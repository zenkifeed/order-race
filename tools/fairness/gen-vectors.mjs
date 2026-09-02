// Sinh vector vàng — Order Race / M0
// Chạy: node tools/fairness/gen-vectors.mjs
//
// Định dạng là TSV chứ không phải JSON, có lý do: bản C# phải đọc được file này
// bên trong Unity mà không kéo theo bất kỳ thư viện JSON nào. Đây là dữ liệu
// kiểm thử, không phải định dạng sản phẩm — định dạng sản phẩm vẫn là JSON (GDD §11).
//
// Ngăn cách trường: TAB. Ngăn cách tên trong một danh sách: U+001F.
// Mọi trường văn bản đều được thoát ký tự:  \ -> \\   TAB -> \t   LF -> \n   CR -> \r
// Cần thiết vì tên dán từ Excel có thể chứa tab thật, mà tab là dấu ngăn trường.

import { writeFileSync, mkdirSync } from "node:fs";
import { sha256HexOfString } from "./sha256.mjs";
import { draw, makeRng, makeTestRoster, MAX_ROSTER, MIN_ROSTER, ALGORITHM } from "./fairness.mjs";

const US = String.fromCharCode(31); // U+001F, ngăn cách tên trong một danh sách
const PRNG_CASES = 200;
const PRNG_OUTPUTS = 64;
const BULK_CASES = 10000;

const PRIZES = ["Giải Nhất", "Giải Nhì", "Giải Ba", "Quà Tết", "Voucher 500k", "Giải May Mắn", "Đặc Biệt"];

function esc(value) {
  // Viết bằng fromCharCode thay vì hằng chuỗi có dấu gạch chéo ngược: hàm này
  // đi qua nhiều lớp công cụ (shell, heredoc, trình soạn thảo) và escape lồng
  // nhau là chỗ đã sai một lần rồi.
  const BS = String.fromCharCode(92);
  const TAB = String.fromCharCode(9);
  const LF = String.fromCharCode(10);
  const CR = String.fromCharCode(13);
  let out = "";
  const s = String(value);
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === BS) out += BS + BS;
    else if (ch === TAB) out += BS + "t";
    else if (ch === LF) out += BS + "n";
    else if (ch === CR) out += BS + "r";
    else out += ch;
  }
  return out;
}
const escJoin = (arr) => arr.map(esc).join(US);

const lines = [];
lines.push(`#ALGO\t${ALGORITHM}`);
lines.push(`#COUNTS\tprng=${PRNG_CASES}\tbulk=${BULK_CASES}`);
lines.push(`#LIMITS\tmaxRoster=${MAX_ROSTER}\tminRoster=${MIN_ROSTER}`);
lines.push("#FIELDS\tPRNG=seedHex,outputs | DETAIL=prize,rosterHash,seedHex,names,order | BULK=i,n,prize,rosterHash,seedHex,orderHash");

// ---- 1. Dòng chảy PRNG. Ghim chính xác bộ sinh số, độc lập với phần bốc thăm.
for (let i = 0; i < PRNG_CASES; i++) {
  const seed = sha256HexOfString("prng-seed-" + i);
  const rng = makeRng(seed);
  const out = [];
  for (let k = 0; k < PRNG_OUTPUTS; k++) out.push(rng.next().toString(16).padStart(8, "0"));
  lines.push(`PRNG\t${seed}\t${out.join(",")}`);
}

// ---- 2. Ca chi tiết. Mang theo danh sách đầy đủ nên khi lệch là biết lệch ở đâu.
const LONG = "Nguyễn " + "Văn ".repeat(40) + "Cuối";
const DETAILS = [
  { names: ["A", "B"], prize: "p" },
  { names: ["Bình", "An", "Ánh", "Zoe", "an", "Đức"], prize: "y" },
  { names: ["Nguyễn Văn Tuấn", "Trần Bình", "Lê Hà"], prize: "Giải Nhất Quý 3" },
  { names: ["Nguyễn Văn Tuấn".normalize("NFD"), "Trần Bình".normalize("NFD"), "Lê Hà"], prize: "Giải Nhất Quý 3" },
  { names: ["  Lê A  ", "Trần B", "\tPhạm C\t"], prize: "  Giải  có khoảng trắng  " },
  { names: ["﻿ Lê  A ", "Trần B", " Vũ C"], prize: " rác dán﻿ " },
  { names: ["Đỗ 🐕 Nam", "Vũ 🏁 Linh", "Hồ Anh"], prize: "Giải 🥇" },
  { names: [LONG, "Ngắn", "Vừa"], prize: "" },
  { names: ["a", "A", "á", "Á", "ạ", "Ạ"], prize: "phân biệt hoa thường" },
  { names: makeTestRoster(1, 3), prize: "" },
  { names: makeTestRoster(2, 12), prize: "Giải Nhì" },
  { names: makeTestRoster(3, 149), prize: "gần trần" },
  { names: makeTestRoster(4, 150), prize: "đúng trần" },
];
for (const d of DETAILS) {
  const r = draw(d.names, d.prize);
  lines.push(
    `DETAIL\t${esc(d.prize)}\t${r.rosterHash}\t${r.seedHex}\t${escJoin(d.names)}\t${escJoin(r.finalOrder)}`
  );
}

// ---- 3. Ca hàng loạt. 10 000 lượt bốc, chỉ lưu mã băm của thứ hạng cho gọn file.
for (let i = 0; i < BULK_CASES; i++) {
  const n = 2 + (i % 149);
  const prize = PRIZES[i % PRIZES.length] + (i % 3 === 0 ? " đợt " + i : "");
  const r = draw(makeTestRoster(i, n), prize);
  const orderHash = sha256HexOfString(r.finalOrder.join("\n"));
  lines.push(`BULK\t${i}\t${n}\t${esc(prize)}\t${r.rosterHash}\t${r.seedHex}\t${orderHash}`);
}

mkdirSync("tests/vectors", { recursive: true });
const text = lines.join("\n") + "\n";
writeFileSync("tests/vectors/fairness-vectors.tsv", text, "utf8");
console.log("Đã ghi tests/vectors/fairness-vectors.tsv");
console.log(`  thuật toán ${ALGORITHM}`);
console.log(`  ${PRNG_CASES} ca PRNG, ${DETAILS.length} ca chi tiết, ${BULK_CASES} ca hàng loạt`);
console.log(`  ${(text.length / 1024 / 1024).toFixed(2)} MB · mã băm file: ${sha256HexOfString(text).slice(0, 16)}`);
