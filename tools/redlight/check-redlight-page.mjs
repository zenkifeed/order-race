// Kiểm tra web/redlight.html — Order Race / M1
// Chạy: node tools/redlight/check-redlight-page.mjs
//
// Không thay được việc mở trang bằng mắt. Chỉ bắt những lỗi mà một lần mở trang
// cũng bắt được nhưng rất dễ lọt khi sửa nhanh: sai cú pháp, gõ nhầm id phần tử,
// và trang lỡ phụ thuộc vào tài nguyên ngoài.

import { readFileSync, existsSync } from "node:fs";
import vm from "node:vm";
import { draw, makeTestRoster } from "../fairness/fairness.mjs";
import { buildElimination } from "./elimination.mjs";

let failed = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "  OK  " : "  SAI "} ${name}${detail ? "  — " + detail : ""}`);
  if (!ok) failed++;
}

const html = readFileSync("web/redlight.html", "utf8");
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
check("Tìm thấy khối script", scriptMatch !== null);
if (!scriptMatch) process.exit(1);
const script = scriptMatch[1];

// ---- 1. Cú pháp
try {
  new vm.Script(script, { filename: "redlight.html" });
  check("Khối script biên dịch được", true);
} catch (e) {
  check("Khối script biên dịch được", false, e.message);
  process.exit(1);
}

// ---- 2. Phần thuật toán nhúng phải chạy ra đúng kết quả như thư viện gốc
const cut = script.indexOf("(function () {");
const algo = script.slice(0, cut);
const sandbox = { TextEncoder, console, Math, performance };
vm.createContext(sandbox);
try {
  new vm.Script(algo + "\n;globalThis.__draw = draw; globalThis.__build = buildElimination;")
    .runInContext(sandbox);
  check("Phần thuật toán chạy được ngoài trình duyệt",
    typeof sandbox.__draw === "function" && typeof sandbox.__build === "function");
} catch (e) {
  check("Phần thuật toán chạy được ngoài trình duyệt", false, e.message);
  process.exit(1);
}

let mismatch = 0;
for (const n of [8, 45, 150]) {
  const roster = makeTestRoster(4, n);
  const a = draw(roster, "Trọng tài kiểm tra");
  const b = sandbox.__draw(roster, "Trọng tài kiểm tra");
  const ga = buildElimination(a.finalOrder, a.seedHex, { topK: 3 });
  const gb = sandbox.__build(b.finalOrder, b.seedHex, { topK: 3 });
  if (a.seedHex !== b.seedHex || ga.totalSec !== gb.totalSec || ga.rounds !== gb.rounds) {
    mismatch++;
    continue;
  }
  for (let dog = 0; dog < n; dog++) {
    if (ga.roundOf(dog) !== gb.roundOf(dog)) { mismatch++; break; }
  }
}
check("Trang dựng ra khớp thư viện gốc", mismatch === 0, `${3 - mismatch}/3 ca khớp`);

// ---- 3. Vị trí phải luôn nằm trong sân, nếu không chó vẽ ra ngoài khung
{
  let outside = 0;
  for (const n of [8, 45, 150]) {
    const d = draw(makeTestRoster(5, n), "Trọng tài biên");
    const g = buildElimination(d.finalOrder, d.seedHex, { topK: 3 });
    for (let dog = 0; dog < n; dog += Math.max(1, Math.floor(n / 15))) {
      for (let t = 0; t <= g.totalSec; t += g.totalSec / 250) {
        const p = g.progressOf(dog, t);
        if (!(p >= -1e-9 && p <= 1 + 1e-9)) outside++;
      }
    }
  }
  check("Vị trí luôn nằm trong [0, 1]", outside === 0, outside ? `${outside} mẫu lệch` : "");
}

// ---- 4. Mọi id mà mã JS gọi tới đều phải tồn tại trong HTML
const referenced = [...script.matchAll(/getElementById\("([^"]+)"\)/g)].map((m) => m[1]);
const present = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
const missing = [...new Set(referenced)].filter((id) => !present.has(id));
check("Mọi id được gọi đều tồn tại trong HTML", missing.length === 0,
  missing.length ? "thiếu: " + missing.join(", ") : `${new Set(referenced).size} id, đủ cả`);

// ---- 5. Danh sách nhạc
{
  const m = script.match(/const MUSIC = (\[[^\n]*\]);/);
  check("Có nhúng danh sách nhạc", m !== null);
  if (m) {
    let list = null;
    try { list = JSON.parse(m[1]); } catch { /* để phép kiểm bên dưới báo */ }
    const onDisk = existsSync("music/playlist.json")
      ? JSON.parse(readFileSync("music/playlist.json", "utf8"))
      : [];
    check("Danh sách nhúng khớp thư mục music/",
      JSON.stringify(list) === JSON.stringify(onDisk), `${(list || []).length} bài`);
  }
}


// ---- Lưới an toàn của màn mở
//
// Tấm phủ PHẢI tan bằng animation của CSS, không được phụ thuộc vào JS. Nếu mã
// JS văng lỗi ở bất kỳ đâu thì trang vẫn phải hiện ra và vẫn bấm được — kẹt sau
// một tấm màn đục giữa buổi lễ là kiểu hỏng tệ nhất có thể xảy ra.
{
  const css = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
  const veilRule = css.slice(css.indexOf("#veil{"), css.indexOf("}", css.indexOf("#veil{")));
  check("Có tấm phủ màn mở", html.includes('id="veil"') && veilRule.length > 0);
  check("Tấm phủ tự tan bằng CSS, không cần JS",
    /animation:[^;]*forwards/.test(veilRule),
    "JS chết thì trang vẫn hiện ra");
  check("Tấm phủ không chặn thao tác", veilRule.includes("pointer-events:none"));
}

// ---- 6. Tự chứa
const external = html.match(/(src|href)\s*=\s*["'](https?:)?\/\//gi);
check("Không phụ thuộc tài nguyên ngoài", external === null,
  external ? external.join(", ") : "mở được bằng file://");

console.log(failed === 0 ? "\nTRANG TRỌNG TÀI ĐẠT\n" : `\n${failed} MỤC KHÔNG ĐẠT\n`);
process.exit(failed === 0 ? 0 : 1);
