'use client';

/**
 * AzTool PDF & Office Studio Core Engine (services/pdf_editor + Office Converter)
 * Implements 13 real document conversion & deep PDF editing capabilities:
 *  1. convert_pdf_to_docx
 *  2. convert_word_to_pdf
 *  3. convert_excel_to_pdf
 *  4. convert_ppt_to_pdf
 *  5. convert_pdf_to_pptx
 *  6. rotate_pdf_pages
 *  7. delete_pdf_pages
 *  8. add_pdf_page_numbers
 *  9. crop_pdf_margins
 * 10. split_pdf_by_count
 * 11. merge_pdf_files
 * 12. split_pdf_file
 * 13. compress_pdf_file & extract_images_from_pdf
 */

import { PDFDocument, degrees } from 'pdf-lib';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ImageRun,
  AlignmentType,
  PageBreak,
} from 'docx';

export type ProgressCallback = (title: string, subtitle?: string, progress?: number) => void;

/**
 * Dynamically loads pdfjs-dist in browser and configures local worker
 */
async function getPdfJs() {
  const pdfjsLib = await import('pdfjs-dist');
  if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  }
  return pdfjsLib;
}

/**
 * Parses a human-friendly page range string (e.g., "ALL", "EVEN", "ODD", "1, 3, 5-8")
 * into a sorted array of 1-based page numbers within [1..totalPages].
 */
export function parsePageSelection(input: string, totalPages: number): number[] {
  const clean = (input || 'ALL').trim().toUpperCase();
  if (!clean || clean === 'ALL' || clean === 'TATCA' || clean === '*') {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (clean === 'EVEN' || clean === 'CHAN') {
    return Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p % 2 === 0);
  }
  if (clean === 'ODD' || clean === 'LE') {
    return Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p % 2 === 1);
  }

  const pagesSet = new Set<number>();
  const parts = clean.split(/[,;]+/);
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (trimmed.includes('-')) {
      const [startStr, endStr] = trimmed.split('-');
      const start = parseInt(startStr.trim(), 10);
      const end = parseInt(endStr.trim(), 10);
      if (!isNaN(start) && !isNaN(end)) {
        const minP = Math.max(1, Math.min(start, end));
        const maxP = Math.min(totalPages, Math.max(start, end));
        for (let p = minP; p <= maxP; p++) {
          pagesSet.add(p);
        }
      }
    } else {
      const p = parseInt(trimmed, 10);
      if (!isNaN(p) && p >= 1 && p <= totalPages) {
        pagesSet.add(p);
      }
    }
  }

  const result = Array.from(pagesSet).sort((a, b) => a - b);
  return result.length > 0 ? result : Array.from({ length: totalPages }, (_, i) => i + 1);
}

/**
 * Quick helper to get total pages of a PDF file
 */
export async function getPdfPageCount(file: File): Promise<number> {
  const buf = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
  return pdfDoc.getPageCount();
}

/**
 * Helper to convert Canvas DataURL to Uint8Array
 */
function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] || '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ============================================================================
// 1. PDF SANG WORD .DOCX (convert_pdf_to_docx)
// ============================================================================

interface ExtractedTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  bold: boolean;
}

export async function convertPdfToDocx(
  file: File,
  pageRangeStr = 'ALL',
  includeVisualSnapshot = false,
  onProgress?: ProgressCallback
): Promise<{ blob: Blob; pagesProcessed: number }> {
  onProgress?.('Đang đọc cấu trúc file PDF...', file.name, 10);
  const pdfjsLib = await getPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;
  const targetPages = parsePageSelection(pageRangeStr, totalPages);

  const docChildren: (Paragraph | Table)[] = [];

  for (let idx = 0; idx < targetPages.length; idx++) {
    const pageNum = targetPages[idx];
    const pct = Math.round(15 + ((idx + 1) / targetPages.length) * 75);
    onProgress?.(
      `Đang phục hồi cấu trúc Trang ${pageNum}/${totalPages}...`,
      'Trích xuất văn bản, tọa độ dòng, bảng biểu và hình ảnh sang Word .docx',
      pct
    );

    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent();

    const items: ExtractedTextItem[] = [];
    for (const rawItem of textContent.items as any[]) {
      const str = (rawItem.str || '').replace(/\u0000/g, '');
      if (!str.trim()) continue;
      const tx = rawItem.transform || [12, 0, 0, 12, 0, 0];
      const x = Number(tx[4]) || 0;
      const y = Number(tx[5]) || 0;
      const fontSize = Math.max(8, Math.min(36, Math.round(Math.hypot(tx[0], tx[1]) || 12)));
      const fontName = String(rawItem.fontName || '').toLowerCase();
      items.push({
        str,
        x,
        y,
        width: Number(rawItem.width) || str.length * (fontSize * 0.5),
        height: Number(rawItem.height) || fontSize,
        fontSize,
        bold: fontName.includes('bold') || fontName.includes('black') || fontSize >= 15,
      });
    }

    // Group items into horizontal lines by Y coordinate (tolerance: 4.5pt)
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    const lines: { y: number; items: ExtractedTextItem[] }[] = [];

    for (const item of items) {
      const existingLine = lines.find(l => Math.abs(l.y - item.y) <= 4.5);
      if (existingLine) {
        existingLine.items.push(item);
      } else {
        lines.push({ y: item.y, items: [item] });
      }
    }

    // Sort items left-to-right within each line
    for (const line of lines) {
      line.items.sort((a, b) => a.x - b.x);
    }

    // Detect whether lines have multiple distinct columns (table structure) vs paragraphs
    let lineIdx = 0;
    while (lineIdx < lines.length) {
      const currentLine = lines[lineIdx];

      // Check if current line and next line look like a multi-column table row (separated by wide X gaps > 28pt)
      const getColumns = (ln: { items: ExtractedTextItem[] }) => {
        const cols: { x: number; text: string; bold: boolean }[] = [];
        let curX = ln.items[0]?.x || 0;
        let lastRight = curX;
        let curText = '';
        let curBold = false;

        for (let i = 0; i < ln.items.length; i++) {
          const it = ln.items[i];
          if (i > 0 && it.x - lastRight > 28) {
            cols.push({ x: curX, text: curText.trim(), bold: curBold });
            curX = it.x;
            curText = it.str;
            curBold = it.bold;
          } else {
            const gap = i > 0 ? it.x - lastRight : 0;
            curText += (gap > 2.5 && !curText.endsWith(' ') ? ' ' : '') + it.str;
            curBold = curBold || it.bold;
          }
          lastRight = it.x + it.width;
        }
        if (curText.trim()) {
          cols.push({ x: curX, text: curText.trim(), bold: curBold });
        }
        return cols;
      };

      const cols = getColumns(currentLine);
      if (cols.length >= 2 && lineIdx + 1 < lines.length) {
        const nextCols = getColumns(lines[lineIdx + 1]);
        if (nextCols.length === cols.length && cols.length <= 6) {
          // Collect consecutive rows with the same column count into a real Word Table
          const tableRowsData: { x: number; text: string; bold: boolean }[][] = [cols];
          let lookahead = lineIdx + 1;
          while (lookahead < lines.length) {
            const c = getColumns(lines[lookahead]);
            if (c.length === cols.length) {
              tableRowsData.push(c);
              lookahead++;
            } else {
              break;
            }
          }

          const colPercent = Math.floor(100 / cols.length);
          const wordRows = tableRowsData.map(rowCols => {
            return new TableRow({
              children: rowCols.map(cell => {
                return new TableCell({
                  width: { size: colPercent, type: WidthType.PERCENTAGE },
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: cell.text,
                          bold: cell.bold,
                          font: 'Times New Roman',
                          size: 24,
                        }),
                      ],
                    }),
                  ],
                });
              }),
            });
          });

          docChildren.push(
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: wordRows,
            })
          );
          lineIdx = lookahead;
          continue;
        }
      }

      // Standard paragraph with coordinate-based left indentation
      let lineText = '';
      let lastEnd = currentLine.items[0]?.x || 0;
      let maxFontSize = 12;
      let isBoldLine = false;

      for (let i = 0; i < currentLine.items.length; i++) {
        const it = currentLine.items[i];
        const gap = i > 0 ? it.x - lastEnd : 0;
        lineText += (gap > 2.2 && !lineText.endsWith(' ') ? ' ' : '') + it.str;
        lastEnd = it.x + it.width;
        if (it.fontSize > maxFontSize) maxFontSize = it.fontSize;
        if (it.bold) isBoldLine = true;
      }

      const firstX = currentLine.items[0]?.x || 40;
      const relativeLeftPt = Math.max(0, firstX - 45);
      const isCentered =
        firstX > viewport.width * 0.22 &&
        lastEnd < viewport.width * 0.78 &&
        lineText.length < 85;

      docChildren.push(
        new Paragraph({
          alignment: isCentered ? AlignmentType.CENTER : AlignmentType.LEFT,
          indent:
            !isCentered && relativeLeftPt > 18
              ? { left: Math.min(2800, Math.round(relativeLeftPt * 15)) }
              : undefined,
          spacing: { after: 120, line: 276 },
          children: [
            new TextRun({
              text: lineText.trim(),
              bold: isBoldLine,
              font: 'Times New Roman',
              size: Math.max(22, Math.min(36, Math.round(maxFontSize * 2))),
            }),
          ],
        })
      );

      lineIdx++;
    }

    // If page had zero extractable text (scanned PDF page) OR user requested visual figure preservation
    if (items.length === 0 || includeVisualSnapshot) {
      const renderViewport = page.getViewport({ scale: 1.65 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(renderViewport.width);
      canvas.height = Math.round(renderViewport.height);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        await page.render({ canvasContext: ctx, viewport: renderViewport, canvas } as any).promise;
        const imgBytes = dataUrlToUint8Array(canvas.toDataURL('image/png'));
        const targetWidth = 560;
        const targetHeight = Math.round((canvas.height / canvas.width) * targetWidth);

        docChildren.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 120, after: 160 },
            children: [
              new ImageRun({
                data: imgBytes,
                transformation: { width: targetWidth, height: targetHeight },
                type: 'png',
              }),
            ],
          })
        );
      }
    }

    if (idx < targetPages.length - 1) {
      docChildren.push(
        new Paragraph({
          children: [new PageBreak()],
        })
      );
    }
  }

  onProgress?.('Đang đóng gói tài liệu Word (.docx)...', file.name, 95);

  const doc = new Document({
    sections: [
      {
        properties: {},
        children:
          docChildren.length > 0
            ? docChildren
            : [
                new Paragraph({
                  children: [new TextRun({ text: 'Tài liệu trống', font: 'Times New Roman', size: 24 })],
                }),
              ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  return { blob, pagesProcessed: targetPages.length };
}

// ============================================================================
// 2. WORD SANG PDF (convert_word_to_pdf)
// ============================================================================

/**
 * Helper to wrap text into lines that fit within maxWidth on a 2D Canvas
 */
function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.length > 0 ? lines : [''];
}

export async function convertWordToPdf(
  file: File,
  onProgress?: ProgressCallback
): Promise<{ blob: Blob; pagesCount: number }> {
  onProgress?.('Đang đọc định dạng gốc file Word...', file.name, 15);
  const arrayBuffer = await file.arrayBuffer();

  // Extract structured HTML (preserving tables, headings, bold/italic, images) via Mammoth
  const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlResult.value || '';

  // High-DPI A4 Canvas dimensions (2x print quality: 1190 x 1684 px -> 595 x 842 pt)
  const PAGE_W = 1190;
  const PAGE_H = 1684;
  const MARGIN_X = 110;
  const MARGIN_TOP = 110;
  const MARGIN_BOTTOM = 110;
  const CONTENT_W = PAGE_W - MARGIN_X * 2;

  const canvases: HTMLCanvasElement[] = [];
  let currentCanvas = document.createElement('canvas');
  currentCanvas.width = PAGE_W;
  currentCanvas.height = PAGE_H;
  let ctx = currentCanvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);
  canvases.push(currentCanvas);

  let cursorY = MARGIN_TOP;

  const startNewPage = () => {
    currentCanvas = document.createElement('canvas');
    currentCanvas.width = PAGE_W;
    currentCanvas.height = PAGE_H;
    ctx = currentCanvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);
    canvases.push(currentCanvas);
    cursorY = MARGIN_TOP;
  };

  const nodes = Array.from(tempDiv.children);
  if (nodes.length === 0 && tempDiv.textContent?.trim()) {
    const p = document.createElement('p');
    p.textContent = tempDiv.textContent;
    nodes.push(p);
  }

  onProgress?.('Đang dàn trang in ấn PDF độ nét cao...', 'Giữ nguyên 100% font chữ tiếng Việt và bảng biểu', 45);

  for (const el of nodes) {
    const tag = el.tagName.toLowerCase();

    if (tag === 'table') {
      const rows = Array.from(el.querySelectorAll('tr'));
      if (rows.length === 0) continue;
      const maxCols = Math.max(
        1,
        ...rows.map(r => r.querySelectorAll('td, th').length)
      );
      const colW = CONTENT_W / maxCols;

      for (let rIdx = 0; rIdx < rows.length; rIdx++) {
        const cells = Array.from(rows[rIdx].querySelectorAll('td, th'));
        const isHeaderRow = rIdx === 0 || cells.some(c => c.tagName.toLowerCase() === 'th');
        ctx.font = `${isHeaderRow ? 'bold ' : ''}22px "Times New Roman", serif`;

        const wrappedCells = cells.map(c =>
          wrapCanvasText(ctx, (c.textContent || '').trim(), colW - 20)
        );
        const maxLines = Math.max(1, ...wrappedCells.map(lines => lines.length));
        const rowH = maxLines * 30 + 20;

        if (cursorY + rowH > PAGE_H - MARGIN_BOTTOM) {
          startNewPage();
          ctx.font = `${isHeaderRow ? 'bold ' : ''}22px "Times New Roman", serif`;
        }

        for (let cIdx = 0; cIdx < maxCols; cIdx++) {
          const cellX = MARGIN_X + cIdx * colW;
          if (isHeaderRow) {
            ctx.fillStyle = '#f3f4f6';
            ctx.fillRect(cellX, cursorY, colW, rowH);
          }
          ctx.strokeStyle = '#6b7280';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(cellX, cursorY, colW, rowH);

          ctx.fillStyle = '#111827';
          const cellLines = wrappedCells[cIdx] || [''];
          cellLines.forEach((ln, lIdx) => {
            ctx.fillText(ln, cellX + 10, cursorY + 28 + lIdx * 30);
          });
        }
        cursorY += rowH;
      }
      cursorY += 20;
      continue;
    }

    // Check for embedded images inside paragraph
    const imgs = Array.from(el.querySelectorAll('img'));
    for (const imgEl of imgs) {
      if (imgEl.src) {
        await new Promise<void>(resolve => {
          const imageObj = new Image();
          imageObj.onload = () => {
            const drawW = Math.min(CONTENT_W, imageObj.width * 1.5);
            const drawH = (imageObj.height / Math.max(1, imageObj.width)) * drawW;
            if (cursorY + drawH > PAGE_H - MARGIN_BOTTOM) {
              startNewPage();
            }
            ctx.drawImage(
              imageObj,
              MARGIN_X + (CONTENT_W - drawW) / 2,
              cursorY,
              drawW,
              drawH
            );
            cursorY += drawH + 20;
            resolve();
          };
          imageObj.onerror = () => resolve();
          imageObj.src = imgEl.src;
        });
      }
    }

    const rawText = (el.textContent || '').trim();
    if (!rawText) continue;

    const isHeading = /^h[1-4]$/.test(tag);
    const hasBold =
      isHeading ||
      el.querySelector('strong, b') !== null ||
      /^câu\s+\d+/i.test(rawText);

    const fontSize = tag === 'h1' ? 34 : tag === 'h2' ? 29 : isHeading ? 26 : 24;
    const lineHeight = Math.round(fontSize * 1.48);

    ctx.font = `${hasBold ? 'bold ' : ''}${fontSize}px "Times New Roman", serif`;
    ctx.fillStyle = '#0f172a';

    const lines = wrapCanvasText(ctx, rawText, CONTENT_W);
    for (const ln of lines) {
      if (cursorY + lineHeight > PAGE_H - MARGIN_BOTTOM) {
        startNewPage();
        ctx.font = `${hasBold ? 'bold ' : ''}${fontSize}px "Times New Roman", serif`;
        ctx.fillStyle = '#0f172a';
      }
      ctx.fillText(ln, MARGIN_X, cursorY + fontSize);
      cursorY += lineHeight;
    }
    cursorY += 12;
  }

  onProgress?.('Đang xuất file PDF chuẩn in ấn...', `${canvases.length} trang A4`, 85);

  const pdfDoc = await PDFDocument.create();
  for (const c of canvases) {
    const jpgBytes = dataUrlToUint8Array(c.toDataURL('image/jpeg', 0.94));
    const embeddedImg = await pdfDoc.embedJpg(jpgBytes);
    const page = pdfDoc.addPage([595.28, 841.89]);
    page.drawImage(embeddedImg, {
      x: 0,
      y: 0,
      width: 595.28,
      height: 841.89,
    });
  }

  const pdfBytes = await pdfDoc.save();
  return {
    blob: new Blob([pdfBytes as any], { type: 'application/pdf' }),
    pagesCount: canvases.length,
  };
}

// ============================================================================
// 3. EXCEL SANG PDF (convert_excel_to_pdf)
// ============================================================================

export async function convertExcelToPdf(
  file: File,
  orientation: 'landscape' | 'portrait' = 'landscape',
  onProgress?: ProgressCallback
): Promise<{ blob: Blob; pagesCount: number; sheetsCount: number }> {
  onProgress?.('Đang đọc bảng tính Excel (.xlsx / .xls)...', file.name, 15);
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  const PAGE_W = orientation === 'landscape' ? 1684 : 1190;
  const PAGE_H = orientation === 'landscape' ? 1190 : 1684;
  const PDF_W = orientation === 'landscape' ? 841.89 : 595.28;
  const PDF_H = orientation === 'landscape' ? 595.28 : 841.89;
  const MARGIN = 70;
  const CONTENT_W = PAGE_W - MARGIN * 2;

  const pdfDoc = await PDFDocument.create();
  let totalPagesCreated = 0;

  for (let sIdx = 0; sIdx < workbook.SheetNames.length; sIdx++) {
    const sheetName = workbook.SheetNames[sIdx];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    // Remove completely empty trailing rows
    const nonEmptyRows = rows.filter(r => r.some(cell => String(cell ?? '').trim() !== ''));
    if (nonEmptyRows.length === 0) continue;

    onProgress?.(
      `Đang căn chỉnh Sheet "${sheetName}"...`,
      `Tự động căn vừa trang (${nonEmptyRows.length} dòng)`,
      30 + Math.round(((sIdx + 1) / workbook.SheetNames.length) * 55)
    );

    const maxCols = Math.min(
      18,
      Math.max(1, ...nonEmptyRows.map(r => r.length))
    );

    // Compute proportional column widths based on content length so columns fit the page cleanly
    const colCharWeights = Array.from({ length: maxCols }, (_, cIdx) => {
      let maxLen = 6;
      for (let r = 0; r < Math.min(nonEmptyRows.length, 60); r++) {
        const val = String(nonEmptyRows[r]?.[cIdx] ?? '').trim();
        if (val.length > maxLen) maxLen = Math.min(45, val.length);
      }
      return maxLen;
    });
    const totalWeight = colCharWeights.reduce((a, b) => a + b, 0) || 1;
    const colWidths = colCharWeights.map(w => (w / totalWeight) * CONTENT_W);

    let canvas = document.createElement('canvas');
    canvas.width = PAGE_W;
    canvas.height = PAGE_H;
    let ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);

    // Draw Sheet Title Header
    ctx.font = 'bold 26px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#1e1b4b';
    ctx.fillText(`Bảng tính: ${sheetName}`, MARGIN, MARGIN + 24);
    let cursorY = MARGIN + 48;

    const flushCanvasPage = async () => {
      const jpgBytes = dataUrlToUint8Array(canvas.toDataURL('image/jpeg', 0.94));
      const img = await pdfDoc.embedJpg(jpgBytes);
      const page = pdfDoc.addPage([PDF_W, PDF_H]);
      page.drawImage(img, { x: 0, y: 0, width: PDF_W, height: PDF_H });
      totalPagesCreated++;
    };

    for (let rIdx = 0; rIdx < nonEmptyRows.length; rIdx++) {
      const row = nonEmptyRows[rIdx];
      const isHeader = rIdx === 0;
      ctx.font = `${isHeader ? 'bold ' : ''}18px "Segoe UI", Arial, sans-serif`;

      const wrappedCols = colWidths.map((cw, cIdx) => {
        const cellText = String(row[cIdx] ?? '').trim();
        return wrapCanvasText(ctx, cellText, Math.max(40, cw - 16));
      });
      const maxLines = Math.max(1, ...wrappedCols.map(l => l.length));
      const rowH = maxLines * 24 + 16;

      if (cursorY + rowH > PAGE_H - MARGIN) {
        await flushCanvasPage();
        canvas = document.createElement('canvas');
        canvas.width = PAGE_W;
        canvas.height = PAGE_H;
        ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, PAGE_W, PAGE_H);
        cursorY = MARGIN;
        ctx.font = `${isHeader ? 'bold ' : ''}18px "Segoe UI", Arial, sans-serif`;
      }

      let curX = MARGIN;
      for (let cIdx = 0; cIdx < maxCols; cIdx++) {
        const cw = colWidths[cIdx];
        ctx.fillStyle = isHeader
          ? '#ede9fe'
          : rIdx % 2 === 1
          ? '#f8fafc'
          : '#ffffff';
        ctx.fillRect(curX, cursorY, cw, rowH);

        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(curX, cursorY, cw, rowH);

        ctx.fillStyle = isHeader ? '#3b0764' : '#0f172a';
        const lines = wrappedCols[cIdx] || [''];
        lines.forEach((ln, lIdx) => {
          ctx.fillText(ln, curX + 8, cursorY + 23 + lIdx * 24);
        });
        curX += cw;
      }
      cursorY += rowH;
    }

    await flushCanvasPage();
  }

  const pdfBytes = await pdfDoc.save();
  return {
    blob: new Blob([pdfBytes as any], { type: 'application/pdf' }),
    pagesCount: totalPagesCreated,
    sheetsCount: workbook.SheetNames.length,
  };
}

// ============================================================================
// 4. POWERPOINT SANG PDF (convert_ppt_to_pdf)
// ============================================================================

export async function convertPptToPdf(
  file: File,
  onProgress?: ProgressCallback
): Promise<{ blob: Blob; slidesCount: number }> {
  onProgress?.('Đang giải nén cấu trúc slide PowerPoint...', file.name, 15);
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  // Discover all slide XML files in numerical order
  const slideFiles = Object.keys(zip.files)
    .filter(name => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
      const numB = parseInt(b.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
      return numA - numB;
    });

  if (slideFiles.length === 0) {
    throw new Error('Không tìm thấy slide trong tệp PowerPoint này. Hãy sử dụng định dạng .pptx chuẩn.');
  }

  const pdfDoc = await PDFDocument.create();
  const SLIDE_W = 1600;
  const SLIDE_H = 900;

  for (let i = 0; i < slideFiles.length; i++) {
    const slidePath = slideFiles[i];
    const slideNum = i + 1;
    onProgress?.(
      `Đang kết xuất Slide ${slideNum}/${slideFiles.length} sang PDF...`,
      'Giữ nguyên bố cục văn bản và hình ảnh thuyết trình',
      20 + Math.round(((i + 1) / slideFiles.length) * 70)
    );

    const xmlText = await zip.file(slidePath)!.async('string');
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'application/xml');

    // Load relationship map for images on this slide
    const relPath = `ppt/slides/_rels/slide${slideNum}.xml.rels`;
    const relMap = new Map<string, string>();
    if (zip.file(relPath)) {
      const relXml = await zip.file(relPath)!.async('string');
      const relDoc = parser.parseFromString(relXml, 'application/xml');
      const relNodes = Array.from(relDoc.getElementsByTagName('Relationship'));
      for (const rNode of relNodes) {
        const id = rNode.getAttribute('Id') || '';
        const target = rNode.getAttribute('Target') || '';
        if (id && target) {
          const resolved = target.replace(/^\.\.\//, 'ppt/');
          relMap.set(id, resolved);
        }
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = SLIDE_W;
    canvas.height = SLIDE_H;
    const ctx = canvas.getContext('2d')!;

    // Subtle presentation slide background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, SLIDE_W, SLIDE_H);

    // Draw top decorative accent bar
    const grad = ctx.createLinearGradient(0, 0, SLIDE_W, 0);
    grad.addColorStop(0, '#7d2ae8');
    grad.addColorStop(1, '#00c4cc');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SLIDE_W, 8);

    // 1. Render embedded images (<p:pic>) if present
    const picNodes = Array.from(xmlDoc.getElementsByTagName('p:pic'));
    for (const pic of picNodes) {
      const blip = pic.getElementsByTagName('a:blip')[0];
      const embedId = blip?.getAttribute('r:embed') || '';
      const mediaPath = relMap.get(embedId);
      if (mediaPath && zip.file(mediaPath)) {
        const base64Img = await zip.file(mediaPath)!.async('base64');
        const ext = mediaPath.split('.').pop()?.toLowerCase() || 'png';
        const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';

        const off = pic.getElementsByTagName('a:off')[0];
        const extNode = pic.getElementsByTagName('a:ext')[0];
        // Standard PPTX EMU is 914400 per inch (12192000 x 6858000 for 16:9)
        const emuX = Number(off?.getAttribute('x') || 0);
        const emuY = Number(off?.getAttribute('y') || 0);
        const emuW = Number(extNode?.getAttribute('cx') || 0);
        const emuH = Number(extNode?.getAttribute('cy') || 0);

        const x = emuW > 0 ? (emuX / 12192000) * SLIDE_W : 100;
        const y = emuH > 0 ? (emuY / 6858000) * SLIDE_H : 120;
        const w = emuW > 0 ? (emuW / 12192000) * SLIDE_W : SLIDE_W - 200;
        const h = emuH > 0 ? (emuH / 6858000) * SLIDE_H : SLIDE_H - 220;

        await new Promise<void>(resolve => {
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, x, y, w, h);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = `data:${mime};base64,${base64Img}`;
        });
      }
    }

    // 2. Render text shapes (<p:sp>)
    const shapes = Array.from(xmlDoc.getElementsByTagName('p:sp'));
    let fallbackY = 95;

    for (let sIdx = 0; sIdx < shapes.length; sIdx++) {
      const sp = shapes[sIdx];
      const paragraphs = Array.from(sp.getElementsByTagName('a:p'));
      const linesText: string[] = [];

      for (const p of paragraphs) {
        const tNodes = Array.from(p.getElementsByTagName('a:t'));
        const pStr = tNodes.map(t => t.textContent || '').join('').trim();
        if (pStr) linesText.push(pStr);
      }

      if (linesText.length === 0) continue;

      const off = sp.getElementsByTagName('a:off')[0];
      const extNode = sp.getElementsByTagName('a:ext')[0];
      const emuX = Number(off?.getAttribute('x') || 0);
      const emuY = Number(off?.getAttribute('y') || 0);
      const emuW = Number(extNode?.getAttribute('cx') || 0);

      const boxX = emuX > 0 ? Math.max(70, (emuX / 12192000) * SLIDE_W) : 90;
      let boxY = emuY > 0 ? Math.max(70, (emuY / 6858000) * SLIDE_H) : fallbackY;
      const boxW = emuW > 0 ? Math.min(SLIDE_W - boxX - 70, (emuW / 12192000) * SLIDE_W) : SLIDE_W - 180;

      const isTitle = sIdx === 0 && boxY < 260;
      const fontSize = isTitle ? 44 : 28;
      ctx.font = `${isTitle ? 'bold ' : ''}${fontSize}px "Segoe UI", Arial, sans-serif`;
      ctx.fillStyle = isTitle ? '#1e1b4b' : '#1f2937';

      for (const para of linesText) {
        const wrapped = wrapCanvasText(ctx, para, boxW);
        for (const wLine of wrapped) {
          ctx.fillText(wLine, boxX, boxY + fontSize);
          boxY += Math.round(fontSize * 1.4);
        }
        boxY += 12;
      }

      fallbackY = Math.max(fallbackY, boxY + 25);
    }

    // Slide number badge at bottom-right
    ctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`Slide ${slideNum} / ${slideFiles.length}`, SLIDE_W - 150, SLIDE_H - 28);

    const jpgBytes = dataUrlToUint8Array(canvas.toDataURL('image/jpeg', 0.94));
    const embeddedSlide = await pdfDoc.embedJpg(jpgBytes);
    const pdfPage = pdfDoc.addPage([960, 540]);
    pdfPage.drawImage(embeddedSlide, { x: 0, y: 0, width: 960, height: 540 });
  }

  const pdfBytes = await pdfDoc.save();
  return {
    blob: new Blob([pdfBytes as any], { type: 'application/pdf' }),
    slidesCount: slideFiles.length,
  };
}

// ============================================================================
// 5. PDF SANG POWERPOINT .PPTX (convert_pdf_to_pptx)
// ============================================================================

/**
 * Generates a valid, standards-compliant OpenXML .pptx presentation where each selected PDF page
 * is rendered at high resolution onto a 16:9 widescreen slide.
 */
export async function convertPdfToPptx(
  file: File,
  pageRangeStr = 'ALL',
  onProgress?: ProgressCallback
): Promise<{ blob: Blob; slidesCount: number }> {
  onProgress?.('Đang đọc file PDF để chuyển sang PowerPoint (.pptx)...', file.name, 10);
  const pdfjsLib = await getPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;
  const targetPages = parsePageSelection(pageRangeStr, totalPages);

  const zip = new JSZip();

  // Render each page to high-resolution PNG
  const slideImages: Uint8Array[] = [];
  for (let i = 0; i < targetPages.length; i++) {
    const pNum = targetPages[i];
    onProgress?.(
      `Đang chuyển Trang ${pNum}/${totalPages} thành Slide độ phân giải cao...`,
      `Slide ${i + 1} / ${targetPages.length}`,
      15 + Math.round(((i + 1) / targetPages.length) * 70)
    );

    const page = await pdf.getPage(pNum);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;

    const pngBytes = dataUrlToUint8Array(canvas.toDataURL('image/png'));
    slideImages.push(pngBytes);
  }

  onProgress?.('Đang đóng gói cấu trúc OpenXML PowerPoint (.pptx)...', `${slideImages.length} slides`, 90);

  // Build OpenXML PPTX structure
  const slideOverrides = slideImages
    .map(
      (_, idx) =>
        `<Override PartName="/ppt/slides/slide${idx + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
    )
    .join('\n  ');

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  ${slideOverrides}
</Types>`
  );

  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`
  );

  const presRels = slideImages
    .map(
      (_, idx) =>
        `<Relationship Id="rIdSlide${idx + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${idx + 1}.xml"/>`
    )
    .join('\n  ');

  zip.file(
    'ppt/_rels/presentation.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdMaster1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  ${presRels}
</Relationships>`
  );

  const sldIdLst = slideImages
    .map((_, idx) => `<p:sldId id="${256 + idx}" r:id="rIdSlide${idx + 1}"/>`)
    .join('\n    ');

  // 16:9 Widescreen 12192000 x 6858000 EMUs
  zip.file(
    'ppt/presentation.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst>
    <p:sldMasterId id="2147483648" r:id="rIdMaster1"/>
  </p:sldMasterIdLst>
  <p:sldIdLst>
    ${sldIdLst}
  </p:sldIdLst>
  <p:sldSz cx="12192000" cy="6858000" type="screen16x9"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`
  );

  zip.file(
    'ppt/slideMasters/slideMaster1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rIdLayout1"/></p:sldLayoutIdLst>
</p:sldMaster>`
  );

  zip.file(
    'ppt/slideMasters/_rels/slideMaster1.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdLayout1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`
  );

  zip.file(
    'ppt/slideLayouts/slideLayout1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank">
  <p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
</p:sldLayout>`
  );

  zip.file(
    'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdMaster1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`
  );

  for (let i = 0; i < slideImages.length; i++) {
    const sNum = i + 1;
    zip.file(`ppt/media/slide_page_${sNum}.png`, slideImages[i]);

    zip.file(
      `ppt/slides/_rels/slide${sNum}.xml.rels`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdLayout1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rIdImg1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/slide_page_${sNum}.png"/>
</Relationships>`
    );

    zip.file(
      `ppt/slides/slide${sNum}.xml`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:pic>
        <p:nvPicPr>
          <p:cNvPr id="2" name="SlidePage${sNum}"/>
          <p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr>
          <p:nvPr/>
        </p:nvPicPr>
        <p:blipFill>
          <a:blip r:embed="rIdImg1"/>
          <a:stretch><a:fillRect/></a:stretch>
        </p:blipFill>
        <p:spPr>
          <a:xfrm>
            <a:off x="0" y="0"/>
            <a:ext cx="12192000" cy="6858000"/>
          </a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        </p:spPr>
      </p:pic>
    </p:spTree>
  </p:cSld>
</p:sld>`
    );
  }

  const pptxBlob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  });

  return { blob: pptxBlob, slidesCount: slideImages.length };
}

// ============================================================================
// 6. XOAY TRANG PDF (rotate_pdf_pages)
// ============================================================================

export async function rotatePdfPages(
  file: File,
  angleDeg: 90 | 180 | 270 = 90,
  targetMode: 'ALL' | 'EVEN' | 'ODD' | 'CUSTOM' = 'ALL',
  customRangeStr = '',
  onProgress?: ProgressCallback
): Promise<{ blob: Blob; rotatedCount: number; totalPages: number }> {
  onProgress?.('Đang xoay trang PDF...', file.name, 25);
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const totalPages = pdfDoc.getPageCount();

  const rangeKey = targetMode === 'CUSTOM' ? customRangeStr : targetMode;
  const pagesToRotate = new Set(parsePageSelection(rangeKey, totalPages));

  let rotatedCount = 0;
  for (let i = 0; i < totalPages; i++) {
    const pNum = i + 1;
    if (pagesToRotate.has(pNum)) {
      const page = pdfDoc.getPage(i);
      const currentAngle = page.getRotation().angle || 0;
      page.setRotation(degrees((currentAngle + angleDeg) % 360));
      rotatedCount++;
    }
  }

  onProgress?.('Đang lưu file PDF đã xoay...', `${rotatedCount}/${totalPages} trang`, 85);
  const savedBytes = await pdfDoc.save();
  return {
    blob: new Blob([savedBytes as any], { type: 'application/pdf' }),
    rotatedCount,
    totalPages,
  };
}

// ============================================================================
// 7. XÓA TRANG PDF (delete_pdf_pages)
// ============================================================================

export async function deletePdfPages(
  file: File,
  pagesToDeleteStr: string,
  onProgress?: ProgressCallback
): Promise<{ blob: Blob; deletedCount: number; remainingCount: number }> {
  onProgress?.('Đang phân tích danh sách trang cần xóa...', file.name, 20);
  const arrayBuffer = await file.arrayBuffer();
  const srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const totalPages = srcDoc.getPageCount();

  const toDeleteSet = new Set(parsePageSelection(pagesToDeleteStr, totalPages));
  const keepIndices: number[] = [];
  for (let i = 0; i < totalPages; i++) {
    if (!toDeleteSet.has(i + 1)) {
      keepIndices.push(i);
    }
  }

  if (keepIndices.length === 0) {
    throw new Error('Không thể xóa toàn bộ 100% số trang của file PDF. Cần giữ lại ít nhất 1 trang.');
  }

  onProgress?.(
    `Đang loại bỏ ${totalPages - keepIndices.length} trang...`,
    `Giữ lại ${keepIndices.length} trang`,
    70
  );

  const outDoc = await PDFDocument.create();
  const copiedPages = await outDoc.copyPages(srcDoc, keepIndices);
  for (const p of copiedPages) {
    outDoc.addPage(p);
  }

  const savedBytes = await outDoc.save();
  return {
    blob: new Blob([savedBytes as any], { type: 'application/pdf' }),
    deletedCount: totalPages - keepIndices.length,
    remainingCount: keepIndices.length,
  };
}

// ============================================================================
// 8. ĐÁNH SỐ TRANG TỰ ĐỘNG (add_pdf_page_numbers)
// ============================================================================

export async function addPdfPageNumbers(
  file: File,
  formatStyle: 'trang_x_y' | 'x_y' | 'x' = 'trang_x_y',
  position: 'bottom-right' | 'bottom-center' | 'bottom-left' = 'bottom-right',
  onProgress?: ProgressCallback
): Promise<{ blob: Blob; totalPages: number }> {
  onProgress?.('Đang chèn số trang tự động...', file.name, 20);
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const totalPages = pdfDoc.getPageCount();

  for (let i = 0; i < totalPages; i++) {
    const pNum = i + 1;
    const label =
      formatStyle === 'trang_x_y'
        ? `Trang ${pNum} / ${totalPages}`
        : formatStyle === 'x_y'
        ? `${pNum} / ${totalPages}`
        : `${pNum}`;

    // Render Unicode Vietnamese label onto a crisp transparent high-DPI canvas
    const stampCanvas = document.createElement('canvas');
    stampCanvas.width = 320;
    stampCanvas.height = 56;
    const sCtx = stampCanvas.getContext('2d')!;
    sCtx.clearRect(0, 0, stampCanvas.width, stampCanvas.height);
    sCtx.font = 'bold 24px "Times New Roman", "Segoe UI", serif';
    sCtx.fillStyle = '#1e293b';
    sCtx.textBaseline = 'middle';

    if (position === 'bottom-right') {
      sCtx.textAlign = 'right';
      sCtx.fillText(label, 305, 28);
    } else if (position === 'bottom-center') {
      sCtx.textAlign = 'center';
      sCtx.fillText(label, 160, 28);
    } else {
      sCtx.textAlign = 'left';
      sCtx.fillText(label, 15, 28);
    }

    const pngBytes = dataUrlToUint8Array(stampCanvas.toDataURL('image/png'));
    const embeddedPng = await pdfDoc.embedPng(pngBytes);

    const page = pdfDoc.getPage(i);
    const { width } = page.getSize();
    const stampW = 128;
    const stampH = 22.4;

    const posX =
      position === 'bottom-right'
        ? Math.max(10, width - stampW - 24)
        : position === 'bottom-center'
        ? (width - stampW) / 2
        : 24;

    page.drawImage(embeddedPng, {
      x: posX,
      y: 14,
      width: stampW,
      height: stampH,
    });
  }

  onProgress?.('Đang lưu file PDF đã đánh số trang...', `${totalPages} trang`, 90);
  const savedBytes = await pdfDoc.save();
  return {
    blob: new Blob([savedBytes as any], { type: 'application/pdf' }),
    totalPages,
  };
}

// ============================================================================
// 9. XÉN VIỀN TRẮNG PDF (crop_pdf_margins)
// ============================================================================

export async function cropPdfMargins(
  file: File,
  mode: 'auto' | 'custom' = 'auto',
  customMarginPercent = 8,
  onProgress?: ProgressCallback
): Promise<{ blob: Blob; croppedPages: number }> {
  onProgress?.('Đang phân tích lề trắng dư thừa trên từng trang PDF...', file.name, 15);
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const totalPages = pdfDoc.getPageCount();

  if (mode === 'auto') {
    const pdfjsLib = await getPdfJs();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;

    for (let i = 0; i < totalPages; i++) {
      onProgress?.(
        `Đang tự động nhận diện viền trắng Trang ${i + 1}/${totalPages}...`,
        'Phóng to vùng chữ hiển thị rõ nét khi đọc và in ấn',
        20 + Math.round(((i + 1) / totalPages) * 65)
      );

      const pageJs = await pdf.getPage(i + 1);
      const scale = 0.5;
      const viewport = pageJs.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await pageJs.render({ canvasContext: ctx, viewport, canvas } as any).promise;

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let minX = canvas.width;
      let minY = canvas.height;
      let maxX = 0;
      let maxY = 0;
      let foundInk = false;

      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const idx = (y * canvas.width + x) * 4;
          const r = imgData[idx];
          const g = imgData[idx + 1];
          const b = imgData[idx + 2];
          if (r < 245 || g < 245 || b < 245) {
            foundInk = true;
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
        }
      }

      if (foundInk && maxX > minX && maxY > minY) {
        const pdfPage = pdfDoc.getPage(i);
        const { width, height } = pdfPage.getSize();
        const padPt = 14;

        const cropLeft = Math.max(0, (minX / canvas.width) * width - padPt);
        const cropRight = Math.min(width, (maxX / canvas.width) * width + padPt);
        // Canvas Y is top-down, PDF Y is bottom-up
        const cropTopFromBottom = Math.min(
          height,
          height - (minY / canvas.height) * height + padPt
        );
        const cropBottomFromBottom = Math.max(
          0,
          height - (maxY / canvas.height) * height - padPt
        );

        const newW = Math.max(100, cropRight - cropLeft);
        const newH = Math.max(100, cropTopFromBottom - cropBottomFromBottom);

        pdfPage.setCropBox(cropLeft, cropBottomFromBottom, newW, newH);
        pdfPage.setMediaBox(cropLeft, cropBottomFromBottom, newW, newH);
      }
    }
  } else {
    const ratio = Math.max(1, Math.min(30, customMarginPercent)) / 100;
    for (let i = 0; i < totalPages; i++) {
      const pdfPage = pdfDoc.getPage(i);
      const { width, height } = pdfPage.getSize();
      const dx = width * ratio;
      const dy = height * ratio;
      pdfPage.setCropBox(dx, dy, width - dx * 2, height - dy * 2);
      pdfPage.setMediaBox(dx, dy, width - dx * 2, height - dy * 2);
    }
  }

  const savedBytes = await pdfDoc.save();
  return {
    blob: new Blob([savedBytes as any], { type: 'application/pdf' }),
    croppedPages: totalPages,
  };
}

// ============================================================================
// 10. CẮT NHỎ PDF THEO SỐ TRANG (split_pdf_by_count)
// ============================================================================

export async function splitPdfByCount(
  file: File,
  pagesPerChunk = 5,
  onProgress?: ProgressCallback
): Promise<{
  zipBlob: Blob;
  chunks: { fileName: string; blob: Blob; pageRange: string }[];
}> {
  onProgress?.('Đang chia nhỏ file PDF theo số trang...', file.name, 15);
  const arrayBuffer = await file.arrayBuffer();
  const srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const totalPages = srcDoc.getPageCount();
  const step = Math.max(1, pagesPerChunk);
  const baseName = file.name.replace(/\.pdf$/i, '');

  const zip = new JSZip();
  const chunks: { fileName: string; blob: Blob; pageRange: string }[] = [];

  for (let start = 0; start < totalPages; start += step) {
    const end = Math.min(totalPages, start + step);
    const indices = Array.from({ length: end - start }, (_, k) => start + k);

    const subDoc = await PDFDocument.create();
    const copied = await subDoc.copyPages(srcDoc, indices);
    for (const p of copied) subDoc.addPage(p);

    const bytes = await subDoc.save();
    const chunkBlob = new Blob([bytes as any], { type: 'application/pdf' });
    const rangeLabel = `Trang_${start + 1}_den_${end}`;
    const fileName = `${baseName}_Phan_${chunks.length + 1}_${rangeLabel}.pdf`;

    chunks.push({ fileName, blob: chunkBlob, pageRange: `${start + 1}-${end}` });
    zip.file(fileName, bytes);
  }

  onProgress?.('Đang đóng gói các file PDF đã cắt nhỏ (.ZIP)...', `${chunks.length} file`, 90);
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  return { zipBlob, chunks };
}

// ============================================================================
// 11. GỘP NHIỀU FILE PDF (merge_pdf_files)
// ============================================================================

export async function mergePdfFiles(
  files: File[],
  onProgress?: ProgressCallback
): Promise<{ blob: Blob; totalPages: number; filesCount: number }> {
  if (files.length === 0) {
    throw new Error('Vui lòng chọn ít nhất 1 file PDF để gộp.');
  }

  const mergedPdf = await PDFDocument.create();
  let totalPages = 0;

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    onProgress?.(
      `Đang nối file ${i + 1}/${files.length}: ${f.name}...`,
      'Giữ nguyên 100% chất lượng và định dạng từng trang',
      15 + Math.round(((i + 1) / files.length) * 75)
    );

    const buf = await f.arrayBuffer();
    const srcDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
    const indices = srcDoc.getPageIndices();
    const copied = await mergedPdf.copyPages(srcDoc, indices);
    for (const page of copied) {
      mergedPdf.addPage(page);
      totalPages++;
    }
  }

  const savedBytes = await mergedPdf.save();
  return {
    blob: new Blob([savedBytes as any], { type: 'application/pdf' }),
    totalPages,
    filesCount: files.length,
  };
}

// ============================================================================
// 12. TÁCH / TRÍCH XUẤT TRANG PDF (split_pdf_file)
// ============================================================================

export async function splitPdfFile(
  file: File,
  mode: 'extract-single' | 'separate-files' = 'extract-single',
  pageRangeStr = 'ALL',
  onProgress?: ProgressCallback
): Promise<{
  outputBlob: Blob;
  isZip: boolean;
  extractedCount: number;
}> {
  onProgress?.('Đang trích xuất trang PDF...', file.name, 20);
  const arrayBuffer = await file.arrayBuffer();
  const srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const totalPages = srcDoc.getPageCount();
  const selectedPages = parsePageSelection(pageRangeStr, totalPages);
  const baseName = file.name.replace(/\.pdf$/i, '');

  if (mode === 'extract-single') {
    const outDoc = await PDFDocument.create();
    const indices = selectedPages.map(p => p - 1);
    const copied = await outDoc.copyPages(srcDoc, indices);
    for (const p of copied) outDoc.addPage(p);
    const bytes = await outDoc.save();
    return {
      outputBlob: new Blob([bytes as any], { type: 'application/pdf' }),
      isZip: false,
      extractedCount: selectedPages.length,
    };
  } else {
    const zip = new JSZip();
    for (let i = 0; i < selectedPages.length; i++) {
      const pNum = selectedPages[i];
      const singleDoc = await PDFDocument.create();
      const [copiedPage] = await singleDoc.copyPages(srcDoc, [pNum - 1]);
      singleDoc.addPage(copiedPage);
      const bytes = await singleDoc.save();
      zip.file(`${baseName}_Trang_${pNum}.pdf`, bytes);
    }
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    return {
      outputBlob: zipBlob,
      isZip: true,
      extractedCount: selectedPages.length,
    };
  }
}

// ============================================================================
// 13A. NÉN PDF TIÊU CHUẨN (compress_pdf_file)
// ============================================================================

export async function compressPdfFile(
  file: File,
  compressionLevel: 'standard' | 'high' | 'lossless' = 'standard',
  onProgress?: ProgressCallback
): Promise<{
  blob: Blob;
  originalBytes: number;
  compressedBytes: number;
  savedPercent: number;
}> {
  const originalBytes = file.size;
  onProgress?.('Đang phân tích cấu trúc & tối ưu hóa dung lượng PDF...', file.name, 15);
  const arrayBuffer = await file.arrayBuffer();

  if (compressionLevel === 'lossless') {
    const srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
    const bytes = await srcDoc.save({ useObjectStreams: true });
    const compressedBytes = bytes.byteLength;
    const savedPercent = Math.max(
      0,
      Math.round(((originalBytes - compressedBytes) / Math.max(1, originalBytes)) * 100)
    );
    return {
      blob: new Blob([bytes as any], { type: 'application/pdf' }),
      originalBytes,
      compressedBytes,
      savedPercent,
    };
  }

  // Standard or High compression: re-optimize page streams at controlled DPI & JPEG quality
  const pdfjsLib = await getPdfJs();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
  const totalPages = pdf.numPages;

  const scale = compressionLevel === 'high' ? 1.15 : 1.45;
  const jpegQuality = compressionLevel === 'high' ? 0.62 : 0.78;

  const outDoc = await PDFDocument.create();

  for (let i = 1; i <= totalPages; i++) {
    onProgress?.(
      `Đang nén thông minh Trang ${i}/${totalPages}...`,
      compressionLevel === 'high' ? 'Chế độ Siêu nén dung lượng' : 'Chế độ Nén tiêu chuẩn giữ nét chữ',
      20 + Math.round((i / totalPages) * 65)
    );

    const page = await pdf.getPage(i);
    const origViewport = page.getViewport({ scale: 1.0 });
    const renderViewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(renderViewport.width);
    canvas.height = Math.round(renderViewport.height);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: renderViewport, canvas } as any).promise;

    const jpgBytes = dataUrlToUint8Array(canvas.toDataURL('image/jpeg', jpegQuality));
    const embeddedJpg = await outDoc.embedJpg(jpgBytes);
    const pdfPage = outDoc.addPage([origViewport.width, origViewport.height]);
    pdfPage.drawImage(embeddedJpg, {
      x: 0,
      y: 0,
      width: origViewport.width,
      height: origViewport.height,
    });
  }

  const reencodedBytes = await outDoc.save({ useObjectStreams: true });

  // Also test lossless object stream save so we always return whichever is smaller!
  const losslessDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const losslessBytes = await losslessDoc.save({ useObjectStreams: true });

  const bestBytes =
    reencodedBytes.byteLength < losslessBytes.byteLength ? reencodedBytes : losslessBytes;
  const finalSize = Math.min(originalBytes, bestBytes.byteLength);
  const savedPercent = Math.max(
    0,
    Math.round(((originalBytes - finalSize) / Math.max(1, originalBytes)) * 100)
  );

  return {
    blob: new Blob([bestBytes as any], { type: 'application/pdf' }),
    originalBytes,
    compressedBytes: bestBytes.byteLength,
    savedPercent,
  };
}

// ============================================================================
// 13B. TRÍCH XUẤT TOÀN BỘ ẢNH TỪ PDF (extract_images_from_pdf)
// ============================================================================

export interface ExtractedPdfImage {
  id: string;
  fileName: string;
  pageNumber: number;
  width: number;
  height: number;
  dataUrl: string;
}

export async function extractImagesFromPdf(
  file: File,
  pageRangeStr = 'ALL',
  onProgress?: ProgressCallback
): Promise<{
  zipBlob: Blob;
  images: ExtractedPdfImage[];
}> {
  onProgress?.('Đang quét và bóc tách hình ảnh từ PDF...', file.name, 15);
  const pdfjsLib = await getPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;
  const targetPages = parsePageSelection(pageRangeStr, totalPages);
  const baseName = file.name.replace(/\.pdf$/i, '');

  const zip = new JSZip();
  const imgFolder = zip.folder(`${baseName}_Hinh_Anh`) || zip;
  const extractedImages: ExtractedPdfImage[] = [];

  for (let i = 0; i < targetPages.length; i++) {
    const pNum = targetPages[i];
    onProgress?.(
      `Đang bóc tách ảnh tại Trang ${pNum}/${totalPages}...`,
      `Đã trích xuất ${extractedImages.length} ảnh`,
      20 + Math.round(((i + 1) / targetPages.length) * 65)
    );

    const page = await pdf.getPage(pNum);
    const opList = await page.getOperatorList();
    let foundEmbeddedOnPage = 0;

    // 1. Try extracting raw embedded image XObjects from PDF page operators
    const OPS = pdfjsLib.OPS;
    for (let opIdx = 0; opIdx < opList.fnArray.length; opIdx++) {
      const fn = opList.fnArray[opIdx];
      if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) {
        const objId = opList.argsArray[opIdx]?.[0];
        if (!objId) continue;

        try {
          const imgObj: any = await new Promise(resolve => {
            if (page.objs.has(objId)) {
              resolve(page.objs.get(objId));
            } else if (page.commonObjs.has(objId)) {
              resolve(page.commonObjs.get(objId));
            } else {
              resolve(null);
            }
          });

          if (imgObj && imgObj.width >= 32 && imgObj.height >= 32) {
            const c = document.createElement('canvas');
            c.width = imgObj.width;
            c.height = imgObj.height;
            const ctx = c.getContext('2d')!;

            if (imgObj.bitmap) {
              ctx.drawImage(imgObj.bitmap, 0, 0);
            } else if (imgObj.data) {
              const imageData = ctx.createImageData(imgObj.width, imgObj.height);
              const src = imgObj.data;
              const dst = imageData.data;
              if (src.length === imgObj.width * imgObj.height * 4) {
                dst.set(src);
              } else if (src.length === imgObj.width * imgObj.height * 3) {
                for (let j = 0, k = 0; j < src.length; j += 3, k += 4) {
                  dst[k] = src[j];
                  dst[k + 1] = src[j + 1];
                  dst[k + 2] = src[j + 2];
                  dst[k + 3] = 255;
                }
              }
              ctx.putImageData(imageData, 0, 0);
            }

            const dataUrl = c.toDataURL('image/png');
            const bytes = dataUrlToUint8Array(dataUrl);
            foundEmbeddedOnPage++;
            const fileName = `Trang_${pNum}_Anh_${foundEmbeddedOnPage}_${imgObj.width}x${imgObj.height}.png`;

            imgFolder.file(fileName, bytes);
            extractedImages.push({
              id: `p${pNum}-img${foundEmbeddedOnPage}`,
              fileName,
              pageNumber: pNum,
              width: imgObj.width,
              height: imgObj.height,
              dataUrl,
            });
          }
        } catch {
          // Fallback to high-res page image below
        }
      }
    }

    // 2. Also export a high-resolution snapshot of the page if no standalone XObject was exposed (e.g. vector graphics/scanned page)
    if (foundEmbeddedOnPage === 0) {
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;

      const dataUrl = canvas.toDataURL('image/png');
      const bytes = dataUrlToUint8Array(dataUrl);
      const fileName = `Trang_${pNum}_BanChupNetCao_${canvas.width}x${canvas.height}.png`;

      imgFolder.file(fileName, bytes);
      extractedImages.push({
        id: `p${pNum}-full`,
        fileName,
        pageNumber: pNum,
        width: canvas.width,
        height: canvas.height,
        dataUrl,
      });
    }
  }

  onProgress?.('Đang nén thư mục hình ảnh (.ZIP)...', `${extractedImages.length} ảnh`, 92);
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  return { zipBlob, images: extractedImages };
}
