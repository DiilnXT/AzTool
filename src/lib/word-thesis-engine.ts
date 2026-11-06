'use client';

/**
 * AzTool Word Thesis & Textbook Surgical Auditor Engine (src/lib/word-thesis-engine.ts)
 * ------------------------------------------------------------------------------------
 * Reads 100% of a Word (.docx) document's XML (`word/document.xml`) without losing any content,
 * detects & cross-checks:
 *   1. Danh mục Từ viết tắt (Abbreviations List vs. Acronyms in body)
 *   2. Danh mục Bảng biểu (List of Tables vs. actual <w:tbl> and Table Captions)
 *   3. Danh mục Hình ảnh / Ảnh / Sơ đồ / Biểu đồ (List of Figures vs. actual <w:drawing>/<w:pict> and Figure Captions)
 *
 * Performs surgical in-place XML fixes (`word/document.xml`) via PizZip + DOMParser + XMLSerializer
 * so ONLY the targeted error is fixed while 100% of fonts, styles, equations, images, headers/footers,
 * and layout remain untouched byte-for-byte.
 */

import PizZip from 'pizzip';

export type ThesisCategory = 'figure' | 'table' | 'abbreviation';

export type ThesisIssueType =
  | 'SEQUENCE_GAP'        // Đang 2.3 nhảy lên 2.5 (không có ảnh/bảng ở giữa)
  | 'UNLABELLED_MEDIA'    // Có ảnh/bảng nằm giữa (VD sau 2.3) nhưng quên gắn nhãn, kế tiếp lại ghi 2.4 hoặc 2.5
  | 'DUPLICATE_NUMBER'    // Trùng số thứ tự (hai hình/bảng cùng mang số 2.3)
  | 'WRONG_CHAPTER'       // Đang ở Chương 3 nhưng đánh số Hình 2.4
  | 'TOC_MISSING'         // Có hình/bảng trong bài nhưng thiếu trong Danh mục đầu file
  | 'TOC_MISMATCH'        // Số hiệu hoặc tên trong Danh mục đầu file lệch với ghi chú thực tế trong bài
  | 'UNLISTED_ABBREV'     // Từ viết tắt dùng nhiều lần trong bài nhưng chưa khai báo trong Danh mục từ viết tắt
  | 'UNUSED_ABBREV';      // Có trong Danh mục từ viết tắt nhưng không hề xuất hiện trong nội dung bài

export interface DetectedCatalogItem {
  id: string;
  category: 'figure' | 'table';
  prefix: string;            // "Hình", "Ảnh", "Sơ đồ", "Biểu đồ", "Bảng"
  numberStr: string;         // "2.3" hoặc "4"
  chapterNum: number | null; // 2
  seqNum: number;            // 3
  title: string;             // "Sơ đồ quy trình..."
  fullCaption: string;       // "Hình 2.3: Sơ đồ quy trình..."
  xmlNodeIndex: number;      // Exact index in <w:body> children
  hasAdjacentMedia: boolean; // Whether an actual image/table is next to this caption
  inFrontMatterToc: boolean; // Whether listed in front-matter List of Figures/Tables
  contextSnippet: string;
}

export interface DetectedUnlabelledMedia {
  id: string;
  category: 'figure' | 'table';
  xmlNodeIndex: number;      // Exact index in <w:body> children
  chapterNum: number;
  prevCaption?: DetectedCatalogItem;
  nextCaption?: DetectedCatalogItem;
  expectedPrefix: string;    // "Hình" / "Ảnh" / "Bảng"
  expectedNumberStr: string; // "2.4"
  suggestedCaption: string;  // "Ảnh 2.4: Mô tả hình minh họa"
  contextBefore: string;
  contextAfter: string;
}

export interface DetectedAbbreviationItem {
  acronym: string;           // "CNTT"
  meaningInToc: string;      // "Công nghệ thông tin" (if present in front-matter list)
  inFrontMatterList: boolean;
  occurrencesInBody: number;
  firstContextSnippet: string;
  inferredMeaning: string;   // Auto-inferred from "(Công nghệ thông tin - CNTT)" or built-in dictionary
  firstBodyXmlIndex: number;
}

export interface CascadeUpdateItem {
  xmlNodeIndex: number;
  oldText: string;
  newText: string;
  oldNumberStr: string;
  newNumberStr: string;
}

export interface ThesisAuditIssue {
  id: string;
  category: ThesisCategory;
  issueType: ThesisIssueType;
  severity: 'error' | 'warning';
  title: string;
  description: string;
  locationLabel: string;
  currentText: string;
  suggestedFixText: string;
  xmlNodeIndex: number; // Target node in <w:body>
  /**
   * Action mode for surgical XML fixer:
   * - 'replace_paragraph_text': replaces the caption text at xmlNodeIndex (and optionally cascades subsequent captions)
   * - 'insert_caption_after': inserts a new caption paragraph right after xmlNodeIndex (for unlabelled image) and cascades subsequent captions in same chapter
   * - 'insert_caption_before': inserts a new caption paragraph right before xmlNodeIndex (for unlabelled table) and cascades subsequent captions in same chapter
   * - 'add_abbreviation': inserts the abbreviation into the front-matter Abbreviation Table/List or expands first occurrence
   * - 'remove_paragraph_or_row': removes an unused abbreviation row/paragraph
   * - 'append_to_toc': adds missing figure/table entry to front-matter List of Figures/Tables
   */
  fixAction:
    | 'replace_paragraph_text'
    | 'insert_caption_after'
    | 'insert_caption_before'
    | 'add_abbreviation'
    | 'remove_unused_abbrev'
    | 'append_to_toc';
  cascadeUpdates?: CascadeUpdateItem[];
  abbrevData?: {
    acronym: string;
    meaning: string;
  };
  fixed: boolean;
}

export interface ThesisAuditReport {
  fileName: string;
  totalParagraphs: number;
  totalTablesInDoc: number;
  totalImagesInDoc: number;
  figuresCatalog: DetectedCatalogItem[];
  tablesCatalog: DetectedCatalogItem[];
  unlabelledMedia: DetectedUnlabelledMedia[];
  abbreviations: DetectedAbbreviationItem[];
  issues: ThesisAuditIssue[];
  tocZones: {
    abbrevTableNodeIndex: number | null;
    abbrevHeaderNodeIndex: number | null;
    figureTocLastNodeIndex: number | null;
    tableTocLastNodeIndex: number | null;
  };
}

// Common Vietnamese academic & administrative acronyms dictionary for smart auto-suggestion
const ACADEMIC_ABBREV_DICTIONARY: Record<string, string> = {
  'CNTT': 'Công nghệ thông tin',
  'TTNT': 'Trí tuệ nhân tạo',
  'AI': 'Trí tuệ nhân tạo (Artificial Intelligence)',
  'GD&ĐT': 'Giáo dục và Đào tạo',
  'GDĐT': 'Giáo dục và Đào tạo',
  'BGDĐT': 'Bộ Giáo dục và Đào tạo',
  'ĐBCL': 'Đảm bảo chất lượng',
  'KTĐG': 'Kiểm tra đánh giá',
  'CSDL': 'Cơ sở dữ liệu',
  'HTTT': 'Hệ thống thông tin',
  'THPT': 'Trung học phổ thông',
  'THCS': 'Trung học cơ sở',
  'ĐH': 'Đại học',
  'CĐ': 'Cao đẳng',
  'GV': 'Giảng viên / Giáo viên',
  'SV': 'Sinh viên',
  'HS': 'Học sinh',
  'NCKH': 'Nghiên cứu khoa học',
  'UBND': 'Ủy ban nhân dân',
  'HĐND': 'Hội đồng nhân dân',
  'KTXH': 'Kinh tế - Xã hội',
  'XHCN': 'Xã hội chủ nghĩa',
  'NXB': 'Nhà xuất bản',
  'TNHH': 'Trách nhiệm hữu hạn',
  'TMCP': 'Thương mại cổ phần',
  'BHXH': 'Bảo hiểm xã hội',
  'BHYT': 'Bảo hiểm y tế',
  'BYT': 'Bộ Y tế',
  'WHO': 'Tổ chức Y tế Thế giới (World Health Organization)',
  'WTO': 'Tổ chức Thương mại Thế giới (World Trade Organization)',
  'ASEAN': 'Hiệp hội các quốc gia Đông Nam Á',
  'GDP': 'Tổng sản phẩm nội địa (Gross Domestic Product)',
  'FDI': 'Đầu tư trực tiếp nước ngoài (Foreign Direct Investment)',
  'ODA': 'Hỗ trợ phát triển chính thức (Official Development Assistance)',
  'IoT': 'Internet vạn vật (Internet of Things)',
  'ERP': 'Hoạch định nguồn lực doanh nghiệp (Enterprise Resource Planning)',
  'CRM': 'Quản trị quan hệ khách hàng (Customer Relationship Management)',
  'KPI': 'Chỉ số đánh giá hiệu quả công việc (Key Performance Indicator)',
  'SWOT': 'Điểm mạnh, Điểm yếu, Cơ hội, Thách thức',
  'PBL': 'Học tập dựa trên dự án (Project-Based Learning)',
  'STEM': 'Khoa học, Công nghệ, Kỹ thuật và Toán học',
};

// Ignore Roman numerals or common short tokens that are not abbreviations
const IGNORED_UPPERCASE_TOKENS = new Set([
  'II', 'III', 'IV', 'VI', 'VII', 'VIII', 'IX', 'XI', 'XII', 'XIII', 'XIV', 'XV',
  'CHƯƠNG', 'PHẦN', 'MỤC', 'BẢNG', 'HÌNH', 'ẢNH', 'SƠ', 'ĐỒ', 'BIỂU', 'CÂU',
  'DANH', 'TỪ', 'VIẾT', 'TẮT', 'KẾT', 'LUẬN', 'MỞ', 'ĐẦU', 'TÀI', 'LIỆU', 'THAM', 'KHẢO',
  'PHỤ', 'LỤC', 'TRANG', 'STT', 'MÃ', 'SỐ', 'TP', 'HCM', 'HN', 'VN', 'OK', 'PDF', 'WORD',
  'DOCX', 'XLSX', 'PPTX', 'HTML', 'CSS', 'XML', 'JSON', 'URL', 'HTTP', 'HTTPS',
]);

/**
 * Helper to extract plain text from any XML node (<w:p> or <w:tc>)
 */
function getXmlNodeText(node: Element): string {
  const paragraphs = node.tagName === 'w:p' ? [node] : Array.from(node.getElementsByTagName('w:p'));
  const lines: string[] = [];

  for (const p of paragraphs) {
    let pText = '';
    const children = p.childNodes;
    const walk = (n: Node) => {
      if (n.nodeType === 1) {
        const el = n as Element;
        if (el.tagName === 'w:t') {
          pText += el.textContent || '';
        } else if (el.tagName === 'w:tab') {
          pText += '\t';
        } else if (el.tagName === 'w:br' || el.tagName === 'w:cr') {
          pText += '\n';
        } else {
          for (let i = 0; i < el.childNodes.length; i++) {
            walk(el.childNodes[i]);
          }
        }
      }
    };
    for (let i = 0; i < children.length; i++) {
      walk(children[i]);
    }
    if (pText) lines.push(pText);
  }
  return lines.join('\n').trim();
}

/**
 * Checks if a <w:p> element contains an embedded image / drawing / shape graphic
 */
function paragraphHasEmbeddedImage(p: Element): boolean {
  if (p.getElementsByTagName('w:drawing').length > 0) return true;
  if (p.getElementsByTagName('w:pict').length > 0) return true;
  if (p.getElementsByTagName('v:imagedata').length > 0) return true;
  if (p.getElementsByTagName('a:blip').length > 0) return true;
  return false;
}

/**
 * Regex matchers for Figure and Table captions
 * Matches e.g.:
 *   "Hình 2.3: Sơ đồ kiến trúc"
 *   "Hình 2.3. Sơ đồ kiến trúc"
 *   "Hình 2.3 - Sơ đồ kiến trúc"
 *   "Ảnh 1.2: Giao diện người dùng"
 *   "Sơ đồ 3.1: Quy trình..."
 *   "Biểu đồ 2.4: Tỷ lệ..."
 *   "Bảng 2.1: Thống kê kết quả..."
 */
const FIGURE_CAPTION_REGEX = /^(Hình\s+ảnh|Hình\s+vẽ|Hình|Ảnh|Sơ\s+đồ|Biểu\s+đồ|Đồ\s+thị|Figure|Fig\.?)\s+(\d+(?:\.\d+)*)\s*(?:[:.\-–—]\s*(.*))?$/i;
const TABLE_CAPTION_REGEX = /^(Bảng\s+biểu|Bảng\s+số\s+liệu|Bảng|Biểu|Table|Tab\.?)\s+(\d+(?:\.\d+)*)\s*(?:[:.\-–—]\s*(.*))?$/i;
const CHAPTER_HEADING_REGEX = /^(?:CHƯƠNG|PHẦN|CHAPTER)\s+(\d+|[IVXLCDM]+)\b/i;

function romanToInt(roman: string): number | null {
  const s = roman.toUpperCase().trim();
  const map: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100 };
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const curr = map[s[i]];
    const next = map[s[i + 1]] || 0;
    if (!curr) return null;
    if (curr < next) total -= curr;
    else total += curr;
  }
  return total > 0 ? total : null;
}

function parseNumberParts(numStr: string): { chapterNum: number | null; seqNum: number } {
  const parts = numStr.split('.').map(n => parseInt(n, 10)).filter(n => !isNaN(n));
  if (parts.length >= 2) {
    return {
      chapterNum: parts[0],
      seqNum: parts[parts.length - 1],
    };
  }
  return {
    chapterNum: null,
    seqNum: parts[0] || 1,
  };
}

/**
 * Strips trailing page numbers or dot-leaders from TOC lines (e.g. "Hình 2.1: Sơ đồ ....... 15")
 */
function stripTocDotsAndPage(text: string): string {
  return text
    .replace(/\s*(?:\.{2,}|…+|\t+)\s*\d+\s*$/, '')
    .replace(/\s+\d+\s*$/, '')
    .trim();
}

/**
 * Main analyzer: Loads a .docx file into PizZip and performs a 100% deep XML inspection
 */
export async function analyzeWordThesisDocx(
  file: File
): Promise<{
  zip: PizZip;
  report: ThesisAuditReport;
}> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = new PizZip(arrayBuffer);
  const docXmlFile = zip.file('word/document.xml');
  if (!docXmlFile) {
    throw new Error('File không đúng cấu trúc Word (.docx). Nếu đang là file .doc (Word 97-2003), vui lòng lưu sang .docx để chỉnh sửa trực tiếp chuẩn 100%.');
  }

  const xmlText = docXmlFile.asText();
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
  const body = xmlDoc.getElementsByTagName('w:body')[0];
  if (!body) {
    throw new Error('Không tìm thấy phần thân tài liệu (w:body) trong file Word.');
  }

  const bodyChildren = Array.from(body.childNodes).filter(
    n => n.nodeType === 1 && ((n as Element).tagName === 'w:p' || (n as Element).tagName === 'w:tbl')
  ) as Element[];

  let totalParagraphs = 0;
  let totalTablesInDoc = 0;
  let totalImagesInDoc = 0;

  // Front-matter section state machine
  type SectionZone = 'NORMAL' | 'TOC_ABBREV' | 'TOC_TABLE' | 'TOC_FIGURE' | 'TOC_GENERAL';
  let currentZone: SectionZone = 'NORMAL';
  let currentChapter = 1;
  let hasEnteredMainChapters = false;

  const abbrevTocMap = new Map<string, string>(); // ACRONYM -> meaning
  const figureTocEntries: Array<{ numberStr: string; title: string; rawText: string; xmlNodeIndex: number }> = [];
  const tableTocEntries: Array<{ numberStr: string; title: string; rawText: string; xmlNodeIndex: number }> = [];

  let abbrevTableNodeIndex: number | null = null;
  let abbrevHeaderNodeIndex: number | null = null;
  let figureTocLastNodeIndex: number | null = null;
  let tableTocLastNodeIndex: number | null = null;

  const figuresCatalog: DetectedCatalogItem[] = [];
  const tablesCatalog: DetectedCatalogItem[] = [];

  // Track all body media nodes (<w:p> with image or <w:tbl> data table) to detect unlabelled media
  interface MediaNodeRecord {
    category: 'figure' | 'table';
    xmlNodeIndex: number;
    chapterNum: number;
    matchedCaptionId?: string;
    contextBefore: string;
    contextAfter: string;
  }
  const mediaNodes: MediaNodeRecord[] = [];

  // Pre-extract text of all body children for fast context lookahead/lookbehind
  const nodeTexts: string[] = bodyChildren.map(el => getXmlNodeText(el));

  const getContextAround = (idx: number, direction: 'before' | 'after'): string => {
    if (direction === 'before') {
      for (let i = idx - 1; i >= Math.max(0, idx - 4); i--) {
        const t = nodeTexts[i]?.replace(/\s+/g, ' ').trim();
        if (t && t.length > 5) return t.slice(0, 110);
      }
    } else {
      for (let i = idx + 1; i <= Math.min(bodyChildren.length - 1, idx + 4); i++) {
        const t = nodeTexts[i]?.replace(/\s+/g, ' ').trim();
        if (t && t.length > 5) return t.slice(0, 110);
      }
    }
    return '';
  };

  // Track acronyms in main body
  const bodyAcronymCounts = new Map<string, { count: number; firstContext: string; firstXmlIndex: number; inferredMeaning: string }>();

  for (let idx = 0; idx < bodyChildren.length; idx++) {
    const el = bodyChildren[idx];
    const tag = el.tagName;
    const rawText = nodeTexts[idx];
    const singleLineText = rawText.replace(/\s+/g, ' ').trim();
    const upperText = singleLineText.toUpperCase();

    if (tag === 'w:p') {
      totalParagraphs++;
    } else if (tag === 'w:tbl') {
      totalTablesInDoc++;
    }

    // 1. Detect Front-Matter Section Headers
    if (tag === 'w:p' && singleLineText.length > 0 && singleLineText.length <= 120) {
      if (
        upperText.includes('DANH MỤC TỪ VIẾT TẮT') ||
        upperText.includes('DANH MỤC CÁC TỪ VIẾT TẮT') ||
        upperText.includes('DANH MỤC CHỮ VIẾT TẮT') ||
        upperText.includes('DANH MỤC CÁC CHỮ VIẾT TẮT') ||
        upperText.includes('KÝ HIỆU VÀ CHỮ VIẾT TẮT')
      ) {
        currentZone = 'TOC_ABBREV';
        abbrevHeaderNodeIndex = idx;
        continue;
      }
      if (
        upperText.includes('DANH MỤC BẢNG') ||
        upperText.includes('DANH MỤC CÁC BẢNG')
      ) {
        currentZone = 'TOC_TABLE';
        tableTocLastNodeIndex = idx;
        continue;
      }
      if (
        upperText.includes('DANH MỤC HÌNH') ||
        upperText.includes('DANH MỤC CÁC HÌNH') ||
        upperText.includes('DANH MỤC ẢNH') ||
        upperText.includes('DANH MỤC SƠ ĐỒ') ||
        upperText.includes('DANH MỤC BIỂU ĐỒ')
      ) {
        currentZone = 'TOC_FIGURE';
        figureTocLastNodeIndex = idx;
        continue;
      }
      if (upperText === 'MỤC LỤC' || upperText === 'TÀI LIỆU THAM KHẢO' || upperText === 'PHỤ LỤC') {
        currentZone = 'TOC_GENERAL';
        continue;
      }

      // Detect Chapter Heading (e.g. "CHƯƠNG 1", "CHƯƠNG II", "PHẦN 1")
      const chapMatch = singleLineText.match(CHAPTER_HEADING_REGEX);
      if (chapMatch && !singleLineText.includes('....')) {
        const chapToken = chapMatch[1];
        const parsedChap = parseInt(chapToken, 10) || romanToInt(chapToken);
        if (parsedChap && parsedChap >= 1 && parsedChap <= 30) {
          currentChapter = parsedChap;
          currentZone = 'NORMAL';
          hasEnteredMainChapters = true;
        }
      } else if (
        upperText === 'MỞ ĐẦU' ||
        upperText === 'PHẦN MỞ ĐẦU' ||
        upperText === 'ĐẶT VẤN ĐỀ' ||
        upperText === 'TỔNG QUAN' ||
        upperText === 'LỜI NÓI ĐẦU'
      ) {
        currentZone = 'NORMAL';
      }
    }

    // 2. Process Front-Matter Zones (Abbreviations, List of Tables, List of Figures)
    if (currentZone === 'TOC_ABBREV' && !hasEnteredMainChapters) {
      if (tag === 'w:tbl') {
        abbrevTableNodeIndex = idx;
        const rows = Array.from(el.getElementsByTagName('w:tr'));
        for (const tr of rows) {
          const cells = Array.from(tr.getElementsByTagName('w:tc'));
          if (cells.length >= 2) {
            const col1 = getXmlNodeText(cells[0]).replace(/\s+/g, ' ').trim();
            const col2 = getXmlNodeText(cells[cells.length - 1]).replace(/\s+/g, ' ').trim();
            const col1Upper = col1.toUpperCase();
            if (
              col1 &&
              col1.length >= 2 &&
              col1.length <= 15 &&
              col1Upper !== 'STT' &&
              !col1Upper.includes('VIẾT TẮT') &&
              !col1Upper.includes('KÝ HIỆU')
            ) {
              abbrevTocMap.set(col1Upper, col2 || col1);
            } else if (cells.length >= 3) {
              // Format: [STT | Từ viết tắt | Nghĩa đầy đủ]
              const c2 = getXmlNodeText(cells[1]).replace(/\s+/g, ' ').trim();
              const c3 = getXmlNodeText(cells[2]).replace(/\s+/g, ' ').trim();
              if (c2 && c2.length >= 2 && c2.length <= 15 && !c2.toUpperCase().includes('VIẾT TẮT')) {
                abbrevTocMap.set(c2.toUpperCase(), c3 || c2);
              }
            }
          }
        }
        continue;
      } else if (tag === 'w:p' && singleLineText) {
        // Tab or colon or dash separated abbreviation line: "CNTT : Công nghệ thông tin"
        const abbrevLineMatch = singleLineText.match(/^([A-ZĐ0-9&/\-]{2,12})\s*(?:[:\-–—\t]+)\s*(.+)$/);
        if (abbrevLineMatch) {
          abbrevTocMap.set(abbrevLineMatch[1].trim().toUpperCase(), abbrevLineMatch[2].trim());
          abbrevHeaderNodeIndex = idx;
          continue;
        }
      }
    }

    if (currentZone === 'TOC_FIGURE' && !hasEnteredMainChapters) {
      if (tag === 'w:p' && singleLineText) {
        const cleanedLine = stripTocDotsAndPage(singleLineText);
        const m = cleanedLine.match(FIGURE_CAPTION_REGEX);
        if (m) {
          figureTocEntries.push({
            numberStr: m[2],
            title: (m[3] || '').trim(),
            rawText: singleLineText,
            xmlNodeIndex: idx,
          });
          figureTocLastNodeIndex = idx;
          continue;
        }
      } else if (tag === 'w:tbl') {
        const rows = Array.from(el.getElementsByTagName('w:tr'));
        for (const tr of rows) {
          const rowText = stripTocDotsAndPage(getXmlNodeText(tr).replace(/\s+/g, ' ').trim());
          const m = rowText.match(FIGURE_CAPTION_REGEX);
          if (m) {
            figureTocEntries.push({
              numberStr: m[2],
              title: (m[3] || '').trim(),
              rawText: rowText,
              xmlNodeIndex: idx,
            });
          }
        }
        figureTocLastNodeIndex = idx;
        continue;
      }
    }

    if (currentZone === 'TOC_TABLE' && !hasEnteredMainChapters) {
      if (tag === 'w:p' && singleLineText) {
        const cleanedLine = stripTocDotsAndPage(singleLineText);
        const m = cleanedLine.match(TABLE_CAPTION_REGEX);
        if (m) {
          tableTocEntries.push({
            numberStr: m[2],
            title: (m[3] || '').trim(),
            rawText: singleLineText,
            xmlNodeIndex: idx,
          });
          tableTocLastNodeIndex = idx;
          continue;
        }
      } else if (tag === 'w:tbl') {
        const rows = Array.from(el.getElementsByTagName('w:tr'));
        for (const tr of rows) {
          const rowText = stripTocDotsAndPage(getXmlNodeText(tr).replace(/\s+/g, ' ').trim());
          const m = rowText.match(TABLE_CAPTION_REGEX);
          if (m) {
            tableTocEntries.push({
              numberStr: m[2],
              title: (m[3] || '').trim(),
              rawText: rowText,
              xmlNodeIndex: idx,
            });
          }
        }
        tableTocLastNodeIndex = idx;
        continue;
      }
    }

    if (currentZone === 'TOC_GENERAL' && !hasEnteredMainChapters) {
      continue;
    }

    // 3. Main Document Body Inspection
    // Check if this paragraph has an embedded image
    if (tag === 'w:p' && paragraphHasEmbeddedImage(el)) {
      totalImagesInDoc++;
      mediaNodes.push({
        category: 'figure',
        xmlNodeIndex: idx,
        chapterNum: currentChapter,
        contextBefore: getContextAround(idx, 'before'),
        contextAfter: getContextAround(idx, 'after'),
      });
    }

    // Check if this is a data table in the main body
    if (tag === 'w:tbl') {
      const rows = el.getElementsByTagName('w:tr');
      if (rows.length >= 2) {
        mediaNodes.push({
          category: 'table',
          xmlNodeIndex: idx,
          chapterNum: currentChapter,
          contextBefore: getContextAround(idx, 'before'),
          contextAfter: getContextAround(idx, 'after'),
        });
      }
    }

    // Check if this paragraph is a Figure Caption or Table Caption in the body
    if (tag === 'w:p' && singleLineText && singleLineText.length <= 260) {
      // Avoid matching TOC dot-leader lines if TOC zone wasn't explicitly titled
      const isDotLeaderTocLine = /\.{4,}\s*\d+$/.test(singleLineText);
      if (isDotLeaderTocLine) {
        const cleaned = stripTocDotsAndPage(singleLineText);
        const fm = cleaned.match(FIGURE_CAPTION_REGEX);
        if (fm) {
          figureTocEntries.push({
            numberStr: fm[2],
            title: (fm[3] || '').trim(),
            rawText: singleLineText,
            xmlNodeIndex: idx,
          });
          figureTocLastNodeIndex = idx;
          continue;
        }
        const tm = cleaned.match(TABLE_CAPTION_REGEX);
        if (tm) {
          tableTocEntries.push({
            numberStr: tm[2],
            title: (tm[3] || '').trim(),
            rawText: singleLineText,
            xmlNodeIndex: idx,
          });
          tableTocLastNodeIndex = idx;
          continue;
        }
      }

      const figMatch = singleLineText.match(FIGURE_CAPTION_REGEX);
      if (figMatch) {
        const prefix = figMatch[1].trim();
        const numberStr = figMatch[2].trim();
        const title = (figMatch[3] || '').trim();
        const { chapterNum, seqNum } = parseNumberParts(numberStr);
        if (chapterNum !== null && chapterNum >= 1 && chapterNum <= 30) {
          currentChapter = chapterNum;
        }

        // Check if there is an image within 2 nodes before or after this caption
        let linkedMedia: MediaNodeRecord | undefined;
        for (let k = mediaNodes.length - 1; k >= 0; k--) {
          const m = mediaNodes[k];
          if (m.category === 'figure' && !m.matchedCaptionId && Math.abs(m.xmlNodeIndex - idx) <= 2) {
            linkedMedia = m;
            break;
          }
        }
        // Or check 1-2 nodes ahead if caption is placed above the image
        const hasImageAhead =
          (idx + 1 < bodyChildren.length &&
            bodyChildren[idx + 1].tagName === 'w:p' &&
            paragraphHasEmbeddedImage(bodyChildren[idx + 1])) ||
          (idx + 2 < bodyChildren.length &&
            bodyChildren[idx + 2].tagName === 'w:p' &&
            paragraphHasEmbeddedImage(bodyChildren[idx + 2]));

        const itemId = `fig-${idx}-${numberStr}`;
        if (linkedMedia) {
          linkedMedia.matchedCaptionId = itemId;
        }

        figuresCatalog.push({
          id: itemId,
          category: 'figure',
          prefix,
          numberStr,
          chapterNum,
          seqNum,
          title,
          fullCaption: singleLineText,
          xmlNodeIndex: idx,
          hasAdjacentMedia: Boolean(linkedMedia || hasImageAhead || paragraphHasEmbeddedImage(el)),
          inFrontMatterToc: figureTocEntries.some(e => e.numberStr === numberStr),
          contextSnippet: getContextAround(idx, 'before') || getContextAround(idx, 'after'),
        });
      }

      const tblMatch = singleLineText.match(TABLE_CAPTION_REGEX);
      if (tblMatch) {
        const prefix = tblMatch[1].trim();
        const numberStr = tblMatch[2].trim();
        const title = (tblMatch[3] || '').trim();
        const { chapterNum, seqNum } = parseNumberParts(numberStr);
        if (chapterNum !== null && chapterNum >= 1 && chapterNum <= 30) {
          currentChapter = chapterNum;
        }

        // Link to adjacent table (usually 1-2 nodes after or before)
        let linkedTable: MediaNodeRecord | undefined;
        for (let k = mediaNodes.length - 1; k >= 0; k--) {
          const m = mediaNodes[k];
          if (m.category === 'table' && !m.matchedCaptionId && Math.abs(m.xmlNodeIndex - idx) <= 2) {
            linkedTable = m;
            break;
          }
        }
        const hasTableAhead =
          (idx + 1 < bodyChildren.length && bodyChildren[idx + 1].tagName === 'w:tbl') ||
          (idx + 2 < bodyChildren.length && bodyChildren[idx + 2].tagName === 'w:tbl');

        const itemId = `tbl-${idx}-${numberStr}`;
        if (linkedTable) {
          linkedTable.matchedCaptionId = itemId;
        }

        tablesCatalog.push({
          id: itemId,
          category: 'table',
          prefix,
          numberStr,
          chapterNum,
          seqNum,
          title,
          fullCaption: singleLineText,
          xmlNodeIndex: idx,
          hasAdjacentMedia: Boolean(linkedTable || hasTableAhead),
          inFrontMatterToc: tableTocEntries.some(e => e.numberStr === numberStr),
          contextSnippet: getContextAround(idx, 'after') || getContextAround(idx, 'before'),
        });
      }
    }

    // Second pass link: if a table or figure appeared right AFTER its caption, mark its mediaNode as matched
    if (mediaNodes.length > 0) {
      const latestMedia = mediaNodes[mediaNodes.length - 1];
      if (!latestMedia.matchedCaptionId && latestMedia.xmlNodeIndex === idx) {
        if (latestMedia.category === 'figure') {
          const prevFig = figuresCatalog.find(
            f => Math.abs(f.xmlNodeIndex - idx) <= 2
          );
          if (prevFig) latestMedia.matchedCaptionId = prevFig.id;
        } else if (latestMedia.category === 'table') {
          const prevTbl = tablesCatalog.find(
            t => Math.abs(t.xmlNodeIndex - idx) <= 2
          );
          if (prevTbl) latestMedia.matchedCaptionId = prevTbl.id;
        }
      }
    }

    // 4. Scan Acronyms in Main Body Text
    if (singleLineText.length > 3) {
      // Find patterns like "Công nghệ thông tin (CNTT)" or "(CNTT: Công nghệ thông tin)" to auto-learn meaning
      const parenMatches = singleLineText.matchAll(/([A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][^()\n]{4,65})\s*\(\s*([A-ZĐ&]{2,8})\s*\)/g);
      const localInferred = new Map<string, string>();
      for (const pm of parenMatches) {
        const phrase = pm[1].trim();
        const acr = pm[2].trim();
        localInferred.set(acr, phrase);
      }

      const acronymMatches = singleLineText.matchAll(/\b([A-ZĐ]{2,7}(?:&[A-ZĐ]{1,4})?)\b/g);
      for (const am of acronymMatches) {
        const token = am[1];
        if (IGNORED_UPPERCASE_TOKENS.has(token)) continue;
        // Skip if the entire paragraph is ALL CAPS (e.g. a heading)
        if (singleLineText === singleLineText.toUpperCase() && singleLineText.length > 15) continue;

        const existing = bodyAcronymCounts.get(token);
        const inferred =
          localInferred.get(token) ||
          abbrevTocMap.get(token) ||
          ACADEMIC_ABBREV_DICTIONARY[token] ||
          '';

        if (!existing) {
          bodyAcronymCounts.set(token, {
            count: 1,
            firstContext: singleLineText.slice(0, 140),
            firstXmlIndex: idx,
            inferredMeaning: inferred,
          });
        } else {
          existing.count += 1;
          if (!existing.inferredMeaning && inferred) {
            existing.inferredMeaning = inferred;
          }
        }
      }
    }
  }

  // ============================================================================
  // AUDIT 1: CHECK FIGURES & TABLES FOR SEQUENCE GAPS, UNLABELLED MEDIA, DUPLICATES
  // ============================================================================
  const issues: ThesisAuditIssue[] = [];
  const unlabelledMedia: DetectedUnlabelledMedia[] = [];

  const auditCatalogSequence = (
    catalog: DetectedCatalogItem[],
    category: 'figure' | 'table',
    tocEntries: Array<{ numberStr: string; title: string; rawText: string; xmlNodeIndex: number }>
  ) => {
    const defaultPrefix =
      catalog[0]?.prefix || (category === 'figure' ? 'Hình' : 'Bảng');

    // Find unlabelled media nodes for this category
    const catMediaNodes = mediaNodes.filter(m => m.category === category);

    // Group catalog items by chapterNum (or null for flat numbering 1, 2, 3...)
    const groups = new Map<string, DetectedCatalogItem[]>();
    for (const item of catalog) {
      const key = item.chapterNum !== null ? `chap-${item.chapterNum}` : 'flat';
      const arr = groups.get(key) || [];
      arr.push(item);
      groups.set(key, arr);
    }

    // Check for unlabelled media sitting between catalog items or inside chapters
    for (const mNode of catMediaNodes) {
      if (mNode.matchedCaptionId) continue;

      // Skip front-matter tables (like abbreviation table or header tables at top of document)
      if (
        category === 'table' &&
        (mNode.xmlNodeIndex === abbrevTableNodeIndex || mNode.xmlNodeIndex < 3)
      ) {
        continue;
      }

      // Find the catalog item immediately before and immediately after this unlabelled media node
      const prevCat = [...catalog]
        .reverse()
        .find(c => c.xmlNodeIndex < mNode.xmlNodeIndex);
      const nextCat = catalog.find(c => c.xmlNodeIndex > mNode.xmlNodeIndex);

      const prefix = prevCat?.prefix || nextCat?.prefix || defaultPrefix;
      const chap = prevCat?.chapterNum ?? nextCat?.chapterNum ?? mNode.chapterNum;
      const expectedSeq = prevCat ? prevCat.seqNum + 1 : 1;
      const expectedNumberStr =
        chap !== null && (prevCat?.chapterNum !== null || nextCat?.chapterNum !== null || catalog.some(c => c.chapterNum !== null))
          ? `${chap}.${expectedSeq}`
          : `${expectedSeq}`;

      const contextHint =
        mNode.contextAfter || mNode.contextBefore || (category === 'figure' ? 'Hình minh họa' : 'Bảng dữ liệu');
      const shortTitle = contextHint.length > 65 ? `${contextHint.slice(0, 62)}...` : contextHint;
      const suggestedCaption = `${prefix} ${expectedNumberStr}: ${shortTitle}`;

      const unlabelledItem: DetectedUnlabelledMedia = {
        id: `unlabelled-${category}-${mNode.xmlNodeIndex}`,
        category,
        xmlNodeIndex: mNode.xmlNodeIndex,
        chapterNum: chap || 1,
        prevCaption: prevCat,
        nextCaption: nextCat,
        expectedPrefix: prefix,
        expectedNumberStr,
        suggestedCaption,
        contextBefore: mNode.contextBefore,
        contextAfter: mNode.contextAfter,
      };
      unlabelledMedia.push(unlabelledItem);

      // Compute cascade updates if next captions in the same chapter need to be incremented (e.g., 2.4 -> 2.5, 2.5 -> 2.6)
      const cascadeUpdates: CascadeUpdateItem[] = [];
      if (nextCat && nextCat.chapterNum === prevCat?.chapterNum && nextCat.seqNum === expectedSeq) {
        const sameChapSubsequent = catalog.filter(
          c => c.xmlNodeIndex > mNode.xmlNodeIndex && c.chapterNum === nextCat.chapterNum
        );
        let runningSeq = expectedSeq + 1;
        for (const sub of sameChapSubsequent) {
          const newNumStr =
            sub.chapterNum !== null ? `${sub.chapterNum}.${runningSeq}` : `${runningSeq}`;
          if (sub.numberStr !== newNumStr) {
            const updatedCaption = sub.fullCaption.replace(
              new RegExp(`^(${sub.prefix}\\s+)${sub.numberStr.replace('.', '\\.')}`, 'i'),
              `$1${newNumStr}`
            );
            cascadeUpdates.push({
              xmlNodeIndex: sub.xmlNodeIndex,
              oldText: sub.fullCaption,
              newText: updatedCaption,
              oldNumberStr: sub.numberStr,
              newNumberStr: newNumStr,
            });
          }
          runningSeq++;
        }
      }

      const betweenExplain =
        prevCat && nextCat
          ? `Nằm giữa [${prevCat.prefix} ${prevCat.numberStr}] và [${nextCat.prefix} ${nextCat.numberStr}] có 1 ${
              category === 'figure' ? 'hình ảnh' : 'bảng dữ liệu'
            } chưa được gắn nhãn (ghi chú). Lẽ ra chuỗi đúng phải là ${prevCat.numberStr} → ${expectedNumberStr} → ${
              nextCat.chapterNum !== null ? `${nextCat.chapterNum}.${expectedSeq + 1}` : expectedSeq + 1
            }.`
          : prevCat
          ? `Ngay sau [${prevCat.prefix} ${prevCat.numberStr}] có 1 ${
              category === 'figure' ? 'hình ảnh' : 'bảng dữ liệu'
            } bị bỏ sót chưa gắn nhãn tên ${prefix} ${expectedNumberStr}.`
          : `Phát hiện 1 ${
              category === 'figure' ? 'hình ảnh' : 'bảng dữ liệu'
            } trong bài chưa có dòng ghi chú (${prefix} ${expectedNumberStr}).`;

      issues.push({
        id: `issue-unlabelled-${category}-${mNode.xmlNodeIndex}`,
        category,
        issueType: 'UNLABELLED_MEDIA',
        severity: 'error',
        title: `Thiếu ghi chú cho ${category === 'figure' ? 'Hình ảnh' : 'Bảng biểu'} (Lẽ ra là ${prefix} ${expectedNumberStr})`,
        description:
          betweenExplain +
          (cascadeUpdates.length > 0
            ? ` Khi bấm sửa, hệ thống sẽ chèn nhãn "${prefix} ${expectedNumberStr}" và tự động cập nhật ${cascadeUpdates.length} mục phía sau (${cascadeUpdates
                .map(u => `${u.oldNumberStr} → ${u.newNumberStr}`)
                .join(', ')}) cho khớp 100%.`
            : ''),
        locationLabel: `Đoạn văn #${mNode.xmlNodeIndex + 1}${
          prevCat ? ` (Sau ${prevCat.prefix} ${prevCat.numberStr})` : ''
        }`,
        currentText: `[Chưa gắn nhãn ${category === 'figure' ? 'Hình ảnh' : 'Bảng'}] • Ngữ cảnh: "${
          mNode.contextBefore || mNode.contextAfter || 'Trong nội dung bài'
        }"`,
        suggestedFixText: suggestedCaption,
        xmlNodeIndex: mNode.xmlNodeIndex,
        fixAction: category === 'figure' ? 'insert_caption_after' : 'insert_caption_before',
        cascadeUpdates,
        fixed: false,
      });
    }

    // Check sequence numbering within each chapter/group
    for (const [, groupItems] of groups.entries()) {
      for (let i = 0; i < groupItems.length; i++) {
        const curr = groupItems[i];
        const prev = i > 0 ? groupItems[i - 1] : null;
        const expectedSeq = prev ? prev.seqNum + 1 : 1;

        // Check if there is an unlabelled media between prev and curr
        const hasUnlabelledBetween = unlabelledMedia.some(
          u =>
            u.category === category &&
            u.xmlNodeIndex > (prev?.xmlNodeIndex ?? -1) &&
            u.xmlNodeIndex < curr.xmlNodeIndex
        );

        if (curr.seqNum > expectedSeq && !hasUnlabelledBetween) {
          // CASE: Sequence gap (e.g. Hình 2.3 -> Hình 2.5 with NO image in between!)
          const expectedNumStr =
            curr.chapterNum !== null ? `${curr.chapterNum}.${expectedSeq}` : `${expectedSeq}`;
          const fixedCaption = curr.fullCaption.replace(
            new RegExp(`^(${curr.prefix}\\s+)${curr.numberStr.replace('.', '\\.')}`, 'i'),
            `$1${expectedNumStr}`
          );

          // Also build cascade updates for subsequent items in this chapter so 2.5->2.4, 2.6->2.5, etc.
          const cascadeUpdates: CascadeUpdateItem[] = [];
          let nextExpected = expectedSeq + 1;
          for (let j = i + 1; j < groupItems.length; j++) {
            const sub = groupItems[j];
            const subExpectedStr =
              sub.chapterNum !== null ? `${sub.chapterNum}.${nextExpected}` : `${nextExpected}`;
            if (sub.numberStr !== subExpectedStr) {
              const subFixed = sub.fullCaption.replace(
                new RegExp(`^(${sub.prefix}\\s+)${sub.numberStr.replace('.', '\\.')}`, 'i'),
                `$1${subExpectedStr}`
              );
              cascadeUpdates.push({
                xmlNodeIndex: sub.xmlNodeIndex,
                oldText: sub.fullCaption,
                newText: subFixed,
                oldNumberStr: sub.numberStr,
                newNumberStr: subExpectedStr,
              });
            }
            nextExpected++;
          }

          issues.push({
            id: `issue-gap-${category}-${curr.xmlNodeIndex}`,
            category,
            issueType: 'SEQUENCE_GAP',
            severity: 'error',
            title: `Đánh nhảy số thứ tự: Đang ${
              prev ? `${prev.prefix} ${prev.numberStr}` : 'đầu chương'
            } nhảy sang ${curr.prefix} ${curr.numberStr} (Thiếu ${expectedNumStr})`,
            description: `Giữa ${
              prev ? `${prev.prefix} ${prev.numberStr}` : 'đầu mục'
            } và ${curr.prefix} ${curr.numberStr} không có ${
              category === 'figure' ? 'hình ảnh' : 'bảng biểu'
            } nào khác nhưng số hiệu bị nhảy cóc. Lẽ ra phải đánh số liên tiếp là ${curr.prefix} ${expectedNumStr}.${
              cascadeUpdates.length > 0
                ? ` Sửa mục này sẽ đồng thời lùi số ${cascadeUpdates.length} mục kế tiếp (${cascadeUpdates
                    .map(c => `${c.oldNumberStr} → ${c.newNumberStr}`)
                    .join(', ')}) về đúng chuẩn.`
                : ''
            }`,
            locationLabel: `Đoạn văn #${curr.xmlNodeIndex + 1}`,
            currentText: curr.fullCaption,
            suggestedFixText: fixedCaption,
            xmlNodeIndex: curr.xmlNodeIndex,
            fixAction: 'replace_paragraph_text',
            cascadeUpdates,
            fixed: false,
          });
        } else if (prev && curr.seqNum === prev.seqNum) {
          // CASE: Duplicate number (e.g. Hình 2.3 and Hình 2.3 twice!)
          const expectedNumStr =
            curr.chapterNum !== null ? `${curr.chapterNum}.${prev.seqNum + 1}` : `${prev.seqNum + 1}`;
          const fixedCaption = curr.fullCaption.replace(
            new RegExp(`^(${curr.prefix}\\s+)${curr.numberStr.replace('.', '\\.')}`, 'i'),
            `$1${expectedNumStr}`
          );

          const cascadeUpdates: CascadeUpdateItem[] = [];
          let nextExpected = prev.seqNum + 2;
          for (let j = i + 1; j < groupItems.length; j++) {
            const sub = groupItems[j];
            const subExpectedStr =
              sub.chapterNum !== null ? `${sub.chapterNum}.${nextExpected}` : `${nextExpected}`;
            if (sub.numberStr !== subExpectedStr) {
              const subFixed = sub.fullCaption.replace(
                new RegExp(`^(${sub.prefix}\\s+)${sub.numberStr.replace('.', '\\.')}`, 'i'),
                `$1${subExpectedStr}`
              );
              cascadeUpdates.push({
                xmlNodeIndex: sub.xmlNodeIndex,
                oldText: sub.fullCaption,
                newText: subFixed,
                oldNumberStr: sub.numberStr,
                newNumberStr: subExpectedStr,
              });
            }
            nextExpected++;
          }

          issues.push({
            id: `issue-dup-${category}-${curr.xmlNodeIndex}`,
            category,
            issueType: 'DUPLICATE_NUMBER',
            severity: 'error',
            title: `Trùng số thứ tự: ${curr.prefix} ${curr.numberStr} bị lặp lại 2 lần`,
            description: `Mục này bị đánh trùng số hiệu "${curr.numberStr}" với mục đứng trước đó. Lẽ ra phải đánh số tiếp theo là "${curr.prefix} ${expectedNumStr}".`,
            locationLabel: `Đoạn văn #${curr.xmlNodeIndex + 1}`,
            currentText: curr.fullCaption,
            suggestedFixText: fixedCaption,
            xmlNodeIndex: curr.xmlNodeIndex,
            fixAction: 'replace_paragraph_text',
            cascadeUpdates,
            fixed: false,
          });
        }
      }
    }

    // Cross-check against Front-Matter TOC if the document has a List of Figures / List of Tables
    if (tocEntries.length > 0) {
      for (const item of catalog) {
        const matchToc = tocEntries.find(e => e.numberStr === item.numberStr);
        if (!matchToc) {
          issues.push({
            id: `issue-toc-missing-${category}-${item.xmlNodeIndex}`,
            category,
            issueType: 'TOC_MISSING',
            severity: 'warning',
            title: `Thiếu "${item.prefix} ${item.numberStr}" trong trang Danh mục ${
              category === 'figure' ? 'hình ảnh' : 'bảng biểu'
            }`,
            description: `Trong nội dung bài có "${item.fullCaption}" nhưng trên bảng Danh mục ${
              category === 'figure' ? 'hình ảnh' : 'bảng biểu'
            } đầu tài liệu lại bị liệt kê thiếu mục này.`,
            locationLabel: `Danh mục đầu file ↔ Đoạn #${item.xmlNodeIndex + 1}`,
            currentText: `[Chưa có trong Danh mục ${category === 'figure' ? 'hình ảnh' : 'bảng'}]`,
            suggestedFixText: item.fullCaption,
            xmlNodeIndex:
              (category === 'figure' ? figureTocLastNodeIndex : tableTocLastNodeIndex) ??
              item.xmlNodeIndex,
            fixAction: 'append_to_toc',
            fixed: false,
          });
        } else if (
          item.title &&
          matchToc.title &&
          item.title.toLowerCase().replace(/[^a-z0-9à-ỹ]/g, '') !==
            matchToc.title.toLowerCase().replace(/[^a-z0-9à-ỹ]/g, '')
        ) {
          issues.push({
            id: `issue-toc-mismatch-${category}-${item.xmlNodeIndex}`,
            category,
            issueType: 'TOC_MISMATCH',
            severity: 'warning',
            title: `Sai lệch tên "${item.prefix} ${item.numberStr}" giữa Danh mục và nội dung bài`,
            description: `Tên ghi trên Danh mục đầu tài liệu ("${matchToc.title}") không khớp với tên ghi chú thực tế tại hình/bảng ("${item.title}").`,
            locationLabel: `Danh mục đoạn #${matchToc.xmlNodeIndex + 1}`,
            currentText: matchToc.rawText,
            suggestedFixText: `${item.prefix} ${item.numberStr}: ${item.title}`,
            xmlNodeIndex: matchToc.xmlNodeIndex,
            fixAction: 'replace_paragraph_text',
            fixed: false,
          });
        }
      }
    }
  };

  auditCatalogSequence(figuresCatalog, 'figure', figureTocEntries);
  auditCatalogSequence(tablesCatalog, 'table', tableTocEntries);

  // ============================================================================
  // AUDIT 2: ABBREVIATIONS (DANH MỤC TỪ VIẾT TẮT)
  // ============================================================================
  const abbreviations: DetectedAbbreviationItem[] = [];

  // 1. Add all acronyms found in the front-matter Abbreviation List
  for (const [acr, meaning] of abbrevTocMap.entries()) {
    const bodyStats = bodyAcronymCounts.get(acr);
    const count = bodyStats?.count || 0;
    abbreviations.push({
      acronym: acr,
      meaningInToc: meaning,
      inFrontMatterList: true,
      occurrencesInBody: count,
      firstContextSnippet: bodyStats?.firstContext || 'Không xuất hiện trong thân bài',
      inferredMeaning: meaning,
      firstBodyXmlIndex: bodyStats?.firstXmlIndex ?? 0,
    });

    if (count === 0) {
      issues.push({
        id: `issue-unused-abbrev-${acr}`,
        category: 'abbreviation',
        issueType: 'UNUSED_ABBREV',
        severity: 'warning',
        title: `Từ viết tắt "${acr}" có trong Danh mục nhưng không dùng trong bài`,
        description: `Từ viết tắt "${acr}" (${meaning}) được liệt kê ở Danh mục từ viết tắt nhưng không xuất hiện lần nào trong nội dung đề án/giáo trình.`,
        locationLabel: 'Bảng Danh mục từ viết tắt',
        currentText: `${acr}: ${meaning}`,
        suggestedFixText: `Xóa dòng "${acr}" khỏi Danh mục từ viết tắt`,
        xmlNodeIndex: abbrevTableNodeIndex ?? abbrevHeaderNodeIndex ?? 0,
        fixAction: 'remove_unused_abbrev',
        abbrevData: { acronym: acr, meaning },
        fixed: false,
      });
    }
  }

  // 2. Check acronyms used in the body that are missing from the front-matter Abbreviation List
  for (const [acr, stats] of bodyAcronymCounts.entries()) {
    if (abbrevTocMap.has(acr)) continue;
    // Flag acronyms that appear >= 2 times OR have a known academic meaning
    if (stats.count >= 2 || Boolean(stats.inferredMeaning)) {
      const suggestedMeaning =
        stats.inferredMeaning ||
        ACADEMIC_ABBREV_DICTIONARY[acr] ||
        `Giải nghĩa đầy đủ của ${acr}`;

      abbreviations.push({
        acronym: acr,
        meaningInToc: '',
        inFrontMatterList: false,
        occurrencesInBody: stats.count,
        firstContextSnippet: stats.firstContext,
        inferredMeaning: suggestedMeaning,
        firstBodyXmlIndex: stats.firstXmlIndex,
      });

      issues.push({
        id: `issue-unlisted-abbrev-${acr}`,
        category: 'abbreviation',
        issueType: 'UNLISTED_ABBREV',
        severity: 'error',
        title: `Thiếu từ viết tắt "${acr}" (Xuất hiện ${stats.count} lần trong bài)`,
        description: `Từ viết tắt "${acr}" được sử dụng ${stats.count} lần trong nội dung bài viết nhưng chưa được khai báo trong Danh mục từ viết tắt.`,
        locationLabel: `Đoạn văn đầu tiên #${stats.firstXmlIndex + 1}`,
        currentText: stats.firstContext,
        suggestedFixText: `${acr}: ${suggestedMeaning}`,
        xmlNodeIndex: abbrevTableNodeIndex ?? abbrevHeaderNodeIndex ?? stats.firstXmlIndex,
        fixAction: 'add_abbreviation',
        abbrevData: {
          acronym: acr,
          meaning: suggestedMeaning,
        },
        fixed: false,
      });
    }
  }

  abbreviations.sort((a, b) => a.acronym.localeCompare(b.acronym));

  return {
    zip,
    report: {
      fileName: file.name,
      totalParagraphs,
      totalTablesInDoc,
      totalImagesInDoc,
      figuresCatalog,
      tablesCatalog,
      unlabelledMedia,
      abbreviations,
      issues,
      tocZones: {
        abbrevTableNodeIndex,
        abbrevHeaderNodeIndex,
        figureTocLastNodeIndex,
        tableTocLastNodeIndex,
      },
    },
  };
}

/**
 * Helper: Replaces the visible text inside a <w:p> element while preserving
 * 100% of its paragraph properties (<w:pPr>), run properties (<w:rPr>), and any embedded drawings!
 */
function replaceParagraphTextPreservingFormatting(
  xmlDoc: Document,
  pElement: Element,
  newText: string
): void {
  const wNs = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

  // Find first existing <w:rPr> to clone font, size, bold/italic, color
  const existingRPr = pElement.getElementsByTagName('w:rPr')[0];
  const clonedRPr = existingRPr ? existingRPr.cloneNode(true) : null;

  // Check if any run contains drawings/images (<w:drawing>, <w:pict>) — never delete image runs!
  const runs = Array.from(pElement.childNodes).filter(
    n => n.nodeType === 1 && (n as Element).tagName === 'w:r'
  ) as Element[];

  let replacedFirstTextRun = false;

  for (const r of runs) {
    const hasDrawing =
      r.getElementsByTagName('w:drawing').length > 0 ||
      r.getElementsByTagName('w:pict').length > 0 ||
      r.getElementsByTagName('v:imagedata').length > 0;

    if (hasDrawing) {
      // Remove only <w:t> inside this drawing run if any
      const tNodes = Array.from(r.getElementsByTagName('w:t'));
      for (const t of tNodes) {
        t.parentNode?.removeChild(t);
      }
      continue;
    }

    if (!replacedFirstTextRun) {
      // Reuse this first text run and set its <w:t> to newText
      const tNodes = Array.from(r.getElementsByTagName('w:t'));
      if (tNodes.length > 0) {
        tNodes[0].textContent = newText;
        tNodes[0].setAttribute('xml:space', 'preserve');
        for (let i = 1; i < tNodes.length; i++) {
          tNodes[i].parentNode?.removeChild(tNodes[i]);
        }
      } else {
        const newT = xmlDoc.createElementNS(wNs, 'w:t');
        newT.setAttribute('xml:space', 'preserve');
        newT.textContent = newText;
        r.appendChild(newT);
      }
      replacedFirstTextRun = true;
    } else {
      // Remove subsequent pure-text runs (and hyperlink wrappers if pure text)
      pElement.removeChild(r);
    }
  }

  // Also remove any <w:hyperlink> or <w:fldSimple> text runs if we already replaced text
  const hyperlinks = Array.from(pElement.childNodes).filter(
    n => n.nodeType === 1 && (n as Element).tagName === 'w:hyperlink'
  ) as Element[];
  for (const hl of hyperlinks) {
    if (!replacedFirstTextRun) {
      const tNodes = Array.from(hl.getElementsByTagName('w:t'));
      if (tNodes.length > 0) {
        tNodes[0].textContent = newText;
        for (let i = 1; i < tNodes.length; i++) {
          tNodes[i].parentNode?.removeChild(tNodes[i]);
        }
        replacedFirstTextRun = true;
      }
    } else {
      pElement.removeChild(hl);
    }
  }

  if (!replacedFirstTextRun) {
    const newR = xmlDoc.createElementNS(wNs, 'w:r');
    if (clonedRPr) {
      newR.appendChild(clonedRPr);
    }
    const newT = xmlDoc.createElementNS(wNs, 'w:t');
    newT.setAttribute('xml:space', 'preserve');
    newT.textContent = newText;
    newR.appendChild(newT);
    pElement.appendChild(newR);
  }
}

/**
 * Helper: Creates a new <w:p> caption element by cloning the exact paragraph/run style
 * (<w:pPr> & <w:rPr>) of a reference caption in the document so font, size, centering, and color match 100%.
 */
function createFormattedCaptionParagraph(
  xmlDoc: Document,
  bodyChildren: Element[],
  captionText: string
): Element {
  const wNs = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const newP = xmlDoc.createElementNS(wNs, 'w:p');

  // Search for an existing Figure/Table caption paragraph in bodyChildren to clone its <w:pPr> and <w:rPr>
  let templateP: Element | null = null;
  for (const el of bodyChildren) {
    if (el.tagName === 'w:p') {
      const txt = getXmlNodeText(el).trim();
      if (FIGURE_CAPTION_REGEX.test(txt) || TABLE_CAPTION_REGEX.test(txt)) {
        templateP = el;
        break;
      }
    }
  }

  if (templateP) {
    const pPr = templateP.getElementsByTagName('w:pPr')[0];
    if (pPr) {
      newP.appendChild(pPr.cloneNode(true));
    }
  } else {
    const pPr = xmlDoc.createElementNS(wNs, 'w:pPr');
    const jc = xmlDoc.createElementNS(wNs, 'w:jc');
    jc.setAttribute('w:val', 'center');
    pPr.appendChild(jc);
    newP.appendChild(pPr);
  }

  const newR = xmlDoc.createElementNS(wNs, 'w:r');
  if (templateP) {
    const rPr = templateP.getElementsByTagName('w:rPr')[0];
    if (rPr) {
      newR.appendChild(rPr.cloneNode(true));
    }
  } else {
    const rPr = xmlDoc.createElementNS(wNs, 'w:rPr');
    const iEl = xmlDoc.createElementNS(wNs, 'w:i');
    rPr.appendChild(iEl);
    newR.appendChild(rPr);
  }

  const newT = xmlDoc.createElementNS(wNs, 'w:t');
  newT.setAttribute('xml:space', 'preserve');
  newT.textContent = captionText;
  newR.appendChild(newT);
  newP.appendChild(newR);

  return newP;
}

/**
 * Applies a single surgical fix (and its cascade renumbering updates if any) directly to `word/document.xml`
 * inside the PizZip instance, preserving 100% of the rest of the Word document!
 */
export function applySurgicalFixToZip(
  zip: PizZip,
  issue: ThesisAuditIssue,
  customFixText?: string,
  tocZones?: ThesisAuditReport['tocZones']
): void {
  const docXmlFile = zip.file('word/document.xml');
  if (!docXmlFile) return;

  const xmlText = docXmlFile.asText();
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
  const body = xmlDoc.getElementsByTagName('w:body')[0];
  if (!body) return;

  const bodyChildren = Array.from(body.childNodes).filter(
    n => n.nodeType === 1 && ((n as Element).tagName === 'w:p' || (n as Element).tagName === 'w:tbl')
  ) as Element[];

  const finalFixText = (customFixText ?? issue.suggestedFixText).trim();

  if (issue.fixAction === 'replace_paragraph_text') {
    const targetNode = bodyChildren[issue.xmlNodeIndex];
    if (targetNode && targetNode.tagName === 'w:p') {
      replaceParagraphTextPreservingFormatting(xmlDoc, targetNode, finalFixText);
    }

    // Apply cascade updates (e.g., shifting subsequent captions 2.5 -> 2.4, 2.6 -> 2.5)
    if (issue.cascadeUpdates && issue.cascadeUpdates.length > 0) {
      for (const casc of issue.cascadeUpdates) {
        const cascNode = bodyChildren[casc.xmlNodeIndex];
        if (cascNode && cascNode.tagName === 'w:p') {
          replaceParagraphTextPreservingFormatting(xmlDoc, cascNode, casc.newText);
        }
      }
    }
  } else if (
    issue.fixAction === 'insert_caption_after' ||
    issue.fixAction === 'insert_caption_before'
  ) {
    // First apply cascade updates on subsequent captions before inserting the new node
    if (issue.cascadeUpdates && issue.cascadeUpdates.length > 0) {
      for (const casc of issue.cascadeUpdates) {
        const cascNode = bodyChildren[casc.xmlNodeIndex];
        if (cascNode && cascNode.tagName === 'w:p') {
          replaceParagraphTextPreservingFormatting(xmlDoc, cascNode, casc.newText);
        }
      }
    }

    const targetNode = bodyChildren[issue.xmlNodeIndex];
    if (targetNode) {
      const newCaptionP = createFormattedCaptionParagraph(xmlDoc, bodyChildren, finalFixText);
      if (issue.fixAction === 'insert_caption_after') {
        if (targetNode.nextSibling) {
          body.insertBefore(newCaptionP, targetNode.nextSibling);
        } else {
          body.appendChild(newCaptionP);
        }
      } else {
        body.insertBefore(newCaptionP, targetNode);
      }
    }
  } else if (issue.fixAction === 'add_abbreviation') {
    // Parse "ACRONYM: Full meaning" from finalFixText
    const parts = finalFixText.split(/[:\-–—]/);
    const acronym = (parts[0] || issue.abbrevData?.acronym || '').trim();
    const meaning = (parts.slice(1).join(':').trim() || issue.abbrevData?.meaning || finalFixText).trim();

    const abbrevTblIdx = tocZones?.abbrevTableNodeIndex;
    const abbrevHdrIdx = tocZones?.abbrevHeaderNodeIndex;

    if (abbrevTblIdx !== null && abbrevTblIdx !== undefined && bodyChildren[abbrevTblIdx]?.tagName === 'w:tbl') {
      // Clone the last row <w:tr> of the existing Abbreviation Table and set its cells!
      const tbl = bodyChildren[abbrevTblIdx];
      const rows = Array.from(tbl.getElementsByTagName('w:tr'));
      if (rows.length > 0) {
        const templateRow = rows[rows.length - 1];
        const newRow = templateRow.cloneNode(true) as Element;
        const cells = Array.from(newRow.getElementsByTagName('w:tc'));
        if (cells.length >= 3) {
          const p0 = cells[0].getElementsByTagName('w:p')[0];
          const p1 = cells[1].getElementsByTagName('w:p')[0];
          const p2 = cells[2].getElementsByTagName('w:p')[0];
          if (p0) replaceParagraphTextPreservingFormatting(xmlDoc, p0, String(rows.length));
          if (p1) replaceParagraphTextPreservingFormatting(xmlDoc, p1, acronym);
          if (p2) replaceParagraphTextPreservingFormatting(xmlDoc, p2, meaning);
        } else if (cells.length >= 2) {
          const p0 = cells[0].getElementsByTagName('w:p')[0];
          const p1 = cells[1].getElementsByTagName('w:p')[0];
          if (p0) replaceParagraphTextPreservingFormatting(xmlDoc, p0, acronym);
          if (p1) replaceParagraphTextPreservingFormatting(xmlDoc, p1, meaning);
        }
        tbl.appendChild(newRow);
      }
    } else if (abbrevHdrIdx !== null && abbrevHdrIdx !== undefined && bodyChildren[abbrevHdrIdx]) {
      // Insert a formatted paragraph right under the "DANH MỤC TỪ VIẾT TẮT" heading
      const hdrNode = bodyChildren[abbrevHdrIdx];
      const newP = createFormattedCaptionParagraph(xmlDoc, bodyChildren, `${acronym}\t${meaning}`);
      if (hdrNode.nextSibling) {
        body.insertBefore(newP, hdrNode.nextSibling);
      } else {
        body.appendChild(newP);
      }
    } else {
      // No abbreviation section exists yet: expand the first occurrence in the body text e.g. "CNTT" -> "Công nghệ thông tin (CNTT)"
      const targetNode = bodyChildren[issue.xmlNodeIndex];
      if (targetNode && targetNode.tagName === 'w:p') {
        const currentTxt = getXmlNodeText(targetNode);
        const expanded = currentTxt.replace(
          new RegExp(`\\b${acronym}\\b`),
          `${meaning} (${acronym})`
        );
        if (expanded !== currentTxt) {
          replaceParagraphTextPreservingFormatting(xmlDoc, targetNode, expanded);
        }
      }
    }
  } else if (issue.fixAction === 'remove_unused_abbrev') {
    const acr = issue.abbrevData?.acronym || '';
    const abbrevTblIdx = tocZones?.abbrevTableNodeIndex;
    if (abbrevTblIdx !== null && abbrevTblIdx !== undefined && bodyChildren[abbrevTblIdx]?.tagName === 'w:tbl') {
      const tbl = bodyChildren[abbrevTblIdx];
      const rows = Array.from(tbl.getElementsByTagName('w:tr'));
      for (const tr of rows) {
        const rowTxt = getXmlNodeText(tr);
        if (new RegExp(`\\b${acr}\\b`).test(rowTxt) && rows.length > 1) {
          tr.parentNode?.removeChild(tr);
          break;
        }
      }
    }
  } else if (issue.fixAction === 'append_to_toc') {
    const targetNode = bodyChildren[issue.xmlNodeIndex];
    if (targetNode) {
      const newTocP = targetNode.tagName === 'w:p'
        ? (targetNode.cloneNode(true) as Element)
        : createFormattedCaptionParagraph(xmlDoc, bodyChildren, finalFixText);
      if (newTocP.tagName === 'w:p') {
        replaceParagraphTextPreservingFormatting(xmlDoc, newTocP, finalFixText);
      }
      if (targetNode.nextSibling) {
        body.insertBefore(newTocP, targetNode.nextSibling);
      } else {
        body.appendChild(newTocP);
      }
    }
  }

  const serializer = new XMLSerializer();
  const updatedXml = serializer.serializeToString(xmlDoc);
  zip.file('word/document.xml', updatedXml);
}

/**
 * Generates a downloadable .docx Blob from the in-memory PizZip instance
 */
export function exportFixedThesisDocxBlob(zip: PizZip): Blob {
  return zip.generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}
