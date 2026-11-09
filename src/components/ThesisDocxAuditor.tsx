'use client';

import React, { useState, useRef } from 'react';
import PizZip from 'pizzip';
import { downloadFileMobileSafe } from '@/lib/mobile-download';
import confetti from 'canvas-confetti';
import {
  analyzeWordThesisDocx,
  applySurgicalFixToZip,
  exportFixedThesisDocxBlob,
  insertThreeCatalogsAfterTocToZip,
  formatNumberedAbbreviationLine,
  suggestAbbreviationMeaningsWithAI,
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

          // MỤC LỤC
          new Paragraph({
            spacing: { before: 240, after: 100 },
            children: [
              new TextRun({
                text: 'MỤC LỤC',
                bold: true,
                size: 28,
                font: 'Times New Roman',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({
                text: 'CHƯƠNG 1: TỔNG QUAN VỀ HOẠT ĐỘNG XÚC TÁC CỦA ENZYM VÀ ỨNG DỤNG CNTT ......... 1',
                size: 24,
                font: 'Times New Roman',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 160 },
            children: [
              new TextRun({
                text: 'CHƯƠNG 2: KẾT QUẢ THỰC NGHIỆM VÀ ĐÁNH GIÁ ........................................ 5',
                size: 24,
                font: 'Times New Roman',
              }),
            ],
          }),

          // CHƯƠNG 1 (Có Hình 20.1 sai số chương -> phải sửa thành Hình 1.1., tiếp theo là Hình 1.2.)
          new Paragraph({
            spacing: { before: 300, after: 120 },
            children: [
              new TextRun({
                text: 'CHƯƠNG 1: TỔNG QUAN VỀ HOẠT ĐỘNG XÚC TÁC CỦA ENZYM VÀ ỨNG DỤNG CNTT',
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
                text: 'Trong nghiên cứu hóa sinh lâm sàng và ứng dụng CNTT, các chỉ số enzym như CK (Creatine Kinase), α-amylase và chỉ số HbA1c đóng vai trò đặc biệt quan trọng. Xét nghiệm CK, α-amylase và HbA1c hỗ trợ chẩn đoán chính xác trên hệ thống CSDL và ĐBCL bệnh viện.',
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
                text: 'Hình 20.1. Mô hình hoạt động xúc tác của enzym và sự tạo thành phức hợp Enzym - Cơ chất',
                italics: true,
                bold: true,
                size: 24,
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
                text: 'Hình 20.2. Đồ thị biểu diễn vận tốc phản ứng theo nồng độ cơ chất (Động học Michaelis - Menten)',
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
  const { user, consumeDailyQuota } = useAuth();
  const toast = useToast();

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isFixingAll, setIsFixingAll] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [catalogsInserted, setCatalogsInserted] = useState(false);
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
    if (!consumeDailyQuota('Kiểm Duyệt Đề Án & Giáo Trình Word')) {
      toast.error(
        'Đã hết limit 5/5 lần sử dụng trong ngày!',
        'Thời gian tính từ 00h00 đến 23h59. Bạn không thể sử dụng thêm tính năng hôm nay.'
      );
      setIsAnalyzing(false);
      return;
    }

    setIsAnalyzing(true);
    setLoadingProgress(8);
    setCatalogsInserted(false);
    toast.showLoading(
      'Đang đọc 100% cấu trúc XML của file Word...',
      'Rà soát Danh mục Từ viết tắt, Danh mục Bảng biểu, Danh mục Hình ảnh & thứ tự đánh số theo Chương',
      8
    );

    try {
      originalFileRef.current = file;
      const { zip, report: auditReport } = await analyzeWordThesisDocx(
        file,
        (title, sub, pct) => {
          if (typeof pct === 'number') setLoadingProgress(pct);
          toast.showLoading(title, sub, pct);
        }
      );

      // Auto-resolve any unknown abbreviations via Gemini AI if API key is available
      const savedApiKey =
        typeof window !== 'undefined'
          ? localStorage.getItem('deq_gemini_api_key') || ''
          : '';
      const savedModel =
        typeof window !== 'undefined'
          ? localStorage.getItem('deq_gemini_model') || undefined
          : undefined;
      const unresolvedAbbrevs = auditReport.abbreviations.filter(ab =>
        ab.inferredMeaning.includes('Thuật ngữ viết tắt chuyên ngành trong đề án')
      );

      if (unresolvedAbbrevs.length > 0 && savedApiKey.trim()) {
        try {
          toast.showLoading(
            'Đang tra cứu AI chuẩn thuật ngữ học thuật cho các từ viết tắt...',
            unresolvedAbbrevs.map(a => a.acronym).join(', '),
            94
          );
          const aiMeanings = await suggestAbbreviationMeaningsWithAI(
            unresolvedAbbrevs.map(a => ({
              acronym: a.acronym,
              context: a.firstContextSnippet,
            })),
            savedApiKey,
            savedModel
          );
          for (const ab of auditReport.abbreviations) {
            if (aiMeanings[ab.acronym]) {
              ab.inferredMeaning = aiMeanings[ab.acronym];
            }
          }
          for (const iss of auditReport.issues) {
            if (iss.category === 'abbreviation' && iss.acronym && aiMeanings[iss.acronym]) {
              const abObj = auditReport.abbreviations.find(a => a.acronym === iss.acronym);
              if (abObj) {
                const formatted = formatNumberedAbbreviationLine(1, abObj).replace(/^\d+\.\s*/, '');
                iss.suggestedFixText = formatted;
                iss.meaning = formatted;
              }
            }
          }
        } catch {
          // Ignore AI fallback error and keep built-in dictionary results
        }
      }

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
          `Gồm lỗi sai số chương (VD: Chương 1 ghi Hình 20.1 → 1.1), nhảy số hoặc thiếu Từ viết tắt.`
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
    setLoadingProgress(5);
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

  const handleInsertThreeCatalogsOnly = () => {
    if (!zipRef.current || !report) return;
    try {
      toast.showLoading(
        'Đang chèn 3 Danh mục vào trước Mục lục (sau Lời giới thiệu / Lời nói đầu)...',
        'Danh mục hình • Danh mục bảng • Danh mục từ viết tắt',
        65
      );
      const ok = insertThreeCatalogsAfterTocToZip(zipRef.current, report, customFixInputs);
      if (ok) {
        setCatalogsInserted(true);
        toast.success(
          'Đã chèn 3 Danh mục chuẩn vào trước Mục lục!',
          'Danh mục hình, Danh mục bảng & Danh mục từ viết tắt đã được đặt sau Lời giới thiệu / Lời nói đầu và trước Mục lục.'
        );
        confetti({ particleCount: 50, spread: 60 });
      } else {
        toast.warning('Không tìm thấy mục nào để chèn vào danh mục.');
      }
    } catch (err: any) {
      toast.error('Lỗi khi chèn 3 danh mục', err.message || String(err));
    } finally {
      toast.hideLoading();
    }
  };

  const handleFixAllIssues = async () => {
    if (!zipRef.current || !report) return;
    const unfixed = report.issues.filter(i => !i.fixed);

    setIsFixingAll(true);
    setLoadingProgress(10);
    toast.showLoading(
      `Đang sửa tự động ${unfixed.length} vị trí & chèn 3 Danh mục trước Mục lục...`,
      'Chuẩn hóa Chương 1 → Hình 1.1, Bảng 1.1... & giữ nguyên 100% định dạng gốc',
      10
    );

    try {
      await new Promise(r => setTimeout(r, 30));
      const alreadyCascadedNodes = new Set<number>();

      for (let i = 0; i < unfixed.length; i++) {
        const iss = unfixed[i];
        const pct = Math.round(15 + ((i + 1) / Math.max(1, unfixed.length)) * 60);
        setLoadingProgress(pct);
        toast.showLoading(
          `Đang sửa tự động (${i + 1}/${unfixed.length}): ${iss.locationLabel}...`,
          iss.title,
          pct
        );

        if (alreadyCascadedNodes.has(iss.xmlNodeIndex) && iss.fixAction === 'replace_paragraph_text') {
          continue;
        }
        const customText = customFixInputs[iss.id] ?? iss.suggestedFixText;
        applySurgicalFixToZip(zipRef.current!, iss, customText, report.tocZones);
        for (const c of iss.cascadeUpdates || []) {
          alreadyCascadedNodes.add(c.xmlNodeIndex);
        }

        if (i % 2 === 0) {
          await new Promise(r => setTimeout(r, 18));
        }
      }

      // Automatically insert/update the 3 Catalogs (Danh mục hình, Danh mục bảng, Danh mục từ viết tắt)
      // right BEFORE Mục lục and AFTER Lời giới thiệu / Lời nói đầu!
      setLoadingProgress(88);
      toast.showLoading(
        'Đang chèn 3 Danh mục (Hình, Bảng, Từ viết tắt) vào trước Mục lục...',
        'Đặt ngay sau Lời giới thiệu / Lời nói đầu và trước Mục lục',
        88
      );
      await new Promise(r => setTimeout(r, 25));
      insertThreeCatalogsAfterTocToZip(zipRef.current!, report, customFixInputs);
      setCatalogsInserted(true);

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

      setLoadingProgress(100);
      setFixedCount(report.issues.length);
      toast.success(
        `Đã sửa ${unfixed.length} lỗi & chèn 3 Danh mục trước Mục lục!`,
        'Bấm nút "Tải File Word Đã Chỉnh Sửa (.docx)" để tải về ngay.'
      );
      confetti({ particleCount: 75, spread: 70 });
    } catch (err: any) {
      toast.error('Lỗi khi sửa hàng loạt', err.message || String(err));
    } finally {
      setIsFixingAll(false);
      toast.hideLoading();
    }
  };

  const handleDownloadFixedDocx = () => {
    if (!zipRef.current || !report) return;
    try {
      // Ensure 3 catalogs before Mục lục are always up to date when exporting if user fixed issues
      if (!catalogsInserted) {
        insertThreeCatalogsAfterTocToZip(zipRef.current, report, customFixInputs);
        setCatalogsInserted(true);
      }
      const fixedBlob = exportFixedThesisDocxBlob(zipRef.current);
      const baseName = report.fileName.replace(/\.docx?$/i, '');
      const outName = `${baseName}_DaChinhSua_ChuanDanhMuc.docx`;
      void downloadFileMobileSafe(fixedBlob, outName);

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
        `File "${outName}" đã chuẩn hóa Bảng n.m / Hình n.m và chèn đủ 3 Danh mục trước Mục lục (sau Lời giới thiệu / Lời nói đầu).`
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
              Đọc <strong>100% toàn bộ cấu trúc XML của file Word</strong>: Tự động đối chiếu theo đúng <strong>Chương thực tế</strong>, tự động chèn nhãn <strong>Bảng n.m / Hình n.m</strong> cho mọi bảng biểu và hình ảnh chưa có chú thích, chuẩn hóa 100% thuật ngữ viết tắt chuyên ngành, và <strong>chèn đủ 3 Danh mục vào trước Mục lục (ngay sau Lời giới thiệu &amp; Lời nói đầu)!</strong>
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
              <span>Nạp Đề Án Mẫu Có Lỗi (Hình 20.1 → 1.1 &amp; CK, HbA1c)</span>
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
              Hệ thống sẽ đọc toàn bộ 100% các chương mục, bảng biểu, hình ảnh nhúng và từ viết tắt để chuẩn hóa số thứ tự theo Chương (Chương 1 → Hình 1.1, 1.2...) và tự động chèn 3 Danh mục ngay sau Mục lục.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl mx-auto pt-3 text-left text-xs">
            <div className="p-3.5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 space-y-1">
              <div className="font-black text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4" />
                <span>1. Danh Mục Hình (Chuẩn Chương)</span>
              </div>
              <p className="text-[11px] text-neutral-500">
                Sửa ngay lỗi sai số chương (VD: Chương 1 ghi Hình 20.1 → đổi thành Hình 1.1., tiếp theo là Hình 1.2.).
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 space-y-1">
              <div className="font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <TableIcon className="w-4 h-4" />
                <span>2. Danh Mục Bảng Biểu</span>
              </div>
              <p className="text-[11px] text-neutral-500">
                Kiểm tra toàn bộ bảng dữ liệu theo từng chương, sửa lỗi đánh nhảy số Bảng 1.1 → 1.3 thành 1.1 → 1.2.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 space-y-1">
              <div className="font-black text-[#7d2ae8] dark:text-purple-400 flex items-center gap-1.5">
                <BookOpenCheck className="w-4 h-4" />
                <span>3. Danh Mục Từ Viết Tắt (Y Sinh &amp; Học Thuật)</span>
              </div>
              <p className="text-[11px] text-neutral-500">
                Tự động lập danh mục đánh số 1. CK (Creatine Kinase)..., 2. α-amylase..., 3. HbA1c... chèn sau Mục lục.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Loading State with Animated AzTool Logo & Live % */}
      {isAnalyzing && (
        <div className="canva-card p-12 rounded-3xl border border-neutral-200 dark:border-neutral-800 text-center">
          <AzLogoLoader
            title="Đang đọc 100% file Word & kiểm tra Danh mục Hình, Bảng, Từ viết tắt..."
            subtitle="Phân tích từng Chương, hình ảnh nhúng và bảng dữ liệu trong word/document.xml"
            progress={loadingProgress}
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
                {catalogsInserted && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-cyan-100 text-cyan-800 dark:bg-cyan-950/80 dark:text-cyan-300">
                    ✓ Đã chèn 3 Danh mục trước Mục lục (sau Lời giới thiệu)
                  </span>
                )}
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

            {/* Action Buttons: Fix All, Insert 3 Catalogs & Download Edited Word File */}
            <div className="flex flex-wrap items-center gap-2.5">
              {remainingUnfixedCount > 0 && (
                <button
                  type="button"
                  onClick={() => void handleFixAllIssues()}
                  disabled={isFixingAll}
                  className="px-4 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-600 hover:to-rose-700 text-white font-black text-xs sm:text-sm shadow-lg transition canva-tap flex items-center gap-2"
                >
                  {isFixingAll ? (
                    <DeQLogo size="xs" showSubtitle={false} isLoadingMode />
                  ) : (
                    <Wand2 className="w-4 h-4" />
                  )}
                  <span>
                    {isFixingAll
                      ? `Đang xử lý ${loadingProgress}%...`
                      : `Sửa Tất Cả & Chèn 3 Danh Mục (${remainingUnfixedCount} lỗi)`}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={handleInsertThreeCatalogsOnly}
                className="px-4 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs sm:text-sm shadow-md transition canva-tap flex items-center gap-1.5"
              >
                <Layers className="w-4 h-4" />
                <span>Chèn 3 Danh Mục (Trước Mục Lục)</span>
              </button>

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
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm sm:text-base font-black text-neutral-900 dark:text-white">
                    Danh Mục Hình Chuẩn Hóa Theo Chương ({report.figuresCatalog.length} hình)
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Tự động sắp xếp theo đúng Chương thực tế (VD: Chương 1 → Hình 1.1., Hình 1.2....) để chèn vào sau Mục lục &amp; trước Nội dung.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const lines = [
                      'Danh mục hình',
                      ...report.figuresCatalog.map(
                        f => `Hình ${f.expectedNumberStr}. ${f.title || f.fullCaption}`
                      ),
                    ].join('\n');
                    navigator.clipboard.writeText(lines);
                    toast.success('Đã sao chép Danh mục hình chuẩn!');
                  }}
                  className="canva-btn-secondary px-3.5 py-2 rounded-xl text-xs font-bold"
                >
                  Sao chép Danh mục hình
                </button>
              </div>

              {report.figuresCatalog.length > 0 && (
                <div className="p-4 rounded-2xl bg-cyan-50/50 dark:bg-cyan-950/20 border border-cyan-200/70 dark:border-cyan-800/50 space-y-1.5 text-xs">
                  <div className="font-black text-cyan-800 dark:text-cyan-300">
                    Danh mục hình (Bản chuẩn chèn sau Mục lục):
                  </div>
                  {report.figuresCatalog.map(fig => (
                    <div key={`prev-${fig.id}`} className="font-medium text-neutral-800 dark:text-neutral-200">
                      <strong>Hình {fig.expectedNumberStr}.</strong> {fig.title || fig.fullCaption}
                    </div>
                  ))}
                </div>
              )}

              {report.figuresCatalog.length === 0 ? (
                <p className="text-xs text-neutral-400 py-8 text-center">
                  Không tìm thấy dòng ghi chú Hình/Ảnh nào trong tài liệu.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 font-extrabold border-b border-neutral-200 dark:border-neutral-800">
                        <th className="py-3 px-4">Chương</th>
                        <th className="py-3 px-4">Số Đang Ghi</th>
                        <th className="py-3 px-4">Số Chuẩn Theo Chương</th>
                        <th className="py-3 px-4">Nội Dung Ghi Chú (Caption)</th>
                        <th className="py-3 px-4">Vị Trí Đoạn</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200/70 dark:divide-neutral-800">
                      {report.figuresCatalog.map(fig => (
                        <tr key={fig.id} className="hover:bg-cyan-50/30 dark:hover:bg-neutral-800/40">
                          <td className="py-3 px-4 font-bold">Chương {fig.actualChapter}</td>
                          <td className="py-3 px-4 font-mono text-neutral-500">
                            {fig.prefix} {fig.numberStr}
                          </td>
                          <td className="py-3 px-4 font-black text-cyan-700 dark:text-cyan-400">
                            Hình {fig.expectedNumberStr}.
                          </td>
                          <td className="py-3 px-4 font-semibold text-neutral-900 dark:text-white">
                            {fig.title || fig.fullCaption}
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
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm sm:text-base font-black text-neutral-900 dark:text-white">
                    Danh Mục Bảng Biểu Chuẩn Hóa Theo Chương ({report.tablesCatalog.length} bảng)
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Sắp xếp chuẩn theo từng Chương (Bảng 1.1., Bảng 1.2....) để chèn vào sau Mục lục.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const lines = [
                      'Danh mục bảng',
                      ...report.tablesCatalog.map(
                        t => `Bảng ${t.expectedNumberStr}. ${t.title || t.fullCaption}`
                      ),
                    ].join('\n');
                    navigator.clipboard.writeText(lines);
                    toast.success('Đã sao chép Danh mục bảng chuẩn!');
                  }}
                  className="canva-btn-secondary px-3.5 py-2 rounded-xl text-xs font-bold"
                >
                  Sao chép Danh mục bảng
                </button>
              </div>

              {report.tablesCatalog.length > 0 && (
                <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-800/50 space-y-1.5 text-xs">
                  <div className="font-black text-emerald-800 dark:text-emerald-300">
                    Danh mục bảng (Bản chuẩn chèn sau Mục lục):
                  </div>
                  {report.tablesCatalog.map(tbl => (
                    <div key={`prev-t-${tbl.id}`} className="font-medium text-neutral-800 dark:text-neutral-200">
                      <strong>Bảng {tbl.expectedNumberStr}.</strong> {tbl.title || tbl.fullCaption}
                    </div>
                  ))}
                </div>
              )}

              {report.tablesCatalog.length === 0 ? (
                <p className="text-xs text-neutral-400 py-8 text-center">
                  Không tìm thấy tiêu đề Bảng nào trong tài liệu.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 font-extrabold border-b border-neutral-200 dark:border-neutral-800">
                        <th className="py-3 px-4">Chương</th>
                        <th className="py-3 px-4">Số Đang Ghi</th>
                        <th className="py-3 px-4">Số Chuẩn Theo Chương</th>
                        <th className="py-3 px-4">Tên Bảng Biểu</th>
                        <th className="py-3 px-4">Vị Trí Đoạn</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200/70 dark:divide-neutral-800">
                      {report.tablesCatalog.map(tbl => (
                        <tr key={tbl.id} className="hover:bg-emerald-50/30 dark:hover:bg-neutral-800/40">
                          <td className="py-3 px-4 font-bold">Chương {tbl.actualChapter}</td>
                          <td className="py-3 px-4 font-mono text-neutral-500">
                            {tbl.prefix} {tbl.numberStr}
                          </td>
                          <td className="py-3 px-4 font-black text-emerald-700 dark:text-emerald-400">
                            Bảng {tbl.expectedNumberStr}.
                          </td>
                          <td className="py-3 px-4 font-semibold text-neutral-900 dark:text-white">
                            {tbl.title || tbl.fullCaption}
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
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm sm:text-base font-black text-neutral-900 dark:text-white">
                    Danh Mục Từ Viết Tắt ({report.abbreviations.length} từ)
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Đánh số tự động (1. CK (Creatine Kinase): ..., 2. α-amylase: ..., 3. HbA1c: ...) và chèn vào sau Mục lục.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const active = report.abbreviations.filter(
                      ab => ab.occurrencesInBody > 0 || ab.inFrontMatterList
                    );
                    const lines = [
                      'Danh mục từ viết tắt',
                      ...active.map((ab, idx) => formatNumberedAbbreviationLine(idx + 1, ab)),
                    ].join('\n');
                    navigator.clipboard.writeText(lines);
                    toast.success('Đã sao chép Danh mục từ viết tắt chuẩn!');
                  }}
                  className="canva-btn-secondary px-3.5 py-2 rounded-xl text-xs font-bold"
                >
                  Sao chép Danh mục từ viết tắt
                </button>
              </div>

              {report.abbreviations.length > 0 && (
                <div className="p-4 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/70 dark:border-purple-800/50 space-y-1.5 text-xs">
                  <div className="font-black text-[#7d2ae8] dark:text-purple-300">
                    Danh mục từ viết tắt (Bản chuẩn chèn sau Mục lục):
                  </div>
                  {report.abbreviations
                    .filter(ab => ab.occurrencesInBody > 0 || ab.inFrontMatterList)
                    .map((ab, idx) => (
                      <div key={`prev-ab-${ab.acronym}`} className="font-medium text-neutral-800 dark:text-neutral-200">
                        {formatNumberedAbbreviationLine(idx + 1, ab)}
                      </div>
                    ))}
                </div>
              )}

              <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 font-extrabold border-b border-neutral-200 dark:border-neutral-800">
                      <th className="py-3 px-4">STT</th>
                      <th className="py-3 px-4">Từ Viết Tắt</th>
                      <th className="py-3 px-4">Giải Nghĩa Chuẩn (Gợi ý / Đã khai báo)</th>
                      <th className="py-3 px-4 text-center">Số Lần Dùng</th>
                      <th className="py-3 px-4 text-center">Trạng Thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200/70 dark:divide-neutral-800">
                    {report.abbreviations.map((ab, idx) => (
                      <tr key={ab.acronym} className="hover:bg-purple-50/30 dark:hover:bg-neutral-800/40">
                        <td className="py-3 px-4 font-bold">{idx + 1}</td>
                        <td className="py-3 px-4 font-mono font-black text-sm text-[#7d2ae8] dark:text-purple-300">
                          {ab.acronym}
                        </td>
                        <td className="py-3 px-4 font-semibold text-neutral-800 dark:text-neutral-200">
                          {formatNumberedAbbreviationLine(idx + 1, ab)}
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
