using System;
using System.Globalization;

namespace OrderRace.Fairness
{
    /// <summary>
    /// xorshift128, số học 32-bit không dấu. Phải cho ra đúng cùng dòng số với
    /// makeRng() trong tools/fairness/fairness.mjs — đó là nguồn duy nhất của
    /// thuật toán, file này chỉ là bản sao chạy trong Unity.
    /// </summary>
    public struct Xorshift128
    {
        private uint _s0, _s1, _s2, _s3;

        public Xorshift128(string seedHex)
        {
            if (seedHex == null || seedHex.Length < 32)
            {
                throw new ArgumentException("Seed phải là chuỗi hex dài ít nhất 32 ký tự.", nameof(seedHex));
            }

            _s0 = ParseWord(seedHex, 0);
            _s1 = ParseWord(seedHex, 1);
            _s2 = ParseWord(seedHex, 2);
            _s3 = ParseWord(seedHex, 3);

            // Trạng thái toàn 0 khiến xorshift đứng im vĩnh viễn. SHA-256 gần như
            // không thể cho ra 128 bit 0, nhưng "gần như" vẫn phải xử lý — và phải
            // xử lý GIỐNG HỆT bản JS.
            if ((_s0 | _s1 | _s2 | _s3) == 0u)
            {
                _s0 = 0x9e3779b9u;
                _s1 = 0x243f6a88u;
                _s2 = 0xb7e15162u;
                _s3 = 0x85ebca6bu;
            }
        }

        private static uint ParseWord(string hex, int index)
        {
            return uint.Parse(hex.Substring(index * 8, 8), NumberStyles.HexNumber, CultureInfo.InvariantCulture);
        }

        public uint Next()
        {
            uint t = _s3;
            uint x = _s0;
            _s3 = _s2;
            _s2 = _s1;
            _s1 = x;
            t ^= t << 11;
            t ^= t >> 8;
            _s0 = t ^ x ^ (x >> 19);
            return _s0;
        }

        /// <summary>
        /// Số nguyên phân bố đều trong [0, n) bằng phép loại bỏ.
        /// Không dùng Next() % n: khi n không chia hết 2^32, modulo làm lệch phân
        /// phối về phía các chỉ số nhỏ.
        /// </summary>
        public int NextBelow(int n)
        {
            if (n <= 1)
            {
                return 0;
            }

            uint un = (uint)n;

            // limit BẮT BUỘC là ulong. Khi n chia hết 2^32 (n = 2, 4, 8...) thì
            // limit đúng bằng 2^32; ép về uint sẽ thành 0 và vòng lặp không bao
            // giờ thoát. Bản JS không dính lỗi này vì Number chứa được 2^32 —
            // đúng loại lệch âm thầm mà bộ đối chiếu sinh ra để bắt.
            ulong limit = 4294967296UL - (4294967296UL % un);

            uint r;
            do
            {
                r = Next();
            }
            while (r >= limit);

            return (int)(r % un);
        }
    }
}
