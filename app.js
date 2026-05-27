(function(){
  'use strict';
  var app=document.getElementById('app');
  var W=1456,H=2048;
  var rawCfg=(window.JIFU_SUPABASE||window.JIFU_SUPABASE_CONFIG||{});
  var cfg={
    url: rawCfg.url || rawCfg.SUPABASE_URL || '',
    anonKey: rawCfg.anonKey || rawCfg.SUPABASE_ANON_KEY || '',
    storageBucket: rawCfg.storageBucket || rawCfg.STORAGE_BUCKET || rawCfg.bucket || 'dm-assets'
  };
  var sb=null,user=null,view='front';
  var dms=[],contacts=[],logs=[];
  var selectedDm='', selectedContact='';
  var settings=defaultSettings();
  var pendingFiles=[];

  function defaultSettings(){return {x:950,y:58,w:452,h:142,labelSize:22,nameSize:34,titleSize:22,phoneSize:26,companySize:18,labelGap:6,nameGap:8,subGap:8,paddingX:18,paddingY:8,fontFamily:'Microsoft JhengHei',fontWeight:'bold',color:'#000000',bgEnabled:false,photoX:1268,photoY:68,photoSize:118,qrX:1268,qrY:68,qrSize:118};}
  function escapeHtml(v){return String(v||'').replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];});}
  function escapeAttr(v){return escapeHtml(v).replace(/`/g,'&#96;');}
  function notice(msg){var n=document.getElementById('notice'); if(n)n.textContent=msg;}
  function bucket(){return cfg.storageBucket||'dm-assets';}
  function safeName(name,prefix){var ext=(name.match(/\.[a-zA-Z0-9]+$/)||['.jpg'])[0].toLowerCase();return Date.now()+'_'+Math.random().toString(36).slice(2)+'_'+(prefix||'file')+ext;}
  function val(id){var e=document.getElementById(id);return e?e.value.trim():'';}

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
    app.innerHTML='<header class="topbar"><div class="brand"><small>JIFU CLOUD DM SYSTEM</small><h1>吉富 DM 套版系統</h1><p>前台選業務，後台管理 DM、通訊錄、形象照與 QR Code</p></div><nav class="tabs">'+tab('front','前台下載')+tab('admin','後台管理')+tab('contacts','通訊錄')+tab('settings','欄位設定')+tab('logs','紀錄')+'</nav></header><div id="notice" class="notice">正在連線雲端資料庫...</div><main id="main" class="wrap"></main>';
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
    var c=contacts.find(function(x){return x.id===selectedContact;})||{};
    return '<div class="grid"><aside><section class="card"><h2>前台下載</h2><div class="field"><label>選擇 DM</label><select id="dmSelect">'+options(dms,selectedDm,'name','請選擇 DM')+'</select></div><div class="field"><label>選擇業務聯絡資訊</label><select id="contactSelect">'+contactOptions()+'</select><small>形象照與 QR Code 由後台依業務設定，自動同步到前台。</small></div>'+contactAssetPreview(c)+'<button id="renderBtn" class="btn primary full">更新預覽</button><button id="downloadBtn" class="btn gold full">下載 DM 圖片</button></section><section class="card"><h2>使用說明</h2><p class="muted">業務只要選擇 DM 與自己的姓名，即可自動帶出聯絡資訊、形象照、QR Code 並下載完整 DM。聯絡資訊只會套在右上角白色框，不會跑到物件區。</p></section></aside><section><section class="card"><h2>即時預覽</h2><div class="canvas-wrap"><canvas id="dmCanvas" class="dm-canvas"></canvas></div></section><section class="card"><h2>可選 DM</h2><div class="dm-grid">'+dmCards(false)+'</div></section></section></div>';
  }
  function contactAssetPreview(c){
    return '<div class="asset-preview-box"><h3>業務圖像資料</h3><div class="asset-preview-grid"><div><span>形象照</span>'+(c.photo_url?'<img src="'+escapeAttr(c.photo_url)+'" alt="形象照">':'<div class="asset-empty">尚未設定</div>')+'</div><div><span>QR Code</span>'+(c.qr_url?'<img src="'+escapeAttr(c.qr_url)+'" alt="QR Code">':'<div class="asset-empty">尚未設定</div>')+'</div></div><small>如需更新，請到後台「通訊錄」針對業務個人上傳。</small></div>';
  }
  function adminHtml(){
    return '<div class="grid admin"><aside><section class="card"><h2>後台登入</h2><p class="muted">'+(user?'已登入：'+escapeHtml(user.email):'尚未登入。前台可用，後台管理需登入。')+'</p><div class="field"><label>管理員 Email</label><input id="loginEmail" value="'+escapeAttr(user&&user.email||'')+'"></div><div class="field"><label>密碼</label><input id="loginPassword" type="password"></div><button id="loginBtn" class="btn primary full">登入後台</button><button id="logoutBtn" class="btn line full">登出</button></section><section class="card '+(!user?'hidden':'')+'"><h2>上傳已排版 DM</h2><label class="upload">一次上傳多張 DM<input id="dmUpload" type="file" accept="image/*" multiple></label><div id="pendingInfo" class="muted">尚未選擇檔案</div><button id="uploadBtn" class="btn gold full">上傳並發布</button><div class="table-note">請使用英文檔名，例如 A26-5_DM01.jpg。不要用中文、空格、單引號。</div></section></aside><section><section class="card"><h2>DM 管理</h2><div class="dm-grid">'+dmCards(true)+'</div></section></section></div>';
  }
  function contactsHtml(){
    return '<section class="card"><h2>通訊錄管理</h2><p class="muted">前台會讀取這裡的業務資料。形象照與 QR Code 請在這裡針對每位業務上傳，前台選到該姓名時會自動套入。</p><div class="table-note">第一次使用新功能請先在 Supabase SQL Editor 執行壓縮包內的 <b>supabase_contact_assets_update.sql</b>，新增 photo_url 與 qr_url 欄位。</div><div class="'+(!user?'hidden':'')+'"><div class="row4"><div class="field"><label>姓名</label><input id="cName"></div><div class="field"><label>職稱</label><input id="cTitle"></div><div class="field"><label>電話</label><input id="cPhone"></div><div class="field"><label>公司 / 團隊</label><input id="cCompany"></div></div><div class="field"><label>地址</label><input id="cAddress"></div><button id="addContactBtn" class="btn primary">新增聯絡人</button></div><div class="contact-grid" style="margin-top:18px">'+contactCards()+'</div></section>';
  }
  function settingsHtml(){
    return '<section class="card"><h2>右上角聯絡資訊欄位設定</h2><p class="muted">所有設定都會存到雲端。欄位只控制右上角白色聯絡資訊框，不會影響物件格。</p><div class="row4"><div class="field"><label>「聯絡資訊」標籤字級</label><input id="labelSize" type="number" value="'+(settings.labelSize||22)+'"></div><div class="field"><label>姓名字級</label><input id="nameSize" type="number" value="'+settings.nameSize+'"></div><div class="field"><label>職稱字級</label><input id="titleSize" type="number" value="'+settings.titleSize+'"></div><div class="field"><label>電話字級</label><input id="phoneSize" type="number" value="'+settings.phoneSize+'"></div></div><div class="row4"><div class="field"><label>公司/團隊字級</label><input id="companySize" type="number" value="'+settings.companySize+'"></div><div class="field"><label>姓名區行距</label><input id="nameGap" type="number" value="'+settings.nameGap+'"></div><div class="field"><label>下方資訊行距</label><input id="subGap" type="number" value="'+settings.subGap+'"></div><div class="field"><label>標籤到姓名距離</label><input id="labelGap" type="number" value="'+(settings.labelGap||6)+'"></div></div><div class="row4"><div class="field"><label>左右內距</label><input id="paddingX" type="number" value="'+settings.paddingX+'"></div><div class="field"><label>上下內距</label><input id="paddingY" type="number" value="'+settings.paddingY+'"></div><div class="field"><label>文字顏色</label><input id="fontColor" type="color" value="'+settings.color+'"></div><div class="field"><label>聯絡區背景</label><select id="bgEnabled"><option value="false">不要底色，使用公版白色框</option><option value="true">加半透明底色</option></select></div></div><div class="row"><div class="field"><label>字型</label><select id="fontFamily"><option>Microsoft JhengHei</option><option>PMingLiU</option><option>MingLiU</option><option>DFKai-SB</option><option>Arial</option><option>Tahoma</option></select></div><div class="field"><label>文字粗細</label><select id="fontWeight"><option value="normal">一般</option><option value="600">SemiBold</option><option value="bold">粗體</option><option value="900">超粗</option></select></div></div><button id="saveSettingsBtn" class="btn primary '+(!user?'hidden':'')+'">儲存設定到雲端</button><p class="admin-only-note '+(user?'hidden':'')+'">請先登入後台，才能儲存欄位設定。</p></section>';
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
    if((el=document.getElementById('dmUpload'))) el.onchange=function(e){pendingFiles=Array.prototype.slice.call(e.target.files||[]); document.getElementById('pendingInfo').textContent='已選擇 '+pendingFiles.length+' 張 DM';};
    if((el=document.getElementById('uploadBtn'))) el.onclick=uploadDms;
    if((el=document.getElementById('addContactBtn'))) el.onclick=addContact;
    if((el=document.getElementById('saveSettingsBtn'))) el.onclick=saveSettings;
    document.querySelectorAll('[data-select-dm]').forEach(function(card){card.onclick=function(){selectedDm=card.dataset.selectDm;view='front';render();setTimeout(renderCanvas,50);};});
    document.querySelectorAll('[data-delete-dm]').forEach(function(btn){btn.onclick=deleteDm;});
    document.querySelectorAll('[data-delete-contact]').forEach(function(btn){btn.onclick=deleteContact;});
    document.querySelectorAll('[data-upload-photo]').forEach(function(input){input.onchange=function(e){uploadContactAsset(input.dataset.uploadPhoto,'photo',e.target.files[0]);};});
    document.querySelectorAll('[data-upload-qr]').forEach(function(input){input.onchange=function(e){uploadContactAsset(input.dataset.uploadQr,'qr',e.target.files[0]);};});
    document.querySelectorAll('[data-clear-photo]').forEach(function(btn){btn.onclick=function(){clearContactAsset(btn.dataset.clearPhoto,'photo');};});
    document.querySelectorAll('[data-clear-qr]').forEach(function(btn){btn.onclick=function(){clearContactAsset(btn.dataset.clearQr,'qr');};});
    var ff=document.getElementById('fontFamily'); if(ff)ff.value=settings.fontFamily;
    var fw=document.getElementById('fontWeight'); if(fw)fw.value=settings.fontWeight;
    var bg=document.getElementById('bgEnabled'); if(bg)bg.value=String(!!settings.bgEnabled);
  }

  function options(items,selected,label,empty){return '<option value="">'+empty+'</option>'+items.map(function(x){return '<option value="'+x.id+'" '+(x.id===selected?'selected':'')+'>'+escapeHtml(x[label]||'未命名')+'</option>';}).join('');}
  function contactOptions(){return '<option value="">請選擇聯絡人</option>'+contacts.map(function(c){return '<option value="'+c.id+'" '+(c.id===selectedContact?'selected':'')+'>'+escapeHtml(c.name||'未命名')+'｜'+escapeHtml(c.title||'')+'｜'+escapeHtml(c.phone||'')+'</option>';}).join('');}
  function dmCards(admin){if(!dms.length)return '<div class="empty">尚無 DM</div>';return dms.map(function(d){return '<div class="dm-card '+(d.id===selectedDm?'active':'')+'"><img src="'+escapeAttr(d.image_url)+'" alt=""><h3>'+escapeHtml(d.name)+'</h3><span class="pill">'+escapeHtml(d.category||'DM')+'</span><div class="actions"><button class="btn line" data-select-dm="'+d.id+'">選用</button>'+(admin&&user?'<button class="btn danger" data-delete-dm="'+d.id+'">下架</button>':'')+'</div></div>';}).join('');}
  function contactCards(){if(!contacts.length)return '<div class="empty">尚無通訊錄</div>';return contacts.map(function(c){return '<div class="contact-card '+(c.id===selectedContact?'active':'')+'"><h3>'+escapeHtml(c.name||'未命名')+' '+escapeHtml(c.title||'')+'</h3><p class="muted">'+escapeHtml(c.phone||'')+'<br>'+escapeHtml(c.company||'')+' '+escapeHtml(c.address||'')+'</p><div class="asset-preview-grid mini"><div><span>形象照</span>'+(c.photo_url?'<img src="'+escapeAttr(c.photo_url)+'">':'<div class="asset-empty">尚無</div>')+'</div><div><span>QR</span>'+(c.qr_url?'<img src="'+escapeAttr(c.qr_url)+'">':'<div class="asset-empty">尚無</div>')+'</div></div>'+(user?'<div class="contact-actions"><label class="btn line small">上傳形象照<input class="hidden-input" data-upload-photo="'+c.id+'" type="file" accept="image/*"></label><label class="btn line small">上傳 QR Code<input class="hidden-input" data-upload-qr="'+c.id+'" type="file" accept="image/*"></label><button class="btn danger small" data-clear-photo="'+c.id+'">清除形象照</button><button class="btn danger small" data-clear-qr="'+c.id+'">清除 QR</button><button class="btn danger small" data-delete-contact="'+c.id+'">刪除聯絡人</button></div>':'')+'</div>';}).join('');}

  async function login(){var email=document.getElementById('loginEmail').value.trim();var pw=document.getElementById('loginPassword').value;var res=await sb.auth.signInWithPassword({email:email,password:pw}); if(res.error)notice('登入失敗：'+res.error.message); else {user=res.data.user; notice('登入成功'); loadAll();}}
  async function logout(){await sb.auth.signOut(); user=null; notice('已登出'); loadAll();}
  async function addLog(action,detail){try{await sb.from('access_logs').insert({action:action,detail:detail||''});}catch(e){}}
  async function uploadDms(){if(!user)return notice('請先登入後台。'); if(!pendingFiles.length)return notice('請先選擇 DM 圖檔。'); for(var i=0;i<pendingFiles.length;i++){var file=pendingFiles[i]; if(/[\u4e00-\u9fa5\s'"\\/]/.test(file.name)){notice('檔名含中文、空格或特殊符號，請改成英文檔名再上傳：'+file.name); return;} var path='dm/'+safeName(file.name,'dm'); var up=await sb.storage.from(bucket()).upload(path,file,{upsert:true,contentType:file.type||'image/jpeg'}); if(up.error){notice('上傳失敗：'+up.error.message); return;} var url=sb.storage.from(bucket()).getPublicUrl(path).data.publicUrl; var ins=await sb.from('dm_items').insert({name:file.name.replace(/\.[^.]+$/,''),category:'已排版DM',image_url:url,is_active:true}); if(ins.error){notice('DM 資料寫入失敗：'+ins.error.message); return;} } await addLog('上傳並發布DM',String(pendingFiles.length)+' 張'); pendingFiles=[]; notice('DM 已上傳並發布。'); loadAll();}
  async function deleteDm(e){e.stopPropagation(); if(!confirm('確定要下架這張 DM？'))return; await sb.from('dm_items').update({is_active:false}).eq('id',e.target.dataset.deleteDm); await addLog('下架DM',e.target.dataset.deleteDm); loadAll();}
  async function addContact(){if(!user)return notice('請先登入後台。'); var row={name:val('cName')||'未命名',title:val('cTitle'),phone:val('cPhone'),company:val('cCompany'),address:val('cAddress'),is_active:true}; var res=await sb.from('contacts').insert(row); if(res.error)return notice('新增失敗：'+res.error.message); await addLog('新增聯絡人',row.name); notice('已新增聯絡人。'); loadAll();}
  async function deleteContact(e){if(!confirm('確定刪除這位聯絡人？'))return; await sb.from('contacts').update({is_active:false}).eq('id',e.target.dataset.deleteContact); await addLog('刪除聯絡人',e.target.dataset.deleteContact); loadAll();}
  async function clearContactAsset(contactId,type){if(!user)return notice('請先登入後台。'); var field=type==='photo'?'photo_url':'qr_url'; var obj={}; obj[field]=''; var res=await sb.from('contacts').update(obj).eq('id',contactId); if(res.error)return notice('清除失敗：'+res.error.message); await addLog('清除'+(type==='photo'?'形象照':'QR Code'),contactId); notice('已清除。'); loadAll();}
  async function uploadContactAsset(contactId,type,file){
    if(!user)return notice('請先登入後台。');
    if(!file)return;
    if(/[\u4e00-\u9fa5\s'"\\/]/.test(file.name)){notice('檔名含中文、空格或特殊符號，請改成英文檔名再上傳：'+file.name); return;}
    notice(type==='photo'?'正在裁切並上傳形象照...':'正在判讀並裁切 QR Code...');
    try{
      var blob= type==='photo' ? await cropPhotoBlob(file) : await cropQrBlob(file);
      var path='contacts/'+contactId+'/'+safeName(file.name,type);
      var up=await sb.storage.from(bucket()).upload(path,blob,{upsert:true,contentType:blob.type||'image/jpeg'});
      if(up.error){notice('上傳失敗：'+up.error.message); return;}
      var url=sb.storage.from(bucket()).getPublicUrl(path).data.publicUrl;
      var field=type==='photo'?'photo_url':'qr_url'; var obj={}; obj[field]=url;
      var res=await sb.from('contacts').update(obj).eq('id',contactId);
      if(res.error){notice('通訊錄圖片欄位寫入失敗：'+res.error.message+'。請先執行 supabase_contact_assets_update.sql。'); return;}
      await addLog(type==='photo'?'更新業務形象照':'更新業務QR Code',contactId);
      notice(type==='photo'?'形象照已更新並同步前台。':'QR Code 已更新並同步前台。');
      loadAll();
    }catch(err){console.error(err); notice('圖片處理失敗：'+(err.message||err));}
  }
  async function saveSettings(){settings=Object.assign({},settings,{labelSize:+val('labelSize')||22,nameSize:+val('nameSize')||34,titleSize:+val('titleSize')||22,phoneSize:+val('phoneSize')||26,companySize:+val('companySize')||18,labelGap:+val('labelGap')||6,nameGap:+val('nameGap')||8,subGap:+val('subGap')||8,paddingX:+val('paddingX')||18,paddingY:+val('paddingY')||8,fontFamily:val('fontFamily')||'Microsoft JhengHei',fontWeight:val('fontWeight')||'bold',color:val('fontColor')||'#000000',bgEnabled:val('bgEnabled')==='true'}); var res=await sb.from('app_settings').upsert({key:'contact_box',value:settings,updated_at:new Date().toISOString()}); if(res.error)return notice('設定儲存失敗：'+res.error.message); await addLog('更新欄位設定',''); notice('設定已儲存。'); renderCanvas();}

  function readFile(file){return new Promise(function(resolve,reject){if(!file)return resolve('');var r=new FileReader();r.onload=function(){resolve(r.result);};r.onerror=reject;r.readAsDataURL(file);});}
  function loadImage(src){return new Promise(function(resolve){if(!src)return resolve(null);var img=new Image();img.crossOrigin='anonymous';img.onload=function(){resolve(img);};img.onerror=function(){resolve(null);};img.src=src;});}
  function fileToImage(file){return new Promise(function(resolve,reject){var url=URL.createObjectURL(file);var img=new Image();img.onload=function(){URL.revokeObjectURL(url);resolve(img);};img.onerror=function(){URL.revokeObjectURL(url);reject(new Error('圖片讀取失敗'));};img.src=url;});}
  function canvasToBlob(canvas,type,quality){return new Promise(function(resolve){canvas.toBlob(function(blob){resolve(blob);},type||'image/jpeg',quality||0.92);});}
  async function cropPhotoBlob(file){
    var img=await fileToImage(file); var iw=img.width, ih=img.height;
    var sourceW,sourceH,sx,sy;
    if(ih>iw*1.15){
      sourceW=iw*0.86; sourceH=sourceW; sx=(iw-sourceW)/2; sy=Math.max(0,ih*0.12);
      if(sy+sourceH>ih) sy=ih-sourceH;
    }else{
      sourceW=Math.min(iw,ih)*0.82; sourceH=sourceW; sx=(iw-sourceW)/2; sy=Math.max(0,(ih-sourceH)*0.18);
    }
    var out=document.createElement('canvas'); out.width=800; out.height=800; var ctx=out.getContext('2d'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,out.width,out.height); ctx.drawImage(img,sx,sy,sourceW,sourceH,0,0,out.width,out.height); return canvasToBlob(out,'image/jpeg',0.92);
  }
  async function cropQrBlob(file){
    var img=await fileToImage(file); var max=1200; var scale=Math.min(1,max/Math.max(img.width,img.height)); var cw=Math.round(img.width*scale), ch=Math.round(img.height*scale); var c=document.createElement('canvas'); c.width=cw; c.height=ch; var ctx=c.getContext('2d'); ctx.drawImage(img,0,0,cw,ch); var data=ctx.getImageData(0,0,cw,ch).data; var minX=cw,minY=ch,maxX=0,maxY=0,count=0;
    for(var y=0;y<ch;y+=2){for(var x=0;x<cw;x+=2){var i=(y*cw+x)*4; var r=data[i],g=data[i+1],b=data[i+2]; var dark=(r+g+b)<300; if(dark){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);count++;}}}
    var sx,sy,sw,sh;
    if(count>80 && maxX>minX && maxY>minY){var pad=Math.max(maxX-minX,maxY-minY)*0.12; minX=Math.max(0,minX-pad);minY=Math.max(0,minY-pad);maxX=Math.min(cw,maxX+pad);maxY=Math.min(ch,maxY+pad);sw=maxX-minX;sh=maxY-minY;var side=Math.max(sw,sh);sx=minX-(side-sw)/2;sy=minY-(side-sh)/2;sx=Math.max(0,Math.min(cw-side,sx));sy=Math.max(0,Math.min(ch-side,sy));sw=sh=side;} else {var side2=Math.min(cw,ch); sx=(cw-side2)/2; sy=(ch-side2)/2; sw=sh=side2;}
    var out=document.createElement('canvas'); out.width=800; out.height=800; var o=out.getContext('2d'); o.fillStyle='#fff'; o.fillRect(0,0,800,800); o.drawImage(c,sx,sy,sw,sh,0,0,800,800); return canvasToBlob(out,'image/png',0.95);
  }

  async function renderCanvas(){var canvas=document.getElementById('dmCanvas'); if(!canvas)return; var ctx=canvas.getContext('2d'); canvas.width=W; canvas.height=H; ctx.fillStyle='#f4f1eb';ctx.fillRect(0,0,W,H); var dm=dms.find(function(x){return x.id===selectedDm;}); if(dm){var img=await loadImage(dm.image_url); if(img)ctx.drawImage(img,0,0,W,H);} else {ctx.fillStyle='#666';ctx.font='36px Arial';ctx.fillText('請先選擇 DM',570,930);} await drawContact(ctx);}
  async function drawContact(ctx){var c=contacts.find(function(x){return x.id===selectedContact;})||{}; var b=Object.assign(defaultSettings(),settings); if(b.bgEnabled){ctx.fillStyle='rgba(221,230,239,.88)';roundRect(ctx,b.x,b.y,b.w,b.h,6);ctx.fill();} var px=b.paddingX||18, py=b.paddingY||8; var labelSize=b.labelSize||22,nameSize=b.nameSize||34,titleSize=b.titleSize||22,phoneSize=b.phoneSize||26,companySize=b.companySize||18; var family=b.fontFamily||'Microsoft JhengHei', weight=b.fontWeight||'bold'; ctx.fillStyle=b.color||'#000'; var textX=b.x+px; var assetSize=b.photoSize||118; var textMaxW=b.w-assetSize-px-24; var yLabel=b.y+py+labelSize; ctx.font=weight+' '+labelSize+'px "'+family+'", Arial'; fitText(ctx,'聯絡資訊',textX,yLabel,textMaxW,labelSize+4); var yName=yLabel+(b.labelGap||6)+nameSize; var nameW=Math.min(textMaxW*0.56,190); var titleX=textX+nameW+14; var titleW=Math.max(20,textMaxW-nameW-14); ctx.font=weight+' '+nameSize+'px "'+family+'", Arial'; fitText(ctx,c.name||'',textX,yName,nameW,nameSize+4); ctx.font=weight+' '+titleSize+'px "'+family+'", Arial'; fitText(ctx,c.title||'',titleX,yName,titleW,titleSize+4); var yPhone=yName+(b.nameGap||8)+phoneSize; ctx.font=weight+' '+phoneSize+'px "'+family+'", Arial'; fitText(ctx,c.phone||'',textX,yPhone,textMaxW,phoneSize+4); var yCompany=yPhone+(b.subGap||8)+companySize; ctx.font=weight+' '+companySize+'px "'+family+'", Arial'; fitText(ctx,(c.company||'吉富工商')+(c.address?' '+c.address:''),textX,yCompany,textMaxW,companySize+4); await drawContactAssets(ctx,c,b);}
  async function drawContactAssets(ctx,c,b){var x=b.photoX||1268,y=b.photoY||68,size=b.photoSize||118; var photo=await loadImage(c.photo_url); var qr=await loadImage(c.qr_url); if(photo){ctx.save();roundRect(ctx,x,y,size,size,0);ctx.clip();drawCover(ctx,photo,x,y,size,size);ctx.restore();} if(qr){if(photo){var qs=Math.round(size*0.45); var qx=x+size-qs-3; var qy=y+size-qs-3; ctx.fillStyle='#fff';ctx.fillRect(qx-4,qy-4,qs+8,qs+8);drawContain(ctx,qr,qx,qy,qs,qs);}else{ctx.fillStyle='#fff';ctx.fillRect(x-4,y-4,size+8,size+8);drawContain(ctx,qr,x,y,size,size);}}}
  function fitText(ctx,text,x,y,maxW,maxH){text=String(text||''); if(!text)return; var original=ctx.font; var size=parseInt((ctx.font.match(/(\d+)px/)||[])[1]||20,10); while(ctx.measureText(text).width>maxW && size>10){size--;ctx.font=ctx.font.replace(/\d+px/,size+'px');} ctx.textAlign='left';ctx.fillText(text,x,y);ctx.font=original;}
  function drawCover(ctx,img,x,y,w,h){var scale=Math.max(w/img.width,h/img.height),sw=w/scale,sh=h/scale;ctx.drawImage(img,(img.width-sw)/2,(img.height-sh)/2,sw,sh,x,y,w,h);}
  function drawContain(ctx,img,x,y,w,h){var scale=Math.min(w/img.width,h/img.height),dw=img.width*scale,dh=img.height*scale;ctx.drawImage(img,x+(w-dw)/2,y+(h-dh)/2,dw,dh);}
  function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
  async function downloadCanvas(){await renderCanvas(); var dm=dms.find(function(x){return x.id===selectedDm;}); var c=contacts.find(function(x){return x.id===selectedContact;}); var a=document.createElement('a'); a.href=document.getElementById('dmCanvas').toDataURL('image/png'); a.download=((dm&&dm.name||'DM')+'_'+(c&&c.name||'業務')+'.png').replace(/[\\/]/g,'-'); a.click(); await addLog('下載DM',a.download);}
  init();
})();
