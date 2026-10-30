(async () => {
  if (!await window.shopReady) return;
  const statusLabels = {
    pending: "Chờ xác nhận",
    confirmed: "Đã xác nhận",
    shipping: "Đang giao",
    delivered: "Đã giao",
    cancelled: "Đã hủy"
  };
  const periodSelect = document.getElementById("period-select");
  const errorBox = document.getElementById("dashboard-error");



  function orderDate(order) {
    const value = order.createdAt || order.date;
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function orderTotal(order) {
    if (order.total !== undefined && order.total !== null && order.total !== "" && Number.isFinite(Number(order.total))) {
      return Number(order.total);
    }
    if (!Array.isArray(order.items)) return 0;
    return order.items.reduce((sum, item) => {
      return sum + (Number(item.price) || 0) * (Number(item.quantity) || 1);
    }, 0);
  }

  function itemCount(order) {
    if (!Array.isArray(order.items)) return 0;
    return order.items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
  }

  function formatPrice(value) {
    return `${value.toLocaleString("vi-VN")}₫`;
  }

  function formatDate(value) {
    const date = orderDate(value);
    if (!date) return "Chưa cập nhật";
    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(date);
  }

  function normalizedStatus(order) {
    const value = String(order.status || "pending").toLowerCase();
    return Object.hasOwn(statusLabels, value) ? value : "pending";
  }

  function selectedOrders(orders) {
    const days = periodSelect.value;
    if (days === "all") return orders;
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - (Number(days) - 1));
    return orders.filter((order) => {
      const date = orderDate(order);
      return date && date >= cutoff;
    });
  }

  function renderChart(orders) {
    const dayCount = periodSelect.value === "30" ? 30 : 7;
    const chart = document.getElementById("revenue-chart");
    const buckets = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let offset = dayCount - 1; offset >= 0; offset -= 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - offset);
      buckets.push({ date, total: 0 });
    }

    const bucketByDay = new Map(buckets.map((bucket) => [
      `${bucket.date.getFullYear()}-${bucket.date.getMonth()}-${bucket.date.getDate()}`,
      bucket
    ]));

    orders.forEach((order) => {
      if (normalizedStatus(order) !== "delivered") return;
      const date = orderDate(order);
      if (!date) return;
      const bucket = bucketByDay.get(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`);
      if (bucket) bucket.total += orderTotal(order);
    });

    const maximum = Math.max(...buckets.map((bucket) => bucket.total), 0);
    chart.replaceChildren();
    chart.style.gridTemplateColumns = `repeat(${dayCount}, minmax(0, 1fr))`;
    chart.setAttribute("aria-label", `Doanh thu trong ${dayCount} ngày qua`);

    buckets.forEach((bucket, index) => {
      const day = document.createElement("div");
      day.className = "chart-day";
      const area = document.createElement("div");
      area.className = "chart-bar-area";
      const bar = document.createElement("span");
      bar.className = "chart-bar";
      const height = maximum === 0 ? 3 : Math.max(4, (bucket.total / maximum) * 100);
      bar.style.height = `${height}%`;
      bar.title = `${formatDate({ createdAt: bucket.date })}: ${formatPrice(bucket.total)}`;
      area.append(bar);

      const label = document.createElement("span");
      label.className = "chart-day-label";
      label.textContent = dayCount === 7 || index % 5 === 0 || index === dayCount - 1
        ? new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(bucket.date)
        : "";
      day.append(area, label);
      chart.append(day);
    });

    const chartTotal = buckets.reduce((sum, bucket) => sum + bucket.total, 0);
    document.getElementById("chart-total").textContent = formatPrice(chartTotal);
    document.getElementById("chart-period").textContent = `${dayCount} ngày`;
  }

  function renderStatus(orders) {
    const counts = Object.keys(statusLabels).reduce((result, status) => {
      result[status] = 0;
      return result;
    }, {});
    orders.forEach((order) => {
      counts[normalizedStatus(order)] += 1;
    });

    document.getElementById("status-total").textContent = String(orders.length);
    const list = document.getElementById("status-list");
    list.replaceChildren();
    Object.entries(statusLabels).forEach(([status, label]) => {
      const row = document.createElement("div");
      row.className = "status-row";
      row.dataset.status = status;

      const name = document.createElement("span");
      name.textContent = label;
      const count = document.createElement("strong");
      count.textContent = String(counts[status]);

      const track = document.createElement("div");
      track.className = "status-track";
      const fill = document.createElement("div");
      fill.className = "status-fill";
      fill.style.width = orders.length ? `${(counts[status] / orders.length) * 100}%` : "0%";
      track.append(fill);
      row.append(name, count, track);
      list.append(row);
    });
  }

  function createCell(text, className) {
    const cell = document.createElement("td");
    if (className) cell.className = className;
    cell.textContent = text;
    return cell;
  }

  function renderRecentOrders(orders) {
    const body = document.getElementById("recent-orders");
    const empty = document.getElementById("orders-empty");
    const recent = [...orders]
      .sort((first, second) => (orderDate(second)?.getTime() || 0) - (orderDate(first)?.getTime() || 0))
      .slice(0, 6);

    body.replaceChildren();
    recent.forEach((order, index) => {
      const row = document.createElement("tr");
      const reference = order.id ? String(order.id) : `#${index + 1}`;
      const customer = order.customerName || order.customer?.name || order.customer?.fullName || "Khách hàng";
      const status = normalizedStatus(order);

      row.append(
        createCell(reference, "order-reference"),
        createCell(customer),
        createCell(formatDate(order)),
        createCell(`${itemCount(order)} sản phẩm`),
        createCell(formatPrice(orderTotal(order)), "order-total")
      );

      const statusCell = document.createElement("td");
      const statusBadge = document.createElement("span");
      statusBadge.className = "order-status";
      statusBadge.dataset.status = status;
      statusBadge.textContent = statusLabels[status];
      statusCell.append(statusBadge);
      row.append(statusCell);
      body.append(row);
    });

    empty.hidden = recent.length > 0;
  }

  async function renderDashboard() {
    try {
      const [data,stats]=await Promise.all([shop.all('/api/quan-tri/don-hang'),shop.request('/api/quan-tri/tong-quan')]);
      const allOrders=data.map(shop.order);
      const orders = selectedOrders(allOrders);
      const billableOrders = orders.filter((order) => normalizedStatus(order) === "delivered");
      const revenue = billableOrders.reduce((sum, order) => sum + orderTotal(order), 0);
      const pending = orders.filter((order) => normalizedStatus(order) === "pending").length;
      const cartCount=stats.cartQuantity;

      document.getElementById("revenue-value").textContent = formatPrice(revenue);
      document.getElementById("revenue-caption").textContent = `${billableOrders.length} đơn đã giao`;
      document.getElementById("orders-value").textContent = String(orders.length);
      document.getElementById("pending-value").textContent = String(pending);
      document.getElementById("cart-value").textContent = String(cartCount);
      renderChart(orders);
      renderStatus(orders);
      renderRecentOrders(allOrders);
      errorBox.hidden = true;
    } catch (error) {
      console.error("Không thể tải dữ liệu tổng quan quản trị:", error);
      errorBox.textContent = error.message;
      errorBox.hidden = false;
    }
  }

  document.getElementById("today-label").textContent = new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date());

  periodSelect.addEventListener("change", renderDashboard);
  document.getElementById("refresh-button").addEventListener("click", renderDashboard);

  renderDashboard();
})();
