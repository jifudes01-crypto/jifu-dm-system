/* JIFU_QR_PHOTO_SCROLL_FINAL_20260528 */
/* JIFU_QR_PHOTO_SAFE_LAYOUT_20260528 */
/* JIFU_QR_POSITION_EDITOR_NUMBER_FIX_20260528 */
/* JIFU_PHOTO_POSITION_EDITOR_20260528 */
/* JIFU_FINAL_IMAGE_QR_ONLY_20260528 */
/* JIFU_FINAL_COORDINATE_CORRECTED_20260528 */
/* JIFU_IDEAL_LAYOUT_FINAL_20260527 */
(function(){
  'use strict';
  var app=document.getElementById('app');
  var W=1456,H=2048;
  var cfg=(window.JIFU_SUPABASE||{});
  var sb=null,user=null,view='front';
  var dms=[],contacts=[],logs=[];
  var selectedDm='', selectedContact='';
  var assets={photo:'',qr:''};
  var settings=defaultSettings();
  var pendingFiles=[];

  function defaultSettings(){return {x:950,y:58,w:452,h:142,nameSize:34,titleSize:24,phoneSize:26,companySize:18,nameGap:8,subGap:8,paddingX:18,paddingY:8,fontFamily:'Microsoft JhengHei',fontWeight:'bold',color:'#000000',bgEnabled:false,photoX:1268,photoY:68,photoSize:118,qrX:1268,qrY:68,qrSize:118};}
    function numOr(v, fallback){
    var n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

function escapeHtml(v){return String(v||'').replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];});}
  function escapeAttr(v){return escapeHtml(v).replace(/`/g,'&#96;');}
  function notice(msg){var n=document.getElementById('notice'); if(n)n.textContent=msg;}
  function bucket(){return cfg.storageBucket||cfg.bucket||'dm-assets';}
  function safeName(name){var ext=(name.match(/\.[a-zA-Z0-9]+$/)||['.jpg'])[0].toLowerCase();return Date.now()+'_'+Math.random().toString(36).slice(2)+'_dm'+ext;}

  window.addEventListener('error',function(e){console.error(e.error||e.message);});
  window.addEventListener('unhandledrejection',function(e){console.error(e.reason); notice('發生錯誤：'+((e.reason&&e.reason.message)||e.reason||'未知錯誤'));});

  function init(){
    if(!cfg.url || !cfg.anonKey || !window.supabase){
      app.innerHTML='<div class="fatal-panel"><h2>Supabase 尚未設定完成</h2><p>請檢查 config.js 是否有 url 與 anonKey，且金鑰必須在同一行。</p></div>';
      return;
    }
    sb=window.supabase.createClient(cfg.url,cfg.anonKey);
    sb.auth.getSession().then(function(res){user=res.data.session&&res.data.session.user||null; return loadAll();});
    sb.auth.onAuthStateChange(function(evt,session){user=session&&session.user||null; loadAll();});
  }

  async function loadAll(){
    renderShell();
    try{
      var dmRes=await sb.from('dm_items').select('*').eq('is_active',true).order('created_at',{ascending:false});
      if(dmRes.error) throw dmRes.error;
      dms=dmRes.data||[];
      if(!selectedDm && dms[0]) selectedDm=dms[0].id;
      var cRes=await sb.from('contacts').select('*').eq('is_active',true).order('created_at',{ascending:false});
      if(cRes.error) throw cRes.error;
      contacts=cRes.data||[];
      if(!selectedContact && contacts[0]) selectedContact=contacts[0].id;
      var sRes=await sb.from('app_settings').select('*').eq('key','contact_box').maybeSingle();
      if(!sRes.error && sRes.data && sRes.data.value) settings=Object.assign(defaultSettings(),sRes.data.value);
      if(user){var lRes=await sb.from('access_logs').select('*').order('created_at',{ascending:false}).limit(60); if(!lRes.error) logs=lRes.data||[];}
      render();
      renderCanvas();
      notice('已連線雲端資料庫。');
    }catch(err){console.error(err); notice('資料讀取失敗：'+(err.message||err)); render();}
  }

  function renderShell(){
    app.innerHTML='<header class="topbar"><div class="brand"><small>JIFU CLOUD DM SYSTEM</small><h1>吉富 DM 套版系統</h1><p>前台套聯絡資訊，後台管理 DM 與通訊錄</p></div><nav class="tabs">'+tab('front','前台下載')+tab('admin','後台管理')+tab('contacts','通訊錄')+tab('settings','欄位設定')+tab('logs','紀錄')+'</nav></header><div id="notice" class="notice">正在連線雲端資料庫...</div><main id="main" class="wrap"></main>';
    document.querySelectorAll('.tab').forEach(function(btn){btn.onclick=function(){view=btn.dataset.view;render(); if(view==='front') setTimeout(renderCanvas,50);};});
  }
  function tab(id,label){return '<button class="tab '+(view===id?'active':'')+'" data-view="'+id+'" type="button">'+label+'</button>';}
  function render(){
    document.querySelectorAll('.tab').forEach(function(btn){btn.classList.toggle('active',btn.dataset.view===view);});
    var main=document.getElementById('main'); if(!main)return;
    if(view==='front') main.innerHTML=frontHtml();
    if(view==='admin') main.innerHTML=adminHtml();
    if(view==='contacts') main.innerHTML=contactsHtml();
    if(view==='settings') main.innerHTML=settingsHtml();
    if(view==='logs') main.innerHTML=logsHtml();
    bindPage();
  }

  function frontHtml(){
    var c = getSelectedContact ? getSelectedContact() : null;
    var photoUrl = c ? (c.photo_url || c.avatar_url || '') : '';
    var qrUrl = c ? (c.qr_url || c.qr_code_url || '') : '';

    return '<div class="grid"><aside><section class="card"><h2>前台下載</h2>' +
      '<div class="field"><label>選擇 DM</label><select id="dmSelect">'+options(dms,selectedDm,'name','請選擇 DM')+'</select></div>' +
      '<div class="field"><label>選擇業務聯絡資訊</label><select id="contactSelect">'+contactOptions()+'</select><small>資料來自雲端通訊錄；形象照與 QR Code 由後台管理。</small></div>' +
      '<div class="mini-contact">' +
        '<div><strong>' + escapeHtml(c ? (c.name || '未命名') : '尚未選擇') + '</strong><span>' + escapeHtml(c ? (c.title || '') : '') + '</span><p>' + escapeHtml(c ? (c.phone || '') : '') + '<br>' + escapeHtml(c ? (c.company || '') : '') + '</p></div>' +
        '<div class="mini-assets">' +
          (photoUrl ? '<img src="' + escapeAttr(photoUrl) + '" alt="形象照">' : '<span>無形象照</span>') +
          (qrUrl ? '<img src="' + escapeAttr(qrUrl) + '" alt="QR Code">' : '<span>無 QR</span>') +
        '</div>' +
      '</div>' +
      '<button id="renderBtn" class="btn primary full">更新預覽</button><button id="downloadBtn" class="btn gold full">下載 DM 圖片</button>' +
      '</section><section class="card"><h2>使用說明</h2><p class="muted">業務只要選擇 DM 與自己的姓名，即可自動帶入聯絡資訊、形象照與 QR Code，並下載完整 DM。上傳與刪除請到後台通訊錄管理。</p></section></aside>' +
      '<section><section class="card"><h2>即時預覽</h2><div class="canvas-wrap"><canvas id="dmCanvas" class="dm-canvas"></canvas></div></section><section class="card"><h2>可選 DM</h2><div class="dm-grid">'+dmCards(false)+'</div></section></section></div>';
  }
  function adminHtml(){
    return '<div class="grid admin"><aside><section class="card"><h2>後台登入</h2><p class="muted">'+(user?'已登入：'+escapeHtml(user.email):'尚未登入。前台可用，後台管理需登入。')+'</p><div class="field"><label>管理員 Email</label><input id="loginEmail" value="'+escapeAttr(user&&user.email||'')+'"></div><div class="field"><label>密碼</label><input id="loginPassword" type="password"></div><button id="loginBtn" class="btn primary full">登入後台</button><button id="logoutBtn" class="btn line full">登出</button></section><section class="card '+(!user?'hidden':'')+'"><h2>上傳已排版 DM</h2><label class="upload">一次上傳多張 DM<input id="dmUpload" type="file" accept="image/*" multiple></label><div id="pendingInfo" class="muted">尚未選擇檔案</div><button id="uploadBtn" class="btn gold full">上傳並發布</button><div class="table-note">請使用英文檔名，例如 A26-5_DM01.jpg。不要用中文、空格、單引號。</div></section></aside><section><section class="card"><h2>DM 管理</h2><div class="dm-grid">'+dmCards(true)+'</div></section></section></div>';
  }
  function contactsHtml(){
    return '<section class="card"><h2>通訊錄管理</h2><p class="muted">前台會讀取這裡的業務資料。CSV 匯入欄位請用：name,title,phone,company,address</p><div class="'+(!user?'hidden':'')+'"><div class="row4"><div class="field"><label>姓名</label><input id="cName"></div><div class="field"><label>職稱</label><input id="cTitle"></div><div class="field"><label>電話</label><input id="cPhone"></div><div class="field"><label>公司</label><input id="cCompany"></div></div><div class="field"><label>地址</label><input id="cAddress"></div><button id="addContactBtn" class="btn primary">新增聯絡人</button></div><div class="contact-grid" style="margin-top:18px">'+contactCards()+'</div></section>';
  }
  function settingsHtml(){
    return '<section class="card"><h2>右上角聯絡資訊欄位設定</h2><p class="muted">所有設定都會存到雲端。這些欄位只控制右上角白色聯絡資訊框，不會影響物件格。</p><div class="row4"><div class="field"><label>姓名字級</label><input id="nameSize" type="number" value="'+settings.nameSize+'"></div><div class="field"><label>職稱字級</label><input id="titleSize" type="number" value="'+settings.titleSize+'"></div><div class="field"><label>電話字級</label><input id="phoneSize" type="number" value="'+settings.phoneSize+'"></div><div class="field"><label>公司/地址字級</label><input id="companySize" type="number" value="'+settings.companySize+'"></div></div><div class="row4"><div class="field"><label>姓名區行距</label><input id="nameGap" type="number" value="'+settings.nameGap+'"></div><div class="field"><label>下方資訊行距</label><input id="subGap" type="number" value="'+settings.subGap+'"></div><div class="field"><label>左右內距</label><input id="paddingX" type="number" value="'+settings.paddingX+'"></div><div class="field"><label>上下內距</label><input id="paddingY" type="number" value="'+settings.paddingY+'"></div></div><div class="row"><div class="field"><label>字型</label><select id="fontFamily"><option>Microsoft JhengHei</option><option>PMingLiU</option><option>MingLiU</option><option>DFKai-SB</option><option>Arial</option><option>Tahoma</option></select></div><div class="field"><label>文字粗細</label><select id="fontWeight"><option value="normal">一般</option><option value="600">SemiBold</option><option value="bold">粗體</option><option value="900">超粗</option></select></div></div><div class="row"><div class="field"><label>文字顏色</label><input id="fontColor" type="color" value="'+settings.color+'"></div><div class="field"><label>聯絡區背景</label><select id="bgEnabled"><option value="false">不要底色，使用公版白色框</option><option value="true">加半透明底色</option></select></div></div><button id="saveSettingsBtn" class="btn primary '+(!user?'hidden':'')+'">儲存設定到雲端</button><p class="admin-only-note '+(user?'hidden':'')+'">請先登入後台，才能儲存欄位設定。</p></section>';
  }
  function logsHtml(){return '<section class="card"><h2>紀錄</h2><div class="log-list">'+(user?(logs.length?logs.map(function(l){return '<div>'+new Date(l.created_at).toLocaleString()+'｜'+escapeHtml(l.action)+'｜'+escapeHtml(l.detail||'')+'</div>';}).join(''):'尚無紀錄'):'請先登入後台查看紀錄。')+'</div></section>';}

  function bindPage(){
    var el;
    if((el=document.getElementById('dmSelect'))) el.onchange=function(){selectedDm=this.value; render(); renderCanvas();};
    if((el=document.getElementById('contactSelect'))) el.onchange=function(){selectedContact=this.value; render(); renderCanvas();};
    if((el=document.getElementById('renderBtn'))) el.onclick=renderCanvas;
    if((el=document.getElementById('downloadBtn'))) el.onclick=downloadCanvas;

    if((el=document.getElementById('loginBtn'))) el.onclick=login;
    if((el=document.getElementById('logoutBtn'))) el.onclick=logout;
    if((el=document.getElementById('dmUpload'))) el.onchange=function(e){pendingFiles=Array.prototype.slice.call(e.target.files||[]); var p=document.getElementById('pendingInfo'); if(p)p.textContent='已選擇 '+pendingFiles.length+' 張 DM';};
    if((el=document.getElementById('uploadBtn'))) el.onclick=uploadDms;
    if((el=document.getElementById('addContactBtn'))) el.onclick=addContact;
    if((el=document.getElementById('saveSettingsBtn'))) el.onclick=saveSettings;

    document.querySelectorAll('[data-select-dm]').forEach(function(card){card.onclick=function(){selectedDm=card.dataset.selectDm;view='front';render();setTimeout(renderCanvas,50);};});
    document.querySelectorAll('[data-delete-dm]').forEach(function(btn){btn.onclick=deleteDm;});
    document.querySelectorAll('[data-delete-contact]').forEach(function(btn){btn.onclick=deleteContact;});

    document.querySelectorAll('[data-select-contact]').forEach(function(btn){
      btn.onclick=function(){selectedContact=btn.dataset.selectContact;view='front';render();setTimeout(renderCanvas,50);};
    });
    document.querySelectorAll('[data-photo-contact]').forEach(function(input){
      input.onchange=function(e){uploadContactAsset(e,input.dataset.photoContact,'photo');};
    });
    document.querySelectorAll('[data-qr-contact]').forEach(function(input){
      input.onchange=function(e){uploadContactAsset(e,input.dataset.qrContact,'qr');};
    });
    document.querySelectorAll('[data-delete-photo]').forEach(function(btn){
      btn.onclick=function(e){deleteContactAsset(e,btn.dataset.deletePhoto,'photo');};
    });
    document.querySelectorAll('[data-delete-qr]').forEach(function(btn){
      btn.onclick=function(e){deleteContactAsset(e,btn.dataset.deleteQr,'qr');};
    });

    document.querySelectorAll('[data-photo-adjust]').forEach(function(input){
      input.oninput=function(){ previewPhotoAdjust(input.dataset.photoAdjust,input.dataset.adjustField,input.value); };
      input.onchange=function(){ savePhotoAdjust(input.dataset.photoAdjust,input.dataset.adjustField,input.value); };
    });

    document.querySelectorAll('[data-photo-adjust-number]').forEach(function(input){
      input.oninput=function(){ previewPhotoAdjust(input.dataset.photoAdjustNumber,input.dataset.adjustField,input.value); };
      input.onchange=function(){ savePhotoAdjust(input.dataset.photoAdjustNumber,input.dataset.adjustField,input.value); };
    });

    document.querySelectorAll('[data-reset-photo-adjust]').forEach(function(btn){
      btn.onclick=function(){ resetPhotoAdjust(btn.dataset.resetPhotoAdjust); };
    });

    var ff=document.getElementById('fontFamily'); if(ff)ff.value=settings.fontFamily;
    var fw=document.getElementById('fontWeight'); if(fw)fw.value=settings.fontWeight;
    var bg=document.getElementById('bgEnabled'); if(bg)bg.value=String(!!settings.bgEnabled);
  }

  function options(items,selected,label,empty){return '<option value="">'+empty+'</option>'+items.map(function(x){return '<option value="'+x.id+'" '+(x.id===selected?'selected':'')+'>'+escapeHtml(x[label]||'未命名')+'</option>';}).join('');}
  function contactOptions(){return '<option value="">請選擇聯絡人</option>'+contacts.map(function(c){return '<option value="'+c.id+'" '+(c.id===selectedContact?'selected':'')+'>'+escapeHtml(c.name||'未命名')+'｜'+escapeHtml(c.title||'')+'｜'+escapeHtml(c.phone||'')+'</option>';}).join('');}
  function getSelectedContact(){
    return contacts.find(function(x){return x.id===selectedContact;}) || contacts[0] || null;
  }

  function dmCards(admin){if(!dms.length)return '<div class="empty">尚無 DM</div>';return dms.map(function(d){return '<div class="dm-card '+(d.id===selectedDm?'active':'')+'"><img src="'+escapeAttr(d.image_url)+'" alt=""><h3>'+escapeHtml(d.name)+'</h3><span class="pill">'+escapeHtml(d.category||'DM')+'</span><div class="actions"><button class="btn line" data-select-dm="'+d.id+'">選用</button>'+(admin&&user?'<button class="btn danger" data-delete-dm="'+d.id+'">下架</button>':'')+'</div></div>';}).join('');}
  function contactCards(){
    if(!contacts.length) return '<div class="empty">尚無通訊錄</div>';
    return contacts.map(function(c){
      var photoUrl=c.photo_url||c.avatar_url||'';
      var qrUrl=c.qr_url||c.qr_code_url||'';
      var hasPhoto=!!photoUrl;
      var hasQr=!!qrUrl;
      var ox=numOr(c.photo_offset_x,0);
      var oy=numOr(c.photo_offset_y,0);
      var sc=numOr(c.photo_scale,1);
      return '<div class="contact-card '+(c.id===selectedContact?'active':'')+'">' +
        '<div class="contact-info"><h3>'+escapeHtml(c.name||'未命名')+' <span>'+escapeHtml(c.title||'')+'</span></h3>' +
        '<p class="muted">'+escapeHtml(c.phone||'')+'<br>'+escapeHtml(c.company||'')+' '+escapeHtml(c.address||'')+'</p>' +
        '<div class="actions"><button class="btn line small" data-select-contact="'+c.id+'">前台預覽</button>'+(user?'<button class="btn danger small" data-delete-contact="'+c.id+'">刪除聯絡人</button>':'')+'</div></div>' +
        '<div class="asset-panel fixed-asset-panel">' +
          '<div class="asset-box"><div class="asset-title">形象照</div><div class="asset-preview">'+(hasPhoto?'<img src="'+escapeAttr(photoUrl)+'" alt="形象照">':'<span>尚無形象照</span>')+'</div>' +
            (user?'<label class="mini-upload">上傳形象照<input data-photo-contact="'+c.id+'" type="file" accept="image/*"></label>'+(hasPhoto?'<button class="asset-delete" data-delete-photo="'+c.id+'" type="button">刪除形象照</button>':'<button class="asset-delete disabled" type="button" disabled>無形象照可刪</button>'):'') +
            (user?'<div class="photo-adjuster"><div class="asset-title">照片微調</div>' +
              '<label>左右 <span class="adjust-control"><input data-photo-adjust="'+c.id+'" data-adjust-field="photo_offset_x" type="range" min="-90" max="90" step="1" value="'+escapeAttr(ox)+'"><input class="adjust-number" data-photo-adjust-number="'+c.id+'" data-adjust-field="photo_offset_x" type="number" min="-90" max="90" step="1" value="'+escapeAttr(ox)+'"></span></label>' +
              '<label>上下 <span class="adjust-control"><input data-photo-adjust="'+c.id+'" data-adjust-field="photo_offset_y" type="range" min="-120" max="120" step="1" value="'+escapeAttr(oy)+'"><input class="adjust-number" data-photo-adjust-number="'+c.id+'" data-adjust-field="photo_offset_y" type="number" min="-120" max="120" step="1" value="'+escapeAttr(oy)+'"></span></label>' +
              '<label>縮放 <span class="adjust-control"><input data-photo-adjust="'+c.id+'" data-adjust-field="photo_scale" type="range" min="0.6" max="2.2" step="0.01" value="'+escapeAttr(sc)+'"><input class="adjust-number" data-photo-adjust-number="'+c.id+'" data-adjust-field="photo_scale" type="number" min="0.6" max="2.2" step="0.01" value="'+escapeAttr(sc)+'"></span></label>' +
              '<button class="btn line small" data-reset-photo-adjust="'+c.id+'" type="button">重設照片位置</button></div>':'') +
          '</div>' +
          '<div class="asset-box"><div class="asset-title">QR Code</div><div class="asset-preview qr-preview">'+(hasQr?'<img src="'+escapeAttr(qrUrl)+'" alt="QR Code">':'<span>尚無 QR</span>')+'</div>' +
            (user?'<label class="mini-upload">上傳 QR Code<input data-qr-contact="'+c.id+'" type="file" accept="image/*"></label>'+(hasQr?'<button class="asset-delete" data-delete-qr="'+c.id+'" type="button">刪除 QR Code</button>':'<button class="asset-delete disabled" type="button" disabled>無 QR 可刪</button>'):'')+'</div>' +
        '</div></div>';
    }).join('');
  }

  async function login(){var email=document.getElementById('loginEmail').value.trim();var pw=document.getElementById('loginPassword').value;var res=await sb.auth.signInWithPassword({email:email,password:pw}); if(res.error)notice('登入失敗：'+res.error.message); else {user=res.data.user; notice('登入成功'); loadAll();}}
  async function logout(){await sb.auth.signOut(); user=null; notice('已登出'); loadAll();}
  async function addLog(action,detail){try{await sb.from('access_logs').insert({action:action,detail:detail||''});}catch(e){}}
  async function uploadDms(){if(!user)return notice('請先登入後台。'); if(!pendingFiles.length)return notice('請先選擇 DM 圖檔。'); for(var i=0;i<pendingFiles.length;i++){var file=pendingFiles[i]; if(/[\u4e00-\u9fa5\s'"\\/]/.test(file.name)){notice('檔名含中文、空格或特殊符號，請改成英文檔名再上傳：'+file.name); return;} var path='dm/'+safeName(file.name); var up=await sb.storage.from(bucket()).upload(path,file,{upsert:true,contentType:file.type||'image/jpeg'}); if(up.error){notice('上傳失敗：'+up.error.message); return;} var url=sb.storage.from(bucket()).getPublicUrl(path).data.publicUrl; var ins=await sb.from('dm_items').insert({name:file.name.replace(/\.[^.]+$/,''),category:'已排版DM',image_url:url,is_active:true}); if(ins.error){notice('DM 資料寫入失敗：'+ins.error.message); return;} } await addLog('上傳並發布DM',String(pendingFiles.length)+' 張'); pendingFiles=[]; notice('DM 已上傳並發布。'); loadAll();}
  function keepScrollPosition(fn){
    var x = window.scrollX || window.pageXOffset || 0;
    var y = window.scrollY || window.pageYOffset || 0;
    var result = fn();
    setTimeout(function(){ window.scrollTo(x,y); }, 0);
    setTimeout(function(){ window.scrollTo(x,y); }, 60);
    return result;
  }

  function updateLocalContactPhotoAdjust(contactId,field,value){
    var c=contacts.find(function(x){return x.id===contactId;});
    if(c)c[field]=Number(value);
    if(selectedContact===contactId && view==='front') setTimeout(renderCanvas,30);
  }

  function previewPhotoAdjust(contactId,field,value){
    updateLocalContactPhotoAdjust(contactId,field,value);

    document.querySelectorAll('[data-photo-adjust="'+contactId+'"][data-adjust-field="'+field+'"]').forEach(function(el){
      if(String(el.value)!==String(value)) el.value=value;
    });
    document.querySelectorAll('[data-photo-adjust-number="'+contactId+'"][data-adjust-field="'+field+'"]').forEach(function(el){
      if(String(el.value)!==String(value)) el.value=value;
    });
  }

  async function savePhotoAdjust(contactId,field,value){
    if(!user)return notice('請先登入後台。');
    var payload={};
    payload[field]=Number(value);
    updateLocalContactPhotoAdjust(contactId,field,value);
    var scrollX = window.scrollX || window.pageXOffset || 0;
    var scrollY = window.scrollY || window.pageYOffset || 0;
    var res=await sb.from('contacts').update(payload).eq('id',contactId);
    if(res.error) notice('照片微調儲存失敗：'+res.error.message);
    setTimeout(function(){ window.scrollTo(scrollX,scrollY); }, 0);
    setTimeout(function(){ window.scrollTo(scrollX,scrollY); }, 80);
  }

  async function resetPhotoAdjust(contactId){
    if(!user)return notice('請先登入後台。');
    var scrollX = window.scrollX || window.pageXOffset || 0;
    var scrollY = window.scrollY || window.pageYOffset || 0;
    var payload={photo_offset_x:0,photo_offset_y:0,photo_scale:1};
    var c=contacts.find(function(x){return x.id===contactId;});
    if(c){c.photo_offset_x=0;c.photo_offset_y=0;c.photo_scale=1;}
    var res=await sb.from('contacts').update(payload).eq('id',contactId);
    if(res.error) notice('照片位置重設失敗：'+res.error.message);
    else {
      notice('照片位置已重設。');
      await loadAll();
      setTimeout(function(){ window.scrollTo(scrollX,scrollY); }, 0);
      setTimeout(function(){ window.scrollTo(scrollX,scrollY); }, 100);
    }
  }

  async function uploadContactAsset(e,contactId,kind){
    if(!user) return notice('請先登入後台。');
    var file=(e.target.files||[])[0];
    if(!file) return;
    var folder=kind==='qr'?'qr':'photo';
    var path='contacts/'+folder+'/'+contactId+'/'+safeName(file.name,folder);
    var up=await sb.storage.from(bucket()).upload(path,file,{upsert:true,contentType:file.type||'image/jpeg'});
    if(up.error){notice('上傳失敗：'+up.error.message);return;}
    var url=sb.storage.from(bucket()).getPublicUrl(path).data.publicUrl;
    var payload={};
    if(kind==='qr'){payload.qr_url=url;payload.qr_code_url=url;}else{payload.photo_url=url;payload.avatar_url=url;}
    var res=await sb.from('contacts').update(payload).eq('id',contactId);
    if(res.error){
      var fallback={};
      if(kind==='qr')fallback.qr_url=url;else fallback.photo_url=url;
      res=await sb.from('contacts').update(fallback).eq('id',contactId);
    }
    if(res.error){notice('通訊錄圖片更新失敗：'+res.error.message);return;}
    await addLog(kind==='qr'?'更新業務QR':'更新業務形象照',contactId);
    notice(kind==='qr'?'QR Code 已更新。':'形象照已更新。');
    var scrollX = window.scrollX || window.pageXOffset || 0;
    var scrollY = window.scrollY || window.pageYOffset || 0;
    await loadAll();
    setTimeout(function(){ window.scrollTo(scrollX,scrollY); }, 0);
    setTimeout(function(){ window.scrollTo(scrollX,scrollY); }, 100);
  }

  async function deleteContactAsset(e,contactId,kind){
    if(e&&e.stopPropagation)e.stopPropagation();
    if(!user) return notice('請先登入後台。');
    var label=kind==='qr'?'QR Code':'形象照';
    if(!confirm('確定要刪除這位業務的'+label+'？'))return;
    var payload={};
    if(kind==='qr'){payload.qr_url='';payload.qr_code_url='';}else{payload.photo_url='';payload.avatar_url='';}
    var res=await sb.from('contacts').update(payload).eq('id',contactId);
    if(res.error){
      var fallback={};
      if(kind==='qr')fallback.qr_url='';else fallback.photo_url='';
      res=await sb.from('contacts').update(fallback).eq('id',contactId);
    }
    if(res.error){notice(label+'刪除失敗：'+res.error.message);return;}
    await addLog('刪除業務'+label,contactId);
    notice(label+'已刪除。');
    var scrollX = window.scrollX || window.pageXOffset || 0;
    var scrollY = window.scrollY || window.pageYOffset || 0;
    await loadAll();
    setTimeout(function(){ window.scrollTo(scrollX,scrollY); }, 0);
    setTimeout(function(){ window.scrollTo(scrollX,scrollY); }, 100);
  }

  async function deleteDm(e){e.stopPropagation(); if(!confirm('確定要下架這張 DM？'))return; await sb.from('dm_items').update({is_active:false}).eq('id',e.target.dataset.deleteDm); await addLog('下架DM',e.target.dataset.deleteDm); loadAll();}
  async function addContact(){if(!user)return notice('請先登入後台。'); var row={name:val('cName')||'未命名',title:val('cTitle'),phone:val('cPhone'),company:val('cCompany'),address:val('cAddress'),is_active:true}; var res=await sb.from('contacts').insert(row); if(res.error)return notice('新增失敗：'+res.error.message); await addLog('新增聯絡人',row.name); notice('已新增聯絡人。'); loadAll();}
  async function deleteContact(e){if(!confirm('確定刪除這位聯絡人？'))return; await sb.from('contacts').update({is_active:false}).eq('id',e.target.dataset.deleteContact); await addLog('刪除聯絡人',e.target.dataset.deleteContact); loadAll();}
  function val(id){var e=document.getElementById(id);return e?e.value.trim():'';}
  async function saveSettings(){settings=Object.assign({},settings,{nameSize:+val('nameSize')||34,titleSize:+val('titleSize')||24,phoneSize:+val('phoneSize')||26,companySize:+val('companySize')||18,nameGap:+val('nameGap')||8,subGap:+val('subGap')||8,paddingX:+val('paddingX')||18,paddingY:+val('paddingY')||8,fontFamily:val('fontFamily')||'Microsoft JhengHei',fontWeight:val('fontWeight')||'bold',color:val('fontColor')||'#000000',bgEnabled:val('bgEnabled')==='true'}); var res=await sb.from('app_settings').upsert({key:'contact_box',value:settings,updated_at:new Date().toISOString()}); if(res.error)return notice('設定儲存失敗：'+res.error.message); await addLog('更新欄位設定',''); notice('設定已儲存。'); renderCanvas();}

  function readFile(file){return new Promise(function(resolve,reject){if(!file)return resolve('');var r=new FileReader();r.onload=function(){resolve(r.result);};r.onerror=reject;r.readAsDataURL(file);});}
  function loadImage(src){return new Promise(function(resolve){if(!src)return resolve(null);var img=new Image();img.crossOrigin='anonymous';img.onload=function(){resolve(img);};img.onerror=function(){resolve(null);};img.src=src;});}
  async function renderCanvas(){var canvas=document.getElementById('dmCanvas'); if(!canvas)return; var ctx=canvas.getContext('2d'); canvas.width=W; canvas.height=H; ctx.fillStyle='#f4f1eb';ctx.fillRect(0,0,W,H); var dm=dms.find(function(x){return x.id===selectedDm;}); if(dm){var img=await loadImage(dm.image_url); if(img)ctx.drawImage(img,0,0,W,H);} else {ctx.fillStyle='#666';ctx.font='36px Arial';ctx.fillText('請先選擇 DM',570,930);} await drawContact(ctx);}
  async function drawContact(ctx){
    var c=getSelectedContact()||{};
    var family=settings.fontFamily||'Microsoft JhengHei';
    var weight='900';
    ctx.fillStyle=settings.color||'#000';
    ctx.textBaseline='alphabetic';

    // 文字位置維持不動。
    var nameX=930;
    var phoneX=930;
    var companyX=930;

    var nameY=126;
    var phoneY=182;
    var companyY=238;

    var nameText=c.name||'';
    var titleText=c.title||'';

    ctx.font=weight+' 34px "'+family+'", Arial';
    fitText(ctx,nameText,nameX,nameY,130,38);

    var titleX=nameX+Math.min(ctx.measureText(nameText).width,130)+26;
    ctx.font=weight+' 30px "'+family+'", Arial';
    fitText(ctx,titleText,titleX,nameY,120,34);

    ctx.font=weight+' 34px "'+family+'", Arial';
    fitText(ctx,c.phone||'',phoneX,phoneY,250,38);

    ctx.font=weight+' 34px "'+family+'", Arial';
    fitText(ctx,c.company||'吉富工商',companyX,companyY,250,38);

    var photo=await loadImage(c.photo_url||c.avatar_url||'');
    var qr=await loadImage(c.qr_url||c.qr_code_url||'');

    // QR 位置維持不動。
    var qrX=1168, qrY=166, qrSize=82;

    // 形象照基準框：固定在灰色框內。
    var photoX=1350, photoY=58, photoW=78, photoH=210;

    // 每位業務可在後台微調照片裁切位置。
    var pOffsetX=numOr(c.photo_offset_x,0);
    var pOffsetY=numOr(c.photo_offset_y,0);
    var pScale=Math.max(0.6,Math.min(2.2,numOr(c.photo_scale,1)));

    if(qr){
      drawQrImage(ctx,qr,qrX,qrY,qrSize);
    }

    if(photo){
      ctx.save();
      roundRect(ctx,photoX,photoY,photoW,photoH,4);
      ctx.clip();
      drawPortraitCropAdjusted(ctx,photo,photoX,photoY,photoW,photoH,pOffsetX,pOffsetY,pScale);
      ctx.restore();
    }
  }

function fitText(ctx,text,x,y,maxW,maxH){text=String(text||''); if(!text)return; var original=ctx.font; var size=parseInt((ctx.font.match(/(\d+)px/)||[])[1]||20,10); while(ctx.measureText(text).width>maxW && size>10){size--;ctx.font=ctx.font.replace(/\d+px/,size+'px');} ctx.textAlign='left';ctx.fillText(text,x,y);ctx.font=original;}
  function drawCover(ctx,img,x,y,w,h){var scale=Math.max(w/img.width,h/img.height),sw=w/scale,sh=h/scale;ctx.drawImage(img,(img.width-sw)/2,(img.height-sh)/2,sw,sh,x,y,w,h);}
  function drawContain(ctx,img,x,y,w,h){var scale=Math.min(w/img.width,h/img.height),dw=img.width*scale,dh=img.height*scale;ctx.drawImage(img,x+(w-dw)/2,y+(h-dh)/2,dw,dh);}
      function drawQrImage(ctx,img,x,y,size){
    if(!img)return;
    var iw=img.naturalWidth||img.width;
    var ih=img.naturalHeight||img.height;
    if(!iw||!ih)return;

    ctx.save();
    ctx.fillStyle='#fff';
    ctx.fillRect(x,y,size,size);

    var scale=Math.min(size/iw,size/ih);
    var dw=iw*scale;
    var dh=ih*scale;
    var dx=x+(size-dw)/2;
    var dy=y+(size-dh)/2;
    ctx.drawImage(img,dx,dy,dw,dh);
    ctx.restore();
  }

function drawPortraitCropAdjusted(ctx,img,x,y,w,h,offsetX,offsetY,scaleAdjust){
    if(!img)return;
    var iw=img.width, ih=img.height;

    // contain-like base so entire person is less likely to burst out visually,
    // then user scale controls zoom.
    var baseScale=Math.max(w/iw,h/ih);
    var scale=baseScale*(scaleAdjust||1);

    var dw=iw*scale;
    var dh=ih*scale;

    var dx=x+(w-dw)/2+Number(offsetX||0);
    var dy=y+(h-dh)/2+Number(offsetY||0);

    ctx.drawImage(img,dx,dy,dw,dh);
  }

function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
  async function downloadCanvas(){await renderCanvas(); var dm=dms.find(function(x){return x.id===selectedDm;}); var c=contacts.find(function(x){return x.id===selectedContact;}); var a=document.createElement('a'); a.href=document.getElementById('dmCanvas').toDataURL('image/png'); a.download=((dm&&dm.name||'DM')+'_'+(c&&c.name||'業務')+'.png').replace(/[\\/]/g,'-'); a.click(); await addLog('下載DM',a.download);}
  init();
})();  function drawPortraitCrop(ctx,img,x,y,w,h){
    if(!img)return;
    var iw=img.width,ih=img.height;
    var scale=Math.max(w/iw,h/ih);
    var sw=w/scale,sh=h/scale;
    var sx=(iw-sw)/2;
    var sy=Math.max(0,Math.min(ih-sh,ih*0.06));
    ctx.drawImage(img,sx,sy,sw,sh,x,y,w,h);
  }


