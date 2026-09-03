// Nhân vật chó chibi — Order Race
//
// Vẽ bằng canvas 2D, không một file ảnh nào: trang vẫn tự chứa và vẫn mở được
// bằng file://. Đây cũng là cách trang tham chiếu 3D làm (xem GDD §11) và là lý
// do build của họ nhẹ dù có 3D.
//
// NƯỚNG SẴN THÀNH SPRITE, KHÔNG VẼ LẠI MỖI KHUNG HÌNH. Một chú chó là khoảng
// mười lệnh vẽ đường; nhân với 150 con và 60 khung hình mỗi giây là chín chục
// nghìn lệnh mỗi giây. Nướng một lần lúc bắt đầu lượt rồi mỗi khung chỉ còn một
// lệnh drawImage cho mỗi con. Đúng quy tắc "cache theo khoá nội dung, dùng lại"
// của lớp cảm giác, và đúng bài học đo được ở GDD §11.
//
// TÊN NẰM TRÊN CHÍNH CON VẬT, không phải biển bay lơ lửng. Biển bay thì phải
// tránh đè nhau nên luôn có người không được hiện tên. Tên nướng thẳng vào
// sprite thì mỗi model luôn mang tên của mình, không có ngoại lệ.

const FUR = [
  "#e2574c", "#4a86e8", "#8e9aa4", "#f2b134", "#7bc86c", "#b57edc", "#e08a4b", "#3fb8af",
  "#d95f8a", "#6f8fd6", "#c9a227", "#5aa469", "#a4634d", "#7f8fa6", "#e6785e", "#4f9d9d",
];
const PATTERN = ["tron", "dom", "soc", "mang", "tat", "matna", "yen", "taile"];
const ACC = ["khong", "mu", "khan", "kinh", "no", "vanhtai", "mucao", "vongco",
             "chomtoc", "mubaseball", "khanco", "hoatai"];
const SILK = ["#cf3a26", "#2a5fbf", "#8b8f86", "#2b2f2c", "#dd8318", "#0f6b47"];

const INK = "#1a1410";

export function hashName(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/**
 * Ngoại hình suy ra từ tên: một người luôn có cùng con chó ở mọi buổi.
 * 16 × 8 × 12 × 6 = 9 216 tổ hợp — xem GDD §9.
 */
export function dogLook(name, bump = 0) {
  const h = hashName(name);
  return {
    fur: FUR[h % FUR.length],
    pattern: PATTERN[(h >>> 4) % PATTERN.length],
    acc: ACC[((h >>> 9) + bump) % ACC.length],
    silk: SILK[(h >>> 14) % SILK.length],
  };
}

const lookKey = (l) => l.fur + "|" + l.pattern + "|" + l.acc + "|" + l.silk;

/**
 * Gán ngoại hình cho cả danh sách, gỡ trùng.
 *
 * Với 150 người rút từ 9 216 tổ hợp thì vẫn còn vài cặp trùng theo nghịch lý
 * ngày sinh. Người đứng trước giữ nguyên, người trùng bị đẩy chỉ số phụ kiện
 * cho tới khi khác — nên chỉ rất ít người bị đổi khi danh sách thay đổi. Đánh
 * đổi có ý thức: ưu tiên tính ổn định hơn là tuyệt đối. Xem GDD §9.
 */
export function assignLooks(names) {
  const used = new Set();
  return names.map((name) => {
    for (let bump = 0; bump < ACC.length; bump++) {
      const look = dogLook(name, bump);
      const key = lookKey(look);
      if (!used.has(key)) { used.add(key); return look; }
    }
    return dogLook(name, 0);
  });
}

// ─────────────────────────────────────────────────────────────────────────
//  Vẽ
// ─────────────────────────────────────────────────────────────────────────
const ART_W = 96;    // bề ngang vùng vẽ con chó trong sprite
const ART_H = 62;    // chiều cao vùng vẽ con chó
const PLATE_H = 20;  // chiều cao biển tên gắn dưới chân

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

// ─────────────────────────────────────────────────────────────────────────
//  Nhịp chân
//
//  Bốn cái chân cũ là bốn hình chữ nhật NẰM CHẾT trong sprite thân. Cả đàn
//  nhấp nhô và nén giãn theo quãng đường, nhưng chân thì không nhúc nhích —
//  và một con vật trượt trên mặt cỏ với bốn cái que cứng đơ đọc ra thành đồ
//  vật đang bị kéo, không thành sinh vật đang chạy.
//
//  NƯỚNG THÀNH DẢI TƯ THẾ, KHÔNG VẼ LẠI MỖI KHUNG HÌNH. Điều khoản của lớp
//  cảm giác — "đừng cấp phát trên đường đi nóng của hiệu ứng" — vẫn giữ
//  nguyên: thêm juice mà mỗi khung hình lại dựng đường vẽ mới thì đúng vào
//  cái bẫy mà cả file này được viết ra để tránh.
//
//  DẢI CHÂN DÙNG CHUNG GIỮA CÁC CON. Chân chỉ phụ thuộc MÀU LÔNG và việc có
//  đi tất hay không — hoạ tiết thân bị cắt trong khung thân, phụ kiện thì ở
//  trên đầu. 16 màu × 2 = nhiều nhất 32 dải cho cả đàn 150 con, thay vì 150
//  dải. Không có chỗ dùng chung này thì chín tư thế × 150 con là hơn hai chục
//  megabyte ảnh, tức là đổi một cái chân biết chạy lấy một cú khựng lúc mở.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Số tư thế trong một sải chân.
 *
 * Mười, không phải tám. Ở đàn 45 người thì một sải kéo dài chừng 0,6 giây, nên
 * tám khung là mười ba tư thế mỗi giây — đủ để thấy chân chạy, nhưng nó giật
 * bên cạnh một cái thân nhấp nhô mượt hoàn toàn, và chính chỗ chênh đó là thứ
 * mắt bắt được. Mười khung tốn thêm chừng hai megabyte ảnh cho cả đàn.
 */
export const GALLOP_FRAMES = 10;

/** Tư thế đứng yên, nằm ngay sau dải sải chân. Dùng lúc xếp hàng và lúc nằm đơ. */
export const NEUTRAL_FRAME = GALLOP_FRAMES;

const LEG_W = 9;
const LEG_LEN = 15;

/**
 * Bốn cái hông: tâm ngang, đỉnh chân, và lệch pha trong vòng sải.
 *
 * Hai chân sau lệch pha π so với hai chân trước — đó là cú nhảy chồm của loài
 * bốn chân: sau đạp thì trước với, không phải bốn cái cùng lúc. Trong mỗi cặp
 * còn lệch thêm một chút để chân gần và chân xa không dính làm một.
 */
const HIPS = [
  { x: 31.5, y: 40, ph: 0 },                 // sau — xa
  { x: 42.5, y: 41, ph: 0.42 },              // sau — gần
  { x: 62.5, y: 41, ph: Math.PI },           // trước — xa
  { x: 73.5, y: 40, ph: Math.PI + 0.42 },    // trước — gần
];

/**
 * Biên độ đưa chân, radian.
 *
 * Rộng hơn mức "đúng giải phẫu", và cố ý. Trên sân, một chú chó cao chừng bốn
 * mươi điểm ảnh và cái chân dài chừng mười — sải 35 độ ở cỡ đó là bàn chân
 * nhích đi bốn điểm ảnh, tức là không ai thấy. 49 độ đưa nó lên tám, và tám
 * điểm ảnh thì đọc ra được từ cuối phòng, kể cả trên máy chiếu.
 */
const SWING = 0.85;
/** Mức co chân lúc thu về trước, theo tỉ lệ chiều dài chân. */
const TUCK = 0.30;

/**
 * Tư thế bốn chân ở một khung trong sải.
 *
 * Thuần tính toán, không đụng canvas — nên kiểm thử được bằng máy ngoài trình
 * duyệt, xem tools/web/dog-selftest.mjs.
 *
 * Chân duỗi hết cỡ trong lúc QUÉT VỀ SAU (đó là lúc nó chạm đất và đẩy) và co
 * lại trong lúc THU VỀ TRƯỚC (lúc nó nhấc khỏi mặt cỏ). Làm ngược lại thì bàn
 * chân cày xuống đất trên đường thu về, và mắt đọc ra ngay thành trượt băng.
 *
 * @param frame  0…GALLOP_FRAMES-1 là một vòng sải; GALLOP_FRAMES là tư thế đứng
 * @param amp    biên độ, 0 là đứng thẳng hoàn toàn (dùng cho giảm chuyển động)
 */
export function legPose(frame, amp = 1, frames = GALLOP_FRAMES) {
  const still = frame >= frames || amp <= 0;
  const u = (frame / frames) * Math.PI * 2;
  return HIPS.map((hip) => {
    if (still) return { x: hip.x, y: hip.y, angle: 0, len: LEG_LEN };
    const a = u + hip.ph;
    return {
      x: hip.x,
      y: hip.y,
      angle: SWING * amp * Math.sin(a),
      len: LEG_LEN * (1 - TUCK * amp * Math.max(0, Math.cos(a))),
    };
  });
}

/**
 * Khung chứa cả bốn chân lúc đưa hết cỡ, CỘNG cái bóng dưới chân.
 *
 * Bóng đi cùng chân chứ không ở lại với thân, vì thứ tự vẽ là bóng → chân →
 * thân. Để bóng lại trong sprite thân thì nó phủ lên bàn chân, và vệt tốc độ
 * — vốn chỉ vẽ lại sprite thân — sẽ kéo theo một hàng bóng bay lơ lửng.
 *
 * Xuất ra ngoài để kiểm thử được: một cái chân thò ra khỏi khung này thì bị cắt
 * cụt, và nó chỉ cụt ở vài khung giữa sải — tức là đúng loại lỗi mà mở trang
 * nhìn một cái không bắt được. Xem tools/web/dog-selftest.mjs.
 */
export const LEG_GEOMETRY = {
  box: { x: 11, y: 34, w: 84, h: 32 },
  legW: LEG_W,
  legLen: LEG_LEN,
  hips: HIPS,
};
const LEG_BOX = LEG_GEOMETRY.box;

function drawGroundShadow(g) {
  g.fillStyle = "rgba(0,0,0,.22)";
  g.beginPath();
  g.ellipse(ART_W / 2, ART_H - 4, 30, 5, 0, 0, Math.PI * 2);
  g.fill();
}

function drawLegs(g, look, frame, amp) {
  const fur = look.fur;
  const socks = look.pattern === "tat";

  g.save();
  g.lineWidth = 2.2;
  g.strokeStyle = INK;
  g.lineJoin = "round";

  for (const leg of legPose(frame, amp)) {
    g.save();
    g.translate(leg.x, leg.y);
    g.rotate(leg.angle);
    g.fillStyle = fur;
    roundRect(g, -LEG_W / 2, 0, LEG_W, leg.len, 4);
    g.fill();
    g.stroke();
    if (socks) {
      g.fillStyle = "rgba(255,255,255,.72)";
      roundRect(g, -LEG_W / 2, leg.len - 7, LEG_W, 7, 3);
      g.fill();
    }
    g.restore();
  }
  g.restore();
}

/**
 * Thân, đầu, đuôi — nhìn ngang, hướng sang phải.
 *
 * KHÔNG có chân: chân nằm ở drawLegs và được nướng thành một dải tư thế riêng,
 * vì chân là thứ duy nhất trên con chó phải đổi theo từng khung hình.
 */
function drawBody(g, look) {
  const fur = look.fur;

  g.save();
  g.lineWidth = 2.2;
  g.strokeStyle = INK;
  g.lineJoin = "round";

  // đuôi
  g.strokeStyle = fur;
  g.lineWidth = 7;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(20, 30);
  g.quadraticCurveTo(8, 26, 11, 15);
  g.stroke();
  g.strokeStyle = INK;
  g.lineWidth = 2.2;
  g.beginPath();
  g.moveTo(20, 30);
  g.quadraticCurveTo(8, 26, 11, 15);
  g.stroke();

  // thân
  g.fillStyle = fur;
  roundRect(g, 20, 22, 58, 24, 12);
  g.fill();
  g.stroke();

  // cổ và đầu
  g.beginPath();
  g.ellipse(72, 20, 16, 15, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();

  // tai cụp
  g.beginPath();
  g.ellipse(65, 9, 6.5, 10, -0.45, 0, Math.PI * 2);
  g.fill();
  g.stroke();

  // mõm
  g.fillStyle = "#f6ead8";
  roundRect(g, 80, 20, 14, 11, 5);
  g.fill();
  g.stroke();

  // mũi
  g.fillStyle = INK;
  g.beginPath();
  g.ellipse(92, 23, 2.6, 2.1, 0, 0, Math.PI * 2);
  g.fill();

  // mắt
  g.beginPath();
  g.arc(78, 16, 3.1, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#fff";
  g.beginPath();
  g.arc(79, 15, 1.1, 0, Math.PI * 2);
  g.fill();

  g.restore();
}

/**
 * Hoạ tiết, cắt gọn trong thân để không tràn ra ngoài viền.
 *
 * "tat" — bốn chiếc tất trắng — không còn ở đây: nó nằm trên CHÂN, và chân giờ
 * đổi tư thế mỗi khung hình. Vẽ tất theo toạ độ cũ thì bốn vệt trắng đứng yên
 * trong khi bàn chân đã chạy đi mất.
 */
function drawPattern(g, look) {
  if (look.pattern === "tron" || look.pattern === "tat") return;

  g.save();
  roundRect(g, 20, 22, 58, 24, 12);
  g.clip();
  g.fillStyle = "rgba(0,0,0,.2)";

  switch (look.pattern) {
    case "dom":
      for (const [x, y, r] of [[32, 30, 5], [46, 38, 4], [60, 29, 5.5], [40, 27, 3]]) {
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      }
      break;
    case "soc":
      for (let x = 26; x < 78; x += 11) g.fillRect(x, 20, 4.5, 30);
      break;
    case "mang":
      g.beginPath(); g.ellipse(58, 34, 18, 14, 0, 0, Math.PI * 2); g.fill();
      break;
    case "yen":
      g.fillRect(34, 20, 26, 30);
      break;
    case "matna":
      g.restore();
      g.save();
      g.fillStyle = "rgba(0,0,0,.24)";
      g.beginPath(); g.ellipse(74, 17, 13, 11, 0, 0, Math.PI * 2); g.fill();
      break;
    case "taile":
      g.restore();
      g.save();
      g.fillStyle = "rgba(0,0,0,.26)";
      g.beginPath(); g.ellipse(65, 9, 6.5, 10, -0.45, 0, Math.PI * 2); g.fill();
      break;
  }
  g.restore();
}

/** Phụ kiện đội trên đầu — tầng nhận diện dễ thấy nhất từ xa. */
function drawAccessory(g, look) {
  g.save();
  g.lineWidth = 2;
  g.strokeStyle = INK;
  g.lineJoin = "round";
  const c = look.silk;

  switch (look.acc) {
    case "mu":
      g.fillStyle = c;
      roundRect(g, 62, 1, 20, 8, 3); g.fill(); g.stroke();
      g.fillRect(58, 8, 28, 3.4); g.strokeRect(58, 8, 28, 3.4);
      break;
    case "mucao":
      g.fillStyle = c;
      roundRect(g, 65, -4, 15, 13, 3); g.fill(); g.stroke();
      g.fillRect(60, 8, 25, 3.4); g.strokeRect(60, 8, 25, 3.4);
      break;
    case "mubaseball":
      g.fillStyle = c;
      g.beginPath(); g.arc(73, 8, 11, Math.PI, Math.PI * 2); g.fill(); g.stroke();
      g.fillRect(80, 6.5, 14, 3.2); g.strokeRect(80, 6.5, 14, 3.2);
      break;
    case "khan":
    case "khanco":
      g.fillStyle = c;
      g.beginPath();
      g.moveTo(62, 28); g.lineTo(80, 28); g.lineTo(71, 40); g.closePath();
      g.fill(); g.stroke();
      break;
    case "kinh":
      g.strokeStyle = INK; g.lineWidth = 2.2;
      g.beginPath(); g.arc(78, 16, 5.4, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(72.6, 15); g.lineTo(64, 13); g.stroke();
      break;
    case "no":
      g.fillStyle = c;
      g.beginPath();
      g.moveTo(66, 6); g.lineTo(60, 1); g.lineTo(60, 11); g.closePath(); g.fill(); g.stroke();
      g.beginPath();
      g.moveTo(66, 6); g.lineTo(72, 1); g.lineTo(72, 11); g.closePath(); g.fill(); g.stroke();
      break;
    case "vanhtai":
      g.strokeStyle = c; g.lineWidth = 3;
      g.beginPath(); g.arc(72, 8, 12, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      break;
    case "vongco":
      g.fillStyle = c;
      roundRect(g, 62, 30, 14, 5, 2); g.fill(); g.stroke();
      break;
    case "chomtoc":
      g.strokeStyle = c; g.lineWidth = 3; g.lineCap = "round";
      for (const dx of [-4, 0, 4]) {
        g.beginPath(); g.moveTo(73 + dx, 6); g.lineTo(73 + dx * 1.5, -2); g.stroke();
      }
      break;
    case "hoatai":
      g.fillStyle = c;
      g.beginPath(); g.arc(63, 18, 3.2, 0, Math.PI * 2); g.fill(); g.stroke();
      break;
  }
  g.restore();
}

/**
 * Nướng dải tư thế chân, dùng chung giữa mọi con cùng màu lông và cùng kiểu tất.
 *
 * Bóng dưới chân nằm ở đây, vẽ TRƯỚC chân — xem chú thích ở LEG_BOX.
 */
function bakeLegs(look, scale, amp, cache) {
  const key = look.fur + (look.pattern === "tat" ? "|tat" : "");
  if (cache && cache.has(key)) return cache.get(key);

  const frames = [];
  for (let f = 0; f <= GALLOP_FRAMES; f++) {
    const c = document.createElement("canvas");
    c.width = Math.ceil(LEG_BOX.w * scale);
    c.height = Math.ceil(LEG_BOX.h * scale);
    const g = c.getContext("2d");
    g.scale(scale, scale);
    // Vẽ trong đúng toạ độ của con chó rồi dời khung — nhờ vậy mọi con số
    // hình học ở trên vẫn đọc thẳng được so với thân, không phải trừ đi tay.
    g.translate(-LEG_BOX.x, -LEG_BOX.y);
    drawGroundShadow(g);
    drawLegs(g, look, f, amp);
    frames.push(c);
  }

  if (cache) cache.set(key, frames);
  return frames;
}

/**
 * Nướng một chú chó thành BA sprite dùng lại được: thân, dải chân, biển tên.
 *
 * Thân và biển tên tách nhau vì trên đường đua thân phải xoay theo hướng chạy
 * còn biển tên phải đứng thẳng — gộp một sprite thì tên nằm nghiêng khi con chó
 * bị cắn ngã và không đọc nổi.
 *
 * Chân tách ra vì nó là thứ DUY NHẤT phải đổi theo từng khung hình. Ba lệnh
 * drawImage mỗi con vẫn rẻ hơn hẳn mười lệnh vẽ đường, và dải chân dùng chung
 * nên chi phí bộ nhớ tính theo số màu lông chứ không theo số người.
 *
 * @param name   tên hiển thị trên biển
 * @param look   ngoại hình từ assignLooks
 * @param scale  bội số độ phân giải; 2 cho màn retina và máy chiếu
 * @param amp    biên độ sải chân, hạ xuống khi người xem chọn giảm chuyển động
 * @param legCache  Map dùng chung dải chân giữa cả đàn; bakeAll tự dựng
 */
export function bakeDog(name, look, scale = 2, amp = 1, legCache = null) {
  const probe = document.createElement("canvas").getContext("2d");
  const font = "700 15px -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";
  probe.font = font;

  // ── sprite thân ───────────────────────────────────────────────────────
  const body = document.createElement("canvas");
  body.width = Math.ceil(ART_W * scale);
  body.height = Math.ceil(ART_H * scale);
  const g = body.getContext("2d");
  g.scale(scale, scale);

  drawBody(g, look);
  drawPattern(g, look);
  drawAccessory(g, look);

  // ── sprite biển tên ───────────────────────────────────────────────────
  const textW = Math.ceil(probe.measureText(name).width);
  const plateW = Math.min(Math.max(textW + 16, 54), 190);
  let label = name;
  if (textW + 16 > plateW) {
    while (label.length > 1 && probe.measureText(label + "…").width + 16 > plateW) {
      label = label.slice(0, -1);
    }
    label += "…";
  }

  const plate = document.createElement("canvas");
  plate.width = Math.ceil(plateW * scale);
  plate.height = Math.ceil(PLATE_H * scale);
  const p = plate.getContext("2d");
  p.scale(scale, scale);
  p.fillStyle = look.silk;
  p.strokeStyle = INK;
  p.lineWidth = 2;
  roundRect(p, 1, 1, plateW - 2, PLATE_H - 2, 6);
  p.fill();
  p.stroke();
  p.font = font;
  p.textAlign = "center";
  p.textBaseline = "middle";
  p.fillStyle = "#fff";
  p.fillText(label, plateW / 2, PLATE_H / 2 + 0.5);

  return {
    body,
    plate,
    legs: bakeLegs(look, scale, amp, legCache),
    bodyW: ART_W,
    bodyH: ART_H,
    plateW,
    plateH: PLATE_H,
    // Khung chân theo TỈ LỆ của khung thân, không theo điểm ảnh. Chỗ gọi đã có
    // sẵn ô đích của thân (đã nhân độ phóng, đã nén giãn); nhân tỉ lệ vào là ra
    // ô đích của chân, không cần biết ART_W hay LEG_BOX là bao nhiêu.
    legFx: LEG_BOX.x / ART_W,
    legFy: LEG_BOX.y / ART_H,
    legFw: LEG_BOX.w / ART_W,
    legFh: LEG_BOX.h / ART_H,
  };
}

/**
 * Nướng cả danh sách một lần, gọi lúc bắt đầu lượt.
 *
 * Một Map dùng chung cho cả đàn: dải chân nướng theo màu lông chứ không theo
 * người, nên đàn 150 con vẫn chỉ tốn nhiều nhất 32 dải.
 */
export function bakeAll(names, looks, scale = 2, amp = 1) {
  const legCache = new Map();
  return names.map((n, i) => bakeDog(n, looks[i], scale, amp, legCache));
}
