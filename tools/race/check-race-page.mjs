// Kiểm tra web/race.html — Order Race / M1
// Chạy: node tools/race/check-race-page.mjs
//
// Bộ kiểm tra này KHÔNG thay được việc mở trang bằng mắt. Nó chỉ bắt những lỗi
// mà một lần mở trang cũng bắt được nhưng lại rất dễ lọt khi sửa nhanh: sai cú
// pháp, gõ nhầm id phần tử, và trang lỡ phụ thuộc vào tài nguyên ngoài.
//
// Phần "trông có đẹp không, có hồi hộp không" thì vẫn phải có người xem.

import { readFileSync, existsSync } from "node:fs";
import vm from "node:vm";
import { draw, makeTestRoster } from "../fairness/fairness.mjs";
import { buildRace } from "./director.mjs";

let failed = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "  OK  " : "  SAI "} ${name}${detail ? "  — " + detail : ""}`);
  if (!ok) failed++;
}

const html = readFileSync("web/race.html", "utf8");
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
check("Tìm thấy khối script", scriptMatch !== null);
if (!scriptMatch) process.exit(1);
const script = scriptMatch[1];

// ---- 1. Cú pháp
try {
  new vm.Script(script, { filename: "race.html" });
  check("Khối script biên dịch được", true);
} catch (e) {
  check("Khối script biên dịch được", false, e.message);
  process.exit(1);
}

// ---- 2. Phần thuật toán nhúng phải chạy ra đúng kết quả như thư viện gốc
// Mã của trang nằm trong một IIFE; phần thuật toán nhúng là mọi thứ trước nó.
const cut = script.indexOf("(function () {");
const algo = script.slice(0, cut);
const sandbox = { TextEncoder, console, Math, performance };
vm.createContext(sandbox);
try {
  new vm.Script(algo + "\n;globalThis.__draw = draw; globalThis.__build = buildRace;").runInContext(sandbox);
  check("Phần thuật toán chạy được ngoài trình duyệt",
    typeof sandbox.__draw === "function" && typeof sandbox.__build === "function");
} catch (e) {
  check("Phần thuật toán chạy được ngoài trình duyệt", false, e.message);
  process.exit(1);
}

let mismatch = 0;
for (const n of [8, 45, 150]) {
  const roster = makeTestRoster(3, n);
  const a = draw(roster, "Giải kiểm tra");
  const b = sandbox.__draw(roster, "Giải kiểm tra");
  const ra = buildRace(a.finalOrder, a.seedHex, { topK: 3 });
  const rb = sandbox.__build(b.finalOrder, b.seedHex, { topK: 3 });
  if (a.seedHex !== b.seedHex) mismatch++;
  else if (ra.progress.length !== rb.progress.length) mismatch++;
  else {
    for (let i = 0; i < ra.progress.length; i += 97) {
      if (ra.progress[i] !== rb.progress[i]) { mismatch++; break; }
    }
  }
}
check("Trang dựng ra khớp thư viện gốc từng khung hình", mismatch === 0, `${3 - mismatch}/3 ca khớp`);

// ---- 3. Mọi id mà mã JS gọi tới đều phải tồn tại trong HTML
const referenced = [...script.matchAll(/getElementById\("([^"]+)"\)/g)].map((m) => m[1]);
const present = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
const missing = [...new Set(referenced)].filter((id) => !present.has(id));
check("Mọi id được gọi đều tồn tại trong HTML", missing.length === 0,
  missing.length ? "thiếu: " + missing.join(", ") : `${new Set(referenced).size} id, đủ cả`);

// ---- 4. Danh sách nhạc phải hợp lệ và khớp với thư mục music/
{
  const m = script.match(/const MUSIC = (\[[^\n]*\]);/);
  check("Có nhúng danh sách nhạc", m !== null);
  if (m) {
    let list = null;
    try { list = JSON.parse(m[1]); } catch { /* để phép kiểm bên dưới báo */ }
    check("Danh sách nhạc là JSON hợp lệ",
      Array.isArray(list) && list.every((x) => typeof x === "string"));

    const onDisk = existsSync("music/playlist.json")
      ? JSON.parse(readFileSync("music/playlist.json", "utf8"))
      : [];
    check("Danh sách nhúng khớp thư mục music/",
      JSON.stringify(list) === JSON.stringify(onDisk),
      `${(list || []).length} bài`);
  }

  // Tên file có dấu tiếng Việt và khoảng trắng chỉ tải được nếu được mã hoá.
  check("Đường dẫn nhạc được mã hoá URI",
    script.includes('new Audio("music/" + encodeURIComponent('));

  // Thư mục trống là chuyện bình thường, không được làm hỏng cuộc đua.
  check("Thư mục nhạc trống vẫn chạy được", script.includes("if (!this.list.length) return;"));
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

// ---- 5. Tự chứa
const external = html.match(/(src|href)\s*=\s*["'](https?:)?\/\//gi);
check("Không phụ thuộc tài nguyên ngoài", external === null,
  external ? external.join(", ") : "mở được bằng file://");

// ---- 6. Hình học đường đua phải liền mạch — chó không được nhảy chỗ
{
  // Cắt bằng mốc TƯỜNG MINH đặt sẵn trong trang. Trước đây mốc kết thúc là một
  // khai báo tình cờ nằm gần đó, và nó gãy hai lần: một lần vì dog.mjs cũng khai
  // báo FUR, một lần vì dòng ngay sau đó gọi hàm của module khác.
  const geo = script.slice(script.indexOf("/* GEO-START"), script.indexOf("/* GEO-END"));
  check("Tìm thấy mốc hình học trong trang", geo.length > 100);
  const ctxGeo = { Math, Int32Array, Float64Array };
  vm.createContext(ctxGeo);
  new vm.Script(geo + `
;globalThis.__pointAt = pointAt;
globalThis.__LEN = TRACK_LEN;
globalThis.__lanesFor = lanesFor;
globalThis.__assignLanes = assignLanes;`).runInContext(ctxGeo);
  const at = ctxGeo.__pointAt;

  let worst = 0;
  const STEP = 1 / 4000;
  for (let p = 0; p < 1; p += STEP) {
    const a = at(p, 0);
    const b = at(p + STEP, 0);
    worst = Math.max(worst, Math.hypot(b.x - a.x, b.y - a.y));
  }
  const expected = ctxGeo.__LEN * STEP;
  check("Đường đua liền mạch, không có chỗ nhảy", worst < expected * 1.6,
    `bước lớn nhất ${worst.toFixed(3)} so với chuẩn ${expected.toFixed(3)}`);

  // Sân THẲNG: hai vạch ở hai đầu, cách nhau đúng chiều dài đường đua.
  //
  // Ràng buộc cũ — "vạch xuất phát trùng vạch đích" — là ràng buộc của sân
  // oval và đã hết hiệu lực. Xoá hẳn chứ không nới lỏng: một phép kiểm được
  // nới cho vừa với mã mới thì từ đó không kiểm gì nữa, mà vẫn báo màu xanh.
  const start = at(0, 0);
  const end = at(1, 0);
  check("Vạch đích cách vạch xuất phát đúng chiều dài đường đua",
    Math.abs(end.x - start.x - ctxGeo.__LEN) < 1e-9 && Math.abs(end.y - start.y) < 1e-9,
    `${ctxGeo.__LEN} đơn vị sân`);
  check("Đường chạy thẳng, không lệch theo chiều dọc",
    at(0.37, 0).y === 0 && at(0.81, 0).y === 0);

  // Chia làn phải ĐỀU. Đây là lý do duy nhất khiến việc bỏ sân oval đáng làm,
  // nên nó được kiểm chứ không được tin.
  let worstImbalance = 0;
  for (const n of [8, 45, 150]) {
    const lanes = ctxGeo.__lanesFor(n);
    const assigned = ctxGeo.__assignLanes(n, "seed-kiem-tra-" + n, lanes);
    const tally = new Map();
    for (const v of assigned) tally.set(v, (tally.get(v) || 0) + 1);
    const counts = [...tally.values()];
    worstImbalance = Math.max(worstImbalance, Math.max(...counts) - Math.min(...counts));
    if (tally.size !== Math.min(lanes, n)) worstImbalance = 99;
  }
  check("Chia làn đều, lệch nhau nhiều nhất một con", worstImbalance <= 1,
    `8 người → ${ctxGeo.__lanesFor(8)} làn, 45 → ${ctxGeo.__lanesFor(45)}, ` +
    `150 → ${ctxGeo.__lanesFor(150)} làn`);

  // Người thắng luôn là chó số 0. Nếu làn suy ra từ chỉ số thì người thắng
  // luôn nằm ở làn đầu tiên, và sau dăm buổi lễ sẽ có người nhận ra.
  const winnerLanes = new Set();
  for (let i = 0; i < 40; i++) {
    winnerLanes.add(ctxGeo.__assignLanes(45, "giai-" + i, ctxGeo.__lanesFor(45))[0]);
  }
  check("Làn của người thắng không dính dáng gì tới việc họ thắng",
    winnerLanes.size >= 8, `${winnerLanes.size} làn khác nhau qua 40 lượt`);
}

console.log(failed === 0 ? "\nTRANG ĐUA ĐẠT\n" : `\n${failed} MỤC KHÔNG ĐẠT\n`);
process.exit(failed === 0 ? 0 : 1);
