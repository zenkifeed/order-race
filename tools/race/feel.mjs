// Lớp cảm giác — Order Race / M1
//
// Mô hình khung va chạm:  chuẩn bị → ▣ VA CHẠM → phản ứng → lắng xuống.
//
// Mọi phản hồi phải nổ đúng vào KHOẢNH KHẮC CHẠM VẠCH chứ không rải quanh nó.
// Bản đầu làm chậm cả 12% cuối bằng hai bậc nhảy cứng (1 → 0.65 → 0.3) và không
// có cú va chạm nào ở giữa. Bậc nhảy tức thời của hệ số thời gian đọc ra y hệt
// một cú rớt khung hình, còn một vùng chậm kéo dài mà không neo vào cái gì thì
// chỉ còn là máy chạy chậm. Người dùng mô tả đúng cảm giác đó: "giống giật lag".
//
// Tách thành module riêng để kiểm thử được bằng máy — xem feel-selftest.mjs.
// Bản Unity ở M1 phải dùng đúng bộ hằng số này.

export const FEEL = {
  /** Giây thời gian đua trước vạch đích, để siết dần chứ không sập bậc. */
  ANTICIPATION: 1.1,

  /** Giây THẬT đóng băng ngay tại khung va chạm.
   *  Bậc cao nhất trong dải 120–160 ms, vì đây là khoảnh khắc lớn nhất buổi lễ. */
  FREEZE: 0.14,

  /** Giây THẬT để tua trở lại tốc độ thường sau khi hết đóng băng. */
  REACTION: 0.95,

  /** Giây THẬT giữ nguyên sau phản ứng, trước khi lên bục vinh danh. */
  HOLD: 0.7,

  /** Hệ số thời gian ở cuối đoạn chuẩn bị. Đủ để cảm thấy đang tới gần chuyện
   *  gì đó, chưa đủ để đọc ra thành máy chậm. */
  MIN_SCALE: 0.55,

  /** Hệ số ngay sau khi hết đóng băng — đây mới là chỗ chậm thật sự, và nó
   *  ngắn. */
  RESUME_FROM: 0.18,
};

const sat = (u) => (u < 0 ? 0 : u > 1 ? 1 : u);

export const easeInQuad = (u) => u * u;
export const easeOutQuint = (u) => 1 - Math.pow(1 - u, 5);
export const easeOutCubic = (u) => 1 - Math.pow(1 - u, 3);

/**
 * Hệ số thời gian của mô phỏng.
 *
 * @param phase           "countdown" | "run" | "impact" | "reaction" | "done"
 * @param sinceImpact     giây THẬT tính từ khung va chạm
 * @param remainToFinish  giây THỜI GIAN ĐUA còn lại tới vạch đích
 */
export function timeScaleAt(phase, sinceImpact, remainToFinish) {
  if (phase === "impact") return 0;

  if (phase === "reaction") {
    return FEEL.RESUME_FROM + (1 - FEEL.RESUME_FROM) * easeOutQuint(sat(sinceImpact / FEEL.REACTION));
  }

  if (phase === "run") {
    if (remainToFinish > FEEL.ANTICIPATION) return 1;
    return 1 - (1 - FEEL.MIN_SCALE) * easeInQuad(1 - sat(remainToFinish / FEEL.ANTICIPATION));
  }

  return 1;
}

/** Tổng thời gian THẬT của cả pha về đích, từ khung va chạm tới lúc lên bục. */
export const finishBeatDuration = () => FEEL.FREEZE + FEEL.REACTION + FEEL.HOLD;

/**
 * Biên độ rung màn hình theo hai hình sin lệch tần số.
 *
 * Nhiễu trắng đọc ra đúng như... nhiễu. Hai hình sin lệch nhau đọc ra như cú
 * giật của máy quay, và còn tái tạo được — cùng một mốc thời gian cho cùng một
 * khung hình, nên quay video lại vẫn giống hệt.
 */
export function shakeAt(nowSec, amount, motionScale) {
  if (amount <= 0 || motionScale <= 0) return { x: 0, y: 0 };
  const amp = 16 * amount * amount * motionScale;
  return { x: Math.sin(nowSec * 62) * amp, y: Math.cos(nowSec * 47) * amp * 0.7 };
}
