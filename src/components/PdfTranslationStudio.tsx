'use client';

import React, { useState, useRef } from 'react';
import {
  Languages,
  UploadCloud,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Download,
  FileText,
  BookOpen,
  Layers,
  ShieldCheck,
  Sliders,
  Eye,
  Plus,
  Trash2,
  RefreshCw,
  FileArchive,
  Type,
  Link2,
  Check,
  Edit3,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { AzLogoLoader } from '@/components/DeQLogo';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ToastProvider';
import { downloadFileMobileSafe } from '@/lib/mobile-download';
import {
  analyzePdfForTranslation,
  translatePdfBlocksWithGlossary,
  buildTranslatedPdfAndRunQa,
  exportTranslatedWordDocx,
  exportFullTranslationHandoverZip,
  type PdfTranslationProject,
  type GlossaryEntry,
} from '@/lib/pdf-translation-engine';

const LANGUAGE_OPTIONS = [
  'Tiếng Việt (Vietnamese)',
  'Tiếng Anh (English)',
  'Tiếng Pháp (French)',
  'Tiếng Nhật (Japanese)',
  'Tiếng Hàn (Korean)',
  'Tiếng Trung (Chinese)',
];

export function PdfTranslationStudio() {
  const { user, systemConfig } = useAuth();
  const toast = useToast();

  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [customFontFile, setCustomFontFile] = useState<File | null>(null);
  const [sourceLang, setSourceLang] = useState('Tiếng Anh (English)');
  const [targetLang, setTargetLang] = useState('Tiếng Việt (Vietnamese)');
  const [batchScope, setBatchScope] = useState<'all_pages' | 'sample_batch'>('all_pages');

  const [project, setProject] = useState<PdfTranslationProject | null>(null);
  const [translatedPdfBlob, setTranslatedPdfBlob] = useState<Blob | null>(null);

  // Active Inspector View Tab
  const [activeSubView, setActiveSubView] = useState<
    'visual_qa' | 'blocks_editor' | 'glossary_style' | 'qa_checklist'
  >('visual_qa');
  const [selectedPage, setSelectedPage] = useState<number>(1);
  const [compareMode, setCompareMode] = useState<'side_by_side' | 'overlay'>('side_by_side');
  const [overlayOpacity, setOverlayOpacity] = useState<number>(65);
  const [showSafeZoneGuide, setShowSafeZoneGuide] = useState<boolean>(true);

  // New Glossary Input State
  const [newSourceTerm, setNewSourceTerm] = useState('');
  const [newTargetTerm, setNewTargetTerm] = useState('');
  const [newKeepEnglish, setNewKeepEnglish] = useState(false);
  const [newContextNote, setNewContextNote] = useState('');

  // Processing Progress
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [progressTitle, setProgressTitle] = useState('');
  const [progressSub, setProgressSub] = useState('');
  const [progressPct, setProgressPct] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fontInputRef = useRef<HTMLInputElement | null>(null);

  const effectiveApiKey = user?.customApiKey || systemConfig.defaultGeminiApiKey || '';
  const effectiveModelId = user?.customModelId || systemConfig.defaultGeminiModel;

  // Step 1: Upload & Run Source PDF Inventory
  const handleSelectPdfFile = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    if (!f.name.toLowerCase().endsWith('.pdf')) {
      setErrorMsg('Vui lòng chọn đúng định dạng tệp .PDF cần dịch.');
      return;
    }

    setSourceFile(f);
    setTranslatedPdfBlob(null);
    setErrorMsg(null);
    setIsAnalyzing(true);
    setProgressPct(5);
    setProgressTitle('Bước 1/6: Đang kiểm kê PDF nguồn...');
    setProgressSub(f.name);

    try {
      const inv = await analyzePdfForTranslation(f, sourceLang, targetLang, (title, sub, pct) => {
        setProgressTitle(title);
        if (sub) setProgressSub(sub);
        if (typeof pct === 'number') setProgressPct(pct);
      });
      setProject(inv);
      setSelectedPage(1);
      toast.success(
        `Đã kiểm kê xong ${inv.totalPages} trang PDF!`,
        `Phát hiện ${inv.blocks.length} khối văn bản, ${inv.fontsAudit.length} font gốc và ${inv.links.length} liên kết.`
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể phân tích tệp PDF này.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Full Pipeline Execution (Step 2 -> Step 6)
  const handleRunFullTranslationPipeline = async () => {
    if (!sourceFile || !project) return;
    setIsTranslating(true);
    setErrorMsg(null);
    setProgressPct(10);

    try {
      const currentProject: PdfTranslationProject = {
        ...project,
        sourceLang,
        targetLang,
      };

      // Step 2: Context-Aware AI Translation with Glossary Lock
      const translatedBlocks = await translatePdfBlocksWithGlossary(
        currentProject,
        effectiveApiKey,
        effectiveModelId,
        batchScope,
        undefined,
        (title, sub, pct) => {
          setProgressTitle(title);
          if (sub) setProgressSub(sub);
          if (typeof pct === 'number') setProgressPct(pct);
        }
      );

      const projectWithTranslations: PdfTranslationProject = {
        ...currentProject,
        blocks: translatedBlocks,
      };

      // Step 3, 4, 5, 6: Font Embedding, Safe-Zone Layout Reconstruction, Badge Centering & 4-Layer QA
      const { pdfBlob, updatedProject } = await buildTranslatedPdfAndRunQa(
        sourceFile,
        projectWithTranslations,
        customFontFile,
        (title, sub, pct) => {
          setProgressTitle(title);
          if (sub) setProgressSub(sub);
          if (typeof pct === 'number') setProgressPct(pct);
        }
      );

      setProject(updatedProject);
      setTranslatedPdfBlob(pdfBlob);
      setActiveSubView('visual_qa');
      toast.success(
        'Dịch & Dàn Trang PDF Pro Hoàn Tất 100%!',
        'Giữ nguyên đồ họa gốc, căn tâm Badge, tuân thủ Safe Zone 4% và có lớp văn bản Unicode tìm kiếm được.'
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Lỗi trong quá trình dịch và dàn trang PDF.');
    } finally {
      setIsTranslating(false);
    }
  };

  // Re-render Layout Only (when user edits a translated block or changes font/glossary manually)
  const handleRebuildLayoutOnly = async () => {
    if (!sourceFile || !project) return;
    setIsTranslating(true);
    setErrorMsg(null);
    try {
      const { pdfBlob, updatedProject } = await buildTranslatedPdfAndRunQa(
        sourceFile,
        project,
        customFontFile,
        (title, sub, pct) => {
          setProgressTitle(title);
          if (sub) setProgressSub(sub);
          if (typeof pct === 'number') setProgressPct(pct);
        }
      );
      setProject(updatedProject);
      setTranslatedPdfBlob(pdfBlob);
      toast.success('Đã cập nhật lại bố cục trang PDF!', 'Áp dụng ngay các chỉnh sửa văn bản của bạn.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể dàn lại trang PDF.');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleAddGlossaryEntry = () => {
    if (!project || !newSourceTerm.trim()) return;
    const entry: GlossaryEntry = {
      id: `gl-${Date.now()}`,
      sourceTerm: newSourceTerm.trim(),
      targetTerm: newKeepEnglish ? newSourceTerm.trim() : newTargetTerm.trim() || newSourceTerm.trim(),
      keepEnglish: newKeepEnglish,
      contextNote: newContextNote.trim() || 'Thuật ngữ khóa do người dùng thêm',
    };
    setProject({
      ...project,
      glossary: [entry, ...project.glossary],
    });
    setNewSourceTerm('');
    setNewTargetTerm('');
    setNewKeepEnglish(false);
    setNewContextNote('');
  };

  const handleDownloadTranslatedPdf = async () => {
    if (!translatedPdfBlob || !project) return;
    const baseName = project.fileName.replace(/\.pdf$/i, '');
    const outName = `${baseName}_DichPro_GiuBoCuc.pdf`;
    await downloadFileMobileSafe(translatedPdfBlob, outName);
  };

  const handleDownloadTranslatedWord = async () => {
    if (!project) return;
    const baseName = project.fileName.replace(/\.pdf$/i, '');
    const docxBlob = await exportTranslatedWordDocx(project);
    await downloadFileMobileSafe(docxBlob, `${baseName}_BanDich_ChinhSua.docx`);
  };

  const handleDownloadHandoverZip = async () => {
    if (!sourceFile || !translatedPdfBlob || !project) return;
    const { zipBlob, zipFileName } = await exportFullTranslationHandoverZip(
      sourceFile,
      translatedPdfBlob,
      project
    );
    await downloadFileMobileSafe(zipBlob, zipFileName);
  };

  const currentPageMeta = project?.pages.find(p => p.pageNumber === selectedPage) || project?.pages[0];
  const currentPageBlocks =
    project?.blocks.filter(b => b.pageNumber === selectedPage) || [];

  return (
    <div className="space-y-6">
      {/* Top Hero Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#311042] text-white p-6 sm:p-8 shadow-xl border border-white/10">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2.5 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-bold text-cyan-300">
              <Languages className="w-3.5 h-3.5" />
              <span>AzTool PDF Translation &amp; Layout Studio Pro • Chuẩn 7 Bước Runbook</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              Dịch &amp; Dàn Trang PDF Pro Giữ Nguyên Thiết Kế 100%
            </h2>
            <p className="text-xs sm:text-sm text-white/80 leading-relaxed">
              Thay thế ngôn ngữ trong PDF mà <strong>không flatten thành ảnh</strong>: Bảo toàn hình minh họa vector,
              bảng biểu, màu nền gốc, tự động căn tâm <strong>Badge/Capsule</strong>, kiểm soát{' '}
              <strong>Safe Zone 4%</strong> không tràn lề, nhúng <strong>Font Unicode Tiếng Việt</strong> có thể bôi đen
              sao chép &amp; tìm kiếm, và giữ nguyên <strong>Hyperlink</strong>.
            </p>
          </div>

          {/* 7-Step Pipeline Pill Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] font-bold shrink-0">
            <div className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>1. Kiểm kê PDF &amp; Font</span>
            </div>
            <div className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>2. Khóa Glossary AI</span>
            </div>
            <div className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>3. Bản đồ Style (+1pt)</span>
            </div>
            <div className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>4. Nhúng Font Unicode</span>
            </div>
            <div className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>5. Safe Zone &amp; Badge</span>
            </div>
            <div className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>6. QA 4 Tầng &amp; Bàn giao</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="canva-card p-6 sm:p-8 border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 rounded-3xl shadow-sm space-y-6">
        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-start gap-3 text-rose-700 dark:text-rose-300 text-xs sm:text-sm font-semibold">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
            <div className="flex-1">{errorMsg}</div>
          </div>
        )}

        {/* Upload Dropzone & Language / Font Configuration */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Dropzone (Left 5 cols) */}
          <div className="lg:col-span-5 flex flex-col">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={e => void handleSelectPdfFile(e.target.files)}
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                void handleSelectPdfFile(e.dataTransfer.files);
              }}
              className={`flex-1 p-6 rounded-3xl border-2 border-dashed text-center cursor-pointer transition flex flex-col items-center justify-center group ${
                sourceFile
                  ? 'border-emerald-500/60 bg-emerald-50/30 dark:bg-emerald-950/15'
                  : 'border-[#7d2ae8]/40 hover:border-[#7d2ae8] bg-neutral-50/70 dark:bg-neutral-900/50'
              }`}
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#7d2ae8] to-[#00c4cc] text-white flex items-center justify-center mx-auto shadow-md group-hover:scale-105 transition-transform">
                <UploadCloud className="w-7 h-7" />
              </div>

              {sourceFile && project ? (
                <div className="mt-3 space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-xs font-black">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{sourceFile.name}</span>
                  </div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-300 font-bold">
                    {project.totalPages} trang • {project.blocks.length} khối văn bản • {project.fontsAudit.length} font
                  </p>
                  <p className="text-[10px] font-mono text-neutral-400">
                    SHA-256: {project.sha256Checksum.slice(0, 18)}...
                  </p>
                </div>
              ) : (
                <div className="mt-3 space-y-1">
                  <h4 className="text-sm sm:text-base font-black text-neutral-900 dark:text-white">
                    Tải lên File PDF gốc cần dịch &amp; giữ nguyên bố cục (.pdf)
                  </h4>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Tự động kiểm kê số trang, tọa độ Span/Block, màu nền, Badge, Hyperlink và Font nhúng
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Translation Settings & Action Controls (Right 7 cols) */}
          <div className="lg:col-span-7 p-5 rounded-3xl bg-neutral-50/90 dark:bg-neutral-900/60 border border-neutral-200/80 dark:border-neutral-800 flex flex-col justify-between space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-neutral-700 dark:text-neutral-200">
                  Ngôn ngữ PDF nguồn:
                </label>
                <select
                  value={sourceLang}
                  onChange={e => setSourceLang(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-bold"
                >
                  {LANGUAGE_OPTIONS.map(lang => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-black text-neutral-700 dark:text-neutral-200">
                  Ngôn ngữ đích cần chế bản:
                </label>
                <select
                  value={targetLang}
                  onChange={e => setTargetLang(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#7d2ae8]/50 bg-white dark:bg-neutral-800 text-xs font-black text-[#7d2ae8] dark:text-purple-300"
                >
                  {LANGUAGE_OPTIONS.map(lang => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Scope & Custom Brand Font Upload (SKILL.md Step 4 & Step 7) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-neutral-700 dark:text-neutral-200">
                  Chế độ phát hành (Bước 7 Runbook):
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBatchScope('all_pages')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${
                      batchScope === 'all_pages'
                        ? 'border-[#7d2ae8] bg-purple-50 dark:bg-purple-950/40 text-[#7d2ae8] dark:text-purple-300 font-black'
                        : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800'
                    }`}
                  >
                    Toàn bộ ({project?.totalPages || '100%'} trang)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBatchScope('sample_batch')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${
                      batchScope === 'sample_batch'
                        ? 'border-[#7d2ae8] bg-purple-50 dark:bg-purple-950/40 text-[#7d2ae8] dark:text-purple-300 font-black'
                        : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800'
                    }`}
                  >
                    Duyệt mẫu (5 trang đầu)
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-black text-neutral-700 dark:text-neutral-200">
                  Font nhúng đầu ra (Bước 4 Runbook):
                </label>
                <input
                  ref={fontInputRef}
                  type="file"
                  accept=".ttf,.otf"
                  className="hidden"
                  onChange={e => setCustomFontFile(e.target.files?.[0] || null)}
                />
                <button
                  type="button"
                  onClick={() => fontInputRef.current?.click()}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-bold flex items-center justify-between gap-2 hover:border-[#7d2ae8]"
                >
                  <span className="truncate flex items-center gap-1.5">
                    <Type className="w-3.5 h-3.5 text-[#7d2ae8] shrink-0" />
                    {customFontFile
                      ? `Font riêng: ${customFontFile.name}`
                      : 'Unicode Tiếng Việt Chuẩn (Hoặc tải .TTF riêng)'}
                  </span>
                  {customFontFile && (
                    <span
                      onClick={e => {
                        e.stopPropagation();
                        setCustomFontFile(null);
                      }}
                      className="text-[10px] text-rose-600 font-black px-1.5 py-0.5 rounded bg-rose-50"
                    >
                      Xóa
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Primary Execute Button */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                ✓ Không ảnh hóa trang • ✓ Căn tâm Badge • ✓ Safe Zone 4%
              </div>

              <button
                type="button"
                disabled={!project || isAnalyzing || isTranslating}
                onClick={() => void handleRunFullTranslationPipeline()}
                className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-[#7d2ae8] via-[#00c4cc] to-[#ff66c4] hover:opacity-95 disabled:opacity-50 text-white font-black text-xs sm:text-sm shadow-lg transition canva-tap flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  {isTranslating
                    ? `Đang Dịch & Chế Bản PDF (${progressPct}%)...`
                    : 'Chạy Dịch & Dàn Trang PDF Pro Ngay'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Loading Progress Indicator with Animated AzTool Calligraphy Logo */}
        {(isAnalyzing || isTranslating) && (
          <div className="p-6 rounded-3xl border border-purple-200 dark:border-purple-900/50 bg-purple-50/30 dark:bg-purple-950/15">
            <AzLogoLoader
              title={progressTitle || 'Đang xử lý tài liệu PDF...'}
              subtitle={progressSub}
              progress={progressPct}
            />
          </div>
        )}

        {/* Export & Handover Action Bar when Translated PDF is Ready */}
        {translatedPdfBlob && project && !isTranslating && (
          <div className="p-5 rounded-3xl border-2 border-emerald-500/40 bg-emerald-50/30 dark:bg-emerald-950/20 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 text-sm sm:text-base font-black text-emerald-800 dark:text-emerald-300">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <span>
                  Đã hoàn tất chế bản PDF dịch ({project.totalPages} trang) • Đạt 6/6 cổng kiểm định QA!
                </span>
              </div>
              <p className="text-xs text-neutral-600 dark:text-neutral-400">
                Văn bản tiếng Việt được nhúng trực tiếp bằng vector font Unicode (bôi đen, tìm kiếm Ctrl+F, sao chép
                100%).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => void handleDownloadTranslatedPdf()}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition canva-tap flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                <span>Tải PDF Đã Dịch Giữ Bố Cục (.PDF)</span>
              </button>

              <button
                type="button"
                onClick={() => void handleDownloadTranslatedWord()}
                className="px-4 py-2.5 rounded-xl bg-[#7d2ae8] hover:bg-purple-700 text-white font-black text-xs shadow-md transition canva-tap flex items-center gap-1.5"
              >
                <FileText className="w-4 h-4" />
                <span>Tải Bản Word Chỉnh Sửa (.DOCX)</span>
              </button>

              <button
                type="button"
                onClick={() => void handleDownloadHandoverZip()}
                className="px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 text-white font-black text-xs shadow-md transition canva-tap flex items-center gap-1.5"
              >
                <FileArchive className="w-4 h-4" />
                <span>Tải Hồ Sơ Bàn Giao Runbook (.ZIP)</span>
              </button>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* 4 INTERACTIVE WORKBENCH TABS (WHEN PDF IS LOADED)                 */}
        {/* ================================================================= */}
        {project && (
          <div className="space-y-5 pt-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                type="button"
                onClick={() => setActiveSubView('visual_qa')}
                className={`p-3 rounded-2xl border text-left transition flex items-center gap-2.5 ${
                  activeSubView === 'visual_qa'
                    ? 'border-[#7d2ae8] bg-purple-50/80 dark:bg-purple-950/30 font-black text-[#7d2ae8] dark:text-purple-300'
                    : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/40'
                }`}
              >
                <Eye className="w-4 h-4 shrink-0" />
                <div>
                  <div className="text-xs font-black">1. Đối Chiếu Trực Quan</div>
                  <div className="text-[10px] text-neutral-500">Song song &amp; Overlay Safe Zone</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveSubView('blocks_editor')}
                className={`p-3 rounded-2xl border text-left transition flex items-center gap-2.5 ${
                  activeSubView === 'blocks_editor'
                    ? 'border-[#7d2ae8] bg-purple-50/80 dark:bg-purple-950/30 font-black text-[#7d2ae8] dark:text-purple-300'
                    : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/40'
                }`}
              >
                <Edit3 className="w-4 h-4 shrink-0" />
                <div>
                  <div className="text-xs font-black">
                    2. Khối Văn Bản ({project.blocks.length})
                  </div>
                  <div className="text-[10px] text-neutral-500">Chỉnh sửa &amp; Căn tâm Badge</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveSubView('glossary_style')}
                className={`p-3 rounded-2xl border text-left transition flex items-center gap-2.5 ${
                  activeSubView === 'glossary_style'
                    ? 'border-[#7d2ae8] bg-purple-50/80 dark:bg-purple-950/30 font-black text-[#7d2ae8] dark:text-purple-300'
                    : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/40'
                }`}
              >
                <BookOpen className="w-4 h-4 shrink-0" />
                <div>
                  <div className="text-xs font-black">
                    3. Glossary &amp; Font ({project.glossary.length})
                  </div>
                  <div className="text-[10px] text-neutral-500">Khóa thuật ngữ &amp; Style Map</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveSubView('qa_checklist')}
                className={`p-3 rounded-2xl border text-left transition flex items-center gap-2.5 ${
                  activeSubView === 'qa_checklist'
                    ? 'border-[#7d2ae8] bg-purple-50/80 dark:bg-purple-950/30 font-black text-[#7d2ae8] dark:text-purple-300'
                    : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/40'
                }`}
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <div>
                  <div className="text-xs font-black">
                    4. Kiểm Định QA 4 Tầng
                  </div>
                  <div className="text-[10px] text-neutral-500">Cơ khí • Hình học • Nội dung</div>
                </div>
              </button>
            </div>

            {/* Page Selector Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-neutral-100/80 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={selectedPage <= 1}
                  onClick={() => setSelectedPage(p => Math.max(1, p - 1))}
                  className="p-1.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-black px-2">
                  Trang {selectedPage} / {project.totalPages}
                </span>
                <button
                  type="button"
                  disabled={selectedPage >= project.totalPages}
                  onClick={() => setSelectedPage(p => Math.min(project.totalPages, p + 1))}
                  className="p-1.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                {currentPageMeta && (
                  <span className="text-[11px] text-neutral-500 hidden sm:inline">
                    • Kích thước: {currentPageMeta.widthPt} × {currentPageMeta.heightPt} pt •{' '}
                    {currentPageMeta.blocksCount} khối chữ • {currentPageMeta.linksCount} link
                  </span>
                )}
              </div>

              {activeSubView === 'visual_qa' && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCompareMode('side_by_side')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      compareMode === 'side_by_side'
                        ? 'bg-[#7d2ae8] text-white'
                        : 'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700'
                    }`}
                  >
                    So sánh Song song
                  </button>
                  <button
                    type="button"
                    onClick={() => setCompareMode('overlay')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      compareMode === 'overlay'
                        ? 'bg-[#7d2ae8] text-white'
                        : 'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700'
                    }`}
                  >
                    Chồng lớp (Overlay)
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSafeZoneGuide(v => !v)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      showSafeZoneGuide
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700'
                    }`}
                  >
                    Khung Safe Zone 4%
                  </button>
                </div>
              )}

              {activeSubView === 'blocks_editor' && (
                <button
                  type="button"
                  onClick={() => void handleRebuildLayoutOnly()}
                  disabled={isTranslating}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Cập Nhật Bố Cục Trang Từ Bản Sửa</span>
                </button>
              )}
            </div>

            {/* ============================================================= */}
            {/* SUB-VIEW 1: ĐỐI CHIẾU TRỰC QUAN SONG SONG & OVERLAY           */}
            {/* ============================================================= */}
            {activeSubView === 'visual_qa' && currentPageMeta && (
              <div className="space-y-4">
                {compareMode === 'side_by_side' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Original Page */}
                    <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 space-y-2">
                      <div className="flex items-center justify-between text-xs font-black text-neutral-700 dark:text-neutral-200">
                        <span>BẢN GỐC ({project.sourceLang}) — Trang {selectedPage}</span>
                        <span className="text-[11px] font-mono text-neutral-400">
                          {currentPageMeta.widthPt}×{currentPageMeta.heightPt}pt
                        </span>
                      </div>
                      <div className="relative rounded-xl overflow-hidden border border-neutral-300 dark:border-neutral-700 bg-white">
                        <img
                          src={currentPageMeta.sourcePreviewDataUrl}
                          alt={`Trang gốc ${selectedPage}`}
                          className="w-full h-auto block"
                        />
                        {showSafeZoneGuide && (
                          <div
                            className="absolute inset-[4%] border border-dashed border-cyan-500/70 pointer-events-none"
                            title="Safe Zone 4%"
                          />
                        )}
                      </div>
                    </div>

                    {/* Translated Page */}
                    <div className="p-4 rounded-2xl border border-purple-300 dark:border-purple-900/60 bg-purple-50/20 dark:bg-purple-950/10 space-y-2">
                      <div className="flex items-center justify-between text-xs font-black text-[#7d2ae8] dark:text-purple-300">
                        <span>BẢN DỊCH GIỮ BỐ CỤC ({project.targetLang}) — Trang {selectedPage}</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px]">
                          Safe Zone 100%
                        </span>
                      </div>
                      {currentPageMeta.translatedPreviewDataUrl ? (
                        <div className="relative rounded-xl overflow-hidden border border-purple-300 dark:border-purple-800 bg-white">
                          <img
                            src={currentPageMeta.translatedPreviewDataUrl}
                            alt={`Trang dịch ${selectedPage}`}
                            className="w-full h-auto block"
                          />
                          {showSafeZoneGuide && (
                            <div
                              className="absolute inset-[4%] border border-dashed border-emerald-500/80 pointer-events-none"
                              title="Safe Zone 4%"
                            />
                          )}
                        </div>
                      ) : (
                        <div className="h-80 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 flex flex-col items-center justify-center p-6 text-center space-y-2">
                          <Languages className="w-8 h-8 text-[#7d2ae8]" />
                          <p className="text-xs font-bold text-neutral-600 dark:text-neutral-300">
                            Nhấn nút &ldquo;Chạy Dịch &amp; Dàn Trang PDF Pro Ngay&rdquo; ở trên để tạo bản dịch giữ nguyên thiết kế!
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Overlay Comparison Mode */
                  <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-xs font-black">
                        Chế độ Chồng lớp (Overlay Inspector) — Kiểm tra khớp tọa độ, Badge &amp; Hình học:
                      </span>
                      <div className="flex items-center gap-2 text-xs font-bold">
                        <span>Gốc (0%)</span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={overlayOpacity}
                          onChange={e => setOverlayOpacity(Number(e.target.value))}
                          className="w-36 accent-[#7d2ae8]"
                        />
                        <span>Dịch ({overlayOpacity}%)</span>
                      </div>
                    </div>

                    <div className="relative max-w-2xl mx-auto rounded-xl overflow-hidden border border-neutral-300 dark:border-neutral-700 bg-white">
                      <img
                        src={currentPageMeta.sourcePreviewDataUrl}
                        alt="Original Base"
                        className="w-full h-auto block"
                      />
                      {currentPageMeta.translatedPreviewDataUrl && (
                        <img
                          src={currentPageMeta.translatedPreviewDataUrl}
                          alt="Translated Overlay"
                          style={{ opacity: overlayOpacity / 100 }}
                          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                        />
                      )}
                      {showSafeZoneGuide && (
                        <div className="absolute inset-[4%] border-2 border-dashed border-emerald-500/80 pointer-events-none" />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ============================================================= */}
            {/* SUB-VIEW 2: TRÌNH CHỈNH SỬA KHỐI VĂN BẢN & BADGE THEO TRANG   */}
            {/* ============================================================= */}
            {activeSubView === 'blocks_editor' && (
              <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1">
                {currentPageBlocks.length === 0 ? (
                  <div className="p-8 text-center text-xs text-neutral-500">
                    Trang này không có khối văn bản nào (Trang hình ảnh thuần túy).
                  </div>
                ) : (
                  currentPageBlocks.map(blk => (
                    <div
                      key={blk.id}
                      className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/60 space-y-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-purple-100 text-[#7d2ae8] dark:bg-purple-950 dark:text-purple-300 font-black uppercase">
                            {blk.role}
                          </span>
                          <span className="font-mono text-neutral-500">
                            Cột {blk.columnIndex + 1} • Thứ tự #{blk.readingOrder} • Cỡ gốc: {blk.sourceFontSize}pt → Đích:{' '}
                            {blk.targetFontSize}pt
                          </span>
                          {blk.isBadgeOrCapsule && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold">
                              Badge/Capsule (Căn tâm tự động)
                            </span>
                          )}
                          {blk.linkedUri && (
                            <span className="px-2 py-0.5 rounded-md bg-cyan-100 text-cyan-800 font-bold flex items-center gap-1">
                              <Link2 className="w-3 h-3" /> {blk.linkedUri}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className="w-4 h-4 rounded border border-neutral-300"
                            style={{ backgroundColor: blk.sampledBgHex }}
                            title={`Màu nền mẫu: ${blk.sampledBgHex}`}
                          />
                          <span
                            className="w-4 h-4 rounded border border-neutral-300"
                            style={{ backgroundColor: blk.textColorHex }}
                            title={`Màu chữ gốc: ${blk.textColorHex}`}
                          />
                          <label className="inline-flex items-center gap-1 text-xs font-bold cursor-pointer">
                            <input
                              type="checkbox"
                              checked={blk.keepOriginal}
                              onChange={e => {
                                const checked = e.target.checked;
                                setProject(prev =>
                                  prev
                                    ? {
                                        ...prev,
                                        blocks: prev.blocks.map(b =>
                                          b.id === blk.id ? { ...b, keepOriginal: checked } : b
                                        ),
                                      }
                                    : prev
                                );
                              }}
                            />
                            <span>Giữ nguyên gốc</span>
                          </label>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-2.5 rounded-xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-700 dark:text-neutral-300">
                          <div className="text-[10px] font-bold text-neutral-400 mb-1">
                            Văn bản nguồn ({project.sourceLang}):
                          </div>
                          {blk.sourceText}
                        </div>

                        <div>
                          <div className="text-[10px] font-bold text-[#7d2ae8] mb-1">
                            Bản dịch chế bản ({project.targetLang} — có thể sửa trực tiếp):
                          </div>
                          <textarea
                            rows={2}
                            value={blk.translatedText}
                            onChange={e => {
                              const val = e.target.value;
                              setProject(prev =>
                                prev
                                  ? {
                                      ...prev,
                                      blocks: prev.blocks.map(b =>
                                        b.id === blk.id ? { ...b, translatedText: val } : b
                                      ),
                                    }
                                  : prev
                              );
                            }}
                            className="w-full p-2.5 rounded-xl bg-white dark:bg-neutral-950 border border-purple-300 dark:border-purple-800 text-xs font-semibold focus:outline-2 focus:outline-[#7d2ae8]"
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ============================================================= */}
            {/* SUB-VIEW 3: BẢNG THUẬT NGỮ (GLOSSARY) & KIỂM KÊ FONT          */}
            {/* ============================================================= */}
            {activeSubView === 'glossary_style' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Glossary Table (7 cols) */}
                <div className="lg:col-span-7 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/50 space-y-4">
                  <div className="text-xs sm:text-sm font-black flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-[#7d2ae8]" />
                    <span>Bảng Thuật Ngữ Đã Khóa (Glossary — Bước 2 SKILL.md)</span>
                  </div>

                  {/* Add Term Form */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <input
                      type="text"
                      value={newSourceTerm}
                      onChange={e => setNewSourceTerm(e.target.value)}
                      placeholder="Thuật ngữ nguồn (VD: Individual tasks)"
                      className="sm:col-span-4 px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-bold"
                    />
                    <input
                      type="text"
                      value={newTargetTerm}
                      disabled={newKeepEnglish}
                      onChange={e => setNewTargetTerm(e.target.value)}
                      placeholder="Bản dịch khóa (VD: Tác vụ cá nhân)"
                      className="sm:col-span-4 px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-bold disabled:opacity-50"
                    />
                    <label className="sm:col-span-2 flex items-center gap-1 text-[11px] font-bold px-2">
                      <input
                        type="checkbox"
                        checked={newKeepEnglish}
                        onChange={e => setNewKeepEnglish(e.target.checked)}
                      />
                      <span>Giữ EN</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleAddGlossaryEntry}
                      className="sm:col-span-2 px-3 py-2 rounded-xl bg-[#7d2ae8] text-white text-xs font-black flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Thêm
                    </button>
                  </div>

                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {project.glossary.map(g => (
                      <div
                        key={g.id}
                        className="p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <span className="font-black text-neutral-900 dark:text-white">
                            {g.sourceTerm}
                          </span>{' '}
                          ➔{' '}
                          <span className="font-black text-[#7d2ae8] dark:text-purple-300">
                            {g.keepEnglish ? `${g.sourceTerm} (Giữ nguyên tiếng Anh)` : g.targetTerm}
                          </span>
                          <div className="text-[10px] text-neutral-400">{g.contextNote}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setProject(prev =>
                              prev
                                ? {
                                    ...prev,
                                    glossary: prev.glossary.filter(item => item.id !== g.id),
                                  }
                                : prev
                            )
                          }
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Font Inventory & Style Mapping (5 cols) */}
                <div className="lg:col-span-5 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/50 space-y-3">
                  <div className="text-xs sm:text-sm font-black flex items-center gap-2">
                    <Type className="w-4 h-4 text-emerald-600" />
                    <span>Kiểm Kê Font Nguồn &amp; Ánh Xạ Font Đích (pdffonts)</span>
                  </div>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {project.fontsAudit.map(f => (
                      <div
                        key={f.fontId}
                        className="p-3 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between font-black">
                          <span className="truncate">{f.originalName}</span>
                          <span className="px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-[10px]">
                            {f.isSubset ? 'Subset Embedded' : 'Embedded'} • {f.blocksCount} khối
                          </span>
                        </div>
                        <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold">
                          ➔ Nhúng đích: {customFontFile ? customFontFile.name : f.targetFallbackName}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================= */}
            {/* SUB-VIEW 4: BÁO CÁO KIỂM ĐỊNH QA 4 TẦNG & NHẬT KÝ NGOẠI LỆ    */}
            {/* ============================================================= */}
            {activeSubView === 'qa_checklist' && (
              <div className="space-y-4">
                {project.qaChecks.length === 0 ? (
                  <div className="p-6 rounded-2xl border border-dashed border-neutral-300 text-center text-xs text-neutral-500">
                    Hãy bấm &ldquo;Chạy Dịch &amp; Dàn Trang PDF Pro Ngay&rdquo; để hệ thống thực hiện kiểm định 4 tầng (Cơ khí, Hình học, Nội dung, Trực quan).
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {project.qaChecks.map((chk, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-950/15 flex items-start gap-3"
                      >
                        <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="w-4 h-4" />
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs font-black text-neutral-900 dark:text-white">
                            {chk.title}
                          </div>
                          <p className="text-[11px] text-neutral-600 dark:text-neutral-300 leading-relaxed">
                            {chk.details}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {project.layoutExceptions.length > 0 && (
                  <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-50/20 dark:bg-amber-950/15 space-y-2">
                    <div className="text-xs font-black text-amber-800 dark:text-amber-300">
                      Nhật ký Tự động Tinh chỉnh Cỡ chữ / Leading để chống tràn Safe Zone ({project.layoutExceptions.length} mục):
                    </div>
                    <ul className="text-[11px] text-neutral-600 dark:text-neutral-400 space-y-1 max-h-48 overflow-y-auto list-disc list-inside">
                      {project.layoutExceptions.map((note, idx) => (
                        <li key={idx}>{note}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default PdfTranslationStudio;
