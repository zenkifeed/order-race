// Sân đua — Order Race / M3
//
// Đường đua là hình TĨNH. Nó không đổi một điểm ảnh nào trong suốt 40 giây. Vậy
// mà bản đầu tô lại toàn bộ nó mỗi khung hình, sáu mươi lần mỗi giây. Phép tính
// thì rẻ; cái đắt là DIỆN TÍCH TÔ, và trên máy tích hợp đồ hoạ — đúng loại máy
// đem đi họp — băng thông tô mới là thứ hết trước.
//
// Nướng sẵn rồi mỗi khung chỉ còn vài lệnh drawImage. Cùng lý lẽ đã có ở đầu
// tools/web/dog.mjs cho đàn chó, áp cho cái sân.
//
// NƯỚNG MỘT KHOANH RỒI LÁT, KHÔNG NƯỚNG CẢ TẤM. Sân thẳng dài 4 200 đơn vị;
// nướng cả tấm ở 2× là một ảnh rộng 8 480 điểm ảnh. Chrome chịu được, Safari
// thì có máy trần 4 096 — và một trang trắng trên máy của người khác là kiểu
// hỏng không ai gỡ được giữa buổi lễ. Sân thẳng thì lặp lại y hệt theo chiều
// ngang, nên một khoanh 512 đơn vị lát ngang qua đúng phần đang nhìn thấy là
// đủ, tốn chừng năm lệnh vẽ.
//
// Hàm tô nhận vào "thứ giống ngữ cảnh canvas" chứ không nhận canvas thật, nên
// cửa hiệu năng đếm được số lệnh vẽ mà không cần trình duyệt.

import { TRACK_LEN, TRACK_HALF, laneWFor, trackHalfH } from "./track.mjs";
import { skyPalette } from "./sky.mjs";

/** Bề ngang một khoanh sân, tính bằng đơn vị sân. */
export const TILE_W = 512;

/**
 * Chừa mép trên dưới cho vành cỏ ngoài đường chạy.
 *
 * Rộng hơn bản trước (26 → 74) vì giờ vành cỏ có việc để làm: nó mang hàng rào
 * cây, vành đá đỏ trắng và dải cỏ cắt sọc. Một vành 26 đơn vị chỉ đủ chỗ cho
 * một đường viền, và một đường viền thì không phải một cái sân.
 */
const EDGE = 74;

/**
 * Bề ngang một sọc cỏ cắt. PHẢI chia hết TILE_W.
 *
 * Nếu không chia hết thì sọc cuối của khoanh này và sọc đầu của khoanh sau có bề
 * ngang khác nhau, và chỗ nối hiện ra thành một đường sọc dọc chạy ngang màn
 * hình — đúng cái bẫy mà chú thích ở paintTile cảnh báo, chỉ khác là nó không lộ
 * ra cho tới khi máy quay đi qua đúng chỗ nối.
 */
const MOW = TILE_W / 8;

/** Bề ngang một ô vành đá đỏ trắng. Cũng phải chia hết TILE_W. */
const KERB = TILE_W / 16;

/**
 * Tô một khoanh sân, gốc toạ độ ở mép trái khoanh, giữa theo chiều dọc.
 *
 * Khoanh phải LÁT KHÍT: mọi hoa văn đều lặp theo một ước của TILE_W, không có
 * hoa văn nào phụ thuộc vị trí tuyệt đối. Nếu có thì chỗ nối giữa hai khoanh sẽ
 * hiện ra thành một đường sọc chạy dọc màn hình, và nó chỉ lộ ra khi máy quay đi
 * qua đúng chỗ đó.
 *
 * `sky` là id bảng màu ở tools/race/sky.mjs. Màu mặt sân đi cùng bảng màu trời
 * chứ không tách ra: mặt cỏ dưới nắng trưa và mặt cỏ dưới đèn pha ban đêm lệch
 * cả sắc, không phải cùng một màu bị làm tối đi.
 */
export function paintTile(g, lanes, sky) {
  const halfH = trackHalfH(lanes);
  const laneW = laneWFor(lanes);
  const T = skyPalette(sky).track;
  const outer = halfH + EDGE;

  // --- Vành cỏ ngoài đường chạy, cắt sọc.
  g.fillStyle = T.grass;
  g.fillRect(0, -outer, TILE_W, outer * 2);
  g.fillStyle = T.grassAlt;
  for (let x = 0; x < TILE_W; x += MOW * 2) g.fillRect(x, -outer, MOW, outer * 2);

  // --- Hàng rào cây ở rìa ngoài cùng. Chỉ là một dải đậm cộng những bụi tròn
  //     nhô lên — nhìn từ trên xuống thì một cái cây ĐÚNG LÀ một bụi tròn, và
  //     vẽ chi tiết hơn thế là vẽ thứ không ai nhìn thấy ở mức phóng 1,2×.
  g.fillStyle = T.hedge;
  g.fillRect(0, -outer, TILE_W, 15);
  g.fillRect(0, outer - 15, TILE_W, 15);
  for (let x = MOW / 2; x < TILE_W; x += MOW) {
    for (const side of [-1, 1]) {
      g.beginPath();
      g.ellipse(x, side * (outer - 15), 15, 12, 0, 0, Math.PI * 2);
      g.fill();
    }
  }

  // --- Mặt đường chạy, cũng cắt sọc nhưng LỆCH PHA nửa sọc so với vành cỏ, để
  //     hai vùng không đọc ra thành một tấm sọc liền.
  g.fillStyle = T.turf;
  g.fillRect(0, -halfH, TILE_W, halfH * 2);
  g.fillStyle = T.turfAlt;
  for (let x = MOW; x < TILE_W; x += MOW * 2) g.fillRect(x, -halfH, MOW, halfH * 2);

  // --- Bóng đổ ở hai mép đường chạy: mặt sân sáng đều từ mép này sang mép kia
  //     đọc ra phẳng lì. Hai dải tối mỏng đủ để nó có bề dày.
  const shade = g.createLinearGradient(0, -halfH, 0, halfH);
  shade.addColorStop(0, T.shade);
  shade.addColorStop(0.16, "rgba(0,0,0,0)");
  shade.addColorStop(0.84, "rgba(0,0,0,0)");
  shade.addColorStop(1, T.shade);
  g.fillStyle = shade;
  g.fillRect(0, -halfH, TILE_W, halfH * 2);

  // --- Vạch làn.
  g.strokeStyle = T.line;
  g.lineWidth = 1.5;
  for (let i = 1; i < lanes; i++) {
    const y = -halfH + i * laneW;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(TILE_W, y);
    g.stroke();
  }

  // --- Mép đường chạy: một vạch trắng liền, rồi vành đá đỏ trắng nằm ngoài nó.
  g.fillStyle = T.edge;
  g.fillRect(0, -halfH - 2.5, TILE_W, 2.5);
  g.fillRect(0, halfH, TILE_W, 2.5);
  for (let x = 0; x < TILE_W; x += KERB) {
    g.fillStyle = (x / KERB) % 2 ? T.kerbAlt : T.kerb;
    g.fillRect(x, -halfH - 9, KERB, 6.5);
    g.fillRect(x, halfH + 2.5, KERB, 6.5);
  }
}

/**
 * Nướng một khoanh thành ảnh dùng lại.
 *
 * `makeCanvas(w, h)` phải trả về canvas có `getContext("2d")`. Truyền vào thay
 * vì gọi document.createElement, để module này chạy được ngoài trình duyệt.
 *
 * `supersample` cố định ở 2, không theo mức phóng: mức phóng chạy từ 1,45× tới
 * khoảng 1,9× trong pha về đích, nên nướng ở 2× thì ảnh luôn còn dư điểm ảnh.
 * Nướng theo mức phóng thì mỗi lần máy quay siết vào lại phải nướng lại — đúng
 * vào đoạn cần khung hình mượt nhất.
 */
export function bakeTile(makeCanvas, lanes, supersample = 2, sky) {
  const halfH = trackHalfH(lanes) + EDGE;
  const w = Math.ceil(TILE_W * supersample);
  const h = Math.ceil(halfH * 2 * supersample);
  const cv = makeCanvas(w, h);
  const g = cv.getContext("2d");
  g.setTransform(supersample, 0, 0, supersample, 0, halfH * supersample);
  paintTile(g, lanes, sky);
  g.setTransform(1, 0, 0, 1, 0, 0);
  return { canvas: cv, w: TILE_W, h: halfH * 2, halfH, lanes, sky };
}

/**
 * Lát khoanh sân qua đúng phần đang nhìn thấy.
 *
 * Số lệnh vẽ phụ thuộc bề rộng khung hình, KHÔNG phụ thuộc chiều dài đường đua.
 * Đó là điều khiến cách này chịu được một sân dài bao nhiêu cũng được.
 */
export function drawTiledTrack(ctx, tile, camX, halfW) {
  const left = Math.max(-TRACK_HALF, camX - halfW - TILE_W);
  const right = Math.min(TRACK_HALF, camX + halfW + TILE_W);
  const first = Math.floor((left + TRACK_HALF) / TILE_W);
  const last = Math.ceil((right + TRACK_HALF) / TILE_W);
  let drawn = 0;
  for (let i = first; i < last; i++) {
    const x = -TRACK_HALF + i * TILE_W;
    ctx.drawImage(tile.canvas, x, -tile.halfH, tile.w, tile.h);
    drawn++;
  }
  return drawn;
}

/**
 * Vạch xuất phát và vạch đích.
 *
 * Vẽ riêng chứ không nướng vào khoanh, vì mỗi cái chỉ có một trên cả đường đua
 * — nướng vào khoanh thì chúng lặp lại ở mọi khoanh. Chỉ vẽ khi nằm trong khung
 * hình, nên phần lớn thời gian chúng không tốn lệnh nào.
 */
export function drawMarkers(ctx, lanes, camX, halfW, sky) {
  const halfH = trackHalfH(lanes);
  const T = skyPalette(sky).track;
  let drawn = 0;

  if (Math.abs(-TRACK_HALF - camX) < halfW + 80) {
    // Chuồng xuất phát: một dải sẫm chắn ngang, chia ô theo làn. Bản trước chỉ
    // có một vạch trắng mảnh, và một vạch mảnh trên nền sọc thì đọc ra thành
    // một vạch làn nữa chứ không thành vạch xuất phát.
    const laneW = laneWFor(lanes);
    ctx.fillStyle = "rgba(18,26,20,.62)";
    ctx.fillRect(-TRACK_HALF - 26, -halfH, 26, halfH * 2);
    drawn++;
    ctx.fillStyle = T.edge;
    ctx.fillRect(-TRACK_HALF - 2, -halfH, 4, halfH * 2);
    drawn++;
    ctx.fillStyle = T.kerb;
    for (let i = 0; i <= lanes; i++) {
      ctx.fillRect(-TRACK_HALF - 26, -halfH + i * laneW - 1, 26, 2);
      drawn++;
    }
  }

  if (Math.abs(TRACK_HALF - camX) < halfW + 110) {
    // Ô bàn cờ: hai cột, ô đen trắng so le. Đây là thứ duy nhất trên sân mà
    // khán giả cần đọc ra ngay lập tức, nên nó không dùng bảng màu trầm của
    // phần còn lại.
    const cell = 14;
    const rows = Math.ceil((halfH * 2) / cell);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < 2; c++) {
        ctx.fillStyle = (r + c) % 2 ? "#f2f4ee" : "#1b211c";
        ctx.fillRect(TRACK_HALF + c * cell - cell, -halfH + r * cell, cell, cell);
        drawn++;
      }
    }
    // Hai cột cờ đích, nhô ra khỏi hai mép đường chạy. Chúng nằm NGOÀI vành cỏ
    // nên không đè lên con nào, và chúng là thứ đầu tiên lọt vào khung hình khi
    // máy quay tiến tới vạch đích.
    ctx.fillStyle = T.kerbAlt;
    ctx.fillRect(TRACK_HALF - cell, -halfH - 46, cell * 2, 40);
    ctx.fillRect(TRACK_HALF - cell, halfH + 6, cell * 2, 40);
    drawn += 2;
  }
  return drawn;
}

/**
 * Ngữ cảnh 2D giả, chỉ đếm lệnh.
 *
 * Cùng mẹo với tools/web/roster-input-selftest.mjs: thứ không click thử được
 * thì dựng một cái giả rồi kiểm trên đó. Ở đây thứ không đo được là chi phí tô
 * của một trình duyệt, nên cái đo được là SỐ LỆNH gửi xuống — và số lệnh chính
 * là thứ mà việc nướng sân cắt đi.
 */
export function makeCountingCtx() {
  const counts = new Map();
  const bump = (k) => counts.set(k, (counts.get(k) || 0) + 1);
  const noop = (k) => () => bump(k);
  const ctx = {
    counts,
    total() {
      let t = 0;
      for (const v of counts.values()) t += v;
      return t;
    },
    get(k) { return counts.get(k) || 0; },
    reset() { counts.clear(); },
    beginPath: noop("beginPath"),
    moveTo: noop("moveTo"),
    lineTo: noop("lineTo"),
    arc: noop("arc"),
    ellipse: noop("ellipse"),
    closePath: noop("closePath"),
    stroke: noop("stroke"),
    fill: noop("fill"),
    fillRect: noop("fillRect"),
    fillText: noop("fillText"),
    roundRect: noop("roundRect"),
    drawImage: noop("drawImage"),
    save: noop("save"),
    restore: noop("restore"),
    translate: noop("translate"),
    rotate: noop("rotate"),
    scale: noop("scale"),
    setTransform: noop("setTransform"),
    measureText: (t) => { bump("measureText"); return { width: String(t).length * 7 }; },
    // Dải chuyển màu KHÔNG được tính là một lệnh vẽ: nó không tô gì cả, nó chỉ
    // dựng ra một kiểu tô. Lệnh vẽ là cái fillRect dùng nó — đếm cả hai thì một
    // cái bóng đổ hoá ra đắt gấp đôi một mảng màu phẳng, mà thật ra chúng bằng
    // nhau.
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
  };
  ctx.strokeStyle = "";
  ctx.fillStyle = "";
  ctx.lineWidth = 0;
  ctx.font = "";
  ctx.textAlign = "";
  ctx.textBaseline = "";
  ctx.globalAlpha = 1;
  return ctx;
}
