// Kiểm thử xếp biển tên — Order Race
// Chạy: node tools/web/labels-selftest.mjs

import { placeLabels } from "./labels.mjs";

let failed = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "  OK  " : "  SAI "} ${name}${detail ? "  — " + detail : ""}`);
  if (!ok) failed++;
}

const box = (key, x, y, priority = 1, w = 60, h = 18) => ({ key, x, y, w, h, priority });

// ------------------------------------------- 1. Không đè nhau thì đặt hết
{
  const out = placeLabels([box(0, 0, 0), box(1, 200, 0), box(2, 400, 0)]);
  check("Ba biển cách xa nhau đều được đặt", out.length === 3);
}

// -------------------------------------- 2. Đè nhau thì ưu tiên thắng
{
  const out = placeLabels([box(1, 10, 0, 5), box(2, 12, 0, 1), box(3, 14, 0, 9)]);
  check("Chỉ đặt được một biển trong cụm chồng nhau", out.length === 1, `đặt ${out.length}`);
  check("Biển ưu tiên cao nhất được giữ lại", out[0].key === 2, `giữ key ${out[0]?.key}`);
}

// ------------------------------- 3. Cùng ưu tiên thì theo key, không theo vị trí
{
  const a = placeLabels([box(7, 10, 0), box(3, 12, 0)]);
  const b = placeLabels([box(3, 12, 0), box(7, 10, 0)]);
  check("Thứ tự đầu vào không đổi kết quả", a[0].key === b[0].key && a[0].key === 3,
    `giữ key ${a[0].key}`);
}

// ------------------------------------------ 4. Ổn định khi chó nhích qua nhau
{
  let flips = 0;
  let prev = null;
  for (let step = 0; step <= 60; step++) {
    // hai chú chó đi ngang qua nhau
    const out = placeLabels([box(4, 100 - step, 0), box(9, 40 + step, 0)]);
    const kept = out.map((o) => o.key).join(",");
    if (prev !== null && kept !== prev) flips++;
    prev = kept;
  }
  check("Không nhấp nháy khi hai chú chó đi ngang qua nhau", flips <= 2,
    `${flips} lần đổi tập biển`);
}

// ---------------------------------------------------- 5. Tôn trọng khoảng đệm
{
  const tight = placeLabels([box(0, 0, 0), box(1, 62, 0)], { padding: 0 });
  const spaced = placeLabels([box(0, 0, 0), box(1, 62, 0)], { padding: 6 });
  check("Không đệm thì hai biển sát nhau vẫn đặt được", tight.length === 2);
  check("Có đệm thì bị coi là đè nhau", spaced.length === 1);
}

// ------------------------------------------------------- 6. Trần số biển
{
  const many = [];
  for (let i = 0; i < 50; i++) many.push(box(i, i * 200, 0));
  check("Tôn trọng trần số biển", placeLabels(many, { maxLabels: 8 }).length === 8);
}

// ------------------------ 7. Đám đông vơi thì số biển đọc được phải tăng
{
  const dense = [];
  for (let i = 0; i < 150; i++) dense.push(box(i, (i % 25) * 34, Math.floor(i / 25) * 22));
  const thin = dense.filter((_, i) => i % 10 === 0);
  const a = placeLabels(dense).length;
  const b = placeLabels(thin).length / thin.length;
  const aRatio = a / dense.length;
  check("Đông thì chỉ hiện được một phần tên", aRatio < 0.8, `${(aRatio * 100).toFixed(0)}% số tên`);
  check("Vơi thì hiện được gần hết", b > 0.9, `${(b * 100).toFixed(0)}% số tên`);
}

// ------------------------------- 8. Không được cấp phát trong lúc chạy
{
  const pool = [];
  for (let i = 0; i < 40; i++) pool.push(box(i, (i % 8) * 70, Math.floor(i / 8) * 30));
  const out = [];
  const first = placeLabels(pool, { out });
  check("Trả về đúng mảng out được truyền vào", first === out);

  const before = out.length;
  placeLabels(pool, { out });
  check("Gọi lại nhiều lần cho cùng kết quả", out.length === before);
  check("Không nhân bản đối tượng: phần tử trả về chính là phần tử đầu vào",
    out.every((o) => pool.indexOf(o) >= 0));
}

console.log(failed === 0 ? "\nXẾP BIỂN TÊN ĐẠT\n" : `\n${failed} MỤC KHÔNG ĐẠT\n`);
process.exit(failed === 0 ? 0 : 1);
