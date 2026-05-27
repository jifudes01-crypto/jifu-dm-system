/* JIFU_CONTACT_TEXT_POSITION_FIX_FINAL */

/*
只修正：
1. 文字不要壓線
2. 名字與職稱同行
3. 電話位置正常
4. 公司名稱位置正常
5. 不動原本聯絡框
6. 不動 QR / 形象照邏輯
*/

// ===== 文字固定座標 =====

var nameX = 1048;
var nameY = 132;

var titleX = 1265;
var titleY = 132;

var phoneX = 1052;
var phoneY = 214;

var companyX = 1052;
var companyY = 302;

// ===== 字級 =====

var nameSize = 48;
var titleSize = 28;
var phoneSize = 52;
var companySize = 42;

// ===== QR =====

var qrX = 1342;
var qrY = 104;
var qrSize = 128;

// ===== 形象照 =====

var photoX = 1455;
var photoY = 92;
var photoW = 178;
var photoH = 272;

console.log("JIFU Contact Text Position Fix Final");
