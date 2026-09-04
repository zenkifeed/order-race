// Hình nền trang chọn trò chơi — Order Race
// ============================================================================
//
// Vì sao là hình VẼ chứ không phải file ảnh: cửa check:hub chặn mọi tài nguyên
// ngoài, vì cả ba trang phải mở được bằng file:// sau khi ai đó tải về máy. Một
// file .png nằm cạnh trang là một thứ nữa để quên chép, mà quên chép thì trang
// vẫn mở — chỉ là trống hoác, đúng lúc không ai kịp sửa.
//
// Cảnh: nhìn dọc đường đua về phía chân trời. Cùng một sân với lúc chơi, chỉ
// khác góc — trang chọn trò chơi mà không thấy sân thì nó là một cái menu, chứ
// không phải cửa vào một cuộc đua.
//
// Toàn bộ phối cảnh chạy trên MỘT đại lượng: s = 1/(1+z), z là khoảng cách.
// s = 1 là sát chân người xem, s → 0 là chân trời. Cả tung độ lẫn bề rộng đều
// nhân với s, nên mọi thứ tự khớp nhau — không có hai công thức để lệch pha.
// Nhờ vậy vạch chia làn là ĐƯỜNG THẲNG từ điểm tụ tới đáy, vẽ bằng hai lệnh,
// không phải một chuỗi đoạn gấp khúc phải tự canh cho khỏi gãy.
//
// Ba điều khoản, có cửa canh:
//
//   1. KHÔNG arc() TRONG ĐƯỜNG VẼ MỖI KHUNG. Giữ đúng nếp của lớp sân đua — ở
//      đó phép đếm arc() là bằng chứng cho một chuyện khác, và một thói quen
//      chỉ giữ được nếu không có ngoại lệ. Bóng mây nướng sẵn rồi drawImage.
//   2. KHÔNG NUỐT CHỮ. Trang này có chữ xám trên nền sáng. Vẽ cảnh xong thì
//      một tấm lụa dọc phủ đậm ở đỉnh và ở chân — đúng hai chỗ có chữ — rồi
//      mới tới cạnh mờ. Nền đẹp mà đọc không ra tên trò chơi là nền hỏng.
//   3. GIẢM CHUYỂN ĐỘNG THÌ ĐỨNG HẲN. Không hạ biên độ như trong cuộc đua: ở
//      đó chuyển động mang tin (ai đang dẫn), ở đây nó chỉ để màn hình đừng
//      chết. Thứ không mang tin thì tắt được.

export const SCENE = {
  // Chân trời hạ xuống 0,62 và điểm tụ lệch sang phải 0,68 — cả hai đều là
  // quyết định BỐ CỤC, không phải thẩm mỹ suông. Nội dung của trang là hai
  // tấm thẻ nằm giữa: điểm tụ đặt ở giữa thì chỗ đẹp nhất của hình bị thẻ
  // che kín, chỉ còn lề trái phải trống trơ. Đẩy nó chếch lên góc phải thì
  // nêm cỏ và vệt lề chạy chéo qua đúng khoảng lề trái đang bỏ không.
  horizon: 0.62,
  vanish: 0.68,    // điểm tụ, theo tỉ lệ bề ngang
  bands: 20,       // số vạch cỏ cắt ngang
  step: 0.6,       // khoảng cách giữa hai vạch, tính theo z
  halfWidth: 0.62, // nửa bề rộng đường đua ở sát người xem, theo tỉ lệ bề ngang
  lanes: 6,
  cycleSec: 7.6,   // một vạch trôi từ chân trời về tới đáy mất bấy nhiêu giây
  clouds: 4,
  mows: 10,        // số luống cắt DỌC theo đường đua
  trees: 7,        // số cụm cây nhô lên khỏi hàng rào chân trời
};

const SKY_TOP = "#9fc9e8";
const SKY_MID = "#cfe4ee";
const SKY_LOW = "#f6ead0";
const HEDGE   = "#1f4a33";
const HAZE    = "#a8cba2";  // dải cỏ xa, nhạt đi vì lớp không khí ở giữa
const FAR     = "#7fb478";
const NEAR    = "#25693f";
const PAPER   = "238,242,234";

/** s = 1/(1+z): vừa là hệ số thu nhỏ, vừa là vị trí trên màn hình. */
const depth = (z) => 1 / (1 + z);

/**
 * Bóng tròn mềm, nướng một lần. Dùng lại cho cả mây, bóng mây lẫn quầng nắng —
 * ba thứ đó chỉ khác nhau ở màu và phép hoà, không khác nhau ở hình.
 */
export function bakeBlob(makeCanvas, size, rgb) {
  const c = makeCanvas(size, size);
  const g = c.getContext("2d");
  const r = size / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, "rgba(" + rgb + ",1)");
  grad.addColorStop(0.45, "rgba(" + rgb + ",0.7)");
  grad.addColorStop(1, "rgba(" + rgb + ",0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

/** Ba tấm bóng mềm mà một khung hình cần. Nướng một lần cho cả phiên. */
export function bakeBlobs(makeCanvas) {
  return {
    light: bakeBlob(makeCanvas, 256, "255,255,255"),
    dark: bakeBlob(makeCanvas, 256, "14,38,24"),
    sun: bakeBlob(makeCanvas, 256, "255,241,206"),
  };
}

/**
 * Vị trí một đám mây tại thời điểm bất kỳ. Suy từ (chỉ số, giờ), không lưu gì.
 *
 * Lề trôi và bán kính đều đo theo BỀ NGANG, không theo một số pixel cố định:
 * một lề 450px là vừa trên màn 1280 nhưng lớn hơn cả khung trên màn 420, và
 * khi đó mỗi khung vẽ một tấm ảnh to gấp đôi màn hình vào chỗ không ai thấy.
 */
function cloudAt(i, nowSec, W, hy) {
  const spread = ((i * 9301 + 49297) % 233) / 233;
  const margin = W * 0.4;
  const span = W + margin * 2;
  const x = ((spread * span + nowSec * (7 + i * 3)) % span) - margin;
  const r = Math.min(hy, W * 0.3) * (0.5 + spread * 0.55);
  return { x: x, y: hy * (0.16 + spread * 0.4), r: r };
}

/**
 * Vẽ trọn một khung. Trả về số lệnh vẽ, để cửa kiểm còn có cái mà đặt trần.
 *
 * nowSec đứng yên thì hình đứng yên — đó là cách trang này tôn trọng giảm
 * chuyển động, và cũng là cách cửa kiểm chứng minh được nó đứng yên thật.
 */
export function drawBackdrop(ctx, blobs, W, H, nowSec, opts) {
  const o = opts || {};
  const accent = o.accent || null;
  const amt = Math.max(0, Math.min(1, o.accentAmt || 0));
  let ops = 0;

  const hy = Math.round(H * SCENE.horizon);
  const gh = H - hy;
  const vpX = W * SCENE.vanish;
  const hw = W * SCENE.halfWidth;

  // ---- trời -------------------------------------------------------------
  const sky = ctx.createLinearGradient(0, 0, 0, hy);
  sky.addColorStop(0, SKY_TOP);
  sky.addColorStop(0.62, SKY_MID);
  sky.addColorStop(1, SKY_LOW);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, hy); ops++;

  // Mây trên trời — cùng tấm bóng với bóng mây dưới đất, chỉ khác màu.
  ctx.globalAlpha = 0.62;
  for (let i = 0; i < SCENE.clouds; i++) {
    const c = cloudAt(i, nowSec * 0.35, W, hy);
    ctx.drawImage(blobs.light, c.x - c.r, c.y - c.r * 0.42, c.r * 2, c.r * 0.84); ops++;
  }
  ctx.globalAlpha = 1;

  // ---- đất --------------------------------------------------------------
  // Ba chặng chứ không hai: cỏ ở xa phải nhạt hẳn đi vì có cả một lớp không
  // khí nằm giữa. Chuyển thẳng từ cỏ xa sang cỏ gần thì mặt đất trông như một
  // tấm vải dựng đứng, không ra chiều sâu.
  const ground = ctx.createLinearGradient(0, hy, 0, H);
  ground.addColorStop(0, HAZE);
  ground.addColorStop(0.1, FAR);
  ground.addColorStop(1, NEAR);
  ctx.fillStyle = ground;
  ctx.fillRect(0, hy, W, gh); ops++;

  // Hàng rào cây ở chân trời. Không có nó thì hai dải màu chạm thẳng vào nhau
  // và trông như một lỗi chuyển sắc chứ không như một đường chân trời.
  // Hàng rào ở chân trời. Một dải trơn suốt bề ngang thì không ra hàng rào —
  // nó ra một thanh chắn, và mắt đọc ngay là đồ hoạ chứ không phải cảnh vật.
  // Nên: thân rào liền, rồi một hàng bụi cao thấp mọc lên trên nó. Chiều cao
  // suy từ chỉ số nên vẫn xác định, không cần lưu gì.
  const hedgeH = Math.max(5, H * 0.02);
  ctx.fillStyle = HEDGE;
  ctx.fillRect(0, hy - hedgeH, W, hedgeH + 2); ops++;
  // Cụm cây là ELLIPSE, không phải hình chữ nhật. Đã thử bằng hình chữ nhật:
  // ở cỡ này nó đọc ra thành lô cốt, và thêm bao nhiêu cụm cũng không cứu được
  // — thứ làm mắt đọc ra cây là cái ĐỈNH TRÒN, không phải số lượng.
  //
  // Dùng ellipse chứ không dùng arc, đúng như lớp tuyết và lá bên sky.mjs: nếp
  // "không arc() trong đường vẽ" nhờ vậy vẫn nguyên vẹn.
  //
  // Mỗi cụm hai tông: thân sẫm, rồi một mảng sáng lệch lên trái nơi nắng rọi
  // tới. Hai tông phẳng, không chuyển sắc — đúng ngôn ngữ decal của trang.
  for (let i = 0; i < SCENE.trees; i++) {
    const a = ((i * 7919) % 97) / 97;
    const b = ((i * 4111) % 83) / 83;
    // Cả hai bán kính đo theo CHIỀU CAO HÀNG RÀO. Lấy rx theo W còn ry theo H
    // thì tỉ lệ bụi cây đổi theo khổ màn: ở khổ dọc hẹp chúng thành quả trứng
    // dựng đứng. Cùng một đơn vị thì cây ở đâu cũng ra cây.
    const rx = hedgeH * (2 + a * 2.8);
    const ry = hedgeH * (0.9 + b * 2.4);
    const cx = ((i + 0.5 + (b - 0.5) * 0.66) / SCENE.trees) * W;
    const cy = hy - hedgeH * 0.15;
    ctx.fillStyle = HEDGE;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill(); ops++;
    ctx.fillStyle = "rgba(150,196,132,0.28)";
    ctx.beginPath();
    ctx.ellipse(cx - rx * 0.34, cy - ry * 0.42, rx * 0.44, ry * 0.4, 0, 0, Math.PI * 2);
    ctx.fill(); ops++;
  }

  // ---- luống cắt dọc ----------------------------------------------------
  // Sân cỏ thật được cắt Ô BÀN CỜ: máy chạy dọc một lượt rồi ngang một lượt,
  // và chiều nằm rạp của cọng cỏ làm hai chiều bắt sáng khác nhau. Chỉ có vạch
  // ngang thì mắt không đọc ra cỏ cắt — nó đọc ra sọc nhiễu của màn hình.
  //
  // Luống dọc thì đứng yên khi người xem tiến lên, nên chuyển động vẫn hoàn
  // toàn nằm ở lớp vạch ngang.
  const mowFar = depth((SCENE.bands + 1) * SCENE.step);
  const mowY = hy + gh * mowFar;
  // Dải u vừa đủ phủ hết bề ngang Ở ĐÁY, cộng một chút lề. Trước đây để cứng
  // ±2,2 và nó vẽ tới x = 2616 trên màn rộng 1280 — hơn gấp đôi khung, toàn bộ
  // phần thừa nằm ngoài màn. Điểm tụ lệch nên dải cũng phải lệch theo; suy ra
  // từ vpX là hết chuyện, không có con số nào để đoán sai.
  const uLo = (0 - vpX) / hw - 0.15;
  const uHi = (W - vpX) / hw + 0.15;
  const uStep = (uHi - uLo) / SCENE.mows;
  for (let k = 0; k < SCENE.mows; k++) {
    const u1 = uLo + k * uStep;
    const u2 = u1 + uStep;
    ctx.fillStyle = k % 2 ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)";
    ctx.beginPath();
    ctx.moveTo(vpX + u1 * hw * mowFar, mowY);
    ctx.lineTo(vpX + u2 * hw * mowFar, mowY);
    ctx.lineTo(vpX + u2 * hw, H);
    ctx.lineTo(vpX + u1 * hw, H);
    ctx.closePath();
    ctx.fill(); ops++;
  }

  // ---- vạch cỏ cắt ngang, trôi về phía người xem ------------------------
  // Cắt ngang thì vuông góc với hướng nhìn, nên mỗi vạch là một hình chữ nhật
  // suốt bề ngang — không phải dựng hình thang.
  const phase = (nowSec / SCENE.cycleSec) % 1;
  const edges = [];
  for (let i = 0; i <= SCENE.bands; i++) {
    const s = depth((i + 1 - phase) * SCENE.step);
    edges.push({ s: s, y: hy + gh * s });
  }
  for (let i = 0; i < SCENE.bands; i++) {
    const a = edges[i + 1], b = edges[i];
    const h = b.y - a.y;
    if (h < 0.5) continue;
    ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)";
    ctx.fillRect(0, a.y, W, h + 0.5); ops++;
  }

  // ---- mặt đường --------------------------------------------------------
  // Hình thang phủ MỜ, không đục: vạch cỏ bên dưới vẫn ánh lên, nên đường và
  // cỏ cùng được cắt một kiểu, chỉ khác sắc — đúng như một sân cỏ thật.
  const far = edges[SCENE.bands];
  ctx.fillStyle = "rgba(14,66,42,0.52)";
  ctx.beginPath();
  ctx.moveTo(vpX - hw * far.s, far.y);
  ctx.lineTo(vpX + hw * far.s, far.y);
  ctx.lineTo(vpX + hw, H);
  ctx.lineTo(vpX - hw, H);
  ctx.closePath();
  ctx.fill(); ops++;

  // ---- viền lề đỏ trắng --------------------------------------------------
  // Vẽ ở MỌI vạch, không cách quãng. Cách quãng thì các khối rời ra và trông
  // như confetti vãi xuống cỏ chứ không ra một đường lề chạy dài.
  for (let i = 0; i < SCENE.bands; i++) {
    const a = edges[i + 1], b = edges[i];
    if (b.y - a.y < 0.6) continue;
    ctx.fillStyle = i % 2 ? "#f2f0e8" : "#c8452f";
    for (let k = 0; k < 2; k++) {
      const side = k ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(vpX + side * hw * a.s, a.y);
      ctx.lineTo(vpX + side * hw * 1.085 * a.s, a.y);
      ctx.lineTo(vpX + side * hw * 1.085 * b.s, b.y);
      ctx.lineTo(vpX + side * hw * b.s, b.y);
      ctx.closePath();
      ctx.fill(); ops++;
    }
  }

  // ---- vạch chia làn -----------------------------------------------------
  // Nhờ y và bề rộng dùng chung một s, mỗi vạch là đường thẳng từ điểm tụ tới
  // đáy. Không cần chia đoạn, nên không có chỗ nào để gãy.
  ctx.strokeStyle = "rgba(255,255,255,0.46)";
  ctx.lineWidth = Math.max(1, W * 0.0022);
  for (let k = 1; k < SCENE.lanes; k++) {
    const u = (k / SCENE.lanes) * 2 - 1;
    ctx.beginPath();
    ctx.moveTo(vpX + u * hw * far.s, far.y);
    ctx.lineTo(vpX + u * hw, H);
    ctx.stroke(); ops++;
  }

  // ---- bóng mây đổ xuống đất --------------------------------------------
  ctx.globalAlpha = 0.16;
  for (let i = 0; i < SCENE.clouds; i++) {
    const c = cloudAt(i + 5, nowSec, W, hy);
    const y = hy + gh * (0.25 + ((i * 37) % 50) / 100);
    const r = Math.min(gh, W * 0.34) * (0.5 + (i % 3) * 0.22);
    ctx.drawImage(blobs.dark, c.x - r, y - r * 0.22, r * 2, r * 0.44); ops++;
  }
  ctx.globalAlpha = 1;

  // ---- nắng chếch từ trên trái ------------------------------------------
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.2;
  // Bán kính theo CẠNH NGẮN. Theo cạnh dài thì trên màn 21:9 quầng nắng cao
  // gấp rưỡi màn hình, và phần lớn nó nằm ngoài khung.
  //
  // Tâm dạt hẳn ra ngoài mép trái trên. Để nó vào trong khung thì quầng sáng
  // nằm chình ình giữa trời, đọc ra thành một mảng sương chứ không ra nắng —
  // nắng là thứ RỌI TỚI từ ngoài khung, không phải một vệt trắng dán lên trời.
  const sr = Math.min(W, H) * 0.44;
  ctx.drawImage(blobs.sun, -sr * 0.86, -sr * 0.9, sr * 2, sr * 2); ops++;
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;

  // ---- màu của trò chơi đang trỏ vào ------------------------------------
  // Rê chuột lên thẻ nào thì cả sân ngả về màu trò đó — cùng màu với lúc rửa
  // màn để sang trang, nên cú chuyển cảnh bắt đầu từ trước khi bấm.
  if (accent && amt > 0) {
    ctx.globalAlpha = amt * 0.17;
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, W, H); ops++;
    ctx.globalAlpha = 1;
  }

  // ---- lụa phủ: đỉnh và chân là nơi có chữ ------------------------------
  const veil = ctx.createLinearGradient(0, 0, 0, H);
  veil.addColorStop(0, "rgba(" + PAPER + ",0.62)");
  veil.addColorStop(0.3, "rgba(" + PAPER + ",0.30)");
  veil.addColorStop(0.62, "rgba(" + PAPER + ",0.06)");
  veil.addColorStop(0.86, "rgba(" + PAPER + ",0.20)");
  veil.addColorStop(1, "rgba(" + PAPER + ",0.44)");
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, W, H); ops++;

  // ---- tối bốn góc -------------------------------------------------------
  const vig = ctx.createRadialGradient(W / 2, H * 0.46, Math.min(W, H) * 0.28,
                                       W / 2, H * 0.46, Math.max(W, H) * 0.76);
  vig.addColorStop(0, "rgba(18,33,26,0)");
  vig.addColorStop(1, "rgba(18,33,26,0.16)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H); ops++;

  return ops;
}
