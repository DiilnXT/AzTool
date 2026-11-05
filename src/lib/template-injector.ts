import JSZip from 'jszip';
import { Question, ExamMetadata } from '@/types/exam';

function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove invalid XML 1.0 control characters
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Injects questions and ticks the answer sheet in the official MAU_DE_THI_tracnghiem.docx template.
 * STRICT USER INSTRUCTION:
 * - GIỮ NGUYÊN 100% TOÀN BỘ PHẦN THÔNG TIN ĐẦU ĐỀ CỦA FILE GỐC (môn học, học kỳ, thời gian, năm học, ngày tháng, v.v. KHÔNG CHỈNH SỬA GÌ HẾT).
 * - CHỈ CHỈNH NỘI DUNG ĐỀ (giữa "Nội dung đề" và "-----Hết-----").
 * - VÀ TICK Ô ĐÁP ÁN THÔI (Table 1: đánh dấu X cho giáo viên hoặc để trống cho sinh viên).
 */
export async function injectIntoTemplateDocx(
  templateBuffer: ArrayBuffer | Uint8Array,
  _metadata: ExamMetadata,
  questions: Question[],
  hasAnswers: boolean = false,
  customExamCode?: string
): Promise<Blob> {
  const zip = new JSZip();
  const zipContent = await zip.loadAsync(templateBuffer);

  const docXmlFile = zipContent.file('word/document.xml');
  if (!docXmlFile) {
    throw new Error('Template không hợp lệ (không tìm thấy word/document.xml)');
  }

  let docXml = await docXmlFile.async('text');

  // ONLY IF explicitly mixing exam codes (customExamCode passed), fill exam code in the two boxes
  if (customExamCode) {
    const cleanCode = escapeXml(customExamCode);
    docXml = docXml.replace(
      /(<w:t xml:space="preserve">Đề Số: <\/w:t>[\s\S]*?<w:t>)\.\.(<\/w:t>)/,
      `$1${cleanCode}$2`
    );
    docXml = docXml.replace(
      /<w:t>Đề số:[^<]*<\/w:t>/,
      `<w:t>Đề số: ${cleanCode}</w:t>`
    );
  }
  // OTHERWISE: 100% OF HEADER IS LEFT COMPLETELY UNTOUCHED AS IN THE ORIGINAL TEMPLATE FILE!

  // 1. UPDATE TABLE 1 (PHIẾU TRẢ LỜI 60 CÂU - TICK Ô ĐÁP ÁN)
  const tblRegex = /<w:tbl[\s\S]*?<\/w:tbl>/g;
  const tblMatches = [...docXml.matchAll(tblRegex)];

  if (tblMatches.length >= 2) {
    const table1Match = tblMatches[1];
    const table1Original = table1Match[0];
    const table1Start = table1Match.index;
    const table1End = table1Start + table1Original.length;

    const updatedTable1 = updateAnswerSheetTableXml(table1Original, questions, hasAnswers);
    docXml = docXml.substring(0, table1Start) + updatedTable1 + docXml.substring(table1End);
  }

  // 2. LOCATE AND REPLACE CONTENT BETWEEN "Nội dung đề" AND "-----Hết-----"
  const noiDungIdx = docXml.indexOf('Nội dung đề');
  const hetIdx = docXml.indexOf('-----Hết-----');

  if (noiDungIdx !== -1 && hetIdx !== -1 && hetIdx > noiDungIdx) {
    // End of <w:p> containing "Nội dung đề"
    const pEndAfterNoiDung = docXml.indexOf('</w:p>', noiDungIdx) + 6;

    // Start of the exact <w:p> containing "-----Hết-----"
    const pMatches = [...docXml.substring(0, hetIdx).matchAll(/<w:p[\s>]/g)];
    if (pMatches.length > 0) {
      const pStartBeforeHet = pMatches[pMatches.length - 1].index;

      if (pEndAfterNoiDung !== -1 && pStartBeforeHet !== -1 && pStartBeforeHet > pEndAfterNoiDung) {
        const questionsXml = generateQuestionsXml(questions);
        docXml = docXml.substring(0, pEndAfterNoiDung) + questionsXml + docXml.substring(pStartBeforeHet);
      }
    }
  }

  zipContent.file('word/document.xml', docXml);
  return await zipContent.generateAsync({ type: 'blob' });
}

function updateAnswerSheetTableXml(
  tableXml: string,
  questions: Question[],
  hasAnswers: boolean
): string {
  const qMap = new Map<number, string>();
  questions.forEach((q, idx) => {
    if (q.correctAnswer) {
      qMap.set(idx + 1, q.correctAnswer);
    }
  });

  const rows = tableXml.split('</w:tr>');

  for (let rIdx = 0; rIdx < 15 && rIdx + 1 < rows.length; rIdx++) {
    const rowContent = rows[rIdx + 1];
    const cells = rowContent.split('</w:tc>');

    if (cells.length >= 20) {
      for (let b = 0; b < 4; b++) {
        const qNum = (rIdx + 1) + b * 15;
        const correctAns = qMap.get(qNum);

        const optIndices = [
          { opt: 'A', idx: b * 5 + 1 },
          { opt: 'B', idx: b * 5 + 2 },
          { opt: 'C', idx: b * 5 + 3 },
          { opt: 'D', idx: b * 5 + 4 },
        ];

        optIndices.forEach(({ opt, idx }) => {
          const isCorrect = hasAnswers && correctAns === opt;
          if (isCorrect) {
            cells[idx] = cells[idx].replace(
              /<w:p[\s>][\s\S]*?<\/w:p>/,
              `<w:p><w:pPr><w:spacing w:line="276" w:lineRule="auto"/><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:sz w:val="26"/><w:color w:val="C00000"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:sz w:val="26"/><w:color w:val="C00000"/></w:rPr><w:t>X</w:t></w:r></w:p>`
            );
          } else {
            // Clean empty cell for student
            cells[idx] = cells[idx].replace(
              /<w:p[\s>][\s\S]*?<\/w:p>/,
              `<w:p><w:pPr><w:spacing w:line="276" w:lineRule="auto"/><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="26"/></w:rPr></w:pPr></w:p>`
            );
          }
        });
      }

      rows[rIdx + 1] = cells.join('</w:tc>');
    }
  }

  return rows.join('</w:tr>');
}

function generateQuestionsXml(questions: Question[]): string {
  let xml = '';

  questions.forEach((q, idx) => {
    const qNum = idx + 1;

    // Question Paragraph
    xml += `<w:p w:rsidR="000D5031" w:rsidRDefault="000D5031">
      <w:pPr>
        <w:spacing w:before="120" w:after="40" w:line="260"/>
        <w:rPr>
          <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
          <w:b/>
          <w:sz w:val="26"/>
        </w:rPr>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
          <w:b/>
          <w:sz w:val="26"/>
        </w:rPr>
        <w:t>Câu ${qNum}: </w:t>
      </w:r>
      <w:r>
        <w:rPr>
          <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
          <w:sz w:val="26"/>
        </w:rPr>
        <w:t xml:space="preserve">${escapeXml(q.text)}</w:t>
      </w:r>
    </w:p>`;

    // Options A, B, C, D: ZERO BOLD in option content for ALL versions (answers are in Table 1)
    const options: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];
    options.forEach(opt => {
      const optText = q.options[opt] || '';

      xml += `<w:p w:rsidR="000D5031" w:rsidRDefault="000D5031">
        <w:pPr>
          <w:ind w:left="400"/>
          <w:spacing w:before="20" w:after="30" w:line="240"/>
          <w:rPr>
            <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
            <w:sz w:val="26"/>
          </w:rPr>
        </w:pPr>
        <w:r>
          <w:rPr>
            <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
            <w:b/>
            <w:sz w:val="26"/>
          </w:rPr>
          <w:t>${opt}. </w:t>
        </w:r>
        <w:r>
          <w:rPr>
            <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
            <w:sz w:val="26"/>
          </w:rPr>
          <w:t xml:space="preserve">${escapeXml(optText)}</w:t>
        </w:r>
      </w:p>`;
    });
  });

  return xml;
}
