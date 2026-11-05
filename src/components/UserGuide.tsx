'use client';

import React from 'react';
import {
  FileText,
  Shuffle,
  Sparkles,
  CheckCircle,
  BookOpen,
} from 'lucide-react';

export function UserGuide() {
  return (
    <div className="space-y-8 max-w-3xl mx-auto py-2">
      {/* Canva Style Hero */}
      <div className="text-center space-y-3 pt-2 sm:pt-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-100 text-[#7d2ae8] dark:bg-purple-950/60 dark:text-purple-300 text-xs font-bold border border-purple-200">
          <BookOpen className="w-3.5 h-3.5" />
          <span>Tài Liệu &amp; Hướng Dẫn Soạn Đề</span>
        </div>

        <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-neutral-900 dark:text-neutral-100">
          Quy Chuẩn Soạn Đề AzTool
        </h2>

        <p className="text-sm text-neutral-500 font-normal max-w-md mx-auto">
          Chuẩn hóa 1 nút bấm, tạo mã đề và kiểm tra lỗi đề thi trắc nghiệm theo đúng quy cách khảo thí ĐH Cửu Long.
        </p>
      </div>

      {/* 3 Steps Canva Bento */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div className="canva-card p-5 space-y-2.5 border border-neutral-200/90 dark:border-neutral-800">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#00c4cc] to-[#7d2ae8] text-white font-bold flex items-center justify-center text-xs shadow-xs">
            1
          </div>
          <h3 className="font-bold text-neutral-900 dark:text-white">Bóc Tách File Word</h3>
          <p className="text-neutral-500 leading-relaxed">
            Hệ thống tự động đọc từng run văn bản trong file docx để tìm các đoạn in đậm (bold) làm đáp án đúng.
          </p>
        </div>

        <div className="canva-card p-5 space-y-2.5 border border-neutral-200/90 dark:border-neutral-800">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#10b981] to-[#00c4cc] text-white font-bold flex items-center justify-center text-xs shadow-xs">
            2
          </div>
          <h3 className="font-bold text-neutral-900 dark:text-white">Vào Khuôn Chuẩn 100%</h3>
          <p className="text-neutral-500 leading-relaxed">
            Giữ nguyên font Times New Roman, bảng điểm 5 cột và tự động đánh dấu [X] vào bảng Phiếu trả lời 4 khối.
          </p>
        </div>

        <div className="canva-card p-5 space-y-2.5 border border-neutral-200/90 dark:border-neutral-800">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#ff66c4] to-[#7d2ae8] text-white font-bold flex items-center justify-center text-xs shadow-xs">
            3
          </div>
          <h3 className="font-bold text-neutral-900 dark:text-white">Trộn &amp; Soát Lỗi AI</h3>
          <p className="text-neutral-500 leading-relaxed">
            Xáo trộn câu và phương án với tỷ lệ 25% đều. Tự do cấu hình Model ID Gemini để quét lỗi và sửa 1 chạm.
          </p>
        </div>
      </div>

      {/* Formatting Card */}
      <div className="canva-card p-6 space-y-4 shadow-xs text-xs border border-neutral-200/90 dark:border-neutral-800">
        <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#7d2ae8]" />
          <span>Mẫu Soạn Đề Chuẩn Dành Cho Giảng Viên</span>
        </h3>

        <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900 font-mono text-[11px] space-y-1.5 border border-neutral-200 dark:border-neutral-800">
          <div className="font-bold text-neutral-900 dark:text-white">
            Câu 1: Đâu là ngôn ngữ lập trình phổ biến nhất cho web frontend?
          </div>
          <div className="text-[#7d2ae8] font-bold">
            A. JavaScript (IN ĐẬM HOẶC GẠCH CHÂN HOẶC ĐỂ DẤU * PHƯƠNG ÁN ĐÚNG)
          </div>
          <div className="text-neutral-600 dark:text-neutral-400">B. C++</div>
          <div className="text-neutral-600 dark:text-neutral-400">C. Python</div>
          <div className="text-neutral-600 dark:text-neutral-400">D. Rust</div>
        </div>

        <div className="space-y-2 pt-1 text-neutral-600 dark:text-neutral-300">
          <div className="flex items-start gap-2">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
            <span>
              <strong>Bắt đầu câu hỏi:</strong> <code>Câu 1:</code> hoặc <code>Câu 1.</code> hoặc <code>1.</code>
            </span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
            <span>
              <strong>Bắt đầu phương án:</strong> <code>A.</code>, <code>B.</code>, <code>C.</code>, <code>D.</code>
            </span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
            <span>
              <strong>Đáp án đúng:</strong> In đậm chữ cái phương án (ví dụ <b>A.</b>) hoặc in đậm nội dung. Nếu để bảng đáp án ở cuối đề dạng <code>1-A, 2-B, 3-C...</code> tool cũng tự động đọc!
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
