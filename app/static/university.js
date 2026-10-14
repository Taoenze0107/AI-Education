"use strict";

// Enhance the existing navigation without changing routes or the mounted form.
(() => {
  const header = document.querySelector(".site-header");
  const toggle = document.getElementById("universityNavToggle");
  const nav = document.getElementById("universityPrimaryNav");
  if (!header || !toggle || !nav) return;
  header.classList.add("nav-enhanced");
  const setOpen = (open) => {
    header.classList.toggle("nav-is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.querySelector("span").textContent = open ? "关闭" : "菜单";
  };
  toggle.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) setOpen(false);
  });
  header.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
      setOpen(false);
      toggle.focus();
    }
  });
  const breakpoint = matchMedia("(max-width: 900px)");
  breakpoint.addEventListener("change", () => {
    const focusInNavigation = nav.contains(document.activeElement);
    setOpen(false);
    if (breakpoint.matches && focusInNavigation) toggle.focus();
  });
})();
