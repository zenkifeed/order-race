// Kiểm thử danh sách mẫu — Order Race
// Chạy: node tools/web/names-selftest.mjs
//
// Cửa này canh một thứ rất dễ hỏng âm thầm: danh sách mẫu là ĐẦU VÀO của phép
// bốc thăm, nên một cái tên trùng trong hồ không làm hỏng cái tên đó — nó làm
// draw() ném lỗi và nút Bắt đầu chết, ở đúng một cỡ danh sách nào đó, trước cả
// phòng. Vì vậy mục 5 không kiểm hàm sinh tên: nó chạy thẳng draw() thật ở mọi
// cỡ từ 2 tới trần.

import { NAME_POOL, NAME_MIN, NAME_MAX, makeDemoRoster } from "./names.mjs";
import { draw, MAX_ROSTER, MIN_ROSTER, normalizeName } from "../fairness/fairness.mjs";

let failed = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "  OK  " : "  SAI "} ${name}${detail ? "  — " + detail : ""}`);
  if (!ok) failed++;
}

// ------------------------------------------------- 1. Hình dạng của từng tên
{
  const short = NAME_POOL.filter((s) => s.length < NAME_MIN);
  const long = NAME_POOL.filter((s) => s.length > NAME_MAX);
  check(`Mọi tên dài ${NAME_MIN}–${NAME_MAX} ký tự`, short.length === 0 && long.length === 0,
    [...short, ...long].slice(0, 6).join(", "));

  const notLatin = NAME_POOL.filter((s) => !/^[A-Z][a-z]+$/.test(s));
  check("Chỉ chữ cái Latin, viết hoa chữ đầu", notLatin.length === 0,
    notLatin.slice(0, 6).join(", "));

  // Cắt hai đầu là bước đầu tiên của prepareRoster. Một cái tên dính dấu cách
  // sẽ bị cắt ngắn lại và có thể tuột khỏi dải 6–9 mà mục trên vẫn xanh.
  const trimmed = NAME_POOL.filter((s) => s !== s.trim());
  check("Không tên nào dính khoảng trắng", trimmed.length === 0, `${trimmed.length} tên`);
}

// ------------------------------------------------------- 2. Hồ tên đủ rộng
{
  check(`Hồ rộng hơn trần danh sách ${MAX_ROSTER}`, NAME_POOL.length > MAX_ROSTER,
    `${NAME_POOL.length} tên`);

  const seen = new Set(NAME_POOL);
  check("Không tên nào trùng trong hồ", seen.size === NAME_POOL.length,
    `${NAME_POOL.length - seen.size} cái trùng`);

  // draw() so trùng SAU khi chuẩn hoá, không so chuỗi thô. Hai tên chỉ khác
  // nhau ở thứ mà normalizeName xoá đi vẫn là trùng dưới mắt nó.
  const norm = new Set(NAME_POOL.map((s) => normalizeName(s)));
  check("Chuẩn hoá xong vẫn không trùng", norm.size === NAME_POOL.length,
    `${NAME_POOL.length - norm.size} cái trùng sau chuẩn hoá`);
}

// ----------------------------------------- 3. Không quay lại lối mã nhân viên
{
  // Mục này tồn tại vì đã có lần hai trang chơi gọi thẳng makeTestRoster của
  // lớp công bằng — vật cố định của bộ vector vàng — để lấy danh sách hiển thị.
  const codes = NAME_POOL.filter((s) => /^NV|\d|-/.test(s));
  check("Không tên nào là mã nhân viên", codes.length === 0, codes.slice(0, 6).join(", "));
}

// -------------------------------------------------- 4. Xác định, và nối dài
{
  const a = makeDemoRoster(45);
  const b = makeDemoRoster(45);
  check("Cùng n thì cùng danh sách", a.join("|") === b.join("|"));

  // Tăng sĩ số từ 44 lên 45 mà cả danh sách đổi tên thì lượt chạy thử vừa xong
  // không còn nói gì về lượt sắp chạy. Xáo rồi cắt giữ được tính chất này.
  const c = makeDemoRoster(44);
  check("Danh sách ngắn là phần đầu của danh sách dài",
    c.join("|") === a.slice(0, 44).join("|"));

  check("Đúng số lượng yêu cầu", makeDemoRoster(150).length === 150);
  check("Xin 0 người thì trả mảng rỗng", makeDemoRoster(0).length === 0);

  let threw = false;
  try { makeDemoRoster(NAME_POOL.length + 1); } catch { threw = true; }
  check("Xin quá hồ tên thì ném lỗi, không trả danh sách thiếu", threw);
}

// ------------------------------- 5. draw() THẬT nuốt được, ở mọi cỡ danh sách
{
  let worstLen = 0;
  const broken = [];
  for (let n = MIN_ROSTER; n <= MAX_ROSTER; n++) {
    const roster = makeDemoRoster(n);
    if (new Set(roster).size !== n) { broken.push(`n=${n} trùng tên`); continue; }
    for (const s of roster) worstLen = Math.max(worstLen, s.length);
    try {
      const d = draw(roster, `Giải mẫu ${n}`);
      if (d.finalOrder.length !== n) broken.push(`n=${n} bảng thiếu người`);
    } catch (e) {
      broken.push(`n=${n}: ${e.message}`);
    }
  }
  check(`Bốc thăm chạy được ở cả ${MAX_ROSTER - MIN_ROSTER + 1} cỡ danh sách`,
    broken.length === 0, broken.slice(0, 3).join(" · "));
  check(`Tên dài nhất từng sinh ra vẫn trong dải`, worstLen <= NAME_MAX, `${worstLen} ký tự`);
}

// ------------------------------------- 6. Không quấn vào cỗ máy công bằng
{
  // Danh sách mẫu là đầu vào của phép bốc. Nếu nó lấy số từ chính cỗ máy đó thì
  // hai lớp quấn vào nhau — và chỉnh một bên là lặng lẽ đổi bên kia.
  const src = await import("node:fs").then((fs) =>
    fs.readFileSync(new URL("./names.mjs", import.meta.url), "utf8"));
  check("names.mjs không nhập gì từ lớp công bằng", !/from\s+["'].*fairness/.test(src));
  check("names.mjs không nhập gì cả", !/^import\s/m.test(src));
}

console.log(failed === 0 ? "\nDANH SÁCH MẪU ĐẠT\n" : `\n${failed} MỤC KHÔNG ĐẠT\n`);
process.exit(failed === 0 ? 0 : 1);
