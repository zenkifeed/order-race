// Bộ icon dùng chung — Order Race
//
// Vẽ bằng SVG path nội tuyến chứ không dùng emoji, vì ba lý do:
//   · sắc nét ở mọi cỡ, kể cả phóng lên máy chiếu
//   · không tải gì từ mạng, trang vẫn tự chứa
//   · nhận màu từ currentColor nên đổi theme là đổi màu theo, không phải sửa gì
//
// Emoji thì mỗi hệ điều hành vẽ một kiểu, và trên Windows chúng ra màu mè lạc
// hẳn khỏi bảng màu — đúng thứ nhìn thấy ngay trên máy chiếu.

const PATHS = {
  race:
    '<path d="M7 3.5v17"/><path d="M7 5.2h11l-2.6 4.1L18 13.4H7z"/>',
  referee:
    '<path d="M9 2.8h6a2.2 2.2 0 0 1 2.2 2.2v14a2.2 2.2 0 0 1-2.2 2.2H9A2.2 2.2 0 0 1 6.8 19V5A2.2 2.2 0 0 1 9 2.8z"/>' +
    '<circle cx="12" cy="7.2" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="16.8" r="1.7"/>',
  verify:
    '<path d="M12 2.8l7.2 2.9v5.8c0 4.6-3.1 7.7-7.2 9.2-4.1-1.5-7.2-4.6-7.2-9.2V5.7z"/>' +
    '<path d="M9 11.8l2.2 2.2 4.2-4.4"/>',
  soundOn:
    '<path d="M4.5 9.2h3.2L12 5.4v13.2l-4.3-3.8H4.5z"/>' +
    '<path d="M15.4 9.4a3.7 3.7 0 0 1 0 5.2"/><path d="M17.9 6.9a7.2 7.2 0 0 1 0 10.2"/>',
  soundOff:
    '<path d="M4.5 9.2h3.2L12 5.4v13.2l-4.3-3.8H4.5z"/>' +
    '<path d="M16 9.6l4.2 4.8"/><path d="M20.2 9.6L16 14.4"/>',
  pause:
    '<path d="M9.2 4.6v14.8"/><path d="M14.8 4.6v14.8"/>',
  play:
    '<path d="M7.8 4.6l11 7.4-11 7.4z"/>',
  back:
    '<path d="M10 5.6L4.4 11.2 10 16.8"/><path d="M4.4 11.2h9.4a5.8 5.8 0 0 1 0 11.6H9"/>',
  people:
    '<path d="M9 11.4a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8z"/>' +
    '<path d="M2.6 20.2c0-3.5 2.9-5.6 6.4-5.6s6.4 2.1 6.4 5.6"/>' +
    '<path d="M16.4 5.2a3.1 3.1 0 0 1 0 6.1"/><path d="M17.6 14.9c2.3.5 3.8 2.3 3.8 5.3"/>',
  trophy:
    '<path d="M7.2 3.8h9.6v5.1a4.8 4.8 0 0 1-9.6 0z"/>' +
    '<path d="M7.2 5.4H4.4v1.4a3.2 3.2 0 0 0 3 3.2"/><path d="M16.8 5.4h2.8v1.4a3.2 3.2 0 0 1-3 3.2"/>' +
    '<path d="M12 13.7v3.6"/><path d="M8.4 20.2h7.2"/><path d="M9.6 20.2l.6-2.9h3.6l.6 2.9"/>',
  tag:
    '<path d="M4.6 4.6h7.2l7.6 7.6-7.2 7.2-7.6-7.6z"/><circle cx="9" cy="9" r="1.5"/>',
};

/**
 * SVG nội tuyến cho một icon.
 * @param key   khoá trong bảng trên
 * @param size  cỡ pixel; mặc định thừa hưởng cỡ chữ
 */
export function icon(key, size = 20) {
  const d = PATHS[key];
  if (!d) throw new Error("Không có icon: " + key);
  return (
    `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" ` +
    'fill="none" stroke="currentColor" stroke-width="2" ' +
    `stroke-linecap="round" stroke-linejoin="round">${d}</svg>`
  );
}

export const iconKeys = () => Object.keys(PATHS);
