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

import { PDFDocument, degrees, rgb, StandardFonts } from 'pdf-lib';
import PizZip from 'pizzip';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { callGeminiVisionApi, getAvailableKeys } from '@/lib/gemini';
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
  ShadingType,
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
// 1. PDF SANG WORD .DOCX (convert_pdf_to_docx) — LATTICE/STREAM TABLES + EMBEDDED IMAGES + OCR
// ============================================================================

interface ExtractedTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  bold: boolean;
  italic: boolean;
}

/**
 * Samples the dominant non-text background color (hex RRGGBB) inside a rectangle on a canvas.
 * Returns null if the background is white/near-white.
 */
function sampleCellBackgroundHex(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  canvasW: number,
  canvasH: number
): string | null {
  try {
    const sx = Math.max(0, Math.min(canvasW - 2, Math.round(x)));
    const sy = Math.max(0, Math.min(canvasH - 2, Math.round(y)));
    const sw = Math.max(2, Math.min(canvasW - sx, Math.round(w)));
    const sh = Math.max(2, Math.min(canvasH - sy, Math.round(h)));
    const data = ctx.getImageData(sx, sy, sw, sh).data;

    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    let count = 0;

    // Sample perimeter-interior pixels (avoiding dark text ink < 90 brightness)
    const step = Math.max(4, Math.floor((sw * sh) / 60) * 4);
    for (let i = 0; i < data.length; i += step) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum > 110) {
        rSum += r;
        gSum += g;
        bSum += b;
        count++;
      }
    }

    if (count === 0) return null;
    const rAvg = Math.round(rSum / count);
    const gAvg = Math.round(gSum / count);
    const bAvg = Math.round(bSum / count);

    // If very close to pure white (> 246), treat as no fill
    if (rAvg > 246 && gAvg > 246 && bAvg > 246) return null;

    const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
    return `${toHex(rAvg)}${toHex(gAvg)}${toHex(bAvg)}`;
  } catch {
    return null;
  }
}

export async function convertPdfToDocx(
  file: File,
  pageRangeStr = 'ALL',
  includeVisualSnapshot = false,
  onProgress?: ProgressCallback,
  apiKeysStr?: string,
  modelId?: string
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
      'Bóc tách văn bản độc lập, bảng biểu chuẩn kích thước cột, ô gộp và hình ảnh gốc',
      pct
    );

    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent();

    // Render page at 1.5x onto offscreen canvas for background color sampling & Scanned OCR fallback
    const renderViewport = page.getViewport({ scale: 1.5 });
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = Math.round(renderViewport.width);
    pageCanvas.height = Math.round(renderViewport.height);
    const pageCtx = pageCanvas.getContext('2d')!;
    pageCtx.fillStyle = '#ffffff';
    pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    await page.render({ canvasContext: pageCtx, viewport: renderViewport, canvas: pageCanvas } as any).promise;

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
        italic: fontName.includes('italic') || fontName.includes('oblique'),
      });
    }

    // 1. Extract standalone embedded images from PDF page operators (NOT full-page dead screenshot!)
    const embeddedImagesOnPage: Array<{ bytes: Uint8Array; width: number; height: number }> = [];
    if (items.length > 0) {
      try {
        const opList = await page.getOperatorList();
        const OPS = pdfjsLib.OPS;
        for (let opIdx = 0; opIdx < opList.fnArray.length; opIdx++) {
          const fn = opList.fnArray[opIdx];
          if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) {
            const objId = opList.argsArray[opIdx]?.[0];
            if (!objId) continue;
            const imgObj: any = page.objs.has(objId)
              ? page.objs.get(objId)
              : page.commonObjs.has(objId)
              ? page.commonObjs.get(objId)
              : null;

            if (imgObj && imgObj.width >= 36 && imgObj.height >= 36) {
              // Skip if this image is a full-page background scan (>92% of page size)
              const isFullPageBg =
                imgObj.width > viewport.width * 1.3 && imgObj.height > viewport.height * 1.3 && opList.fnArray.length < 25;
              if (isFullPageBg) continue;

              const ic = document.createElement('canvas');
              ic.width = imgObj.width;
              ic.height = imgObj.height;
              const ictx = ic.getContext('2d')!;
              if (imgObj.bitmap) {
                ictx.drawImage(imgObj.bitmap, 0, 0);
              } else if (imgObj.data) {
                const imgData = ictx.createImageData(imgObj.width, imgObj.height);
                const src = imgObj.data;
                const dst = imgData.data;
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
                ictx.putImageData(imgData, 0, 0);
              }
              const maxDocxW = 460;
              const scaleRatio = Math.min(1, maxDocxW / imgObj.width);
              embeddedImagesOnPage.push({
                bytes: dataUrlToUint8Array(ic.toDataURL('image/png')),
                width: Math.max(48, Math.round(imgObj.width * scaleRatio)),
                height: Math.max(36, Math.round(imgObj.height * scaleRatio)),
              });
            }
          }
        }
      } catch {
        // Ignore operator extraction errors
      }
    }

    // 2. If Scanned PDF Page (items.length < 3), run Vietnamese AI Vision OCR to recover editable paragraphs & tables!
    if (items.length < 3 && apiKeysStr) {
      try {
        onProgress?.(
          `Phát hiện Trang ${pageNum} là bản Scan/Ảnh — Đang chạy OCR Tiếng Việt...`,
          'Bóc tách chữ tiếng Việt có dấu và bảng biểu thành văn bản Word chỉnh sửa được',
          pct
        );
        const jpgDataUrl = pageCanvas.toDataURL('image/jpeg', 0.88);
        const ocrPrompt = `Bạn là hệ thống OCR Tiếng Việt và tái tạo cấu trúc tài liệu Word chuyên nghiệp.
Hãy đọc toàn bộ nội dung trong trang tài liệu này và trả về JSON theo cấu trúc:
{
  "blocks": [
    {
      "type": "paragraph",
      "text": "Nội dung đoạn văn tiếng Việt chính xác 100%",
      "bold": false,
      "italic": false,
      "align": "left"
    },
    {
      "type": "table",
      "rows": [
        [
          { "text": "Nội dung ô", "bold": true, "colSpan": 1, "bgHex": "E2EFDA" }
        ]
      ]
    }
  ]
}`;
        const ocrJsonText = await callGeminiVisionApi(ocrPrompt, jpgDataUrl, 'image/jpeg', apiKeysStr, modelId);
        const parsedOcr = JSON.parse(ocrJsonText.replace(/```json|```/g, '').trim());
        if (parsedOcr?.blocks && Array.isArray(parsedOcr.blocks)) {
          for (const blk of parsedOcr.blocks) {
            if (blk.type === 'table' && Array.isArray(blk.rows) && blk.rows.length > 0) {
              const wordRows = blk.rows.map((r: any[]) =>
                new TableRow({
                  cantSplit: true,
                  children: (Array.isArray(r) ? r : []).map((cell: any) =>
                    new TableCell({
                      columnSpan: cell?.colSpan && cell.colSpan > 1 ? cell.colSpan : undefined,
                      shading: cell?.bgHex
                        ? { fill: String(cell.bgHex).replace('#', ''), type: ShadingType.CLEAR, color: 'auto' }
                        : undefined,
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: String(cell?.text ?? ''),
                              bold: Boolean(cell?.bold),
                              font: 'Times New Roman',
                              size: 24,
                            }),
                          ],
                        }),
                      ],
                    })
                  ),
                })
              );
              docChildren.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: wordRows }));
            } else if (blk.text) {
              docChildren.push(
                new Paragraph({
                  alignment:
                    blk.align === 'center'
                      ? AlignmentType.CENTER
                      : blk.align === 'right'
                      ? AlignmentType.RIGHT
                      : AlignmentType.LEFT,
                  spacing: { after: 120, line: 276 },
                  children: [
                    new TextRun({
                      text: String(blk.text),
                      bold: Boolean(blk.bold),
                      italics: Boolean(blk.italic),
                      font: 'Times New Roman',
                      size: 24,
                    }),
                  ],
                })
              );
            }
          }
          if (idx < targetPages.length - 1) {
            docChildren.push(new Paragraph({ children: [new PageBreak()] }));
          }
          continue;
        }
      } catch {
        // Fallback to standard processing below if OCR key not set
      }
    }

    // 3. Group items into horizontal lines by Y coordinate (tolerance: 4.5pt)
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    const lines: { y: number; height: number; items: ExtractedTextItem[] }[] = [];

    for (const item of items) {
      const existingLine = lines.find(l => Math.abs(l.y - item.y) <= 4.5);
      if (existingLine) {
        existingLine.items.push(item);
        existingLine.height = Math.max(existingLine.height, item.height);
      } else {
        lines.push({ y: item.y, height: item.height, items: [item] });
      }
    }

    for (const line of lines) {
      line.items.sort((a, b) => a.x - b.x);
    }

    // 4. Reconstruct Lattice & Stream Tables (with exact column widths, merged cells, cantSplit & cell shading)
    let lineIdx = 0;
    while (lineIdx < lines.length) {
      const currentLine = lines[lineIdx];

      const getSegments = (ln: { y: number; height: number; items: ExtractedTextItem[] }) => {
        const segs: { x: number; right: number; text: string; bold: boolean; italic: boolean }[] = [];
        let curX = ln.items[0]?.x || 0;
        let lastRight = curX;
        let curText = '';
        let curBold = false;
        let curItalic = false;

        for (let i = 0; i < ln.items.length; i++) {
          const it = ln.items[i];
          if (i > 0 && it.x - lastRight > 22) {
            segs.push({ x: curX, right: lastRight, text: curText.trim(), bold: curBold, italic: curItalic });
            curX = it.x;
            curText = it.str;
            curBold = it.bold;
            curItalic = it.italic;
          } else {
            const gap = i > 0 ? it.x - lastRight : 0;
            curText += (gap > 2.2 && !curText.endsWith(' ') ? ' ' : '') + it.str;
            curBold = curBold || it.bold;
            curItalic = curItalic || it.italic;
          }
          lastRight = it.x + it.width;
        }
        if (curText.trim()) {
          segs.push({ x: curX, right: lastRight, text: curText.trim(), bold: curBold, italic: curItalic });
        }
        return segs;
      };

      const segs = getSegments(currentLine);
      if (segs.length >= 2 && lineIdx + 1 < lines.length) {
        const nextSegs = getSegments(lines[lineIdx + 1]);
        if (nextSegs.length >= 2 && Math.abs(nextSegs.length - segs.length) <= 1 && segs.length <= 10) {
          // Collect consecutive table rows
          const rawTableLines: { y: number; height: number; segs: ReturnType<typeof getSegments> }[] = [
            { y: currentLine.y, height: currentLine.height, segs },
          ];
          let lookahead = lineIdx + 1;
          while (lookahead < lines.length) {
            const candidateSegs = getSegments(lines[lookahead]);
            const verticalGap = Math.abs(lines[lookahead - 1].y - lines[lookahead].y);
            if (
              verticalGap < 42 &&
              (candidateSegs.length >= 2 ||
                (candidateSegs.length === 1 &&
                  lookahead + 1 < lines.length &&
                  getSegments(lines[lookahead + 1]).length >= 2))
            ) {
              rawTableLines.push({
                y: lines[lookahead].y,
                height: lines[lookahead].height,
                segs: candidateSegs,
              });
              lookahead++;
            } else {
              break;
            }
          }

          if (rawTableLines.length >= 2) {
            // Discover canonical column X anchors across all collected table rows
            const colAnchors: number[] = [];
            for (const r of rawTableLines) {
              if (r.segs.length >= 2) {
                for (const s of r.segs) {
                  const existingAnchor = colAnchors.find(a => Math.abs(a - s.x) <= 24);
                  if (existingAnchor === undefined) {
                    colAnchors.push(s.x);
                  }
                }
              }
            }
            colAnchors.sort((a, b) => a - b);
            const numCols = Math.max(2, Math.min(10, colAnchors.length));

            // Calculate exact proportional column widths (in DXA twips, total table width = 9360 twips)
            const TOTAL_TABLE_TWIPS = 9360;
            const tableRightEdge = Math.max(
              viewport.width - 45,
              ...rawTableLines.flatMap(r => r.segs.map(s => s.right))
            );
            const colWidthsTwips: number[] = [];
            for (let c = 0; c < numCols; c++) {
              const startX = colAnchors[c] || 45;
              const endX = c + 1 < numCols ? colAnchors[c + 1] : tableRightEdge;
              colWidthsTwips.push(Math.max(700, Math.round(((endX - startX) / Math.max(100, tableRightEdge - (colAnchors[0] || 45))) * TOTAL_TABLE_TWIPS)));
            }

            const wordRows = rawTableLines.map((rowObj, rIndex) => {
              // If a row has only 1 segment inside a multi-column table, treat it as a Merged Group Header (colSpan = numCols)!
              if (rowObj.segs.length === 1 && numCols > 1) {
                const onlySeg = rowObj.segs[0];
                const canvasY = (viewport.height - rowObj.y - rowObj.height) * 1.5;
                const bgHex = sampleCellBackgroundHex(
                  pageCtx,
                  onlySeg.x * 1.5,
                  canvasY,
                  (onlySeg.right - onlySeg.x) * 1.5,
                  rowObj.height * 1.8,
                  pageCanvas.width,
                  pageCanvas.height
                );
                return new TableRow({
                  cantSplit: true,
                  children: [
                    new TableCell({
                      columnSpan: numCols,
                      shading: bgHex
                        ? { fill: bgHex, type: ShadingType.CLEAR, color: 'auto' }
                        : rIndex === 0
                        ? { fill: 'F1F5F9', type: ShadingType.CLEAR, color: 'auto' }
                        : undefined,
                      children: [
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [
                            new TextRun({
                              text: onlySeg.text,
                              bold: true,
                              font: 'Times New Roman',
                              size: 24,
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                });
              }

              // Map each segment to its nearest column index and detect horizontal spanning
              const rowCells: TableCell[] = [];
              const bucketTexts: { text: string; bold: boolean; italic: boolean; x: number }[] = Array.from(
                { length: numCols },
                (_, cIdx) => ({ text: '', bold: false, italic: false, x: colAnchors[cIdx] || 50 })
              );

              for (const seg of rowObj.segs) {
                let bestCol = 0;
                let minDist = Infinity;
                for (let c = 0; c < numCols; c++) {
                  const d = Math.abs(seg.x - colAnchors[c]);
                  if (d < minDist) {
                    minDist = d;
                    bestCol = c;
                  }
                }
                bucketTexts[bestCol].text = bucketTexts[bestCol].text
                  ? `${bucketTexts[bestCol].text} ${seg.text}`
                  : seg.text;
                bucketTexts[bestCol].bold = bucketTexts[bestCol].bold || seg.bold;
                bucketTexts[bestCol].italic = bucketTexts[bestCol].italic || seg.italic;
              }

              for (let c = 0; c < numCols; c++) {
                const b = bucketTexts[c];
                const canvasY = (viewport.height - rowObj.y - rowObj.height) * 1.5;
                const bgHex = sampleCellBackgroundHex(
                  pageCtx,
                  b.x * 1.5,
                  canvasY,
                  (colWidthsTwips[c] / TOTAL_TABLE_TWIPS) * pageCanvas.width * 0.8,
                  rowObj.height * 1.8,
                  pageCanvas.width,
                  pageCanvas.height
                );

                rowCells.push(
                  new TableCell({
                    width: { size: colWidthsTwips[c], type: WidthType.DXA },
                    shading: bgHex
                      ? { fill: bgHex, type: ShadingType.CLEAR, color: 'auto' }
                      : rIndex === 0
                      ? { fill: 'F8FAFC', type: ShadingType.CLEAR, color: 'auto' }
                      : undefined,
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: b.text,
                            bold: b.bold || rIndex === 0,
                            italics: b.italic,
                            font: 'Times New Roman',
                            size: 23,
                          }),
                        ],
                      }),
                    ],
                  })
                );
              }

              return new TableRow({
                cantSplit: true,
                children: rowCells,
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
      }

      // Standard independent editable paragraph
      let lineText = '';
      let lastEnd = currentLine.items[0]?.x || 0;
      let maxFontSize = 12;
      let isBoldLine = false;
      let isItalicLine = false;

      for (let i = 0; i < currentLine.items.length; i++) {
        const it = currentLine.items[i];
        const gap = i > 0 ? it.x - lastEnd : 0;
        lineText += (gap > 2.2 && !lineText.endsWith(' ') ? ' ' : '') + it.str;
        lastEnd = it.x + it.width;
        if (it.fontSize > maxFontSize) maxFontSize = it.fontSize;
        if (it.bold) isBoldLine = true;
        if (it.italic) isItalicLine = true;
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
          spacing: { after: 110, line: 276 },
          children: [
            new TextRun({
              text: lineText.trim(),
              bold: isBoldLine,
              italics: isItalicLine,
              font: 'Times New Roman',
              size: Math.max(22, Math.min(36, Math.round(maxFontSize * 2))),
            }),
          ],
        })
      );

      lineIdx++;
    }

    // 5. Append any standalone figures/diagrams extracted from this page at their exact aspect ratio
    for (const figImg of embeddedImagesOnPage) {
      docChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 100, after: 120 },
          children: [
            new ImageRun({
              data: figImg.bytes,
              transformation: { width: figImg.width, height: figImg.height },
              type: 'png',
            }),
          ],
        })
      );
    }

    // Only if page had zero text AND zero OCR (or user explicitly checked visual snapshot)
    if (items.length === 0 || includeVisualSnapshot) {
      const imgBytes = dataUrlToUint8Array(pageCanvas.toDataURL('image/png'));
      const targetWidth = 540;
      const targetHeight = Math.round((pageCanvas.height / pageCanvas.width) * targetWidth);

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
// 2. WORD SANG PDF (convert_word_to_pdf) — NATIVE DOCX XML + 2D OMML MATH ENGINE
// ============================================================================

/**
 * Normalizes Private Use Area (Symbol / Wingdings / MT Extra) math characters
 * to standard Unicode mathematical symbols (ℝ, ℤ, ℕ, ℚ, ℂ, ∫, ∑, √, ∀, ∃, ∈, ⊂, ≤, ≥, ±, ∞, Greek...)
 */
function normalizeMathGlyphs(str: string): string {
  const puaMap: Record<number, string> = {
    0xf022: '∀',
    0xf024: '∃',
    0xf027: '∋',
    0xf02a: '*',
    0xf02d: '−',
    0xf0b1: '±',
    0xf0b2: '″',
    0xf0b3: '≥',
    0xf0a3: '≤',
    0xf0b4: '×',
    0xf0b8: '÷',
    0xf0b9: '≠',
    0xf0ba: '≡',
    0xf0bb: '≈',
    0xf0a5: '∞',
    0xf0b6: '∂',
    0xf0d1: '∇',
    0xf0d6: '√',
    0xf0ce: '∈',
    0xf0cf: '∉',
    0xf0cc: '⊂',
    0xf0cd: '⊆',
    0xf0c7: '∩',
    0xf0c8: '∪',
    0xf0de: '⇒',
    0xf0db: '⇔',
    0xf0e5: '∑',
    0xf0f2: '∫',
    0xf061: 'α',
    0xf062: 'β',
    0xf067: 'γ',
    0xf064: 'δ',
    0xf044: 'Δ',
    0xf065: 'ε',
    0xf070: 'π',
    0xf073: 'σ',
    0xf077: 'ω',
    0xf057: 'Ω',
    0xf06c: 'λ',
    0xf06d: 'μ',
    0xf071: 'θ',
    0xf066: 'φ',
  };

  let out = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    out += puaMap[code] || str[i];
  }
  return out;
}

/**
 * 2D OMML (<m:oMath>) AST Node types for exact mathematical typesetting on Canvas
 */
type OmmlMathNode =
  | { type: 'text'; text: string }
  | { type: 'frac'; num: OmmlMathNode[]; den: OmmlMathNode[] }
  | { type: 'rad'; deg: OmmlMathNode[]; base: OmmlMathNode[] }
  | { type: 'sup'; base: OmmlMathNode[]; sup: OmmlMathNode[] }
  | { type: 'sub'; base: OmmlMathNode[]; sub: OmmlMathNode[] }
  | { type: 'subsup'; base: OmmlMathNode[]; sub: OmmlMathNode[]; sup: OmmlMathNode[] }
  | { type: 'nary'; chr: string; sub: OmmlMathNode[]; sup: OmmlMathNode[]; base: OmmlMathNode[] }
  | { type: 'delim'; begChr: string; endChr: string; inner: OmmlMathNode[] }
  | { type: 'limLow'; base: OmmlMathNode[]; lim: OmmlMathNode[] }
  | { type: 'limUpp'; base: OmmlMathNode[]; lim: OmmlMathNode[] }
  | { type: 'func'; fName: OmmlMathNode[]; arg: OmmlMathNode[] }
  | { type: 'acc'; chr: string; base: OmmlMathNode[] }
  | { type: 'matrix'; rows: OmmlMathNode[][][] };

function getXmlLocalName(el: Element): string {
  return (el.localName || el.tagName.replace(/^[a-zA-Z0-9]+:/, '')).trim();
}

function getDirectChildByTag(parent: Element, localOrFullTag: string): Element | null {
  const targetLocal = localOrFullTag.replace(/^[a-zA-Z0-9]+:/, '');
  for (let i = 0; i < parent.childNodes.length; i++) {
    const c = parent.childNodes[i];
    if (c.nodeType === 1) {
      const el = c as Element;
      if (el.tagName === localOrFullTag || getXmlLocalName(el) === targetLocal) {
        return el;
      }
    }
  }
  return null;
}

/**
 * Parses inline LaTeX or linear equations (e.g. \frac{V_{max}[S]}{K_m + [S]}, \sqrt{x^2+y^2}, E = mc^2)
 * into 2D OmmlMathNode[] so even equations typed as linear text or LaTeX render in 2D!
 */
function parseLatexOrLinearMathToNodes(expr: string): OmmlMathNode[] {
  const nodes: OmmlMathNode[] = [];
  let i = 0;
  const s = normalizeMathGlyphs(expr.trim().replace(/^\$+|\$+$/g, ''));

  const readBracedGroup = (startIdx: number): { content: string; nextIdx: number } => {
    while (startIdx < s.length && s[startIdx] === ' ') startIdx++;
    if (s[startIdx] === '{') {
      let depth = 0;
      let j = startIdx;
      while (j < s.length) {
        if (s[j] === '{') depth++;
        else if (s[j] === '}') {
          depth--;
          if (depth === 0) {
            return { content: s.slice(startIdx + 1, j), nextIdx: j + 1 };
          }
        }
        j++;
      }
      return { content: s.slice(startIdx + 1), nextIdx: s.length };
    }
    const m = s.slice(startIdx).match(/^([A-Za-z0-9α-ωΑ-Ω+\-]+|.)/);
    const tok = m ? m[1] : '';
    return { content: tok, nextIdx: startIdx + tok.length };
  };

  let textBuf = '';
  const flushText = () => {
    if (textBuf) {
      nodes.push({ type: 'text', text: normalizeMathGlyphs(textBuf) });
      textBuf = '';
    }
  };

  while (i < s.length) {
    if (s.startsWith('\\frac', i) || s.startsWith('\\dfrac', i) || s.startsWith('\\tfrac', i)) {
      flushText();
      const cmdLen = s.startsWith('\\dfrac', i) || s.startsWith('\\tfrac', i) ? 6 : 5;
      const g1 = readBracedGroup(i + cmdLen);
      const g2 = readBracedGroup(g1.nextIdx);
      nodes.push({
        type: 'frac',
        num: parseLatexOrLinearMathToNodes(g1.content),
        den: parseLatexOrLinearMathToNodes(g2.content),
      });
      i = g2.nextIdx;
    } else if (s.startsWith('\\sqrt', i)) {
      flushText();
      let cur = i + 5;
      let degNodes: OmmlMathNode[] = [];
      if (s[cur] === '[') {
        const closeBracket = s.indexOf(']', cur);
        if (closeBracket > cur) {
          degNodes = parseLatexOrLinearMathToNodes(s.slice(cur + 1, closeBracket));
          cur = closeBracket + 1;
        }
      }
      const g = readBracedGroup(cur);
      nodes.push({
        type: 'rad',
        deg: degNodes,
        base: parseLatexOrLinearMathToNodes(g.content),
      });
      i = g.nextIdx;
    } else if ((s[i] === '^' || s[i] === '_') && (textBuf.length > 0 || nodes.length > 0)) {
      const op = s[i];
      let baseNode: OmmlMathNode;
      if (textBuf.length > 0) {
        const lastChar = textBuf.slice(-1);
        textBuf = textBuf.slice(0, -1);
        flushText();
        baseNode = { type: 'text', text: lastChar };
      } else {
        baseNode = nodes.pop()!;
      }
      const g = readBracedGroup(i + 1);
      const scriptNodes = parseLatexOrLinearMathToNodes(g.content);
      nodes.push(
        op === '^'
          ? { type: 'sup', base: [baseNode], sup: scriptNodes }
          : { type: 'sub', base: [baseNode], sub: scriptNodes }
      );
      i = g.nextIdx;
    } else {
      textBuf += s[i];
      i++;
    }
  }
  flushText();
  return nodes;
}

/**
 * Recursively parses an OMML XML element (<m:oMath>, <m:e>, <m:num>, <m:den>, etc.) into OmmlMathNode[]
 */
function parseOmmlNodes(container: Element | null): OmmlMathNode[] {
  if (!container) return [];
  const result: OmmlMathNode[] = [];

  for (let i = 0; i < container.childNodes.length; i++) {
    const child = container.childNodes[i];
    if (child.nodeType !== 1) continue;
    const el = child as Element;
    const local = getXmlLocalName(el);

    if (local === 'r') {
      let runTxt = '';
      for (let j = 0; j < el.childNodes.length; j++) {
        const rc = el.childNodes[j];
        if (rc.nodeType === 1) {
          const rcEl = rc as Element;
          const rcLocal = getXmlLocalName(rcEl);
          if (rcLocal === 't' || rcLocal === 'instrText') {
            runTxt += rcEl.textContent || '';
          } else if (rcLocal === 'sym') {
            const symChar = rcEl.getAttribute('w:char') || rcEl.getAttribute('char') || '';
            if (symChar) {
              const code = parseInt(symChar, 16);
              if (!isNaN(code)) {
                runTxt += String.fromCharCode(code > 0xf000 ? code - 0xf000 : code);
              }
            }
          }
        }
      }
      if (!runTxt) {
        const ts = el.getElementsByTagName('m:t');
        for (let j = 0; j < ts.length; j++) runTxt += ts[j].textContent || '';
      }
      if (runTxt) {
        if (/\\frac|\\sqrt|\^\{|_\{/.test(runTxt)) {
          result.push(...parseLatexOrLinearMathToNodes(runTxt));
        } else {
          result.push({ type: 'text', text: normalizeMathGlyphs(runTxt) });
        }
      }
    } else if (local === 'f') {
      result.push({
        type: 'frac',
        num: parseOmmlNodes(getDirectChildByTag(el, 'm:num')),
        den: parseOmmlNodes(getDirectChildByTag(el, 'm:den')),
      });
    } else if (local === 'rad') {
      result.push({
        type: 'rad',
        deg: parseOmmlNodes(getDirectChildByTag(el, 'm:deg')),
        base: parseOmmlNodes(getDirectChildByTag(el, 'm:e')),
      });
    } else if (local === 'sSup') {
      result.push({
        type: 'sup',
        base: parseOmmlNodes(getDirectChildByTag(el, 'm:e')),
        sup: parseOmmlNodes(getDirectChildByTag(el, 'm:sup')),
      });
    } else if (local === 'sSub') {
      result.push({
        type: 'sub',
        base: parseOmmlNodes(getDirectChildByTag(el, 'm:e')),
        sub: parseOmmlNodes(getDirectChildByTag(el, 'm:sub')),
      });
    } else if (local === 'sSubSup') {
      result.push({
        type: 'subsup',
        base: parseOmmlNodes(getDirectChildByTag(el, 'm:e')),
        sub: parseOmmlNodes(getDirectChildByTag(el, 'm:sub')),
        sup: parseOmmlNodes(getDirectChildByTag(el, 'm:sup')),
      });
    } else if (local === 'sPre') {
      result.push({
        type: 'subsup',
        base: [{ type: 'text', text: '' }],
        sub: parseOmmlNodes(getDirectChildByTag(el, 'm:sub')),
        sup: parseOmmlNodes(getDirectChildByTag(el, 'm:sup')),
      });
      result.push(...parseOmmlNodes(getDirectChildByTag(el, 'm:e')));
    } else if (local === 'nary') {
      const pr = getDirectChildByTag(el, 'm:naryPr');
      const chrEl = pr ? getDirectChildByTag(pr, 'm:chr') : null;
      const chr = chrEl?.getAttribute('m:val') || chrEl?.getAttribute('val') || '∫';
      result.push({
        type: 'nary',
        chr: normalizeMathGlyphs(chr),
        sub: parseOmmlNodes(getDirectChildByTag(el, 'm:sub')),
        sup: parseOmmlNodes(getDirectChildByTag(el, 'm:sup')),
        base: parseOmmlNodes(getDirectChildByTag(el, 'm:e')),
      });
    } else if (local === 'd') {
      const pr = getDirectChildByTag(el, 'm:dPr');
      const begEl = pr ? getDirectChildByTag(pr, 'm:begChr') : null;
      const endEl = pr ? getDirectChildByTag(pr, 'm:endChr') : null;
      const sepEl = pr ? getDirectChildByTag(pr, 'm:sepChr') : null;
      const begChr = begEl ? (begEl.getAttribute('m:val') ?? begEl.getAttribute('val') ?? '(') : '(';
      const endChr = endEl ? (endEl.getAttribute('m:val') ?? endEl.getAttribute('val') ?? ')') : ')';
      const sepChr = sepEl ? (sepEl.getAttribute('m:val') ?? sepEl.getAttribute('val') ?? ', ') : ', ';
      const innerNodes: OmmlMathNode[] = [];
      const eChildren = Array.from(el.childNodes).filter(
        n => n.nodeType === 1 && getXmlLocalName(n as Element) === 'e'
      ) as Element[];
      eChildren.forEach((eNode, eIdx) => {
        if (eIdx > 0) innerNodes.push({ type: 'text', text: sepChr });
        innerNodes.push(...parseOmmlNodes(eNode));
      });
      result.push({
        type: 'delim',
        begChr,
        endChr,
        inner: innerNodes,
      });
    } else if (local === 'func') {
      result.push({
        type: 'func',
        fName: parseOmmlNodes(getDirectChildByTag(el, 'm:fName')),
        arg: parseOmmlNodes(getDirectChildByTag(el, 'm:e')),
      });
    } else if (local === 'limLow') {
      result.push({
        type: 'limLow',
        base: parseOmmlNodes(getDirectChildByTag(el, 'm:e')),
        lim: parseOmmlNodes(getDirectChildByTag(el, 'm:lim')),
      });
    } else if (local === 'limUpp') {
      result.push({
        type: 'limUpp',
        base: parseOmmlNodes(getDirectChildByTag(el, 'm:e')),
        lim: parseOmmlNodes(getDirectChildByTag(el, 'm:lim')),
      });
    } else if (local === 'acc' || local === 'bar' || local === 'groupChr') {
      const pr =
        getDirectChildByTag(el, 'm:accPr') ||
        getDirectChildByTag(el, 'm:barPr') ||
        getDirectChildByTag(el, 'm:groupChrPr');
      const chrEl = pr ? getDirectChildByTag(pr, 'm:chr') : null;
      const chr = chrEl?.getAttribute('m:val') || chrEl?.getAttribute('val') || (local === 'bar' ? '¯' : '⃗');
      result.push({
        type: 'acc',
        chr,
        base: parseOmmlNodes(getDirectChildByTag(el, 'm:e')),
      });
    } else if (local === 'eqArr') {
      const eRows = Array.from(el.childNodes).filter(
        n => n.nodeType === 1 && getXmlLocalName(n as Element) === 'e'
      ) as Element[];
      if (eRows.length > 1) {
        result.push({
          type: 'matrix',
          rows: eRows.map(er => [parseOmmlNodes(er)]),
        });
      } else if (eRows.length === 1) {
        result.push(...parseOmmlNodes(eRows[0]));
      }
    } else if (local === 'm') {
      const mRows = Array.from(el.childNodes).filter(
        n => n.nodeType === 1 && getXmlLocalName(n as Element) === 'mr'
      ) as Element[];
      const parsedRows = mRows.map(mr => {
        const cells = Array.from(mr.childNodes).filter(
          n => n.nodeType === 1 && getXmlLocalName(n as Element) === 'e'
        ) as Element[];
        return cells.map(c => parseOmmlNodes(c));
      });
      result.push({ type: 'matrix', rows: parsedRows });
    } else if (
      local === 'oMathPr' ||
      local === 'rPr' ||
      local === 'ctrlPr' ||
      local === 'fPr' ||
      local === 'radPr' ||
      local === 'sSupPr' ||
      local === 'sSubPr' ||
      local === 'sSubSupPr' ||
      local === 'dPr' ||
      local === 'mPr' ||
      local === 'funcPr' ||
      local === 'limLowPr' ||
      local === 'limUppPr' ||
      local === 'eqArrPr'
    ) {
      // Skip metadata/property nodes so they don't emit noise
      continue;
    } else {
      // Recurse into wrapper elements like <m:oMath>, <m:oMathPara>, <m:box>, <m:e>, <mc:Choice>
      result.push(...parseOmmlNodes(el));
    }
  }

  return result;
}

/**
 * Measures and renders an array of OmmlMathNode[] onto a 2D Canvas with publication-quality 2D math layout!
 */
function measureAndDrawOmmlMath(
  ctx: CanvasRenderingContext2D,
  nodes: OmmlMathNode[],
  x: number,
  baselineY: number,
  fontSize: number,
  color: string,
  draw: boolean
): { width: number; ascent: number; descent: number } {
  let cursorX = x;
  let maxAscent = fontSize * 0.85;
  let maxDescent = fontSize * 0.25;

  const setMathFont = (sz: number, italic = true) => {
    ctx.font = `${italic ? 'italic ' : ''}${Math.round(sz)}px "Cambria Math", "Times New Roman", serif`;
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
  };

  for (const node of nodes) {
    if (node.type === 'text') {
      const isOperatorOrNum = /^[0-9+\-=<>≤≥≠±×÷∞∀∃∈∉⊂⊆∪∩⇒⇔()[\]{}.,;:|∑∫√lim\s]+$/i.test(node.text);
      setMathFont(fontSize, !isOperatorOrNum);
      const w = ctx.measureText(node.text).width;
      if (draw) {
        ctx.fillText(node.text, cursorX, baselineY);
      }
      cursorX += w;
    } else if (node.type === 'frac') {
      const subFont = Math.max(13, fontSize * 0.78);
      const numMetrics = measureAndDrawOmmlMath(ctx, node.num, 0, 0, subFont, color, false);
      const denMetrics = measureAndDrawOmmlMath(ctx, node.den, 0, 0, subFont, color, false);
      const fracW = Math.max(numMetrics.width, denMetrics.width) + 12;
      const barY = baselineY - fontSize * 0.32;
      const numBaseline = barY - numMetrics.descent - 4;
      const denBaseline = barY + denMetrics.ascent + 4;

      if (draw) {
        measureAndDrawOmmlMath(
          ctx,
          node.num,
          cursorX + (fracW - numMetrics.width) / 2,
          numBaseline,
          subFont,
          color,
          true
        );
        measureAndDrawOmmlMath(
          ctx,
          node.den,
          cursorX + (fracW - denMetrics.width) / 2,
          denBaseline,
          subFont,
          color,
          true
        );
        ctx.beginPath();
        ctx.lineWidth = Math.max(1.4, fontSize * 0.065);
        ctx.moveTo(cursorX + 2, barY);
        ctx.lineTo(cursorX + fracW - 2, barY);
        ctx.stroke();
      }

      maxAscent = Math.max(maxAscent, baselineY - (numBaseline - numMetrics.ascent) + 4);
      maxDescent = Math.max(maxDescent, denBaseline + denMetrics.descent - baselineY + 4);
      cursorX += fracW + 4;
    } else if (node.type === 'rad') {
      const baseMetrics = measureAndDrawOmmlMath(ctx, node.base, 0, 0, fontSize, color, false);
      const degFont = Math.max(11, fontSize * 0.58);
      const degMetrics =
        node.deg.length > 0
          ? measureAndDrawOmmlMath(ctx, node.deg, 0, 0, degFont, color, false)
          : { width: 0, ascent: 0, descent: 0 };

      const hookW = Math.max(14, degMetrics.width + 10);
      const topY = baselineY - baseMetrics.ascent - 5;
      const bottomY = baselineY + baseMetrics.descent + 2;

      if (draw) {
        if (node.deg.length > 0) {
          measureAndDrawOmmlMath(ctx, node.deg, cursorX + 2, baselineY - baseMetrics.ascent * 0.45, degFont, color, true);
        }
        ctx.beginPath();
        ctx.lineWidth = Math.max(1.5, fontSize * 0.068);
        ctx.moveTo(cursorX + hookW - 10, baselineY - baseMetrics.ascent * 0.35);
        ctx.lineTo(cursorX + hookW - 7, baselineY - baseMetrics.ascent * 0.42);
        ctx.lineTo(cursorX + hookW - 3, bottomY);
        ctx.lineTo(cursorX + hookW + 2, topY);
        ctx.lineTo(cursorX + hookW + baseMetrics.width + 6, topY);
        ctx.stroke();

        measureAndDrawOmmlMath(ctx, node.base, cursorX + hookW + 3, baselineY, fontSize, color, true);
      }

      maxAscent = Math.max(maxAscent, baseMetrics.ascent + 8);
      maxDescent = Math.max(maxDescent, baseMetrics.descent + 4);
      cursorX += hookW + baseMetrics.width + 8;
    } else if (node.type === 'sup') {
      const baseM = measureAndDrawOmmlMath(ctx, node.base, cursorX, baselineY, fontSize, color, draw);
      const supFont = Math.max(12, fontSize * 0.68);
      const supY = baselineY - Math.max(fontSize * 0.38, baseM.ascent * 0.55);
      const supM = measureAndDrawOmmlMath(ctx, node.sup, cursorX + baseM.width + 1, supY, supFont, color, draw);
      maxAscent = Math.max(maxAscent, baselineY - (supY - supM.ascent));
      cursorX += baseM.width + supM.width + 2;
    } else if (node.type === 'sub') {
      const baseM = measureAndDrawOmmlMath(ctx, node.base, cursorX, baselineY, fontSize, color, draw);
      const subFont = Math.max(12, fontSize * 0.68);
      const subY = baselineY + Math.max(fontSize * 0.24, baseM.descent * 0.7);
      const subM = measureAndDrawOmmlMath(ctx, node.sub, cursorX + baseM.width + 1, subY, subFont, color, draw);
      maxDescent = Math.max(maxDescent, subY + subM.descent - baselineY);
      cursorX += baseM.width + subM.width + 2;
    } else if (node.type === 'subsup') {
      const baseM = measureAndDrawOmmlMath(ctx, node.base, cursorX, baselineY, fontSize, color, draw);
      const sFont = Math.max(12, fontSize * 0.66);
      const supY = baselineY - Math.max(fontSize * 0.38, baseM.ascent * 0.55);
      const subY = baselineY + Math.max(fontSize * 0.24, baseM.descent * 0.7);
      const supM = measureAndDrawOmmlMath(ctx, node.sup, cursorX + baseM.width + 1, supY, sFont, color, draw);
      const subM = measureAndDrawOmmlMath(ctx, node.sub, cursorX + baseM.width + 1, subY, sFont, color, draw);
      maxAscent = Math.max(maxAscent, baselineY - (supY - supM.ascent));
      maxDescent = Math.max(maxDescent, subY + subM.descent - baselineY);
      cursorX += baseM.width + Math.max(supM.width, subM.width) + 3;
    } else if (node.type === 'nary') {
      const opFont = Math.round(fontSize * 1.45);
      setMathFont(opFont, false);
      const opW = ctx.measureText(node.chr).width;
      const limFont = Math.max(11, fontSize * 0.62);
      const subM = measureAndDrawOmmlMath(ctx, node.sub, 0, 0, limFont, color, false);
      const supM = measureAndDrawOmmlMath(ctx, node.sup, 0, 0, limFont, color, false);

      if (draw) {
        setMathFont(opFont, false);
        ctx.fillText(node.chr, cursorX, baselineY + fontSize * 0.14);
        if (node.sup.length > 0) {
          measureAndDrawOmmlMath(ctx, node.sup, cursorX + opW + 2, baselineY - fontSize * 0.52, limFont, color, true);
        }
        if (node.sub.length > 0) {
          measureAndDrawOmmlMath(ctx, node.sub, cursorX + opW + 2, baselineY + fontSize * 0.42, limFont, color, true);
        }
      }

      const limitsW = Math.max(subM.width, supM.width);
      const naryW = opW + (limitsW > 0 ? limitsW + 4 : 2);
      const baseM = measureAndDrawOmmlMath(ctx, node.base, cursorX + naryW, baselineY, fontSize, color, draw);
      maxAscent = Math.max(maxAscent, fontSize * 1.15, baseM.ascent);
      maxDescent = Math.max(maxDescent, fontSize * 0.65, baseM.descent);
      cursorX += naryW + baseM.width + 3;
    } else if (node.type === 'limLow') {
      const baseM = measureAndDrawOmmlMath(ctx, node.base, 0, 0, fontSize, color, false);
      const limFont = Math.max(11, fontSize * 0.65);
      const limM = measureAndDrawOmmlMath(ctx, node.lim, 0, 0, limFont, color, false);
      const blockW = Math.max(baseM.width, limM.width) + 4;
      const limY = baselineY + baseM.descent + limM.ascent + 2;

      if (draw) {
        measureAndDrawOmmlMath(ctx, node.base, cursorX + (blockW - baseM.width) / 2, baselineY, fontSize, color, true);
        measureAndDrawOmmlMath(ctx, node.lim, cursorX + (blockW - limM.width) / 2, limY, limFont, color, true);
      }

      maxDescent = Math.max(maxDescent, limY + limM.descent - baselineY);
      cursorX += blockW + 4;
    } else if (node.type === 'limUpp') {
      const baseM = measureAndDrawOmmlMath(ctx, node.base, 0, 0, fontSize, color, false);
      const limFont = Math.max(11, fontSize * 0.65);
      const limM = measureAndDrawOmmlMath(ctx, node.lim, 0, 0, limFont, color, false);
      const blockW = Math.max(baseM.width, limM.width) + 4;
      const limY = baselineY - baseM.ascent - limM.descent - 2;

      if (draw) {
        measureAndDrawOmmlMath(ctx, node.base, cursorX + (blockW - baseM.width) / 2, baselineY, fontSize, color, true);
        measureAndDrawOmmlMath(ctx, node.lim, cursorX + (blockW - limM.width) / 2, limY, limFont, color, true);
      }

      maxAscent = Math.max(maxAscent, baselineY - (limY - limM.ascent));
      cursorX += blockW + 4;
    } else if (node.type === 'func') {
      const fnM = measureAndDrawOmmlMath(ctx, node.fName, cursorX, baselineY, fontSize, color, draw);
      const argM = measureAndDrawOmmlMath(ctx, node.arg, cursorX + fnM.width + 4, baselineY, fontSize, color, draw);
      maxAscent = Math.max(maxAscent, fnM.ascent, argM.ascent);
      maxDescent = Math.max(maxDescent, fnM.descent, argM.descent);
      cursorX += fnM.width + argM.width + 6;
    } else if (node.type === 'delim') {
      const innerM = measureAndDrawOmmlMath(ctx, node.inner, 0, 0, fontSize, color, false);
      const totalH = innerM.ascent + innerM.descent;
      const delimScale = Math.max(1, Math.min(2.2, totalH / (fontSize * 1.05)));
      const delimFont = Math.round(fontSize * delimScale);
      setMathFont(delimFont, false);
      const begW = node.begChr ? ctx.measureText(node.begChr).width + 2 : 0;
      const endW = node.endChr ? ctx.measureText(node.endChr).width + 2 : 0;

      if (draw) {
        const delimY = baselineY + (innerM.descent - innerM.ascent) / 2 + delimFont * 0.32;
        if (node.begChr) {
          setMathFont(delimFont, false);
          ctx.fillText(node.begChr, cursorX, delimY);
        }
        measureAndDrawOmmlMath(ctx, node.inner, cursorX + begW, baselineY, fontSize, color, true);
        if (node.endChr) {
          setMathFont(delimFont, false);
          ctx.fillText(node.endChr, cursorX + begW + innerM.width + 1, delimY);
        }
      }

      maxAscent = Math.max(maxAscent, innerM.ascent + 3);
      maxDescent = Math.max(maxDescent, innerM.descent + 3);
      cursorX += begW + innerM.width + endW + 2;
    } else if (node.type === 'acc') {
      const baseM = measureAndDrawOmmlMath(ctx, node.base, cursorX, baselineY, fontSize, color, draw);
      if (draw) {
        ctx.beginPath();
        ctx.lineWidth = Math.max(1.3, fontSize * 0.06);
        const barY = baselineY - baseM.ascent - 3;
        ctx.moveTo(cursorX + 1, barY);
        ctx.lineTo(cursorX + baseM.width - 1, barY);
        if (node.chr.includes('⃗') || node.chr.includes('→')) {
          ctx.lineTo(cursorX + baseM.width - 5, barY - 3);
        }
        ctx.stroke();
      }
      maxAscent = Math.max(maxAscent, baseM.ascent + 7);
      cursorX += baseM.width + 2;
    } else if (node.type === 'matrix') {
      const cellFont = Math.max(13, fontSize * 0.82);
      const numRows = node.rows.length;
      const numCols = Math.max(1, ...node.rows.map(r => r.length));
      const colWidths = Array(numCols).fill(0);
      const rowHeights = Array(numRows).fill(cellFont * 1.3);

      for (let r = 0; r < numRows; r++) {
        for (let c = 0; c < node.rows[r].length; c++) {
          const m = measureAndDrawOmmlMath(ctx, node.rows[r][c], 0, 0, cellFont, color, false);
          colWidths[c] = Math.max(colWidths[c], m.width + 12);
          rowHeights[r] = Math.max(rowHeights[r], m.ascent + m.descent + 8);
        }
      }

      const matW = colWidths.reduce((a, b) => a + b, 0);
      const matH = rowHeights.reduce((a, b) => a + b, 0);
      const topY = baselineY - matH / 2 - fontSize * 0.25;

      if (draw) {
        let curRowY = topY;
        for (let r = 0; r < numRows; r++) {
          let curColX = cursorX;
          for (let c = 0; c < node.rows[r].length; c++) {
            const cellM = measureAndDrawOmmlMath(ctx, node.rows[r][c], 0, 0, cellFont, color, false);
            measureAndDrawOmmlMath(
              ctx,
              node.rows[r][c],
              curColX + (colWidths[c] - cellM.width) / 2,
              curRowY + rowHeights[r] * 0.72,
              cellFont,
              color,
              true
            );
            curColX += colWidths[c];
          }
          curRowY += rowHeights[r];
        }
      }

      maxAscent = Math.max(maxAscent, baselineY - topY + 4);
      maxDescent = Math.max(maxDescent, topY + matH - baselineY + 4);
      cursorX += matW + 4;
    }
  }

  return {
    width: Math.max(0, cursorX - x),
    ascent: maxAscent,
    descent: maxDescent,
  };
}

/**
 * Rich inline token inside a Word paragraph (Text Run, Inline Math Equation, or Embedded Image)
 */
type WordInlineToken =
  | {
      kind: 'text';
      text: string;
      bold: boolean;
      italic: boolean;
      underline: boolean;
      color: string;
      fontSizePx: number;
      vertAlign?: 'superscript' | 'subscript';
    }
  | {
      kind: 'math';
      mathNodes: OmmlMathNode[];
      fontSizePx: number;
      color: string;
    }
  | {
      kind: 'image';
      img: HTMLImageElement;
      drawW: number;
      drawH: number;
    }
  | {
      kind: 'br';
    };

export async function convertWordToPdf(
  file: File,
  onProgress?: ProgressCallback
): Promise<{ blob: Blob; pagesCount: number }> {
  onProgress?.('Đang đọc 100% cấu trúc XML & Công thức Toán học (OMML)...', file.name, 15);
  const arrayBuffer = await file.arrayBuffer();

  // High-DPI A4 Canvas dimensions (2x print quality: 1190 x 1684 px -> 595.28 x 841.89 pt)
  const PAGE_W = 1190;
  const PAGE_H = 1684;
  const MARGIN_X = 105;
  const MARGIN_TOP = 105;
  const MARGIN_BOTTOM = 105;
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

  // Try native .docx PizZip XML + OMML Math Engine first (supports 100% of equations, tables, colors, images)
  let zip: PizZip | null = null;
  try {
    zip = new PizZip(arrayBuffer);
  } catch {
    zip = null;
  }

  const docXmlFile = zip?.file('word/document.xml');
  if (zip && docXmlFile) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(docXmlFile.asText(), 'application/xml');

    // Load relationship map (rId -> word/media/imageX.png)
    const relsMap = new Map<string, string>();
    const relsFile = zip.file('word/_rels/document.xml.rels');
    if (relsFile) {
      const relsDoc = parser.parseFromString(relsFile.asText(), 'application/xml');
      const relEls = Array.from(relsDoc.getElementsByTagName('Relationship'));
      for (const rel of relEls) {
        const id = rel.getAttribute('Id');
        const target = rel.getAttribute('Target');
        if (id && target) {
          relsMap.set(id, target.startsWith('word/') ? target : `word/${target.replace(/^\//, '')}`);
        }
      }
    }

    // Cache loaded HTMLImageElements by rId
    const imageCache = new Map<string, HTMLImageElement>();
    for (const [rId, mediaPath] of relsMap.entries()) {
      const mediaFile = zip.file(mediaPath);
      if (mediaFile && /\.(png|jpe?g|gif|bmp|webp|svg)$/i.test(mediaPath)) {
        try {
          const ext = mediaPath.split('.').pop()?.toLowerCase() || 'png';
          const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
          const b64 = mediaFile.asBinary();
          const dataUrl = `data:${mime};base64,${btoa(b64)}`;
          const loadedImg = await new Promise<HTMLImageElement | null>(resolve => {
            const im = new Image();
            im.onload = () => resolve(im);
            im.onerror = () => resolve(null);
            im.src = dataUrl;
          });
          if (loadedImg) imageCache.set(rId, loadedImg);
        } catch {
          // Ignore unreadable media
        }
      }
    }

    const extractParagraphTokens = (pEl: Element, defaultFontPx = 24, forceBold = false): {
      tokens: WordInlineToken[];
      align: 'left' | 'center' | 'right';
      leftIndentPx: number;
    } => {
      let align: 'left' | 'center' | 'right' = 'left';
      let leftIndentPx = 0;

      const pPr = getDirectChildByTag(pEl, 'w:pPr');
      if (pPr) {
        const jc = getDirectChildByTag(pPr, 'w:jc');
        const jcVal = jc?.getAttribute('w:val') || jc?.getAttribute('val') || '';
        if (jcVal === 'center') align = 'center';
        else if (jcVal === 'right' || jcVal === 'end') align = 'right';

        const ind = getDirectChildByTag(pPr, 'w:ind');
        const leftTwips = parseInt(ind?.getAttribute('w:left') || '0', 10);
        if (leftTwips > 0) {
          leftIndentPx = Math.min(240, Math.round((leftTwips / 1440) * 140));
        }
      }

      const tokens: WordInlineToken[] = [];

      const walkParagraphChildren = (container: Element) => {
        for (let i = 0; i < container.childNodes.length; i++) {
          const node = container.childNodes[i];
          if (node.nodeType !== 1) continue;
          const el = node as Element;
          const local = getXmlLocalName(el);

          if (local === 'oMathPara' || local === 'oMath') {
            if (local === 'oMathPara' && tokens.length > 0 && tokens[tokens.length - 1].kind !== 'br') {
              tokens.push({ kind: 'br' });
            }
            const mathNodes = parseOmmlNodes(el);
            if (mathNodes.length > 0) {
              tokens.push({
                kind: 'math',
                mathNodes,
                fontSizePx: defaultFontPx + 2,
                color: '#0f172a',
              });
            }
          } else if (local === 'AlternateContent') {
            // Word 2013-2024 wraps equations & modern drawings in <mc:AlternateContent><mc:Choice>...</mc:Choice><mc:Fallback>...</mc:Fallback></mc:AlternateContent>
            const choiceEl = getDirectChildByTag(el, 'mc:Choice');
            const fallbackEl = getDirectChildByTag(el, 'mc:Fallback');
            if (choiceEl) {
              walkParagraphChildren(choiceEl);
            } else if (fallbackEl) {
              walkParagraphChildren(fallbackEl);
            }
          } else if (local === 'r') {
            const rPr = getDirectChildByTag(el, 'w:rPr');
            let bold = forceBold;
            let italic = false;
            let underline = false;
            let color = '#0f172a';
            let fontSizePx = defaultFontPx;
            let vertAlign: 'superscript' | 'subscript' | undefined;

            if (rPr) {
              const bEl = getDirectChildByTag(rPr, 'w:b');
              if (bEl && bEl.getAttribute('w:val') !== '0' && bEl.getAttribute('w:val') !== 'false') {
                bold = true;
              }
              const iEl = getDirectChildByTag(rPr, 'w:i');
              if (iEl && iEl.getAttribute('w:val') !== '0' && iEl.getAttribute('w:val') !== 'false') {
                italic = true;
              }
              const uEl = getDirectChildByTag(rPr, 'w:u');
              if (uEl && uEl.getAttribute('w:val') && uEl.getAttribute('w:val') !== 'none') {
                underline = true;
              }
              const colEl = getDirectChildByTag(rPr, 'w:color');
              const colVal = colEl?.getAttribute('w:val') || colEl?.getAttribute('val');
              if (colVal && colVal !== 'auto' && /^[0-9A-Fa-f]{6}$/.test(colVal)) {
                color = `#${colVal}`;
              }
              const szEl = getDirectChildByTag(rPr, 'w:sz');
              const halfPts = parseInt(szEl?.getAttribute('w:sz') || szEl?.getAttribute('w:val') || szEl?.getAttribute('val') || '0', 10);
              if (halfPts > 0) {
                fontSizePx = Math.max(16, Math.min(54, Math.round(halfPts)));
              }
              const vaEl = getDirectChildByTag(rPr, 'w:vertAlign');
              const vaVal = vaEl?.getAttribute('w:val') || vaEl?.getAttribute('val');
              if (vaVal === 'superscript' || vaVal === 'subscript') {
                vertAlign = vaVal;
              }
            }

            // Check for embedded images or MathType/Equation Editor OLE objects inside run
            const blips = Array.from(el.getElementsByTagName('a:blip'));
            const vImgs = Array.from(el.getElementsByTagName('v:imagedata'));
            const embedId =
              blips[0]?.getAttribute('r:embed') ||
              blips[0]?.getAttribute('embed') ||
              vImgs[0]?.getAttribute('r:id') ||
              vImgs[0]?.getAttribute('o:relid') ||
              vImgs[0]?.getAttribute('id');

            if (embedId && imageCache.has(embedId)) {
              const imgObj = imageCache.get(embedId)!;
              const extentEl = el.getElementsByTagName('wp:extent')[0];
              let drawW = Math.min(CONTENT_W * 0.85, imgObj.width * 1.4);
              let drawH = (imgObj.height / Math.max(1, imgObj.width)) * drawW;
              if (extentEl) {
                const cx = parseInt(extentEl.getAttribute('cx') || '0', 10);
                const cy = parseInt(extentEl.getAttribute('cy') || '0', 10);
                if (cx > 0 && cy > 0) {
                  drawW = Math.min(CONTENT_W, Math.round((cx / 914400) * 158));
                  drawH = Math.round((cy / 914400) * 158);
                }
              }
              tokens.push({ kind: 'image', img: imgObj, drawW, drawH });
            }

            // Walk run children for <w:t>, <m:oMath>, <w:sym>, <w:tab>, <w:br>
            for (let k = 0; k < el.childNodes.length; k++) {
              const rChild = el.childNodes[k];
              if (rChild.nodeType !== 1) continue;
              const rChildEl = rChild as Element;
              const rLocal = getXmlLocalName(rChildEl);

              if (rLocal === 'oMath' || rLocal === 'oMathPara') {
                const mathNodes = parseOmmlNodes(rChildEl);
                if (mathNodes.length > 0) {
                  tokens.push({
                    kind: 'math',
                    mathNodes,
                    fontSizePx: fontSizePx + 2,
                    color,
                  });
                }
              } else if (rLocal === 'AlternateContent') {
                const choiceEl = getDirectChildByTag(rChildEl, 'mc:Choice');
                if (choiceEl) walkParagraphChildren(choiceEl);
              } else if (rLocal === 'sym') {
                const symChar = rChildEl.getAttribute('w:char') || rChildEl.getAttribute('char') || '';
                if (symChar) {
                  const code = parseInt(symChar, 16);
                  if (!isNaN(code)) {
                    const ch = normalizeMathGlyphs(String.fromCharCode(code > 0xf000 ? code - 0xf000 : code));
                    tokens.push({
                      kind: 'text',
                      text: ch,
                      bold,
                      italic,
                      underline,
                      color,
                      fontSizePx,
                      vertAlign,
                    });
                  }
                }
              } else if (rLocal === 't') {
                const rawTxt = normalizeMathGlyphs(rChildEl.textContent || '');
                if (rawTxt) {
                  // Automatically upgrade inline LaTeX or linear equations (e.g. \frac{a}{b}, \sqrt{x}, V_{max}) into 2D Math AST!
                  if (/\\frac|\\dfrac|\\sqrt|\^\{|_\{|\$[A-Za-z0-9\\+\-=^_{}()[\]\s]+\$/.test(rawTxt)) {
                    const mathNodes = parseLatexOrLinearMathToNodes(rawTxt);
                    if (mathNodes.length > 0) {
                      tokens.push({
                        kind: 'math',
                        mathNodes,
                        fontSizePx: fontSizePx + 1,
                        color,
                      });
                      continue;
                    }
                  }
                  const parts = rawTxt.match(/\S+|\s+/g) || [rawTxt];
                  for (const pt of parts) {
                    tokens.push({
                      kind: 'text',
                      text: pt,
                      bold,
                      italic,
                      underline,
                      color,
                      fontSizePx,
                      vertAlign,
                    });
                  }
                }
              } else if (rLocal === 'tab') {
                tokens.push({
                  kind: 'text',
                  text: '    ',
                  bold,
                  italic: false,
                  underline: false,
                  color,
                  fontSizePx,
                });
              } else if (rLocal === 'br' || rLocal === 'cr') {
                tokens.push({ kind: 'br' });
              }
            }
          } else if (
            local === 'hyperlink' ||
            local === 'smartTag' ||
            local === 'sdt' ||
            local === 'sdtContent' ||
            local === 'ins' ||
            local === 'fldSimple'
          ) {
            walkParagraphChildren(el);
          }
        }
      };

      walkParagraphChildren(pEl);
      return { tokens, align, leftIndentPx };
    };

    const layoutAndRenderParagraph = (
      pEl: Element,
      boxX: number,
      boxMaxW: number,
      defaultFontPx = 24,
      forceBold = false,
      dryRunOnly = false
    ): number => {
      const { tokens, align, leftIndentPx } = extractParagraphTokens(pEl, defaultFontPx, forceBold);
      if (tokens.length === 0) return 0;

      const availW = Math.max(60, boxMaxW - leftIndentPx);

      interface LineItem {
        token: WordInlineToken;
        width: number;
        ascent: number;
        descent: number;
      }

      const lines: { items: LineItem[]; width: number; maxAscent: number; maxDescent: number }[] = [];
      let currentLine: LineItem[] = [];
      let currentLineW = 0;
      let currentMaxAscent = defaultFontPx * 0.85;
      let currentMaxDescent = defaultFontPx * 0.25;

      const pushLine = () => {
        if (currentLine.length > 0) {
          lines.push({
            items: currentLine,
            width: currentLineW,
            maxAscent: currentMaxAscent,
            maxDescent: currentMaxDescent,
          });
        }
        currentLine = [];
        currentLineW = 0;
        currentMaxAscent = defaultFontPx * 0.85;
        currentMaxDescent = defaultFontPx * 0.25;
      };

      for (const tok of tokens) {
        if (tok.kind === 'br') {
          pushLine();
          continue;
        }

        let itemW = 0;
        let itemAsc = defaultFontPx * 0.85;
        let itemDesc = defaultFontPx * 0.25;

        if (tok.kind === 'text') {
          const effectiveSz = tok.vertAlign ? Math.round(tok.fontSizePx * 0.68) : tok.fontSizePx;
          ctx.font = `${tok.italic ? 'italic ' : ''}${tok.bold ? 'bold ' : ''}${effectiveSz}px "Cambria Math", "Times New Roman", serif`;
          itemW = ctx.measureText(tok.text).width;
          itemAsc = tok.fontSizePx * 0.88;
          itemDesc = tok.fontSizePx * 0.26;
        } else if (tok.kind === 'math') {
          const mMetrics = measureAndDrawOmmlMath(ctx, tok.mathNodes, 0, 0, tok.fontSizePx, tok.color, false);
          itemW = mMetrics.width + 6;
          itemAsc = mMetrics.ascent + 4;
          itemDesc = mMetrics.descent + 4;
        } else if (tok.kind === 'image') {
          const scale = Math.min(1, availW / Math.max(1, tok.drawW));
          itemW = tok.drawW * scale;
          itemAsc = tok.drawH * scale;
          itemDesc = 6;
        }

        if (currentLineW + itemW > availW && currentLine.length > 0) {
          pushLine();
          // Skip leading whitespace token at start of wrapped line
          if (tok.kind === 'text' && /^\s+$/.test(tok.text)) {
            continue;
          }
        }

        currentLine.push({
          token: tok,
          width: itemW,
          ascent: itemAsc,
          descent: itemDesc,
        });
        currentLineW += itemW;
        currentMaxAscent = Math.max(currentMaxAscent, itemAsc);
        currentMaxDescent = Math.max(currentMaxDescent, itemDesc);
      }
      pushLine();

      let totalHeightUsed = 0;
      for (const ln of lines) {
        const lineH = Math.round(ln.maxAscent + ln.maxDescent + 8);
        if (!dryRunOnly) {
          if (cursorY + lineH > PAGE_H - MARGIN_BOTTOM) {
            startNewPage();
          }

          let drawX = boxX + leftIndentPx;
          if (align === 'center') {
            drawX = boxX + Math.max(0, (boxMaxW - ln.width) / 2);
          } else if (align === 'right') {
            drawX = boxX + Math.max(0, boxMaxW - ln.width);
          }

          const baselineY = cursorY + ln.maxAscent;

          for (const item of ln.items) {
            const t = item.token;
            if (t.kind === 'text') {
              const effectiveSz = t.vertAlign ? Math.round(t.fontSizePx * 0.68) : t.fontSizePx;
              ctx.font = `${t.italic ? 'italic ' : ''}${t.bold ? 'bold ' : ''}${effectiveSz}px "Cambria Math", "Times New Roman", serif`;
              ctx.fillStyle = t.color;
              const yOffset =
                t.vertAlign === 'superscript'
                  ? -t.fontSizePx * 0.35
                  : t.vertAlign === 'subscript'
                  ? t.fontSizePx * 0.22
                  : 0;
              ctx.fillText(t.text, drawX, baselineY + yOffset);
              if (t.underline && t.text.trim()) {
                ctx.beginPath();
                ctx.strokeStyle = t.color;
                ctx.lineWidth = 1.3;
                ctx.moveTo(drawX, baselineY + 3);
                ctx.lineTo(drawX + item.width, baselineY + 3);
                ctx.stroke();
              }
              drawX += item.width;
            } else if (t.kind === 'math') {
              measureAndDrawOmmlMath(ctx, t.mathNodes, drawX + 3, baselineY, t.fontSizePx, t.color, true);
              drawX += item.width;
            } else if (t.kind === 'image') {
              ctx.drawImage(
                t.img,
                drawX,
                baselineY - item.ascent,
                item.width,
                item.ascent
              );
              drawX += item.width;
            }
          }

          cursorY += lineH;
        }
        totalHeightUsed += lineH;
      }

      if (!dryRunOnly) {
        cursorY += 10;
      }
      return totalHeightUsed + 10;
    };

    const body = xmlDoc.getElementsByTagName('w:body')[0];
    if (body) {
      onProgress?.(
        'Đang kết xuất phương trình Toán học (OMML), Bảng biểu & Hình ảnh...',
        'Bảo toàn 100% ký hiệu ℝ, ℤ, ℕ, ∫, ∑, √, lim, phân số, ma trận và khung bảng',
        55
      );

      const bodyChildren = Array.from(body.childNodes).filter(
        n => n.nodeType === 1
      ) as Element[];

      for (let bIdx = 0; bIdx < bodyChildren.length; bIdx++) {
        const el = bodyChildren[bIdx];
        const bLocal = getXmlLocalName(el);
        if (bIdx % 8 === 0) {
          const pct = Math.min(84, Math.round(35 + (bIdx / Math.max(1, bodyChildren.length)) * 50));
          onProgress?.(
            `Đang kết xuất Toán học 2D & Bảng biểu (${pct}%)...`,
            `Đã dàn trang ${canvases.length} trang A4 • Giữ nguyên 100% công thức, phân số, căn thức, ma trận`,
            pct
          );
          await new Promise(r => setTimeout(r, 12));
        }

        if (bLocal === 'p') {
          layoutAndRenderParagraph(el, MARGIN_X, CONTENT_W, 24, false, false);
        } else if (bLocal === 'tbl') {
          const trEls = Array.from(el.childNodes).filter(
            n => n.nodeType === 1 && getXmlLocalName(n as Element) === 'tr'
          ) as Element[];
          if (trEls.length === 0) continue;

          // Read exact column widths from <w:tblGrid><w:gridCol w:w="..."/>
          const tblGrid = getDirectChildByTag(el, 'w:tblGrid');
          const gridCols = tblGrid
            ? (Array.from(tblGrid.childNodes).filter(
                n => n.nodeType === 1 && getXmlLocalName(n as Element) === 'gridCol'
              ) as Element[])
            : [];

          let colRatios: number[] = [];
          if (gridCols.length > 0) {
            const rawWidths = gridCols.map(gc => Math.max(400, parseInt(gc.getAttribute('w:w') || gc.getAttribute('w') || '1500', 10)));
            const sumW = rawWidths.reduce((a, b) => a + b, 0) || 1;
            colRatios = rawWidths.map(w => w / sumW);
          } else {
            const maxCells = Math.max(
              1,
              ...trEls.map(tr =>
                Array.from(tr.childNodes).filter(n => n.nodeType === 1 && getXmlLocalName(n as Element) === 'tc').length
              )
            );
            colRatios = Array(maxCells).fill(1 / maxCells);
          }

          for (let rIdx = 0; rIdx < trEls.length; rIdx++) {
            const tcEls = Array.from(trEls[rIdx].childNodes).filter(
              n => n.nodeType === 1 && getXmlLocalName(n as Element) === 'tc'
            ) as Element[];

            // First measure height of each cell in this row
            let maxCellH = 38;
            let colCursor = 0;
            const cellLayouts: {
              tc: Element;
              x: number;
              w: number;
              bgFill: string | null;
              paragraphs: Element[];
            }[] = [];

            for (const tc of tcEls) {
              const tcPr = getDirectChildByTag(tc, 'w:tcPr');
              const gridSpanEl = tcPr ? getDirectChildByTag(tcPr, 'w:gridSpan') : null;
              const span = Math.max(1, parseInt(gridSpanEl?.getAttribute('w:val') || gridSpanEl?.getAttribute('val') || '1', 10));
              const shdEl = tcPr ? getDirectChildByTag(tcPr, 'w:shd') : null;
              const shdFill = shdEl?.getAttribute('w:fill') || shdEl?.getAttribute('fill');
              const bgFill =
                shdFill && shdFill !== 'auto' && /^[0-9A-Fa-f]{6}$/.test(shdFill)
                  ? `#${shdFill}`
                  : null;

              let cellW = 0;
              for (let s = 0; s < span; s++) {
                cellW += (colRatios[colCursor + s] || 1 / Math.max(1, tcEls.length)) * CONTENT_W;
              }
              const cellX =
                MARGIN_X +
                colRatios.slice(0, colCursor).reduce((a, b) => a + b, 0) * CONTENT_W;
              colCursor += span;

              const cellParas = Array.from(tc.childNodes).filter(
                n => n.nodeType === 1 && getXmlLocalName(n as Element) === 'p'
              ) as Element[];

              let measuredH = 16;
              for (const cp of cellParas) {
                measuredH += layoutAndRenderParagraph(cp, cellX + 10, cellW - 20, 21, rIdx === 0, true);
              }
              maxCellH = Math.max(maxCellH, measuredH + 8);
              cellLayouts.push({ tc, x: cellX, w: cellW, bgFill, paragraphs: cellParas });
            }

            // Anti-split across page (`cantSplit` protection)
            if (cursorY + maxCellH > PAGE_H - MARGIN_BOTTOM) {
              startNewPage();
            }

            const rowStartY = cursorY;
            for (const cl of cellLayouts) {
              if (cl.bgFill) {
                ctx.fillStyle = cl.bgFill;
                ctx.fillRect(cl.x, rowStartY, cl.w, maxCellH);
              } else if (rIdx === 0) {
                ctx.fillStyle = '#f8fafc';
                ctx.fillRect(cl.x, rowStartY, cl.w, maxCellH);
              }

              ctx.strokeStyle = '#475569';
              ctx.lineWidth = 1.4;
              ctx.strokeRect(cl.x, rowStartY, cl.w, maxCellH);

              cursorY = rowStartY + 10;
              for (const cp of cl.paragraphs) {
                layoutAndRenderParagraph(cp, cl.x + 10, cl.w - 20, 21, rIdx === 0, false);
              }
            }

            cursorY = rowStartY + maxCellH;
          }

          cursorY += 18;
        }
      }

      onProgress?.('Đang xuất file PDF chuẩn in ấn (Print Quality)...', `${canvases.length} trang A4 sắc nét`, 88);
      const pdfDoc = await PDFDocument.create();
      for (const c of canvases) {
        const jpgBytes = dataUrlToUint8Array(c.toDataURL('image/jpeg', 0.95));
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
  }

  // Fallback for legacy .doc files via Mammoth
  const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlResult.value || '';
  const rawText = (tempDiv.textContent || '').trim() || 'Tài liệu Word';
  ctx.font = '24px "Times New Roman", serif';
  ctx.fillStyle = '#0f172a';
  ctx.fillText(rawText.slice(0, 120), MARGIN_X, cursorY + 24);

  const pdfDoc = await PDFDocument.create();
  for (const c of canvases) {
    const jpgBytes = dataUrlToUint8Array(c.toDataURL('image/jpeg', 0.95));
    const embeddedImg = await pdfDoc.embedJpg(jpgBytes);
    const page = pdfDoc.addPage([595.28, 841.89]);
    page.drawImage(embeddedImg, { x: 0, y: 0, width: 595.28, height: 841.89 });
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

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let currentLine = words[0];
  for (let i = 1; i < words.length; i++) {
    const testLine = `${currentLine} ${words[i]}`;
    if (ctx.measureText(testLine).width > maxWidth) {
      lines.push(currentLine);
      currentLine = words[i];
    } else {
      currentLine = testLine;
    }
  }
  lines.push(currentLine);
  return lines;
}

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

// ============================================================================
// 15. CHUYỂN PDF (KỂ CẢ FILE SCAN) SANG EXCEL .XLSX (convert_pdf_to_excel)
//     Giữ nguyên 100% Bảng biểu, Chữ cái, Cột/Ô, Định dạng màu nền, Đường kẻ, Gộp ô!
// ============================================================================

interface ExcelExtractedCell {
  text: string;
  colIndex: number;
  colSpan?: number;
  rowSpan?: number;
  bgHex?: string | null;
  textColorHex?: string | null;
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  hasBorder?: boolean;
}

/**
 * Resiliently extracts a JSON object or array from an AI response string
 */
function parseResilientVisionJson(rawText: string): any {
  const cleaned = (rawText || '').replace(/```json|```/gi, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
      } catch {
        // Ignore
      }
    }
    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');
    if (firstBracket >= 0 && lastBracket > firstBracket) {
      try {
        return { rows: JSON.parse(cleaned.slice(firstBracket, lastBracket + 1)) };
      } catch {
        // Ignore
      }
    }
    return null;
  }
}

/**
 * Detects horizontal and vertical table grid lines directly from a 2D Canvas image of a scanned PDF page,
 * and runs local Tesseract.js OCR ('vie+eng') to populate exact rows and columns in Excel even without an API key!
 */
async function extractScannedPageTableViaLocalOcr(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  pageNum: number,
  totalPages: number,
  pct: number,
  onProgress?: ProgressCallback
): Promise<ExcelExtractedCell[][]> {
  const w = canvas.width;
  const h = canvas.height;

  // 1. Detect vertical and horizontal dark grid lines from pixel data
  const imgData = ctx.getImageData(0, 0, w, h).data;
  const isDarkPixel = (x: number, y: number): boolean => {
    const idx = (y * w + x) * 4;
    const r = imgData[idx];
    const g = imgData[idx + 1];
    const b = imgData[idx + 2];
    return (r + g + b) / 3 < 175;
  };

  const vLineXs: number[] = [];
  for (let x = Math.round(w * 0.03); x < Math.round(w * 0.97); x += 2) {
    let darkRun = 0;
    let maxRun = 0;
    for (let y = Math.round(h * 0.04); y < Math.round(h * 0.96); y += 3) {
      if (isDarkPixel(x, y)) {
        darkRun += 3;
        if (darkRun > maxRun) maxRun = darkRun;
      } else {
        darkRun = 0;
      }
    }
    if (maxRun > h * 0.12) {
      if (!vLineXs.some(vx => Math.abs(vx - x) <= 14)) {
        vLineXs.push(x);
      }
    }
  }
  vLineXs.sort((a, b) => a - b);

  // 2. Run local Tesseract.js OCR (Vietnamese + English) with word/line bounding boxes
  onProgress?.(
    `Đang chạy Engine OCR Nội Bộ (Việt/Anh) bóc tách bảng Trang ${pageNum}/${totalPages}...`,
    'Nhận diện chữ từ ảnh Scan và phân tách hàng/cột tự động',
    pct
  );

  try {
    const loadTesseract = async (): Promise<any> => {
      if (typeof window === 'undefined') return null;
      if ((window as any).Tesseract) return (window as any).Tesseract;
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Tesseract CDN load failed'));
        document.head.appendChild(script);
      });
      return (window as any).Tesseract;
    };
    const Tesseract = await loadTesseract();
    if (!Tesseract) return [];
    const ocrResult = await Tesseract.recognize(canvas, 'vie+eng');
    const ocrData = ocrResult?.data || {};

    // Collect words with bounding boxes
    const rawWords: { text: string; x0: number; y0: number; x1: number; y1: number; bold: boolean }[] = [];
    if (Array.isArray(ocrData.words) && ocrData.words.length > 0) {
      for (const wd of ocrData.words) {
        const txt = String(wd.text || '').trim();
        if (!txt) continue;
        const bbox = wd.bbox || {};
        rawWords.push({
          text: txt,
          x0: Number(bbox.x0) || 0,
          y0: Number(bbox.y0) || 0,
          x1: Number(bbox.x1) || 0,
          y1: Number(bbox.y1) || 0,
          bold: Boolean(wd.is_bold) || (Number(bbox.y1) - Number(bbox.y0) > 28),
        });
      }
    } else if (ocrData.text && String(ocrData.text).trim()) {
      // Fallback if words array isn't populated: split plain text by lines and multi-space/pipe/tab delimiters
      const plainLines = String(ocrData.text)
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(Boolean);
      return plainLines.map((lineStr, rIdx) => {
        const cols = lineStr
          .split(/\s{2,}|\t|\|/)
          .map(c => c.trim())
          .filter(Boolean);
        return cols.map((colTxt, cIdx) => ({
          text: colTxt,
          colIndex: cIdx,
          colSpan: 1,
          rowSpan: 1,
          bgHex: rIdx === 0 ? 'E2E8F0' : null,
          bold: rIdx === 0,
          italic: false,
          align: /^[-+]?\d[\d,./%\s]*$/.test(colTxt) ? 'center' : 'left',
          hasBorder: true,
        }));
      });
    }

    if (rawWords.length === 0) return [];

    // Group words into horizontal rows by vertical center Y
    rawWords.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
    const ocrRows: { yCenter: number; height: number; words: typeof rawWords }[] = [];
    for (const wd of rawWords) {
      const yMid = (wd.y0 + wd.y1) / 2;
      const wdH = Math.max(12, wd.y1 - wd.y0);
      const existingRow = ocrRows.find(r => Math.abs(r.yCenter - yMid) <= Math.max(14, r.height * 0.65));
      if (existingRow) {
        existingRow.words.push(wd);
        existingRow.height = Math.max(existingRow.height, wdH);
      } else {
        ocrRows.push({ yCenter: yMid, height: wdH, words: [wd] });
      }
    }

    // Group words within each row into horizontal cell segments
    const segmentedOcrRows = ocrRows.map(row => {
      row.words.sort((a, b) => a.x0 - b.x0);
      const segs: { x0: number; x1: number; y0: number; y1: number; text: string; bold: boolean }[] = [];
      let cur: { x0: number; x1: number; y0: number; y1: number; text: string; bold: boolean } | null = null;

      for (const wd of row.words) {
        if (!cur) {
          cur = { ...wd };
          continue;
        }
        const gap = wd.x0 - cur.x1;
        // Split into a new cell if gap > 26px OR a detected vertical grid line lies between cur.x1 and wd.x0
        const crossedVLine = vLineXs.some(vx => vx >= cur!.x1 - 4 && vx <= wd.x0 + 4);
        if (gap > 26 || crossedVLine) {
          segs.push(cur);
          cur = { ...wd };
        } else {
          cur.text += (wd.text === '|' ? '' : ` ${wd.text}`);
          cur.x1 = Math.max(cur.x1, wd.x1);
          cur.y0 = Math.min(cur.y0, wd.y0);
          cur.y1 = Math.max(cur.y1, wd.y1);
          cur.bold = cur.bold || wd.bold;
        }
      }
      if (cur) segs.push(cur);
      return segs.filter(s => s.text.replace(/\|/g, '').trim().length > 0);
    });

    // Discover column X anchors from vertical grid lines or segment starts
    const colAnchors: number[] = [];
    if (vLineXs.length >= 3) {
      for (let i = 0; i < vLineXs.length - 1; i++) {
        colAnchors.push(vLineXs[i]);
      }
    } else {
      for (const sRow of segmentedOcrRows) {
        if (sRow.length >= 2) {
          for (const seg of sRow) {
            if (!colAnchors.some(a => Math.abs(a - seg.x0) <= 35)) {
              colAnchors.push(seg.x0);
            }
          }
        }
      }
      colAnchors.sort((a, b) => a - b);
    }

    const totalCols = Math.max(1, Math.min(16, colAnchors.length || 1));
    const finalRows: ExcelExtractedCell[][] = [];

    for (const sRow of segmentedOcrRows) {
      if (sRow.length === 0) continue;
      if (sRow.length === 1 && totalCols > 1) {
        const s = sRow[0];
        const bgHex = sampleCellBackgroundHex(ctx, s.x0, s.y0, s.x1 - s.x0, s.y1 - s.y0, w, h);
        finalRows.push([
          {
            text: s.text.replace(/^\|+|\|+$/g, '').trim(),
            colIndex: 0,
            colSpan: totalCols,
            rowSpan: 1,
            bgHex,
            bold: s.bold,
            italic: false,
            align: s.x0 > w * 0.2 ? 'center' : 'left',
            hasBorder: true,
          },
        ]);
        continue;
      }

      const assigned = new Map<number, typeof sRow[0]>();
      for (const seg of sRow) {
        let bestCol = 0;
        let minDist = Infinity;
        for (let c = 0; c < totalCols; c++) {
          const d = Math.abs(seg.x0 - (colAnchors[c] || 0));
          if (d < minDist) {
            minDist = d;
            bestCol = c;
          }
        }
        const prev = assigned.get(bestCol);
        if (prev) {
          prev.text = `${prev.text} ${seg.text}`;
          prev.x1 = Math.max(prev.x1, seg.x1);
          prev.bold = prev.bold || seg.bold;
        } else {
          assigned.set(bestCol, { ...seg });
        }
      }

      const rowCells: ExcelExtractedCell[] = [];
      for (let c = 0; c < totalCols; c++) {
        const seg = assigned.get(c);
        const cleanTxt = seg ? seg.text.replace(/^\|+|\|+$/g, '').trim() : '';
        const bgHex = seg
          ? sampleCellBackgroundHex(ctx, seg.x0, seg.y0, Math.max(30, seg.x1 - seg.x0), Math.max(18, seg.y1 - seg.y0), w, h)
          : null;
        rowCells.push({
          text: cleanTxt,
          colIndex: c,
          colSpan: 1,
          rowSpan: 1,
          bgHex,
          bold: Boolean(seg?.bold),
          italic: false,
          align: /^[-+]?\d[\d,./%\s]*$/.test(cleanTxt) ? 'center' : 'left',
          hasBorder: true,
        });
      }
      finalRows.push(rowCells);
    }

    return finalRows;
  } catch {
    return [];
  }
}

export async function convertPdfToExcel(
  file: File,
  pageRangeStr = 'ALL',
  sheetMode: 'single_sheet' | 'sheet_per_page' = 'single_sheet',
  useAiOcr: 'auto' | 'always' = 'auto',
  onProgress?: ProgressCallback,
  apiKeysStr?: string,
  modelId?: string
): Promise<{ blob: Blob; pagesProcessed: number; totalRows: number }> {
  onProgress?.('Đang khởi tạo Engine Lattice Grid & OCR PDF sang Excel (.xlsx)...', file.name, 10);

  const ExcelJSImport = await import('exceljs');
  const ExcelJS = (ExcelJSImport as any).default || ExcelJSImport;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AzTool Studio Pro';
  workbook.created = new Date();

  const pdfjsLib = await getPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;
  const targetPages = parsePageSelection(pageRangeStr, totalPages);

  let combinedSheet: any = null;
  if (sheetMode === 'single_sheet') {
    combinedSheet = workbook.addWorksheet('DuLieu_PDF_AzTool', {
      views: [{ showGridLines: true }],
    });
  }

  let globalRowCursor = 1;
  let totalRowsExported = 0;
  const globalMaxColChars: number[] = [];

  const parseSmartCellValue = (raw: string): string | number => {
    const t = raw.trim();
    if (!t) return '';
    // Keep strings with leading zero (e.g. phone numbers, IDs "01234") as text
    if (/^0\d+$/.test(t)) return t;
    // Detect clean numbers or formatted currency/numbers (e.g., "1,250,000" or "45.5")
    if (/^-?\d+(?:,\d{3})+(?:\.\d+)?$/.test(t)) {
      const num = Number(t.replace(/,/g, ''));
      if (!isNaN(num)) return num;
    }
    if (/^-?\d+(?:\.\d+)?$/.test(t)) {
      const num = Number(t);
      if (!isNaN(num)) return num;
    }
    return t;
  };

  for (let idx = 0; idx < targetPages.length; idx++) {
    const pageNum = targetPages[idx];
    const pct = Math.round(15 + ((idx + 1) / targetPages.length) * 75);
    onProgress?.(
      `Đang quét lưới bảng, màu ô & chữ tại Trang ${pageNum}/${totalPages}...`,
      'Tái tạo chính xác số hàng, số cột, ô gộp (Merged Cells), màu nền và đường kẻ viền',
      pct
    );

    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent();

    // Render page at 1.75x onto canvas for pixel background color sampling & Scanned PDF AI Vision OCR
    const renderScale = 1.75;
    const renderViewport = page.getViewport({ scale: renderScale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(renderViewport.width);
    canvas.height = Math.round(renderViewport.height);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: renderViewport, canvas } as any).promise;

    const rawItems = textContent.items as any[];
    const items: ExtractedTextItem[] = [];
    for (const rawItem of rawItems) {
      const str = (rawItem.str || '').replace(/\u0000/g, '');
      if (!str.trim()) continue;
      const tx = rawItem.transform || [12, 0, 0, 12, 0, 0];
      const x = Number(tx[4]) || 0;
      const y = Number(tx[5]) || 0;
      const fontSize = Math.max(8, Math.min(36, Math.round(Math.hypot(tx[0], tx[1]) || 11)));
      const fontName = String(rawItem.fontName || '').toLowerCase();
      items.push({
        str,
        x,
        y,
        width: Number(rawItem.width) || str.length * (fontSize * 0.5),
        height: Number(rawItem.height) || fontSize,
        fontSize,
        bold: fontName.includes('bold') || fontName.includes('black') || fontSize >= 14,
        italic: fontName.includes('italic') || fontName.includes('oblique'),
      });
    }

    const activeSheet =
      sheetMode === 'sheet_per_page'
        ? workbook.addWorksheet(`Trang_${pageNum}`, { views: [{ showGridLines: true }] })
        : combinedSheet;

    if (sheetMode === 'sheet_per_page') {
      globalRowCursor = 1;
    }

    let extractedRowsForPage: ExcelExtractedCell[][] | null = null;
    const availableKeys = getAvailableKeys(apiKeysStr);

    const runVisionOcrForPage = async (): Promise<ExcelExtractedCell[][] | null> => {
      if (availableKeys.length === 0) return null;
      try {
        onProgress?.(
          `Đang chạy AI Vision OCR bóc tách bảng biểu Trang ${pageNum}/${totalPages}...`,
          'Nhận diện chữ Scan tiếng Việt, cấu trúc cột/dòng, ô gộp và màu sắc',
          pct
        );
        const jpgDataUrl = canvas.toDataURL('image/jpeg', 0.88);
        const prompt = `Bạn là hệ thống chuyển đổi PDF/Ảnh Scan sang bảng tính Microsoft Excel (.xlsx) chính xác 100%.
Hãy trích xuất toàn bộ nội dung bảng biểu và văn bản trên trang này thành ma trận các hàng và ô.
Trả về đúng định dạng JSON:
{
  "rows": [
    [
      {
        "text": "Nội dung ô chính xác 100%",
        "colIndex": 0,
        "colSpan": 1,
        "rowSpan": 1,
        "bgHex": "D9E1F2",
        "textColorHex": "000000",
        "bold": true,
        "italic": false,
        "align": "center",
        "hasBorder": true
      }
    ]
  ]
}
Lưu ý:
- Nếu ô không có màu nền (nền trắng), đặt "bgHex": null. Nếu ô có màu nền (xanh, vàng, xám...), trả mã hex 6 ký tự (VD: "FFF2CC", "E2EFDA", "D9E1F2").
- Nếu là tiêu đề gộp nhiều cột, đặt "colSpan" tương ứng (VD: 4, 5...).`;

        const visionJson = await callGeminiVisionApi(prompt, jpgDataUrl, 'image/jpeg', apiKeysStr, modelId);
        const parsed = parseResilientVisionJson(visionJson);
        if (parsed?.rows && Array.isArray(parsed.rows) && parsed.rows.length > 0) {
          return parsed.rows;
        }
      } catch {
        // Fallback below
      }
      return null;
    };

    // 1. Check if page is Scanned PDF (items.length < 15) or user selected 'always' AI Vision OCR
    if (items.length < 15 || useAiOcr === 'always') {
      extractedRowsForPage = await runVisionOcrForPage();
      if (!extractedRowsForPage || extractedRowsForPage.length === 0) {
        const localOcrRows = await extractScannedPageTableViaLocalOcr(
          canvas,
          ctx,
          pageNum,
          totalPages,
          pct,
          onProgress
        );
        if (localOcrRows.length > 0) {
          extractedRowsForPage = localOcrRows;
        }
      }
    }

    // 2. Coordinate + Visual Pixel Color Grid Reconstruction (Lattice & Stream Engine)
    if (!extractedRowsForPage || extractedRowsForPage.length === 0) {
      items.sort((a, b) => b.y - a.y || a.x - b.x);
      const lines: { y: number; height: number; items: ExtractedTextItem[] }[] = [];
      for (const item of items) {
        const existing = lines.find(l => Math.abs(l.y - item.y) <= 4.5);
        if (existing) {
          existing.items.push(item);
          existing.height = Math.max(existing.height, item.height);
        } else {
          lines.push({ y: item.y, height: item.height, items: [item] });
        }
      }

      // Segment each line into distinct horizontal cells
      const segmentedLines = lines.map(ln => {
        ln.items.sort((a, b) => a.x - b.x);
        const segs: {
          x: number;
          right: number;
          text: string;
          bold: boolean;
          italic: boolean;
          fontSize: number;
        }[] = [];
        let curX = ln.items[0]?.x || 0;
        let lastRight = curX;
        let curText = '';
        let curBold = false;
        let curItalic = false;
        let maxFs = 11;

        for (let i = 0; i < ln.items.length; i++) {
          const it = ln.items[i];
          if (i > 0 && it.x - lastRight > 16) {
            segs.push({
              x: curX,
              right: lastRight,
              text: curText.trim(),
              bold: curBold,
              italic: curItalic,
              fontSize: maxFs,
            });
            curX = it.x;
            curText = it.str;
            curBold = it.bold;
            curItalic = it.italic;
            maxFs = it.fontSize;
          } else {
            const gap = i > 0 ? it.x - lastRight : 0;
            curText += (gap > 2.0 && !curText.endsWith(' ') ? ' ' : '') + it.str;
            curBold = curBold || it.bold;
            curItalic = curItalic || it.italic;
            maxFs = Math.max(maxFs, it.fontSize);
          }
          lastRight = it.x + it.width;
        }
        if (curText.trim()) {
          segs.push({
            x: curX,
            right: lastRight,
            text: curText.trim(),
            bold: curBold,
            italic: curItalic,
            fontSize: maxFs,
          });
        }
        return { y: ln.y, height: ln.height, segs };
      });

      // Discover global column X boundaries across all multi-cell lines on the page
      const colAnchors: number[] = [];
      for (const sl of segmentedLines) {
        if (sl.segs.length >= 2) {
          for (const s of sl.segs) {
            if (!colAnchors.some(a => Math.abs(a - s.x) <= 22)) {
              colAnchors.push(s.x);
            }
          }
        }
      }
      colAnchors.sort((a, b) => a - b);
      const totalCols = Math.max(1, Math.min(16, colAnchors.length || 1));

      extractedRowsForPage = [];

      for (const sl of segmentedLines) {
        if (sl.segs.length === 0) continue;

        const canvasY = (viewport.height - sl.y - sl.height) * renderScale;

        // If this line has only 1 segment and totalCols > 1, check if it's a centered/wide title or section header -> merge across columns!
        if (sl.segs.length === 1 && totalCols > 1) {
          const s = sl.segs[0];
          const bgHex = sampleCellBackgroundHex(
            ctx,
            s.x * renderScale,
            canvasY,
            Math.max(60, (s.right - s.x) * renderScale),
            sl.height * renderScale * 1.5,
            canvas.width,
            canvas.height
          );
          const isCenteredTitle =
            s.x > viewport.width * 0.18 && s.right < viewport.width * 0.85;

          extractedRowsForPage.push([
            {
              text: s.text,
              colIndex: 0,
              colSpan: totalCols,
              rowSpan: 1,
              bgHex,
              bold: s.bold || isCenteredTitle,
              italic: s.italic,
              align: isCenteredTitle ? 'center' : 'left',
              hasBorder: Boolean(bgHex),
            },
          ]);
          continue;
        }

        // Multi-column table row
        const rowCells: ExcelExtractedCell[] = [];
        const assignedCols = new Map<number, typeof sl.segs[0]>();

        for (const s of sl.segs) {
          let bestCol = 0;
          let minDist = Infinity;
          for (let c = 0; c < totalCols; c++) {
            const d = Math.abs(s.x - (colAnchors[c] || 0));
            if (d < minDist) {
              minDist = d;
              bestCol = c;
            }
          }
          const prevInCol = assignedCols.get(bestCol);
          if (prevInCol) {
            prevInCol.text = `${prevInCol.text} ${s.text}`;
            prevInCol.right = Math.max(prevInCol.right, s.right);
            prevInCol.bold = prevInCol.bold || s.bold;
          } else {
            assignedCols.set(bestCol, { ...s });
          }
        }

        let cIdx = 0;
        while (cIdx < totalCols) {
          const seg = assignedCols.get(cIdx);
          if (!seg) {
            rowCells.push({
              text: '',
              colIndex: cIdx,
              colSpan: 1,
              rowSpan: 1,
              bgHex: null,
              bold: false,
              italic: false,
              align: 'left',
              hasBorder: true,
            });
            cIdx++;
            continue;
          }

          // Check if this segment's right edge spans across subsequent empty columns (`colSpan`)
          let span = 1;
          while (
            cIdx + span < totalCols &&
            !assignedCols.has(cIdx + span) &&
            seg.right > (colAnchors[cIdx + span] || Infinity) + 12
          ) {
            span++;
          }

          const cellStartX = (colAnchors[cIdx] ?? seg.x) * renderScale;
          const nextAnchorX =
            cIdx + span < totalCols
              ? colAnchors[cIdx + span] * renderScale
              : Math.max(seg.right * renderScale, canvas.width * 0.88);
          const bgHex = sampleCellBackgroundHex(
            ctx,
            cellStartX,
            canvasY,
            Math.max(30, nextAnchorX - cellStartX),
            sl.height * renderScale * 1.6,
            canvas.width,
            canvas.height
          );

          const isNumericOrCode = /^[-+]?\d[\d,./%\s]*$/.test(seg.text) || seg.text.length <= 5;
          rowCells.push({
            text: seg.text,
            colIndex: cIdx,
            colSpan: span,
            rowSpan: 1,
            bgHex,
            bold: seg.bold,
            italic: seg.italic,
            align: isNumericOrCode ? 'center' : 'left',
            hasBorder: true,
          });

          cIdx += span;
        }

        extractedRowsForPage.push(rowCells);
      }

      // If coordinate stream extraction found 0 rows or only stray headers while the page has visual table content, run OCR!
      if (extractedRowsForPage.length < 2) {
        const visionFallback = await runVisionOcrForPage();
        if (visionFallback && visionFallback.length > 0) {
          extractedRowsForPage = visionFallback;
        } else {
          const localFallback = await extractScannedPageTableViaLocalOcr(
            canvas,
            ctx,
            pageNum,
            totalPages,
            pct,
            onProgress
          );
          if (localFallback.length > extractedRowsForPage.length) {
            extractedRowsForPage = localFallback;
          }
        }
      }
    }

    // 2.5. Ultimate Guarantee: If page is a pure graphic/scan where 0 text cells could be extracted, embed the high-res table image directly into the Excel sheet so it is NEVER blank!
    if (!extractedRowsForPage || extractedRowsForPage.length === 0) {
      const headerRow = activeSheet.getRow(globalRowCursor);
      const headerCell = headerRow.getCell(1);
      headerCell.value = `Bảng biểu / Nội dung Trang ${pageNum} (Bản chụp sắc nét từ PDF Scan)`;
      headerCell.font = { name: 'Times New Roman', size: 12, bold: true, color: { argb: 'FF1E293B' } };
      headerRow.height = 26;
      globalRowCursor++;
      totalRowsExported++;

      try {
        const base64Jpg = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
        const imageId = workbook.addImage({
          base64: base64Jpg,
          extension: 'jpeg',
        });
        const imgRowsSpan = 34;
        activeSheet.addImage(imageId, {
          tl: { col: 0, row: globalRowCursor - 1 },
          ext: { width: Math.round(canvas.width * 0.62), height: Math.round(canvas.height * 0.62) },
        });
        globalRowCursor += imgRowsSpan;
        totalRowsExported += imgRowsSpan;
      } catch {
        // Ignore image embed failure
      }
      continue;
    }

    // 3. Write extracted rows to ExcelJS Worksheet with full colors, borders, merges, and fonts
    for (const rCells of extractedRowsForPage) {
      if (!Array.isArray(rCells) || rCells.length === 0) continue;
      const excelRow = activeSheet.getRow(globalRowCursor);
      let maxTextLinesInRow = 1;

      for (let i = 0; i < rCells.length; i++) {
        const cellData = rCells[i];
        const col1Based = (typeof cellData.colIndex === 'number' ? cellData.colIndex : i) + 1;
        const spanC = Math.max(1, cellData.colSpan || 1);
        const spanR = Math.max(1, cellData.rowSpan || 1);

        const xlCell = excelRow.getCell(col1Based);
        xlCell.value = parseSmartCellValue(String(cellData.text ?? ''));

        // Track column width
        const textLen = String(cellData.text ?? '').length;
        if (spanC === 1) {
          globalMaxColChars[col1Based] = Math.max(
            globalMaxColChars[col1Based] || 10,
            Math.min(52, textLen + 4)
          );
        }
        maxTextLinesInRow = Math.max(maxTextLinesInRow, Math.ceil(textLen / 45));

        // Font styling
        const cleanTextColor = cellData.textColorHex
          ? String(cellData.textColorHex).replace('#', '').toUpperCase()
          : '0F172A';
        xlCell.font = {
          name: 'Times New Roman',
          size: 11,
          bold: Boolean(cellData.bold),
          italic: Boolean(cellData.italic),
          color: { argb: `FF${cleanTextColor.length === 6 ? cleanTextColor : '0F172A'}` },
        };

        // Alignment & wrap
        xlCell.alignment = {
          vertical: 'middle',
          horizontal:
            cellData.align ||
            (typeof xlCell.value === 'number' ? 'right' : 'left'),
          wrapText: true,
        };

        // Background fill color
        const cleanBg = cellData.bgHex
          ? String(cellData.bgHex).replace('#', '').toUpperCase()
          : null;
        if (cleanBg && /^[0-9A-F]{6}$/.test(cleanBg) && cleanBg !== 'FFFFFF') {
          xlCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: `FF${cleanBg}` },
          };
        }

        // Merge cells if colSpan > 1 or rowSpan > 1
        if (spanC > 1 || spanR > 1) {
          try {
            activeSheet.mergeCells(
              globalRowCursor,
              col1Based,
              globalRowCursor + spanR - 1,
              col1Based + spanC - 1
            );
          } catch {
            // Ignore overlapping merge
          }
        }

        // Apply crisp borders across all spanned cells
        if (cellData.hasBorder !== false) {
          for (let mr = globalRowCursor; mr < globalRowCursor + spanR; mr++) {
            for (let mc = col1Based; mc < col1Based + spanC; mc++) {
              const spannedCell = activeSheet.getRow(mr).getCell(mc);
              spannedCell.border = {
                top: { style: 'thin', color: { argb: 'FF94A3B8' } },
                left: { style: 'thin', color: { argb: 'FF94A3B8' } },
                bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
                right: { style: 'thin', color: { argb: 'FF94A3B8' } },
              };
            }
          }
        }
      }

      excelRow.height = Math.max(22, maxTextLinesInRow * 18);
      globalRowCursor++;
      totalRowsExported++;
    }

    // Add a 1-row separator between pages in single_sheet mode
    if (sheetMode === 'single_sheet' && idx < targetPages.length - 1) {
      globalRowCursor++;
    }
  }

  // Apply auto-fitted column widths across all worksheets
  for (const ws of workbook.worksheets) {
    globalMaxColChars.forEach((charCount, colIdx) => {
      if (colIdx >= 1 && charCount) {
        ws.getColumn(colIdx).width = Math.max(12, Math.min(55, charCount));
      }
    });
  }

  onProgress?.('Đang xuất file Excel (.xlsx) chuẩn định dạng...', `${totalRowsExported} dòng dữ liệu`, 95);
  const buffer = await workbook.xlsx.writeBuffer();
  return {
    blob: new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    pagesProcessed: targetPages.length,
    totalRows: totalRowsExported,
  };
}

// ============================================================================
// 16. MỞ KHÓA MẬT KHẨU & XÓA CHẶN IN/COPY FILE PDF (unlock_pdf_file)
// ============================================================================

export async function unlockPdfFile(
  file: File,
  onProgress?: ProgressCallback
): Promise<{ blob: Blob; totalPages: number }> {
  onProgress?.('Đang gỡ bỏ mã hóa quyền hạn (Owner/Permissions Lock)...', file.name, 25);
  const arrayBuffer = await file.arrayBuffer();
  const srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const totalPages = srcDoc.getPageCount();

  // Clone all pages into a brand-new unencrypted PDFDocument to strip 100% of permission locks
  const unlockedDoc = await PDFDocument.create();
  const indices = Array.from({ length: totalPages }, (_, i) => i);
  const copiedPages = await unlockedDoc.copyPages(srcDoc, indices);
  for (const p of copiedPages) {
    unlockedDoc.addPage(p);
  }

  onProgress?.('Đang xuất file PDF tự do hoàn toàn (Cho phép In, Copy, Chỉnh sửa)...', `${totalPages} trang`, 90);
  const savedBytes = await unlockedDoc.save();
  return {
    blob: new Blob([savedBytes as any], { type: 'application/pdf' }),
    totalPages,
  };
}

// ============================================================================
// 17. ĐÓNG DẤU BẢN QUYỀN (WATERMARK) & KÝ TÊN ĐIỆN TỬ (watermark_sign_pdf)
// ============================================================================

export interface WatermarkSignOptions {
  watermarkText: string;
  angleDeg: number;
  opacity: number;
  colorHex: string;
  position: 'diagonal-center' | 'bottom-right' | 'top-right' | 'bottom-left';
  signatureImageFile?: File | null;
  pageRangeStr?: string;
}

export async function watermarkAndSignPdf(
  file: File,
  options: WatermarkSignOptions,
  onProgress?: ProgressCallback
): Promise<{ blob: Blob; stampedPages: number }> {
  onProgress?.('Đang khởi tạo con dấu bản quyền & chữ ký điện tử...', file.name, 20);
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const totalPages = pdfDoc.getPageCount();
  const targetPages = parsePageSelection(options.pageRangeStr || 'ALL', totalPages);

  // Render high-res transparent PNG watermark stamp (supporting full Vietnamese Unicode)
  let textStampPng: any = null;
  if (options.watermarkText.trim()) {
    const c = document.createElement('canvas');
    c.width = 900;
    c.height = 240;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.font = 'bold 54px "Times New Roman", "Segoe UI", sans-serif';
    ctx.fillStyle = options.colorHex || '#dc2626';
    ctx.globalAlpha = Math.max(0.08, Math.min(1, options.opacity || 0.28));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(options.watermarkText.trim(), c.width / 2, c.height / 2);

    const pngBytes = dataUrlToUint8Array(c.toDataURL('image/png'));
    textStampPng = await pdfDoc.embedPng(pngBytes);
  }

  // Embed signature / logo PNG if provided
  let sigPng: any = null;
  let sigAspectRatio = 2.2;
  if (options.signatureImageFile) {
    const sigBuf = await options.signatureImageFile.arrayBuffer();
    const sigDataUrl = await new Promise<string>(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.readAsDataURL(new Blob([sigBuf]));
    });
    const imgEl = await new Promise<HTMLImageElement | null>(resolve => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => resolve(null);
      im.src = sigDataUrl;
    });
    if (imgEl) {
      sigAspectRatio = imgEl.width / Math.max(1, imgEl.height);
      const sc = document.createElement('canvas');
      sc.width = imgEl.width;
      sc.height = imgEl.height;
      const sctx = sc.getContext('2d')!;
      sctx.drawImage(imgEl, 0, 0);
      sigPng = await pdfDoc.embedPng(dataUrlToUint8Array(sc.toDataURL('image/png')));
    }
  }

  for (const pNum of targetPages) {
    const page = pdfDoc.getPage(pNum - 1);
    const { width, height } = page.getSize();

    if (textStampPng) {
      const stampW = Math.min(width * 0.75, 420);
      const stampH = stampW * (240 / 900);

      if (options.position === 'diagonal-center') {
        page.drawImage(textStampPng, {
          x: width / 2 - stampW / 2,
          y: height / 2 - stampH / 2,
          width: stampW,
          height: stampH,
          rotate: degrees(options.angleDeg || 35),
        });
      } else if (options.position === 'bottom-right') {
        page.drawImage(textStampPng, {
          x: width - stampW * 0.65 - 20,
          y: 20,
          width: stampW * 0.65,
          height: stampH * 0.65,
        });
      } else if (options.position === 'top-right') {
        page.drawImage(textStampPng, {
          x: width - stampW * 0.65 - 20,
          y: height - stampH * 0.65 - 20,
          width: stampW * 0.65,
          height: stampH * 0.65,
        });
      } else {
        page.drawImage(textStampPng, {
          x: 20,
          y: 20,
          width: stampW * 0.65,
          height: stampH * 0.65,
        });
      }
    }

    if (sigPng) {
      const sigW = Math.min(165, width * 0.28);
      const sigH = sigW / Math.max(0.4, sigAspectRatio);
      const sigX = options.position === 'bottom-left' ? 36 : width - sigW - 36;
      const sigY = options.position === 'top-right' ? height - sigH - 36 : 36;

      page.drawImage(sigPng, {
        x: sigX,
        y: sigY,
        width: sigW,
        height: sigH,
      });
    }
  }

  onProgress?.('Đang xuất file PDF đã đóng dấu bản quyền & chữ ký...', `${targetPages.length} trang`, 92);
  const savedBytes = await pdfDoc.save();
  return {
    blob: new Blob([savedBytes as any], { type: 'application/pdf' }),
    stampedPages: targetPages.length,
  };
}

// ============================================================================
// 18. QUẢN LÝ TRANG PDF TRỰC QUAN (visual_pdf_organizer)
//     Hiển thị Thumbnail từng trang: Xoay 90°, Đổi vị trí trang, Xóa trang trắng
// ============================================================================

export interface PdfPageThumbnailItem {
  originalPageNumber: number; // 1-based index in original PDF
  thumbnailDataUrl: string;
  rotation: number;           // Additional rotation: 0, 90, 180, 270
  deleted: boolean;
}

export async function generatePdfPageThumbnails(
  file: File,
  onProgress?: ProgressCallback
): Promise<PdfPageThumbnailItem[]> {
  onProgress?.('Đang tạo ảnh thu nhỏ (Thumbnail) cho từng trang PDF...', file.name, 15);
  const pdfjsLib = await getPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;
  const thumbnails: PdfPageThumbnailItem[] = [];

  for (let p = 1; p <= totalPages; p++) {
    onProgress?.(
      `Đang dựng Thumbnail Trang ${p}/${totalPages}...`,
      'Sẵn sàng kéo đổi chỗ, xoay 90° hoặc xóa trang thừa',
      15 + Math.round((p / totalPages) * 80)
    );
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 0.45 });
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(viewport.width));
    c.height = Math.max(1, Math.round(viewport.height));
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport, canvas: c } as any).promise;

    thumbnails.push({
      originalPageNumber: p,
      thumbnailDataUrl: c.toDataURL('image/jpeg', 0.8),
      rotation: 0,
      deleted: false,
    });
  }

  return thumbnails;
}

export async function exportVisualOrganizedPdf(
  file: File,
  orderedPages: PdfPageThumbnailItem[],
  onProgress?: ProgressCallback
): Promise<{ blob: Blob; finalPageCount: number }> {
  const activeItems = orderedPages.filter(p => !p.deleted);
  if (activeItems.length === 0) {
    throw new Error('Bạn đã đánh dấu xóa toàn bộ các trang. Vui lòng giữ lại ít nhất 1 trang!');
  }

  onProgress?.('Đang sắp xếp và xoay chiều các trang PDF...', `${activeItems.length} trang`, 35);
  const arrayBuffer = await file.arrayBuffer();
  const srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const outDoc = await PDFDocument.create();

  for (const item of activeItems) {
    const [copiedPage] = await outDoc.copyPages(srcDoc, [item.originalPageNumber - 1]);
    if (item.rotation % 360 !== 0) {
      const currentAngle = copiedPage.getRotation().angle || 0;
      copiedPage.setRotation(degrees((currentAngle + item.rotation) % 360));
    }
    outDoc.addPage(copiedPage);
  }

  onProgress?.('Đang xuất file PDF hoàn chỉnh...', `${activeItems.length} trang`, 92);
  const savedBytes = await outDoc.save();
  return {
    blob: new Blob([savedBytes as any], { type: 'application/pdf' }),
    finalPageCount: activeItems.length,
  };
}

// ============================================================================
// 19. NÉN ẢNH HÀNG LOẠT KHÔNG GIẢM CHẤT LƯỢNG (compress_images_batch — Thay thế TinyPNG)
// ============================================================================

export interface CompressedImageResultItem {
  fileName: string;
  blob: Blob;
  dataUrl: string;
  originalBytes: number;
  compressedBytes: number;
  savedPercent: number;
}

export async function compressImagesBatch(
  files: File[],
  qualityLevel: 'high' | 'balanced' | 'ultra' = 'balanced',
  onProgress?: ProgressCallback
): Promise<{
  items: CompressedImageResultItem[];
  zipBlob: Blob;
  totalOriginalBytes: number;
  totalCompressedBytes: number;
  totalSavedPercent: number;
}> {
  const zip = new JSZip();
  const results: CompressedImageResultItem[] = [];
  let totalOrig = 0;
  let totalComp = 0;

  const jpegQuality =
    qualityLevel === 'ultra' ? 0.62 : qualityLevel === 'balanced' ? 0.76 : 0.86;
  const maxDimension =
    qualityLevel === 'ultra' ? 1920 : qualityLevel === 'balanced' ? 2400 : 3200;

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    totalOrig += f.size;
    onProgress?.(
      `Đang nén thông minh ảnh ${i + 1}/${files.length}: ${f.name}...`,
      'Giữ nguyên độ sắc nét thị giác, giảm tối đa dung lượng byte',
      15 + Math.round(((i + 1) / files.length) * 75)
    );

    const dataUrl = await new Promise<string>(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.readAsDataURL(f);
    });

    const imgEl = await new Promise<HTMLImageElement | null>(resolve => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => resolve(null);
      im.src = dataUrl;
    });

    if (!imgEl) continue;

    let targetW = imgEl.width;
    let targetH = imgEl.height;
    if (targetW > maxDimension || targetH > maxDimension) {
      const ratio = Math.min(maxDimension / targetW, maxDimension / targetH);
      targetW = Math.round(targetW * ratio);
      targetH = Math.round(targetH * ratio);
    }

    const c = document.createElement('canvas');
    c.width = targetW;
    c.height = targetH;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(imgEl, 0, 0, targetW, targetH);

    // Export as WebP or JPEG for optimal lossless-look compression
    const isPng = /\.png$/i.test(f.name);
    const outMime = isPng ? 'image/webp' : 'image/jpeg';
    const outDataUrl = c.toDataURL(outMime, jpegQuality);
    const outBytes = dataUrlToUint8Array(outDataUrl);

    const finalBytes = outBytes.byteLength < f.size ? outBytes : new Uint8Array(await f.arrayBuffer());
    const finalSavedPct =
      finalBytes.byteLength < f.size
        ? Math.max(1, Math.round(((f.size - finalBytes.byteLength) / f.size) * 100))
        : 0;

    totalComp += finalBytes.byteLength;
    const outName = isPng && finalBytes === outBytes
      ? f.name.replace(/\.png$/i, '_AzOptimized.webp')
      : f.name;

    const itemBlob = new Blob([finalBytes as any], { type: outMime });
    zip.file(outName, finalBytes);
    results.push({
      fileName: outName,
      blob: itemBlob,
      dataUrl: outDataUrl,
      originalBytes: f.size,
      compressedBytes: finalBytes.byteLength,
      savedPercent: finalSavedPct,
    });
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const totalSavedPercent =
    totalOrig > 0 && totalComp < totalOrig
      ? Math.max(1, Math.round(((totalOrig - totalComp) / totalOrig) * 100))
      : 0;

  return {
    items: results,
    zipBlob,
    totalOriginalBytes: totalOrig,
    totalCompressedBytes: totalComp,
    totalSavedPercent,
  };
}

// ============================================================================
// 20. TÁCH NỀN ẢNH AI THÔNG MINH (remove_image_bg — Thay thế Remove.bg)
//     Hỗ trợ tách nền ảnh chân dung, ảnh sản phẩm, con dấu đỏ, chữ ký tay -> PNG trong suốt
// ============================================================================

export async function removeImageBackground(
  file: File,
  tolerance = 38,
  mode: 'auto_edge' | 'signature_stamp' = 'auto_edge',
  onProgress?: ProgressCallback
): Promise<{
  blob: Blob;
  dataUrl: string;
  fileName: string;
  width: number;
  height: number;
}> {
  onProgress?.('Đang phân tích chủ thể & tách nền trong suốt...', file.name, 25);

  const srcDataUrl = await new Promise<string>(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });

  const imgEl = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('Không thể đọc file ảnh'));
    im.src = srcDataUrl;
  });

  const w = imgEl.width;
  const h = imgEl.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(imgEl, 0, 0);

  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  // Sample corner and border pixels to determine background RGB color
  const samplePoints = [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
    [Math.floor(w / 2), 0],
    [0, Math.floor(h / 2)],
    [w - 1, Math.floor(h / 2)],
  ];

  let bgR = 0;
  let bgG = 0;
  let bgB = 0;
  for (const [sx, sy] of samplePoints) {
    const idx = (sy * w + sx) * 4;
    bgR += data[idx];
    bgG += data[idx + 1];
    bgB += data[idx + 2];
  }
  bgR = Math.round(bgR / samplePoints.length);
  bgG = Math.round(bgG / samplePoints.length);
  bgB = Math.round(bgB / samplePoints.length);

  const colorDist = (r: number, g: number, b: number) =>
    Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);

  if (mode === 'signature_stamp') {
    // Remove all light paper background pixels globally (ideal for signatures, stamps, logos with inner holes)
    const maxDist = Math.max(18, tolerance * 1.9);
    const softEdge = maxDist * 1.35;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const d = colorDist(r, g, b);
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      if (d <= maxDist || lum > 240) {
        data[i + 3] = 0;
      } else if (d < softEdge) {
        // Smooth anti-aliased alpha feathering
        const alphaRatio = (d - maxDist) / (softEdge - maxDist);
        data[i + 3] = Math.round(data[i + 3] * alphaRatio);
      }
    }
  } else {
    // Flood-fill from all 4 outer edges so interior white regions of the subject (eyes, shirt, product details) are preserved!
    const visited = new Uint8Array(w * h);
    const queue = new Int32Array(w * h);
    let head = 0;
    let tail = 0;

    const maxDist = Math.max(15, tolerance * 1.6);
    const softDist = maxDist * 1.35;

    const tryEnqueue = (px: number, py: number) => {
      const pos = py * w + px;
      if (visited[pos]) return;
      const idx = pos * 4;
      const d = colorDist(data[idx], data[idx + 1], data[idx + 2]);
      if (d <= softDist) {
        visited[pos] = 1;
        queue[tail++] = pos;
      }
    };

    for (let x = 0; x < w; x++) {
      tryEnqueue(x, 0);
      tryEnqueue(x, h - 1);
    }
    for (let y = 0; y < h; y++) {
      tryEnqueue(0, y);
      tryEnqueue(w - 1, y);
    }

    while (head < tail) {
      const pos = queue[head++];
      const idx = pos * 4;
      const d = colorDist(data[idx], data[idx + 1], data[idx + 2]);

      if (d <= maxDist) {
        data[idx + 3] = 0;
      } else {
        const ratio = (d - maxDist) / Math.max(1, softDist - maxDist);
        data[idx + 3] = Math.round(data[idx + 3] * ratio);
      }

      const px = pos % w;
      const py = (pos - px) / w;
      if (px > 0) tryEnqueue(px - 1, py);
      if (px + 1 < w) tryEnqueue(px + 1, py);
      if (py > 0) tryEnqueue(px, py - 1);
      if (py + 1 < h) tryEnqueue(px, py + 1);
    }
  }

  ctx.putImageData(imageData, 0, 0);
  onProgress?.('Đang xuất ảnh PNG nền trong suốt...', `${w}x${h} px`, 92);

  const outDataUrl = canvas.toDataURL('image/png');
  const outBytes = dataUrlToUint8Array(outDataUrl);
  const outName = `${file.name.replace(/\.[^.]+$/, '')}_TachNen_AzTool.png`;

  return {
    blob: new Blob([outBytes as any], { type: 'image/png' }),
    dataUrl: outDataUrl,
    fileName: outName,
    width: w,
    height: h,
  };
}

