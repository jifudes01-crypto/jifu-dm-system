/* JIFU_DIRECT_OVERLAY_FINAL */

//
// 固定模板座標模式
// 不再自動排版
//

var nameX = 1045;
var nameY = 154;

var titleX = 1260;
var titleY = 154;

var phoneX = 1050;
var phoneY = 245;

var companyX = 1050;
var companyY = 337;

var qrX = 1340;
var qrY = 108;
var qrSize = 128;

var photoX = 1458;
var photoY = 92;
var photoW = 178;
var photoH = 272;

//
// 單圖靠右
//
function getAssetLayout(hasPhoto, hasQr){
  if(hasPhoto && hasQr){
    return {
      qr:{x:1340,y:108,size:128},
      photo:{x:1458,y:92,w:178,h:272}
    };
  }

  if(hasPhoto){
    return {
      photo:{x:1458,y:92,w:178,h:272}
    };
  }

  if(hasQr){
    return {
      qr:{x:1458,y:108,size:128}
    };
  }

  return {};
}

console.log("JIFU Photoshop Template Mode Enabled");
