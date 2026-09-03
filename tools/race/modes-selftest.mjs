// Cửa biến thể cuộc đua — Order Race / M2
// Chạy: node tools/race/modes-selftest.mjs
//
// Cửa này trả lời hai câu hỏi, và câu thứ nhất quan trọng hơn hẳn:
//
//   1. Biến thể có đụng được vào kết quả không?  Phải là KHÔNG, trên mọi tổ hợp.
//      Toàn bộ giá trị của dự án nằm ở chỗ khán giả tự tính lại được người thắng
//      ở web/verify.html. Trang đó không biết gì về biến thể cả — nên nếu một
//      biến thể xê dịch dù chỉ một hạng, trang kiểm chứng sẽ nói dối.
//
//   2. Biến thể có thật sự khác nhau không?  Một biến thể chỉ đổi cái tên chứ
//      không đổi cuộc đua thì tệ hơn là không có: nó hứa với cả phòng một điều
//      mà nó không giao.
//
// Và mọi biến thể vẫn phải qua lại các ràng buộc kịch tính gốc — thêm chiều sâu
// mà làm hỏng nhịp kể chuyện thì không phải là thêm chiều sâu.

import { draw, makeTestRoster } from "../fairness/fairness.mjs";
import { buildRace } from "./director.mjs";
import { MODES, NEUTRAL_DRAMA, mergeModes, pickModes, modeById, modeLabel } from "./modes.mjs";

let failed = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "  OK  " : "  SAI "} ${name}${detail ? "  — " + detail : ""}`);
  if (!ok) failed++;
}

const SIZES = [8, 45, 150];
const PER_SIZE = 12;
const sampleFor = (r, tNorm) => Math.round((tNorm / (1 + 0.35)) * (r.sampleCount - 1));

/** Danh sách các lượt quay dùng chung cho mọi biến thể — cùng seed, cùng người. */
const draws = [];
for (const n of SIZES) {
  for (let i = 0; i < PER_SIZE; i++) {
    draws.push({
      n,
      topK: 1 + (i % 5),
      d: draw(makeTestRoster(4000 + i, n), `Giải biến thể ${n}-${i}`),
    });
  }
}
console.log(`${MODES.length} biến thể × ${draws.length} lượt quay (${SIZES.join(", ")} chó)\n`);

// =====================================================================
//  1. BẰNG CHỨNG CÔ LẬP — không biến thể nào đụng được vào kết quả
// =====================================================================
{
  // Mọi biến thể đơn lẻ, cộng với mọi cặp. Kiểm tổ hợp chứ không chỉ kiểm từng
  // cái một: núm được NHÂN với nhau, nên hai biến thể hiền lành vẫn có thể ra
  // một tổ hợp không hiền lành.
  const combos = [[]];
  for (const a of MODES) {
    combos.push([a.id]);
    for (const b of MODES) if (a.id !== b.id) combos.push([a.id, b.id]);
  }

  let bad = 0;
  let checked = 0;
  for (const { d, topK } of draws) {
    const expect = d.finalOrder.map((_, i) => i).join(",");
    for (const ids of combos) {
      const { drama } = mergeModes(ids);
      const r = buildRace(d.finalOrder, d.seedHex, { topK, drama });
      checked++;
      if (r.rankingAt(r.finishSample).join(",") !== expect) {
        if (bad === 0) console.log(`       tổ hợp làm sai kết quả: ${ids.join("+") || "(không có)"}`);
        bad++;
      }
    }
  }
  check("Không tổ hợp biến thể nào đổi được thứ hạng về đích", bad === 0,
    `${checked - bad}/${checked} lượt dựng đúng thứ hạng đã chốt`);
}

// =====================================================================
//  2. KHÔNG BẬT BIẾN THỂ = GIỐNG HỆT TỪNG BIT BẢN CHƯA CÓ TÍNH NĂNG NÀY
// =====================================================================
{
  // Đây là điều khoản giữ cho lớp biến thể không bao giờ trở thành một khoản nợ
  // âm thầm. Nếu bộ núm trung tính lệch dù một ulp thì mọi cuộc đua đã quay
  // trong quá khứ đều không tua lại được nữa.
  let diff = 0;
  let compared = 0;
  for (const { d, topK } of draws) {
    const plain = buildRace(d.finalOrder, d.seedHex, { topK });
    const neutral = buildRace(d.finalOrder, d.seedHex, { topK, drama: { ...NEUTRAL_DRAMA } });
    const empty = buildRace(d.finalOrder, d.seedHex, { topK, drama: mergeModes([]).drama });
    for (let i = 0; i < plain.progress.length; i++) {
      compared++;
      if (plain.progress[i] !== neutral.progress[i] || plain.progress[i] !== empty.progress[i]) {
        diff++;
        break;
      }
    }
    if (plain.falseLeader !== neutral.falseLeader) diff++;
  }
  check("Bộ núm trung tính cho ra cuộc đua giống hệt từng bit", diff === 0,
    `${compared.toLocaleString("vi")} mẫu vị trí trùng khớp`);
}

// =====================================================================
//  3. MỖI BIẾN THỂ VẪN PHẢI QUA CỬA KỊCH TÍNH
// =====================================================================
console.log("\n  Đo từng biến thể trên cửa kịch tính:\n");
console.log("  biến thể        thứ hạng  lùi     lộ sớm  đổi ngôi  sát nút   lệch bản chuẩn");
console.log("  ─────────────── ───────── ─────── ─────── ───────── ──────── ───────────────");

// Đường chạy của bản chuẩn, để đo xem một biến thể có THẬT SỰ đổi cuộc đua hay
// chỉ đổi cái nhãn. Đây là phép đo trung thực nhất có thể có: so sánh chính thứ
// khán giả nhìn thấy — vị trí của từng chú chó ở từng mẫu — chứ không so sánh
// một chỉ số tóm tắt, thứ có thể trùng nhau vì những lý do chẳng liên quan.
const baseline = draws.map(({ d, topK }) => buildRace(d.finalOrder, d.seedHex, { topK }));

const measured = new Map();
for (const mode of MODES) {
  const { drama } = mergeModes([mode.id]);
  let wrongOrder = 0;
  let backsteps = 0;
  let totalSamples = 0;
  let earlyLead = 0;
  let tooFewChanges = 0;
  let changesSum = 0;
  let tightFinish = 0;
  let gapSum = 0;
  let traceDiffSum = 0;

  for (let di = 0; di < draws.length; di++) {
    const { d, topK, n } = draws[di];
    const race = buildRace(d.finalOrder, d.seedHex, { topK, drama });

    const ref = baseline[di].progress;
    let diff = 0;
    for (let i = 0; i < race.progress.length; i++) diff += Math.abs(race.progress[i] - ref[i]);
    traceDiffSum += diff / race.progress.length;

    const order = race.rankingAt(race.finishSample);
    for (let p = 0; p < race.n; p++) if (order[p] !== p) { wrongOrder++; break; }

    backsteps += race.diagnostics.backstepCount;
    totalSamples += race.diagnostics.totalSamples;

    if (n >= 6) {
      for (let tn = 0; tn <= 0.8; tn += 0.01) {
        if (race.rankingAt(sampleFor(race, tn))[0] === 0) { earlyLead++; break; }
      }
    }

    let last = -1;
    let c = 0;
    for (let s = 0; s <= race.finishSample; s += 3) {
      const lead = race.rankingAt(s)[0];
      if (lead !== last) { c++; last = lead; }
    }
    changesSum += c;
    if (c < 3) tooFewChanges++;

    const gap = race.progressOf(0, race.finishSample) - race.progressOf(1, race.finishSample);
    gapSum += gap;
    if (gap < 0.006) tightFinish++;
  }

  const stat = {
    wrongOrder,
    backRate: backsteps / totalSamples,
    earlyLead,
    tooFewChanges,
    avgChanges: changesSum / draws.length,
    tightRate: tightFinish / draws.length,
    avgGap: gapSum / draws.length,
    traceDiff: traceDiffSum / draws.length,
  };
  measured.set(mode.id, stat);

  console.log(
    "  " + (mode.icon + " " + mode.name).padEnd(15) +
    " " + String(wrongOrder === 0 ? "đúng" : wrongOrder + " sai").padEnd(9) +
    " " + (stat.backRate * 100).toFixed(3).padEnd(7) +
    " " + String(earlyLead).padEnd(7) +
    " " + stat.avgChanges.toFixed(1).padEnd(9) +
    " " + ((stat.tightRate * 100).toFixed(0) + "%").padEnd(8) +
    " " + (stat.traceDiff * 100).toFixed(3) + "% đường đua"
  );
}
console.log("");

{
  const bad = [...measured].filter(([, s]) => s.wrongOrder > 0).map(([id]) => id);
  check("Mọi biến thể dựng đúng thứ hạng đã chốt", bad.length === 0, bad.join(", "));
}
{
  const bad = [...measured].filter(([, s]) => s.backRate >= 0.001).map(([id]) => id);
  check("Không biến thể nào gây chuyển động lùi", bad.length === 0, bad.join(", ") || "mọi biến thể dưới 0,1% mẫu");
}
{
  const bad = [...measured].filter(([, s]) => s.earlyLead > 0).map(([id]) => id);
  check("Không biến thể nào để lộ người thắng trước mốc 80%", bad.length === 0, bad.join(", "));
}
{
  const bad = [...measured].filter(([, s]) => s.tooFewChanges > 0).map(([id]) => id);
  check("Mọi biến thể vẫn đổi ngôi đầu ít nhất 3 lần", bad.length === 0, bad.join(", "));
}
{
  const bad = [...measured].filter(([, s]) => s.tightRate < 0.7).map(([id]) => id);
  check("Mọi biến thể vẫn về đích sát nút ở ≥70% số lượt", bad.length === 0, bad.join(", "));
}

// =====================================================================
//  4. BIẾN THỂ PHẢI THẬT SỰ KHÁC NHAU
// =====================================================================
{
  // Biến thể "canh" chỉ đổi phần nhìn nghe, nên chúng PHẢI trùng khít với bản
  // chuẩn ở lớp đạo diễn — đó chính là điều làm chúng an toàn về kết quả theo
  // nghĩa đen. Biến thể "nhịp" thì ngược lại: phải đo được sự khác biệt.
  const base = measured.get("chuan");
  const rhythm = MODES.filter((m) => m.tag === "nhip");
  const scene = MODES.filter((m) => m.tag === "canh");

  // Ngưỡng 0,2% chiều dài đường đua, lấy trung bình trên toàn bộ đường chạy.
  // Với 45 chú chó thì một hạng chiếm khoảng 0,65% đường đua, nên 0,2% là mức
  // mắt thường thấy được đàn chó xếp khác đi, chứ không phải sai số làm tròn.
  //
  // Ba chỉ số tóm tắt tôi thử trước đó — số lần đổi ngôi, khe hở về đích, hạng
  // của kẻ dẫn đầu giả — đều báo "không khác gì" cho hai biến thể thật sự khác.
  // Chúng tóm tắt quá mạnh tay: hai cuộc đua hoàn toàn khác nhau vẫn có thể
  // cùng đổi ngôi 4,6 lần. Chỉ so sánh thẳng đường chạy mới không nói dối.
  const FLAT = 0.002;
  const fmt = (id) => id + " " + (measured.get(id).traceDiff * 100).toFixed(2) + "%";
  const flat = rhythm.filter((m) => measured.get(m.id).traceDiff < FLAT).map((m) => m.id);
  check("Mỗi biến thể nhịp đổi cuộc đua một cách đo được", flat.length === 0,
    flat.length ? "chỉ có cái tên: " + flat.map(fmt).join(", ")
                : rhythm.map((m) => fmt(m.id)).join(", "));

  const sceneMoved = scene.filter((m) => measured.get(m.id).traceDiff !== 0).map((m) => m.id);
  check("Biến thể cảnh không xê dịch một mẫu nào", sceneMoved.length === 0, sceneMoved.join(", "));

  let leaky = 0;
  for (const { d, topK } of draws.slice(0, 8)) {
    const a = buildRace(d.finalOrder, d.seedHex, { topK });
    for (const m of scene) {
      const b = buildRace(d.finalOrder, d.seedHex, { topK, drama: mergeModes([m.id]).drama });
      for (let i = 0; i < a.progress.length; i += 53) {
        if (a.progress[i] !== b.progress[i]) { leaky++; break; }
      }
    }
  }
  check("Biến thể cảnh không chạm tới lớp đạo diễn", leaky === 0,
    scene.map((m) => m.id).join(", ") + " — trùng khít bản chuẩn");
}

// =====================================================================
//  5. BỐC BIẾN THỂ PHẢI XÁC ĐỊNH VÀ HỢP LỆ
// =====================================================================
{
  const d = draw(makeTestRoster(11, 40), "Giải bốc biến thể");
  const a = pickModes(d.seedHex, 2);
  const b = pickModes(d.seedHex, 2);
  check("Cùng seed bốc ra cùng biến thể", a.ids.join(",") === b.ids.join(","),
    modeLabel(a) || "(không có)");

  const other = draw(makeTestRoster(11, 40), "Giải bốc biến thể khác");
  check("Seed khác thì bốc lại", other.seedHex !== d.seedHex);

  let dup = 0;
  let stacked = 0;
  let unknown = 0;
  const seen = new Map();
  for (let i = 0; i < 400; i++) {
    const r = pickModes(sha(i), 2);
    if (new Set(r.ids).size !== r.ids.length) dup++;
    if (r.ids.includes("chuan") && r.ids.length > 1) stacked++;
    for (const id of r.ids) {
      if (!modeById(id)) unknown++;
      seen.set(id, (seen.get(id) || 0) + 1);
    }
  }
  check("Không bốc trùng một biến thể hai lần", dup === 0);
  check('Biến thể "Chuẩn" không chồng với biến thể khác', stacked === 0);
  check("Chỉ bốc ra biến thể có thật", unknown === 0, `${seen.size}/${MODES.length} biến thể đều xuất hiện`);
  check("Mọi biến thể đều có cơ hội xuất hiện", seen.size === MODES.length,
    [...seen].map(([id, c]) => `${id} ${c}`).join(", "));

  check("Bốc 0 biến thể trả về bộ núm trung tính",
    JSON.stringify(pickModes(d.seedHex, 0).drama) === JSON.stringify(NEUTRAL_DRAMA));
}

// =====================================================================
//  6. GỘP BIẾN THỂ PHẢI KẸP ĐƯỢC TỔ HỢP CỰC ĐOAN
// =====================================================================
{
  // Xếp mọi biến thể lên nhau cùng lúc — một tổ hợp không bao giờ xảy ra khi
  // bốc tự động, nhưng quản trò chọn tay thì có thể. Trần và sàn phải chặn.
  const all = mergeModes(MODES.map((m) => m.id));
  const inRange =
    all.drama.spreadMult >= 0.6 && all.drama.spreadMult <= 1.35 &&
    all.drama.gapMult >= 0.4 && all.drama.gapMult <= 1.6 &&
    all.drama.chaosMult >= 0.7 && all.drama.chaosMult <= 1.5 &&
    all.drama.sprintMult >= 0.7 && all.drama.sprintMult <= 1.6 &&
    all.drama.falseLeaderBias >= 0 && all.drama.falseLeaderBias <= 3 &&
    Number.isInteger(all.drama.falseLeaderBias);
  check("Xếp hết biến thể lên nhau vẫn nằm trong trần", inRange,
    Object.entries(all.drama).map(([k, v]) => `${k} ${v.toFixed ? v.toFixed(2) : v}`).join(", "));

  const d = draw(makeTestRoster(13, 90), "Giải xếp chồng");
  const r = buildRace(d.finalOrder, d.seedHex, { topK: 3, drama: all.drama });
  const order = r.rankingAt(r.finishSample);
  let ok = true;
  for (let p = 0; p < r.n; p++) if (order[p] !== p) { ok = false; break; }
  check("Tổ hợp cực đoan vẫn về đích đúng thứ hạng", ok);

  check("Biến thể không có thật thì bị bỏ qua", mergeModes(["khong_ton_tai"]).ids.length === 0);
  check("Gộp danh sách rỗng trả về trung tính",
    JSON.stringify(mergeModes([]).drama) === JSON.stringify(NEUTRAL_DRAMA));
}

function sha(i) {
  return draw(makeTestRoster(i, 12), "Giải " + i).seedHex;
}

console.log(failed === 0 ? "\nCỬA BIẾN THỂ ĐẠT\n" : `\n${failed} MỤC KHÔNG ĐẠT\n`);
process.exit(failed === 0 ? 0 : 1);
