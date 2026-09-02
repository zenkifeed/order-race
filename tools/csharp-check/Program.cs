using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text;
using OrderRace.Fairness;
using OrderRace.Fairness.Testing;

namespace OrderRace.Fairness.Check
{
    /// <summary>
    /// Đối chiếu bản C# với bản JS qua file vector vàng.
    ///
    /// Đây là cửa hoàn thành của M0 (GDD §12): nếu lệnh này báo xanh thì hai bản
    /// cài đặt cho ra kết quả giống hệt nhau, và trang kiểm chứng mà khán giả
    /// chạy lại sau buổi lễ sẽ khớp với thứ hạng mà cuộc đua đã diễn.
    ///
    ///   dotnet run --project tools/csharp-check -- tests/vectors/fairness-vectors.tsv
    /// </summary>
    internal static class Program
    {
        private static int _failures;
        private static readonly List<string> FirstFailures = new List<string>();

        private static void Fail(string message)
        {
            _failures++;
            if (FirstFailures.Count < 10)
            {
                FirstFailures.Add(message);
            }
        }

        private static void Section(string title, int count, Stopwatch sw)
        {
            Console.WriteLine(
                "  {0,-34} {1,7} ca   {2,6} ms",
                title,
                count.ToString("N0"),
                sw.ElapsedMilliseconds.ToString("N0"));
        }

        private static int Main(string[] args)
        {
            Console.OutputEncoding = Encoding.UTF8;

            var path = args.Length > 0
                ? args[0]
                : Path.Combine("tests", "vectors", "fairness-vectors.tsv");

            if (!File.Exists(path))
            {
                Console.Error.WriteLine("Không tìm thấy file vector: " + Path.GetFullPath(path));
                Console.Error.WriteLine("Chạy trước: node tools/fairness/gen-vectors.mjs");
                return 2;
            }

            Console.WriteLine();
            Console.WriteLine("ĐỐI CHIẾU C# <-> JS   ·   " + Path.GetFullPath(path));
            Console.WriteLine();

            var vectors = VectorFile.Load(path);
            var sw = new Stopwatch();

            // ---- 1. Dòng chảy PRNG -----------------------------------------
            sw.Restart();
            foreach (var v in vectors.Prng)
            {
                var rng = new Xorshift128(v.SeedHex);
                for (var i = 0; i < v.Outputs.Length; i++)
                {
                    var got = rng.Next();
                    if (got != v.Outputs[i])
                    {
                        Fail($"PRNG seed {v.SeedHex.Substring(0, 12)} bước {i}: JS={v.Outputs[i]:x8} C#={got:x8}");
                        break;
                    }
                }
            }
            sw.Stop();
            Section("Dòng số của xorshift128", vectors.Prng.Count, sw);

            // ---- 2. Ca chi tiết --------------------------------------------
            sw.Restart();
            foreach (var v in vectors.Detail)
            {
                var r = FairDraw.Draw(v.Names, v.Prize);

                if (r.RosterHash != v.RosterHash)
                {
                    Fail($"DETAIL rosterHash lệch (n={v.Names.Length}): JS={v.RosterHash.Substring(0, 16)} C#={r.RosterHash.Substring(0, 16)}");
                    continue;
                }
                if (r.SeedHex != v.SeedHex)
                {
                    Fail($"DETAIL seedHex lệch (n={v.Names.Length}): JS={v.SeedHex.Substring(0, 16)} C#={r.SeedHex.Substring(0, 16)}");
                    continue;
                }
                if (r.FinalOrder.Count != v.Order.Length)
                {
                    Fail($"DETAIL số người lệch: JS={v.Order.Length} C#={r.FinalOrder.Count}");
                    continue;
                }
                for (var i = 0; i < v.Order.Length; i++)
                {
                    if (r.FinalOrder[i] != v.Order[i])
                    {
                        Fail($"DETAIL hạng {i + 1} lệch: JS=\"{v.Order[i]}\" C#=\"{r.FinalOrder[i]}\"");
                        break;
                    }
                }
            }
            sw.Stop();
            Section("Ca chi tiết (Unicode, biên, rác dán)", vectors.Detail.Count, sw);

            // ---- 3. Ca hàng loạt -------------------------------------------
            sw.Restart();
            foreach (var v in vectors.Bulk)
            {
                var roster = TestRoster.Make(v.Index, v.N);
                var r = FairDraw.Draw(roster, v.Prize);

                if (r.RosterHash != v.RosterHash)
                {
                    Fail($"BULK #{v.Index} (n={v.N}) rosterHash lệch");
                    continue;
                }
                if (r.SeedHex != v.SeedHex)
                {
                    Fail($"BULK #{v.Index} (n={v.N}) seedHex lệch");
                    continue;
                }

                var orderHash = FairDraw.Sha256Hex(string.Join("\n", r.FinalOrder));
                if (orderHash != v.OrderHash)
                {
                    Fail($"BULK #{v.Index} (n={v.N}) thứ hạng lệch: JS={v.OrderHash.Substring(0, 16)} C#={orderHash.Substring(0, 16)}");
                }
            }
            sw.Stop();
            Section("Ca hàng loạt (n = 2..150)", vectors.Bulk.Count, sw);

            // ---- 4. Bất biến của thư viện ----------------------------------
            sw.Restart();
            var invariants = 0;

            invariants++;
            if (vectors.Algorithm != FairDraw.Algorithm)
            {
                Fail($"Phiên bản thuật toán lệch: JS={vectors.Algorithm}, C#={FairDraw.Algorithm}.");
            }

            invariants++;
            if (vectors.MaxRoster != FairDraw.MaxRoster || vectors.MinRoster != FairDraw.MinRoster)
            {
                Fail($"Giới hạn danh sách lệch giữa hai bản: JS max={vectors.MaxRoster} min={vectors.MinRoster}, " +
                     $"C# max={FairDraw.MaxRoster} min={FairDraw.MinRoster}.");
            }

            foreach (var bad in new[]
                     {
                         new object[] { new[] { "Chỉ một người" }, "p" },
                         new object[] { TestRoster.Make(0, 151), "p" },
                         new object[] { new[] { "Lê A", " Lê  A " }, "p" },
                     })
            {
                invariants++;
                try
                {
                    FairDraw.Draw((string[])bad[0], (string)bad[1]);
                    Fail("Đầu vào sai lẽ ra phải bị chặn nhưng lại chạy lọt.");
                }
                catch (ArgumentException)
                {
                    // đúng như mong đợi
                }
            }

            // Cùng đầu vào, hai lần gọi, phải ra cùng kết quả.
            var a = FairDraw.Draw(TestRoster.Make(42, 150), "Giải");
            var b = FairDraw.Draw(TestRoster.Make(42, 150), "Giải");
            invariants++;
            if (a.SeedHex != b.SeedHex || string.Join("|", a.FinalOrder) != string.Join("|", b.FinalOrder))
            {
                Fail("Gọi hai lần cùng đầu vào cho ra hai kết quả khác nhau.");
            }

            // Thứ hạng phải là một hoán vị đầy đủ, không mất ai, không nhân bản ai.
            invariants++;
            var seen = new HashSet<string>(a.FinalOrder);
            if (seen.Count != 150 || a.FinalOrder.Count != 150)
            {
                Fail("Thứ hạng không phải hoán vị đầy đủ của danh sách.");
            }

            sw.Stop();
            Section("Bất biến của thư viện", invariants, sw);

            // ---- Kết luận ---------------------------------------------------
            var total = vectors.Prng.Count + vectors.Detail.Count + vectors.Bulk.Count + invariants;
            Console.WriteLine();

            if (_failures == 0)
            {
                Console.WriteLine($"ĐẠT — {total:N0} phép đối chiếu, không có sai lệch nào.");
                Console.WriteLine("Cửa hoàn thành M0 (GDD §12): C# và JS cho ra kết quả giống hệt nhau.");
                Console.WriteLine();
                return 0;
            }

            Console.WriteLine($"KHÔNG ĐẠT — {_failures:N0}/{total:N0} phép đối chiếu sai lệch.");
            Console.WriteLine();
            foreach (var f in FirstFailures)
            {
                Console.WriteLine("  · " + f);
            }
            if (_failures > FirstFailures.Count)
            {
                Console.WriteLine($"  … và {_failures - FirstFailures.Count:N0} sai lệch khác.");
            }
            Console.WriteLine();
            return 1;
        }
    }
}
