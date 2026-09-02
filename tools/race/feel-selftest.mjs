// Kiểm thử lớp cảm giác — Order Race / M1
// Chạy: node tools/race/feel-selftest.mjs
//
// "Trông có đã không" thì phải có người xem. Nhưng "có bị giật không" thì đo
// được: một hệ số thời gian nhảy bậc bên trong một pha chính là thứ mà mắt đọc
// ra thành rớt khung hình. Chỗ duy nhất được phép nhảy là cú đóng băng, và nó
// phải ngắn.

import { FEEL, timeScaleAt, finishBeatDuration, shakeAt } from "./feel.mjs";

let failed = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "  OK  " : "  SAI "} ${name}${detail ? "  — " + detail : ""}`);
  if (!ok) failed++;
}

// ------------------------------------------- 1. Đoạn chuẩn bị phải liền mạch
{
  const STEPS = 2000;
  let worstJump = 0;
  let prev = timeScaleAt("run", 0, FEEL.ANTICIPATION * 1.5);
  for (let i = 0; i <= STEPS; i++) {
    const remain = FEEL.ANTICIPATION * (1 - i / STEPS);
    const v = timeScaleAt("run", 0, remain);
    worstJump = Math.max(worstJump, Math.abs(v - prev));
    prev = v;
  }
  // Ngưỡng tương ứng khoảng 1 khung hình ở 60fps: nhảy lớn hơn thế là thấy được.
  check("Đoạn chuẩn bị không có bậc nhảy", worstJump < 0.01,
    `bậc lớn nhất ${worstJump.toFixed(5)}`);

  check("Chuẩn bị bắt đầu từ tốc độ thường", timeScaleAt("run", 0, FEEL.ANTICIPATION) === 1);
  check("Chuẩn bị kết thúc đúng ngưỡng đặt ra",
    Math.abs(timeScaleAt("run", 0, 0) - FEEL.MIN_SCALE) < 1e-9);
}

// ------------------------------------------------- 2. Đóng băng phải đứng im
{
  check("Đóng băng thật sự đứng im", timeScaleAt("impact", 0.05, 0) === 0);
  check("Đóng băng nằm trong dải 120–160 ms", FEEL.FREEZE >= 0.12 && FEEL.FREEZE <= 0.16,
    `${(FEEL.FREEZE * 1000).toFixed(0)} ms`);
}

// -------------------------------- 3. Phản ứng phải tăng đều, liền mạch, về 1
{
  const STEPS = 2000;
  let worstJump = 0;
  let monotonic = true;
  let prev = timeScaleAt("reaction", 0, 0);
  check("Phản ứng khởi động từ đúng hệ số đặt ra", Math.abs(prev - FEEL.RESUME_FROM) < 1e-9);

  for (let i = 1; i <= STEPS; i++) {
    const v = timeScaleAt("reaction", (FEEL.REACTION * i) / STEPS, 0);
    if (v < prev - 1e-12) monotonic = false;
    worstJump = Math.max(worstJump, Math.abs(v - prev));
    prev = v;
  }
  check("Phản ứng không có bậc nhảy", worstJump < 0.01, `bậc lớn nhất ${worstJump.toFixed(5)}`);
  check("Phản ứng chỉ tăng, không dao động", monotonic);
  check("Phản ứng kết thúc đúng tốc độ thường", Math.abs(prev - 1) < 1e-9);
}

// ------------------------------------- 4. Hệ số luôn hợp lệ ở mọi đầu vào
{
  let ok = true;
  for (const phase of ["countdown", "run", "impact", "reaction", "done"]) {
    for (let i = 0; i <= 200; i++) {
      const v = timeScaleAt(phase, i / 100, i / 100);
      if (!(v >= 0 && v <= 1) || Number.isNaN(v)) { ok = false; break; }
    }
  }
  check("Hệ số thời gian luôn nằm trong [0, 1]", ok);
}

// ------------------------------------------------ 5. Cả pha phải đủ ngắn
{
  const d = finishBeatDuration();
  check("Pha về đích gọn dưới 2 giây", d < 2, `${d.toFixed(2)}s`);
  check("Phần chậm thật sự ngắn hơn phần chuẩn bị", FEEL.REACTION < 1.0,
    `${FEEL.REACTION}s chậm so với ${FEEL.ANTICIPATION}s chuẩn bị`);
}

// ------------------------------------------ 6. Rung: tái tạo được, có tắt được
{
  const a = shakeAt(12.345, 1, 1);
  const b = shakeAt(12.345, 1, 1);
  check("Rung tái tạo được", a.x === b.x && a.y === b.y);

  const off = shakeAt(12.345, 1, 0);
  check("Giảm chuyển động thì tắt hẳn rung", off.x === 0 && off.y === 0);

  let peak = 0;
  for (let i = 0; i < 4000; i++) peak = Math.max(peak, Math.abs(shakeAt(i / 200, 1, 1).x));
  check("Biên độ rung có trần hợp lý", peak <= 16.001, `đỉnh ${peak.toFixed(1)} px`);
}

console.log(failed === 0 ? "\nLỚP CẢM GIÁC ĐẠT\n" : `\n${failed} MỤC KHÔNG ĐẠT\n`);
process.exit(failed === 0 ? 0 : 1);
