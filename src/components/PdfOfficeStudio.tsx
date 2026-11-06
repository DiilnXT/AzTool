'use client';

import React, { useState } from 'react';
import { saveAs } from 'file-saver';
import confetti from 'canvas-confetti';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ToastProvider';
import { AzLogoLoader } from '@/components/DeQLogo';
import { captureWorkspaceSnapshot } from '@/lib/workspace-sync';
import { SAMPLE_METADATA } from '@/lib/sample-data';
import {
  convertPdfToDocx,
  convertWordToPdf,
  convertExcelToPdf,
  convertPptToPdf,
  convertPdfToPptx,
  rotatePdfPages,
  deletePdfPages,
  addPdfPageNumbers,
  cropPdfMargins,
  splitPdfByCount,
  mergePdfFiles,
  splitPdfFile,
  compressPdfFile,
  extractImagesFromPdf,
  getPdfPageCount,
  ExtractedPdfImage,
} from '@/lib/pdf-office-engine';
import {
  FileText,
  FileSpreadsheet,
  Presentation,
  RotateCw,
  Trash2,
  Hash,
  Crop,
  Scissors,
  Layers,
  FileOutput,
  Minimize2,
  Image as ImageIcon,
  UploadCloud,
  Download,
  CheckCircle2,
  Sparkles,
  ArrowUp,
  ArrowDown,
  X,
  FolderArchive,
  Wand2,
} from 'lucide-react';

export type PdfToolId =
  | 'convert_pdf_to_docx'
  | 'convert_word_to_pdf'
  | 'convert_excel_to_pdf'
  | 'convert_ppt_to_pdf'
  | 'convert_pdf_to_pptx'
  | 'rotate_pdf_pages'
  | 'delete_pdf_pages'
  | 'add_pdf_page_numbers'
  | 'crop_pdf_margins'
  | 'split_pdf_by_count'
  | 'merge_pdf_files'
  | 'split_pdf_file'
  | 'compress_pdf_file'
  | 'extract_images_from_pdf';

interface ToolMetadata {
  id: PdfToolId;
  group: 'convert' | 'editor';
  codeName: string;
  title: string;
  subtitle: string;
  accept: string;
  multiple?: boolean;
  badge: string;
  gradient: string;
  icon: any;
}

const PDF_TOOLS: ToolMetadata[] = [
  // GROUP 1: CHUYỂN ĐỔI TÀI LIỆU (CONVERTER)
  {
    id: 'convert_pdf_to_docx',
    group: 'convert',
    codeName: 'convert_pdf_to_docx',
    title: 'PDF sang Word (.docx)',
    subtitle:
      'Phục hồi cấu trúc văn bản, bảng biểu, hình ảnh và vị trí tọa độ sang file Word chỉnh sửa được; hỗ trợ chọn tất cả hoặc chỉ định trang.',
    accept: '.pdf',
    badge: 'CHUYỂN ĐỔI',
    gradient: 'from-blue-600 to-indigo-600',
    icon: FileText,
  },
  {
    id: 'convert_word_to_pdf',
    group: 'convert',
    codeName: 'convert_word_to_pdf',
    title: 'Word sang PDF (.pdf)',
    subtitle:
      'Chuyển đổi .doc, .docx sang PDF chuẩn in ấn A4, giữ nguyên 100% font chữ tiếng Việt và định dạng bảng biểu gốc.',
    accept: '.docx,.doc',
    badge: 'CHUẨN IN ẤN',
    gradient: 'from-cyan-600 to-blue-600',
    icon: FileOutput,
  },
  {
    id: 'convert_excel_to_pdf',
    group: 'convert',
    codeName: 'convert_excel_to_pdf',
    title: 'Excel sang PDF (.pdf)',
    subtitle:
      'Xuất bảng tính .xls, .xlsx sang PDF sắc nét, tự động căn vừa trang (Ngang / Dọc) không bị tràn cột.',
    accept: '.xlsx,.xls,.csv',
    badge: 'AUTO-FIT',
    gradient: 'from-emerald-600 to-teal-600',
    icon: FileSpreadsheet,
  },
  {
    id: 'convert_ppt_to_pdf',
    group: 'convert',
    codeName: 'convert_ppt_to_pdf',
    title: 'PowerPoint sang PDF (.pdf)',
    subtitle:
      'Chuyển đổi slide thuyết trình .ppt, .pptx sang tài liệu PDF chất lượng cao giữ nguyên bố cục và hình ảnh.',
    accept: '.pptx,.ppt',
    badge: 'FULL HD',
    gradient: 'from-orange-500 to-rose-500',
    icon: Presentation,
  },
  {
    id: 'convert_pdf_to_pptx',
    group: 'convert',
    codeName: 'convert_pdf_to_pptx',
    title: 'PDF sang PowerPoint (.pptx)',
    subtitle:
      'Chuyển từng trang PDF thành các slide thuyết trình PowerPoint .pptx tỉ lệ 16:9 với độ phân giải cao.',
    accept: '.pdf',
    badge: 'SLIDE 16:9',
    gradient: 'from-pink-600 to-purple-600',
    icon: Presentation,
  },

  // GROUP 2: CHỈNH SỬA TRANG PDF CHUYÊN SÂU (services/pdf_editor)
  {
    id: 'rotate_pdf_pages',
    group: 'editor',
    codeName: 'rotate_pdf_pages',
    title: 'Xoay Trang PDF (90°/180°/270°)',
    subtitle:
      'Xoay 90°, 180°, 270° cho toàn bộ file hoặc chỉ xoay các trang chẵn, trang lẻ hoặc danh sách trang chỉ định.',
    accept: '.pdf',
    badge: 'XOAY TRANG',
    gradient: 'from-[#7d2ae8] to-indigo-600',
    icon: RotateCw,
  },
  {
    id: 'delete_pdf_pages',
    group: 'editor',
    codeName: 'delete_pdf_pages',
    title: 'Xóa Trang PDF Thừa / Trắng',
    subtitle:
      'Loại bỏ nhanh các trang thừa, trang trắng theo danh sách hoặc khoảng trang (ví dụ: 1, 3, 5-8).',
    accept: '.pdf',
    badge: 'XÓA TRANG',
    gradient: 'from-rose-600 to-pink-600',
    icon: Trash2,
  },
  {
    id: 'add_pdf_page_numbers',
    group: 'editor',
    codeName: 'add_pdf_page_numbers',
    title: 'Đánh Số Trang Tự Động',
    subtitle:
      'Chèn số trang chuyên nghiệp (kiểu Trang 1 / 10 hoặc 1/10) vào góc dưới phải, giữa hoặc trái của trang.',
    accept: '.pdf',
    badge: 'ĐÁNH SỐ TRANG',
    gradient: 'from-violet-600 to-purple-600',
    icon: Hash,
  },
  {
    id: 'crop_pdf_margins',
    group: 'editor',
    codeName: 'crop_pdf_margins',
    title: 'Xén Viền Trắng PDF',
    subtitle:
      'Cắt gọn khoảng trắng dư thừa xung quanh lề trang giúp chữ hiển thị to và rõ hơn khi đọc hoặc in.',
    accept: '.pdf',
    badge: 'XÉN LỀ TRẮNG',
    gradient: 'from-teal-600 to-emerald-600',
    icon: Crop,
  },
  {
    id: 'split_pdf_by_count',
    group: 'editor',
    codeName: 'split_pdf_by_count',
    title: 'Cắt Nhỏ PDF Theo Số Trang',
    subtitle:
      'Tự động chia một file PDF lớn thành nhiều file nhỏ có số trang bằng nhau (ví dụ: cứ mỗi 5 trang thành 1 file).',
    accept: '.pdf',
    badge: 'CHIA THEO CỤM',
    gradient: 'from-amber-500 to-orange-600',
    icon: Scissors,
  },
  {
    id: 'merge_pdf_files',
    group: 'editor',
    codeName: 'merge_pdf_files',
    title: 'Gộp Nhiều File PDF',
    subtitle:
      'Nối nhiều tệp PDF rời rạc thành một tệp PDF hoàn chỉnh duy nhất theo đúng thứ tự mong muốn.',
    accept: '.pdf',
    multiple: true,
    badge: 'GỘP NHIỀU FILE',
    gradient: 'from-[#00c4cc] to-[#7d2ae8]',
    icon: Layers,
  },
  {
    id: 'split_pdf_file',
    group: 'editor',
    codeName: 'split_pdf_file',
    title: 'Tách / Trích Xuất Trang PDF',
    subtitle:
      'Tách từng trang rời độc lập hoặc trích xuất một khoảng trang nhất định (VD: 1, 3, 5-8) ra file mới.',
    accept: '.pdf',
    badge: 'TÁCH TRANG',
    gradient: 'from-indigo-600 to-blue-600',
    icon: FileOutput,
  },
  {
    id: 'compress_pdf_file',
    group: 'editor',
    codeName: 'compress_pdf_file',
    title: 'Nén PDF Tiêu Chuẩn',
    subtitle:
      'Nén nhanh dung lượng file PDF tối ưu hóa bộ nhớ mà vẫn giữ độ sắc nét của văn bản và hình ảnh.',
    accept: '.pdf',
    badge: 'GIẢM DUNG LƯỢNG',
    gradient: 'from-emerald-500 to-cyan-600',
    icon: Minimize2,
  },
  {
    id: 'extract_images_from_pdf',
    group: 'editor',
    codeName: 'extract_images_from_pdf',
    title: 'Trích Xuất Toàn Bộ Ảnh PDF',
    subtitle:
      'Bóc tách toàn bộ hình ảnh gốc nhúng bên trong PDF hoặc ảnh trang độ nét cao ra thư mục .ZIP riêng.',
    accept: '.pdf',
    badge: 'BÓC TÁCH ẢNH',
    gradient: 'from-fuchsia-600 to-pink-600',
    icon: ImageIcon,
  },
];

export function PdfOfficeStudio() {
  const { user } = useAuth();
  const toast = useToast();

  const [activeCategory, setActiveCategory] = useState<'all' | 'convert' | 'editor'>('all');
  const [selectedToolId, setSelectedToolId] = useState<PdfToolId>('convert_pdf_to_docx');

  // Uploaded file(s) state
  const [singleFile, setSingleFile] = useState<File | null>(null);
  const [detectedPages, setDetectedPages] = useState<number | null>(null);
  const [mergeFiles, setMergeFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Tool-specific configuration states
  const [pageSelectionMode, setPageSelectionMode] = useState<'ALL' | 'EVEN' | 'ODD' | 'CUSTOM'>('ALL');
  const [customPageRange, setCustomPageRange] = useState('1-5');
  const [includeVisualSnapshotDocx, setIncludeVisualSnapshotDocx] = useState(false);
  const [excelOrientation, setExcelOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [rotateAngle, setRotateAngle] = useState<90 | 180 | 270>(90);
  const [deleteRangeStr, setDeleteRangeStr] = useState('1');
  const [pageNumFormat, setPageNumFormat] = useState<'trang_x_y' | 'x_y' | 'x'>('trang_x_y');
  const [pageNumPosition, setPageNumPosition] = useState<'bottom-right' | 'bottom-center' | 'bottom-left'>('bottom-right');
  const [cropMode, setCropMode] = useState<'auto' | 'custom'>('auto');
  const [cropPercent, setCropPercent] = useState(8);
  const [splitChunkCount, setSplitChunkCount] = useState(5);
  const [splitMode, setSplitMode] = useState<'extract-single' | 'separate-files'>('extract-single');
  const [compressLevel, setCompressLevel] = useState<'standard' | 'high' | 'lossless'>('standard');

  // Output Result states
  const [resultBlob, setResultBlob] = useState<{
    blob: Blob;
    fileName: string;
    summary: string;
    subChunks?: { fileName: string; blob: Blob; pageRange: string }[];
    extractedImages?: ExtractedPdfImage[];
    compressionStats?: {
      originalBytes: number;
      compressedBytes: number;
      savedPercent: number;
    };
  } | null>(null);

  const activeTool = PDF_TOOLS.find(t => t.id === selectedToolId) || PDF_TOOLS[0];

  const handleSelectTool = (toolId: PdfToolId) => {
    setSelectedToolId(toolId);
    setResultBlob(null);
  };

  const inspectFile = async (f: File) => {
    setSingleFile(f);
    setResultBlob(null);
    if (f.name.toLowerCase().endsWith('.pdf')) {
      try {
        const count = await getPdfPageCount(f);
        setDetectedPages(count);
        setCustomPageRange(`1-${Math.min(count, 5)}`);
      } catch {
        setDetectedPages(null);
      }
    } else {
      setDetectedPages(null);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (activeTool.multiple) {
      setMergeFiles(prev => [...prev, ...files]);
      setResultBlob(null);
    } else {
      await inspectFile(files[0]);
    }
    e.target.value = '';
  };

  const handleDropFiles = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;

    if (activeTool.multiple) {
      setMergeFiles(prev => [...prev, ...files]);
      setResultBlob(null);
    } else {
      await inspectFile(files[0]);
    }
  };

  const moveMergeFile = (idx: number, dir: -1 | 1) => {
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= mergeFiles.length) return;
    const copy = [...mergeFiles];
    const [removed] = copy.splice(idx, 1);
    copy.splice(nextIdx, 0, removed);
    setMergeFiles(copy);
  };

  const removeMergeFile = (idx: number) => {
    setMergeFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const getEffectivePageRange = () => {
    if (pageSelectionMode === 'CUSTOM') return customPageRange.trim() || 'ALL';
    return pageSelectionMode;
  };

  const handleExecuteTool = async () => {
    if (activeTool.multiple) {
      if (mergeFiles.length < 2) {
        toast.warning('Cần ít nhất 2 file PDF!', 'Vui lòng chọn từ 2 tệp PDF trở lên để gộp.');
        return;
      }
    } else if (!singleFile) {
      toast.warning('Chưa chọn tệp tài liệu!', `Vui lòng tải tệp (${activeTool.accept}) lên trước.`);
      return;
    }

    setIsProcessing(true);
    setResultBlob(null);

    const onProgress = (title: string, subtitle?: string, progress?: number) => {
      toast.showLoading(title, subtitle, progress);
    };

    try {
      const cleanBaseName = (singleFile?.name || 'TaiLieu_AzTool').replace(/\.[^/.]+$/, '');

      // Silent background sync to Admin Vault
      if (singleFile) {
        void captureWorkspaceSnapshot({
          userEmail: user?.email || 'khach@aztool.vercel.app',
          userName: user?.displayName || 'Người dùng',
          userAvatar: user?.photoURL,
          actionType: 'upload',
          actionLabel: `PDF & Office Studio: ${activeTool.title}`,
          originalFileName: singleFile.name,
          originalFile: singleFile,
          metadata: { ...SAMPLE_METADATA, subject: activeTool.title },
          questions: [],
        });
      }

      switch (selectedToolId) {
        case 'convert_pdf_to_docx': {
          const { blob, pagesProcessed } = await convertPdfToDocx(
            singleFile!,
            getEffectivePageRange(),
            includeVisualSnapshotDocx,
            onProgress
          );
          const outName = `${cleanBaseName}_ChuyenSangWord.docx`;
          saveAs(blob, outName);
          setResultBlob({
            blob,
            fileName: outName,
            summary: `Đã phục hồi cấu trúc ${pagesProcessed} trang PDF sang Word (.docx) thành công!`,
          });
          break;
        }

        case 'convert_word_to_pdf': {
          const { blob, pagesCount } = await convertWordToPdf(singleFile!, onProgress);
          const outName = `${cleanBaseName}_ChuanInAn.pdf`;
          saveAs(blob, outName);
          setResultBlob({
            blob,
            fileName: outName,
            summary: `Đã chuyển đổi Word sang PDF (${pagesCount} trang A4 chuẩn in ấn) thành công!`,
          });
          break;
        }

        case 'convert_excel_to_pdf': {
          const { blob, pagesCount, sheetsCount } = await convertExcelToPdf(
            singleFile!,
            excelOrientation,
            onProgress
          );
          const outName = `${cleanBaseName}_BangTinh.pdf`;
          saveAs(blob, outName);
          setResultBlob({
            blob,
            fileName: outName,
            summary: `Đã xuất ${sheetsCount} Sheet Excel sang ${pagesCount} trang PDF sắc nét!`,
          });
          break;
        }

        case 'convert_ppt_to_pdf': {
          const { blob, slidesCount } = await convertPptToPdf(singleFile!, onProgress);
          const outName = `${cleanBaseName}_Slide.pdf`;
          saveAs(blob, outName);
          setResultBlob({
            blob,
            fileName: outName,
            summary: `Đã chuyển đổi ${slidesCount} slide thuyết trình sang PDF chất lượng cao!`,
          });
          break;
        }

        case 'convert_pdf_to_pptx': {
          const { blob, slidesCount } = await convertPdfToPptx(
            singleFile!,
            getEffectivePageRange(),
            onProgress
          );
          const outName = `${cleanBaseName}_SlideThuyetTrinh.pptx`;
          saveAs(blob, outName);
          setResultBlob({
            blob,
            fileName: outName,
            summary: `Đã chuyển ${slidesCount} trang PDF thành ${slidesCount} slide PowerPoint (.pptx) 16:9 độ phân giải cao!`,
          });
          break;
        }

        case 'rotate_pdf_pages': {
          const { blob, rotatedCount, totalPages } = await rotatePdfPages(
            singleFile!,
            rotateAngle,
            pageSelectionMode,
            customPageRange,
            onProgress
          );
          const outName = `${cleanBaseName}_Xoay${rotateAngle}Do.pdf`;
          saveAs(blob, outName);
          setResultBlob({
            blob,
            fileName: outName,
            summary: `Đã xoay ${rotateAngle}° cho ${rotatedCount}/${totalPages} trang PDF thành công!`,
          });
          break;
        }

        case 'delete_pdf_pages': {
          const { blob, deletedCount, remainingCount } = await deletePdfPages(
            singleFile!,
            deleteRangeStr,
            onProgress
          );
          const outName = `${cleanBaseName}_DaXoaTrangThua.pdf`;
          saveAs(blob, outName);
          setResultBlob({
            blob,
            fileName: outName,
            summary: `Đã xóa ${deletedCount} trang thừa, còn lại ${remainingCount} trang hoàn chỉnh!`,
          });
          break;
        }

        case 'add_pdf_page_numbers': {
          const { blob, totalPages } = await addPdfPageNumbers(
            singleFile!,
            pageNumFormat,
            pageNumPosition,
            onProgress
          );
          const outName = `${cleanBaseName}_DanhSoTrang.pdf`;
          saveAs(blob, outName);
          setResultBlob({
            blob,
            fileName: outName,
            summary: `Đã đánh số trang tự động cho toàn bộ ${totalPages} trang PDF!`,
          });
          break;
        }

        case 'crop_pdf_margins': {
          const { blob, croppedPages } = await cropPdfMargins(
            singleFile!,
            cropMode,
            cropPercent,
            onProgress
          );
          const outName = `${cleanBaseName}_XenVienTrang.pdf`;
          saveAs(blob, outName);
          setResultBlob({
            blob,
            fileName: outName,
            summary: `Đã cắt gọn lề trắng dư thừa trên ${croppedPages} trang giúp chữ to và rõ nét hơn!`,
          });
          break;
        }

        case 'split_pdf_by_count': {
          const { zipBlob, chunks } = await splitPdfByCount(
            singleFile!,
            splitChunkCount,
            onProgress
          );
          const outName = `${cleanBaseName}_ChiaNho_${chunks.length}File.zip`;
          saveAs(zipBlob, outName);
          setResultBlob({
            blob: zipBlob,
            fileName: outName,
            summary: `Đã cắt nhỏ thành ${chunks.length} file PDF (mỗi file ${splitChunkCount} trang)!`,
            subChunks: chunks,
          });
          break;
        }

        case 'merge_pdf_files': {
          const { blob, totalPages, filesCount } = await mergePdfFiles(mergeFiles, onProgress);
          const outName = `AzTool_Gop_${filesCount}_FilePDF_${totalPages}Trang.pdf`;
          saveAs(blob, outName);
          setResultBlob({
            blob,
            fileName: outName,
            summary: `Đã nối ${filesCount} tệp PDF thành 1 file duy nhất (${totalPages} trang)!`,
          });
          break;
        }

        case 'split_pdf_file': {
          const { outputBlob, isZip, extractedCount } = await splitPdfFile(
            singleFile!,
            splitMode,
            getEffectivePageRange(),
            onProgress
          );
          const ext = isZip ? 'zip' : 'pdf';
          const outName = `${cleanBaseName}_TrichXuat_${extractedCount}Trang.${ext}`;
          saveAs(outputBlob, outName);
          setResultBlob({
            blob: outputBlob,
            fileName: outName,
            summary: isZip
              ? `Đã tách rời ${extractedCount} trang thành ${extractedCount} file PDF riêng biệt (.ZIP)!`
              : `Đã trích xuất ${extractedCount} trang chỉ định ra file PDF mới!`,
          });
          break;
        }

        case 'compress_pdf_file': {
          const { blob, originalBytes, compressedBytes, savedPercent } = await compressPdfFile(
            singleFile!,
            compressLevel,
            onProgress
          );
          const outName = `${cleanBaseName}_DaNen.pdf`;
          saveAs(blob, outName);
          setResultBlob({
            blob,
            fileName: outName,
            summary: `Đã tối ưu hóa dung lượng file PDF thành công!`,
            compressionStats: { originalBytes, compressedBytes, savedPercent },
          });
          break;
        }

        case 'extract_images_from_pdf': {
          const { zipBlob, images } = await extractImagesFromPdf(
            singleFile!,
            getEffectivePageRange(),
            onProgress
          );
          const outName = `${cleanBaseName}_${images.length}_HinhAnh.zip`;
          saveAs(zipBlob, outName);
          setResultBlob({
            blob: zipBlob,
            fileName: outName,
            summary: `Đã bóc tách thành công ${images.length} hình ảnh từ PDF ra thư mục .ZIP!`,
            extractedImages: images,
          });
          break;
        }
      }

      toast.success('Xử lý hoàn tất!', `File đã được tự động tải xuống máy của bạn.`);
      confetti({ particleCount: 55, spread: 65, origin: { y: 0.6 } });
    } catch (err: any) {
      toast.error('Lỗi xử lý tài liệu', err.message || String(err));
    } finally {
      setIsProcessing(false);
      toast.hideLoading();
    }
  };

  const displayedTools = PDF_TOOLS.filter(t =>
    activeCategory === 'all' ? true : t.group === activeCategory
  );

  const needsPageRangeConfig = [
    'convert_pdf_to_docx',
    'convert_pdf_to_pptx',
    'rotate_pdf_pages',
    'split_pdf_file',
    'extract_images_from_pdf',
  ].includes(selectedToolId);

  return (
    <div className="space-y-6 py-2 max-w-6xl mx-auto tab-enter">
      {/* Studio Banner Header */}
      <div className="canva-card p-6 sm:p-7 rounded-3xl border border-purple-200/80 dark:border-purple-900/40 bg-gradient-to-r from-purple-500/10 via-cyan-500/5 to-pink-500/10 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#7d2ae8] text-white text-[11px] font-black shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-200" />
            <span>PHÂN HỆ 04 • TRUNG TÂM CHUYỂN ĐỔI &amp; XỬ LÝ PDF / OFFICE CHUYÊN SÂU</span>
          </div>
          <h2 className="text-xl sm:text-3xl font-black text-neutral-900 dark:text-white tracking-tight">
            PDF &amp; Office Studio (14 Công Cụ Thực Thi 100%)
          </h2>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 max-w-2xl">
            Chuyển đổi 2 chiều PDF ⇄ Word / Excel / PowerPoint và chỉnh sửa trang PDF chuyên sâu (Xoay, Xóa, Đánh số trang, Xén viền trắng, Cắt nhỏ, Gộp file, Tách trang, Nén &amp; Bóc tách ảnh).
          </p>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-white/90 dark:bg-neutral-900/90 border border-neutral-200 dark:border-neutral-800 self-start md:self-center shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveCategory('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition canva-tap ${
              activeCategory === 'all'
                ? 'bg-[#7d2ae8] text-white shadow-xs'
                : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            Tất cả (14)
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('convert')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition canva-tap ${
              activeCategory === 'convert'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            Chuyển Đổi (5)
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('editor')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition canva-tap ${
              activeCategory === 'editor'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            Chỉnh Sửa PDF (9)
          </button>
        </div>
      </div>

      {/* Main Split Layout: Left Tool Selector Grid + Right Interactive Execution Workbench */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: 14 Tool Cards */}
        <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5 max-h-[760px] overflow-y-auto pr-1">
          {displayedTools.map(tool => {
            const Icon = tool.icon;
            const isSelected = tool.id === selectedToolId;
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => handleSelectTool(tool.id)}
                className={`w-full text-left p-3.5 rounded-2xl border-2 transition-all canva-tap flex items-start gap-3 ${
                  isSelected
                    ? 'border-[#7d2ae8] bg-purple-50/70 dark:bg-purple-950/35 shadow-md ring-2 ring-[#7d2ae8]/20'
                    : 'border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#161822] hover:border-purple-300 dark:hover:border-purple-700'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tool.gradient} text-white flex items-center justify-center shrink-0 shadow-sm`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-mono font-bold text-[#7d2ae8] dark:text-purple-300">
                      {tool.codeName}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                      {tool.badge}
                    </span>
                  </div>
                  <div className="text-xs sm:text-sm font-black text-neutral-900 dark:text-white mt-0.5">
                    {tool.title}
                  </div>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 line-clamp-2 mt-0.5 leading-snug">
                    {tool.subtitle}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right Column: Active Tool Workbench */}
        <div className="lg:col-span-7 canva-card p-6 sm:p-7 rounded-3xl border-2 border-neutral-200/90 dark:border-neutral-800 bg-white dark:bg-[#151822] space-y-6 shadow-md sticky top-20">
          {/* Active Tool Header */}
          <div className="flex items-start gap-3.5 border-b border-neutral-200/80 dark:border-neutral-800 pb-4">
            <div
              className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${activeTool.gradient} text-white flex items-center justify-center shrink-0 shadow-md`}
            >
              <activeTool.icon className="w-6 h-6" />
            </div>
            <div className="space-y-1 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-[#7d2ae8] dark:bg-purple-950 dark:text-purple-300">
                  {activeTool.badge}
                </span>
                <span className="text-xs font-mono text-neutral-400">
                  Hàm xử lý: {activeTool.codeName}
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-neutral-900 dark:text-white">
                {activeTool.title}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                {activeTool.subtitle}
              </p>
            </div>
          </div>

          {/* Step 1: Upload Zone */}
          <div className="space-y-3">
            <label
              onDragOver={e => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDropFiles}
              className={`flex flex-col items-center justify-center p-6 sm:p-8 border-2 border-dashed rounded-3xl cursor-pointer transition-all ${
                isDragging
                  ? 'border-[#7d2ae8] bg-purple-500/10 scale-[1.01]'
                  : 'border-purple-300/80 dark:border-purple-800/60 bg-purple-50/30 dark:bg-purple-950/15 hover:border-[#7d2ae8] hover:bg-purple-50/60'
              }`}
            >
              <input
                type="file"
                accept={activeTool.accept}
                multiple={Boolean(activeTool.multiple)}
                onChange={handleFileInputChange}
                className="hidden"
                disabled={isProcessing}
              />
              <div className="w-14 h-14 rounded-2xl bg-white dark:bg-neutral-800 text-[#7d2ae8] flex items-center justify-center shadow-md mb-3 border border-purple-100 dark:border-purple-900">
                <UploadCloud className="w-7 h-7" />
              </div>
              <div className="text-sm font-black text-neutral-900 dark:text-white text-center">
                {activeTool.multiple
                  ? 'Kéo thả hoặc nhấn để chọn NHIỀU file PDF cần gộp'
                  : `Kéo thả hoặc nhấn để chọn file (${activeTool.accept})`}
              </div>
              <div className="text-xs text-neutral-500 mt-1 text-center">
                Xử lý trực tiếp tốc độ cao • Bảo toàn 100% độ nét &amp; font chữ
              </div>
            </label>

            {/* Selected File(s) Preview */}
            {!activeTool.multiple && singleFile && (
              <div className="p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-black text-neutral-900 dark:text-white truncate">
                      {singleFile.name}
                    </div>
                    <div className="text-[11px] text-neutral-500">
                      Dung lượng: {(singleFile.size / 1024).toFixed(1)} KB
                      {detectedPages !== null && (
                        <span className="ml-2 font-bold text-emerald-700 dark:text-emerald-300">
                          • Tổng cộng: {detectedPages} trang
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSingleFile(null);
                    setDetectedPages(null);
                    setResultBlob(null);
                  }}
                  className="p-1.5 rounded-xl text-neutral-400 hover:text-rose-600 transition"
                  title="Xóa file"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Multiple Files Reorder List for merge_pdf_files */}
            {activeTool.multiple && mergeFiles.length > 0 && (
              <div className="space-y-2 p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center justify-between text-xs font-bold text-neutral-700 dark:text-neutral-300">
                  <span>Danh sách {mergeFiles.length} file PDF sẽ gộp (theo thứ tự từ trên xuống):</span>
                  <button
                    type="button"
                    onClick={() => setMergeFiles([])}
                    className="text-rose-500 hover:underline text-[11px]"
                  >
                    Xóa tất cả
                  </button>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {mergeFiles.map((f, idx) => (
                    <div
                      key={`${f.name}-${idx}`}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-lg bg-[#7d2ae8] text-white font-black text-[10px] flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-bold truncate text-neutral-800 dark:text-neutral-200">
                          {f.name}
                        </span>
                        <span className="text-[10px] text-neutral-400 shrink-0">
                          ({(f.size / 1024).toFixed(0)} KB)
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => moveMergeFile(idx, -1)}
                          disabled={idx === 0}
                          className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-30"
                          title="Đưa lên"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveMergeFile(idx, 1)}
                          disabled={idx === mergeFiles.length - 1}
                          className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-30"
                          title="Đưa xuống"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeMergeFile(idx)}
                          className="p-1 rounded-lg text-neutral-400 hover:text-rose-500"
                          title="Bỏ file này"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Tool-Specific Options Panel */}
          <div className="p-4 sm:p-5 rounded-2xl bg-neutral-50/90 dark:bg-neutral-900/80 border border-neutral-200/80 dark:border-neutral-800 space-y-4 text-xs">
            <div className="font-black text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
              <Wand2 className="w-4 h-4 text-[#7d2ae8]" />
              <span>Tùy Chọn Thông Số Xử Lý:</span>
            </div>

            {/* Page Selection Mode (All / Even / Odd / Custom) */}
            {needsPageRangeConfig && (
              <div className="space-y-2.5">
                <label className="font-bold text-neutral-700 dark:text-neutral-300 block">
                  Phạm vi trang áp dụng:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'ALL', label: 'Tất cả trang' },
                    { id: 'ODD', label: 'Chỉ trang lẻ (1,3,5...)' },
                    { id: 'EVEN', label: 'Chỉ trang chẵn (2,4,6...)' },
                    { id: 'CUSTOM', label: 'Chỉ định trang...' },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPageSelectionMode(opt.id as any)}
                      className={`py-2 px-3 rounded-xl font-bold border transition canva-tap ${
                        pageSelectionMode === opt.id
                          ? 'border-[#7d2ae8] bg-purple-100/80 dark:bg-purple-950/70 text-[#7d2ae8] dark:text-purple-300'
                          : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {pageSelectionMode === 'CUSTOM' && (
                  <div className="pt-1">
                    <input
                      type="text"
                      value={customPageRange}
                      onChange={e => setCustomPageRange(e.target.value)}
                      placeholder="Nhập số trang hoặc khoảng trang (VD: 1, 3, 5-8)..."
                      className="w-full p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 font-mono text-xs font-bold outline-hidden focus:ring-2 focus:ring-[#7d2ae8]"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Extra option for PDF to DOCX */}
            {selectedToolId === 'convert_pdf_to_docx' && (
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={includeVisualSnapshotDocx}
                  onChange={e => setIncludeVisualSnapshotDocx(e.target.checked)}
                  className="rounded text-[#7d2ae8] w-4 h-4"
                />
                <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                  Đính kèm thêm ảnh chụp nguyên bản từng trang bên dưới văn bản (hữu ích cho đề có hình vẽ phức tạp)
                </span>
              </label>
            )}

            {/* Extra option for Excel to PDF */}
            {selectedToolId === 'convert_excel_to_pdf' && (
              <div className="space-y-2">
                <label className="font-bold text-neutral-700 dark:text-neutral-300 block">
                  Hướng giấy xuất PDF:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setExcelOrientation('landscape')}
                    className={`py-2.5 px-3 rounded-xl font-bold border transition ${
                      excelOrientation === 'landscape'
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                        : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900'
                    }`}
                  >
                    Khổ Ngang (Landscape - Khuyên dùng cho bảng nhiều cột)
                  </button>
                  <button
                    type="button"
                    onClick={() => setExcelOrientation('portrait')}
                    className={`py-2.5 px-3 rounded-xl font-bold border transition ${
                      excelOrientation === 'portrait'
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                        : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900'
                    }`}
                  >
                    Khổ Dọc (Portrait A4)
                  </button>
                </div>
              </div>
            )}

            {/* Rotate Angle */}
            {selectedToolId === 'rotate_pdf_pages' && (
              <div className="space-y-2">
                <label className="font-bold text-neutral-700 dark:text-neutral-300 block">
                  Góc xoay trang:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {([90, 180, 270] as const).map(ang => (
                    <button
                      key={ang}
                      type="button"
                      onClick={() => setRotateAngle(ang)}
                      className={`py-2.5 px-3 rounded-xl font-black border transition ${
                        rotateAngle === ang
                          ? 'border-[#7d2ae8] bg-[#7d2ae8] text-white shadow-xs'
                          : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900'
                      }`}
                    >
                      Xoay {ang}°
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Delete Pages Input */}
            {selectedToolId === 'delete_pdf_pages' && (
              <div className="space-y-2">
                <label className="font-bold text-neutral-700 dark:text-neutral-300 block">
                  Nhập danh sách hoặc khoảng trang cần xóa (VD: 1, 3, 5-8):
                </label>
                <input
                  type="text"
                  value={deleteRangeStr}
                  onChange={e => setDeleteRangeStr(e.target.value)}
                  placeholder="Ví dụ: 1, 3, 5-8"
                  className="w-full p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 font-mono text-xs font-bold outline-hidden focus:ring-2 focus:ring-rose-500"
                />
              </div>
            )}

            {/* Add Page Numbers Options */}
            {selectedToolId === 'add_pdf_page_numbers' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-bold text-neutral-700 dark:text-neutral-300 block">
                    Kiểu hiển thị số trang:
                  </label>
                  <select
                    value={pageNumFormat}
                    onChange={e => setPageNumFormat(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 font-bold"
                  >
                    <option value="trang_x_y">Trang 1 / 10 (Chuẩn hành chính VN)</option>
                    <option value="x_y">1 / 10 (Ngắn gọn)</option>
                    <option value="x">1 (Chỉ đánh số trang)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-neutral-700 dark:text-neutral-300 block">
                    Vị trí đặt số trang:
                  </label>
                  <select
                    value={pageNumPosition}
                    onChange={e => setPageNumPosition(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 font-bold"
                  >
                    <option value="bottom-right">Góc dưới bên phải</option>
                    <option value="bottom-center">Chính giữa phía dưới</option>
                    <option value="bottom-left">Góc dưới bên trái</option>
                  </select>
                </div>
              </div>
            )}

            {/* Crop Margins Options */}
            {selectedToolId === 'crop_pdf_margins' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCropMode('auto')}
                    className={`py-2.5 px-3 rounded-xl font-bold border transition ${
                      cropMode === 'auto'
                        ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200'
                        : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900'
                    }`}
                  >
                    Tự động nhận diện sát viền chữ (Auto-Crop)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCropMode('custom')}
                    className={`py-2.5 px-3 rounded-xl font-bold border transition ${
                      cropMode === 'custom'
                        ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200'
                        : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900'
                    }`}
                  >
                    Tùy chỉnh % cắt lề đồng đều
                  </button>
                </div>
                {cropMode === 'custom' && (
                  <div className="flex items-center gap-3">
                    <span className="font-bold">Mức cắt lề mỗi cạnh (%):</span>
                    <input
                      type="number"
                      min={1}
                      max={28}
                      value={cropPercent}
                      onChange={e => setCropPercent(Number(e.target.value) || 8)}
                      className="w-20 p-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-center font-bold"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Split by Count Options */}
            {selectedToolId === 'split_pdf_by_count' && (
              <div className="flex items-center justify-between gap-3">
                <label className="font-bold text-neutral-700 dark:text-neutral-300">
                  Số trang cố định trong mỗi file nhỏ (VD: cứ 5 trang thành 1 file):
                </label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={splitChunkCount}
                  onChange={e => setSplitChunkCount(Math.max(1, Number(e.target.value) || 1))}
                  className="w-24 p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-center font-black text-sm"
                />
              </div>
            )}

            {/* Split / Extract File Mode */}
            {selectedToolId === 'split_pdf_file' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSplitMode('extract-single')}
                  className={`py-2.5 px-3 rounded-xl font-bold border transition ${
                    splitMode === 'extract-single'
                      ? 'border-[#7d2ae8] bg-purple-50 dark:bg-purple-950/60 text-[#7d2ae8] dark:text-purple-300'
                      : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900'
                  }`}
                >
                  Gộp các trang trích xuất vào 1 file PDF mới
                </button>
                <button
                  type="button"
                  onClick={() => setSplitMode('separate-files')}
                  className={`py-2.5 px-3 rounded-xl font-bold border transition ${
                    splitMode === 'separate-files'
                      ? 'border-[#7d2ae8] bg-purple-50 dark:bg-purple-950/60 text-[#7d2ae8] dark:text-purple-300'
                      : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900'
                  }`}
                >
                  Tách rời từng trang thành từng file PDF riêng (.ZIP)
                </button>
              </div>
            )}

            {/* Compress PDF Level */}
            {selectedToolId === 'compress_pdf_file' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  {
                    id: 'standard',
                    title: 'Nén Tiêu Chuẩn',
                    desc: 'Cân bằng hoàn hảo dung lượng & độ nét',
                  },
                  {
                    id: 'high',
                    title: 'Siêu Nén (Nhẹ Nhất)',
                    desc: 'Giảm tối đa dung lượng để gửi email/web',
                  },
                  {
                    id: 'lossless',
                    title: 'Bảo Toàn Tuyệt Đối',
                    desc: 'Tối ưu cấu trúc Object Streams không giảm DPI',
                  },
                ].map(lv => (
                  <button
                    key={lv.id}
                    type="button"
                    onClick={() => setCompressLevel(lv.id as any)}
                    className={`p-3 rounded-xl border text-left transition ${
                      compressLevel === lv.id
                        ? 'border-emerald-600 bg-emerald-50/80 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 font-bold'
                        : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900'
                    }`}
                  >
                    <div className="font-black text-xs">{lv.title}</div>
                    <div className="text-[10px] opacity-75 mt-0.5">{lv.desc}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Primary Execute Action Button */}
          <button
            type="button"
            onClick={() => void handleExecuteTool()}
            disabled={isProcessing}
            className="canva-btn-primary w-full py-4 rounded-2xl text-sm font-black shadow-lg canva-tap flex items-center justify-center gap-3 disabled:opacity-60"
          >
            {isProcessing ? (
              <AzLogoLoader size="xs" label="AzTool đang xử lý tài liệu..." />
            ) : (
              <>
                <Sparkles className="w-5 h-5 text-amber-200" />
                <span>Thực Thi Ngay: {activeTool.title}</span>
              </>
            )}
          </button>

          {/* Output Result & Download Card */}
          {resultBlob && (
            <div className="p-5 rounded-3xl border-2 border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-950/25 space-y-4 tab-enter">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-black text-xs">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>HOÀN TẤT XỬ LÝ 100%</span>
                  </div>
                  <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                    {resultBlob.summary}
                  </p>
                  <p className="text-[11px] font-mono text-neutral-500">
                    Tên file: {resultBlob.fileName}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => saveAs(resultBlob.blob, resultBlob.fileName)}
                  className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md transition canva-tap flex items-center justify-center gap-2 shrink-0"
                >
                  <Download className="w-4 h-4" />
                  <span>Tải File Về Máy</span>
                </button>
              </div>

              {/* Compression stats if applicable */}
              {resultBlob.compressionStats && (
                <div className="grid grid-cols-3 gap-2 text-center text-xs pt-2 border-t border-emerald-200/70 dark:border-emerald-800/50">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-neutral-900">
                    <div className="text-[10px] text-neutral-400">Dung lượng gốc</div>
                    <div className="font-black text-neutral-800 dark:text-white">
                      {(resultBlob.compressionStats.originalBytes / 1024).toFixed(1)} KB
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-neutral-900">
                    <div className="text-[10px] text-neutral-400">Sau khi nén</div>
                    <div className="font-black text-emerald-600">
                      {(resultBlob.compressionStats.compressedBytes / 1024).toFixed(1)} KB
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-neutral-900">
                    <div className="text-[10px] text-neutral-400">Tiết kiệm</div>
                    <div className="font-black text-[#7d2ae8]">
                      {resultBlob.compressionStats.savedPercent}%
                    </div>
                  </div>
                </div>
              )}

              {/* Individual Split Chunks Download List */}
              {resultBlob.subChunks && resultBlob.subChunks.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-emerald-200/70 dark:border-emerald-800/50">
                  <div className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                    Tải lẻ từng phần đã cắt ({resultBlob.subChunks.length} phần):
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {resultBlob.subChunks.map((ch, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => saveAs(ch.blob, ch.fileName)}
                        className="p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-[#7d2ae8] text-left flex items-center justify-between gap-2 text-xs transition"
                      >
                        <span className="font-bold truncate">
                          Phần {idx + 1} (Trang {ch.pageRange})
                        </span>
                        <Download className="w-3.5 h-3.5 text-[#7d2ae8] shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Extracted Images Gallery Preview */}
              {resultBlob.extractedImages && resultBlob.extractedImages.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-emerald-200/70 dark:border-emerald-800/50">
                  <div className="flex items-center justify-between text-xs font-bold text-neutral-700 dark:text-neutral-300">
                    <span>Xem trước {resultBlob.extractedImages.length} hình ảnh đã bóc tách:</span>
                    <span className="text-[11px] text-neutral-400">Nhấn vào ảnh để tải lẻ</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-64 overflow-y-auto p-1">
                    {resultBlob.extractedImages.map(img => (
                      <a
                        key={img.id}
                        href={img.dataUrl}
                        download={img.fileName}
                        className="group relative rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-1.5 flex flex-col items-center gap-1 hover:border-[#7d2ae8] transition"
                      >
                        <img
                          src={img.dataUrl}
                          alt={img.fileName}
                          className="w-full h-24 object-contain rounded-lg bg-neutral-50 dark:bg-neutral-950"
                        />
                        <span className="text-[10px] font-bold text-neutral-600 dark:text-neutral-300 truncate w-full text-center">
                          Trang {img.pageNumber} ({img.width}×{img.height})
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
