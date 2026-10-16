"use strict";
// A nonce announces an account change without placing account details in storage.
(() => {
  const key = "at-account-change";
  let receiving = false;
  window.addEventListener("lab-account-changed", () => {
    if (receiving) return;
    try { localStorage.setItem(key, `${Date.now()}-${Math.random()}`); } catch (_) {}
  });
  window.addEventListener("storage", event => {
    if (event.key !== key || !event.newValue) return;
    receiving = true;
    for (const storage of [localStorage, sessionStorage]) {
      try { for (const name of Object.keys(storage)) if (name.startsWith("at-lab-tutor-") || name.startsWith("at-practice-")) storage.removeItem(name); } catch (_) {}
    }
    window.dispatchEvent(new Event("lab-account-changed"));
    // Recreate this tab with the current owner; no prior account's form or cached
    // course answers should remain visible after signing out in another tab.
    location.reload();
  });
})();
