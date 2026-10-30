(() => {
  const adminNav = document.querySelector(".admin-nav");
  if (!adminNav) return;

  const adminNavItems = Array.from(adminNav.querySelectorAll(".admin-nav-link:not(:disabled)"));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  let adminNavCenters = new Map();

  function resetAdminNav() {
    adminNavItems.forEach((item) => {
      item.dataset.near = "false";
      item.style.removeProperty("width");
      item.style.removeProperty("height");
      item.style.removeProperty("transform");
      item.style.setProperty("--spec-bright", "0");
    });
  }

  function measureAdminNav() {
    resetAdminNav();
    adminNavCenters = new Map(adminNavItems.map((item) => {
      const rect = item.getBoundingClientRect();
      return [item, { width: rect.width, height: rect.height, centerY: rect.top + rect.height / 2 }];
    }));
  }

  function focusAdminNavItem(focusedItem) {
    adminNavItems.forEach((item) => {
      item.dataset.near = String(item === focusedItem);
    });
  }

  if (!reduceMotion.matches && finePointer.matches) {
    measureAdminNav();
    window.addEventListener("resize", measureAdminNav);
    adminNav.addEventListener("pointermove", (event) => {
      if (event.pointerType === "touch") return;
      const rect = adminNav.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const brightness = Math.max(0, Math.min(1, 1 - Math.hypot(dx, dy) / 240));

      adminNavItems.forEach((item) => {
        const baseSize = adminNavCenters.get(item);
        if (!baseSize) return;
        const proximity = Math.max(0, 1 - Math.abs(event.clientY - baseSize.centerY) / 72);
        const lift = proximity * proximity * (3 - 2 * proximity);
        item.dataset.near = String(lift > 0.08);
        item.style.width = `${baseSize.width + Math.min(18, baseSize.width * 0.12) * lift}px`;
        item.style.height = `${baseSize.height + 12 * lift}px`;
        item.style.transform = `translateY(${3.5 * lift}px)`;
        item.style.setProperty("--spec-angle", `${Math.atan2(dy, dx)}rad`);
        item.style.setProperty("--spec-bright", `${brightness * brightness * 0.92}`);
      });
    });
    adminNav.addEventListener("pointerleave", resetAdminNav);
  }

  adminNav.addEventListener("focusin", (event) => {
    const focused = event.target.closest(".admin-nav-link");
    if (focused) focusAdminNavItem(focused);
  });
  adminNav.addEventListener("focusout", () => {
    window.requestAnimationFrame(() => {
      if (!adminNav.contains(document.activeElement)) resetAdminNav();
    });
  });
})();
