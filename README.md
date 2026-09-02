# Order Race

Minigame quay thưởng dạng đua chó chibi 3D cho các buổi trao thưởng nội bộ.
Tài liệu thiết kế đầy đủ: [`docs/GDD.html`](docs/GDD.html).

**Trạng thái: M0 đạt. M1 đạt cửa kịch tính.** Cỗ máy công bằng, trang kiểm chứng,
lớp đạo diễn 5 nhịp và một bản đua chạy được trên trình duyệt đều đã xong. Còn
lại của M1 là cửa hiệu năng, thứ bắt buộc phải có Unity project.

Hai minigame, dùng chung một cỗ máy công bằng:

| Trang | Minigame | Thể thức |
|---|---|---|
| `web/index.html` | **Chọn trò chơi** | Điểm vào: bấm một thẻ là vào thẳng trò chơi |
| `web/race.html` | **Đường đua** | Một cuộc đua 40 giây, top-K về đích đầu tiên |
| `web/redlight.html` | **SquidGame** | Loại dần qua từng vòng, K người sống sót cuối cùng |
| `web/verify.html` | Kiểm chứng | Khán giả tự tính lại kết quả sau buổi lễ |

> Mở bằng trình duyệt là chạy. Cả hai minigame đều có nút phân tích chạy ngay
> trong trang, chấm điểm kịch tính trên chính danh sách bạn nhập.
>
> Muốn có nhạc nền: thả file vào `music/` rồi chạy `npm run build:web`.
> Chi tiết ở [`music/README.md`](music/README.md).

---

## Chạy toàn bộ kiểm thử

```bash
npm run m1     # gồm cả m0
```

Một lệnh chạy hết chuỗi: tự kiểm JS → sinh vector vàng → dựng trang kiểm chứng →
kiểm tra trang → đối chiếu C# với JS. Cần `node` và `dotnet`, **không cần Unity**.

| Lệnh | Việc |
|---|---|
| `npm run selftest` | Chứng minh thuật toán công bằng: phân bố đều, không thiên lệch |
| `npm run vectors` | Sinh `tests/vectors/fairness-vectors.tsv` từ bản JS |
| `npm run build:web` | Dựng `web/verify.html` và `web/race.html` từ các file `.mjs` |
| `npm run check:verify` | Kiểm tra trang dựng ra khớp thư viện và tự chứa |
| `npm run check:csharp` | Đối chiếu 10 220 phép tính giữa C# và JS |
| `npm run drama` | Cửa kịch tính đường đua: 200 cuộc đua, 10 ràng buộc |
| `npm run drama:redlight` | Cửa kịch tính trọng tài: 200 lượt, 16 ràng buộc |
| `npm run feel` | Lớp cảm giác: hệ số thời gian liền mạch, không nhảy bậc |
| `npm run check:race` | Kiểm tra trang đua dựng ra: cú pháp, id, hình học |
| `npm run check:redlight` | Kiểm tra trang trọng tài dựng ra |
| `npm run check:roster` | Ô nhập danh sách: đếm, khoá, báo lỗi (chạy trên DOM giả) |
| `npm run check:labels` | Xếp biển tên: tránh đè, ổn định, không nhấp nháy |
| `npm run check:handoff` | Chuyển thiết lập giữa các trang |
| `npm run check:hub` | Trang chọn trò chơi, kèm mấy điều khoản của gate UI/UX |

---

## Quy tắc quan trọng nhất của kho mã này

> `tools/fairness/fairness.mjs` là **nguồn duy nhất** của thuật toán.

`Assets/Scripts/Fairness/FairDraw.cs` là bản sao chạy trong Unity. Hai bản phải
cho ra kết quả giống hệt nhau trên mọi đầu vào — nếu lệch, người trong phòng sẽ
tính lại ra một kết quả khác với thứ hạng mà cuộc đua đã diễn, và toàn bộ mục
tiêu niềm tin của dự án sụp đổ.

Sửa thuật toán thì phải sửa cả hai bên rồi chạy lại `npm run m0`. Bộ đối chiếu đã
được kiểm tra bằng phép đột biến: đổi một phép dịch bit trong C# từ `<< 11` thành
`<< 12` làm 10 120 phép so sánh báo đỏ.

Bốn file dưới đây **sinh tự động, đừng sửa tay** (đã nằm trong `.gitignore`):
`web/verify.html`, `web/race.html`, `music/playlist.json` và
`tests/vectors/fairness-vectors.tsv`.

File nhạc trong `music/` cũng không vào kho mã — chúng là tài sản của bạn và
thường có bản quyền.

---

## Bố cục

```
docs/GDD.html                      tài liệu thiết kế
tools/fairness/
  sha256.mjs                       SHA-256 thuần JS (không dùng crypto.subtle)
  fairness.mjs                     ★ NGUỒN DUY NHẤT của thuật toán
  selftest.mjs                     kiểm tra tính công bằng
  gen-vectors.mjs                  sinh vector vàng
  check-verify-page.mjs            kiểm tra trang đã dựng
tools/web/sound.mjs                lớp âm thanh + nhạc, dùng chung hai game
tools/web/roster-input.mjs         ô nhập danh sách, dùng chung hai game
tools/web/labels.mjs               xếp biển tên tránh đè, dùng chung hai game
tools/web/icons.mjs                bộ icon SVG path, dùng chung mọi trang
tools/web/handoff.mjs              chuyển thiết lập giữa các trang qua URL
tools/web/boot.mjs                 màn mở + chuyển cảnh giữa các trang
tools/web/tap.mjs                  sàn phản hồi khi chạm, một bộ nghe cho mọi nút
tools/race/
  director.mjs                     ★ lớp đạo diễn 5 nhịp
  director-selftest.mjs            cửa kịch tính, 200 cuộc đua
  feel.mjs                         ★ lớp cảm giác: đường cong pha về đích
  feel-selftest.mjs                kiểm thử lớp cảm giác
  check-race-page.mjs              kiểm tra trang đua đã dựng
tools/redlight/
  elimination.mjs                  ★ lớp đạo diễn của trò loại dần
  elimination-selftest.mjs         cửa kịch tính, 200 lượt chơi
  check-redlight-page.mjs          kiểm tra trang trọng tài đã dựng
tools/build-web.mjs                dựng cả ba trang web + quét thư mục nhạc
music/                             thả file nhạc vào đây
tools/csharp-check/                đối chiếu C# ↔ JS, chạy không cần Unity
web/verify.template.html           mẫu trang kiểm chứng (sửa ở đây)
web/race.template.html             mẫu trang đua (sửa ở đây)
Assets/Scripts/Fairness/           bản C#, không tham chiếu UnityEngine
Assets/Tests/EditMode/             cùng bộ đối chiếu đó, chạy trong Unity
tests/vectors/                     vector vàng (sinh tự động)
```

Dự án C# `tools/csharp-check` **không sao chép mã** — nó biên dịch thẳng chính
những file `.cs` mà Unity sẽ dùng. Nhờ vậy bộ đối chiếu chạy được trong CI trên
máy chưa cài Unity, mà vẫn kiểm đúng mã thật.

---

## M0 bảo đảm những gì

- **Kết quả tái tạo được.** Cùng danh sách + cùng tên giải luôn cho ra cùng thứ
  hạng, ở cả C# lẫn JavaScript. Hệ quả: mỗi lượt quay trong một buổi phải mang
  tên giải khác nhau, nếu không lượt sau lặp lại y hệt lượt trước.
- **Kết quả tính trước được — giới hạn đã biết.** Seed chỉ phụ thuộc danh sách và
  tên giải, cả hai đều biết trước buổi lễ, nên ai có mã nguồn cũng tính ra người
  thắng từ trước. Đây là lựa chọn có ý thức, ghi rõ ở GDD §4. Thuật toán `v1`
  từng có thêm một chuỗi do khán giả đọc tại chỗ để chặn điều này.
- **Không thiên lệch.** Xáo trộn Fisher–Yates với phép loại bỏ thay cho modulo.
  Đo trên 200 000 lượt bốc: tỉ lệ về nhất lệch tối đa 2,56 sigma, chênh lệch hạng
  trung bình giữa người cao nhất và thấp nhất là 0,0105 hạng.
- **Tên tiếng Việt an toàn.** Chuẩn hoá NFC, sắp xếp theo byte UTF-8 chứ không
  theo locale, và một tập ký tự khoảng trắng liệt kê tường minh — vì `String.trim()`
  của JS cắt BOM còn `string.Trim()` của C# thì không.
- **Khán giả kiểm chứng được.** `web/verify.html` là một file duy nhất, mở bằng
  `file://` cũng chạy, không gọi mạng, mã nguồn đọc được bằng Ctrl+U.

## M1 bảo đảm những gì

Đo bằng máy trên 200 cuộc đua (8, 20, 45, 90, 150 chó × 40 lượt):

- **Thứ hạng về đích luôn đúng** kết quả đã chốt — 200/200.
- **Không có chuyển động lùi** — 0,0000% số mẫu phải kẹp.
- **Không lộ người thắng sớm** — 0 lượt để người thắng dẫn đầu trước mốc 80%.
- **Có xáo trộn thật** — trung bình 4,5 lần đổi ngôi đầu mỗi lượt, ít nhất 3.
- **Về đích sát nút** — 100% số lượt, hạng 1 cách hạng 2 trung bình 0,35% đường đua.
- **Đạo diễn không đụng được kết quả** — đổi top-K hay thời lượng không đổi thứ hạng.

### Pha về đích

Dựng theo mô hình khung va chạm: chuẩn bị → ▣ va chạm → phản ứng → lắng xuống.

| Giai đoạn | Thời lượng | Hệ số thời gian |
|---|---|---|
| Chuẩn bị | 1,10 s (thời gian đua) | 1,00 → 0,55, siết dần liền mạch |
| ▣ Va chạm | 0,14 s (thật) | 0 — đóng băng, kèm chớp + rung + giật máy quay + tiếng + rung tay |
| Phản ứng | 0,95 s (thật) | 0,18 → 1,00, ease-out-quint |
| Lắng xuống | 0,70 s (thật) | 1,00, rồi lên bục |

Hai điều khiến bản đầu trông như giật lag, cả hai đều đã sửa:

1. **Vị trí bị làm tròn về lưới mẫu 30 Hz.** Ở tốc độ 0,3× thì mỗi mẫu bị giữ
   6–7 khung hình, đàn chó nhảy giữa các ô thay vì trượt. Đây là lỗi lấy mẫu,
   không phải lỗi hiệu ứng — và làm chậm lại chính là thứ phơi nó ra.
2. **Hệ số thời gian là hàm bậc thang** (`1 → 0,65 → 0,3`) trải suốt 12% cuối,
   không neo vào cú va chạm nào. Bậc nhảy tức thời đọc ra y hệt một cú rớt
   khung hình.

Chớp, rung và giật máy quay chạy trên thời gian **thật**, không phải thời gian
đã bị làm chậm: trong lúc đóng băng, đàn chó phải đứng yên còn màn hình thì phải
rung. Nếu rung cũng bị đóng băng thì chỉ còn một khung hình đứng im, và nó lại
đọc ra thành treo máy.

### SquidGame

Minigame thứ hai, cùng cỗ máy công bằng. Trọng tài quay lưng thì cả đàn tiến
lên; quay mặt lại thì ai còn nhúc nhích bị loại. Loại dần tới khi còn đúng K
người, rồi K người đó chạy nước rút để phân hạng.

Ánh xạ bắt buộc: **người hạng r bị loại ở đúng vòng mà số người sống sót tụt
xuống dưới r+1**. Nhờ vậy K người sống tới cuối chính là top-K, và toàn bộ diễn
tiến vẫn tái tạo được từ cùng một seed.

Đo trên 200 lượt (8/20/45/90/150 người), 16 ràng buộc — người sống sót cuối cùng
luôn đúng top-K, hạng càng cao càng bị loại muộn, không vòng nào loại 0 người,
không chuyển động lùi, mọi lượt đều có cú doạ quay.

Người bị loại bị **đội canh bắn** rồi bật lên biến mất kiểu hoạt hình. Mỗi loạt
đạn có cửa sổ khoá mục tiêu 0,22 giây với khung ngắm đỏ, và trần 2,2 giây cho
cả loạt dù bao nhiêu người — vòng đầu loại 64 người mà bắn thưa thì kéo 5,4
giây, thành từng phát rời rạc lê thê.

Chi tiết thiết kế và ghi chú về sở hữu trí tuệ ở GDD §14.

### Trang chọn trò chơi

`web/index.html` là điểm vào thuần: bấm một thẻ là vào thẳng trò chơi. **Danh sách
và giải thưởng nhập ở trong từng minigame**, không phải ở đây — mỗi trò có nhu
cầu riêng (đường đua còn có thời lượng), và gom vào một chỗ chung thì trang chọn
phải gánh cả phần không dùng tới.

Nhưng khi bấm "Chọn trò chơi khác" từ trong một trò, thiết lập đang nhập dở được
**mang theo** qua trang chọn rồi chuyển tiếp sang trò được chọn tiếp theo. Trang
chọn không đọc, không sửa, chỉ chuyển tiếp — đổi trò giữa buổi mà phải dán lại
150 tên là một cái bẫy đúng vào lúc cả phòng đang nhìn.

Thiết lập đi qua **phần băm của URL** (`#s=…`) chứ không phải localStorage: phần
băm không gửi lên máy chủ nên danh sách nhân sự không rời khỏi máy, và nó chạy y
hệt nhau khi mở bằng `file://` lẫn khi phục vụ qua web server.

Trang đích **không tự chạy luôn**. Trình duyệt chỉ cho phát âm thanh sau một cú
chạm của người dùng, mà cú chạm ở trang trước không tính sang trang sau — tự chạy
sẽ cho ra một lượt đua câm. Thay vào đó nó điền sẵn mọi thứ rồi đặt con trỏ vào
nút bắt đầu.

Trang này dùng **theme sáng** trong khi các màn trò chơi dùng theme tối. Có chủ
đích: trang chọn là màn hình làm việc lúc đèn phòng còn bật, các màn trò chơi là
buổi diễn lúc đèn đã tắt. Ngôn ngữ hình ảnh vẫn là một — cùng viền mực dày, cùng
đổ bóng cứng kiểu decal — chỉ lật nền.

### Biển tên và điều khiển

Tên hiện trên đầu **mọi** người, không chặn cứng ở top 8: các biển được xếp theo
thứ tự ưu tiên và biển nào đè lên biển đã đặt thì bỏ, nên số tên đọc được tự co
giãn theo mật độ. Ưu tiên cao nhất dành cho người đang bị khoá mục tiêu.

Thứ tự duyệt xếp theo thứ hạng chứ không theo toạ độ — xếp theo toạ độ thì hai
chú chó đi ngang qua nhau sẽ làm cả cụm biển tên nhấp nháy. Có kiểm thử riêng
cho đúng tình huống đó.

Khi đang chạy, góc màn hình có **⏸ Dừng** và **↩ Thiết lập**, kèm phím tắt
`Space` và `Esc`. Quay lại thiết lập được giữa chừng, không phải đợi công bố xong.

### Ô nhập danh sách

Dán danh sách vào là **số người tự cập nhật theo đúng số tên đã dán**, và ô số
người bị khoá lại vì nó đã được suy ra. Trùng tên, vượt trần 150 và danh sách
quá ngắn đều báo ngay lúc dán chứ không đợi tới lúc bấm bắt đầu — phát hiện
muộn thì quản trò phải sửa giữa lúc cả phòng đang nhìn.

Kiểm bằng DOM giả trong `npm run check:roster`, vì đây là thứ không click thử được.

### Nhạc nền

Thả file vào `music/`, chạy `npm run build:web`, xong. Nhạc bật đúng lúc cửa
chuồng mở, **hạ xuống 0,16 trong 0,35 giây** ở khoảnh khắc người thắng chạm vạch
để tiếng va chạm nổi lên, rồi trả lại mức thường. Hạ nhanh, lên chậm — nền tụt
xuống phải dứt khoát để nhường chỗ, còn dâng lên thì phải êm, nếu không chính nó
lại thành một sự kiện gây chú ý.

Một trang web không tự đọc được nội dung thư mục trên máy, nên phải có bước quét.
Nếu bạn phục vụ dự án qua một web server thì trang tự đọc `music/playlist.json`
mỗi lần tải và không cần dựng lại.

## Bước tiếp theo — nốt M1

**Cửa hiệu năng** (GDD §11): 150 khối hộp đạt p99 frame time dưới 20 ms, đo trên
đúng chiếc laptop sẽ dùng ở phòng họp, chạy bằng pin, cắm máy chiếu. Việc này cần
Unity project và lớp render instanced — chưa làm được ở đây.

Lớp đạo diễn khi port sang C# phải giữ nguyên các hằng số trong `director.mjs`;
khác với lớp công bằng, nó **không** cần đối chiếu từng bit giữa hai ngôn ngữ, vì
không ai kiểm chứng lại phần trình diễn.
