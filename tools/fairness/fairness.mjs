// Cỗ máy công bằng — Order Race / M0
//
// Đây là NGUỒN DUY NHẤT của thuật toán. Bản C# trong Assets/Scripts/Fairness
// phải cho ra kết quả giống hệt file này trên mọi đầu vào; bộ đối chiếu ở
// tools/csharp-check kiểm tra điều đó bằng vector vàng do file này sinh ra.
//
// Không có gì trong file này được phép biết tới đồ hoạ, Unity, hay lớp đạo diễn.

import { sha256Bytes, toHex, utf8 } from "./sha256.mjs";

export const ALGORITHM = "order-race/fairness/v2";
export const MAX_ROSTER = 150; // trần cứng, chốt 02.09.2026 — xem GDD §2
export const MIN_ROSTER = 2;

/**
 * Chuẩn hoá một cái tên. Đây là hàm nhạy cảm nhất của toàn bộ M0.
 *
 * Ba việc, theo đúng thứ tự:
 *   1. NFC — tên tiếng Việt dán từ Google Sheets, Excel và macOS có thể mang
 *      cùng một chữ ở hai dạng byte khác nhau ("ế" = U+1EBF, hoặc "e" + hai dấu
 *      tổ hợp). Không chuẩn hoá thì hai người gõ cùng một tên cho ra hai mã băm.
 *   2. Gộp mọi cụm khoảng trắng thành đúng một dấu cách. Dán từ Excel rất hay
 *      lẫn tab, khoảng trắng cứng (U+00A0) và BOM (U+FEFF) vào giữa tên.
 *   3. Cắt hai đầu.
 *
 * KHÔNG dùng String.trim() của JS hay string.Trim() của C#: hai hàm đó cắt hai
 * tập ký tự KHÁC NHAU — JS cắt U+FEFF, C# thì không. Đúng loại lệch âm thầm mà
 * bộ đối chiếu sinh ra để bắt. Vì vậy tập ký tự dưới đây được liệt kê tường minh.
 */
const TRIMMABLE = new Set([
  0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x20, 0x85, 0xa0, 0x1680,
  0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008,
  0x2009, 0x200a, 0x200b, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff,
]);

export function isTrimmable(codeUnit) {
  return TRIMMABLE.has(codeUnit);
}

export function normalizeName(value) {
  const s = String(value == null ? "" : value).normalize("NFC");
  let out = "";
  let pendingSpace = false;
  for (let i = 0; i < s.length; i++) {
    if (isTrimmable(s.charCodeAt(i))) {
      if (out.length > 0) pendingSpace = true;
      continue;
    }
    if (pendingSpace) { out += " "; pendingSpace = false; }
    out += s[i];
  }
  return out;
}

/** Giữ lại tên cũ cho dễ đọc; NFC là bước đầu của normalizeName. */
export function nfc(s) {
  return String(s == null ? "" : s).normalize("NFC");
}

/** Chuẩn hoá từng dòng, bỏ dòng rỗng. */
export function prepareRoster(lines) {
  const out = [];
  for (const line of lines) {
    const t = normalizeName(line);
    if (t.length > 0) out.push(t);
  }
  return out;
}

/**
 * So sánh theo byte UTF-8, KHÔNG theo locale.
 *
 * So sánh theo locale tiếng Việt cho thứ tự khác nhau giữa hai môi trường và
 * giữa hai phiên bản ICU — đó là một trong ba cái bẫy đã ghi ở GDD §4.
 * So byte thì chỉ có đúng một câu trả lời, ở mọi nơi, mãi mãi.
 */
export function compareUtf8(a, b) {
  const ba = utf8(a);
  const bb = utf8(b);
  const n = Math.min(ba.length, bb.length);
  for (let i = 0; i < n; i++) {
    if (ba[i] !== bb[i]) return ba[i] - bb[i];
  }
  return ba.length - bb.length;
}

export function sortRoster(names) {
  return [...names].sort(compareUtf8);
}

/** Trả về danh sách tên xuất hiện nhiều hơn một lần (đầu vào đã sắp xếp). */
export function findDuplicates(sorted) {
  const dups = [];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] && dups[dups.length - 1] !== sorted[i]) {
      dups.push(sorted[i]);
    }
  }
  return dups;
}

export function rosterHash(sortedNames) {
  return toHex(sha256Bytes(utf8(sortedNames.join("\n"))));
}

/**
 * Seed chỉ phụ thuộc danh sách và tên giải.
 *
 * GHI CHÚ QUAN TRỌNG: cả hai đầu vào đều biết trước buổi lễ, nên kết quả tính
 * trước được. Đây là lựa chọn có ý thức (xem GDD §4) chứ không phải thiếu sót —
 * phiên bản v1 từng có thêm một chuỗi do khán giả đọc tại chỗ để chặn điều đó.
 *
 * Hệ quả trực tiếp: cùng danh sách + cùng tên giải LUÔN cho cùng người thắng.
 * Mỗi lượt quay trong một buổi phải mang tên giải khác nhau, nếu không lượt sau
 * sẽ lặp lại y hệt lượt trước.
 */
export function seedHex(rosterHashHex, prizeLabel) {
  const payload = rosterHashHex + "|" + normalizeName(prizeLabel);
  return toHex(sha256Bytes(utf8(payload)));
}

/**
 * xorshift128, số học 32-bit không dấu.
 *
 * Trạng thái lấy từ 4 word đầu của seed (big-endian). Trạng thái toàn 0 sẽ khiến
 * xorshift đứng im mãi mãi; xác suất SHA-256 cho ra 128 bit 0 là không đáng kể
 * nhưng vẫn phải xử lý, và phải xử lý GIỐNG NHAU ở cả hai ngôn ngữ.
 */
export function makeRng(seedHexStr) {
  const s = new Uint32Array(4);
  for (let i = 0; i < 4; i++) {
    s[i] = parseInt(seedHexStr.slice(i * 8, i * 8 + 8), 16) >>> 0;
  }
  if ((s[0] | s[1] | s[2] | s[3]) === 0) {
    s[0] = 0x9e3779b9; s[1] = 0x243f6a88; s[2] = 0xb7e15162; s[3] = 0x85ebca6b;
  }
  return {
    next() {
      let t = s[3];
      const x = s[0];
      s[3] = s[2];
      s[2] = s[1];
      s[1] = x;
      t = (t ^ (t << 11)) >>> 0;
      t = (t ^ (t >>> 8)) >>> 0;
      s[0] = (t ^ x ^ (x >>> 19)) >>> 0;
      return s[0];
    },
  };
}

/**
 * Số nguyên đều trong [0, n) bằng phép loại bỏ.
 *
 * KHÔNG dùng next() % n: khi n không chia hết 2^32, modulo làm lệch phân phối về
 * phía các chỉ số nhỏ. Với 150 người thì độ lệch cực nhỏ, nhưng "cực nhỏ" không
 * phải là thứ nên nói trong một buổi trao thưởng.
 */
export function uniformBelow(rng, n) {
  if (n <= 1) return 0;
  const limit = 4294967296 - (4294967296 % n);
  let r;
  do {
    r = rng.next();
  } while (r >= limit);
  return r % n;
}

/** Fisher–Yates duyệt ngược. Sửa mảng tại chỗ và trả về chính nó. */
export function shuffleInPlace(arr, rng) {
  for (let i = arr.length - 1; i >= 1; i--) {
    const j = uniformBelow(rng, i + 1);
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

/**
 * Bốc thăm đầy đủ. Đây là hàm duy nhất mà phần còn lại của game được gọi.
 * finalOrder[0] là hạng 1.
 */
export function draw(lines, prizeLabel) {
  const names = prepareRoster(lines);
  if (names.length < MIN_ROSTER) {
    throw new Error(`Danh sách cần ít nhất ${MIN_ROSTER} người, đang có ${names.length}.`);
  }
  if (names.length > MAX_ROSTER) {
    throw new Error(`Danh sách tối đa ${MAX_ROSTER} người, đang có ${names.length}. Hãy chia thành nhiều lượt.`);
  }
  const sorted = sortRoster(names);
  const dups = findDuplicates(sorted);
  if (dups.length > 0) {
    throw new Error(
      `Trùng tên: ${dups.join(", ")}. Hãy phân biệt (thêm phòng ban) trước khi khoá danh sách.`
    );
  }
  const rh = rosterHash(sorted);
  const sh = seedHex(rh, prizeLabel);
  const order = shuffleInPlace([...sorted], makeRng(sh));
  return {
    algorithm: ALGORITHM,
    rosterHash: rh,
    prizeLabel: normalizeName(prizeLabel),
    seedHex: sh,
    roster: sorted,
    finalOrder: order,
  };
}

/** Bộ sinh danh sách giả CHỈ DÙNG CHO KIỂM THỬ — bản C# phải sao y hàm này. */
export const TEST_SUFFIX = [
  "An", "Bình", "Cường", "Dũng", "Hà", "Hương", "Khánh", "Linh",
  "Minh", "Ngọc", "Phúc", "Quân", "Sơn", "Thảo", "Tuấn", "Vy",
];

export function makeTestRoster(caseIndex, n) {
  const out = new Array(n);
  for (let k = 0; k < n; k++) {
    const suffix = TEST_SUFFIX[(caseIndex * 31 + k * 17) % TEST_SUFFIX.length];
    out[k] = `NV${String(caseIndex).padStart(5, "0")}-${k} ${suffix}`;
  }
  return out;
}
