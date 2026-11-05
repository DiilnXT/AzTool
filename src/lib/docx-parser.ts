import JSZip from 'jszip';
import { Question, ExamMetadata } from '@/types/exam';
import { parseDocxWithMammoth, parseHtmlQuiz } from './mammoth-parser';

export { parseHtmlQuiz };

/**
 * Universal Word docx parser combining Mammoth conversion (Dzota engine) + Raw XML run parser
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

  // Strategy 1: Mammoth + Dzota Parser (100% accurate bold, underline, color, line detection)
  try {
    const mammothResult = await parseDocxWithMammoth(arrayBuffer);
    if (mammothResult.questions.length > 0) {
      return mammothResult;
    }
  } catch (err) {
    console.warn('Mammoth parser warning, falling back to raw XML:', err);
  }

  // Strategy 2: Direct word/document.xml zip parser (Fallback)
  const zip = new JSZip();
  const zipContent = await zip.loadAsync(arrayBuffer);

  const documentXmlFile = zipContent.file('word/document.xml');
  if (!documentXmlFile) {
    throw new Error('File không đúng định dạng Word .docx (không tìm thấy word/document.xml)');
  }

  const documentXml = await documentXmlFile.async('text');
  return parseWordXmlDirect(documentXml);
}

function parseWordXmlDirect(xmlStr: string): {
  questions: Question[];
  metadata: Partial<ExamMetadata>;
  rawText: string;
} {
  // Simple extraction
  const pRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  const pMatches = [...xmlStr.matchAll(pRegex)].map(m => m[0]);

  const lines = pMatches.map(p => {
    const tRegex = /<w:t(?:[^>]*)>([\s\S]*?)<\/w:t>/g;
    let text = '';
    let m: RegExpExecArray | null;
    while ((m = tRegex.exec(p)) !== null) {
      text += m[1] || '';
    }
    const isBold = /<w:b(?:\s+[^>]*w:val="(?:true|1)")?\s*\/>|<w:b\/>|<w:bCs\/>/i.test(p);
    const isUnderline = /<w:u[\s\S]*?\/>/i.test(p) && !/<w:u\s+w:val="none"\s*\/>/i.test(p);
    return {
      text: text.trim(),
      segments: [{ text: text.trim(), bold: isBold, underline: isUnderline, color: '' }],
    };
  }).filter(l => l.text.length > 0);

  // Use Dzota line parser
  const html = lines.map(l => {
    let t = l.text;
    if (l.segments[0].underline) t = `<u>${t}</u>`;
    if (l.segments[0].bold) t = `<strong>${t}</strong>`;
    return `<p>${t}</p>`;
  }).join('');

  return parseHtmlQuiz(html);
}

export function parsePlainTextExam(text: string): {
  questions: Question[];
  metadata: Partial<ExamMetadata>;
} {
  const lines = text.split(/\r?\n/).map(l => {
    let line = l.trim();
    if (!line) return '';
    const isBold = /\*\*[A-D]\.|\<strong\>[A-D]\.|\<b\>[A-D]\./i.test(line);
    const isUnderline = /<u>[A-D]\.|\_[A-D]\./i.test(line);
    line = line.replace(/\*\*|\<strong\>|\<\/strong\>|\<b\>|\<\/b\>|<u>|<\/u>/g, '');
    let htmlLine = line;
    if (isUnderline) htmlLine = `<u>${htmlLine}</u>`;
    if (isBold) htmlLine = `<strong>${htmlLine}</strong>`;
    return `<p>${htmlLine}</p>`;
  }).join('');

  return parseHtmlQuiz(lines);
}
