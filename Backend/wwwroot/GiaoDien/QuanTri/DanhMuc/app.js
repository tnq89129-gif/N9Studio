(async () => {
  'use strict';
  if(!await window.shopReady)return;
  const $=id=>document.getElementById(id),url='/api/quan-tri/danh-muc';
  let categories=[],failed=false,pendingDelete=null,returnFocus=null,feedbackTimer,busy=false;
  const normalize=s=>s.normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('vi');
  const slug=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60).replace(/-$/,'');
  const map=c=>({...c,id:String(c.id),active:c.isActive});
  function feedback(message){$('categories-feedback').textContent=message;$('categories-feedback').hidden=false;clearTimeout(feedbackTimer);feedbackTimer=setTimeout(()=>$('categories-feedback').hidden=true,5000);}
  async function load(){
    $('refresh-button').disabled=true;
    try{
      categories=(await shop.request(url)).map(map);failed=false;$('categories-error').hidden=true;render();return true;
    }catch(e){failed=true;categories=[];$('categories-list').replaceChildren();$('categories-count').textContent='Không thể tải danh mục';$('categories-empty').hidden=true;
      ['total-categories','active-categories','hidden-categories','categorized-products'].forEach(id=>$(id).textContent='—');shop.error(e,$('categories-error'));return false;
    }finally{$('add-category').disabled=failed;$('refresh-button').disabled=false;}
  }
  async function sync(message){const ok=await load();feedback(message+(ok?'':' Dữ liệu đã lưu nhưng chưa tải lại được. Hãy bấm Làm mới.'));}
  function button(label,action,id,danger=false){const b=document.createElement('button');b.type='button';b.className='row-action'+(danger?' row-action--delete':'');b.textContent=label;b.dataset.action=action;b.dataset.id=id;return b;}
  function cell(child){const td=document.createElement('td');td.append(child);return td;}
  function row(c){
    const tr=document.createElement('tr'),identity=document.createElement('div');identity.className='category-identity';
    const monogram=document.createElement('span');monogram.className='category-monogram';monogram.textContent=c.name.charAt(0).toUpperCase();monogram.setAttribute('aria-hidden','true');
    const copy=document.createElement('div'),name=document.createElement('strong'),desc=document.createElement('small');name.textContent=c.name;desc.textContent=c.description||'Chưa có mô tả';copy.append(name,desc);identity.append(monogram,copy);
    const code=document.createElement('code');code.className='category-code';code.textContent=c.code;
    const quantity=document.createElement('div');quantity.className='category-count';const number=document.createElement('strong');number.textContent=c.productCount;const unit=document.createElement('span');unit.textContent='sản phẩm';quantity.append(number,unit);
    const state=document.createElement('span');state.className='product-state';state.dataset.published=String(c.active);state.textContent=c.active?'Đang hiển thị':'Đang ẩn';
    const actions=document.createElement('div');actions.className='product-row-actions';actions.append(button('Sửa','edit',c.id),button(c.active?'Ẩn':'Hiện','toggle',c.id),button('Xóa','delete',c.id,true));
    tr.append(cell(identity),cell(code),cell(quantity),cell(state),cell(actions));return tr;
  }
  function render(){
    if(failed)return;
    const query=normalize($('category-search').value),status=$('category-filter').value;
    const visible=categories.filter(c=>normalize(c.name+' '+c.code).includes(query)&&(status==='all'||(status==='active'?c.active:!c.active)));
    $('categories-list').replaceChildren(...visible.map(row));$('categories-empty').hidden=visible.length>0;
    $('categories-count').textContent=`${visible.length} / ${categories.length} danh mục`;
    $('total-categories').textContent=categories.length;$('active-categories').textContent=categories.filter(c=>c.active).length;$('hidden-categories').textContent=categories.filter(c=>!c.active).length;
    $('categorized-products').textContent=categories.reduce((sum,c)=>sum+c.productCount,0);
  }
  function close(dialog){if(busy)return;dialog.close();if(returnFocus?.isConnected)returnFocus.focus();else $('add-category').focus();}
  function openEditor(c=null){
    returnFocus=document.activeElement;$('category-form').reset();$('form-error').hidden=true;
    $('category-id').value=c?.id||'';$('category-name').value=c?.name||'';$('category-code').value=c?.code||'';$('category-description').value=c?.description||'';$('category-active').checked=c?.active??true;
    $('category-code').readOnly=!!c&&c.productCount>0;$('category-code').dataset.manual=String(!!c);
    $('dialog-title').textContent=c?'Chỉnh sửa danh mục':'Thêm danh mục';$('category-dialog').showModal();$('category-name').focus();
  }
  $('category-name').addEventListener('input',()=>{if($('category-code').dataset.manual!=='true'&&!$('category-id').value)$('category-code').value=slug($('category-name').value);});
  $('category-code').addEventListener('input',()=>$('category-code').dataset.manual='true');
  $('category-form').addEventListener('submit',async event=>{
    event.preventDefault();if(busy||!$('category-form').reportValidity())return;
    $('form-error').hidden=true;
    await shop.action($('category-form').querySelector('[type="submit"]'),async()=>{
      const id=$('category-id').value,name=$('category-name').value.trim().replace(/\s+/g,' '),code=normalize($('category-code').value);
      if(!name)throw new Error('Tên danh mục không được chỉ chứa khoảng trắng.');
      if(!/^[a-z0-9]+(?:[ -][a-z0-9]+)*$/.test(code))throw new Error('Mã chỉ gồm chữ thường không dấu, số, gạch ngang hoặc khoảng trắng giữa các từ.');
      if(categories.some(c=>c.id!==id&&(normalize(c.name)===normalize(name)||normalize(c.code)===code)))throw new Error('Tên hoặc mã danh mục đã tồn tại.');
      busy=true;
      try{await shop.request(url+(id?'/'+id:''),id?'PUT':'POST',{name,code,description:$('category-description').value.trim(),isActive:$('category-active').checked});}
      finally{busy=false;}
      close($('category-dialog'));await sync(id?'Đã cập nhật danh mục.':'Đã thêm danh mục mới.');
    },e=>shop.error(e,$('form-error')));
  });
  $('categories-list').addEventListener('click',async event=>{
    const b=event.target.closest('[data-action]');if(!b||busy)return;
    await shop.action(b,async()=>{
      if(b.dataset.action==='toggle'){
        const c=categories.find(c=>c.id===b.dataset.id);if(!c)return;
        busy=true;try{await shop.request(url+'/'+c.id+'/trang-thai','PATCH',{isActive:!c.active});}finally{busy=false;}
        await sync(c.active?'Đã ẩn danh mục và tạm ngừng bán sản phẩm thuộc danh mục.':'Đã hiển thị lại danh mục.');return;
      }
      const c=map(await shop.request(url+'/'+b.dataset.id));
      if(b.dataset.action==='edit'){openEditor(c);return;}
      if(c.productCount>0)throw new Error(`“${c.name}” đang có ${c.productCount} sản phẩm. Chuyển sản phẩm sang danh mục khác trước khi xóa.`);
      returnFocus=b;pendingDelete=c.id;$('delete-error').hidden=true;$('delete-description').textContent=`Bạn muốn xóa “${c.name}”? Thao tác này không thể hoàn tác.`;$('delete-dialog').showModal();$('cancel-delete').focus();
    },e=>shop.error(e,$('categories-error')));
  });
  $('delete-form').addEventListener('submit',async event=>{
    event.preventDefault();if(busy||!pendingDelete)return;$('delete-error').hidden=true;
    await shop.action($('delete-form').querySelector('[type="submit"]'),async()=>{
      busy=true;try{await shop.request(url+'/'+pendingDelete,'DELETE');}finally{busy=false;}
      close($('delete-dialog'));pendingDelete=null;await sync('Đã xóa danh mục.');
    },e=>shop.error(e,$('delete-error')));
  });
  for(const id of ['close-dialog','cancel-dialog'])$(id).onclick=()=>close($('category-dialog'));
  for(const id of ['close-delete','cancel-delete'])$(id).onclick=()=>close($('delete-dialog'));
  for(const id of ['category-dialog','delete-dialog']){
    $(id).addEventListener('cancel',e=>{if(busy)e.preventDefault();});
    $(id).addEventListener('click',e=>{if(e.target===$(id)){const rect=$(id).getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)close($(id));}});
  }
  $('add-category').onclick=()=>openEditor();$('category-search').oninput=render;$('category-filter').onchange=render;
  $('clear-filters').onclick=()=>{$('category-search').value='';$('category-filter').value='all';render();$('category-search').focus();};
  $('refresh-button').onclick=()=>{if(!busy)load();};
  window.addEventListener('focus',()=>{if(!busy&&!$('category-dialog').open&&!$('delete-dialog').open)load();});
  $('today-label').textContent=new Intl.DateTimeFormat('vi-VN',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date());
  await load();
})();
