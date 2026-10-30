// Run with jsdom installed: node tests/image-upload-dom.cjs
const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'../Backend/wwwroot');
const tick=()=>new Promise(resolve=>setTimeout(resolve,25));
const images=[],products=[],calls=[];
let releaseUpload,failUpload=false,uploadPending=false;
async function main(){
 const dom=new JSDOM(fs.readFileSync(root+'/GiaoDien/QuanTri/SanPham/index.html','utf8'),{
  url:'https://localhost:7043/GiaoDien/QuanTri/SanPham/index.html',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,d=w.document,$=id=>d.getElementById(id);
 w.matchMedia=q=>({matches:q.includes('reduce')});w.confirm=()=>true;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.fetch=async(url,options={})=>{
  const method=options.method||'GET';calls.push({url,method,options});let data,status=200;
  if(url==='/api/tai-khoan/csrf')data={token:'upload-csrf'};
  else if(url==='/api/tai-khoan/me')data={id:'admin',fullName:'Admin',roles:['Admin']};
  else if(url==='/api/gio-hang')data=[];
  else if(url==='/api/quan-tri/danh-muc')data=[{id:1,name:'Áo',isActive:true}];
  else if(url.startsWith('/api/quan-tri/san-pham?'))data={total:products.length,items:products};
  else if(url==='/api/quan-tri/anh-san-pham'&&method==='GET')data=images;
  else if(url==='/api/quan-tri/anh-san-pham'&&method==='POST'){
   assert(options.body instanceof w.FormData,'Send multipart FormData');
   assert.equal(options.headers['Content-Type'],undefined,'Browser must set multipart boundary');
   assert.equal(options.headers['X-CSRF-TOKEN'],'upload-csrf');
   assert.equal(options.credentials,'same-origin');
   assert.equal(options.body.get('file').name,'ao-moi.png');
   uploadPending=true;await new Promise(resolve=>releaseUpload=resolve);uploadPending=false;
   if(failUpload){status=400;data={message:'Nội dung ảnh không hợp lệ.'};}
   else {data={url:'/images/san-pham/ao-moi-unique.png',name:'ao-moi-unique.png'};images.push(data);}
  }
  else if(url==='/api/quan-tri/san-pham'&&method==='POST'){
   assert.equal(options.headers['Content-Type'],'application/json');
   assert.equal(options.headers['X-CSRF-TOKEN'],'upload-csrf');
   const product=JSON.parse(options.body);product.id=1;product.variants=product.variants.map((v,i)=>({...v,id:i+1}));
   products.push(product);data={id:1};
  }
  else throw Error('Unexpected request '+method+' '+url);
  return new Response(status===204?null:JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
 };
 for(const script of d.querySelectorAll('script[src]')){
  const file=root+decodeURIComponent(new URL(script.src).pathname);
  const result=w.eval(fs.readFileSync(file,'utf8'));if(result?.then)await result;
 }
 await tick();$('add-product').click();await tick();
 assert($('product-dialog').open);const old=$('product-image').value;
 assert(old.startsWith('/images/'),'Old image dropdown remains');
 const choose=(name,size=100)=>{
  const file=new w.File([new Uint8Array(size)],name,{type:'image/png'});
  Object.defineProperty($('product-image-file'),'files',{configurable:true,value:[file]});
  $('product-image-file').dispatchEvent(new w.Event('change'));
 };
 const uploadCount=()=>calls.filter(c=>c.url==='/api/quan-tri/anh-san-pham'&&c.method==='POST').length;
 choose('file.svg');await tick();assert.equal(uploadCount(),0);assert.equal($('image-upload-status').dataset.state,'error');assert.equal($('product-image').value,old);
 choose('large.png',5*1024*1024+1);await tick();assert.equal(uploadCount(),0);
 choose('ao-moi.png');await tick();assert(uploadPending);
 assert($('product-form').querySelector('[type="submit"]').disabled);
 assert($('product-image-file').disabled&&$('product-image').disabled);
 $('product-form').dispatchEvent(new w.Event('submit',{cancelable:true}));
 const cancel=new w.Event('cancel',{cancelable:true});$('product-dialog').dispatchEvent(cancel);assert(cancel.defaultPrevented);
 assert(!calls.some(c=>c.url==='/api/quan-tri/san-pham'&&c.method==='POST'));
 releaseUpload();await tick();assert.equal($('product-image').value,images[0].url);
 assert.equal($('product-image-preview').getAttribute('src'),images[0].url);assert(!$('image-preview-wrap').hidden);
 assert.equal($('image-upload-status').dataset.state,'success');assert(!$('product-form').querySelector('[type="submit"]').disabled);
 // A subsequent failed upload must leave the previous successful selection intact.
 failUpload=true;choose('ao-moi.png');await tick();releaseUpload();await tick();
 assert.equal($('product-image').value,images[0].url);assert.equal($('image-upload-status').dataset.state,'error');
 // Switching back to an old image still works, and the new one stays reusable.
 $('product-image').value=old;$('product-image').dispatchEvent(new w.Event('change'));
 assert.equal($('product-image-preview').getAttribute('src'),old);
 $('product-image').value=images[0].url;$('product-image').dispatchEvent(new w.Event('change'));
 $('product-name').value='Áo mới';$('product-description').value='Cotton';$('product-category').value='1';
 for(const [field,value] of Object.entries({size:'M',color:'Đen',price:'199000',stock:'10'}))
  $('variant-rows').querySelector('[data-field="'+field+'"]').value=value;
 $('product-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();
 assert.equal(products[0].imageUrl,images[0].url);assert(!$('product-dialog').open);
 d.querySelector('[data-action="edit"]').click();await tick();
 assert.equal($('product-image').value,products[0].imageUrl,'Edit retains uploaded image');
 $('cancel-dialog').click();$('add-product').click();await tick();
 assert([...$('product-image').options].some(o=>o.value===images[0].url),'Reuse uploaded image on next product');
 // Fresh page session gets the uploaded option from the server, not localStorage.
 assert(calls.filter(c=>c.url==='/api/quan-tri/anh-san-pham'&&c.method==='GET').length>=3);
 assert.equal(w.localStorage.length,0);
 dom.window.close();console.log('PASS image DOM workflow: multipart+CSRF, original dropdown, auto-select/preview, save lock, file validation, failure retention, product payload, edit and reusable images. Mock API used.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
