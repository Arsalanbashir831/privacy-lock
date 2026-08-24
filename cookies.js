(function () {
  let banner = document.getElementById("cookie-banner");
  if (!banner) {
    banner = document.createElement("aside");
    banner.className = "cookie-banner";
    banner.id = "cookie-banner";
    banner.hidden = true;
    banner.setAttribute("aria-labelledby", "cookie-title");
    banner.setAttribute("aria-describedby", "cookie-copy");
    const privacyPath = window.location.pathname.includes("/guides/") ? "../privacy.html#cookies" : "privacy.html#cookies";
    banner.innerHTML = `<div class="cookie-copy"><p class="cookie-kicker" id="cookie-title">Privacy preference</p><p id="cookie-copy">We don’t use advertising or analytics cookies. We only save your choice on this device so this notice stays dismissed. <a href="${privacyPath}">Read our cookie policy</a>.</p></div><div class="cookie-actions"><button class="cookie-button cookie-button-secondary" type="button" data-cookie-choice="declined">Decline</button><button class="cookie-button" type="button" data-cookie-choice="accepted">Accept</button></div>`;
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
