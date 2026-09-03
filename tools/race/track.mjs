// Hình học đường đua — Order Race
//
// ĐƯỜNG THẲNG, nhiều làn. Bản trước là một sân oval kiểu sân vận động; đổi sang
// đường thẳng vì lý do đọc được, không phải vì thẩm mỹ:
//
//   · Trên oval, 150 chú chó chen trong 7 làn là hơn hai chục con mỗi làn, xếp
//     chồng lên nhau dọc theo đường chạy. Ai cũng thành một chấm màu trong đám.
//   · Khúc cua ăn mất bề ngang: đúng lúc đàn chó vào cua thì cả cụm bị nén lại
//     theo phương nhìn, và đó lại thường là lúc có cú vượt.
//   · Đường thẳng thì số làn muốn bao nhiêu cũng được — chiều cao khung hình
//     là thứ duy nhất giới hạn — nên cả đàn giãn ra theo chiều dọc, và vị trí
//     theo chiều ngang đọc thẳng ra thành thứ hạng.
//
// Đánh đổi đã cân nhắc: mất vạch xuất phát trùng vạch đích, và mất cái cảm giác
// "sân vận động". Đổi lại là thứ quan trọng hơn ở một buổi trao thưởng — nhìn
// vào là biết ai đang dẫn.
//
// Đây cũng là đường đi NÓNG NHẤT của cả trang: mỗi khung hình một lần cho mỗi
// con, 9 000 lần mỗi giây ở đàn 150. Vì vậy nó nằm ở module riêng có cửa đo
// bằng máy, thay vì nằm trong một file HTML.
//
// Bộ kiểm tra trang cắt khối này ra bằng hai mốc TƯỜNG MINH đặt ngay dưới đây.
// Bản trước lấy mốc mở đầu là chính câu khai báo hằng số chiều dài — và nó gãy
// ngay lần đầu, vì đoạn chú thích này cũng nhắc tới cái tên đó. Cùng một lỗi đã
// xảy ra một lần với mốc kết thúc. Mốc phải là mốc, không phải một câu mã tình
// cờ nằm đúng chỗ.

/* GEO-START — mốc cho tools/race/check-race-page.mjs, đừng xoá */
export const TRACK_LEN = 4200;

/** Nửa chiều dài — vạch xuất phát ở -HALF, vạch đích ở +HALF. */
export const TRACK_HALF = TRACK_LEN / 2;

/**
 * Số làn theo số người.
 *
 * Không cố định, vì cùng một con số không phục vụ được cả hai đầu. Tám người
 * trong hai mươi làn thì rải rác như hạt vừng; 150 người trong bảy làn thì đè
 * lên nhau. Căn theo căn bậc hai để số con mỗi làn tăng chậm: 8 người → 6 làn,
 * 45 người → 13 làn, 150 người → 23 làn, tức khoảng 6 con mỗi làn ở đầu đông.
 */
export function lanesFor(n) {
  const v = Math.round(Math.sqrt(n) * 1.9);
  return v < 6 ? 6 : v > 23 ? 23 : v;
}

/**
 * Bề rộng một làn, co lại khi nhiều làn.
 *
 * Giữ tổng chiều cao đường đua gần như không đổi, để mức phóng của máy quay
 * không phải đổi theo số người — nếu chiều cao thay đổi thì đàn 150 con bị thu
 * nhỏ tới mức không nhận ra hình chú chó nữa.
 */
export function laneWFor(lanes) {
  const w = 620 / lanes;
  return w < 24 ? 24 : w > 46 ? 46 : w;
}

/** Nửa chiều cao vành đường chạy, tính cả một làn đệm hai bên. */
export function trackHalfH(lanes) {
  return (lanes * laneWFor(lanes)) / 2;
}

/** Độ lệch theo chiều dọc của làn thứ `lane`, tâm đường đua là 0. */
export function laneOffset(lane, lanes) {
  return (lane - (lanes - 1) / 2) * laneWFor(lanes);
}

/**
 * Toạ độ tại một vị trí trên đường đua, GHI VÀO đối tượng có sẵn.
 *
 * Bản trước trả về một đối tượng mới mỗi lần gọi: 9 000 đối tượng rác mỗi giây
 * ở đàn 150, tất cả chết ngay trong khung hình đó. Bộ dọn rác thu chúng theo
 * từng đợt — và một đợt rơi đúng giây cuối là một khung hình rớt đúng khoảnh
 * khắc quan trọng nhất buổi lễ.
 *
 * `a` là hướng chạy, luôn bằng 0 trên đường thẳng. Giữ lại trong kết quả trả về
 * chứ không bỏ đi: mã vẽ, lớp bụi và lớp cắn nhau đều hỏi hướng chạy, và ngày
 * nào đó thêm một khúc cong thì chỉ phải sửa đúng ở đây.
 */
export function pointAtInto(out, prog, lane) {
  out.x = -TRACK_HALF + prog * TRACK_LEN;
  out.y = lane;
  out.a = 0;
  return out;
}

/** Dạng tiện dụng, có cấp phát. Chỉ dùng ngoài đường đi nóng. */
export function pointAt(prog, lane) {
  return pointAtInto({ x: 0, y: 0, a: 0 }, prog, lane);
}

/**
 * Xếp làn cho cả đàn: xáo trộn rồi chia vòng tròn.
 *
 * Hai cách làm sai đều hấp dẫn và đều phải tránh:
 *
 *   · Băm tên rồi lấy dư cho số làn. Đó là cách bản oval làm. Nó cho phân bố
 *     lệch — với 150 người và 23 làn thì có làn mười con, có làn ba con — và
 *     mục đích của cả việc chuyển sang đường thẳng là để đàn chó giãn ĐỀU ra.
 *
 *   · Lấy thẳng chỉ số con chó chia dư. Phân bố thì đều tuyệt đối, nhưng chó
 *     được đánh số THEO HẠNG CUỐI, nên người thắng sẽ luôn nằm ở làn 0. Sau
 *     dăm ba buổi lễ thì có người nhận ra, và cả cỗ máy công bằng đổ sông.
 *
 * Xáo trộn theo seed rồi chia vòng tròn thì vừa đều tuyệt đối, vừa không dính
 * dáng gì tới thứ hạng. Bộ sinh số ở đây là một xorshift hạng nhẹ, KHÔNG phải
 * cỗ máy công bằng: xếp làn là chuyện trình diễn thuần tuý, và giữ module này
 * không phụ thuộc gì ngoài Math là điều kiện để bộ kiểm tra trang cắt được nó
 * ra chạy riêng.
 */
export function assignLanes(n, seedText, lanes) {
  let h = 2166136261;
  for (let i = 0; i < seedText.length; i++) {
    h ^= seedText.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h >>>= 0;
  const rand = () => {
    h ^= h << 13; h >>>= 0;
    h ^= h >>> 17;
    h ^= h << 5; h >>>= 0;
    return h / 4294967296;
  };

  const idx = new Int32Array(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  for (let i = n - 1; i >= 1; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = idx[i]; idx[i] = idx[j]; idx[j] = t;
  }

  const out = new Float64Array(n);
  for (let p = 0; p < n; p++) out[idx[p]] = laneOffset(p % lanes, lanes);
  return out;
}
/* GEO-END — mốc cho tools/race/check-race-page.mjs, đừng xoá */
