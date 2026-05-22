# 吉富工商地產 DM 雲端產生系統

這是一個可部署到 Vercel 的 React/Vite + Supabase 網站，用來集中管理吉富工商地產的 DM 圖檔、業務通訊錄，並讓業務快速產出帶有個人資訊、形象照與 QR Code 的 PNG 圖檔。

## 已完成功能

- Supabase Auth 登入 / 註冊。
- 角色權限：`admin` / `sales`。
- 管理後台：DM 批次上傳、名稱、分類、排序、上架 / 下架。
- 管理後台：通訊錄新增、編輯、停用。
- 管理後台：使用者顯示名稱、角色、啟用狀態管理。
- 管理後台：聯絡資訊文字樣式、形象照位置、QR Code 位置設定。
- 管理後台：SaaS 風格側邊導覽、資訊摘要、專業化表單與行動版資料卡。
- 業務前台：選擇 DM、選擇聯絡資訊、上傳形象照、上傳 QR Code、預覽、下載 PNG。
- Supabase 未設定時，會顯示建置提示，不會直接白畫面。
- 可部署至 Vercel。

## 專案結構

```text
src/main.jsx              網站主要畫面與功能
src/styles.css            視覺樣式與響應式版面
src/lib/supabase.js       Supabase 連線與上傳工具
supabase/schema.sql       資料庫、權限與 Storage policy
index.html                網站入口
vite.config.js            Vite React 設定
```

## 本機啟動

```bash
npm install
cp .env.example .env
npm run dev
```

`.env` 內容：

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
VITE_STORAGE_BUCKET=dm-assets
```

## Supabase 設定

### 1. 建立專案

到 Supabase 建立新專案。

### 2. 建立 Storage Bucket

在 Storage 建立 bucket：

```text
dm-assets
```

建議設為 Public bucket，因為 DM 圖檔需要在前台預覽與下載圖中顯示。

### 3. 執行資料庫 SQL

到 Supabase SQL Editor，貼上並執行：

```text
supabase/schema.sql
```

這份 SQL 會建立：

- `profiles`：使用者資料與角色。
- `dm_items`：DM 圖檔資料。
- `contacts`：業務通訊錄。
- `design_settings`：輸出位置與樣式設定。
- RLS 權限政策。
- Storage 權限政策。

### 4. 建立第一位管理員

先在網站註冊一個帳號，然後回到 Supabase SQL Editor 執行：

```sql
update public.profiles
set role = 'admin'
where email = '你的管理員Email';
```

完成後重新整理網站，即可看到「管理後台」。

## Vercel 部署

1. 將專案推到 GitHub。
2. 到 Vercel 匯入 GitHub repo。
3. 在 Vercel Project Settings → Environment Variables 新增：

```env
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_STORAGE_BUCKET
```

4. Deploy。

## GitHub Pages 部署

這個專案已經包含 `.github/workflows/deploy-pages.yml`，可用 GitHub Actions 自動部署到：

```text
https://你的帳號.github.io/jifu-dm-system/
```

請到 GitHub repo 的 Settings → Secrets and variables → Actions → New repository secret，新增：

```env
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_STORAGE_BUCKET
```

`VITE_STORAGE_BUCKET` 的值填：

```text
dm-assets
```

接著到 Settings → Pages，把 Source 改成 `GitHub Actions`。之後推送到 `main` 分支，就會自動建置並上線。

## 正式營運建議

- Supabase Auth 建議關閉公開註冊，改由管理員建立帳號或邀請業務。
- DM 底圖建議統一尺寸為 1000 x 1414 px，前台輸出會以此畫布產生 PNG。
- 如果要做印刷用高解析輸出，建議另做 PDF / 300dpi 輸出流程。
- 若圖片量增加，建議加入上傳前壓縮與命名規則。
