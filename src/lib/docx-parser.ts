import JSZip from 'jszip';
import { Question, ExamMetadata } from '@/types/exam';
import { parseDocxWithMammoth, parseHtmlQuiz } from './mammoth-parser';

export { parseHtmlQuiz };

/**
 * Universal Word docx parser combining Direct XML Run-Level Parser (<w:r> Bold/Underline/Color)
 * + Mammoth conversion (Dzota engine) so 100% of Bold (In đậm) OR Underline (Gạch chân)
 * answers are accurately detected.
 */
export async function parseDocxFile(file: File | ArrayBuffer): Promise<{
  questions: Question[];
  metadata: Partial<ExamMetadata>;
  rawText: string;
}> {
  let arrayBuffer: ArrayBuffer;

  if (file instanceof File) {
    arrayBuffer = await file.arrayBuffer();
  } else {
    arrayBuffer = file;
  }

  let xmlResult: {
    questions: Question[];
    metadata: Partial<ExamMetadata>;
    rawText: string;
  } | null = null;

  // Strategy 1: Direct word/document.xml run-by-run parser (Preserves 100% of <w:u> underline, <w:b> bold, <w:tab/>, and <w:tbl>)
  try {
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(arrayBuffer);
    const documentXmlFile = zipContent.file('word/document.xml');
    if (documentXmlFile) {
      const documentXml = await documentXmlFile.async('text');
      xmlResult = parseWordXmlDirect(documentXml);
    }
  } catch (err) {
    console.warn('Direct XML parser warning:', err);
  }

  // Strategy 2: Mammoth HTML parser
  let mammothResult: {
    questions: Question[];
    metadata: Partial<ExamMetadata>;
    rawText: string;
  } | null = null;
  try {
    mammothResult = await parseDocxWithMammoth(arrayBuffer);
  } catch (err) {
    console.warn('Mammoth parser warning:', err);
  }

  // Merge both strategies: pick the one with more questions, and fill in any missing correctAnswer from the other!
  if (xmlResult && mammothResult) {
    const base =
      xmlResult.questions.length >= mammothResult.questions.length
        ? xmlResult
        : mammothResult;
    const secondary = base === xmlResult ? mammothResult : xmlResult;

    const mergedQuestions = base.questions.map((q, idx) => {
      if (q.correctAnswer) return q;
      const matchByNum =
        secondary.questions.find(sq => sq.originalNumber === q.originalNumber && sq.correctAnswer) ||
        secondary.questions[idx];
      if (matchByNum?.correctAnswer) {
        return { ...q, correctAnswer: matchByNum.correctAnswer };
      }
      return q;
    });

    return {
      questions: mergedQuestions,
      metadata: { ...secondary.metadata, ...base.metadata },
      rawText: base.rawText || secondary.rawText,
    };
  }

  if (xmlResult && xmlResult.questions.length > 0) return xmlResult;
  if (mammothResult && mammothResult.questions.length > 0) return mammothResult;

  throw new Error('Không thể đọc dữ liệu câu hỏi từ file Word này. Vui lòng kiểm tra định dạng .docx.');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function isRunBold(rPrXml: string): boolean {
  if (!rPrXml) return false;
  if (/<w:b(?:\s+w:val="(?:0|false|off)")?\s*\/>/i.test(rPrXml)) {
    if (/<w:b\s+w:val="(?:0|false|off)"/i.test(rPrXml)) return false;
  }
  return /<w:b(?:\s+[^>]*w:val="(?:true|1|on)")?\s*\/>|<w:b\/>|<w:bCs(?:\s+[^>]*w:val="(?:true|1|on)")?\s*\/>|<w:bCs\/>/i.test(
    rPrXml
  );
}

function isRunUnderline(rPrXml: string): boolean {
  if (!rPrXml) return false;
  if (/<w:u\s+[^>]*w:val="(?:none|0|false|off)"/i.test(rPrXml)) return false;
  return /<w:u(?:\s+[^>]*)?\/>|<w:u(?:\s+[^>]*)?>/i.test(rPrXml);
}

function isRunRedOrHighlighted(rPrXml: string): boolean {
  if (!rPrXml) return false;
  if (/<w:highlight\s+[^>]*w:val="(?!none)[^"]+"/i.test(rPrXml)) return true;
  const colorMatch = rPrXml.match(/<w:color\s+[^>]*w:val="([^"]+)"/i);
  if (colorMatch) {
    const c = colorMatch[1].toUpperCase();
    // Red / Dark Red / Orange-Red shades commonly used to mark answers
    if (
      c === 'RED' ||
      c === 'FF0000' ||
      c === 'C00000' ||
      c === 'EE0000' ||
      c === 'CC0000' ||
      c === 'FF3300' ||
      c === 'E3242B'
    ) {
      return true;
    }
  }
  return false;
}

function convertParagraphXmlToHtml(pXml: string): string {
  // Check paragraph-level default run properties (<w:pPr><w:rPr>)
  const pPrMatch = pXml.match(/<w:pPr>([\s\S]*?)<\/w:pPr>/);
  const pRPrMatch = pPrMatch ? pPrMatch[1].match(/<w:rPr>([\s\S]*?)<\/w:rPr>/) : null;
  const pLevelRPr = pRPrMatch ? pRPrMatch[1] : '';

  // Also check if paragraph is a numbered list item (<w:numPr>)
  const rRegex = /<w:r[\s>][\s\S]*?<\/w:r>/g;
  const runs = [...pXml.matchAll(rRegex)].map(m => m[0]);

  if (runs.length === 0) {
    // Fallback if text is directly inside paragraph without standard <w:r>
    const tMatches = [...pXml.matchAll(/<w:t(?:[^>]*)>([\s\S]*?)<\/w:t>/g)];
    const raw = tMatches.map(m => m[1] || '').join('').trim();
    return raw ? `<p>${escapeHtml(raw)}</p>` : '';
  }

  let htmlParts = '';

  for (const rXml of runs) {
    const rPrMatch = rXml.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/);
    const rPr = (pLevelRPr + ' ' + (rPrMatch ? rPrMatch[1] : '')).trim();

    const bold = isRunBold(rPr);
    const underline = isRunUnderline(rPr);
    const red = isRunRedOrHighlighted(rPr);

    // Extract text and tabs in order inside this run
    const tokenRegex = /<w:t(?:[^>]*)>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br\s*\/>/g;
    let runText = '';
    let hasLineBreak = false;
    let tok: RegExpExecArray | null;

    while ((tok = tokenRegex.exec(rXml)) !== null) {
      if (tok[0].startsWith('<w:tab')) {
        runText += '    ';
      } else if (tok[0].startsWith('<w:br')) {
        hasLineBreak = true;
        runText += '\n';
      } else {
        runText += tok[1] || '';
      }
    }

    if (!runText) continue;

    const pieces = hasLineBreak ? runText.split('\n') : [runText];
    const formattedPieces = pieces.map(piece => {
      if (!piece) return '';
      let out = escapeHtml(piece);
      if (underline) out = `<u>${out}</u>`;
      if (bold) out = `<strong>${out}</strong>`;
      if (red) out = `<span style="color:red">${out}</span>`;
      return out;
    });

    htmlParts += formattedPieces.join('<br/>');
  }

  if (!htmlParts.trim()) return '';
  return `<p>${htmlParts}</p>`;
}

function parseWordXmlDirect(xmlStr: string): {
  questions: Question[];
  metadata: Partial<ExamMetadata>;
  rawText: string;
} {
  // Extract top-level tables (<w:tbl>) and paragraphs (<w:p>) in document order
  const blockRegex = /<w:tbl[\s>][\s\S]*?<\/w:tbl>|<w:p[\s>][\s\S]*?<\/w:p>/g;
  const blocks = [...xmlStr.matchAll(blockRegex)].map(m => m[0]);

  const htmlBlocks: string[] = [];

  for (const blk of blocks) {
    if (blk.startsWith('<w:tbl')) {
      const trMatches = [...blk.matchAll(/<w:tr[\s>][\s\S]*?<\/w:tr>/g)].map(m => m[0]);
      const rowsHtml: string[] = [];
      for (const tr of trMatches) {
        const tcMatches = [...tr.matchAll(/<w:tc[\s>][\s\S]*?<\/w:tc>/g)].map(m => m[0]);
        const cellsHtml: string[] = [];
        for (const tc of tcMatches) {
          const pInCell = [...tc.matchAll(/<w:p[\s>][\s\S]*?<\/w:p>/g)].map(m => m[0]);
          const cellInner = pInCell.map(convertParagraphXmlToHtml).join('');
          cellsHtml.push(`<td>${cellInner}</td>`);
        }
        rowsHtml.push(`<tr>${cellsHtml.join('')}</tr>`);
      }
      htmlBlocks.push(`<table>${rowsHtml.join('')}</table>`);
      // Also emit paragraphs inside table cells that might contain questions/options formatted inside a layout table
      const pInTable = [...blk.matchAll(/<w:p[\s>][\s\S]*?<\/w:p>/g)].map(m => m[0]);
      for (const p of pInTable) {
        const pHtml = convertParagraphXmlToHtml(p);
        if (pHtml && /(?:câu|cau|\b[A-D]\s*[.):])/i.test(pHtml)) {
          htmlBlocks.push(pHtml);
        }
      }
    } else {
      const pHtml = convertParagraphXmlToHtml(blk);
      if (pHtml) htmlBlocks.push(pHtml);
    }
  }

  return parseHtmlQuiz(htmlBlocks.join('\n'));
}

export function parsePlainTextExam(text: string): {
  questions: Question[];
  metadata: Partial<ExamMetadata>;
} {
  const lines = text
    .split(/\r?\n/)
    .map(l => {
      let line = l.trim();
      if (!line) return '';
      const isBold = /\*\*[A-D]\.|\<strong\>[A-D]\.|\<b\>[A-D]\./i.test(line);
      const isUnderline = /<u>[A-D]\.|\_[A-D]\./i.test(line);
      line = line.replace(/\*\*|\<strong\>|\<\/strong\>|\<b\>|\<\/b\>|<u>|<\/u>/g, '');
      let htmlLine = line;
      if (isUnderline) htmlLine = `<u>${htmlLine}</u>`;
      if (isBold) htmlLine = `<strong>${htmlLine}</strong>`;
      return `<p>${htmlLine}</p>`;
    })
    .join('');

  return parseHtmlQuiz(lines);
}
