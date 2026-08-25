import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import test from "node:test";
import { isPublicFile, PUBLIC_FILES, PUBLIC_ROUTES } from "../public-files.mjs";

const verificationFile = /^google[a-f0-9]+\.html$/;
const pages = [
  ...readdirSync(".").filter((file) => file.endsWith(".html") && !verificationFile.test(file)),
  ...readdirSync("guides").filter((file) => file.endsWith(".html")).map((file) => `guides/${file}`)
  ,...readdirSync("alternatives").filter((file) => file.endsWith(".html")).map((file) => `alternatives/${file}`)
];

test("every public page has discovery and accessibility metadata", () => {
  assert.ok(pages.length > 0);
  for (const file of pages) {
    const html = readFileSync(file, "utf8");
    assert.match(html, /<html lang="en">/, `${file}: language`);
    assert.match(html, /<title>[^<]+<\/title>/, `${file}: title`);
    assert.match(html, /<meta name="description"/, `${file}: description`);
    assert.match(html, /<link rel="canonical" href="https:\/\/secretshare\.dev\//, `${file}: canonical`);
    assert.match(html, /<meta property="og:title"/, `${file}: Open Graph title`);
    assert.match(html, /<meta property="og:url"/, `${file}: Open Graph URL`);
    assert.match(html, /pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=ca-pub-2654122264996557/, `${file}: AdSense publisher code`);
    assert.match(html, /<h1\b/, `${file}: H1`);
    assert.match(html, /<nav class="topnav"/, `${file}: main navigation`);
  }
});

test("all local links resolve", () => {
  for (const file of pages) {
    const html = readFileSync(file, "utf8");
    for (const match of html.matchAll(/href="([^"]+)"/g)) {
      const href = match[1];
      if (/^(?:https?:|mailto:|#)/.test(href)) continue;
      const clean = href.split("#")[0].split("?")[0];
      if (!clean) continue;
      if (clean === "/" || (clean.startsWith("/") && PUBLIC_ROUTES.has(clean))) continue;
      const target = clean.startsWith("/")
        ? clean.slice(1)
        : normalize(join(dirname(file), clean));
      assert.ok(existsSync(target), `${file}: ${href}`);
    }
  }
});

test("guides expose editorial accountability and article schema", () => {
  const guides = pages.filter((file) => file.startsWith("guides/"));
  assert.equal(guides.length, 10);
  for (const file of guides) {
    const html = readFileSync(file, "utf8");
    assert.match(html, /By SecretShare Editorial Team/);
    assert.match(html, /Reviewed 24 August 2026/);
    assert.match(html, /<script type="application\/ld\+json">/);
    assert.match(html, /Sources and review basis/);
  }
});

test("robots and sitemap expose the production origin", () => {
  const robots = readFileSync("robots.txt", "utf8");
  assert.match(robots, /Sitemap: https:\/\/secretshare\.dev\/sitemap\.xml/);
  assert.match(robots, /User-agent: OAI-SearchBot\s+Allow: \//);
  const sitemap = readFileSync("sitemap.xml", "utf8");
  assert.match(sitemap, /<loc>https:\/\/secretshare\.dev\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/secretshare\.dev\/resources\.html<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/secretshare\.dev\/alternatives<\/loc>/);
});

test("answer-engine content is factual, visible, and machine-readable", () => {
  const homepage = readFileSync("index.html", "utf8");
  assert.match(homepage, /<h2 class="h2" id="why-secretshare">What is SecretShare\?<\/h2>/);
  assert.match(homepage, /"SoftwareApplication"/);
  assert.match(homepage, /"applicationCategory":"SecurityApplication"/);
  assert.match(homepage, /"price":"0"/);

  const comparison = readFileSync("alternatives.html", "utf8");
  assert.match(comparison, /<table class="comparison-table">/);
  assert.match(comparison, /Sources and methodology/);
  assert.match(comparison, /"ItemList"/);

  const llms = readFileSync("llms.txt", "utf8");
  assert.match(llms, /maximum supported file size is 150 MB/i);
  assert.doesNotMatch(llms, /up to 100 MB/i);
  assert.equal(isPublicFile("llms.txt"), true);
});

test("the 150 MB file limit is consistent across browser, server, and proxy", () => {
  const app = readFileSync("app.js", "utf8");
  const server = readFileSync("server.mjs", "utf8");
  const nginx = readFileSync("ops/nginx-secretshare.conf", "utf8");
  assert.match(app, /const MAX_FILE_SIZE = 150 \* 1024 \* 1024;/);
  assert.match(app, /fetch\("\/api\/secrets\/binary"/);
  assert.match(server, /const MAX_FILE_SIZE = 150 \* 1024 \* 1024;/);
  assert.match(server, /url\.pathname === "\/api\/secrets\/binary"/);
  assert.match(nginx, /client_max_body_size 151m;/);
  assert.match(readFileSync("encrypted-file-sharing.html", "utf8"), /files up to 150 MB/i);
});

test("the static server allowlist exposes only intentional public files", () => {
  for (const file of PUBLIC_FILES) {
    assert.ok(existsSync(file), `allowlisted file is missing: ${file}`);
    assert.equal(isPublicFile(file), true);
  }

  for (const [route, file] of PUBLIC_ROUTES) {
    assert.ok(route.startsWith("/"), `clean route must start with a slash: ${route}`);
    assert.ok(PUBLIC_FILES.has(file), `clean route target must be allowlisted: ${file}`);
  }

  for (const file of [
    "server.mjs",
    "public-files.mjs",
    "package.json",
    "README.md",
    "ADSENSE_READINESS.md",
    "Dockerfile",
    "compose.yaml",
    ".gitignore",
    ".github/workflows/deploy.yml",
    "ops/nginx-secretshare.conf",
    "test/site.test.js",
    ".data/secrets/example.json"
  ]) {
    assert.equal(isPublicFile(file), false, `private file was allowlisted: ${file}`);
  }
});
