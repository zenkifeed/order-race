// Bầu trời, ánh sáng và thời tiết — Order Race / M3
//
// Sân đua nhìn từ TRÊN XUỐNG. Đó là ràng buộc chi phối cả file này, và nó loại
// bỏ ngay cách làm hiển nhiên: một dải trời xanh có mây ở mép trên khung hình.
// Nhìn từ trên xuống thì không có đường chân trời, nên một dải trời dán ở mép
// trên đọc ra thành một tấm hình nền lạc chỗ chứ không thành bầu trời.
//
// Thứ mà một cảnh nhìn từ trên xuống ĐỌC RA ĐƯỢC là ÁNH SÁNG chiếu xuống nó:
//
//   1. NỀN NGOÀI SÂN   Sắc trời hắt xuống mép khung hình, nơi cỏ không phủ tới.
//   2. BÓNG MÂY        Những vệt tối mềm trôi ngang qua mặt cỏ. Đây là thứ duy
//                      nhất trong cả file này nói "hôm nay trời nắng" mà không
//                      cần vẽ lấy một đám mây nào — và nó đúng về mặt hình học,
//                      vì bóng mây thì nhìn từ trên xuống mới thấy rõ nhất.
//   3. VỆT NẮNG        Một quầng sáng ấm lệch về một góc, trong TOẠ ĐỘ MÀN HÌNH.
//                      Nó thuộc về ống kính, không thuộc về cái sân.
//   4. THỜI TIẾT       Lớp hạt vẽ chồng lên tất cả, cũng trong toạ độ màn hình.
//
// Vì sao ba lớp trên nằm ở module riêng thay vì trong file HTML: chúng chạy mỗi
// khung hình, và mọi thứ chạy mỗi khung hình trong dự án này đều phải đo được
// bằng máy — xem tools/race/sky-selftest.mjs. Cùng lý lẽ đã có ở đầu
// tools/race/perf.mjs và tools/race/stage.mjs.
//
// KHÔNG DÙNG arc() Ở ĐƯỜNG ĐI MỖI KHUNG HÌNH. Cửa chạy thật ở
// tools/race/check-race-runtime.mjs đếm số lần gọi arc() để chứng minh lớp cắn
// nhau vẽ được vòng sao trên đầu con đang đơ — nếu thời tiết cũng gọi arc() thì
// phép đếm đó không còn chứng minh được điều nó tuyên bố. Hạt mưa là đoạn thẳng,
// hạt tuyết và cánh lá là ellipse, bóng mây là ảnh nướng sẵn.

import { TRACK_LEN, TRACK_HALF, trackHalfH } from "./track.mjs";

/**
 * Bảng màu của một kiểu trời.
 *
 * Màu mặt sân nằm CHUNG trong bảng này chứ không tách ra, vì ánh sáng và mặt đất
 * là một: mặt cỏ dưới nắng trưa và mặt cỏ dưới đèn pha ban đêm không phải cùng
 * một màu bị làm tối đi, chúng lệch cả sắc. Tách ra thì sớm muộn cũng có một tổ
 * hợp "trời sáng + cỏ đêm" lọt ra màn hình.
 */
export const SKIES = [
  {
    id: "ngay",
    name: "Trời sáng",
    // Nền ngoài sân: xanh trời ở mép trên, ấm dần xuống mép dưới.
    backdropTop: "#8fc6e8",
    backdropMid: "#bfe0ee",
    backdropBot: "#8bbfa0",
    // Quầng nắng trong toạ độ màn hình.
    sun: { x: 0.28, y: -0.1, r: 0.86, color: "255,242,205", alpha: 0.17 },
    // Bóng mây trôi trên mặt cỏ.
    cloud: { count: 9, alpha: 0.16, drift: 26, size: 460 },
    track: {
      grass: "#4d8f57",
      grassAlt: "#559a5f",
      hedge: "#2f6a3e",
      turf: "#3f7a4d",
      turfAlt: "#458454",
      line: "rgba(255,255,255,.20)",
      edge: "rgba(255,255,255,.46)",
      kerb: "#f2f4ee",
      kerbAlt: "#d0574a",
      shade: "rgba(10,26,16,.30)",
    },
  },
  {
    id: "binh_minh",
    name: "Sớm mai",
    backdropTop: "#b9c9e6",
    backdropMid: "#f3d9bc",
    backdropBot: "#9ab98f",
    sun: { x: 0.13, y: 0.0, r: 0.96, color: "255,224,168", alpha: 0.22 },
    cloud: { count: 6, alpha: 0.12, drift: 18, size: 520 },
    track: {
      grass: "#54895a",
      grassAlt: "#5d9463",
      hedge: "#3a6b45",
      turf: "#48774f",
      turfAlt: "#4f8156",
      line: "rgba(255,255,255,.19)",
      edge: "rgba(255,255,255,.44)",
      kerb: "#f6f1e4",
      kerbAlt: "#d9814a",
      shade: "rgba(40,26,12,.26)",
    },
  },
  {
    id: "hoang_hon",
    name: "Chiều vàng",
    backdropTop: "#7d8fbd",
    backdropMid: "#f0b678",
    backdropBot: "#8d8f63",
    sun: { x: 0.87, y: 0.05, r: 1.0, color: "255,196,120", alpha: 0.26 },
    cloud: { count: 7, alpha: 0.2, drift: 22, size: 560 },
    track: {
      grass: "#5a7d48",
      grassAlt: "#63874f",
      hedge: "#3e5c33",
      turf: "#4c6f42",
      turfAlt: "#547848",
      line: "rgba(255,244,220,.20)",
      edge: "rgba(255,244,220,.44)",
      kerb: "#f7ead2",
      kerbAlt: "#c4603f",
      shade: "rgba(60,28,8,.32)",
    },
  },
  {
    id: "dem",
    name: "Đèn pha",
    backdropTop: "#0a1016",
    backdropMid: "#12202b",
    backdropBot: "#0c1a18",
    sun: { x: 0.5, y: -0.05, r: 1.1, color: "180,215,255", alpha: 0.1 },
    cloud: { count: 4, alpha: 0.22, drift: 14, size: 620 },
    track: {
      grass: "#1b2b24",
      grassAlt: "#20332a",
      hedge: "#132018",
      turf: "#24443a",
      turfAlt: "#294c41",
      line: "rgba(200,230,255,.16)",
      edge: "rgba(200,230,255,.38)",
      kerb: "#cfe0dc",
      kerbAlt: "#8a4038",
      shade: "rgba(0,10,20,.42)",
    },
  },
];

const SKY_BY_ID = new Map(SKIES.map((s) => [s.id, s]));

/** Kiểu trời mặc định. Trời sáng, vì buổi trao thưởng nào cũng giữa ban ngày. */
export const DEFAULT_SKY = "ngay";

/** Tra bảng màu, luôn trả về một bảng có thật. */
export function skyPalette(id) {
  return SKY_BY_ID.get(id) || SKY_BY_ID.get(DEFAULT_SKY);
}

// =========================================================================
//  1. NỀN NGOÀI SÂN
// =========================================================================

/**
 * Tô nền một khung hình, trong TOẠ ĐỘ MÀN HÌNH.
 *
 * Một lệnh fillRect với một dải chuyển màu dựng sẵn. Dựng lại dải chuyển màu mỗi
 * khung hình cũng chạy được, nhưng nó cấp phát một đối tượng mỗi khung — đúng
 * nhóm rác mà cả tools/race/perf.mjs đi dọn — nên nó được nhớ lại theo chiều
 * cao khung hình và theo bảng màu.
 */
export function makeBackdrop(ctx, pal, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, pal.backdropTop);
  g.addColorStop(0.55, pal.backdropMid);
  g.addColorStop(1, pal.backdropBot);
  return { grad: g, h, id: pal.id };
}

/** Dải chuyển màu còn dùng lại được không? Sai một trong hai thì dựng lại. */
export const backdropStale = (cache, pal, h) => !cache || cache.h !== h || cache.id !== pal.id;

// =========================================================================
//  2. BÓNG MÂY
// =========================================================================

/**
 * Nướng một vệt mờ tròn dùng làm bóng mây.
 *
 * Nướng chứ không vẽ: một quầng chuyển màu bán kính là phép tô đắt nhất mà một
 * trình duyệt phải làm, và ở đây có chín cái mỗi khung hình. Nướng một lần rồi
 * lát lại thì mỗi cái còn đúng một lệnh drawImage.
 *
 * `makeCanvas(w, h)` phải trả về canvas có getContext("2d") — truyền vào thay vì
 * gọi document.createElement, để module này chạy được ngoài trình duyệt.
 */
export function bakeSoftBlob(makeCanvas, size, rgb) {
  const s = Math.max(8, Math.ceil(size));
  const cv = makeCanvas(s, s);
  const g = cv.getContext("2d");
  const r = s / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, "rgba(" + rgb + ",1)");
  grad.addColorStop(0.45, "rgba(" + rgb + ",.72)");
  grad.addColorStop(1, "rgba(" + rgb + ",0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  return { canvas: cv, size: s };
}

/**
 * Vị trí một bóng mây tại thời điểm `nowSec`, GHI VÀO đối tượng có sẵn.
 *
 * Suy ra từ chỉ số chứ không lưu trạng thái, cùng lý lẽ với lớp mưa: mây không
 * đáng để có một hồ chứa riêng, và cách này tái tạo được khi quay lại video.
 *
 * Trôi theo chiều ngang rồi cuộn vòng qua một dải rộng hơn cả đường đua, nên
 * không bao giờ có khoảnh khắc "hết mây" ở một đầu sân.
 */
export function cloudAt(out, i, nowSec, pal, halfH) {
  const c = pal.cloud;
  const seed = Math.imul(i + 1, 2654435761) >>> 0;
  const span = TRACK_LEN + 2400;
  const base = ((seed % 100000) / 100000) * span;
  let x = (base + nowSec * c.drift) % span;
  if (x < 0) x += span;
  out.x = x - TRACK_HALF - 1200;
  out.y = (((seed >>> 9) % 1000) / 1000) * (halfH * 2 + 460) - (halfH + 230);
  // Cỡ lệch nhau theo chỉ số: chín vệt bằng nhau đọc ra thành hoa văn lặp.
  out.r = c.size * (0.62 + (((seed >>> 19) % 100) / 100) * 0.75);
  return out;
}

/**
 * Lát bóng mây lên mặt cỏ, trong TOẠ ĐỘ SÂN.
 *
 * Trong toạ độ sân chứ không phải toạ độ màn hình, ngược với mưa và nắng: bóng
 * mây nằm TRÊN mặt đất, nên nó phải trượt qua khi máy quay chạy dọc đường đua và
 * phải to ra khi máy quay siết vào. Mưa thì không — xem chú thích ở drawWeather.
 *
 * Chỉ vẽ những vệt lọt vào khung hình. Ở mức phóng thường thì đó là hai tới ba
 * lệnh drawImage, không phải chín.
 */
export function drawCloudShadows(ctx, blob, pal, nowSec, camX, halfW, lanes, scratch) {
  if (!blob || pal.cloud.alpha <= 0) return 0;
  const halfH = trackHalfH(lanes);
  const prevAlpha = ctx.globalAlpha;
  let drawn = 0;
  for (let i = 0; i < pal.cloud.count; i++) {
    const c = cloudAt(scratch, i, nowSec, pal, halfH);
    if (c.x + c.r < camX - halfW || c.x - c.r > camX + halfW) continue;
    ctx.globalAlpha = pal.cloud.alpha;
    // Bẹt theo chiều dọc: bóng của một đám mây trên mặt đất phẳng là một hình
    // bầu dục, không phải hình tròn.
    ctx.drawImage(blob.canvas, c.x - c.r, c.y - c.r * 0.52, c.r * 2, c.r * 1.04);
    drawn++;
  }
  ctx.globalAlpha = prevAlpha;
  return drawn;
}

// =========================================================================
//  3. VỆT NẮNG
// =========================================================================

/**
 * Quầng nắng ấm, trong TOẠ ĐỘ MÀN HÌNH.
 *
 * Một lệnh drawImage của cùng cái vệt mờ đã nướng cho bóng mây, tô bằng chế độ
 * cộng sáng. Nó không di chuyển theo máy quay vì mặt trời ở xa vô hạn — nếu nó
 * trượt theo đường đua thì nó đọc ra thành một vũng sáng nằm trên mặt cỏ.
 */
export function drawSunWash(ctx, blob, pal, W, H) {
  if (!blob || !pal.sun || pal.sun.alpha <= 0) return 0;
  const s = pal.sun;
  const r = Math.max(W, H) * s.r;
  const prevAlpha = ctx.globalAlpha;
  const prevOp = ctx.globalCompositeOperation;
  ctx.globalAlpha = s.alpha;
  ctx.globalCompositeOperation = "lighter";
  ctx.drawImage(blob.canvas, W * s.x - r, H * s.y - r, r * 2, r * 2);
  ctx.globalCompositeOperation = prevOp;
  ctx.globalAlpha = prevAlpha;
  return 1;
}

// =========================================================================
//  4. THỜI TIẾT
// =========================================================================

/**
 * Thư viện thời tiết.
 *
 * `id` là thứ nằm trong cờ trình diễn của một biến thể (tools/race/modes.mjs),
 * nên đổi tên ở đây là đổi luôn dữ liệu biến thể — cửa ở sky-selftest.mjs canh
 * đúng chỗ nối đó.
 */
export const WEATHERS = [
  { id: "khong", name: "Quang mây" },
  { id: "mua", name: "Mưa" },
  { id: "tuyet", name: "Tuyết" },
  { id: "la", name: "Lá bay" },
  { id: "suong", name: "Sương sớm" },
];

const WEATHER_IDS = new Set(WEATHERS.map((w) => w.id));

export const isWeather = (id) => WEATHER_IDS.has(id);

/** Số hạt của từng kiểu. Đủ dày để thấy, đủ thưa để không che mất đàn chó. */
const WEATHER_COUNT = { khong: 0, mua: 90, tuyet: 110, la: 34, suong: 7 };

/**
 * Lớp thời tiết, vẽ trong TOẠ ĐỘ MÀN HÌNH chứ không phải toạ độ sân.
 *
 * Thời tiết thuộc về ống kính, không thuộc về cái sân: nó không được to ra khi
 * máy quay siết vào, và không được trượt đi khi máy quay chạy dọc đường đua. Vẽ
 * trong toạ độ sân thì nó làm cả hai, và đọc ra thành một tấm hoa văn dán lên
 * mặt đất. Đây là lỗi mà bản mưa đầu tiên mắc phải.
 *
 * Ngược lại hoàn toàn với bóng mây ở trên — bóng mây NẰM TRÊN mặt đất nên nó
 * phải trượt và phải phóng to. Hai lớp trông giống nhau về mã nhưng ở hai hệ toạ
 * độ khác nhau, và đổi nhầm hệ của một trong hai là lỗi nhìn thấy ngay.
 *
 * Vị trí suy ra từ chỉ số hạt và đồng hồ, không lưu trạng thái: lớp này không
 * đáng để có một hồ chứa riêng, và cách này tái tạo được khi quay lại video.
 *
 * `intensity` là hệ số biên độ của lớp cảm giác (MOTION). Giảm chuyển động thì
 * hạt thưa đi và chậm lại, nhưng KHÔNG bao giờ tắt hẳn — thời tiết là thông tin
 * về cảnh, không phải một hiệu ứng trang trí.
 *
 * @returns số hạt đã vẽ, để cửa kiểm thử đếm được
 */
export function drawWeather(ctx, kind, nowSec, W, H, dpr, intensity = 1) {
  if (!WEATHER_IDS.has(kind) || kind === "khong") return 0;
  const n = Math.max(1, Math.round(WEATHER_COUNT[kind] * (0.45 + 0.55 * intensity)));
  const speed = 0.5 + 0.5 * intensity;

  if (kind === "mua") return drawRainDrops(ctx, n, nowSec * speed, W, H, dpr);
  if (kind === "tuyet") return drawSnowFlakes(ctx, n, nowSec * speed, W, H, dpr);
  if (kind === "la") return drawLeaves(ctx, n, nowSec * speed, W, H, dpr);
  return drawMistBands(ctx, n, nowSec * speed, W, H, dpr);
}

/** Rải đều theo chỉ số, không theo Math.random — xem chú thích ở drawWeather. */
const spread = (i, mod) => ((i * 9301 + 49297) % mod) / mod;

function drawRainDrops(ctx, n, t, W, H, dpr) {
  ctx.strokeStyle = "rgba(198,214,232,.26)";
  ctx.lineWidth = 1.1 * dpr;
  ctx.beginPath();
  const drop = 26 * dpr;
  for (let i = 0; i < n; i++) {
    const speed = 900 + (i % 7) * 130;
    const x = spread(i, 233280) * W + ((i % 3) - 1) * 9 * dpr;
    const y = ((t * speed + i * 137) % (H + drop)) - drop;
    ctx.moveTo(x, y);
    ctx.lineTo(x - 4 * dpr, y + drop);
  }
  ctx.stroke();
  return n;
}

function drawSnowFlakes(ctx, n, t, W, H, dpr) {
  ctx.fillStyle = "rgba(244,249,255,.72)";
  for (let i = 0; i < n; i++) {
    const speed = 46 + (i % 9) * 13;
    const r = (1.1 + (i % 4) * 0.55) * dpr;
    // Trôi ngang theo hình sin: tuyết rơi thẳng đứng đọc ra thành mưa trắng.
    const sway = Math.sin(t * (0.5 + (i % 5) * 0.16) + i) * 24 * dpr;
    const x = spread(i, 199933) * W + sway;
    const y = ((t * speed + i * 191) % (H + 40 * dpr)) - 20 * dpr;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  return n;
}

const LEAF_TINT = ["rgba(214,142,58,.78)", "rgba(186,96,44,.74)", "rgba(150,158,62,.70)"];

function drawLeaves(ctx, n, t, W, H, dpr) {
  for (let i = 0; i < n; i++) {
    const speed = 62 + (i % 6) * 22;
    const w = (5 + (i % 4) * 2.4) * dpr;
    const sway = Math.sin(t * (0.7 + (i % 4) * 0.2) + i * 1.7) * 46 * dpr;
    const x = spread(i, 174763) * W + sway;
    const y = ((t * speed + i * 211) % (H + 60 * dpr)) - 30 * dpr;
    ctx.fillStyle = LEAF_TINT[i % LEAF_TINT.length];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * (0.9 + (i % 3) * 0.4) + i);
    ctx.beginPath();
    ctx.ellipse(0, 0, w, w * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  return n;
}

/**
 * Sương: những dải mờ nằm ngang trôi chậm, không phải hạt.
 *
 * Bảy dải rộng thay cho hàng trăm hạt nhỏ. Sương KHÔNG có hạt — vẽ nó bằng hạt
 * thì ra một màn bụi, và một màn bụi phủ lên đàn chó là thứ che mất chính cuộc
 * đua mà nó đang trang trí.
 */
function drawMistBands(ctx, n, t, W, H, dpr) {
  ctx.fillStyle = "rgba(228,238,240,.055)";
  for (let i = 0; i < n; i++) {
    const h = (34 + (i % 4) * 26) * dpr;
    const speed = 9 + (i % 5) * 6;
    const y = ((spread(i, 121631) * (H + h) + t * speed * 0.35) % (H + h)) - h;
    const x = ((t * speed + i * 320) % (W + 260 * dpr)) - 130 * dpr;
    ctx.fillRect(x - W * 0.3, y, W * 1.6, h);
  }
  return n;
}
