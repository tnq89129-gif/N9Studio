(() => {
  const storageKey = window.storeCatalog.storageKey;
  const productForm = document.getElementById("product-form");
  const productDialog = document.getElementById("product-dialog");
  const productList = document.getElementById("products-list");
  const searchInput = document.getElementById("product-search");
  const filterSelect = document.getElementById("product-filter");
  const errorMessage = document.getElementById("products-error");
  const feedbackMessage = document.getElementById("products-feedback");
  const formError = document.getElementById("form-error");
  const imageSelect = document.getElementById("product-image");
  let products = [];
  let loadFailed = false;
  let feedbackTimer;

  function readProducts() {
    const storedProducts = window.localStorage.getItem(storageKey);
    if (storedProducts === null) {
      const initialProducts = JSON.parse(JSON.stringify(window.storeCatalog.initial));
      window.localStorage.setItem(storageKey, JSON.stringify(initialProducts));
      return initialProducts;
    }

    const parsedProducts = JSON.parse(storedProducts);
    if (!Array.isArray(parsedProducts) || parsedProducts.some((product) =>
      !product || typeof product.id !== "string" || typeof product.name !== "string" ||
      !Number.isFinite(Number(product.price)) || typeof product.image !== "string" ||
      typeof product.category !== "string"
    )) {
      throw new Error("Dữ liệu sản phẩm không hợp lệ. Hãy kiểm tra khóa products trong localStorage.");
    }
    const normalizedProducts = parsedProducts.map((product) => ({
      ...product,
      image: window.storeCatalog.normalizeImagePath(product.image)
    }));
    if (normalizedProducts.some((product, index) => product.image !== parsedProducts[index].image)) {
      window.localStorage.setItem(storageKey, JSON.stringify(normalizedProducts));
    }
    return normalizedProducts;
  }

  function showFeedback(message) {
    feedbackMessage.textContent = message;
    feedbackMessage.hidden = false;
    window.clearTimeout(feedbackTimer);
    feedbackTimer = window.setTimeout(() => {
      feedbackMessage.hidden = true;
    }, 3200);
  }

  function saveProducts(nextProducts) {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(nextProducts));
      products = nextProducts;
      loadFailed = false;
      errorMessage.hidden = true;
      renderProducts();
      return true;
    } catch (error) {
      console.error("Không thể lưu danh mục sản phẩm:", error);
      errorMessage.textContent = "Không thể lưu sản phẩm. Hãy kiểm tra dung lượng lưu trữ của trình duyệt rồi thử lại.";
      errorMessage.hidden = false;
      return false;
    }
  }

  function categoryLabel(category) {
    const labels = {
      women: "Thời trang nữ",
      "women outerwear": "Nữ · Áo khoác",
      men: "Thời trang nam",
      "men outerwear": "Nam · Áo khoác",
      outerwear: "Áo khoác"
    };
    return labels[category] || category;
  }

  function createProductRow(product) {
    const row = document.createElement("tr");
    const productCell = document.createElement("td");
    const cellContent = document.createElement("div");
    cellContent.className = "product-cell";
    const image = document.createElement("img");
    image.className = "product-thumb";
    image.src = product.image;
    image.alt = "";
    image.loading = "lazy";
    image.addEventListener("error", () => {
      image.alt = "Không tải được ảnh";
      image.classList.add("product-thumb--error");
    }, { once: true });

    const copy = document.createElement("div");
    copy.className = "product-cell-copy";
    const name = document.createElement("strong");
    name.textContent = product.name;
    const identifier = document.createElement("small");
    identifier.textContent = product.id;
    copy.append(name, identifier);
    cellContent.append(image, copy);
    productCell.append(cellContent);

    const categoryCell = document.createElement("td");
    categoryCell.className = "product-category-label";
    categoryCell.textContent = categoryLabel(product.category);

    const priceCell = document.createElement("td");
    priceCell.className = "product-price-cell";
    priceCell.textContent = `${Number(product.price).toLocaleString("vi-VN")}₫`;

    const statusCell = document.createElement("td");
    const status = document.createElement("span");
    status.className = "product-state";
    status.dataset.published = String(product.published !== false);
    status.textContent = product.published === false ? "Đang ẩn" : "Đang hiển thị";
    statusCell.append(status);

    const actionsCell = document.createElement("td");
    const actions = document.createElement("div");
    actions.className = "product-row-actions";
    [
      { action: "edit", label: "Sửa" },
      { action: "toggle", label: product.published === false ? "Hiện" : "Ẩn" },
      { action: "delete", label: "Xóa" }
    ].forEach(({ action, label }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = action === "delete" ? "row-action row-action--delete" : "row-action";
      button.dataset.action = action;
      button.dataset.productId = product.id;
      button.textContent = label;
      actions.append(button);
    });
    actionsCell.append(actions);
    row.append(productCell, categoryCell, priceCell, statusCell, actionsCell);
    return row;
  }

  function renderProducts() {
    const query = searchInput.value.trim().toLocaleLowerCase("vi");
    const statusFilter = filterSelect.value;
    const visibleProducts = products.filter((product) => {
      const matchesSearch = product.name.toLocaleLowerCase("vi").includes(query);
      const isPublished = product.published !== false;
      const matchesStatus = statusFilter === "all" ||
        (statusFilter === "published" && isPublished) ||
        (statusFilter === "hidden" && !isPublished);
      return matchesSearch && matchesStatus;
    });

    productList.replaceChildren(...visibleProducts.map(createProductRow));
    document.getElementById("products-count").textContent =
      `${visibleProducts.length} / ${products.length} sản phẩm`;
    document.getElementById("total-products").textContent = String(products.length);
    document.getElementById("published-products").textContent =
      String(products.filter((product) => product.published !== false).length);
    document.getElementById("hidden-products").textContent =
      String(products.filter((product) => product.published === false).length);
    document.getElementById("products-empty").hidden = visibleProducts.length !== 0;
  }

  function loadProducts() {
    try {
      products = readProducts();
      loadFailed = false;
      errorMessage.hidden = true;
      renderProducts();
    } catch (error) {
      console.error("Không thể tải danh mục sản phẩm:", error);
      products = [];
      loadFailed = true;
      errorMessage.textContent = error instanceof SyntaxError
        ? "Dữ liệu sản phẩm trong trình duyệt bị lỗi định dạng. Hãy khôi phục dữ liệu products trước khi tiếp tục."
        : error.message;
      errorMessage.hidden = false;
      renderProducts();
    }
  }

  function resetForm() {
    productForm.reset();
    document.getElementById("product-id").value = "";
    formError.hidden = true;
    formError.textContent = "";
    Array.from(imageSelect.options).forEach((option) => {
      if (option.dataset.custom === "true") option.remove();
    });
  }

  function openCreateDialog() {
    resetForm();
    document.getElementById("dialog-title").textContent = "Thêm sản phẩm";
    productDialog.showModal();
    document.getElementById("product-name").focus();
  }

  function openEditDialog(product) {
    resetForm();
    document.getElementById("dialog-title").textContent = "Chỉnh sửa sản phẩm";
    document.getElementById("product-id").value = product.id;
    document.getElementById("product-name").value = product.name;
    document.getElementById("product-category").value = product.category;
    document.getElementById("product-price").value = String(product.price);
    if (!Array.from(imageSelect.options).some((option) => option.value === product.image)) {
      const customOption = new Option(product.image, product.image);
      customOption.dataset.custom = "true";
      imageSelect.add(customOption);
    }
    imageSelect.value = product.image;
    document.getElementById("product-description").value = product.description || "";
    document.getElementById("product-colors").value =
      Array.isArray(product.colors) ? product.colors.join(", ") : "";
    document.getElementById("product-tag").value = product.tag || "";
    document.getElementById("product-published").checked = product.published !== false;
    productDialog.showModal();
    document.getElementById("product-name").focus();
  }

  function handleProductAction(event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const productIndex = products.findIndex((product) => product.id === button.dataset.productId);
    if (productIndex < 0) return;
    const product = products[productIndex];

    if (button.dataset.action === "edit") {
      openEditDialog(product);
      return;
    }
    if (button.dataset.action === "toggle") {
      const updatedProducts = products.slice();
      updatedProducts[productIndex] = { ...product, published: product.published === false };
      if (saveProducts(updatedProducts)) {
        showFeedback(product.published === false ? "Sản phẩm đã được hiển thị trên cửa hàng." : "Sản phẩm đã được ẩn khỏi cửa hàng.");
      }
      return;
    }
    if (button.dataset.action === "delete" &&
        window.confirm(`Bạn có chắc muốn xóa sản phẩm “${product.name}” không?`)) {
      const updatedProducts = products.filter((item) => item.id !== product.id);
      if (saveProducts(updatedProducts)) showFeedback("Đã xóa sản phẩm.");
    }
  }

  function createProductId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return `product-${window.crypto.randomUUID()}`;
    }
    return `product-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function handleFormSubmit(event) {
    event.preventDefault();
    formError.hidden = true;
    if (!productForm.reportValidity()) return;
    if (loadFailed) {
      formError.textContent = "Không thể lưu khi dữ liệu danh mục hiện tại không hợp lệ.";
      formError.hidden = false;
      return;
    }

    const id = document.getElementById("product-id").value;
    const name = document.getElementById("product-name").value.trim();
    const description = document.getElementById("product-description").value.trim();
    const colors = [...new Set(document.getElementById("product-colors").value
      .split(",").map((color) => color.trim()).filter(Boolean))];
    const price = Number(document.getElementById("product-price").value);
    if (!name || !description || !colors.length || !Number.isFinite(price) || price <= 0) {
      formError.textContent = "Vui lòng nhập tên, mô tả, giá hợp lệ và ít nhất một màu sắc.";
      formError.hidden = false;
      return;
    }

    const existingIndex = products.findIndex((product) => product.id === id);
    const product = {
      id: id || createProductId(),
      name,
      price,
      image: window.storeCatalog.normalizeImagePath(imageSelect.value),
      description,
      colors,
      category: document.getElementById("product-category").value,
      tag: document.getElementById("product-tag").value.trim(),
      rating: existingIndex >= 0 ? Number(products[existingIndex].rating) || 0 : 0,
      reviews: existingIndex >= 0 ? Number(products[existingIndex].reviews) || 0 : 0,
      published: document.getElementById("product-published").checked
    };
    const updatedProducts = products.slice();
    if (existingIndex >= 0) {
      updatedProducts[existingIndex] = product;
    } else {
      updatedProducts.unshift(product);
    }

    if (saveProducts(updatedProducts)) {
      productDialog.close();
      resetForm();
      showFeedback(existingIndex >= 0 ? "Đã cập nhật sản phẩm." : "Đã thêm sản phẩm mới.");
    } else {
      formError.textContent = "Không thể lưu sản phẩm. Hãy thử lại sau khi kiểm tra dung lượng trình duyệt.";
      formError.hidden = false;
    }
  }

  document.getElementById("today-label").textContent = new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date());
  document.getElementById("add-product").addEventListener("click", openCreateDialog);
  document.getElementById("close-dialog").addEventListener("click", () => productDialog.close());
  document.getElementById("cancel-dialog").addEventListener("click", () => productDialog.close());
  productForm.addEventListener("submit", handleFormSubmit);
  productList.addEventListener("click", handleProductAction);
  searchInput.addEventListener("input", renderProducts);
  filterSelect.addEventListener("change", renderProducts);
  window.addEventListener("storage", (event) => {
    if (event.key === storageKey || event.key === null) loadProducts();
  });
  loadProducts();
})();
