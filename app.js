(function () {
  "use strict";

  var STORE_KEY = "jifuDmSystemStateV2";
  var DB_NAME = "jifu-dm-system";
  var DB_STORE = "kv";
  var MAX_FONT_PT = 50;
  var MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
  var app = document.getElementById("app");
  var fatal = document.getElementById("fatal");
  var fatalMessage = document.getElementById("fatalMessage");
  var state = null;
  var currentView = "front";
  var selectedTemplateId = "";
  var selectedRecordId = "";
  var selectedFieldId = "";
  var saveTimer = 0;
  var toastTimer = 0;
  var stageObserver = null;
  var dragState = null;

  var coreTextFields = ["name", "phone", "title", "address", "company", "line", "qrLabel"];
  var labelMap = {
    name: "姓名",
    phone: "電話",
    title: "職稱",
    address: "地址",
    company: "公司名稱",
    line: "LINE ID",
    qrLabel: "QR Code 標籤",
    photo: "個人形象照",
    qr: "QR Code",
    logo: "LOGO",
  };

  window.addEventListener("error", function (event) {
    showFatal(event.error || event.message);
  });

  window.addEventListener("unhandledrejection", function (event) {
    showFatal(event.reason || "非同步資料處理失敗");
  });

  window.dmSystemExportBackup = function () {
    if (!state) return;
    downloadText("jifu-dm-system-backup.json", JSON.stringify(state, null, 2));
  };

  window.dmSystemResetLocal = async function () {
    if (!confirm("確定要清除這台裝置上的模板、紀錄與草稿嗎？")) return;
    await storage.clear();
    state = migrateState(createDefaultState());
    selectedTemplateId = state.templates[0].id;
    selectedRecordId = "";
    selectedFieldId = "name";
    await storage.save(state);
    safeRender();
  };

  async function init() {
    try {
      var loaded = await storage.load();
      state = migrateState(loaded);
      selectedTemplateId = state.templates[0] ? state.templates[0].id : "";
      selectedFieldId = firstEditableField(selectedTemplate()) || "";
      await storage.save(state);
      bindEvents();
      safeRender();
    } catch (error) {
      showFatal(error);
    }
  }

  var storage = {
    load: async function () {
      try {
        var db = await openDb();
        var fromDb = await idbGet(db, STORE_KEY);
        if (fromDb) return fromDb;
      } catch (error) {
        console.warn("IndexedDB unavailable, using localStorage.", error);
      }

      try {
        var raw = localStorage.getItem(STORE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (error) {
        console.warn("localStorage data could not be parsed.", error);
        return null;
      }
    },
    save: async function (data) {
      try {
        var db = await openDb();
        await idbSet(db, STORE_KEY, data);
      } catch (error) {
        console.warn("IndexedDB save failed.", error);
      }

      try {
        var backup = JSON.stringify(data);
        if (backup.length < 4500000) localStorage.setItem(STORE_KEY, backup);
      } catch (error) {
        console.warn("localStorage backup skipped.", error);
      }
    },
    clear: async function () {
      try {
        var db = await openDb();
        await idbDelete(db, STORE_KEY);
      } catch (error) {
        console.warn("IndexedDB clear failed.", error);
      }
      try {
        localStorage.removeItem(STORE_KEY);
      } catch (error) {
        console.warn("localStorage clear failed.", error);
      }
    },
  };

  function openDb() {
    return new Promise(function (resolve, reject) {
      if (!("indexedDB" in window)) {
        reject(new Error("IndexedDB not available"));
        return;
      }
      var request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = function () {
        request.result.createObjectStore(DB_STORE);
      };
      request.onsuccess = function () {
        resolve(request.result);
      };
      request.onerror = function () {
        reject(request.error);
      };
    });
  }

  function idbGet(db, key) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(DB_STORE, "readonly");
      var request = tx.objectStore(DB_STORE).get(key);
      request.onsuccess = function () {
        resolve(request.result || null);
      };
      request.onerror = function () {
        reject(request.error);
      };
    });
  }

  function idbSet(db, key, value) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).put(value, key);
      tx.oncomplete = function () {
        resolve();
      };
      tx.onerror = function () {
        reject(tx.error);
      };
    });
  }

  function idbDelete(db, key) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).delete(key);
      tx.oncomplete = function () {
        resolve();
      };
      tx.onerror = function () {
        reject(tx.error);
      };
    });
  }

  function migrateState(input) {
    var base = input && typeof input === "object" ? input : createDefaultState();
    var now = new Date().toISOString();
    base.version = 2;
    base.users = Array.isArray(base.users) && base.users.length ? base.users : [{ id: uid("user"), name: "本機使用者", createdAt: now }];
    base.activeUserId = base.activeUserId && findById(base.users, base.activeUserId) ? base.activeUserId : base.users[0].id;
    base.templates = Array.isArray(base.templates) && base.templates.length ? base.templates.map(normalizeTemplate) : [createDefaultTemplate()];
    base.records = Array.isArray(base.records) ? base.records : [];
    base.drafts = base.drafts && typeof base.drafts === "object" ? base.drafts : {};
    base.settings = Object.assign({ apiEndpoint: "" }, base.settings || {});
    return base;
  }

  function createDefaultState() {
    var now = new Date().toISOString();
    return {
      version: 2,
      users: [{ id: uid("user"), name: "本機使用者", createdAt: now }],
      activeUserId: "",
      templates: [createDefaultTemplate()],
      records: [],
      drafts: {},
      settings: { apiEndpoint: "" },
    };
  }

  function createDefaultTemplate(name, backgroundDataUrl, width, height) {
    var now = new Date().toISOString();
    var canvasWidth = width || 1080;
    var canvasHeight = height || 1350;
    return normalizeTemplate({
      id: uid("tpl"),
      name: name || "預設名片式 DM",
      status: "published",
      createdAt: now,
      updatedAt: now,
      canvas: {
        width: canvasWidth,
        height: canvasHeight,
        background: backgroundDataUrl ? { type: "image", value: backgroundDataUrl } : { type: "builtin", value: "warm" },
      },
      fields: defaultFields(canvasWidth, canvasHeight),
    });
  }

  function defaultFields(width, height) {
    var sx = width / 1080;
    var sy = height / 1350;
    function box(id, type, label, x, y, w, h, options) {
      return Object.assign(
        {
          id: id,
          type: type,
          label: label,
          x: Math.round(x * sx),
          y: Math.round(y * sy),
          width: Math.round(w * sx),
          height: Math.round(h * sy),
          layer: 10,
        },
        options || {}
      );
    }

    return [
      box("logo", "image", "LOGO", 70, 64, 190, 86, { role: "logo", layer: 9 }),
      box("photo", "image", "個人形象照", 72, 216, 340, 510, { role: "portrait", layer: 8 }),
      box("company", "text", "公司名稱", 450, 152, 520, 66, {
        defaultText: "吉富不動產顧問",
        fontSize: 25,
        color: "#17684f",
        fontWeight: "800",
      }),
      box("name", "text", "姓名", 450, 280, 420, 70, {
        defaultText: "王小明",
        fontSize: 38,
        color: "#242321",
        fontWeight: "900",
      }),
      box("title", "text", "職稱", 454, 354, 420, 44, {
        defaultText: "資深專員",
        fontSize: 20,
        color: "#6b665e",
        fontWeight: "700",
      }),
      box("phone", "text", "電話", 454, 438, 470, 48, {
        defaultText: "0900-000-000",
        fontSize: 21,
        color: "#242321",
        fontWeight: "750",
      }),
      box("line", "text", "LINE ID", 454, 504, 470, 48, {
        defaultText: "@jifu",
        fontSize: 20,
        color: "#242321",
        fontWeight: "700",
      }),
      box("address", "text", "地址", 454, 570, 500, 80, {
        defaultText: "台北市信義區示範路 100 號",
        fontSize: 18,
        color: "#4d4944",
        fontWeight: "600",
        lineHeight: 1.22,
      }),
      box("qr", "image", "QR Code", 790, 930, 210, 210, { role: "qr", layer: 11 }),
      box("qrLabel", "text", "QR Code 標籤", 750, 1152, 290, 48, {
        defaultText: "掃碼加入 LINE",
        fontSize: 17,
        color: "#242321",
        fontWeight: "800",
        align: "center",
        layer: 12,
      }),
    ];
  }

  function normalizeTemplate(template) {
    var now = new Date().toISOString();
    var out = Object.assign({}, template);
    out.id = out.id || uid("tpl");
    out.name = out.name || "未命名模板";
    out.status = out.status || "draft";
    out.createdAt = out.createdAt || now;
    out.updatedAt = out.updatedAt || now;
    out.canvas = Object.assign({ width: 1080, height: 1350, background: { type: "builtin", value: "warm" } }, out.canvas || {});
    out.canvas.width = clampNumber(out.canvas.width, 320, 5000, 1080);
    out.canvas.height = clampNumber(out.canvas.height, 320, 5000, 1350);
    out.canvas.background = normalizeBackground(out.canvas.background);
    out.fields = Array.isArray(out.fields) && out.fields.length ? out.fields.map(function (field, index) {
      return normalizeField(field, index);
    }) : defaultFields(out.canvas.width, out.canvas.height);
    return out;
  }

  function normalizeBackground(background) {
    if (!background) return { type: "builtin", value: "warm" };
    if (typeof background === "string") return { type: "image", value: background };
    if (background.type === "image" && background.value) return { type: "image", value: background.value };
    if (background.type === "color" && background.value) return { type: "color", value: background.value };
    return { type: "builtin", value: "warm" };
  }

  function normalizeField(field, index) {
    var id = field.id || uid("field");
    var type = field.type === "image" ? "image" : "text";
    var defaults = {
      id: id,
      type: type,
      label: field.label || labelMap[id] || "自訂欄位",
      x: clampNumber(field.x, 0, 5000, 40),
      y: clampNumber(field.y, 0, 5000, 40),
      width: clampNumber(field.width, 8, 5000, type === "image" ? 180 : 320),
      height: clampNumber(field.height, 8, 5000, type === "image" ? 180 : 50),
      layer: clampNumber(field.layer, 0, 999, 10 + index),
    };
    if (type === "text") {
      defaults.defaultText = field.defaultText || "";
      defaults.fontSize = clampNumber(field.fontSize, 6, MAX_FONT_PT, 18);
      defaults.fontFamily = field.fontFamily || '"Noto Sans TC", "Microsoft JhengHei", sans-serif';
      defaults.color = field.color || "#242321";
      defaults.fontWeight = field.fontWeight || "700";
      defaults.align = field.align || "left";
      defaults.lineHeight = clampNumber(field.lineHeight, 0.8, 2.2, 1.16);
    } else {
      defaults.role = field.role || (id === "qr" ? "qr" : id === "photo" ? "portrait" : id === "logo" ? "logo" : "image");
      defaults.defaultImage = field.defaultImage || "";
    }
    return defaults;
  }

  function bindEvents() {
    app.addEventListener("click", handleClick);
    app.addEventListener("input", handleInput);
    app.addEventListener("change", handleChange);
    app.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("click", function (event) {
      if (event.target.closest('[data-action="close-modal"]')) closeModal();
    });
    window.addEventListener("resize", updateStageScales);
  }

  function safeRender() {
    try {
      render();
    } catch (error) {
      showFatal(error);
    }
  }

  function render() {
    ensureSelection();
    app.innerHTML = [
      renderTopbar(),
      currentView === "front" ? renderFront() : "",
      currentView === "admin" ? renderAdmin() : "",
      currentView === "editor" ? renderEditor() : "",
      currentView === "records" ? renderRecords() : "",
    ].join("");
    afterRender();
  }

  function renderTopbar() {
    var publishedCount = state.templates.filter(function (item) {
      return item.status === "published";
    }).length;
    var user = activeUser();
    return [
      '<header class="topbar">',
      '<div class="brand-block">',
      '<h1 class="brand-title">吉富 DM 套版系統</h1>',
      '<p class="brand-subtitle">前台套版、後台模板管理、拖拉編輯、紀錄保存與圖片下載</p>',
      "</div>",
      '<nav class="view-tabs" aria-label="主要功能">',
      tabButton("front", "前台套版"),
      tabButton("admin", "後台管理"),
      tabButton("editor", "模板編輯"),
      tabButton("records", "紀錄"),
      "</nav>",
      '<div class="status-strip">',
      '<span class="badge">' + escapeHtml(user.name) + "</span>",
      '<span>' + publishedCount + " 個已上架 DM</span>",
      "</div>",
      "</header>",
    ].join("");
  }

  function tabButton(view, label) {
    return '<button type="button" class="tab-button ' + (currentView === view ? "active" : "") + '" data-view="' + view + '">' + label + "</button>";
  }

  function renderFront() {
    var published = publishedTemplates();
    var template = frontTemplate();
    if (!template) {
      return [
        '<main class="layout">',
        '<section class="panel"><div class="panel-header"><h2 class="panel-title">前台套版</h2></div><div class="panel-body">',
        '<div class="empty-state">目前沒有已上架的 DM。請到後台把模板切換為上架。</div>',
        "</div></section>",
        "</main>",
      ].join("");
    }
    var draft = getDraft(state.activeUserId, template.id);
    return [
      '<main class="layout">',
      '<section class="panel stack">',
      '<div class="panel-header"><h2 class="panel-title">前台套版</h2><span class="badge">每位使用者獨立保存</span></div>',
      '<div class="panel-body stack">',
      renderUserSwitcher(),
      '<div class="form-field"><label class="form-label" for="frontTemplate">選擇 DM</label><select id="frontTemplate" class="select" data-change="front-template">',
      published
        .map(function (item) {
          return '<option value="' + item.id + '"' + (item.id === template.id ? " selected" : "") + ">" + escapeHtml(item.name) + "</option>";
        })
        .join(""),
      "</select></div>",
      renderFrontTextFields(template, draft),
      renderFrontImageFields(template, draft),
      '<div class="button-row">',
      '<button type="button" class="button primary" data-action="save-front-record">完成套版並存紀錄</button>',
      '<button type="button" class="button accent" data-action="download-current">下載 DM 圖片</button>',
      "</div>",
      '<p class="help-text">文字大小上限為 50 pt。每個欄位獨立調整，不會影響其他欄位。</p>',
      "</div></section>",
      '<section class="panel preview-shell">',
      '<div class="panel-header"><h2 class="panel-title">即時預覽</h2><span class="badge">' + escapeHtml(template.name) + "</span></div>",
      '<div class="panel-body"><div data-preview-slot="front">' + renderPreviewHTML(template, draft, { mode: "front" }) + "</div></div>",
      "</section>",
      "</main>",
    ].join("");
  }

  function renderUserSwitcher() {
    return [
      '<div class="field-grid">',
      '<div class="form-field">',
      '<label class="form-label" for="activeUser">使用者</label>',
      '<select id="activeUser" class="select" data-change="active-user">',
      state.users
        .map(function (user) {
          return '<option value="' + user.id + '"' + (user.id === state.activeUserId ? " selected" : "") + ">" + escapeHtml(user.name) + "</option>";
        })
        .join(""),
      "</select>",
      "</div>",
      '<div class="button-row">',
      '<input id="newUserName" class="input" type="text" placeholder="新增使用者名稱" maxlength="30" />',
      '<button type="button" class="button" data-action="add-user">新增</button>',
      "</div>",
      "</div>",
    ].join("");
  }

  function renderFrontTextFields(template, draft) {
    var fields = textFields(template);
    return [
      '<section><h3 class="section-title">文字內容與大小</h3><div class="field-grid">',
      fields
        .map(function (field) {
          var value = getDraftText(draft, field);
          var size = getDraftFont(draft, field);
          var control = field.height > 58 || field.id === "address" ? "textarea" : "input";
          return [
            '<div class="form-field">',
            '<label class="form-label" for="text-' + field.id + '">' + escapeHtml(field.label) + '<span class="value-pill" data-value-pill="' + field.id + '">' + size + " pt</span></label>",
            control === "textarea"
              ? '<textarea id="text-' + field.id + '" class="textarea" data-bind="draft-text" data-field-id="' + field.id + '">' + escapeHtml(value) + "</textarea>"
              : '<input id="text-' + field.id + '" class="input" type="text" value="' + escapeAttr(value) + '" data-bind="draft-text" data-field-id="' + field.id + '" />',
            '<div class="range-row">',
            '<input type="range" min="6" max="' + MAX_FONT_PT + '" value="' + size + '" data-bind="draft-font" data-field-id="' + field.id + '" aria-label="' + escapeAttr(field.label) + ' pt" />',
            '<input class="input" type="number" min="6" max="' + MAX_FONT_PT + '" value="' + size + '" data-bind="draft-font" data-field-id="' + field.id + '" />',
            "</div>",
            "</div>",
          ].join("");
        })
        .join(""),
      "</div></section>",
    ].join("");
  }

  function renderFrontImageFields(template, draft) {
    var fields = imageFields(template).filter(function (field) {
      return field.role === "portrait" || field.role === "qr";
    });
    if (!fields.length) return "";
    return [
      '<section><h3 class="section-title">圖片上傳</h3><div class="field-grid">',
      fields
        .map(function (field) {
          var helper =
            field.role === "qr"
              ? "會自動偵測 QR Code 正方形範圍並裁切。"
              : "會等比例縮放；偏高的全身照會優先裁切上半身到腰部附近。";
          return [
            '<div class="file-drop">',
            '<label class="form-label" for="image-' + field.id + '">' + escapeHtml(field.label) + "</label>",
            '<input id="image-' + field.id + '" type="file" accept="image/png,image/jpeg,image/webp" data-change="front-image" data-field-id="' + field.id + '" />',
            '<span class="help-text">' + helper + " 單張圖片建議小於 12MB。</span>",
            draft.images && draft.images[field.id] ? '<button type="button" class="button small" data-action="remove-front-image" data-field-id="' + field.id + '">移除圖片</button>' : "",
            "</div>",
          ].join("");
        })
        .join(""),
      "</div></section>",
    ].join("");
  }

  function renderAdmin() {
    var template = selectedTemplate();
    return [
      '<main class="layout">',
      '<section class="panel">',
      '<div class="panel-header"><h2 class="panel-title">後台管理</h2><span class="badge">靜態部署可用</span></div>',
      '<div class="panel-body stack">',
      renderKpis(),
      renderTemplateImport(),
      renderTemplateList(),
      renderDataTools(),
      "</div></section>",
      '<section class="panel preview-shell">',
      '<div class="panel-header"><h2 class="panel-title">模板設定</h2>' + (template ? '<span class="' + statusClass(template.status) + '">' + statusText(template.status) + "</span>" : "") + "</div>",
      '<div class="panel-body stack">',
      template ? renderAdminTemplateSettings(template) : '<div class="empty-state">尚未建立模板。</div>',
      template ? '<div data-preview-slot="admin">' + renderPreviewHTML(template, emptyDraft(template), { mode: "admin" }) + "</div>" : "",
      "</div></section>",
      "</main>",
    ].join("");
  }

  function renderKpis() {
    var published = state.templates.filter(function (item) {
      return item.status === "published";
    }).length;
    return [
      '<div class="admin-kpis">',
      '<div class="kpi"><strong>' + state.templates.length + "</strong><span>模板總數</span></div>",
      '<div class="kpi"><strong>' + published + "</strong><span>已上架 DM</span></div>",
      '<div class="kpi"><strong>' + state.records.length + "</strong><span>套版紀錄</span></div>",
      "</div>",
    ].join("");
  }

  function renderTemplateImport() {
    return [
      '<section class="stack">',
      '<h3 class="section-title">模板上傳</h3>',
      '<div class="file-drop">',
      '<label class="form-label" for="templatePackage">上傳壓縮包 / template.json / 圖片</label>',
      '<input id="templatePackage" type="file" multiple accept=".zip,.json,image/png,image/jpeg,image/webp" data-change="template-package" />',
      '<span class="help-text">壓縮包可包含 template.json、模板圖片、預覽圖與素材。若未提供 JSON，會用第一張圖片建立空白 DM 模板。</span>',
      "</div>",
      '<div class="file-drop">',
      '<label class="form-label" for="blankTemplateImage">快速建立空白 DM 模板</label>',
      '<input id="blankTemplateImage" type="file" accept="image/png,image/jpeg,image/webp" data-change="blank-template" />',
      "</div>",
      "</section>",
    ].join("");
  }

  function renderTemplateList() {
    return [
      '<section><h3 class="section-title">DM 上架 / 下架</h3><div class="template-list">',
      state.templates
        .map(function (template) {
          return [
            '<article class="list-item ' + (template.id === selectedTemplateId ? "active" : "") + '">',
            '<div class="item-title-row"><h4 class="item-title">' + escapeHtml(template.name) + '</h4><span class="' + statusClass(template.status) + '">' + statusText(template.status) + "</span></div>",
            '<div class="item-meta">更新時間：' + formatDate(template.updatedAt) + "，欄位：" + template.fields.length + "</div>",
            '<div class="button-row">',
            '<button type="button" class="button small" data-action="select-template" data-template-id="' + template.id + '">編輯</button>',
            template.status === "published"
              ? '<button type="button" class="button small" data-action="set-template-status" data-status="draft" data-template-id="' + template.id + '">下架</button>'
              : '<button type="button" class="button small primary" data-action="set-template-status" data-status="published" data-template-id="' + template.id + '">上架</button>',
            '<button type="button" class="button small" data-action="duplicate-template" data-template-id="' + template.id + '">複製</button>',
            template.status === "archived"
              ? '<button type="button" class="button small" data-action="set-template-status" data-status="draft" data-template-id="' + template.id + '">還原</button>'
              : '<button type="button" class="button small danger" data-action="set-template-status" data-status="archived" data-template-id="' + template.id + '">封存</button>',
            "</div>",
            "</article>",
          ].join("");
        })
        .join(""),
      "</div></section>",
    ].join("");
  }

  function renderAdminTemplateSettings(template) {
    return [
      '<div class="form-field">',
      '<label class="form-label" for="templateName">模板名稱</label>',
      '<input id="templateName" class="input" type="text" value="' + escapeAttr(template.name) + '" data-bind="template-name" maxlength="60" />',
      "</div>",
      '<div class="file-drop">',
      '<label class="form-label" for="logoUpload">LOGO 上傳與定位</label>',
      '<input id="logoUpload" type="file" accept="image/png,image/jpeg,image/webp" data-change="logo-upload" />',
      '<span class="help-text">上傳後可到「模板編輯」拖拉 LOGO 位置並調整大小。</span>',
      "</div>",
      '<section><h3 class="section-title">後台文字大小</h3><div class="field-grid">',
      textFields(template)
        .map(function (field) {
          return [
            '<div class="form-field compact">',
            '<label class="form-label">' + escapeHtml(field.label) + ' pt <span class="value-pill" data-admin-pill="' + field.id + '">' + field.fontSize + " pt</span></label>",
            '<div class="range-row">',
            '<input type="range" min="6" max="' + MAX_FONT_PT + '" value="' + field.fontSize + '" data-bind="admin-font" data-field-id="' + field.id + '" />',
            '<input class="input" type="number" min="6" max="' + MAX_FONT_PT + '" value="' + field.fontSize + '" data-bind="admin-font" data-field-id="' + field.id + '" />',
            "</div>",
            "</div>",
          ].join("");
        })
        .join(""),
      "</div></section>",
      '<div class="button-row">',
      '<button type="button" class="button primary" data-action="set-template-status" data-status="published" data-template-id="' + template.id + '">發布 / 上架</button>',
      '<button type="button" class="button" data-action="set-template-status" data-status="draft" data-template-id="' + template.id + '">儲存為草稿 / 下架</button>',
      "</div>",
    ].join("");
  }

  function renderDataTools() {
    return [
      '<section class="stack">',
      '<h3 class="section-title">資料與未來後端設定</h3>',
      '<div class="form-field">',
      '<label class="form-label" for="apiEndpoint">後端 API Endpoint（可留空）</label>',
      '<input id="apiEndpoint" class="input" type="url" placeholder="https://example.com/api/records" value="' + escapeAttr(state.settings.apiEndpoint || "") + '" data-bind="settings-api" />',
      '<span class="help-text">目前以 IndexedDB 儲存在使用者瀏覽器中。若日後串接 Supabase/Firebase/API，可在這裡保留同步端點。</span>',
      "</div>",
      '<div class="button-row">',
      '<button type="button" class="button" data-action="export-backup">匯出資料備份</button>',
      '<label class="button" for="backupImport">匯入備份</label>',
      '<input id="backupImport" class="sr-only" type="file" accept="application/json,.json" data-change="backup-import" />',
      '<button type="button" class="button danger" data-action="reset-data">重置本機資料</button>',
      "</div>",
      "</section>",
    ].join("");
  }

  function renderEditor() {
    var template = selectedTemplate();
    if (!template) {
      return '<main class="panel"><div class="panel-body"><div class="empty-state">尚未建立模板。</div></div></main>';
    }
    var field = selectedField(template);
    return [
      '<main class="layout three">',
      '<section class="panel">',
      '<div class="panel-header"><h2 class="panel-title">欄位清單</h2><button type="button" class="button small" data-action="add-custom-text">新增文字</button></div>',
      '<div class="panel-body stack">',
      '<div class="form-field"><label class="form-label" for="editorTemplate">編輯模板</label><select id="editorTemplate" class="select" data-change="editor-template">',
      state.templates
        .map(function (item) {
          return '<option value="' + item.id + '"' + (item.id === template.id ? " selected" : "") + ">" + escapeHtml(item.name) + "</option>";
        })
        .join(""),
      "</select></div>",
      '<div class="template-list">',
      template.fields
        .map(function (item) {
          return [
            '<button type="button" class="list-item ' + (item.id === selectedFieldId ? "active" : "") + '" data-action="select-field" data-field-id="' + item.id + '">',
            '<span class="item-title-row"><span class="item-title">' + escapeHtml(item.label) + '</span><span class="badge">' + (item.type === "image" ? "圖片" : item.fontSize + " pt") + "</span></span>",
            '<span class="item-meta">X ' + Math.round(item.x) + " / Y " + Math.round(item.y) + " / W " + Math.round(item.width) + " / H " + Math.round(item.height) + "</span>",
            "</button>",
          ].join("");
        })
        .join(""),
      "</div>",
      '<div class="hint-box">在預覽畫面直接拖拉欄位即可移動；拖右下角色塊可調整尺寸。完成後按發布即可顯示於前台。</div>',
      "</div></section>",
      '<section class="panel preview-shell">',
      '<div class="panel-header"><h2 class="panel-title">視覺化拖拉編輯</h2><span class="badge">' + escapeHtml(template.name) + "</span></div>",
      '<div class="panel-body"><div data-preview-slot="editor">' + renderPreviewHTML(template, emptyDraft(template), { mode: "editor", selectedFieldId: selectedFieldId }) + "</div></div>",
      "</section>",
      '<section class="panel">',
      '<div class="panel-header"><h2 class="panel-title">欄位屬性</h2></div>',
      '<div class="panel-body stack">',
      field ? renderFieldInspector(field) : '<div class="empty-state">請選擇一個欄位。</div>',
      '<div class="button-row">',
      '<button type="button" class="button primary" data-action="set-template-status" data-status="published" data-template-id="' + template.id + '">發布到前台</button>',
      '<button type="button" class="button" data-action="set-template-status" data-status="draft" data-template-id="' + template.id + '">儲存草稿</button>',
      "</div>",
      "</div></section>",
      "</main>",
    ].join("");
  }

  function renderFieldInspector(field) {
    var numeric = [
      ["x", "X 位置"],
      ["y", "Y 位置"],
      ["width", "寬度"],
      ["height", "高度"],
      ["layer", "圖層"],
    ];
    return [
      '<div class="form-field"><label class="form-label">欄位名稱</label><input class="input" type="text" value="' + escapeAttr(field.label) + '" data-bind="field-prop" data-prop="label" /></div>',
      field.type === "text"
        ? '<div class="form-field"><label class="form-label">預設文字</label><textarea class="textarea" data-bind="field-prop" data-prop="defaultText">' + escapeHtml(field.defaultText || "") + "</textarea></div>"
        : "",
      '<div class="split-fields">',
      numeric
        .map(function (item) {
          return '<div class="form-field compact"><label class="form-label">' + item[1] + '</label><input class="input" type="number" value="' + escapeAttr(field[item[0]]) + '" data-bind="field-prop" data-prop="' + item[0] + '" /></div>';
        })
        .join(""),
      "</div>",
      field.type === "text"
        ? [
            '<div class="form-field compact"><label class="form-label">' + escapeHtml(field.label) + ' pt <span class="value-pill" data-field-pill="fontSize">' + field.fontSize + " pt</span></label>",
            '<div class="range-row">',
            '<input type="range" min="6" max="' + MAX_FONT_PT + '" value="' + field.fontSize + '" data-bind="field-prop" data-prop="fontSize" />',
            '<input class="input" type="number" min="6" max="' + MAX_FONT_PT + '" value="' + field.fontSize + '" data-bind="field-prop" data-prop="fontSize" />',
            "</div></div>",
            '<div class="split-fields">',
            '<div class="form-field compact"><label class="form-label">文字顏色</label><input class="input" type="color" value="' + escapeAttr(field.color || "#242321") + '" data-bind="field-prop" data-prop="color" /></div>',
            '<div class="form-field compact"><label class="form-label">對齊</label><select class="select" data-bind="field-prop" data-prop="align"><option value="left"' + selected(field.align, "left") + '>靠左</option><option value="center"' + selected(field.align, "center") + '>置中</option><option value="right"' + selected(field.align, "right") + ">靠右</option></select></div>",
            "</div>",
          ].join("")
        : '<div class="form-field compact"><label class="form-label">圖片角色</label><select class="select" data-bind="field-prop" data-prop="role"><option value="image"' + selected(field.role, "image") + '>一般圖片</option><option value="portrait"' + selected(field.role, "portrait") + '>個人形象照</option><option value="qr"' + selected(field.role, "qr") + '>QR Code</option><option value="logo"' + selected(field.role, "logo") + ">LOGO</option></select></div>",
      '<button type="button" class="button danger" data-action="delete-field" data-field-id="' + field.id + '">刪除此欄位</button>',
    ].join("");
  }

  function renderRecords() {
    var record = selectedRecord();
    return [
      '<main class="layout">',
      '<section class="panel">',
      '<div class="panel-header"><h2 class="panel-title">套版紀錄</h2><span class="badge">' + state.records.length + " 筆</span></div>",
      '<div class="panel-body stack">',
      state.records.length
        ? '<div class="record-list">' +
          state.records
            .slice()
            .sort(function (a, b) {
              return String(b.createdAt).localeCompare(String(a.createdAt));
            })
            .map(renderRecordItem)
            .join("") +
          "</div>"
        : '<div class="empty-state">尚無套版紀錄。前台按「完成套版並存紀錄」後會出現在這裡。</div>',
      "</div></section>",
      '<section class="panel preview-shell">',
      '<div class="panel-header"><h2 class="panel-title">紀錄預覽與下載</h2></div>',
      '<div class="panel-body stack">',
      record ? renderRecordPreview(record) : '<div class="empty-state">請選擇一筆紀錄。</div>',
      "</div></section>",
      "</main>",
    ].join("");
  }

  function renderRecordItem(record) {
    return [
      '<article class="list-item ' + (record.id === selectedRecordId ? "active" : "") + '">',
      '<div class="item-title-row"><h4 class="item-title">' + escapeHtml(record.displayName || record.userName || "未命名使用者") + '</h4><span class="badge">' + escapeHtml(record.templateName || "模板") + "</span></div>",
      '<div class="item-meta">' + formatDate(record.createdAt) + "，使用者 ID：" + escapeHtml(record.userId || "-") + "</div>",
      '<div class="button-row">',
      '<button type="button" class="button small" data-action="select-record" data-record-id="' + record.id + '">查看</button>',
      '<button type="button" class="button small accent" data-action="download-record" data-record-id="' + record.id + '">下載</button>',
      '<button type="button" class="button small danger" data-action="delete-record" data-record-id="' + record.id + '">刪除</button>',
      "</div>",
      "</article>",
    ].join("");
  }

  function renderRecordPreview(record) {
    return [
      '<div class="record-preview">',
      record.outputDataUrl ? '<img src="' + record.outputDataUrl + '" alt="DM 紀錄預覽" />' : '<div data-preview-slot="record">' + renderPreviewHTML(record.templateSnapshot, record.draftSnapshot, { mode: "record" }) + "</div>",
      "</div>",
      '<div class="button-row">',
      '<button type="button" class="button accent" data-action="download-record" data-record-id="' + record.id + '">下載此 DM</button>',
      '<button type="button" class="button" data-action="preview-record-modal" data-record-id="' + record.id + '">放大預覽</button>',
      "</div>",
    ].join("");
  }

  function renderPreviewHTML(template, draft, options) {
    var mode = options && options.mode;
    var editor = mode === "editor";
    var background = template.canvas.background;
    var surfaceClass = "design-surface" + (background.type === "builtin" ? " builtin-bg" : "");
    var surfaceStyle = [
      "width:" + template.canvas.width + "px",
      "height:" + template.canvas.height + "px",
      background.type === "image" ? "background-image:url(" + cssUrl(background.value) + ")" : "",
      background.type === "image" ? "background-size:cover" : "",
      background.type === "image" ? "background-position:center" : "",
      background.type === "color" ? "background:" + background.value : "",
    ]
      .filter(Boolean)
      .join(";");
    return [
      '<div class="preview-stage ' + (editor ? "editor-mode" : "") + '" style="--design-w:' + template.canvas.width + ';--design-h:' + template.canvas.height + '" data-template-id="' + template.id + '">',
      '<div class="' + surfaceClass + '" style="' + surfaceStyle + '">',
      template.fields
        .slice()
        .sort(function (a, b) {
          return a.layer - b.layer;
        })
        .map(function (field) {
          return renderPreviewField(field, draft, editor, options && options.selectedFieldId);
        })
        .join(""),
      "</div></div>",
    ].join("");
  }

  function renderPreviewField(field, draft, editor, activeFieldId) {
    var style = [
      "left:" + field.x + "px",
      "top:" + field.y + "px",
      "width:" + field.width + "px",
      "height:" + field.height + "px",
      "z-index:" + field.layer,
    ];
    var selectedClass = activeFieldId === field.id ? " selected" : "";
    if (field.type === "text") {
      var size = getDraftFont(draft, field);
      style.push("font-size:" + ptToPx(size) + "px");
      style.push("--field-color:" + (field.color || "#242321"));
      style.push("--field-line-height:" + (field.lineHeight || 1.16));
      style.push("font-family:" + (field.fontFamily || "inherit"));
      style.push("font-weight:" + (field.fontWeight || "700"));
      style.push("text-align:" + (field.align || "left"));
      style.push("justify-content:" + (field.align === "center" ? "center" : field.align === "right" ? "flex-end" : "flex-start"));
      return (
        '<div class="design-field text-field' +
        selectedClass +
        '" data-field-id="' +
        field.id +
        '" style="' +
        style.join(";") +
        '">' +
        (editor ? '<span class="field-name-tag">' + escapeHtml(field.label) + "</span>" : "") +
        escapeHtml(getDraftText(draft, field)) +
        (editor ? '<span class="resize-handle" data-resize-field="' + field.id + '"></span>' : "") +
        "</div>"
      );
    }

    var image = getDraftImage(draft, field);
    var label = editor ? '<span class="field-name-tag">' + escapeHtml(field.label) + "</span>" : "";
    var resize = editor ? '<span class="resize-handle" data-resize-field="' + field.id + '"></span>' : "";
    if (image) {
      return '<div class="design-field image-field role-' + escapeAttr(field.role || "image") + selectedClass + '" data-field-id="' + field.id + '" style="' + style.join(";") + '">' + label + '<img src="' + image + '" alt="' + escapeAttr(field.label) + '" />' + resize + "</div>";
    }
    return '<div class="design-field image-field role-' + escapeAttr(field.role || "image") + ' placeholder' + selectedClass + '" data-field-id="' + field.id + '" style="' + style.join(";") + '">' + label + escapeHtml(field.label) + resize + "</div>";
  }

  async function handleClick(event) {
    var viewButton = event.target.closest("[data-view]");
    if (viewButton) {
      currentView = viewButton.dataset.view;
      safeRender();
      return;
    }

    var button = event.target.closest("[data-action]");
    if (!button) return;
    var action = button.dataset.action;

    try {
      if (action === "add-user") addUser();
      if (action === "save-front-record") await saveCurrentRecord();
      if (action === "download-current") await downloadCurrentDraft();
      if (action === "remove-front-image") removeFrontImage(button.dataset.fieldId);
      if (action === "select-template") selectTemplate(button.dataset.templateId, "admin");
      if (action === "set-template-status") setTemplateStatus(button.dataset.templateId, button.dataset.status);
      if (action === "duplicate-template") duplicateTemplate(button.dataset.templateId);
      if (action === "export-backup") window.dmSystemExportBackup();
      if (action === "reset-data") await window.dmSystemResetLocal();
      if (action === "add-custom-text") addCustomTextField();
      if (action === "select-field") selectField(button.dataset.fieldId);
      if (action === "delete-field") deleteField(button.dataset.fieldId);
      if (action === "select-record") selectRecord(button.dataset.recordId);
      if (action === "download-record") await downloadRecord(button.dataset.recordId);
      if (action === "delete-record") deleteRecord(button.dataset.recordId);
      if (action === "preview-record-modal") showRecordModal(button.dataset.recordId);
      if (action === "close-modal") closeModal();
    } catch (error) {
      toast(error.message || "操作失敗", "error");
    }
  }

  function handleInput(event) {
    var target = event.target;
    var bind = target.dataset.bind;
    if (!bind) return;
    var template = selectedTemplate();
    var fieldId = target.dataset.fieldId;
    var field = template && fieldId ? findById(template.fields, fieldId) : null;

    if (bind === "draft-text") {
      var draft = currentDraft();
      draft.text[fieldId] = target.value;
      scheduleSave();
      refreshPreviewSlots();
      return;
    }

    if (bind === "draft-font" && field) {
      var draftFont = clampNumber(target.value, 6, MAX_FONT_PT, field.fontSize || 18);
      currentDraft().font[fieldId] = draftFont;
      updateValuePills(fieldId, draftFont);
      syncPairedInputs(target, draftFont);
      scheduleSave();
      refreshPreviewSlots();
      return;
    }

    if (bind === "admin-font" && field) {
      var adminFont = clampNumber(target.value, 6, MAX_FONT_PT, field.fontSize || 18);
      field.fontSize = adminFont;
      touchTemplate(template);
      updateAdminPills(fieldId, adminFont);
      syncPairedInputs(target, adminFont);
      scheduleSave();
      refreshPreviewSlots();
      return;
    }

    if (bind === "template-name" && template) {
      template.name = target.value.trim() || "未命名模板";
      touchTemplate(template);
      scheduleSave();
      return;
    }

    if (bind === "settings-api") {
      state.settings.apiEndpoint = target.value.trim();
      scheduleSave();
      return;
    }

    if (bind === "field-prop" && template) {
      var selectedItem = selectedField(template);
      if (!selectedItem) return;
      applyFieldProp(selectedItem, target.dataset.prop, target.value);
      touchTemplate(template);
      scheduleSave();
      refreshPreviewSlots();
    }
  }

  async function handleChange(event) {
    var target = event.target;
    var change = target.dataset.change;
    if (!change) return;

    try {
      if (change === "active-user") {
        state.activeUserId = target.value;
        scheduleSave();
        safeRender();
      }
      if (change === "front-template" || change === "editor-template") {
        selectedTemplateId = target.value;
        selectedFieldId = firstEditableField(selectedTemplate()) || "";
        safeRender();
      }
      if (change === "front-image") await uploadFrontImage(target);
      if (change === "template-package") await importTemplatePackage(Array.prototype.slice.call(target.files || []));
      if (change === "blank-template") await importBlankTemplate(target.files && target.files[0]);
      if (change === "logo-upload") await uploadLogo(target.files && target.files[0]);
      if (change === "backup-import") await importBackup(target.files && target.files[0]);
    } catch (error) {
      toast(error.message || "檔案處理失敗", "error");
    } finally {
      if (target.type === "file") target.value = "";
    }
  }

  function handlePointerDown(event) {
    var stage = event.target.closest(".editor-mode");
    if (!stage) return;
    var fieldEl = event.target.closest("[data-field-id]");
    if (!fieldEl) return;
    var template = selectedTemplate();
    var field = template ? findById(template.fields, fieldEl.dataset.fieldId) : null;
    if (!field) return;

    selectedFieldId = field.id;
    var resize = event.target.closest("[data-resize-field]");
    dragState = {
      mode: resize ? "resize" : "move",
      field: field,
      fieldEl: fieldEl,
      startX: event.clientX,
      startY: event.clientY,
      originX: field.x,
      originY: field.y,
      originW: field.width,
      originH: field.height,
      scale: getStageScale(stage),
      template: template,
    };
    fieldEl.setPointerCapture && fieldEl.setPointerCapture(event.pointerId);
    event.preventDefault();
    fieldEl.classList.add("selected");
  }

  function handlePointerMove(event) {
    if (!dragState) return;
    var dx = (event.clientX - dragState.startX) / dragState.scale;
    var dy = (event.clientY - dragState.startY) / dragState.scale;
    var field = dragState.field;
    if (dragState.mode === "resize") {
      field.width = clampNumber(dragState.originW + dx, 12, dragState.template.canvas.width, dragState.originW);
      field.height = clampNumber(dragState.originH + dy, 12, dragState.template.canvas.height, dragState.originH);
    } else {
      field.x = clampNumber(dragState.originX + dx, 0, dragState.template.canvas.width - field.width, dragState.originX);
      field.y = clampNumber(dragState.originY + dy, 0, dragState.template.canvas.height - field.height, dragState.originY);
    }
    if (dragState.fieldEl) {
      dragState.fieldEl.style.left = field.x + "px";
      dragState.fieldEl.style.top = field.y + "px";
      dragState.fieldEl.style.width = field.width + "px";
      dragState.fieldEl.style.height = field.height + "px";
    }
    touchTemplate(dragState.template);
    scheduleSave();
  }

  function handlePointerUp() {
    if (!dragState) return;
    dragState = null;
    safeRender();
  }

  function addUser() {
    var input = document.getElementById("newUserName");
    var name = input ? input.value.trim() : "";
    if (!name) {
      toast("請輸入使用者名稱。", "warning");
      return;
    }
    var user = { id: uid("user"), name: name, createdAt: new Date().toISOString() };
    state.users.push(user);
    state.activeUserId = user.id;
    scheduleSave();
    toast("已新增使用者，草稿會獨立保存。");
    safeRender();
  }

  async function saveCurrentRecord() {
    var template = frontTemplate();
    if (!template) throw new Error("目前沒有可套版的 DM。");
    var draft = currentDraft();
    var displayName = draft.text.name || draft.text.company || activeUser().name;
    var outputDataUrl = await renderToImage(template, draft);
    var record = {
      id: uid("rec"),
      userId: state.activeUserId,
      userName: activeUser().name,
      displayName: displayName,
      templateId: template.id,
      templateName: template.name,
      templateSnapshot: clone(template),
      draftSnapshot: clone(draft),
      outputDataUrl: outputDataUrl,
      createdAt: new Date().toISOString(),
    };
    state.records.push(record);
    selectedRecordId = record.id;
    scheduleSave(true);
    await syncRecord(record);
    toast("已完成套版並產生後台紀錄。");
    currentView = "records";
    safeRender();
  }

  async function downloadCurrentDraft() {
    var template = frontTemplate();
    if (!template) throw new Error("目前沒有可下載的 DM。");
    var dataUrl = await renderToImage(template, currentDraft());
    downloadDataUrl(fileSafeName(template.name + "-" + activeUser().name) + ".png", dataUrl);
  }

  function removeFrontImage(fieldId) {
    var draft = currentDraft();
    if (draft.images) delete draft.images[fieldId];
    scheduleSave();
    toast("已移除圖片。");
    safeRender();
  }

  function selectTemplate(id, view) {
    selectedTemplateId = id;
    currentView = view || currentView;
    selectedFieldId = firstEditableField(selectedTemplate()) || "";
    safeRender();
  }

  function setTemplateStatus(id, status) {
    var template = findById(state.templates, id);
    if (!template) return;
    template.status = status;
    touchTemplate(template);
    scheduleSave();
    toast(status === "published" ? "DM 已上架，前台可看見。" : status === "draft" ? "DM 已下架並保留設定。" : "DM 已封存，後台仍保留。");
    safeRender();
  }

  function duplicateTemplate(id) {
    var template = findById(state.templates, id);
    if (!template) return;
    var next = clone(template);
    next.id = uid("tpl");
    next.name = template.name + " 複製";
    next.status = "draft";
    next.createdAt = new Date().toISOString();
    next.updatedAt = next.createdAt;
    state.templates.push(next);
    selectedTemplateId = next.id;
    scheduleSave();
    toast("已複製模板，可在發布前繼續調整。");
    safeRender();
  }

  function addCustomTextField() {
    var template = selectedTemplate();
    if (!template) return;
    var field = normalizeField({
      id: uid("text"),
      type: "text",
      label: "自訂文字",
      defaultText: "自訂文字",
      x: 120,
      y: 120,
      width: 320,
      height: 54,
      fontSize: 20,
      color: "#242321",
      fontWeight: "800",
      layer: 30 + template.fields.length,
    });
    template.fields.push(field);
    selectedFieldId = field.id;
    touchTemplate(template);
    scheduleSave();
    safeRender();
  }

  function selectField(id) {
    selectedFieldId = id;
    safeRender();
  }

  function deleteField(id) {
    var template = selectedTemplate();
    if (!template) return;
    if (!confirm("確定刪除此欄位？既有紀錄不會被刪除，但新套版會少此欄位。")) return;
    template.fields = template.fields.filter(function (field) {
      return field.id !== id;
    });
    selectedFieldId = firstEditableField(template) || "";
    touchTemplate(template);
    scheduleSave();
    safeRender();
  }

  function selectRecord(id) {
    selectedRecordId = id;
    safeRender();
  }

  async function downloadRecord(id) {
    var record = findById(state.records, id);
    if (!record) return;
    var dataUrl = record.outputDataUrl || (await renderToImage(record.templateSnapshot, record.draftSnapshot));
    downloadDataUrl(fileSafeName((record.templateName || "DM") + "-" + (record.displayName || record.userName || "record")) + ".png", dataUrl);
  }

  function deleteRecord(id) {
    if (!confirm("確定刪除此筆紀錄？")) return;
    state.records = state.records.filter(function (record) {
      return record.id !== id;
    });
    selectedRecordId = state.records[0] ? state.records[0].id : "";
    scheduleSave();
    safeRender();
  }

  function showRecordModal(id) {
    var record = findById(state.records, id);
    if (!record) return;
    closeModal();
    var wrapper = document.createElement("div");
    wrapper.className = "modal-backdrop";
    wrapper.setAttribute("data-modal", "record");
    wrapper.innerHTML = [
      '<div class="modal">',
      '<div class="panel-header"><h2 class="panel-title">DM 放大預覽</h2><button type="button" class="button small" data-action="close-modal">關閉</button></div>',
      record.outputDataUrl ? '<img src="' + record.outputDataUrl + '" alt="DM 放大預覽" />' : '<div class="panel-body">' + renderPreviewHTML(record.templateSnapshot, record.draftSnapshot, { mode: "record" }) + "</div>",
      "</div>",
    ].join("");
    document.body.appendChild(wrapper);
    afterRender();
  }

  function closeModal() {
    var modal = document.querySelector("[data-modal]");
    if (modal) modal.remove();
  }

  async function uploadFrontImage(input) {
    var file = input.files && input.files[0];
    if (!file) return;
    validateImageFile(file);
    var template = frontTemplate();
    var field = findById(template.fields, input.dataset.fieldId);
    if (!field) return;
    var targetAspect = field.width / field.height;
    var dataUrl = await processImage(file, {
      role: field.role,
      targetAspect: targetAspect,
      maxWidth: Math.max(900, field.width * 3),
      maxHeight: Math.max(900, field.height * 3),
    });
    currentDraft().images[field.id] = dataUrl;
    scheduleSave();
    toast(field.role === "qr" ? "QR Code 已自動裁切並放入指定區域。" : "形象照已等比例裁切並放入指定區域。");
    refreshPreviewSlots();
  }

  async function importTemplatePackage(files) {
    if (!files.length) return;
    var first = files[0];
    if (/\.zip$/i.test(first.name)) {
      if (!window.JSZip) throw new Error("ZIP 匯入模組尚未載入，請重新整理後再試；也可直接上傳 template.json 與圖片。");
      await importZipTemplate(first);
      return;
    }
    var jsonFile = files.find(function (file) {
      return /\.json$/i.test(file.name);
    });
    var imageFiles = files.filter(function (file) {
      return file.type.indexOf("image/") === 0;
    });
    if (jsonFile) {
      var json = JSON.parse(await readFileAsText(jsonFile));
      var assets = {};
      for (var i = 0; i < imageFiles.length; i += 1) {
        assets[imageFiles[i].name] = await processImage(imageFiles[i], { role: "asset", maxWidth: 2200, maxHeight: 2200 });
      }
      addImportedTemplate(jsonToTemplate(json, assets));
      return;
    }
    if (imageFiles[0]) {
      await importBlankTemplate(imageFiles[0]);
      return;
    }
    throw new Error("請上傳 .zip、template.json 或圖片檔。");
  }

  async function importZipTemplate(file) {
    var zip = await window.JSZip.loadAsync(file);
    var files = Object.keys(zip.files)
      .map(function (key) {
        return zip.files[key];
      })
      .filter(function (entry) {
        return !entry.dir;
      });
    var jsonEntry = files.find(function (entry) {
      return /(^|\/)template\.json$/i.test(entry.name);
    });
    var assets = {};
    var imageEntries = files.filter(function (entry) {
      return /\.(png|jpe?g|webp)$/i.test(entry.name);
    });
    for (var i = 0; i < imageEntries.length; i += 1) {
      var blob = await imageEntries[i].async("blob");
      var imageFile = new File([blob], imageEntries[i].name.split("/").pop(), { type: blob.type || "image/png" });
      assets[imageEntries[i].name] = await processImage(imageFile, { role: "asset", maxWidth: 2400, maxHeight: 2400 });
      assets[imageFile.name] = assets[imageEntries[i].name];
    }
    if (jsonEntry) {
      var json = JSON.parse(await jsonEntry.async("text"));
      addImportedTemplate(jsonToTemplate(json, assets));
      return;
    }
    if (!imageEntries.length) throw new Error("壓縮包內找不到 template.json 或圖片。");
    var firstName = imageEntries[0].name;
    await addTemplateFromDataUrl(file.name.replace(/\.zip$/i, ""), assets[firstName]);
  }

  async function importBlankTemplate(file) {
    if (!file) return;
    validateImageFile(file);
    var dataUrl = await processImage(file, { role: "asset", maxWidth: 2400, maxHeight: 2400 });
    await addTemplateFromDataUrl(file.name.replace(/\.[^.]+$/, ""), dataUrl);
  }

  async function addTemplateFromDataUrl(name, dataUrl) {
    var image = await loadImage(dataUrl);
    var template = createDefaultTemplate(name || "空白 DM 模板", dataUrl, image.naturalWidth || image.width, image.naturalHeight || image.height);
    template.status = "draft";
    addImportedTemplate(template);
  }

  function addImportedTemplate(template) {
    var normalized = normalizeTemplate(template);
    normalized.id = uid("tpl");
    normalized.createdAt = new Date().toISOString();
    normalized.updatedAt = normalized.createdAt;
    normalized.status = normalized.status === "published" ? "published" : "draft";
    state.templates.push(normalized);
    selectedTemplateId = normalized.id;
    selectedFieldId = firstEditableField(normalized) || "";
    scheduleSave(true);
    toast("模板已匯入，請確認位置後再發布。");
    currentView = "editor";
    safeRender();
  }

  function jsonToTemplate(json, assets) {
    if (!json || typeof json !== "object") throw new Error("template.json 格式錯誤。");
    var canvas = Object.assign({ width: 1080, height: 1350 }, json.canvas || {});
    var background = json.background || canvas.background || json.backgroundImage;
    if (typeof background === "string") {
      background = { type: "image", value: assets[background] || background };
    } else if (background && background.type === "image" && background.value) {
      background = { type: "image", value: assets[background.value] || background.value };
    } else if (assets[json.backgroundImage]) {
      background = { type: "image", value: assets[json.backgroundImage] };
    }
    canvas.background = normalizeBackground(background);
    var fields = Array.isArray(json.fields) ? json.fields : defaultFields(canvas.width, canvas.height);
    fields = fields.map(function (field) {
      var next = Object.assign({}, field);
      if (next.defaultImage && assets[next.defaultImage]) next.defaultImage = assets[next.defaultImage];
      if (next.image && assets[next.image]) next.defaultImage = assets[next.image];
      return next;
    });
    return {
      name: json.name || json.title || "匯入模板",
      status: json.status || "draft",
      canvas: canvas,
      fields: fields,
    };
  }

  async function uploadLogo(file) {
    if (!file) return;
    validateImageFile(file);
    var template = selectedTemplate();
    if (!template) return;
    var logoField = template.fields.find(function (field) {
      return field.role === "logo" || field.id === "logo";
    });
    if (!logoField) {
      logoField = normalizeField({ id: "logo", type: "image", label: "LOGO", role: "logo", x: 60, y: 60, width: 180, height: 80, layer: 20 });
      template.fields.push(logoField);
    }
    logoField.defaultImage = await processImage(file, { role: "logo", maxWidth: 800, maxHeight: 800, keepTransparency: true });
    selectedFieldId = logoField.id;
    touchTemplate(template);
    scheduleSave(true);
    toast("LOGO 已上傳，可在模板編輯中拖拉定位。");
    safeRender();
  }

  async function importBackup(file) {
    if (!file) return;
    var imported = JSON.parse(await readFileAsText(file));
    state = migrateState(imported);
    selectedTemplateId = state.templates[0] ? state.templates[0].id : "";
    selectedFieldId = firstEditableField(selectedTemplate()) || "";
    selectedRecordId = state.records[0] ? state.records[0].id : "";
    await storage.save(state);
    toast("備份已匯入。");
    safeRender();
  }

  function applyFieldProp(field, prop, value) {
    if (["x", "y", "width", "height", "layer"].indexOf(prop) >= 0) {
      field[prop] = clampNumber(value, prop === "layer" ? 0 : 0, prop === "layer" ? 999 : 5000, field[prop]);
      return;
    }
    if (prop === "fontSize") {
      field.fontSize = clampNumber(value, 6, MAX_FONT_PT, field.fontSize || 18);
      updateInspectorPills(field.fontSize);
      syncAllInspectorFont(field.fontSize);
      return;
    }
    if (prop === "lineHeight") {
      field.lineHeight = clampNumber(value, 0.8, 2.2, field.lineHeight || 1.16);
      return;
    }
    if (prop === "label") {
      field.label = String(value || "").trim() || "未命名欄位";
      return;
    }
    field[prop] = value;
  }

  function syncRecord(record) {
    if (!state.settings.apiEndpoint) return Promise.resolve();
    return fetch(state.settings.apiEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "userRecord",
        record: record,
      }),
    }).catch(function (error) {
      toast("本機紀錄已保存，但遠端同步失敗。", "warning");
      console.warn(error);
    });
  }

  async function renderToImage(template, draft) {
    var canvas = document.createElement("canvas");
    canvas.width = template.canvas.width;
    canvas.height = template.canvas.height;
    var ctx = canvas.getContext("2d");
    await drawBackground(ctx, template);
    var fields = template.fields.slice().sort(function (a, b) {
      return a.layer - b.layer;
    });
    for (var i = 0; i < fields.length; i += 1) {
      var field = fields[i];
      if (field.type === "image") {
        var imageUrl = getDraftImage(draft, field);
        if (imageUrl) await drawImageField(ctx, field, imageUrl);
      } else {
        drawTextField(ctx, field, getDraftText(draft, field), getDraftFont(draft, field));
      }
    }
    return canvas.toDataURL("image/png");
  }

  async function drawBackground(ctx, template) {
    var bg = template.canvas.background;
    if (bg.type === "image" && bg.value) {
      var image = await loadImage(bg.value);
      drawCover(ctx, image, 0, 0, template.canvas.width, template.canvas.height);
      return;
    }
    if (bg.type === "color") {
      ctx.fillStyle = bg.value;
      ctx.fillRect(0, 0, template.canvas.width, template.canvas.height);
      return;
    }
    var gradient = ctx.createLinearGradient(0, 0, template.canvas.width, template.canvas.height);
    gradient.addColorStop(0, "#fff8ed");
    gradient.addColorStop(0.58, "#f4ead8");
    gradient.addColorStop(0.58, "#ffffff");
    gradient.addColorStop(1, "#ffffff");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, template.canvas.width, template.canvas.height);
    ctx.fillStyle = "rgba(23,104,79,0.13)";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(template.canvas.width * 0.56, 0);
    ctx.lineTo(0, template.canvas.height * 0.32);
    ctx.closePath();
    ctx.fill();
  }

  async function drawImageField(ctx, field, dataUrl) {
    var image = await loadImage(dataUrl);
    ctx.save();
    ctx.beginPath();
    ctx.rect(field.x, field.y, field.width, field.height);
    ctx.clip();
    if (field.role === "logo") {
      drawContain(ctx, image, field.x, field.y, field.width, field.height);
    } else {
      drawCover(ctx, image, field.x, field.y, field.width, field.height);
    }
    ctx.restore();
  }

  function drawTextField(ctx, field, text, pt) {
    var fontSize = ptToPx(pt);
    ctx.save();
    ctx.beginPath();
    ctx.rect(field.x, field.y, field.width, field.height);
    ctx.clip();
    ctx.fillStyle = field.color || "#242321";
    ctx.font = (field.fontWeight || "700") + " " + fontSize + "px " + (field.fontFamily || '"Noto Sans TC", "Microsoft JhengHei", sans-serif');
    ctx.textBaseline = "top";
    ctx.textAlign = field.align || "left";
    var x = field.x;
    if (field.align === "center") x = field.x + field.width / 2;
    if (field.align === "right") x = field.x + field.width;
    var lineHeight = fontSize * (field.lineHeight || 1.16);
    var lines = wrapText(ctx, String(text || ""), field.width);
    for (var i = 0; i < lines.length; i += 1) {
      var y = field.y + i * lineHeight;
      if (y + lineHeight > field.y + field.height + 2) break;
      ctx.fillText(lines[i], x, y);
    }
    ctx.restore();
  }

  function wrapText(ctx, text, maxWidth) {
    var paragraphs = text.split(/\r?\n/);
    var lines = [];
    paragraphs.forEach(function (paragraph) {
      var chars = Array.from(paragraph);
      var line = "";
      chars.forEach(function (char) {
        var test = line + char;
        if (line && ctx.measureText(test).width > maxWidth) {
          lines.push(line);
          line = char;
        } else {
          line = test;
        }
      });
      lines.push(line);
    });
    return lines;
  }

  function drawCover(ctx, image, x, y, width, height) {
    var iw = image.naturalWidth || image.width;
    var ih = image.naturalHeight || image.height;
    var source = coverRect(iw, ih, width / height, 0.5, 0.5);
    ctx.drawImage(image, source.x, source.y, source.width, source.height, x, y, width, height);
  }

  function drawContain(ctx, image, x, y, width, height) {
    var iw = image.naturalWidth || image.width;
    var ih = image.naturalHeight || image.height;
    var ratio = Math.min(width / iw, height / ih);
    var dw = iw * ratio;
    var dh = ih * ratio;
    ctx.drawImage(image, x + (width - dw) / 2, y + (height - dh) / 2, dw, dh);
  }

  async function processImage(file, options) {
    var dataUrl = await readFileAsDataUrl(file);
    var image = await loadImage(dataUrl);
    var iw = image.naturalWidth || image.width;
    var ih = image.naturalHeight || image.height;
    var role = options.role || "asset";
    var crop;
    if (role === "qr") {
      crop = await detectQrCrop(image);
    } else if (role === "portrait") {
      crop = coverRect(iw, ih, options.targetAspect || 0.68, 0.5, ih / iw > 1.45 ? 0.36 : 0.45);
    } else {
      crop = { x: 0, y: 0, width: iw, height: ih };
    }
    var maxWidth = options.maxWidth || 1600;
    var maxHeight = options.maxHeight || 1600;
    var out = fitSize(crop.width, crop.height, maxWidth, maxHeight);
    var canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(out.width));
    canvas.height = Math.max(1, Math.round(out.height));
    var ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
    var type = options.keepTransparency || /png|webp/i.test(file.type) || role === "logo" ? "image/png" : "image/jpeg";
    return canvasToDataUrl(canvas, type, 0.88);
  }

  async function detectQrCrop(image) {
    var iw = image.naturalWidth || image.width;
    var ih = image.naturalHeight || image.height;
    var max = 520;
    var scale = Math.min(1, max / Math.max(iw, ih));
    var canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(iw * scale));
    canvas.height = Math.max(1, Math.round(ih * scale));
    var ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    var data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    var corners = cornerAverage(data, canvas.width, canvas.height);
    var minX = canvas.width;
    var minY = canvas.height;
    var maxX = 0;
    var maxY = 0;
    var count = 0;
    for (var y = 0; y < canvas.height; y += 1) {
      for (var x = 0; x < canvas.width; x += 1) {
        var index = (y * canvas.width + x) * 4;
        var r = data[index];
        var g = data[index + 1];
        var b = data[index + 2];
        var a = data[index + 3];
        if (a < 40) continue;
        var dist = Math.abs(r - corners.r) + Math.abs(g - corners.g) + Math.abs(b - corners.b);
        var light = (r + g + b) / 3;
        if (dist > 70 || light < 190) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
          count += 1;
        }
      }
    }
    if (count < 80) return centerSquare(iw, ih);
    var pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.08);
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(canvas.width, maxX + pad);
    maxY = Math.min(canvas.height, maxY + pad);
    var size = Math.max(maxX - minX, maxY - minY);
    var cx = (minX + maxX) / 2;
    var cy = (minY + maxY) / 2;
    var sx = clampNumber(cx - size / 2, 0, canvas.width - size, 0);
    var sy = clampNumber(cy - size / 2, 0, canvas.height - size, 0);
    return {
      x: sx / scale,
      y: sy / scale,
      width: size / scale,
      height: size / scale,
    };
  }

  function cornerAverage(data, width, height) {
    var samples = [
      [0, 0],
      [width - 1, 0],
      [0, height - 1],
      [width - 1, height - 1],
    ];
    var sum = { r: 0, g: 0, b: 0 };
    samples.forEach(function (point) {
      var index = (point[1] * width + point[0]) * 4;
      sum.r += data[index];
      sum.g += data[index + 1];
      sum.b += data[index + 2];
    });
    return { r: sum.r / 4, g: sum.g / 4, b: sum.b / 4 };
  }

  function centerSquare(width, height) {
    var size = Math.min(width, height);
    return { x: (width - size) / 2, y: (height - size) / 2, width: size, height: size };
  }

  function coverRect(sourceW, sourceH, targetAspect, focusX, focusY) {
    var sourceAspect = sourceW / sourceH;
    var width = sourceW;
    var height = sourceH;
    if (sourceAspect > targetAspect) {
      width = sourceH * targetAspect;
    } else {
      height = sourceW / targetAspect;
    }
    var x = clampNumber(sourceW * focusX - width / 2, 0, sourceW - width, 0);
    var y = clampNumber(sourceH * focusY - height / 2, 0, sourceH - height, 0);
    return { x: x, y: y, width: width, height: height };
  }

  function fitSize(width, height, maxWidth, maxHeight) {
    var ratio = Math.min(1, maxWidth / width, maxHeight / height);
    return { width: width * ratio, height: height * ratio };
  }

  function validateImageFile(file) {
    if (!file.type || file.type.indexOf("image/") !== 0) throw new Error("請上傳 PNG、JPG 或 WEBP 圖片。");
    if (file.size > MAX_UPLOAD_BYTES) throw new Error("圖片超過 12MB，請先壓縮後再上傳。");
  }

  function currentDraft() {
    return getDraft(state.activeUserId, frontTemplate().id);
  }

  function getDraft(userId, templateId) {
    var key = userId + "::" + templateId;
    if (!state.drafts[key]) state.drafts[key] = emptyDraft(selectedTemplateId ? findById(state.templates, templateId) : null);
    state.drafts[key].text = state.drafts[key].text || {};
    state.drafts[key].font = state.drafts[key].font || {};
    state.drafts[key].images = state.drafts[key].images || {};
    return state.drafts[key];
  }

  function emptyDraft(template) {
    var draft = { text: {}, font: {}, images: {} };
    if (template) {
      textFields(template).forEach(function (field) {
        draft.text[field.id] = field.defaultText || "";
        draft.font[field.id] = field.fontSize || 18;
      });
    }
    return draft;
  }

  function getDraftText(draft, field) {
    return draft && draft.text && draft.text[field.id] !== undefined ? draft.text[field.id] : field.defaultText || "";
  }

  function getDraftFont(draft, field) {
    return clampNumber(draft && draft.font && draft.font[field.id] !== undefined ? draft.font[field.id] : field.fontSize || 18, 6, MAX_FONT_PT, field.fontSize || 18);
  }

  function getDraftImage(draft, field) {
    return (draft && draft.images && draft.images[field.id]) || field.defaultImage || "";
  }

  function frontTemplate() {
    var published = publishedTemplates();
    if (!published.length) return null;
    if (!selectedTemplateId || !published.some(function (item) { return item.id === selectedTemplateId; })) selectedTemplateId = published[0].id;
    return findById(published, selectedTemplateId) || published[0];
  }

  function selectedTemplate() {
    return findById(state.templates, selectedTemplateId) || state.templates[0] || null;
  }

  function selectedField(template) {
    return template ? findById(template.fields, selectedFieldId) || template.fields[0] || null : null;
  }

  function selectedRecord() {
    if (!state.records.length) return null;
    return findById(state.records, selectedRecordId) || state.records[state.records.length - 1];
  }

  function activeUser() {
    return findById(state.users, state.activeUserId) || state.users[0];
  }

  function publishedTemplates() {
    return state.templates.filter(function (item) {
      return item.status === "published";
    });
  }

  function textFields(template) {
    return template.fields.filter(function (field) {
      return field.type === "text";
    });
  }

  function imageFields(template) {
    return template.fields.filter(function (field) {
      return field.type === "image";
    });
  }

  function ensureSelection() {
    if (!state.activeUserId || !findById(state.users, state.activeUserId)) state.activeUserId = state.users[0].id;
    if (!selectedTemplateId || !findById(state.templates, selectedTemplateId)) selectedTemplateId = state.templates[0] ? state.templates[0].id : "";
    if (!selectedRecordId && state.records[0]) selectedRecordId = state.records[state.records.length - 1].id;
    if (!selectedFieldId && selectedTemplate()) selectedFieldId = firstEditableField(selectedTemplate()) || "";
  }

  function firstEditableField(template) {
    return template && template.fields[0] ? template.fields[0].id : "";
  }

  function findById(list, id) {
    return (list || []).find(function (item) {
      return item.id === id;
    });
  }

  function touchTemplate(template) {
    template.updatedAt = new Date().toISOString();
  }

  function scheduleSave(immediate) {
    clearTimeout(saveTimer);
    if (immediate) {
      storage.save(state);
      return;
    }
    saveTimer = setTimeout(function () {
      storage.save(state);
    }, 240);
  }

  function afterRender() {
    updateStageScales();
    if (!stageObserver && "ResizeObserver" in window) {
      stageObserver = new ResizeObserver(updateStageScales);
    }
    if (stageObserver) {
      document.querySelectorAll(".preview-stage").forEach(function (stage) {
        stageObserver.observe(stage);
      });
    }
  }

  function refreshPreviewSlots() {
    document.querySelectorAll("[data-preview-slot]").forEach(function (slot) {
      var type = slot.dataset.previewSlot;
      if (type === "front") slot.innerHTML = renderPreviewHTML(frontTemplate(), currentDraft(), { mode: "front" });
      if (type === "admin") slot.innerHTML = renderPreviewHTML(selectedTemplate(), emptyDraft(selectedTemplate()), { mode: "admin" });
      if (type === "editor") slot.innerHTML = renderPreviewHTML(selectedTemplate(), emptyDraft(selectedTemplate()), { mode: "editor", selectedFieldId: selectedFieldId });
      if (type === "record" && selectedRecord()) slot.innerHTML = renderPreviewHTML(selectedRecord().templateSnapshot, selectedRecord().draftSnapshot, { mode: "record" });
    });
    updateStageScales();
  }

  function updateStageScales() {
    document.querySelectorAll(".preview-stage").forEach(function (stage) {
      var width = parseFloat(stage.style.getPropertyValue("--design-w")) || 1080;
      var scale = stage.clientWidth / width;
      stage.style.setProperty("--stage-scale", scale);
    });
  }

  function getStageScale(stage) {
    return parseFloat(stage.style.getPropertyValue("--stage-scale")) || stage.clientWidth / (parseFloat(stage.style.getPropertyValue("--design-w")) || 1080) || 1;
  }

  function updateValuePills(fieldId, value) {
    document.querySelectorAll('[data-value-pill="' + cssEscape(fieldId) + '"]').forEach(function (el) {
      el.textContent = value + " pt";
    });
  }

  function updateAdminPills(fieldId, value) {
    document.querySelectorAll('[data-admin-pill="' + cssEscape(fieldId) + '"]').forEach(function (el) {
      el.textContent = value + " pt";
    });
  }

  function updateInspectorPills(value) {
    document.querySelectorAll('[data-field-pill="fontSize"]').forEach(function (el) {
      el.textContent = value + " pt";
    });
  }

  function syncPairedInputs(target, value) {
    var fieldId = target.dataset.fieldId;
    var bind = target.dataset.bind;
    document.querySelectorAll('[data-bind="' + bind + '"][data-field-id="' + cssEscape(fieldId) + '"]').forEach(function (input) {
      if (input !== target) input.value = value;
    });
  }

  function syncAllInspectorFont(value) {
    document.querySelectorAll('[data-bind="field-prop"][data-prop="fontSize"]').forEach(function (input) {
      input.value = value;
    });
  }

  function showFatal(error) {
    console.error(error);
    if (!fatal || !fatalMessage) return;
    fatal.hidden = false;
    fatalMessage.textContent = "系統載入時發生錯誤：" + (error && error.message ? error.message : String(error || "未知錯誤"));
  }

  function toast(message, type) {
    clearTimeout(toastTimer);
    var old = document.querySelector(".toast");
    if (old) old.remove();
    var el = document.createElement("div");
    el.className = "toast " + (type || "");
    el.textContent = message;
    document.body.appendChild(el);
    toastTimer = setTimeout(function () {
      el.remove();
    }, 3200);
  }

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(reader.result);
      };
      reader.onerror = function () {
        reject(reader.error);
      };
      reader.readAsDataURL(file);
    });
  }

  function readFileAsText(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(reader.result);
      };
      reader.onerror = function () {
        reject(reader.error);
      };
      reader.readAsText(file, "UTF-8");
    });
  }

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var image = new Image();
      image.onload = function () {
        resolve(image);
      };
      image.onerror = function () {
        reject(new Error("圖片載入失敗"));
      };
      image.src = src;
    });
  }

  function canvasToDataUrl(canvas, type, quality) {
    if (type === "image/png") return canvas.toDataURL(type);
    return canvas.toDataURL(type, quality || 0.88);
  }

  function downloadDataUrl(filename, dataUrl) {
    var link = document.createElement("a");
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function downloadText(filename, text) {
    var blob = new Blob([text], { type: "application/json;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    downloadDataUrl(filename, url);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 500);
  }

  function uid(prefix) {
    var random = window.crypto && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
    return prefix + "_" + String(random).replace(/-/g, "").slice(0, 18);
  }

  function clampNumber(value, min, max, fallback) {
    var number = Number(value);
    if (!Number.isFinite(number)) number = fallback;
    return Math.min(max, Math.max(min, Math.round(number * 100) / 100));
  }

  function ptToPx(pt) {
    return Math.round(Number(pt) * 96 / 72 * 100) / 100;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/\n/g, "&#10;");
  }

  function cssUrl(value) {
    return String(value || "").replace(/["\\\n\r]/g, "");
  }

  function cssEscape(value) {
    if (window.CSS && CSS.escape) return CSS.escape(value);
    return String(value).replace(/"/g, '\\"');
  }

  function selected(value, expected) {
    return value === expected ? " selected" : "";
  }

  function statusText(status) {
    if (status === "published") return "已上架";
    if (status === "archived") return "已封存";
    return "草稿 / 下架";
  }

  function statusClass(status) {
    return "badge " + (status === "published" ? "" : status === "archived" ? "archived" : "draft");
  }

  function formatDate(value) {
    if (!value) return "-";
    try {
      return new Intl.DateTimeFormat("zh-TW", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value));
    } catch (error) {
      return value;
    }
  }

  function fileSafeName(value) {
    return String(value || "dm").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 80);
  }

  init();
})();
