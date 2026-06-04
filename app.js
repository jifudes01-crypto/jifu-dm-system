/* JIFU_BROKER_LINE_POSITION_CONTROL_20260603 */
/* JIFU_BROKER_LINE_SIZE_CONTROL_20260603 */
/* JIFU_ADMIN_CONTACT_UX_FIX_20260603 */
/* JIFU_BROKER_IPHONE_FIX_20260603 */
/* JIFU_LINE_TEAM_DMNAME_FIX_20260528 */
/* JIFU_RESTORE_FEATURES_CLEAN_20260528 */
/* JIFU_QR_INDEPENDENT_ADJUSTER_20260528 */
/* JIFU_FINAL_QR_TIGHT_LAYOUT_20260528 */
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
  var dms=[],contacts=[],brokers=[],logs=[];
  var selectedDm='', selectedContact='', selectedTeam='', selectedBroker='';
  var adminContactTeamFilter='', adminContactKeyword='';
  var assets={photo:'',qr:''};
  var settings=defaultSettings();
  var pendingFiles=[];

  function defaultSettings(){return {x:950,y:58,w:452,h:142,nameSize:34,titleSize:24,phoneSize:26,companySize:18,nameGap:8,subGap:8,paddingX:18,paddingY:8,fontFamily:'Microsoft JhengHei',fontWeight:'bold',color:'#000000',bgEnabled:false,photoX:1268,photoY:68,photoSize:118,qrX:1268,qrY:68,qrSize:118,brokerLineSize:18,brokerLineY:320};}
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

      var bRes=await sb.from('brokers').select('*').eq('is_active',true).order('team',{ascending:true}).order('name',{ascending:true});
      if(!bRes.error){
        brokers=bRes.data||[];
        if(!selectedBroker && brokers[0]) selectedBroker=brokers[0].id;
      }else{
        brokers=[];
        console.warn('brokers table not ready', bRes.error);
      }
      ensureSelectedBrokerInTeam();

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
    // Front stage broker is intentionally auto-bound by team; no broker dropdown is rendered here.
    ensureSelectedContactInTeam();
    ensureSelectedBrokerInTeam();
    var c=getSelectedContact?getSelectedContact():null;
    var broker=getSelectedBroker?getSelectedBroker():null;
    var photoUrl=c?(c.photo_url||c.avatar_url||''):'';
    var qrUrl=c?(c.qr_url||c.qr_code_url||''):'';
    var lineHint=isLineBrowser()?'<div class="line-hint">LINE 內建瀏覽器請使用下方「手機備用選單」。</div>':'';
    return '<div class="grid"><aside><section class="card"><h2>前台下載</h2>'+lineHint+
      '<div class="field"><label>選擇 DM</label><select id="dmSelect">'+options(dms,selectedDm,'name','請選擇 DM')+'</select><button id="dmPickerBtn" class="btn line full line-fallback-btn" type="button">手機備用：選擇 DM</button></div>'+
      '<div class="field"><label>選擇團隊</label><select id="teamSelect">'+teamOptions()+'</select><button id="teamPickerBtn" class="btn line full line-fallback-btn" type="button">手機備用：選擇團隊</button></div>'+
      '<div class="field"><label>選擇業務聯絡資訊</label><select id="contactSelect">'+contactOptions()+'</select><small>資料來自雲端通訊錄；形象照、QR Code 與經紀人由後台依團隊綁定。</small><button id="contactPickerBtn" class="btn line full line-fallback-btn" type="button">手機備用：選擇業務</button></div>'+
      '<div class="mini-contact"><div><strong>'+escapeHtml(c?(c.name||'未命名'):'尚未選擇')+'</strong><span>'+escapeHtml(c?(c.title||''):'')+'</span><p>'+escapeHtml(c?(c.phone||''):'')+'<br>'+escapeHtml(c?getTeamName(c):'')+'</p><p class="mini-broker">經紀人：'+escapeHtml(broker?(broker.name||'未命名經紀人'):'依團隊自動套入')+(broker&&broker.license_no?'｜'+escapeHtml(broker.license_no):'')+'</p></div><div class="mini-assets">'+
      (photoUrl?'<img src="'+escapeAttr(photoUrl)+'" alt="形象照">':'<span>無形象照</span>')+
      (qrUrl?'<img src="'+escapeAttr(qrUrl)+'" alt="QR Code">':'<span>無 QR</span>')+
      '</div></div><button id="renderBtn" class="btn primary full">更新預覽</button><button id="downloadBtn" class="btn gold full">下載 DM 圖片</button></section><section class="card"><h2>使用說明</h2><p class="muted">業務只要選擇 DM、團隊與業務，即可產生 DM；不動產經紀人會由後台依團隊自動套入。上傳與編輯請到後台管理。</p></section></aside><section><section class="card"><h2>即時預覽</h2><div class="canvas-wrap"><canvas id="dmCanvas" class="dm-canvas"></canvas></div></section><section class="card"><h2>可選 DM</h2><div class="dm-grid">'+dmCards(false)+'</div></section></section></div>';
  }
  function adminHtml(){
    return '<div class="grid admin"><aside><section class="card"><h2>後台登入</h2><p class="muted">'+(user?'已登入：'+escapeHtml(user.email):'尚未登入。前台可用，後台管理需登入。')+'</p><div class="field"><label>管理員 Email</label><input id="loginEmail" value="'+escapeAttr(user&&user.email||'')+'"></div><div class="field"><label>密碼</label><input id="loginPassword" type="password"></div><button id="loginBtn" class="btn primary full">登入後台</button><button id="logoutBtn" class="btn line full">登出</button></section><section class="card '+(!user?'hidden':'')+'"><h2>上傳已排版 DM</h2><div class="field"><label>DM 名稱</label><input id="dmUploadName" placeholder="例如：26年5月農地版第一期"></div><label class="upload">一次上傳多張 DM<input id="dmUpload" type="file" accept="image/*" multiple></label><div id="pendingInfo" class="muted">尚未選擇檔案</div><button id="uploadBtn" class="btn gold full">上傳並發布</button><div class="table-note">可先輸入 DM 名稱再上傳。若一次多張，系統會自動在後面加序號。</div></section></aside><section><section class="card"><h2>DM 管理</h2><div class="dm-grid">'+dmCards(true)+'</div></section></section></div>';
  }
  function contactsHtml(){
    return '<section class="card"><h2>通訊錄管理</h2><p class="muted">前後台都會依「公司 / 團隊」自動分組。可用團隊下拉與關鍵字快速篩選業務，管理時不需要一直捲很久。</p>' +
    '<div class="admin-contact-toolbar">' +
      '<div class="field"><label>依團隊篩選</label><select id="adminContactTeamFilter">'+adminTeamOptions()+'</select></div>' +
      '<div class="field"><label>搜尋姓名 / 電話 / 職稱 / 團隊</label><input id="adminContactKeyword" value="'+escapeAttr(adminContactKeyword||'')+'" placeholder="輸入關鍵字搜尋"></div>' +
      '<div class="field toolbar-actions"><label>&nbsp;</label><button id="clearAdminContactFilter" class="btn line" type="button">清除篩選</button></div>' +
    '</div>' +
    '<div class="'+(!user?'hidden':'')+'"><div class="row4"><div class="field"><label>姓名</label><input id="cName"></div><div class="field"><label>職稱</label><input id="cTitle"></div><div class="field"><label>電話</label><input id="cPhone"></div><div class="field"><label>公司 / 團隊</label><input id="cCompany"></div></div><div class="field"><label>地址</label><input id="cAddress"></div><button id="addContactBtn" class="btn primary">新增聯絡人</button></div>' +
    '<div class="compact-contact-list" style="margin-top:18px">'+contactCards()+'</div></section>' +
    '<section class="card"><h2>不動產經紀人選單管理</h2><p class="muted">前台會依團隊篩選經紀人。可在這裡新增、修改、刪除經紀人選單內容；DM 右上方紅框位置的字體大小與上下位置也在這裡調整。</p><div class="broker-size-panel"><div class="field"><label>DM 上不動產經紀人字體大小</label><input id="brokerLineSize" type="number" min="12" max="32" step="1" value="'+escapeAttr(settings.brokerLineSize||18)+'"><small>建議 18px，約等於 10pt 視覺大小。數字越大，DM 上紅框位置文字越大。</small></div><div class="field broker-range-field"><label>DM 上不動產經紀人上下位置</label><div class="range-with-value"><input id="brokerLineY" type="range" min="260" max="390" step="1" value="'+escapeAttr(settings.brokerLineY||320)+'"><input id="brokerLineYNumber" type="number" min="260" max="390" step="1" value="'+escapeAttr(settings.brokerLineY||320)+'"><span>px</span></div><small>用拉軸直接調整上下位置；數字越小越上面，越大越下面。右側數字可手動輸入。</small></div><div class="field"><label>&nbsp;</label><button id="saveBrokerLineSizeBtn" class="btn primary" type="button">儲存字體與位置</button></div></div><div class="'+(!user?'hidden':'')+'"><div class="row4"><div class="field"><label>團隊</label><input id="brokerTeam" placeholder="例如：祥億團隊"></div><div class="field"><label>經紀人姓名</label><input id="brokerName" placeholder="例如：王小明"></div><div class="field"><label>證號 / 備註</label><input id="brokerLicense" placeholder="例如：(112)新北經字第000000號"></div><div class="field"><label>&nbsp;</label><button id="addBrokerBtn" class="btn primary">新增經紀人</button></div></div></div><div class="broker-grid" style="margin-top:18px">'+brokerCards()+'</div></section>';
  }
  function settingsHtml(){
    return '<section class="card"><h2>右上角聯絡資訊欄位設定</h2><p class="muted">所有設定都會存到雲端。這些欄位只控制右上角白色聯絡資訊框，不會影響物件格。</p><div class="row4"><div class="field"><label>姓名字級</label><input id="nameSize" type="number" value="'+settings.nameSize+'"></div><div class="field"><label>職稱字級</label><input id="titleSize" type="number" value="'+settings.titleSize+'"></div><div class="field"><label>電話字級</label><input id="phoneSize" type="number" value="'+settings.phoneSize+'"></div><div class="field"><label>公司/地址字級</label><input id="companySize" type="number" value="'+settings.companySize+'"></div></div><div class="row4"><div class="field"><label>姓名區行距</label><input id="nameGap" type="number" value="'+settings.nameGap+'"></div><div class="field"><label>下方資訊行距</label><input id="subGap" type="number" value="'+settings.subGap+'"></div><div class="field"><label>左右內距</label><input id="paddingX" type="number" value="'+settings.paddingX+'"></div><div class="field"><label>上下內距</label><input id="paddingY" type="number" value="'+settings.paddingY+'"></div></div><div class="row"><div class="field"><label>字型</label><select id="fontFamily"><option>Microsoft JhengHei</option><option>PMingLiU</option><option>MingLiU</option><option>DFKai-SB</option><option>Arial</option><option>Tahoma</option></select></div><div class="field"><label>文字粗細</label><select id="fontWeight"><option value="normal">一般</option><option value="600">SemiBold</option><option value="bold">粗體</option><option value="900">超粗</option></select></div></div><div class="row"><div class="field"><label>文字顏色</label><input id="fontColor" type="color" value="'+settings.color+'"></div><div class="field"><label>聯絡區背景</label><select id="bgEnabled"><option value="false">不要底色，使用公版白色框</option><option value="true">加半透明底色</option></select></div></div><button id="saveSettingsBtn" class="btn primary '+(!user?'hidden':'')+'">儲存設定到雲端</button><p class="admin-only-note '+(user?'hidden':'')+'">請先登入後台，才能儲存欄位設定。</p></section>';
  }
  function logsHtml(){return '<section class="card"><h2>紀錄</h2><div class="log-list">'+(user?(logs.length?logs.map(function(l){return '<div>'+new Date(l.created_at).toLocaleString()+'｜'+escapeHtml(l.action)+'｜'+escapeHtml(l.detail||'')+'</div>';}).join(''):'尚無紀錄'):'請先登入後台查看紀錄。')+'</div></section>';}

  function bindPage(){
    var el; document.body.classList.toggle('line-browser',isLineBrowser()); document.body.classList.toggle('mobile-browser',isMobileBrowser());
    if((el=document.getElementById('dmSelect'))){el.onchange=function(){selectedDm=this.value;render();renderCanvas();};el.addEventListener('touchstart',function(e){if(isLineBrowser()){e.preventDefault();openPicker('選擇 DM',pickerItemsFromDms(),function(v){selectedDm=v;render();setTimeout(renderCanvas,50);});}},{passive:false});}
    if((el=document.getElementById('teamSelect'))){el.onchange=function(){selectedTeam=this.value;ensureSelectedContactInTeam();ensureSelectedBrokerInTeam();render();setTimeout(renderCanvas,50);};el.addEventListener('touchstart',function(e){if(isLineBrowser()){e.preventDefault();openPicker('選擇團隊',pickerItemsFromTeams(),function(v){selectedTeam=v;ensureSelectedContactInTeam();ensureSelectedBrokerInTeam();render();setTimeout(renderCanvas,50);});}},{passive:false});}
    if((el=document.getElementById('contactSelect'))){el.onchange=function(){selectedContact=this.value;ensureSelectedBrokerInTeam();render();renderCanvas();};el.addEventListener('touchstart',function(e){if(isLineBrowser()){e.preventDefault();openPicker('選擇業務',pickerItemsFromContacts(),function(v){selectedContact=v;ensureSelectedBrokerInTeam();render();setTimeout(renderCanvas,50);});}},{passive:false});}
    if((el=document.getElementById('dmPickerBtn')))el.onclick=function(){openPicker('選擇 DM',pickerItemsFromDms(),function(v){selectedDm=v;render();setTimeout(renderCanvas,50);});};
    if((el=document.getElementById('teamPickerBtn')))el.onclick=function(){openPicker('選擇團隊',pickerItemsFromTeams(),function(v){selectedTeam=v;ensureSelectedContactInTeam();ensureSelectedBrokerInTeam();render();setTimeout(renderCanvas,50);});};
    if((el=document.getElementById('contactPickerBtn')))el.onclick=function(){openPicker('選擇業務',pickerItemsFromContacts(),function(v){selectedContact=v;ensureSelectedBrokerInTeam();render();setTimeout(renderCanvas,50);});};
    if((el=document.getElementById('renderBtn')))el.onclick=renderCanvas;
    if((el=document.getElementById('downloadBtn')))el.onclick=downloadCanvas;
    if((el=document.getElementById('loginBtn')))el.onclick=login;
    if((el=document.getElementById('logoutBtn')))el.onclick=logout;
    if((el=document.getElementById('dmUpload')))el.onchange=function(e){pendingFiles=Array.prototype.slice.call(e.target.files||[]);var p=document.getElementById('pendingInfo');if(p)p.textContent='已選擇 '+pendingFiles.length+' 張 DM';};
    if((el=document.getElementById('uploadBtn')))el.onclick=uploadDms;
    if((el=document.getElementById('addContactBtn')))el.onclick=addContact;

    if((el=document.getElementById('adminContactTeamFilter'))) el.onchange=function(){adminContactTeamFilter=this.value;render();};
    if((el=document.getElementById('adminContactKeyword'))) el.oninput=function(){adminContactKeyword=this.value;render();};
    if((el=document.getElementById('clearAdminContactFilter'))) el.onclick=function(){adminContactTeamFilter='';adminContactKeyword='';render();};

    if((el=document.getElementById('addBrokerBtn')))el.onclick=addBroker;
    if((el=document.getElementById('brokerLineSize'))){el.oninput=function(){previewBrokerLineStyle();};}
    if((el=document.getElementById('brokerLineY'))){el.oninput=function(){syncBrokerLineY('slider');previewBrokerLineStyle();};}
    if((el=document.getElementById('brokerLineYNumber'))){el.oninput=function(){syncBrokerLineY('number');previewBrokerLineStyle();};}
    if((el=document.getElementById('saveBrokerLineSizeBtn')))el.onclick=saveBrokerLineSize;
    if((el=document.getElementById('saveSettingsBtn')))el.onclick=saveSettings;
    document.querySelectorAll('[data-select-dm]').forEach(function(card){card.onclick=function(){selectedDm=card.dataset.selectDm;view='front';render();setTimeout(renderCanvas,50);};});
    document.querySelectorAll('[data-delete-dm]').forEach(function(btn){btn.onclick=deleteDm;});
    document.querySelectorAll('[data-rename-dm]').forEach(function(btn){btn.onclick=function(e){renameDm(e,btn.dataset.renameDm);};});
    document.querySelectorAll('[data-delete-contact]').forEach(function(btn){btn.onclick=deleteContact;});
    document.querySelectorAll('[data-delete-broker]').forEach(function(btn){btn.onclick=function(e){deleteBroker(e,btn.dataset.deleteBroker);};});
    document.querySelectorAll('[data-rename-broker]').forEach(function(btn){btn.onclick=function(e){renameBroker(e,btn.dataset.renameBroker);};});
    document.querySelectorAll('[data-select-contact]').forEach(function(btn){btn.onclick=function(){selectedContact=btn.dataset.selectContact;selectedTeam=getTeamName(contacts.find(function(c){return c.id===selectedContact;})||{});view='front';render();setTimeout(renderCanvas,50);};});
    document.querySelectorAll('[data-photo-contact]').forEach(function(input){input.onchange=function(e){uploadContactAsset(e,input.dataset.photoContact,'photo');};});
    document.querySelectorAll('[data-qr-contact]').forEach(function(input){input.onchange=function(e){uploadContactAsset(e,input.dataset.qrContact,'qr');};});
    document.querySelectorAll('[data-delete-photo]').forEach(function(btn){btn.onclick=function(e){deleteContactAsset(e,btn.dataset.deletePhoto,'photo');};});
    document.querySelectorAll('[data-delete-qr]').forEach(function(btn){btn.onclick=function(e){deleteContactAsset(e,btn.dataset.deleteQr,'qr');};});
    document.querySelectorAll('[data-photo-adjust]').forEach(function(input){input.oninput=function(){previewPhotoAdjust(input.dataset.photoAdjust,input.dataset.adjustField,input.value);};input.onchange=function(){savePhotoAdjust(input.dataset.photoAdjust,input.dataset.adjustField,input.value);};});
    document.querySelectorAll('[data-photo-adjust-number]').forEach(function(input){input.oninput=function(){previewPhotoAdjust(input.dataset.photoAdjustNumber,input.dataset.adjustField,input.value);};input.onchange=function(){savePhotoAdjust(input.dataset.photoAdjustNumber,input.dataset.adjustField,input.value);};});
    document.querySelectorAll('[data-reset-photo-adjust]').forEach(function(btn){btn.onclick=function(){resetPhotoAdjust(btn.dataset.resetPhotoAdjust);};});
    document.querySelectorAll('[data-qr-adjust]').forEach(function(input){input.oninput=function(){previewQrAdjust(input.dataset.qrAdjust,input.dataset.adjustField,input.value);};input.onchange=function(){saveQrAdjust(input.dataset.qrAdjust,input.dataset.adjustField,input.value);};});
    document.querySelectorAll('[data-qr-adjust-number]').forEach(function(input){input.oninput=function(){previewQrAdjust(input.dataset.qrAdjustNumber,input.dataset.adjustField,input.value);};input.onchange=function(){saveQrAdjust(input.dataset.qrAdjustNumber,input.dataset.adjustField,input.value);};});
    document.querySelectorAll('[data-reset-qr-adjust]').forEach(function(btn){btn.onclick=function(){resetQrAdjust(btn.dataset.resetQrAdjust);};});
    var ff=document.getElementById('fontFamily');if(ff)ff.value=settings.fontFamily;var fw=document.getElementById('fontWeight');if(fw)fw.value=settings.fontWeight;var bg=document.getElementById('bgEnabled');if(bg)bg.value=String(!!settings.bgEnabled);
  }

  
  function isLineBrowser(){ return /Line\//i.test(navigator.userAgent || ''); }
  function isMobileBrowser(){ return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || ''); }
  function getTeamName(c){ return String((c && (c.team || c.company)) || '未分類團隊').trim() || '未分類團隊'; }
  function uniqueTeams(){ var map={}; contacts.forEach(function(c){map[getTeamName(c)]=true;}); return Object.keys(map).sort(function(a,b){return a.localeCompare(b,'zh-Hant');}); }
  function filteredContacts(){ var list=contacts||[]; if(!selectedTeam)return list; return list.filter(function(c){return getTeamName(c)===selectedTeam;}); }
  function ensureSelectedContactInTeam(){ var list=filteredContacts(); if(selectedContact&&list.some(function(c){return c.id===selectedContact;}))return; selectedContact=list[0]?list[0].id:''; }
  
  function adminFilteredContacts(){
    var list = contacts || [];
    if(adminContactTeamFilter){
      list = list.filter(function(c){ return getTeamName(c) === adminContactTeamFilter; });
    }
    if(adminContactKeyword){
      var kw = String(adminContactKeyword).trim().toLowerCase();
      if(kw){
        list = list.filter(function(c){
          return [
            c.name,
            c.title,
            c.phone,
            c.company,
            c.team,
            c.address
          ].join(' ').toLowerCase().indexOf(kw) !== -1;
        });
      }
    }
    return list;
  }

  function adminTeamOptions(){
    return '<option value="">全部團隊</option>'+uniqueTeams().map(function(t){
      return '<option value="'+escapeAttr(t)+'" '+(t===adminContactTeamFilter?'selected':'')+'>'+escapeHtml(t)+'</option>';
    }).join('');
  }

function openPicker(title,items,onSelect){
    var old=document.getElementById('linePickerModal'); if(old)old.remove();
    var modal=document.createElement('div'); modal.id='linePickerModal'; modal.className='line-picker-modal';
    var html='<div class="line-picker-panel"><div class="line-picker-head"><strong>'+escapeHtml(title)+'</strong><button type="button" id="linePickerClose">關閉</button></div><div class="line-picker-list">';
    items.forEach(function(item){html+='<button type="button" class="line-picker-item" data-value="'+escapeAttr(item.value)+'">'+escapeHtml(item.label)+'</button>';});
    html+='</div></div>'; modal.innerHTML=html; document.body.appendChild(modal);
    document.getElementById('linePickerClose').onclick=function(){modal.remove();};
    modal.addEventListener('click',function(e){if(e.target===modal)modal.remove();});
    modal.querySelectorAll('.line-picker-item').forEach(function(btn){btn.onclick=function(){var v=btn.getAttribute('data-value')||'';modal.remove();onSelect(v);};});
  }
  function pickerItemsFromDms(){return dms.map(function(d){return {value:d.id,label:d.name||'未命名 DM'};});}
  function pickerItemsFromTeams(){var items=[{value:'',label:'全部團隊'}];uniqueTeams().forEach(function(t){items.push({value:t,label:t});});return items;}
  function pickerItemsFromContacts(){return filteredContacts().map(function(c){return {value:c.id,label:(c.name||'未命名')+(c.title?'｜'+c.title:'')+(c.phone?'｜'+c.phone:'')};});}

  function filteredBrokers(){
    var list = brokers || [];
    var contact = getSelectedContact ? getSelectedContact() : null;
    var activeTeam = selectedTeam || (contact ? getTeamName(contact) : '');
    if(!activeTeam) return list;
    return list.filter(function(b){ return getTeamName(b) === activeTeam; });
  }

  function ensureSelectedBrokerInTeam(){
    var list = filteredBrokers();
    if(selectedBroker && list.some(function(b){ return b.id === selectedBroker; })) return;
    selectedBroker = list[0] ? list[0].id : '';
  }

  function getSelectedBroker(){
    return (brokers || []).find(function(b){ return b.id === selectedBroker; }) || null;
  }

  function pickerItemsFromBrokers(){
    return filteredBrokers().map(function(b){
      return {value:b.id,label:(b.name||'未命名經紀人')+(b.license_no?'｜'+b.license_no:'')};
    });
  }


function options(items,selected,label,empty){return '<option value="">'+empty+'</option>'+items.map(function(x){return '<option value="'+x.id+'" '+(x.id===selected?'selected':'')+'>'+escapeHtml(x[label]||'未命名')+'</option>';}).join('');}
  function teamOptions(){return '<option value="">全部團隊</option>'+uniqueTeams().map(function(t){return '<option value="'+escapeAttr(t)+'" '+(t===selectedTeam?'selected':'')+'>'+escapeHtml(t)+'</option>';}).join('');}
  function contactOptions(){var list=filteredContacts();return '<option value="">請選擇聯絡人</option>'+list.map(function(c){return '<option value="'+c.id+'" '+(c.id===selectedContact?'selected':'')+'>'+escapeHtml(c.name||'未命名')+'｜'+escapeHtml(c.title||'')+'｜'+escapeHtml(c.phone||'')+'</option>';}).join('');}
  function brokerOptions(){
    var list=filteredBrokers();
    return '<option value="">請選擇不動產經紀人</option>'+list.map(function(b){
      return '<option value="'+b.id+'" '+(b.id===selectedBroker?'selected':'')+'>'+escapeHtml(b.name||'未命名經紀人')+(b.license_no?'｜'+escapeHtml(b.license_no):'')+'</option>';
    }).join('');
  }

  function getSelectedContact(){
    return contacts.find(function(x){return x.id===selectedContact;}) || contacts[0] || null;
  }

  function dmCards(admin){if(!dms.length)return '<div class="empty">尚無 DM</div>';return dms.map(function(d){return '<div class="dm-card '+(d.id===selectedDm?'active':'')+'"><img src="'+escapeAttr(d.image_url)+'" alt=""><h3>'+escapeHtml(d.name)+'</h3><span class="pill">'+escapeHtml(d.category||'DM')+'</span>'+(admin&&user?'<div class="field dm-rename-field"><label>DM 名稱</label><input data-dm-name="'+d.id+'" value="'+escapeAttr(d.name||'')+'"><button class="btn line small" data-rename-dm="'+d.id+'" type="button">儲存名稱</button></div>':'')+'<div class="actions"><button class="btn line" data-select-dm="'+d.id+'">選用</button>'+(admin&&user?'<button class="btn danger" data-delete-dm="'+d.id+'">下架</button>':'')+'</div></div>';}).join('');}
  function contactCards(){
    var visibleContacts = adminFilteredContacts();
    if(!visibleContacts.length) return '<div class="empty">目前篩選條件下沒有通訊錄資料</div>';

    var grouped={};
    visibleContacts.forEach(function(c){
      var team=getTeamName(c);
      if(!grouped[team]) grouped[team]=[];
      grouped[team].push(c);
    });

    return Object.keys(grouped).sort(function(a,b){return a.localeCompare(b,'zh-Hant');}).map(function(team){
      return '<div class="team-group compact-team-group"><h3 class="team-heading">'+escapeHtml(team)+' <span class="team-count">'+grouped[team].length+' 位</span></h3>'+
        grouped[team].map(function(c){
          var photoUrl=c.photo_url||c.avatar_url||'';
          var qrUrl=c.qr_url||c.qr_code_url||'';
          var hasPhoto=!!photoUrl;
          var hasQr=!!qrUrl;
          var ox=numOr(c.photo_offset_x,0);
          var oy=numOr(c.photo_offset_y,0);
          var sc=numOr(c.photo_scale,1);
          return '<div class="contact-card compact-contact-card '+(c.id===selectedContact?'active':'')+'" data-contact-card-id="'+c.id+'">' +
            '<div class="contact-main">' +
              '<div class="contact-avatar">'+(hasPhoto?'<img src="'+escapeAttr(photoUrl)+'" alt="形象照">':'<span>無照</span>')+'</div>' +
              '<div class="contact-info"><h3>'+escapeHtml(c.name||'未命名')+' <span>'+escapeHtml(c.title||'')+'</span></h3>' +
                '<p class="muted">'+escapeHtml(c.phone||'')+'<br>'+escapeHtml(getTeamName(c))+(c.address?'｜'+escapeHtml(c.address):'')+'</p>' +
                '<div class="actions"><button class="btn line small" data-select-contact="'+c.id+'">前台預覽</button>'+(user?'<button class="btn danger small" data-delete-contact="'+c.id+'">刪除聯絡人</button>':'')+'</div>' +
              '</div>' +
            '</div>' +
            '<details class="compact-assets">' +
              '<summary>照片 / QR / 微調</summary>' +
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
                  (user?'<label class="mini-upload">上傳 QR Code<input data-qr-contact="'+c.id+'" type="file" accept="image/*"></label>'+(hasQr?'<button class="asset-delete" data-delete-qr="'+c.id+'" type="button">刪除 QR Code</button>':'<button class="asset-delete disabled" type="button" disabled>無 QR 可刪</button>'):'') +
                  (user?'<div class="qr-adjuster"><div class="asset-title">QR 微調</div>' +
                    '<label>左右 <span class="adjust-control"><input data-qr-adjust="'+c.id+'" data-adjust-field="qr_offset_x" type="range" min="-120" max="120" step="1" value="'+escapeAttr(numOr(c.qr_offset_x,0))+'"><input class="adjust-number" data-qr-adjust-number="'+c.id+'" data-adjust-field="qr_offset_x" type="number" min="-120" max="120" step="1" value="'+escapeAttr(numOr(c.qr_offset_x,0))+'"></span></label>' +
                    '<label>上下 <span class="adjust-control"><input data-qr-adjust="'+c.id+'" data-adjust-field="qr_offset_y" type="range" min="-120" max="120" step="1" value="'+escapeAttr(numOr(c.qr_offset_y,0))+'"><input class="adjust-number" data-qr-adjust-number="'+c.id+'" data-adjust-field="qr_offset_y" type="number" min="-120" max="120" step="1" value="'+escapeAttr(numOr(c.qr_offset_y,0))+'"></span></label>' +
                    '<label>縮放 <span class="adjust-control"><input data-qr-adjust="'+c.id+'" data-adjust-field="qr_scale" type="range" min="0.5" max="2" step="0.01" value="'+escapeAttr(numOr(c.qr_scale,1))+'"><input class="adjust-number" data-qr-adjust-number="'+c.id+'" data-adjust-field="qr_scale" type="number" min="0.5" max="2" step="0.01" value="'+escapeAttr(numOr(c.qr_scale,1))+'"></span></label>' +
                    '<button class="btn line small" data-reset-qr-adjust="'+c.id+'" type="button">重設 QR 位置</button></div>':'') +
                '</div>' +
              '</div>' +
            '</details>' +
          '</div>';
        }).join('')+'</div>';
    }).join('');
  }

  
  function brokerCards(){
    if(!brokers.length)return '<div class="empty">尚無經紀人資料</div>';
    var grouped={};
    brokers.forEach(function(b){var t=getTeamName(b);if(!grouped[t])grouped[t]=[];grouped[t].push(b);});
    return Object.keys(grouped).sort(function(a,b){return a.localeCompare(b,'zh-Hant');}).map(function(team){
      return '<div class="team-group"><h3 class="team-heading">'+escapeHtml(team)+'</h3>'+grouped[team].map(function(b){
        return '<div class="broker-card"><div><strong>'+escapeHtml(b.name||'未命名經紀人')+'</strong><p class="muted">'+escapeHtml(b.license_no||'')+'</p></div>'+
        (user?'<div class="broker-edit"><input data-broker-team="'+b.id+'" value="'+escapeAttr(getTeamName(b))+'" placeholder="團隊"><input data-broker-name="'+b.id+'" value="'+escapeAttr(b.name||'')+'" placeholder="經紀人姓名"><input data-broker-license="'+b.id+'" value="'+escapeAttr(b.license_no||'')+'" placeholder="證號 / 備註"><button class="btn line small" data-rename-broker="'+b.id+'" type="button">儲存</button><button class="btn danger small" data-delete-broker="'+b.id+'" type="button">刪除</button></div>':'')+
        '</div>';
      }).join('')+'</div>';
    }).join('');
  }


  async function addBroker(){
    if(!user)return notice('請先登入後台。');
    var team=(document.getElementById('brokerTeam')&&document.getElementById('brokerTeam').value||'').trim();
    var name=(document.getElementById('brokerName')&&document.getElementById('brokerName').value||'').trim();
    var license=(document.getElementById('brokerLicense')&&document.getElementById('brokerLicense').value||'').trim();
    if(!team)return notice('請先輸入團隊。');
    if(!name)return notice('請先輸入經紀人姓名。');

    var res=await sb.from('brokers').insert({team:team,name:name,license_no:license,is_active:true});
    if(res.error)return notice('新增經紀人失敗：'+res.error.message);

    await addLog('新增經紀人',team+'｜'+name);
    document.getElementById('brokerName').value='';
    document.getElementById('brokerLicense').value='';
    notice('已新增經紀人。');
    loadAll();
  }

  async function renameBroker(e,brokerId){
    if(e&&e.stopPropagation)e.stopPropagation();
    if(!user)return notice('請先登入後台。');

    var team=(document.querySelector('[data-broker-team="'+brokerId+'"]')||{}).value||'';
    var name=(document.querySelector('[data-broker-name="'+brokerId+'"]')||{}).value||'';
    var license=(document.querySelector('[data-broker-license="'+brokerId+'"]')||{}).value||'';

    team=team.trim();
    name=name.trim();
    license=license.trim();

    if(!team)return notice('團隊不可空白。');
    if(!name)return notice('經紀人姓名不可空白。');

    var res=await sb.from('brokers').update({team:team,name:name,license_no:license}).eq('id',brokerId);
    if(res.error)return notice('經紀人更新失敗：'+res.error.message);

    var b=brokers.find(function(x){return x.id===brokerId;});
    if(b){b.team=team;b.name=name;b.license_no=license;}
    await addLog('修改經紀人',team+'｜'+name);
    notice('經紀人已更新。');
    render();
  }

  async function deleteBroker(e,brokerId){
    if(e&&e.stopPropagation)e.stopPropagation();
    if(!user)return notice('請先登入後台。');
    if(!confirm('確定刪除這位經紀人？'))return;

    var res=await sb.from('brokers').update({is_active:false}).eq('id',brokerId);
    if(res.error)return notice('刪除經紀人失敗：'+res.error.message);

    await addLog('刪除經紀人',brokerId);
    if(selectedBroker===brokerId)selectedBroker='';
    notice('經紀人已刪除。');
    loadAll();
  }

async function login(){var email=document.getElementById('loginEmail').value.trim();var pw=document.getElementById('loginPassword').value;var res=await sb.auth.signInWithPassword({email:email,password:pw}); if(res.error)notice('登入失敗：'+res.error.message); else {user=res.data.user; notice('登入成功'); loadAll();}}
  async function logout(){await sb.auth.signOut(); user=null; notice('已登出'); loadAll();}
  async function addLog(action,detail){try{await sb.from('access_logs').insert({action:action,detail:detail||''});}catch(e){}}
  async function uploadDms(){
    if(!user)return notice('請先登入後台。');
    if(!pendingFiles.length)return notice('請先選擇 DM 圖檔。');
    var customNameEl=document.getElementById('dmUploadName');
    var customName=(customNameEl&&customNameEl.value||'').trim();
    for(var i=0;i<pendingFiles.length;i++){
      var file=pendingFiles[i];
      var path='dm/'+safeName(file.name);
      var up=await sb.storage.from(bucket()).upload(path,file,{upsert:true,contentType:file.type||'image/jpeg'});
      if(up.error){notice('上傳失敗：'+up.error.message);return;}
      var url=sb.storage.from(bucket()).getPublicUrl(path).data.publicUrl;
      var finalName=customName||file.name.replace(/\.[^.]+$/,'');
      if(customName&&pendingFiles.length>1)finalName=customName+'-'+(i+1);
      var ins=await sb.from('dm_items').insert({name:finalName,category:'已排版DM',image_url:url,is_active:true});
      if(ins.error){notice('DM 資料寫入失敗：'+ins.error.message);return;}
    }
    await addLog('上傳並發布DM',String(pendingFiles.length)+' 張');
    pendingFiles=[];
    if(customNameEl)customNameEl.value='';
    notice('DM 已上傳並發布。');
    loadAll();
  }

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

  function updateLocalContactQrAdjust(contactId,field,value){
    var c=contacts.find(function(x){return x.id===contactId;});
    if(c)c[field]=Number(value);
    if(selectedContact===contactId && view==='front') setTimeout(renderCanvas,30);
  }

  function previewQrAdjust(contactId,field,value){
    updateLocalContactQrAdjust(contactId,field,value);

    document.querySelectorAll('[data-qr-adjust="'+contactId+'"][data-adjust-field="'+field+'"]').forEach(function(el){
      if(String(el.value)!==String(value)) el.value=value;
    });
    document.querySelectorAll('[data-qr-adjust-number="'+contactId+'"][data-adjust-field="'+field+'"]').forEach(function(el){
      if(String(el.value)!==String(value)) el.value=value;
    });
  }

  async function saveQrAdjust(contactId,field,value){
    if(!user)return notice('請先登入後台。');
    var payload={};
    payload[field]=Number(value);
    updateLocalContactQrAdjust(contactId,field,value);
    var scrollX = window.scrollX || window.pageXOffset || 0;
    var scrollY = window.scrollY || window.pageYOffset || 0;
    var res=await sb.from('contacts').update(payload).eq('id',contactId);
    if(res.error) notice('QR 微調儲存失敗：'+res.error.message);
    setTimeout(function(){ window.scrollTo(scrollX,scrollY); }, 0);
    setTimeout(function(){ window.scrollTo(scrollX,scrollY); }, 80);
  }

  async function resetQrAdjust(contactId){
    if(!user)return notice('請先登入後台。');
    var scrollX = window.scrollX || window.pageXOffset || 0;
    var scrollY = window.scrollY || window.pageYOffset || 0;
    var payload={qr_offset_x:0,qr_offset_y:0,qr_scale:1};
    var c=contacts.find(function(x){return x.id===contactId;});
    if(c){c.qr_offset_x=0;c.qr_offset_y=0;c.qr_scale=1;}
    var res=await sb.from('contacts').update(payload).eq('id',contactId);
    if(res.error) notice('QR 位置重設失敗：'+res.error.message);
    else {
      notice('QR 位置已重設。');
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

  async function renameDm(e,dmId){
    if(e&&e.stopPropagation)e.stopPropagation();
    if(!user)return notice('請先登入後台。');
    var input=document.querySelector('[data-dm-name="'+dmId+'"]');
    var name=(input&&input.value||'').trim();
    if(!name)return notice('請先輸入 DM 名稱。');
    var res=await sb.from('dm_items').update({name:name}).eq('id',dmId);
    if(res.error)return notice('DM 名稱更新失敗：'+res.error.message);
    var d=dms.find(function(x){return x.id===dmId;});
    if(d)d.name=name;
    await addLog('修改DM名稱',name);
    notice('DM 名稱已更新。');
    render();
  }

  async function deleteDm(e){e.stopPropagation(); if(!confirm('確定要下架這張 DM？'))return; await sb.from('dm_items').update({is_active:false}).eq('id',e.target.dataset.deleteDm); await addLog('下架DM',e.target.dataset.deleteDm); loadAll();}
  async function addContact(){if(!user)return notice('請先登入後台。'); var row={name:val('cName')||'未命名',title:val('cTitle'),phone:val('cPhone'),company:val('cCompany'),address:val('cAddress'),is_active:true}; var res=await sb.from('contacts').insert(row); if(res.error)return notice('新增失敗：'+res.error.message); await addLog('新增聯絡人',row.name); notice('已新增聯絡人。'); loadAll();}
  async function deleteContact(e){if(!confirm('確定刪除這位聯絡人？'))return; await sb.from('contacts').update({is_active:false}).eq('id',e.target.dataset.deleteContact); await addLog('刪除聯絡人',e.target.dataset.deleteContact); loadAll();}
  function val(id){var e=document.getElementById(id);return e?e.value.trim():'';}
  async function saveSettings(){settings=Object.assign({},settings,{nameSize:+val('nameSize')||34,titleSize:+val('titleSize')||24,phoneSize:+val('phoneSize')||26,companySize:+val('companySize')||18,nameGap:+val('nameGap')||8,subGap:+val('subGap')||8,paddingX:+val('paddingX')||18,paddingY:+val('paddingY')||8,fontFamily:val('fontFamily')||'Microsoft JhengHei',fontWeight:val('fontWeight')||'bold',color:val('fontColor')||'#000000',bgEnabled:val('bgEnabled')==='true',brokerLineSize:numOr(settings.brokerLineSize,18),brokerLineY:numOr(settings.brokerLineY,320)}); var res=await sb.from('app_settings').upsert({key:'contact_box',value:settings,updated_at:new Date().toISOString()}); if(res.error)return notice('設定儲存失敗：'+res.error.message); await addLog('更新欄位設定',''); notice('設定已儲存。'); renderCanvas();}

  function syncBrokerLineY(source){
    var slider=document.getElementById('brokerLineY');
    var number=document.getElementById('brokerLineYNumber');
    if(!slider || !number)return;
    var v=source==='number'?number.value:slider.value;
    v=Math.max(260,Math.min(390,numOr(v,320)));
    slider.value=v;
    number.value=v;
  }

  function previewBrokerLineStyle(){
    syncBrokerLineY('slider');
    settings.brokerLineSize=Math.max(12,Math.min(32,numOr(val('brokerLineSize'),18)));
    settings.brokerLineY=Math.max(260,Math.min(390,numOr(val('brokerLineYNumber')||val('brokerLineY'),320)));
    renderCanvas();
  }

  async function saveBrokerLineSize(){
    syncBrokerLineY('slider');
    settings.brokerLineSize=Math.max(12,Math.min(32,numOr(val('brokerLineSize'),18)));
    settings.brokerLineY=Math.max(260,Math.min(390,numOr(val('brokerLineYNumber')||val('brokerLineY'),320)));
    var res=await sb.from('app_settings').upsert({key:'contact_box',value:settings,updated_at:new Date().toISOString()});
    if(res.error)return notice('不動產經紀人字體與位置儲存失敗：'+res.error.message);
    await addLog('更新經紀人字體與位置','size='+settings.brokerLineSize+', y='+settings.brokerLineY);
    notice('不動產經紀人字體與上下位置已儲存。');
    renderCanvas();
  }

  function readFile(file){return new Promise(function(resolve,reject){if(!file)return resolve('');var r=new FileReader();r.onload=function(){resolve(r.result);};r.onerror=reject;r.readAsDataURL(file);});}
  function loadImage(src){return new Promise(function(resolve){if(!src)return resolve(null);var img=new Image();img.crossOrigin='anonymous';img.onload=function(){resolve(img);};img.onerror=function(){resolve(null);};img.src=src;});}
  async function renderCanvas(){var canvas=document.getElementById('dmCanvas'); if(!canvas)return; var ctx=canvas.getContext('2d'); canvas.width=W; canvas.height=H; ctx.fillStyle='#f4f1eb';ctx.fillRect(0,0,W,H); var dm=dms.find(function(x){return x.id===selectedDm;}); if(dm){var img=await loadImage(dm.image_url); if(img)ctx.drawImage(img,0,0,W,H);} else {ctx.fillStyle='#666';ctx.font='36px Arial';ctx.fillText('請先選擇 DM',570,930);} await drawContact(ctx);}
  async function drawContact(ctx){
    var c=getSelectedContact()||{};
    var family=settings.fontFamily||'Microsoft JhengHei';
    var weight='900';
    ctx.fillStyle=settings.color||'#000';
    ctx.textBaseline='alphabetic';

    var nameX=930, phoneX=930, companyX=930;
    var nameY=126, phoneY=182, companyY=238;

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

    var qrBaseX=1218, qrBaseY=122, qrBaseSize=64;
    var qOffsetX=numOr(c.qr_offset_x,0);
    var qOffsetY=numOr(c.qr_offset_y,0);
    var qScale=Math.max(0.5,Math.min(2.0,numOr(c.qr_scale,1)));
    var qrSize=qrBaseSize*qScale;
    var qrX=qrBaseX+qOffsetX;
    var qrY=qrBaseY+qOffsetY;

    var photoX=1356, photoY=58, photoW=74, photoH=210;
    var pOffsetX=numOr(c.photo_offset_x,0);
    var pOffsetY=numOr(c.photo_offset_y,0);
    var pScale=Math.max(0.6,Math.min(2.2,numOr(c.photo_scale,1)));

    if(qr){
      drawQrImage(ctx,qr,qrX,qrY,qrSize);
    }

    if(photo){
      drawPortraitFreeScale(ctx,photo,photoX,photoY,photoW,photoH,pOffsetX,pOffsetY,pScale);
    }

    drawBrokerLine(ctx);
  }

  function drawBrokerLine(ctx){
    var broker=getSelectedBroker ? getSelectedBroker() : null;
    if(!broker)return;
    var family=settings.fontFamily||'Microsoft JhengHei';
    var size=Math.max(12,Math.min(32,numOr(settings.brokerLineSize,18)));
    var text='不動產經紀人：'+(broker.name||'')+(broker.license_no?'｜'+broker.license_no:'');
    if(!text.replace('不動產經紀人：','').trim())return;
    ctx.save();
    ctx.fillStyle='#333333';
    ctx.textAlign='right';
    ctx.textBaseline='alphabetic';
    ctx.font='600 '+size+'px "'+family+'", Arial';
    var y=Math.max(260,Math.min(390,numOr(settings.brokerLineY,320)));
    fitTextRight(ctx,text,1428,y,560,size+8,12);
    ctx.restore();
  }

function drawPortraitFreeScale(ctx,img,x,y,w,h,offsetX,offsetY,scaleAdjust){
    if(!img)return;
    var iw=img.naturalWidth||img.width;
    var ih=img.naturalHeight||img.height;
    if(!iw||!ih)return;

    var baseScale=Math.min(w/iw,h/ih);
    var scale=baseScale*(scaleAdjust||1);
    var dw=iw*scale;
    var dh=ih*scale;
    var dx=x+(w-dw)/2+Number(offsetX||0);
    var dy=y+(h-dh)/2+Number(offsetY||0);

    ctx.drawImage(img,dx,dy,dw,dh);
  }

function fitText(ctx,text,x,y,maxW,maxH){text=String(text||''); if(!text)return; var original=ctx.font; var size=parseInt((ctx.font.match(/(\d+)px/)||[])[1]||20,10); while(ctx.measureText(text).width>maxW && size>10){size--;ctx.font=ctx.font.replace(/\d+px/,size+'px');} ctx.textAlign='left';ctx.fillText(text,x,y);ctx.font=original;}
function fitTextRight(ctx,text,x,y,maxW,maxH,minSize){text=String(text||''); if(!text)return; var original=ctx.font; var size=parseInt((ctx.font.match(/(\d+)px/)||[])[1]||20,10); minSize=Number(minSize||10); while(ctx.measureText(text).width>maxW && size>minSize){size--;ctx.font=ctx.font.replace(/\d+px/,size+'px');} ctx.textAlign='right';ctx.fillText(text,x,y);ctx.font=original;}
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
async function downloadCanvas(){
    var canvas=document.getElementById('dmCanvas');
    if(!canvas)return notice('找不到預覽圖，請先更新預覽。');

    await renderCanvas();

    var dm=dms.find(function(x){return x.id===selectedDm;});
    var c=contacts.find(function(x){return x.id===selectedContact;});
    var fileName=((dm&&dm.name||'DM')+'_'+(c&&c.name||'業務')+'.png').replace(/[\\/]/g,'-');

    var dataUrl='';
    try{ dataUrl=canvas.toDataURL('image/png'); }catch(e){ dataUrl=''; }
    if(!dataUrl)return notice('圖片產生失敗，請重新更新預覽後再試一次。');

    var ua=navigator.userAgent||'';
    var isMobile=/Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    var isLine=/Line\//i.test(ua);
    var isIOS=/iPhone|iPad|iPod/i.test(ua);
    var isInApp=/Line\//i.test(ua)||/FBAN|FBAV|Instagram|MicroMessenger|Notion/i.test(ua);

    // 桌機優先使用真正下載；手機/LINE/Notion 內建瀏覽器一律使用同頁長按儲存，避免 popup、download、blob 被封鎖。
    if(!isMobile && !isLine && !isInApp){
      try{
        canvas.toBlob(function(blob){
          if(blob){
            var url=URL.createObjectURL(blob);
            var a=document.createElement('a');
            a.href=url;
            a.download=fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(function(){URL.revokeObjectURL(url);},1500);
          }else{
            forceSamePageImageSave(dataUrl,fileName);
          }
          addLog('下載DM',fileName);
        },'image/png',1);
      }catch(err){
        forceSamePageImageSave(dataUrl,fileName);
      }
      return;
    }

    forceSamePageImageSave(dataUrl,fileName);
    await addLog('下載DM',fileName);
  }

  function forceSamePageImageSave(dataUrl,fileName){
    // LINE / Notion / iPhone WebView may block window.open, target=_blank,
    // <a download>, data: links, and blob: links. Do not trigger any external
    // navigation here. Put the PNG image directly in the current page and open
    // the full-screen long-press panel immediately.
    showMobileDownloadFallback(dataUrl,fileName);
    openInlineImageSavePage(dataUrl,fileName);
    setTimeout(function(){
      var img=document.getElementById('inlineImageSaveImg') || document.getElementById('mobileDownloadPreviewImg');
      if(img)img.scrollIntoView({behavior:'smooth',block:'center'});
    },120);
    notice('圖片已產生，請直接長按圖片儲存。');
  }

  function showMobileDownloadFallback(dataUrl,fileName){
    var old=document.getElementById('mobileDownloadFallback');
    if(old)old.remove();

    var box=document.createElement('div');
    box.id='mobileDownloadFallback';
    box.className='mobile-download-fallback';
    box.innerHTML=''
      +'<div class="mobile-save-head">'
      +  '<div><strong>圖片已產生</strong><p>為避免 LINE / Notion / iPhone 阻擋下載，系統已直接在本頁顯示圖片。請長按圖片，選擇「儲存圖片」或「加入照片」。</p><small>'+escapeHtml(fileName||'jifu-dm.png')+'</small></div>'
      +  '<button type="button" id="closeMobileImageBtn" aria-label="關閉">×</button>'
      +'</div>'
      +'<div class="mobile-save-note">不使用開新分頁、不使用外部 App、不使用 data/blob 下載連結。</div>'
      +'<img id="mobileDownloadPreviewImg" alt="DM圖片預覽，請長按儲存">';

    var canvasWrap=document.querySelector('.canvas-wrap');
    if(canvasWrap && canvasWrap.parentNode){
      canvasWrap.parentNode.insertBefore(box,canvasWrap.nextSibling);
    }else{
      document.body.appendChild(box);
    }

    var preview=document.getElementById('mobileDownloadPreviewImg');
    if(preview){
      preview.src=dataUrl;
      preview.addEventListener('contextmenu',function(e){ e.stopPropagation(); },false);
      preview.addEventListener('touchstart',function(){ preview.classList.add('is-touching'); },{passive:true});
      preview.addEventListener('touchend',function(){ preview.classList.remove('is-touching'); },{passive:true});
    }

    var close=document.getElementById('closeMobileImageBtn');
    if(close){
      close.onclick=function(){ var b=document.getElementById('mobileDownloadFallback'); if(b)b.remove(); };
    }
  }

  function openInlineImageSavePage(dataUrl,fileName){
    var old=document.getElementById('inlineImageSavePage');
    if(old)old.remove();

    var page=document.createElement('div');
    page.id='inlineImageSavePage';
    page.className='inline-image-save-page';
    page.innerHTML=''
      +'<div class="inline-image-save-toolbar">'
      +  '<button type="button" id="backFromInlineSave">返回編輯</button>'
      +  '<div><strong>長按圖片儲存</strong><span>已在同一頁顯示圖片，不會開啟外部應用程式。</span></div>'
      +'</div>'
      +'<div class="inline-image-save-instruction">請長按下方圖片，選擇「儲存圖片」或「加入照片」。<br><small>'+escapeHtml(fileName||'jifu-dm.png')+'</small></div>'
      +'<img id="inlineImageSaveImg" alt="DM圖片，請長按儲存">';
    document.body.appendChild(page);
    document.body.classList.add('inline-save-open');

    var img=document.getElementById('inlineImageSaveImg');
    if(img){
      img.src=dataUrl;
      img.addEventListener('contextmenu',function(e){ e.stopPropagation(); },false);
      img.addEventListener('touchstart',function(){ img.classList.add('is-touching'); },{passive:true});
      img.addEventListener('touchend',function(){ img.classList.remove('is-touching'); },{passive:true});
    }

    var back=document.getElementById('backFromInlineSave');
    if(back){
      back.onclick=function(){
        var p=document.getElementById('inlineImageSavePage');
        if(p)p.remove();
        document.body.classList.remove('inline-save-open');
        var box=document.getElementById('mobileDownloadFallback');
        if(box)box.scrollIntoView({behavior:'smooth',block:'start'});
      };
    }
  }



  init();
})();
