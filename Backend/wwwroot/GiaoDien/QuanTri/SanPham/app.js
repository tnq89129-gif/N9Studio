(async () => {
  if (!await window.shopReady) return;
  let categories=[];
  const productForm = document.getElementById("product-form");
  const productDialog = document.getElementById("product-dialog");
  const productList = document.getElementById("products-list");
  const searchInput = document.getElementById("product-search");
  const filterSelect = document.getElementById("product-filter");
  const errorMessage = document.getElementById("products-error");
  const feedbackMessage = document.getElementById("products-feedback");
  const formError = document.getElementById("form-error");
  const imageSelect = document.getElementById("product-image");
  const imageFile = document.getElementById("product-image-file");
  const imageStatus = document.getElementById("image-upload-status");
  const imagePreview = document.getElementById("product-image-preview");
  const imagePreviewWrap = document.getElementById("image-preview-wrap");
  let uploading = false;
  let products = [];
  let loadFailed = false;
  let feedbackTimer;
  let saving=false;
  const variantRows=document.getElementById("variant-rows");



  function showFeedback(message) {
    feedbackMessage.textContent = message;
    feedbackMessage.hidden = false;
    window.clearTimeout(feedbackTimer);
    feedbackTimer = window.setTimeout(() => {
      feedbackMessage.hidden = true;
    }, 3200);
  }



  function setImageStatus(message, state = "") {
    imageStatus.textContent = message;
    imageStatus.dataset.state = state;
    imageStatus.hidden = !message;
  }

  function updateImagePreview() {
    const url = imageSelect.value;
    imagePreviewWrap.hidden = !url;
    if (url) imagePreview.src = url;
    else imagePreview.removeAttribute("src");
    document.getElementById("image-preview-caption").textContent = "Ảnh đang chọn";
  }

  function addImageOption(image) {
    if (!Array.from(imageSelect.options).some(option => option.value === image.url)) {
      const option = new Option(image.name, image.url);
      option.dataset.uploaded = "true";
      imageSelect.add(option);
    }
  }

  async function loadImages() {
    try {
      const images = await shop.request('/api/quan-tri/anh-san-pham');
      images.forEach(addImageOption);
    } catch (e) {
      setImageStatus('Chưa tải được danh sách ảnh mới: ' + e.message + ' Bạn vẫn có thể chọn ảnh có sẵn hoặc tải ảnh khác.', 'error');
    }
  }

  async function uploadImage() {
    if (uploading || saving) return;
    const file = imageFile.files?.[0];
    if (!file) return;
    if (!/\.(jpe?g|png|webp)$/i.test(file.name)) {
      setImageStatus('Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.', 'error');
      imageFile.value = '';
      return;
    }
    if (!file.size || file.size > 5 * 1024 * 1024) {
      setImageStatus('Ảnh cần có dung lượng lớn hơn 0 và tối đa 5 MB.', 'error');
      imageFile.value = '';
      return;
    }
    uploading = true;
    const controls = [imageFile, imageSelect, productForm.querySelector('[type="submit"]'),
      document.getElementById('close-dialog'), document.getElementById('cancel-dialog')];
    controls.forEach(control => control.disabled = true);
    productForm.setAttribute('aria-busy', 'true');
    setImageStatus('Đang tải ảnh lên, vui lòng chờ…');
    try {
      const data = new FormData();
      data.append('file', file);
      const uploaded = await shop.request('/api/quan-tri/anh-san-pham', 'POST', data);
      addImageOption(uploaded);
      imageSelect.value = uploaded.url;
      updateImagePreview();
      setImageStatus('Đã tải ảnh và chọn sẵn. Nhấn Lưu sản phẩm để sử dụng ảnh này.', 'success');
    } catch (e) {
      setImageStatus(e.message + ' Ảnh đang chọn trước đó được giữ lại.', 'error');
    } finally {
      uploading = false;
      controls.forEach(control => control.disabled = false);
      productForm.removeAttribute('aria-busy');
      imageFile.value = '';
    }
  }

  imageFile.addEventListener('change', uploadImage);
  imageSelect.addEventListener('change', updateImagePreview);
  imagePreview.addEventListener('error', () => {
    document.getElementById('image-preview-caption').textContent = 'Không tải được ảnh xem trước. Hãy chọn ảnh khác hoặc kiểm tra lại file.';
  });

  function categoryLabel(category) {return categories.find(c=>String(c.id)===String(category))?.name||'';}

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
    priceCell.textContent = product.variants.length ? `${Number(product.price).toLocaleString("vi-VN")}₫` : "Chưa có biến thể";

    const statusCell = document.createElement("td");
    const status = document.createElement("span");
    status.className = "product-state";
    status.dataset.published = String(product.published !== false);
    const category=categories.find(c=>c.id===product.categoryId);
    status.dataset.published=String(product.published!==false&&category?.isActive!==false);
    status.textContent = product.published === false ? "Đang ẩn" : category?.isActive===false ? "Danh mục đang ẩn" : !product.variants.some(v=>v.isActive!==false) ? "Chưa có lựa chọn đang bán" : "Đang hiển thị";
    statusCell.append(status);

    const actionsCell = document.createElement("td");
    const actions = document.createElement("div");
    actions.className = "product-row-actions";
    [
      { action: "edit", label: "Sửa" },
      { action: "toggle", label: product.published === false ? "Hiện" : "Ẩn" },
      { action: "delete", label: "Ngừng bán" }
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

  async function loadProducts() {
    try {
      const [categoryData,data]=await Promise.all([shop.request('/api/quan-tri/danh-muc'),shop.all('/api/quan-tri/san-pham')]);
      categories=categoryData;products=data.map(p=>shop.product(p,categories));
      const select=document.getElementById('product-category');select.replaceChildren(new Option('Chọn danh mục',''));
      categories.forEach(c=>select.add(new Option(c.name+(c.isActive===false?' (đang ẩn)':''),String(c.id))));
      loadFailed=false;errorMessage.hidden=true;renderProducts();
      if(!categories.length)shop.error(new Error('Chưa có danh mục. Mở mục Danh mục trên thanh menu để tạo trước khi thêm sản phẩm.'),errorMessage);
    }catch(e){products=[];loadFailed=true;renderProducts();shop.error(e,errorMessage);}
  }

  function resetForm() {
    productForm.reset();
    imageFile.value = '';
    setImageStatus('');
    variantRows.replaceChildren();
    document.getElementById("product-id").value = "";
    formError.hidden = true;
    formError.textContent = "";
    Array.from(imageSelect.options).forEach((option) => {
      if (option.dataset.custom === "true") option.remove();
    });
    updateImagePreview();
  }

  async function openCreateDialog() {
    await loadProducts();
    if(loadFailed)return;
    resetForm();
    await loadImages();
    addVariantRow();
    document.getElementById("dialog-title").textContent = "Thêm sản phẩm";
    productDialog.showModal();
    document.getElementById("product-name").focus();
  }

  async function openEditDialog(product) {
    await loadProducts();
    if(loadFailed)return;
    product=products.find(p=>p.id===product.id);
    if(!product){shop.error(new Error("Sản phẩm không còn tồn tại."),errorMessage);return;}
    resetForm();
    await loadImages();
    (product.variants.length?product.variants:[{}]).forEach(addVariantRow);
    document.getElementById("dialog-title").textContent = "Chỉnh sửa sản phẩm";
    document.getElementById("product-id").value = product.id;
    document.getElementById("product-name").value = product.name;
    document.getElementById("product-category").value = product.category;
    if (!Array.from(imageSelect.options).some((option) => option.value === product.image)) {
      const customOption = new Option(product.image, product.image);
      customOption.dataset.custom = "true";
      imageSelect.add(customOption);
    }
    imageSelect.value = product.image;
    updateImagePreview();
    document.getElementById("product-description").value = product.description || "";
    document.getElementById("product-tag").value = product.tag || "";
    document.getElementById("product-published").checked = product.published !== false;
    productDialog.showModal();
    document.getElementById("product-name").focus();
  }

  async function handleProductAction(event) {
    const button=event.target.closest('[data-action]');if(!button)return;
    const p=products.find(p=>p.id===button.dataset.productId);if(!p)return;
    if(button.dataset.action==='edit'){openEditDialog(p);return;}
    if(button.dataset.action==='delete'&&!confirm('Ngừng bán sản phẩm “'+p.name+'”? Lịch sử đơn hàng được giữ lại.'))return;
    await shop.action(button,async()=>{
      if(button.dataset.action==='delete')await shop.request('/api/quan-tri/san-pham/'+p.id,'DELETE');
      else await shop.request('/api/quan-tri/san-pham/'+p.id,'PUT',{name:p.name,description:p.description,imageUrl:p.imageUrl,categoryId:p.categoryId,isActive:!p.published});
      await loadProducts();showFeedback('Đã cập nhật sản phẩm.');
    },e=>shop.error(e,errorMessage));
  }



  async function handleFormSubmit(event) {
    event.preventDefault();if(saving||uploading)return;formError.hidden=true;if(!productForm.reportValidity())return;
    if(loadFailed){shop.error(new Error('Chưa tải được dữ liệu sản phẩm.'),formError);return;}
    await shop.action(productForm.querySelector('[type="submit"]'),async()=>{
      const id=document.getElementById('product-id').value;
      const data={name:document.getElementById('product-name').value.trim(),description:document.getElementById('product-description').value.trim(),
        imageUrl:imageSelect.value,categoryId:Number(document.getElementById('product-category').value),isActive:document.getElementById('product-published').checked,tag:document.getElementById('product-tag').value.trim(),variants:readVariants()};
      if(data.isActive&&!data.variants.some(v=>v.isActive))throw new Error('Cần ít nhất một dòng size/màu đang bán để sản phẩm hiển thị.');
      saving=true;imageFile.disabled=true;
      try{await shop.request('/api/quan-tri/san-pham'+(id?'/'+id:''),id?'PUT':'POST',data);}finally{saving=false;imageFile.disabled=false;}
      productDialog.close();resetForm();await loadProducts();
      showFeedback('Đã lưu sản phẩm, giá, màu sắc, nhãn và tồn kho.'+(categories.find(c=>c.id===data.categoryId)?.isActive===false?' Danh mục đang ẩn nên sản phẩm chưa hiện ở cửa hàng.':''));
    },e=>shop.error(e,formError));
  }


  function addVariantRow(v={}) {
    const row=document.createElement('div');row.className='variant-row';if(v.id)row.dataset.id=String(v.id);
    const fields=[['size','Size','text',v.size||'','M'],['color','Màu sắc','text',v.color||'','Đen'],['price','Giá bán (₫)','number',v.price??'','199000'],['stock','Tồn kho','number',v.stock??0,'10']];
    for(const [key,title,type,value,placeholder] of fields){
      const label=document.createElement('label');label.className='form-field';const text=document.createElement('span');text.textContent=title;
      const input=document.createElement('input');input.dataset.field=key;input.type=type;input.value=value;input.placeholder=placeholder;input.required=true;
      if(type==='text')input.maxLength=key==='size'?30:50;
      else {input.min=key==='price'?'1':'0';input.max=key==='price'?'999999999999':'1000000';input.step=key==='price'?'0.01':'1';}
      label.append(text,input);row.append(label);
    }
    const label=document.createElement('label');label.className='variant-toggle';const active=document.createElement('input');active.type='checkbox';active.dataset.field='active';active.checked=v.isActive!==false;
    label.append(active,document.createTextNode('Đang bán'));row.append(label);
    active.onchange=()=>row.classList.toggle('is-inactive',!active.checked);row.classList.toggle('is-inactive',!active.checked);
    const remove=document.createElement('button');remove.className='row-action row-action--delete variant-remove';remove.type='button';remove.textContent=v.id?'Ngừng bán':'Bỏ dòng';
    remove.onclick=()=>{if(saving)return;if(v.id){active.checked=false;active.dispatchEvent(new Event('change'));}else row.remove();};row.append(remove);variantRows.append(row);
  }
  function readVariants() {
    const seen=new Set();
    return [...variantRows.children].map(row=>{
      const val=key=>row.querySelector('[data-field="'+key+'"]').value.trim().replace(/\s+/g,' ');
      const size=val('size'),color=val('color'),price=Number(val('price')),stock=Number(val('stock'));
      if(!size||!color||price<1||price>999999999999||!Number.isFinite(price)||!Number.isInteger(stock)||stock<0||stock>1000000)throw new Error('Nhập đủ size, màu, giá lớn hơn 0 và tồn kho nguyên từ 0 đến 1.000.000.');
      const key=size.normalize('NFC').toUpperCase()+'\n'+color.normalize('NFC').toUpperCase();if(seen.has(key))throw new Error('Hai dòng đang trùng size và màu.');seen.add(key);
      return {id:row.dataset.id?Number(row.dataset.id):null,size,color,price,stock,isActive:row.querySelector('[data-field="active"]').checked};
    });
  }
  document.getElementById('add-variant').onclick=()=>{if(!saving)addVariantRow();};
  productDialog.addEventListener('cancel',e=>{if(saving||uploading)e.preventDefault();});

  document.getElementById("today-label").textContent = new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date());
  document.getElementById("add-product").addEventListener("click", openCreateDialog);
  document.getElementById("close-dialog").addEventListener("click", () => {if(!saving&&!uploading)productDialog.close();});
  document.getElementById("cancel-dialog").addEventListener("click", () => {if(!saving&&!uploading)productDialog.close();});
  productForm.addEventListener("submit", handleFormSubmit);
  productList.addEventListener("click", handleProductAction);
  searchInput.addEventListener("input", renderProducts);
  filterSelect.addEventListener("change", renderProducts);
  loadProducts();
})();
