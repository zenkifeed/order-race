// Logo Order Race
// ============================================================================
//
// Cái cúp cũ nói "có giải thưởng" — đúng nhưng rỗng, phần mềm nào phát thưởng
// cũng dùng được cái cúp đó. Logo phải nói đúng SẢN PHẨM NÀY: một con chó đang
// sải hết cỡ, bốn chân duỗi thẳng ra hai đầu, trên một vệt tốc độ.
//
// Vì sao là SVG path chứ không phải file ảnh: cùng lý do với bộ icon — sắc nét
// trên máy chiếu ở mọi cỡ, không tải gì từ mạng, và nhận màu từ currentColor.
//
// Vì sao hình khối ĐẶC chứ không phải nét như icons.mjs: logo phải đọc được ở
// 24px trên thanh tiêu đề. Ở cỡ đó một hình vẽ bằng nét 2px chỉ còn là một mớ
// vạch rối; bóng đặc thì vẫn ra hình con chó. Đây là ngoại lệ có lý do, không
// phải quên mất bộ icon.
//
// Toạ độ trong lưới 100×100 chứ không phải 24×24 của icons.mjs: dáng con vật
// cần số lẻ nhỏ hơn một đơn vị, mà viết 0,4 trong lưới 24 thì đọc không ra.

/**
 * Hình logo, tách khỏi phần sinh SVG.
 *
 * Để rời ra như thế này thì bộ tô thử vẽ được đúng cái mà trình duyệt vẽ, và
 * cửa kiểm soi được từng toạ độ. Nhét thẳng vào một chuỗi SVG thì cả hai việc
 * đó đều phải làm bằng cách đọc chuỗi bằng mắt.
 */
export const LOGO_SHAPES = [
  // vệt tốc độ phía sau — vẽ trước nên nằm dưới đầu chó
  { stroke: "M8 33 L23 33", width: 6, alpha: 0.42 },
  { stroke: "M5 48 L17 48", width: 6, alpha: 0.26 },

  // Tai cụp NGƯỢC VỀ SAU, không dựng lên. Greyhound lúc chạy cụp tai sát đầu;
  // để tai dựng thì hình ra con sói, và ở cỡ nhỏ nó đọc thành một cái sừng.
  { fill: "M43 29 C34 21 24 21 20 27 C23 35 31 42 41 44 Z" },

  // Đầu và cổ. Con mắt là một nhánh KHOÉT RA bằng fill-rule evenodd, nên cả
  // hình vẫn chỉ một màu và vẫn ăn theo currentColor — không phải chồng thêm
  // một lớp màu nền, thứ sẽ sai ngay khi ai đó đổi màu huy hiệu.
  {
    fill:
      "M46 26 C54 27 59 31 61 36 " +      // trán tới hõm mũi
      "L87 43 C91 44 92 47 90 49 " +      // sống mũi ra tới chóp
      "C88 51 85 51 82 50 " +             // chóp mũi, thon chứ không bè
      "L64 52 " +                         // mõm dưới
      "C59 57 55 61 52 65 " +             // gò má
      "C49 69 45 71 41 72 " +             // yết hầu, hàm nhẹ hẳn đi
      "L31 64 " +                         // gáy cắt chéo
      "C23 57 25 42 32 35 " +             // sau sọ
      "C36 30 41 26 46 26 Z" +
      "M51 39 C53 37 56 37 58 39 " +      // mắt: hình hạnh nhân, khoét ra
      "C56 42 53 42 51 39 Z",
    evenodd: true,
  },
];

/**
 * Dấu logo: con chó trong một cái huy hiệu bo góc.
 *
 * Trả về SVG đặt vừa một ô vuông `size`. Màu lấy từ currentColor, nên chỗ nào
 * đặt nó vào cũng chỉ cần chỉnh màu chữ.
 */
/**
 * Khung nhìn lệch đi để hình nằm GIỮA huy hiệu.
 *
 * Khung bao thật của hình là x 2,0–91,0 · y 22,7–72,0, tâm (46,5 · 47,4). Dịch
 * khung nhìn đi -3,5 và -2,6 thì tâm về đúng (50 · 50). Làm ở đây, một chỗ, chứ
 * không đi sửa hai chục toạ độ trong đường dẫn — sửa toạ độ thì lần sau ai nắn
 * lại dáng con vật là lệch tâm trở lại mà không biết vì sao.
 */
export const VIEW_BOX = "-3.5 -2.6 100 100";

export function logoMark(size = 44) {
  return (
    `<svg class="ic" width="${size}" height="${size}" viewBox="${VIEW_BOX}" ` +
    'aria-hidden="true" fill="currentColor" stroke="currentColor" ' +
    'stroke-linecap="round" stroke-linejoin="round">' +
    LOGO_SHAPES.map(shapeToSvg).join("") +
    "</svg>"
  );
}

function shapeToSvg(s) {
  const op = s.alpha === undefined ? "" : ` opacity="${s.alpha}"`;
  if (s.fill) {
    const fr = s.evenodd ? ' fill-rule="evenodd"' : "";
    return `<path d="${s.fill}" stroke="none"${fr}${op}/>`;
  }
  return `<path d="${s.stroke}" fill="none" stroke-width="${s.width}"${op}/>`;
}
