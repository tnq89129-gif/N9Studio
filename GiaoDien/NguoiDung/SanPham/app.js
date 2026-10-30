(() => {
  const starterProducts = window.storeCatalog.initial;
  const productStorageKey = window.storeCatalog.storageKey;
  const reviewStorageKey = window.storeReviewCatalog.storageKey;
  const filters = Array.from(document.querySelectorAll("[data-filter]"));
  const search = document.getElementById("product-search");
  const productGrid = document.getElementById("product-grid");
  const loadError = document.getElementById("products-load-error");
  let cards = [];
  const resultCount = document.getElementById("result-count");
  const emptyState = document.getElementById("empty-state");
  const toast = document.getElementById("cart-toast");
  const cartBadge = document.getElementById("cart-badge");
  const detailDialog = document.getElementById("product-dialog");
  const detailForm = document.getElementById("detail-form");
  const detailSize = document.getElementById("detail-size");
  const detailColor = document.getElementById("detail-color");
  let activeFilter = "all";
  let toastTimer;
  let selectedProduct;

  function readCart() {
    return JSON.parse(window.localStorage.getItem("cart") || "[]");
  }

  function readProducts() {
    const storedProducts = window.localStorage.getItem(productStorageKey);
    if (storedProducts === null) {
      window.localStorage.setItem(productStorageKey, JSON.stringify(starterProducts));
      return starterProducts;
    }
    const products = JSON.parse(storedProducts);
    if (!Array.isArray(products)) {
      throw new Error("Danh mục sản phẩm không hợp lệ.");
    }
    const normalizedProducts = products.map((product) => ({
      ...product,
      image: window.storeCatalog.normalizeImagePath(product.image)
    }));
    if (normalizedProducts.some((product, index) => product.image !== products[index].image)) {
      window.localStorage.setItem(productStorageKey, JSON.stringify(normalizedProducts));
    }
    return normalizedProducts;
  }

  function readReviews() {
    const storedReviews = window.localStorage.getItem(reviewStorageKey);
    if (storedReviews === null) {
      const initialReviews = JSON.parse(JSON.stringify(window.storeReviewCatalog.initial));
      window.localStorage.setItem(reviewStorageKey, JSON.stringify(initialReviews));
      return initialReviews;
    }
    const reviews = JSON.parse(storedReviews);
    if (!Array.isArray(reviews)) {
      throw new Error("Danh sách đánh giá không hợp lệ.");
    }
    return reviews;
  }

  function updateCartBadge() {
    const count = readCart().reduce((total, item) => total + item.quantity, 0);
    cartBadge.textContent = String(count);
  }

  function updateProducts() {
    const query = search.value.trim().toLocaleLowerCase("vi");
    let visibleCount = 0;

    cards.forEach((card) => {
      const matchesFilter = activeFilter === "all" || card.dataset.category.split(" ").includes(activeFilter);
      const matchesQuery = card.dataset.name.toLocaleLowerCase("vi").includes(query);
      const visible = matchesFilter && matchesQuery;
      card.hidden = !visible;
      if (visible) visibleCount += 1;
    });

    resultCount.textContent = `${visibleCount} thiết kế`;
    emptyState.hidden = visibleCount !== 0;
  }

  function openProductDetails(card) {
    const button = card.querySelector("[data-product]");
    const image = card.querySelector(".product-image img");
    const category = card.querySelector(".product-category");
    const price = card.querySelector(".product-price");

    selectedProduct = {
      id: button.dataset.id,
      name: button.dataset.product,
      price: Number(button.dataset.price),
      image: button.dataset.image,
      description: button.dataset.description,
      colors: card.dataset.colors.split(",").map((color) => color.trim()).filter(Boolean),
      rating: Number(card.dataset.rating),
      reviews: Number(card.dataset.reviews)
    };

    document.getElementById("detail-image").src = image.src;
    document.getElementById("detail-image").alt = image.alt;
    document.getElementById("detail-category").textContent = category.textContent;
    document.getElementById("detail-name").textContent = selectedProduct.name;
    const detailRating = document.getElementById("detail-rating");
    detailRating.textContent = `★★★★★ ${selectedProduct.rating.toFixed(1)} · ${selectedProduct.reviews} đánh giá`;
    detailRating.setAttribute("aria-label", `${selectedProduct.rating} trên 5 sao, ${selectedProduct.reviews} đánh giá`);
    document.getElementById("detail-price").textContent = price.textContent;
    document.getElementById("detail-description").textContent = selectedProduct.description;
    renderReviews(selectedProduct.id);
    detailSize.value = "";
    detailColor.replaceChildren(new Option("Chọn màu sắc", ""));
    selectedProduct.colors.forEach((color) => {
      detailColor.add(new Option(color, color));
    });
    detailDialog.showModal();
  }

  function renderReviews(productId) {
    const reviewList = document.getElementById("detail-review-list");
    reviewList.replaceChildren();
    try {
      const reviews = readReviews().filter((review) =>
        review.productId === productId && review.published !== false
      );
      reviews.forEach((review) => {
        const article = document.createElement("article");
        article.className = "review-item";

        const heading = document.createElement("h4");
        heading.textContent = review.name;

        const rating = document.createElement("p");
        rating.className = "review-stars";
        rating.textContent = `${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}`;
        rating.setAttribute("aria-label", `${review.rating} trên 5 sao`);

        const comment = document.createElement("p");
        comment.className = "review-comment";
        comment.textContent = review.comment;

        article.append(heading, rating, comment);
        reviewList.append(article);
      });
      if (reviews.length === 0) {
        const emptyMessage = document.createElement("p");
        emptyMessage.className = "review-note";
        emptyMessage.textContent = "Sản phẩm chưa có nhận xét đang hiển thị.";
        reviewList.append(emptyMessage);
      }
    } catch (error) {
      console.error("Không thể tải nhận xét sản phẩm:", error);
      const errorMessage = document.createElement("p");
      errorMessage.className = "review-note";
      errorMessage.textContent = "Không thể tải nhận xét sản phẩm. Vui lòng thử lại sau.";
      reviewList.append(errorMessage);
    }
  }

  function categoryLabel(category) {
    const categories = String(category || "").split(/\s+/);
    if (categories.includes("outerwear") && !categories.includes("women") && !categories.includes("men")) {
      return "ÁO KHOÁC";
    }
    return categories.includes("men") ? "THỜI TRANG NAM" : "THỜI TRANG NỮ";
  }

  function createProductCard(product) {
    const card = document.createElement("article");
    card.className = "product-card";
    card.dataset.category = product.category;
    card.dataset.name = product.name.toLocaleLowerCase("vi");
    card.dataset.colors = Array.isArray(product.colors) ? product.colors.join(", ") : "";
    card.dataset.rating = String(Number(product.rating) || 0);
    card.dataset.reviews = String(Number(product.reviews) || 0);

    const imageButton = document.createElement("button");
    imageButton.className = "product-image";
    imageButton.type = "button";
    imageButton.dataset.viewProduct = "";
    imageButton.setAttribute("aria-label", `Xem chi tiết ${product.name}`);
    const image = document.createElement("img");
    image.src = product.image;
    image.alt = product.name;
    image.loading = "lazy";
    imageButton.append(image);
    if (product.tag) {
      const tag = document.createElement("span");
      tag.className = "product-tag";
      tag.textContent = product.tag;
      imageButton.append(tag);
    }

    const info = document.createElement("div");
    info.className = "product-info";
    const details = document.createElement("div");
    const category = document.createElement("p");
    category.className = "product-category";
    category.textContent = categoryLabel(product.category);
    const title = document.createElement("h3");
    const titleButton = document.createElement("button");
    titleButton.className = "product-title";
    titleButton.type = "button";
    titleButton.dataset.viewProduct = "";
    titleButton.textContent = product.name;
    title.append(titleButton);
    const rating = document.createElement("p");
    rating.className = "rating-summary";
    rating.dataset.ratingDisplay = "";
    details.append(category, title, rating);

    const price = document.createElement("p");
    price.className = "product-price";
    price.textContent = `${Number(product.price).toLocaleString("vi-VN")}₫`;
    info.append(details, price);

    const addButton = document.createElement("button");
    addButton.className = "add-button";
    addButton.type = "button";
    addButton.dataset.id = product.id;
    addButton.dataset.product = product.name;
    addButton.dataset.price = String(product.price);
    addButton.dataset.image = product.image;
    addButton.dataset.description = product.description;
    addButton.append(document.createTextNode("Thêm vào giỏ"));
    const addIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    addIcon.setAttribute("viewBox", "0 0 24 24");
    addIcon.setAttribute("aria-hidden", "true");
    const addPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    addPath.setAttribute("d", "M12 5v14m-7-7h14");
    addIcon.append(addPath);
    addButton.append(addIcon);

    card.append(imageButton, info, addButton);
    return card;
  }

  function bindProductCard(card) {
    const rating = Number(card.dataset.rating);
    const reviews = Number(card.dataset.reviews);
    const ratingSummary = card.querySelector("[data-rating-display]");
    ratingSummary.textContent = `★★★★★ ${rating.toFixed(1)} (${reviews})`;
    ratingSummary.setAttribute("aria-label", `${rating} trên 5 sao, ${reviews} đánh giá`);

    card.querySelectorAll("[data-view-product], .add-button").forEach((control) => {
      control.addEventListener("click", () => openProductDetails(card));
    });
  }

  function renderProductCatalog() {
    try {
      const products = readProducts().filter((product) => product.published !== false);
      productGrid.replaceChildren(...products.map(createProductCard));
      cards = Array.from(productGrid.querySelectorAll(".product-card"));
      cards.forEach(bindProductCard);
      loadError.hidden = true;
      updateProducts();
    } catch (error) {
      console.error("Không thể tải danh mục sản phẩm:", error);
      productGrid.replaceChildren();
      cards = [];
      loadError.textContent = "Không thể tải danh mục sản phẩm. Vui lòng kiểm tra dữ liệu rồi tải lại trang.";
      loadError.hidden = false;
      updateProducts();
    }
  }

  function addSelectedProductToCart() {
    const size = detailSize.value;
    const color = detailColor.value;
    const cart = readCart();
    const existingItem = cart.find((item) =>
      item.id === selectedProduct.id && item.size === size && item.color === color
    );

    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      cart.push({ ...selectedProduct, size, color, quantity: 1 });
    }

    window.localStorage.setItem("cart", JSON.stringify(cart));
    updateCartBadge();
    toast.textContent = `Đã thêm “${selectedProduct.name}” (size ${size}, màu ${color}) vào giỏ hàng.`;
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2400);
    detailDialog.close();
  }

  filters.forEach((filter) => {
    filter.addEventListener("click", () => {
      activeFilter = filter.dataset.filter;
      filters.forEach((item) => {
        const selected = item === filter;
        item.classList.toggle("is-selected", selected);
        item.setAttribute("aria-pressed", String(selected));
      });
      updateProducts();
    });
  });

  search.addEventListener("input", updateProducts);
  updateCartBadge();
  renderProductCatalog();
  window.addEventListener("storage", (event) => {
    if (event.key === productStorageKey || event.key === null) renderProductCatalog();
    if ((event.key === reviewStorageKey || event.key === null) &&
        selectedProduct && detailDialog.open) {
      renderReviews(selectedProduct.id);
    }
  });

  document.querySelector("[data-close-detail]").addEventListener("click", () => detailDialog.close());
  detailForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!detailForm.reportValidity()) return;
    addSelectedProductToCart();
  });
})();
