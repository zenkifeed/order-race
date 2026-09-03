// Cửa cảm giác phần thân cuộc đua — Order Race / M2
// Chạy: node tools/race/juice-selftest.mjs
//
// Bộ canh nhịp là thứ dễ làm hỏng nhất trong cả đợt này, vì nó hỏng theo kiểu
// KHÔNG ai phát hiện được lúc chạy thử với tám cái tên. Với tám con thì thứ
// hạng tách bạch và không có gì để nhầm. Với 150 con thì lúc nào cũng có vài
// cặp chạy ngang nhau, thứ hạng của chúng đảo qua đảo lại sáu mươi lần một
// giây, và cái đáng lẽ là một cú "đổi ngôi đầu" trở thành một tràng liên thanh
// — đúng lúc cả phòng đang nhìn.
//
// Nên cửa này kiểm nhiều nhất vào chuyện đó: báo khi nào, và quan trọng hơn,
// KHÔNG báo khi nào.

import { draw, makeTestRoster } from "../fairness/fairness.mjs";
import { buildRace } from "./director.mjs";
import {
  JUICE, makeBeatWatcher, streakPitch, gallopAt, gallopPhase, gallopFrame, breatheAt, makeDust,
} from "./juice.mjs";
import { GALLOP_FRAMES } from "../web/dog.mjs";

let failed = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "  OK  " : "  SAI "} ${name}${detail ? "  — " + detail : ""}`);
  if (!ok) failed++;
}

/** Chạy bộ canh nhịp qua trọn một cuộc đua ở 60 khung hình mỗi giây. */
function runWatch(race, topK, durationSec = 40) {
  const w = makeBeatWatcher({ topK });
  const events = [];
  const n = race.n;
  const pos = new Float64Array(n);
  const order = new Int32Array(n);
  const FPS = 60;
  const frames = Math.round(durationSec * 1.2 * FPS);

  for (let f = 0; f < frames; f++) {
    const tSec = (f / FPS);
    const tNorm = tSec / durationSec;
    for (let dog = 0; dog < n; dog++) {
      pos[dog] = race.progressAtTime(dog, tSec);
      order[dog] = dog;
    }
    Array.prototype.sort.call(order, (p, q) => pos[q] - pos[p] || p - q);
    const e = w.feed(order, pos, tSec, tNorm);
    if (e) events.push(e);
  }
  return events;
}

const RACES = [];
for (const n of [8, 20, 45, 90, 150]) {
  for (let i = 0; i < 8; i++) {
    const topK = 1 + (i % 4);
    const d = draw(makeTestRoster(7000 + i, n), `Giải cảm giác ${n}-${i}`);
    RACES.push({ n, topK, race: buildRace(d.finalOrder, d.seedHex, { topK }) });
  }
}
console.log(`${RACES.length} cuộc đua (8, 20, 45, 90, 150 chó)\n`);

// =====================================================================
//  1. BỘ CANH NHỊP — KHÔNG BÁO GIẢ
// =====================================================================
{
  // Hai chú chó chạy ngang nhau, chênh nhau một phần triệu đường đua, đảo chỗ
  // mỗi khung hình. Đây chính xác là thứ xảy ra ở đàn đông, và nó phải cho ra
  // ĐÚNG KHÔNG sự kiện nào. Bản không có ngưỡng khoảng cách cho ra một cú báo
  // mỗi lần hết quãng nghỉ, tức là suốt cuộc đua.
  const w = makeBeatWatcher({ topK: 3 });
  const pos = new Float64Array(4);
  const order = new Int32Array(4);
  let fired = 0;
  for (let f = 0; f < 3600; f++) {
    const t = f / 60;
    pos[0] = 0.5 + t * 0.02 + (f % 2 ? 1e-6 : 0);
    pos[1] = 0.5 + t * 0.02 + (f % 2 ? 0 : 1e-6);
    pos[2] = 0.4 + t * 0.02;
    pos[3] = 0.3 + t * 0.02;
    for (let i = 0; i < 4; i++) order[i] = i;
    Array.prototype.sort.call(order, (p, q) => pos[q] - pos[p] || p - q);
    if (w.feed(order, pos, t, t / 40)) fired++;
  }
  check("Hai con chạy ngang nhau không sinh ra cú báo nào", fired === 0,
    `3 600 khung hình đảo ngôi liên tục, ${fired} lần báo`);
}

// =====================================================================
//  2. BỘ CANH NHỊP — BẮT ĐƯỢC CÚ ĐỔI NGÔI THẬT
// =====================================================================
{
  // Lớp đạo diễn bảo đảm mỗi cuộc đua có ít nhất 3 lần đổi ngôi đầu. Nếu bộ
  // canh nhịp im lặng trên một cuộc đua như vậy thì nó đã lọc quá tay, và cả
  // tính năng này chỉ là mã chết.
  let silent = 0;
  let totalEvents = 0;
  let leadEvents = 0;
  let edgeEvents = 0;
  const perRace = [];

  for (const { race, topK } of RACES) {
    const ev = runWatch(race, topK);
    perRace.push(ev.length);
    totalEvents += ev.length;
    leadEvents += ev.filter((e) => e.kind === "dan_dau").length;
    edgeEvents += ev.filter((e) => e.kind === "ranh_gioi").length;
    if (ev.length === 0) silent++;
  }
  const avg = totalEvents / RACES.length;
  check("Cuộc đua nào cũng có ít nhất một nhịp được báo", silent === 0,
    `trung bình ${avg.toFixed(1)} nhịp mỗi lượt, ít nhất ${Math.min(...perRace)}, nhiều nhất ${Math.max(...perRace)}`);
  check("Cả hai loại nhịp đều xảy ra thật", leadEvents > 0 && edgeEvents > 0,
    `${leadEvents} cú đổi ngôi đầu, ${edgeEvents} cú vượt ranh giới trúng thưởng`);

  // Trần trên cũng quan trọng như sàn dưới. Cuộc đua 40 giây mà báo hai chục
  // lần thì mỗi lần báo không còn nghĩa lý gì — đó là định nghĩa của quá tay.
  check("Không lượt nào bị báo quá dày", Math.max(...perRace) <= 12,
    `nhiều nhất ${Math.max(...perRace)} nhịp trong 40 giây`);
}

// =====================================================================
//  3. BỘ CANH NHỊP — TÔN TRỌNG QUÃNG NGHỈ VÀ SỰ IM LẶNG CUỐI
// =====================================================================
{
  let tooClose = 0;
  let tooLate = 0;
  for (const { race, topK } of RACES) {
    const ev = runWatch(race, topK);
    for (let i = 1; i < ev.length; i++) {
      if (ev[i].tSec - ev[i - 1].tSec < JUICE.COOLDOWN - 1e-9) tooClose++;
    }
    for (const e of ev) if (e.tSec / 40 >= JUICE.QUIET_FROM) tooLate++;
  }
  check("Hai nhịp không bao giờ sát nhau dưới quãng nghỉ", tooClose === 0,
    `quãng nghỉ ${JUICE.COOLDOWN} giây`);
  check("Im lặng hoàn toàn từ lúc pha về đích bắt đầu", tooLate === 0,
    `từ mốc ${(JUICE.QUIET_FROM * 100).toFixed(0)}% trở đi, khoảnh khắc chạm vạch sở hữu trọn kênh phản hồi`);
}

// =====================================================================
//  4. BỘ CANH NHỊP — KHÔNG BÁO Ở KHUNG HÌNH ĐẦU
// =====================================================================
{
  const w = makeBeatWatcher({ topK: 3 });
  const pos = Float64Array.from([0.1, 0.3, 0.2]);
  const order = Int32Array.from([1, 2, 0]);
  const first = w.feed(order, pos, 0, 0);
  check("Cửa chuồng vừa bật thì không có cú đổi ngôi nào", first === null,
    "khung hình đầu chỉ để ghi nhận hiện trạng");

  w.reset();
  check("Đặt lại thì quên sạch trạng thái cũ", w.feed(order, pos, 0, 0) === null);
}

// =====================================================================
//  5. CHUỖI ĐỔI NGÔI ĐẨY CAO ĐỘ LÊN, CÓ TRẦN
// =====================================================================
{
  let rising = true;
  for (let s = 1; s <= JUICE.STREAK_CAP; s++) {
    if (streakPitch(s) <= streakPitch(s - 1)) rising = false;
  }
  check("Chuỗi càng dài, tiếng báo càng cao", rising,
    `1 → ${streakPitch(JUICE.STREAK_CAP).toFixed(2)}×`);
  check("Cao độ có trần", streakPitch(99) === streakPitch(JUICE.STREAK_CAP),
    `trần ở chuỗi ${JUICE.STREAK_CAP}`);
}

// =====================================================================
//  6. NHỊP SẢI CHÂN
// =====================================================================
{
  // Nén giãn phải giữ nguyên thể tích. Không giữ thì con chó phồng lên xẹp
  // xuống như quả bóng thay vì như một sinh vật đang chạy.
  let worstVolume = 0;
  let worstJump = 0;
  let prev = null;
  const STEP = 0.00002;
  for (let d = 0; d < 0.02; d += STEP) {
    const g = gallopAt(0.7, d, 1);
    worstVolume = Math.max(worstVolume, Math.abs(g.sx * g.sy - 1));
    if (prev) {
      worstJump = Math.max(worstJump,
        Math.abs(g.bob - prev.bob), Math.abs(g.sy - prev.sy) * 40);
    }
    prev = g;
  }
  check("Nén giãn giữ nguyên thể tích", worstVolume < 1e-12,
    `lệch lớn nhất ${worstVolume.toExponential(1)}`);
  check("Nhịp chân liền mạch, không nhảy bậc", worstJump < 0.5,
    `bước lớn nhất ${worstJump.toFixed(4)} đơn vị sân giữa hai mẫu`);

  const off = gallopAt(0.7, 0.01, 0);
  check("Giảm chuyển động thì tắt hẳn nhịp chân",
    off.bob === 0 && off.sx === 1 && off.sy === 1);

  // Cả đàn nhún cùng nhịp thì trông như một khối duy nhất đang thở, không
  // giống một đàn chó. Lệch pha phải trải đều.
  const phases = [];
  for (let dog = 0; dog < 150; dog++) phases.push(gallopPhase(dog));
  const buckets = new Set(phases.map((p) => Math.floor(p / (Math.PI / 4))));
  check("Mỗi con chạy lệch pha với con bên cạnh", buckets.size >= 6,
    `${buckets.size}/8 nhóm pha có mặt trong đàn 150 con`);

  // Nhịp chân suy ra từ QUÃNG ĐƯỜNG: đứng yên thì chân cũng đứng yên. Đây là
  // thứ giữ cho cú đóng băng ở khung va chạm còn nguyên sức nặng.
  const a = gallopAt(1.1, 0.5, 1);
  const b = gallopAt(1.1, 0.5, 1);
  check("Đứng yên thì chân cũng đứng yên", a.bob === b.bob && a.sy === b.sy,
    "nhịp chân theo quãng đường, không theo đồng hồ");
}

// =====================================================================
//  6b. KHUNG TƯ THẾ CHÂN
//
//  gallopAt lo cái thân nhấp nhô; gallopFrame lo bốn cái chân. Hai thứ phải đi
//  chung một nhịp, và đó chính là phép kiểm quan trọng nhất ở đây.
// =====================================================================
{
  let bad = 0;
  for (let i = 0; i <= 5000; i++) {
    const f = gallopFrame(gallopPhase(i % 150), i / 5000, GALLOP_FRAMES);
    if (!Number.isInteger(f) || f < 0 || f >= GALLOP_FRAMES) bad++;
  }
  check("Khung tư thế luôn nằm trong dải đã nướng", bad === 0,
    `${GALLOP_FRAMES} tư thế — chỉ số ngoài dải là một sprite rỗng, không phải một lỗi văng ra`);

  // Một sải chân dài đúng π trong biến u, tức là đúng một vòng nhấp nhô của
  // thân. Lệch nhịp thì con chó nhún một đằng, đạp một nẻo.
  const stride = Math.PI / JUICE.GALLOP_FREQ;
  let mismatched = 0;
  for (let i = 0; i < 400; i++) {
    const d = i / 400;
    if (gallopFrame(0.3, d, GALLOP_FRAMES) !== gallopFrame(0.3, d + stride, GALLOP_FRAMES)) {
      mismatched++;
    }
  }
  check("Một sải chân khớp đúng một vòng nhấp nhô của thân", mismatched === 0,
    `${(1 / stride).toFixed(0)} sải trên một vòng đua`);

  // Đứng yên thì chân đứng yên — cùng tính chất với gallopAt, và đây là thứ
  // giữ cho cú đóng băng ở khung va chạm còn nguyên sức nặng.
  check("Đứng yên thì tư thế chân cũng đứng yên",
    gallopFrame(1.1, 0.5, GALLOP_FRAMES) === gallopFrame(1.1, 0.5, GALLOP_FRAMES));

  // Chạy thì phải đổi tư thế. Một cuộc đua 40 giây phải đi qua cả dải, không
  // được kẹt ở một hai khung — kẹt thì chân "có động" trên giấy mà đứng chết
  // trên màn hình.
  const seen = new Set();
  for (let i = 0; i <= 1000; i++) seen.add(gallopFrame(0.3, i / 1000, GALLOP_FRAMES));
  check("Cả dải tư thế đều được dùng tới trong một cuộc đua",
    seen.size === GALLOP_FRAMES, `${seen.size}/${GALLOP_FRAMES} tư thế xuất hiện`);

  // Cả đàn cùng một khung tư thế thì đó là một khối duy nhất đang đạp chân,
  // không phải một đàn chó.
  const spread = new Set();
  for (let dog = 0; dog < 150; dog++) spread.add(gallopFrame(gallopPhase(dog), 0.4, GALLOP_FRAMES));
  check("Cả đàn không đạp chân cùng một nhịp", spread.size >= GALLOP_FRAMES - 1,
    `${spread.size}/${GALLOP_FRAMES} tư thế có mặt cùng lúc trong đàn 150 con`);
}

// =====================================================================
//  7. MÁY QUAY THỞ
// =====================================================================
{
  let lo = Infinity;
  let hi = -Infinity;
  let worstJump = 0;
  let prev = breatheAt(0, 1);
  for (let t = 0; t < 60; t += 1 / 60) {
    const v = breatheAt(t, 1);
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
    worstJump = Math.max(worstJump, Math.abs(v - prev));
    prev = v;
  }
  check("Biên độ thở nhỏ tới mức không ai chỉ ra được",
    hi - 1 <= JUICE.BREATHE + 1e-12 && 1 - lo <= JUICE.BREATHE + 1e-12,
    `${((hi - lo) * 100).toFixed(2)}% mức phóng, chu kỳ ${JUICE.BREATHE_PERIOD} giây`);
  check("Thở liền mạch", worstJump < 0.001, `bước lớn nhất ${worstJump.toExponential(1)}`);
  check("Giảm chuyển động thì máy quay đứng yên hẳn", breatheAt(3.3, 0) === 1);
}

// =====================================================================
//  8. BỤI — HỒ CHỨA CỐ ĐỊNH, KHÔNG BAO GIỜ CẤP PHÁT
// =====================================================================
{
  const dust = makeDust(64);
  check("Hồ chứa rỗng lúc mới dựng", dust.alive() === 0);

  // Bắn gấp mười lần sức chứa. Số hạt sống không được vượt sức chứa, và không
  // một mảng nào được dựng thêm — đây đúng là điều khoản "đừng dựng mới trên
  // đường đi nóng của hiệu ứng" của lớp cảm giác.
  for (let i = 0; i < 100; i++) dust.spawn(10, 20, 8, 1, 0, 1);
  check("Bắn quá sức chứa thì ghi đè hạt cũ nhất, không phình ra",
    dust.alive() <= 64 && dust.x.length === 64,
    `${dust.alive()}/64 hạt sống sau 800 lần bắn`);

  const before = { x: dust.x.buffer, life: dust.life.buffer };
  for (let f = 0; f < 600; f++) {
    dust.spawn(0, 0, 3, 1, 0, 1);
    dust.update(1 / 60);
  }
  check("Chạy 600 khung hình không thay bộ nhớ đệm nào",
    dust.x.buffer === before.x && dust.life.buffer === before.life);

  // Hạt phải chết. Không chết thì sau bốn mươi giây màn hình đầy bụi.
  for (let f = 0; f < 200; f++) dust.update(1 / 60);
  check("Ngừng bắn thì bụi tan hết", dust.alive() === 0,
    "sau 3,3 giây không bắn thêm");

  dust.spawn(5, 5, 20, 0, 1, 1);
  dust.clear();
  check("Xoá là sạch", dust.alive() === 0);

  // Bụi chạy trên thời gian ĐÃ LÀM CHẬM: cuộc đua đứng yên thì bụi đứng yên.
  dust.spawn(0, 0, 4, 1, 0, 1);
  const snapshot = Array.from(dust.x);
  dust.update(0);
  check("Thời gian dừng thì bụi cũng dừng",
    Array.from(dust.x).every((v, i) => v === snapshot[i]),
    "trong lúc đóng băng ở khung va chạm, mọi thứ phải đứng yên trừ màn hình rung");
}

console.log(failed === 0 ? "\nCỬA CẢM GIÁC THÂN CUỘC ĐUA ĐẠT\n" : `\n${failed} MỤC KHÔNG ĐẠT\n`);
process.exit(failed === 0 ? 0 : 1);
