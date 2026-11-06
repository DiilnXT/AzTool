'use client';

import React, { useState, useEffect, useRef } from 'react';
import { saveAs } from 'file-saver';
import confetti from 'canvas-confetti';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ToastProvider';
import { AzLogoLoader } from '@/components/DeQLogo';
import { captureWorkspaceSnapshot } from '@/lib/workspace-sync';
import { SAMPLE_METADATA } from '@/lib/sample-data';
import { getAvailableKeys } from '@/lib/gemini';
import {
  convertPdfToExcel,
  splitPdfByCount,
  splitPdfFile,
  generatePdfPageThumbnails,
  exportVisualOrganizedPdf,
  getPdfPageCount,
  ExcelExtractedCell,
  PdfPageThumbnailItem,
} from '@/lib/pdf-office-engine';
import {
  FileSpreadsheet,
  Scissors,
  UploadCloud,
  Download,
  CheckCircle2,
  Sparkles,
  RotateCw,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Copy,
  KeyRound,
  FileOutput,
  LayoutGrid,
  Check,
  RefreshCcw,
  ClipboardPaste,
  Table as TableIcon,
} from 'lucide-react';

export type PdfToolId = 'split_pdf_studio' | 'ocr_to_excel';

export function PdfOfficeStudio() {
  const { user, systemConfig, saveUserApiKey } = useAuth();
  const toast = useToast();

  // Only 2 core tools per user instruction:
  // 1) 'split_pdf_studio': Cắt & Tách PDF theo trang setting (Phạm vi trang / Số lượng trang / Thumbnail)
  // 2) 'ocr_to_excel': Nhìn Ảnh & PDF Scan (AI Vision OCR) -> Bảng tính Excel (.xlsx) & Copy Word chuẩn 100%
  const [activeTool, setActiveTool] = useState<PdfToolId>('ocr_to_excel');

  // Shared file state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [detectedPageCount, setDetectedPageCount] = useState<number>(0);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [progressTitle, setProgressTitle] = useState('');
  const [progressSub, setProgressSub] = useState('');

  // Inline API Key state for Vision OCR
  const [inlineApiKey, setInlineApiKey] = useState('');
  const [savedKeyCount, setSavedKeyCount] = useState(0);

  // ============================================================================
  // STATE FOR TOOL 1: CẮT & TÁCH PDF THEO TRANG SETTING (split_pdf_studio)
  // ============================================================================
  const [splitMethod, setSplitMethod] = useState<'by_range' | 'by_count' | 'visual_select'>('by_range');
  const [rangePreset, setRangePreset] = useState<'ALL' | 'ODD' | 'EVEN' | 'CUSTOM'>('CUSTOM');
  const [customPageRange, setCustomPageRange] = useState('1-3');
  const [rangeOutputFormat, setRangeOutputFormat] = useState<'extract-single' | 'separate-files'>('extract-single');
  const [pagesPerChunk, setPagesPerChunk] = useState<number>(5);

  // Split results
  const [splitSingleResult, setSplitSingleResult] = useState<{
    blob: Blob;
    fileName: string;
    summary: string;
  } | null>(null);
  const [splitChunksResult, setSplitChunksResult] = useState<{
    zipBlob: Blob;
    zipName: string;
    chunks: { fileName: string; blob: Blob; pageRange: string }[];
  } | null>(null);

  // Visual thumbnails for visual_select
  const [visualThumbnails, setVisualThumbnails] = useState<PdfPageThumbnailItem[]>([]);
  const [isLoadingThumbnails, setIsLoadingThumbnails] = useState(false);

  // ============================================================================
  // STATE FOR TOOL 2: NHÌN ẢNH / PDF SCAN OCR -> EXCEL CHUẨN 100% (ocr_to_excel)
  // ============================================================================
  const [ocrPageRangeMode, setOcrPageRangeMode] = useState<'ALL' | 'CUSTOM'>('ALL');
  const [ocrCustomPages, setOcrCustomPages] = useState('1');
  const [excelSheetMode, setExcelSheetMode] = useState<'single_sheet' | 'sheet_per_page'>('single_sheet');
  const [ocrResult, setOcrResult] = useState<{
    blob: Blob;
    fileName: string;
    pagesProcessed: number;
    totalRows: number;
    previewRows: ExcelExtractedCell[][];
  } | null>(null);
  const [copiedWordTable, setCopiedWordTable] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync API keys from Auth / LocalStorage
  useEffect(() => {
    const rawKeys = [
      user?.customApiKey || '',
      systemConfig?.defaultGeminiApiKey || '',
      typeof window !== 'undefined' ? localStorage.getItem('deq_gemini_keys') || '' : '',
    ]
      .filter(Boolean)
      .join(',');
    const keys = getAvailableKeys(rawKeys);
    setSavedKeyCount(keys.length);
    if (keys.length > 0 && !inlineApiKey) {
      setInlineApiKey(keys.join(', '));
    }
  }, [user, systemConfig]);

  // Global Ctrl+V clipboard image paste support when on 'ocr_to_excel'
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (activeTool !== 'ocr_to_excel') return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            const ext = item.type.split('/')[1] || 'png';
            const pastedFile = new File(
              [blob],
              `Anh_Dan_Clipboard_${new Date().toISOString().slice(11, 19).replace(/:/g, '-')}.${ext}`,
              { type: item.type }
            );
            void handleSelectFile(pastedFile);
            toast.success(
              'Đã dán ảnh bảng biểu từ Clipboard (Ctrl+V)!',
              'Bấm nút "Chạy AI Vision OCR & Xuất Excel (.xlsx)" để bóc tách ngay.'
            );
            break;
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [activeTool]);

  const handleSaveInlineApiKey = () => {
    const trimmed = inlineApiKey.trim();
    if (!trimmed) {
      toast.warning('Vui lòng dán Gemini API Key vào ô trống.');
      return;
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('deq_gemini_keys', trimmed);
      localStorage.setItem('deq_gemini_api_key', trimmed);
    }
    saveUserApiKey(trimmed);
    const keys = getAvailableKeys(trimmed);
    setSavedKeyCount(keys.length);
    toast.success(
      `Đã lưu ${keys.length} Gemini API Key!`,
      'AI Vision OCR đã sẵn sàng đọc 100% ảnh chụp và PDF Scan sang Excel.'
    );
  };

  const resetResults = () => {
    setSplitSingleResult(null);
    setSplitChunksResult(null);
    setOcrResult(null);
    setCopiedWordTable(false);
  };

  const handleSelectFile = async (file: File) => {
    resetResults();
    setSelectedFile(file);

    const isImg =
      file.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp)$/i.test(file.name);

    if (isImg) {
      setDetectedPageCount(1);
      const reader = new FileReader();
      reader.onload = () => setImagePreviewUrl(String(reader.result || ''));
      reader.readAsDataURL(file);
    } else {
      setImagePreviewUrl(null);
      const count = await getPdfPageCount(file);
      setDetectedPageCount(count);
      if (count > 0) {
        setCustomPageRange(`1-${Math.min(count, 3)}`);
        setOcrCustomPages(count > 3 ? '1-3' : `1-${count}`);
      }
      if (activeTool === 'split_pdf_studio' && splitMethod === 'visual_select') {
        void loadVisualThumbnails(file);
      }
    }
  };

  const loadVisualThumbnails = async (file: File) => {
    setIsLoadingThumbnails(true);
    try {
      const thumbs = await generatePdfPageThumbnails(file, (title, sub, pct) => {
        setProgressTitle(title);
        setProgressSub(sub || '');
        if (typeof pct === 'number') setProgressPct(pct);
      });
      setVisualThumbnails(thumbs);
    } catch (err: any) {
      toast.error('Không thể tạo ảnh xem trước trang PDF', err.message || String(err));
    } finally {
      setIsLoadingThumbnails(false);
    }
  };

  // ============================================================================
  // EXECUTE TOOL 1: CẮT & TÁCH PDF THEO TRANG SETTING
  // ============================================================================
  const handleRunSplitPdf = async () => {
    if (!selectedFile) {
      toast.warning('Vui lòng tải lên 1 file PDF cần cắt/tách trang.');
      return;
    }

    setIsProcessing(true);
    setProgressPct(10);
    resetResults();

    const baseName = selectedFile.name.replace(/\.pdf$/i, '');
    const updateProgress = (title: string, sub?: string, pct?: number) => {
      setProgressTitle(title);
      setProgressSub(sub || '');
      if (typeof pct === 'number') setProgressPct(pct);
      toast.showLoading(title, sub, pct);
    };

    try {
      if (splitMethod === 'by_range') {
        const effectiveRange = rangePreset === 'CUSTOM' ? customPageRange : rangePreset;
        const res = await splitPdfFile(
          selectedFile,
          rangeOutputFormat,
          effectiveRange,
          updateProgress
        );
        const outName = res.isZip
          ? `${baseName}_TachRoi_${res.extractedCount}Trang.zip`
          : `${baseName}_CatTrang_${effectiveRange.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;

        setSplitSingleResult({
          blob: res.outputBlob,
          fileName: outName,
          summary: res.isZip
            ? `Đã tách rời ${res.extractedCount} trang thành các file PDF riêng biệt trong gói .ZIP`
            : `Đã cắt và trích xuất ${res.extractedCount} trang (${effectiveRange}) thành 1 file PDF chuẩn`,
        });
        saveAs(res.outputBlob, outName);
        toast.success('Cắt / Tách trang PDF thành công!', `Đã tự động tải về "${outName}".`);
      } else if (splitMethod === 'by_count') {
        const res = await splitPdfByCount(selectedFile, pagesPerChunk, updateProgress);
        const zipName = `${baseName}_CatMoiFile_${pagesPerChunk}Trang.zip`;
        setSplitChunksResult({
          zipBlob: res.zipBlob,
          zipName,
          chunks: res.chunks,
        });
        saveAs(res.zipBlob, zipName);
        toast.success(
          `Đã chia thành ${res.chunks.length} file PDF nhỏ!`,
          `Mỗi file gồm tối đa ${pagesPerChunk} trang. Bạn có thể tải lẻ từng phần hoặc trọn bộ .ZIP.`
        );
      } else if (splitMethod === 'visual_select') {
        const res = await exportVisualOrganizedPdf(
          selectedFile,
          visualThumbnails,
          updateProgress
        );
        const outName = `${baseName}_DaCatChon_${res.finalPageCount}Trang.pdf`;
        setSplitSingleResult({
          blob: res.blob,
          fileName: outName,
          summary: `Đã xuất ${res.finalPageCount} trang được giữ lại theo đúng thứ tự và góc xoay trực quan`,
        });
        saveAs(res.blob, outName);
        toast.success('Đã xuất file PDF theo các trang đã chọn!', `Đã tải về "${outName}".`);
      }

      confetti({ particleCount: 55, spread: 60 });
    } catch (err: any) {
      toast.error('Lỗi khi cắt trang PDF', err.message || String(err));
    } finally {
      setIsProcessing(false);
      toast.hideLoading();
    }
  };

  // ============================================================================
  // EXECUTE TOOL 2: NHÌN ẢNH / PDF SCAN (AI VISION OCR) -> EXCEL (.XLSX) & WORD
  // ============================================================================
  const handleRunOcrToExcel = async () => {
    if (!selectedFile) {
      toast.warning('Vui lòng chọn Ảnh chụp bảng biểu (.png, .jpg) hoặc file PDF Scan (.pdf)!');
      return;
    }

    const activeApiKeys = [
      inlineApiKey.trim(),
      user?.customApiKey || '',
      systemConfig?.defaultGeminiApiKey || '',
      typeof window !== 'undefined' ? localStorage.getItem('deq_gemini_keys') || '' : '',
    ]
      .filter(Boolean)
      .join(',');

    const availableKeys = getAvailableKeys(activeApiKeys);
    if (availableKeys.length === 0) {
      toast.warning(
        'Cần nhập Gemini API Key để đọc Ảnh / PDF Scan chuẩn 100%!',
        'Vui lòng dán Gemini API Key vào ô cấu hình ngay bên dưới rồi bấm Lưu.'
      );
      return;
    }

    setIsProcessing(true);
    setProgressPct(8);
    resetResults();

    const baseName = selectedFile.name.replace(/\.[^.]+$/, '');
    const activeModel = user?.customModelId || systemConfig?.defaultGeminiModel || 'gemini-2.5-flash';
    const targetRange = ocrPageRangeMode === 'CUSTOM' ? ocrCustomPages : 'ALL';

    const updateProgress = (title: string, sub?: string, pct?: number) => {
      setProgressTitle(title);
      setProgressSub(sub || '');
      if (typeof pct === 'number') setProgressPct(pct);
      toast.showLoading(title, sub, pct);
    };

    try {
      const res = await convertPdfToExcel(
        selectedFile,
        targetRange,
        excelSheetMode,
        'always',
        updateProgress,
        activeApiKeys,
        activeModel
      );

      const outName = `${baseName}_BangTinhChuan_AzTool.xlsx`;
      setOcrResult({
        blob: res.blob,
        fileName: outName,
        pagesProcessed: res.pagesProcessed,
        totalRows: res.totalRows,
        previewRows: res.previewRows,
      });

      saveAs(res.blob, outName);

      void captureWorkspaceSnapshot({
        userEmail: user?.email || 'khach@aztool.vercel.app',
        userName: user?.displayName || 'Người dùng AzTool',
        userAvatar: user?.photoURL,
        actionType: 'export_word',
        actionLabel: `AI Vision OCR sang Excel (${res.totalRows} dòng)`,
        originalFileName: selectedFile.name,
        originalFile: selectedFile,
        prebuiltStandardBlob: res.blob,
        metadata: {
          ...SAMPLE_METADATA,
          department: 'PDF & OCR Excel Studio',
          subject: outName,
          subjectNote: `${res.pagesProcessed} trang • ${res.totalRows} dòng`,
          examCode: 'XLSX',
        },
        questions: [],
      });

      toast.success(
        'Đã đọc bảng biểu AI Vision OCR & tải file Excel (.xlsx)!',
        `Trích xuất chuẩn xác ${res.totalRows} dòng dữ liệu từ ${res.pagesProcessed} trang.`
      );
      confetti({ particleCount: 65, spread: 65 });
    } catch (err: any) {
      toast.error('Lỗi khi chạy AI Vision OCR sang Excel', err.message || String(err));
    } finally {
      setIsProcessing(false);
      toast.hideLoading();
    }
  };

  // Copy reconstructed table as 100% Word-compatible HTML table
  const handleCopyPreviewTableToWord = async () => {
    if (!ocrResult || ocrResult.previewRows.length === 0) return;

    const trsHtml = ocrResult.previewRows
      .map(row => {
        const tdsHtml = row
          .map(cell => {
            const spanC = cell.colSpan && cell.colSpan > 1 ? ` colspan="${cell.colSpan}"` : '';
            const spanR = cell.rowSpan && cell.rowSpan > 1 ? ` rowspan="${cell.rowSpan}"` : '';
            const bg =
              cell.bgHex && /^[0-9A-Fa-f]{6}$/.test(cell.bgHex.replace('#', ''))
                ? `background-color:#${cell.bgHex.replace('#', '')};`
                : '';
            const fw = cell.bold ? 'font-weight:bold;' : '';
            const fs = cell.italic ? 'font-style:italic;' : '';
            const ta = `text-align:${cell.align || 'left'};`;
            const safeText = String(cell.text ?? '')
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;');
            return `<td${spanC}${spanR} style="border:1pt solid #334155;padding:6pt 8pt;font-family:'Times New Roman',serif;font-size:12pt;vertical-align:middle;${bg}${fw}${fs}${ta}">${safeText}</td>`;
          })
          .join('');
        return `<tr>${tdsHtml}</tr>`;
      })
      .join('');

    const fullHtml = `<table style="border-collapse:collapse;width:100%;border:1pt solid #334155;font-family:'Times New Roman',serif;font-size:12pt;"><tbody>${trsHtml}</tbody></table>`;
    const plainTsv = ocrResult.previewRows
      .map(r => r.map(c => c.text).join('\t'))
      .join('\n');

    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        const item = new ClipboardItem({
          'text/html': new Blob([fullHtml], { type: 'text/html' }),
          'text/plain': new Blob([plainTsv], { type: 'text/plain' }),
        });
        await navigator.clipboard.write([item]);
      } else {
        await navigator.clipboard.writeText(plainTsv);
      }
      setCopiedWordTable(true);
      setTimeout(() => setCopiedWordTable(false), 3000);
      toast.success(
        'Đã sao chép Bảng chuẩn 100%!',
        'Mở Microsoft Word hoặc Excel và bấm Ctrl + V để dán nguyên khung viền, màu nền và ô gộp.'
      );
    } catch (err: any) {
      toast.error('Không thể copy bảng vào Clipboard', err.message || String(err));
    }
  };

  return (
    <div className="space-y-6 py-2 max-w-6xl mx-auto">
      {/* Top Hero Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#1e1b4b] via-[#4c1d95] to-[#065f46] p-6 sm:p-8 text-white shadow-xl border border-white/15">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-black text-emerald-300">
              <Sparkles className="w-4 h-4" />
              <span>2 CÔNG CỤ CHỦ LỰC • CẮT TRANG PDF &amp; AI VISION OCR BẢNG BIỂU SANG EXCEL</span>
            </div>
            <h2 className="text-xl sm:text-3xl font-black tracking-tight leading-tight">
              Cắt PDF Theo Trang Setting &amp; Nhìn Ảnh / PDF Scan Làm Lại Bảng Tính Excel (.xlsx) Chuẩn 100%
            </h2>
            <p className="text-xs sm:text-sm text-purple-100/90 leading-relaxed">
              Đã tinh gọn hoàn toàn: Chỉ giữ lại <strong>2 công cụ trọng tâm</strong> hoạt động chuẩn xác 100% — <strong>(1) Cắt &amp; Tách trang PDF theo cài đặt trang/số lượng trang</strong> và <strong>(2) AI Vision OCR nhìn Ảnh chụp / PDF Scan (kể cả CamScanner) tái tạo bảng tính Excel (.xlsx) &amp; Copy qua Word</strong> giữ nguyên hàng cột, ô gộp, đường kẻ và màu nền.
            </p>
          </div>
        </div>
      </div>

      {/* 2 Big Mode Selector Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => {
            setActiveTool('ocr_to_excel');
            resetResults();
          }}
          className={`p-5 rounded-3xl border-2 text-left transition-all canva-tap flex items-start gap-4 ${
            activeTool === 'ocr_to_excel'
              ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30 ring-2 ring-emerald-500/40 shadow-lg'
              : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#151824] hover:border-emerald-400/60'
          }`}
        >
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shrink-0 shadow-md">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div className="space-y-1 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                AI VISION OCR 100% • KHÔNG LỖI CHỮ RÁC
              </span>
              {activeTool === 'ocr_to_excel' && (
                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                  ● Đang chọn
                </span>
              )}
            </div>
            <h3 className="text-base sm:text-lg font-black text-neutral-900 dark:text-white">
              1. Nhìn Ảnh / PDF Scan ➔ Làm Lại Bảng Excel (.xlsx)
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Tải ảnh bảng biểu (.png, .jpg), dán ảnh (Ctrl+V) hoặc tải file PDF Scan (CamScanner): AI nhìn trực tiếp hình ảnh để dựng lại bảng Excel chuẩn 100% hàng/cột, ô gộp, màu sắc &amp; cho phép Copy dán thẳng sang Word.
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTool('split_pdf_studio');
            resetResults();
          }}
          className={`p-5 rounded-3xl border-2 text-left transition-all canva-tap flex items-start gap-4 ${
            activeTool === 'split_pdf_studio'
              ? 'border-[#7d2ae8] bg-purple-50/70 dark:bg-purple-950/30 ring-2 ring-[#7d2ae8]/40 shadow-lg'
              : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#151824] hover:border-purple-400/60'
          }`}
        >
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#7d2ae8] to-orange-500 text-white flex items-center justify-center shrink-0 shadow-md">
            <Scissors className="w-6 h-6" />
          </div>
          <div className="space-y-1 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-[#7d2ae8] dark:bg-purple-950 dark:text-purple-300">
                CẮT &amp; TÁCH TRANG PDF PRO
              </span>
              {activeTool === 'split_pdf_studio' && (
                <span className="text-xs font-black text-[#7d2ae8] dark:text-purple-400">
                  ● Đang chọn
                </span>
              )}
            </div>
            <h3 className="text-base sm:text-lg font-black text-neutral-900 dark:text-white">
              2. Cắt PDF Theo Trang Setting &amp; Số Lượng Trang
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Cắt trích xuất theo khoảng trang tùy chỉnh (VD: 1, 3, 5-8, Chẵn/Lẻ), chia nhỏ mỗi N trang thành 1 file PDF riêng, hoặc chọn/xoay/xóa trang trực quan trên lưới Thumbnail.
            </p>
          </div>
        </button>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={
          activeTool === 'ocr_to_excel'
            ? '.pdf,image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp'
            : '.pdf'
        }
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) void handleSelectFile(f);
          e.target.value = '';
        }}
        className="hidden"
      />

      {/* Main Workspace Card */}
      <div className="canva-card p-6 sm:p-8 rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#151822] shadow-md space-y-6">
        {/* Upload / Paste Dropzone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={e => {
            e.preventDefault();
            e.stopPropagation();
            const f = e.dataTransfer.files?.[0];
            if (f) void handleSelectFile(f);
          }}
          className={`p-8 rounded-3xl border-2 border-dashed text-center cursor-pointer transition group ${
            selectedFile
              ? 'border-emerald-500/60 bg-emerald-50/30 dark:bg-emerald-950/15'
              : 'border-[#7d2ae8]/40 hover:border-[#7d2ae8] bg-neutral-50/70 dark:bg-neutral-900/50'
          }`}
        >
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#7d2ae8] to-[#00c4cc] text-white flex items-center justify-center mx-auto shadow-md group-hover:scale-105 transition-transform">
            <UploadCloud className="w-7 h-7" />
          </div>

          {selectedFile ? (
            <div className="mt-3 space-y-1">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-xs font-black">
                <CheckCircle2 className="w-4 h-4" />
                <span>Đã nạp tệp: {selectedFile.name}</span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Dung lượng: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                {detectedPageCount > 0 ? ` • Tổng số trang: ${detectedPageCount} trang` : ''} — Nhấn vào đây nếu muốn đổi tệp khác
              </p>
            </div>
          ) : (
            <div className="mt-3 space-y-1.5">
              <h4 className="text-sm sm:text-base font-black text-neutral-900 dark:text-white">
                {activeTool === 'ocr_to_excel'
                  ? 'Kéo thả hoặc nhấn để chọn Ảnh chụp bảng biểu (.png, .jpg) hoặc File PDF Scan (.pdf)'
                  : 'Kéo thả hoặc nhấn để chọn File PDF (.pdf) cần cắt / tách trang'}
              </h4>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {activeTool === 'ocr_to_excel'
                  ? 'Mẹo nhanh: Bạn có thể chụp màn hình bảng biểu (Win + Shift + S) rồi bấm Ctrl + V để dán thẳng ảnh vào đây!'
                  : 'Hỗ trợ mọi tệp PDF dung lượng lớn, xử lý trực tiếp 100% tốc độ cao.'}
              </p>
            </div>
          )}
        </div>

        {/* Image Preview if user uploaded/pasted an image */}
        {imagePreviewUrl && activeTool === 'ocr_to_excel' && (
          <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-2">
            <div className="text-xs font-bold text-neutral-600 dark:text-neutral-300 flex items-center gap-1.5">
              <ClipboardPaste className="w-4 h-4 text-emerald-500" />
              <span>Ảnh gốc chuẩn bị quét AI Vision OCR:</span>
            </div>
            <img
              src={imagePreviewUrl}
              alt="Preview OCR"
              className="max-h-72 rounded-xl border border-neutral-200 dark:border-neutral-700 mx-auto object-contain bg-white"
            />
          </div>
        )}

        {/* ================================================================= */}
        {/* CONFIGURATION FOR TOOL 2: AI VISION OCR -> EXCEL (.XLSX)          */}
        {/* ================================================================= */}
        {activeTool === 'ocr_to_excel' && (
          <div className="space-y-5">
            {/* Inline API Key Box so Vision OCR NEVER fails due to missing key */}
            <div
              className={`p-4 rounded-2xl border ${
                savedKeyCount > 0
                  ? 'border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/15'
                  : 'border-amber-500/50 bg-amber-50/60 dark:bg-amber-950/20'
              } space-y-2.5`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-black flex items-center gap-1.5 text-neutral-900 dark:text-white">
                  <KeyRound className="w-4 h-4 text-emerald-600" />
                  <span>
                    Cấu hình Gemini AI Vision OCR (Bắt buộc để đọc chuẩn 100% ảnh chụp &amp; PDF Scan CamScanner):
                  </span>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-black ${
                    savedKeyCount > 0
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                      : 'bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200'
                  }`}
                >
                  {savedKeyCount > 0
                    ? `✓ Đã kích hoạt ${savedKeyCount} API Key AI Vision`
                    : '⚠ Chưa có API Key — Hãy dán API Key bên dưới'}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="password"
                  value={inlineApiKey}
                  onChange={e => setInlineApiKey(e.target.value)}
                  placeholder="Dán Gemini API Key (AIzaSy...) vào đây để kích hoạt AI Vision đọc bảng biểu chuẩn 100%..."
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={handleSaveInlineApiKey}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shrink-0 transition canva-tap flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Lưu API Key</span>
                </button>
              </div>
            </div>

            {/* Page Range & Sheet Settings when input is a multi-page PDF */}
            {!imagePreviewUrl && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900/70 border border-neutral-200 dark:border-neutral-800">
                <div className="space-y-2">
                  <label className="block text-xs font-black text-neutral-800 dark:text-neutral-200">
                    Chọn trang PDF cần đọc bảng sang Excel:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setOcrPageRangeMode('ALL')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                        ocrPageRangeMode === 'ALL'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700'
                      }`}
                    >
                      Tất cả các trang ({detectedPageCount || 'ALL'})
                    </button>
                    <button
                      type="button"
                      onClick={() => setOcrPageRangeMode('CUSTOM')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                        ocrPageRangeMode === 'CUSTOM'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700'
                      }`}
                    >
                      Chỉ định trang (Nhanh hơn)
                    </button>
                  </div>
                  {ocrPageRangeMode === 'CUSTOM' && (
                    <input
                      type="text"
                      value={ocrCustomPages}
                      onChange={e => setOcrCustomPages(e.target.value)}
                      placeholder="VD: 1, 2, 5-7"
                      className="w-full px-3.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-bold"
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-black text-neutral-800 dark:text-neutral-200">
                    Cách bố trí Sheet trong file Excel (.xlsx):
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setExcelSheetMode('single_sheet')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                        excelSheetMode === 'single_sheet'
                          ? 'bg-[#7d2ae8] text-white shadow-xs'
                          : 'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700'
                      }`}
                    >
                      Gộp chung vào 1 Sheet liên tục
                    </button>
                    <button
                      type="button"
                      onClick={() => setExcelSheetMode('sheet_per_page')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                        excelSheetMode === 'sheet_per_page'
                          ? 'bg-[#7d2ae8] text-white shadow-xs'
                          : 'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700'
                      }`}
                    >
                      Tách mỗi trang PDF thành 1 Sheet riêng
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Action Button */}
            <div className="flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => void handleRunOcrToExcel()}
                disabled={isProcessing || !selectedFile}
                className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white font-black text-xs sm:text-sm shadow-lg shadow-emerald-600/20 transition canva-tap flex items-center gap-2"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>
                  {isProcessing
                    ? `Đang đọc AI Vision OCR (${progressPct}%)...`
                    : 'Chạy AI Vision OCR & Xuất File Excel (.xlsx) Chuẩn 100%'}
                </span>
              </button>
            </div>

            {/* Live Extracted Table Preview & Copy to Word / Download Excel */}
            {ocrResult && (
              <div className="p-5 rounded-3xl border-2 border-emerald-500/40 bg-emerald-50/20 dark:bg-emerald-950/10 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="text-sm font-black text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5" />
                      <span>
                        Đã tái tạo thành công {ocrResult.totalRows} dòng bảng biểu ({ocrResult.pagesProcessed} trang)!
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Bạn có thể bấm vào từng ô bên dưới để chỉnh sửa trực tiếp trước khi Copy sang Word hoặc Tải lại file Excel.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => void handleCopyPreviewTableToWord()}
                      className="px-4 py-2.5 rounded-xl bg-[#7d2ae8] hover:bg-purple-700 text-white font-black text-xs shadow-md transition canva-tap flex items-center gap-1.5"
                    >
                      <Copy className="w-4 h-4" />
                      <span>
                        {copiedWordTable
                          ? '✓ Đã Copy! Bấm Ctrl+V vào Word'
                          : 'Copy Bảng Chuẩn 100% Sang Word'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => saveAs(ocrResult.blob, ocrResult.fileName)}
                      className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition canva-tap flex items-center gap-1.5"
                    >
                      <Download className="w-4 h-4" />
                      <span>Tải File Excel ({ocrResult.fileName})</span>
                    </button>
                  </div>
                </div>

                {/* Interactive HTML Table Preview */}
                {ocrResult.previewRows.length > 0 && (
                  <div className="overflow-x-auto max-h-[460px] rounded-2xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-inner">
                    <table className="w-full border-collapse text-xs">
                      <tbody>
                        {ocrResult.previewRows.map((row, rIdx) => (
                          <tr key={rIdx}>
                            {row.map((cell, cIdx) => {
                              const bgHex =
                                cell.bgHex && /^[0-9A-Fa-f]{6}$/.test(cell.bgHex.replace('#', ''))
                                  ? `#${cell.bgHex.replace('#', '')}`
                                  : undefined;
                              return (
                                <td
                                  key={cIdx}
                                  colSpan={cell.colSpan && cell.colSpan > 1 ? cell.colSpan : undefined}
                                  rowSpan={cell.rowSpan && cell.rowSpan > 1 ? cell.rowSpan : undefined}
                                  contentEditable
                                  suppressContentEditableWarning
                                  onBlur={e => {
                                    const newVal = e.currentTarget.textContent || '';
                                    setOcrResult(prev => {
                                      if (!prev) return prev;
                                      const nextRows = prev.previewRows.map((r, ri) =>
                                        ri === rIdx
                                          ? r.map((c, ci) =>
                                              ci === cIdx ? { ...c, text: newVal } : c
                                            )
                                          : r
                                      );
                                      return { ...prev, previewRows: nextRows };
                                    });
                                  }}
                                  style={{
                                    backgroundColor: bgHex,
                                    fontWeight: cell.bold ? 700 : 400,
                                    fontStyle: cell.italic ? 'italic' : 'normal',
                                    textAlign: cell.align || 'left',
                                  }}
                                  className="border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-neutral-900 dark:text-neutral-100 focus:outline-2 focus:outline-[#7d2ae8]"
                                >
                                  {cell.text}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* CONFIGURATION FOR TOOL 1: CẮT & TÁCH PDF THEO TRANG SETTING       */}
        {/* ================================================================= */}
        {activeTool === 'split_pdf_studio' && (
          <div className="space-y-5">
            {/* 3 Sub-mode Tabs for Splitting */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setSplitMethod('by_range')}
                className={`p-3.5 rounded-2xl border text-left transition ${
                  splitMethod === 'by_range'
                    ? 'border-[#7d2ae8] bg-purple-50/70 dark:bg-purple-950/30 font-black'
                    : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/50'
                }`}
              >
                <div className="text-xs font-black text-[#7d2ae8] dark:text-purple-300 flex items-center gap-1.5">
                  <FileOutput className="w-4 h-4" />
                  <span>1. Cắt Theo Khoảng Trang Setting</span>
                </div>
                <p className="text-[11px] text-neutral-500 mt-1">
                  Chọn trang cụ thể (VD: 1, 3, 5-8), trang Chẵn hoặc trang Lẻ.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSplitMethod('by_count')}
                className={`p-3.5 rounded-2xl border text-left transition ${
                  splitMethod === 'by_count'
                    ? 'border-[#7d2ae8] bg-purple-50/70 dark:bg-purple-950/30 font-black'
                    : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/50'
                }`}
              >
                <div className="text-xs font-black text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <Scissors className="w-4 h-4" />
                  <span>2. Cắt Nhỏ Mỗi N Trang / File</span>
                </div>
                <p className="text-[11px] text-neutral-500 mt-1">
                  Chia đều file PDF lớn: cứ mỗi N trang (VD: 5 trang) thành 1 file PDF.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSplitMethod('visual_select');
                  if (selectedFile && visualThumbnails.length === 0) {
                    void loadVisualThumbnails(selectedFile);
                  }
                }}
                className={`p-3.5 rounded-2xl border text-left transition ${
                  splitMethod === 'visual_select'
                    ? 'border-[#7d2ae8] bg-purple-50/70 dark:bg-purple-950/30 font-black'
                    : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/50'
                }`}
              >
                <div className="text-xs font-black text-cyan-600 dark:text-cyan-400 flex items-center gap-1.5">
                  <LayoutGrid className="w-4 h-4" />
                  <span>3. Xem Thumbnail Cắt / Xoay / Xóa</span>
                </div>
                <p className="text-[11px] text-neutral-500 mt-1">
                  Xem trước từng trang PDF để xóa trang thừa hoặc xoay 90°.
                </p>
              </button>
            </div>

            {/* Settings for Method 1: by_range */}
            {splitMethod === 'by_range' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900/70 border border-neutral-200 dark:border-neutral-800">
                <div className="space-y-2.5">
                  <label className="block text-xs font-black text-neutral-800 dark:text-neutral-200">
                    Cài đặt phạm vi trang cần cắt (Page Setting):
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'CUSTOM', label: 'Tùy chọn trang (1, 3, 5-8)' },
                      { id: 'ODD', label: 'Chỉ trang Lẻ (1, 3, 5...)' },
                      { id: 'EVEN', label: 'Chỉ trang Chẵn (2, 4, 6...)' },
                      { id: 'ALL', label: 'Tất cả các trang' },
                    ].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setRangePreset(opt.id as any)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition ${
                          rangePreset === opt.id
                            ? 'bg-[#7d2ae8] text-white'
                            : 'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {rangePreset === 'CUSTOM' && (
                    <input
                      type="text"
                      value={customPageRange}
                      onChange={e => setCustomPageRange(e.target.value)}
                      placeholder="Nhập số trang hoặc khoảng trang: VD 1, 3, 5-8"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-bold"
                    />
                  )}
                </div>

                <div className="space-y-2.5">
                  <label className="block text-xs font-black text-neutral-800 dark:text-neutral-200">
                    Kiểu đóng gói file PDF sau khi cắt:
                  </label>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setRangeOutputFormat('extract-single')}
                      className={`w-full p-3 rounded-xl border text-left text-xs font-bold transition ${
                        rangeOutputFormat === 'extract-single'
                          ? 'border-[#7d2ae8] bg-purple-50 dark:bg-purple-950/40 text-[#7d2ae8] dark:text-purple-300'
                          : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800'
                      }`}
                    >
                      ✓ Gộp các trang đã chọn thành 1 file PDF duy nhất (.pdf)
                    </button>
                    <button
                      type="button"
                      onClick={() => setRangeOutputFormat('separate-files')}
                      className={`w-full p-3 rounded-xl border text-left text-xs font-bold transition ${
                        rangeOutputFormat === 'separate-files'
                          ? 'border-[#7d2ae8] bg-purple-50 dark:bg-purple-950/40 text-[#7d2ae8] dark:text-purple-300'
                          : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800'
                      }`}
                    >
                      ✓ Tách rời mỗi trang thành 1 file PDF độc lập (.ZIP)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Settings for Method 2: by_count */}
            {splitMethod === 'by_count' && (
              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900/70 border border-neutral-200 dark:border-neutral-800 space-y-3">
                <label className="block text-xs font-black text-neutral-800 dark:text-neutral-200">
                  Số lượng trang trên mỗi file PDF nhỏ (Cứ mỗi N trang cắt thành 1 file):
                </label>
                <div className="flex flex-wrap items-center gap-2.5">
                  {[1, 2, 3, 5, 10, 15, 20].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setPagesPerChunk(num)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-black transition ${
                        pagesPerChunk === num
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700'
                      }`}
                    >
                      {num} trang / file
                    </button>
                  ))}
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={pagesPerChunk}
                    onChange={e => setPagesPerChunk(Math.max(1, parseInt(e.target.value || '1', 10)))}
                    className="w-24 px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-black text-center"
                  />
                </div>
              </div>
            )}

            {/* Settings for Method 3: visual_select */}
            {splitMethod === 'visual_select' && (
              <div className="space-y-3">
                {isLoadingThumbnails ? (
                  <div className="p-8 text-center">
                    <AzLogoLoader
                      title={progressTitle || 'Đang dựng ảnh xem trước từng trang PDF...'}
                      subtitle={progressSub}
                      progress={progressPct}
                    />
                  </div>
                ) : visualThumbnails.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-neutral-600 dark:text-neutral-300">
                        Đang giữ lại{' '}
                        <strong className="text-[#7d2ae8]">
                          {visualThumbnails.filter(t => !t.deleted).length}/{visualThumbnails.length}
                        </strong>{' '}
                        trang (Nhấn biểu tượng Thùng rác để bỏ trang hoặc Xoay 90°):
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setVisualThumbnails(prev =>
                            prev.map(p => ({ ...p, deleted: false, rotation: 0 }))
                          )
                        }
                        className="px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs font-bold flex items-center gap-1"
                      >
                        <RefreshCcw className="w-3.5 h-3.5" />
                        <span>Khôi phục tất cả trang</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-[420px] overflow-y-auto p-2">
                      {visualThumbnails.map((item, idx) => (
                        <div
                          key={item.originalPageNumber}
                          className={`p-2.5 rounded-2xl border transition flex flex-col items-center gap-2 ${
                            item.deleted
                              ? 'opacity-40 border-rose-300 bg-rose-50/30'
                              : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-xs'
                          }`}
                        >
                          <div className="relative w-full aspect-[3/4] flex items-center justify-center overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-800">
                            <img
                              src={item.thumbnailDataUrl}
                              alt={`Trang ${item.originalPageNumber}`}
                              style={{ transform: `rotate(${item.rotation}deg)` }}
                              className="max-h-full max-w-full object-contain transition-transform"
                            />
                          </div>
                          <div className="text-[11px] font-black">
                            Trang {item.originalPageNumber}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                setVisualThumbnails(prev => {
                                  if (idx === 0) return prev;
                                  const copy = [...prev];
                                  const tmp = copy[idx - 1];
                                  copy[idx - 1] = copy[idx];
                                  copy[idx] = tmp;
                                  return copy;
                                })
                              }
                              className="p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200"
                              title="Đưa lên trước"
                            >
                              <ArrowLeft className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setVisualThumbnails(prev =>
                                  prev.map((p, i) =>
                                    i === idx ? { ...p, rotation: (p.rotation + 90) % 360 } : p
                                  )
                                )
                              }
                              className="p-1.5 rounded-lg bg-purple-100 text-[#7d2ae8] hover:bg-purple-200"
                              title="Xoay 90 độ"
                            >
                              <RotateCw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setVisualThumbnails(prev =>
                                  prev.map((p, i) =>
                                    i === idx ? { ...p, deleted: !p.deleted } : p
                                  )
                                )
                              }
                              className={`p-1.5 rounded-lg ${
                                item.deleted
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-rose-100 text-rose-700'
                              }`}
                              title={item.deleted ? 'Khôi phục trang' : 'Bỏ trang này'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setVisualThumbnails(prev => {
                                  if (idx === prev.length - 1) return prev;
                                  const copy = [...prev];
                                  const tmp = copy[idx + 1];
                                  copy[idx + 1] = copy[idx];
                                  copy[idx] = tmp;
                                  return copy;
                                })
                              }
                              className="p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200"
                              title="Đưa ra sau"
                            >
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {/* Action Button for Split PDF */}
            <div className="flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => void handleRunSplitPdf()}
                disabled={isProcessing || !selectedFile}
                className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-[#7d2ae8] to-orange-500 hover:from-purple-700 hover:to-orange-600 disabled:opacity-50 text-white font-black text-xs sm:text-sm shadow-lg transition canva-tap flex items-center gap-2"
              >
                <Scissors className="w-4 h-4" />
                <span>
                  {isProcessing
                    ? `Đang cắt PDF (${progressPct}%)...`
                    : 'Thực Hiện Cắt & Tải File PDF Ngay'}
                </span>
              </button>
            </div>

            {/* Split Result Download Cards */}
            {splitSingleResult && (
              <div className="p-4 rounded-2xl border-2 border-emerald-500/40 bg-emerald-50/30 dark:bg-emerald-950/15 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs sm:text-sm font-black text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{splitSingleResult.summary}</span>
                  </div>
                  <div className="text-xs text-neutral-500">{splitSingleResult.fileName}</div>
                </div>
                <button
                  type="button"
                  onClick={() => saveAs(splitSingleResult.blob, splitSingleResult.fileName)}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  <span>Tải Về ({splitSingleResult.fileName})</span>
                </button>
              </div>
            )}

            {splitChunksResult && (
              <div className="p-5 rounded-2xl border-2 border-amber-500/40 bg-amber-50/20 dark:bg-amber-950/15 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-black text-amber-800 dark:text-amber-300">
                    Đã cắt thành {splitChunksResult.chunks.length} file PDF nhỏ:
                  </div>
                  <button
                    type="button"
                    onClick={() => saveAs(splitChunksResult.zipBlob, splitChunksResult.zipName)}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs flex items-center gap-1.5"
                  >
                    <Download className="w-4 h-4" />
                    <span>Tải Trọn Bộ .ZIP ({splitChunksResult.chunks.length} file)</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {splitChunksResult.chunks.map((ch, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => saveAs(ch.blob, ch.fileName)}
                      className="p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:border-amber-500 text-left flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="truncate font-bold">
                        Phần {idx + 1} (Trang {ch.pageRange})
                      </span>
                      <Download className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
