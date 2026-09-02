using System.Collections.Generic;

namespace OrderRace.Fairness
{
    /// <summary>
    /// Kết quả một lượt bốc thăm. FinalOrder[0] là hạng 1.
    /// Lớp đạo diễn nhận đối tượng này ở dạng CHỈ ĐỌC và không bao giờ được sửa —
    /// xem GDD §4, kiến trúc hai lớp một chiều.
    /// </summary>
    public sealed class DrawResult
    {
        public string Algorithm;
        public string RosterHash;
        public string PrizeLabel;
        public string SeedHex;

        /// <summary>Danh sách đã chuẩn hoá và sắp xếp theo byte UTF-8.</summary>
        public IReadOnlyList<string> Roster;

        /// <summary>Thứ hạng cuối cùng. Chỉ số 0 là hạng 1.</summary>
        public IReadOnlyList<string> FinalOrder;

        public IReadOnlyList<string> Winners(int topK)
        {
            var count = topK < 0 ? 0 : (topK > FinalOrder.Count ? FinalOrder.Count : topK);
            var list = new List<string>(count);
            for (var i = 0; i < count; i++)
            {
                list.Add(FinalOrder[i]);
            }
            return list;
        }
    }
}
