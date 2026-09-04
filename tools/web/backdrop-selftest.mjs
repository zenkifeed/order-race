// Kiểm thử hình nền trang chọn — Order Race
// Chạy: node tools/web/backdrop-selftest.mjs
//
// Hình nền là thứ dễ nhất để làm hỏng một trang mà không ai kêu: nó không báo
// lỗi, chỉ làm chữ khó đọc đi một chút, hoặc ăn một phần CPU mà không ai nghĩ
// tới. Nên cửa này đo đúng ba thứ đó — vẽ trong khung, ngân sách mỗi khung, và
// đứng yên thật khi được bảo đứng yên.

import { SCENE, bakeBlobs, drawBackdrop } from "./backdrop.mjs";

let failed = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "  OK  " : "  SAI "} ${name}${detail ? "  — " + detail : ""}`);
  if (!ok) failed++;
}

/**
 * Ctx giả biết đếm. Mọi lệnh vẽ đều ghi lại kèm hộp bao, để phép kiểm nói được
 * "vẽ ra ngoài khung" chứ không chỉ "có vẽ".
 *
 * createLinearGradient / createRadialGradient KHÔNG tính là lệnh vẽ — chúng chỉ
 * dựng vật liệu. arc/ellipse cũng vậy: chúng là lệnh ĐƯỜNG DẪN, cùng loại với
 * lineTo, và cái vẽ thật là fill() theo sau. Đếm chúng vào tổng thì trần ngân
 * sách thành một con số vô nghĩa — đã đếm nhầm một lần và cửa báo lệch 14.
 */
function makeCtx() {
  const tally = new Map();     // lệnh VẼ
  const shapes = new Map();    // lệnh dựng đường dẫn
  const boxes = [];
  let path = [];
  const bump = (k) => tally.set(k, (tally.get(k) || 0) + 1);
  const shape = (k) => shapes.set(k, (shapes.get(k) || 0) + 1);
  const grad = { addColorStop() {} };
  return {
    tally,
    shapes,
    boxes,
    total: () => [...tally.values()].reduce((a, b) => a + b, 0),
    globalAlpha: 1, globalCompositeOperation: "source-over",
    fillStyle: "", strokeStyle: "", lineWidth: 1, lineCap: "butt",
    createLinearGradient: () => grad,
    createRadialGradient: () => grad,
    fillRect(x, y, w, h) { bump("fillRect"); boxes.push([x, y, x + w, y + h]); },
    drawImage(img, x, y, w, h) { bump("drawImage"); boxes.push([x, y, x + w, y + h]); },
    beginPath() { path = []; },
    moveTo(x, y) { path.push([x, y]); },
    lineTo(x, y) { path.push([x, y]); },
    closePath() {},
    fill() { bump("fill"); pushPath(); },
    stroke() { bump("stroke"); pushPath(); },
    arc(cx, cy, r) { shape("arc"); path.push([cx - r, cy - r], [cx + r, cy + r]); },
    ellipse(cx, cy, rx, ry) {
      shape("ellipse");
      path.push([cx - rx, cy - ry], [cx + rx, cy + ry]);
    },
  };
  function pushPath() {
    if (!path.length) return;
    const xs = path.map((p) => p[0]), ys = path.map((p) => p[1]);
    boxes.push([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]);
  }
}

const makeCanvas = (w, h) => ({
  width: w, height: h,
  getContext: () => makeCtx(),
});

const W = 1280, H = 800;

// ------------------------------------------------- 1. Nướng một lần, ba tấm
{
  let made = 0;
  const counting = (w, h) => { made++; return makeCanvas(w, h); };
  const blobs = bakeBlobs(counting);
  check("Nướng đúng ba tấm bóng mềm", made === 3, `${made} tấm`);
  check("Có đủ mây sáng, bóng tối và quầng nắng",
    !!(blobs.light && blobs.dark && blobs.sun));

  // Nướng xong là xong. Nếu một khung hình còn gọi tạo canvas thì mỗi giây
  // trang này sinh 60 tấm ảnh mới — cách chắc chắn nhất để quạt máy chạy.
  const before = made;
  drawBackdrop(makeCtx(), blobs, W, H, 3.2);
  check("Vẽ một khung không nướng thêm gì", made === before, `thêm ${made - before}`);
}

const blobs = bakeBlobs(makeCanvas);

// ------------------------------------------------------- 2. Ngân sách mỗi khung
{
  const ctx = makeCtx();
  const ops = drawBackdrop(ctx, blobs, W, H, 1.5);
  check("Số lệnh vẽ khớp với con số hàm tự khai", ops === ctx.total(),
    `khai ${ops}, đếm ${ctx.total()}`);

  // Đây là một cái MENU. Nó không được phép tốn như một cuộc đua 150 con chó.
  // Trần 130 đặt theo con số ĐO ĐƯỢC của cảnh hiện tại (104), chừa chỗ cho vài
  // bụi cây nữa chứ không chừa chỗ cho một lớp mới. Muốn thêm hẳn một lớp thì
  // phải xoá bớt lớp khác, hoặc đo lại rồi bảo vệ con số mới bằng lời.
  check("Một khung dưới 130 lệnh vẽ", ops <= 130, `${ops} lệnh`);

  // Cùng lý do như lớp sân đua: phép đếm arc() ở cửa check:runtime là bằng
  // chứng cho một chuyện khác, và một nếp chỉ giữ được nếu không có ngoại lệ.
  // Cụm cây dùng ellipse — đúng như lớp tuyết và lá bên sky.mjs.
  check("Không gọi arc() trong đường vẽ mỗi khung", !ctx.shapes.get("arc"),
    `${ctx.shapes.get("arc") || 0} lần`);
  check("Mỗi cụm cây đúng hai tông, không hơn",
    ctx.shapes.get("ellipse") === SCENE.trees * 2,
    `${ctx.shapes.get("ellipse")} ellipse cho ${SCENE.trees} cụm`);
}

// --------------------------------------------- 3. Không vẽ tràn ra ngoài khung
{
  // Mây và nắng cố tình thò ra ngoài — chúng phải thò, nếu không thì nhìn thấy
  // rìa của tấm bóng. Nhưng thò cũng có hạn: gấp đôi khung là đang phí GPU vẽ
  // vào chỗ không ai thấy.
  for (const [w, h] of [[1280, 800], [420, 900], [2560, 1080]]) {
    const ctx = makeCtx();
    drawBackdrop(ctx, blobs, w, h, 2.4);
    const lim = { x0: -w, y0: -h, x1: 2 * w, y1: 2 * h };
    const out = ctx.boxes.filter((b) =>
      b[0] < lim.x0 || b[1] < lim.y0 || b[2] > lim.x1 || b[3] > lim.y1);
    check(`Ở khổ ${w}×${h} không vẽ quá xa khung`, out.length === 0,
      out.length ? `${out.length} hình` : "");
  }
}

// ------------------------------------- 4. Giảm chuyển động thì đứng yên THẬT
{
  // Cách trang này tắt chuyển động là ngừng nhích nowSec. Nếu có bất kỳ thứ gì
  // trong hàm còn đọc đồng hồ riêng, mục này đổ — và đó đúng là lỗi cần bắt,
  // vì trên màn hình nó chỉ hiện ra thành "vẫn hơi nhúc nhích".
  const a = makeCtx(); drawBackdrop(a, blobs, W, H, 0);
  const b = makeCtx(); drawBackdrop(b, blobs, W, H, 0);
  check("Cùng một mốc thời gian thì ra cùng một hình",
    JSON.stringify(a.boxes) === JSON.stringify(b.boxes));

  const c = makeCtx(); drawBackdrop(c, blobs, W, H, 4.1);
  check("Khác mốc thời gian thì hình phải khác",
    JSON.stringify(a.boxes) !== JSON.stringify(c.boxes));
}

// ------------------------------------------- 5. Vạch cỏ trôi liền, không nhảy
{
  // Một chu kỳ đủ trọn thì vạch phải về đúng chỗ cũ. Lệch một chút là mỗi vòng
  // hình giật một cái — thứ mắt bắt được nhưng khó gọi tên.
  const at = (t) => { const c = makeCtx(); drawBackdrop(c, blobs, W, H, t); return c.boxes; };
  const p0 = at(0), p1 = at(SCENE.cycleSec);
  const diff = p0.reduce((m, b, i) =>
    Math.max(m, Math.abs(b[1] - p1[i][1])), 0);
  check("Trọn một chu kỳ thì vạch về đúng chỗ cũ", diff < 0.5, `lệch ${diff.toFixed(3)}px`);

  // Không có bước nhảy nào giữa hai khung liền nhau.
  let jump = 0;
  for (let t = 0; t < SCENE.cycleSec; t += SCENE.cycleSec / 40) {
    const u = at(t), v = at(t + SCENE.cycleSec / 40);
    for (let i = 0; i < u.length; i++) jump = Math.max(jump, Math.abs(u[i][1] - v[i][1]));
  }
  check("Không khung nào nhảy quá xa khung trước", jump < H * 0.2,
    `bước lớn nhất ${jump.toFixed(1)}px`);
}

// --------------------------------------------------- 6. Màu trò chơi trỏ vào
{
  const off = makeCtx(); drawBackdrop(off, blobs, W, H, 1, { accent: "#0f7a4f", accentAmt: 0 });
  const on = makeCtx(); drawBackdrop(on, blobs, W, H, 1, { accent: "#0f7a4f", accentAmt: 1 });
  check("Không rê chuột thì không tốn thêm lệnh nào", on.total() === off.total() + 1,
    `${off.total()} → ${on.total()}`);

  const wild = makeCtx();
  drawBackdrop(wild, blobs, W, H, 1, { accent: "#0f7a4f", accentAmt: 9 });
  check("Mức ngả màu bị kẹp lại, không vượt trần", wild.total() === on.total());

  const none = makeCtx(); drawBackdrop(none, blobs, W, H, 1, { accentAmt: 1 });
  check("Không có màu thì bỏ qua, không ném lỗi", none.total() === off.total());
}

// ------------------------------------------------- 7. Lụa phủ phải là lớp cuối
{
  // Chữ của trang nằm ở đỉnh và ở chân. Lụa phủ và cạnh mờ là hai thứ giữ cho
  // chúng đọc được — nếu chúng không phải hai lệnh CUỐI thì có gì đó vẽ đè lên
  // sau, và độ tương phản mà mục này canh trở thành lời hứa suông.
  const ctx = makeCtx();
  drawBackdrop(ctx, blobs, W, H, 1);
  const last2 = ctx.boxes.slice(-2);
  const full = last2.filter((b) =>
    b[0] <= 0 && b[1] <= 0 && b[2] >= W && b[3] >= H);
  check("Hai lệnh cuối phủ trọn khung: lụa rồi tới cạnh mờ", full.length === 2,
    `${full.length}/2`);
}

console.log(failed === 0 ? "\nHÌNH NỀN TRANG CHỌN ĐẠT\n" : `\n${failed} MỤC KHÔNG ĐẠT\n`);
process.exit(failed === 0 ? 0 : 1);
