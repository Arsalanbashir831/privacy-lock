import http from "node:http";
import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, timingSafeEqual } from "node:crypto";

const ROOT = dirname(fileURLToPath(import.meta.url));
const STORE = join(ROOT, ".data", "secrets");
const PORT = Number(process.env.PORT || 3000);
const MAX_BODY = 8 * 1024 * 1024;
const MAX_TTL = 7 * 24 * 60 * 60 * 1000;
const ID_RE = /^[A-Za-z0-9_-]{20,32}$/;
const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".png": "image/png",
  ".svg": "image/svg+xml", ".txt": "text/plain; charset=utf-8"
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

async function inspectSecret(id, res) {
  try {
    const record = JSON.parse(await readFile(join(STORE, `${id}.json`), "utf8"));
    if (record.expiresAt <= Date.now()) {
      await unlink(join(STORE, `${id}.json`)).catch(() => {});
      return json(res, 410, { error: "This secret has expired" });
    }
    return json(res, 200, {
      available: true,
      requiresPassphrase: record.requiresPassphrase,
      consumeToken: record.consumeToken,
      expiresAt: record.expiresAt
    });
  } catch (error) {
    if (error.code === "ENOENT") return json(res, 404, { error: "Secret not found or already opened" });
    throw error;
  }
}

async function consumeSecret(req, id, res) {
  if (!allow(req, 30)) return json(res, 429, { error: "Too many requests" });
  const source = join(STORE, `${id}.json`);
  const claimed = join(STORE, `.${id}.${randomBytes(8).toString("hex")}.claimed`);
  const request = await body(req);
  let current;
  try { current = JSON.parse(await readFile(source, "utf8")); }
  catch (error) {
    if (error.code === "ENOENT") return json(res, 404, { error: "Secret not found or already opened" });
    throw error;
  }
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
    : (pathname === "/" ? "/index.html" : pathname);
  const relative = normalize(decodeURIComponent(requested)).replace(/^(\.\.(\/|\\|$))+/, "");
  const file = join(ROOT, relative);
  if (!file.startsWith(ROOT) || !Object.hasOwn(MIME, extname(file))) return json(res, 404, { error: "Not found" });
  try {
    const content = await readFile(file);
    res.writeHead(200, headers({
      "Content-Type": MIME[extname(file)],
      "Cache-Control": [".html", ".css", ".js"].includes(extname(file)) ? "no-cache" : "public, max-age=3600"
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
    if (req.method === "GET" && url.pathname === "/healthz") {
      return json(res, 200, { status: "ok" });
    }
    if (req.method === "POST" && url.pathname === "/api/secrets") return await createSecret(req, res);
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
