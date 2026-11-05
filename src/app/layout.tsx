import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AzTool - Chuẩn Hóa & Trộn Đề Thi Trắc Nghiệm ĐH Cửu Long',
  description:
    'AzTool (AzTool.vercel.app) - Hệ thống chuẩn hóa đề thi trắc nghiệm 1 nút bấm, bóc tách file Word sang khuôn chuẩn Đại học Cửu Long, tự động đánh dấu X phiếu trả lời, trộn mã đề tỷ lệ 25% và rà soát lỗi bằng AI Gemini.',
  keywords: [
    'AzTool',
    'AzTool.vercel.app',
    'chuẩn hóa đề thi',
    'trộn đề thi trắc nghiệm',
    'đại học cửu long',
    'phiếu trả lời trắc nghiệm',
    'gemini flash',
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
