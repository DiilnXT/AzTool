'use client';

import React, { useState } from 'react';
import { parseDocxFile, parsePlainTextExam } from '@/lib/docx-parser';
import { generateStandardDocx, setCustomTemplate } from '@/lib/docx-generator';
import { Question, ExamMetadata } from '@/types/exam';
import { SAMPLE_METADATA, SAMPLE_QUESTIONS } from '@/lib/sample-data';
import { useAuth } from '@/lib/auth-context';
import { captureWorkspaceSnapshot } from '@/lib/workspace-sync';
import { useToast } from '@/components/ToastProvider';
import { downloadFileMobileSafe } from '@/lib/mobile-download';
import {
  UploadCloud,
  FileCheck,
  Download,
  Shuffle,
  Sparkles,
  Plus,
  Trash2,
  Check,
  Sliders,
  FileCode,
  Grid,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { DeQLogo } from '@/components/DeQLogo';

interface ExamStandardizerProps {
  examMetadata: ExamMetadata;
  setExamMetadata: React.Dispatch<React.SetStateAction<ExamMetadata>>;
  questions: Question[];
  setQuestions: React.Dispatch<React.SetStateAction<Question[]>>;
  onGoToMixer: () => void;
  onGoToAiAudit: () => void;
}

export function ExamStandardizer({
  examMetadata,
  setExamMetadata,
  questions,
  setQuestions,
  onGoToMixer,
  onGoToAiAudit,
}: ExamStandardizerProps) {
  const { user, incrementUsage, isDailyLimitReached, consumeDailyQuota, openLimitModal } = useAuth();
  const toast = useToast();

  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [activeTabMode, setActiveTabMode] = useState<'upload' | 'text'>('upload');
  const [rawTextInput, setRawTextInput] = useState('');
  const [showAnswerSheetPreview, setShowAnswerSheetPreview] = useState(true);
  const [customTemplateName, setCustomTemplateName] = useState<string>('MAU_DE_THI_tracnghiem.docx (Chuẩn Gốc 100%)');

  const processDocxFile = async (file: File) => {
    if (isDailyLimitReached) {
      toast.error(
        'Đã hết limit 5/5 lần sử dụng trong ngày!',
        'Thời gian tính từ 00h00 đến 23h59. Bạn không thể sử dụng thêm tính năng hôm nay.'
      );
      openLimitModal('Chuẩn Hóa Đề Thi 1 Chạm');
      return;
    }

    setIsProcessing(true);
    toast.showLoading(
      'Đang bóc tách đề thi Word...',
      'Quét đáp án Loại 1 (In đậm/Gạch chân/Đỏ) & Loại 2 (Bảng đáp án đánh X)'
    );

    try {
      const parsed = await parseDocxFile(file);
      if (parsed.questions.length === 0) {
        toast.error(
          'Không tìm thấy câu hỏi!',
          'Hãy kiểm tra cú pháp "Câu 1: ...", "A. ...".'
        );
      } else {
        setQuestions(parsed.questions);
        setExamMetadata(prev => ({
          ...prev,
          ...parsed.metadata,
        }));
        const detectedCount = parsed.questions.filter(q => !!q.correctAnswer).length;
        const msg = `Đã nạp ${parsed.questions.length} câu hỏi (${detectedCount}/${parsed.questions.length} câu có đáp án)!`;
        setUploadMessage(msg);
        toast.success('Chuẩn hóa dữ liệu thành công!', msg);
        confetti({ particleCount: 45, spread: 55, origin: { y: 0.6 } });

        void captureWorkspaceSnapshot({
          userEmail: user?.email || 'khach@aztool.vercel.app',
          userName: user?.displayName || (user?.email ? user.email.split('@')[0] : 'Khách vãng lai'),
          userAvatar: user?.photoURL,
          actionType: 'upload',
          actionLabel: 'Tải đề gốc lên Chuẩn Hóa 1 Chạm',
          originalFileName: file.name,
          originalFile: file,
          metadata: { ...examMetadata, ...parsed.metadata },
          questions: parsed.questions,
        });
      }
    } catch (err: any) {
      toast.error('Lỗi đọc file Word', err.message || String(err));
      setUploadMessage(null);
    } finally {
      setIsProcessing(false);
      toast.hideLoading();
    }
  };

  // Handle docx upload (Exam from teacher)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processDocxFile(file);
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processDocxFile(file);
    }
  };

  // Handle custom template upload (if teacher wants to upload an updated template.docx)
  const handleCustomTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buf = await file.arrayBuffer();
      setCustomTemplate(buf);
      setCustomTemplateName(file.name);
      toast.success('Đã nạp khuôn mẫu mới!', `Sử dụng "${file.name}" làm khuôn gốc.`);
      confetti({ particleCount: 30, spread: 40 });
    } catch (err: any) {
      toast.error('Lỗi nạp template', err.message);
    }
  };

  // Load sample exam
  const handleLoadSample = () => {
    if (isDailyLimitReached) {
      toast.error(
        'Đã hết limit 5/5 lần sử dụng trong ngày!',
        'Thời gian tính từ 00h00 đến 23h59. Bạn không thể sử dụng thêm tính năng hôm nay.'
      );
      openLimitModal('Nạp Đề Thi Mẫu');
      return;
    }

    setQuestions(SAMPLE_QUESTIONS);
    setExamMetadata(SAMPLE_METADATA);
    setUploadMessage('Đã tải đề thi mẫu chuẩn 10 câu AzTool!');
    toast.info('Đã nạp đề mẫu 10 câu', 'Sẵn sàng xuất file Word hoặc trộn đề.');
    confetti({ particleCount: 35, spread: 45 });
  };

  // Parse raw text
  const handleParseRawText = () => {
    if (!rawTextInput.trim()) return;
    if (isDailyLimitReached) {
      toast.error(
        'Đã hết limit 5/5 lần sử dụng trong ngày!',
        'Thời gian tính từ 00h00 đến 23h59. Bạn không thể sử dụng thêm tính năng hôm nay.'
      );
      openLimitModal('Chuyển Văn Bản Đề Thi Thô');
      return;
    }

    try {
      const parsed = parsePlainTextExam(rawTextInput);
      if (parsed.questions.length === 0) {
        toast.warning('Không trích xuất được câu hỏi', 'Hãy kiểm tra định dạng Câu 1:, A., B., C., D.');
        return;
      }
      setQuestions(parsed.questions);
      setExamMetadata(prev => ({ ...prev, ...parsed.metadata }));
      setUploadMessage(`Đã chuyển đổi thành công ${parsed.questions.length} câu hỏi!`);
      setActiveTabMode('upload');
      toast.success(`Đã bóc tách ${parsed.questions.length} câu hỏi!`);
      confetti({ particleCount: 40, spread: 50 });

      void captureWorkspaceSnapshot({
        userEmail: user?.email || 'khach@aztool.vercel.app',
        userName: user?.displayName || (user?.email ? user.email.split('@')[0] : 'Khách vãng lai'),
        userAvatar: user?.photoURL,
        actionType: 'upload',
        actionLabel: 'Dán văn bản đề thi thô lên web',
        originalFileName: `VanBanTho_${parsed.questions.length}cau.docx`,
        metadata: { ...examMetadata, ...parsed.metadata },
        questions: parsed.questions,
      });
    } catch (err: any) {
      toast.error('Lỗi phân tích văn bản', err.message);
    }
  };

  // Export standard DOCX cloned directly from MAU_DE_THI_tracnghiem.docx
  const handleDownloadDocx = async (hasAnswers: boolean) => {
    if (questions.length === 0) {
      toast.warning('Chưa có câu hỏi nào!', 'Vui lòng tải đề lên hoặc nhấn "Thử Đề Mẫu".');
      return;
    }

    if (!consumeDailyQuota('Chuẩn Hóa & Xuất Đề Thi Word')) {
      toast.error(
        'Đã hết limit 5/5 lần sử dụng trong ngày!',
        'Thời gian tính từ 00h00 đến 23h59. Bạn không thể sử dụng thêm tính năng hôm nay.'
      );
      return;
    }

    setIsExporting(true);
    toast.showLoading(
      hasAnswers ? 'Đang xuất Bản Giảng Viên (Có đánh X)...' : 'Đang xuất Bản Sinh Viên (Đề sạch)...',
      'Giữ nguyên 100% tiêu đề gốc • Không in đậm phương án trả lời'
    );

    try {
      const blob = await generateStandardDocx(examMetadata, questions, hasAnswers);
      const suffix = hasAnswers ? 'DAP_AN_DANH_X' : 'BAN_SINH_VIEN_LAM_BAI';
      const fileName = `AzTool_ChuanHoa_${suffix}.docx`;

      await downloadFileMobileSafe(blob, fileName);
      incrementUsage('standardize');

      void captureWorkspaceSnapshot({
        userEmail: user?.email || 'khach@aztool.vercel.app',
        userName: user?.displayName || (user?.email ? user.email.split('@')[0] : 'Khách vãng lai'),
        userAvatar: user?.photoURL,
        actionType: 'standardize',
        actionLabel: hasAnswers
          ? 'Xuất đề chuẩn hóa (Bản GV có đánh X)'
          : 'Xuất đề chuẩn hóa (Bản SV sạch)',
        originalFileName: fileName,
        metadata: examMetadata,
        questions,
        prebuiltStandardBlob: hasAnswers ? blob : undefined,
      });

      toast.success(
        hasAnswers ? 'Đã tải Bản Giảng Viên (Có đánh X)!' : 'Đã tải Bản Sinh Viên (Đề sạch)!',
        `File: ${fileName} • Giữ nguyên 100% thông tin đầu đề gốc.`
      );
      confetti({ particleCount: 55, spread: 65 });
    } catch (err: any) {
      toast.error('Lỗi xuất file Word', err.message || String(err));
    } finally {
      setIsExporting(false);
      toast.hideLoading();
    }
  };

  const handleQuestionChange = (index: number, field: string, value: string) => {
    const updated = [...questions];
    if (field === 'text') {
      updated[index].text = value;
    } else if (['A', 'B', 'C', 'D'].includes(field)) {
      updated[index].options[field as 'A' | 'B' | 'C' | 'D'] = value;
    } else if (field === 'correctAnswer') {
      updated[index].correctAnswer = value as any;
    }
    setQuestions(updated);
  };

  const handleDeleteQuestion = (index: number) => {
    const updated = questions.filter((_, i) => i !== index).map((q, i) => ({ ...q, id: i + 1 }));
    setQuestions(updated);
    toast.info(`Đã xóa Câu ${index + 1}`, `Còn lại ${updated.length} câu hỏi.`);
  };

  const handleAddQuestion = () => {
    const newQ: Question = {
      id: questions.length + 1,
      originalNumber: questions.length + 1,
      text: 'Nội dung câu hỏi mới...',
      options: {
        A: 'Phương án A',
        B: 'Phương án B',
        C: 'Phương án C',
        D: 'Phương án D',
      },
      correctAnswer: 'A',
    };
    setQuestions([...questions, newQ]);
    toast.success(`Đã thêm Câu ${questions.length + 1}`);
  };

  const answeredCount = questions.filter(q => !!q.correctAnswer).length;

  return (
    <div className="space-y-8 py-2">
      {/* Canva Style Hero */}
      <div className="text-center max-w-3xl mx-auto space-y-3 pt-2 sm:pt-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 text-xs font-bold shadow-xs">
          <span className="w-2 h-2 rounded-full bg-[#00c4cc] animate-pulse" />
          <span>Khuôn Mẫu Chuẩn: {customTemplateName}</span>
        </div>

        <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-neutral-900 dark:text-neutral-100">
          Chuẩn Hóa &amp; Xuất Đề Thi 1 Chạm
        </h2>

        <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 font-normal max-w-2xl mx-auto leading-relaxed">
          Giữ nguyên <strong>100% phần thông tin đầu đề gốc</strong> (Đơn vị, Học kỳ, Năm học, Môn thi, Thời gian). Tự động đánh dấu <strong className="text-rose-600">X đỏ</strong> vào Phiếu trả lời 60 câu và <strong>không in đậm phương án</strong> ở cả 2 bản Giảng viên &amp; Sinh viên.
        </p>

        <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
          <button
            onClick={handleLoadSample}
            className="canva-btn-secondary px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition canva-tap flex items-center gap-1.5"
          >
            <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Nạp Đề Mẫu (10 Câu)</span>
          </button>

          <a
            href="/template/MAU_DE_THI_tracnghiem.docx"
            download="MAU_DE_THI_tracnghiem.docx"
            className="canva-btn-secondary px-4 py-2 rounded-xl text-xs font-bold text-neutral-700 dark:text-neutral-200 hover:text-[#7d2ae8] transition canva-tap flex items-center gap-1.5"
          >
            <FileCode className="w-3.5 h-3.5 text-blue-500" />
            <span>Xem File Mẫu Gốc (.docx)</span>
          </a>

          <label className="canva-btn-purple-subtle px-4 py-2 rounded-xl text-xs font-bold transition canva-tap flex items-center gap-1.5 cursor-pointer">
            <input
              type="file"
              accept=".docx"
              onChange={handleCustomTemplateUpload}
              className="hidden"
            />
            <Sliders className="w-3.5 h-3.5" />
            <span>Đổi File Mẫu Khác</span>
          </label>
        </div>
      </div>

      {/* Prominent Dual Export Cards (Teacher & Student) */}
      <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Card 1: Teacher Version */}
        <div className="canva-card-interactive p-5 sm:p-6 border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent flex flex-col justify-between gap-4 shadow-sm hover:shadow-lg">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200">
                BẢN GIẢNG VIÊN / ĐÁP ÁN
              </span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                {answeredCount}/{questions.length} câu có X
              </span>
            </div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-white">
              1. Bản Giảng Viên (Có Đánh X Bảng Đáp Án)
            </h3>
            <ul className="text-xs text-neutral-500 dark:text-neutral-400 space-y-1.5">
              <li className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Tự động đánh chữ <strong className="text-rose-600">X đỏ in đậm</strong> vào Bảng Phiếu trả lời</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Nội dung phương án A, B, C, D <strong>không in đậm</strong></span>
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Giữ nguyên 100% phần thông tin đầu đề gốc</span>
              </li>
            </ul>
          </div>

          <button
            onClick={() => handleDownloadDocx(true)}
            disabled={isExporting || questions.length === 0}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition canva-tap flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Tải Bản Giảng Viên (Có Đánh X) .DOCX</span>
          </button>
        </div>

        {/* Card 2: Student Version */}
        <div className="canva-card-interactive p-5 sm:p-6 border-2 border-purple-500/30 bg-gradient-to-br from-purple-500/5 via-transparent to-transparent flex flex-col justify-between gap-4 shadow-sm hover:shadow-lg">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-[#7d2ae8] dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200">
                BẢN IN CHO SINH VIÊN
              </span>
              <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                Sạch 100%
              </span>
            </div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-white">
              2. Bản Sinh Viên Làm Bài (Đề Sạch)
            </h3>
            <ul className="text-xs text-neutral-500 dark:text-neutral-400 space-y-1.5">
              <li className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#7d2ae8] shrink-0" />
                <span>Bảng Phiếu trả lời <strong>để trống hoàn toàn</strong> cho SV tích</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#7d2ae8] shrink-0" />
                <span>Xóa sạch mọi in đậm/gạch chân lộ đáp án trong câu hỏi</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#7d2ae8] shrink-0" />
                <span>Giữ nguyên 100% phần thông tin đầu đề gốc</span>
              </li>
            </ul>
          </div>

          <button
            onClick={() => handleDownloadDocx(false)}
            disabled={isExporting || questions.length === 0}
            className="canva-btn-primary w-full py-3 rounded-xl text-xs font-bold shadow-md transition canva-tap flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Tải Bản Sinh Viên (Đề Sạch) .DOCX</span>
          </button>
        </div>
      </div>

      {/* Live Visual Preview of Table 1 (60-Question Answer Sheet Grid, 4 blocks x 15 rows) */}
      {questions.length > 0 && (
        <div className="max-w-4xl mx-auto">
          <div className="canva-card p-5 sm:p-6 space-y-4 shadow-sm border border-neutral-200/90 dark:border-neutral-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Grid className="w-4 h-4 text-[#7d2ae8]" />
                <h3 className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-white">
                  Xem Trước Bảng Phiếu Trả Lời 60 Câu (Tự động đánh dấu X đỏ)
                </h3>
              </div>
              <button
                onClick={() => setShowAnswerSheetPreview(!showAnswerSheetPreview)}
                className="canva-btn-secondary px-3 py-1 rounded-xl text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 flex items-center gap-1.5 canva-tap"
              >
                {showAnswerSheetPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showAnswerSheetPreview ? 'Thu gọn bảng' : 'Hiện bảng phiếu trả lời'}</span>
              </button>
            </div>

            {showAnswerSheetPreview && (
              <div className="overflow-x-auto">
                <p className="text-[11px] text-neutral-400 mb-3">
                  Nhấn trực tiếp vào ô <strong>A, B, C, D</strong> trong bảng dưới đây để đổi nhanh đáp án đúng trước khi tải file:
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
                  {[0, 1, 2, 3].map(blockIdx => (
                    <div
                      key={blockIdx}
                      className="rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden bg-white dark:bg-neutral-900 shadow-2xs"
                    >
                      <table className="w-full text-center border-collapse">
                        <thead>
                          <tr className="bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 font-bold border-b border-purple-100 dark:border-neutral-800">
                            <th className="py-1.5 px-1 border-r border-purple-100 dark:border-neutral-800">Câu</th>
                            <th className="py-1.5 px-1 border-r border-purple-100 dark:border-neutral-800">A</th>
                            <th className="py-1.5 px-1 border-r border-purple-100 dark:border-neutral-800">B</th>
                            <th className="py-1.5 px-1 border-r border-purple-100 dark:border-neutral-800">C</th>
                            <th className="py-1.5 px-1">D</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                          {Array.from({ length: 15 }, (_, r) => {
                            const qNum = blockIdx * 15 + r + 1;
                            const qObj = questions[qNum - 1];
                            return (
                              <tr
                                key={qNum}
                                className={qObj ? 'hover:bg-purple-50/50 dark:hover:bg-purple-950/20' : 'opacity-40'}
                              >
                                <td className="py-1 font-bold text-neutral-700 dark:text-neutral-300 border-r border-neutral-100 dark:border-neutral-800">
                                  {qNum}
                                </td>
                                {(['A', 'B', 'C', 'D'] as const).map(opt => {
                                  const isMarked = qObj?.correctAnswer === opt;
                                  return (
                                    <td
                                      key={opt}
                                      onClick={() => {
                                        if (qObj) handleQuestionChange(qNum - 1, 'correctAnswer', opt);
                                      }}
                                      className={`py-1 border-r last:border-r-0 border-neutral-100 dark:border-neutral-800 ${
                                        qObj ? 'cursor-pointer hover:bg-rose-50 dark:hover:bg-rose-950/30' : ''
                                      }`}
                                    >
                                      {isMarked ? (
                                        <span className="font-extrabold text-rose-600 dark:text-rose-400 text-xs">
                                          X
                                        </span>
                                      ) : (
                                        <span className="text-transparent select-none">·</span>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload Zone / Raw Text Input */}
      <div className="max-w-4xl mx-auto">
        <div className="canva-card p-5 sm:p-6 shadow-xs space-y-4 border border-neutral-200/90 dark:border-neutral-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
              Nạp Đề Thi Khác Hoặc Dán Văn Bản
            </span>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800">
              <button
                onClick={() => setActiveTabMode('upload')}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold transition ${
                  activeTabMode === 'upload'
                    ? 'bg-white dark:bg-neutral-900 text-[#7d2ae8] shadow-2xs'
                    : 'text-neutral-500'
                }`}
              >
                Tải File .DOCX
              </button>
              <button
                onClick={() => setActiveTabMode('text')}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold transition ${
                  activeTabMode === 'text'
                    ? 'bg-white dark:bg-neutral-900 text-[#7d2ae8] shadow-2xs'
                    : 'text-neutral-500'
                }`}
              >
                Dán Văn Bản Thô
              </button>
            </div>
          </div>

          {activeTabMode === 'upload' ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <label
                className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-3xl p-6 sm:p-8 cursor-pointer transition group ${
                  isDragging
                    ? 'border-[#7d2ae8] bg-purple-500/10 scale-[1.01]'
                    : 'border-purple-200 dark:border-purple-900/40 hover:border-[#7d2ae8] bg-purple-50/20 dark:bg-purple-950/10'
                }`}
              >
                <input
                  type="file"
                  accept=".docx,.doc"
                  onChange={handleFileUpload}
                  disabled={isProcessing}
                  className="hidden"
                />
                {isProcessing ? (
                  <div className="mb-2">
                    <DeQLogo size="md" showSubtitle={false} isLoadingMode />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-white dark:bg-neutral-800 text-[#7d2ae8] flex items-center justify-center shadow-md group-hover:scale-105 transition-transform mb-2.5 border border-purple-100">
                    <UploadCloud className="w-5 h-5" />
                  </div>
                )}
                <p className="text-xs sm:text-sm font-bold text-neutral-800 dark:text-neutral-200 text-center">
                  {isProcessing ? 'Đang phân tích đề thi...' : 'Kéo thả hoặc nhấn để chọn file đề (.docx)'}
                </p>
                <p className="text-[11px] text-neutral-400 mt-1 text-center max-w-md">
                  Nhận diện tự động đáp án đúng qua: <strong>In đậm</strong> HOẶC <strong>Gạch chân</strong> (1 trong 2 đều được), Tô đỏ, Dấu * hoặc Bảng đáp án đánh X.
                </p>
              </label>

              {uploadMessage && (
                <div className="mt-3 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 dark:text-emerald-300 text-xs font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{uploadMessage}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <textarea
                rows={6}
                value={rawTextInput}
                onChange={e => setRawTextInput(e.target.value)}
                placeholder={`Câu 1: Thủ đô của Việt Nam là gì?\n*A. Hà Nội\nB. TP. Hồ Chí Minh\nC. Đà Nẵng\nD. Cần Thơ`}
                className="w-full text-xs font-mono p-3.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 focus:ring-2 focus:ring-[#7d2ae8] outline-hidden"
              />
              <div className="flex justify-end">
                <button
                  onClick={handleParseRawText}
                  className="canva-btn-primary px-4 py-2 rounded-xl text-xs font-bold transition canva-tap"
                >
                  Chuyển Đổi Sang Dữ Liệu Chuẩn
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sticky Action Bar */}
      <div className="sticky top-20 z-30 max-w-4xl mx-auto">
        <div className="bg-white/95 dark:bg-[#181920]/95 backdrop-blur-md rounded-2xl p-3 px-5 shadow-lg flex flex-wrap items-center justify-between gap-2 border border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00c4cc] animate-pulse" />
            <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
              {questions.length} câu hỏi ({answeredCount} câu đã có đáp án)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onGoToAiAudit}
              className="canva-btn-secondary px-3.5 py-1.5 rounded-xl text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:text-[#7d2ae8] transition canva-tap flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#7d2ae8]" />
              <span>AI Soát Lỗi</span>
            </button>

            <button
              onClick={() => handleDownloadDocx(true)}
              disabled={isExporting || questions.length === 0}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition canva-tap flex items-center gap-1.5 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Bản GV (Có X)</span>
            </button>

            <button
              onClick={() => handleDownloadDocx(false)}
              disabled={isExporting || questions.length === 0}
              className="canva-btn-primary px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-xs transition canva-tap flex items-center gap-1.5 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Bản SV (Đề Sạch)</span>
            </button>

            <button
              onClick={onGoToMixer}
              disabled={questions.length === 0}
              className="canva-btn-secondary px-3.5 py-1.5 rounded-xl text-xs font-bold transition canva-tap flex items-center gap-1.5 disabled:opacity-50"
            >
              <Shuffle className="w-3.5 h-3.5 text-[#7d2ae8]" />
              <span>Trộn Mã Đề →</span>
            </button>
          </div>
        </div>
      </div>

      {/* Questions List */}
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-sm font-bold tracking-tight text-neutral-800 dark:text-neutral-200">
            Danh Sách Câu Hỏi &amp; Chỉnh Sửa Nhanh ({questions.length} câu)
          </h3>
          <button
            onClick={handleAddQuestion}
            className="canva-btn-secondary flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold canva-tap"
          >
            <Plus className="w-3.5 h-3.5 text-[#7d2ae8]" />
            <span>Thêm Câu Mới</span>
          </button>
        </div>

        {questions.length === 0 ? (
          <div className="canva-card p-12 text-center text-neutral-400 space-y-2">
            <p className="text-sm font-medium">Chưa có câu hỏi nào trong đề.</p>
            <p className="text-xs text-neutral-400">
              Hãy tải lên file Word .docx ở trên hoặc nhấn &quot;Nạp Đề Mẫu&quot;.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {questions.map((q, idx) => {
              const optionsKey: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];
              return (
                <div
                  key={q.id || idx}
                  className="canva-card-interactive p-5 space-y-3 shadow-xs border border-neutral-200/90 dark:border-neutral-800"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-xl bg-gradient-to-br from-[#7d2ae8] to-[#00c4cc] text-white text-xs font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                        Câu {idx + 1}.
                      </span>
                      {!q.correctAnswer && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                          <AlertTriangle className="w-3 h-3" /> Chưa chọn đáp án
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-neutral-400 mr-1">Đáp án đúng:</span>
                      {optionsKey.map(opt => (
                        <button
                          key={opt}
                          onClick={() => handleQuestionChange(idx, 'correctAnswer', opt)}
                          className={`w-7 h-7 rounded-xl text-xs font-bold transition canva-tap ${
                            q.correctAnswer === opt
                              ? 'bg-[#7d2ae8] text-white shadow-xs scale-105'
                              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}

                      <button
                        onClick={() => handleDeleteQuestion(idx)}
                        className="p-1.5 rounded-xl text-neutral-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition ml-1 canva-tap"
                        title="Xóa câu"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <textarea
                    rows={2}
                    value={q.text}
                    onChange={e => handleQuestionChange(idx, 'text', e.target.value)}
                    className="w-full text-xs font-medium p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 text-neutral-800 dark:text-neutral-100 outline-hidden focus:ring-2 focus:ring-[#7d2ae8] transition"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {optionsKey.map(opt => {
                      const isCorrect = q.correctAnswer === opt;
                      return (
                        <div
                          key={opt}
                          className={`flex items-center gap-2 p-2.5 rounded-xl border transition ${
                            isCorrect
                              ? 'border-[#7d2ae8] bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-100 font-semibold shadow-xs'
                              : 'border-neutral-200/70 dark:border-neutral-800 bg-white dark:bg-neutral-900'
                          }`}
                        >
                          <button
                            onClick={() => handleQuestionChange(idx, 'correctAnswer', opt)}
                            className={`w-5 h-5 rounded-full text-[11px] font-bold shrink-0 flex items-center justify-center transition ${
                              isCorrect
                                ? 'bg-[#7d2ae8] text-white'
                                : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200'
                            }`}
                          >
                            {opt}
                          </button>
                          <input
                            type="text"
                            value={q.options[opt] || ''}
                            onChange={e => handleQuestionChange(idx, opt, e.target.value)}
                            className="w-full bg-transparent text-xs font-normal text-neutral-800 dark:text-neutral-200 outline-hidden"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
