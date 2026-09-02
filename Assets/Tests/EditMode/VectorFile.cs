using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;

namespace OrderRace.Fairness.Testing
{
    public sealed class PrngVector
    {
        public string SeedHex;
        public uint[] Outputs;
    }

    public sealed class DetailVector
    {
        public string Prize;
        public string RosterHash;
        public string SeedHex;
        public string[] Names;
        public string[] Order;
    }

    public sealed class BulkVector
    {
        public int Index;
        public int N;
        public string Prize;
        public string RosterHash;
        public string SeedHex;
        public string OrderHash;
    }

    /// <summary>
    /// Đọc file vector vàng do tools/fairness/gen-vectors.mjs sinh ra.
    ///
    /// Định dạng TSV chứ không phải JSON để lớp kiểm thử chạy được trong Unity mà
    /// không kéo theo thư viện JSON nào. Xem chú thích đầu file gen-vectors.mjs.
    /// </summary>
    public sealed class VectorFile
    {
        private const char UnitSeparator = '\u001f';

        /// <summary>Giới hạn do bản JS công bố. Dùng để bắt lệch hằng số giữa hai bên.</summary>
        public string Algorithm;
        public int MaxRoster = -1;
        public int MinRoster = -1;

        public readonly List<PrngVector> Prng = new List<PrngVector>();
        public readonly List<DetailVector> Detail = new List<DetailVector>();
        public readonly List<BulkVector> Bulk = new List<BulkVector>();

        /// <summary>Nghịch đảo của esc() trong gen-vectors.mjs.</summary>
        public static string Unescape(string value)
        {
            if (value.IndexOf('\\') < 0)
            {
                return value;
            }

            var sb = new StringBuilder(value.Length);
            for (var i = 0; i < value.Length; i++)
            {
                if (value[i] != '\\' || i + 1 >= value.Length)
                {
                    sb.Append(value[i]);
                    continue;
                }

                i++;
                switch (value[i])
                {
                    case 't': sb.Append('\t'); break;
                    case 'n': sb.Append('\n'); break;
                    case 'r': sb.Append('\r'); break;
                    case '\\': sb.Append('\\'); break;
                    default:
                        throw new FormatException("Chuỗi thoát không hợp lệ: \\" + value[i]);
                }
            }
            return sb.ToString();
        }

        private static string[] SplitNames(string field)
        {
            var raw = field.Split(UnitSeparator);
            var result = new string[raw.Length];
            for (var i = 0; i < raw.Length; i++)
            {
                result[i] = Unescape(raw[i]);
            }
            return result;
        }

        public static VectorFile Load(string path)
        {
            var file = new VectorFile();

            foreach (var line in File.ReadAllLines(path, Encoding.UTF8))
            {
                if (line.Length == 0 || line[0] == '#')
                {
                    if (line.StartsWith("#ALGO"))
                    {
                        file.Algorithm = line.Split('	')[1];
                    }
                    else if (line.StartsWith("#LIMITS"))
                    {
                        foreach (var part in line.Split('	'))
                        {
                            if (part.StartsWith("maxRoster="))
                                file.MaxRoster = int.Parse(part.Substring(10), CultureInfo.InvariantCulture);
                            else if (part.StartsWith("minRoster="))
                                file.MinRoster = int.Parse(part.Substring(10), CultureInfo.InvariantCulture);
                        }
                    }
                    continue;
                }

                var f = line.Split('\t');
                switch (f[0])
                {
                    case "PRNG":
                    {
                        var parts = f[2].Split(',');
                        var outputs = new uint[parts.Length];
                        for (var i = 0; i < parts.Length; i++)
                        {
                            outputs[i] = uint.Parse(parts[i], NumberStyles.HexNumber, CultureInfo.InvariantCulture);
                        }
                        file.Prng.Add(new PrngVector { SeedHex = f[1], Outputs = outputs });
                        break;
                    }

                    case "DETAIL":
                        file.Detail.Add(new DetailVector
                        {
                            Prize = Unescape(f[1]),
                            RosterHash = f[2],
                            SeedHex = f[3],
                            Names = SplitNames(f[4]),
                            Order = SplitNames(f[5]),
                        });
                        break;

                    case "BULK":
                        file.Bulk.Add(new BulkVector
                        {
                            Index = int.Parse(f[1], CultureInfo.InvariantCulture),
                            N = int.Parse(f[2], CultureInfo.InvariantCulture),
                            Prize = Unescape(f[3]),
                            RosterHash = f[4],
                            SeedHex = f[5],
                            OrderHash = f[6],
                        });
                        break;

                    default:
                        throw new FormatException("Loại dòng lạ trong file vector: " + f[0]);
                }
            }

            return file;
        }
    }
}
