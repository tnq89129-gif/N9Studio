(() => {
  const userStorageKey = "storeUsers";
  const persistentSessionKey = "storeSession";
  const temporarySessionKey = "storeSession";
  const authForm = document.getElementById("auth-form");
  const authStatus = document.getElementById("form-status");

  function readUsers() {
    const storedUsers = window.localStorage.getItem(userStorageKey);
    if (storedUsers === null) return [];
    const users = JSON.parse(storedUsers);
    if (!Array.isArray(users) || users.some((user) =>
      !user || typeof user.email !== "string" || typeof user.passwordHash !== "string" ||
      typeof user.passwordSalt !== "string"
    )) {
      throw new Error("Dữ liệu tài khoản không hợp lệ. Hãy kiểm tra khóa storeUsers trong localStorage.");
    }
    return users;
  }

  function getCurrentUser() {
    const storedSession = window.localStorage.getItem(persistentSessionKey) ||
      window.sessionStorage.getItem(temporarySessionKey);
    if (!storedSession) return null;
    const session = JSON.parse(storedSession);
    if (!session || typeof session.email !== "string" || typeof session.name !== "string") {
      throw new Error("Phiên đăng nhập không hợp lệ. Hãy đăng nhập lại.");
    }
    return session;
  }

  function setCurrentUser(user, remember) {
    const session = JSON.stringify({ name: user.name, email: user.email });
    window.localStorage.removeItem(persistentSessionKey);
    window.sessionStorage.removeItem(temporarySessionKey);
    if (remember) {
      window.localStorage.setItem(persistentSessionKey, session);
    } else {
      window.sessionStorage.setItem(temporarySessionKey, session);
    }
  }

  function setAuthMessage(message, isError) {
    if (!authStatus) return;
    authStatus.textContent = message;
    authStatus.dataset.state = isError ? "error" : "success";
  }

  function bytesToHex(bytes) {
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  async function hashPassword(password, salt) {
    if (!window.crypto?.subtle) {
      throw new Error("Trình duyệt không hỗ trợ mã hóa mật khẩu. Hãy mở website bằng localhost hoặc HTTPS.");
    }
    const encoder = new TextEncoder();
    const key = await window.crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    const bits = await window.crypto.subtle.deriveBits({
      name: "PBKDF2",
      salt: encoder.encode(salt),
      iterations: 120000,
      hash: "SHA-256"
    }, key, 256);
    return bytesToHex(new Uint8Array(bits));
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    if (!authForm || !authForm.reportValidity()) return;

    const values = new FormData(authForm);
    const email = String(values.get("email") || "").trim().toLocaleLowerCase("vi");
    const password = String(values.get("password") || "");

    try {
      const users = readUsers();
      if (authForm.dataset.authMode === "register") {
        const name = String(values.get("fullName") || "").trim();
        const confirmPassword = String(values.get("confirmPassword") || "");
        if (password !== confirmPassword) {
          document.getElementById("confirm-password")?.setCustomValidity("Mật khẩu xác nhận chưa khớp.");
          authForm.reportValidity();
          return;
        }
        if (!values.has("terms")) {
          setAuthMessage("Vui lòng đồng ý với các điều khoản để tiếp tục.", true);
          return;
        }
        if (users.some((user) => user.email.toLocaleLowerCase("vi") === email)) {
          setAuthMessage("Email này đã được đăng ký. Hãy đăng nhập hoặc dùng email khác.", true);
          return;
        }
        const saltBytes = window.crypto.getRandomValues(new Uint8Array(16));
        const passwordSalt = bytesToHex(saltBytes);
        const newUser = {
          id: window.crypto.randomUUID(),
          name,
          email,
          passwordSalt,
          passwordHash: await hashPassword(password, passwordSalt),
          createdAt: new Date().toISOString()
        };
        window.localStorage.setItem(userStorageKey, JSON.stringify([...users, newUser]));
        setCurrentUser(newUser, true);
      } else {
        const user = users.find((item) => item.email.toLocaleLowerCase("vi") === email);
        if (!user || await hashPassword(password, user.passwordSalt) !== user.passwordHash) {
          setAuthMessage("Email hoặc mật khẩu không chính xác.", true);
          return;
        }
        setCurrentUser(user, values.has("remember"));
      }
      window.location.href = "../TaiKhoan/index.html";
    } catch (error) {
      console.error("Không thể xử lý tài khoản:", error);
      setAuthMessage(error.message || "Không thể xử lý yêu cầu. Vui lòng thử lại.", true);
    }
  }

  function refreshAuthNavigation() {
    const user = getCurrentUser();
    document.querySelectorAll(".site-dock, .dock").forEach((nav) => {
      const links = Array.from(nav.querySelectorAll("a"));
      const loginLink = links.find((link) => /DangNhap\/index\.html$/.test(link.getAttribute("href") || ""));
      const registerLink = links.find((link) => /DangKy\/index\.html$/.test(link.getAttribute("href") || ""));
      const logoutLink = links.find((link) => link.hasAttribute("data-logout"));
      if (loginLink) loginLink.hidden = Boolean(user);
      if (registerLink) registerLink.hidden = Boolean(user);

      if (user && !logoutLink && loginLink) {
        const link = document.createElement("a");
        link.className = loginLink.className;
        link.textContent = "Đăng xuất";
        link.href = "#logout";
        link.dataset.logout = "";
        nav.append(link);
      } else if (logoutLink) {
        logoutLink.hidden = !user;
        if (user) logoutLink.href = "#logout";
      }
    });
  }

  document.addEventListener("click", (event) => {
    const logoutLink = event.target.closest("[data-logout]");
    if (!logoutLink) return;
    event.preventDefault();
    window.localStorage.removeItem(persistentSessionKey);
    window.sessionStorage.removeItem(temporarySessionKey);
    window.location.href = "../DangNhap/index.html";
  });

  if (authForm) {
    authForm.addEventListener("submit", handleAuthSubmit);
    const password = document.getElementById("password");
    const confirmPassword = document.getElementById("confirm-password");
    if (password && confirmPassword) {
      const validatePasswordMatch = () => {
        confirmPassword.setCustomValidity(
          !confirmPassword.value || password.value === confirmPassword.value
            ? ""
            : "Mật khẩu xác nhận chưa khớp."
        );
      };
      password.addEventListener("input", validatePasswordMatch);
      confirmPassword.addEventListener("input", validatePasswordMatch);
    }
  }

  try {
    refreshAuthNavigation();
  } catch (error) {
    console.error("Không thể tải phiên đăng nhập:", error);
    setAuthMessage(error.message || "Không thể tải phiên đăng nhập.", true);
  }

  window.storeAuth = { getCurrentUser };

  document.querySelectorAll("[data-password-toggle]").forEach((toggle) => {
    const input = document.getElementById(toggle.getAttribute("aria-controls"));
    if (!input) return;

    toggle.addEventListener("click", () => {
      const shouldReveal = input.type === "password";
      input.type = shouldReveal ? "text" : "password";
      toggle.setAttribute("aria-pressed", String(shouldReveal));
      toggle.setAttribute("aria-label", shouldReveal ? "Ẩn mật khẩu" : "Hiện mật khẩu");
    });
  });

  const nav = document.querySelector(".site-dock");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

  const cartBadge = document.getElementById("cart-badge");
  if (cartBadge) {
    try {
      const cart = JSON.parse(window.localStorage.getItem("cart") || "[]");
      if (!Array.isArray(cart)) throw new Error("Dữ liệu giỏ hàng không hợp lệ.");
      const count = cart.reduce((total, item) => total + (Number(item.quantity) || 0), 0);
      cartBadge.textContent = String(count);
    } catch (error) {
      console.error("Không thể cập nhật số lượng giỏ hàng:", error);
      cartBadge.textContent = "!";
      cartBadge.setAttribute("aria-label", "Không thể đọc giỏ hàng");
    }
  }

  window.addEventListener("storage", (event) => {
    if (event.key === "storeSession" || event.key === null) {
      try {
        refreshAuthNavigation();
      } catch (error) {
        console.error("Không thể cập nhật điều hướng tài khoản:", error);
      }
    }
    if (cartBadge && (event.key === "cart" || event.key === null)) {
      try {
        const cart = JSON.parse(window.localStorage.getItem("cart") || "[]");
        if (!Array.isArray(cart)) throw new Error("Dữ liệu giỏ hàng không hợp lệ.");
        cartBadge.textContent = String(
          cart.reduce((total, item) => total + (Number(item.quantity) || 0), 0)
        );
        cartBadge.removeAttribute("aria-label");
      } catch (error) {
        console.error("Không thể cập nhật số lượng giỏ hàng:", error);
        cartBadge.textContent = "!";
        cartBadge.setAttribute("aria-label", "Không thể đọc giỏ hàng");
      }
    }
  });

  if (!nav || reduceMotion.matches || !finePointer.matches) return;

  const items = Array.from(nav.querySelectorAll("a"));
  const measurements = [];
  let designUnit = 1;
  let pointerX = 0;
  let pointerY = 0;
  let pointerInside = false;

  function measureItems() {
    items.forEach((item) => {
      item.style.removeProperty("width");
      item.style.removeProperty("height");
      item.style.removeProperty("--lift");
      item.dataset.near = "false";
    });

    designUnit = Math.min(
      window.innerWidth / (window.innerWidth <= 900 ? 760 : 1600),
      1900 / 1600
    );
    measurements.length = 0;
    items.forEach((item) => {
      const rect = item.getBoundingClientRect();
      measurements.push({
        width: rect.width,
        height: rect.height,
        extraWidth: Math.min(18 * designUnit, rect.width * 0.24),
        extraHeight: 16 * designUnit
      });
    });
  }

  function setMagnification(item, amount) {
    const index = items.indexOf(item);
    const size = measurements[index];
    if (!size) return;

    const value = Math.max(0, Math.min(amount, 1.08));
    item.style.width = `${size.width + size.extraWidth * value}px`;
    item.style.height = `${size.height + size.extraHeight * value}px`;
    item.style.setProperty("--lift", `${3.5 * designUnit * value}px`);
    item.dataset.near = value > 0.08 ? "true" : "false";
  }

  function resetMagnification() {
    items.forEach((item) => setMagnification(item, 0));
  }

  function updateFromPointer(event) {
    pointerX = event.clientX;
    pointerY = event.clientY;
    pointerInside = true;

    const navRect = nav.getBoundingClientRect();
    const dx = pointerX - (navRect.left + navRect.width / 2);
    const dy = pointerY - (navRect.top + navRect.height / 2);
    const distance = Math.hypot(dx, dy);
    const brightness = Math.max(0, Math.min(1, 1 - distance / 260));
    nav.style.setProperty("--spec-angle", `${Math.atan2(dy, dx)}rad`);
    nav.style.setProperty("--spec-bright", `${brightness * brightness * 0.92}`);

    items.forEach((item, index) => {
      const rect = item.getBoundingClientRect();
      const proximity = Math.max(0, 1 - Math.abs(pointerX - (rect.left + rect.width / 2)) / (128 * designUnit));
      setMagnification(items[index], proximity * proximity * (3 - 2 * proximity));
    });
  }

  measureItems();
  window.addEventListener("resize", measureItems);
  nav.addEventListener("pointermove", updateFromPointer, { passive: true });
  nav.addEventListener("pointerleave", () => {
    pointerInside = false;
    resetMagnification();
    nav.style.setProperty("--spec-bright", "0");
  });

  nav.addEventListener("focusin", (event) => {
    const focused = event.target.closest("a");
    if (!focused) return;

    items.forEach((item) => {
      const distance = Math.abs(items.indexOf(item) - items.indexOf(focused));
      const proximity = distance === 0 ? 1 : distance === 1 ? 0.24 : 0;
      setMagnification(item, proximity);
    });
  });

  nav.addEventListener("focusout", () => {
    requestAnimationFrame(() => {
      if (!nav.contains(document.activeElement)) {
        resetMagnification();
        nav.style.setProperty("--spec-bright", pointerInside ? ".35" : "0");
      }
    });
  });
})();
