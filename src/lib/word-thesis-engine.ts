import PizZip from 'pizzip';
import { callGeminiApi } from '@/lib/gemini';

// ============================================================================
// TYPES & INTERFACES FOR WORD THESIS / PROPOSAL AUDITOR
// ============================================================================

export type ThesisIssueCategory = 'figure' | 'table' | 'abbreviation' | 'structure';

export interface ThesisCatalogEntry {
  id: string;
  kind: 'figure' | 'table';
  prefix: string; // "Hình" | "Bảng"
  numberStr: string; // Current number in doc e.g. "20.1"
  expectedNumberStr: string; // Correct chapter-based number e.g. "1.1"
  chapterNum: number | null; // Chapter parsed from numberStr (e.g. 20)
  actualChapter: number; // True chapter in document where it sits (e.g. 1)
  seqNum: number | null;
  title: string;
  fullCaption: string;
  hasAdjacentMedia: boolean;
  xmlNodeIndex: number; // 0-based <w:p> index in word/document.xml
}

export interface ThesisAbbrevEntry {
  acronym: string;
  meaningInToc?: string;
  inferredMeaning: string;
  firstContextSnippet: string;
  occurrencesInBody: number;
  inFrontMatterList: boolean;
  xmlNodeIndex: number;
}

export interface CascadeUpdateItem {
  xmlNodeIndex: number;
  oldNumberStr: string;
  newNumberStr: string;
  newText: string;
}

export interface ThesisAuditIssue {
  id: string;
  category: ThesisIssueCategory;
  severity: 'error' | 'warning';
  title: string;
  description: string;
  locationLabel: string;
  currentText: string;
  suggestedFixText: string;
  xmlNodeIndex: number;
  fixAction:
    | 'replace_paragraph_text'
    | 'insert_caption_after_node'
    | 'append_abbreviation_row'
    | 'insert_three_catalogs';
  fixed?: boolean;
  cascadeUpdates?: CascadeUpdateItem[];
  acronym?: string;
  meaning?: string;
}

export interface ThesisTocZones {
  mainTocStartNodeIndex: number;
  mainTocEndNodeIndex: number;
  abbrevStartNodeIndex: number;
  abbrevEndNodeIndex: number;
  abbrevTableIndex: number;
  figuresTocStartNodeIndex: number;
  figuresTocEndNodeIndex: number;
  tablesTocStartNodeIndex: number;
  tablesTocEndNodeIndex: number;
  bodyStartNodeIndex: number;
}

export interface ThesisAuditReport {
  fileName: string;
  totalParagraphs: number;
  totalImagesInDoc: number;
  totalTablesInDoc: number;
  figuresCatalog: ThesisCatalogEntry[];
  tablesCatalog: ThesisCatalogEntry[];
  abbreviations: ThesisAbbrevEntry[];
  issues: ThesisAuditIssue[];
  tocZones: ThesisTocZones;
  detectedChapters: Array<{ number: number; title: string; xmlNodeIndex: number }>;
}

export type ThesisProgressCallback = (title: string, subtitle?: string, progress?: number) => void;

// ============================================================================
// BUILT-IN VIETNAMESE, MEDICAL, BIOCHEMICAL & ACADEMIC ABBREVIATION DICTIONARY
// ============================================================================

export const ACADEMIC_ABBREV_DICTIONARY: Record<string, string> = {
  // Y học - Hóa sinh lâm sàng - Sinh học phân tử (chuẩn đề án Y Sinh)
  CK: 'CK (Creatine Kinase): Enzym xúc tác chuyển hóa năng lượng ở cơ và tim.',
  'CK-MB':
    'CK-MB (Creatine Kinase-MB): Isoenzym đặc hiệu cơ tim dùng trong chẩn đoán nhồi máu cơ tim.',
  'α-amylase':
    'α-amylase: Enzym thủy phân tinh bột (được theo dõi đặc hiệu trong viêm tụy cấp).',
  'β-amylase':
    'β-amylase: Enzym thủy phân liên kết α-1,4-glycosid từ đầu không khử của chuỗi tinh bột.',
  HbA1c:
    'HbA1c: Glycated hemoglobin (chỉ số đánh giá và kiểm soát đường huyết trung bình trong 2 - 3 tháng của bệnh nhân đái tháo đường).',
  AST: 'AST (Aspartate Aminotransferase / GOT): Enzym chuyển nhóm amin đánh giá tổn thương tế bào gan và cơ tim.',
  ALT: 'ALT (Alanine Aminotransferase / GPT): Enzym chuyển nhóm amin đặc hiệu đánh giá tổn thương nhu mô gan.',
  GGT: 'GGT (Gamma-Glutamyl Transferase): Enzym màng tế bào gan mật, tăng cao trong tắc mật và tổn thương gan.',
  ALP: 'ALP (Alkaline Phosphatase): Enzym phosphatase kiềm đánh giá bệnh lý đường mật và xương.',
  LDH: 'LDH (Lactate Dehydrogenase): Enzym xúc tác chuyển hóa qua lại giữa pyruvate và lactate.',
  CRP: 'CRP (C-Reactive Protein): Protein phản ứng C chỉ điểm tình trạng viêm cấp tính.',
  HDL: 'HDL (High-Density Lipoprotein): Lipoprotein tỷ trọng cao (cholesterol bảo vệ thành mạch).',
  'HDL-C': 'HDL-C (High-Density Lipoprotein Cholesterol): Cholesterol lipoprotein tỷ trọng cao.',
  LDL: 'LDL (Low-Density Lipoprotein): Lipoprotein tỷ trọng thấp (cholesterol gây xơ vữa động mạch).',
  'LDL-C': 'LDL-C (Low-Density Lipoprotein Cholesterol): Cholesterol lipoprotein tỷ trọng thấp.',
  VLDL: 'VLDL (Very Low-Density Lipoprotein): Lipoprotein tỷ trọng rất thấp vận chuyển triglycerid nội sinh.',
  TG: 'TG (Triglyceride): Chất béo trung tính dự trữ năng lượng trong huyết tương và mô mỡ.',
  BUN: 'BUN (Blood Urea Nitrogen): Nồng độ nitơ urê trong máu đánh giá chức năng lọc cầu thận.',
  eGFR: 'eGFR (Estimated Glomerular Filtration Rate): Độ lọc cầu thận ước tính đánh giá chức năng thận.',
  WBC: 'WBC (White Blood Cell): Số lượng bạch cầu trong máu ngoại vi.',
  RBC: 'RBC (Red Blood Cell): Số lượng hồng cầu trong máu ngoại vi.',
  PLT: 'PLT (Platelet): Số lượng tiểu cầu tham gia quá trình cầm máu và đông máu.',
  HGB: 'HGB (Hemoglobin): Huyết sắc tố vận chuyển oxy trong hồng cầu.',
  HCT: 'HCT (Hematocrit): Tỷ lệ thể tích hồng cầu trên tổng thể tích máu toàn phần.',
  MCV: 'MCV (Mean Corpuscular Volume): Thể tích trung bình của một hồng cầu.',
  MCH: 'MCH (Mean Corpuscular Hemoglobin): Lượng huyết sắc tố trung bình trong một hồng cầu.',
  MCHC: 'MCHC (Mean Corpuscular Hemoglobin Concentration): Nồng độ huyết sắc tố trung bình trong hồng cầu.',
  ATP: 'ATP (Adenosine Triphosphate): Phân tử mang năng lượng chính trong tế bào sống.',
  ADP: 'ADP (Adenosine Diphosphate): Hợp chất nucleotide tham gia chu trình chuyển hóa năng lượng ATP.',
  AMP: 'AMP (Adenosine Monophosphate): Nucleotide cấu tạo nên axit nucleic và chuyển hóa năng lượng.',
  NAD: 'NAD (Nicotinamide Adenine Dinucleotide): Coenzym vận chuyển điện tử trong phản ứng oxy hóa - khử.',
  NADH: 'NADH (Nicotinamide Adenine Dinucleotide - dạng khử): Coenzym khử cung cấp điện tử cho chuỗi hô hấp tế bào.',
  NADPH: 'NADPH (Nicotinamide Adenine Dinucleotide Phosphate): Coenzym khử trong tổng hợp sinh học và chống oxy hóa.',
  FAD: 'FAD (Flavin Adenine Dinucleotide): Coenzym oxy hóa - khử trong chu trình Krebs.',
  DNA: 'DNA (Deoxyribonucleic Acid): Axit deoxyribonucleic lưu giữ thông tin di truyền.',
  ADN: 'ADN (Axit Deoxyribonucleic): Phân tử mang thông tin di truyền của sinh vật.',
  RNA: 'RNA (Ribonucleic Acid): Axit ribonucleic tham gia phiên mã và tổng hợp protein.',
  ARN: 'ARN (Axit Ribonucleic): Đại phân tử sinh học tham gia biểu hiện gen và tổng hợp protein.',
  mRNA: 'mRNA (Messenger RNA): ARN thông tin làm khuôn mẫu cho quá trình dịch mã tổng hợp protein.',
  tRNA: 'tRNA (Transfer RNA): ARN vận chuyển axit amin tới ribosom.',
  rRNA: 'rRNA (Ribosomal RNA): ARN cấu tạo nên tiểu phần ribosom.',
  PCR: 'PCR (Polymerase Chain Reaction): Phản ứng chuỗi trùng hợp khuếch đại đặc hiệu đoạn phân tử DNA.',
  'RT-PCR': 'RT-PCR (Reverse Transcription Polymerase Chain Reaction): Phản ứng chuỗi trùng hợp phiên mã ngược.',
  ELISA: 'ELISA (Enzyme-Linked Immunosorbent Assay): Xét nghiệm hấp thụ miễn dịch liên kết với enzym.',
  BMI: 'BMI (Body Mass Index): Chỉ số khối cơ thể đánh giá tình trạng dinh dưỡng.',
  ECG: 'ECG (Electrocardiogram): Điện tâm đồ ghi lại hoạt động điện học của tim.',
  EEG: 'EEG (Electroencephalogram): Điện não đồ.',
  MRI: 'MRI (Magnetic Resonance Imaging): Chụp cộng hưởng từ hạt nhân.',
  CT: 'CT (Computed Tomography): Chụp cắt lớp vi tính.',
  ICU: 'ICU (Intensive Care Unit): Khoa Hồi sức tích cực và Chống độc.',
  COPD: 'COPD (Chronic Obstructive Pulmonary Disease): Bệnh phổi tắc nghẽn mạn tính.',
  THA: 'THA: Tăng huyết áp.',
  ĐTĐ: 'ĐTĐ: Đái tháo đường (tiểu đường).',
  BHYT: 'BHYT: Bảo hiểm y tế.',
  BYT: 'BYT: Bộ Y tế.',
  WHO: 'WHO (World Health Organization): Tổ chức Y tế Thế giới.',
  FDA: 'FDA (Food and Drug Administration): Cục Quản lý Thực phẩm và Dược phẩm Hoa Kỳ.',
  IgG: 'IgG (Immunoglobulin G): Kháng thể miễn dịch lớp G phổ biến nhất trong huyết thanh.',
  IgM: 'IgM (Immunoglobulin M): Kháng thể miễn dịch lớp M xuất hiện sớm trong đáp ứng miễn dịch cấp.',
  IgA: 'IgA (Immunoglobulin A): Kháng thể miễn dịch tiết bảo vệ bề mặt niêm mạc.',
  IgE: 'IgE (Immunoglobulin E): Kháng thể miễn dịch lớp E liên quan đến phản ứng dị ứng và ký sinh trùng.',
  IC50: 'IC50 (Half Maximal Inhibitory Concentration): Nồng độ ức chế 50% hoạt tính sinh học hoặc enzym.',
  EC50: 'EC50 (Half Maximal Effective Concentration): Nồng độ có hiệu lực đạt 50% đáp ứng tối đa.',
  Vmax: 'Vmax (Maximum Velocity): Vận tốc phản ứng cực đại khi enzym bão hòa cơ chất.',
  Km: 'Km (Michaelis Constant): Hằng số Michaelis biểu thị ái lực của enzym đối với cơ chất.',
  SpO2: 'SpO2 (Peripheral Capillary Oxygen Saturation): Độ bão hòa oxy trong máu ngoại vi.',

  // Giáo dục - Hành chính - Kinh tế - CNTT
  BGDĐT: 'BGDĐT: Bộ Giáo dục và Đào tạo.',
  'GD&ĐT': 'GD&ĐT: Giáo dục và Đào tạo.',
  GDĐT: 'GDĐT: Giáo dục và Đào tạo.',
  ĐBCL: 'ĐBCL: Đảm bảo chất lượng.',
  ĐHQG: 'ĐHQG: Đại học Quốc gia.',
  CSGD: 'CSGD: Cơ sở giáo dục.',
  CTĐT: 'CTĐT: Chương trình đào tạo.',
  NCKH: 'NCKH: Nghiên cứu khoa học.',
  KHCN: 'KHCN: Khoa học và Công nghệ.',
  GV: 'GV: Giảng viên / Giáo viên.',
  SV: 'SV: Sinh viên.',
  HS: 'HS: Học sinh.',
  HV: 'HV: Học viên.',
  CBQL: 'CBQL: Cán bộ quản lý.',
  CNTT: 'CNTT (Information Technology): Công nghệ thông tin.',
  TTNT: 'TTNT: Trí tuệ nhân tạo.',
  AI: 'AI (Artificial Intelligence): Trí tuệ nhân tạo.',
  ML: 'ML (Machine Learning): Học máy.',
  DL: 'DL (Deep Learning): Học sâu.',
  NLP: 'NLP (Natural Language Processing): Xử lý ngôn ngữ tự nhiên.',
  LLM: 'LLM (Large Language Model): Mô hình ngôn ngữ lớn.',
  OCR: 'OCR (Optical Character Recognition): Nhận dạng ký tự quang học.',
  IoT: 'IoT (Internet of Things): Internet vạn vật.',
  CSDL: 'CSDL (Database): Cơ sở dữ liệu.',
  HTTT: 'HTTT: Hệ thống thông tin.',
  TMĐT: 'TMĐT: Thương mại điện tử.',
  DN: 'DN: Doanh nghiệp.',
  DNNVV: 'DNNVV: Doanh nghiệp nhỏ và vừa.',
  SME: 'SME (Small and Medium Enterprise): Doanh nghiệp nhỏ và vừa.',
  FDI: 'FDI (Foreign Direct Investment): Đầu tư trực tiếp nước ngoài.',
  GDP: 'GDP (Gross Domestic Product): Tổng sản phẩm quốc nội.',
  CPI: 'CPI (Consumer Price Index): Chỉ số giá tiêu dùng.',
  WTO: 'WTO (World Trade Organization): Tổ chức Thương mại Thế giới.',
  ASEAN: 'ASEAN (Association of Southeast Asian Nations): Hiệp hội các quốc gia Đông Nam Á.',
  UNESCO: 'UNESCO: Tổ chức Giáo dục, Khoa học và Văn hóa Liên Hợp Quốc.',
  UNICEF: 'UNICEF: Quỹ Nhi đồng Liên Hợp Quốc.',
  UBND: 'UBND: Ủy ban nhân dân.',
  HĐND: 'HĐND: Hội đồng nhân dân.',
  TW: 'TW: Trung ương.',
  XHCN: 'XHCN: Xã hội chủ nghĩa.',
  KTXH: 'KTXH: Kinh tế - Xã hội.',
  NXB: 'NXB: Nhà xuất bản.',
  TNHH: 'TNHH: Trách nhiệm hữu hạn.',
  TPHCM: 'TPHCM: Thành phố Hồ Chí Minh.',
  THPT: 'THPT: Trung học phổ thông.',
  THCS: 'THCS: Trung học cơ sở.',
  API: 'API (Application Programming Interface): Giao diện lập trình ứng dụng.',
  UI: 'UI (User Interface): Giao diện người dùng.',
  UX: 'UX (User Experience): Trải nghiệm người dùng.',
  SQL: 'SQL (Structured Query Language): Ngôn ngữ truy vấn có cấu trúc.',
  JSON: 'JSON (JavaScript Object Notation): Định dạng trao đổi dữ liệu văn bản nhẹ.',
  XML: 'XML (eXtensible Markup Language): Ngôn ngữ đánh dấu mở rộng.',
  PDF: 'PDF (Portable Document Format): Định dạng tài liệu di động.',
  KPI: 'KPI (Key Performance Indicator): Chỉ số đánh giá hiệu quả công việc.',
  ROI: 'ROI (Return on Investment): Tỷ suất hoàn vốn đầu tư.',
  ERP: 'ERP (Enterprise Resource Planning): Hệ thống hoạch định nguồn lực doanh nghiệp.',
  CRM: 'CRM (Customer Relationship Management): Quản trị quan hệ khách hàng.',
};

const STOPWORD_ACRONYMS = new Set([
  'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX',
  'CHƯƠNG', 'PHẦN', 'MỤC', 'LỤC', 'BẢNG', 'HÌNH', 'ẢNH', 'BIỂU', 'ĐỒ', 'SƠ',
  'DANH', 'TỪ', 'VIẾT', 'TẮT', 'MỞ', 'ĐẦU', 'KẾT', 'LUẬN', 'KIẾN', 'NGHỊ',
  'TÀI', 'LIỆU', 'THAM', 'KHẢO', 'PHỤ', 'LỜI', 'CẢM', 'ƠN', 'CAM', 'ĐOAN',
  'TÓM', 'ĐẶT', 'VẤN', 'ĐỀ', 'TỔNG', 'QUAN', 'ĐỐI', 'TƯỢNG', 'PHƯƠNG', 'PHÁP',
  'NGHIÊN', 'CỨU', 'KẾT', 'QUẢ', 'BÀN', 'TRƯỜNG', 'ĐẠI', 'HỌC', 'KHOA', 'BỘ',
  'MÔN', 'VIỆN', 'BÁO', 'CÁO', 'LUẬN', 'VĂN', 'ÁP', 'DỤNG', 'TRONG', 'CỦA',
  'VÀ', 'CHO', 'VỚI', 'TẠI', 'THEO', 'NHỮNG', 'CÁC', 'MỘT', 'SỐ', 'NĂM',
  'THÁNG', 'NGÀY', 'VIỆT', 'NAM', 'HÀ', 'NỘI', 'HỒ', 'CHÍ', 'MINH', 'ĐÀ',
  'NẴNG', 'CẦN', 'THƠ', 'STT', 'TRANG', 'GHI', 'CHÚ', 'NGUỒN', 'CỘNG', 'HÒA',
  'XÃ', 'HỘI', 'CHỦ', 'NGHĨA', 'ĐỘC', 'LẬP', 'TỰ', 'DO', 'HẠNH', 'PHÚC',
  'SINH', 'VIÊN', 'GIẢNG', 'HƯỚNG', 'DẪN', 'THỰC', 'HIỆN', 'NHẬN', 'XÉT',
  'ĐÁNH', 'GIÁ', 'PHÂN', 'TÍCH', 'THIẾT', 'KẾ', 'XÂY', 'DỰNG', 'TRIỂN', 'KHAI',
  'THỬ', 'NGHIỆM', 'ĐỀ', 'ÁN', 'GIÁO', 'TRÌNH', 'MẪU',
]);

const MEASUREMENT_UNITS = new Set([
  'MM', 'CM', 'DM', 'KM', 'MG', 'KG', 'ML', 'KB', 'MB', 'GB', 'TB',
  'HZ', 'KHZ', 'MHZ', 'GHZ', 'USD', 'VND', 'VNĐ', 'AM', 'PM', 'OK',
  'UL', 'DL', 'MOL', 'MMOL', 'UMOL', 'NMOL', 'PMOL', 'UI', 'IU',
]);

// Special biomedical/scientific mixed-case & Greek-prefixed terms
const SPECIAL_SCIENTIFIC_TERMS_REGEX =
  /\b(HbA1[cC]|mRNA|tRNA|rRNA|cDNA|dsDNA|ssRNA|siRNA|miRNA|eGFR|SpO2|PaO2|PaCO2|VO2max|FEV1|Vmax|Km|IC50|EC50|LD50|IgG|IgM|IgA|IgE|IgD|CoA|NADH|NADPH|FADH2|[αβγ]-?[a-zA-Z]{3,15})\b/g;

// ============================================================================
// XML & TEXT PARSING HELPERS
// ============================================================================

export function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

export function encodeXmlEntities(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function extractParagraphPlainText(pXml: string): string {
  const withBreaks = pXml
    .replace(/<w:tab\b[^>]*\/>/g, '\t')
    .replace(/<w:(?:br|cr)\b[^>]*\/>/g, '\n');

  const textParts: string[] = [];
  const tRegex = /<w:t(?:\s+[^>]*)?>([\s\S]*?)<\/w:t>/g;
  let match: RegExpExecArray | null;
  while ((match = tRegex.exec(withBreaks)) !== null) {
    textParts.push(decodeXmlEntities(match[1]));
  }
  return textParts.join('').replace(/\u00A0/g, ' ').trim();
}

function romanToInt(roman: string): number | null {
  const s = roman.toUpperCase().trim();
  const map: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100 };
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const curr = map[s[i]];
    const next = map[s[i + 1]];
    if (!curr) return null;
    if (next && curr < next) {
      total -= curr;
    } else {
      total += curr;
    }
  }
  return total > 0 ? total : null;
}

const TABLE_CAPTION_REGEX =
  /^(Bảng|BẢNG|Table|TABLE)\s+([0-9]+(?:\s*[.\-_]\s*[0-9]+)*)\s*([:.–\-])?\s*(.*)$/i;

const FIGURE_CAPTION_REGEX =
  /^(Hình|HÌNH|Ảnh|ẢNH|Hình\s+ảnh|Sơ\s+đồ|Biểu\s+đồ|Đồ\s+thị|Figure|FIGURE|Fig\.)\s+([0-9]+(?:\s*[.\-_]\s*[0-9]+)*)\s*([:.–\-])?\s*(.*)$/i;

const CHAPTER_HEADING_REGEX =
  /^(?:(?:MỤC|PHẦN|CHƯƠNG|Chương|Phần)\s+([0-9]+|[IVXLC]+))\b/i;

const TOC_HEADING_REGEX = /^(MỤC\s+LỤC|TABLE\s+OF\s+CONTENTS)$/i;
const ABBREV_SECTION_HEADING_REGEX =
  /^(DANH\s+MỤC\s+(?:CÁC\s+)?(?:TỪ\s+VIẾT\s+TẮT|CHỮ\s+VIẾT\s+TẮT|KÝ\s+HIỆU(?:\s+VÀ\s+CHỮ\s+VIẾT\s+TẮT)?)|BẢNG\s+CHỮ\s+VIẾT\s+TẮT|LIST\s+OF\s+ABBREVIATIONS)$/i;
const TABLE_CATALOG_HEADING_REGEX =
  /^(DANH\s+MỤC\s+(?:CÁC\s+)?BẢNG(?:\s+BIỂU)?|LIST\s+OF\s+TABLES)$/i;
const FIGURE_CATALOG_HEADING_REGEX =
  /^(DANH\s+MỤC\s+(?:CÁC\s+)?(?:HÌNH(?:\s+ẢNH|\s+VẼ)?|ẢNH|SƠ\s+ĐỒ|BIỂU\s+ĐỒ)|LIST\s+OF\s+FIGURES)$/i;
const BODY_START_HEADING_REGEX =
  /^(MỞ\s+ĐẦU|LỜI\s+MỞ\s+ĐẦU|ĐẶT\s+VẤN\s+ĐỀ|GIỚI\s+THIỆU|PHẦN\s+MỞ\s+ĐẦU|CHƯƠNG\s+(?:1|I)\b|PHẦN\s+(?:1|I)\b)/i;

function normalizeCaptionNumber(numRaw: string): string {
  return numRaw.replace(/\s+/g, '').replace(/[-_]/g, '.');
}

function parseNumberParts(numStr: string): { chapterNum: number | null; seqNum: number | null } {
  const norm = normalizeCaptionNumber(numStr);
  const parts = norm.split('.');
  if (parts.length >= 2) {
    const c = parseInt(parts[0], 10);
    const s = parseInt(parts[1], 10);
    return {
      chapterNum: isNaN(c) ? null : c,
      seqNum: isNaN(s) ? null : s,
    };
  }
  const single = parseInt(parts[0], 10);
  return {
    chapterNum: null,
    seqNum: isNaN(single) ? null : single,
  };
}

function isMostlyAllCapsLine(text: string): boolean {
  const letters = text.replace(/[^a-zA-ZÀ-ỹ]/g, '');
  if (letters.length < 4) return false;
  const upper = letters.replace(
    /[^A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]/g,
    ''
  );
  return upper.length / letters.length >= 0.8;
}

/**
 * Formats an abbreviation entry into the exact numbered format requested by the user:
 *   1. CK (Creatine Kinase): Enzym xúc tác chuyển hóa năng lượng ở cơ và tim.
 *   2. α-amylase: Enzym thủy phân tinh bột (được theo dõi đặc hiệu trong viêm tụy cấp).
 *   3. HbA1c: Glycated hemoglobin (chỉ số đánh giá và kiểm soát đường huyết trung bình trong 2 - 3 tháng của bệnh nhân đái tháo đường).
 */
export function formatNumberedAbbreviationLine(index1Based: number, ab: ThesisAbbrevEntry): string {
  const raw = (ab.meaningInToc || ab.inferredMeaning || '').trim();
  if (!raw) {
    return `${index1Based}. ${ab.acronym}: Thuật ngữ chuyên ngành sử dụng trong tài liệu.`;
  }
  // If raw already starts with the acronym (e.g. "CK (Creatine Kinase): Enzym...")
  const escapedAcr = ab.acronym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const startsWithAcrRegex = new RegExp(`^${escapedAcr}\\b`, 'i');
  if (startsWithAcrRegex.test(raw)) {
    return `${index1Based}. ${raw}`;
  }
  if (raw.startsWith('(')) {
    return `${index1Based}. ${ab.acronym} ${raw}`;
  }
  const clean = raw.replace(/^[:–\-]\s*/, '').trim();
  return `${index1Based}. ${ab.acronym}: ${clean}`;
}

// ============================================================================
// MAIN THESIS AUDITOR FUNCTION (analyzeWordThesisDocx)
// ============================================================================

export async function analyzeWordThesisDocx(
  file: File,
  onProgress?: ThesisProgressCallback
): Promise<{ zip: PizZip; report: ThesisAuditReport }> {
  onProgress?.('Đang giải nén cấu trúc XML của file Word (.docx)...', file.name, 12);
  await new Promise(r => setTimeout(r, 20));

  const arrayBuffer = await file.arrayBuffer();
  const zip = new PizZip(arrayBuffer);
  const docXmlFile = zip.file('word/document.xml');

  if (!docXmlFile) {
    throw new Error('File không đúng chuẩn Word (.docx) hoặc bị hỏng cấu trúc XML.');
  }

  const docXml = docXmlFile.asText();
  const totalTablesInDoc = (docXml.match(/<w:tbl\b/g) || []).length;
  const totalImagesInDoc = (docXml.match(/<w:(?:drawing|pict)\b|<v:imagedata\b/g) || []).length;

  onProgress?.('Đang quét tọa độ đoạn văn, bảng biểu & hình ảnh nhúng...', 'Đọc 100% word/document.xml', 32);
  await new Promise(r => setTimeout(r, 20));

  // Locate all <w:tbl> byte ranges
  const tableRanges: Array<{ start: number; end: number; tableIndex: number }> = [];
  const tblRegex = /<w:tbl\b[\s\S]*?<\/w:tbl>/g;
  let tblMatch: RegExpExecArray | null;
  let tIdx = 0;
  while ((tblMatch = tblRegex.exec(docXml)) !== null) {
    tableRanges.push({
      start: tblMatch.index,
      end: tblMatch.index + tblMatch[0].length,
      tableIndex: tIdx++,
    });
  }

  const getTableIndexAtOffset = (offset: number): number => {
    for (const r of tableRanges) {
      if (offset >= r.start && offset <= r.end) return r.tableIndex;
    }
    return -1;
  };

  interface ParsedNode {
    index: number;
    text: string;
    inTableIndex: number;
    hasDrawing: boolean;
    isHeading: boolean;
  }

  const nodes: ParsedNode[] = [];
  const pRegex = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
  let pMatch: RegExpExecArray | null;
  let pIdx = 0;

  while ((pMatch = pRegex.exec(docXml)) !== null) {
    const pXml = pMatch[0];
    const offset = pMatch.index;
    const text = extractParagraphPlainText(pXml);
    const inTableIndex = getTableIndexAtOffset(offset);
    const hasDrawing = /<w:(?:drawing|pict)\b|<v:imagedata\b/.test(pXml);
    const styleMatch = pXml.match(/<w:pStyle\s+w:val="([^"]+)"/);
    const styleVal = styleMatch ? styleMatch[1] : '';
    const isHeading =
      /Heading|tle|Chuong|Muc/i.test(styleVal) || CHAPTER_HEADING_REGEX.test(text);

    nodes.push({
      index: pIdx,
      text,
      inTableIndex,
      hasDrawing,
      isHeading,
    });
    pIdx++;
  }

  onProgress?.('Đang phân tích Mục lục, ranh giới Chương 1..N và 3 Danh mục...', `${nodes.length} đoạn văn`, 54);
  await new Promise(r => setTimeout(r, 20));

  // Identify front-matter zones & where main content (Chương 1 / Mở đầu) starts
  const tocZones: ThesisTocZones = {
    mainTocStartNodeIndex: -1,
    mainTocEndNodeIndex: -1,
    abbrevStartNodeIndex: -1,
    abbrevEndNodeIndex: -1,
    abbrevTableIndex: -1,
    figuresTocStartNodeIndex: -1,
    figuresTocEndNodeIndex: -1,
    tablesTocStartNodeIndex: -1,
    tablesTocEndNodeIndex: -1,
    bodyStartNodeIndex: 0,
  };

  const detectedChapters: Array<{ number: number; title: string; xmlNodeIndex: number }> = [];
  let activeFront: 'none' | 'toc' | 'abbrev' | 'fig_toc' | 'tbl_toc' = 'none';
  let bodyStarted = false;

  for (let i = 0; i < nodes.length; i++) {
    const raw = nodes[i].text.trim();
    if (!raw) continue;
    const clean = raw.replace(/^[0-9IVXLC]+\.\s*/, '').trim();
    const isDotLeaderTocLine = /(?:\s*\.\s*){4,}\s*\d+\s*$/.test(raw) || /\t\d+$/.test(raw);

    if (!bodyStarted && TOC_HEADING_REGEX.test(clean)) {
      tocZones.mainTocStartNodeIndex = i;
      tocZones.mainTocEndNodeIndex = i;
      activeFront = 'toc';
      continue;
    }

    if (!bodyStarted && ABBREV_SECTION_HEADING_REGEX.test(clean)) {
      tocZones.abbrevStartNodeIndex = i;
      tocZones.abbrevEndNodeIndex = i;
      activeFront = 'abbrev';
      continue;
    }

    if (!bodyStarted && FIGURE_CATALOG_HEADING_REGEX.test(clean)) {
      tocZones.figuresTocStartNodeIndex = i;
      tocZones.figuresTocEndNodeIndex = i;
      activeFront = 'fig_toc';
      continue;
    }

    if (!bodyStarted && TABLE_CATALOG_HEADING_REGEX.test(clean)) {
      tocZones.tablesTocStartNodeIndex = i;
      tocZones.tablesTocEndNodeIndex = i;
      activeFront = 'tbl_toc';
      continue;
    }

    // Extend active front-matter zone while still before main body
    if (!bodyStarted) {
      if (activeFront === 'toc' && (isDotLeaderTocLine || i - tocZones.mainTocStartNodeIndex <= 45)) {
        if (isDotLeaderTocLine) {
          tocZones.mainTocEndNodeIndex = i;
          continue;
        }
      }
    }

    // Check if main content / Chapter 1 has started
    if (!bodyStarted && !isDotLeaderTocLine && BODY_START_HEADING_REGEX.test(clean) && raw.length < 140) {
      bodyStarted = true;
      tocZones.bodyStartNodeIndex = i;
      activeFront = 'none';
    }

    const chapMatch = raw.match(CHAPTER_HEADING_REGEX);
    if (chapMatch && !isDotLeaderTocLine && raw.length < 160) {
      const token = chapMatch[1];
      const chapNum = /^\d+$/.test(token) ? parseInt(token, 10) : romanToInt(token);
      if (chapNum !== null) {
        if (!bodyStarted) {
          bodyStarted = true;
          tocZones.bodyStartNodeIndex = i;
          activeFront = 'none';
        }
        detectedChapters.push({
          number: chapNum,
          title: raw,
          xmlNodeIndex: i,
        });
      }
    }

    if (!bodyStarted) {
      if (activeFront === 'abbrev') {
        tocZones.abbrevEndNodeIndex = i;
        if (nodes[i].inTableIndex >= 0 && tocZones.abbrevTableIndex < 0) {
          tocZones.abbrevTableIndex = nodes[i].inTableIndex;
        }
      } else if (activeFront === 'fig_toc') {
        tocZones.figuresTocEndNodeIndex = i;
      } else if (activeFront === 'tbl_toc') {
        tocZones.tablesTocEndNodeIndex = i;
      }
    }
  }

  onProgress?.('Đang đối chiếu thứ tự Hình 1.1, 1.2 & Bảng 1.1, 1.2 theo từng Chương...', 'Phát hiện sai số chương & nhảy số', 74);
  await new Promise(r => setTimeout(r, 20));

  // ==========================================================================
  // SCAN BODY FOR FIGURES, UNLABELLED IMAGES, AND TABLES BY ACTUAL CHAPTER
  // ==========================================================================
  const figuresCatalog: ThesisCatalogEntry[] = [];
  const tablesCatalog: ThesisCatalogEntry[] = [];

  const isInsideFrontCatalog = (idx: number): boolean => {
    if (
      tocZones.abbrevStartNodeIndex >= 0 &&
      idx >= tocZones.abbrevStartNodeIndex &&
      idx <= tocZones.abbrevEndNodeIndex
    ) {
      return true;
    }
    if (
      tocZones.figuresTocStartNodeIndex >= 0 &&
      idx >= tocZones.figuresTocStartNodeIndex &&
      idx <= tocZones.figuresTocEndNodeIndex
    ) {
      return true;
    }
    if (
      tocZones.tablesTocStartNodeIndex >= 0 &&
      idx >= tocZones.tablesTocStartNodeIndex &&
      idx <= tocZones.tablesTocEndNodeIndex
    ) {
      return true;
    }
    if (
      tocZones.mainTocStartNodeIndex >= 0 &&
      idx >= tocZones.mainTocStartNodeIndex &&
      idx <= tocZones.mainTocEndNodeIndex
    ) {
      return true;
    }
    return false;
  };

  const scanStart = tocZones.bodyStartNodeIndex > 0 ? tocZones.bodyStartNodeIndex : 0;

  // CRITICAL: `currentChapter` is ONLY updated by actual Chapter headings ("CHƯƠNG 1", "CHƯƠNG 2"...),
  // NEVER by a figure/table's own wrong caption number (such as "Hình 20.1" inside Chương 1)!
  let currentChapter = 1;
  const drawingNodesSatisfiedByCaption = new Set<number>();

  interface RawBodyEvent {
    type: 'figure_caption' | 'unlabelled_drawing' | 'table_caption';
    xmlNodeIndex: number;
    actualChapter: number;
    entry?: ThesisCatalogEntry;
  }

  const bodyEvents: RawBodyEvent[] = [];

  // Pass 1: Find all figure & table captions and record which drawing nodes they label
  for (let i = scanStart; i < nodes.length; i++) {
    if (isInsideFrontCatalog(i)) continue;
    const node = nodes[i];
    const text = node.text.trim();
    if (!text) continue;

    // Ignore dot-leader TOC lines
    if (/(?:\s*\.\s*){4,}\s*\d+\s*$/.test(text)) continue;

    // Update currentChapter ONLY on genuine Chapter headings
    const chapMatch = text.match(CHAPTER_HEADING_REGEX);
    if (chapMatch && text.length < 160) {
      const token = chapMatch[1];
      const chapNum = /^\d+$/.test(token) ? parseInt(token, 10) : romanToInt(token);
      if (chapNum !== null && chapNum >= 1 && chapNum <= 30) {
        currentChapter = chapNum;
      }
    } else if (
      node.isHeading &&
      detectedChapters.length === 0 &&
      /^(\d+)\.\s+[A-ZÀ-Ỹ]/.test(text) &&
      !/^(\d+\.\d+)/.test(text)
    ) {
      const m = text.match(/^(\d+)\.\s+/);
      if (m) {
        const cNum = parseInt(m[1], 10);
        if (cNum >= 1 && cNum <= 15) currentChapter = cNum;
      }
    }

    // Check Table caption
    if (node.inTableIndex < 0 && text.length < 300) {
      const tblMatch = text.match(TABLE_CAPTION_REGEX);
      if (tblMatch) {
        const rawNum = tblMatch[2];
        const sep = tblMatch[3] || '';
        const titleRest = (tblMatch[4] || '').trim();
        const isContinuation =
          !sep &&
          titleRest.length > 0 &&
          /^(cho\s+thấy|trình\s+bày|thể\s+hiện|minh\s+họa|dưới\s+đây|trên\s+đây|này|là|được|có|và|của)\b/i.test(
            titleRest
          );

        if (!isContinuation) {
          const numberStr = normalizeCaptionNumber(rawNum);
          const { chapterNum, seqNum } = parseNumberParts(numberStr);
          let hasAdjTable = false;
          for (let k = Math.max(0, i - 3); k <= Math.min(nodes.length - 1, i + 6); k++) {
            if (nodes[k].inTableIndex >= 0) {
              hasAdjTable = true;
              break;
            }
          }
          const entry: ThesisCatalogEntry = {
            id: `tbl-${i}`,
            kind: 'table',
            prefix: 'Bảng',
            numberStr,
            expectedNumberStr: numberStr,
            chapterNum,
            actualChapter: currentChapter,
            seqNum,
            title: titleRest,
            fullCaption: text,
            hasAdjacentMedia: hasAdjTable,
            xmlNodeIndex: i,
          };
          tablesCatalog.push(entry);
          bodyEvents.push({
            type: 'table_caption',
            xmlNodeIndex: i,
            actualChapter: currentChapter,
            entry,
          });
          continue;
        }
      }
    }

    // Check Figure caption
    if (text.length < 300) {
      const figMatch = text.match(FIGURE_CAPTION_REGEX);
      if (figMatch) {
        const rawPrefix = figMatch[1].trim();
        const rawNum = figMatch[2];
        const sep = figMatch[3] || '';
        const titleRest = (figMatch[4] || '').trim();
        const isContinuation =
          !sep &&
          titleRest.length > 0 &&
          /^(cho\s+thấy|trình\s+bày|thể\s+hiện|minh\s+họa|dưới\s+đây|trên\s+đây|này|là|được|có|và|của)\b/i.test(
            titleRest
          );

        if (!isContinuation) {
          const numberStr = normalizeCaptionNumber(rawNum);
          const { chapterNum, seqNum } = parseNumberParts(numberStr);
          let hasAdjDrawing = false;
          for (let k = Math.max(0, i - 2); k <= Math.min(nodes.length - 1, i + 2); k++) {
            if (nodes[k].hasDrawing) {
              hasAdjDrawing = true;
              drawingNodesSatisfiedByCaption.add(k);
              break;
            }
          }
          const normalizedPrefix = /^Ảnh$/i.test(rawPrefix) ? 'Hình' : 'Hình';
          const entry: ThesisCatalogEntry = {
            id: `fig-${i}`,
            kind: 'figure',
            prefix: normalizedPrefix,
            numberStr,
            expectedNumberStr: numberStr,
            chapterNum,
            actualChapter: currentChapter,
            seqNum,
            title: titleRest,
            fullCaption: text,
            hasAdjacentMedia: hasAdjDrawing,
            xmlNodeIndex: i,
          };
          figuresCatalog.push(entry);
          bodyEvents.push({
            type: 'figure_caption',
            xmlNodeIndex: i,
            actualChapter: currentChapter,
            entry,
          });
          continue;
        }
      }
    }
  }

  // Pass 2: Check for standalone embedded drawings (<w:drawing>) in body that have NO caption nearby
  currentChapter = 1;
  for (let i = scanStart; i < nodes.length; i++) {
    if (isInsideFrontCatalog(i)) continue;
    const node = nodes[i];
    const text = node.text.trim();
    const chapMatch = text.match(CHAPTER_HEADING_REGEX);
    if (chapMatch && text.length < 160) {
      const token = chapMatch[1];
      const chapNum = /^\d+$/.test(token) ? parseInt(token, 10) : romanToInt(token);
      if (chapNum !== null && chapNum >= 1 && chapNum <= 30) {
        currentChapter = chapNum;
      }
    }

    if (
      node.hasDrawing &&
      node.inTableIndex < 0 &&
      !drawingNodesSatisfiedByCaption.has(i) &&
      figuresCatalog.length > 0
    ) {
      bodyEvents.push({
        type: 'unlabelled_drawing',
        xmlNodeIndex: i,
        actualChapter: currentChapter,
      });
    }
  }

  bodyEvents.sort((a, b) => a.xmlNodeIndex - b.xmlNodeIndex);

  // ==========================================================================
  // AUDIT CHAPTER-BASED SEQUENTIAL NUMBERING FOR FIGURES & TABLES
  // ==========================================================================
  const issues: ThesisAuditIssue[] = [];

  // 1. Audit Figures by `actualChapter` (Chương 1 -> Hình 1.1., Hình 1.2....)
  const figEventsByChap = new Map<number, RawBodyEvent[]>();
  for (const ev of bodyEvents) {
    if (ev.type === 'figure_caption' || ev.type === 'unlabelled_drawing') {
      const arr = figEventsByChap.get(ev.actualChapter) || [];
      arr.push(ev);
      figEventsByChap.set(ev.actualChapter, arr);
    }
  }

  for (const [chapNum, evList] of figEventsByChap.entries()) {
    let seq = 0;
    const seenNumsInChap = new Map<string, number>();

    for (let idx = 0; idx < evList.length; idx++) {
      const ev = evList[idx];
      seq++;
      const expectedNum = `${chapNum}.${seq}`;

      if (ev.type === 'unlabelled_drawing') {
        // Compute cascade updates for subsequent captioned figures in the same chapter
        const cascadeUpdates: CascadeUpdateItem[] = [];
        let futureSeq = seq;
        for (let fIdx = idx + 1; fIdx < evList.length; fIdx++) {
          futureSeq++;
          const futEv = evList[fIdx];
          if (futEv.type === 'figure_caption' && futEv.entry) {
            const futExpected = `${chapNum}.${futureSeq}`;
            if (futEv.entry.numberStr !== futExpected) {
              const futTitle = futEv.entry.title || `Hình minh họa ${futExpected}`;
              cascadeUpdates.push({
                xmlNodeIndex: futEv.xmlNodeIndex,
                oldNumberStr: `Hình ${futEv.entry.numberStr}`,
                newNumberStr: `Hình ${futExpected}`,
                newText: `Hình ${futExpected}. ${futTitle}`,
              });
            }
          }
        }

        issues.push({
          id: `issue-fig-unlabelled-${ev.xmlNodeIndex}`,
          category: 'figure',
          severity: 'error',
          title: `Phát hiện hình ảnh tại Chương ${chapNum} chưa gắn nhãn (Lẽ ra là Hình ${expectedNum})`,
          description: `Hình ảnh nhúng tại đoạn #${ev.xmlNodeIndex + 1} (Chương ${chapNum}) chưa có dòng chú thích tên hình bên dưới, làm lệch số thứ tự các hình phía sau trong Chương ${chapNum}.`,
          locationLabel: `Chương ${chapNum} • Đoạn #${ev.xmlNodeIndex + 1}`,
          currentText: '(Hình ảnh chưa có dòng chú thích Hình X.Y)',
          suggestedFixText: `Hình ${expectedNum}. Hình minh họa thực tế tại Chương ${chapNum}`,
          xmlNodeIndex: ev.xmlNodeIndex,
          fixAction: 'insert_caption_after_node',
          cascadeUpdates,
        });
        continue;
      }

      const entry = ev.entry!;
      entry.expectedNumberStr = expectedNum;
      const prevCount = seenNumsInChap.get(entry.numberStr) || 0;
      seenNumsInChap.set(entry.numberStr, prevCount + 1);

      const cleanTitle = entry.title || `Mô hình minh họa ${expectedNum}`;
      const standardText = `Hình ${expectedNum}. ${cleanTitle}`;

      if (entry.chapterNum !== null && entry.chapterNum !== chapNum) {
        // User's exact bug report: Inside Chương 1, figure is written as "Hình 20.1" instead of "Hình 1.1"!
        issues.push({
          id: `issue-fig-wrongchap-${entry.xmlNodeIndex}`,
          category: 'figure',
          severity: 'error',
          title: `Sai số chương: Đang ở Chương ${chapNum} nhưng ghi "${entry.prefix} ${entry.numberStr}" → Sửa thành "Hình ${expectedNum}"`,
          description: `Hình này thuộc Chương ${chapNum} (vị trí hình thứ ${seq} của Chương ${chapNum}) nhưng đang đánh số là "${entry.prefix} ${entry.numberStr}". Hệ thống tự động chuẩn hóa về đúng Chương ${chapNum}: "Hình ${expectedNum}."`,
          locationLabel: `Chương ${chapNum} • Đoạn #${entry.xmlNodeIndex + 1}`,
          currentText: entry.fullCaption,
          suggestedFixText: standardText,
          xmlNodeIndex: entry.xmlNodeIndex,
          fixAction: 'replace_paragraph_text',
        });
      } else if (prevCount > 0) {
        issues.push({
          id: `issue-fig-dup-${entry.xmlNodeIndex}`,
          category: 'figure',
          severity: 'error',
          title: `Trùng số thứ tự Hình ${entry.numberStr} trong Chương ${chapNum} → Sửa thành Hình ${expectedNum}`,
          description: `Số hiệu "${entry.numberStr}" đã xuất hiện trước đó trong Chương ${chapNum}. Đổi thành "Hình ${expectedNum}." để đảm bảo thứ tự liên tục.`,
          locationLabel: `Chương ${chapNum} • Đoạn #${entry.xmlNodeIndex + 1}`,
          currentText: entry.fullCaption,
          suggestedFixText: standardText,
          xmlNodeIndex: entry.xmlNodeIndex,
          fixAction: 'replace_paragraph_text',
        });
      } else if (entry.numberStr !== expectedNum) {
        issues.push({
          id: `issue-fig-gap-${entry.xmlNodeIndex}`,
          category: 'figure',
          severity: 'error',
          title: `Đánh nhảy số / Sai thứ tự: "${entry.prefix} ${entry.numberStr}" → Sửa thành "Hình ${expectedNum}"`,
          description: `Theo thứ tự liên tục trong Chương ${chapNum} (Hình ${chapNum}.1, Hình ${chapNum}.2...), hình thứ ${seq} này phải mang số hiệu "Hình ${expectedNum}".`,
          locationLabel: `Chương ${chapNum} • Đoạn #${entry.xmlNodeIndex + 1}`,
          currentText: entry.fullCaption,
          suggestedFixText: standardText,
          xmlNodeIndex: entry.xmlNodeIndex,
          fixAction: 'replace_paragraph_text',
        });
      }
    }
  }

  // 2. Audit Tables by `actualChapter` (Chương 1 -> Bảng 1.1., Bảng 1.2....)
  const tblEventsByChap = new Map<number, ThesisCatalogEntry[]>();
  for (const tbl of tablesCatalog) {
    const arr = tblEventsByChap.get(tbl.actualChapter) || [];
    arr.push(tbl);
    tblEventsByChap.set(tbl.actualChapter, arr);
  }

  for (const [chapNum, tblList] of tblEventsByChap.entries()) {
    const seenTblNums = new Map<string, number>();

    tblList.forEach((tbl, idx) => {
      const seq = idx + 1;
      const expectedNum = `${chapNum}.${seq}`;
      tbl.expectedNumberStr = expectedNum;

      const prevCount = seenTblNums.get(tbl.numberStr) || 0;
      seenTblNums.set(tbl.numberStr, prevCount + 1);

      const cleanTitle = tbl.title || `Bảng dữ liệu ${expectedNum}`;
      const standardText = `Bảng ${expectedNum}. ${cleanTitle}`;

      if (tbl.chapterNum !== null && tbl.chapterNum !== chapNum) {
        issues.push({
          id: `issue-tbl-wrongchap-${tbl.xmlNodeIndex}`,
          category: 'table',
          severity: 'error',
          title: `Sai số chương: Đang ở Chương ${chapNum} nhưng ghi "Bảng ${tbl.numberStr}" → Sửa thành "Bảng ${expectedNum}"`,
          description: `Bảng này thuộc Chương ${chapNum} (bảng thứ ${seq} của Chương ${chapNum}) nhưng đang ghi số hiệu là "Bảng ${tbl.numberStr}". Đổi thành "Bảng ${expectedNum}."`,
          locationLabel: `Chương ${chapNum} • Đoạn #${tbl.xmlNodeIndex + 1}`,
          currentText: tbl.fullCaption,
          suggestedFixText: standardText,
          xmlNodeIndex: tbl.xmlNodeIndex,
          fixAction: 'replace_paragraph_text',
        });
      } else if (prevCount > 0) {
        issues.push({
          id: `issue-tbl-dup-${tbl.xmlNodeIndex}`,
          category: 'table',
          severity: 'error',
          title: `Trùng số hiệu Bảng ${tbl.numberStr} trong Chương ${chapNum} → Sửa thành Bảng ${expectedNum}`,
          description: `Số hiệu Bảng ${tbl.numberStr} bị lặp lại. Chuẩn hóa thành "Bảng ${expectedNum}."`,
          locationLabel: `Chương ${chapNum} • Đoạn #${tbl.xmlNodeIndex + 1}`,
          currentText: tbl.fullCaption,
          suggestedFixText: standardText,
          xmlNodeIndex: tbl.xmlNodeIndex,
          fixAction: 'replace_paragraph_text',
        });
      } else if (tbl.numberStr !== expectedNum) {
        issues.push({
          id: `issue-tbl-gap-${tbl.xmlNodeIndex}`,
          category: 'table',
          severity: 'error',
          title: `Nhảy số thứ tự Bảng ${tbl.numberStr} → Sửa thành Bảng ${expectedNum}`,
          description: `Trong Chương ${chapNum}, bảng thứ ${seq} phải đánh số là "Bảng ${expectedNum}" (đang ghi là Bảng ${tbl.numberStr}).`,
          locationLabel: `Chương ${chapNum} • Đoạn #${tbl.xmlNodeIndex + 1}`,
          currentText: tbl.fullCaption,
          suggestedFixText: standardText,
          xmlNodeIndex: tbl.xmlNodeIndex,
          fixAction: 'replace_paragraph_text',
        });
      }
    });
  }

  onProgress?.('Đang quét Từ viết tắt (CK, α-amylase, HbA1c, CNTT...) & tổng hợp 3 Danh mục...', 'Kiểm tra giải nghĩa chuyên ngành', 88);
  await new Promise(r => setTimeout(r, 20));

  // ==========================================================================
  // SCAN FRONT-MATTER & BODY FOR ABBREVIATIONS (INCLUDING BIOMEDICAL TERMS)
  // ==========================================================================
  const declaredAbbrevs = new Map<string, { meaning: string; xmlNodeIndex: number }>();

  if (tocZones.abbrevStartNodeIndex >= 0) {
    for (
      let i = tocZones.abbrevStartNodeIndex + 1;
      i <= tocZones.abbrevEndNodeIndex && i < nodes.length;
      i++
    ) {
      const node = nodes[i];
      const raw = node.text.trim();
      if (!raw) continue;

      const stripped = raw.replace(/^\d+\s*[.)]\s*/, '').trim();

      // Match "CK (Creatine Kinase): Enzym..." or "α-amylase: Enzym..." or "CSDL\tCơ sở dữ liệu"
      const m1 = stripped.match(
        /^([αβγa-zA-Z0-9Đđ&]{2,15}(?:[-/][a-zA-Z0-9]{1,10})?)\s*(\([^)]+\)\s*[:–\-]\s*.+)$/
      );
      if (m1) {
        declaredAbbrevs.set(m1[1].trim(), {
          meaning: `${m1[1].trim()} ${m1[2].trim()}`,
          xmlNodeIndex: i,
        });
        continue;
      }

      const m2 = stripped.match(
        /^([αβγa-zA-Z0-9Đđ&]{2,15}(?:[-/][a-zA-Z0-9]{1,10})?)\s*(?:[\t:–\-]+|\s{2,})\s*(.+)$/
      );
      if (m2) {
        const acr = m2[1].trim();
        const mean = m2[2].trim();
        if (!/^(Từ\s+viết\s+tắt|Chữ\s+viết\s+tắt|Nghĩa\s+đầy\s+đủ)$/i.test(acr)) {
          declaredAbbrevs.set(acr, { meaning: mean, xmlNodeIndex: i });
          continue;
        }
      }

      // 2-column table cells inside Danh mục từ viết tắt
      if (
        node.inTableIndex >= 0 &&
        /^[αβγa-zA-Z0-9Đđ&]{2,15}(?:[-/][a-zA-Z0-9]{1,10})?$/.test(stripped)
      ) {
        if (!/^(STT|TT|TỪ|CHỮ|KÝ)$/i.test(stripped) && i + 1 <= tocZones.abbrevEndNodeIndex) {
          const nextNode = nodes[i + 1];
          if (nextNode && nextNode.inTableIndex === node.inTableIndex && nextNode.text.trim()) {
            declaredAbbrevs.set(stripped, {
              meaning: nextNode.text.trim(),
              xmlNodeIndex: i,
            });
            i++;
          }
        }
      }
    }
  }

  const bodyAbbrevs = new Map<
    string,
    { count: number; firstNodeIndex: number; snippet: string; inlineMeaning?: string }
  >();

  const UPPER_ACRONYM_REGEX = /\b([A-ZĐ]{2,10}(?:[&\-/][A-Z0-9Đ]{1,6})?)\b/g;

  for (let i = scanStart; i < nodes.length; i++) {
    if (isInsideFrontCatalog(i)) continue;
    const text = nodes[i].text.trim();
    if (!text) continue;

    const mostlyCaps = isMostlyAllCapsLine(text);

    // 1. Standard uppercase acronyms
    UPPER_ACRONYM_REGEX.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = UPPER_ACRONYM_REGEX.exec(text)) !== null) {
      const token = m[1];
      if (STOPWORD_ACRONYMS.has(token) || MEASUREMENT_UNITS.has(token)) continue;
      if (/^[IVXLC]+$/.test(token)) continue;
      if (mostlyCaps && !declaredAbbrevs.has(token) && !ACADEMIC_ABBREV_DICTIONARY[token]) {
        continue;
      }

      let inlineMeaning: string | undefined;
      const pos = m.index;
      const before = text.slice(Math.max(0, pos - 90), pos);
      const beforeMatch = before.match(/([A-ZÀ-Ỹa-zà-ỹ][^().,;:\n]{4,75})\(\s*$/);
      if (beforeMatch) {
        inlineMeaning = beforeMatch[1].trim();
      } else {
        const after = text.slice(pos + token.length, pos + token.length + 120);
        const afterMatch = after.match(/^\s*(\([^()]+\)(?:\s*[:–\-]\s*[^.;\n]+)?)/);
        if (afterMatch) {
          inlineMeaning = `${token} ${afterMatch[1].trim()}`;
        }
      }

      const prev = bodyAbbrevs.get(token);
      if (!prev) {
        const sStart = Math.max(0, pos - 40);
        const sEnd = Math.min(text.length, pos + token.length + 55);
        bodyAbbrevs.set(token, {
          count: 1,
          firstNodeIndex: i,
          snippet:
            (sStart > 0 ? '...' : '') +
            text.slice(sStart, sEnd).trim() +
            (sEnd < text.length ? '...' : ''),
          inlineMeaning,
        });
      } else {
        prev.count++;
        if (!prev.inlineMeaning && inlineMeaning) prev.inlineMeaning = inlineMeaning;
      }
    }

    // 2. Biomedical / Greek-letter / Mixed-case abbreviations (α-amylase, HbA1c, mRNA, Vmax, Km...)
    SPECIAL_SCIENTIFIC_TERMS_REGEX.lastIndex = 0;
    let sm: RegExpExecArray | null;
    while ((sm = SPECIAL_SCIENTIFIC_TERMS_REGEX.exec(text)) !== null) {
      const rawToken = sm[1];
      const token =
        rawToken.toLowerCase() === 'hba1c'
          ? 'HbA1c'
          : rawToken.toLowerCase() === 'α-amylase'
          ? 'α-amylase'
          : rawToken;
      const pos = sm.index;
      const prev = bodyAbbrevs.get(token);
      if (!prev) {
        const sStart = Math.max(0, pos - 40);
        const sEnd = Math.min(text.length, pos + rawToken.length + 55);
        bodyAbbrevs.set(token, {
          count: 1,
          firstNodeIndex: i,
          snippet:
            (sStart > 0 ? '...' : '') +
            text.slice(sStart, sEnd).trim() +
            (sEnd < text.length ? '...' : ''),
        });
      } else {
        prev.count++;
      }
    }
  }

  const allAcronyms = new Set<string>([
    ...Array.from(declaredAbbrevs.keys()),
    ...Array.from(bodyAbbrevs.keys()),
  ]);

  const abbreviations: ThesisAbbrevEntry[] = [];

  for (const acr of allAcronyms) {
    const decl = declaredAbbrevs.get(acr);
    const body = bodyAbbrevs.get(acr);
    const dict =
      ACADEMIC_ABBREV_DICTIONARY[acr] || ACADEMIC_ABBREV_DICTIONARY[acr.toUpperCase()];

    // Skip single-occurrence unknown uppercase words unless in dictionary or inline-defined
    if (!decl && body && body.count === 1 && !dict && !body.inlineMeaning) {
      continue;
    }

    const inferred =
      decl?.meaning ||
      body?.inlineMeaning ||
      dict ||
      `${acr}: Thuật ngữ viết tắt chuyên ngành trong đề án.`;

    const abEntry: ThesisAbbrevEntry = {
      acronym: acr,
      meaningInToc: decl?.meaning,
      inferredMeaning: inferred,
      firstContextSnippet: body?.snippet || '(Khai báo ở Danh mục từ viết tắt)',
      occurrencesInBody: body?.count || 0,
      inFrontMatterList: Boolean(decl),
      xmlNodeIndex: body ? body.firstNodeIndex : decl?.xmlNodeIndex || 0,
    };
    abbreviations.push(abEntry);

    if (!decl && body) {
      const formattedLine = formatNumberedAbbreviationLine(abbreviations.length, abEntry).replace(
        /^\d+\.\s*/,
        ''
      );
      issues.push({
        id: `issue-abbr-missing-${acr}`,
        category: 'abbreviation',
        severity: 'warning',
        title: `Thiếu từ viết tắt "${acr}" (${body.count} lần) trong Danh mục từ viết tắt`,
        description: `Từ viết tắt "${acr}" được sử dụng ${body.count} lần trong bài (lần đầu tại đoạn #${
          body.firstNodeIndex + 1
        }) nhưng chưa được liệt kê vào Danh mục từ viết tắt đầu tài liệu.`,
        locationLabel: `Đoạn #${body.firstNodeIndex + 1}`,
        currentText: body.snippet,
        suggestedFixText: formattedLine,
        xmlNodeIndex: body.firstNodeIndex,
        fixAction: 'append_abbreviation_row',
        acronym: acr,
        meaning: formattedLine,
      });
    }
  }

  onProgress?.('Hoàn tất phân tích 100% tài liệu Word!', `Phát hiện ${issues.length} mục cần chuẩn hóa`, 100);

  return {
    zip,
    report: {
      fileName: file.name,
      totalParagraphs: nodes.length,
      totalImagesInDoc,
      totalTablesInDoc,
      figuresCatalog,
      tablesCatalog,
      abbreviations,
      issues,
      tocZones,
      detectedChapters,
    },
  };
}

// ============================================================================
// SURGICAL XML FIXER & 3-CATALOG INSERTION AFTER "MỤC LỤC"
// ============================================================================

export function replaceParagraphTextInZip(
  zip: PizZip,
  paraIndex: number,
  newPlainText: string
): boolean {
  const docFile = zip.file('word/document.xml');
  if (!docFile) return false;
  const xml = docFile.asText();

  const pRegex = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
  let match: RegExpExecArray | null;
  let currentIdx = 0;

  while ((match = pRegex.exec(xml)) !== null) {
    if (currentIdx === paraIndex) {
      const pXml = match[0];
      const pStart = match.index;
      const pEnd = pStart + pXml.length;

      let replacedFirst = false;
      const updatedPXml = pXml.replace(
        /<w:t(?:\s+[^>]*)?>([\s\S]*?)<\/w:t>/g,
        () => {
          if (!replacedFirst) {
            replacedFirst = true;
            return `<w:t xml:space="preserve">${encodeXmlEntities(newPlainText)}</w:t>`;
          }
          return `<w:t></w:t>`;
        }
      );

      if (!replacedFirst) {
        // If paragraph had no <w:t>, append a <w:r><w:t> inside <w:p>
        const injected = pXml.replace(
          /<\/w:p>$/,
          `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:sz w:val="26"/></w:rPr><w:t xml:space="preserve">${encodeXmlEntities(
            newPlainText
          )}</w:t></w:r></w:p>`
        );
        const newXml = xml.slice(0, pStart) + injected + xml.slice(pEnd);
        zip.file('word/document.xml', newXml);
        return true;
      }

      const newXml = xml.slice(0, pStart) + updatedPXml + xml.slice(pEnd);
      zip.file('word/document.xml', newXml);
      return true;
    }
    currentIdx++;
  }

  return false;
}

function buildCleanWordParagraphXml(
  text: string,
  opts: {
    bold?: boolean;
    italic?: boolean;
    fontSizeHalfPt?: number;
    align?: 'left' | 'center' | 'both';
    spaceBeforeTwips?: number;
    spaceAfterTwips?: number;
  } = {}
): string {
  const {
    bold = false,
    italic = false,
    fontSizeHalfPt = 26, // 13pt standard
    align = 'both',
    spaceBeforeTwips = 60,
    spaceAfterTwips = 100,
  } = opts;

  return `<w:p><w:pPr><w:spacing w:before="${spaceBeforeTwips}" w:after="${spaceAfterTwips}" w:line="312" w:lineRule="auto"/><w:jc w:val="${align}"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>${
    bold ? '<w:b/>' : ''
  }${
    italic ? '<w:i/>' : ''
  }<w:sz w:val="${fontSizeHalfPt}"/><w:szCs w:val="${fontSizeHalfPt}"/></w:rPr><w:t xml:space="preserve">${encodeXmlEntities(
    text
  )}</w:t></w:r></w:p>`;
}

/**
 * Inserts or updates the 3 Front-Matter Catalogs right AFTER "Mục lục" and BEFORE Main Content:
 *   1. Danh mục hình (Hình 1.1. ..., Hình 1.2. ...)
 *   2. Danh mục bảng (Bảng 1.1. ..., Bảng 1.2. ...)
 *   3. Danh mục từ viết tắt (1. CK (Creatine Kinase): ..., 2. α-amylase: ..., 3. HbA1c: ...)
 */
export function insertThreeCatalogsAfterTocToZip(
  zip: PizZip,
  report: ThesisAuditReport,
  customFixInputs?: Record<string, string>
): boolean {
  const docFile = zip.file('word/document.xml');
  if (!docFile) return false;
  const xml = docFile.asText();

  const catalogBlocksXml: string[] = [];

  // 1. Danh mục hình (using the corrected chapter-based numbering Hình 1.1., Hình 1.2....)
  if (report.figuresCatalog.length > 0) {
    catalogBlocksXml.push(
      buildCleanWordParagraphXml('Danh mục hình', {
        bold: true,
        fontSizeHalfPt: 28,
        align: 'left',
        spaceBeforeTwips: 220,
        spaceAfterTwips: 120,
      })
    );

    report.figuresCatalog.forEach(fig => {
      const relatedIssue = report.issues.find(
        iss => iss.category === 'figure' && iss.xmlNodeIndex === fig.xmlNodeIndex
      );
      let finalLine = '';
      if (relatedIssue) {
        finalLine =
          (customFixInputs && customFixInputs[relatedIssue.id]) ||
          relatedIssue.suggestedFixText;
      } else {
        const cleanTitle = fig.title || fig.fullCaption;
        finalLine = `Hình ${fig.expectedNumberStr}. ${cleanTitle.replace(
          /^(?:Hình|Ảnh|Sơ\s+đồ|Biểu\s+đồ)\s+[0-9.]+\s*[:.–\-]?\s*/i,
          ''
        )}`;
      }
      catalogBlocksXml.push(
        buildCleanWordParagraphXml(finalLine, {
          bold: false,
          fontSizeHalfPt: 26,
          align: 'both',
          spaceBeforeTwips: 40,
          spaceAfterTwips: 80,
        })
      );
    });
  }

  // 2. Danh mục bảng (using the corrected chapter-based numbering Bảng 1.1., Bảng 1.2....)
  if (report.tablesCatalog.length > 0) {
    catalogBlocksXml.push(
      buildCleanWordParagraphXml('Danh mục bảng', {
        bold: true,
        fontSizeHalfPt: 28,
        align: 'left',
        spaceBeforeTwips: 220,
        spaceAfterTwips: 120,
      })
    );

    report.tablesCatalog.forEach(tbl => {
      const relatedIssue = report.issues.find(
        iss => iss.category === 'table' && iss.xmlNodeIndex === tbl.xmlNodeIndex
      );
      let finalLine = '';
      if (relatedIssue) {
        finalLine =
          (customFixInputs && customFixInputs[relatedIssue.id]) ||
          relatedIssue.suggestedFixText;
      } else {
        const cleanTitle = tbl.title || tbl.fullCaption;
        finalLine = `Bảng ${tbl.expectedNumberStr}. ${cleanTitle.replace(
          /^Bảng\s+[0-9.]+\s*[:.–\-]?\s*/i,
          ''
        )}`;
      }
      catalogBlocksXml.push(
        buildCleanWordParagraphXml(finalLine, {
          bold: false,
          fontSizeHalfPt: 26,
          align: 'both',
          spaceBeforeTwips: 40,
          spaceAfterTwips: 80,
        })
      );
    });
  }

  // 3. Danh mục từ viết tắt (numbered 1. CK (Creatine Kinase): ..., 2. α-amylase: ..., 3. HbA1c: ...)
  const activeAbbrevs = report.abbreviations.filter(
    ab => ab.occurrencesInBody > 0 || ab.inFrontMatterList
  );
  if (activeAbbrevs.length > 0) {
    catalogBlocksXml.push(
      buildCleanWordParagraphXml('Danh mục từ viết tắt', {
        bold: true,
        fontSizeHalfPt: 28,
        align: 'left',
        spaceBeforeTwips: 220,
        spaceAfterTwips: 120,
      })
    );

    activeAbbrevs.forEach((ab, idx) => {
      const relatedIssue = report.issues.find(
        iss => iss.category === 'abbreviation' && iss.acronym === ab.acronym
      );
      let lineStr = '';
      if (relatedIssue && customFixInputs && customFixInputs[relatedIssue.id]) {
        const customVal = customFixInputs[relatedIssue.id].trim().replace(/^\d+\.\s*/, '');
        lineStr = `${idx + 1}. ${customVal}`;
      } else {
        lineStr = formatNumberedAbbreviationLine(idx + 1, ab);
      }

      catalogBlocksXml.push(
        buildCleanWordParagraphXml(lineStr, {
          bold: false,
          fontSizeHalfPt: 26,
          align: 'both',
          spaceBeforeTwips: 40,
          spaceAfterTwips: 80,
        })
      );
    });
  }

  if (catalogBlocksXml.length === 0) return false;
  const fullCatalogXml = catalogBlocksXml.join('');

  // Avoid duplicate insertion if we already inserted the 3 catalogs in this session
  if (xml.includes('<!-- AZTOOL_THREE_CATALOGS_START -->')) {
    const replaced = xml.replace(
      /<!-- AZTOOL_THREE_CATALOGS_START -->[\s\S]*?<!-- AZTOOL_THREE_CATALOGS_END -->/,
      `<!-- AZTOOL_THREE_CATALOGS_START -->${fullCatalogXml}<!-- AZTOOL_THREE_CATALOGS_END -->`
    );
    zip.file('word/document.xml', replaced);
    return true;
  }

  const wrappedCatalogXml = `<!-- AZTOOL_THREE_CATALOGS_START -->${fullCatalogXml}<!-- AZTOOL_THREE_CATALOGS_END -->`;

  // Target insertion point:
  // Right AFTER "Mục lục" (`mainTocEndNodeIndex`) and BEFORE `bodyStartNodeIndex` (Chương 1 / Mở đầu)!
  const insertBeforeParaIdx =
    report.tocZones.mainTocEndNodeIndex >= 0
      ? report.tocZones.mainTocEndNodeIndex + 1
      : report.tocZones.bodyStartNodeIndex > 0
      ? report.tocZones.bodyStartNodeIndex
      : report.detectedChapters.length > 0
      ? report.detectedChapters[0].xmlNodeIndex
      : 0;

  // Make sure if insertBeforeParaIdx is inside a <w:tbl>, we step outside the <w:tbl> before inserting <w:p>
  const tblRanges: Array<[number, number]> = [];
  const tblRegex = /<w:tbl\b[\s\S]*?<\/w:tbl>/g;
  let tm: RegExpExecArray | null;
  while ((tm = tblRegex.exec(xml)) !== null) {
    tblRanges.push([tm.index, tm.index + tm[0].length]);
  }

  const pRegex = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
  let match: RegExpExecArray | null;
  let currentIdx = 0;

  while ((match = pRegex.exec(xml)) !== null) {
    if (currentIdx === insertBeforeParaIdx) {
      let targetOffset = match.index;
      // If targetOffset falls inside a <w:tbl>, move targetOffset to right before that <w:tbl>
      for (const [tStart, tEnd] of tblRanges) {
        if (targetOffset >= tStart && targetOffset <= tEnd) {
          targetOffset = tStart;
          break;
        }
      }
      const newXml =
        xml.slice(0, targetOffset) + wrappedCatalogXml + xml.slice(targetOffset);
      zip.file('word/document.xml', newXml);
      return true;
    }
    currentIdx++;
  }

  // Fallback: insert right after <w:body>
  const bodyMatch = xml.match(/<w:body\b[^>]*>/);
  if (bodyMatch && bodyMatch.index !== undefined) {
    const offset = bodyMatch.index + bodyMatch[0].length;
    const newXml = xml.slice(0, offset) + wrappedCatalogXml + xml.slice(offset);
    zip.file('word/document.xml', newXml);
    return true;
  }

  return false;
}

export function applySurgicalFixToZip(
  zip: PizZip,
  issue: ThesisAuditIssue,
  customText: string,
  tocZones: ThesisTocZones
): boolean {
  if (issue.fixAction === 'replace_paragraph_text') {
    const ok = replaceParagraphTextInZip(zip, issue.xmlNodeIndex, customText);
    if (issue.cascadeUpdates && issue.cascadeUpdates.length > 0) {
      for (const casc of issue.cascadeUpdates) {
        replaceParagraphTextInZip(zip, casc.xmlNodeIndex, casc.newText);
      }
    }
    return ok;
  }

  if (issue.fixAction === 'insert_caption_after_node') {
    // First apply cascade updates to later nodes (in reverse order or in-place replace)
    if (issue.cascadeUpdates && issue.cascadeUpdates.length > 0) {
      for (const casc of issue.cascadeUpdates) {
        replaceParagraphTextInZip(zip, casc.xmlNodeIndex, casc.newText);
      }
    }

    const docFile = zip.file('word/document.xml');
    if (!docFile) return false;
    const xml = docFile.asText();

    const pRegex = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
    let match: RegExpExecArray | null;
    let currentIdx = 0;
    while ((match = pRegex.exec(xml)) !== null) {
      if (currentIdx === issue.xmlNodeIndex) {
        const pEnd = match.index + match[0].length;
        const captionXml = buildCleanWordParagraphXml(customText, {
          bold: true,
          italic: true,
          fontSizeHalfPt: 24,
          align: 'center',
          spaceBeforeTwips: 60,
          spaceAfterTwips: 160,
        });
        const newXml = xml.slice(0, pEnd) + captionXml + xml.slice(pEnd);
        zip.file('word/document.xml', newXml);
        return true;
      }
      currentIdx++;
    }
    return false;
  }

  if (issue.fixAction === 'append_abbreviation_row') {
    const docFile = zip.file('word/document.xml');
    if (!docFile) return false;
    const xml = docFile.asText();

    // If there is an abbreviation table in front matter, append a row to that <w:tbl>
    if (tocZones.abbrevTableIndex >= 0) {
      const tblRegex = /<w:tbl\b[\s\S]*?<\/w:tbl>/g;
      let tm: RegExpExecArray | null;
      let tIdx = 0;
      while ((tm = tblRegex.exec(xml)) !== null) {
        if (tIdx === tocZones.abbrevTableIndex) {
          const tblXml = tm[0];
          const acr = issue.acronym || customText.split(/[:(]/)[0].trim();
          const mean = customText.replace(new RegExp(`^${acr}\\s*[:–\\-]?\\s*`, 'i'), '').trim() || customText;
          const newRowXml = `<w:tr><w:tc><w:p><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">${encodeXmlEntities(
            acr
          )}</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">${encodeXmlEntities(
            mean
          )}</w:t></w:r></w:p></w:tc></w:tr>`;
          const updatedTbl = tblXml.replace(/<\/w:tbl>$/, `${newRowXml}</w:tbl>`);
          const newXml =
            xml.slice(0, tm.index) + updatedTbl + xml.slice(tm.index + tblXml.length);
          zip.file('word/document.xml', newXml);
          return true;
        }
        tIdx++;
      }
    }
    return true;
  }

  return false;
}

export function exportFixedThesisDocxBlob(zip: PizZip): Blob {
  return zip.generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

export async function suggestAbbreviationMeaningsWithAI(
  acronyms: Array<{ acronym: string; context: string }>,
  apiKeysStr: string,
  modelId?: string
): Promise<Record<string, string>> {
  if (acronyms.length === 0) return {};

  const systemInstruction = `Bạn là Hội đồng Thẩm định Đề án, Luận văn & Y Sinh học Đại học Việt Nam.
Nhiệm vụ: Giải nghĩa chính xác từng từ viết tắt theo đúng quy chuẩn danh mục từ viết tắt:
- Ví dụ:
  + "CK": "CK (Creatine Kinase): Enzym xúc tác chuyển hóa năng lượng ở cơ và tim."
  + "α-amylase": "α-amylase: Enzym thủy phân tinh bột (được theo dõi đặc hiệu trong viêm tụy cấp)."
  + "HbA1c": "HbA1c: Glycated hemoglobin (chỉ số đánh giá và kiểm soát đường huyết trung bình trong 2 - 3 tháng của bệnh nhân đái tháo đường)."
Trả về đúng định dạng JSON thuần túy (key là từ viết tắt, value là giải nghĩa).`;

  const prompt = `Hãy giải nghĩa các từ viết tắt sau dựa vào ngữ cảnh xuất hiện trong đề án:\n${JSON.stringify(
    acronyms,
    null,
    2
  )}`;

  const res = await callGeminiApi(prompt, apiKeysStr, modelId, systemInstruction, true);
  const cleaned = res.replace(/```json/g, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleaned);
  return typeof parsed === 'object' && parsed !== null ? parsed : {};
}
