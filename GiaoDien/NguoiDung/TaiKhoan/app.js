(() => {
  const title = document.getElementById("account-status-title");
  const description = document.getElementById("account-description");
  const note = document.getElementById("account-note");
  const actions = document.getElementById("account-actions");

  function renderAccount() {
    try {
      const user = window.storeAuth?.getCurrentUser();
      const authLinks = actions.querySelectorAll('a[href*="DangNhap/"], a[href*="DangKy/"]');
      authLinks.forEach((link) => {
        link.hidden = Boolean(user);
      });
      document.getElementById("account-logout").hidden = !user;

      if (!user) {
        title.textContent = "Bạn chưa đăng nhập";
        description.textContent = "Đăng nhập để xem thông tin tài khoản và các lựa chọn mua sắm của bạn.";
        note.textContent = "Đơn hàng đặt với tư cách khách vẫn có thể tra cứu sau khi đăng nhập bằng cùng email.";
        return;
      }

      title.textContent = user.name;
      description.textContent = user.email;
      const orders = JSON.parse(window.localStorage.getItem("orders") || "[]");
      if (!Array.isArray(orders)) throw new Error("Dữ liệu đơn hàng không hợp lệ.");
      const orderCount = orders.filter((order) => {
        const email = order.customerEmail || order.customer?.email || order.email || "";
        return String(email).toLocaleLowerCase("vi") === user.email.toLocaleLowerCase("vi");
      }).length;
      note.textContent = `${orderCount} đơn hàng được gắn với tài khoản này. Dữ liệu demo chỉ được lưu trên trình duyệt hiện tại.`;
    } catch (error) {
      console.error("Không thể tải thông tin tài khoản:", error);
      note.textContent = error.message || "Không thể tải thông tin tài khoản.";
    }
  }

  window.addEventListener("storage", (event) => {
    if (event.key === "storeSession" || event.key === "orders") renderAccount();
  });

  renderAccount();
})();
