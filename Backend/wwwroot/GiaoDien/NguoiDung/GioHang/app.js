(async () => {
  if (!await window.shopReady) return;
  let cart=[];
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

  function readCart() {return cart;}

  function formatPrice(price) {
    return `${Number(price).toLocaleString("vi-VN")}₫`;
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
    if(item.available===false)variant.textContent += " · Tạm ngừng bán";
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
    increase.disabled=item.available===false;
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

  async function renderCart() {
    try {
      cart=(await shop.request('/api/gio-hang')).map(x=>({...x,name:x.product,image:x.imageUrl}));
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
      errorMessage.textContent = error.message;
      errorMessage.hidden = false;
    }
  }

  async function changeQuantity(index,change) {
    const item=cart[index];if(!item)return;
    await shop.action(document.activeElement,async()=>{
      const quantity=item.quantity+change;
      await shop.request('/api/gio-hang/'+item.id,quantity<=0?'DELETE':'PUT',quantity<=0?undefined:{quantity});
      await renderCart();
    },e=>shop.error(e,errorMessage));
  }

  async function removeItem(index) {
    const item=cart[index];if(!item)return;
    await shop.action(document.activeElement,async()=>{await shop.request('/api/gio-hang/'+item.id,'DELETE');await renderCart();},e=>shop.error(e,errorMessage));
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

  checkoutForm.addEventListener('submit',async event=>{
    event.preventDefault();if(!checkoutForm.reportValidity())return;checkoutError.hidden=true;
    await shop.action(checkoutForm.querySelector('[type="submit"]'),async()=>{
      const values=new FormData(checkoutForm);
      const order=await shop.request('/api/don-hang','POST',{recipient:String(values.get('name')).trim(),phone:String(values.get('phone')).trim(),address:String(values.get('address')).trim(),note:''});
      location.href='../DonHang/index.html?order='+encodeURIComponent(order.id);
    },e=>shop.error(e,checkoutError));
  });


  renderCart();
})();
