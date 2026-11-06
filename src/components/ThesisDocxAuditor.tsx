'use client';

import React, { useState, useRef } from 'react';
import PizZip from 'pizzip';
import { saveAs } from 'file-saver';
import confetti from 'canvas-confetti';
import {
  analyzeWordThesisDocx,
  applySurgicalFixToZip,
  exportFixedThesisDocxBlob,
  ThesisAuditReport,
  ThesisAuditIssue,
} from '@/lib/word-thesis-engine';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ToastProvider';
import { captureWorkspaceSnapshot } from '@/lib/workspace-sync';
import { SAMPLE_METADATA } from '@/lib/sample-data';
import { DeQLogo, AzLogoLoader } from '@/components/DeQLogo';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ImageRun,
  AlignmentType,
  HeadingLevel,
} from 'docx';
import {
  UploadCloud,
  FileCheck2,
  AlertTriangle,
  CheckCircle2,
  Wand2,
  Download,
  Image as ImageIcon,
  Table as TableIcon,
  BookOpenCheck,
  Sparkles,
  Check,
  FileText,
  RefreshCw,
  Layers,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

/**
 * Generates a realistic sample Thesis/Textbook .docx with intentional errors:
 * - Image between Hình 1.1 and Hình 1.2 without caption (should be 1.1, 1.2, 1.3)
 * - Sequence gap in Chapter 2: Ảnh 2.1 -> Ảnh 2.2 -> Ảnh 2.3 -> jumps to Ảnh 2.5 (missing 2.4)
 * - Table sequence gap: Bảng 1.1 -> Bảng 1.3 (missing 1.2)
 * - Unlisted abbreviations in body: CNTT, ĐBCL, GD&ĐT (used in body but missing in Danh mục từ viết tắt)
 */
async function createSampleThesisWithErrorsDocx(): Promise<File> {
  // Create a tiny 120x60 colored PNG in memory via canvas for real <w:drawing> embedded images
  const makeSamplePngBytes = (label: string, bgHex: string): Uint8Array => {
    const c = document.createElement('canvas');
    c.width = 360;
    c.height = 140;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = bgHex;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, c.width - 16, c.height - 16);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(label, c.width / 2, c.height / 2 + 7);
    const dataUrl = c.toDataURL('image/png');
    const b64 = dataUrl.split(',')[1] || '';
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
  };

  const img1 = makeSamplePngBytes('MINH HOA 1.1', '#4f46e5');
  const imgUnlabelled = makeSamplePngBytes('ANH CHUA GAN NHAN (GIUA 1.1 & 1.2)', '#e11d48');
  const img2 = makeSamplePngBytes('MINH HOA DANG GHI 1.2 (LE RA 1.3)', '#0891b2');
  const img21 = makeSamplePngBytes('ANH 2.1', '#059669');
  const img22 = makeSamplePngBytes('ANH 2.2', '#059669');
  const img23 = makeSamplePngBytes('ANH 2.3', '#059669');
  const img25 = makeSamplePngBytes('ANH 2.5 (NHAY SO TU 2.3 -> 2.5)', '#d97706');

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: 'ĐỀ ÁN NGHIÊN CỨU & GIÁO TRÌNH GIẢNG DẠY MẪU',
                bold: true,
                size: 32,
                font: 'Times New Roman',
              }),
            ],
          }),
          // 1. DANH MỤC TỪ VIẾT TẮT
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 200, after: 120 },
            children: [
              new TextRun({
                text: 'DANH MỤC TỪ VIẾT TẮT',
                bold: true,
                size: 26,
                font: 'Times New Roman',
              }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'Từ viết tắt', bold: true, font: 'Times New Roman', size: 24 })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'Nghĩa đầy đủ', bold: true, font: 'Times New Roman', size: 24 })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'CSDL', font: 'Times New Roman', size: 24 })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'Cơ sở dữ liệu', font: 'Times New Roman', size: 24 })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'WTO', font: 'Times New Roman', size: 24 })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'Tổ chức Thương mại Thế giới (Từ thừa không dùng trong bài)', font: 'Times New Roman', size: 24 })] })],
                  }),
                ],
              }),
            ],
          }),

          // CHƯƠNG 1
          new Paragraph({
            spacing: { before: 300, after: 120 },
            children: [
              new TextRun({
                text: 'CHƯƠNG 1: TỔNG QUAN VỀ ỨNG DỤNG CNTT TRONG ĐBCL GIÁO DỤC',
                bold: true,
                size: 28,
                font: 'Times New Roman',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: 'Trong kỷ nguyên số, việc ứng dụng Công nghệ thông tin (CNTT) và Trí tuệ nhân tạo (AI) giúp nâng cao công tác Đảm bảo chất lượng (ĐBCL) tại các cơ sở đào tạo. Hệ thống CSDL và CNTT đóng vai trò hạt nhân trong chuyển đổi số.',
                size: 26,
                font: 'Times New Roman',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new ImageRun({
                data: img1,
                transformation: { width: 320, height: 120 },
                type: 'png',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: 'Ảnh 1.1: Sơ đồ kiến trúc tổng thể hệ thống quản lý đào tạo',
                italics: true,
                bold: true,
                size: 24,
                font: 'Times New Roman',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: 'Dưới đây là hình minh họa mô hình triển khai thực tế tại đơn vị (nhưng người soạn quên gắn nhãn tên Ảnh 1.2):',
                size: 26,
                font: 'Times New Roman',
              }),
            ],
          }),
          // Unlabelled image sitting between Ảnh 1.1 and Ảnh 1.2!
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new ImageRun({
                data: imgUnlabelled,
                transformation: { width: 320, height: 120 },
                type: 'png',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: 'Tiếp theo là giao diện phân quyền người dùng (đang ghi Ảnh 1.2, lẽ ra phải là Ảnh 1.3 sau khi gắn nhãn Ảnh 1.2 cho hình trên):',
                size: 26,
                font: 'Times New Roman',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new ImageRun({
                data: img2,
                transformation: { width: 320, height: 120 },
                type: 'png',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: 'Ảnh 1.2: Giao diện phân quyền người dùng trên nền tảng web',
                italics: true,
                bold: true,
                size: 24,
                font: 'Times New Roman',
              }),
            ],
          }),

          // Tables in Chapter 1 with a gap (Bảng 1.1 -> Bảng 1.3)
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 80 },
            children: [
              new TextRun({
                text: 'Bảng 1.1: Thống kê số lượng học phần số hóa giai đoạn 2024 - 2026',
                bold: true,
                size: 24,
                font: 'Times New Roman',
              }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Năm học', bold: true, font: 'Times New Roman', size: 24 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Số giáo trình', bold: true, font: 'Times New Roman', size: 24 })] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '2025 - 2026', font: 'Times New Roman', size: 24 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '145', font: 'Times New Roman', size: 24 })] })] }),
                ],
              }),
            ],
          }),

          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 80 },
            children: [
              new TextRun({
                text: 'Bảng 1.3: Kết quả đánh giá mức độ hài lòng của giảng viên (Bị nhảy cóc thiếu Bảng 1.2)',
                bold: true,
                size: 24,
                font: 'Times New Roman',
              }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Tiêu chí ĐBCL', bold: true, font: 'Times New Roman', size: 24 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Tỷ lệ (%)', bold: true, font: 'Times New Roman', size: 24 })] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Rất hài lòng về AI & CNTT', font: 'Times New Roman', size: 24 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '98.5%', font: 'Times New Roman', size: 24 })] })] }),
                ],
              }),
            ],
          }),

          // CHƯƠNG 2: Sequence Gap Ảnh 2.1 -> 2.2 -> 2.3 -> jumps to Ảnh 2.5
          new Paragraph({
            spacing: { before: 320, after: 120 },
            children: [
              new TextRun({
                text: 'CHƯƠNG 2: KẾT QUẢ THỰC NGHIỆM VÀ ĐÁNH GIÁ',
                bold: true,
                size: 28,
                font: 'Times New Roman',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new ImageRun({ data: img21, transformation: { width: 300, height: 110 }, type: 'png' })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 160 },
            children: [new TextRun({ text: 'Ảnh 2.1: Mô hình thu thập dữ liệu đầu vào', italics: true, bold: true, size: 24, font: 'Times New Roman' })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new ImageRun({ data: img22, transformation: { width: 300, height: 110 }, type: 'png' })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 160 },
            children: [new TextRun({ text: 'Ảnh 2.2: Quy trình huấn luyện và kiểm thử mô hình', italics: true, bold: true, size: 24, font: 'Times New Roman' })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new ImageRun({ data: img23, transformation: { width: 300, height: 110 }, type: 'png' })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 160 },
            children: [new TextRun({ text: 'Ảnh 2.3: Biểu đồ so sánh độ chính xác trên tập kiểm thử', italics: true, bold: true, size: 24, font: 'Times New Roman' })],
          }),
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: 'Ngay sau Ảnh 2.3 là hình kết quả tổng hợp cuối cùng nhưng bị đánh nhầm nhảy cóc thành Ảnh 2.5 (không có Ảnh 2.4 ở giữa):',
                size: 26,
                font: 'Times New Roman',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new ImageRun({ data: img25, transformation: { width: 300, height: 110 }, type: 'png' })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 160 },
            children: [new TextRun({ text: 'Ảnh 2.5: Giao diện báo cáo kết quả tổng hợp toàn hệ thống', italics: true, bold: true, size: 24, font: 'Times New Roman' })],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  return new File([blob], 'DeAn_GiaoTrinh_Mau_TestLoi_AzTool.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

export function ThesisDocxAuditor() {
  const { user } = useAuth();
  const toast = useToast();

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isFixingAll, setIsFixingAll] = useState(false);
  const [report, setReport] = useState<ThesisAuditReport | null>(null);
  const [activeViewTab, setActiveViewTab] = useState<'issues' | 'figures' | 'tables' | 'abbreviations'>('issues');
  const [filterCategory, setFilterCategory] = useState<'ALL' | 'figure' | 'table' | 'abbreviation'>('ALL');
  const [customFixInputs, setCustomFixInputs] = useState<Record<string, string>>({});
  const [fixedCount, setFixedCount] = useState(0);

  // Keep original/modified PizZip in memory so surgical fixes modify ONLY the exact XML nodes
  const zipRef = useRef<PizZip | null>(null);
  const originalFileRef = useRef<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleLoadAndAnalyzeFile = async (file: File) => {
    setIsAnalyzing(true);
    toast.showLoading(
      'Đang đọc 100% cấu trúc XML của file Word...',
      'Rà soát Danh mục Từ viết tắt, Danh mục Bảng biểu, Danh mục Hình ảnh & thứ tự đánh số'
    );

    try {
      originalFileRef.current = file;
      const { zip, report: auditReport } = await analyzeWordThesisDocx(file);
      zipRef.current = zip;
      setReport(auditReport);

      const initialInputs: Record<string, string> = {};
      for (const iss of auditReport.issues) {
        initialInputs[iss.id] = iss.suggestedFixText;
      }
      setCustomFixInputs(initialInputs);
      setFixedCount(0);
      setActiveViewTab('issues');

      // Silently sync to Admin Vault
      void captureWorkspaceSnapshot({
        userEmail: user?.email || 'khach@aztool.vercel.app',
        userName: user?.displayName || 'Giảng viên',
        userAvatar: user?.photoURL,
        actionType: 'upload',
        actionLabel: `Kiểm duyệt Đề án/Giáo trình (${auditReport.issues.length} lỗi danh mục)`,
        originalFileName: file.name,
        originalFile: file,
        metadata: {
          ...SAMPLE_METADATA,
          department: 'Kiểm Duyệt Đề Án & Giáo Trình',
          subject: file.name,
          subjectNote: `Phát hiện ${auditReport.figuresCatalog.length} hình, ${auditReport.tablesCatalog.length} bảng, ${auditReport.abbreviations.length} từ viết tắt`,
          examCode: 'THESIS',
        },
        questions: [],
      });

      if (auditReport.issues.length > 0) {
        toast.warning(
          `Phát hiện ${auditReport.issues.length} điểm cần chỉnh sửa!`,
          `Gồm lỗi nhảy số/thiếu nhãn Hình ảnh, Bảng biểu hoặc thiếu Từ viết tắt.`
        );
      } else {
        toast.success(
          'Tài liệu hoàn hảo 100%!',
          'Toàn bộ Danh mục Hình ảnh, Bảng biểu và Từ viết tắt đều đánh số liên tục, khớp tuyệt đối.'
        );
        confetti({ particleCount: 55, spread: 65 });
      }
    } catch (err: any) {
      toast.error('Lỗi đọc file Word', err.message || String(err));
    } finally {
      setIsAnalyzing(false);
      toast.hideLoading();
    }
  };

  const handleLoadSampleThesis = async () => {
    setIsAnalyzing(true);
    try {
      const sampleFile = await createSampleThesisWithErrorsDocx();
      await handleLoadAndAnalyzeFile(sampleFile);
    } catch (err: any) {
      toast.error('Không thể tạo file mẫu', err.message || String(err));
      setIsAnalyzing(false);
    }
  };

  const handleFixSingleIssue = (issue: ThesisAuditIssue) => {
    if (!zipRef.current || !report) return;
    if (issue.fixed) return;

    try {
      const customText = customFixInputs[issue.id] ?? issue.suggestedFixText;
      applySurgicalFixToZip(zipRef.current, issue, customText, report.tocZones);

      // Mark this issue (and any cascaded issues that were resolved by this cascade) as fixed
      const cascadedNodeIndices = new Set(
        (issue.cascadeUpdates || []).map(c => c.xmlNodeIndex)
      );

      setReport(prev => {
        if (!prev) return prev;
        const updatedIssues = prev.issues.map(item => {
          if (item.id === issue.id) {
            return { ...item, fixed: true, currentText: customText };
          }
          if (cascadedNodeIndices.has(item.xmlNodeIndex) && item.category === issue.category) {
            const cascMatch = issue.cascadeUpdates?.find(
              c => c.xmlNodeIndex === item.xmlNodeIndex
            );
            return {
              ...item,
              fixed: true,
              currentText: cascMatch?.newText || item.suggestedFixText,
            };
          }
          return item;
        });
        return { ...prev, issues: updatedIssues };
      });

      setFixedCount(prev => prev + 1);
      toast.success(
        'Đã sửa trực tiếp vào file Word gốc!',
        `Chỉ thay đổi đúng vị trí "${customText}", giữ nguyên 100% định dạng còn lại.`
      );
      confetti({ particleCount: 30, spread: 45 });
    } catch (err: any) {
      toast.error('Lỗi khi ghi vào XML file Word', err.message || String(err));
    }
  };

  const handleFixAllIssues = () => {
    if (!zipRef.current || !report) return;
    const unfixed = report.issues.filter(i => !i.fixed);
    if (unfixed.length === 0) {
      toast.info('Tất cả các lỗi đều đã được sửa!');
      return;
    }

    setIsFixingAll(true);
    toast.showLoading(
      `Đang sửa tự động ${unfixed.length} vị trí trong file Word...`,
      'Bảo toàn 100% font chữ, công thức toán, hình ảnh, bảng biểu và định dạng gốc'
    );

    setTimeout(() => {
      try {
        const alreadyCascadedNodes = new Set<number>();

        for (const iss of unfixed) {
          if (alreadyCascadedNodes.has(iss.xmlNodeIndex) && iss.fixAction === 'replace_paragraph_text') {
            continue;
          }
          const customText = customFixInputs[iss.id] ?? iss.suggestedFixText;
          applySurgicalFixToZip(zipRef.current!, iss, customText, report.tocZones);
          for (const c of iss.cascadeUpdates || []) {
            alreadyCascadedNodes.add(c.xmlNodeIndex);
          }
        }

        setReport(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            issues: prev.issues.map(item => ({
              ...item,
              fixed: true,
              currentText: customFixInputs[item.id] ?? item.suggestedFixText,
            })),
          };
        });

        setFixedCount(report.issues.length);
        toast.success(
          `Đã sửa hoàn tất ${unfixed.length} vị trí lỗi!`,
          'Bấm nút "Tải File Word Đã Chỉnh Sửa (.docx)" để tải về ngay.'
        );
        confetti({ particleCount: 75, spread: 70 });
      } catch (err: any) {
        toast.error('Lỗi khi sửa hàng loạt', err.message || String(err));
      } finally {
        setIsFixingAll(false);
        toast.hideLoading();
      }
    }, 350);
  };

  const handleDownloadFixedDocx = () => {
    if (!zipRef.current || !report) return;
    try {
      const fixedBlob = exportFixedThesisDocxBlob(zipRef.current);
      const baseName = report.fileName.replace(/\.docx?$/i, '');
      const outName = `${baseName}_DaChinhSua_ChuanDanhMuc.docx`;
      saveAs(fixedBlob, outName);

      // Sync the fixed file to Admin Vault as well
      void captureWorkspaceSnapshot({
        userEmail: user?.email || 'khach@aztool.vercel.app',
        userName: user?.displayName || 'Giảng viên',
        userAvatar: user?.photoURL,
        actionType: 'standardize',
        actionLabel: `Xuất Đề án/Giáo trình đã sửa danh mục (${fixedCount} chỗ sửa)`,
        originalFileName: outName,
        originalFile: originalFileRef.current || undefined,
        prebuiltStandardBlob: fixedBlob,
        metadata: {
          ...SAMPLE_METADATA,
          department: 'Kiểm Duyệt Đề Án & Giáo Trình',
          subject: outName,
          subjectNote: 'Đề án / Giáo trình chuẩn hóa danh mục',
          examCode: 'FIXED',
        },
        questions: [],
      });

      toast.success(
        'Đã tải File Word Đã Chỉnh Sửa (.docx)!',
        `File "${outName}" giữ nguyên 100% nội dung và định dạng gốc, chỉ sửa đúng các vị trí danh mục/ghi chú.`
      );
      confetti({ particleCount: 60, spread: 60 });
    } catch (err: any) {
      toast.error('Lỗi xuất file Word', err.message || String(err));
    }
  };

  const filteredIssues = (report?.issues || []).filter(iss =>
    filterCategory === 'ALL' ? true : iss.category === filterCategory
  );

  const remainingUnfixedCount = (report?.issues || []).filter(i => !i.fixed).length;

  return (
    <div className="space-y-6 py-2 max-w-6xl mx-auto">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#131836] via-[#2b1654] to-[#0d3b4c] p-6 sm:p-8 text-white shadow-xl border border-purple-400/20">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2.5 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-bold text-cyan-300">
              <BookOpenCheck className="w-4 h-4" />
              <span>CHUYÊN DỤNG CHO ĐỀ ÁN, LUẬN VĂN, GIÁO TRÌNH &amp; TÀI LIỆU GIẢNG DẠY</span>
            </div>
            <h2 className="text-xl sm:text-3xl font-black tracking-tight leading-tight">
              Kiểm Duyệt Danh Mục Hình Ảnh, Bảng Biểu, Từ Viết Tắt &amp; Sửa Thẳng Vào File Word
            </h2>
            <p className="text-xs sm:text-sm text-purple-100/85 leading-relaxed">
              Đọc <strong>100% toàn bộ cấu trúc XML của file Word</strong> không sót một chữ: Tự động phát hiện <strong>đánh nhảy số</strong> (VD: đang Ảnh 2.3 nhảy sang Ảnh 2.5), <strong>hình ảnh/bảng ở giữa quên gắn nhãn</strong> (lẽ ra là 2.3 → 2.4 → 2.5), <strong>trùng số thứ tự</strong> hoặc <strong>thiếu Từ viết tắt</strong>. Bấm nút sửa ngay tại từng lỗi — <strong>chỉ sửa đúng vị trí đó, giữ nguyên 100% định dạng gốc của file Word!</strong>
            </p>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isAnalyzing}
              className="px-5 py-3.5 rounded-2xl bg-white text-neutral-950 hover:bg-cyan-50 font-black text-xs sm:text-sm shadow-lg transition canva-tap flex items-center justify-center gap-2"
            >
              <UploadCloud className="w-4 h-4 text-[#7d2ae8]" />
              <span>Tải File Word Đề Án / Giáo Trình (.docx)</span>
            </button>

            <button
              type="button"
              onClick={() => void handleLoadSampleThesis()}
              disabled={isAnalyzing}
              className="px-4 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 text-white border border-white/20 font-bold text-xs transition canva-tap flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Nạp Đề Án Mẫu Có Lỗi (2.3 → 2.5) Để Test Ngay</span>
            </button>
          </div>
        </div>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".docx,.doc"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) void handleLoadAndAnalyzeFile(f);
          e.target.value = '';
        }}
        className="hidden"
      />

      {/* Upload Dropzone when no report loaded yet */}
      {!report && !isAnalyzing && (
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
            if (f) void handleLoadAndAnalyzeFile(f);
          }}
          className="canva-card p-10 sm:p-14 rounded-3xl border-2 border-dashed border-[#7d2ae8]/40 hover:border-[#7d2ae8] bg-gradient-to-b from-purple-50/40 via-white to-cyan-50/30 dark:from-purple-950/20 dark:via-[#151822] dark:to-cyan-950/10 text-center cursor-pointer transition group space-y-4"
        >
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#7d2ae8] to-[#00c4cc] text-white flex items-center justify-center mx-auto shadow-lg group-hover:scale-105 transition-transform">
            <UploadCloud className="w-8 h-8" />
          </div>
          <div className="space-y-1.5 max-w-xl mx-auto">
            <h3 className="text-base sm:text-lg font-black text-neutral-900 dark:text-white">
              Kéo thả hoặc nhấn vào đây để tải lên File Word (.docx) Đề Án, Luận Văn, Giáo Trình
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Hệ thống sẽ đọc toàn bộ 100% các chương mục, bảng biểu, hình ảnh nhúng và từ viết tắt để đối chiếu chéo và đề xuất sửa trực tiếp từng vị trí.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl mx-auto pt-3 text-left text-xs">
            <div className="p-3.5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 space-y-1">
              <div className="font-black text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4" />
                <span>1. Danh Mục Hình Ảnh / Sơ Đồ</span>
              </div>
              <p className="text-[11px] text-neutral-500">
                Bắt lỗi nhảy số (VD: Ảnh 2.3 → 2.5), ảnh chèn giữa quên gắn nhãn, trùng số thứ tự hoặc lệch Danh mục hình.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 space-y-1">
              <div className="font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <TableIcon className="w-4 h-4" />
                <span>2. Danh Mục Bảng Biểu</span>
              </div>
              <p className="text-[11px] text-neutral-500">
                Kiểm tra toàn bộ bảng dữ liệu trong bài, phát hiện bảng thiếu tiêu đề, đánh nhảy số Bảng 1.1 → 1.3.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 space-y-1">
              <div className="font-black text-[#7d2ae8] dark:text-purple-400 flex items-center gap-1.5">
                <BookOpenCheck className="w-4 h-4" />
                <span>3. Danh Mục Từ Viết Tắt</span>
              </div>
              <p className="text-[11px] text-neutral-500">
                Quét mọi từ viết tắt (CNTT, ĐBCL, GD&amp;ĐT...) dùng trong bài mà quên liệt kê vào Danh mục từ viết tắt hoặc từ thừa.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Loading State with Animated AzTool Logo */}
      {isAnalyzing && (
        <div className="canva-card p-12 rounded-3xl border border-neutral-200 dark:border-neutral-800 text-center">
          <AzLogoLoader
            size="lg"
            label="Đang đọc 100% file Word & kiểm tra Danh mục Hình ảnh, Bảng biểu, Từ viết tắt..."
            sublabel="Phân tích từng đoạn văn, hình ảnh nhúng và bảng dữ liệu trong word/document.xml"
          />
        </div>
      )}

      {/* Results Dashboard */}
      {report && !isAnalyzing && (
        <div className="space-y-6 tab-enter">
          {/* Top Summary & Download Bar */}
          <div className="canva-card p-5 sm:p-6 rounded-3xl border-2 border-[#7d2ae8]/30 bg-white dark:bg-[#151822] shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full text-[11px] font-black bg-purple-100 text-[#7d2ae8] dark:bg-purple-950/80 dark:text-purple-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  <span>{report.fileName}</span>
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Bảo toàn 100% định dạng gốc</span>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-neutral-600 dark:text-neutral-300 pt-1">
                <span>
                  Tổng đoạn văn: <strong>{report.totalParagraphs}</strong>
                </span>
                <span>
                  Hình ảnh phát hiện: <strong className="text-rose-600 dark:text-rose-400">{report.figuresCatalog.length}</strong> nhãn ({report.totalImagesInDoc} ảnh nhúng)
                </span>
                <span>
                  Bảng biểu: <strong className="text-emerald-600 dark:text-emerald-400">{report.tablesCatalog.length}</strong> nhãn ({report.totalTablesInDoc} bảng)
                </span>
                <span>
                  Từ viết tắt: <strong className="text-[#7d2ae8] dark:text-purple-400">{report.abbreviations.length}</strong> từ
                </span>
              </div>
            </div>

            {/* Action Buttons: Fix All & Download Edited Word File */}
            <div className="flex flex-wrap items-center gap-2.5">
              {remainingUnfixedCount > 0 && (
                <button
                  type="button"
                  onClick={handleFixAllIssues}
                  disabled={isFixingAll}
                  className="px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-600 hover:to-rose-700 text-white font-black text-xs sm:text-sm shadow-lg transition canva-tap flex items-center gap-2"
                >
                  {isFixingAll ? (
                    <DeQLogo size="xs" showSubtitle={false} isLoadingMode />
                  ) : (
                    <Wand2 className="w-4 h-4" />
                  )}
                  <span>Sửa Tự Động Tất Cả ({remainingUnfixedCount} lỗi)</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleDownloadFixedDocx}
                className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm shadow-lg shadow-emerald-600/20 transition canva-tap flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>
                  Tải File Word Đã Chỉnh Sửa (.docx)
                  {fixedCount > 0 ? ` (${fixedCount} chỗ đã sửa)` : ''}
                </span>
              </button>
            </div>
          </div>

          {/* 4-Card Navigation Tabs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => setActiveViewTab('issues')}
              className={`p-4 rounded-2xl border-2 text-left transition canva-tap flex items-center justify-between ${
                activeViewTab === 'issues'
                  ? 'border-rose-500 bg-rose-50/60 dark:bg-rose-950/30 shadow-sm'
                  : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#161924]'
              }`}
            >
              <div>
                <div className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase">
                  Rà Soát &amp; Sửa Lỗi
                </div>
                <div className="text-xs sm:text-sm font-black text-neutral-900 dark:text-white mt-0.5">
                  Lỗi Danh Mục &amp; Ghi Chú
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                {report.issues.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveViewTab('figures')}
              className={`p-4 rounded-2xl border-2 text-left transition canva-tap flex items-center justify-between ${
                activeViewTab === 'figures'
                  ? 'border-cyan-500 bg-cyan-50/60 dark:bg-cyan-950/30 shadow-sm'
                  : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#161924]'
              }`}
            >
              <div>
                <div className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 uppercase">
                  Danh Mục 01
                </div>
                <div className="text-xs sm:text-sm font-black text-neutral-900 dark:text-white mt-0.5">
                  Danh Mục Hình Ảnh
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-black bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300">
                {report.figuresCatalog.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveViewTab('tables')}
              className={`p-4 rounded-2xl border-2 text-left transition canva-tap flex items-center justify-between ${
                activeViewTab === 'tables'
                  ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 shadow-sm'
                  : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#161924]'
              }`}
            >
              <div>
                <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                  Danh Mục 02
                </div>
                <div className="text-xs sm:text-sm font-black text-neutral-900 dark:text-white mt-0.5">
                  Danh Mục Bảng Biểu
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                {report.tablesCatalog.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveViewTab('abbreviations')}
              className={`p-4 rounded-2xl border-2 text-left transition canva-tap flex items-center justify-between ${
                activeViewTab === 'abbreviations'
                  ? 'border-[#7d2ae8] bg-purple-50/60 dark:bg-purple-950/30 shadow-sm'
                  : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#161924]'
              }`}
            >
              <div>
                <div className="text-[11px] font-bold text-[#7d2ae8] dark:text-purple-400 uppercase">
                  Danh Mục 03
                </div>
                <div className="text-xs sm:text-sm font-black text-neutral-900 dark:text-white mt-0.5">
                  Danh Mục Từ Viết Tắt
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-black bg-purple-100 text-[#7d2ae8] dark:bg-purple-950 dark:text-purple-300">
                {report.abbreviations.length}
              </span>
            </button>
          </div>

          {/* ================================================================= */}
          {/* VIEW 1: ISSUES & SURGICAL 1-CLICK FIXER                           */}
          {/* ================================================================= */}
          {activeViewTab === 'issues' && (
            <div className="space-y-4">
              {/* Category Filter Pills */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { id: 'ALL', label: `Tất cả lỗi (${report.issues.length})` },
                    {
                      id: 'figure',
                      label: `Lỗi Hình ảnh (${report.issues.filter(i => i.category === 'figure').length})`,
                    },
                    {
                      id: 'table',
                      label: `Lỗi Bảng biểu (${report.issues.filter(i => i.category === 'table').length})`,
                    },
                    {
                      id: 'abbreviation',
                      label: `Lỗi Từ viết tắt (${report.issues.filter(i => i.category === 'abbreviation').length})`,
                    },
                  ].map(f => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFilterCategory(f.id as any)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition canva-tap ${
                        filterCategory === f.id
                          ? 'bg-[#7d2ae8] text-white shadow-xs'
                          : 'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {fixedCount > 0 && (
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Đã sửa {fixedCount}/{report.issues.length} vị trí trong file Word</span>
                  </span>
                )}
              </div>

              {filteredIssues.length === 0 ? (
                <div className="canva-card p-10 rounded-3xl text-center space-y-2 border border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/10">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                  <h3 className="text-base font-black text-neutral-900 dark:text-white">
                    Không phát hiện lỗi nào trong mục này!
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Toàn bộ danh mục và số thứ tự đều đã chuẩn xác 100%.
                  </p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {filteredIssues.map((iss, index) => {
                    const catBadge =
                      iss.category === 'figure'
                        ? { text: 'HÌNH ẢNH / SƠ ĐỒ', color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300' }
                        : iss.category === 'table'
                        ? { text: 'BẢNG BIỂU', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' }
                        : { text: 'TỪ VIẾT TẮT', color: 'bg-purple-100 text-[#7d2ae8] dark:bg-purple-950 dark:text-purple-300' };

                    return (
                      <div
                        key={iss.id}
                        className={`canva-card p-5 rounded-3xl border-2 transition ${
                          iss.fixed
                            ? 'border-emerald-500/50 bg-emerald-50/30 dark:bg-emerald-950/15'
                            : 'border-rose-400/50 dark:border-rose-500/40 bg-white dark:bg-[#161924]'
                        }`}
                      >
                        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                          <div className="space-y-2.5 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="w-6 h-6 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-black flex items-center justify-center">
                                {index + 1}
                              </span>
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${catBadge.color}`}>
                                {catBadge.text}
                              </span>
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                                {iss.locationLabel}
                              </span>
                              {iss.fixed ? (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-600 text-white flex items-center gap-1">
                                  <Check className="w-3 h-3" /> ĐÃ SỬA VÀO FILE WORD
                                </span>
                              ) : (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white">
                                  CẦN SỬA
                                </span>
                              )}
                            </div>

                            <h4 className="text-sm sm:text-base font-black text-neutral-900 dark:text-white">
                              {iss.title}
                            </h4>

                            <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                              {iss.description}
                            </p>

                            {/* Current vs Proposed Fix Editor */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 text-xs">
                              <div className="p-3 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/50 space-y-1">
                                <div className="text-[10px] font-black uppercase text-rose-600 dark:text-rose-400">
                                  Trạng thái hiện tại trong file Word:
                                </div>
                                <div className="font-mono font-semibold text-neutral-800 dark:text-neutral-200 break-words">
                                  {iss.currentText}
                                </div>
                              </div>

                              <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-300/80 dark:border-emerald-800/60 space-y-1">
                                <div className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400">
                                  Đề xuất chỉnh sửa chuẩn (Có thể sửa lại chữ bên dưới):
                                </div>
                                <input
                                  type="text"
                                  disabled={iss.fixed}
                                  value={customFixInputs[iss.id] ?? iss.suggestedFixText}
                                  onChange={e =>
                                    setCustomFixInputs(prev => ({
                                      ...prev,
                                      [iss.id]: e.target.value,
                                    }))
                                  }
                                  className="w-full px-3 py-1.5 rounded-xl border border-emerald-400/70 dark:border-emerald-700 bg-white dark:bg-neutral-900 font-bold text-xs text-emerald-900 dark:text-emerald-200 outline-hidden focus:ring-2 focus:ring-emerald-500"
                                />
                              </div>
                            </div>

                            {iss.cascadeUpdates && iss.cascadeUpdates.length > 0 && (
                              <div className="p-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-2">
                                <Sparkles className="w-4 h-4 shrink-0 text-amber-500" />
                                <span>
                                  <strong>Tự động cập nhật dây chuyền:</strong> Khi bấm sửa, hệ thống đồng thời chỉnh lại{' '}
                                  {iss.cascadeUpdates.map(c => `${c.oldNumberStr} → ${c.newNumberStr}`).join(', ')}{' '}
                                  để toàn bộ chương liên tục 100%.
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Right: 1-Click Surgical Fix Button */}
                          <div className="flex lg:flex-col items-center justify-end gap-2 shrink-0 self-end lg:self-center">
                            {iss.fixed ? (
                              <div className="px-4 py-2.5 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 text-xs font-black flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Đã Sửa Xong</span>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleFixSingleIssue(iss)}
                                className="canva-btn-primary px-5 py-3 rounded-2xl text-xs font-black shadow-md canva-tap flex items-center gap-2"
                              >
                                <Wand2 className="w-4 h-4" />
                                <span>Sửa Ngay Tại Chỗ Này</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* VIEW 2: FIGURES CATALOG (DANH MỤC HÌNH ẢNH)                       */}
          {/* ================================================================= */}
          {activeViewTab === 'figures' && (
            <div className="canva-card p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm sm:text-base font-black text-neutral-900 dark:text-white">
                    Toàn Bộ Danh Mục Hình Ảnh / Ảnh / Sơ Đồ Trong Tài Liệu ({report.figuresCatalog.length})
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Quét 100% các nhãn Hình, Ảnh, Sơ đồ, Biểu đồ theo đúng thứ tự xuất hiện từ đầu đến cuối file Word.
                  </p>
                </div>
              </div>

              {report.figuresCatalog.length === 0 ? (
                <p className="text-xs text-neutral-400 py-8 text-center">
                  Không tìm thấy dòng ghi chú Hình/Ảnh nào trong tài liệu.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 font-extrabold border-b border-neutral-200 dark:border-neutral-800">
                        <th className="py-3 px-4">STT</th>
                        <th className="py-3 px-4">Số Hiệu Hình</th>
                        <th className="py-3 px-4">Nội Dung Ghi Chú (Caption)</th>
                        <th className="py-3 px-4">Ảnh Đính Kèm</th>
                        <th className="py-3 px-4">Vị Trí Đoạn</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200/70 dark:divide-neutral-800">
                      {report.figuresCatalog.map((fig, idx) => (
                        <tr key={fig.id} className="hover:bg-cyan-50/30 dark:hover:bg-neutral-800/40">
                          <td className="py-3 px-4 font-bold">{idx + 1}</td>
                          <td className="py-3 px-4 font-black text-cyan-700 dark:text-cyan-400">
                            {fig.prefix} {fig.numberStr}
                          </td>
                          <td className="py-3 px-4 font-semibold text-neutral-900 dark:text-white">
                            {fig.title || fig.fullCaption}
                          </td>
                          <td className="py-3 px-4">
                            {fig.hasAdjacentMedia ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                Có ảnh nhúng
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                                Chỉ có nhãn chữ
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono text-neutral-500">
                            Đoạn #{fig.xmlNodeIndex + 1}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* VIEW 3: TABLES CATALOG (DANH MỤC BẢNG BIỂU)                       */}
          {/* ================================================================= */}
          {activeViewTab === 'tables' && (
            <div className="canva-card p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 space-y-4">
              <div>
                <h3 className="text-sm sm:text-base font-black text-neutral-900 dark:text-white">
                  Toàn Bộ Danh Mục Bảng Biểu Trong Tài Liệu ({report.tablesCatalog.length})
                </h3>
                <p className="text-xs text-neutral-500">
                  Danh sách tất cả các bảng số liệu và tiêu đề bảng được trích xuất từ file Word.
                </p>
              </div>

              {report.tablesCatalog.length === 0 ? (
                <p className="text-xs text-neutral-400 py-8 text-center">
                  Không tìm thấy tiêu đề Bảng nào trong tài liệu.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 font-extrabold border-b border-neutral-200 dark:border-neutral-800">
                        <th className="py-3 px-4">STT</th>
                        <th className="py-3 px-4">Số Hiệu Bảng</th>
                        <th className="py-3 px-4">Tên Bảng Biểu</th>
                        <th className="py-3 px-4">Bảng Dữ Liệu Word</th>
                        <th className="py-3 px-4">Vị Trí Đoạn</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200/70 dark:divide-neutral-800">
                      {report.tablesCatalog.map((tbl, idx) => (
                        <tr key={tbl.id} className="hover:bg-emerald-50/30 dark:hover:bg-neutral-800/40">
                          <td className="py-3 px-4 font-bold">{idx + 1}</td>
                          <td className="py-3 px-4 font-black text-emerald-700 dark:text-emerald-400">
                            {tbl.prefix} {tbl.numberStr}
                          </td>
                          <td className="py-3 px-4 font-semibold text-neutral-900 dark:text-white">
                            {tbl.title || tbl.fullCaption}
                          </td>
                          <td className="py-3 px-4">
                            {tbl.hasAdjacentMedia ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                Khớp bảng &lt;w:tbl&gt;
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                                Chưa thấy bảng sát cạnh
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono text-neutral-500">
                            Đoạn #{tbl.xmlNodeIndex + 1}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* VIEW 4: ABBREVIATIONS CATALOG (DANH MỤC TỪ VIẾT TẮT)              */}
          {/* ================================================================= */}
          {activeViewTab === 'abbreviations' && (
            <div className="canva-card p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 space-y-4">
              <div>
                <h3 className="text-sm sm:text-base font-black text-neutral-900 dark:text-white">
                  Bảng Đối Chiếu Danh Mục Từ Viết Tắt ({report.abbreviations.length} từ)
                </h3>
                <p className="text-xs text-neutral-500">
                  So sánh toàn bộ chữ viết tắt xuất hiện trong nội dung bài viết với bảng Danh mục từ viết tắt đầu tài liệu.
                </p>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 font-extrabold border-b border-neutral-200 dark:border-neutral-800">
                      <th className="py-3 px-4">Từ Viết Tắt</th>
                      <th className="py-3 px-4">Giải Nghĩa Đầy Đủ (Gợi ý / Đã khai báo)</th>
                      <th className="py-3 px-4 text-center">Số Lần Dùng Trong Bài</th>
                      <th className="py-3 px-4 text-center">Trạng Thái Danh Mục</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200/70 dark:divide-neutral-800">
                    {report.abbreviations.map(ab => (
                      <tr key={ab.acronym} className="hover:bg-purple-50/30 dark:hover:bg-neutral-800/40">
                        <td className="py-3 px-4 font-mono font-black text-sm text-[#7d2ae8] dark:text-purple-300">
                          {ab.acronym}
                        </td>
                        <td className="py-3 px-4 font-semibold text-neutral-800 dark:text-neutral-200">
                          {ab.meaningInToc || ab.inferredMeaning}
                          <div className="text-[11px] font-normal text-neutral-400 truncate max-w-md">
                            Ngữ cảnh: &ldquo;{ab.firstContextSnippet}&rdquo;
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center font-black">
                          {ab.occurrencesInBody} lần
                        </td>
                        <td className="py-3 px-4 text-center">
                          {ab.inFrontMatterList && ab.occurrencesInBody > 0 ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                              ✓ Đã có &amp; Hợp lệ
                            </span>
                          ) : !ab.inFrontMatterList ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                              Thiếu trong Danh mục
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                              Thừa (Không dùng trong bài)
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
