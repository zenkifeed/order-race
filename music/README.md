# Thư mục nhạc

Thả file nhạc vào đây, rồi chạy:

```bash
npm run build:web
```

Xong. Lần đua tiếp theo, nhạc sẽ bật ngay khi cửa chuồng mở.

Định dạng nhận được: `.mp3` `.ogg` `.wav` `.m4a` `.aac` `.opus` `.flac` `.webm`
Tên file có dấu tiếng Việt và khoảng trắng đều dùng được.

---

## Vì sao phải chạy thêm một lệnh

Một trang web **không tự đọc được** danh sách file trong một thư mục trên máy bạn.
Mở bằng `file://` thì trình duyệt không cho liệt kê thư mục, và `fetch` cũng bị
chặn — đây là quy định bảo mật, không phải thiếu sót.

Nên lệnh `build:web` quét thư mục này rồi ghi danh sách tên file thẳng vào trang.
Chỉ cần chạy lại khi bạn **thêm hoặc bớt** file, không cần chạy mỗi lần đua.

Nếu bạn phục vụ thư mục dự án qua một web server (`python -m http.server` chẳng
hạn) thì trang sẽ tự đọc `music/playlist.json` mỗi lần tải, và lúc đó thêm nhạc
là thấy ngay, không cần dựng lại.

---

## Nhạc chạy thế nào trong một lượt đua

| Lúc | Nhạc |
|---|---|
| Cửa chuồng mở | Chọn ngẫu nhiên một bài, mở dần lên trong 1,2 giây |
| Người thắng chạm vạch | **Hạ xuống 0,16** trong 0,35 giây, để tiếng va chạm nổi lên |
| Sau cú va chạm | Trả lại mức thường |
| Bục vinh danh | Hạ nhẹ để nghe rõ tên người trúng |
| Bấm nút tắt tiếng | Tắt cùng với hiệu ứng âm thanh |

Bài dài hơn cuộc đua thì bị cắt giữa chừng, ngắn hơn thì tự lặp lại.

`playlist.json` trong thư mục này **sinh tự động** — đừng sửa tay.
