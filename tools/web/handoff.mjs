// Chuyển thiết lập giữa các trang — Order Race
//
// Quản trò nhập danh sách MỘT LẦN ở trang chọn game, rồi trang minigame nhận
// lại. Không bắt dán lại danh sách 150 người mỗi lần đổi trò.
//
// Dùng phần băm của URL (#…) chứ không phải tham số truy vấn hay localStorage:
//   · phần băm không gửi lên máy chủ — danh sách nhân sự không rời khỏi máy
//   · chạy y hệt nhau khi mở bằng file:// và khi phục vụ qua web server,
//     còn localStorage với file:// thì mỗi trình duyệt xử lý một kiểu
//   · sao chép được: dán URL cho người khác là họ có nguyên thiết lập
//
// KHÔNG tự chạy luôn khi trang minigame mở ra. Trình duyệt chỉ cho phát âm
// thanh sau một cú chạm của người dùng, mà cú chạm ở trang trước không tính
// sang trang sau. Tự chạy sẽ cho ra một lượt đua câm. Thay vào đó trang đích
// điền sẵn mọi thứ rồi đặt con trỏ vào nút bắt đầu — quản trò bấm một lần nữa.

const VERSION = 1;

/** Đóng gói thiết lập thành phần băm của URL. */
export function encodeHandoff(settings) {
  const payload = {
    v: VERSION,
    n: settings.count ?? 0,
    k: settings.topK ?? 3,
    p: settings.prize ?? "",
    r: settings.roster ?? "",
  };
  return "#s=" + encodeURIComponent(JSON.stringify(payload));
}

/**
 * Đọc lại thiết lập từ một phần băm. Trả về null nếu không có hoặc hỏng —
 * hỏng thì trang đích cứ chạy như bình thường, không bao giờ được văng lỗi.
 */
export function decodeHandoff(hash) {
  if (!hash) return null;
  const raw = String(hash).replace(/^#/, "");
  if (!raw.startsWith("s=")) return null;
  try {
    const obj = JSON.parse(decodeURIComponent(raw.slice(2)));
    if (!obj || obj.v !== VERSION) return null;
    return {
      count: Number(obj.n) || 0,
      topK: Number(obj.k) || 3,
      prize: typeof obj.p === "string" ? obj.p : "",
      roster: typeof obj.r === "string" ? obj.r : "",
    };
  } catch {
    return null;
  }
}

/**
 * Điền thiết lập nhận được vào form của trang minigame.
 * Trả về true nếu có thiết lập để điền.
 */
export function applyHandoff(hash, fields) {
  const s = decodeHandoff(hash);
  if (!s) return false;
  if (fields.roster && s.roster) fields.roster.value = s.roster;
  if (fields.count && s.count > 0 && !s.roster) fields.count.value = s.count;
  if (fields.topK) fields.topK.value = s.topK;
  if (fields.prize && s.prize) fields.prize.value = s.prize;
  return true;
}
