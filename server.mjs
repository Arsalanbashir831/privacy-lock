import http from "node:http";
import { createReadStream } from "node:fs";
import { mkdir, open, readFile, rename, stat, unlink } from "node:fs/promises";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { canonicalRouteForFile, isPublicFile, resolvePublicRoute } from "./public-files.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const STORE = join(ROOT, ".data", "secrets");
const PORT = Number(process.env.PORT || 3000);
const MAX_BODY = 8 * 1024 * 1024;
const MAX_FILE_SIZE = 150 * 1024 * 1024;
const MAX_BINARY_CIPHERTEXT = MAX_FILE_SIZE + 64 * 1024;
const MAX_TTL = 7 * 24 * 60 * 60 * 1000;
const ID_RE = /^[A-Za-z0-9_-]{20,32}$/;
const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".png": "image/png",
    ".svg": "image/svg+xml", ".xml": "application/xml; charset=utf-8", ".txt": "text/plain; charset=utf-8"
};
const rate = new Map();

await mkdir(STORE, { recursive: true, mode: 0o700 });

function headers(extra = {}) {
  return {
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    ...extra
  };
}

function json(res, status, value) {
  res.writeHead(status, headers({ "Content-Type": "application/json; charset=utf-8" }));
  res.end(JSON.stringify(value));
}

function allow(req, limit = 60) {
  const ip = req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const current = rate.get(ip);
  if (!current || current.reset < now) {
    rate.set(ip, { count: 1, reset: now + 60_000 });
    return true;
  }
  current.count += 1;
  return current.count <= limit;
}

async function body(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw Object.assign(new Error("Payload too large"), { status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw Object.assign(new Error("Invalid JSON"), { status: 400 }); }
}

async function binaryBodyToFile(req, target) {
  const declaredLength = Number(req.headers["content-length"] || 0);
  if (!Number.isFinite(declaredLength) || declaredLength < 20 || declaredLength > MAX_BINARY_CIPHERTEXT) {
    throw Object.assign(new Error("Encrypted payload too large"), { status: 413 });
  }
  const handle = await open(target, "wx", 0o600);
  let size = 0;
  try {
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_BINARY_CIPHERTEXT) throw Object.assign(new Error("Encrypted payload too large"), { status: 413 });
      await handle.write(chunk);
    }
    if (size !== declaredLength) throw Object.assign(new Error("Incomplete encrypted payload"), { status: 400 });
    return size;
  } finally {
    await handle.close();
  }
}

function validBase64(value, min, max) {
  return typeof value === "string" && value.length >= min && value.length <= max && /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}

async function createSecret(req, res) {
  if (!allow(req, 20)) return json(res, 429, { error: "Too many requests" });
  const data = await body(req);
  const expiresAt = Number(data.expiresAt);
  if (!validBase64(data.ciphertext, 20, 7_500_000) || !validBase64(data.iv, 16, 24) ||
      !validBase64(data.salt, 20, 32) || !Number.isFinite(expiresAt) ||
      expiresAt <= Date.now() || expiresAt > Date.now() + MAX_TTL + 60_000) {
    return json(res, 400, { error: "Invalid encrypted payload" });
  }
  const record = {
    version: 1,
    ciphertext: data.ciphertext,
    iv: data.iv,
    salt: data.salt,
    requiresPassphrase: Boolean(data.requiresPassphrase),
    consumeToken: randomBytes(24).toString("base64url"),
    createdAt: Date.now(),
    expiresAt
  };
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const id = randomBytes(16).toString("base64url");
    try {
      const handle = await open(join(STORE, `${id}.json`), "wx", 0o600);
      await handle.writeFile(JSON.stringify(record));
      await handle.close();
      return json(res, 201, { id, expiresAt });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
  throw new Error("Could not allocate an identifier");
}

async function createBinarySecret(req, res) {
  if (!allow(req, 10)) return json(res, 429, { error: "Too many requests" });
  const expiresAt = Number(req.headers["x-secret-expires-at"]);
  const iv = String(req.headers["x-secret-iv"] || "");
  const salt = String(req.headers["x-secret-salt"] || "");
  if (!validBase64(iv, 16, 24) || !validBase64(salt, 20, 32) || !Number.isFinite(expiresAt) ||
      expiresAt <= Date.now() || expiresAt > Date.now() + MAX_TTL + 60_000) {
    return json(res, 400, { error: "Invalid encrypted payload metadata" });
  }
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const id = randomBytes(16).toString("base64url");
    const payloadPath = join(STORE, `${id}.bin`);
    const metadataPath = join(STORE, `${id}.json`);
    let metadata;
    try {
      metadata = await open(metadataPath, "wx", 0o600);
      const ciphertextLength = await binaryBodyToFile(req, payloadPath);
      const record = {
        version: 2, iv, salt,
        requiresPassphrase: req.headers["x-secret-passphrase"] === "1",
        consumeToken: randomBytes(24).toString("base64url"),
        ciphertextLength, createdAt: Date.now(), expiresAt
      };
      await metadata.writeFile(JSON.stringify(record));
      await metadata.close();
      return json(res, 201, { id, expiresAt });
    } catch (error) {
      await metadata?.close().catch(() => {});
      await unlink(payloadPath).catch(() => {});
      if (metadata) await unlink(metadataPath).catch(() => {});
      if (error.code === "EEXIST" && !metadata) continue;
      throw error;
    }
  }
  throw new Error("Could not allocate an identifier");
}

async function inspectSecret(id, res) {
  try {
    const record = JSON.parse(await readFile(join(STORE, `${id}.json`), "utf8"));
    if (record.expiresAt <= Date.now()) {
      await unlink(join(STORE, `${id}.json`)).catch(() => {});
      if (record.version === 2) await unlink(join(STORE, `${id}.bin`)).catch(() => {});
      return json(res, 410, { error: "This secret has expired" });
    }
    return json(res, 200, {
      available: true,
      version: record.version || 1,
      requiresPassphrase: record.requiresPassphrase,
      consumeToken: record.consumeToken,
      expiresAt: record.expiresAt
    });
  } catch (error) {
    if (error.code === "ENOENT") return json(res, 404, { error: "Secret not found or already opened" });
    throw error;
  }
}

async function consumeBinarySecret(req, id, current, res) {
  const sourceMetadata = join(STORE, `${id}.json`);
  const sourcePayload = join(STORE, `${id}.bin`);
  const claimId = `.${id}.${randomBytes(8).toString("hex")}`;
  const claimedMetadata = join(STORE, `${claimId}.claimed.json`);
  const claimedPayload = join(STORE, `${claimId}.claimed.bin`);
  const request = await body(req);
  const supplied = Buffer.from(String(request.consumeToken || ""));
  const expected = Buffer.from(String(current.consumeToken || ""));
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return json(res, 403, { error: "Invalid confirmation token" });
  }
  try {
    await rename(sourceMetadata, claimedMetadata);
    await rename(sourcePayload, claimedPayload);
  } catch (error) {
    await unlink(claimedMetadata).catch(() => {});
    await unlink(claimedPayload).catch(() => {});
    if (error.code === "ENOENT") return json(res, 404, { error: "Secret not found or already opened" });
    throw error;
  }
  if (current.expiresAt <= Date.now()) {
    await unlink(claimedMetadata).catch(() => {});
    await unlink(claimedPayload).catch(() => {});
    return json(res, 410, { error: "This secret has expired" });
  }
  const payloadSize = (await stat(claimedPayload)).size;
  res.writeHead(200, headers({
    "Content-Type": "application/octet-stream",
    "Content-Length": payloadSize,
    "X-Secret-IV": current.iv,
    "X-Secret-Salt": current.salt,
    "X-Secret-Passphrase": current.requiresPassphrase ? "1" : "0"
  }));
  const stream = createReadStream(claimedPayload);
  const cleanup = () => {
    unlink(claimedMetadata).catch(() => {});
    unlink(claimedPayload).catch(() => {});
  };
  stream.on("error", (error) => { cleanup(); res.destroy(error); });
  res.on("close", cleanup);
  stream.pipe(res);
}

async function consumeSecret(req, id, res) {
  if (!allow(req, 30)) return json(res, 429, { error: "Too many requests" });
  const source = join(STORE, `${id}.json`);
  const claimed = join(STORE, `.${id}.${randomBytes(8).toString("hex")}.claimed`);
  let current;
  try { current = JSON.parse(await readFile(source, "utf8")); }
  catch (error) {
    if (error.code === "ENOENT") return json(res, 404, { error: "Secret not found or already opened" });
    throw error;
  }
  if (current.version === 2) return consumeBinarySecret(req, id, current, res);
  const request = await body(req);
  const supplied = Buffer.from(String(request.consumeToken || ""));
  const expected = Buffer.from(String(current.consumeToken || ""));
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return json(res, 403, { error: "Invalid confirmation token" });
  }
  try {
    await rename(source, claimed);
  } catch (error) {
    if (error.code === "ENOENT") return json(res, 404, { error: "Secret not found or already opened" });
    throw error;
  }
  try {
    const record = JSON.parse(await readFile(claimed, "utf8"));
    if (record.expiresAt <= Date.now()) return json(res, 410, { error: "This secret has expired" });
    return json(res, 200, {
      ciphertext: record.ciphertext, iv: record.iv, salt: record.salt,
      requiresPassphrase: record.requiresPassphrase
    });
  } finally {
    await unlink(claimed).catch(() => {});
  }
}

async function serveStatic(pathname, res) {
  const requested = /^\/s\/[A-Za-z0-9_-]{20,32}$/.test(pathname)
    ? "/index.html"
    : (pathname === "/" ? "/index.html" : `/${resolvePublicRoute(pathname) || pathname.replace(/^\//, "")}`);
  const relative = normalize(decodeURIComponent(requested)).replace(/^[/\\]+/, "");
  if (!isPublicFile(relative)) return json(res, 404, { error: "Not found" });
  const file = join(ROOT, relative);
  if (!file.startsWith(`${ROOT}/`) || !Object.hasOwn(MIME, extname(file))) return json(res, 404, { error: "Not found" });
  try {
    let content = await readFile(file);
    const extra = {
      "Content-Type": MIME[extname(file)],
      "Cache-Control": [".html", ".css", ".js"].includes(extname(file)) ? "no-cache" : "public, max-age=3600"
    };
    if (extname(file) === ".html") {
      const nonce = randomBytes(16).toString("base64");
      content = Buffer.from(content.toString("utf8").replaceAll("<script", `<script nonce="${nonce}"`));
      extra["Content-Security-Policy"] = `default-src 'self'; object-src 'none'; script-src 'nonce-${nonce}' 'unsafe-inline' 'unsafe-eval' 'strict-dynamic' https: http:; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; frame-src 'self' https:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`;
    }
    res.writeHead(200, headers({
      ...extra
    }));
    res.end(content);
  } catch (error) {
    if (error.code === "ENOENT") return json(res, 404, { error: "Not found" });
    throw error;
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const canonicalRoute = canonicalRouteForFile(url.pathname);
    if ((req.method === "GET" || req.method === "HEAD") && canonicalRoute) {
      res.writeHead(308, headers({ Location: canonicalRoute, "Cache-Control": "public, max-age=86400" }));
      return res.end();
    }
    if (req.method === "GET" && url.pathname === "/healthz") {
      return json(res, 200, { status: "ok" });
    }
    if (req.method === "POST" && url.pathname === "/api/secrets") return await createSecret(req, res);
    if (req.method === "POST" && url.pathname === "/api/secrets/binary") return await createBinarySecret(req, res);
    const match = url.pathname.match(/^\/api\/secrets\/([^/]+)(\/consume)?$/);
    if (match && ID_RE.test(match[1])) {
      if (req.method === "GET" && !match[2]) return await inspectSecret(match[1], res);
      if (req.method === "POST" && match[2]) return await consumeSecret(req, match[1], res);
    }
    if (req.method === "GET" || req.method === "HEAD") return await serveStatic(url.pathname, res);
    return json(res, 405, { error: "Method not allowed" });
  } catch (error) {
    console.error(error);
    return json(res, error.status || 500, { error: error.status ? error.message : "Internal server error" });
  }
});

server.listen(PORT, () => console.log(`Secretshare listening on http://localhost:${PORT}`));
