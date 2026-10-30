(() => {
  const badge = document.getElementById("cart-badge");
  const layout = document.getElementById("cart-layout");
  const list = document.getElementById("cart-items-list");
  const emptyState = document.getElementById("cart-empty");
  const errorMessage = document.getElementById("cart-error");
  const countLabel = document.getElementById("cart-count");
  const subtotalLabel = document.getElementById("cart-subtotal");
  const totalLabel = document.getElementById("cart-total");
  const checkoutMessage = document.getElementById("checkout-message");
  const checkoutDialog = document.getElementById("checkout-dialog");
  const checkoutForm = document.getElementById("checkout-form");
  const checkoutError = document.getElementById("checkout-error");
  const checkoutTotal = document.getElementById("checkout-total");

  function readCart() {
    const cart = JSON.parse(window.localStorage.getItem("cart") || "[]");
    if (!Array.isArray(cart)) {
      throw new Error("Dữ liệu giỏ hàng không hợp lệ.");
    }
    return cart;
  }

  function formatPrice(price) {
    return `${Number(price).toLocaleString("vi-VN")}₫`;
  }

  function saveCart(cart) {
    window.localStorage.setItem("cart", JSON.stringify(cart));
    renderCart();
  }

  function createItem(item, index) {
    const article = document.createElement("article");
    article.className = "cart-item";

    const image = document.createElement("img");
    image.className = "cart-item-image";
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
    info.className = "cart-item-info";
    const name = document.createElement("h2");
    name.textContent = item.name || "Sản phẩm";
    const price = document.createElement("p");
    price.className = "cart-item-price";
    price.textContent = formatPrice(item.price);
    const variant = document.createElement("p");
    variant.className = "cart-item-variant";
    variant.textContent = `Kích cỡ: ${item.size || "Chưa chọn"} · Màu: ${item.color || "Chưa chọn"}`;
    info.append(name, price, variant);

    const actions = document.createElement("div");
    actions.className = "cart-item-actions";
    const quantityControl = document.createElement("div");
    quantityControl.className = "quantity-control";
    quantityControl.setAttribute("aria-label", `Số lượng ${item.name || "sản phẩm"}`);

    const decrease = document.createElement("button");
    decrease.type = "button";
    decrease.textContent = "−";
    decrease.setAttribute("aria-label", "Giảm số lượng");
    decrease.addEventListener("click", () => changeQuantity(index, -1));

    const quantity = document.createElement("span");
    quantity.className = "quantity-value";
    quantity.textContent = String(item.quantity || 1);

    const increase = document.createElement("button");
    increase.type = "button";
    increase.textContent = "+";
    increase.setAttribute("aria-label", "Tăng số lượng");
    increase.addEventListener("click", () => changeQuantity(index, 1));
    quantityControl.append(decrease, quantity, increase);

    const remove = document.createElement("button");
    remove.className = "remove-item";
    remove.type = "button";
    remove.textContent = "Xóa";
    remove.setAttribute("aria-label", `Xóa ${item.name || "sản phẩm"} khỏi giỏ hàng`);
    remove.addEventListener("click", () => removeItem(index));

    actions.append(quantityControl, remove);
    article.append(image, info, actions);
    return article;
  }

  function renderCart() {
    try {
      const cart = readCart();
      const itemCount = cart.reduce((total, item) => total + (Number(item.quantity) || 0), 0);
      const subtotal = cart.reduce((total, item) => total + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0);

      badge.textContent = String(itemCount);
      countLabel.textContent = `${itemCount} sản phẩm`;
      subtotalLabel.textContent = formatPrice(subtotal);
      totalLabel.textContent = formatPrice(subtotal);
      checkoutTotal.textContent = formatPrice(subtotal);
      list.replaceChildren(...cart.map(createItem));
      layout.hidden = cart.length === 0;
      emptyState.hidden = cart.length !== 0;
      errorMessage.hidden = true;
    } catch (error) {
      console.error("Không thể tải giỏ hàng:", error);
      layout.hidden = true;
      emptyState.hidden = true;
      errorMessage.textContent = "Không thể đọc dữ liệu giỏ hàng. Vui lòng tải lại trang hoặc thử lại sau.";
      errorMessage.hidden = false;
    }
  }

  function changeQuantity(index, change) {
    try {
      const cart = readCart();
      if (!cart[index]) return;
      cart[index].quantity = (Number(cart[index].quantity) || 1) + change;
      if (cart[index].quantity <= 0) {
        cart.splice(index, 1);
      }
      saveCart(cart);
    } catch (error) {
      console.error("Không thể cập nhật giỏ hàng:", error);
      errorMessage.textContent = "Không thể cập nhật số lượng. Vui lòng thử lại.";
      errorMessage.hidden = false;
    }
  }

  function removeItem(index) {
    try {
      const cart = readCart();
      if (!cart[index]) return;
      cart.splice(index, 1);
      saveCart(cart);
    } catch (error) {
      console.error("Không thể xóa sản phẩm khỏi giỏ hàng:", error);
      errorMessage.textContent = "Không thể xóa sản phẩm. Vui lòng thử lại.";
      errorMessage.hidden = false;
    }
  }

  document.getElementById("checkout-button").addEventListener("click", () => {
    checkoutMessage.hidden = true;
    checkoutError.hidden = true;
    checkoutForm.reset();
    try {
      const user = window.storeAuth?.getCurrentUser();
      if (user) {
        document.getElementById("checkout-name").value = user.name;
        document.getElementById("checkout-email").value = user.email;
      }
    } catch (error) {
      console.error("Không thể tải thông tin tài khoản:", error);
      checkoutMessage.textContent = error.message || "Không thể tải thông tin tài khoản.";
      checkoutMessage.hidden = false;
      return;
    }
    checkoutDialog.showModal();
  });

  document.getElementById("checkout-close").addEventListener("click", () => checkoutDialog.close());
  checkoutDialog.addEventListener("click", (event) => {
    if (event.target === checkoutDialog) checkoutDialog.close();
  });

  checkoutForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!checkoutForm.reportValidity()) return;
    checkoutError.hidden = true;

    try {
      const cart = readCart();
      if (cart.length === 0) {
        checkoutError.textContent = "Giỏ hàng đã trống. Hãy chọn sản phẩm trước khi đặt hàng.";
        checkoutError.hidden = false;
        renderCart();
        return;
      }
      const storedOrders = window.localStorage.getItem("orders");
      const orders = storedOrders === null ? [] : JSON.parse(storedOrders);
      if (!Array.isArray(orders)) throw new Error("Dữ liệu đơn hàng không hợp lệ.");

      const values = new FormData(checkoutForm);
      const customer = {
        name: String(values.get("name") || "").trim(),
        email: String(values.get("email") || "").trim().toLocaleLowerCase("vi"),
        phone: String(values.get("phone") || "").trim(),
        address: String(values.get("address") || "").trim()
      };
      const total = cart.reduce((sum, item) =>
        sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0
      );
      const order = {
        id: `DH-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        customerAddress: customer.address,
        customer,
        items: cart.map((item) => ({ ...item })),
        total,
        status: "pending",
        createdAt: new Date().toISOString()
      };

      const previousOrders = window.localStorage.getItem("orders");
      window.localStorage.setItem("orders", JSON.stringify([...orders, order]));
      try {
        window.localStorage.setItem("cart", "[]");
      } catch (error) {
        if (previousOrders === null) window.localStorage.removeItem("orders");
        else window.localStorage.setItem("orders", previousOrders);
        throw error;
      }

      window.location.href = `../DonHang/index.html?order=${encodeURIComponent(order.id)}`;
    } catch (error) {
      console.error("Không thể tạo đơn hàng:", error);
      checkoutError.textContent = error instanceof SyntaxError
        ? "Dữ liệu đơn hàng trong trình duyệt bị lỗi. Vui lòng kiểm tra lại rồi thử lại."
        : "Không thể lưu đơn hàng. Hãy kiểm tra dung lượng lưu trữ của trình duyệt rồi thử lại.";
      checkoutError.hidden = false;
    }
  });

  window.addEventListener("storage", (event) => {
    if (event.key === "cart") renderCart();
  });

  renderCart();
})();
