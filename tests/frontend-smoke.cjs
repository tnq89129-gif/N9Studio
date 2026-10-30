/* UI integration test with a mocked HTTP API. Does not validate SQL Server or C#.
   Start static server at localhost:8765, then run node tests/frontend-smoke.cjs.
   Requires Playwright + Chromium. */
const assert=require('node:assert/strict');
let chromium;
try {({chromium}=require('playwright'));}
catch {({chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright'));}
const base=process.env.SHOP_UI_BASE_URL||'http://localhost:8765';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const context=await browser.newContext();
 let role='Admin', loggedIn=true, failCatalog=false, stock=5;
 const mutations=[];
 const user=()=>({id:'u1',fullName:'Khách thử',email:'test@example.com',roles:[role],phoneNumber:'0901234567',address:'Địa chỉ thử'});
 const product={id:1,name:'Áo thử <script>',description:'Cotton',imageUrl:'/images/7.jpg',categoryId:1,isActive:true,variants:[{id:1,size:'M',color:'Đen',price:199000,stock:5,isActive:true}]};
 let cart=[{id:11,variantId:1,quantity:1,product:product.name,imageUrl:product.imageUrl,size:'M',color:'Đen',price:199000,stock,available:true,subtotal:199000}];
 const order={id:21,userId:'u1',email:'test@example.com',recipient:'Khách thử',phone:'0901234567',address:'Địa chỉ thử',note:'',status:'Pending',total:199000,createdAt:'2026-10-28T06:00:00',lines:[{variantId:1,productName:product.name,size:'M',color:'Đen',unitPrice:199000,quantity:1}]};
 const review={id:31,productId:1,productName:product.name,userId:'u1',fullName:'Khách thử',rating:5,content:'Đẹp <img src=x onerror=alert(1)>',isVisible:true};
 const errors=[];const apiCalls=[];
 await context.route('**/api/**',async route=>{
   const req=route.request(),url=new URL(req.url()),path=url.pathname,method=req.method();
   apiCalls.push(method+' '+path);
   const send=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:status===204?'':JSON.stringify(data)});
   if(path==='/api/tai-khoan/csrf')return send({token:'test-csrf'});
   if(method!=='GET'){
     assert.equal(req.headers()['x-csrf-token'],'test-csrf','Mutations must send CSRF token');
     const body=req.postData()?req.postDataJSON():null;mutations.push({path,method,body});
     if(path.endsWith('dang-nhap')){loggedIn=true;return send({message:'OK'});}
     if(path.endsWith('dang-ky'))return send({message:'OK'});
     if(path.endsWith('dang-xuat')){loggedIn=false;return send(null,204);}
     if(path==='/api/gio-hang'){
       if(!loggedIn)return send({message:'Đăng nhập'},401);
       cart[0].quantity++;return send(null,204);
     }
     if(path==='/api/gio-hang/11'){
       if(method==='DELETE')cart=[];else cart[0].quantity=req.postDataJSON().quantity;
       return send(null,204);
     }
     if(path==='/api/don-hang'){cart=[];return send({id:21,total:199000,status:'Pending'},201);}
     if(path.endsWith('/trang-thai')){order.status=req.postDataJSON().status;return send(null,204);}
     if(path==='/api/quan-tri/danh-gia/31'){review.isVisible=req.postDataJSON().isVisible;return send(null,204);}
     if(path==='/api/quan-tri/san-pham/1')return send(null,204);
     if(path==='/api/quan-tri/san-pham')return send({id:2});
     throw new Error('Unexpected mutation '+path);
   }
   if(path==='/api/tai-khoan/me')return send(loggedIn?user():{},loggedIn?200:401);
   if(path==='/api/gio-hang')return send(cart);
   if(path.endsWith('/danh-muc'))return send([{id:1,name:'Thời trang nữ'}]);
   if(path==='/api/san-pham' || path==='/api/quan-tri/san-pham'){
     if(failCatalog)return send({message:'Lỗi tải thử'},500);
     return send({total:1,items:[product]});
   }
   if(path==='/api/san-pham/1')return send({...product,category:'Thời trang nữ',reviews:review.isVisible?[review]:[]});
   if(path==='/api/don-hang' || path==='/api/quan-tri/don-hang')return send({total:1,items:[order]});
   if(path==='/api/quan-tri/don-hang/21')return send(order);
   if(path==='/api/quan-tri/khach-hang')return send({total:2,items:[user(),{id:'u2',fullName:'Chưa mua',email:'empty@example.com'}]});
   if(path==='/api/quan-tri/danh-gia')return send({total:1,items:[review]});
   if(path==='/api/quan-tri/tong-quan')return send({cartQuantity:2,customers:2,products:1,orders:1,pending:1,revenue:0,bestSellers:[]});
   throw new Error('Unexpected GET '+path);
 });
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 async function go(path){await page.goto(base+'/GiaoDien/'+path+'/index.html');await page.evaluate(()=>window.shopReady);}
 try{
   for(const name of ['TongQuan','SanPham','DonHang','KhachHang','DanhGia']){
     await go('QuanTri/'+name);
     await page.waitForTimeout(150);
     const error=await page.locator('[role="alert"]:visible').allTextContents();
     assert.equal(error.filter(Boolean).length,0,name+': '+error.join(','));
     console.log('Rendered admin '+name);
   }
   await go('QuanTri/DonHang');await page.locator('[data-action="details"]').click();
   await page.waitForSelector('#order-dialog[open]');assert.match(await page.locator('#order-detail-content').innerText(),/Địa chỉ thử/);
   await page.locator('#close-order-dialog').click();
   await page.locator('.order-status-select').selectOption('confirmed');await page.locator('[data-action="save-status"]').click();
   await page.waitForFunction(()=>document.querySelector('#orders-feedback').hidden===false);
   assert.equal(order.status,'Confirmed');
   await go('QuanTri/KhachHang');await page.waitForFunction(()=>document.querySelector('#customers-list').children.length===2);
   await go('QuanTri/SanPham');await page.locator('[data-action="edit"]').click();
   assert.equal(await page.locator('[data-field="price"]').first().isEditable(),true);
   assert.equal(await page.locator('#product-tag').isEditable(),true);
   await page.locator('#product-name').fill('Áo đã sửa');await page.locator('#product-form [type="submit"]').click();
   await page.waitForFunction(()=>!document.querySelector('#product-dialog').open);
   assert(mutations.some(x=>x.path==='/api/quan-tri/san-pham/1'&&x.body.name==='Áo đã sửa'));
   await go('QuanTri/DanhGia');await page.locator('[data-action="toggle"]').click();
   await page.waitForFunction(()=>document.querySelector('#hidden-reviews').textContent==='1');
   role='Customer';
   for(const name of ['TaiKhoan','DonHang','GioHang','SanPham']){
     await go('NguoiDung/'+name);await page.waitForTimeout(100);console.log('Rendered user '+name);
   }
   await page.waitForSelector('.product-card');assert.equal(await page.locator('.product-card').count(),1);
   await page.locator('[data-view-product]').first().click();await page.waitForSelector('#product-dialog[open]');
   await page.selectOption('#detail-size','M');await page.selectOption('#detail-color','Đen');
   await page.locator('#detail-form [type="submit"]').click();await page.waitForFunction(()=>!document.querySelector('#product-dialog').open);
   assert.equal(cart[0].quantity,2);
   await go('NguoiDung/GioHang');await page.waitForSelector('.cart-item');
   await page.locator('button[aria-label="Tăng số lượng"]').click();
   await page.waitForFunction(()=>document.querySelector('.quantity-value').textContent==='3');
   await page.locator('#checkout-button').click();await page.waitForSelector('#checkout-dialog[open]');
   await page.fill('#checkout-phone','0901234567');await page.fill('#checkout-address','Địa chỉ thử');
   await page.locator('#checkout-form [type="submit"]').click();await page.waitForURL('**/DonHang/index.html?order=21');
   await page.waitForSelector('.order-card');assert.match(await page.locator('.order-card').innerText(),/199\.000/);
   assert.equal((await page.evaluate(()=>localStorage.length)),0,'No demo records persisted');
   await go('NguoiDung/SanPham');failCatalog=true;await page.reload();
   await page.waitForSelector('#products-load-error:not([hidden])');assert.equal(await page.locator('.product-card').count(),0);failCatalog=false;
   loggedIn=false;
   await go('NguoiDung/DangKy');await page.fill('#full-name','Tên thử');await page.fill('#email','register@example.com');await page.fill('#password','Fashion!2026');await page.fill('#confirm-password','Fashion!2026');
   await page.locator('input[name="terms"]').check();await page.locator('#auth-form [type="submit"]').click();
   await page.waitForURL('**/TaiKhoan/index.html');assert(mutations.some(x=>x.path.endsWith('dang-ky')));
   await page.locator('#account-logout').click();await page.waitForURL('**/DangNhap/index.html');
   await page.fill('#email','test@example.com');await page.fill('#password','Fashion!2026');await page.locator('#auth-form [type="submit"]').click();await page.waitForURL('**/TaiKhoan/index.html');
   await go('NguoiDung/TrangChu');await page.waitForTimeout(500);
   assert.deepEqual(errors,[],'No unhandled browser JavaScript errors');
   console.log('PASS: all 12 pages, CRUD connections, checkout, CSRF headers, auth redirects, no localStorage, API failure states.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
