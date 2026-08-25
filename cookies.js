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

  let banner = document.getElementById("cookie-banner");
  if (!banner) {
    banner = document.createElement("aside");
    banner.className = "cookie-banner";
    banner.id = "cookie-banner";
    banner.hidden = true;
    banner.setAttribute("aria-labelledby", "cookie-title");
    banner.setAttribute("aria-describedby", "cookie-copy");
    const privacyPath = `${prefix}privacy.html#cookies`;
    banner.innerHTML = `<div class="cookie-copy"><p class="cookie-kicker" id="cookie-title">Advertising notice</p><p id="cookie-copy">AdSense code is installed and Google may use cookies or similar identifiers when advertising is enabled. This notice only remembers its dismissal; regional advertising-consent controls are provided separately. <a href="${privacyPath}">Read our cookie policy</a>.</p></div><div class="cookie-actions"><button class="cookie-button" type="button" data-cookie-choice="dismissed">Dismiss</button></div>`;
    document.body.appendChild(banner);
  }

  const preferenceKey = "privacy-lock-cookie-choice";
  let savedChoice = null;

  try {
    savedChoice = window.localStorage.getItem(preferenceKey);
  } catch (_) {
    // Storage may be unavailable in strict privacy modes; the banner still works.
  }

  if (!savedChoice) banner.hidden = false;

  banner.querySelectorAll("[data-cookie-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      try {
        window.localStorage.setItem(preferenceKey, button.dataset.cookieChoice);
      } catch (_) {
        // Dismiss for this page view if storage is blocked.
      }
      banner.hidden = true;
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
      banner.querySelector("button")?.focus();
    });
  });
})();
