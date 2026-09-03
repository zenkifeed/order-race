# Order Race

Minigame quay thưởng dạng đua chó chibi 3D cho các buổi trao thưởng nội bộ.
Tài liệu thiết kế đầy đủ: [`docs/GDD.html`](docs/GDD.html).

**Trạng thái: M0, M1, M2 đạt. M3 đạt cửa cắn nhau.** Sân đã chuyển sang đường
thẳng nhiều làn. Cỗ máy công bằng, trang kiểm chứng,
lớp đạo diễn 5 nhịp và một bản đua chạy được trên trình duyệt đều đã xong. Cửa
hiệu năng của bản Unity thì vẫn phải có Unity project mới đo được.

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
npm run m2     # gồm cả m1 và m0
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
| `npm run modes` | Cửa biến thể: 1 332 lượt chứng minh biến thể không đụng được kết quả |
| `npm run sky` | Cửa trời và thời tiết: chỗ nối khoanh sân, ngân sách vẽ mỗi khung |
| `npm run juice` | Cửa cảm giác thân cuộc đua: bộ canh nhịp, nhịp sải chân, bụi |
| `npm run perf` | Cửa hiệu năng nửa CPU: sắp chèn, cắt bớt, không sinh rác, nướng sân |
| `npm run bite` | Cửa cắn nhau: 260 cú cắn không đụng được vào thứ hạng về đích |
| `npm run check:runtime` | **Chạy thật** trang đua trên DOM giả, mọi biến thể, tới bục vinh danh |

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
  modes.mjs                        ★ thư viện biến thể cuộc đua
  modes-selftest.mjs               cửa biến thể + bằng chứng cô lập kết quả
  feel.mjs                         ★ lớp cảm giác: đường cong pha về đích
  feel-selftest.mjs                kiểm thử lớp cảm giác
  juice.mjs                        ★ lớp cảm giác của phần THÂN cuộc đua
  juice-selftest.mjs               cửa cảm giác thân cuộc đua
  track.mjs                        hình học sân THẲNG + chia làn đều
  bite.mjs                         ★ lớp cắn nhau: lịch cắn tính sẵn từ đường chạy
  bite-selftest.mjs                cửa cắn nhau, ràng buộc chặt nhất kho mã
  perf.mjs                         ★ đường đi nóng của một khung hình
  stage.mjs                        sân nướng sẵn + ngữ cảnh canvas đếm lệnh
  sky.mjs                          ★ trời, ánh sáng và thời tiết của sân đua
  sky-selftest.mjs                 cửa trời: chỗ nối khoanh sân, ngân sách vẽ
  perf-selftest.mjs                cửa hiệu năng nửa CPU
  check-race-page.mjs              kiểm tra trang đua đã dựng
  check-race-runtime.mjs           CHẠY trang đua trên DOM giả, mọi biến thể
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

## M2 bảo đảm những gì

### Biến thể cuộc đua

Một buổi trao thưởng quay 8–12 lượt. Cấu trúc năm nhịp chỉ có một dáng, và tới
lượt thứ tư thì cả phòng đã thuộc lòng — cú vượt ở giây cuối hết ăn tiền vì ai
cũng biết nó sắp tới. Sáu biến thể đổi **biến số** của một lượt, dùng lại nguyên
cỗ máy đã có. Bốc xác định theo seed, nên lượt chạy thử ở nhà ra đúng lượt sẽ
chạy thật trước cả phòng. Bốn biến thể **cảnh** đổi cả kiểu trời lẫn thời tiết —
chúng còn không được truyền vào lớp đạo diễn.

> **Không biến thể nào được phép chạm vào kết quả.** Trang kiểm chứng không biết
> gì về biến thể, nên một biến thể xê dịch dù một hạng là trang kiểm chứng nói
> dối. Giữ bằng cấu trúc chứ không bằng lời hứa: mọi núm là hệ số nhân mặc định
> 1.0 — mà nhân với 1.0 thì chính xác từng bit — và `npm run modes` dựng 1 332
> lượt trên mọi biến thể đơn lẻ cùng mọi cặp để chứng minh lại điều đó.

| Biến thể | Loại | Lệch bản chuẩn |
|---|---|---|
| ◆ Chuẩn | chuẩn | 0% |
| ⇉ Bám đuôi — đàn bó cụm, ngôi đầu đổi tới mét cuối cùng | nhịp | 2,00% |
| ▮ Nghẹt thở — khe hở về đích siết còn một nửa | nhịp | 0,50% |
| ➤ Bỏ trốn — một chú bứt hẳn rồi sụp ở nhịp cuối | nhịp | 1,12% |
| ☂ Đêm mưa — sân ướt dưới đèn pha | cảnh | 0% |
| ☀ Sớm mai — nắng sớm xiên qua màn sương | cảnh | 0% |
| ☘ Chiều vàng — nắng cuối ngày, gió cuốn lá bay | cảnh | 0% |
| ❄ Tuyết rơi — tuyết phủ mờ mặt sân | cảnh | 0% |
| ✷ Pháo hoa — bậc ăn mừng kéo hết cỡ | cảnh | 0% |

Biến thể loại **cảnh** còn không được truyền vào `buildRace`, và cửa kiểm thử xác
nhận chúng không xê dịch một mẫu vị trí nào — an toàn về kết quả theo nghĩa đen.
Biến thể loại **nhịp** thì có, nên chúng phải qua lại toàn bộ cửa kịch tính.

"Lệch bản chuẩn" so sánh thẳng đường chạy: chênh lệch trung bình vị trí từng con
ở từng mẫu, so với cùng seed chạy bản chuẩn. Ba chỉ số tóm tắt tôi thử trước đó
— số lần đổi ngôi, khe hở về đích, hạng của kẻ dẫn đầu giả — đều báo "không khác
gì" cho hai biến thể thật sự có khác: hai cuộc đua hoàn toàn khác nhau vẫn có
thể cùng đổi ngôi 4,6 lần.

### Nhịp kịch tính không còn im lặng

Lớp đạo diễn dựng sẵn trung bình 4,5 lần đổi ngôi đầu mỗi cuộc đua, một kẻ dẫn
đầu giả sụp ở nhịp 4, những cú vượt qua ranh giới trúng thưởng — và **không một
nhịp nào phát ra tiếng động hay chớp sáng**. Chúng chỉ xảy ra, ở đâu đó giữa 150
chấm màu đang chạy, và ai không nhìn đúng chỗ thì không biết vừa có chuyện gì.

Giờ mỗi nhịp nổ trên cả ba kênh — chớp máy quay nhẹ, một quãng hai nốt đi lên,
một cú rung tay ngắn — cộng một nắm bụi tung lên dưới chân con vừa vượt, vì
tiếng động một mình chỉ nói *có chuyện xảy ra*, không nói *xảy ra ở đâu*. Bậc để
ở mức vừa: khung va chạm ở vạch đích mới được dùng bậc nặng, và nếu giữa chừng
cũng rung màn hình thì lúc về đích chẳng còn gì để leo lên nữa.

Việc khó là phân biệt cú vượt thật với hai con đang chạy ngang nhau đảo chỗ sáu
mươi lần một giây. Lọc bằng **ngưỡng khoảng cách** chứ không phải ngưỡng thời
gian: hai con ngang nhau đổi chỗ liên tục nhưng không bao giờ vượt hẳn nhau một
khoảng, còn ngưỡng thời gian thì vẫn cho lọt một cú báo mỗi lần hết giờ nghỉ.
`npm run juice` chạy 3 600 khung hình đảo ngôi liên tục và đòi đúng **không** cú
báo nào.

Cùng đợt: nhịp sải chân nhấp nhô kèm nén giãn giữ nguyên thể tích, suy từ **quãng
đường** chứ không từ đồng hồ — nên trong lúc đóng băng ở khung va chạm thì chân
cũng đứng yên; và máy quay thở 2,4% mức phóng trong chu kỳ 7,5 giây, đủ để khung
hình không bao giờ thật sự đứng yên.

### Hiệu năng — nửa mà một cửa không cần trình duyệt đo được

Ngân sách 20 ms chia đôi: nửa CPU (nội suy, xếp hạng, chiếu toạ độ, cắt bớt) và
nửa vẽ. `npm run perf` đo cả hai, và mọi con số đều đặt cạnh bản cũ dựng lại
nguyên văn — một con số đứng một mình thì không nói được gì.

| Việc | Đo được |
|---|---|
| Không cấp phát trên đường đi nóng | 53 MB rác trong 6 000 khung hình → **0,2–0,5 MB**, còn 1% |
| Sắp chèn thay vì `Array.sort` | nửa CPU ở đàn 150: 0,013 ms → **0,005 ms**, nhanh 2,3× |
| Nướng sân thay vì tô lại mỗi khung | **77 lệnh vẽ mỗi khung → 1**, tức 4 620 → 60 lệnh mỗi giây |
| Cắt bớt ngoài khung hình | 26% số con ở pha về đích trên laptop; **1% ở máy chiếu 1080p** |

Dòng cuối là chỗ tôi đã đoán sai. Tôi vào việc này tin rằng cắt bớt là khoản lãi
lớn nhất, và phép đo bác bỏ ngay ở lần chạy đầu: sân đua rộng 1 328 × 708 đơn
vị, còn khung hình ở 1080p mức phóng 1,45× rộng 1 324 × 676 — **cả sân lọt trong
khung, không có gì để cắt**. Nó chỉ lãi trên màn hình laptop và trong pha về
đích lúc máy quay siết vào 1,9×. Giữ lại vì hai chỗ đó có thật và cái giá bằng
không, nhưng nó không phải chỗ có tiền.

Chỗ có tiền là nướng sân. Và cả nửa CPU, kể cả bản cũ, chưa bao giờ là chỗ nghẽn
— 0,013 ms trong ngân sách 20 ms.

### Trang đua có một cửa CHẠY THẬT

`npm run check:race` *biên dịch* mã của trang. Nó không chạy nó — và khoảng cách
giữa hai việc đó là toàn bộ nhóm lỗi biên dịch sạch sẽ rồi làm trang chết trắng
ở khung hình đầu tiên: một tên gọi trước khi khai báo, một thuộc tính đọc trên
null, một hàm đổi chữ ký mà chỗ gọi thì chưa đổi.

`npm run check:runtime` dựng một trình duyệt giả vừa đủ — DOM giả, canvas giả
đếm lệnh vẽ, đồng hồ giả, `requestAnimationFrame` do mình cầm nhịp — rồi chạy
chính khối mã của trang: bấm nút xuất phát, quay trọn cuộc đua từ đếm ngược tới
bục vinh danh, ở **mọi** biến thể, với 2 người, 45 người và 150 người, và với
tên tiếng Việt có dấu.

Nó không biết cái gì đẹp và không biết cái gì hồi hộp — phần đó vẫn phải có
người mở trang ra xem. Nó chỉ bảo đảm điều mà mắt người không kiểm nổi trên mọi
tổ hợp: trang không văng lỗi ở bất kỳ khung hình nào.

## M3 bảo đảm những gì

### Sân thẳng, nhiều làn

Bỏ sân oval. Lý do là khả năng đọc, không phải thẩm mỹ: trên oval, 150 chú chó
chen trong 7 làn là hơn hai chục con mỗi làn, xếp chồng lên nhau dọc đường chạy,
và ai cũng thành một chấm màu trong đám.

| Số người | Làn (oval) | Con/làn | Làn (thẳng) | Con/làn |
|---|---|---|---|---|
| 8 | 7 | 1,1 | 6 | 1,3 |
| 45 | 7 | 6,4 | 13 | 3,5 |
| 150 | 7 | 21,4 | 23 | 6,5 |

GDD §7 từng kết luận "sân oval là chế độ duy nhất", dựa trên tiền đề *mỗi người
một làn*. Tiền đề đó sai: đường thẳng không bắt buộc mỗi người một làn, nó chỉ
bắt buộc mỗi làn một dải ngang — và số làn thì muốn bao nhiêu cũng được, vì thứ
giới hạn là chiều cao khung hình chứ không phải hình học. Đoạn cũ được giữ lại
trong GDD kèm một ghi chú đảo lại, chứ không xoá.

Hai thứ đổi kèm:

- **Khúc cua ăn mất bề ngang.** Đúng lúc đàn chó vào cua thì cả cụm bị nén theo
  phương nhìn — mà cua lại thường là chỗ có cú vượt. Trên đường thẳng, khoảng
  cách ngang màn hình đọc thẳng ra thành thứ hạng, ở mọi thời điểm.
- **Xếp làn đều thay vì băm tên.** Bản oval lấy dư mã băm tên chia số làn, cho
  phân bố lệch. Bản thẳng xáo trộn theo seed rồi chia vòng tròn: đều tuyệt đối.
  **Không được** lấy thẳng chỉ số chó chia dư — chó đánh số theo hạng cuối, nên
  người thắng sẽ luôn nằm ở làn đầu, và sau dăm buổi lễ sẽ có người nhận ra.
  `npm run check:race` canh đúng chuyện đó: 40 lượt, làn người thắng phải rơi
  vào ít nhất 8 làn khác nhau.

Mức phóng máy quay cũng không còn là hằng số — nó tự căn để vừa cả chiều cao
đường đua lẫn bề ngang của đàn lúc giãn nhất, với độ giãn lấy từ chính cuộc đua
vừa dựng.

Sân dài 4 200 đơn vị nên **không nướng cả tấm được**: ở 2× là một ảnh rộng 8 480
điểm ảnh, mà có trình duyệt trần chỉ 4 096 — một trang trắng trên máy người
khác, giữa buổi lễ. Nướng một khoanh 512 đơn vị rồi lát ngang qua đúng phần đang
nhìn thấy: **6 lệnh vẽ mỗi khung thay vì 450**, và chi phí phụ thuộc bề rộng
khung hình chứ không phụ thuộc chiều dài đường đua.

### Chó cắn nhau

Chó cắn nhau để vượt lên. Con bị cắn trúng ngã ra, **nằm quay đơ hai giây**, rồi
bò dậy đuổi theo. Thuần tuý cho vui — và đây là phần nguy hiểm nhất của cả kho mã.

> Mọi thứ khác ở lớp trình diễn chỉ đổi cách *kể lại* một kết quả đã chốt. Lớp
> này đổi **vị trí của một chú chó trên màn hình** — mà vị trí trên màn hình
> chính là thứ khán giả đọc ra thành thứ hạng. Làm ẩu một chút là buổi lễ công
> bố một người, còn `web/verify.html` tính ra một người khác.

Bốn ràng buộc, giữ bằng cấu trúc chứ không bằng lời hứa:

1. **Độ tụt một chiều.** Con bị cắn tụt lại; không con nào được đẩy lên *trước*
   vị trí lớp đạo diễn đã định.
2. **Mọi độ tụt về 0 trước vạch đích.** Lịch cắn từ chối mọi cú mà vòng đời chưa
   kịp khép lại trước lúc chạm vạch.
3. **Không ai cắn con đang dẫn đầu** — kể cả con *sẽ* dẫn đầu trong lúc nó còn
   nằm. Ràng buộc này phải nhìn tới trước: một con đang hạng ba lúc bị cắn hoàn
   toàn có thể lên hạng nhất ở giây thứ hai của cú đơ.
4. **Lịch cắn tính sẵn từ đường chạy**, không sinh lúc chạy — nếu không thì nó
   phụ thuộc nhịp khung hình của máy và cùng một seed cho ra hai cuộc đua khác nhau.

#### Mô hình độ tụt — hai lần sai trước khi đúng

| Bản | Mô hình | Tốc độ lùi | Vì sao sai |
|---|---|---|---|
| 1 | Đặt sẵn "độ tụt tối đa" rồi kéo con chó về đó trong 0,18 s | −13× | Không phải vấp ngã, mà là teleport |
| 2 | Vẫn đặt sẵn, nhưng tính theo *thân chó* | −6,2× | "Một thân chó" chẳng liên quan gì tới việc con chó đó chạy nhanh bao nhiêu |
| 3 | **Không đặt trước gì cả.** Va thì lùi một quãng ngắn tính bằng *giây quãng đường*, rồi **đứng im** | −0,83× | Đúng |

Bài học chung: khi một hiệu ứng phải trông như vật lý, đừng đặt trước *kết quả*
rồi nội suy tới đó. Đặt trước *nguyên nhân* — ở đây là "đứng im" — rồi để kết quả
tự sinh ra. Hai giây sau, độ tụt đúng bằng quãng đường lớp đạo diễn đã cho nó đi
trong hai giây đó. Không con số nào phải bịa, và cú đơ đọc ra đúng như một cú đơ
vì nó thật sự đứng yên trên màn hình.

| Giai đoạn | Thời lượng | Trên màn hình |
|---|---|---|
| Loạng choạng | 0,18 s | Trượt lùi chậm hơn tốc độ chạy, thân nghiêng dần tới 79° |
| ▣ Nằm đơ | **2,00 s** | Đứng im tuyệt đối, ba ngôi sao quay trên đầu, cả đàn tràn qua |
| Bò dậy đuổi theo | 3,00 s | Dậy trong 0,45 s đầu, rồi phi tới 2,2× tốc độ chạy |

Cú cắn được bốc từ những cặp **vừa thật sự vượt nhau** trong nửa giây trước đó, ở
hai làn kề bên. Nó là lời *giải thích* cho một cú vượt vốn đã sắp xảy ra, không
phải nguyên nhân tạo ra nó. Một phần ba số cơ hội bị bỏ qua — nếu cú vượt nào
cũng kèm cắn thì cắn nhau thành luật vật lý của cuộc đua chứ không còn là chuyện
bất ngờ.

Phản hồi ở **bậc vừa**: tiếng va trầm, chớp máy quay, rung tay, bụi tung — nhưng
*không* rung màn hình. Rung màn hình dành riêng cho khung va chạm ở vạch đích.

`npm run bite` chạy 50 cuộc đua, 260 cú cắn. Ràng buộc quan trọng nhất **không
được suy ra** từ bốn ràng buộc trên — nó được vét cạn trên chính con số mắt
người sẽ thấy: thứ hạng *hiển thị* lúc về đích, so với thứ hạng đã chốt.

## Bước tiếp theo — nốt còn lại


**Cửa hiệu năng đo trên máy thật** (GDD §11): 150 khối hộp đạt p99 frame time
dưới 20 ms, đo trên đúng chiếc laptop sẽ dùng ở phòng họp, chạy bằng pin, cắm
máy chiếu. Phần này vẫn chưa làm được ở đây và không có cửa nào thay thế được:
một cửa chạy trong node không có card đồ hoạ, không có máy chiếu, không chạy
bằng pin.

Cái `npm run perf` làm được là nửa còn lại — toàn bộ phép tính của một khung
hình, cộng số lệnh vẽ mà nửa đó quyết định sẽ gửi xuống canvas. Nếu nửa CPU vượt
ngân sách thì phép đo trên máy thật chưa cần chạy cũng biết là trượt. Hiện nó
tốn 0,005 ms trong ngân sách 4 ms, nên nút thắt nếu có sẽ nằm ở phía trình duyệt
tô, chứ không nằm ở mã của trang.

Lớp đạo diễn khi port sang C# phải giữ nguyên các hằng số trong `director.mjs`,
và `modes.mjs` phải port theo cùng bộ hệ số;
khác với lớp công bằng, nó **không** cần đối chiếu từng bit giữa hai ngôn ngữ, vì
không ai kiểm chứng lại phần trình diễn.
