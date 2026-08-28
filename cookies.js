(function () {
  const inNestedSection = window.location.pathname.includes("/guides/") || window.location.pathname.includes("/alternatives/");
  const prefix = inNestedSection ? "../" : "";
  const topbar = document.querySelector(".topbar-inner");
  const navigation = topbar?.querySelector(".topnav");
  if (topbar && navigation) {
    document.body.classList.add("has-menu");
    navigation.setAttribute("aria-label", "Main");
    navigation.innerHTML = `<a href="${prefix}index.html">Home</a><a href="${prefix}index.html#compose">Send a secret</a><a href="${prefix}resources.html">Guides</a><a href="${prefix}security.html">Security</a><a href="${prefix}about.html">About</a><a href="${prefix}contact.html">Contact</a>`;
    const menuButton = document.createElement("button");
    menuButton.className = "menu-button";
    menuButton.type = "button";
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "Open navigation");
    menuButton.textContent = "Menu";
    menuButton.addEventListener("click", () => {
      const open = navigation.classList.toggle("is-open");
      menuButton.setAttribute("aria-expanded", String(open));
      menuButton.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
      menuButton.textContent = open ? "Close" : "Menu";
    });
    topbar.insertBefore(menuButton, navigation);
  }

  /*
   * Advertising is temporarily disabled so SecretShare runs as a completely
   * free, ad-free tool. Keep this implementation commented for easy review or
   * a future opt-in reintroduction; none of the code below executes.
   *
  function adFrame(source, label, className) {
    const zone = document.createElement("aside");
    zone.className = `ad-zone ${className === "ad-frame-rectangle" ? "ad-zone-bottom" : "ad-zone-middle"}`;
    zone.setAttribute("aria-label", label);
    const caption = document.createElement("p");
    caption.className = "ad-zone-label";
    caption.textContent = "Sponsored";
    const frame = document.createElement("iframe");
    frame.className = `ad-frame ${className}`;
    frame.src = source;
    frame.title = label;
    frame.loading = "lazy";
    frame.referrerPolicy = "no-referrer";
    frame.setAttribute("sandbox", "allow-scripts allow-popups");
    zone.append(caption, frame);
    return zone;
  }

  function mountAds() {
    if (/^\/s\/[A-Za-z0-9_-]{20,32}$/.test(window.location.pathname) || document.querySelector("[data-ad-mounted]")) return;
    const main = document.querySelector("main");
    const footer = document.querySelector("footer");
    if (!main || !footer) return;
    const marker = document.createElement("span");
    marker.hidden = true;
    marker.dataset.adMounted = "true";
    document.body.appendChild(marker);

    const path = window.location.pathname;
    const isHomepage = path === "/" || path.endsWith("/index.html");
    const isEditorial = isHomepage || path.includes("/guides/") || path.includes("/alternatives") ||
      path.endsWith("/resources.html") || path.endsWith("/encrypted-file-sharing") ||
      path.endsWith("/one-time-file-download");

    if (isEditorial) {
      const sections = [...main.querySelectorAll(":scope > section")];
      const middleAnchor = isHomepage ? main.querySelector(".spec") : sections[Math.max(0, Math.floor(sections.length / 2) - 1)];
      middleAnchor?.after(adFrame("/ads/native.html", "Sponsored recommendations", "ad-frame-native"));
    }
    footer.before(adFrame("/ads/rectangle.html", "Sponsored advertisement", "ad-frame-rectangle"));
  }

  function unmountAds() {
    document.querySelectorAll(".ad-zone,[data-ad-mounted]").forEach((element) => element.remove());
  }

  let banner = document.getElementById("cookie-banner");
  const privacyPath = `${prefix}privacy.html#cookies`;
  if (!banner) {
    banner = document.createElement("aside");
    banner.className = "cookie-banner";
    banner.id = "cookie-banner";
    banner.hidden = true;
    banner.setAttribute("aria-labelledby", "cookie-title");
    banner.setAttribute("aria-describedby", "cookie-copy");
    document.body.appendChild(banner);
  }
  banner.innerHTML = `<div class="cookie-copy"><p class="cookie-kicker" id="cookie-title">Advertising choice</p><p id="cookie-copy">Allowing ads displays Google and other advertising partners inside isolated frames. Declining keeps these display units disabled; the AdSense verification loader remains installed. <a href="${privacyPath}">Read our cookie policy</a>.</p></div><div class="cookie-actions"><button class="cookie-button" type="button" data-cookie-choice="declined">Decline</button><button class="cookie-button" type="button" data-cookie-choice="accepted">Allow ads</button></div>`;

  const preferenceKey = "privacy-lock-cookie-choice";
  let savedChoice = null;

  try {
    savedChoice = window.localStorage.getItem(preferenceKey);
  } catch (_) {
    // Storage may be unavailable in strict privacy modes; the banner still works.
  }

  if (savedChoice === "dismissed") savedChoice = null;
  if (!savedChoice) banner.hidden = false;
  if (savedChoice === "accepted") mountAds();

  banner.querySelectorAll("[data-cookie-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      try {
        window.localStorage.setItem(preferenceKey, button.dataset.cookieChoice);
      } catch (_) {
        // Dismiss for this page view if storage is blocked.
      }
      banner.hidden = true;
      if (button.dataset.cookieChoice === "accepted") mountAds();
      else unmountAds();
    });
  });

  document.querySelectorAll("[data-reset-cookie-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      try {
        window.localStorage.removeItem(preferenceKey);
      } catch (_) {
        // The visible confirmation remains useful when storage is blocked.
      }
      banner.hidden = false;
      unmountAds();
      banner.querySelector("button")?.focus();
    });
  });
  */
})();
