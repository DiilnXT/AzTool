'use client';

import React, { useState, useRef } from 'react';
import {
  Scissors,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Download,
  RotateCw,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  FileOutput,
  RefreshCcw,
  LayoutGrid,
} from 'lucide-react';
import { AzLogoLoader } from '@/components/DeQLogo';
import {
  getPdfPageCount,
  generatePdfPageThumbnails,
  exportVisualOrganizedPdf,
  splitPdfByCount,
  deletePdfPages,
  type PdfPageThumbnailItem,
} from '@/lib/pdf-office-engine';
import { downloadFileMobileSafe } from '@/lib/mobile-download';

interface SplitChunksState {
  zipBlob: Blob;
  zipName: string;
  chunks: { fileName: string; blob: Blob; pageRange: string }[];
}

export function PdfOfficeStudio() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [detectedPageCount, setDetectedPageCount] = useState<number>(0);

  // Split PDF Studio States
  const [splitMethod, setSplitMethod] = useState<'by_range' | 'by_count' | 'visual_select'>('by_range');
  const [rangePreset, setRangePreset] = useState<'CUSTOM' | 'ODD' | 'EVEN' | 'ALL'>('CUSTOM');
  const [customPageRange, setCustomPageRange] = useState('1-3');
  const [rangeOutputFormat, setRangeOutputFormat] = useState<'extract-single' | 'separate-files'>('extract-single');
  const [pagesPerChunk, setPagesPerChunk] = useState<number>(5);

  const [visualThumbnails, setVisualThumbnails] = useState<PdfPageThumbnailItem[]>([]);
  const [isLoadingThumbnails, setIsLoadingThumbnails] = useState(false);

  // Results for Split PDF
  const [splitSingleResult, setSplitSingleResult] = useState<{
    blob: Blob;
    fileName: string;
    summary: string;
  } | null>(null);
  const [splitChunksResult, setSplitChunksResult] = useState<SplitChunksState | null>(null);

  // Shared Progress & Errors
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [progressTitle, setProgressTitle] = useState('');
  const [progressSub, setProgressSub] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const clearResults = () => {
    setSplitSingleResult(null);
    setSplitChunksResult(null);
    setErrorMsg(null);
  };

  const loadVisualThumbnails = async (file: File) => {
    setIsLoadingThumbnails(true);
    setProgressPct(10);
    setProgressTitle('Đang kết xuất hình thu nhỏ các trang PDF...');
    try {
      const items = await generatePdfPageThumbnails(file, (title, sub, pct) => {
        setProgressTitle(title);
        if (sub) setProgressSub(sub);
        if (typeof pct === 'number') setProgressPct(pct);
      });
      setVisualThumbnails(items);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể tải lưới xem trước trang PDF.');
    } finally {
      setIsLoadingThumbnails(false);
    }
  };

  const handleSelectFile = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    clearResults();
    setSelectedFile(f);
    setDetectedPageCount(0);
    setVisualThumbnails([]);

    if (f.name.toLowerCase().endsWith('.pdf')) {
      try {
        const count = await getPdfPageCount(f);
        setDetectedPageCount(count);
        if (count > 0) {
          setCustomPageRange(count >= 3 ? '1-3' : '1');
        }
        if (splitMethod === 'visual_select') {
          await loadVisualThumbnails(f);
        }
      } catch {
        setDetectedPageCount(0);
      }
    }
  };

  // ============================================================================
  // EXECUTE: CẮT & TÁCH PDF THEO TRANG SETTING
  // ============================================================================
  const handleRunSplitPdf = async () => {
    if (!selectedFile) {
      setErrorMsg('Vui lòng tải lên tệp PDF cần cắt/tách trang.');
      return;
    }

    setIsProcessing(true);
    clearResults();
    setProgressPct(10);
    setProgressTitle('Đang xử lý Cắt & Tách Trang PDF...');
    setProgressSub('Khởi tạo trình xử lý trang PDF...');

    try {
      const baseName = selectedFile.name.replace(/\.pdf$/i, '');

      if (splitMethod === 'by_count') {
        const res = await splitPdfByCount(selectedFile, pagesPerChunk, (title, sub, pct) => {
          setProgressTitle(title);
          if (sub) setProgressSub(sub);
          if (typeof pct === 'number') setProgressPct(pct);
        });
        const zipName = `${baseName}_Cat_${pagesPerChunk}Trang.zip`;
        setSplitChunksResult({
          zipBlob: res.zipBlob,
          zipName,
          chunks: res.chunks,
        });
        await downloadFileMobileSafe(res.zipBlob, zipName);
      } else if (splitMethod === 'visual_select') {
        const kept = visualThumbnails.filter(t => !t.deleted);
        if (kept.length === 0) {
          throw new Error('Bạn cần giữ lại ít nhất 1 trang PDF để xuất file.');
        }
        const organized = await exportVisualOrganizedPdf(selectedFile, visualThumbnails, (title, sub, pct) => {
          setProgressTitle(title);
          if (sub) setProgressSub(sub);
          if (typeof pct === 'number') setProgressPct(pct);
        });
        const outName = `${baseName}_DaCat_${kept.length}trang.pdf`;
        setSplitSingleResult({
          blob: organized.blob,
          fileName: outName,
          summary: `Đã trích xuất thành công ${kept.length}/${visualThumbnails.length} trang PDF đã chọn.`,
        });
        await downloadFileMobileSafe(organized.blob, outName);
      } else {
        // splitMethod === 'by_range'
        const total = detectedPageCount || (await getPdfPageCount(selectedFile));
        let keepSpec = customPageRange.trim();
        if (rangePreset === 'ALL') keepSpec = `1-${total}`;
        else if (rangePreset === 'ODD') {
          const odds: number[] = [];
          for (let i = 1; i <= total; i += 2) odds.push(i);
          keepSpec = odds.join(',');
        } else if (rangePreset === 'EVEN') {
          const evens: number[] = [];
          for (let i = 2; i <= total; i += 2) evens.push(i);
          keepSpec = evens.join(',');
        }

        if (rangeOutputFormat === 'separate-files') {
          const allChunks = await splitPdfByCount(selectedFile, 1, (title, sub, pct) => {
            setProgressTitle(title);
            if (sub) setProgressSub(sub);
            if (typeof pct === 'number') setProgressPct(pct);
          });
          const zipName = `${baseName}_TachRoiTungTrang.zip`;
          setSplitChunksResult({
            zipBlob: allChunks.zipBlob,
            zipName,
            chunks: allChunks.chunks,
          });
          await downloadFileMobileSafe(allChunks.zipBlob, zipName);
        } else {
          const parsedKeep = new Set<number>();
          const parts = keepSpec
            .split(/[,\s;]+/)
            .map(s => s.trim())
            .filter(Boolean);
          for (const part of parts) {
            if (part.includes('-')) {
              const [a, b] = part.split('-').map(n => parseInt(n.trim(), 10));
              if (!isNaN(a) && !isNaN(b)) {
                const start = Math.max(1, Math.min(a, b));
                const end = Math.min(total, Math.max(a, b));
                for (let p = start; p <= end; p++) parsedKeep.add(p);
              }
            } else {
              const p = parseInt(part, 10);
              if (!isNaN(p) && p >= 1 && p <= total) parsedKeep.add(p);
            }
          }

          if (parsedKeep.size === 0) {
            throw new Error(`Khoảng trang "${keepSpec}" không hợp lệ (Tệp có ${total} trang).`);
          }

          const toDelete: number[] = [];
          for (let p = 1; p <= total; p++) {
            if (!parsedKeep.has(p)) toDelete.push(p);
          }

          let outBlob: Blob;
          if (toDelete.length === 0) {
            outBlob = new Blob([await selectedFile.arrayBuffer()], { type: 'application/pdf' });
          } else {
            const deletedRes = await deletePdfPages(selectedFile, toDelete.join(','));
            outBlob = deletedRes.blob;
          }

          const outName = `${baseName}_Trang_${keepSpec.replace(/[^0-9a-zA-Z_-]/g, '_')}.pdf`;
          setSplitSingleResult({
            blob: outBlob,
            fileName: outName,
            summary: `Đã cắt & trích xuất chuẩn xác ${parsedKeep.size}/${total} trang PDF (Trang: ${keepSpec}).`,
          });
          await downloadFileMobileSafe(outBlob, outName);
        }
      }

      setProgressPct(100);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Lỗi khi cắt trang PDF.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Studio Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#120924] via-[#1e113a] to-[#0c192c] text-white p-6 sm:p-8 shadow-xl border border-white/10">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-bold text-cyan-300">
              <Sparkles className="w-3.5 h-3.5" />
              <span>AzTool PDF Split Studio • Tốc Độ Cao 100%</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              Cắt &amp; Tách Trang PDF Theo Trang Setting
            </h2>
            <p className="text-xs sm:text-sm text-white/75 leading-relaxed">
              Hỗ trợ <strong>Cắt nhỏ &amp; Trích xuất trang PDF theo khoảng trang Setting</strong> (VD:{' '}
              <code>1, 3, 5-8</code>, trang Chẵn/Lẻ), chia nhỏ mỗi <strong>N trang thành 1 file</strong>, hoặc xem trực
              quan từng trang để xoay 90° / xóa trang trắng.
            </p>
          </div>
        </div>
      </div>

      {/* Main Workspace Card */}
      <div className="canva-card p-6 sm:p-8 border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 rounded-3xl shadow-sm space-y-6">
        {/* Error Alert */}
        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-start gap-3 text-rose-700 dark:text-rose-300 text-xs sm:text-sm font-semibold">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
            <div className="flex-1">{errorMsg}</div>
          </div>
        )}

        {/* File Dropzone */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={e => void handleSelectFile(e.target.files)}
        />

        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault();
            void handleSelectFile(e.dataTransfer.files);
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
                Kéo thả hoặc nhấn để chọn File PDF (.pdf) cần cắt / tách trang
              </h4>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Hỗ trợ mọi tệp PDF dung lượng lớn, xử lý trực tiếp 100% tốc độ cao.
              </p>
            </div>
          )}
        </div>

        {/* ================================================================= */}
        {/* CONFIGURATION FOR CẮT & TÁCH PDF THEO TRANG SETTING               */}
        {/* ================================================================= */}
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
                onClick={() => void downloadFileMobileSafe(splitSingleResult.blob, splitSingleResult.fileName)}
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
                  onClick={() => void downloadFileMobileSafe(splitChunksResult.zipBlob, splitChunksResult.zipName)}
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
                    onClick={() => void downloadFileMobileSafe(ch.blob, ch.fileName)}
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
      </div>
    </div>
  );
}

export default PdfOfficeStudio;
