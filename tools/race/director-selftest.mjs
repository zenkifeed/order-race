// Cửa kịch tính — Order Race / M1
// Chạy: node tools/race/director-selftest.mjs
//
// Đây là bản đo được của cửa hoàn thành M1 ở GDD §12: "xem 20 race liên tiếp mà
// không đoán được người thắng trước mốc 70%". Con mắt người không đo được điều
// đó một cách đáng tin, nên nó được viết thành các ràng buộc kiểm tra bằng máy,
// chạy trên hàng trăm cuộc đua thay vì hai chục.

import { draw, makeTestRoster } from "../fairness/fairness.mjs";
import { buildRace, BEATS } from "./director.mjs";

let failed = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "  OK  " : "  SAI "} ${name}${detail ? "  — " + detail : ""}`);
  if (!ok) failed++;
}

const SIZES = [8, 20, 45, 90, 150];
const PER_SIZE = 40;

const races = [];
for (const n of SIZES) {
  for (let i = 0; i < PER_SIZE; i++) {
    const topK = 1 + (i % 5);
    const d = draw(makeTestRoster(1000 + i, n), `Giải ${n}-${i}`);
    races.push({ n, topK, drawResult: d, race: buildRace(d.finalOrder, d.seedHex, { topK }) });
  }
}
console.log(`Dựng ${races.length} cuộc đua (${SIZES.join(", ")} chó × ${PER_SIZE} lượt)\n`);

const sampleFor = (r, tNorm) => Math.round((tNorm / (1 + 0.35)) * (r.sampleCount - 1));

// ---------------------------------------------- 1. Không được sai thứ hạng
{
  let bad = 0;
  for (const { race } of races) {
    const order = race.rankingAt(race.finishSample);
    for (let p = 0; p < race.n; p++) {
      if (order[p] !== p) { bad++; break; }
    }
  }
  check("Thứ hạng về đích đúng y kết quả đã chốt", bad === 0, `${races.length - bad}/${races.length} đúng`);
}

// ---------------------------------------------- 2. Không con nào chạy lùi
{
  let worst = 0;
  let count = 0;
  let total = 0;
  for (const { race } of races) {
    worst = Math.max(worst, race.diagnostics.worstBackstep);
    count += race.diagnostics.backstepCount;
    total += race.diagnostics.totalSamples;
  }
  const rate = count / total;
  check("Không có chuyển động lùi", rate < 0.001 && worst < 0.0005,
    `${(rate * 100).toFixed(4)}% mẫu phải kẹp, lùi lớn nhất ${(worst * 100).toFixed(5)}% đường đua`);
}

// ---------------------------------------------- 3. Người thắng phải giấu mình
{
  let earlyTop3 = 0;
  let earlyLead = 0;
  for (const { race, n } of races) {
    if (n < 6) continue;
    for (let tn = 0; tn <= 0.15; tn += 0.01) {
      if (race.rankingAt(sampleFor(race, tn)).indexOf(0) < 3) { earlyTop3++; break; }
    }
    for (let tn = 0; tn <= 0.8; tn += 0.01) {
      if (race.rankingAt(sampleFor(race, tn))[0] === 0) { earlyLead++; break; }
    }
  }
  check("Người thắng không lọt top 3 trong nhịp 1", earlyTop3 === 0, `${earlyTop3} lượt vi phạm`);
  check("Người thắng không dẫn đầu trước mốc 80%", earlyLead === 0, `${earlyLead} lượt vi phạm`);
}

// ---------------------------------------------- 4. Kẻ dẫn đầu giả phải làm việc
{
  let held = 0;
  let eligible = 0;
  for (const { race } of races) {
    if (race.falseLeader < 0) continue;
    eligible++;
    let leadingSamples = 0;
    for (let tn = 0.15; tn <= 0.45; tn += 0.01) {
      if (race.rankingAt(sampleFor(race, tn))[0] === race.falseLeader) leadingSamples++;
    }
    if (leadingSamples >= 20) held++;
  }
  check("Kẻ dẫn đầu giả dẫn suốt nhịp 2", held === eligible, `${held}/${eligible} lượt`);
}

// ---------------------------------------------- 5. Phải có xáo trộn thật sự
{
  let tooFew = 0;
  const changes = [];
  for (const { race } of races) {
    let last = -1;
    let c = 0;
    for (let s = 0; s <= race.finishSample; s += 3) {
      const lead = race.rankingAt(s)[0];
      if (lead !== last) { c++; last = lead; }
    }
    changes.push(c);
    if (c < 3) tooFew++;
  }
  const avg = changes.reduce((a, b) => a + b, 0) / changes.length;
  check("Mỗi cuộc đua đổi ngôi đầu ít nhất 3 lần", tooFew === 0,
    `trung bình ${avg.toFixed(1)} lần, ít nhất ${Math.min(...changes)} lần`);
}

// ---------------------------------------------- 6. Về đích phải sát nút
{
  let tight = 0;
  const gaps = [];
  for (const { race } of races) {
    const s = race.finishSample;
    const gap = race.progressOf(0, s) - race.progressOf(1, s);
    gaps.push(gap);
    if (gap < 0.006) tight++;
  }
  const ratio = tight / races.length;
  const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  check("Hạng 1 và hạng 2 về sát nút ở ≥70% số lượt", ratio >= 0.7,
    `${(ratio * 100).toFixed(0)}% số lượt, cách nhau trung bình ${(avg * 100).toFixed(2)}% đường đua`);
}

// ---------------------------------------------- 7. Ranh giới trúng thưởng căng
{
  let tight = 0;
  let eligible = 0;
  for (const { race, topK } of races) {
    if (topK >= race.n) continue;
    eligible++;
    const s = race.finishSample;
    const gap = race.progressOf(topK - 1, s) - race.progressOf(topK, s);
    if (gap < 0.008) tight++;
  }
  check("Ranh giới top-K bám nhau lúc về đích", tight / eligible >= 0.85,
    `${((tight / eligible) * 100).toFixed(0)}% số lượt`);
}

// ---------------------------------------------- 8. Tua lại phải ra y hệt
{
  const d = draw(makeTestRoster(7, 60), "Giải tua lại");
  const a = buildRace(d.finalOrder, d.seedHex, { topK: 3 });
  const b = buildRace(d.finalOrder, d.seedHex, { topK: 3 });
  let same = a.progress.length === b.progress.length;
  if (same) {
    for (let i = 0; i < a.progress.length; i++) {
      if (a.progress[i] !== b.progress[i]) { same = false; break; }
    }
  }
  check("Cùng seed cho ra cùng cuộc đua từng khung hình", same);
}

// ---------------------------------------------- 9. Đạo diễn không đụng kết quả
{
  const d = draw(makeTestRoster(7, 60), "Giải bất biến");
  const a = buildRace(d.finalOrder, d.seedHex, { topK: 1, durationSec: 30 });
  const b = buildRace(d.finalOrder, d.seedHex, { topK: 9, durationSec: 55 });
  const ordA = a.rankingAt(a.finishSample).join(",");
  const ordB = b.rankingAt(b.finishSample).join(",");
  check("Đổi tham số trình diễn không đổi thứ hạng", ordA === ordB && ordA === d.finalOrder.map((_, i) => i).join(","));
}

console.log(failed === 0 ? "\nCỬA KỊCH TÍNH ĐẠT\n" : `\n${failed} MỤC KHÔNG ĐẠT\n`);
process.exit(failed === 0 ? 0 : 1);
