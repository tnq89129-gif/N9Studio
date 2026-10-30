(() => {
  const form = document.getElementById('recovery-form');
  if (!form) return;
  const mode = form.dataset.recoveryMode;
  const email = document.getElementById('recovery-email');
  const status = document.getElementById('recovery-status');
  const button = document.getElementById('recovery-submit');
  let code = '', busy = false, remaining = 0, linkValid = true;
  const label = button.textContent;
  function message(text, state = 'error') {
    status.textContent = text;
    status.dataset.state = state;
  }
  if (mode === 'reset') {
    const params = new URLSearchParams(location.hash.slice(1));
    email.value = params.get('email') || '';
    code = params.get('code') || '';
    // Keep the reset secret only in this closure, not history, storage or later requests' URLs.
    history.replaceState(null, '', location.pathname + location.search);
    if (!email.value || !/^[A-Za-z0-9_-]{1,4096}$/.test(code)) {
      message('Liên kết không đầy đủ hoặc không hợp lệ. Hãy chọn “Yêu cầu liên kết mới”.');
      linkValid = false;
      button.disabled = true;
      form.querySelectorAll('input').forEach(input => input.disabled = true);
    }
  }
  function startCooldown() {
    remaining = 60;
    button.disabled = true;
    button.textContent = 'Gửi lại sau ' + remaining + ' giây';
    const timer = window.setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        window.clearInterval(timer);
        button.disabled = false;
        button.textContent = label;
      } else button.textContent = 'Gửi lại sau ' + remaining + ' giây';
    }, 1000);
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!linkValid || busy || remaining > 0 || !form.reportValidity()) return;
    if (mode === 'reset') {
      const password = document.getElementById('new-password').value;
      const confirm = document.getElementById('confirm-password').value;
      if (password !== confirm) { message('Mật khẩu xác nhận chưa khớp.'); return; }
      if (password.length < 8 || password.length > 100 || !/[A-Z]/.test(password) || !/[a-z]/.test(password)
        || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
        message('Mật khẩu cần từ 8 đến 100 ký tự, có chữ hoa, chữ thường, chữ số và ký tự đặc biệt.'); return;
      }
    }
    busy = true; button.disabled = true; form.setAttribute('aria-busy', 'true');
    message(mode === 'forgot' ? 'Đang gửi yêu cầu…' : 'Đang lưu mật khẩu mới…', 'pending');
    try {
      if (mode === 'forgot') {
        const result = await shop.request('/api/tai-khoan/quen-mat-khau', 'POST', { email: email.value.trim() });
        message(result.message, 'success');
        startCooldown();
      } else {
        await shop.request('/api/tai-khoan/dat-lai-mat-khau', 'POST', {
          email: email.value.trim(), code,
          newPassword: document.getElementById('new-password').value,
          confirmPassword: document.getElementById('confirm-password').value
        });
        code = '';
        form.reset(); form.hidden = true;
        document.getElementById('recovery-success').hidden = false;
        document.getElementById('request-new-link').hidden = true;
        document.getElementById('form-title').textContent = 'Khôi phục thành công';
      }
    } catch (e) {
      message(e.message || 'Chưa thực hiện được yêu cầu. Vui lòng thử lại sau.');
    } finally {
      busy = false; form.removeAttribute('aria-busy');
      if (remaining === 0) button.disabled = false;
    }
  });
})();
