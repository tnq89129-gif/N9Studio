(async () => {
  if (!await window.shopReady) return;
  const title = document.getElementById("account-status-title");
  const description = document.getElementById("account-description");
  const note = document.getElementById("account-note");
  const actions = document.getElementById("account-actions");

  async function renderAccount() {
    try {
      const user=window.storeAuth.getCurrentUser();
      actions.querySelectorAll('a[href*="DangNhap/"],a[href*="DangKy/"]').forEach(a=>a.hidden=!!user);
      document.getElementById('account-logout').hidden=!user;
      if(!user){title.textContent='Bạn chưa đăng nhập';description.textContent='Đăng nhập để xem tài khoản của bạn.';note.textContent='Đơn hàng được gắn với tài khoản đăng nhập.';return;}
      title.textContent=user.name;description.textContent=user.email;
      const result=await shop.request('/api/don-hang');
      note.textContent=`${result.total} đơn hàng thuộc tài khoản này.`;
    }catch(e){shop.error(e,note);}
  }


  renderAccount();
})();
