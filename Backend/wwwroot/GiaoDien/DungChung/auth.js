(() => {
  let currentUser=null;
  const authForm=document.getElementById('auth-form');
  const authStatus=document.getElementById('form-status');
  window.storeAuth={getCurrentUser:()=>currentUser};
  function navigation() {
    document.querySelectorAll('a[href*="DangNhap/"],a[href*="DangKy/"]').forEach(a=>a.hidden=!!currentUser);
    document.querySelectorAll('[data-logout]').forEach(a=>a.hidden=!currentUser);
    document.querySelectorAll('a[href*="QuanTri/"]').forEach(a=>a.hidden=!currentUser?.roles?.includes('Admin'));
    const dock=document.querySelector('.site-dock,.dock');
    if(currentUser&&dock&&!dock.querySelector('[data-logout]')) {
      const a=document.createElement('a');a.href='#logout';a.dataset.logout='';a.textContent='Đăng xuất';dock.append(a);
    }
  }
  window.shopReady=(async()=>{
    try {
      try {const u=await shop.request('/api/tai-khoan/me');currentUser={...u,name:u.fullName};}
      catch(e){if(e.status!==401)throw e;}
      navigation();
      if(location.pathname.includes('/QuanTri/')&&!currentUser?.roles?.includes('Admin')){
        if(!currentUser)location.replace(shop.root+'/NguoiDung/DangNhap/index.html');
        else shop.error(new Error('Bạn không có quyền truy cập khu vực quản trị.'));
        return false;
      }
      if(!currentUser&&/\/(GioHang|DonHang)\//.test(location.pathname)){
        location.replace(shop.root+'/NguoiDung/DangNhap/index.html');return false;
      }
      await shop.badge();return true;
    }catch(e){shop.error(e);return false;}
  })();
  if(authForm)authForm.addEventListener('submit',async event=>{
    event.preventDefault();if(!authForm.reportValidity())return;
    const values=new FormData(authForm),email=String(values.get('email')||'').trim(),password=String(values.get('password')||'');
    await shop.action(authForm.querySelector('[type="submit"]'),async()=>{
      if(!await window.shopReady)throw new Error('Máy chủ chưa sẵn sàng. Hãy tải lại trang.');
      if(authForm.dataset.authMode==='register') {
        if(password!==values.get('confirmPassword'))throw new Error('Mật khẩu xác nhận chưa khớp.');
        if(!values.has('terms'))throw new Error('Vui lòng đồng ý điều khoản.');
        await shop.request('/api/tai-khoan/dang-ky','POST',{email,password,fullName:String(values.get('fullName')||'').trim()});
      }
      await shop.request('/api/tai-khoan/dang-nhap','POST',{email,password,remember:values.has('remember')});
      await shop.csrf();
      const user=await shop.request('/api/tai-khoan/me');
      location.href=shop.root+(user.roles.includes('Admin')?'/QuanTri/TongQuan/index.html':'/NguoiDung/TaiKhoan/index.html');
    },e=>{authStatus.textContent=e.message;authStatus.dataset.state='error';});
  });
  document.addEventListener('click',async event=>{
    const button=event.target.closest('[data-logout]');if(!button)return;event.preventDefault();
    await shop.action(button,async()=>{
      await shop.request('/api/tai-khoan/dang-xuat','POST');currentUser=null;
      location.href=shop.root+'/NguoiDung/DangNhap/index.html';
    });
  });
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
