(async () => {
  if (!await window.shopReady) return;
  let products=[], categories=[];


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







  async function updateCartBadge() { await shop.badge(); }

  function updateProducts() {
    const query = search.value.trim().toLocaleLowerCase("vi");
    let visibleCount = 0;

    cards.forEach((card) => {
      const matchesFilter = activeFilter === "all" || card.dataset.category === activeFilter;
      const matchesQuery = card.dataset.name.toLocaleLowerCase("vi").includes(query);
      const visible = matchesFilter && matchesQuery;
      card.hidden = !visible;
      if (visible) visibleCount += 1;
    });

    resultCount.textContent = `${visibleCount} thiết kế`;
    emptyState.hidden = visibleCount !== 0;
  }

  async function openProductDetails(card) {
    try {
      const detail=await shop.request('/api/san-pham/'+card.querySelector('[data-product]').dataset.id);
      selectedProduct=detail;
      document.getElementById('detail-image').src=detail.imageUrl||'';
      document.getElementById('detail-image').alt=detail.name;
      document.getElementById('detail-category').textContent=detail.category;
      document.getElementById('detail-name').textContent=detail.name;
      document.getElementById('detail-description').textContent=detail.description;
      const reviews=detail.reviews||[],average=reviews.length?reviews.reduce((s,r)=>s+r.rating,0)/reviews.length:0;
      document.getElementById('detail-rating').textContent=reviews.length?`${average.toFixed(1)}/5 · ${reviews.length} đánh giá hiển thị`:'Chưa có đánh giá';
      document.getElementById('detail-price').textContent=card.querySelector('.product-price').textContent;
      detailSize.replaceChildren(new Option('Chọn kích cỡ',''));
      [...new Set(detail.variants.map(v=>v.size))].forEach(size=>detailSize.add(new Option(size,size)));
      detailColor.replaceChildren(new Option('Chọn màu sắc',''));
      renderReviews(reviews);detailDialog.showModal();
    }catch(e){shop.error(e,loadError);}
  }

  function renderReviews(reviews) {
    const list=document.getElementById('detail-review-list');list.replaceChildren();
    for(const r of reviews){
      const article=document.createElement('article');article.className='review-item';
      const name=document.createElement('h4');name.textContent=r.fullName;
      const stars=document.createElement('p');stars.className='review-stars';stars.textContent='★'.repeat(r.rating)+'☆'.repeat(5-r.rating);
      const content=document.createElement('p');content.className='review-comment';content.textContent=r.content;
      article.append(name,stars,content);list.append(article);
    }
    if(!reviews.length)list.textContent='Chưa có đánh giá.';
  }

  function categoryLabel(category) {return categories.find(c=>String(c.id)===String(category))?.name||'';}

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
    ratingSummary.textContent = "Xem chi tiết và đánh giá";
    ratingSummary.setAttribute("aria-label", `${rating} trên 5 sao, ${reviews} đánh giá`);

    card.querySelectorAll("[data-view-product], .add-button").forEach((control) => {
      control.addEventListener("click", () => openProductDetails(card));
    });
  }

  async function renderProductCatalog() {
    try {
      categories=await shop.request('/api/san-pham/danh-muc');
      if(activeFilter!=='all'&&!categories.some(c=>String(c.id)===activeFilter))activeFilter='all';
      const filterBox=document.querySelector('.filters');filterBox.replaceChildren();
      const options=[{id:'all',name:'Tất cả'},...categories];
      options.forEach(c=>{const b=document.createElement('button');b.type='button';b.className='filter';b.textContent=c.name;b.dataset.filter=String(c.id);b.classList.toggle('is-selected',String(c.id)===activeFilter);b.setAttribute('aria-pressed',String(String(c.id)===activeFilter));b.onclick=()=>{activeFilter=String(c.id);filterBox.querySelectorAll('button').forEach(x=>{x.classList.toggle('is-selected',x===b);x.setAttribute('aria-pressed',String(x===b));});updateProducts();};filterBox.append(b);});
      products=(await shop.all('/api/san-pham')).map(p=>shop.product(p,categories));
      productGrid.replaceChildren(...products.map(createProductCard));
      cards=Array.from(productGrid.querySelectorAll('.product-card'));cards.forEach(bindProductCard);
      loadError.hidden=true;updateProducts();
    }catch(e){productGrid.replaceChildren();cards=[];updateProducts();shop.error(e,loadError);}
  }

  async function addSelectedProductToCart() {
    const variant=selectedProduct?.variants.find(v=>v.size===detailSize.value&&v.color===detailColor.value);
    if(!variant||variant.stock<1){shop.error(new Error('Lựa chọn này đã hết hàng.'),loadError);return;}
    await shop.action(detailForm.querySelector('[type="submit"]'),async()=>{
      await shop.request('/api/gio-hang','POST',{variantId:variant.id,quantity:1});
      await shop.badge();detailDialog.close();toast.textContent='Đã thêm sản phẩm vào giỏ hàng.';toast.classList.add('is-visible');
      clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('is-visible'),2400);
    },e=>{if(e.status===401)location.href='../DangNhap/index.html';else shop.error(e,loadError);});
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

  detailSize.addEventListener('change',()=>{
    detailColor.replaceChildren(new Option('Chọn màu sắc',''));
    selectedProduct.variants.filter(v=>v.size===detailSize.value).forEach(v=>{
      const option=new Option(v.color+(v.stock?'':' (hết hàng)'),v.color);option.disabled=v.stock<1;detailColor.add(option);
    });
  });
  detailColor.addEventListener('change',()=>{
    const v=selectedProduct.variants.find(v=>v.size===detailSize.value&&v.color===detailColor.value);
    if(v)document.getElementById('detail-price').textContent=v.price.toLocaleString('vi-VN')+'₫ · Còn '+v.stock;
  });
  window.addEventListener("focus",()=>{if(!detailDialog.open)renderProductCatalog();});
  search.addEventListener("input", updateProducts);
  updateCartBadge();
  renderProductCatalog();

  document.querySelector("[data-close-detail]").addEventListener("click", () => detailDialog.close());
  detailForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!detailForm.reportValidity()) return;
    addSelectedProductToCart();
  });
})();
