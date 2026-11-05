import JSZip from 'jszip';
import { Question, ExamMetadata, MixedExam } from '@/types/exam';
import { generateStandardDocx } from './docx-generator';

const OPTION_KEYS: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];

/**
 * Standard Fisher-Yates array shuffle
 */
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Mix an exam into multiple codes with shuffled questions and shuffled options
 * Ensures 25% balanced answer key distribution across A, B, C, D
 */
export function generateMixedExams(
  originalQuestions: Question[],
  numExams: number = 4,
  customCodes?: string[],
  balancedDistribution: boolean = true
): MixedExam[] {
  const mixedExams: MixedExam[] = [];

  // Generate codes like 101, 102, 103... or custom
  const codes: string[] = [];
  for (let i = 0; i < numExams; i++) {
    if (customCodes && customCodes[i]) {
      codes.push(customCodes[i]);
    } else {
      codes.push(`${101 + i}`);
    }
  }

  for (const code of codes) {
    // 1. Shuffle question order
    const shuffledQuestionOrder = shuffleArray(originalQuestions);

    // Track distribution
    const counts = { A: 0, B: 0, C: 0, D: 0 };
    const mixedQuestions: Question[] = [];

    // Pre-determine target letters for balanced distribution if enabled
    let targetLetters: ('A' | 'B' | 'C' | 'D')[] = [];
    if (balancedDistribution) {
      const qCount = shuffledQuestionOrder.length;
      const basePerOption = Math.floor(qCount / 4);
      const remainder = qCount % 4;

      const lettersPool: ('A' | 'B' | 'C' | 'D')[] = [];
      for (const k of OPTION_KEYS) {
        for (let b = 0; b < basePerOption; b++) {
          lettersPool.push(k);
        }
      }
      // Distribute remainder
      for (let r = 0; r < remainder; r++) {
        lettersPool.push(OPTION_KEYS[r]);
      }
      targetLetters = shuffleArray(lettersPool);
    }

    shuffledQuestionOrder.forEach((origQ, idx) => {
      const originalOptions = origQ.options;
      const origCorrect = origQ.correctAnswer;

      let newOptions: { A: string; B: string; C: string; D: string } = {
        A: '',
        B: '',
        C: '',
        D: '',
      };
      let newCorrectAnswer: 'A' | 'B' | 'C' | 'D' | '' = '';

      if (origCorrect && OPTION_KEYS.includes(origCorrect as any)) {
        // We know the correct answer
        const correctText = originalOptions[origCorrect as 'A' | 'B' | 'C' | 'D'];
        const distractorTexts = OPTION_KEYS
          .filter(k => k !== origCorrect)
          .map(k => originalOptions[k]);

        // Decide which slot the correct answer goes to
        let targetSlot: 'A' | 'B' | 'C' | 'D';
        if (balancedDistribution && targetLetters[idx]) {
          targetSlot = targetLetters[idx];
        } else {
          targetSlot = OPTION_KEYS[Math.floor(Math.random() * 4)];
        }

        // Shuffle the remaining 3 distractors into remaining 3 slots
        const shuffledDistractors = shuffleArray(distractorTexts);
        const remainingSlots = OPTION_KEYS.filter(k => k !== targetSlot);

        newOptions[targetSlot] = correctText;
        remainingSlots.forEach((slot, dIdx) => {
          newOptions[slot] = shuffledDistractors[dIdx];
        });

        newCorrectAnswer = targetSlot;
        counts[targetSlot]++;
      } else {
        // No marked correct answer, just shuffle all 4 options randomly
        const allTexts = shuffleArray([
          originalOptions.A,
          originalOptions.B,
          originalOptions.C,
          originalOptions.D,
        ]);
        newOptions = {
          A: allTexts[0],
          B: allTexts[1],
          C: allTexts[2],
          D: allTexts[3],
        };
      }

      mixedQuestions.push({
        id: idx + 1,
        originalNumber: origQ.originalNumber,
        text: origQ.text,
        options: newOptions,
        correctAnswer: newCorrectAnswer,
        explanation: origQ.explanation,
      });
    });

    mixedExams.push({
      code,
      questions: mixedQuestions,
      answerDistribution: counts,
    });
  }

  return mixedExams;
}

/**
 * Generate a Zip package containing all mixed exams (with and without answers) + Summary matrix
 */
export async function createMixedExamsZip(
  metadata: ExamMetadata,
  mixedExams: MixedExam[]
): Promise<Blob> {
  const zip = new JSZip();

  // Summary Matrix (Bảng ma trận so chiếu đáp án các mã đề)
  let summaryText = `BẢNG MA TRẬN ĐÁP ÁN CÁC MÃ ĐỀ\n`;
  summaryText += `Trường: ${metadata.university || 'TRƯỜNG ĐẠI HỌC CỬU LONG'}\n`;
  summaryText += `Môn thi: ${metadata.subject}\n`;
  summaryText += `Học kỳ: ${metadata.semester} - Năm học: ${metadata.academicYear}\n`;
  summaryText += `Thời gian: ${metadata.durationMinutes} phút\n`;
  summaryText += `Ngày tạo: ${new Date().toLocaleDateString('vi-VN')}\n`;
  summaryText += `------------------------------------------------------\n\n`;

  const totalQuestions = mixedExams[0]?.questions.length || 0;

  // Header row: Câu | 101 | 102 | 103 ...
  summaryText += `Câu\t` + mixedExams.map(e => `Mã ${e.code}`).join('\t') + '\n';

  for (let q = 1; q <= totalQuestions; q++) {
    const row = [
      `Câu ${q}`,
      ...mixedExams.map(e => e.questions[q - 1]?.correctAnswer || '-'),
    ];
    summaryText += row.join('\t') + '\n';
  }

  // Answer distribution summary
  summaryText += `\n------------------------------------------------------\n`;
  summaryText += `THỐNG KÊ TỶ LỆ ĐÁP ÁN (A - B - C - D)\n`;
  mixedExams.forEach(e => {
    const total = e.questions.length || 1;
    const d = e.answerDistribution;
    const pA = ((d.A / total) * 100).toFixed(1);
    const pB = ((d.B / total) * 100).toFixed(1);
    const pC = ((d.C / total) * 100).toFixed(1);
    const pD = ((d.D / total) * 100).toFixed(1);
    summaryText += `Mã đề ${e.code}: A=${d.A} (${pA}%) | B=${d.B} (${pB}%) | C=${d.C} (${pC}%) | D=${d.D} (${pD}%)\n`;
  });

  zip.file('Bang_Dap_An_Tong_Hop.txt', summaryText);

  // Generate DOCX files for each exam
  for (const exam of mixedExams) {
    // 1. File Đề thi (Bản sinh viên - không có đáp án đánh X)
    const studentDocBlob = await generateStandardDocx(
      metadata,
      exam.questions,
      false,
      exam.code
    );
    zip.file(`De_Thi_Ma_${exam.code}_(Ban_Lam_Bai).docx`, studentDocBlob);

    // 2. File Đáp án (Bản giáo viên / chấm thi - có đánh dấu X)
    const teacherDocBlob = await generateStandardDocx(
      metadata,
      exam.questions,
      true,
      exam.code
    );
    zip.file(`De_Thi_Ma_${exam.code}_(Dap_An_Danh_X).docx`, teacherDocBlob);
  }

  return await zip.generateAsync({ type: 'blob' });
}
