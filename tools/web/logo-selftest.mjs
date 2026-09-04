// Kiểm thử logo — Order Race
// Chạy: node tools/web/logo-selftest.mjs
//
// Một cái logo sai thì không có ngoại lệ nào được ném ra: nó vẫn là SVG hợp lệ,
// vẫn hiện lên, chỉ là lệch khỏi huy hiệu hoặc bị cắt mất một mẩu tai. Nên cửa
// này đọc thẳng TOẠ ĐỘ trong đường dẫn chứ không tin vào chuỗi.

import { LOGO_SHAPES, VIEW_BOX, logoMark } from "./logo.mjs";

let failed = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "  OK  " : "  SAI "} ${name}${detail ? "  — " + detail : ""}`);
  if (!ok) failed++;
}

/** Mọi cặp toạ độ trong một đường dẫn. Đủ cho phép đo khung bao. */
function points(d) {
  const nums = (d.match(/-?\d*\.?\d+/g) || []).map(Number);
  const out = [];
  for (let i = 0; i + 1 < nums.length; i += 2) out.push([nums[i], nums[i + 1]]);
  return out;
}

const [vx, vy, vw, vh] = VIEW_BOX.split(/\s+/).map(Number);

// ------------------------------------------------------ 1. Cú pháp đường dẫn
{
  const bad = [];
  for (const s of LOGO_SHAPES) {
    const d = s.fill || s.stroke;
    if (!d) { bad.push("hình không có đường dẫn"); continue; }
    if (!/^M/.test(d.trim())) bad.push("không bắt đầu bằng M: " + d.slice(0, 16));
    // Chỉ cho phép đúng bộ lệnh mà cả trình duyệt lẫn bộ tô thử đều hiểu.
    const cmds = d.match(/[A-Za-z]/g) || [];
    const odd = cmds.filter((c) => !"MLCZ".includes(c.toUpperCase()));
    if (odd.length) bad.push("lệnh lạ: " + [...new Set(odd)].join(""));
    // Số cặp toạ độ phải chẵn, nếu lẻ là gõ thiếu một số.
    if ((d.match(/-?\d*\.?\d+/g) || []).length % 2 !== 0) bad.push("số toạ độ lẻ");
  }
  check("Mọi đường dẫn đúng cú pháp và chỉ dùng M/L/C/Z", bad.length === 0,
    bad.slice(0, 3).join(" · "));

  const closed = LOGO_SHAPES.filter((s) => s.fill).every((s) => /Z\s*$/.test(s.fill.trim()));
  check("Mọi hình tô kín đều khép lại bằng Z", closed);
}

// ------------------------------------------- 2. Nằm gọn và nằm giữa khung nhìn
{
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const s of LOGO_SHAPES) {
    const pad = s.fill ? 0 : s.width / 2;   // nét kẻ phình ra hai bên nửa bề rộng
    for (const [px, py] of points(s.fill || s.stroke)) {
      x0 = Math.min(x0, px - pad); y0 = Math.min(y0, py - pad);
      x1 = Math.max(x1, px + pad); y1 = Math.max(y1, py + pad);
    }
  }
  // Điểm điều khiển của đường Bézier nằm NGOÀI đường cong, nên khung đo được ở
  // đây rộng hơn khung thật. Lọt vào khung nhìn theo phép đo này thì lọt thật.
  check("Hình nằm gọn trong khung nhìn, không bị cắt",
    x0 >= vx && y0 >= vy && x1 <= vx + vw && y1 <= vy + vh,
    `x ${x0.toFixed(1)}–${x1.toFixed(1)} · y ${y0.toFixed(1)}–${y1.toFixed(1)}`);

  const cx = (x0 + x1) / 2 - (vx + vw / 2);
  const cy = (y0 + y1) / 2 - (vy + vh / 2);
  check("Hình nằm giữa huy hiệu, lệch dưới 3 đơn vị",
    Math.abs(cx) < 3 && Math.abs(cy) < 3,
    `lệch (${cx.toFixed(1)}, ${cy.toFixed(1)})`);
}

// ------------------------------------------------- 3. Đọc được ở cỡ nhỏ nhất
{
  // Logo phải sống ở 24px trên thanh tiêu đề. Ở cỡ đó một đơn vị lưới còn 0,24px
  // — mọi chi tiết mảnh hơn 4 đơn vị là biến mất, và cái mất đi trước tiên bao
  // giờ cũng là con mắt.
  const eye = LOGO_SHAPES.find((s) => s.fill && s.fill.lastIndexOf("M") > 0);
  check("Đầu có nhánh khoét làm con mắt", !!eye);
  if (eye) {
    const sub = eye.fill.slice(eye.fill.lastIndexOf("M"));
    const pts = points(sub);
    const w = Math.max(...pts.map((p) => p[0])) - Math.min(...pts.map((p) => p[0]));
    const h = Math.max(...pts.map((p) => p[1])) - Math.min(...pts.map((p) => p[1]));
    check("Mắt đủ to để còn thấy ở 24px", w >= 4 && h >= 3,
      `${w.toFixed(1)}×${h.toFixed(1)} đơn vị`);
    check("Hình có khoét thì phải khai fill-rule evenodd", eye.evenodd === true);
  }

  const thin = LOGO_SHAPES.filter((s) => s.stroke && s.width < 4);
  check("Không nét nào mảnh dưới 4 đơn vị", thin.length === 0, `${thin.length} nét`);
}

// ----------------------------------------------------- 4. SVG sinh ra dùng được
{
  const svg = logoMark(44);
  check("Sinh ra SVG có đủ cỡ và khung nhìn",
    svg.includes('width="44"') && svg.includes(`viewBox="${VIEW_BOX}"`));
  check("Ăn màu từ currentColor, không chôn cứng màu nào",
    svg.includes("currentColor") && !/#[0-9a-f]{3,6}/i.test(svg));
  check("Số thẻ path khớp số hình", (svg.match(/<path/g) || []).length === LOGO_SHAPES.length);
  check("Có khai fill-rule cho hình khoét", svg.includes('fill-rule="evenodd"'));
  check("Không có emoji trong logo",
    !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(svg));

  // Cỡ nào cũng phải ra cùng một hình, chỉ khác thước.
  const a = logoMark(24).replace(/(width|height)="24"/g, "");
  const b = logoMark(78).replace(/(width|height)="78"/g, "");
  check("Đổi cỡ không đổi hình", a === b);
}

console.log(failed === 0 ? "\nLOGO ĐẠT\n" : `\n${failed} MỤC KHÔNG ĐẠT\n`);
process.exit(failed === 0 ? 0 : 1);
