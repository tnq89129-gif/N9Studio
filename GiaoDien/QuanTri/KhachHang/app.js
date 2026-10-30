(() => {
  const statusLabels = {
    pending: "Chờ xác nhận",
    confirmed: "Đã xác nhận",
    shipping: "Đang giao",
    delivered: "Đã giao",
    cancelled: "Đã hủy"
  };
  const searchInput = document.getElementById("customer-search");
  const filterSelect = document.getElementById("customer-filter");
  const customerList = document.getElementById("customers-list");
  const errorMessage = document.getElementById("customers-error");
  const customerDialog = document.getElementById("customer-dialog");
  let customers = [];

  function readOrders() {
    const storedOrders = window.localStorage.getItem("orders");
    if (storedOrders === null) return [];
    const parsedOrders = JSON.parse(storedOrders);
    if (!Array.isArray(parsedOrders) || parsedOrders.some((order) => !order || typeof order !== "object")) {
      throw new Error("Dữ liệu đơn hàng không hợp lệ. Hãy kiểm tra khóa orders trong localStorage.");
    }
    return parsedOrders;
  }

  function orderStatus(order) {
    const status = String(order.status || "pending").toLowerCase();
    return Object.hasOwn(statusLabels, status) ? status : "pending";
  }

  function orderDate(order) {
    const date = new Date(order.createdAt || order.date);
    return Number.isNaN(date.getTime()) ? null : date;
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

  function getCustomerDetails(order) {
    const nested = order.customer && typeof order.customer === "object" ? order.customer : {};
    return {
      name: String(order.customerName || nested.name || nested.fullName || order.name || "").trim(),
      email: String(order.customerEmail || nested.email || order.email || "").trim(),
      phone: String(order.customerPhone || nested.phone || order.phone || "").trim(),
      address: String(order.customerAddress || nested.address || order.address || "").trim()
    };
  }

  function customerKey(details, order, orderIndex) {
    if (details.email) return `email:${details.email.toLocaleLowerCase("vi")}`;
    const normalizedPhone = details.phone.replace(/\D/g, "");
    if (normalizedPhone) return `phone:${normalizedPhone}`;
    if (details.name) return `name:${details.name.toLocaleLowerCase("vi").replace(/\s+/g, " ")}`;
    return `order:${order.id || orderIndex}`;
  }

  function purchaseCount(customer) {
    return customer.orders.filter((order) => orderStatus(order) !== "cancelled").length;
  }

  function aggregateCustomers(orders) {
    const customerByKey = new Map();
    orders.forEach((order, orderIndex) => {
      const details = getCustomerDetails(order);
      const key = customerKey(details, order, orderIndex);
      let customer = customerByKey.get(key);
      if (!customer) {
        customer = {
          key,
          name: details.name || "Khách hàng",
          email: details.email,
          phone: details.phone,
          address: details.address,
          orders: [],
          totalSpent: 0,
          lastOrderDate: null
        };
        customerByKey.set(key, customer);
      } else {
        customer.name = customer.name === "Khách hàng" && details.name ? details.name : customer.name;
        customer.email = customer.email || details.email;
        customer.phone = customer.phone || details.phone;
        customer.address = customer.address || details.address;
      }

      customer.orders.push(order);
      if (orderStatus(order) !== "cancelled") customer.totalSpent += orderTotal(order);
      const date = orderDate(order);
      if (date && (!customer.lastOrderDate || date > customer.lastOrderDate)) {
        customer.lastOrderDate = date;
      }
    });

    return [...customerByKey.values()].sort((first, second) =>
      (second.lastOrderDate?.getTime() || 0) - (first.lastOrderDate?.getTime() || 0)
    );
  }

  function formatPrice(value) {
    return `${Number(value).toLocaleString("vi-VN")}₫`;
  }

  function formatDate(date) {
    if (!date) return "Chưa cập nhật";
    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function createCell(text, className) {
    const cell = document.createElement("td");
    if (className) cell.className = className;
    cell.textContent = text;
    return cell;
  }

  function createCustomerRow(customer, index) {
    const row = document.createElement("tr");
    row.dataset.customerIndex = String(index);

    const nameCell = document.createElement("td");
    const identity = document.createElement("div");
    identity.className = "customer-identity";
    const avatar = document.createElement("span");
    avatar.className = "customer-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = customer.name === "Khách hàng"
      ? "KH"
      : customer.name.split(/\s+/).slice(-2).map((part) => part.charAt(0)).join("").toLocaleUpperCase("vi");
    const name = document.createElement("strong");
    name.className = "customer-name";
    name.textContent = customer.name;
    const group = document.createElement("small");
    group.className = "customer-group";
    const purchases = purchaseCount(customer);
    group.textContent = purchases > 1
      ? "Khách quay lại"
      : purchases === 1 ? "Mua một lần" : "Chưa có đơn hợp lệ";
    const nameCopy = document.createElement("div");
    nameCopy.className = "customer-name-copy";
    nameCopy.append(name, group);
    identity.append(avatar, nameCopy);
    nameCell.append(identity);

    const contact = document.createElement("td");
    const contactBlock = document.createElement("div");
    contactBlock.className = "customer-contact";
    const phone = document.createElement("span");
    phone.textContent = customer.phone || "Chưa có số điện thoại";
    const email = document.createElement("small");
    email.textContent = customer.email || "Chưa có email";
    contactBlock.append(phone, email);
    contact.append(contactBlock);

    const countCell = createCell(`${customer.orders.length} đơn`);
    const spendCell = createCell(formatPrice(customer.totalSpent), "product-price-cell");
    const dateCell = createCell(formatDate(customer.lastOrderDate), "customer-date-cell");
    const actionsCell = document.createElement("td");
    const viewButton = document.createElement("button");
    viewButton.className = "row-action";
    viewButton.type = "button";
    viewButton.dataset.action = "details";
    viewButton.textContent = "Xem hồ sơ";
    actionsCell.append(viewButton);

    row.append(nameCell, contact, countCell, spendCell, dateCell, actionsCell);
    return row;
  }

  function renderCustomers() {
    const query = searchInput.value.trim().toLocaleLowerCase("vi");
    const filter = filterSelect.value;
    const visibleCustomers = customers
      .map((customer, index) => ({ customer, index }))
      .filter(({ customer }) => {
        const searchable = `${customer.name} ${customer.email} ${customer.phone}`.toLocaleLowerCase("vi");
        const matchesQuery = searchable.includes(query);
        const matchesFilter = filter === "all" ||
          (filter === "repeat" && purchaseCount(customer) > 1) ||
          (filter === "new" && purchaseCount(customer) === 1);
        return matchesQuery && matchesFilter;
      });

    customerList.replaceChildren(...visibleCustomers.map(({ customer, index }) =>
      createCustomerRow(customer, index)
    ));
    document.getElementById("customers-count").textContent =
      `${visibleCustomers.length} / ${customers.length} khách hàng`;
    document.getElementById("total-customers").textContent = String(customers.length);
    document.getElementById("repeat-customers").textContent =
      String(customers.filter((customer) => purchaseCount(customer) > 1).length);
    const allOrders = customers.flatMap((customer) => customer.orders);
    document.getElementById("customer-orders").textContent = String(allOrders.length);
    const revenue = allOrders.reduce((total, order) =>
      total + (orderStatus(order) === "cancelled" ? 0 : orderTotal(order)), 0
    );
    document.getElementById("customer-revenue").textContent = formatPrice(revenue);
    document.getElementById("customers-empty").hidden = visibleCustomers.length !== 0;
  }

  function loadCustomers() {
    try {
      customers = aggregateCustomers(readOrders());
      errorMessage.hidden = true;
      renderCustomers();
    } catch (error) {
      console.error("Không thể tải danh sách khách hàng:", error);
      customers = [];
      errorMessage.textContent = error instanceof SyntaxError
        ? "Dữ liệu đơn hàng trong trình duyệt bị lỗi định dạng. Hãy khôi phục dữ liệu orders trước khi tiếp tục."
        : error.message;
      errorMessage.hidden = false;
      renderCustomers();
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

  function showCustomerDetails(customer) {
    const container = document.getElementById("customer-detail-content");
    container.replaceChildren();
    document.getElementById("customer-dialog-title").textContent = customer.name;

    const infoSection = document.createElement("section");
    infoSection.className = "order-detail-section";
    const infoHeading = document.createElement("h3");
    infoHeading.textContent = "Thông tin liên hệ";
    const infoGrid = document.createElement("div");
    infoGrid.className = "order-detail-grid";
    addDetailField(infoGrid, "Họ tên", customer.name);
    addDetailField(infoGrid, "Số điện thoại", customer.phone);
    addDetailField(infoGrid, "Email", customer.email);
    addDetailField(infoGrid, "Địa chỉ gần nhất", customer.address);
    infoSection.append(infoHeading, infoGrid);

    const orderSection = document.createElement("section");
    orderSection.className = "order-detail-section";
    const orderHeading = document.createElement("h3");
    orderHeading.textContent = `Lịch sử đơn hàng (${customer.orders.length})`;
    const orderList = document.createElement("div");
    orderList.className = "customer-history";
    [...customer.orders]
      .sort((first, second) => (orderDate(second)?.getTime() || 0) - (orderDate(first)?.getTime() || 0))
      .forEach((order, index) => {
        const row = document.createElement("div");
        row.className = "customer-history-row";
        const details = document.createElement("div");
        const reference = document.createElement("strong");
        reference.textContent = order.id ? String(order.id) : `Đơn hàng #${index + 1}`;
        const meta = document.createElement("small");
        meta.textContent = `${formatDate(orderDate(order))} · ${statusLabels[orderStatus(order)]}`;
        details.append(reference, meta);
        const total = document.createElement("strong");
        total.className = "customer-history-total";
        total.textContent = formatPrice(orderTotal(order));
        row.append(details, total);
        orderList.append(row);
      });
    orderSection.append(orderHeading, orderList);

    const total = document.createElement("div");
    total.className = "order-detail-summary";
    const totalLabel = document.createElement("span");
    totalLabel.textContent = "Doanh số không tính đơn đã hủy";
    const totalValue = document.createElement("strong");
    totalValue.textContent = formatPrice(customer.totalSpent);
    total.append(totalLabel, totalValue);
    container.append(infoSection, orderSection, total);
    customerDialog.showModal();
  }

  customerList.addEventListener("click", (event) => {
    const button = event.target.closest('[data-action="details"]');
    if (!button) return;
    const index = Number(button.closest("[data-customer-index]").dataset.customerIndex);
    const customer = customers[index];
    if (customer) showCustomerDetails(customer);
  });

  document.getElementById("today-label").textContent = new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date());
  searchInput.addEventListener("input", renderCustomers);
  filterSelect.addEventListener("change", renderCustomers);
  document.getElementById("refresh-button").addEventListener("click", loadCustomers);
  document.getElementById("close-customer-dialog").addEventListener("click", () => customerDialog.close());
  window.addEventListener("storage", (event) => {
    if (event.key === "orders" || event.key === null) loadCustomers();
  });
  loadCustomers();
})();
