using System;
using System.Collections.Generic;
using System.IO;
using NUnit.Framework;
using UnityEngine;

namespace OrderRace.Fairness.Testing
{
    /// <summary>
    /// Cùng bộ đối chiếu mà tools/csharp-check chạy, nhưng chạy bên trong Unity.
    ///
    /// Cần cả hai: bản console bắt lỗi sớm và chạy được trong CI mà không cần cài
    /// Unity; bản này bảo đảm mã vẫn đúng sau khi qua trình biên dịch của Unity và
    /// các thiết lập runtime của nó — nhất là phần chuẩn hoá Unicode, thứ phụ
    /// thuộc vào ICU mà Unity đóng gói riêng.
    /// </summary>
    public sealed class FairnessVectorTests
    {
        private static VectorFile _vectors;

        private static string VectorPath =>
            Path.GetFullPath(Path.Combine(Application.dataPath, "..", "tests", "vectors", "fairness-vectors.tsv"));

        [OneTimeSetUp]
        public void LoadVectors()
        {
            if (!File.Exists(VectorPath))
            {
                Assert.Ignore(
                    "Chưa có file vector: " + VectorPath +
                    "\nSinh bằng: node tools/fairness/gen-vectors.mjs");
            }
            _vectors = VectorFile.Load(VectorPath);
        }

        [Test]
        public void PhienBanThuatToanKhopVoiBanJs()
        {
            Assert.AreEqual(_vectors.Algorithm, FairDraw.Algorithm,
                "Phiên bản thuật toán lệch giữa JS và C#. Chạy lại: npm run vectors");
        }

        [Test]
        public void GioiHanDanhSachKhopVoiBanJs()
        {
            Assert.AreEqual(_vectors.MaxRoster, FairDraw.MaxRoster, "Trần danh sách lệch giữa JS và C#.");
            Assert.AreEqual(_vectors.MinRoster, FairDraw.MinRoster, "Sàn danh sách lệch giữa JS và C#.");
        }

        [Test]
        public void DongSoXorshiftKhopVoiBanJs()
        {
            foreach (var v in _vectors.Prng)
            {
                var rng = new Xorshift128(v.SeedHex);
                for (var i = 0; i < v.Outputs.Length; i++)
                {
                    Assert.AreEqual(v.Outputs[i], rng.Next(),
                        $"Lệch ở seed {v.SeedHex.Substring(0, 12)} bước {i}.");
                }
            }
        }

        [Test]
        public void CaChiTietKhopVoiBanJs()
        {
            foreach (var v in _vectors.Detail)
            {
                var r = FairDraw.Draw(v.Names, v.Prize);
                Assert.AreEqual(v.RosterHash, r.RosterHash, $"rosterHash lệch (n={v.Names.Length}).");
                Assert.AreEqual(v.SeedHex, r.SeedHex, $"seedHex lệch (n={v.Names.Length}).");
                CollectionAssert.AreEqual(v.Order, r.FinalOrder, $"Thứ hạng lệch (n={v.Names.Length}).");
            }
        }

        [Test]
        public void CaHangLoatKhopVoiBanJs()
        {
            foreach (var v in _vectors.Bulk)
            {
                var r = FairDraw.Draw(TestRoster.Make(v.Index, v.N), v.Prize);
                Assert.AreEqual(v.RosterHash, r.RosterHash, $"BULK #{v.Index} (n={v.N}) rosterHash lệch.");
                Assert.AreEqual(v.SeedHex, r.SeedHex, $"BULK #{v.Index} (n={v.N}) seedHex lệch.");

                var orderHash = FairDraw.Sha256Hex(string.Join("\n", r.FinalOrder));
                Assert.AreEqual(v.OrderHash, orderHash, $"BULK #{v.Index} (n={v.N}) thứ hạng lệch.");
            }
        }

        [Test]
        public void CungDauVaoChoCungKetQua()
        {
            var a = FairDraw.Draw(TestRoster.Make(42, 150), "Giải");
            var b = FairDraw.Draw(TestRoster.Make(42, 150), "Giải");
            Assert.AreEqual(a.SeedHex, b.SeedHex);
            CollectionAssert.AreEqual(a.FinalOrder, b.FinalOrder);
        }

        [Test]
        public void ThuHangLaHoanViDayDu()
        {
            var r = FairDraw.Draw(TestRoster.Make(7, 150), "Giải");
            Assert.AreEqual(150, r.FinalOrder.Count);
            Assert.AreEqual(150, new HashSet<string>(r.FinalOrder).Count, "Có tên bị nhân bản hoặc biến mất.");
            CollectionAssert.AreEquivalent(r.Roster, r.FinalOrder);
        }

        [Test]
        public void ChanDanhSachQuaNgan()
        {
            Assert.Throws<ArgumentException>(() => FairDraw.Draw(new[] { "Chỉ một người" }, "p"));
        }

        [Test]
        public void ChanDanhSachVuotTran()
        {
            Assert.Throws<ArgumentException>(() => FairDraw.Draw(TestRoster.Make(0, 151), "p"));
        }

        [Test]
        public void ChanTrungTen()
        {
            // Hai dòng này là cùng một cái tên sau khi chuẩn hoá khoảng trắng.
            Assert.Throws<ArgumentException>(() => FairDraw.Draw(new[] { "Lê A", " Lê  A " }, "p"));
        }

        [Test]
        public void RacDanTuExcelKhongDoiKetQua()
        {
            var sach = FairDraw.Draw(new[] { "Lê A", "Trần B", "Vũ C" }, "p");
            var ban = FairDraw.Draw(new[] { "﻿ Lê  A ", "Trần B", "  Vũ\tC" }, " p ");
            Assert.AreEqual(sach.SeedHex, ban.SeedHex, "BOM, khoảng trắng cứng hoặc tab đã làm đổi kết quả.");
            CollectionAssert.AreEqual(sach.FinalOrder, ban.FinalOrder);
        }
    }
}
