import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import test from "node:test";

const verificationFile = /^google[a-f0-9]+\.html$/;
const pages = [
  ...readdirSync(".").filter((file) => file.endsWith(".html") && !verificationFile.test(file)),
  ...readdirSync("guides").filter((file) => file.endsWith(".html")).map((file) => `guides/${file}`)
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
  assert.match(readFileSync("robots.txt", "utf8"), /Sitemap: https:\/\/secretshare\.dev\/sitemap\.xml/);
  const sitemap = readFileSync("sitemap.xml", "utf8");
  assert.match(sitemap, /<loc>https:\/\/secretshare\.dev\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/secretshare\.dev\/resources\.html<\/loc>/);
});
