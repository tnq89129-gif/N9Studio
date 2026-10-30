(() => {
  const statusLabels = {
    pending: "Chờ xác nhận",
    confirmed: "Đã xác nhận",
    shipping: "Đang giao",
    delivered: "Đã giao",
    cancelled: "Đã hủy"
  };
  const searchInput = document.getElementById("order-search");
  const filterSelect = document.getElementById("order-filter");
  const orderList = document.getElementById("orders-list");
  const errorMessage = document.getElementById("orders-error");
  const feedbackMessage = document.getElementById("orders-feedback");
  const orderDialog = document.getElementById("order-dialog");
  let orders = [];
  let feedbackTimer;

  function readOrders() {
    const storedOrders = window.localStorage.getItem("orders");
    if (storedOrders === null) return [];
    const parsedOrders = JSON.parse(storedOrders);
    if (!Array.isArray(parsedOrders) || parsedOrders.some((order) => !order || typeof order !== "object")) {
      throw new Error("Dữ liệu đơn hàng không hợp lệ. Hãy kiểm tra khóa orders trong localStorage.");
    }
    return parsedOrders;
  }

  function normalizedStatus(order) {
    const status = String(order.status || "pending").toLowerCase();
    return Object.hasOwn(statusLabels, status) ? status : "pending";
  }

  function orderTotal(order) {
    if (order.total !== undefined && order.total !== null && order.total !== "" &&
        Number.isFinite(Number(order.total))) {
      return Number(order.total);
    }
    if (!Array.isArray(order.items)) return 0;
    return order.items.reduce((total, item) => {
      return total + (Number(item.price) || 0) * (Number(item.quantity) || 1);
    }, 0);
  }

  function itemCount(order) {
    if (!Array.isArray(order.items)) return 0;
    return order.items.reduce((total, item) => total + (Number(item.quantity) || 1), 0);
  }

  function customerName(order) {
    return order.customerName || order.customer?.name || order.customer?.fullName ||
      order.name || "Khách hàng";
  }

  function formatPrice(value) {
    return `${Number(value).toLocaleString("vi-VN")}₫`;
  }

  function formatDate(order) {
    const date = new Date(order.createdAt || order.date);
    if (Number.isNaN(date.getTime())) return "Chưa cập nhật";
    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function showFeedback(message) {
    feedbackMessage.textContent = message;
    feedbackMessage.hidden = false;
    window.clearTimeout(feedbackTimer);
    feedbackTimer = window.setTimeout(() => {
      feedbackMessage.hidden = true;
    }, 3200);
  }

  function createCell(text, className) {
    const cell = document.createElement("td");
    if (className) cell.className = className;
    cell.textContent = text;
    return cell;
  }

  function createOrderRow(order, index) {
    const row = document.createElement("tr");
    row.dataset.orderIndex = String(index);

    const referenceCell = document.createElement("td");
    const reference = document.createElement("strong");
    reference.className = "admin-order-reference";
    reference.textContent = order.id ? String(order.id) : `Đơn hàng #${index + 1}`;
    const date = document.createElement("small");
    date.className = "admin-order-date";
    date.textContent = formatDate(order);
    referenceCell.append(reference, date);

    const customerCell = createCell(customerName(order), "admin-customer-cell");
    const itemCell = createCell(`${itemCount(order)} sản phẩm`);
    const totalCell = createCell(formatPrice(orderTotal(order)), "product-price-cell");

    const statusCell = document.createElement("td");
    const status = normalizedStatus(order);
    const statusSelect = document.createElement("select");
    statusSelect.className = "order-status-select";
    statusSelect.setAttribute("aria-label", `Trạng thái đơn ${reference.textContent}`);
    Object.entries(statusLabels).forEach(([value, label]) => {
      const option = new Option(label, value);
      option.selected = value === status;
      statusSelect.add(option);
    });
    statusCell.append(statusSelect);

    const actionsCell = document.createElement("td");
    const actions = document.createElement("div");
    actions.className = "product-row-actions";
    const detailButton = document.createElement("button");
    detailButton.className = "row-action";
    detailButton.type = "button";
    detailButton.dataset.action = "details";
    detailButton.textContent = "Chi tiết";
    const saveButton = document.createElement("button");
    saveButton.className = "row-action row-action--save";
    saveButton.type = "button";
    saveButton.dataset.action = "save-status";
    saveButton.textContent = "Cập nhật";
    actions.append(detailButton, saveButton);
    actionsCell.append(actions);

    row.append(referenceCell, customerCell, itemCell, totalCell, statusCell, actionsCell);
    return row;
  }

  function renderOrders() {
    const query = searchInput.value.trim().toLocaleLowerCase("vi");
    const statusFilter = filterSelect.value;
    const visibleOrders = orders
      .map((order, index) => ({ order, index }))
      .filter(({ order }) => {
        const matchesQuery = `${order.id || ""} ${customerName(order)}`.toLocaleLowerCase("vi").includes(query);
        return matchesQuery && (statusFilter === "all" || normalizedStatus(order) === statusFilter);
      })
      .sort((first, second) => {
        const firstDate = new Date(first.order.createdAt || first.order.date).getTime() || 0;
        const secondDate = new Date(second.order.createdAt || second.order.date).getTime() || 0;
        return secondDate - firstDate;
      });

    orderList.replaceChildren(...visibleOrders.map(({ order, index }) => createOrderRow(order, index)));
    document.getElementById("orders-count").textContent =
      `${visibleOrders.length} / ${orders.length} đơn hàng`;
    document.getElementById("total-orders").textContent = String(orders.length);
    document.getElementById("pending-orders").textContent =
      String(orders.filter((order) => normalizedStatus(order) === "pending").length);
    document.getElementById("shipping-orders").textContent =
      String(orders.filter((order) => normalizedStatus(order) === "shipping").length);
    document.getElementById("delivered-orders").textContent =
      String(orders.filter((order) => normalizedStatus(order) === "delivered").length);
    document.getElementById("orders-empty").hidden = visibleOrders.length !== 0;
  }

  function loadOrders() {
    try {
      orders = readOrders();
      errorMessage.hidden = true;
      renderOrders();
    } catch (error) {
      console.error("Không thể tải danh sách đơn hàng:", error);
      orders = [];
      errorMessage.textContent = error instanceof SyntaxError
        ? "Dữ liệu đơn hàng trong trình duyệt bị lỗi định dạng. Hãy khôi phục dữ liệu orders trước khi tiếp tục."
        : error.message;
      errorMessage.hidden = false;
      renderOrders();
    }
  }

  function updateOrderStatus(index, status) {
    if (!statusLabels[status] || !orders[index]) return;
    const updatedOrders = orders.slice();
    updatedOrders[index] = { ...updatedOrders[index], status };
    try {
      window.localStorage.setItem("orders", JSON.stringify(updatedOrders));
      orders = updatedOrders;
      errorMessage.hidden = true;
      renderOrders();
      showFeedback("Đã cập nhật trạng thái đơn hàng.");
    } catch (error) {
      console.error("Không thể cập nhật trạng thái đơn hàng:", error);
      errorMessage.textContent = "Không thể lưu trạng thái đơn hàng. Hãy kiểm tra dung lượng lưu trữ rồi thử lại.";
      errorMessage.hidden = false;
    }
  }

  function addDetailField(container, labelText, value) {
    const field = document.createElement("div");
    field.className = "order-detail-field";
    const label = document.createElement("span");
    label.textContent = labelText;
    const content = document.createElement("strong");
    content.textContent = value || "Chưa cập nhật";
    field.append(label, content);
    container.append(field);
  }

  function openOrderDetails(order, index) {
    const container = document.getElementById("order-detail-content");
    container.replaceChildren();
    const reference = order.id ? String(order.id) : `Đơn hàng #${index + 1}`;
    document.getElementById("order-dialog-title").textContent = reference;

    const customerSection = document.createElement("section");
    customerSection.className = "order-detail-section";
    const customerHeading = document.createElement("h3");
    customerHeading.textContent = "Thông tin khách hàng";
    const customerGrid = document.createElement("div");
    customerGrid.className = "order-detail-grid";
    const customer = order.customer && typeof order.customer === "object" ? order.customer : {};
    addDetailField(customerGrid, "Họ tên", customerName(order));
    addDetailField(customerGrid, "Số điện thoại", order.phone || customer.phone || order.customerPhone);
    addDetailField(customerGrid, "Email", order.email || customer.email);
    addDetailField(customerGrid, "Địa chỉ", order.address || customer.address);
    customerSection.append(customerHeading, customerGrid);

    const itemSection = document.createElement("section");
    itemSection.className = "order-detail-section";
    const itemHeading = document.createElement("h3");
    itemHeading.textContent = "Sản phẩm trong đơn";
    const itemList = document.createElement("div");
    itemList.className = "order-detail-items";
    if (Array.isArray(order.items) && order.items.length) {
      order.items.forEach((item) => {
        const itemRow = document.createElement("div");
        itemRow.className = "order-detail-item";
        const itemName = document.createElement("span");
        itemName.textContent = `${item.name || "Sản phẩm"} · Size ${item.size || "—"} · ${item.color || "—"} × ${Number(item.quantity) || 1}`;
        const itemPrice = document.createElement("strong");
        itemPrice.textContent = formatPrice((Number(item.price) || 0) * (Number(item.quantity) || 1));
        itemRow.append(itemName, itemPrice);
        itemList.append(itemRow);
      });
    } else {
      const noItems = document.createElement("p");
      noItems.className = "order-detail-muted";
      noItems.textContent = "Đơn hàng chưa có thông tin sản phẩm.";
      itemList.append(noItems);
    }
    itemSection.append(itemHeading, itemList);

    const summary = document.createElement("div");
    summary.className = "order-detail-summary";
    const date = document.createElement("span");
    date.textContent = `Đặt lúc ${formatDate(order)}`;
    const total = document.createElement("strong");
    total.textContent = formatPrice(orderTotal(order));
    summary.append(date, total);
    container.append(customerSection, itemSection, summary);
    orderDialog.showModal();
  }

  orderList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const row = button.closest("[data-order-index]");
    const index = Number(row.dataset.orderIndex);
    if (!Number.isInteger(index) || !orders[index]) return;

    if (button.dataset.action === "details") {
      openOrderDetails(orders[index], index);
      return;
    }
    if (button.dataset.action === "save-status") {
      updateOrderStatus(index, row.querySelector(".order-status-select").value);
    }
  });

  document.getElementById("today-label").textContent = new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date());
  searchInput.addEventListener("input", renderOrders);
  filterSelect.addEventListener("change", renderOrders);
  document.getElementById("refresh-button").addEventListener("click", loadOrders);
  document.getElementById("close-order-dialog").addEventListener("click", () => orderDialog.close());
  window.addEventListener("storage", (event) => {
    if (event.key === "orders" || event.key === null) loadOrders();
  });
  loadOrders();
})();
