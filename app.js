/* JIFU_SAFE_RESTORE_NO_DUPLICATE_CONTACT_GRAPHICS_20260527 */
/* JIFU_GET_SELECTED_CONTACT_FIX_20260527 */
/* JIFU_NEW_CONTACT_BOX_LAYOUT_20260527 */
/* JIFU_CONTACT_COLON_FINAL_20260527 */
/* JIFU_FORCE_UPDATE_20260527_FINAL - app.js */
(function(){
  'use strict';

  var app = document.getElementById('app');
  var W = 1456, H = 2048;

  var cfg = window.JIFU_SUPABASE || window.JIFU_SUPABASE_CONFIG || {};
  if (cfg.SUPABASE_URL && !cfg.url) cfg.url = cfg.SUPABASE_URL;
  if (cfg.SUPABASE_ANON_KEY && !cfg.anonKey) cfg.anonKey = cfg.SUPABASE_ANON_KEY;
  if (cfg.STORAGE_BUCKET && !cfg.storageBucket) cfg.storageBucket = cfg.STORAGE_BUCKET;

  var sb = null;
  var user = null;
  var view = 'front';

  var dms = [];
  var contacts = [];
  var logs = [];

  var selectedDm = '';
  var selectedContact = '';
  var pendingFiles = [];

  var settings = normalizeSettings(defaultSettings());

  function defaultSettings(){
    return {
      x: 950,
      y: 58,
      w: 452,
      h: 142,

      labelSize: 22,
      nameSize: 32,
      titleSize: 18,
      phoneSize: 28,
      companySize: 18,

      nameGap: 8,
      subGap: 8,
      paddingX: 20,
      paddingY: 16,

      fontFamily: 'Microsoft JhengHei',
      fontWeight: 'bold',
      color: '#000000',
      bgEnabled: false,

      photoX:1284,photoY:72,photoSize:132,qrX:1152,qrY:76,qrSize:106
    };
  }

  
  function normalizeSettings(input){
    var s=Object.assign(defaultSettings(),input||{});

    // 新版右上聯絡框固定配置：
    // 左：文字資訊；中：QR；右：形象照。
    s.photoX=1284;
    s.photoY=72;
    s.photoSize=132;
    s.qrX=1152;
    s.qrY=76;
    s.qrSize=106;

    return s;
  }

  function bucket(){
    return cfg.storageBucket || cfg.bucket || 'dm-assets';
  }

  function escapeHtml(v){
    return String(v || '').replace(/[&<>"']/g, function(m){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];
    });
  }

  function escapeAttr(v){
    return escapeHtml(v).replace(/`/g, '&#96;');
  }

  function notice(msg){
    var el = document.getElementById('notice');
    if (el) el.textContent = msg || '';
  }

  function safeName(name, prefix){
    var ext = (String(name || '').match(/\.[a-zA-Z0-9]+$/) || ['.jpg'])[0].toLowerCase();
    return Date.now() + '_' + Math.random().toString(36).slice(2) + '_' + (prefix || 'file') + ext;
  }

  function isUnsafeFileName(name){
    return /[\u4e00-\u9fff\s'"\\/]/.test(String(name || ''));
  }

  window.addEventListener('error', function(e){
    console.error(e.error || e.message);
  });

  window.addEventListener('unhandledrejection', function(e){
    console.error(e.reason);
    notice('發生錯誤：' + ((e.reason && e.reason.message) || e.reason || '未知錯誤'));
  });

  function init(){
    if (!app) return;

    if (!cfg.url || !cfg.anonKey || !window.supabase) {
      app.innerHTML =
        '<div class="fatal-panel">' +
        '<h2>Supabase 尚未設定完成</h2>' +
        '<p>請檢查 config.js 是否有 url 與 anonKey，且金鑰必須完整在同一行。</p>' +
        '</div>';
      return;
    }

    sb = window.supabase.createClient(cfg.url, cfg.anonKey);

    sb.auth.getSession().then(function(res){
      user = (res.data.session && res.data.session.user) || null;
      return loadAll();
    });

    sb.auth.onAuthStateChange(function(evt, session){
      user = (session && session.user) || null;
      loadAll();
    });
  }

  async function loadAll(){
    renderShell();

    try {
      var dmRes = await sb.from('dm_items').select('*').eq('is_active', true).order('created_at', {ascending:false});
      if (dmRes.error) throw dmRes.error;
      dms = dmRes.data || [];
      if (!selectedDm && dms[0]) selectedDm = dms[0].id;

      var cRes = await sb.from('contacts').select('*').eq('is_active', true).order('created_at', {ascending:false});
      if (cRes.error) throw cRes.error;
      contacts = cRes.data || [];
      if (!selectedContact && contacts[0]) selectedContact = contacts[0].id;

      var sRes = await sb.from('app_settings').select('*').eq('key', 'contact_box').maybeSingle();
      if (!sRes.error && sRes.data && sRes.data.value) {
        settings =normalizeSettings(sRes.data.value);
      }

      if (user) {
        var lRes = await sb.from('access_logs').select('*').order('created_at', {ascending:false}).limit(60);
        if (!lRes.error) logs = lRes.data || [];
      }

      render();
      setTimeout(renderCanvas, 60);
      notice('已連線雲端資料庫。');
    } catch (err) {
      console.error(err);
      notice('資料讀取失敗：' + (err.message || err));
      render();
    }
  }

  function renderShell(){
    app.innerHTML =
      '<header class="topbar">' +
        '<div class="brand">' +
          '<small>JIFU CLOUD DM SYSTEM</small>' +
          '<h1>吉富 DM 套版系統</h1>' +
          '<p>前台選業務自動套聯絡資訊，後台管理 DM、通訊錄、形象照與 QR Code</p>' +
        '</div>' +
        '<nav class="tabs">' +
          tab('front','前台下載') +
          tab('admin','後台管理') +
          tab('contacts','通訊錄') +
          tab('settings','欄位設定') +
          tab('logs','紀錄') +
        '</nav>' +
      '</header>' +
      '<div id="notice" class="notice">正在連線雲端資料庫...</div>' +
      '<main id="main" class="wrap"></main>';

    document.querySelectorAll('.tab').forEach(function(btn){
      btn.onclick = function(){
        view = btn.dataset.view;
        render();
        if (view === 'front') setTimeout(renderCanvas, 60);
      };
    });
  }

  function tab(id, label){
    return '<button class="tab ' + (view === id ? 'active' : '') + '" data-view="' + id + '">' + label + '</button>';
  }

  function render(){
    var main = document.getElementById('main');
    if (!main) return;

    if (view === 'front') main.innerHTML = frontHtml();
    if (view === 'admin') main.innerHTML = adminHtml();
    if (view === 'contacts') main.innerHTML = contactsHtml();
    if (view === 'settings') main.innerHTML = settingsHtml();
    if (view === 'logs') main.innerHTML = logsHtml();

    bindPage();
  }

  function frontHtml(){
    var contact = getSelectedContact();

    return (
      '<div class="grid front-grid">' +
        '<aside>' +
          '<section class="card control-card">' +
            '<h2>前台下載</h2>' +
            '<div class="field">' +
              '<label>選擇 DM</label>' +
              '<select id="dmSelect">' + options(dms, selectedDm, 'name', '請選擇 DM') + '</select>' +
            '</div>' +
            '<div class="field">' +
              '<label>選擇業務聯絡資訊</label>' +
              '<select id="contactSelect">' + contactOptions() + '</select>' +
              '<small>資料來自雲端通訊錄；形象照與 QR Code 由後台管理。</small>' +
            '</div>' +
            contactMiniCard(contact) +
            '<button id="renderBtn" class="btn primary full">更新預覽</button>' +
            '<button id="downloadBtn" class="btn gold full">下載 DM 圖片</button>' +
          '</section>' +
          '<section class="card">' +
            '<h2>使用說明</h2>' +
            '<p class="muted">業務只要選擇 DM 與自己的姓名，即可自動帶入聯絡資訊、形象照與 QR Code，並下載完整 DM。</p>' +
          '</section>' +
        '</aside>' +
        '<section>' +
          '<section class="card">' +
            '<div class="section-head">' +
              '<h2>即時預覽</h2>' +
              '<span class="pill">' + escapeHtml((dms.find(function(x){return x.id===selectedDm;}) || {}).name || '尚未選擇 DM') + '</span>' +
            '</div>' +
            '<div class="canvas-wrap"><canvas id="dmCanvas" class="dm-canvas"></canvas></div>' +
          '</section>' +
          '<section class="card">' +
            '<h2>可選 DM</h2>' +
            '<div class="dm-grid">' + dmCards(false) + '</div>' +
          '</section>' +
        '</section>' +
      '</div>'
    );
  }

  function adminHtml(){
    return (
      '<div class="grid admin-grid">' +
        '<aside>' +
          '<section class="card">' +
            '<h2>後台登入</h2>' +
            '<p class="muted">' + (user ? '已登入：' + escapeHtml(user.email) : '尚未登入。前台可用，後台管理需登入。') + '</p>' +
            '<div class="field"><label>管理員 Email</label><input id="loginEmail" value="' + escapeAttr((user && user.email) || '') + '"></div>' +
            '<div class="field"><label>密碼</label><input id="loginPassword" type="password"></div>' +
            '<button id="loginBtn" class="btn primary full">登入後台</button>' +
            '<button id="logoutBtn" class="btn line full">登出</button>' +
          '</section>' +
          '<section class="card ' + (!user ? 'hidden' : '') + '">' +
            '<h2>上傳已排版 DM</h2>' +
            '<label class="upload">一次上傳多張 DM<input id="dmUpload" type="file" accept="image/*" multiple></label>' +
            '<div id="pendingInfo" class="muted">尚未選擇檔案</div>' +
            '<button id="uploadBtn" class="btn gold full">上傳並發布</button>' +
            '<div class="table-note">請使用英文檔名，例如 A26-5_DM01.jpg。不要用中文、空格、單引號。</div>' +
          '</section>' +
        '</aside>' +
        '<section>' +
          '<section class="card">' +
            '<div class="section-head"><h2>DM 管理</h2><span class="pill">' + dms.length + ' 張上架 DM</span></div>' +
            '<div class="dm-grid">' + dmCards(true) + '</div>' +
          '</section>' +
        '</section>' +
      '</div>'
    );
  }

  function contactsHtml(){
    return (
      '<section class="card">' +
        '<div class="section-head">' +
          '<div>' +
            '<h2>通訊錄管理</h2>' +
            '<p class="muted">前台會讀取這裡的業務資料。每位業務的形象照與 QR Code 請在這裡上傳，前台選姓名後會自動帶出。</p>' +
          '</div>' +
          '<span class="pill">' + contacts.length + ' 位聯絡人</span>' +
        '</div>' +
        '<div class="' + (!user ? 'hidden' : '') + '">' +
          '<div class="row4">' +
            '<div class="field"><label>姓名</label><input id="cName"></div>' +
            '<div class="field"><label>職稱</label><input id="cTitle"></div>' +
            '<div class="field"><label>電話</label><input id="cPhone"></div>' +
            '<div class="field"><label>公司 / 團隊</label><input id="cCompany"></div>' +
          '</div>' +
          '<div class="field"><label>地址</label><input id="cAddress"></div>' +
          '<button id="addContactBtn" class="btn primary">新增聯絡人</button>' +
        '</div>' +
        '<div class="table-note">CSV 匯入欄位請用：name,title,phone,company,address。照片與 QR 後續在這裡逐一上傳。</div>' +
        '<div class="contact-grid">' + contactCards() + '</div>' +
      '</section>'
    );
  }

  function settingsHtml(){
    return (
      '<section class="card">' +
        '<h2>右上角聯絡資訊欄位設定</h2>' +
        '<p class="muted">設定只控制右上角白色聯絡框，不會影響物件區。</p>' +

        '<div class="row4">' +
          '<div class="field"><label>「聯絡資訊」字級</label><input id="labelSize" type="number" value="' + settings.labelSize + '"></div>' +
          '<div class="field"><label>姓名字級</label><input id="nameSize" type="number" value="' + settings.nameSize + '"></div>' +
          '<div class="field"><label>職稱字級</label><input id="titleSize" type="number" value="' + settings.titleSize + '"></div>' +
          '<div class="field"><label>電話字級</label><input id="phoneSize" type="number" value="' + settings.phoneSize + '"></div>' +
        '</div>' +

        '<div class="row4">' +
          '<div class="field"><label>公司/團隊字級</label><input id="companySize" type="number" value="' + settings.companySize + '"></div>' +
          '<div class="field"><label>姓名與電話間距</label><input id="nameGap" type="number" value="' + settings.nameGap + '"></div>' +
          '<div class="field"><label>電話與團隊間距</label><input id="subGap" type="number" value="' + settings.subGap + '"></div>' +
          '<div class="field"><label>上下內距</label><input id="paddingY" type="number" value="' + settings.paddingY + '"></div>' +
        '</div>' +

        '<div class="row4">' +
          '<div class="field"><label>左右內距</label><input id="paddingX" type="number" value="' + settings.paddingX + '"></div>' +
          '<div class="field"><label>形象照 X</label><input id="photoX" type="number" value="' + settings.photoX + '"></div>' +
          '<div class="field"><label>形象照 Y</label><input id="photoY" type="number" value="' + settings.photoY + '"></div>' +
          '<div class="field"><label>形象照大小</label><input id="photoSize" type="number" value="' + settings.photoSize + '"></div>' +
        '</div>' +

        '<div class="row4">' +
          '<div class="field"><label>QR X</label><input id="qrX" type="number" value="' + settings.qrX + '"></div>' +
          '<div class="field"><label>QR Y</label><input id="qrY" type="number" value="' + settings.qrY + '"></div>' +
          '<div class="field"><label>QR 大小</label><input id="qrSize" type="number" value="' + settings.qrSize + '"></div>' +
          '<div class="field"><label>文字顏色</label><input id="fontColor" type="color" value="' + settings.color + '"></div>' +
        '</div>' +

        '<div class="row">' +
          '<div class="field"><label>字型</label><select id="fontFamily"><option>Microsoft JhengHei</option><option>PMingLiU</option><option>MingLiU</option><option>DFKai-SB</option><option>Arial</option><option>Tahoma</option></select></div>' +
          '<div class="field"><label>文字粗細</label><select id="fontWeight"><option value="normal">一般</option><option value="600">SemiBold</option><option value="bold">粗體</option><option value="900">超粗</option></select></div>' +
          '<div class="field"><label>聯絡區背景</label><select id="bgEnabled"><option value="false">不要底色，使用公版白色框</option><option value="true">加半透明底色</option></select></div>' +
        '</div>' +

        '<button id="saveSettingsBtn" class="btn primary ' + (!user ? 'hidden' : '') + '">儲存設定到雲端</button>' +
        '<p class="admin-only-note ' + (user ? 'hidden' : '') + '">請先登入後台，才能儲存欄位設定。</p>' +
      '</section>'
    );
  }

  function logsHtml(){
    if (!user) return '<section class="card"><h2>紀錄</h2><p class="muted">請先登入後台。</p></section>';
    return '<section class="card"><h2>操作紀錄</h2><div class="log-list">' + (logs.length ? logs.map(function(l){
      return '<div class="log-item"><strong>' + escapeHtml(l.action || '') + '</strong><span>' + escapeHtml(l.detail || '') + '</span><small>' + escapeHtml(l.created_at || '') + '</small></div>';
    }).join('') : '<div class="empty">尚無紀錄</div>') + '</div></section>';
  }

  function bindPage(){
    var el;

    if ((el = document.getElementById('dmSelect'))) {
      el.onchange = function(){ selectedDm = this.value; render(); setTimeout(renderCanvas, 60); };
    }

    if ((el = document.getElementById('contactSelect'))) {
      el.onchange = function(){ selectedContact = this.value; render(); setTimeout(renderCanvas, 60); };
    }

    if ((el = document.getElementById('renderBtn'))) el.onclick = renderCanvas;
    if ((el = document.getElementById('downloadBtn'))) el.onclick = downloadCanvas;

    if ((el = document.getElementById('loginBtn'))) el.onclick = login;
    if ((el = document.getElementById('logoutBtn'))) el.onclick = logout;

    if ((el = document.getElementById('dmUpload'))) {
      el.onchange = function(e){
        pendingFiles = Array.prototype.slice.call(e.target.files || []);
        var info = document.getElementById('pendingInfo');
        if (info) info.textContent = '已選擇 ' + pendingFiles.length + ' 張 DM';
      };
    }

    if ((el = document.getElementById('uploadBtn'))) el.onclick = uploadDms;
    if ((el = document.getElementById('addContactBtn'))) el.onclick = addContact;
    if ((el = document.getElementById('saveSettingsBtn'))) el.onclick = saveSettings;

    document.querySelectorAll('[data-select-dm]').forEach(function(card){
      card.onclick = function(){ selectedDm = card.dataset.selectDm; view = 'front'; render(); setTimeout(renderCanvas, 60); };
    });

    document.querySelectorAll('[data-delete-dm]').forEach(function(btn){
      btn.onclick = deleteDm;
    });

    document.querySelectorAll('[data-delete-contact]').forEach(function(btn){
      btn.onclick = deleteContact;
    });

    document.querySelectorAll('[data-photo-contact]').forEach(function(input){
      input.onchange = function(e){ uploadContactAsset(e, input.dataset.photoContact, 'photo'); };
    });

    document.querySelectorAll('[data-qr-contact]').forEach(function(input){
      input.onchange = function(e){ uploadContactAsset(e, input.dataset.qrContact, 'qr'); };
    });

    document.querySelectorAll('[data-select-contact]').forEach(function(btn){
      btn.onclick = function(){
        selectedContact = btn.dataset.selectContact;
        view = 'front';
        render();
        setTimeout(renderCanvas, 60);
      };
    });

    var ff = document.getElementById('fontFamily'); if (ff) ff.value = settings.fontFamily;
    var fw = document.getElementById('fontWeight'); if (fw) fw.value = settings.fontWeight;
    var bg = document.getElementById('bgEnabled'); if (bg) bg.value = String(!!settings.bgEnabled);
  }

  function options(list, selected, labelKey, emptyText){
    var html = '<option value="">' + escapeHtml(emptyText || '請選擇') + '</option>';
    return html + list.map(function(item){
      return '<option value="' + item.id + '"' + (item.id === selected ? ' selected' : '') + '>' + escapeHtml(item[labelKey] || '未命名') + '</option>';
    }).join('');
  }

  function contactOptions(){
    var html = '<option value="">請選擇聯絡人</option>';
    return html + contacts.map(function(c){
      return '<option value="' + c.id + '"' + (c.id === selectedContact ? ' selected' : '') + '>' +
        escapeHtml((c.name || '未命名') + (c.title ? '｜' + c.title : '') + (c.phone ? '｜' + c.phone : '')) +
      '</option>';
    }).join('');
  }

  function getSelectedContact(){
    return contacts.find(function(x){ return x.id === selectedContact; }) || null;
  }

  function contactMiniCard(c){
    if (!c) return '<div class="mini-contact empty">請先選擇業務聯絡人</div>';

    return (
      '<div class="mini-contact">' +
        '<div>' +
          '<strong>' + escapeHtml(c.name || '未命名') + '</strong>' +
          '<span>' + escapeHtml(c.title || '') + '</span>' +
          '<p>' + escapeHtml(c.phone || '') + '<br>' + escapeHtml(c.company || '') + '</p>' +
        '</div>' +
        '<div class="mini-assets">' +
          (c.photo_url ? '<img src="' + escapeAttr(c.photo_url) + '" alt="形象照">' : '<span>無形象照</span>') +
          (c.qr_url ? '<img src="' + escapeAttr(c.qr_url) + '" alt="QR Code">' : '<span>無 QR</span>') +
        '</div>' +
      '</div>'
    );
  }

  function dmCards(adminMode){
    if (!dms.length) return '<div class="empty">尚無 DM</div>';

    return dms.map(function(dm){
      return (
        '<article class="dm-card" data-select-dm="' + dm.id + '">' +
          '<img src="' + escapeAttr(dm.image_url) + '" alt="' + escapeAttr(dm.name || '') + '">' +
          '<div><strong>' + escapeHtml(dm.name || '未命名 DM') + '</strong><small>' + escapeHtml(dm.category || '已排版 DM') + '</small></div>' +
          (adminMode && user ? '<button class="btn danger small" data-delete-dm="' + dm.id + '">下架</button>' : '') +
        '</article>'
      );
    }).join('');
  }

  function contactCards(){
    if (!contacts.length) return '<div class="empty">尚無通訊錄</div>';

    return contacts.map(function(c){
      var hasPhoto = !!c.photo_url;
      var hasQr = !!c.qr_url;

      return (
        '<article class="contact-card ' + (c.id === selectedContact ? 'active' : '') + '">' +
          '<div class="contact-info">' +
            '<h3>' + escapeHtml(c.name || '未命名') + '<span>' + escapeHtml(c.title || '') + '</span></h3>' +
            '<p>' + escapeHtml(c.phone || '') + '<br>' + escapeHtml(c.company || '') + (c.address ? '<br>' + escapeHtml(c.address) : '') + '</p>' +
            '<div class="contact-actions">' +
              '<button class="btn line small" data-select-contact="' + c.id + '">前台預覽</button>' +
              (user ? '<button class="btn danger small" data-delete-contact="' + c.id + '">刪除</button>' : '') +
            '</div>' +
          '</div>' +
          '<div class="asset-panel">' +
            '<div class="asset-preview">' + (hasPhoto ? '<img src="' + escapeAttr(c.photo_url) + '" alt="形象照">' : '<span>尚無形象照</span>') + '</div>' +
            '<div class="asset-preview qr-preview">' + (hasQr ? '<img src="' + escapeAttr(c.qr_url) + '" alt="QR Code">' : '<span>尚無 QR</span>') + '</div>' +
            (user ?
              '<label class="mini-upload">上傳形象照<input data-photo-contact="' + c.id + '" type="file" accept="image/*"></label>' +
              '<label class="mini-upload">上傳 QR Code<input data-qr-contact="' + c.id + '" type="file" accept="image/*"></label>'
              : ''
            ) +
          '</div>' +
        '</article>'
      );
    }).join('');
  }

  async function login(){
    var email = document.getElementById('loginEmail').value.trim();
    var pw = document.getElementById('loginPassword').value;

    var res = await sb.auth.signInWithPassword({email: email, password: pw});
    if (res.error) notice('登入失敗：' + res.error.message);
    else {
      user = res.data.user;
      notice('登入成功');
      loadAll();
    }
  }

  async function logout(){
    await sb.auth.signOut();
    user = null;
    notice('已登出');
    loadAll();
  }

  async function addLog(action, detail){
    try {
      await sb.from('access_logs').insert({action: action, detail: detail || ''});
    } catch(e) {}
  }

  async function uploadDms(){
    if (!user) return notice('請先登入後台。');
    if (!pendingFiles.length) return notice('請先選擇 DM 圖檔。');

    for (var i=0; i<pendingFiles.length; i++) {
      var file = pendingFiles[i];

      if (isUnsafeFileName(file.name)) {
        notice('檔名含中文、空格或特殊符號，請改成英文檔名再上傳：' + file.name);
        return;
      }

      var path = 'dm/' + safeName(file.name, 'dm');
      var up = await sb.storage.from(bucket()).upload(path, file, {upsert:true, contentType:file.type || 'image/jpeg'});

      if (up.error) {
        notice('上傳失敗：' + up.error.message);
        return;
      }

      var url = sb.storage.from(bucket()).getPublicUrl(path).data.publicUrl;
      var ins = await sb.from('dm_items').insert({
        name: file.name.replace(/\.[^.]+$/, ''),
        category: '已排版DM',
        image_url: url,
        is_active: true
      });

      if (ins.error) {
        notice('DM 資料寫入失敗：' + ins.error.message);
        return;
      }
    }

    await addLog('上傳並發布DM', String(pendingFiles.length) + ' 張');
    pendingFiles = [];
    notice('DM 已上傳並發布。');
    loadAll();
  }

  async function uploadContactAsset(e, contactId, kind){
    if (!user) return notice('請先登入後台。');

    var file = (e.target.files || [])[0];
    if (!file) return;

    if (isUnsafeFileName(file.name)) {
      notice('檔名含中文、空格或特殊符號，請改成英文檔名再上傳：' + file.name);
      e.target.value = '';
      return;
    }

    var folder = kind === 'qr' ? 'qr' : 'photo';
    var path = 'contacts/' + folder + '/' + contactId + '/' + safeName(file.name, folder);

    var up = await sb.storage.from(bucket()).upload(path, file, {upsert:true, contentType:file.type || 'image/jpeg'});
    if (up.error) {
      notice('上傳失敗：' + up.error.message);
      return;
    }

    var url = sb.storage.from(bucket()).getPublicUrl(path).data.publicUrl;
    var field = kind === 'qr' ? 'qr_url' : 'photo_url';
    var payload = {};
    payload[field] = url;

    var res = await sb.from('contacts').update(payload).eq('id', contactId);
    if (res.error) {
      notice('通訊錄圖片更新失敗：' + res.error.message);
      return;
    }

    await addLog(kind === 'qr' ? '更新業務QR' : '更新業務形象照', contactId);
    notice(kind === 'qr' ? 'QR Code 已更新。' : '形象照已更新。');
    loadAll();
  }

  async function deleteDm(e){
    e.stopPropagation();
    if (!confirm('確定要下架這張 DM？')) return;

    await sb.from('dm_items').update({is_active:false}).eq('id', e.target.dataset.deleteDm);
    await addLog('下架DM', e.target.dataset.deleteDm);
    loadAll();
  }

  async function addContact(){
    if (!user) return notice('請先登入後台。');

    var row = {
      name: val('cName') || '未命名',
      title: val('cTitle'),
      phone: val('cPhone'),
      company: val('cCompany'),
      address: val('cAddress'),
      is_active: true
    };

    var res = await sb.from('contacts').insert(row);
    if (res.error) return notice('新增失敗：' + res.error.message);

    await addLog('新增聯絡人', row.name);
    notice('已新增聯絡人。');
    loadAll();
  }

  async function deleteContact(e){
    if (!confirm('確定刪除這位聯絡人？')) return;

    await sb.from('contacts').update({is_active:false}).eq('id', e.target.dataset.deleteContact);
    await addLog('刪除聯絡人', e.target.dataset.deleteContact);
    loadAll();
  }

  function val(id){
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  async function saveSettings(){
    if (!user) return notice('請先登入後台。');

    var next = Object.assign({}, settings, {
      labelSize: Number(val('labelSize')) || settings.labelSize,
      nameSize: Number(val('nameSize')) || settings.nameSize,
      titleSize: Number(val('titleSize')) || settings.titleSize,
      phoneSize: Number(val('phoneSize')) || settings.phoneSize,
      companySize: Number(val('companySize')) || settings.companySize,

      nameGap: Number(val('nameGap')) || 0,
      subGap: Number(val('subGap')) || 0,
      paddingX: Number(val('paddingX')) || 0,
      paddingY: Number(val('paddingY')) || 0,

      photoX: Number(val('photoX')) || settings.photoX,
      photoY: Number(val('photoY')) || settings.photoY,
      photoSize: Number(val('photoSize')) || settings.photoSize,

      qrX: Number(val('qrX')) || settings.qrX,
      qrY: Number(val('qrY')) || settings.qrY,
      qrSize: Number(val('qrSize')) || settings.qrSize,

      fontFamily: val('fontFamily') || settings.fontFamily,
      fontWeight: val('fontWeight') || settings.fontWeight,
      color: val('fontColor') || settings.color,
      bgEnabled: val('bgEnabled') === 'true'
    });

    var res = await sb.from('app_settings').upsert({key:'contact_box', value: next}, {onConflict:'key'});
    if (res.error) return notice('設定儲存失敗：' + res.error.message);

    settings = next;
    await addLog('更新欄位設定', 'contact_box');
    notice('設定已儲存。');
    render();
    setTimeout(renderCanvas, 60);
  }

  function readFile(file){
    return new Promise(function(resolve, reject){
      var reader = new FileReader();
      reader.onload = function(){ resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function loadImage(src){
    return new Promise(function(resolve){
      if (!src) return resolve(null);
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function(){ resolve(img); };
      img.onerror = function(){ resolve(null); };
      img.src = src;
    });
  }

  async function renderCanvas(){
    var canvas = document.getElementById('dmCanvas');
    if (!canvas) return;

    var ctx = canvas.getContext('2d');
    canvas.width = W;
    canvas.height = H;

    ctx.fillStyle = '#f4f1eb';
    ctx.fillRect(0, 0, W, H);

    var dm = dms.find(function(x){ return x.id === selectedDm; });

    if (dm) {
      var img = await loadImage(dm.image_url);
      if (img) ctx.drawImage(img, 0, 0, W, H);
    } else {
      ctx.fillStyle = '#666';
      ctx.font = '36px Arial';
      ctx.fillText('請先選擇 DM', 570, 930);
    }

    await drawContact(ctx);
  }

  async function drawContact(ctx){
    var c = getSelectedContact() || {};
    var b = normalizeSettings(settings);

    // 只套資料，不重畫模板上的「專業請找」、icon、底線、背景。
    var boxX = b.x || 950;
    var boxY = b.y || 58;
    var boxW = b.w || 452;

    var family = b.fontFamily || 'Microsoft JhengHei';
    var weight = b.fontWeight || 'bold';
    var color = b.color || '#111';
    ctx.fillStyle = color;
    ctx.textBaseline = 'alphabetic';

    // 依目前模板線條微調：文字放在線上方，不壓線。
    var nameX = boxX + 96;
    var titleX = boxX + 255;
    var phoneX = boxX + 96;
    var companyX = boxX + 96;

    var nameY = boxY + 82;
    var phoneY = boxY + 128;
    var companyY = boxY + 176;

    ctx.font = weight + ' 28px "' + family + '", Arial';
    fitText(ctx, c.name || '', nameX, nameY, 150, 32);

    ctx.font = weight + ' 22px "' + family + '", Arial';
    fitText(ctx, c.title || '', titleX, nameY, 120, 26);

    ctx.font = weight + ' 31px "' + family + '", Arial';
    fitText(ctx, c.phone || '', phoneX, phoneY, 280, 35);

    ctx.font = weight + ' 29px "' + family + '", Arial';
    fitText(ctx, c.company || '吉富工商', companyX, companyY, 280, 33);

    var photo = await loadImage(c.photo_url || c.avatar_url || '');
    var qr = await loadImage(c.qr_url || c.qr_code_url || '');

    // 圖片只貼到模板預留位置，不影響文字。
    var qrSize = 106;
    var photoW = 130;
    var photoH = 132;
    var rightPad = 18;
    var gap = 14;
    var assetY = boxY + 24;
    var photoX = boxX + boxW - rightPad - photoW;
    var qrX = photoX - gap - qrSize;

    if (photo && qr) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(qrX - 4, assetY + 6 - 4, qrSize + 8, qrSize + 8);
      drawSquareContain(ctx, qr, qrX, assetY + 6, qrSize, qrSize);

      ctx.save();
      roundRect(ctx, photoX, assetY, photoW, photoH, 4);
      ctx.clip();
      drawPortraitCrop(ctx, photo, photoX, assetY, photoW, photoH);
      ctx.restore();
    } else if (photo) {
      ctx.save();
      roundRect(ctx, photoX, assetY, photoW, photoH, 4);
      ctx.clip();
      drawPortraitCrop(ctx, photo, photoX, assetY, photoW, photoH);
      ctx.restore();
    } else if (qr) {
      var singleQrX = boxX + boxW - rightPad - qrSize;
      ctx.fillStyle = '#fff';
      ctx.fillRect(singleQrX - 4, assetY + 6 - 4, qrSize + 8, qrSize + 8);
      drawSquareContain(ctx, qr, singleQrX, assetY + 6, qrSize, qrSize);
    }
  }

function fitText(ctx, text, x, y, maxW, lineHeight){
    text = String(text || '');
    if (!text) return;

    if (ctx.measureText(text).width <= maxW) {
      ctx.fillText(text, x, y);
      return;
    }

    var out = '';
    for (var i=0; i<text.length; i++) {
      var next = out + text[i];
      if (ctx.measureText(next + '…').width > maxW) break;
      out = next;
    }
    ctx.fillText(out + '…', x, y);
  }

  function drawPortraitCrop(ctx,img,x,y,w,h){
    var iw=img.width, ih=img.height;
    var scale=Math.max(w/iw,h/ih);
    var sw=w/scale;
    var sh=h/scale;
    var sx=(iw-sw)/2;
    var sy=Math.max(0,Math.min(ih-sh,ih*0.08));
    ctx.drawImage(img,sx,sy,sw,sh,x,y,w,h);
  }

function drawSquareContain(ctx, img, x, y, w, h){
    var size = Math.min(img.width, img.height);
    var sx = (img.width - size) / 2;
    var sy = (img.height - size) / 2;
    ctx.drawImage(img, sx, sy, size, size, x, y, w, h);
  }

  function roundRect(ctx, x, y, w, h, r){
    r = Math.max(0, r || 0);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function downloadCanvas(){
    var canvas = document.getElementById('dmCanvas');
    if (!canvas) return notice('尚無預覽可下載。');

    var dm = dms.find(function(x){ return x.id === selectedDm; }) || {};
    var a = document.createElement('a');
    a.download = (dm.name || 'jifu-dm') + '.png';
    a.href = canvas.toDataURL('image/png');
    a.click();

    addLog('下載DM', dm.name || selectedDm || '');
  }

  init();
})();