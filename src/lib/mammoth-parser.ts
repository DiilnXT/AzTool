import mammoth from 'mammoth';
import { Question, ExamMetadata } from '@/types/exam';

interface LineSegment {
  text: string;
  bold: boolean;
  underline: boolean;
  color: string;
}

interface ParsedLine {
  text: string;
  segments: LineSegment[];
}

function cleanText(str: string): string {
  return str.replace(/\s+/g, ' ').trim();
}

/**
 * Universal Word docx parser combining Mammoth conversion (Dzota engine) + Table Answer Key scanner
 * Supports both:
 * 1) Type 1: In-line Bold/Underline/Asterisk/Color (<u>A.</u> or **A.** or red)
 * 2) Type 2: Answer Table (Bảng đánh dấu X, Bảng 1-A 2-B...)
 */
export async function parseDocxWithMammoth(arrayBuffer: ArrayBuffer): Promise<{
  questions: Question[];
  metadata: Partial<ExamMetadata>;
  rawText: string;
}> {
  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      styleMap: [
        "u => u",
        "b => strong",
        "i => em",
        "strike => del"
      ]
    }
  );

  const html = result.value;
  return parseHtmlQuiz(html);
}

/**
 * Parse HTML representation into structured questions (Dzota Core Algorithm)
 */
export function parseHtmlQuiz(htmlStr: string): {
  questions: Question[];
  metadata: Partial<ExamMetadata>;
  rawText: string;
} {
  let lines: ParsedLine[] = [];
  const tableAnswers: Record<number, 'A' | 'B' | 'C' | 'D'> = {};

  if (typeof window !== 'undefined' && window.DOMParser) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${htmlStr}</div>`, 'text/html');

    // Extract answers from any <table> with marked 'X' or answers (Type 2)
    extractAnswersFromHtmlTables(doc, tableAnswers);

    lines = parseDomToLines(doc.body);
  } else {
    lines = parseHtmlToLinesRegex(htmlStr);
  }

  // 1. Extract metadata (only Subject)
  const metadata = extractMetadataFromLines(lines);

  // 2. Extract trailing text answer table if present (e.g. 1-A, 2-B, 3-C...)
  const textAnswers = extractTrailingAnswerKeyFromLines(lines);

  // Merge table answers and text answers
  const answerMap = { ...textAnswers, ...tableAnswers };

  // 3. Extract questions using Dzota multi-criteria analyzer
  const questions = extractQuestionsFromLines(lines, answerMap);

  const rawText = lines.map(l => l.text).join('\n');

  return { questions, metadata, rawText };
}

/**
 * Type 2 Answer Detector: Extract answers from any Table in the uploaded docx
 * Matches tables with 'Câu | A | B | C | D' containing 'X' marks!
 */
function extractAnswersFromHtmlTables(doc: Document, answerMap: Record<number, 'A' | 'B' | 'C' | 'D'>) {
  const tables = doc.querySelectorAll('table');

  tables.forEach(table => {
    const rows = table.querySelectorAll('tr');
    if (rows.length < 2) return;

    // Check if table contains header or cells with A, B, C, D
    const tableText = table.textContent || '';
    if (!/A[\s\S]*B[\s\S]*C[\s\S]*D/i.test(tableText)) return;

    // Inspect each row
    rows.forEach((row) => {
      const cells = row.querySelectorAll('td, th');
      if (cells.length < 5) return;

      // May have multiple blocks of 5 cells (e.g. 4 blocks = 20 cells in official sheet)
      const blocksCount = Math.floor(cells.length / 5);
      for (let b = 0; b < blocksCount; b++) {
        const qCellText = cells[b * 5].textContent?.trim() || '';
        const qNum = parseInt(qCellText.replace(/\D/g, ''), 10);
        if (!qNum || qNum > 200) continue;

        const optLetters: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];
        optLetters.forEach((letter, lIdx) => {
          const cellContent = cells[b * 5 + 1 + lIdx].textContent?.trim() || '';
          // Check for 'X', 'x', 'Х', '✓', 'v', '1'
          if (/^[XxХх✓vV1]$/i.test(cellContent) || cellContent.includes('X') || cellContent.includes('Х') || cellContent.includes('✓')) {
            answerMap[qNum] = letter;
          }
        });
      }
    });
  });
}

function parseDomToLines(rootNode: any): ParsedLine[] {
  const lines: ParsedLine[] = [];
  let currentLine: ParsedLine = { text: '', segments: [] };

  const flushLine = () => {
    if (currentLine.text.trim().length > 0) {
      lines.push(currentLine);
    }
    currentLine = { text: '', segments: [] };
  };

  const isBlock = (node: any) => {
    const tags = ['DIV', 'P', 'LI', 'BR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TR'];
    return tags.includes(node.nodeName);
  };

  const walk = (node: any) => {
    if (node.nodeType === 3) {
      const text = node.textContent.replace(/\u00A0/g, ' ');
      if (text.length === 0) return;

      let isBold = false;
      let isUnderline = false;
      let detectedColor = '';

      let parent = node.parentElement;
      while (parent && parent !== rootNode) {
        const style = (parent.getAttribute('style') || '').toLowerCase();
        const tag = parent.tagName;

        if (
          tag === 'B' ||
          tag === 'STRONG' ||
          style.includes('font-weight: bold') ||
          style.includes('font-weight: 700') ||
          style.includes('font-weight: 800') ||
          style.includes('font-weight: 900')
        ) {
          isBold = true;
        }

        if (
          tag === 'U' ||
          style.includes('text-decoration: underline') ||
          style.includes('text-decoration-line: underline')
        ) {
          isUnderline = true;
        }

        if (
          style.includes('color: red') ||
          style.includes('#ff0000') ||
          style.includes('#c00000') ||
          style.includes('rgb(255, 0, 0)')
        ) {
          detectedColor = 'red';
        }

        parent = parent.parentElement;
      }

      currentLine.text += text;
      currentLine.segments.push({
        text,
        bold: isBold,
        underline: isUnderline,
        color: detectedColor,
      });
    } else if (node.nodeName === 'BR') {
      flushLine();
    } else {
      const isBlk = isBlock(node);
      if (isBlk) flushLine();
      for (let i = 0; i < node.childNodes.length; i++) {
        walk(node.childNodes[i]);
      }
      if (isBlk) flushLine();
    }
  };

  walk(rootNode);
  flushLine();
  return lines;
}

function parseHtmlToLinesRegex(html: string): ParsedLine[] {
  const lines: ParsedLine[] = [];
  const blocks = html.split(/<\/(?:p|div|tr|li|h[1-6])>|<br\s*\/?>/i);

  for (const blk of blocks) {
    const clean = blk.trim();
    if (!clean) continue;

    const isBold = /<(?:strong|b)\b[^>]*>[\s\S]*?<\/(?:strong|b)>/i.test(clean);
    const isUnderline = /<u\b[^>]*>[\s\S]*?<\/u>/i.test(clean);
    const isRed = /color:\s*(?:red|#ff0000|#c00000)/i.test(clean);
    const textOnly = clean.replace(/<[^>]+>/g, '').replace(/\u00A0/g, ' ').trim();

    if (textOnly) {
      lines.push({
        text: textOnly,
        segments: [{ text: textOnly, bold: isBold, underline: isUnderline, color: isRed ? 'red' : '' }],
      });
    }
  }

  return lines;
}

function extractQuestionHeader(lineText: string, currentCounter: number): { number: number; text: string } | null {
  const trimmed = (lineText || '').trim();
  if (!trimmed) return null;
  if (/^[-*_]{3,}$/.test(trimmed)) return null;

  // Pattern: Câu 1. hoặc Câu 1: hoặc Bài 1: hoặc Câu 01.
  let m = trimmed.match(/^(?:câu|cau|bài|bai)\s*(\d+)[\s.:\-–]+(.*)$/i);
  if (m) {
    const qNum = parseInt(m[1], 10);
    const qText = cleanText(m[2] || '');
    return { number: qNum, text: qText };
  }

  // Pattern: 1. Nội dung hoặc 1: Nội dung
  m = trimmed.match(/^(\d+)[\s.:)\/*\-]+(?!\s*[A-G][\s.):\/*])(.*)$/i);
  if (m) {
    const qNum = parseInt(m[1], 10);
    if (qNum === currentCounter + 1 || currentCounter === 0) {
      const qText = cleanText(m[2] || '');
      return { number: qNum, text: qText };
    }
  }

  return null;
}

interface SplitOptionItem {
  label: 'A' | 'B' | 'C' | 'D';
  content: string;
  isBold: boolean;
  isUnderline: boolean;
  hasAsterisk: boolean;
  isRed: boolean;
  contentBold: boolean;
  contentUnderline: boolean;
  prefixBold: boolean;
  prefixUnderline: boolean;
}

/**
 * Splits a line into 1 or more options if multiple options are placed horizontally on one line
 * (e.g. "A. Lựa chọn 1    B. Lựa chọn 2    C. Lựa chọn 3    D. Lựa chọn 4")
 * Supports both Bold (In đậm) and Underline (Gạch chân) — 1 trong 2 đều được!
 */
function splitLineIntoOptions(lineObj: ParsedLine): SplitOptionItem[] {
  const text = lineObj.text || '';
  if (!text.trim()) return [];

  // Primary regex: start of line or 2+ spaces/tabs before A., B., C., D.
  const optionRegex = /(?:^|\s{2,}|\t)(\s*)(?:[-*•~]?\s*(?:\*\*)?(?:\[|\()?\s*([A-D])\s*(?:\]|\))?[\s.):\/*-]+(?:\*\*)?)/gi;

  const matches: {
    optStart: number;
    prefixEnd: number;
    label: 'A' | 'B' | 'C' | 'D';
  }[] = [];
  let match: RegExpExecArray | null;

  while ((match = optionRegex.exec(text)) !== null) {
    const label = match[2].toUpperCase() as 'A' | 'B' | 'C' | 'D';
    const fullMatchStr = match[0];
    // Find exact index where the option marker (*, [, (, or A-D) begins, skipping leading spaces
    const leadingWsMatch = fullMatchStr.match(/^\s*/);
    const leadingWsLen = leadingWsMatch ? leadingWsMatch[0].length : 0;
    const optStart = match.index + leadingWsLen;
    const prefixEnd = match.index + fullMatchStr.length;

    matches.push({
      optStart,
      prefixEnd,
      label,
    });
  }

  // Fallback for single-space separated horizontal options (e.g. "A. Đáp án 1 B. Đáp án 2 C. Đáp án 3 D. Đáp án 4")
  if (matches.length === 1 && matches[0].label === 'A') {
    const singleSpaceRegex = /(?:^|\s+)(\*?([A-D])[.):]\s+)/g;
    const altMatches: typeof matches = [];
    let m2: RegExpExecArray | null;
    const expectedOrder = ['A', 'B', 'C', 'D'];
    while ((m2 = singleSpaceRegex.exec(text)) !== null) {
      const lbl = m2[2].toUpperCase() as 'A' | 'B' | 'C' | 'D';
      if (lbl === expectedOrder[altMatches.length]) {
        const leadWs = m2[0].match(/^\s*/)?.[0].length || 0;
        altMatches.push({
          optStart: m2.index + leadWs,
          prefixEnd: m2.index + m2[0].length,
          label: lbl,
        });
      }
    }
    if (altMatches.length >= 2) {
      matches.length = 0;
      matches.push(...altMatches);
    }
  }

  if (matches.length === 0) return [];

  const results: SplitOptionItem[] = [];

  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const nextStart = i + 1 < matches.length ? matches[i + 1].optStart : text.length;
    const content = cleanText(text.substring(cur.prefixEnd, nextStart));
    const optFullText = text.substring(cur.optStart, nextStart).trim();

    // Analyze segments strictly on non-whitespace characters belonging to this option
    // so trailing underlined/bolded spaces never bleed into the next option!
    let charPos = 0;
    let isBold = false;
    let isUnderline = false;
    let isRed = false;
    let contentBold = false;
    let contentUnderline = false;
    let prefixBold = false;
    let prefixUnderline = false;

    for (const seg of lineObj.segments) {
      const segStart = charPos;
      const segEnd = charPos + seg.text.length;
      charPos = segEnd;

      // Overlap with the entire option [cur.optStart, nextStart)
      const ovStart = Math.max(segStart, cur.optStart);
      const ovEnd = Math.min(segEnd, nextStart);
      if (ovEnd > ovStart) {
        const ovText = text.substring(ovStart, ovEnd).trim();
        if (ovText.length > 0) {
          if (seg.bold) isBold = true;
          if (seg.underline) isUnderline = true;
          if (seg.color === 'red') isRed = true;
        }
      }

      // Overlap with the option prefix [cur.optStart, cur.prefixEnd) (e.g. "A.")
      const prefOvStart = Math.max(segStart, cur.optStart);
      const prefOvEnd = Math.min(segEnd, cur.prefixEnd);
      if (prefOvEnd > prefOvStart) {
        const prefOvText = text.substring(prefOvStart, prefOvEnd).trim();
        if (prefOvText.length > 0) {
          if (seg.bold) prefixBold = true;
          if (seg.underline) prefixUnderline = true;
        }
      }

      // Overlap with the option content [cur.prefixEnd, nextStart)
      const contOvStart = Math.max(segStart, cur.prefixEnd);
      const contOvEnd = Math.min(segEnd, nextStart);
      if (contOvEnd > contOvStart) {
        const contOvText = text.substring(contOvStart, contOvEnd).trim();
        if (contOvText.length > 0) {
          if (seg.bold) contentBold = true;
          if (seg.underline) contentUnderline = true;
        }
      }
    }

    const hasAsterisk =
      optFullText.startsWith('*') ||
      optFullText.includes('*' + cur.label) ||
      optFullText.startsWith(cur.label + '*');

    results.push({
      label: cur.label,
      content,
      isBold,
      isUnderline,
      hasAsterisk,
      isRed,
      contentBold,
      contentUnderline,
      prefixBold,
      prefixUnderline,
    });
  }

  return results;
}

function extractQuestionsFromLines(
  lines: ParsedLine[],
  answerMap: Record<number, 'A' | 'B' | 'C' | 'D'>
): Question[] {
  const questions: Question[] = [];
  let currentQ: {
    number: number;
    textParts: string[];
    options: { A: string; B: string; C: string; D: string };
    optAttrs: Record<string, SplitOptionItem>;
    currentOptLabel: 'A' | 'B' | 'C' | 'D' | null;
  } | null = null;

  const finalizeCurrentQ = () => {
    if (!currentQ) return;

    const optKeys = (['A', 'B', 'C', 'D'] as const).filter(k => currentQ!.options[k]);
    if (optKeys.length === 0) return;

    let detectedAns: 'A' | 'B' | 'C' | 'D' | '' = '';
    const qNum = currentQ.number;
    const attrs = currentQ.optAttrs;

    // 1. Check Answer Map (Type 2: Answer sheet Table with X or bottom key table)
    if (answerMap[qNum]) {
      detectedAns = answerMap[qNum];
    }

    // 2. Check Type 1: In-line Asterisk rule (*A. or A.*)
    if (!detectedAns) {
      const astKey = optKeys.find(k => attrs[k]?.hasAsterisk);
      if (astKey) detectedAns = astKey;
    }

    // 3. Check Type 1: In-line Red / Highlight rule
    if (!detectedAns) {
      const redKeys = optKeys.filter(k => attrs[k]?.isRed);
      if (redKeys.length === 1) detectedAns = redKeys[0];
    }

    // 4. Check Type 1: GẠCH CHÂN (Underline: <u>A.</u> hoặc A. <u>Nội dung</u> hoặc <u>A. Nội dung</u>)
    if (!detectedAns) {
      const uKeys = optKeys.filter(k => attrs[k]?.isUnderline);
      if (uKeys.length === 1) {
        detectedAns = uKeys[0];
      } else if (uKeys.length > 1) {
        const contUKeys = optKeys.filter(k => attrs[k]?.contentUnderline);
        if (contUKeys.length === 1) {
          detectedAns = contUKeys[0];
        } else {
          const prefUKeys = optKeys.filter(k => attrs[k]?.prefixUnderline);
          if (prefUKeys.length === 1) detectedAns = prefUKeys[0];
        }
      }
    }

    // 5. Check Type 1: IN ĐẬM PHẦN NỘI DUNG (Content Bold: A. <b>Nội dung</b> hoặc <b>A. Nội dung</b> khi B., C., D. chỉ in đậm chữ cái đầu)
    if (!detectedAns) {
      const contentBoldKeys = optKeys.filter(k => attrs[k]?.contentBold);
      if (contentBoldKeys.length === 1) {
        detectedAns = contentBoldKeys[0];
      }
    }

    // 6. Check Type 1: IN ĐẬM CHỮ CÁI ĐẦU HOẶC TOÀN PHƯƠNG ÁN (Option Bold: <b>A.</b> Nội dung khi B., C., D. không in đậm)
    if (!detectedAns) {
      const boldKeys = optKeys.filter(k => attrs[k]?.isBold);
      if (boldKeys.length === 1) {
        detectedAns = boldKeys[0];
      } else if (boldKeys.length > 1 && boldKeys.length < 4) {
        const prefBoldKeys = optKeys.filter(k => attrs[k]?.prefixBold);
        if (prefBoldKeys.length === 1) {
          detectedAns = prefBoldKeys[0];
        } else {
          const uInBold = boldKeys.filter(k => attrs[k]?.isUnderline);
          if (uInBold.length === 1) detectedAns = uInBold[0];
        }
      }
    }

    questions.push({
      id: questions.length + 1,
      originalNumber: qNum,
      text: cleanText(currentQ.textParts.join(' ')),
      options: currentQ.options,
      correctAnswer: detectedAns,
    });

    currentQ = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const text = line.text.trim();
    if (!text) continue;

    // Skip school headers & footers
    if (
      text.includes('BỘ GIÁO DỤC') ||
      text.includes('CỘNG HÒA XÃ HỘI') ||
      text.includes('TRƯỜNG ĐẠI HỌC') ||
      text.includes('PHIẾU TRẢ LỜI') ||
      text.includes('Cán bộ chấm thi') ||
      text.includes('DUYỆT BỘ MÔN') ||
      text.includes('GIẢNG VIÊN BIÊN SOẠN') ||
      text.includes('-----Hết-----')
    ) {
      continue;
    }

    // Check Question Header
    const qHeader = extractQuestionHeader(text, questions.length);
    if (qHeader) {
      finalizeCurrentQ();

      currentQ = {
        number: qHeader.number,
        textParts: [qHeader.text],
        options: { A: '', B: '', C: '', D: '' },
        optAttrs: {},
        currentOptLabel: null,
      };
      continue;
    }

    // Check Options
    if (currentQ) {
      const optionsFound = splitLineIntoOptions(line);
      if (optionsFound.length > 0) {
        optionsFound.forEach(opt => {
          currentQ!.currentOptLabel = opt.label;
          currentQ!.options[opt.label] = opt.content;
          currentQ!.optAttrs[opt.label] = opt;
        });
      } else if (currentQ.currentOptLabel) {
        const lbl = currentQ.currentOptLabel;
        currentQ.options[lbl] += ' ' + text;
        const existingAttr = currentQ.optAttrs[lbl];
        if (existingAttr) {
          for (const seg of line.segments) {
            if (seg.text.trim().length > 0) {
              if (seg.bold) {
                existingAttr.isBold = true;
                existingAttr.contentBold = true;
              }
              if (seg.underline) {
                existingAttr.isUnderline = true;
                existingAttr.contentUnderline = true;
              }
              if (seg.color === 'red') {
                existingAttr.isRed = true;
              }
            }
          }
        }
      } else {
        currentQ.textParts.push(text);
      }
    }
  }

  finalizeCurrentQ();
  return questions;
}

/**
 * Extract exam metadata (only subject - as instructed by user)
 */
function extractMetadataFromLines(lines: ParsedLine[]): Partial<ExamMetadata> {
  const meta: Partial<ExamMetadata> = {
    university: 'TRƯỜNG ĐẠI HỌC CỬU LONG',
    subject: '',
    examCode: '101',
  };

  const topText = lines.slice(0, 25).map(l => l.text).join('\n');
  const subjectMatch = topText.match(/Môn(?:\s+thi)?\s*[:：]\s*([^\n\r(]+)/i);
  if (subjectMatch && subjectMatch[1]) meta.subject = cleanText(subjectMatch[1]);

  return meta;
}

/**
 * Extract trailing answer key table (e.g. 1-A, 2-B, 3-C...)
 */
function extractTrailingAnswerKeyFromLines(lines: ParsedLine[]): Record<number, 'A' | 'B' | 'C' | 'D'> {
  const map: Record<number, 'A' | 'B' | 'C' | 'D'> = {};
  const tailText = lines.slice(-40).map(l => l.text).join('\n');

  const keyMatch = tailText.match(/(?:Đáp án|Bảng đáp án|Answer Key|Key)[:\s]*([\s\S]*)$/i);
  const textToScan = keyMatch ? keyMatch[1] : tailText;

  for (const match of textToScan.matchAll(/(?:Câu\s*)?(\d+)[\s.:\/-]+([A-D])(?:\b|\.|\s|$)/gi)) {
    const qNum = parseInt(match[1], 10);
    const ans = match[2].toUpperCase() as 'A' | 'B' | 'C' | 'D';
    if (qNum > 0 && qNum <= 200) {
      map[qNum] = ans;
    }
  }

  return map;
}
