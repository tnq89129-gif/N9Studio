const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'../Backend/wwwroot'),tick=()=>new Promise(r=>setTimeout(r,25));
async function load(page,fragment=''){
 const dom=new JSDOM(fs.readFileSync(root+'/GiaoDien/NguoiDung/'+page+'/index.html','utf8'),{url:'https://n9studio.onrender.com/GiaoDien/NguoiDung/'+page+'/index.html'+fragment,runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,calls=[];let fail=false;
 w.matchMedia=q=>({matches:q.includes('reduce')});
 w.fetch=async(url,options={})=>{
  const method=options.method||'GET',body=options.body?JSON.parse(options.body):null;calls.push({url,method,body,headers:options.headers});let data={},status=200;
  if(url==='/api/tai-khoan/me')status=401;
  else if(url==='/api/tai-khoan/csrf')data={token:'recovery-csrf'};
  else if(url==='/api/gio-hang')data=[];
  else if(method==='POST'&&['/api/tai-khoan/quen-mat-khau','/api/tai-khoan/dat-lai-mat-khau'].includes(url)){
   assert.equal(options.headers['X-CSRF-TOKEN'],'recovery-csrf');
   if(fail){status=400;data={message:'Liên kết đã hết hạn.'};}
   else data={message:'Nếu email khớp với một tài khoản, hướng dẫn sẽ được gửi.'};
  }else throw new Error('Unexpected request '+url);
  return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
 };
 for(const script of w.document.querySelectorAll('script[src]')){
  const src=new URL(script.src).pathname;const result=w.eval(fs.readFileSync(root+decodeURIComponent(src),'utf8'));if(result?.then)await result;
 }
 await tick();return {w,calls,fail:value=>fail=value};
}
(async()=>{
 const login=fs.readFileSync(root+'/GiaoDien/NguoiDung/DangNhap/index.html','utf8');assert(login.includes('../QuenMatKhau/index.html'));assert(!login.includes('chưa được triển khai'));
 let t=await load('QuenMatKhau'),w=t.w,d=w.document,$=id=>d.getElementById(id);
 $('recovery-email').value='admin@example.com';$('recovery-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();
 assert(t.calls.some(c=>c.url.endsWith('quen-mat-khau')&&c.body.email==='admin@example.com'));
 assert.equal($('recovery-status').dataset.state,'success');assert($('recovery-submit').disabled);assert.match($('recovery-submit').textContent,/60/);w.close();
 t=await load('DatLaiMatKhau','#email=admin%40example.com&code=Safe_code-123');w=t.w;d=w.document;$=id=>d.getElementById(id);
 assert.equal(w.location.hash,'');assert.equal($('recovery-email').value,'admin@example.com');assert($('recovery-email').readOnly);assert(!$('recovery-submit').disabled);
 const submit=()=>{$('recovery-form').dispatchEvent(new w.Event('submit',{cancelable:true}));};
 $('new-password').value='New@2026';$('confirm-password').value='Different@2026';submit();await tick();assert(!t.calls.some(c=>c.method==='POST'));assert.match($('recovery-status').textContent,/chưa khớp/);
 $('new-password').value='passwordonly';$('confirm-password').value='passwordonly';submit();await tick();assert(!t.calls.some(c=>c.method==='POST'));assert.match($('recovery-status').textContent,/chữ hoa/);
 $('new-password').value='New@2026';$('confirm-password').value='New@2026';t.fail(true);submit();await tick();assert(!$('recovery-form').hidden);assert.equal($('recovery-status').dataset.state,'error');assert.match($('recovery-status').textContent,/hết hạn/);
 t.fail(false);submit();await tick();assert($('recovery-form').hidden);assert(!$('recovery-success').hidden);
 const request=t.calls.find(c=>c.url.endsWith('dat-lai-mat-khau'));assert.equal(request.body.code,'Safe_code-123');assert.equal(request.body.confirmPassword,'New@2026');
 assert(t.calls.every(c=>!c.url.includes('Safe_code-123')));assert.equal(w.localStorage.length,0);assert.equal(w.sessionStorage.length,0);w.close();
 t=await load('DatLaiMatKhau');w=t.w;d=w.document;$=id=>d.getElementById(id);
 assert($('recovery-submit').disabled);assert($('new-password').disabled);
 const ev=new w.Event('submit',{cancelable:true});$('recovery-form').dispatchEvent(ev);assert(ev.defaultPrevented);await tick();assert(!t.calls.some(c=>c.method==='POST'));w.close();
 console.log('PASS recovery DOM: login link, forgot submit+CSRF+cooldown, fragment removal, confirm/policy checks, API failure/retry, reset success, no token in URL/storage, invalid-link form cannot submit. Mock API used.');
})().catch(e=>{console.error(e);process.exitCode=1;});
