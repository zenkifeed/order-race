// Xếp biển tên tránh đè nhau — Order Race
//
// Bài toán: ai cũng muốn thấy tên mình, nhưng 150 biển tên trên một màn hình thì
// chồng lên nhau thành một vệt mực và không đọc được cái nào — kể cả tên mình.
//
// Cách giải: duyệt theo thứ tự ưu tiên, đặt được biển nào thì đặt, biển nào đè
// lên biển đã đặt thì bỏ. Đám đông càng vơi thì càng nhiều tên hiện ra — và
// chính điều đó lại thành một nhịp: cả phòng thấy tên bắt đầu đọc được nghĩa là
// sắp tới lúc quan trọng.
//
// Thứ tự duyệt phải ỔN ĐỊNH, không phụ thuộc vị trí trên màn hình. Nếu xếp theo
// toạ độ thì hai chú chó đi ngang qua nhau sẽ làm cả cụm biển tên nhấp nháy.
//
// KHÔNG CẤP PHÁT TRONG LÚC CHẠY. Hàm này chạy mỗi khung hình với 150 phần tử.
// Bản đầu dùng `candidates.slice().sort()` và `placed.push({...c, ...})`: mỗi
// khung hình là một mảng 150 phần tử mới cộng vài chục đối tượng mới, tức khoảng
// 9 000 đối tượng mỗi giây ném cho bộ dọn rác. Nó không làm rớt khung hình ngay,
// nhưng đó đúng là loại chi phí âm thầm khiến một trang 3D "mở lên thấy lag" mà
// không ai chỉ ra được vì sao.

/**
 * @param candidates  [{ key, x, y, w, h, priority }] — toạ độ pixel, (x, y) là
 *                    tâm biển. priority nhỏ hơn được ưu tiên trước.
 *                    MẢNG NÀY BỊ SẮP XẾP TẠI CHỖ và các phần tử bị gắn thêm
 *                    trường biên. Nơi gọi vốn dựng lại nó mỗi khung hình nên
 *                    điều đó là an toàn, và nó tiết kiệm một mảng mỗi khung.
 * @param options     { padding, maxLabels, out } — truyền `out` là một mảng dùng
 *                    lại để không cấp phát gì cả.
 * @returns tập con đặt được, theo thứ tự ưu tiên
 */
export function placeLabels(candidates, options = {}) {
  const padding = options.padding ?? 4;
  const maxLabels = options.maxLabels ?? Infinity;
  const placed = options.out ?? [];
  placed.length = 0;

  candidates.sort((a, b) => (a.priority - b.priority) || (a.key - b.key));

  for (let i = 0; i < candidates.length; i++) {
    if (placed.length >= maxLabels) break;
    const c = candidates[i];

    const left = c.x - c.w / 2 - padding;
    const right = c.x + c.w / 2 + padding;
    const top = c.y - c.h / 2 - padding;
    const bottom = c.y + c.h / 2 + padding;

    let clash = false;
    for (let j = 0; j < placed.length; j++) {
      const p = placed[j];
      if (left < p.right && right > p.left && top < p.bottom && bottom > p.top) {
        clash = true;
        break;
      }
    }
    if (clash) continue;

    c.left = left;
    c.right = right;
    c.top = top;
    c.bottom = bottom;
    placed.push(c);
  }

  return placed;
}
