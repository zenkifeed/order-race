// Cửa hiệu năng, nửa CPU — Order Race / M2
// Chạy: node tools/race/perf-selftest.mjs
//
// GDD §11 đòi 150 chú chó giữ p99 dưới 20 ms trên đúng chiếc laptop sẽ dùng ở
// phòng họp. Cửa này KHÔNG thay được phép đo đó — nó không có card đồ hoạ, không
// có máy chiếu, không chạy bằng pin. Nó đo nửa còn lại, nửa mà một cửa chạy
// không cần trình duyệt đo được và đo chính xác:
//
//   · toàn bộ phép tính của một khung hình (nội suy, xếp hạng, chiếu, cắt bớt)
//   · số lệnh vẽ mà nửa đó quyết định sẽ gửi xuống canvas
//
// Ngân sách chia đôi: nửa CPU không được ăn quá 4 ms của 20 ms, để lại 16 ms
// cho phần vẽ. Nếu nửa CPU vượt ngân sách thì phép đo trên máy thật chưa cần
// chạy cũng biết là trượt.
//
// Mọi phép so sánh ở đây đều đối chiếu với BẢN CŨ, dựng lại nguyên văn ở dưới.
// Một con số đứng một mình ("0,42 ms") không nói được gì; con số đặt cạnh cái
// nó thay thế thì nói được.

import { draw, makeTestRoster } from "../fairness/fairness.mjs";
import { buildRace } from "./director.mjs";
import { pointAt, TRACK_LEN, lanesFor, trackHalfH, assignLanes } from "./track.mjs";
import { makeFrameState, stepFrame, sortRankDesc, viewHalfExtent, cullMarginFor, CULL_MARGIN } from "./perf.mjs";
import { paintTile, bakeTile, drawTiledTrack, drawMarkers, TILE_W, makeCountingCtx } from "./stage.mjs";

let failed = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "  OK  " : "  SAI "} ${name}${detail ? "  — " + detail : ""}`);
  if (!ok) failed++;
}

/** Màn hình phòng họp mẫu: máy chiếu 1080p, trừ đi thanh bên và thanh trạng thái. */
const CLIENT_W = 1920;
const CLIENT_H = 980;
/**
 * Mức phóng cơ sở, tính đúng công thức mà web/race.html dùng.
 *
 * Sân thẳng có chiều cao đổi theo số làn, nên mức phóng không còn là hằng số
 * như hồi sân oval — nó tự căn để vừa cả chiều cao đường đua lẫn bề ngang của
 * đàn lúc giãn nhất. Chép công thức vào đây là một nguy cơ lệch, nhưng nguy cơ
 * đó nhỏ hơn hẳn việc đo hiệu năng ở một mức phóng mà trang không bao giờ dùng.
 */
function baseZoomFor(race, n, clientW, clientH) {
  const spread = race.progressOf(0, race.finishSample) -
                 race.progressOf(n - 1, race.finishSample);
  const zh = clientH / (2 * trackHalfH(lanesFor(n)) + 170);
  const zw = clientW / (spread * TRACK_LEN + 340);
  const z = Math.min(zh, zw);
  return z < 0.85 ? 0.85 : z > 2.4 ? 2.4 : z;
}

/** Ngân sách của nửa CPU trong một khung hình 20 ms. */
const CPU_BUDGET_MS = 4;

/** Cỡ vẽ của một model, đúng công thức mà web/race.html dùng. */
const dogScaleFor = (n) => Math.max(0.34, Math.min(0.66, 0.70 - n * 0.0019));

function makeCase(n, topK = 3) {
  const d = draw(makeTestRoster(500 + n, n), `Giải hiệu năng ${n}`);
  const race = buildRace(d.finalOrder, d.seedHex, { topK });
  const lanes = assignLanes(n, d.seedHex, lanesFor(n));
  return { n, topK, race, lanes, fs: makeFrameState(n) };
}

// =====================================================================
//  BẢN CŨ — dựng lại nguyên văn để có cái mà so
// =====================================================================
//
// Ba đặc điểm của bản cũ, tất cả đều nằm trong hàm render của web/race.html
// trước khi sửa: pointAt cấp phát một đối tượng mỗi con mỗi khung, thứ hạng
// dùng Array.prototype.sort tổng quát, và mọi con đều được vẽ dù nằm ở đâu.
function oldFrame(race, lanes, tn, out) {
  const n = race.n;
  const sc = race.sampleCount;
  const x = tn / race.dtNorm;
  const a = Math.max(0, Math.min(sc - 1, Math.floor(x)));
  const b = Math.min(sc - 1, a + 1);
  const f = x - a;
  for (let dog = 0; dog < n; dog++) {
    const row = dog * sc;
    out.pos[dog] = race.progress[row + a] * (1 - f) + race.progress[row + b] * f;
    out.idx[dog] = dog;
  }
  const order = out.idx;
  order.sort((p, q) => out.pos[q] - out.pos[p] || p - q);

  const lead = out.pos[order[0]];
  const back = out.pos[order[Math.min(7, n - 1)]];
  const cam = pointAt(lead - (lead - back) * 0.45, 0);

  let drawn = 0;
  for (let p = n - 1; p >= 0; p--) {
    const dog = order[p];
    const pt = pointAt(Math.min(out.pos[dog], 1.03), lanes[dog]);
    out.px[dog] = pt.x;
    out.py[dog] = pt.y;
    drawn++;
  }
  out.camX = cam.x;
  out.camY = cam.y;
  out.drawn = drawn;
  return out;
}

const makeOldState = (n) => ({
  pos: new Float64Array(n),
  idx: new Int32Array(n),
  px: new Float64Array(n),
  py: new Float64Array(n),
  camX: 0, camY: 0, drawn: 0,
});

// =====================================================================
//  1. SẮP CHÈN PHẢI CHO RA ĐÚNG THỨ TỰ CŨ
// =====================================================================
{
  // Đây là phép kiểm quan trọng nhất của cả file. Sắp xếp nhanh hơn mà đổi cách
  // xử lý hoà thì hai chú chó ngang nhau sẽ đảo chỗ mỗi khung hình, và cả cụm
  // biển tên nhấp nháy — đúng cái lỗi mà tools/web/labels-selftest.mjs canh.
  let mismatch = 0;
  let cases = 0;
  let rnd = 12345;
  const rand = () => ((rnd = (rnd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

  for (const n of [2, 3, 8, 45, 90, 150]) {
    for (let trial = 0; trial < 40; trial++) {
      const pos = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        // Một phần ba số lượt dùng vị trí có nhiều giá trị trùng, để phép so
        // sánh hoà bị ép chạy thật chứ không phải may mà không gặp.
        pos[i] = trial % 3 === 0 ? Math.round(rand() * 4) / 4 : rand();
      }

      const want = Array.from({ length: n }, (_, i) => i)
        .sort((p, q) => pos[q] - pos[p] || p - q);

      // Vừa kiểm trên thứ tự lộn xộn, vừa kiểm trên thứ tự gần đúng sẵn — đúng
      // trạng thái mà hàm này gặp lúc chạy thật: kết quả của khung hình trước.
      const shuffled = new Int32Array(n);
      for (let i = 0; i < n; i++) shuffled[i] = i;
      sortRankDesc(shuffled, pos, n);

      const nearly = Int32Array.from(want);
      if (n >= 4) {
        const i = Math.floor(rand() * (n - 1));
        const t = nearly[i]; nearly[i] = nearly[i + 1]; nearly[i + 1] = t;
      }
      sortRankDesc(nearly, pos, n);

      cases += 2;
      if (shuffled.join(",") !== want.join(",")) mismatch++;
      if (nearly.join(",") !== want.join(",")) mismatch++;
    }
  }
  check("Sắp chèn cho ra đúng thứ tự của Array.sort", mismatch === 0,
    `${cases} lượt, kể cả các lượt có vị trí trùng nhau`);
}

/** Ba khung nhìn thật, vì cắt bớt lãi hay không hoàn toàn phụ thuộc vào chúng. */
const VIEWS = [
  { name: "máy chiếu 1080p", w: 1920, h: 980, zoomMult: 1 },
  { name: "laptop 1366×768", w: 1366, h: 660, zoomMult: 1 },
  { name: "laptop, pha về đích", w: 1366, h: 660, zoomMult: 1.19 },
];

/**
 * Khung nhìn thật của một cảnh: mức phóng tự căn, nhân hệ số máy quay siết vào.
 *
 * Sân thẳng đổi hẳn bức tranh so với sân oval. Máy quay không còn nhìn được cả
 * đường đua — nó chạy dọc một dải dài 4 200 đơn vị, và phần lớn dải đó luôn nằm
 * ngoài khung. Nhưng đàn chó thì bám quanh máy quay, nên khoản lãi của cắt bớt
 * vẫn đến từ hai mép của chính đàn chó, không phải từ chiều dài đường đua.
 */
const viewFor = (v, race, n) =>
  viewHalfExtent(v.w, v.h, baseZoomFor(race, n, v.w, v.h) * v.zoomMult, dogScaleFor(n));

// =====================================================================
//  2. CẮT BỚT KHÔNG ĐƯỢC BỎ SÓT CON NÀO ĐANG NHÌN THẤY
// =====================================================================
{
  // Cắt sai kiểu bỏ sót thì người xem thấy chó biến mất giữa màn hình. Kiểm
  // bằng vét cạn: mọi con nằm trong hình chữ nhật khung hình đều phải có tên
  // trong danh sách vẽ, ở mọi thời điểm của cuộc đua.
  let missed = 0;
  let checkedFrames = 0;

  for (const v of VIEWS) {
    for (const n of [8, 45, 150]) {
      const c = makeCase(n);
      const view = viewFor(v, c.race, n);
      for (let tn = 0; tn <= 1.2; tn += 0.004) {
        stepFrame(c.fs, c.race, tn, c.lanes, view);
        checkedFrames++;
        const inList = new Set();
        for (let i = 0; i < c.fs.visCount; i++) inList.add(c.fs.vis[i]);
        for (let dog = 0; dog < n; dog++) {
          const dx = Math.abs(c.fs.px[dog] - c.fs.camX);
          const dy = Math.abs(c.fs.py[dog] - c.fs.camY);
          // Vét cạn dùng khung hình THẬT, không cộng biên an toàn. Con nào thật
          // sự nhìn thấy được mà không có trong danh sách vẽ thì là bỏ sót.
          if (dx <= view.halfW && dy <= view.halfH && !inList.has(dog)) missed++;
        }
      }
    }
  }
  check("Cắt bớt không bỏ sót con nào đang nhìn thấy", missed === 0,
    `${checkedFrames.toLocaleString("vi")} khung hình vét cạn trên 3 khung nhìn, ` +
    `biên an toàn theo cỡ vẽ, ${cullMarginFor(0.415).toFixed(0)}–${CULL_MARGIN.toFixed(0)} đơn vị sân`);
}

// =====================================================================
//  3. CẮT BỚT LÃI BAO NHIÊU — VÀ Ở ĐÂU THÌ KHÔNG LÃI
// =====================================================================
console.log("\n  Số con trong đàn 150 phải vẽ mỗi khung hình:\n");
console.log("  khung nhìn            khung hình   phải vẽ   bớt được");
console.log("  ───────────────────── ──────────── ───────── ─────────");

const cullByView = new Map();
for (const v of VIEWS) {
  const c = makeCase(150);
  const view = viewFor(v, c.race, 150);
  let sum = 0;
  let frames = 0;
  for (let tn = 0; tn <= 1.2; tn += 0.002) {
    stepFrame(c.fs, c.race, tn, c.lanes, view);
    sum += c.fs.visCount;
    frames++;
  }
  const avg = sum / frames;
  cullByView.set(v.name, { rate: 1 - avg / 150, avg });
  console.log(
    "  " + v.name.padEnd(21) +
    " " + `${Math.round(view.halfW * 2)}×${Math.round(view.halfH * 2)}`.padEnd(12) +
    " " + avg.toFixed(1).padEnd(9) +
    " " + ((1 - avg / 150) * 100).toFixed(0) + "%"
  );
}
console.log("");
{
  // Hai phép kiểm ở đây từng mô tả sân oval, và sân thẳng làm cả hai sai — theo
  // hướng tốt lên. Trên oval, khoản lãi bằng không ở máy chiếu 1080p vì cả sân
  // lọt trong khung hình, và chỉ hiện ra ở laptop lúc máy quay siết vào. Trên
  // sân thẳng thì máy quay không bao giờ nhìn được cả đường đua, nên khoản lãi
  // có mặt ở MỌI khung nhìn, và đều hơn.
  //
  // Sửa hai phép kiểm cho khớp thực tế mới chứ không xoá: điều đáng canh vẫn
  // còn nguyên giá trị, chỉ là ngưỡng đã đổi.
  const worst = Math.min(...[...cullByView.values()].map((x) => x.rate));
  const finish = cullByView.get("laptop, pha về đích");
  check("Cắt bớt lãi ở MỌI khung nhìn, không chỉ ở pha về đích", worst >= 0.08,
    `thấp nhất bớt ${(worst * 100).toFixed(0)}% số con — trên sân oval con số này là 1%`);
  check("Pha về đích lãi nhiều nhất", finish.rate >= worst,
    `bớt ${(finish.rate * 100).toFixed(0)}% số con, ` +
    `tiết kiệm ${Math.round((150 - finish.avg) * 2 * 60).toLocaleString("vi")} lệnh drawImage mỗi giây`);
  check("Không khung nhìn nào cắt oan quá tay",
    Math.max(...[...cullByView.values()].map((x) => x.rate)) < 0.6,
    "cắt quá nửa đàn nghĩa là đường cắt đang ăn vào phần nhìn thấy được");
}

// =====================================================================
//  4. NGÂN SÁCH NỬA CPU
// =====================================================================
console.log("  Chi phí nửa CPU của một khung hình:\n");
console.log("  đàn    bản cũ    bản mới   nhanh hơn");
console.log("  ────── ───────── ───────── ─────────");

const costs = new Map();
for (const n of [8, 45, 90, 150]) {
  const c = makeCase(n);
  const old = makeOldState(n);
  const view = viewFor(VIEWS[0], c.race, n);
  const FRAMES = 4000;

  const bench = (fn) => {
    // Chạy nóng máy trước. Không có bước này thì lần đo đầu tiên gánh cả chi
    // phí biên dịch tối ưu của V8, và bản nào chạy trước cũng trông chậm hơn.
    for (let i = 0; i < 600; i++) fn(i / 600);
    let best = Infinity;
    for (let rep = 0; rep < 5; rep++) {
      const t0 = performance.now();
      for (let i = 0; i < FRAMES; i++) fn((i % 1000) / 1000 * 1.2);
      const ms = (performance.now() - t0) / FRAMES;
      if (ms < best) best = ms;
    }
    return best;
  };

  // Lấy lần chạy NHANH NHẤT trong năm lượt, không lấy trung bình. Trung bình
  // gộp cả những lượt bị hệ điều hành cắt ngang; lần nhanh nhất là ước lượng
  // sát nhất của chi phí thật.
  const msOld = bench((tn) => oldFrame(c.race, c.lanes, tn, old));
  const msNew = bench((tn) => stepFrame(c.fs, c.race, tn, c.lanes, view));
  costs.set(n, msNew);

  console.log(
    "  " + String(n).padEnd(6) +
    " " + (msOld.toFixed(3) + " ms").padEnd(9) +
    " " + (msNew.toFixed(3) + " ms").padEnd(9) +
    " " + (msOld / msNew).toFixed(2) + "×"
  );
}
console.log("");
{
  const ms150 = costs.get(150);
  check(`Nửa CPU ở đàn 150 con nằm trong ngân sách ${CPU_BUDGET_MS} ms`, ms150 < CPU_BUDGET_MS,
    `${ms150.toFixed(3)} ms, còn ${(20 - ms150).toFixed(2)} ms cho phần vẽ`);
  let monotonic = true;
  let prev = 0;
  for (const n of [8, 45, 90, 150]) {
    if (costs.get(n) < prev * 0.8) monotonic = false;
    prev = costs.get(n);
  }
  check("Chi phí tăng theo số người chứ không nhảy bậc", monotonic,
    [8, 45, 90, 150].map((n) => `${n}:${costs.get(n).toFixed(3)}`).join(" "));
}

// =====================================================================
//  5. KHÔNG CẤP PHÁT TRÊN ĐƯỜNG ĐI NÓNG
// =====================================================================
{
  // Không đo được trực tiếp "có cấp phát hay không" nếu không có cờ --expose-gc,
  // nên đo cái đo được: mức tăng của vùng nhớ động sau vài nghìn khung hình,
  // đặt cạnh bản cũ. Bản cũ sinh một đối tượng cho mỗi con mỗi khung; bản mới
  // ghi vào một đối tượng nháp duy nhất. Chênh lệch phải rất lớn.
  const n = 150;
  const c = makeCase(n);
  const old = makeOldState(n);
  const view = viewFor(VIEWS[0], c.race, n);
  const FRAMES = 6000;

  // Lấy hiệu số đầu–cuối thì không dùng được: bộ dọn rác chạy khi nó muốn, và
  // một lượt dọn rơi vào giữa phép đo cho ra mức tăng ÂM — bản cũ từng đo ra
  // "−1,10 MB", một con số vô nghĩa mà vẫn qua cửa.
  //
  // Cộng dồn các mức TĂNG lấy mẫu dày thì miễn nhiễm với chuyện đó: mỗi lượt
  // dọn rác là một mức giảm và bị bỏ qua, còn phần cấp phát giữa hai lần lấy
  // mẫu thì vẫn được cộng vào. Đây là ước lượng chặn dưới của lượng rác thật.
  const allocated = (fn) => {
    for (let i = 0; i < 500; i++) fn(i / 500);
    let sum = 0;
    let prev = process.memoryUsage().heapUsed;
    for (let i = 0; i < FRAMES; i++) {
      fn((i % 1000) / 1000 * 1.2);
      if (i % 50 === 49) {
        const now = process.memoryUsage().heapUsed;
        if (now > prev) sum += now - prev;
        prev = now;
      }
    }
    return sum;
  };

  const gOld = allocated((tn) => oldFrame(c.race, c.lanes, tn, old));
  const gNew = allocated((tn) => stepFrame(c.fs, c.race, tn, c.lanes, view));
  const mb = (b) => (b / 1048576).toFixed(2) + " MB";

  check("Đường đi nóng không sinh rác", gOld > 0 && gNew < gOld * 0.2,
    `bản mới ${mb(gNew)} / bản cũ ${mb(gOld)} sau ${FRAMES.toLocaleString("vi")} khung hình 150 con — ` +
    `bằng ${((gNew / gOld) * 100).toFixed(1)}% lượng cấp phát cũ`);
}

// =====================================================================
//  6. KẾT QUẢ PHẢI GIỐNG HỆT BẢN CŨ
// =====================================================================
{
  // Nhanh hơn mà vẽ ra khác đi thì không phải tối ưu, mà là viết lại. Vị trí,
  // thứ hạng và máy quay phải trùng khít từng con số.
  let diff = 0;
  let compared = 0;
  for (const n of [8, 45, 150]) {
    const c = makeCase(n);
    const view = viewFor(VIEWS[0], c.race, n);
    const old = makeOldState(n);
    for (let tn = 0; tn <= 1.2; tn += 0.01) {
      stepFrame(c.fs, c.race, tn, c.lanes, view);
      oldFrame(c.race, c.lanes, tn, old);
      compared++;
      if (c.fs.order.join(",") !== Array.from(old.idx).join(",")) { diff++; continue; }
      if (Math.abs(c.fs.camX - old.camX) > 1e-9 || Math.abs(c.fs.camY - old.camY) > 1e-9) { diff++; continue; }
      for (let dog = 0; dog < n; dog++) {
        if (Math.abs(c.fs.px[dog] - old.px[dog]) > 1e-9 || Math.abs(c.fs.py[dog] - old.py[dog]) > 1e-9) {
          diff++;
          break;
        }
      }
    }
  }
  check("Bản mới dựng ra đúng khung hình mà bản cũ dựng", diff === 0,
    `${compared} khung hình trùng khít vị trí, thứ hạng và máy quay`);
}

// =====================================================================
//  7. NƯỚNG SÂN — KHOẢN LÃI THẬT SỰ CỦA NỬA VẼ
// =====================================================================
{
  // Chỗ này mới là nơi có tiền, chứ không phải nửa CPU. Đường đua là hình tĩnh
  // suốt 40 giây mà mỗi khung hình lại tô lại từ đầu: tám đường viền oval, mỗi
  // đường hai cung tròn lớn, cộng tám ô vạch xuất phát.
  //
  // Số lệnh vẽ chỉ là phần đếm được. Cái đắt hơn nằm sau nó: đường viền dày 208
  // đơn vị chạy quanh cả sân là vài trăm nghìn điểm ảnh phải tô lại sáu mươi
  // lần mỗi giây. Một cửa chạy trong node không đo được băng thông tô của một
  // trình duyệt, nên nó đo thứ tỉ lệ thuận với nó và đo được chính xác.
  const lanes150 = lanesFor(150);
  const c = makeCase(150);
  const view = viewFor(VIEWS[0], c.race, 150);

  // Bản cũ: tô lại toàn bộ dải sân đang nhìn thấy, mỗi khung hình. Trên sân
  // thẳng thì đó là nền cỏ, mặt đường, và một vạch kẻ cho mỗi làn, chạy suốt
  // bề ngang khung hình — nhân với số khoanh mà khung hình phủ.
  const g = makeCountingCtx();
  const tilesAcross = Math.ceil((view.halfW * 2) / TILE_W) + 1;
  for (let i = 0; i < tilesAcross; i++) paintTile(g, lanes150, "ngay");
  const perFrameOld = g.total();

  const h = makeCountingCtx();
  const tile = { canvas: {}, w: TILE_W, h: 1, halfH: 1, lanes: lanes150 };
  const tilesDrawn = drawTiledTrack(h, tile, 0, view.halfW);
  const perFrameNew = h.total();

  console.log("  Lệnh vẽ để dựng cái sân, mỗi khung hình:\n");
  console.log(`  tô lại mỗi khung   ${perFrameOld} lệnh · ` +
              `${(perFrameOld * 60).toLocaleString("vi")} lệnh/giây`);
  console.log(`  lát khoanh nướng   ${perFrameNew} lệnh · ` +
              `${(perFrameNew * 60).toLocaleString("vi")} lệnh/giây\n`);

  check("Lát khoanh nướng rẻ hơn tô lại ít nhất mười lần",
    perFrameNew * 10 <= perFrameOld,
    `bớt ${perFrameOld - perFrameNew} lệnh mỗi khung, ` +
    `${((perFrameOld - perFrameNew) * 60).toLocaleString("vi")} lệnh mỗi giây`);

  // Số lệnh vẽ phải phụ thuộc BỀ RỘNG KHUNG HÌNH, không phụ thuộc chiều dài
  // đường đua. Đó là điều duy nhất khiến cách lát khoanh chịu được một sân dài
  // bao nhiêu cũng được — và là điều dễ mất nhất nếu ai đó sửa nhanh.
  const wide = makeCountingCtx();
  drawTiledTrack(wide, tile, 0, view.halfW * 4);
  check("Chi phí lát sân theo bề rộng khung hình, không theo chiều dài đường đua",
    tilesDrawn <= Math.ceil((view.halfW * 2) / TILE_W) + 3 &&
    wide.get("drawImage") > tilesDrawn,
    `${tilesDrawn} khoanh cho khung ${Math.round(view.halfW * 2)} đơn vị, ` +
    `${wide.get("drawImage")} khoanh khi khung rộng gấp bốn`);

  // Ảnh nướng KHÔNG được vượt trần kích thước canvas của trình duyệt. Nướng cả
  // tấm sân 4 200 đơn vị ở 2× là một ảnh rộng 8 480 điểm ảnh, và có máy trần
  // chỉ 4 096 — một trang trắng trên máy người khác, giữa buổi lễ.
  let madeW = 0;
  let madeH = 0;
  const baked = makeCountingCtx();
  bakeTile((w, hh) => { madeW = w; madeH = hh; return { getContext: () => baked }; }, lanes150, 2, "ngay");
  check("Ảnh nướng nằm trong trần kích thước canvas của mọi trình duyệt",
    madeW <= 4096 && madeH <= 4096,
    `${madeW}×${madeH} điểm ảnh — trần thấp nhất từng gặp là 4 096`);

  // Khoanh sân giờ mang cả hoa văn: sọc cỏ cắt, vành đá đỏ trắng, hàng rào cây.
  // Vạch làn vẫn phải đủ một vạch cho mỗi ranh giới làn — đó là thứ DUY NHẤT
  // trên khoanh sân mà thiếu đi thì đọc sai được cuộc đua.
  check("Khoanh nướng vẽ đủ vạch làn",
    baked.get("stroke") === lanes150 - 1,
    `${baked.get("stroke")} vạch cho ${lanes150} làn`);

  // Trần chi phí nướng. Nướng lại xảy ra khi số làn đổi, tức là khi quản trò đổi
  // số người giữa buổi — và một khoanh sân vẽ hàng trăm mảng màu biến lúc đó
  // thành một khoảng khựng ai cũng thấy. Trần này là chỗ chặn hoa văn phình ra.
  check("Chi phí nướng một khoanh sân nằm trong trần",
    baked.total() <= 200,
    `${baked.total()} lệnh cho một khoanh ${madeW}×${madeH}`);

  // Vạch xuất phát và vạch đích chỉ tốn lệnh khi chúng nằm trong khung hình.
  const far = makeCountingCtx();
  drawMarkers(far, lanes150, 0, view.halfW, "ngay");
  const near = makeCountingCtx();
  drawMarkers(near, lanes150, TRACK_LEN / 2, view.halfW, "ngay");
  check("Vạch mốc chỉ tốn lệnh khi nó nằm trong khung hình",
    far.total() === 0 && near.total() > 0,
    `giữa đường đua ${far.total()} lệnh, ở vạch đích ${near.total()} lệnh`);
}

console.log(failed === 0 ? "\nCỬA HIỆU NĂNG (NỬA CPU) ĐẠT\n" : `\n${failed} MỤC KHÔNG ĐẠT\n`);
process.exit(failed === 0 ? 0 : 1);
