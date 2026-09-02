// Tự kiểm phía JS — Order Race / M0
// Chạy: node tools/fairness/selftest.mjs
//
// Đây là phần chứng minh thuật toán CÔNG BẰNG. Bộ đối chiếu C# chỉ chứng minh
// hai bản cài đặt GIỐNG NHAU — hai chuyện khác nhau, cần cả hai.

import { draw, makeRng, uniformBelow, makeTestRoster, sortRoster, normalizeName } from "./fairness.mjs";

let failed = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "  OK  " : "  SAI "} ${name}${detail ? "  — " + detail : ""}`);
  if (!ok) failed++;
}

// ---------------------------------------------------------------- xác định
{
  const a = draw(makeTestRoster(7, 30), "Giải Nhất");
  const b = draw(makeTestRoster(7, 30), "Giải Nhất");
  check("Cùng đầu vào cho cùng kết quả", a.seedHex === b.seedHex && a.finalOrder.join() === b.finalOrder.join());
}

// ------------------------------------------------- nhạy với thay đổi nhỏ
{
  const a = draw(makeTestRoster(7, 30), "Giải Nhất");
  const b = draw(makeTestRoster(7, 30), "Giải Nhì");
  const same = a.finalOrder.filter((n, i) => n === b.finalOrder[i]).length;
  check("Đổi một dấu trong tên giải là đổi hẳn kết quả", a.seedHex !== b.seedHex && same < 5, `${same}/30 vị trí trùng`);
}

// ------------------------------------------------------- chuẩn hoá Unicode
{
  const nfcName = "Nguyễn Văn Tuấn";
  const nfdName = nfcName.normalize("NFD");
  const a = draw([nfcName, "Trần Bình", "Lê Hà"], "y");
  const b = draw([nfdName, "Trần Bình", "Lê Hà"], "y");
  check("NFD và NFC cho cùng mã băm", a.rosterHash === b.rosterHash && a.seedHex === b.seedHex);
}

// ---------------------------------------------------- sắp xếp theo byte
{
  const sorted = sortRoster(["Bình", "An", "Ánh", "Zoe", "an", "Đức"]);
  const stable = sortRoster(["Zoe", "Đức", "an", "Ánh", "An", "Bình"]);
  check("Thứ tự sắp xếp không phụ thuộc thứ tự đầu vào", sorted.join("|") === stable.join("|"), sorted.join(" "));
}

// ----------------------------------------------- loại bỏ lệch của modulo
{
  const rng = makeRng("00".repeat(32).replace(/^.{8}/, "deadbeef"));
  const n = 150;
  const counts = new Int32Array(n);
  const draws = 1500000;
  for (let i = 0; i < draws; i++) counts[uniformBelow(rng, n)]++;
  const expected = draws / n;
  const sigma = Math.sqrt(draws * (1 / n) * (1 - 1 / n));
  let worst = 0;
  for (let i = 0; i < n; i++) worst = Math.max(worst, Math.abs(counts[i] - expected) / sigma);
  check("uniformBelow(150) phân bố đều", worst < 5, `lệch lớn nhất ${worst.toFixed(2)} sigma`);
}

// ------------------------------------------- ai cũng có cơ hội về nhất
{
  const n = 8;
  const roster = makeTestRoster(999, n);
  const trials = 200000;
  const winCount = new Map(roster.map((x) => [x, 0]));
  const rankSum = new Map(roster.map((x) => [x, 0]));
  for (let t = 0; t < trials; t++) {
    const r = draw(roster, "Giải " + t);
    winCount.set(r.finalOrder[0], winCount.get(r.finalOrder[0]) + 1);
    r.finalOrder.forEach((name, idx) => rankSum.set(name, rankSum.get(name) + idx));
  }
  const expected = trials / n;
  const sigma = Math.sqrt(trials * (1 / n) * (1 - 1 / n));
  let worst = 0;
  for (const c of winCount.values()) worst = Math.max(worst, Math.abs(c - expected) / sigma);
  check("Tỉ lệ về nhất đều nhau", worst < 5, `lệch lớn nhất ${worst.toFixed(2)} sigma`);

  const meanRanks = [...rankSum.values()].map((s) => s / trials);
  const spread = Math.max(...meanRanks) - Math.min(...meanRanks);
  check("Không ai có hạng trung bình thiên lệch", spread < 0.05, `chênh lệch ${spread.toFixed(4)} hạng`);
}

// -------------------------------------------- chuẩn hoá khoảng trắng
{
  check("Gộp khoảng trắng lặp", normalizeName("Lê    Văn   A") === "Lê Văn A", JSON.stringify(normalizeName("Lê    Văn   A")));
  check("Cắt BOM ở đầu chuỗi", normalizeName("﻿Lê A") === "Lê A", JSON.stringify(normalizeName("﻿Lê A")));
  check("Khoảng trắng cứng thành dấu cách thường", normalizeName("Lê A") === "Lê A");
  check("Tab trong tên thành dấu cách", normalizeName("	Phạm	C	") === "Phạm C");
  const a = draw(["Lê A", "Trần B", "Vũ C"], "p");
  const b = draw(["﻿ Lê  A ", "Trần B", "  Vũ	C"], " p ");
  check("Rác dán từ Excel không đổi kết quả", a.seedHex === b.seedHex && a.finalOrder.join() === b.finalOrder.join());
}

// ------------------------------------------------------ biên và lỗi
{
  const two = draw(["A", "B"], "p");
  check("Chạy được với đúng 2 người", two.finalOrder.length === 2);
  const full = draw(makeTestRoster(3, 150), "p");
  check("Chạy được với đúng 150 người", full.finalOrder.length === 150);
  check("Kết quả là hoán vị của danh sách", new Set(full.finalOrder).size === 150 && full.finalOrder.every((x) => full.roster.includes(x)));

  let threw = 0;
  for (const bad of [[["A"], "p"], [makeTestRoster(4, 151), "p"], [["A", " A "], "p"]]) {
    try { draw(...bad); } catch { threw++; }
  }
  check("Chặn đúng 3 trường hợp đầu vào sai", threw === 3);
}

console.log(failed === 0 ? "\nTẤT CẢ ĐỀU ĐẠT\n" : `\n${failed} MỤC KHÔNG ĐẠT\n`);
process.exit(failed === 0 ? 0 : 1);
