# AzTool - Hệ Thống Chuẩn Hóa & Trộn Đề Thi Trắc Nghiệm ĐH Cửu Long

> **Tên miền mục tiêu:** `AzTool.vercel.app` (`https://aztool.vercel.app`)  
> **Admin Tối Thượng:** `lenhatduy.vietnam@gmail.com`

---

## 🌟 Giới Thiệu

**AzTool** là giải pháp phần mềm chuyên biệt dành cho Giảng viên Trường Đại học Cửu Long và các trường đại học, cao đẳng:
1. **Kiến trúc 1 nút bấm (AzTool Core):** Tải lên file Word (`.docx`) thô của giáo viên -> Tự động đọc từng đoạn văn bản, bóc tách phương án in đậm (`bold`), gạch chân hoặc bảng đáp án đánh dấu `[X]` làm đáp án đúng -> Xuất ngược lại vào khuôn chuẩn 100% của Trường Đại học Cửu Long (giữ nguyên 100% tiêu đề gốc, bảng điểm 5 cột, bảng phiếu trả lời 4 khối [1-15, 16-30...], nội dung đề và bảng ký duyệt).
2. **Xuất 2 bản độc lập:**
   - **Bản Giảng viên / Chấm thi:** Đã tự động đánh dấu `[X]` màu đỏ vào đúng ô đáp án tương ứng trên phiếu trả lời.
   - **Bản Sinh viên làm bài:** Bảng phiếu trả lời để trống để sinh viên làm bài thi trực tiếp.
3. **Bộ trộn mã đề chống đoán mò (Exam Mixer):**
   - Tùy chọn sinh 2, 4, 6, 8, 12... mã đề (101, 102, 103...).
   - Xáo trộn vị trí câu hỏi & đảo vị trí 4 phương án A, B, C, D.
   - Phân bổ tỷ lệ đáp án đồng đều **~25% cho từng phương án A, B, C, D**.
   - Tải về từng mã đề hoặc tải về gói **ZIP** chứa toàn bộ các file docx và ma trận đáp án tổng hợp.
4. **Trợ lý Khảo thí AI Gemini:**
   - Quét toàn bộ đề thi phát hiện lỗi: câu hỏi sai đề, câu không có đáp án đúng, câu chọn sai đáp án, câu 2 đáp án đúng, câu trùng lặp, lỗi chính tả.
   - Hỗ trợ **nhiều API key Gemini** tự động xoay tua ngẫu nhiên và tự động chuyển đổi model dự phòng khi gặp lỗi 503/429.
   - **Tự động sửa lỗi 1 chạm:** AI tạo ra 3 phiên bản sửa hoàn hảo, giảng viên chuyển tab chọn là đề và bảng đáp án tự động cập nhật ngay.
5. **Đăng nhập Google OAuth 2.0 Thật & Admin Tối Thượng (`lenhatduy.vietnam@gmail.com`):**
   - Tích hợp Google Identity Services chính thức (`https://accounts.google.com/gsi/client`).
   - Nhận diện tự động quyền Super Admin tối cao cho `lenhatduy.vietnam@gmail.com`.

---

© Bản quyền thuộc về **AzTool (AzTool.vercel.app)** • Admin Tối Thượng: `lenhatduy.vietnam@gmail.com`
