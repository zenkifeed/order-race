// Cửa bầu trời, ánh sáng và thời tiết — Order Race / M3
// Chạy: node tools/race/sky-selftest.mjs
//
// Ba lớp mới đều chạy MỖI KHUNG HÌNH và đều nằm ở đường đi nóng nhất của trang.
// Một lớp trang trí làm rớt khung hình đúng giây cuối thì tệ hơn hẳn việc không
// có lớp trang trí nào. Vì vậy cửa này đo bốn thứ mà mắt người không kiểm nổi:
//
//   1. CHỖ NỐI     Khoanh sân lát lại phải khít. Một hoa văn có chu kỳ không
//                  chia hết bề ngang khoanh sẽ để lại một đường sọc dọc chạy
//                  ngang màn hình — và nó chỉ lộ ra khi máy quay đi qua đúng
//                  chỗ đó, tức là thường là giữa buổi lễ.
//   2. CHI PHÍ     Số lệnh vẽ của cả ba lớp cộng lại, so với ngân sách.
//   3. CHỖ NỐI DỮ LIỆU  Mọi cờ `sky` và `weather` trong thư viện biến thể phải
//                  là thứ có thật ở đây. Gõ sai một cái tên trong modes.mjs thì
//                  hỏng ở đây, chứ không phải trước cả phòng.
//   4. arc()       Cửa chạy thật ở tools/race/check-race-runtime.mjs đếm số lần
//                  gọi arc() để chứng minh lớp cắn nhau vẽ tới được lớp vẽ. Nếu
//                  thời tiết cũng gọi arc() thì phép đếm đó không còn chứng minh
//                  được điều nó tuyên bố — nên chỗ này canh hộ nó.

import {
  SKIES, DEFAULT_SKY, skyPalette, WEATHERS, isWeather,
  bakeSoftBlob, cloudAt, drawCloudShadows, drawSunWash, drawWeather, makeBackdrop, backdropStale,
} from "./sky.mjs";
import { paintTile, bakeTile, TILE_W, makeCountingCtx } from "./stage.mjs";
import { lanesFor, trackHalfH, TRACK_LEN, TRACK_HALF } from "./track.mjs";
import { MODES, NEUTRAL_STAGE, mergeModes } from "./modes.mjs";

let failed = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "  OK  " : "  SAI "} ${name}${detail ? "  — " + detail : ""}`);
  if (!ok) failed++;
}

/** Canvas giả đủ để nướng: nhận mọi lệnh, không giữ gì. */
const fakeCanvas = () => ({ getContext: () => makeCountingCtx() });

console.log(`${SKIES.length} kiểu trời × ${WEATHERS.length} kiểu thời tiết\n`);

// =====================================================================
//  1. BẢNG MÀU PHẢI ĐỦ VÀ PHẢI TRA ĐƯỢC
// =====================================================================
{
  const TRACK_KEYS = ["grass", "grassAlt", "hedge", "turf", "turfAlt", "line", "edge",
                      "kerb", "kerbAlt", "shade"];
  const missing = [];
  for (const s of SKIES) {
    for (const k of ["backdropTop", "backdropMid", "backdropBot", "sun", "cloud", "track"]) {
      if (s[k] === undefined) missing.push(`${s.id}.${k}`);
    }
    for (const k of TRACK_KEYS) {
      if (!s.track || typeof s.track[k] !== "string") missing.push(`${s.id}.track.${k}`);
    }
  }
  check("Mọi bảng màu đều đủ khoá", missing.length === 0,
    missing.length ? missing.join(", ") : `${SKIES.length} bảng, ${TRACK_KEYS.length} màu mặt sân mỗi bảng`);

  // Tra một id không có thật phải trả về bảng mặc định, KHÔNG được trả undefined.
  // Chỗ gọi nằm trong vòng lặp vẽ, nên một undefined ở đây là trang chết trắng.
  check("Id lạ thì rơi về bảng mặc định",
    skyPalette("khong_ton_tai").id === DEFAULT_SKY && skyPalette(undefined).id === DEFAULT_SKY);
  check("Trời mặc định là trời sáng", DEFAULT_SKY === "ngay" && NEUTRAL_STAGE.sky === "ngay");
}

// =====================================================================
//  2. CHỖ NỐI DỮ LIỆU VỚI THƯ VIỆN BIẾN THỂ
// =====================================================================
{
  const bad = [];
  for (const m of MODES) {
    if ("sky" in m.stage && !SKIES.some((s) => s.id === m.stage.sky)) bad.push(`${m.id}.sky=${m.stage.sky}`);
    if ("weather" in m.stage && !isWeather(m.stage.weather)) bad.push(`${m.id}.weather=${m.stage.weather}`);
  }
  check("Mọi biến thể trỏ tới kiểu trời và thời tiết có thật", bad.length === 0,
    bad.length ? bad.join(", ") : `${MODES.length} biến thể`);

  // Gộp mọi biến thể lại cũng phải ra một cặp hợp lệ: quản trò chọn tay được, và
  // một tổ hợp chưa ai thử là đúng thứ sẽ xảy ra vào buổi lễ thứ mười.
  const all = mergeModes(MODES.map((m) => m.id)).stage;
  check("Xếp hết biến thể lên nhau vẫn ra kiểu trời và thời tiết hợp lệ",
    SKIES.some((s) => s.id === all.sky) && isWeather(all.weather),
    `trời "${all.sky}", thời tiết "${all.weather}"`);

  check("Thời tiết trung tính là quang mây",
    NEUTRAL_STAGE.weather === "khong" && isWeather(NEUTRAL_STAGE.weather));
}

// =====================================================================
//  3. KHOANH SÂN PHẢI LÁT KHÍT
//
//  Đây là phép kiểm quan trọng nhất trong cả file. Hoa văn mới trên mặt sân —
//  sọc cỏ cắt, vành đá đỏ trắng, hàng rào cây — đều lặp theo một chu kỳ, và một
//  chu kỳ không chia hết TILE_W để lại một mảnh cụt ở mép phải khoanh. Ghép hai
//  khoanh lại thì mảnh cụt đó thành một đường sọc dọc chạy suốt chiều cao màn
//  hình. Nó không lộ ra ở khung hình đầu, chỉ lộ ra khi máy quay chạy qua.
// =====================================================================
{
  const spill = [];
  const rects = [];
  const rec = makeCountingCtx();
  const realFillRect = rec.fillRect;
  rec.fillRect = (x, y, w, h) => {
    realFillRect();
    rects.push({ x, w });
    if (x < -0.001 || x + w > TILE_W + 0.001) spill.push(`${x.toFixed(1)}+${w.toFixed(1)}`);
  };

  for (const s of SKIES) paintTile(rec, lanesFor(150), s.id);

  check("Không hoa văn nào tràn qua mép khoanh sân", spill.length === 0,
    spill.length ? spill.slice(0, 4).join(", ") : `${rects.length} mảng màu, mọi mảng nằm trong [0, ${TILE_W}]`);

  // Mọi hoa văn lặp phải có chu kỳ chia hết TILE_W. Kiểm gián tiếp nhưng chặt:
  // các mảng cùng bề ngang phải cách nhau đều, và số mảng nhân bề ngang bước
  // phải đúng bằng TILE_W.
  const byW = new Map();
  for (const r of rects) {
    if (r.w >= TILE_W) continue;
    const k = r.w.toFixed(3);
    if (!byW.has(k)) byW.set(k, []);
    byW.get(k).push(r.x);
  }
  let uneven = 0;
  for (const xs of byW.values()) {
    const sorted = [...new Set(xs)].sort((a, b) => a - b);
    if (sorted.length < 2) continue;
    const step = sorted[1] - sorted[0];
    if (Math.abs((TILE_W / step) - Math.round(TILE_W / step)) > 1e-9) uneven++;
    for (let i = 2; i < sorted.length; i++) {
      if (Math.abs(sorted[i] - sorted[i - 1] - step) > 1e-9) { uneven++; break; }
    }
  }
  check("Mọi hoa văn lặp có chu kỳ chia hết bề ngang khoanh", uneven === 0,
    `${byW.size} nhóm hoa văn`);
}

// =====================================================================
//  4. ẢNH NƯỚNG PHẢI NẰM TRONG TRẦN CỦA TRÌNH DUYỆT
// =====================================================================
{
  // Vành cỏ rộng ra từ 26 lên 74 đơn vị để có chỗ cho hàng rào cây. Nó đẩy chiều
  // cao ảnh nướng lên, và trần thấp nhất từng gặp là 4 096 điểm ảnh.
  let worst = 0;
  for (const n of [8, 45, 150]) {
    bakeTile((w, h) => { worst = Math.max(worst, w, h); return fakeCanvas(); }, lanesFor(n), 2, "ngay");
  }
  check("Khoanh sân nướng nằm trong trần kích thước canvas", worst <= 4096,
    `cạnh lớn nhất ${worst} điểm ảnh`);

  let blobSize = 0;
  bakeSoftBlob((w, h) => { blobSize = Math.max(w, h); return fakeCanvas(); }, 512, "0,0,0");
  check("Vệt mờ nướng một lần, cỡ vừa phải", blobSize === 512, `${blobSize}×${blobSize}`);
}

// =====================================================================
//  5. BÓNG MÂY: XÁC ĐỊNH, PHỦ KÍN, VÀ CÓ CẮT BỚT
// =====================================================================
{
  const pal = skyPalette("ngay");
  const halfH = trackHalfH(lanesFor(150));
  const a = cloudAt({ x: 0, y: 0, r: 0 }, 3, 12.5, pal, halfH);
  const b = cloudAt({ x: 0, y: 0, r: 0 }, 3, 12.5, pal, halfH);
  check("Cùng thời điểm ra cùng vị trí mây", a.x === b.x && a.y === b.y && a.r === b.r,
    "quay lại video ra đúng cảnh cũ");

  // Mây phải trôi, và phải cuộn vòng chứ không được nhảy về đầu sân thành một
  // cú giật nhìn thấy được.
  const scratch = { x: 0, y: 0, r: 0 };
  let jumps = 0;
  let prev = cloudAt(scratch, 1, 0, pal, halfH).x;
  const span = TRACK_LEN + 2400;
  for (let t = 0.05; t < 400; t += 0.05) {
    const x = cloudAt(scratch, 1, t, pal, halfH).x;
    let d = x - prev;
    if (d < -span * 0.5) d += span;
    if (Math.abs(d) > pal.cloud.drift * 0.2) jumps++;
    prev = x;
  }
  check("Mây trôi liền mạch, cuộn vòng không giật", jumps === 0, `${(400 / 0.05).toFixed(0)} bước`);

  // Cắt bớt phải THẬT SỰ cắt: ở một mức phóng thường thì phần lớn số mây nằm
  // ngoài khung hình, và chúng không được tốn lệnh vẽ nào.
  const blob = bakeSoftBlob((w, h) => fakeCanvas(), 512, "0,0,0");
  const near = makeCountingCtx();
  const drawn = drawCloudShadows(near, blob, pal, 40, 0, 900, lanesFor(150), scratch);
  check("Bóng mây có cắt bớt phần ngoài khung hình", drawn < pal.cloud.count,
    `${drawn}/${pal.cloud.count} vệt lọt vào khung hình rộng 1 800 đơn vị`);

  // ...nhưng KHÔNG được cắt sạch: một khung hình không có bóng mây nào là một
  // khung hình không có hiệu ứng trời sáng.
  let covered = 0;
  for (let camX = -TRACK_HALF; camX <= TRACK_HALF; camX += 120) {
    const c = makeCountingCtx();
    if (drawCloudShadows(c, blob, pal, 40, camX, 900, lanesFor(150), scratch) > 0) covered++;
  }
  const stops = Math.floor((TRACK_HALF * 2) / 120) + 1;
  check("Không có đoạn đường đua nào trống bóng mây", covered === stops,
    `${covered}/${stops} chỗ dừng máy quay đều có mây`);

  // Tắt mây bằng bảng màu thì không tốn lệnh nào — đường thoát cho bảng màu nào
  // không muốn có mây, và nó phải rẻ bằng không chứ không phải rẻ gần bằng không.
  const off = makeCountingCtx();
  const dark = { ...pal, cloud: { ...pal.cloud, alpha: 0 } };
  check("Bảng màu tắt mây thì không tốn lệnh vẽ nào",
    drawCloudShadows(off, blob, dark, 40, 0, 900, lanesFor(150), scratch) === 0 && off.total() === 0);
}

// =====================================================================
//  6. THỜI TIẾT: CÓ VẼ THẬT, KHÔNG DÙNG arc(), VÀ CÓ TRẦN CHI PHÍ
// =====================================================================
{
  const silent = [];
  const usedArc = [];
  let worstOps = 0;
  let worstKind = "";

  for (const w of WEATHERS) {
    if (w.id === "khong") continue;
    for (const intensity of [0, 0.45, 1]) {
      const c = makeCountingCtx();
      const parts = drawWeather(c, w.id, 7.25, 1920, 980, 2, intensity);
      if (parts <= 0) silent.push(`${w.id}@${intensity}`);
      if (c.get("arc") > 0) usedArc.push(w.id);
      if (c.total() > worstOps) { worstOps = c.total(); worstKind = w.id; }
    }
  }

  check("Mọi kiểu thời tiết đều vẽ ra thật, ở mọi mức chuyển động", silent.length === 0,
    silent.length ? silent.join(", ") : `${WEATHERS.length - 1} kiểu × 3 mức`);

  // Điều khoản của lớp cảm giác: giảm chuyển động thì HẠ BIÊN ĐỘ, không bao giờ
  // cắt phản hồi về không. Thời tiết là thông tin về cảnh, không phải trang trí.
  const low = makeCountingCtx();
  const high = makeCountingCtx();
  const lowN = drawWeather(low, "tuyet", 7.25, 1920, 980, 2, 0);
  const highN = drawWeather(high, "tuyet", 7.25, 1920, 980, 2, 1);
  check("Giảm chuyển động thì thưa đi chứ không tắt hẳn", lowN > 0 && lowN < highN,
    `${lowN} hạt so với ${highN} hạt`);

  check("Thời tiết không gọi arc()", usedArc.length === 0,
    usedArc.length
      ? usedArc.join(", ") + " — phép đếm ở check-race-runtime.mjs sẽ nói sai"
      : "phép đếm vòng sao ở cửa chạy thật vẫn nói đúng thứ nó nói");

  check("Chi phí một khung hình thời tiết nằm trong ngân sách", worstOps <= 400,
    `nặng nhất là "${worstKind}" với ${worstOps} lệnh mỗi khung hình`);

  // Quang mây và một id lạ đều phải rẻ bằng không.
  const none = makeCountingCtx();
  const junk = makeCountingCtx();
  check("Quang mây và id lạ đều không tốn lệnh nào",
    drawWeather(none, "khong", 1, 1920, 980, 2, 1) === 0 && none.total() === 0 &&
    drawWeather(junk, "bao_tuyet_sao_hoa", 1, 1920, 980, 2, 1) === 0 && junk.total() === 0);

  // Hạt phải nằm trong khung hình. Một lớp thời tiết rơi ở ngoài màn hình là một
  // lớp thời tiết không ai thấy, và nó vẫn tốn đúng chừng ấy lệnh vẽ.
  let outside = 0;
  let sampled = 0;
  const bounds = makeCountingCtx();
  const W = 1920, H = 980;
  bounds.fillRect = (x, y, w, h) => {
    sampled++;
    if (y > H + 200 || y + h < -200) outside++;
  };
  bounds.moveTo = (x, y) => { sampled++; if (y > H + 200 || y < -200) outside++; };
  bounds.ellipse = (x, y) => { sampled++; if (y > H + 200 || y < -200) outside++; };
  for (const w of WEATHERS) {
    for (let t = 0; t < 12; t += 0.37) drawWeather(bounds, w.id, t, W, H, 2, 1);
  }
  check("Hạt thời tiết luôn nằm trong khung hình", outside === 0,
    `${sampled.toLocaleString("vi")} hạt qua 33 khung hình × ${WEATHERS.length} kiểu`);
}

// =====================================================================
//  7. NỀN VÀ VỆT NẮNG
// =====================================================================
{
  const c = makeCountingCtx();
  const pal = skyPalette("ngay");
  const cache = makeBackdrop(c, pal, 980);
  check("Dải chuyển màu nền dựng được", cache !== null && cache.h === 980 && cache.id === "ngay");

  // Nhớ lại chứ không dựng lại mỗi khung: dựng lại là một đối tượng rác mỗi
  // khung hình, đúng nhóm rác mà cả tools/race/perf.mjs đi dọn.
  check("Dải chuyển màu được dùng lại khi khung hình không đổi",
    backdropStale(null, pal, 980) === true &&
    backdropStale(cache, pal, 980) === false &&
    backdropStale(cache, pal, 720) === true &&
    backdropStale(cache, skyPalette("dem"), 980) === true);

  const blob = bakeSoftBlob((w, h) => fakeCanvas(), 512, "255,255,255");
  const sun = makeCountingCtx();
  check("Vệt nắng tốn đúng một lệnh vẽ",
    drawSunWash(sun, blob, pal, 1920, 980) === 1 && sun.get("drawImage") === 1);

  const noSun = makeCountingCtx();
  check("Bảng màu không có nắng thì không tốn lệnh nào",
    drawSunWash(noSun, blob, { ...pal, sun: null }, 1920, 980) === 0 && noSun.total() === 0);
}

// =====================================================================
//  8. NGÂN SÁCH CỦA CẢ BA LỚP CỘNG LẠI
// =====================================================================
{
  // Cái sân nướng sẵn tốn chừng năm lệnh drawImage mỗi khung hình (xem
  // tools/race/perf-selftest.mjs). Ba lớp mới cộng vào không được lớn hơn nó
  // nhiều lần, nếu không thì khoản lãi của việc nướng sân bị chính lớp trang trí
  // ăn mất.
  const pal = skyPalette("hoang_hon");
  const blob = bakeSoftBlob((w, h) => fakeCanvas(), 512, "0,0,0");
  const scratch = { x: 0, y: 0, r: 0 };
  const c = makeCountingCtx();
  c.fillRect(0, 0, 1920, 980);                                    // nền
  drawCloudShadows(c, blob, pal, 40, 0, 900, lanesFor(150), scratch);
  drawSunWash(c, blob, pal, 1920, 980);
  const total = c.total() + drawWeather(makeCountingCtx(), "la", 40, 1920, 980, 2, 1) * 5;
  console.log(`\n  Ba lớp trời cộng lại: ${c.total()} lệnh vẽ mỗi khung hình\n`);
  check("Ba lớp trời cộng lại rẻ hơn một phần tư ngân sách vẽ của đàn 150",
    c.total() <= 150 / 4, `${c.total()} lệnh so với trần ${150 / 4}`);
  check("Kể cả cộng thêm lớp thời tiết nặng nhất vẫn dưới nghìn lệnh", total < 1000, `${total} lệnh`);
}

console.log(failed === 0 ? "\nCỬA TRỜI VÀ THỜI TIẾT ĐẠT\n" : `\n${failed} MỤC KHÔNG ĐẠT\n`);
process.exit(failed === 0 ? 0 : 1);
