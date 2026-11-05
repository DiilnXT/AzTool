@echo off
chcp 65001 >nul
echo ================================================================
echo     AZTOOL STUDIO - DEPLOY GITHUB ^& VERCEL (AzTool.vercel.app)
echo ================================================================
echo.

set "PATH=%PATH%;C:\Users\lenha\AppData\Local\GitHubDesktop\app-3.6.10\resources\app\git\cmd;C:\Program Files\nodejs"
cd /d "%~dp0"

echo [1/3] Đang lưu toàn bộ mã nguồn AzTool vào Git...
git add .
git commit -m "chore: update AzTool.vercel.app release" 2>nul

echo.
echo [2/3] Để đẩy lên GitHub:
echo   - Mở ứng dụng GitHub Desktop trên máy của bạn
echo   - Chọn File -^> Add local repository...
echo   - Chọn thư mục: C:\Users\lenha\.gemini\antigravity\scratch\deq-app
echo   - Bấm nút "Publish repository" với tên: AzTool
echo.
echo [3/3] Đang khởi chạy triển khai trực tiếp lên Vercel (AzTool.vercel.app)...
call npx vercel --prod --yes
pause
