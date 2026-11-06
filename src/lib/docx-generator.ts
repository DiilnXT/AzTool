import { Question, ExamMetadata } from '@/types/exam';
import { injectIntoTemplateDocx, injectMultipleExamsIntoSingleDocx } from './template-injector';

let cachedTemplateBuffer: ArrayBuffer | null = null;

/**
 * Fetch or load the official MAU_DE_THI_tracnghiem.docx template
 */
async function getOfficialTemplateBuffer(): Promise<ArrayBuffer> {
  if (cachedTemplateBuffer) {
    return cachedTemplateBuffer;
  }

  // If in browser, fetch from public/template/MAU_DE_THI_tracnghiem.docx
  if (typeof window !== 'undefined') {
    const res = await fetch('/template/MAU_DE_THI_tracnghiem.docx');
    if (!res.ok) {
      throw new Error(`Không tải được template mẫu (${res.status})`);
    }
    const buf = await res.arrayBuffer();
    cachedTemplateBuffer = buf;
    return buf;
  } else {
    // If in Node.js
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(process.cwd(), 'public', 'template', 'MAU_DE_THI_tracnghiem.docx');
    const fileBuf = fs.readFileSync(filePath);
    const arrayBuf = fileBuf.buffer.slice(fileBuf.byteOffset, fileBuf.byteOffset + fileBuf.byteLength) as ArrayBuffer;
    cachedTemplateBuffer = arrayBuf;
    return arrayBuf;
  }
}

/**
 * Allows the teacher to upload their own custom template file to use as the base
 */
export function setCustomTemplate(buffer: ArrayBuffer) {
  cachedTemplateBuffer = buffer;
}

/**
 * Generate a Word .docx document using the direct official template MAU_DE_THI_tracnghiem.docx
 */
export async function generateStandardDocx(
  metadata: ExamMetadata,
  questions: Question[],
  hasAnswers: boolean = false,
  customExamCode?: string
): Promise<Blob> {
  const templateBuffer = await getOfficialTemplateBuffer();

  return await injectIntoTemplateDocx(
    templateBuffer,
    metadata,
    questions,
    hasAnswers,
    customExamCode
  );
}

/**
 * Generate a single combined Word (.docx) document containing all mixed exam codes
 * so teachers on mobile phones can open all mixed exams directly in Microsoft Word
 * without needing to extract a .zip file.
 */
export async function generateCombinedMixedDocx(
  metadata: ExamMetadata,
  exams: { code: string; questions: Question[] }[],
  hasAnswers: boolean = false
): Promise<Blob> {
  const templateBuffer = await getOfficialTemplateBuffer();
  return await injectMultipleExamsIntoSingleDocx(templateBuffer, metadata, exams, hasAnswers);
}
