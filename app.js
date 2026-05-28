/* JIFU_FORCE_BOOT_REPAIR_20260528 */
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
  function escapeHtml(v){return String(v||'').replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];});}
  function escapeAttr(v){return escapeHtml(v).replace(/`/g,'&#96;');}
  function notice(msg){var n=document.getElementById('notice'); if(n)n.textContent=msg;}
  function bucket(){return cfg.storageBucket||cfg.bucket||'dm-assets';}
  function safeName(name){var ext=(name.match(/\.[a-zA-Z0-9]+$/)||['.jpg'])[0].toLowerCase();return Date.now()+'_'+Math.random().toString(36).slice(2)+'_dm'+ext;}

  window.addEventListener('error',function(e){console.error(e.error||e.message);});
  window.addEventListener('unhandledrejection',function(e){console.error(e.reason); notice('發生錯誤：'+((e.reason&&e.reason.message)||e.reason||'未知錯誤'));});

  async function init(){
    try{
      if(!app){
        app=document.getElementById('app');
      }

      // 先保底建立畫面，不讓使用者永遠卡在載入中。
      if(app){
        app.innerHTML='<div class="notice">正在連線雲端資料庫...</div>';
      }

      await initSupabase();
      await loadAll();

      if(!selectedDm && dms[0]) selectedDm=dms[0].id;
      if(!selectedContact && contacts[0]) selectedContact=contacts[0].id;

      render();
      setTimeout(renderCanvas,80);
    }catch(err){
      console.error(err);

      // 即使資料庫或某段功能錯誤，也強制打開主畫面。
      try{
        if(!selectedDm && dms && dms[0]) selectedDm=dms[0].id;
        if(!selectedContact && contacts && contacts[0]) selectedContact=contacts[0].id;
        render();
        setTimeout(renderCanvas,120);
      }catch(e){
        console.error(e);
        if(app){
          app.innerHTML='<div class="card"><h2>系統載入錯誤</h2><p class="muted">請截圖這段錯誤給我：</p><pre style="white-space:pre-wrap;color:#8a1d1d;background:#fff1f1;padding:12px;border-radius:12px;">'+escapeHtml(String(err && (err.message || err) || err))+'</pre></div>';
        }
      }

      notice('發生錯誤：'+String(err && (err.message || err) || err));
    }
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
    return '<div class="grid"><aside><section class="card"><h2>前台下載</h2><div class="field"><label>選擇 DM</label><select id="dmSelect">'+options(dms,selectedDm,'name','請選擇 DM')+'</select></div><div class="field"><label>選擇業務聯絡資訊</label><select id="contactSelect">'+contactOptions()+'</select><small>資料來自雲端通訊錄。</small></div><label class="upload">上傳形象照<input id="photoInput" type="file" accept="image/*"></label><div id="photoPreview">'+(assets.photo?'<img class="preview-img" src="'+assets.photo+'">':'')+'</div><label class="upload">上傳 QR Code<input id="qrInput" type="file" accept="image/*"></label><div id="qrPreview">'+(assets.qr?'<img class="preview-img" src="'+assets.qr+'">':'')+'</div><button id="renderBtn" class="btn primary full">更新預覽</button><button id="downloadBtn" class="btn gold full">下載 DM 圖片</button></section><section class="card"><h2>使用說明</h2><p class="muted">業務只要選擇 DM、選擇聯絡人、上傳形象照與 QR Code，即可下載完整 DM。聯絡資訊只會套在右上角白色框，不會跑到物件區。</p></section></aside><section><section class="card"><h2>即時預覽</h2><div class="canvas-wrap"><canvas id="dmCanvas" class="dm-canvas"></canvas></div></section><section class="card"><h2>可選 DM</h2><div class="dm-grid">'+dmCards(false)+'</div></section></section></div>';
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
    if((el=document.getElementById('contactSelect'))) el.onchange=function(){selectedContact=this.value; renderCanvas();};
    if((el=document.getElementById('renderBtn'))) el.onclick=renderCanvas;
    if((el=document.getElementById('downloadBtn'))) el.onclick=downloadCanvas;
    if((el=document.getElementById('photoInput'))) el.onchange=function(e){readFile(e.target.files[0]).then(function(url){assets.photo=url;render();renderCanvas();});};
    if((el=document.getElementById('qrInput'))) el.onchange=function(e){readFile(e.target.files[0]).then(function(url){assets.qr=url;render();renderCanvas();});};
    if((el=document.getElementById('loginBtn'))) el.onclick=login;
    if((el=document.getElementById('logoutBtn'))) el.onclick=logout;
    if((el=document.getElementById('dmUpload'))) el.onchange=function(e){pendingFiles=Array.prototype.slice.call(e.target.files||[]); document.getElementById('pendingInfo').textContent='已選擇 '+pendingFiles.length+' 張 DM';};
    if((el=document.getElementById('uploadBtn'))) el.onclick=uploadDms;
    if((el=document.getElementById('addContactBtn'))) el.onclick=addContact;
    if((el=document.getElementById('saveSettingsBtn'))) el.onclick=saveSettings;
    document.querySelectorAll('[data-select-dm]').forEach(function(card){card.onclick=function(){selectedDm=card.dataset.selectDm;view='front';render();setTimeout(renderCanvas,50);};});
    document.querySelectorAll('[data-delete-dm]').forEach(function(btn){btn.onclick=deleteDm;});
    document.querySelectorAll('[data-delete-contact]').forEach(function(btn){btn.onclick=deleteContact;});
    var ff=document.getElementById('fontFamily'); if(ff)ff.value=settings.fontFamily;
    var fw=document.getElementById('fontWeight'); if(fw)fw.value=settings.fontWeight;
    var bg=document.getElementById('bgEnabled'); if(bg)bg.value=String(!!settings.bgEnabled);
  }

  function options(items,selected,label,empty){return '<option value="">'+empty+'</option>'+items.map(function(x){return '<option value="'+x.id+'" '+(x.id===selected?'selected':'')+'>'+escapeHtml(x[label]||'未命名')+'</option>';}).join('');}
  function contactOptions(){return '<option value="">請選擇聯絡人</option>'+contacts.map(function(c){return '<option value="'+c.id+'" '+(c.id===selectedContact?'selected':'')+'>'+escapeHtml(c.name||'未命名')+'｜'+escapeHtml(c.title||'')+'｜'+escapeHtml(c.phone||'')+'</option>';}).join('');}
  function dmCards(admin){if(!dms.length)return '<div class="empty">尚無 DM</div>';return dms.map(function(d){return '<div class="dm-card '+(d.id===selectedDm?'active':'')+'"><img src="'+escapeAttr(d.image_url)+'" alt=""><h3>'+escapeHtml(d.name)+'</h3><span class="pill">'+escapeHtml(d.category||'DM')+'</span><div class="actions"><button class="btn line" data-select-dm="'+d.id+'">選用</button>'+(admin&&user?'<button class="btn danger" data-delete-dm="'+d.id+'">下架</button>':'')+'</div></div>';}).join('');}
  function contactCards(){if(!contacts.length)return '<div class="empty">尚無通訊錄</div>';return contacts.map(function(c){return '<div class="contact-card '+(c.id===selectedContact?'active':'')+'"><h3>'+escapeHtml(c.name||'未命名')+' '+escapeHtml(c.title||'')+'</h3><p class="muted">'+escapeHtml(c.phone||'')+'<br>'+escapeHtml(c.company||'')+' '+escapeHtml(c.address||'')+'</p>'+(user?'<button class="btn danger" data-delete-contact="'+c.id+'">刪除</button>':'')+'</div>';}).join('');}

  async function login(){var email=document.getElementById('loginEmail').value.trim();var pw=document.getElementById('loginPassword').value;var res=await sb.auth.signInWithPassword({email:email,password:pw}); if(res.error)notice('登入失敗：'+res.error.message); else {user=res.data.user; notice('登入成功'); loadAll();}}
  async function logout(){await sb.auth.signOut(); user=null; notice('已登出'); loadAll();}
  async function addLog(action,detail){try{await sb.from('access_logs').insert({action:action,detail:detail||''});}catch(e){}}
  async function uploadDms(){if(!user)return notice('請先登入後台。'); if(!pendingFiles.length)return notice('請先選擇 DM 圖檔。'); for(var i=0;i<pendingFiles.length;i++){var file=pendingFiles[i]; if(/[\u4e00-\u9fa5\s'"\\/]/.test(file.name)){notice('檔名含中文、空格或特殊符號，請改成英文檔名再上傳：'+file.name); return;} var path='dm/'+safeName(file.name); var up=await sb.storage.from(bucket()).upload(path,file,{upsert:true,contentType:file.type||'image/jpeg'}); if(up.error){notice('上傳失敗：'+up.error.message); return;} var url=sb.storage.from(bucket()).getPublicUrl(path).data.publicUrl; var ins=await sb.from('dm_items').insert({name:file.name.replace(/\.[^.]+$/,''),category:'已排版DM',image_url:url,is_active:true}); if(ins.error){notice('DM 資料寫入失敗：'+ins.error.message); return;} } await addLog('上傳並發布DM',String(pendingFiles.length)+' 張'); pendingFiles=[]; notice('DM 已上傳並發布。'); loadAll();}
  async function deleteDm(e){e.stopPropagation(); if(!confirm('確定要下架這張 DM？'))return; await sb.from('dm_items').update({is_active:false}).eq('id',e.target.dataset.deleteDm); await addLog('下架DM',e.target.dataset.deleteDm); loadAll();}
  async function addContact(){if(!user)return notice('請先登入後台。'); var row={name:val('cName')||'未命名',title:val('cTitle'),phone:val('cPhone'),company:val('cCompany'),address:val('cAddress'),is_active:true}; var res=await sb.from('contacts').insert(row); if(res.error)return notice('新增失敗：'+res.error.message); await addLog('新增聯絡人',row.name); notice('已新增聯絡人。'); loadAll();}
  async function deleteContact(e){if(!confirm('確定刪除這位聯絡人？'))return; await sb.from('contacts').update({is_active:false}).eq('id',e.target.dataset.deleteContact); await addLog('刪除聯絡人',e.target.dataset.deleteContact); loadAll();}
  function val(id){var e=document.getElementById(id);return e?e.value.trim():'';}
  async function saveSettings(){settings=Object.assign({},settings,{nameSize:+val('nameSize')||34,titleSize:+val('titleSize')||24,phoneSize:+val('phoneSize')||26,companySize:+val('companySize')||18,nameGap:+val('nameGap')||8,subGap:+val('subGap')||8,paddingX:+val('paddingX')||18,paddingY:+val('paddingY')||8,fontFamily:val('fontFamily')||'Microsoft JhengHei',fontWeight:val('fontWeight')||'bold',color:val('fontColor')||'#000000',bgEnabled:val('bgEnabled')==='true'}); var res=await sb.from('app_settings').upsert({key:'contact_box',value:settings,updated_at:new Date().toISOString()}); if(res.error)return notice('設定儲存失敗：'+res.error.message); await addLog('更新欄位設定',''); notice('設定已儲存。'); renderCanvas();}

  function readFile(file){return new Promise(function(resolve,reject){if(!file)return resolve('');var r=new FileReader();r.onload=function(){resolve(r.result);};r.onerror=reject;r.readAsDataURL(file);});}
  function loadImage(src){return new Promise(function(resolve){if(!src)return resolve(null);var img=new Image();img.crossOrigin='anonymous';img.onload=function(){resolve(img);};img.onerror=function(){resolve(null);};img.src=src;});}
  async function renderCanvas(){var canvas=document.getElementById('dmCanvas'); if(!canvas)return; var ctx=canvas.getContext('2d'); canvas.width=W; canvas.height=H; ctx.fillStyle='#f4f1eb';ctx.fillRect(0,0,W,H); var dm=dms.find(function(x){return x.id===selectedDm;}); if(dm){var img=await loadImage(dm.image_url); if(img)ctx.drawImage(img,0,0,W,H);} else {ctx.fillStyle='#666';ctx.font='36px Arial';ctx.fillText('請先選擇 DM',570,930);} await drawContact(ctx);}
  async function drawContact(ctx){var c=contacts.find(function(x){return x.id===selectedContact;})||{}; var b=settings; if(b.bgEnabled){ctx.fillStyle='rgba(221,230,239,.88)';roundRect(ctx,b.x,b.y,b.w,b.h,6);ctx.fill();} var px=b.paddingX||18, py=b.paddingY||8; var nameSize=b.nameSize||34,titleSize=b.titleSize||24,phoneSize=b.phoneSize||26,companySize=b.companySize||18; var y1=b.y+py+nameSize, y2=y1+(b.nameGap||8)+phoneSize, y3=y2+(b.subGap||8)+companySize; var family=b.fontFamily||'Microsoft JhengHei', weight=b.fontWeight||'bold'; ctx.fillStyle=b.color||'#000'; ctx.font=weight+' '+nameSize+'px "'+family+'", Arial'; var nameText='聯絡資訊：'+(c.name||''); fitText(ctx,nameText,b.x+px,y1,b.w-165,nameSize+6); ctx.font=weight+' '+titleSize+'px "'+family+'", Arial'; var tw=ctx.measureText(nameText).width+12; fitText(ctx,c.title||'',b.x+px+tw,y1,b.w-165-tw,titleSize+6); ctx.font=weight+' '+phoneSize+'px "'+family+'", Arial'; fitText(ctx,c.phone||'',b.x+px,y2,b.w-170,phoneSize+4); ctx.font=weight+' '+companySize+'px "'+family+'", Arial'; fitText(ctx,(c.company||'吉富工商')+' '+(c.address||''),b.x+px,y3,b.w-170,companySize+4); var photo=await loadImage(assets.photo); if(photo){ctx.save();roundRect(ctx,b.photoX,b.photoY,b.photoSize,b.photoSize,0);ctx.clip();drawCover(ctx,photo,b.photoX,b.photoY,b.photoSize,b.photoSize);ctx.restore();} var qr=await loadImage(assets.qr); if(qr){ctx.fillStyle='#fff';ctx.fillRect(b.qrX-4,b.qrY-4,b.qrSize+8,b.qrSize+8);drawContain(ctx,qr,b.qrX,b.qrY,b.qrSize,b.qrSize);}}
  function fitText(ctx,text,x,y,maxW,maxH){text=String(text||''); if(!text)return; var original=ctx.font; var size=parseInt((ctx.font.match(/(\d+)px/)||[])[1]||20,10); while(ctx.measureText(text).width>maxW && size>10){size--;ctx.font=ctx.font.replace(/\d+px/,size+'px');} ctx.textAlign='left';ctx.fillText(text,x,y);ctx.font=original;}
  function drawCover(ctx,img,x,y,w,h){var scale=Math.max(w/img.width,h/img.height),sw=w/scale,sh=h/scale;ctx.drawImage(img,(img.width-sw)/2,(img.height-sh)/2,sw,sh,x,y,w,h);}
  function drawContain(ctx,img,x,y,w,h){var scale=Math.min(w/img.width,h/img.height),dw=img.width*scale,dh=img.height*scale;ctx.drawImage(img,x+(w-dw)/2,y+(h-dh)/2,dw,dh);}
  function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
  async function downloadCanvas(){await renderCanvas(); var dm=dms.find(function(x){return x.id===selectedDm;}); var c=contacts.find(function(x){return x.id===selectedContact;}); var a=document.createElement('a'); a.href=document.getElementById('dmCanvas').toDataURL('image/png'); a.download=((dm&&dm.name||'DM')+'_'+(c&&c.name||'業務')+'.png').replace(/[\\/]/g,'-'); a.click(); await addLog('下載DM',a.download);}
  init();
})();
