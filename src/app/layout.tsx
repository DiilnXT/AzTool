import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AzTool — Nền Tảng AI & Công Cụ Thông Minh Đa Năng',
  description:
    'AzTool (AzTool.vercel.app) - Hệ sinh thái công cụ thông minh tích hợp AI: kiểm định chất lượng tài liệu, chuẩn hóa đề thi 1 chạm, tự động đánh dấu phiếu trả lời và trộn mã đề cân bằng 25%.',
  keywords: [
    'AzTool',
    'AzTool.vercel.app',
    'nền tảng công cụ thông minh',
    'chuẩn hóa đề thi',
    'trộn đề thi trắc nghiệm',
    'phiếu trả lời trắc nghiệm',
    'AI năng suất',
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        {children}
      </body>
    </html>
  );
}
