// Kiểm tra web/index.html — trang chọn trò chơi
// Chạy: node tools/web/check-hub-page.mjs
//
// Ngoài những phép kiểm quen thuộc (cú pháp, id, tự chứa), file này kiểm luôn
// mấy điều khoản của gate UI/UX mà đọc được từ mã nguồn: không có easing tuyến
// tính, vùng chạm đủ lớn, icon là SVG chứ không phải emoji.

import { readFileSync } from "node:fs";
import vm from "node:vm";
import { iconKeys } from "./icons.mjs";

let failed = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "  OK  " : "  SAI "} ${name}${detail ? "  — " + detail : ""}`);
  if (!ok) failed++;
}

const html = readFileSync("web/index.html", "utf8");
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
check("Tìm thấy khối script", scriptMatch !== null);
if (!scriptMatch) process.exit(1);
const script = scriptMatch[1];

// ---- 1. Cú pháp
try {
  new vm.Script(script, { filename: "index.html" });
  check("Khối script biên dịch được", true);
} catch (e) {
  check("Khối script biên dịch được", false, e.message);
  process.exit(1);
}

// ---- 2. Phần nhúng chạy được
//
// Trang này KHÔNG nhúng cỗ máy công bằng: thiết lập và bốc thăm nằm hết trong
// từng minigame. Bớt được một đường để trang chọn lỡ tay đụng vào thuật toán.
const cut = script.indexOf("(function () {");
const sandbox = { TextEncoder, console, Math };
vm.createContext(sandbox);
try {
  new vm.Script(script.slice(0, cut) +
    "\n;globalThis.__enc = encodeHandoff; globalThis.__dec = decodeHandoff; globalThis.__icon = icon;")
    .runInContext(sandbox);
  check("Phần nhúng chạy được ngoài trình duyệt",
    typeof sandbox.__enc === "function" && typeof sandbox.__icon === "function");
} catch (e) {
  check("Phần nhúng chạy được ngoài trình duyệt", false, e.message);
  process.exit(1);
}

check("Không nhúng cỗ máy công bằng vào trang chọn",
  !script.includes("function draw(lines"), "bốc thăm chỉ nằm trong minigame");

// ---- 3. Mọi id được gọi đều tồn tại
const referenced = [...script.matchAll(/getElementById\("([^"]+)"\)|\$\("([^"]+)"\)/g)]
  .map((m) => m[1] || m[2]);
const present = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
const missing = [...new Set(referenced)].filter((id) => !present.has(id));
check("Mọi id được gọi đều tồn tại trong HTML", missing.length === 0,
  missing.length ? "thiếu: " + missing.join(", ") : `${new Set(referenced).size} id, đủ cả`);

// ---- 4. Mọi icon được gọi đều có trong bộ icon
{
  const keys = new Set(iconKeys());
  // Bắt cả lời gọi trực tiếp icon("x") lẫn tên icon nằm trong dữ liệu (icon: "x").
  // Chỉ bắt lời gọi thì gõ sai tên trong bảng GAMES sẽ lọt qua và chỉ vỡ lúc chạy.
  const used = [
    ...[...script.matchAll(/icon\("([a-zA-Z]+)"/g)].map((m) => m[1]),
    ...[...script.matchAll(/icon: "([a-zA-Z]+)"/g)].map((m) => m[1]),
  ];
  const unknown = [...new Set(used)].filter((k) => !keys.has(k));
  check("Mọi icon được gọi đều có thật", unknown.length === 0,
    unknown.length ? "không có: " + unknown.join(", ") : `${new Set(used).size} icon`);
}

// ---- 5. Gate UI/UX: những điều khoản đọc được từ mã nguồn
{
  const css = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));

  check("Có đủ bộ ease, không dùng easing tuyến tính",
    css.includes("--ease-pop") && css.includes("--ease-out") && css.includes("--ease-snap") &&
    !/transition:[^;]*\blinear\b/.test(css));

  const minHeights = [...css.matchAll(/min-height:(\d+)px/g)].map((m) => Number(m[1]));
  check("Vùng chạm không dưới sàn 44px", minHeights.every((h) => h >= 44),
    minHeights.length ? `nhỏ nhất ${Math.min(...minHeights)}px` : "không đặt min-height nào");

  // Hành động chính của trang này là THẺ TRÒ CHƠI, không phải một cái nút —
  // thiết lập đã chuyển hết vào từng minigame. Nên phép kiểm đo cái thẻ.
  const cardMin = css.match(/\.card\{[\s\S]*?min-height:(\d+)px/);
  check("Hành động chính nổi trội hẳn", cardMin && Number(cardMin[1]) >= 200,
    cardMin ? `thẻ trò chơi ${cardMin[1]}px, nút phụ 44px` : "không đo được");

  check("Nền được sơn tường minh, không mượn của trình duyệt",
    /body\{[^}]*background:var\(--paper\)/.test(css.replace(/\s*\n\s*/g, "")));

  check("Có tôn trọng giảm chuyển động", css.includes("prefers-reduced-motion"));

  // ---- lớp chuyển động
  //
  // Hai điều khoản, cả hai đều là thứ không ai nhận ra khi hỏng: một cái làm
  // trang giật ở máy yếu, một cái làm nhịp vào màn rời rạc dần theo từng lần sửa.
  {
    const frames = [...css.matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g)];
    check("Có đủ các khung hình đã khai", frames.length >= 5, `${frames.length} @keyframes`);

    // Animate width/height/top/left/margin là bắt trình duyệt tính lại bố cục
    // mỗi khung hình. Trên máy chiếu của phòng họp thì đó là nguồn giật số một.
    const LAYOUT = /(^|[;{\s])(width|height|top|left|right|bottom|margin|padding|font-size|border-width)\s*:/;
    const bad = frames.filter(([, , body]) => LAYOUT.test(body)).map(([, name]) => name);
    check("Không khung hình nào động vào thuộc tính gây dựng lại bố cục",
      bad.length === 0, bad.join(", "));

    // Mọi thứ vào màn phải treo vào cùng một thang --t0. Một cái tuột ra ngoài
    // là nó tự chạy theo nhịp riêng, và nhịp cả trang lệch dần sau mỗi lần sửa.
    const enters = [...css.matchAll(/animation:\s*(markIn|riseIn|pop)\b[^;]*;/g)].map((m) => m[0]);
    const off = enters.filter((a) => !a.includes("--t0"));
    check("Mọi thứ vào màn đều treo vào thang thời gian chung",
      enters.length >= 5 && off.length === 0,
      `${enters.length} chỗ, ${off.length} chỗ tuột ra ngoài`);

    // Cú phóng phải có ĐỈNH ở giữa, không phải một đường đi thẳng tới đích:
    // đỉnh chính là khung va chạm mà tiếng và rung hẹn vào.
    const launch = frames.find(([, name]) => name === "launch");
    check("Cú phóng có khung va chạm ở giữa, không đi thẳng", !!launch &&
      /\d+%\s*\{[^}]*scale\(1\.0[5-9]/.test(launch[2]), launch ? "" : "không có @keyframes launch");
  }
  check("Có xử lý lề an toàn của thiết bị", css.includes("env(safe-area-inset"));
  check("Có trạng thái focus nhìn thấy được", (css.match(/:focus-visible/g) || []).length >= 3);
}

// ---- 6. Không emoji trong giao diện
{
  const body = html.slice(html.indexOf("<body>"));
  const emoji = body.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu);
  check("Không dùng emoji làm icon giao diện", emoji === null,
    emoji ? "còn: " + [...new Set(emoji)].join(" ") : "toàn bộ là SVG path");
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

// ---- 7. Tự chứa
const external = html.match(/(src|href)\s*=\s*["'](https?:)?\/\//gi);
check("Không phụ thuộc tài nguyên ngoài", external === null,
  external ? external.join(", ") : "mở được bằng file://");

// ---- 8. Không dẫn tới ngõ cụt
{
  const links = [...html.matchAll(/href="([^"#]+\.html)"/g)].map((m) => m[1]);
  const targets = [...script.matchAll(/href: "([^"]+\.html)"/g)].map((m) => m[1]);
  const all = new Set([...links, ...targets]);
  check("Mọi trang đích đều tồn tại",
    [...all].every((f) => { try { readFileSync("web/" + f); return true; } catch { return false; } }),
    [...all].join(", "));
}

console.log(failed === 0 ? "\nTRANG CHỌN TRÒ CHƠI ĐẠT\n" : `\n${failed} MỤC KHÔNG ĐẠT\n`);
process.exit(failed === 0 ? 0 : 1);
