'use client';

import React, { useState } from 'react';
import { Question, ExamMetadata, MixedExam } from '@/types/exam';
import { generateMixedExams, createMixedExamsZip } from '@/lib/exam-mixer';
import { generateStandardDocx, generateCombinedMixedDocx } from '@/lib/docx-generator';
import { useAuth } from '@/lib/auth-context';
import { captureWorkspaceSnapshot } from '@/lib/workspace-sync';
import { useToast } from '@/components/ToastProvider';
import { downloadFileMobileSafe } from '@/lib/mobile-download';
import {
  Shuffle,
  Download,
  Archive,
  BarChart2,
  CheckCircle2,
  Layers,
  Sparkles,
  Grid,
  FileText,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { DeQLogo } from '@/components/DeQLogo';

interface ExamMixerProps {
  examMetadata: ExamMetadata;
  questions: Question[];
  onGoToAiAudit: () => void;
}

export function ExamMixer({ examMetadata, questions, onGoToAiAudit }: ExamMixerProps) {
  const { user, incrementUsage } = useAuth();
  const toast = useToast();

  const [numExams, setNumExams] = useState(4);
  const [startCode, setStartCode] = useState('101');
  const [balancedDistribution, setBalancedDistribution] = useState(true);
  const [mixedExams, setMixedExams] = useState<MixedExam[]>([]);
  const [activeCodeTab, setActiveCodeTab] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isZipping, setIsZipping] = useState(false);

  const handleMixExams = () => {
    if (questions.length === 0) {
      toast.warning(
        'Chưa có câu hỏi để trộn!',
        'Hãy quay lại Bước 1 để tải đề thi lên hoặc nạp đề mẫu.'
      );
      return;
    }

    setIsGenerating(true);
    toast.showLoading(
      `Đang trộn ${numExams} mã đề độc lập...`,
      'Xáo trộn thứ tự câu hỏi và cân bằng tỷ lệ đáp án ~25% A-B-C-D'
    );

    setTimeout(() => {
      try {
        const startNum = parseInt(startCode, 10) || 101;
        const customCodes: string[] = [];
        for (let i = 0; i < numExams; i++) {
          customCodes.push(`${startNum + i}`);
        }

        const results = generateMixedExams(
          questions,
          numExams,
          customCodes,
          balancedDistribution
        );

        setMixedExams(results);
        setActiveCodeTab(results[0]?.code || '');
        incrementUsage('mix');

        void captureWorkspaceSnapshot({
          userEmail: user?.email || 'khach@aztool.vercel.app',
          userName: user?.displayName || (user?.email ? user.email.split('@')[0] : 'Khách vãng lai'),
          userAvatar: user?.photoURL,
          actionType: 'mix',
          actionLabel: `Trộn ${results.length} mã đề (${customCodes.join(', ')})`,
          originalFileName: `BoDeTron_${customCodes.join('_')}.docx`,
          metadata: examMetadata,
          questions,
        });

        toast.success(
          `Đã tạo thành công ${results.length} mã đề!`,
          `Các mã đề: ${customCodes.join(', ')} • Sẵn sàng tải từng đề hoặc trọn bộ .ZIP`
        );
        confetti({ particleCount: 55, spread: 65, origin: { y: 0.6 } });
      } catch (err: any) {
        toast.error('Lỗi trộn đề', err.message || String(err));
      } finally {
        setIsGenerating(false);
        toast.hideLoading();
      }
    }, 320);
  };

  const handleDownloadSingleExam = async (exam: MixedExam, hasAnswers: boolean) => {
    toast.showLoading(
      `Đang xuất Mã Đề ${exam.code}...`,
      hasAnswers ? 'Bản Giảng Viên (Có đánh X đỏ vào bảng)' : 'Bản Sinh Viên Làm Bài (Đề sạch)'
    );
    try {
      const blob = await generateStandardDocx(examMetadata, exam.questions, hasAnswers, exam.code);
      const suffix = hasAnswers ? 'DAP_AN_DANH_X' : 'BAN_SINH_VIEN_LAM_BAI';
      const fileName = `AzTool_Ma${exam.code}_${suffix}.docx`;
      await downloadFileMobileSafe(blob, fileName);
      toast.success(
        `Đã tải Mã Đề ${exam.code} (.docx)!`,
        `File Word mở trực tiếp trên cả Điện thoại & Laptop: ${fileName}`
      );
    } catch (err: any) {
      toast.error('Lỗi xuất file', err.message || String(err));
    } finally {
      toast.hideLoading();
    }
  };

  const handleDownloadCombinedWord = async (hasAnswers: boolean) => {
    if (mixedExams.length === 0) return;
    setIsZipping(true);
    toast.showLoading(
      `Đang xuất trọn bộ ${mixedExams.length} mã đề vào 1 file Word (.docx)...`,
      'Mở trực tiếp bằng Microsoft Word trên Điện thoại & Laptop (không cần giải nén ZIP)'
    );
    try {
      const blob = await generateCombinedMixedDocx(examMetadata, mixedExams, hasAnswers);
      const codesStr = mixedExams.map(e => e.code).join('_');
      const suffix = hasAnswers ? 'DAP_AN_DANH_X' : 'DE_SINH_VIEN';
      const fileName = `AzTool_TronBo_${mixedExams.length}MaDe_${codesStr}_${suffix}.docx`;
      await downloadFileMobileSafe(blob, fileName);
      toast.success(
        `Đã tải File Word Gộp ${mixedExams.length} Mã Đề (.docx)!`,
        `Mở trực tiếp bằng Word trên điện thoại hoặc máy tính: ${fileName}`
      );
      confetti({ particleCount: 65, spread: 70 });
    } catch (err: any) {
      toast.error('Lỗi xuất file Word gộp', err.message || String(err));
    } finally {
      setIsZipping(false);
      toast.hideLoading();
    }
  };

  const handleDownloadAllZip = async () => {
    if (mixedExams.length === 0) return;
    setIsZipping(true);
    toast.showLoading(
      `Đang đóng gói trọn bộ ${mixedExams.length} mã đề (.ZIP)...`,
      'Bao gồm cả thư mục Đề Sinh Viên, Đề Giảng Viên (có đánh X) và Bảng Tổng Hợp Đáp Án'
    );
    try {
      const zipBlob = await createMixedExamsZip(examMetadata, mixedExams);
      const fileName = `Bo_De_Tron_AzTool_${mixedExams.length}_MaDe.zip`;
      await downloadFileMobileSafe(zipBlob, fileName);
      toast.success(
        'Đã tải trọn bộ đề nén (.ZIP)!',
        `Gồm ${mixedExams.length} bản Sinh Viên + ${mixedExams.length} bản Giảng Viên (đánh X).`
      );
      confetti({ particleCount: 75, spread: 75 });
    } catch (err: any) {
      toast.error('Lỗi nén file ZIP', err.message || String(err));
    } finally {
      setIsZipping(false);
      toast.hideLoading();
    }
  };

  const currentExam = mixedExams.find(e => e.code === activeCodeTab) || mixedExams[0];

  return (
    <div className="space-y-8 py-2 max-w-4xl mx-auto">
      {/* Canva Style Hero */}
      <div className="text-center space-y-3 pt-2 sm:pt-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-100 text-[#7d2ae8] dark:bg-purple-950/60 dark:text-purple-300 text-xs font-bold shadow-xs">
          <Shuffle className="w-3.5 h-3.5" />
          <span>Thuật Toán Hoán Vị Cân Bằng 25% A-B-C-D</span>
        </div>

        <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-neutral-900 dark:text-neutral-100">
          Trộn Mã Đề Thông Minh &amp; Cân Bằng
        </h2>

        <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 font-normal max-w-xl mx-auto leading-relaxed">
          Xáo trộn câu hỏi và phương án A, B, C, D. Giữ nguyên <strong>100% thông tin đầu đề gốc</strong>, chỉ điền Mã đề vào khung &ldquo;Đề Số&rdquo; và đánh dấu <strong className="text-rose-600">X đỏ</strong> vào Phiếu trả lời cho từng mã đề.
        </p>
      </div>

      {/* Canva Config Card */}
      <div className="canva-card p-6 sm:p-8 shadow-xs border border-neutral-200/90 dark:border-neutral-800 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-xs">
          {/* Number of codes */}
          <div className="space-y-2">
            <label className="font-bold text-neutral-800 dark:text-neutral-200">
              1. Số Lượng Mã Đề Cần Tạo:
            </label>
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800">
              {[2, 4, 6, 8].map(n => (
                <button
                  key={n}
                  onClick={() => setNumExams(n)}
                  className={`flex-1 py-1.5 rounded-lg font-bold transition canva-tap ${
                    numExams === n
                      ? 'bg-[#7d2ae8] text-white shadow-xs'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                  }`}
                >
                  {n} Đề
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 pt-1 text-neutral-400">
              <span>Hoặc nhập số đề:</span>
              <input
                type="number"
                min={1}
                max={50}
                value={numExams}
                onChange={e => setNumExams(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 p-1 text-center font-bold rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
              />
            </div>
          </div>

          {/* Start Code */}
          <div className="space-y-2">
            <label className="font-bold text-neutral-800 dark:text-neutral-200">
              2. Mã Đề Bắt Đầu:
            </label>
            <input
              type="text"
              value={startCode}
              onChange={e => setStartCode(e.target.value)}
              placeholder="101"
              className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 font-mono text-xs font-bold focus:ring-2 focus:ring-[#7d2ae8] outline-hidden"
            />
            <p className="text-[11px] text-neutral-400">
              Sẽ tạo các mã đề: <strong className="text-purple-600 dark:text-purple-400">{startCode}, {(parseInt(startCode, 10) || 101) + 1}...</strong>
            </p>
          </div>

          {/* Balanced distribution checkbox & Start Button */}
          <div className="flex flex-col justify-between space-y-3">
            <div>
              <label className="font-bold text-neutral-800 dark:text-neutral-200 block mb-1.5">
                3. Chế Độ Cân Bằng Đáp Án:
              </label>
              <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded-xl border border-purple-100 dark:border-neutral-800 bg-purple-50/40 dark:bg-neutral-900">
                <input
                  type="checkbox"
                  checked={balancedDistribution}
                  onChange={e => setBalancedDistribution(e.target.checked)}
                  className="rounded text-[#7d2ae8] focus:ring-[#7d2ae8] w-4 h-4"
                />
                <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Cân bằng đều ~25% A-B-C-D
                </span>
              </label>
            </div>

            <button
              onClick={handleMixExams}
              disabled={isGenerating || questions.length === 0}
              className="canva-btn-primary w-full py-3 rounded-xl text-xs font-bold shadow-md transition canva-tap flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isGenerating ? (
                <DeQLogo size="xs" showSubtitle={false} isLoadingMode />
              ) : (
                <Shuffle className="w-4 h-4" />
              )}
              <span>{isGenerating ? 'Đang xáo trộn...' : `Bắt Đầu Trộn ${numExams} Mã Đề`}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Results Section */}
      {mixedExams.length > 0 && (
        <div className="space-y-6 tab-enter">
          {/* Top Bar with Direct Word (.DOCX) & ZIP download */}
          <div className="canva-card p-4 px-5 flex flex-col gap-3 shadow-xs border border-neutral-200 dark:border-neutral-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#00c4cc] animate-pulse" />
                Đã tạo thành công {mixedExams.length} mã đề ({questions.length} câu/đề) • Mở Word trực tiếp trên cả Điện thoại &amp; Laptop
              </span>

              <button
                onClick={onGoToAiAudit}
                className="canva-btn-secondary px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 canva-tap"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#7d2ae8]" />
                <span>Quay Lại Soát Lỗi</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                onClick={() => void handleDownloadCombinedWord(false)}
                disabled={isZipping}
                className="canva-btn-primary px-4 py-2.5 rounded-xl text-xs font-bold shadow-md transition canva-tap flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" />
                <span>Tải Tất Cả {mixedExams.length} Đề SV (1 File Word .DOCX)</span>
              </button>

              <button
                onClick={() => void handleDownloadCombinedWord(true)}
                disabled={isZipping}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition canva-tap flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" />
                <span>Tải Tất Cả {mixedExams.length} Đề GV Có X (1 File Word .DOCX)</span>
              </button>

              <button
                onClick={() => void handleDownloadAllZip()}
                disabled={isZipping}
                className="canva-btn-secondary px-4 py-2.5 rounded-xl text-xs font-bold transition canva-tap flex items-center justify-center gap-2"
              >
                {isZipping ? (
                  <DeQLogo size="xs" showSubtitle={false} isLoadingMode />
                ) : (
                  <Archive className="w-4 h-4 text-[#7d2ae8]" />
                )}
                <span>Tải Thư Mục Nén (.ZIP)</span>
              </button>
            </div>
          </div>

          {/* Exam Code Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {mixedExams.map(exam => (
              <button
                key={exam.code}
                onClick={() => setActiveCodeTab(exam.code)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition canva-tap whitespace-nowrap ${
                  activeCodeTab === exam.code
                    ? 'bg-[#7d2ae8] text-white shadow-xs scale-105'
                    : 'canva-card text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 border border-neutral-200 dark:border-neutral-800'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Mã Đề {exam.code}</span>
              </button>
            ))}
          </div>

          {/* Active Code Card */}
          {currentExam && (
            <div key={currentExam.code} className="canva-card p-6 space-y-6 shadow-xs border border-neutral-200/90 dark:border-neutral-800 tab-enter">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200/80 dark:border-neutral-800 pb-4">
                <div>
                  <h3 className="text-lg font-black text-neutral-900 dark:text-neutral-100">
                    Chi Tiết Mã Đề {currentExam.code}
                  </h3>
                  <p className="text-xs text-neutral-400">
                    {currentExam.questions.length} câu hỏi • Giữ nguyên 100% đầu đề gốc • Không in đậm phương án
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => handleDownloadSingleExam(currentExam, false)}
                    className="canva-btn-secondary px-4 py-2.5 rounded-xl text-xs font-bold transition canva-tap flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5 text-[#7d2ae8]" />
                    <span>Bản Sinh Viên (Đề Sạch) .docx</span>
                  </button>

                  <button
                    onClick={() => handleDownloadSingleExam(currentExam, true)}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition canva-tap flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Bản Giảng Viên (Có Đánh X) .docx</span>
                  </button>
                </div>
              </div>

              {/* Ratio Gauge */}
              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center justify-between mb-3 text-xs">
                  <span className="font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                    <BarChart2 className="w-3.5 h-3.5 text-[#7d2ae8]" />
                    <span>Tỷ lệ phân bổ đáp án Mã {currentExam.code}:</span>
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Phân bổ cân bằng
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2.5 text-center text-xs">
                  {(['A', 'B', 'C', 'D'] as const).map(letter => {
                    const count = currentExam.answerDistribution[letter];
                    const total = currentExam.questions.length || 1;
                    const pct = ((count / total) * 100).toFixed(1);
                    return (
                      <div key={letter} className="bg-white dark:bg-neutral-800 p-3 rounded-2xl border border-neutral-200/80 dark:border-neutral-700 shadow-2xs">
                        <div className="font-bold text-neutral-500 dark:text-neutral-400">
                          Phương án {letter}
                        </div>
                        <div className="text-lg font-black text-neutral-900 dark:text-white mt-0.5">
                          {count} câu
                        </div>
                        <div className="text-[11px] text-[#7d2ae8] dark:text-purple-300 font-bold">
                          {pct}%
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Visual 4-Block Answer Sheet Preview for Current Mixed Exam */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-neutral-800 dark:text-neutral-200">
                  <Grid className="w-4 h-4 text-rose-500" />
                  <span>Bảng Phiếu Trả Lời 60 Câu Của Mã Đề {currentExam.code}:</span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
                  {[0, 1, 2, 3].map(blockIdx => (
                    <div
                      key={blockIdx}
                      className="rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden bg-white dark:bg-neutral-900"
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
                            const qObj = currentExam.questions[qNum - 1];
                            return (
                              <tr key={qNum} className={qObj ? '' : 'opacity-40'}>
                                <td className="py-1 font-bold text-neutral-700 dark:text-neutral-300 border-r border-neutral-100 dark:border-neutral-800">
                                  {qNum}
                                </td>
                                {(['A', 'B', 'C', 'D'] as const).map(opt => {
                                  const isMarked = qObj?.correctAnswer === opt;
                                  return (
                                    <td
                                      key={opt}
                                      className="py-1 border-r last:border-r-0 border-neutral-100 dark:border-neutral-800"
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
            </div>
          )}
        </div>
      )}
    </div>
  );
}
