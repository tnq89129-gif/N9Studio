const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'../Backend/wwwroot/GiaoDien');
let products=[{id:1,name:'Áo',description:'Cotton',imageUrl:'/images/7.jpg',categoryId:1,isActive:true,tag:'',variants:[]}],nextId=100,conflict=false;
const calls=[],tick=()=>new Promise(r=>setTimeout(r,30));
async function load(name){
 const dom=new JSDOM(fs.readFileSync(root+'/'+name+'/index.html','utf8'),{runScripts:'outside-only',url:'https://localhost:7043/GiaoDien/'+name+'/index.html',pretendToBeVisual:true});const w=dom.window;
 w.matchMedia=q=>({matches:q.includes('reduce')});w.confirm=()=>true;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.fetch=async(url,options={})=>{
  const method=options.method||'GET',body=options.body?JSON.parse(options.body):null;calls.push({url,method,body});let data,status=200;
  if(url==='/api/tai-khoan/csrf')data={token:'csrf'};
  else if(url==='/api/tai-khoan/me')data={id:'admin',fullName:'Admin',email:'admin@example.com',roles:['Admin']};
  else if(url==='/api/gio-hang')data=[];
  else if(url==='/api/quan-tri/anh-san-pham')data=[];
  else if(url.endsWith('/danh-muc'))data=[{id:1,name:'Áo',isActive:true}];
  else if(method==='GET'&&(url.startsWith('/api/quan-tri/san-pham?')||url.startsWith('/api/san-pham?')))data={total:products.length,items:products};
  else if(method==='GET'&&url==='/api/san-pham/1')data={...products[0],category:'Áo',reviews:[]};
  else if(method!=='GET'){
   assert.equal(options.headers['X-CSRF-TOKEN'],'csrf');
   if(conflict){status=409;data={message:'Size/màu vừa thay đổi. Hãy tải lại.'};}
   else if(method==='PUT'){
    const id=Number(url.split('/').pop()),index=products.findIndex(p=>p.id===id);
    products[index]={...products[index],...body,variants:body.variants.map(v=>({...v,id:v.id??nextId++}))};status=204;
   }else if(method==='POST'){
    const id=products.length+1;products.push({...body,id,variants:body.variants.map(v=>({...v,id:nextId++}))});data={id};
   }else throw new Error('Unexpected mutation '+url);
  }else throw new Error('Unexpected GET '+url);
  return new Response(status===204?null:JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
 };
 for(const script of w.document.querySelectorAll('script[src]')){
  const file=new URL(script.src).pathname.replace('/GiaoDien/','');if(!fs.existsSync(root+'/'+file))continue;
  const result=w.eval(fs.readFileSync(root+'/'+file,'utf8'));if(result?.then)await result;
 }
 await tick();return w;
}
(async()=>{
 let w=await load('QuanTri/SanPham'),d=w.document,$=id=>d.getElementById(id);
 async function edit(){d.querySelector('[data-action="edit"]').click();await tick();assert($('product-dialog').open);}
 function fillRow(row,size,color,price,stock){for(const [key,value] of Object.entries({size,color,price,stock})){const input=row.querySelector(`[data-field="${key}"]`);assert(!input.disabled);input.value=value;}}
 const submit=()=>{$('product-form').dispatchEvent(new w.Event('submit',{cancelable:true}));};
 await edit();assert(!$('product-tag').disabled);assert.equal($('variant-rows').children.length,1);
 fillRow($('variant-rows').children[0],'M','Đen',199000,10);$('product-tag').value='Mới';$('add-variant').click();fillRow($('variant-rows').children[1],'L','Trắng',249000,2);
 submit();await tick();assert.equal(products[0].variants.length,2);assert.equal(products[0].tag,'Mới');assert(!$('product-dialog').open);
 await edit();assert.equal($('product-tag').value,'Mới');assert.equal($('variant-rows').children[0].querySelector('[data-field="price"]').value,'199000');
 fillRow($('variant-rows').children[0],'M','Xanh',219000,9);$('product-tag').value='Bán chạy';submit();await tick();assert.equal(products[0].variants[0].id,100);assert.equal(products[0].variants[0].price,219000);assert.equal(products[0].variants[0].color,'Xanh');
 await edit();fillRow($('variant-rows').children[1],'M','Xanh',249000,2);const count=calls.filter(c=>c.method==='PUT').length;submit();await tick();assert(!$('form-error').hidden);assert.equal(calls.filter(c=>c.method==='PUT').length,count);
 fillRow($('variant-rows').children[1],'L','Trắng',249000,2);conflict=true;submit();await tick();assert($('product-dialog').open);assert.match($('form-error').textContent,/Hãy tải lại/);conflict=false;$('cancel-dialog').click();
 $('add-product').click();await tick();$('product-name').value='Áo mới';$('product-description').value='Cotton';$('product-category').value='1';$('product-tag').value='Hàng mới';fillRow($('variant-rows').children[0],'S','Đen',150000,5);submit();await tick();assert.equal(products.length,2);assert.equal(products[1].tag,'Hàng mới');assert.equal(products[1].variants[0].price,150000);w.close();
 w=await load('NguoiDung/SanPham');assert.equal(w.document.querySelectorAll('.product-card').length,2);assert.match(w.document.querySelector('.product-card').textContent,/Bán chạy/);assert.match(w.document.querySelector('.product-card').textContent,/219\.000/);w.close();
 console.log('PASS editable product price/color/tag, multiple sizes, persisted reload, stable variant IDs, duplicate/conflict handling, atomic request payload and storefront tag/price. Mock API used.');
})().catch(e=>{console.error(e);process.exitCode=1;});
