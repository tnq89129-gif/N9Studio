(() => {
  const badge = document.getElementById("cart-badge");
  const countLabel = document.getElementById("orders-count");
  const list = document.getElementById("orders-list");
  const emptyState = document.getElementById("orders-empty");
  const errorMessage = document.getElementById("orders-error");

  const statusLabels = {
    pending: "Chờ xác nhận",
    confirmed: "Đã xác nhận",
    shipping: "Đang giao",
    delivered: "Đã giao",
    cancelled: "Đã hủy"
  };

  function readOrders() {
    const orders = JSON.parse(window.localStorage.getItem("orders") || "[]");
    if (!Array.isArray(orders)) {
      throw new Error("Dữ liệu đơn hàng không hợp lệ.");
    }
    return orders;
  }

  function formatPrice(value) {
    return `${(Number(value) || 0).toLocaleString("vi-VN")}₫`;
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Ngày đặt chưa cập nhật";
    return new Intl.DateTimeFormat("vi-VN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function createOrderItem(item) {
    const row = document.createElement("div");
    row.className = "order-item";

    const image = document.createElement("img");
    image.className = "order-item-image";
    image.alt = item.name ? `Ảnh ${item.name}` : "Ảnh sản phẩm";
    image.loading = "lazy";
    image.addEventListener("error", () => {
      image.hidden = true;
    }, { once: true });
    if (item.image) {
      image.src = item.image;
    } else {
      image.hidden = true;
    }

    const info = document.createElement("div");
    info.className = "order-item-info";
    const name = document.createElement("h3");
    name.textContent = item.name || "Sản phẩm";
    const variant = document.createElement("p");
    variant.textContent = `Kích cỡ: ${item.size || "Chưa chọn"} · Màu: ${item.color || "Chưa chọn"} · Số lượng: ${Number(item.quantity) || 1}`;
    info.append(name, variant);

    const total = document.createElement("span");
    total.className = "order-item-total";
    total.textContent = formatPrice((Number(item.price) || 0) * (Number(item.quantity) || 1));
    row.append(image, info, total);
    return row;
  }

  function createOrderCard(order, index) {
    const card = document.createElement("article");
    card.className = "order-card";

    const header = document.createElement("header");
    header.className = "order-header";
    const details = document.createElement("div");
    const reference = document.createElement("p");
    reference.className = "order-reference";
    reference.textContent = `Đơn hàng ${order.id || `#${index + 1}`}`;
    const title = document.createElement("h2");
    title.textContent = "Thông tin đơn hàng";
    const date = document.createElement("p");
    date.className = "order-date";
    date.textContent = `Đặt ngày ${formatDate(order.createdAt || order.date)}`;
    details.append(reference, title, date);

    const status = document.createElement("span");
    status.className = "order-status";
    const normalizedStatus = String(order.status || "pending").toLowerCase();
    status.dataset.status = normalizedStatus;
    status.textContent = statusLabels[normalizedStatus] || "Đang xử lý";
    header.append(details, status);

    const items = document.createElement("div");
    items.className = "order-items";
    if (Array.isArray(order.items)) {
      order.items.forEach((item) => items.append(createOrderItem(item)));
    }

    const footer = document.createElement("footer");
    footer.className = "order-footer";
    const itemCount = Array.isArray(order.items)
      ? order.items.reduce((total, item) => total + (Number(item.quantity) || 1), 0)
      : 0;
    const count = document.createElement("span");
    count.textContent = `${itemCount} sản phẩm`;
    const total = document.createElement("span");
    total.className = "order-total";
    const calculatedTotal = Array.isArray(order.items)
      ? order.items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0)
      : 0;
    total.textContent = formatPrice(order.total ?? calculatedTotal);
    footer.append(count, total);
    card.append(header, items, footer);
    return card;
  }

  function renderOrders() {
    try {
      const allOrders = readOrders();
      const user = window.storeAuth?.getCurrentUser();
      const orders = user
        ? allOrders.filter((order) => {
          const email = order.customerEmail || order.customer?.email || order.email || "";
          return String(email).toLocaleLowerCase("vi") === user.email.toLocaleLowerCase("vi");
        })
        : [];
      const cart = JSON.parse(window.localStorage.getItem("cart") || "[]");
      const cartCount = Array.isArray(cart)
        ? cart.reduce((total, item) => total + (Number(item.quantity) || 0), 0)
        : 0;

      badge.textContent = String(cartCount);
      countLabel.textContent = `${orders.length} đơn hàng`;
      list.replaceChildren(...orders.map(createOrderCard));
      emptyState.hidden = orders.length !== 0;
      document.getElementById("orders-empty-description").textContent = user
        ? "Đơn hàng sẽ hiển thị tại đây sau khi bạn hoàn tất đặt hàng."
        : "Đăng nhập bằng email đã dùng khi đặt hàng để xem lịch sử mua sắm.";
      document.getElementById("orders-login-link").hidden = Boolean(user);
      errorMessage.hidden = true;
    } catch (error) {
      console.error("Không thể tải danh sách đơn hàng:", error);
      list.replaceChildren();
      emptyState.hidden = true;
      errorMessage.textContent = "Không thể đọc danh sách đơn hàng. Vui lòng tải lại trang hoặc thử lại sau.";
      errorMessage.hidden = false;
    }
  }

  window.addEventListener("storage", (event) => {
    if (event.key === "orders" || event.key === "cart" || event.key === "storeSession") renderOrders();
  });

  renderOrders();
})();
