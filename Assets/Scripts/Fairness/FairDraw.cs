using System;
using System.Collections.Generic;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace OrderRace.Fairness
{
    /// <summary>
    /// Cỗ máy công bằng của Order Race.
    ///
    /// Bản sao C# của tools/fairness/fairness.mjs. File .mjs là nguồn duy nhất
    /// của thuật toán; file này phải cho ra kết quả giống hệt trên mọi đầu vào,
    /// và tools/csharp-check kiểm tra điều đó trên hơn 10 000 ca.
    ///
    /// KHÔNG được tham chiếu UnityEngine ở đây. Lớp này phải biên dịch và chạy
    /// được ngoài Unity, nếu không thì không đối chiếu được với JS.
    /// </summary>
    public static class FairDraw
    {
        public const string Algorithm = "order-race/fairness/v2";

        /// <summary>Trần cứng, chốt 02.09.2026 — xem GDD §2.</summary>
        public const int MaxRoster = 150;

        public const int MinRoster = 2;

        private static readonly UTF8Encoding Utf8 = new UTF8Encoding(false);

        // Tập ký tự khoảng trắng được liệt kê TƯỜNG MINH.
        //
        // Không dùng string.Trim() của C# hay String.trim() của JS: hai hàm đó cắt
        // hai tập ký tự KHÁC NHAU — JS cắt U+FEFF (BOM), C# thì không. BOM lọt vào
        // rất thường xuyên khi dán từ file, và khi đó hai bên sẽ cho ra hai mã băm
        // khác nhau mà không ai hiểu vì sao.
        private static readonly HashSet<int> Trimmable = new HashSet<int>
        {
            0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x20, 0x85, 0xa0, 0x1680,
            0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008,
            0x2009, 0x200a, 0x200b, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff,
        };

        public static bool IsTrimmable(char c)
        {
            return Trimmable.Contains(c);
        }

        /// <summary>
        /// Chuẩn hoá một cái tên: NFC, gộp mọi cụm khoảng trắng thành đúng một dấu
        /// cách, cắt hai đầu. Xem chú thích dài trong fairness.mjs.
        /// </summary>
        public static string NormalizeName(string value)
        {
            var s = (value ?? string.Empty).Normalize(NormalizationForm.FormC);
            var sb = new StringBuilder(s.Length);
            var pendingSpace = false;

            for (var i = 0; i < s.Length; i++)
            {
                if (IsTrimmable(s[i]))
                {
                    if (sb.Length > 0)
                    {
                        pendingSpace = true;
                    }
                    continue;
                }

                if (pendingSpace)
                {
                    sb.Append(' ');
                    pendingSpace = false;
                }
                sb.Append(s[i]);
            }

            return sb.ToString();
        }

        public static List<string> PrepareRoster(IEnumerable<string> lines)
        {
            var result = new List<string>();
            foreach (var line in lines)
            {
                var t = NormalizeName(line);
                if (t.Length > 0)
                {
                    result.Add(t);
                }
            }
            return result;
        }

        /// <summary>
        /// So sánh theo byte UTF-8, KHÔNG theo locale. So sánh theo locale tiếng
        /// Việt cho thứ tự khác nhau giữa hai môi trường và giữa hai phiên bản
        /// ICU. So byte thì chỉ có đúng một câu trả lời, ở mọi nơi.
        /// </summary>
        public static int CompareUtf8(string a, string b)
        {
            var ba = Utf8.GetBytes(a);
            var bb = Utf8.GetBytes(b);
            var n = ba.Length < bb.Length ? ba.Length : bb.Length;
            for (var i = 0; i < n; i++)
            {
                if (ba[i] != bb[i])
                {
                    return ba[i] - bb[i];
                }
            }
            return ba.Length - bb.Length;
        }

        public static List<string> SortRoster(IEnumerable<string> names)
        {
            var list = new List<string>(names);
            list.Sort(CompareUtf8);
            return list;
        }

        /// <summary>Tên xuất hiện nhiều hơn một lần. Đầu vào phải đã sắp xếp.</summary>
        public static List<string> FindDuplicates(IReadOnlyList<string> sorted)
        {
            var dups = new List<string>();
            for (var i = 1; i < sorted.Count; i++)
            {
                if (sorted[i] == sorted[i - 1] && (dups.Count == 0 || dups[dups.Count - 1] != sorted[i]))
                {
                    dups.Add(sorted[i]);
                }
            }
            return dups;
        }

        public static string Sha256Hex(string value)
        {
            using (var sha = SHA256.Create())
            {
                var hash = sha.ComputeHash(Utf8.GetBytes(value));
                var sb = new StringBuilder(64);
                for (var i = 0; i < hash.Length; i++)
                {
                    sb.Append(hash[i].ToString("x2", CultureInfo.InvariantCulture));
                }
                return sb.ToString();
            }
        }

        public static string RosterHash(IReadOnlyList<string> sortedNames)
        {
            return Sha256Hex(string.Join("\n", sortedNames));
        }

        /// <summary>
        /// Seed chỉ phụ thuộc danh sách và tên giải.
        ///
        /// GHI CHÚ QUAN TRỌNG: cả hai đầu vào đều biết trước buổi lễ, nên kết quả
        /// tính trước được. Đây là lựa chọn có ý thức (xem GDD §4), không phải
        /// thiếu sót — v1 từng có thêm một chuỗi do khán giả đọc tại chỗ.
        ///
        /// Hệ quả trực tiếp: cùng danh sách + cùng tên giải LUÔN cho cùng người
        /// thắng. Mỗi lượt quay trong một buổi phải mang tên giải khác nhau.
        /// </summary>
        public static string SeedHex(string rosterHashHex, string prizeLabel)
        {
            var payload = rosterHashHex + "|" + NormalizeName(prizeLabel);
            return Sha256Hex(payload);
        }

        /// <summary>Fisher-Yates duyệt ngược. Sửa danh sách tại chỗ.</summary>
        public static void ShuffleInPlace(IList<string> items, ref Xorshift128 rng)
        {
            for (var i = items.Count - 1; i >= 1; i--)
            {
                var j = rng.NextBelow(i + 1);
                var t = items[i];
                items[i] = items[j];
                items[j] = t;
            }
        }

        /// <summary>
        /// Bốc thăm đầy đủ. Đây là hàm duy nhất mà phần còn lại của game được gọi.
        /// </summary>
        public static DrawResult Draw(IEnumerable<string> lines, string prizeLabel)
        {
            var names = PrepareRoster(lines);

            if (names.Count < MinRoster)
            {
                throw new ArgumentException(
                    "Danh sách cần ít nhất " + MinRoster + " người, đang có " + names.Count + ".");
            }
            if (names.Count > MaxRoster)
            {
                throw new ArgumentException(
                    "Danh sách tối đa " + MaxRoster + " người, đang có " + names.Count +
                    ". Hãy chia thành nhiều lượt.");
            }

            var sorted = SortRoster(names);
            var dups = FindDuplicates(sorted);
            if (dups.Count > 0)
            {
                throw new ArgumentException(
                    "Trùng tên: " + string.Join(", ", dups) +
                    ". Hãy phân biệt (thêm phòng ban) trước khi khoá danh sách.");
            }

            var rosterHash = RosterHash(sorted);
            var seedHex = SeedHex(rosterHash, prizeLabel);

            var order = new List<string>(sorted);
            var rng = new Xorshift128(seedHex);
            ShuffleInPlace(order, ref rng);

            return new DrawResult
            {
                Algorithm = Algorithm,
                RosterHash = rosterHash,
                PrizeLabel = NormalizeName(prizeLabel),
                SeedHex = seedHex,
                Roster = sorted,
                FinalOrder = order,
            };
        }
    }
}
