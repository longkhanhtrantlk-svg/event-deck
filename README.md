# 🎛 Event Deck

Phần mềm phát nhạc nhiều kênh cho sự kiện: mỗi kênh có danh sách riêng
(ví dụ nhạc biểu diễn, nhạc MC / nghi thức; đổi tên kênh tùy ý), chuyển qua lại chỉ bằng một cú bấm.

## Cách dùng
1. Mở `index.html` bằng **Chrome** hoặc **Edge** (không cần cài đặt, không cần mạng).
2. Mỗi kênh: **+ File** / **+ Thư mục** hoặc kéo thả file nhạc vào kênh.
3. Bấm ▶ ở một kênh: kênh đang phát sẽ **mờ dần rồi tạm dừng**, kênh kia vẫn giữ nguyên vị trí để phát tiếp.

## Tính năng
- Không giới hạn số kênh, đổi tên, kéo thả sắp xếp bài.
- Chế độ mỗi kênh: phát liên tục / 1 bài rồi dừng / lặp 1 bài / lặp cả danh sách.
- Âm lượng riêng từng kênh, mờ dần (thời gian chỉnh được), "Dừng tất cả".
- Chọn thiết bị loa riêng cho từng kênh (nếu có nhiều đầu ra âm thanh).
- Ghi nhớ danh sách giữa các lần mở (Chrome/Edge; lần đầu mở lại sẽ hỏi cấp quyền đọc file khi bấm phát).
- Phím tắt: `Space` phát/tạm dừng, `←`/`→` bài trước/sau, `F` mờ dần & dừng, `1–9` chọn kênh.

## Về tốc độ nhạc
Ứng dụng phát bằng trình phát âm thanh gốc của trình duyệt, `playbackRate = 1`,
không có bước kéo giãn tempo hay key-lock nào, nên bài nhạc phát đúng tốc độ gốc.

## Phát triển
Chỉ gồm `index.html`, `style.css`, `app.js` thuần, không cần build.

## Bản Windows (.exe)
Tải từ mục **Releases** của repo:
- `EventDeck-x.y.z-portable.exe`: chạy thẳng, không cần cài.
- `EventDeck-x.y.z-setup.exe`: bản cài đặt.

Tự build: chạy workflow **Build Windows exe** trong tab Actions (file nằm ở Artifacts),
hoặc trên Windows: `npm ci && npm run dist` (kết quả trong `dist/`).

## Giao diện & sóng âm
Giao diện tối kiểu "glass", 3 tab: **Phát nhạc**, **Danh sách** (tìm bài, phát nhanh, chuyển bài giữa các kênh) và **Cài đặt**.
Mỗi kênh có hiệu ứng sóng âm phản ứng theo nhạc đang phát (chọn Sóng / Cột / Tắt trong Cài đặt) và hiện ảnh bìa nếu file mp3 có sẵn.
