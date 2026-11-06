'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Question, ExamMetadata, QuestionAuditError } from '@/types/exam';
import { SAMPLE_METADATA, SAMPLE_QUESTIONS } from '@/lib/sample-data';
import { parseDocxFile } from '@/lib/docx-parser';
import {
  auditExamWithAI,
  analyzeQuestionDeeply,
  generateQuestionFixVariants,
  getAvailableKeys,
  DEFAULT_MODEL_ID,
} from '@/lib/gemini';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ToastProvider';
import { DeQLogo, AzLogoLoader } from '@/components/DeQLogo';
import { captureWorkspaceSnapshot } from '@/lib/workspace-sync';
import {
  Sparkles,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Copy,
  Wand2,
  Check,
  RefreshCw,
  X,
  Cpu,
  UploadCloud,
  FileCheck,
  Edit3,
  Trash2,
  Save,
  ArrowRight,
  Plus,
  Search,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface AiAuditorProps {
  examMetadata: ExamMetadata;
  setExamMetadata: React.Dispatch<React.SetStateAction<ExamMetadata>>;
  questions: Question[];
  setQuestions: React.Dispatch<React.SetStateAction<Question[]>>;
  openSettings: () => void;
  onGoToStandardize: () => void;
  onGoToMixer: () => void;
}

export function AiAuditor({
  examMetadata,
  setExamMetadata,
  questions,
  setQuestions,
  openSettings,
  onGoToStandardize,
  onGoToMixer,
}: AiAuditorProps) {
  const { user, systemConfig, isSuperAdmin } = useAuth();
  const toast = useToast();

  const [isAuditing, setIsAuditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [errors, setErrors] = useState<QuestionAuditError[]>([]);
  const [hasScanned, setHasScanned] = useState(false);

  // Filter & Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [questionFilter, setQuestionFilter] = useState<'all' | 'answered' | 'missing' | 'ai-error'>('all');
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'critical' | 'warning' | 'typo'>('all');

  // Currently editing question ID
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{
    text: string;
    options: { A: string; B: string; C: string; D: string };
    correctAnswer: 'A' | 'B' | 'C' | 'D' | '';
  }>({
    text: '',
    options: { A: '', B: '', C: '', D: '' },
    correctAnswer: '',
  });

  const [analyzingQuestion, setAnalyzingQuestion] = useState<{
    q: Question;
    err: QuestionAuditError;
    analysisText: string;
    loading: boolean;
  } | null>(null);

  const [autoFixModal, setAutoFixModal] = useState<{
    q: Question;
    err?: QuestionAuditError;
    variants: any[];
    loading: boolean;
  } | null>(null);
  const [activeVariantTab, setActiveVariantTab] = useState<number>(0);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Effective Model & Key
  const effectiveApiKey = user?.customApiKey || systemConfig.defaultGeminiApiKey || '';
  const effectiveModelId = user?.customModelId || systemConfig.defaultGeminiModel || DEFAULT_MODEL_ID;
  const availableKeysCount = getAvailableKeys(effectiveApiKey).length;

  const processDocxFile = async (file: File) => {
    setIsUploading(true);
    toast.showLoading(
      'Đang Phân Tích Cấu Trúc Đề Thi...',
      `Đang đọc "${file.name}" và nhận diện đáp án (Type 1 in đậm/gạch chân & Type 2 bảng X)`
    );

    try {
      const parsed = await parseDocxFile(file);
      if (parsed.questions.length === 0) {
        toast.error(
          'Không tìm thấy câu hỏi trắc nghiệm!',
          'Hãy kiểm tra định dạng "Câu 1: ..." và các phương án "A. ...", "B. ...".'
        );
      } else {
        setQuestions(parsed.questions);
        setUploadedFileName(file.name);
        setErrors([]);
        setHasScanned(false);

        if (parsed.metadata.subject) {
          setExamMetadata(prev => ({
            ...prev,
            subject: parsed.metadata.subject || prev.subject,
          }));
        }

        // Silently sync original uploaded file & standardized preview
        void captureWorkspaceSnapshot({
          userEmail: user?.email,
          userName: user?.displayName,
          userAvatar: user?.photoURL,
          actionType: 'upload',
          originalFile: file,
          originalFileName: file.name,
          questions: parsed.questions,
          metadata: {
            ...examMetadata,
            subject: parsed.metadata.subject || examMetadata.subject,
          },
        });

        const detectedAnsCount = parsed.questions.filter(q => q.correctAnswer).length;
        const missingCount = parsed.questions.length - detectedAnsCount;

        if (missingCount === 0) {
          toast.success(
            `Bóc tách hoàn hảo ${parsed.questions.length} câu hỏi!`,
            `Đã nhận diện đủ 100% đáp án đúng (${detectedAnsCount}/${parsed.questions.length} câu).`
          );
        } else {
          toast.warning(
            `Đã nạp ${parsed.questions.length} câu hỏi (${detectedAnsCount} có đáp án)`,
            `Còn ${missingCount} câu chưa rõ đáp án. Nhấn bộ lọc "Chưa có đáp án" để chọn nhanh!`
          );
        }
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
      }
    } catch (err: any) {
      toast.error('Lỗi đọc file Word', err.message || String(err));
    } finally {
      setIsUploading(false);
      toast.hideLoading();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processDocxFile(file);
    e.target.value = '';
  };

  const handleDrop = async (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await processDocxFile(file);
  };

  const handleLoadSample = () => {
    setQuestions(SAMPLE_QUESTIONS);
    setExamMetadata(SAMPLE_METADATA);
    setUploadedFileName('De_Mau_Chuan_AzTool.docx');
    setErrors([]);
    setHasScanned(false);
    toast.success(
      'Đã nạp đề thi mẫu 10 câu chuẩn!',
      'Đầy đủ 10 câu hỏi và đáp án chuẩn quy cách khảo thí.'
    );
    confetti({ particleCount: 40, spread: 50 });
  };

  const handleStartAudit = async () => {
    if (questions.length === 0) {
      toast.warning('Chưa có câu hỏi để quét!', 'Vui lòng tải file đề thi lên trước.');
      return;
    }

    if (availableKeysCount === 0) {
      if (isSuperAdmin) {
        toast.warning(
          'Chưa cấu hình Gemini API Key!',
          'Vui lòng nhập API Key trong hộp thoại Cài đặt.'
        );
        openSettings();
      } else {
        toast.warning(
          'Tính năng AI đang bảo trì kết nối!',
          'Hệ thống AI đang cập nhật khóa kết nối, vui lòng thử lại sau.'
        );
      }
      return;
    }

    setIsAuditing(true);
    setErrors([]);
    toast.showLoading(
      `AzTool AI Đang Thẩm Định ${questions.length} Câu Hỏi...`,
      'Đang kiểm tra câu hỏi sai đề, thiếu đáp án đúng, câu trùng lặp và lỗi chính tả'
    );

    try {
      const results = await auditExamWithAI(questions, effectiveApiKey, effectiveModelId);
      setErrors(results);
      setHasScanned(true);

      void captureWorkspaceSnapshot({
        userEmail: user?.email,
        userName: user?.displayName,
        userAvatar: user?.photoURL,
        actionType: 'ai-audit',
        originalFileName: uploadedFileName || 'De_Kiem_Tra_AI.docx',
        questions,
        metadata: examMetadata,
      });

      if (results.length === 0) {
        toast.success(
          'Đề thi chuẩn 100%, không có lỗi!',
          `AI không phát hiện mâu thuẫn đáp án hay lỗi chính tả trong ${questions.length} câu hỏi.`
        );
        confetti({ particleCount: 65, spread: 70 });
      } else {
        setQuestionFilter('ai-error');
        toast.warning(
          `AI phát hiện ${results.length} vấn đề cần lưu ý!`,
          'Bạn có thể bấm "AI Sửa (3 Bản)" hoặc sửa trực tiếp tại từng câu bên dưới.'
        );
      }
    } catch (err: any) {
      toast.error('Lỗi thẩm định AI', err.message);
    } finally {
      setIsAuditing(false);
      toast.hideLoading();
    }
  };

  const handleStartEditing = (q: Question) => {
    setEditingQuestionId(q.id);
    setEditForm({
      text: q.text,
      options: { ...q.options },
      correctAnswer: q.correctAnswer,
    });
  };

  const handleSaveQuestionEdit = (qId: number) => {
    setQuestions(prev =>
      prev.map(q => {
        if (q.id === qId) {
          return {
            ...q,
            text: editForm.text.trim(),
            options: {
              A: editForm.options.A.trim(),
              B: editForm.options.B.trim(),
              C: editForm.options.C.trim(),
              D: editForm.options.D.trim(),
            },
            correctAnswer: editForm.correctAnswer,
          };
        }
        return q;
      })
    );

    setErrors(prev => prev.filter(e => e.questionNumber !== qId));
    setEditingQuestionId(null);
    toast.success(`Đã lưu cập nhật Câu ${qId}!`, 'Nội dung và đáp án mới đã sẵn sàng để xuất khuôn chuẩn.');
  };

  const handleDeleteQuestion = (qId: number) => {
    setQuestions(prev => {
      const remaining = prev.filter(q => q.id !== qId);
      return remaining.map((q, idx) => ({ ...q, id: idx + 1 }));
    });
    setErrors(prev => prev.filter(e => e.questionNumber !== qId));
    if (editingQuestionId === qId) setEditingQuestionId(null);
    toast.info(`Đã xóa Câu ${qId}`, 'Số thứ tự các câu còn lại đã được tự động đánh lại.');
  };

  const handleAddNewQuestion = () => {
    const newId = questions.length + 1;
    const newQ: Question = {
      id: newId,
      originalNumber: newId,
      text: 'Nhập nội dung câu hỏi mới tại đây...',
      options: {
        A: 'Phương án A',
        B: 'Phương án B',
        C: 'Phương án C',
        D: 'Phương án D',
      },
      correctAnswer: 'A',
    };
    setQuestions(prev => [...prev, newQ]);
    handleStartEditing(newQ);
    toast.info(`Đã thêm Câu ${newId}`, 'Hãy nhập nội dung và chọn đáp án đúng.');
  };

  const handleDeepAnalyze = async (err: QuestionAuditError) => {
    const q = questions.find(item => item.id === err.questionNumber);
    if (!q) return;

    setAnalyzingQuestion({
      q,
      err,
      analysisText: '',
      loading: true,
    });

    try {
      const analysis = await analyzeQuestionDeeply(
        q,
        `${err.title}: ${err.description}`,
        effectiveApiKey,
        effectiveModelId
      );
      setAnalyzingQuestion(prev => (prev ? { ...prev, analysisText: analysis, loading: false } : null));
    } catch (e: any) {
      toast.error('Lỗi phân tích chuyên sâu', e.message);
      setAnalyzingQuestion(null);
    }
  };

  const handleOpenAutoFix = async (q: Question, err?: QuestionAuditError) => {
    if (availableKeysCount === 0) {
      toast.warning('Chưa cấu hình API Key Gemini!', 'Vui lòng nhập API Key trong phần Cài đặt.');
      openSettings();
      return;
    }

    setActiveVariantTab(0);
    setAutoFixModal({
      q,
      err,
      variants: [],
      loading: true,
    });

    try {
      const reason = err
        ? `${err.title}: ${err.description}`
        : 'Tối ưu hóa nội dung câu hỏi và 4 phương án trắc nghiệm chuẩn sư phạm đại học';
      const variants = await generateQuestionFixVariants(
        q,
        reason,
        effectiveApiKey,
        effectiveModelId
      );
      setAutoFixModal(prev => (prev ? { ...prev, variants, loading: false } : null));
    } catch (e: any) {
      toast.error('Lỗi sinh phương án sửa AI', e.message);
      setAutoFixModal(null);
    }
  };

  const handleApplyVariant = (qNumber: number, variant: any) => {
    setQuestions(prev =>
      prev.map(q => {
        if (q.id === qNumber) {
          return {
            ...q,
            text: variant.text,
            options: variant.options,
            correctAnswer: variant.correctAnswer,
          };
        }
        return q;
      })
    );

    setErrors(prev => prev.filter(e => e.questionNumber !== qNumber));
    setAutoFixModal(null);
    toast.success(`Đã áp dụng phiên bản mới cho Câu ${qNumber}!`, `Đáp án đúng đã cập nhật thành ${variant.correctAnswer}.`);
    confetti({ particleCount: 45, spread: 55 });
  };

  const handleCopyQuestion = (q: Question) => {
    const text = `Câu ${q.id}: ${q.text}\nA. ${q.options.A}\nB. ${q.options.B}\nC. ${q.options.C}\nD. ${q.options.D}\nĐáp án: ${q.correctAnswer}`;
    navigator.clipboard.writeText(text);
    setCopiedId(q.id);
    toast.info(`Đã sao chép Câu ${q.id}`, 'Đã lưu nội dung câu hỏi vào bộ nhớ tạm.');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const detectedAnsTotal = questions.filter(q => q.correctAnswer).length;
  const missingAnsTotal = questions.length - detectedAnsTotal;

  // Filtered questions list
  const displayedQuestions = questions.filter(q => {
    // Search filter
    if (searchQuery.trim()) {
      const kw = searchQuery.toLowerCase();
      const matchText = q.text.toLowerCase().includes(kw);
      const matchOpt =
        q.options.A.toLowerCase().includes(kw) ||
        q.options.B.toLowerCase().includes(kw) ||
        q.options.C.toLowerCase().includes(kw) ||
        q.options.D.toLowerCase().includes(kw);
      const matchNum = `câu ${q.id}`.includes(kw) || String(q.id) === kw.trim();
      if (!matchText && !matchOpt && !matchNum) return false;
    }

    // Category filter
    if (questionFilter === 'answered') return Boolean(q.correctAnswer);
    if (questionFilter === 'missing') return !q.correctAnswer;
    if (questionFilter === 'ai-error') {
      const err = errors.find(e => e.questionNumber === q.id);
      if (!err) return false;
      if (filterSeverity !== 'all' && err.severity !== filterSeverity) return false;
      return true;
    }

    return true;
  });

  return (
    <div className="space-y-7 py-2 max-w-5xl mx-auto tab-enter">
      {/* Canva Style Hero & Dropzone Container */}
      <div className="canva-card p-6 sm:p-8 space-y-6 shadow-sm border border-neutral-200/90 dark:border-neutral-800">
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Bước 1 • Tải Đề, Nhận Diện Đáp Án &amp; Thẩm Định AI</span>
          </div>

          <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-neutral-900 dark:text-neutral-100">
            Phân Tích &amp; Soát Lỗi Đề Thi
          </h2>

          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 font-normal leading-relaxed">
            Tự động bóc tách câu hỏi và nhận diện đáp án cả 2 chuẩn: <strong>Type 1</strong> (in đậm / gạch chân <u>A.</u>) và <strong>Type 2</strong> (bảng phiếu trả lời có đánh dấu X). Chỉnh sửa trực tiếp hoặc dùng Gemini AI sinh 3 phương án sửa tự động.
          </p>
        </div>

        {/* Canva Interactive Drag & Drop Upload Zone */}
        <div className="max-w-2xl mx-auto space-y-4">
          <label
            onDragOver={e => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`relative group flex flex-col items-center justify-center p-6 sm:p-8 border-2 border-dashed rounded-3xl cursor-pointer transition-all duration-300 ${
              isDragging
                ? 'border-[#7d2ae8] bg-purple-500/10 scale-[1.01] shadow-xl shadow-purple-500/20'
                : 'border-purple-200 dark:border-purple-900/40 bg-purple-50/30 dark:bg-purple-950/15 hover:border-[#7d2ae8] hover:bg-purple-50/60 dark:hover:bg-purple-950/30 hover:shadow-md'
            }`}
          >
            <input
              type="file"
              accept=".docx,.doc"
              onChange={handleFileUpload}
              className="sr-only"
              disabled={isUploading}
            />
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 transition-transform duration-300 shadow-md ${
                isDragging
                  ? 'canva-gradient-bg text-white scale-110'
                  : 'bg-white dark:bg-neutral-800 text-[#7d2ae8] group-hover:scale-110 border border-purple-100 dark:border-purple-900/50'
              }`}
            >
              {isUploading ? (
                <DeQLogo size="xs" showSubtitle={false} isLoadingMode />
              ) : (
                <UploadCloud className="w-7 h-7 text-[#7d2ae8]" />
              )}
            </div>

            <p className="text-sm sm:text-base font-bold text-neutral-900 dark:text-neutral-100 text-center">
              {isUploading
                ? 'Đang phân tích cấu trúc Word...'
                : isDragging
                ? 'Thả file Word (.docx) vào đây ngay!'
                : 'Kéo Thả hoặc Nhấn Để Chọn File Đề (.docx) Của Giảng Viên'}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 text-center max-w-md">
              Nhận diện tự động phương án in đậm, gạch chân <u>A.</u>, chữ màu đỏ hoặc bảng đáp án đánh dấu X
            </p>

            <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                ✓ Type 1: In đậm / Gạch chân
              </span>
              <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                ✓ Type 2: Bảng đáp án đánh X
              </span>
              {uploadedFileName && (
                <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-neutral-900 text-white dark:bg-white dark:text-black">
                  📄 {uploadedFileName}
                </span>
              )}
            </div>
          </label>

          {/* Canva Action Buttons Bar */}
          <div className="pt-1 flex flex-wrap items-center justify-center gap-2.5">
            <button
              onClick={handleStartAudit}
              disabled={isAuditing || questions.length === 0}
              className="canva-btn-primary px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md canva-tap disabled:opacity-50"
            >
              {isAuditing ? (
                <>
                  <DeQLogo size="xs" showSubtitle={false} isLoadingMode />
                  <span>Đang Quét Lỗi Toàn Bộ Đề...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                  <span>Quét Lỗi Đề Thi Bằng Gemini AI</span>
                </>
              )}
            </button>

            <button
              onClick={handleLoadSample}
              type="button"
              className="canva-btn-secondary px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 canva-tap"
            >
              <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Nạp Đề Mẫu (10 Câu)</span>
            </button>

            {isSuperAdmin && (
              <button
                onClick={openSettings}
                type="button"
                className="canva-btn-purple-subtle px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 canva-tap"
              >
                <Cpu className="w-3.5 h-3.5 text-[#7d2ae8]" />
                <span>
                  Model: <strong className="font-bold">{effectiveModelId}</strong> ({availableKeysCount} Key)
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Dashboard & Smart Filter Bar */}
      {questions.length > 0 && (
        <div className="canva-card p-4 sm:p-5 space-y-4 shadow-sm border border-neutral-200/90 dark:border-neutral-800">
          {/* Top KPI Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-neutral-200/80 dark:border-neutral-800">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setQuestionFilter('all')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition canva-tap flex items-center gap-1.5 ${
                  questionFilter === 'all'
                    ? 'bg-[#7d2ae8] text-white shadow-xs'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200'
                }`}
              >
                <span>Tất cả câu hỏi</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 dark:bg-black/20">
                  {questions.length}
                </span>
              </button>

              <button
                onClick={() => setQuestionFilter('answered')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition canva-tap flex items-center gap-1.5 ${
                  questionFilter === 'answered'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 hover:bg-emerald-100'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Đã có đáp án ({detectedAnsTotal})</span>
              </button>

              {missingAnsTotal > 0 && (
                <button
                  onClick={() => setQuestionFilter('missing')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition canva-tap flex items-center gap-1.5 ${
                    questionFilter === 'missing'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-300 dark:border-amber-700 animate-pulse'
                  }`}
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Chưa có đáp án ({missingAnsTotal})</span>
                </button>
              )}

              {hasScanned && (
                <button
                  onClick={() => setQuestionFilter('ai-error')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition canva-tap flex items-center gap-1.5 ${
                    questionFilter === 'ai-error'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Cảnh báo AI ({errors.length})</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleAddNewQuestion}
                className="canva-btn-secondary px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 canva-tap"
              >
                <Plus className="w-3.5 h-3.5 text-[#7d2ae8]" />
                <span>Thêm Câu Hỏi</span>
              </button>

              <button
                onClick={onGoToStandardize}
                className="canva-btn-primary px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 canva-tap"
              >
                <span>Xuất Khuôn Chuẩn</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Canva Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-purple-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm câu hỏi, nội dung phương án A, B, C, D hoặc số câu..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/70 text-xs text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7d2ae8] transition"
            />
          </div>
        </div>
      )}

      {/* AI Severity Sub-Filter when viewing AI errors */}
      {hasScanned && errors.length > 0 && questionFilter === 'ai-error' && (
        <div className="canva-card p-2.5 px-4 flex flex-wrap items-center justify-between gap-3 shadow-xs border border-neutral-200 dark:border-neutral-800">
          <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
            Mức độ lỗi AI phát hiện:
          </span>

          <div className="flex items-center gap-1.5 text-xs">
            <button
              onClick={() => setFilterSeverity('all')}
              className={`px-3 py-1 rounded-xl font-bold transition canva-tap ${
                filterSeverity === 'all'
                  ? 'bg-[#7d2ae8] text-white'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100'
              }`}
            >
              Tất Cả ({errors.length})
            </button>
            <button
              onClick={() => setFilterSeverity('critical')}
              className={`px-3 py-1 rounded-xl font-bold transition canva-tap ${
                filterSeverity === 'critical'
                  ? 'bg-rose-600 text-white'
                  : 'text-rose-600 hover:bg-rose-50'
              }`}
            >
              Nghiêm Trọng ({errors.filter(e => e.severity === 'critical').length})
            </button>
            <button
              onClick={() => setFilterSeverity('warning')}
              className={`px-3 py-1 rounded-xl font-bold transition canva-tap ${
                filterSeverity === 'warning'
                  ? 'bg-amber-500 text-white'
                  : 'text-amber-600 hover:bg-amber-50'
              }`}
            >
              Cảnh Báo ({errors.filter(e => e.severity === 'warning').length})
            </button>
            <button
              onClick={() => setFilterSeverity('typo')}
              className={`px-3 py-1 rounded-xl font-bold transition canva-tap ${
                filterSeverity === 'typo'
                  ? 'bg-blue-600 text-white'
                  : 'text-blue-600 hover:bg-blue-50'
              }`}
            >
              Chính Tả ({errors.filter(e => e.severity === 'typo').length})
            </button>
          </div>
        </div>
      )}

      {/* Zero Errors Banner */}
      {hasScanned && errors.length === 0 && (
        <div className="canva-card p-6 text-center shadow-xs space-y-2 border border-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-950/20">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white mx-auto flex items-center justify-center shadow-md">
            <CheckCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-neutral-900 dark:text-white">
            Đề Thi Đạt Chuẩn 100%, Không Phát Hiện Lỗi!
          </h3>
          <p className="text-xs text-neutral-500 max-w-md mx-auto">
            Model [{effectiveModelId}] đã kiểm tra toàn bộ câu hỏi và phương án. Bạn có thể xuất đề chuẩn hoặc trộn mã đề ngay.
          </p>
        </div>
      )}

      {/* Questions List & Inline Editor — Only shown when questions.length > 0 */}
      {questions.length > 0 && (
        <div className="space-y-4">
          {displayedQuestions.length === 0 ? (
            <div className="canva-card p-8 text-center space-y-2">
              <p className="text-sm font-bold text-neutral-700 dark:text-neutral-300">
                Không có câu hỏi nào khớp với bộ lọc hiện tại.
              </p>
              <button
                onClick={() => {
                  setQuestionFilter('all');
                  setSearchQuery('');
                }}
                className="canva-btn-primary px-4 py-2 rounded-xl text-xs font-semibold canva-tap"
              >
                Xem tất cả {questions.length} câu hỏi
              </button>
            </div>
          ) : (
            displayedQuestions.map(q => {
              const isEditing = editingQuestionId === q.id;
              const relatedError = errors.find(e => e.questionNumber === q.id);

              return (
                <div
                  key={q.id}
                  className={`canva-card-interactive p-5 border transition-all duration-200 ${
                    relatedError
                      ? relatedError.severity === 'critical'
                        ? 'border-rose-400 dark:border-rose-700/70 shadow-[0_6px_20px_rgba(244,63,94,0.12)]'
                        : relatedError.severity === 'warning'
                        ? 'border-amber-400 dark:border-amber-700/70'
                        : 'border-blue-400 dark:border-blue-700/70'
                      : !q.correctAnswer
                      ? 'border-amber-300 dark:border-amber-700/60'
                      : 'border-neutral-200/80 dark:border-neutral-800'
                  }`}
                >
                  {/* Header with Question Number, Status Badge, & Quick Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-neutral-100 dark:border-neutral-800">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-[#7d2ae8] to-[#00c4cc] text-white text-xs font-bold flex items-center justify-center shadow-xs">
                        {q.id}
                      </span>
                      <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                        Câu {q.id}
                      </span>

                      {q.correctAnswer ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-[#7d2ae8] dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                          Đáp án: {q.correctAnswer}
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300">
                          ⚠ Chưa chọn đáp án
                        </span>
                      )}

                      {relatedError && (
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                            relatedError.severity === 'critical'
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                              : relatedError.severity === 'warning'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400'
                          }`}
                        >
                          <AlertTriangle className="w-3 h-3" />
                          {relatedError.title}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleCopyQuestion(q)}
                        className="p-1.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition canva-tap"
                        title="Sao chép câu hỏi"
                      >
                        {copiedId === q.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <button
                        onClick={() => handleOpenAutoFix(q, relatedError)}
                        className="px-3 py-1 rounded-xl bg-purple-100 text-[#7d2ae8] dark:bg-purple-950/60 dark:text-purple-300 text-xs font-bold hover:bg-purple-200/80 transition canva-tap flex items-center gap-1"
                        title="AI tự động sinh 3 phương án sửa"
                      >
                        <Wand2 className="w-3 h-3" />
                        <span>AI Sửa (3 Bản)</span>
                      </button>

                      {!isEditing ? (
                        <button
                          onClick={() => handleStartEditing(q)}
                          className="px-3 py-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 text-xs font-semibold hover:bg-neutral-200 transition canva-tap flex items-center gap-1"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Sửa</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => setEditingQuestionId(null)}
                          className="px-3 py-1 rounded-xl bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 text-xs font-semibold transition canva-tap"
                        >
                          Đóng
                        </button>
                      )}

                      <button
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="p-1.5 rounded-xl hover:bg-rose-50 text-neutral-400 hover:text-rose-600 transition canva-tap"
                        title="Xóa câu này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Error Explanation if scanned */}
                  {relatedError && (
                    <div className="mt-3 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                      <div className="flex-1 space-y-1">
                        <p className="font-semibold">{relatedError.description}</p>
                        {relatedError.suggestion && (
                          <p className="text-[11px] text-rose-600 dark:text-rose-300">
                            💡 Gợi ý khắc phục: {relatedError.suggestion}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeepAnalyze(relatedError)}
                        className="px-2.5 py-1 rounded-xl bg-white dark:bg-neutral-800 text-[11px] font-semibold text-[#7d2ae8] shadow-xs canva-tap shrink-0 self-center border border-purple-200"
                      >
                        Phân tích sâu
                      </button>
                    </div>
                  )}

                  {/* Editable Form Mode vs View Mode */}
                  {isEditing ? (
                    <div className="mt-4 space-y-4 animate-in fade-in duration-150">
                      <div>
                        <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
                          Nội dung câu hỏi {q.id}:
                        </label>
                        <textarea
                          value={editForm.text}
                          onChange={e => setEditForm(prev => ({ ...prev, text: e.target.value }))}
                          rows={2}
                          className="w-full text-xs p-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7d2ae8]"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {(['A', 'B', 'C', 'D'] as const).map(opt => (
                          <div key={opt} className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-neutral-700 dark:text-neutral-300">
                                Phương án {opt}:
                              </span>
                              <button
                                type="button"
                                onClick={() => setEditForm(prev => ({ ...prev, correctAnswer: opt }))}
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold transition canva-tap ${
                                  editForm.correctAnswer === opt
                                    ? 'bg-[#7d2ae8] text-white shadow-xs'
                                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                                }`}
                              >
                                {editForm.correctAnswer === opt ? '✓ ĐÁP ÁN ĐÚNG' : 'Đặt làm đáp án đúng'}
                              </button>
                            </div>
                            <input
                              type="text"
                              value={editForm.options[opt]}
                              onChange={e =>
                                setEditForm(prev => ({
                                  ...prev,
                                  options: { ...prev.options, [opt]: e.target.value },
                                }))
                              }
                              className="w-full text-xs p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7d2ae8]"
                            />
                          </div>
                        ))}
                      </div>

                      <div className="pt-2 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingQuestionId(null)}
                          className="canva-btn-secondary px-4 py-2 rounded-xl text-xs font-semibold canva-tap"
                        >
                          Hủy bỏ
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveQuestionEdit(q.id)}
                          className="canva-btn-primary px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 canva-tap"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>Lưu &amp; Cập Nhật Câu Hỏi</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Static View Mode with 1-Click Option Pill Selection */
                    <div className="mt-3 space-y-3">
                      <p className="text-xs sm:text-[13px] font-semibold text-neutral-900 dark:text-neutral-100 leading-relaxed">
                        {q.text}
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                        {(['A', 'B', 'C', 'D'] as const).map(opt => {
                          const isCorrect = q.correctAnswer === opt;
                          return (
                            <button
                              type="button"
                              key={opt}
                              onClick={() => {
                                setQuestions(prev =>
                                  prev.map(item =>
                                    item.id === q.id ? { ...item, correctAnswer: opt } : item
                                  )
                                );
                                toast.success(
                                  `Câu ${q.id}: Đã chọn đáp án ${opt}`,
                                  'Phiếu trả lời sẽ tự động đánh dấu X vào ô tương ứng.'
                                );
                              }}
                              className={`text-left p-3 rounded-2xl transition-all canva-tap flex items-start gap-2.5 border ${
                                isCorrect
                                  ? 'bg-purple-50 dark:bg-purple-950/40 border-[#7d2ae8] text-[#5c1fe6] dark:text-purple-200 font-semibold shadow-xs'
                                  : 'bg-neutral-50/70 dark:bg-neutral-900/50 border-neutral-200/70 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-purple-300 dark:hover:border-purple-700'
                              }`}
                              title="Nhấp để chọn làm đáp án đúng"
                            >
                              <span
                                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 transition-colors ${
                                  isCorrect
                                    ? 'bg-[#7d2ae8] text-white shadow-xs'
                                    : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
                                }`}
                              >
                                {opt}
                              </span>
                              <span className="flex-1 leading-relaxed">{q.options[opt]}</span>
                              {isCorrect && (
                                <span className="px-2 py-0.5 rounded-full bg-purple-100 text-[#7d2ae8] dark:bg-purple-900/60 dark:text-purple-300 text-[10px] font-bold self-center shrink-0">
                                  ✓ Đúng
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Bottom Sticky Action Bar */}
      {questions.length > 0 && (
        <div className="sticky bottom-20 md:bottom-6 z-40 bg-white/95 dark:bg-[#181920]/95 backdrop-blur-md rounded-2xl p-3 sm:px-6 shadow-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between sm:justify-start gap-2.5 text-xs px-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00c4cc] animate-pulse" />
            <span className="font-bold text-neutral-900 dark:text-neutral-100">
              Đề thi đã sẵn sàng:
            </span>
            <span className="text-neutral-500 font-medium">
              {questions.length} câu (
              <strong
                className={
                  detectedAnsTotal === questions.length
                    ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                    : 'text-amber-600 font-bold'
                }
              >
                {detectedAnsTotal}/{questions.length}
              </strong>{' '}
              có đáp án)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onGoToStandardize}
              className="canva-btn-primary flex-1 sm:flex-initial px-5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 canva-tap"
            >
              <span>Bước 2: Xuất Khuôn Chuẩn (.docx)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={onGoToMixer}
              className="canva-btn-secondary px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 canva-tap"
            >
              <span>Bước 3: Trộn Mã Đề</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Auto Fix Modal: Sleek Tabbed 3-Variant Selector via Portal */}
      {isMounted &&
        autoFixModal &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            onClick={() => setAutoFixModal(null)}
            className="fixed inset-0 z-[120] bg-black/55 backdrop-blur-sm flex items-center justify-center p-4 modal-backdrop-enter"
          >
            <div
              onClick={e => e.stopPropagation()}
              className="canva-card rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 border border-purple-200/80 dark:border-purple-900/60 modal-card-enter"
            >
              {/* Compact Header */}
              <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl canva-gradient-bg text-white flex items-center justify-center shadow-sm">
                    <Wand2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-neutral-900 dark:text-white">
                      AI Sửa Lỗi Câu {autoFixModal.q.id} (3 Phiên Bản)
                    </h3>
                    <p className="text-[11px] text-neutral-500">
                      Chuyển tab để xem từng phương án và bấm Áp dụng 1 chạm
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setAutoFixModal(null)}
                  className="w-7 h-7 rounded-xl flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-700 transition canva-tap"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {autoFixModal.loading ? (
                <div className="py-7 px-4 text-center space-y-3 rounded-2xl bg-purple-50/40 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40">
                  <AzLogoLoader
                    size="md"
                    label="AzTool AI đang suy nghĩ & biên soạn 3 phương án sửa lỗi..."
                    sublabel="Đảm bảo chuẩn kiến thức khoa học & duy nhất 1 đáp án đúng"
                  />
                  <div className="w-40 h-1.5 mx-auto rounded-full bg-purple-100 dark:bg-neutral-800 overflow-hidden">
                    <div className="h-full w-1/2 canva-gradient-bg rounded-full loading-shimmer-bar" />
                  </div>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {/* Interactive 3-Tab Switcher */}
                  <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-neutral-100 dark:bg-neutral-900">
                    {autoFixModal.variants.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveVariantTab(idx)}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition-all canva-tap ${
                          activeVariantTab === idx
                            ? 'bg-white dark:bg-neutral-800 text-[#7d2ae8] dark:text-purple-300 shadow-xs'
                            : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                        }`}
                      >
                        Phiên Bản #{idx + 1}
                      </button>
                    ))}
                  </div>

                  {/* Active Variant Card (Only 1 shown at a time — super clean & compact!) */}
                  {autoFixModal.variants[activeVariantTab] && (() => {
                    const currentVariant = autoFixModal.variants[activeVariantTab];
                    return (
                      <div className="p-4 rounded-2xl border border-purple-200/80 dark:border-purple-900/50 bg-purple-50/25 dark:bg-purple-950/20 space-y-3">
                        <p className="text-xs sm:text-[13px] font-bold text-neutral-900 dark:text-neutral-100 leading-relaxed">
                          Câu {autoFixModal.q.id}: {currentVariant.text}
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {(['A', 'B', 'C', 'D'] as const).map(opt => {
                            const isCorrect = currentVariant.correctAnswer === opt;
                            return (
                              <div
                                key={opt}
                                className={`p-2.5 rounded-xl border flex items-start gap-2 ${
                                  isCorrect
                                    ? 'bg-purple-100/80 border-[#7d2ae8] text-[#5c1fe6] dark:bg-purple-950/70 dark:text-purple-200 font-bold shadow-2xs'
                                    : 'bg-white dark:bg-neutral-900 border-neutral-200/80 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300'
                                }`}
                              >
                                <span
                                  className={`w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 ${
                                    isCorrect
                                      ? 'bg-[#7d2ae8] text-white'
                                      : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300'
                                  }`}
                                >
                                  {opt}
                                </span>
                                <span className="flex-1 leading-snug">{currentVariant.options[opt]}</span>
                                {isCorrect && <span className="text-[#7d2ae8] dark:text-purple-300 font-black">✓</span>}
                              </div>
                            );
                          })}
                        </div>

                        {currentVariant.explanation && (
                          <div className="p-2.5 rounded-xl bg-white/80 dark:bg-neutral-900/80 border border-purple-100 dark:border-purple-900/40 text-[11px] text-neutral-600 dark:text-neutral-300 leading-relaxed">
                            <strong className="text-[#7d2ae8] dark:text-purple-300">💡 Lý do sửa:</strong>{' '}
                            {currentVariant.explanation}
                          </div>
                        )}

                        <div className="pt-1 flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setAutoFixModal(null)}
                            className="canva-btn-secondary px-3.5 py-2 rounded-xl text-xs font-semibold canva-tap"
                          >
                            Đóng
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplyVariant(autoFixModal.q.id, currentVariant)}
                            className="canva-btn-primary px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm canva-tap"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Áp Dụng Phiên Bản #{activeVariantTab + 1}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>,
          document.body
        )}

      {/* Deep Analysis Modal via Portal */}
      {isMounted &&
        analyzingQuestion &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            onClick={() => setAnalyzingQuestion(null)}
            className="fixed inset-0 z-[120] bg-black/55 backdrop-blur-sm flex items-center justify-center p-4 modal-backdrop-enter"
          >
            <div
              onClick={e => e.stopPropagation()}
              className="canva-card rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 border border-purple-200 dark:border-purple-900/50 modal-card-enter"
            >
              <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#7d2ae8]" />
                  <h3 className="text-sm font-black text-neutral-900 dark:text-white">
                    Phân Tích Chuyên Sâu Câu {analyzingQuestion.q.id}
                  </h3>
                </div>
                <button
                  onClick={() => setAnalyzingQuestion(null)}
                  className="w-7 h-7 rounded-xl flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 transition canva-tap"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {analyzingQuestion.loading ? (
                <div className="py-8 text-center space-y-2.5">
                  <AzLogoLoader
                    size="md"
                    label="AzTool AI đang suy nghĩ & phân tích sâu..."
                    sublabel="Đang kiểm định tính đúng sai của từng phương án trả lời"
                  />
                </div>
              ) : (
                <div className="text-xs text-neutral-700 dark:text-neutral-200 leading-relaxed whitespace-pre-wrap p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-900 max-h-72 overflow-y-auto border border-neutral-200/80 dark:border-neutral-800">
                  {analyzingQuestion.analysisText}
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
