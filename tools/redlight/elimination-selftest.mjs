// Cửa kịch tính của minigame "SquidGame" — Order Race / M1
// Chạy: node tools/redlight/elimination-selftest.mjs
//
// Cùng tinh thần với cửa kịch tính của đường đua: những gì mắt người khó chấm
// một cách đáng tin thì viết thành ràng buộc và cho máy chạy trên hàng trăm lượt.

import { draw, makeTestRoster } from "../fairness/fairness.mjs";
import { buildElimination, survivorCurve, roundCount } from "./elimination.mjs";

let failed = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "  OK  " : "  SAI "} ${name}${detail ? "  — " + detail : ""}`);
  if (!ok) failed++;
}

const SIZES = [8, 20, 45, 90, 150];
const PER_SIZE = 40;

const games = [];
for (const n of SIZES) {
  for (let i = 0; i < PER_SIZE; i++) {
    const topK = 1 + (i % 5);
    const d = draw(makeTestRoster(2000 + i, n), `Trọng tài ${n}-${i}`);
    games.push({ n, topK, d, g: buildElimination(d.finalOrder, d.seedHex, { topK }) });
  }
}
console.log(`Dựng ${games.length} lượt chơi (${SIZES.join(", ")} người × ${PER_SIZE} lượt)\n`);

// -------------------------------------- 1. Người sống sót phải đúng top-K
{
  let bad = 0;
  for (const { g, topK } of games) {
    const alive = [];
    for (let dog = 0; dog < g.n; dog++) if (g.roundOf(dog) < 0) alive.push(dog);
    if (alive.length !== topK) { bad++; continue; }
    for (let r = 0; r < topK; r++) if (alive[r] !== r) { bad++; break; }
  }
  check("Người sống sót cuối cùng đúng là top-K", bad === 0, `${games.length - bad}/${games.length}`);
}

// ------------------------ 2. Thứ tự bị loại phải là nghịch đảo thứ hạng
{
  let bad = 0;
  for (const { g } of games) {
    for (let a = 0; a < g.n - 1; a++) {
      const ra = g.roundOf(a) < 0 ? Infinity : g.roundOf(a);
      const rb = g.roundOf(a + 1) < 0 ? Infinity : g.roundOf(a + 1);
      if (ra < rb) { bad++; break; }  // hạng tốt hơn mà bị loại sớm hơn là sai
    }
  }
  check("Hạng càng cao càng bị loại muộn", bad === 0, `${games.length - bad}/${games.length}`);
}

// ----------------------------------- 3. Không vòng nào trôi qua vô nghĩa
{
  let empty = 0;
  let total = 0;
  for (const { g } of games) {
    for (const r of g.schedule) {
      total++;
      if (r.eliminated.length === 0) empty++;
    }
  }
  check("Mọi vòng đều loại ít nhất một người", empty === 0, `${total} vòng, ${empty} vòng trống`);
}

// -------------------------------------------- 4. Số người phải vơi dần
{
  let bad = 0;
  for (const { g, topK, n } of games) {
    const S = g.survivorCounts;
    if (S[0] !== n || S[S.length - 1] !== topK) { bad++; continue; }
    for (let i = 1; i < S.length; i++) if (S[i] >= S[i - 1]) { bad++; break; }
  }
  check("Số người sống sót giảm nghiêm ngặt", bad === 0);

  const rounds = games.map((x) => x.g.rounds);
  check("Số vòng nằm trong dải chấp nhận được",
    Math.min(...rounds) >= 3 && Math.max(...rounds) <= 9,
    `${Math.min(...rounds)} – ${Math.max(...rounds)} vòng`);
}

// ------------------------------------------- 5. Không ai được chạy lùi
{
  let bad = 0;
  let worst = 0;
  for (const { g } of games) {
    const STEP = g.totalSec / 900;
    for (let dog = 0; dog < g.n; dog += Math.max(1, Math.floor(g.n / 12))) {
      let prev = -Infinity;
      for (let t = 0; t <= g.totalSec; t += STEP) {
        const p = g.progressOf(dog, t);
        if (p < prev - 1e-9) { worst = Math.max(worst, prev - p); bad++; break; }
        prev = p;
      }
    }
  }
  check("Không có chuyển động lùi", bad === 0,
    bad ? `${bad} lượt, lùi lớn nhất ${(worst * 100).toFixed(3)}%` : "");
}

// --------------------------- 6. Bị loại rồi thì phải đứng im tại chỗ
{
  let bad = 0;
  for (const { g } of games) {
    for (let dog = 0; dog < g.n; dog++) {
      const at = g.roundOf(dog);
      if (at < 0) continue;
      const impact = g.schedule[at - 1].impactSec;
      if (Math.abs(g.progressOf(dog, impact) - g.progressOf(dog, g.totalSec)) > 1e-9) { bad++; break; }
    }
  }
  check("Người bị loại đứng im từ lúc bị loại", bad === 0);
}

// ------------------ 7. Người sống sót vào nước rút với vị trí ngang nhau
{
  let worst = 0;
  for (const { g, topK } of games) {
    let lo = Infinity, hi = -Infinity;
    for (let dog = 0; dog < topK; dog++) {
      const p = g.progressOf(dog, g.sprintStartSec);
      lo = Math.min(lo, p);
      hi = Math.max(hi, p);
    }
    worst = Math.max(worst, hi - lo);
  }
  check("Vào nước rút ngang hàng nhau", worst < 1e-6,
    `chênh lệch lớn nhất ${(worst * 100).toFixed(6)}%`);
}

// ------------------------------- 8. Về đích đúng thứ hạng và sát nút
{
  let badOrder = 0;
  let gaps = [];
  for (const { g, topK } of games) {
    for (let r = 0; r + 1 < topK; r++) {
      const a = g.progressOf(r, g.totalSec);
      const b = g.progressOf(r + 1, g.totalSec);
      if (!(a > b)) { badOrder++; break; }
    }
    if (topK >= 2) gaps.push(g.progressOf(0, g.totalSec) - g.progressOf(1, g.totalSec));
  }
  check("Nước rút về đích đúng thứ hạng", badOrder === 0);
  const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  check("Hạng 1 và hạng 2 về sát nút", avg < 0.01,
    `cách nhau ${(avg * 100).toFixed(2)}% đường đua`);
}

// -------------------------- 9. Doạ quay và suýt bị bắt phải có mặt
{
  let withFake = 0;
  let fakeInFirst = 0;
  for (const { g } of games) {
    if (g.schedule.some((r) => r.fakeOutAt >= 0)) withFake++;
    if (g.schedule[0].fakeOutAt >= 0) fakeInFirst++;
  }
  check("Mọi lượt đều có ít nhất một cú doạ quay", withFake === games.length,
    `${((withFake / games.length) * 100).toFixed(0)}% số lượt`);
  check("Không doạ quay ngay vòng đầu", fakeInFirst === 0, "khán giả cần hiểu luật trước");

  let winnerNearMiss = 0;
  for (const { g } of games) if (g.nearMiss[g.rounds] === 0) winnerNearMiss++;
  check("Người thắng luôn suýt bị bắt ở vòng cuối", winnerNearMiss === games.length);
}

// ------------------------------ 9b. Loạt bắn không được lê thê
{
  let tooLong = 0;
  let worst = 0;
  for (const { g } of games) for (const r of g.schedule) {
    worst = Math.max(worst, r.volleySec);
    if (r.volleySec > 2.25) tooLong++;
  }
  check("Loạt bắn đông người vẫn gọn", tooLong === 0,
    `loạt dài nhất ${worst.toFixed(2)}s`);
}

// ------------------------- 9c. Đoạn khoá mục tiêu phải đủ dài để ĐỌC ĐƯỢC
{
  // Bản đầu để cả đoạn này 0,22 giây và không ai gọi tên được vấn đề — nó
  // không hỏng, nó chỉ nhạt: khung ngắm hiện lên rồi đạn nổ gần như cùng lúc.
  // Ngưỡng dưới đây là để lần sau ai đó siết thời lượng cho gọn thì cửa kêu,
  // chứ không phải để nhịp lặng lẽ co về chỗ cũ qua vài lần sửa.
  let short = 0, mismatch = 0, noHold = 0;
  let minAim = Infinity;
  for (const { g } of games) for (const r of g.schedule) {
    minAim = Math.min(minAim, r.aimSec);
    if (r.aimSec < 0.6) short++;
    if (Math.abs(r.scanSec + r.holdSec - r.aimSec) > 1e-9) mismatch++;
    if (r.holdSec < 0.2) noHold++;
  }
  check("Khoá mục tiêu đủ lâu để đọc được tên", short === 0,
    `ngắn nhất ${minAim.toFixed(2)}s`);
  check("Quét cộng ghìm đúng bằng cả đoạn khoá", mismatch === 0);
  check("Có nhịp ghìm thật, không quét xong là bắn luôn", noHold === 0);

  // Ở vòng cuối chỉ còn vài người bị loại; mỗi cái tên đáng được nghe riêng
  // một phát chứ không lẫn vào một tràng.
  let tight = 0;
  for (const { g } of games) {
    const last = g.schedule[g.schedule.length - 1];
    if (last && last.eliminated.length <= 4 && last.stagger < 0.12) tight++;
  }
  check("Vòng cuối bắn thưa, từng phát một", tight === 0, `${tight} lượt bắn dồn`);
}

// ----------------------------------------- 10. Thời lượng phải hợp lý
{
  const secs = games.map((x) => x.g.totalSec);
  const avg = secs.reduce((a, b) => a + b, 0) / secs.length;
  // Ngưỡng 30 giây ở bản đầu là một con số đoán bừa, không phải ràng buộc thật:
  // với 8 người thì một lượt 24 giây là vừa đẹp. Ràng buộc thật nằm ở dòng dưới.
  check("Thời lượng nằm trong 20 – 110 giây",
    Math.min(...secs) >= 20 && Math.max(...secs) <= 110,
    `${Math.min(...secs).toFixed(0)} – ${Math.max(...secs).toFixed(0)}s, trung bình ${avg.toFixed(0)}s`);

  let shortGreen = 0;
  for (const { g } of games) for (const r of g.schedule) if (r.greenSec < 3) shortGreen++;
  check("Mỗi vòng đèn xanh đủ dài để theo kịp", shortGreen === 0,
    `${shortGreen} vòng dưới 3 giây`);
}

// ------------------------------------------- 11. Tái tạo được, và bất biến
{
  const d = draw(makeTestRoster(9, 60), "Trọng tài tua lại");
  const a = buildElimination(d.finalOrder, d.seedHex, { topK: 3 });
  const b = buildElimination(d.finalOrder, d.seedHex, { topK: 3 });
  let same = a.totalSec === b.totalSec && a.rounds === b.rounds;
  if (same) {
    for (let dog = 0; dog < a.n && same; dog++) {
      if (a.roundOf(dog) !== b.roundOf(dog)) same = false;
      for (let t = 0; t <= a.totalSec; t += a.totalSec / 200) {
        if (a.progressOf(dog, t) !== b.progressOf(dog, t)) { same = false; break; }
      }
    }
  }
  check("Cùng seed cho ra cùng lượt chơi", same);

  const c = buildElimination(d.finalOrder, d.seedHex, { topK: 7 });
  check("Đổi top-K không đổi người thắng",
    a.roundOf(0) === -1 && c.roundOf(0) === -1 && d.finalOrder[0] === d.finalOrder[0]);
}

// -------------------- 12. Bảng thống kê để người đọc tự chấm bằng mắt
{
  const g = games.find((x) => x.n === 150 && x.topK === 3).g;
  console.log(`\n  Ví dụ 150 người, top 3 — ${g.rounds} vòng, ${g.totalSec.toFixed(0)} giây\n`);
  console.log("    vòng   còn lại   bị loại   đèn xanh   doạ quay");
  for (const r of g.schedule) {
    console.log(
      `     ${String(r.index).padStart(2)}      ${String(r.survivorsAfter).padStart(4)}` +
      `      ${String(r.eliminated.length).padStart(4)}      ${r.greenSec.toFixed(1).padStart(5)}s` +
      `      ${r.fakeOutAt >= 0 ? "có" : "—"}`
    );
  }
}

console.log(failed === 0 ? "\nCỬA KỊCH TÍNH ĐẠT\n" : `\n${failed} MỤC KHÔNG ĐẠT\n`);
process.exit(failed === 0 ? 0 : 1);
