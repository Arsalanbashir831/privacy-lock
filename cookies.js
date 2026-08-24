(function () {
  const banner = document.getElementById("cookie-banner");
  if (!banner) return;

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
