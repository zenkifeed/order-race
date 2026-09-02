// Màn mở và chuyển cảnh giữa các trang — Order Race
//
// Hai phần tử phủ toàn màn hình, mỗi cái đúng một việc. Gộp làm một thì lúc
// vào và lúc ra tranh nhau cùng một thuộc tính opacity, và cú chuyển cảnh sẽ
// giật khựng thay vì mượt.
//
//   #veil  VÀO — trang mở ra sau tấm phủ đục rồi tan dần. Che đúng khoảnh khắc
//          trình duyệt vẽ khung hình trắng đầu tiên và bố cục còn đang nhảy.
//   #wash  RA  — bấm bắt đầu thì tấm phủ đậm lên bằng MÀU CỦA TRÒ CHƠI sắp vào,
//          rồi mới chuyển trang. Trang đích tan #veil cùng màu đó ra. Hai trang
//          là hai tài liệu khác nhau, nhưng người xem đọc thành một cú chuyển
//          cảnh liền mạch.
//
// LƯỚI AN TOÀN THUẦN CSS: #veil tan bằng animation của CSS, không cần một dòng
// JS nào. Mã JS văng lỗi ở bất kỳ đâu thì trang vẫn hiện ra và vẫn bấm được,
// thay vì kẹt sau một tấm màn đục vĩnh viễn. Đây là điều khoản bắt buộc của
// gate UI/UX, và cũng là kiểu lỗi tệ nhất có thể xảy ra giữa buổi lễ.

/** Giây: thời gian tấm phủ đậm lại trước khi rời trang. Khớp với CSS. */
export const WASH_OUT = 0.26;

/** Bỏ qua màn mở ngay lập tức — dùng khi người dùng bấm để vào thẳng. */
export function skipBoot(veil) {
  if (veil) veil.classList.add("gone");
}

/**
 * Đậm tấm phủ lại bằng màu chỉ định rồi chạy tiếp — gọi ngay trước khi rời trang.
 *
 * Luôn gọi `then`, kể cả khi có gì đó sai: một cú chuyển cảnh hỏng không bao giờ
 * được phép giữ quản trò lại ở màn hình cũ.
 */
export function washOut(wash, color, then) {
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    then();
  };

  if (!wash) {
    go();
    return;
  }

  wash.style.background = color;
  wash.classList.add("on");
  wash.addEventListener("transitionend", go, { once: true });

  // Lưới an toàn thứ hai: transitionend không nổ khi tab đang ở nền, và cũng
  // không nổ khi người dùng bật giảm chuyển động (thời lượng bị ép về ~0).
  setTimeout(go, WASH_OUT * 1000 + 140);
}
