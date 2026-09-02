// Kiểm thử chuyển thiết lập giữa các trang — Order Race
// Chạy: node tools/web/handoff-selftest.mjs

import { encodeHandoff, decodeHandoff, applyHandoff } from "./handoff.mjs";

let failed = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "  OK  " : "  SAI "} ${name}${detail ? "  — " + detail : ""}`);
  if (!ok) failed++;
}

const field = (v = "") => ({ value: v });

// ------------------------------------------------- 1. Đi và về nguyên vẹn
{
  const s = { count: 45, topK: 3, prize: "Giải Nhất Quý 3", roster: "Lê A\nTrần B\nVũ C" };
  const back = decodeHandoff(encodeHandoff(s));
  check("Mã hoá rồi giải mã ra đúng như cũ",
    back.count === 45 && back.topK === 3 && back.prize === s.prize && back.roster === s.roster);
}

// -------------------------------------- 2. Tiếng Việt, xuống dòng, ký tự lạ
{
  const roster = "Nguyễn Văn Tuấn\nTrần Bình\nĐỗ 🐕 Nam\nLê\tHà";
  const back = decodeHandoff(encodeHandoff({ count: 4, topK: 2, prize: "Giải 🥇 & Quà", roster }));
  check("Giữ nguyên dấu tiếng Việt, emoji, tab và xuống dòng",
    back.roster === roster && back.prize === "Giải 🥇 & Quà");
}

// --------------------------------------------- 3. Danh sách 150 người vẫn gọn
{
  const roster = Array.from({ length: 150 }, (_, i) => "Nguyễn Văn Nhân Viên Số " + i).join("\n");
  const hash = encodeHandoff({ count: 150, topK: 3, prize: "Đặc Biệt", roster });
  check("Danh sách đầy đủ vẫn về nguyên vẹn", decodeHandoff(hash).roster === roster);
  check("Độ dài URL còn trong mức trình duyệt chịu được", hash.length < 32000,
    `${(hash.length / 1024).toFixed(1)} KB`);
}

// ---------------------------------------- 4. Đầu vào hỏng không được văng lỗi
{
  const bad = ["", "#", "#khong-phai-cua-minh", "#s=", "#s=%%%", "#s=" + encodeURIComponent("{}"),
               "#s=" + encodeURIComponent(JSON.stringify({ v: 99, n: 5 })), null, undefined];
  let threw = 0;
  let nonNull = 0;
  for (const h of bad) {
    try { if (decodeHandoff(h) !== null) nonNull++; } catch { threw++; }
  }
  check("Không bao giờ văng lỗi với đầu vào hỏng", threw === 0);
  check("Đầu vào hỏng luôn trả về null", nonNull === 0, `${bad.length} trường hợp`);
}

// ------------------------------------------------- 5. Điền vào form đích
{
  const f = { roster: field(), count: field("45"), topK: field("3"), prize: field("cũ") };
  const hash = encodeHandoff({ count: 3, topK: 5, prize: "Giải Nhì", roster: "A\nB\nC" });
  check("Báo có thiết lập để điền", applyHandoff(hash, f) === true);
  check("Điền đúng danh sách", f.roster.value === "A\nB\nC");
  check("Điền đúng số người trúng", f.topK.value === 5);
  check("Điền đúng tên giải", f.prize.value === "Giải Nhì");
  check("Có danh sách thì KHÔNG ghi đè ô số người",
    f.count.value === "45", "ô đó do danh sách tự suy ra");

  const g = { roster: field(), count: field("45"), topK: field("3"), prize: field() };
  applyHandoff(encodeHandoff({ count: 88, topK: 2, prize: "", roster: "" }), g);
  check("Không có danh sách thì mới dùng số người", g.count.value === 88);

  const h = { roster: field("giữ nguyên"), count: field("45"), topK: field("3"), prize: field("giữ") };
  check("Không có thiết lập thì báo false", applyHandoff("#linh-tinh", h) === false);
  check("Không có thiết lập thì không đụng vào form", h.roster.value === "giữ nguyên");
}

console.log(failed === 0 ? "\nCHUYỂN THIẾT LẬP ĐẠT\n" : `\n${failed} MỤC KHÔNG ĐẠT\n`);
process.exit(failed === 0 ? 0 : 1);
