namespace OrderRace.Fairness.Testing
{
    /// <summary>
    /// Bộ sinh danh sách giả, CHỈ DÙNG CHO KIỂM THỬ.
    ///
    /// Phải sao y makeTestRoster() trong tools/fairness/fairness.mjs. Nhờ nó mà
    /// file vector vàng không cần chứa 10 000 danh sách đầy đủ — chỉ cần chỉ số
    /// ca và số người, hai bên tự dựng lại cùng một danh sách.
    /// </summary>
    public static class TestRoster
    {
        public static readonly string[] Suffix =
        {
            "An", "Bình", "Cường", "Dũng", "Hà", "Hương", "Khánh", "Linh",
            "Minh", "Ngọc", "Phúc", "Quân", "Sơn", "Thảo", "Tuấn", "Vy",
        };

        public static string[] Make(int caseIndex, int n)
        {
            var result = new string[n];
            for (var k = 0; k < n; k++)
            {
                var suffix = Suffix[(caseIndex * 31 + k * 17) % Suffix.Length];
                result[k] = "NV" + caseIndex.ToString("D5") + "-" + k + " " + suffix;
            }
            return result;
        }
    }
}
