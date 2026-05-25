# 吉富 DM 套版系統

這是一個可直接部署到 GitHub Pages 的純前端 DM 套版系統，不需要建置流程。主要功能包含前台套版、後台模板管理、視覺化拖拉編輯、DM 上架 / 下架、使用者草稿隔離、紀錄保存、預覽與 PNG 下載。

## 部署到 GitHub Pages

1. 將 `index.html`、`styles.css`、`app.js`、`template.example.json` 放到 GitHub Pages 對應分支的根目錄。
2. 到 GitHub repository 的 Settings → Pages。
3. Source 選擇要部署的 branch，例如 `main`，資料夾選 `/root`。
4. 儲存後等待 Pages 完成發布。
5. 開啟 `https://jifudes01-crypto.github.io/jifu-dm-system/?v=20260522` 測試。

所有資源都使用相對路徑，網址帶 query string 也能正常載入，避免 GitHub Pages base path 或 router 造成白屏。

## 前台操作

1. 在「前台套版」選擇使用者與已上架 DM。
2. 填寫姓名、電話、職稱、地址、公司名稱、LINE ID、QR Code 標籤等欄位。
3. 每個文字欄位都可獨立調整 pt 數值，上限 50 pt。
4. 上傳個人形象照，系統會等比例裁切；偏高全身照會優先保留上半身到腰部附近。
5. 上傳 QR Code，系統會偵測內容邊界並裁切成正方形。
6. 按「完成套版並存紀錄」可在後台紀錄區保存，按「下載 DM 圖片」可下載 PNG。

## 後台操作

1. 在「後台管理」可上傳模板壓縮包、`template.json` 或空白 DM 圖片。
2. 可管理 DM 上架 / 下架。下架後前台不可見，後台仍保留設定與紀錄。
3. 可上傳 LOGO，並在「模板編輯」拖拉定位與調整大小。
4. 後台文字大小區域會清楚標示姓名 pt、電話 pt、職稱 pt、地址 pt、公司名稱 pt、LINE ID pt、QR Code 標籤 pt。
5. 在「模板編輯」可直接拖拉欄位，或調整 X/Y、寬高、圖層、文字大小、顏色與對齊。

## 模板壓縮包格式

壓縮包可包含：

- `template.json`
- 模板背景圖，例如 `template-background.png`
- LOGO、預覽圖或其他素材

`template.json` 參考 `template.example.json`。圖片路徑可填壓縮包內的檔名，系統匯入時會轉成可保存的資料格式。

## 資料保存

目前資料使用瀏覽器端 IndexedDB，並在容量允許時同步備份到 localStorage。不同使用者的前台草稿用 `userId + templateId` 分開保存，不會互相覆蓋。

GitHub Pages 是靜態網站，無法自行集中保存不同電腦的資料。後台已保留 API Endpoint 欄位，未來可串接 Supabase、Firebase 或自建 API，把 `userRecords` 同步到遠端資料庫。
