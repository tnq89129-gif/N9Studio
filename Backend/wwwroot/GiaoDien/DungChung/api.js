(() => {
  const root='/GiaoDien';
  let token, pendingToken;
  class ApiError extends Error { constructor(message,status){super(message);this.status=status;} }
  async function csrf() {
    if(!pendingToken) pendingToken=fetch('/api/tai-khoan/csrf',{credentials:'same-origin',cache:'no-store'})
      .then(async r=>{if(!r.ok)throw new ApiError('Không lấy được mã bảo vệ. Hãy tải lại trang.',r.status);token=(await r.json()).token;})
      .finally(()=>{pendingToken=null;});
    await pendingToken;
  }
  async function request(url,method='GET',body) {
    const headers={'Accept':'application/json'};
    if(method!=='GET') {if(!token)await csrf();headers['X-CSRF-TOKEN']=token;}
    const multipart=body instanceof FormData;
    if(body!==undefined&&!multipart)headers['Content-Type']='application/json';
    let r;
    try {r=await fetch(url,{method,headers,credentials:'same-origin',cache:'no-store',body:body===undefined?undefined:multipart?body:JSON.stringify(body)});}
    catch {throw new ApiError('Không kết nối được máy chủ. Kiểm tra backend rồi tải lại.',0);}
    const text=await r.text(); let data;
    try{data=text?JSON.parse(text):null;}catch{data=null;}
    if(!r.ok) {
      let message=r.status===401?'Bạn cần đăng nhập để tiếp tục.':r.status===403?'Bạn không có quyền thực hiện thao tác này.':r.status===413?'Ảnh quá lớn. Vui lòng chọn ảnh tối đa 5 MB.':r.status===429?'Bạn thao tác quá nhanh. Hãy thử lại sau một phút.':'Không xử lý được yêu cầu.';
      if(Array.isArray(data))message=data.join('\n');
      else if(typeof data==='string')message=data;
      else if(data?.errors)message=Object.values(data.errors).flat().join('\n');
      else if(data?.message || data?.detail)message=data.message||data.detail;
      else if(r.status===400)message='Dữ liệu không hợp lệ hoặc phiên bảo vệ đã hết hạn. Hãy tải lại trang.';
      throw new ApiError(message,r.status);
    }
    return data;
  }
  async function all(url) {
    let items=[],page=1;
    while(true) {
      const data=await request(url+(url.includes('?')?'&':'?')+'page='+page+'&pageSize=100');
      if(!Array.isArray(data.items))throw new Error('Dữ liệu danh sách không hợp lệ.');
      items.push(...data.items);
      if(items.length>=data.total)return items;
      if(!data.items.length || page>=100000)throw new Error('Không tải đủ dữ liệu. Hãy tải lại trang.');
      page++;
    }
  }
  function utc(s){return typeof s==='string'&&!/(Z|[+-]\d\d:\d\d)$/.test(s)?s+'Z':s;}
  function product(p,categories=[]) {
    const variants=p.variants||[],active=variants.filter(v=>v.isActive!==false);
    return {...p,id:String(p.id),category:String(p.categoryId),categoryName:p.category||categories.find(c=>c.id===p.categoryId)?.name||'',
      image:p.imageUrl||'',price:active.length?Math.min(...active.map(v=>v.price)):0,
      colors:[...new Set(active.map(v=>v.color))],published:p.isActive!==false,variants,rating:0,reviews:0};
  }
  function order(o) {
    return {...o,id:String(o.id),status:String(o.status).toLowerCase(),createdAt:utc(o.createdAt),
      customerName:o.recipient,customerEmail:o.email,customerPhone:o.phone,customerAddress:o.address,
      items:(o.lines||[]).map(l=>({...l,name:l.productName,price:l.unitPrice}))};
  }
  async function badge(){
    const el=document.getElementById('cart-badge');if(!el)return;
    if(!window.storeAuth?.getCurrentUser()){el.textContent='0';return;}
    try {const cart=await request('/api/gio-hang');el.textContent=String(cart.reduce((n,x)=>n+x.quantity,0));}
    catch(e){el.textContent='!';el.title=e.message;}
  }
  function error(e,element) {
    let el=element;
    if(!el){el=document.getElementById('api-error');if(!el){el=document.createElement('p');el.id='api-error';el.setAttribute('role','alert');el.style.cssText='padding:16px;background:#fff3ed;color:#8b2500;position:relative;z-index:100';(document.querySelector('main')||document.body).prepend(el);}}
    el.textContent=e.message||String(e);el.hidden=false;
  }
  async function action(button,work,onError) {
    if(button?.disabled)return;
    if(button)button.disabled=true;
    try {await work();}catch(e){if(onError)onError(e);else error(e);}
    finally{if(button)button.disabled=false;}
  }
  window.shop={request,all,csrf,product,order,badge,error,action,root};
})();
