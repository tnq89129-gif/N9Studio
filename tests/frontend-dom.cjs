/* DOM + API integration tests; not visual tests and not a .NET/SQL Server test. */
const {JSDOM,VirtualConsole}=require('jsdom');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../Backend/wwwroot');
const product={id:1,name:'Áo thử <script>',description:'Cotton',imageUrl:'/images/7.jpg',categoryId:1,isActive:true,variants:[{id:1,size:'M',color:'Đen',price:199000,stock:5,isActive:true}]};
let role='Admin',authenticated=true,failCatalog=false;
let cart=[{id:11,variantId:1,quantity:1,product:product.name,imageUrl:product.imageUrl,size:'M',color:'Đen',price:199000,stock:5,available:true,subtotal:199000}];
const account={id:'u1',fullName:'Khách thử',email:'test@example.com',phoneNumber:'0901234567',address:'Địa chỉ thử'};
const order={id:21,userId:'u1',email:account.email,recipient:account.fullName,phone:account.phoneNumber,address:account.address,note:'',status:'Pending',total:199000,createdAt:'2026-10-28T06:00:00',lines:[{variantId:1,productName:product.name,size:'M',color:'Đen',unitPrice:199000,quantity:1}]};
const review={id:31,productId:1,productName:product.name,userId:'u1',fullName:account.fullName,rating:5,content:'Đẹp <img src=x onerror=alert(1)>',isVisible:true};
const calls=[],failures=[];
const tick=()=>new Promise(r=>setTimeout(r,20));
async function mockFetch(url,options={}){
 const pathname=new URL(url,'https://localhost:7043').pathname;
 const method=options.method||'GET';let data,status=200;
 const body=options.body?JSON.parse(options.body):null;
 calls.push({pathname,method,body});
 if(pathname==='/api/tai-khoan/csrf')data={token:'csrf-test'};
 else if(method!=='GET'){
  assert.equal(options.headers['X-CSRF-TOKEN'],'csrf-test');
  if(pathname.endsWith('dang-nhap')){authenticated=true;data={message:'OK'};}
  else if(pathname.endsWith('dang-ky'))data={message:'OK'};
  else if(pathname.endsWith('dang-xuat')){authenticated=false;status=204;}
  else if(pathname==='/api/gio-hang'){cart[0].quantity++;status=204;}
  else if(pathname==='/api/gio-hang/11'){if(method==='DELETE')cart=[];else cart[0].quantity=body.quantity;status=204;}
  else if(pathname==='/api/don-hang'){cart=[];data={id:21,total:199000,status:'Pending'};status=201;}
  else if(pathname.endsWith('/trang-thai')){order.status=body.status;status=204;}
  else if(pathname==='/api/quan-tri/san-pham/1'){assert.equal(body.categoryId,1);status=204;}
  else if(pathname==='/api/quan-tri/san-pham'){data={id:2};}
  else if(pathname==='/api/quan-tri/danh-gia/31'){review.isVisible=body.isVisible;status=204;}
  else throw new Error('Unexpected mutation '+pathname);
 }
 else if(pathname==='/api/tai-khoan/me'){data={...account,roles:[role]};if(!authenticated){data={};status=401;}}
 else if(pathname==='/api/gio-hang')data=cart;
 else if(pathname==='/api/quan-tri/anh-san-pham')data=[];
 else if(pathname.endsWith('/danh-muc'))data=[{id:1,name:'Thời trang nữ'}];
 else if(['/api/san-pham','/api/quan-tri/san-pham'].includes(pathname)){data={total:1,items:[product]};if(failCatalog){data={message:'Lỗi tải thử'};status=500;}}
 else if(pathname==='/api/san-pham/1')data={...product,category:'Thời trang nữ',reviews:[review]};
 else if(['/api/don-hang','/api/quan-tri/don-hang'].includes(pathname))data={total:1,items:[order]};
 else if(pathname==='/api/quan-tri/khach-hang')data={total:2,items:[account,{id:'u2',fullName:'Chưa mua',email:'empty@example.com'}]};
 else if(pathname==='/api/quan-tri/danh-gia')data={total:1,items:[review]};
 else if(pathname==='/api/quan-tri/tong-quan')data={cartQuantity:2,customers:2,products:1,orders:1,pending:1,revenue:0,bestSellers:[]};
 else throw new Error('Unexpected GET '+pathname);
 return new Response(status===204?null:JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
}
async function load(page){
 const file='GiaoDien/'+page+'/index.html';
 const virtualConsole=new VirtualConsole();
 virtualConsole.on('jsdomError',e=>{if(!e.message.includes('navigation'))failures.push(e.message);});
 const dom=new JSDOM(fs.readFileSync(path.join(root,file),'utf8'),{url:'https://localhost:7043/'+file,runScripts:'outside-only',pretendToBeVisual:true,virtualConsole});
 const w=dom.window;
 w.fetch=mockFetch;
 w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
 w.confirm=()=>true;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 // Disable animation geometry branches: jsdom does not have a layout engine.
 w.matchMedia=query=>({matches:query.includes('prefers-reduced-motion'),addEventListener(){},removeEventListener(){}});
 for(const script of w.document.querySelectorAll('script[src]')){
   const src=new URL(script.src).pathname;
   if(!src.startsWith('/GiaoDien/'))continue;
   const result=w.eval(fs.readFileSync(path.join(root,decodeURIComponent(src)),'utf8'));
   if(result&&typeof result.then==='function')await result;
 }
 await w.shopReady;await tick();
 return dom;
}
const text=(w,id)=>w.document.getElementById(id).textContent;
function submit(w,id){w.document.getElementById(id).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));}
(async()=>{
 let dom,w;
 for(const page of ['TongQuan','SanPham','DonHang','KhachHang','DanhGia']){
   dom=await load('QuanTri/'+page);w=dom.window;
   const expected={TongQuan:['orders-value','1'],SanPham:['total-products','1'],DonHang:['total-orders','1'],KhachHang:['total-customers','2'],DanhGia:['total-reviews','1']}[page];
   assert.equal(text(w,expected[0]),expected[1],page);
   assert.equal(w.document.querySelectorAll('[role="alert"]:not([hidden])').length,0,page);
   if(page==='DonHang'){
     w.document.querySelector('[data-action="details"]').click();assert(w.document.getElementById('order-dialog').open);
     assert.match(text(w,'order-detail-content'),/Địa chỉ thử/);
     const select=w.document.querySelector('.order-status-select');select.value='confirmed';w.document.querySelector('[data-action="save-status"]').click();await tick();assert.equal(order.status,'Confirmed');
   }
   if(page==='SanPham'){
     w.document.querySelector('[data-action="edit"]').click();await tick();assert.equal(w.document.querySelector('[data-field="price"]').disabled,false);
     assert.equal(w.document.getElementById('product-tag').disabled,false);
     w.document.getElementById('product-name').value='Áo cập nhật';submit(w,'product-form');await tick();
     assert(calls.some(c=>c.pathname==='/api/quan-tri/san-pham/1'&&c.body.name==='Áo cập nhật'));
   }
   if(page==='DanhGia'){
     w.document.querySelector('[data-action="toggle"]').click();await tick();assert.equal(review.isVisible,false);
     assert.equal(w.document.querySelectorAll('[data-action="delete"]').length,0);
   }
   console.log('PASS admin '+page);dom.window.close();
 }
 role='Customer';
 dom=await load('NguoiDung/SanPham');w=dom.window;
 assert.equal(w.document.querySelectorAll('.product-card').length,1);
 assert.equal(w.document.querySelectorAll('.product-card script').length,0,'Escape product names');
 w.document.querySelector('[data-view-product]').click();await tick();assert(w.document.getElementById('product-dialog').open);
 w.document.getElementById('detail-size').value='M';w.document.getElementById('detail-size').dispatchEvent(new w.Event('change'));
 w.document.getElementById('detail-color').value='Đen';submit(w,'detail-form');await tick();assert.equal(cart[0].quantity,2);assert.equal(w.localStorage.length,0);
 console.log('PASS user catalog, details, variant cart and escaping');w.close();
 dom=await load('NguoiDung/GioHang');w=dom.window;
 const increase=w.document.querySelector('[aria-label="Tăng số lượng"]');increase.focus();increase.click();await tick();assert.equal(cart[0].quantity,3);
 w.document.getElementById('checkout-button').click();assert.equal(w.document.getElementById('checkout-email').value,account.email);
 w.document.getElementById('checkout-phone').value=account.phoneNumber;w.document.getElementById('checkout-address').value=account.address;submit(w,'checkout-form');await tick();
 assert(calls.some(c=>c.pathname==='/api/don-hang'&&c.method==='POST'&&c.body.recipient===account.fullName));
 console.log('PASS user cart and checkout');w.close();
 dom=await load('NguoiDung/DonHang');w=dom.window;assert.equal(w.document.querySelectorAll('.order-card').length,1);assert.match(text(w,'orders-list'),/199\.000/);w.close();
 dom=await load('NguoiDung/TaiKhoan');w=dom.window;assert.equal(text(w,'account-status-title'),account.fullName);assert.match(text(w,'account-note'),/1 đơn/);w.close();
 failCatalog=true;dom=await load('NguoiDung/SanPham');w=dom.window;assert.equal(w.document.getElementById('products-load-error').hidden,false);assert.equal(w.document.querySelectorAll('.product-card').length,0);w.close();failCatalog=false;
 authenticated=false;
 dom=await load('NguoiDung/DangKy');w=dom.window;
 for(const [id,value] of Object.entries({'full-name':'Người thử','email':'new@example.com','password':'Fashion!2026','confirm-password':'Fashion!2026'}))w.document.getElementById(id).value=value;
 w.document.querySelector('[name="terms"]').checked=true;submit(w,'auth-form');await tick();assert(calls.some(c=>c.pathname.endsWith('dang-ky')));assert(calls.some(c=>c.pathname.endsWith('dang-nhap')));w.close();
 dom=await load('NguoiDung/DangNhap');w=dom.window;w.document.getElementById('email').value=account.email;w.document.getElementById('password').value='Fashion!2026';submit(w,'auth-form');await tick();w.close();
 dom=await load('NguoiDung/TaiKhoan');w=dom.window;w.document.getElementById('account-logout').click();await tick();assert.equal(authenticated,false);w.close();
 // Home inline WebGL animations require a real browser; validate common auth startup only.
 dom=await load('NguoiDung/TrangChu');dom.window.close();
 assert.deepEqual(failures,[]);
 console.log('PASS 12 page DOM startup, connected actions, CSRF headers, auth, API error state. Home animations not tested.');
})().catch(e=>{console.error(e);process.exitCode=1;});
