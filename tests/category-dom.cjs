// Requires jsdom. Tests actual category UI against a stateful mock API, not SQL Server.
const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'../Backend/wwwroot/GiaoDien');
const dom=new JSDOM(fs.readFileSync(root+'/QuanTri/DanhMuc/index.html','utf8'),{runScripts:'outside-only',url:'https://localhost:7043/GiaoDien/QuanTri/DanhMuc/index.html',pretendToBeVisual:true});
const w=dom.window,d=w.document,$=id=>d.getElementById(id),tick=()=>new Promise(r=>setTimeout(r,20));
let rows=[{id:1,name:'Áo',code:'ao',description:'Test',isActive:true,productCount:3}],fail=false,forceConflict=false;
const calls=[];
w.matchMedia=q=>({matches:q.includes('reduce')});
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
Object.defineProperty(w,'localStorage',{get(){throw new Error('Category page must use API, not localStorage.');}});
w.fetch=async(url,options={})=>{
 const method=options.method||'GET';let value,status=200;const body=options.body?JSON.parse(options.body):null;calls.push({url,method,body});
 if(url==='/api/tai-khoan/csrf')value={token:'csrf'};
 else if(url==='/api/tai-khoan/me')value={id:'admin',email:'admin@example.com',fullName:'Admin',roles:['Admin']};
 else if(method==='GET'){
  if(fail){value={message:'Mất kết nối thử nghiệm'};status=500;}
  else if(url==='/api/quan-tri/danh-muc')value=rows;
  else {const id=Number(url.split('/').pop());value=rows.find(c=>c.id===id);if(!value){status=404;value={message:'Không có danh mục'};}}
 }else{
  assert.equal(options.headers['X-CSRF-TOKEN'],'csrf');const id=Number(url.split('/')[4]);
  if(forceConflict){status=409;value={message:'Tên danh mục vừa được tạo ở cửa sổ khác.'};}
  else if(method==='POST'){value={id:2};rows.push({...body,id:2,productCount:0});}
  else if(method==='PUT'){rows=rows.map(c=>c.id===id?{...c,...body}:c);status=204;}
  else if(method==='PATCH'){rows=rows.map(c=>c.id===id?{...c,isActive:body.isActive}:c);status=204;}
  else if(method==='DELETE'){rows=rows.filter(c=>c.id!==id);status=204;}
 }
 return new Response(status===204?null:JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
};
(async()=>{
 for(const file of ['DungChung/api.js','DungChung/auth.js','DungChung/admin-nav.js','QuanTri/DanhMuc/app.js']){
  const result=w.eval(fs.readFileSync(root+'/'+file,'utf8'));if(result?.then)await result;
 }
 await tick();assert.equal($('total-categories').textContent,'1');assert.equal($('categorized-products').textContent,'3');
 const click=(id,action)=>d.querySelector(`[data-id="${id}"][data-action="${action}"]`).click();
 click(1,'delete');await tick();assert.equal($('delete-dialog').open,false);assert.equal($('categories-error').hidden,false);
 $('add-category').click();$('category-name').value='Phụ kiện';$('category-name').dispatchEvent(new w.Event('input'));assert.equal($('category-code').value,'phu-kien');
 const submit=()=>{$('category-form').dispatchEvent(new w.Event('submit',{cancelable:true}));};submit();await tick();assert.equal(rows.length,2);assert.equal($('category-dialog').open,false);
 click(2,'edit');await tick();$('category-description').value='<img src=x onerror=alert(1)>';submit();await tick();assert.equal(d.querySelectorAll('.category-identity img').length,0);assert($('categories-list').textContent.includes('<img src=x'));
 click(2,'toggle');await tick();assert.equal(rows.find(c=>c.id===2).isActive,false);
 $('category-filter').value='hidden';$('category-filter').dispatchEvent(new w.Event('change'));assert.equal($('categories-list').children.length,1);
 $('clear-filters').click();click(2,'delete');await tick();assert.equal($('delete-dialog').open,true);$('cancel-delete').click();assert.equal(rows.length,2);
 click(2,'delete');await tick();$('delete-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();assert.equal(rows.length,1);
 $('add-category').click();$('category-name').value='Áo';$('category-code').value='dup';submit();await tick();assert.equal($('form-error').hidden,false);assert.equal(rows.length,1);
 $('category-name').value='Tên mới';$('category-code').value='ten-moi';forceConflict=true;submit();await tick();assert.equal($('category-dialog').open,true);assert.match($('form-error').textContent,/cửa sổ khác/);forceConflict=false;$('cancel-dialog').click();
 fail=true;$('refresh-button').click();await tick();assert.equal($('categories-error').hidden,false);assert.equal($('add-category').disabled,true);assert.equal($('categories-list').children.length,0);
 fail=false;$('refresh-button').click();await tick();assert.equal($('add-category').disabled,false);assert.equal($('categories-list').children.length,1);
 assert(calls.some(c=>c.method==='POST')&&calls.some(c=>c.method==='PUT')&&calls.some(c=>c.method==='PATCH')&&calls.some(c=>c.method==='DELETE'));
 console.log('PASS category API UI: CRUD, CSRF headers, hide/filter, escaping, in-use deletion guard, confirmations, conflict and network recovery, no localStorage.');w.close();
})().catch(e=>{console.error(e);w.close();process.exitCode=1;});
