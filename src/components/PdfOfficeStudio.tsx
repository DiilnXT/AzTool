'use client';

import React, { useState } from 'react';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import confetti from 'canvas-confetti';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ToastProvider';
import { AzLogoLoader } from '@/components/DeQLogo';
import { captureWorkspaceSnapshot } from '@/lib/workspace-sync';
import { SAMPLE_METADATA } from '@/lib/sample-data';
import {
  convertPdfToDocx,
  convertPdfToExcel,
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
  unlockPdfFile,
  watermarkAndSignPdf,
  generatePdfPageThumbnails,
  exportVisualOrganizedPdf,
  compressImagesBatch,
  removeImageBackground,
  getPdfPageCount,
  ExtractedPdfImage,
  PdfPageThumbnailItem,
  CompressedImageResultItem,
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
  ArrowLeft,
  ArrowRight,
  X,
  Wand2,
  Unlock,
  Stamp,
  LayoutGrid,
  Eraser,
  RefreshCcw,
} from 'lucide-react';

export type PdfToolId =
  | 'convert_pdf_to_docx'
  | 'convert_pdf_to_excel'
  | 'convert_word_to_pdf'
  | 'convert_excel_to_pdf'
  | 'convert_ppt_to_pdf'
  | 'convert_pdf_to_pptx'
  | 'visual_pdf_organizer'
  | 'unlock_pdf_file'
  | 'watermark_sign_pdf'
  | 'rotate_pdf_pages'
  | 'delete_pdf_pages'
  | 'add_pdf_page_numbers'
  | 'crop_pdf_margins'
  | 'split_pdf_by_count'
  | 'merge_pdf_files'
  | 'split_pdf_file'
  | 'compress_pdf_file'
  | 'extract_images_from_pdf'
  | 'compress_images_batch'
  | 'remove_image_bg';

interface ToolMetadata {
  id: PdfToolId;
  group: 'convert' | 'editor' | 'image_ai';
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
  // GROUP 1: CHUYỂN ĐỔI TÀI LIỆU CHUẨN 100% (CONVERTER)
  {
    id: 'convert_pdf_to_docx',
    group: 'convert',
    codeName: 'convert_pdf_to_docx',
    title: 'PDF sang Word (.docx) Chuẩn 100%',
    subtitle:
      'Phục hồi văn bản chỉnh sửa tự do, bảng biểu chuẩn độ rộng cột & gộp ô, tách ảnh độc lập (không dán chết cả trang) + AI OCR bản Scan & Xử lý hàng loạt.',
    accept: '.pdf',
    multiple: true,
    badge: 'SIÊU CHUẨN 100%',
    gradient: 'from-blue-600 to-indigo-600',
    icon: FileText,
  },
  {
    id: 'convert_pdf_to_excel',
    group: 'convert',
    codeName: 'convert_pdf_to_excel',
    title: 'PDF / Bản Scan sang Excel (.xlsx)',
    subtitle:
      'Chuyển thẳng từ PDF (kể cả file Scan) sang bảng tính Excel giữ nguyên 100% cấu trúc hàng/cột, ô gộp (Merge), màu nền ô, đường kẻ viền và số liệu tính toán được.',
    accept: '.pdf',
    badge: 'PRO • GIỮ MÀU & Ô GỘP',
    gradient: 'from-emerald-600 to-green-600',
    icon: FileSpreadsheet,
  },
  {
    id: 'convert_word_to_pdf',
    group: 'convert',
    codeName: 'convert_word_to_pdf',
    title: 'Word sang PDF (Giữ 100% Toán Học)',
    subtitle:
      'Chuyển đổi .doc, .docx sang PDF chuẩn in ấn A4, bảo toàn 100% công thức toán học (OMML: phân số, căn thức, tích phân, hệ phương trình), bảng biểu, màu nền và hình ảnh.',
    accept: '.docx,.doc',
    badge: '100% CÔNG THỨC TOÁN',
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
    gradient: 'from-teal-600 to-emerald-600',
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

  // GROUP 2: CHỈNH SỬA & BẢO MẬT TRANG PDF CHUYÊN SÂU
  {
    id: 'visual_pdf_organizer',
    group: 'editor',
    codeName: 'visual_pdf_organizer',
    title: 'Quản Lý Trang PDF Trực Quan (Thumbnail)',
    subtitle:
      'Hiển thị ảnh thu nhỏ từng trang PDF: Xoay 90° từng trang bị ngược, Đổi vị trí trang, Xóa trang trắng trực quan ngay trên lưới.',
    accept: '.pdf',
    badge: 'THUMBNAIL TRỰC QUAN',
    gradient: 'from-[#7d2ae8] to-fuchsia-600',
    icon: LayoutGrid,
  },
  {
    id: 'unlock_pdf_file',
    group: 'editor',
    codeName: 'unlock_pdf_file',
    title: 'Mở Khóa & Xóa Chặn In/Copy PDF',
    subtitle:
      'Gỡ bỏ hoàn toàn khóa bảo vệ (Owner Password / Permissions Lock) chặn In ấn, chặn Copy chữ hoặc chặn Chỉnh sửa trên file PDF.',
    accept: '.pdf',
    badge: 'MỞ KHÓA PDF',
    gradient: 'from-amber-500 to-red-600',
    icon: Unlock,
  },
  {
    id: 'watermark_sign_pdf',
    group: 'editor',
    codeName: 'watermark_sign_pdf',
    title: 'Đóng Dấu Bản Quyền & Ký Tên PDF',
    subtitle:
      'Đóng dấu chữ chéo chống sao chép (Watermark tiếng Việt) kèm chèn ảnh chữ ký điện tử / con dấu đỏ trong suốt lên toàn bộ trang.',
    accept: '.pdf',
    badge: 'WATERMARK & CHỮ KÝ',
    gradient: 'from-rose-600 to-red-600',
    icon: Stamp,
  },
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

  // GROUP 3: CÔNG CỤ HÌNH ẢNH & AI THÔNG MINH (THAY THẾ TINYPNG & REMOVE.BG)
  {
    id: 'compress_images_batch',
    group: 'image_ai',
    codeName: 'compress_images_batch',
    title: 'Nén Ảnh Hàng Loạt (Chuẩn TinyPNG)',
    subtitle:
      'Nén cùng lúc hàng chục ảnh JPG, PNG, WebP giảm 60–80% dung lượng mà mắt thường không phân biệt được sự khác biệt.',
    accept: 'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp',
    multiple: true,
    badge: 'THAY THẾ TINYPNG',
    gradient: 'from-sky-500 to-indigo-600',
    icon: Minimize2,
  },
  {
    id: 'remove_image_bg',
    group: 'image_ai',
    codeName: 'remove_image_bg',
    title: 'Tách Nền Ảnh AI & Con Dấu (Remove.bg)',
    subtitle:
      'Tách nền trong suốt (.PNG) cho ảnh chân dung thẻ, ảnh sản phẩm, chữ ký viết tay hoặc con dấu đỏ để chèn vào Word/PDF.',
    accept: 'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp',
    badge: 'THAY THẾ REMOVE.BG',
    gradient: 'from-purple-600 to-pink-600',
    icon: Eraser,
  },
];

export function PdfOfficeStudio() {
  const { user, systemConfig } = useAuth();
  const toast = useToast();

  const [activeCategory, setActiveCategory] = useState<'all' | 'convert' | 'editor' | 'image_ai'>('all');
  const [selectedToolId, setSelectedToolId] = useState<PdfToolId>('convert_pdf_to_docx');

  // Uploaded file(s) state
  const [singleFile, setSingleFile] = useState<File | null>(null);
  const [detectedPages, setDetectedPages] = useState<number | null>(null);
  const [mergeFiles, setMergeFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);

  // Tool-specific configuration states
  const [pageSelectionMode, setPageSelectionMode] = useState<'ALL' | 'EVEN' | 'ODD' | 'CUSTOM'>('ALL');
  const [customPageRange, setCustomPageRange] = useState('1-5');
  const [includeVisualSnapshotDocx, setIncludeVisualSnapshotDocx] = useState(false);
  const [excelSheetMode, setExcelSheetMode] = useState<'single_sheet' | 'sheet_per_page'>('single_sheet');
  const [excelAiOcrMode, setExcelAiOcrMode] = useState<'auto' | 'always'>('auto');
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

  // Watermark & Signature options
  const [watermarkText, setWatermarkText] = useState('BẢN QUYỀN AZTOOL STUDIO - LƯU HÀNH NỘI BỘ');
  const [watermarkColor, setWatermarkColor] = useState('#dc2626');
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.25);
  const [watermarkPosition, setWatermarkPosition] = useState<'diagonal-center' | 'bottom-right' | 'top-right' | 'bottom-left'>('diagonal-center');
  const [signatureFile, setSignatureFile] = useState<File | null>(null);

  // Visual PDF Organizer state
  const [thumbnailPages, setThumbnailPages] = useState<PdfPageThumbnailItem[]>([]);
  const [isLoadingThumbnails, setIsLoadingThumbnails] = useState(false);

  // Image Batch Compression & Remove BG options
  const [imageCompressQuality, setImageCompressQuality] = useState<'high' | 'balanced' | 'ultra'>('balanced');
  const [bgRemoveMode, setBgRemoveMode] = useState<'auto_edge' | 'signature_stamp'>('auto_edge');
  const [bgTolerance, setBgTolerance] = useState(36);

  // Output Result states
  const [resultBlob, setResultBlob] = useState<{
    blob: Blob;
    fileName: string;
    summary: string;
    subChunks?: { fileName: string; blob: Blob; pageRange: string }[];
    extractedImages?: ExtractedPdfImage[];
    compressedImages?: CompressedImageResultItem[];
    removedBgPreviewUrl?: string;
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

        if (selectedToolId === 'visual_pdf_organizer') {
          setIsLoadingThumbnails(true);
          try {
            const thumbs = await generatePdfPageThumbnails(f);
            setThumbnailPages(thumbs);
          } finally {
            setIsLoadingThumbnails(false);
          }
        }
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
      setSingleFile(files[0]);
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
      setSingleFile(files[0]);
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

  // Visual Organizer Helpers
  const rotateSingleThumbnail = (idx: number) => {
    setThumbnailPages(prev =>
      prev.map((item, i) =>
        i === idx ? { ...item, rotation: (item.rotation + 90) % 360 } : item
      )
    );
  };

  const toggleDeleteSingleThumbnail = (idx: number) => {
    setThumbnailPages(prev =>
      prev.map((item, i) => (i === idx ? { ...item, deleted: !item.deleted } : item))
    );
  };

  const moveSingleThumbnail = (idx: number, dir: -1 | 1) => {
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= thumbnailPages.length) return;
    const copy = [...thumbnailPages];
    const [removed] = copy.splice(idx, 1);
    copy.splice(nextIdx, 0, removed);
    setThumbnailPages(copy);
  };

  const getEffectivePageRange = () => {
    if (pageSelectionMode === 'CUSTOM') return customPageRange.trim() || 'ALL';
    return pageSelectionMode;
  };

  const getApiKeysPool = (): string => {
    if (user?.customApiKey && user.customApiKey.trim()) return user.customApiKey;
    if (systemConfig?.defaultGeminiApiKey && systemConfig.defaultGeminiApiKey.trim()) {
      return systemConfig.defaultGeminiApiKey;
    }
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('deq_gemini_keys');
      if (saved && saved.trim()) return saved;
    }
    return '';
  };

  const handleExecuteTool = async () => {
    if (selectedToolId === 'merge_pdf_files') {
      if (mergeFiles.length < 2) {
        toast.warning('Cần ít nhất 2 file PDF!', 'Vui lòng chọn từ 2 tệp PDF trở lên để gộp.');
        return;
      }
    } else if (selectedToolId === 'compress_images_batch' || selectedToolId === 'convert_pdf_to_docx') {
      if (mergeFiles.length === 0 && !singleFile) {
        toast.warning('Chưa chọn tệp!', `Vui lòng tải tệp (${activeTool.accept}) lên trước.`);
        return;
      }
    } else if (!singleFile) {
      toast.warning('Chưa chọn tệp tài liệu!', `Vui lòng tải tệp (${activeTool.accept}) lên trước.`);
      return;
    }

    setIsProcessing(true);
    setProcessingProgress(8);
    setResultBlob(null);

    const onProgress = (title: string, subtitle?: string, progress?: number) => {
      if (typeof progress === 'number') {
        setProcessingProgress(Math.max(5, Math.min(100, Math.round(progress))));
      }
      toast.showLoading(title, subtitle, progress);
    };

    try {
      const primaryFile = singleFile || mergeFiles[0];
      const cleanBaseName = (primaryFile?.name || 'TaiLieu_AzTool').replace(/\.[^/.]+$/, '');
      const apiKeysStr = getApiKeysPool();

      // Silent background sync to Admin Vault
      if (primaryFile) {
        void captureWorkspaceSnapshot({
          userEmail: user?.email || 'khach@aztool.vercel.app',
          userName: user?.displayName || 'Người dùng',
          userAvatar: user?.photoURL,
          actionType: 'upload',
          actionLabel: `PDF & Office Studio: ${activeTool.title}`,
          originalFileName: primaryFile.name,
          originalFile: primaryFile,
          metadata: { ...SAMPLE_METADATA, subject: activeTool.title },
          questions: [],
        });
      }

      switch (selectedToolId) {
        case 'convert_pdf_to_docx': {
          const targetPdfFiles = mergeFiles.length > 0 ? mergeFiles : [singleFile!];
          if (targetPdfFiles.length === 1) {
            const { blob, pagesProcessed } = await convertPdfToDocx(
              targetPdfFiles[0],
              getEffectivePageRange(),
              includeVisualSnapshotDocx,
              onProgress,
              apiKeysStr
            );
            const outName = `${cleanBaseName}_ChuyenSangWord.docx`;
            saveAs(blob, outName);
            setResultBlob({
              blob,
              fileName: outName,
              summary: `Đã phục hồi cấu trúc ${pagesProcessed} trang PDF sang Word (.docx) giữ nguyên văn bản, bảng biểu & ảnh gốc!`,
            });
          } else {
            // Batch convert multiple PDFs to DOCX ZIP
            const zip = new JSZip();
            const subDocs: { fileName: string; blob: Blob; pageRange: string }[] = [];
            for (let i = 0; i < targetPdfFiles.length; i++) {
              const f = targetPdfFiles[i];
              onProgress(
                `Đang chuyển đổi hàng loạt file ${i + 1}/${targetPdfFiles.length}: ${f.name}...`,
                'Bóc tách văn bản, bảng biểu & hình ảnh sang Word (.docx)',
                Math.round(((i + 1) / targetPdfFiles.length) * 90)
              );
              const { blob, pagesProcessed } = await convertPdfToDocx(
                f,
                getEffectivePageRange(),
                includeVisualSnapshotDocx,
                undefined,
                apiKeysStr
              );
              const base = f.name.replace(/\.[^/.]+$/, '');
              const docName = `${base}_Word.docx`;
              zip.file(docName, blob);
              subDocs.push({
                fileName: docName,
                blob,
                pageRange: `${pagesProcessed} trang`,
              });
            }
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const outName = `AzTool_Batch_${targetPdfFiles.length}_FileWord.zip`;
            saveAs(zipBlob, outName);
            setResultBlob({
              blob: zipBlob,
              fileName: outName,
              summary: `Đã chuyển đổi hàng loạt ${targetPdfFiles.length} file PDF sang ${targetPdfFiles.length} file Word (.docx) thành công!`,
              subChunks: subDocs,
            });
          }
          break;
        }

        case 'convert_pdf_to_excel': {
          const { blob, pagesProcessed, totalRows } = await convertPdfToExcel(
            singleFile!,
            getEffectivePageRange(),
            excelSheetMode,
            excelAiOcrMode,
            onProgress,
            apiKeysStr
          );
          const outName = `${cleanBaseName}_BangTinhChuan.xlsx`;
          saveAs(blob, outName);
          setResultBlob({
            blob,
            fileName: outName,
            summary: `Đã chuyển ${pagesProcessed} trang PDF sang Excel (.xlsx) với ${totalRows} dòng dữ liệu (giữ nguyên cột, màu nền, đường kẻ & ô gộp)!`,
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
            summary: `Đã chuyển đổi Word sang PDF (${pagesCount} trang A4 chuẩn in ấn, bảo toàn 100% công thức toán học & bảng biểu)!`,
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

        case 'visual_pdf_organizer': {
          let pagesToExport = thumbnailPages;
          if (pagesToExport.length === 0) {
            pagesToExport = await generatePdfPageThumbnails(singleFile!, onProgress);
            setThumbnailPages(pagesToExport);
          }
          const { blob, finalPageCount } = await exportVisualOrganizedPdf(
            singleFile!,
            pagesToExport,
            onProgress
          );
          const outName = `${cleanBaseName}_DaSapXepTrang.pdf`;
          saveAs(blob, outName);
          setResultBlob({
            blob,
            fileName: outName,
            summary: `Đã xuất file PDF mới gồm ${finalPageCount} trang theo đúng bố cục xoay & sắp xếp trực quan!`,
          });
          break;
        }

        case 'unlock_pdf_file': {
          const { blob, totalPages } = await unlockPdfFile(singleFile!, onProgress);
          const outName = `${cleanBaseName}_DaMoKhoa.pdf`;
          saveAs(blob, outName);
          setResultBlob({
            blob,
            fileName: outName,
            summary: `Đã gỡ bỏ hoàn toàn khóa bảo vệ (In ấn / Copy / Chỉnh sửa) cho ${totalPages} trang PDF!`,
          });
          break;
        }

        case 'watermark_sign_pdf': {
          const { blob, stampedPages } = await watermarkAndSignPdf(
            singleFile!,
            {
              watermarkText,
              angleDeg: 35,
              opacity: watermarkOpacity,
              colorHex: watermarkColor,
              position: watermarkPosition,
              signatureImageFile: signatureFile,
              pageRangeStr: getEffectivePageRange(),
            },
            onProgress
          );
          const outName = `${cleanBaseName}_BanQuyen_Signed.pdf`;
          saveAs(blob, outName);
          setResultBlob({
            blob,
            fileName: outName,
            summary: `Đã đóng dấu bản quyền Watermark & chữ ký điện tử lên ${stampedPages} trang PDF!`,
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

        case 'compress_images_batch': {
          const targetImgs = mergeFiles.length > 0 ? mergeFiles : [singleFile!];
          const {
            items,
            zipBlob,
            totalOriginalBytes,
            totalCompressedBytes,
            totalSavedPercent,
          } = await compressImagesBatch(targetImgs, imageCompressQuality, onProgress);

          if (items.length === 1) {
            saveAs(items[0].blob, items[0].fileName);
            setResultBlob({
              blob: items[0].blob,
              fileName: items[0].fileName,
              summary: `Đã nén thông minh ảnh giữ nguyên độ sắc nét, giảm ${totalSavedPercent}% dung lượng!`,
              compressedImages: items,
              compressionStats: {
                originalBytes: totalOriginalBytes,
                compressedBytes: totalCompressedBytes,
                savedPercent: totalSavedPercent,
              },
            });
          } else {
            const outName = `AzTool_NenAnh_${items.length}File.zip`;
            saveAs(zipBlob, outName);
            setResultBlob({
              blob: zipBlob,
              fileName: outName,
              summary: `Đã nén hàng loạt ${items.length} hình ảnh, tiết kiệm ${totalSavedPercent}% dung lượng!`,
              compressedImages: items,
              compressionStats: {
                originalBytes: totalOriginalBytes,
                compressedBytes: totalCompressedBytes,
                savedPercent: totalSavedPercent,
              },
            });
          }
          break;
        }

        case 'remove_image_bg': {
          const { blob, dataUrl, fileName, width, height } = await removeImageBackground(
            singleFile!,
            bgTolerance,
            bgRemoveMode,
            onProgress
          );
          saveAs(blob, fileName);
          setResultBlob({
            blob,
            fileName,
            summary: `Đã tách nền trong suốt (.PNG ${width}×${height} px) thành công!`,
            removedBgPreviewUrl: dataUrl,
          });
          break;
        }
      }

      toast.success('Xử lý hoàn tất!', `File đã được tự động tải xuống máy của bạn.`);
      confetti({ particleCount: 55, spread: 65, origin: { y: 0.6 } });
    } catch (err: any) {
      toast.error('Lỗi xử lý tài liệu', err.message || String(err));
    } finally {
      setProcessingProgress(100);
      setIsProcessing(false);
      toast.hideLoading();
    }
  };

  const displayedTools = PDF_TOOLS.filter(t =>
    activeCategory === 'all' ? true : t.group === activeCategory
  );

  const needsPageRangeConfig = [
    'convert_pdf_to_docx',
    'convert_pdf_to_excel',
    'convert_pdf_to_pptx',
    'watermark_sign_pdf',
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
            <span>PHÂN HỆ PRO • TRUNG TÂM CHUYỂN ĐỔI PDF / WORD / EXCEL &amp; ĐỒ HỌA AI</span>
          </div>
          <h2 className="text-xl sm:text-3xl font-black text-neutral-900 dark:text-white tracking-tight">
            PDF &amp; Office Studio (20 Công Cụ Thực Thi 100%)
          </h2>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 max-w-2xl">
            Chuyển đổi PDF (kể cả bản Scan) ⇄ Word / Excel / PowerPoint giữ nguyên 100% công thức toán học, bảng biểu, màu ô, đường kẻ, gộp ô; kèm bộ công cụ Mở khóa PDF, Đóng dấu bản quyền, Quản lý trang Thumbnail, Nén ảnh &amp; Tách nền AI.
          </p>
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-white/90 dark:bg-neutral-900/90 border border-neutral-200 dark:border-neutral-800 self-start md:self-center shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveCategory('all')}
            className={`px-3 py-2 rounded-xl text-xs font-extrabold transition canva-tap ${
              activeCategory === 'all'
                ? 'bg-[#7d2ae8] text-white shadow-xs'
                : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            Tất cả (20)
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('convert')}
            className={`px-3 py-2 rounded-xl text-xs font-extrabold transition canva-tap ${
              activeCategory === 'convert'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            Chuyển Đổi (6)
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('editor')}
            className={`px-3 py-2 rounded-xl text-xs font-extrabold transition canva-tap ${
              activeCategory === 'editor'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            Chỉnh Sửa PDF (12)
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('image_ai')}
            className={`px-3 py-2 rounded-xl text-xs font-extrabold transition canva-tap ${
              activeCategory === 'image_ai'
                ? 'bg-pink-600 text-white shadow-xs'
                : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            Nén &amp; Tách Nền Ảnh (2)
          </button>
        </div>
      </div>

      {/* Main Split Layout: Left Tool Selector Grid + Right Interactive Execution Workbench */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: 20 Tool Cards */}
        <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5 max-h-[820px] overflow-y-auto pr-1">
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
                  ? `Kéo thả hoặc nhấn để chọn 1 hoặc NHIỀU file (${activeTool.accept})`
                  : `Kéo thả hoặc nhấn để chọn file (${activeTool.accept})`}
              </div>
              <div className="text-xs text-neutral-500 mt-1 text-center">
                Xử lý trực tiếp tốc độ cao • Bảo toàn 100% độ nét, bảng biểu &amp; công thức toán học
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
                    setThumbnailPages([]);
                    setResultBlob(null);
                  }}
                  className="p-1.5 rounded-xl text-neutral-400 hover:text-rose-600 transition"
                  title="Xóa file"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Multiple Files Reorder List */}
            {activeTool.multiple && mergeFiles.length > 0 && (
              <div className="space-y-2 p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center justify-between text-xs font-bold text-neutral-700 dark:text-neutral-300">
                  <span>Danh sách {mergeFiles.length} file đã chọn:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setMergeFiles([]);
                      setSingleFile(null);
                    }}
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
              <div className="space-y-2 pt-1">
                <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/50 text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
                  <strong>Cam kết chuẩn 100%:</strong> Bóc tách từng đoạn văn bản chỉnh sửa tự do, dựng lại bảng biểu với độ rộng cột &amp; ô gộp chuẩn, chỉ trích xuất hình ảnh minh họa độc lập (tuyệt đối không chụp nguyên cả trang dán chết). Tự động kích hoạt AI OCR nếu phát hiện PDF Scan!
                </div>
                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={includeVisualSnapshotDocx}
                    onChange={e => setIncludeVisualSnapshotDocx(e.target.checked)}
                    className="rounded text-[#7d2ae8] w-4 h-4"
                  />
                  <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                    Đính kèm thêm bản chụp đối chiếu bên dưới văn bản (tùy chọn bổ sung)
                  </span>
                </label>
              </div>
            )}

            {/* Extra options for PDF to EXCEL */}
            {selectedToolId === 'convert_pdf_to_excel' && (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1.5">
                    <label className="font-bold text-neutral-700 dark:text-neutral-300 block">
                      Cách bố trí Sheet Excel:
                    </label>
                    <select
                      value={excelSheetMode}
                      onChange={e => setExcelSheetMode(e.target.value as any)}
                      className="w-full p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 font-bold"
                    >
                      <option value="single_sheet">Gộp liên hoàn vào 1 Sheet duy nhất (Chuẩn báo cáo)</option>
                      <option value="sheet_per_page">Tách mỗi trang PDF thành 1 Sheet riêng</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-neutral-700 dark:text-neutral-300 block">
                      Chế độ nhận diện bảng &amp; bản Scan:
                    </label>
                    <select
                      value={excelAiOcrMode}
                      onChange={e => setExcelAiOcrMode(e.target.value as any)}
                      className="w-full p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 font-bold"
                    >
                      <option value="auto">Tự động (Lattice Grid + AI Vision OCR khi gặp trang Scan)</option>
                      <option value="always">Luôn dùng AI Vision OCR chuyên sâu (Cho bảng Scan phức tạp)</option>
                    </select>
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-[11px] text-emerald-800 dark:text-emerald-200">
                  Giữ nguyên 100% số dòng, số cột, ô gộp (Merged Cells), màu nền tiêu đề, đường kẻ viền và tự động chuyển số liệu về dạng Number để tính hàm <code>SUM</code>, <code>AVERAGE</code>, <code>VLOOKUP</code> ngay.
                </div>
              </div>
            )}

            {/* Extra info for Word to PDF */}
            {selectedToolId === 'convert_word_to_pdf' && (
              <div className="p-3 rounded-xl bg-cyan-50/80 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800/60 text-[11px] text-cyan-900 dark:text-cyan-200 leading-relaxed">
                <strong>Engine OMML Math &amp; Table 2.0:</strong> Hỗ trợ đọc trực tiếp cấu trúc <code>&lt;m:oMath&gt;</code> trong file Word để vẽ chính xác 100% phân số, căn bậc n, tích phân ∫, tổng Σ, giới hạn lim, hệ phương trình, ma trận, chỉ số trên/dưới và tập hợp số (ℝ, ℤ, ℕ, ℚ) mà không bị mất hay lỗi ký tự!
              </div>
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

            {/* Visual PDF Organizer Thumbnail Grid */}
            {selectedToolId === 'visual_pdf_organizer' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-neutral-700 dark:text-neutral-300">
                    Sắp xếp, xoay 90° hoặc xóa từng trang trực quan:
                  </span>
                  {singleFile && (
                    <button
                      type="button"
                      onClick={async () => {
                        setIsLoadingThumbnails(true);
                        try {
                          const thumbs = await generatePdfPageThumbnails(singleFile);
                          setThumbnailPages(thumbs);
                        } finally {
                          setIsLoadingThumbnails(false);
                        }
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-[#7d2ae8] hover:underline"
                    >
                      <RefreshCcw className="w-3.5 h-3.5" />
                      <span>Khôi phục ban đầu</span>
                    </button>
                  )}
                </div>

                {isLoadingThumbnails && (
                  <div className="py-6 flex justify-center">
                    <AzLogoLoader size="xs" label="Đang tạo ảnh thu nhỏ từng trang PDF..." />
                  </div>
                )}

                {!isLoadingThumbnails && thumbnailPages.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-96 overflow-y-auto p-1">
                    {thumbnailPages.map((pg, idx) => (
                      <div
                        key={`${pg.originalPageNumber}-${idx}`}
                        className={`p-2.5 rounded-2xl border-2 transition flex flex-col items-center gap-2 ${
                          pg.deleted
                            ? 'border-rose-300 bg-rose-50/50 dark:bg-rose-950/30 opacity-50'
                            : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900'
                        }`}
                      >
                        <div className="w-full flex items-center justify-between text-[10px] font-black">
                          <span className="px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950 text-[#7d2ae8] dark:text-purple-300">
                            Trang {pg.originalPageNumber}
                          </span>
                          {pg.rotation > 0 && (
                            <span className="text-amber-600 font-mono">+{pg.rotation}°</span>
                          )}
                        </div>
                        <div className="w-full h-32 flex items-center justify-center overflow-hidden bg-neutral-100 dark:bg-neutral-950 rounded-xl">
                          <img
                            src={pg.thumbnailDataUrl}
                            alt={`Trang ${pg.originalPageNumber}`}
                            style={{ transform: `rotate(${pg.rotation}deg)` }}
                            className="max-h-28 max-w-full object-contain transition-transform duration-200"
                          />
                        </div>
                        <div className="flex items-center justify-center gap-1 w-full">
                          <button
                            type="button"
                            onClick={() => moveSingleThumbnail(idx, -1)}
                            disabled={idx === 0}
                            className="p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-purple-100 disabled:opacity-30"
                            title="Đổi chỗ sang trái"
                          >
                            <ArrowLeft className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => rotateSingleThumbnail(idx)}
                            className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-950/70 text-[#7d2ae8] dark:text-purple-300 hover:bg-purple-200"
                            title="Xoay 90°"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleDeleteSingleThumbnail(idx)}
                            className={`p-1.5 rounded-lg ${
                              pg.deleted
                                ? 'bg-rose-600 text-white'
                                : 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 hover:bg-rose-100'
                            }`}
                            title={pg.deleted ? 'Khôi phục trang' : 'Xóa trang này'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveSingleThumbnail(idx, 1)}
                            disabled={idx === thumbnailPages.length - 1}
                            className="p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-purple-100 disabled:opacity-30"
                            title="Đổi chỗ sang phải"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Watermark & Signature Options */}
            {selectedToolId === 'watermark_sign_pdf' && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="font-bold text-neutral-700 dark:text-neutral-300 block">
                    Nội dung chữ đóng dấu bản quyền (Watermark tiếng Việt):
                  </label>
                  <input
                    type="text"
                    value={watermarkText}
                    onChange={e => setWatermarkText(e.target.value)}
                    placeholder="VD: BẢN QUYỀN ĐỀ THI - CẤM SAO CHÉP..."
                    className="w-full p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 font-bold"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="space-y-1">
                    <label className="font-bold text-neutral-700 dark:text-neutral-300 block">
                      Vị trí đóng dấu:
                    </label>
                    <select
                      value={watermarkPosition}
                      onChange={e => setWatermarkPosition(e.target.value as any)}
                      className="w-full p-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 font-bold"
                    >
                      <option value="diagonal-center">Chéo giữa trang (35°)</option>
                      <option value="bottom-right">Góc dưới bên phải</option>
                      <option value="top-right">Góc trên bên phải</option>
                      <option value="bottom-left">Góc dưới bên trái</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-neutral-700 dark:text-neutral-300 block">
                      Màu chữ dấu:
                    </label>
                    <input
                      type="color"
                      value={watermarkColor}
                      onChange={e => setWatermarkColor(e.target.value)}
                      className="w-full h-9 rounded-xl border border-neutral-300 cursor-pointer"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-neutral-700 dark:text-neutral-300 block">
                      Độ mờ ({Math.round(watermarkOpacity * 100)}%):
                    </label>
                    <input
                      type="range"
                      min={0.08}
                      max={0.85}
                      step={0.05}
                      value={watermarkOpacity}
                      onChange={e => setWatermarkOpacity(Number(e.target.value))}
                      className="w-full accent-[#7d2ae8]"
                    />
                  </div>
                </div>
                <div className="space-y-1.5 pt-1">
                  <label className="font-bold text-neutral-700 dark:text-neutral-300 block">
                    Đính kèm thêm ảnh Chữ ký tay / Con dấu đỏ PNG (tùy chọn):
                  </label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={e => setSignatureFile(e.target.files?.[0] || null)}
                    className="w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:bg-purple-100 file:text-[#7d2ae8] file:font-bold"
                  />
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

            {/* Compress Images Batch Options */}
            {selectedToolId === 'compress_images_batch' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  {
                    id: 'balanced',
                    title: 'Cân Bằng Thông Minh (Khuyên dùng)',
                    desc: 'Giảm 60-75% dung lượng, giữ nguyên độ nét',
                  },
                  {
                    id: 'high',
                    title: 'Chất Lượng Cực Cao (In Ấn)',
                    desc: 'Giữ tối đa chi tiết ảnh gốc (3200px)',
                  },
                  {
                    id: 'ultra',
                    title: 'Siêu Nhẹ (Đính Kèm Web/Email)',
                    desc: 'Tối ưu kích thước nhỏ gọn nhất',
                  },
                ].map(lv => (
                  <button
                    key={lv.id}
                    type="button"
                    onClick={() => setImageCompressQuality(lv.id as any)}
                    className={`p-3 rounded-xl border text-left transition ${
                      imageCompressQuality === lv.id
                        ? 'border-sky-600 bg-sky-50/80 dark:bg-sky-950/60 text-sky-900 dark:text-sky-200 font-bold'
                        : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900'
                    }`}
                  >
                    <div className="font-black text-xs">{lv.title}</div>
                    <div className="text-[10px] opacity-75 mt-0.5">{lv.desc}</div>
                  </button>
                ))}
              </div>
            )}

            {/* Remove Image Background Options */}
            {selectedToolId === 'remove_image_bg' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBgRemoveMode('auto_edge')}
                    className={`p-3 rounded-xl border text-left transition ${
                      bgRemoveMode === 'auto_edge'
                        ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/60 text-purple-900 dark:text-purple-200 font-bold'
                        : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900'
                    }`}
                  >
                    <div className="font-black text-xs">Chân Dung / Sản Phẩm (Flood-Fill Viền)</div>
                    <div className="text-[10px] opacity-75 mt-0.5">
                      Bảo toàn vùng màu sáng bên trong chủ thể (áo trắng, mắt...)
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBgRemoveMode('signature_stamp')}
                    className={`p-3 rounded-xl border text-left transition ${
                      bgRemoveMode === 'signature_stamp'
                        ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/60 text-purple-900 dark:text-purple-200 font-bold'
                        : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900'
                    }`}
                  >
                    <div className="font-black text-xs">Chữ Ký Tay / Con Dấu Đỏ / Logo</div>
                    <div className="text-[10px] opacity-75 mt-0.5">
                      Lọc sạch nền giấy trắng kể cả bên trong các nét chữ khép kín
                    </div>
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold">Độ nhạy lọc nền ({bgTolerance}):</span>
                  <input
                    type="range"
                    min={15}
                    max={75}
                    value={bgTolerance}
                    onChange={e => setBgTolerance(Number(e.target.value))}
                    className="flex-1 accent-[#7d2ae8]"
                  />
                </div>
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
              <AzLogoLoader size="xs" label="AzTool đang xử lý tài liệu..." progress={processingProgress} />
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

              {/* Removed BG Preview */}
              {resultBlob.removedBgPreviewUrl && (
                <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:12px_12px] flex justify-center">
                  <img
                    src={resultBlob.removedBgPreviewUrl}
                    alt="Ảnh đã tách nền"
                    className="max-h-60 object-contain rounded-xl"
                  />
                </div>
              )}

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

              {/* Individual Split Chunks / Batch Docs Download List */}
              {resultBlob.subChunks && resultBlob.subChunks.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-emerald-200/70 dark:border-emerald-800/50">
                  <div className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                    Tải lẻ từng file ({resultBlob.subChunks.length} file):
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
                          {ch.fileName} ({ch.pageRange})
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
