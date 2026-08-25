export const PUBLIC_FILES = new Set([
  "index.html",
  "about.html",
  "api.html",
  "contact.html",
  "privacy.html",
  "resources.html",
  "security.html",
  "status.html",
  "terms.html",
  "google71faf693e083cc39.html",
  "guides/client-side-encryption.html",
  "guides/env-files.html",
  "guides/link-preview-bots.html",
  "guides/rotate-exposed-secret.html",
  "guides/secret-expiration.html",
  "guides/secret-sharing-options.html",
  "guides/service-accounts.html",
  "guides/sharing-credentials.html",
  "guides/ssh-keys.html",
  "guides/url-fragment-keys.html",
  "assets/secretshare-transparent.png",
  "assets/secretsharelogo-favicon.png",
  "app.js",
  "cookies.js",
  "styles.css",
  "robots.txt",
  "sitemap.xml",
  "ads.txt"
]);

export function isPublicFile(pathname) {
  return typeof pathname === "string" && PUBLIC_FILES.has(pathname);
}
