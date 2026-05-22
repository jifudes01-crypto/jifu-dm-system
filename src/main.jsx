import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { toPng } from 'html-to-image';
import {
  BadgeCheck,
  Download,
  FileImage,
  ImagePlus,
  LogOut,
  QrCode,
  RefreshCw,
  Save,
  SlidersHorizontal,
  Shield,
  Trash2,
  Upload,
  UserCog,
  UserRound,
  Users
} from 'lucide-react';
import { isSupabaseConfigured, supabase, uploadFile } from './lib/supabase';
import './styles.css';

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 1414;

const emptyContact = {
  name: '',
  title: '',
  company: '吉富工商地產有限公司',
  phone: '',
  address: '',
  email: '',
  line_id: '',
  is_active: true
};

const defaultSettings = {
  font_family: 'Noto Sans TC, Microsoft JhengHei, Arial, sans-serif',
  font_size: 28,
  font_weight: 700,
  color: '#111111',
  line_height: 1.35,
  letter_spacing: 0,
  contact_x: 72,
  contact_y: 1190,
  photo_x: 760,
  photo_y: 980,
  photo_w: 210,
  photo_h: 250,
  qr_x: 790,
  qr_y: 1245,
  qr_w: 170,
  qr_h: 170
};

const contactFields = ['name', 'title', 'company', 'phone', 'address', 'email', 'line_id'];
const numberSettings = [
  'font_size',
  'font_weight',
  'line_height',
  'letter_spacing',
  'contact_x',
  'contact_y',
  'photo_x',
  'photo_y',
  'photo_w',
  'photo_h',
  'qr_x',
  'qr_y',
  'qr_w',
  'qr_h'
];

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [route, setRoute] = useState(location.hash.replace('#', '') || 'front');

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return undefined;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));

    const onHash = () => setRoute(location.hash.replace('#', '') || 'front');
    addEventListener('hashchange', onHash);

    return () => {
      subscription.unsubscribe();
      removeEventListener('hashchange', onHash);
    };
  }, []);

  useEffect(() => {
    if (!session || !isSupabaseConfigured) {
      setProfile(null);
      return;
    }

    let alive = true;
    async function loadProfile() {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (!alive) return;
      setProfile(
        data || {
          id: session.user.id,
          email: session.user.email,
          display_name: session.user.user_metadata?.display_name || session.user.email?.split('@')[0],
          role: 'sales',
          is_active: true
        }
      );
    }

    loadProfile();
    return () => {
      alive = false;
    };
  }, [session]);

  if (!isSupabaseConfigured) return <SetupGuide />;
  if (loading) {
    return (
      <Shell>
        <section className="panel centerPanel">載入網站設定中...</section>
      </Shell>
    );
  }
  if (!session) return <Login />;
  if (profile?.is_active === false) {
    return (
      <Shell profile={profile}>
        <section className="panel centerPanel">
          <h1>帳號尚未啟用</h1>
          <p className="muted">請聯絡管理員開通後再重新登入。</p>
          <button onClick={() => supabase.auth.signOut()}>
            <LogOut size={16} />
            登出
          </button>
        </section>
      </Shell>
    );
  }

  const isAdmin = profile?.role === 'admin';

  return (
    <Shell profile={profile} isAdmin={isAdmin}>
      {route === 'admin' && isAdmin ? <Admin profile={profile} /> : <Front />}
    </Shell>
  );
}

function Shell({ children, profile, isAdmin }) {
  return (
    <>
      <header className="topbar">
        <a className="brand" href="#front" aria-label="回到業務前台">
          <span className="brandMark">JF</span>
          <span>
            吉富工商地產
            <small>DM 雲端產生系統</small>
          </span>
        </a>
        <nav>
          {profile && <a href="#front">業務前台</a>}
          {isAdmin && <a href="#admin">管理後台</a>}
          {profile && (
            <span className="user">
              <UserRound size={16} />
              {profile.display_name || profile.email || '使用者'}
            </span>
          )}
          {profile && (
            <button className="ghost" onClick={() => supabase.auth.signOut()}>
              <LogOut size={16} />
              登出
            </button>
          )}
        </nav>
      </header>
      <main className="wrap">{children}</main>
    </>
  );
}

function SetupGuide() {
  return (
    <Shell>
      <section className="panel setup">
        <div className="eyebrow">網站已整理完成，等待雲端連線設定</div>
        <h1>請先填入 Supabase 環境變數</h1>
        <p>
          這個網站需要 Supabase 專案網址與公開金鑰才能登入、上傳 DM、儲存通訊錄與版面設定。
        </p>
        <div className="setupGrid">
          <div>
            <h2>本機測試</h2>
            <ol>
              <li>複製 `.env.example` 成 `.env`。</li>
              <li>填入 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`。</li>
              <li>在 Supabase 執行 `supabase/schema.sql`。</li>
            </ol>
          </div>
          <div>
            <h2>Vercel 上線</h2>
            <ol>
              <li>將專案推到 GitHub。</li>
              <li>Vercel 匯入專案。</li>
              <li>在 Environment Variables 填入同樣三個變數。</li>
            </ol>
          </div>
        </div>
      </section>
    </Shell>
  );
}

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    setMsg('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setMsg(error.message);
  }

  async function signUp() {
    setBusy(true);
    setMsg('');
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: email.split('@')[0] } }
    });
    setBusy(false);
    setMsg(error ? error.message : '已送出註冊。若有開啟信箱驗證，請先到信箱確認。');
  }

  return (
    <Shell>
      <section className="panel narrow">
        <div className="eyebrow">吉富工商地產有限公司</div>
        <h1>登入 DM 系統</h1>
        <label className="field">
          <span>Email</span>
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="請輸入 Email" />
        </label>
        <label className="field">
          <span>密碼</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="請輸入密碼"
          />
        </label>
        <div className="actions">
          <button disabled={busy || !email || !password} onClick={signIn}>
            登入
          </button>
          <button className="secondary" disabled={busy || !email || !password} onClick={signUp}>
            建立帳號
          </button>
        </div>
        {msg && <p className="status">{msg}</p>}
        <p className="hint">第一位管理員註冊後，請到 Supabase SQL 執行 README 的管理員授權指令。</p>
      </section>
    </Shell>
  );
}

function Front() {
  const [items, setItems] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [settings, setSettings] = useState(defaultSettings);
  const [dm, setDm] = useState(null);
  const [contact, setContact] = useState(null);
  const [photo, setPhoto] = useState('');
  const [qr, setQr] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const canvas = useRef(null);
  const viewport = useRef(null);
  const scale = usePreviewScale(viewport);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError('');

    const [{ data: d, error: dmError }, { data: c, error: contactError }, { data: s }] = await Promise.all([
      supabase
        .from('dm_items')
        .select('*')
        .eq('is_published', true)
        .order('sort_order')
        .order('created_at', { ascending: false }),
      supabase.from('contacts').select('*').eq('is_active', true).order('name'),
      supabase.from('design_settings').select('*').eq('id', 1).maybeSingle()
    ]);

    if (dmError || contactError) setError(dmError?.message || contactError?.message || '讀取資料時發生問題');
    setItems(d || []);
    setContacts(c || []);
    setSettings(s || defaultSettings);
    setDm((d || [])[0] || null);
    setContact((c || [])[0] || null);
    setLoading(false);
  }

  function localFile(setter, file) {
    if (file) setter(URL.createObjectURL(file));
  }

  async function download() {
    if (!canvas.current || !dm) return;
    setBusy(true);
    try {
      const url = await toPng(canvas.current, { pixelRatio: 2, cacheBust: true });
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${dm.name}-${contact?.name || 'DM'}.png`;
      anchor.click();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="frontgrid">
      <section className="panel controls">
        <div className="eyebrow">業務前台</div>
        <h1>DM 產生器</h1>
        {error && <p className="status dangerText">{error}</p>}
        <label>選擇 DM</label>
        <select value={dm?.id || ''} onChange={(event) => setDm(items.find((item) => item.id === event.target.value))}>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.category ? `[${item.category}] ` : ''}
              {item.name}
            </option>
          ))}
        </select>
        <label>選擇聯絡資訊</label>
        <select
          value={contact?.id || ''}
          onChange={(event) => setContact(contacts.find((row) => row.id === event.target.value))}
        >
          {contacts.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name} / {row.title || '未填職稱'}
            </option>
          ))}
        </select>
        <label className="upload">
          <ImagePlus size={18} />
          上傳形象照
          <input type="file" accept="image/*" onChange={(event) => localFile(setPhoto, event.target.files[0])} />
        </label>
        <label className="upload">
          <QrCode size={18} />
          上傳 QR Code
          <input type="file" accept="image/*" onChange={(event) => localFile(setQr, event.target.files[0])} />
        </label>
        <button disabled={busy || !dm} onClick={download}>
          <Download size={18} />
          {busy ? '產生中...' : '下載完整 DM'}
        </button>
        <p className="hint">圖片只用於本次輸出；DM 底圖、通訊錄與樣式設定儲存在 Supabase。</p>
      </section>
      <section className="panel previewPanel">
        <div className="previewTitle">
          <div>
            <div className="eyebrow">輸出預覽</div>
            <h2>{dm?.name || '尚未選擇 DM'}</h2>
          </div>
          <button className="secondary" onClick={load}>
            重新整理
          </button>
        </div>
        {loading ? (
          <EmptyState title="讀取資料中" body="正在載入 DM 與通訊錄。" />
        ) : items.length === 0 ? (
          <EmptyState title="尚未上架 DM" body="請先到管理後台上傳並上架 DM 圖檔。" />
        ) : contacts.length === 0 ? (
          <EmptyState title="尚未建立通訊錄" body="請先到管理後台新增可使用的聯絡資訊。" />
        ) : (
          <div ref={viewport} className="previewViewport" style={{ height: CANVAS_HEIGHT * scale }}>
            <div className="canvasScaler" style={{ transform: `scale(${scale})` }}>
              <Preview refEl={canvas} dm={dm} contact={contact} photo={photo} qr={qr} settings={settings} />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Preview({ refEl, dm, contact, photo, qr, settings }) {
  const text = [
    contact?.name,
    contact?.title,
    contact?.company,
    contact?.phone,
    contact?.address,
    contact?.email,
    contact?.line_id && `LINE：${contact.line_id}`
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <div className="canvas" ref={refEl}>
      {dm ? (
        <img className="base" src={dm.image_url} crossOrigin="anonymous" alt={dm.name} />
      ) : (
        <div className="canvasPlaceholder">DM 底圖預覽</div>
      )}
      {photo && (
        <img
          className="photo"
          src={photo}
          alt="形象照"
          style={{
            left: Number(settings.photo_x),
            top: Number(settings.photo_y),
            width: Number(settings.photo_w),
            height: Number(settings.photo_h)
          }}
        />
      )}
      {qr && (
        <img
          className="qr"
          src={qr}
          alt="QR Code"
          style={{
            left: Number(settings.qr_x),
            top: Number(settings.qr_y),
            width: Number(settings.qr_w),
            height: Number(settings.qr_h)
          }}
        />
      )}
      <div
        className="contactText"
        style={{
          left: Number(settings.contact_x),
          top: Number(settings.contact_y),
          fontFamily: settings.font_family,
          fontSize: Number(settings.font_size),
          fontWeight: Number(settings.font_weight),
          color: settings.color,
          lineHeight: Number(settings.line_height),
          letterSpacing: Number(settings.letter_spacing)
        }}
      >
        {text}
      </div>
    </div>
  );
}

function Admin({ profile }) {
  const [tab, setTab] = useState('dm');
  const tabs = [
    { id: 'dm', label: 'DM 管理', icon: FileImage, description: '上傳、分類與上架狀態' },
    { id: 'contacts', label: '通訊錄', icon: Users, description: '業務聯絡資訊管理' },
    { id: 'users', label: '使用者', icon: UserCog, description: '帳號角色與啟用狀態' },
    { id: 'settings', label: '樣式設定', icon: SlidersHorizontal, description: '輸出座標與字型設定' }
  ];
  const currentTab = tabs.find((item) => item.id === tab) || tabs[0];

  return (
    <div className="adminWorkspace">
      <aside className="adminSidebar" aria-label="後台導覽">
        <div className="adminSidebarBrand">
          <span className="adminSidebarMark">JF</span>
          <div>
            <strong>管理後台</strong>
            <span>DM Cloud Console</span>
          </div>
        </div>
        <div className="adminNav">
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>
                <Icon size={18} />
                <span>
                  {item.label}
                  <small>{item.description}</small>
                </span>
              </button>
            );
          })}
        </div>
      </aside>
      <section className="adminContent">
        <div className="adminHero">
          <Shield />
          <div>
            <div className="eyebrow">吉富工商地產有限公司</div>
            <h1>內容與權限管理</h1>
            <p>集中管理 DM 圖檔、業務資料、帳號權限與輸出版面。</p>
          </div>
        </div>
        <div className="adminSummary">
          <div>
            <FileImage size={18} />
            <span>DM 資產</span>
            <strong>雲端管理</strong>
          </div>
          <div>
            <Users size={18} />
            <span>業務資料</span>
            <strong>統一套版</strong>
          </div>
          <div>
            <BadgeCheck size={18} />
            <span>目前角色</span>
            <strong>{profile?.role === 'admin' ? '管理員' : '業務'}</strong>
          </div>
        </div>
        <div className="adminSectionTitle">
          <div>
            <h2>{currentTab.label}</h2>
            <p>{currentTab.description}</p>
          </div>
        </div>
        {tab === 'dm' && <DmAdmin />}
        {tab === 'contacts' && <ContactAdmin />}
        {tab === 'users' && <UserAdmin currentProfile={profile} />}
        {tab === 'settings' && <SettingsAdmin />}
      </section>
    </div>
  );
}

function DmAdmin() {
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('dm_items')
      .select('*')
      .order('sort_order')
      .order('created_at', { ascending: false });
    setRows(data || []);
    setMsg(error ? error.message : '');
    setLoading(false);
  }

  async function upload(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setMsg('上傳中...');
    try {
      for (const file of files) {
        const up = await uploadFile('dm', file);
        const { error } = await supabase.from('dm_items').insert({
          name: file.name.replace(/\.[^.]+$/, ''),
          category: '',
          image_url: up.url,
          image_path: up.path,
          is_published: true
        });
        if (error) throw error;
      }
      setMsg('上傳完成');
      event.target.value = '';
      load();
    } catch (error) {
      setMsg(error.message);
    }
  }

  async function save(row) {
    const { error } = await supabase
      .from('dm_items')
      .update({
        name: row.name,
        category: row.category,
        is_published: row.is_published,
        sort_order: Number(row.sort_order || 0)
      })
      .eq('id', row.id);
    setMsg(error ? error.message : '已儲存');
    load();
  }

  async function del(row) {
    if (!confirm(`確定刪除「${row.name}」？`)) return;
    const { error } = await supabase.from('dm_items').delete().eq('id', row.id);
    setMsg(error ? error.message : '已刪除');
    load();
  }

  return (
    <section className="panel adminPanel">
      <div className="sectionHead">
        <div>
          <h2>DM 資產庫</h2>
          <p>上傳已排版的 DM 圖檔，設定前台顯示名稱、分類、排序與上架狀態。</p>
        </div>
        <div className="toolbarActions">
          <label className="upload uploadInline">
            <Upload size={18} />
            批次上傳 DM
            <input type="file" multiple accept="image/*" onChange={upload} />
          </label>
          <button className="secondary" onClick={load}>
            <RefreshCw size={16} />
            重新整理
          </button>
        </div>
      </div>
      {msg && <p className="status">{msg}</p>}
      {loading ? (
        <EmptyState title="讀取 DM 中" body="正在讀取已上傳的圖檔。" />
      ) : rows.length === 0 ? (
        <EmptyState title="尚未上傳 DM" body="請使用右上角按鈕上傳 DM 圖檔。" />
      ) : (
        <div className="grid cards">
          {rows.map((row, index) => (
            <div className="card" key={row.id}>
              <img src={row.image_url} crossOrigin="anonymous" alt={row.name} />
              <label className="field compactField">
                <span>DM 名稱</span>
                <input
                  value={row.name}
                  onChange={(event) => updateRow(rows, setRows, index, { name: event.target.value })}
                />
              </label>
              <label className="field compactField">
                <span>分類</span>
                <input
                  placeholder="例如：商辦、廠房、店面"
                  value={row.category || ''}
                  onChange={(event) => updateRow(rows, setRows, index, { category: event.target.value })}
                />
              </label>
              <label className="field compactField">
                <span>排序</span>
                <input
                  type="number"
                  placeholder="數字越小越前面"
                  value={row.sort_order || 0}
                  onChange={(event) => updateRow(rows, setRows, index, { sort_order: event.target.value })}
                />
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={row.is_published}
                  onChange={(event) => updateRow(rows, setRows, index, { is_published: event.target.checked })}
                />
                上架
              </label>
              <div className="actions">
                <button onClick={() => save(row)}>
                  <Save size={16} />
                  儲存
                </button>
                <button className="danger" onClick={() => del(row)}>
                  <Trash2 size={16} />
                  刪除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ContactAdmin() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(emptyContact);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data, error } = await supabase.from('contacts').select('*').order('name');
    setRows(data || []);
    if (error) setMsg(error.message);
  }

  async function save() {
    const payload = contactFields.reduce((result, field) => ({ ...result, [field]: form[field] || '' }), {});
    payload.is_active = Boolean(form.is_active);
    if (form.id) payload.id = form.id;

    const { error } = await supabase.from('contacts').upsert(payload);
    setMsg(error ? error.message : '通訊錄已儲存');
    if (!error) setForm(emptyContact);
    load();
  }

  async function del(id) {
    if (!confirm('確定刪除此筆通訊錄？')) return;
    const { error } = await supabase.from('contacts').delete().eq('id', id);
    setMsg(error ? error.message : '已刪除');
    load();
  }

  return (
    <section className="panel">
      <div className="sectionHead">
        <div>
          <h2>通訊錄管理</h2>
          <p>建立業務姓名、職稱、電話、地址、Email 與 LINE ID。</p>
        </div>
        <button className="secondary" onClick={() => setForm(emptyContact)}>
          清空表單
        </button>
      </div>
      <div className="formgrid">
        {contactFields.map((field) => (
          <label key={field} className="field">
            <span>
              {
                {
                  name: '姓名',
                  title: '職稱',
                  company: '公司',
                  phone: '電話',
                  address: '地址',
                  email: 'Email',
                  line_id: 'LINE ID'
                }[field]
              }
            </span>
            <input
              placeholder={
                {
                  name: '請輸入姓名',
                  title: '請輸入職稱',
                  company: '請輸入公司名稱',
                  phone: '請輸入電話',
                  address: '請輸入地址',
                  email: '請輸入 Email',
                  line_id: '請輸入 LINE ID'
                }[field]
              }
              value={form[field] || ''}
              onChange={(event) => setForm({ ...form, [field]: event.target.value })}
            />
          </label>
        ))}
        <label className="check">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(event) => setForm({ ...form, is_active: event.target.checked })}
          />
          啟用
        </label>
        <button disabled={!form.name} onClick={save}>
          新增 / 儲存
        </button>
      </div>
      {msg && <p className="status">{msg}</p>}
      {rows.length === 0 ? (
        <EmptyState title="尚未建立通訊錄" body="新增第一筆業務聯絡資訊後，前台就能套用到 DM。" />
      ) : (
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>姓名</th>
                <th>職稱</th>
                <th>公司</th>
                <th>電話</th>
                <th>狀態</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td data-label="姓名">{row.name}</td>
                  <td data-label="職稱">{row.title}</td>
                  <td data-label="公司">{row.company}</td>
                  <td data-label="電話">{row.phone}</td>
                  <td data-label="狀態">{row.is_active ? '啟用' : '停用'}</td>
                  <td data-label="操作" className="rowActions">
                    <button onClick={() => setForm(row)}>編輯</button>
                    <button className="danger" onClick={() => del(row.id)}>
                      刪除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function UserAdmin({ currentProfile }) {
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    setRows(data || []);
    if (error) setMsg(error.message);
  }

  async function save(row) {
    if (row.id === currentProfile?.id && row.is_active === false) {
      setMsg('不能停用目前登入中的管理員帳號。');
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: row.display_name,
        role: row.role,
        is_active: row.id === currentProfile?.id ? true : row.is_active
      })
      .eq('id', row.id);
    setMsg(error ? error.message : '使用者已更新');
    load();
  }

  return (
    <section className="panel">
      <div className="sectionHead">
        <div>
          <h2>使用者管理</h2>
          <p>管理帳號顯示名稱、角色與啟用狀態。</p>
        </div>
      </div>
      {msg && <p className="status">{msg}</p>}
      {rows.length === 0 ? (
        <EmptyState title="尚未讀取到使用者" body="註冊帳號後，使用者會出現在這裡。" />
      ) : (
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>顯示名稱</th>
                <th>Email</th>
                <th>角色</th>
                <th>啟用</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id}>
                  <td data-label="顯示名稱">
                    <label className="field tableField">
                      <span>顯示名稱</span>
                      <input
                        value={row.display_name || ''}
                        onChange={(event) => updateRow(rows, setRows, index, { display_name: event.target.value })}
                      />
                    </label>
                  </td>
                  <td data-label="Email">{row.email}</td>
                  <td data-label="角色">
                    <label className="field tableField">
                      <span>角色</span>
                      <select
                        value={row.role}
                        onChange={(event) => updateRow(rows, setRows, index, { role: event.target.value })}
                      >
                        <option value="sales">業務</option>
                        <option value="admin">管理員</option>
                      </select>
                    </label>
                  </td>
                  <td data-label="啟用">
                    <label className="check compact">
                      <input
                        type="checkbox"
                        checked={row.id === currentProfile?.id ? true : row.is_active}
                        disabled={row.id === currentProfile?.id}
                        onChange={(event) => updateRow(rows, setRows, index, { is_active: event.target.checked })}
                      />
                      {row.id === currentProfile?.id ? '目前帳號' : '啟用'}
                    </label>
                  </td>
                  <td data-label="操作">
                    <button onClick={() => save(row)}>
                      <Save size={16} />
                      儲存
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SettingsAdmin() {
  const [settings, setSettings] = useState(defaultSettings);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    supabase
      .from('design_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => setSettings(data || defaultSettings));
  }, []);

  async function save() {
    const payload = { ...settings, id: 1 };
    for (const key of numberSettings) payload[key] = Number(payload[key]);
    const { error } = await supabase.from('design_settings').upsert(payload);
    setMsg(error ? error.message : '樣式設定已儲存');
  }

  const fields = [
    ['font_family', '字體'],
    ['font_size', '字級'],
    ['font_weight', '粗細'],
    ['color', '顏色'],
    ['line_height', '行距'],
    ['letter_spacing', '字距'],
    ['contact_x', '聯絡資訊 X'],
    ['contact_y', '聯絡資訊 Y'],
    ['photo_x', '形象照 X'],
    ['photo_y', '形象照 Y'],
    ['photo_w', '形象照寬'],
    ['photo_h', '形象照高'],
    ['qr_x', 'QR X'],
    ['qr_y', 'QR Y'],
    ['qr_w', 'QR 寬'],
    ['qr_h', 'QR 高']
  ];

  return (
    <section className="panel">
      <div className="sectionHead">
        <div>
          <h2>聯絡資訊與圖片位置設定</h2>
          <p>畫布固定 1000 x 1414 px，座標與尺寸皆以像素設定。</p>
        </div>
        <button onClick={save}>
          <Save size={16} />
          儲存樣式
        </button>
      </div>
      <div className="formgrid">
        {fields.map(([key, label]) => (
          <label key={key} className="field">
            <span>{label}</span>
            <input
              type={key === 'color' ? 'color' : key === 'font_family' ? 'text' : 'number'}
              step="0.05"
              value={settings[key] ?? ''}
              onChange={(event) => setSettings({ ...settings, [key]: event.target.value })}
            />
          </label>
        ))}
      </div>
      {msg && <p className="status">{msg}</p>}
    </section>
  );
}

function EmptyState({ title, body }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

function usePreviewScale(ref) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!ref.current) return undefined;

    function update() {
      setScale(Math.min(1, ref.current.clientWidth / CANVAS_WIDTH));
    }

    update();
    const observer = new ResizeObserver(update);
    observer.observe(ref.current);
    return () => observer.disconnect();
  });

  return scale;
}

function updateRow(rows, setRows, index, patch) {
  const nextRows = [...rows];
  nextRows[index] = { ...nextRows[index], ...patch };
  setRows(nextRows);
}

createRoot(document.getElementById('root')).render(<App />);
