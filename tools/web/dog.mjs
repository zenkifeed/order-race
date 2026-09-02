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

/** Thân, đầu, chân, đuôi — nhìn ngang, hướng sang phải. */
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

  // chân sau rồi chân trước
  g.fillStyle = fur;
  for (const [x, y] of [[27, 40], [38, 41], [58, 41], [69, 40]]) {
    roundRect(g, x, y, 9, 15, 4);
    g.fill();
    g.stroke();
  }

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

/** Hoạ tiết, cắt gọn trong thân để không tràn ra ngoài viền. */
function drawPattern(g, look) {
  if (look.pattern === "tron") return;

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
    case "tat":
      g.restore();
      g.save();
      g.fillStyle = "rgba(255,255,255,.72)";
      for (const [x, y] of [[27, 48], [38, 49], [58, 49], [69, 48]]) {
        roundRect(g, x, y, 9, 7, 3); g.fill();
      }
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
 * Nướng một chú chó thành sprite dùng lại được, kèm biển tên gắn dưới chân.
 *
 * @param name   tên hiển thị trên biển
 * @param look   ngoại hình từ assignLooks
 * @param scale  bội số độ phân giải; 2 cho màn retina và máy chiếu
 */
/**
 * Nướng một chú chó thành HAI sprite dùng lại được.
 *
 * Tách làm hai vì trên đường đua cong, thân phải xoay theo hướng chạy còn biển
 * tên phải đứng thẳng — gộp một sprite thì tên nằm nghiêng ở khúc cua và không
 * đọc nổi. Hai lệnh drawImage mỗi con vẫn rẻ hơn hẳn mười lệnh vẽ đường.
 *
 * @param name   tên hiển thị trên biển
 * @param look   ngoại hình từ assignLooks
 * @param scale  bội số độ phân giải; 2 cho màn retina và máy chiếu
 */
export function bakeDog(name, look, scale = 2) {
  const probe = document.createElement("canvas").getContext("2d");
  const font = "700 15px -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";
  probe.font = font;

  // ── sprite thân ───────────────────────────────────────────────────────
  const body = document.createElement("canvas");
  body.width = Math.ceil(ART_W * scale);
  body.height = Math.ceil(ART_H * scale);
  const g = body.getContext("2d");
  g.scale(scale, scale);

  g.fillStyle = "rgba(0,0,0,.22)";
  g.beginPath();
  g.ellipse(ART_W / 2, ART_H - 4, 30, 5, 0, 0, Math.PI * 2);
  g.fill();

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

  return { body, plate, bodyW: ART_W, bodyH: ART_H, plateW, plateH: PLATE_H };
}

/** Nướng cả danh sách một lần, gọi lúc bắt đầu lượt. */
export function bakeAll(names, looks, scale = 2) {
  return names.map((n, i) => bakeDog(n, looks[i], scale));
}
