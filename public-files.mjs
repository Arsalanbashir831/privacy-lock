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
  "encrypted-file-sharing.html",
  "one-time-file-download.html",
  "alternatives.html",
  "alternatives/one-time-secret.html",
  "alternatives/bitwarden-send.html",
  "alternatives/yopass.html",
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
  "ads.txt",
  "llms.txt"
]);

export const PUBLIC_ROUTES = new Map([
  ["/encrypted-file-sharing", "encrypted-file-sharing.html"],
  ["/one-time-file-download", "one-time-file-download.html"],
  ["/alternatives", "alternatives.html"],
  ["/alternatives/one-time-secret", "alternatives/one-time-secret.html"],
  ["/alternatives/bitwarden-send", "alternatives/bitwarden-send.html"],
  ["/alternatives/yopass", "alternatives/yopass.html"]
]);

export function isPublicFile(pathname) {
  return typeof pathname === "string" && PUBLIC_FILES.has(pathname);
}

export function resolvePublicRoute(pathname) {
  return PUBLIC_ROUTES.get(pathname);
}

export function canonicalRouteForFile(pathname) {
  for (const [route, file] of PUBLIC_ROUTES) {
    if (pathname === `/${file}`) return route;
  }
  return null;
}
