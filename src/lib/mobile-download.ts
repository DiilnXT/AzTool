import { saveAs } from 'file-saver';

export const DOCX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const XLSX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const PPTX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation';
export const PDF_MIME_TYPE = 'application/pdf';
export const ZIP_MIME_TYPE = 'application/zip';

const EXT_TO_MIME: Record<string, string> = {
  docx: DOCX_MIME_TYPE,
  doc: 'application/msword',
  xlsx: XLSX_MIME_TYPE,
  xls: 'application/vnd.ms-excel',
  pptx: PPTX_MIME_TYPE,
  ppt: 'application/vnd.ms-powerpoint',
  pdf: PDF_MIME_TYPE,
  zip: ZIP_MIME_TYPE,
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(sub));
  }
  return btoa(binary);
}

export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  return /android|iphone|ipad|ipod|iemobile|mobile|zalo|fbav|fban|samsungbrowser/i.test(ua);
}

/**
 * Ensures any .docx / .pptx / .xlsx / .pdf Blob has the strict Office MIME type
 * and downloads cleanly on both Mobile (Android/iOS/Zalo) and Desktop without
 * ever being misidentified as a .zip archive ([Content_Types].xml, _rels, word).
 */
export async function downloadFileMobileSafe(blob: Blob, rawFileName: string): Promise<void> {
  const fileName = rawFileName.trim() || 'AzTool_TaiLieu.docx';
  const ext = (fileName.split('.').pop() || 'docx').toLowerCase();
  const targetMime = EXT_TO_MIME[ext] || blob.type || DOCX_MIME_TYPE;

  const arrayBuffer = await blob.arrayBuffer();
  const typedBlob = new Blob([arrayBuffer], { type: targetMime });

  // On Mobile devices (Android Chrome, Samsung Internet, Zalo, iOS Safari),
  // downloading a `blob:` URL for an OpenXML (.docx/.pptx/.xlsx) file causes Android DownloadManager
  // to sniff the PK\x03\x04 header and treat the file as a .zip folder!
  // Submitting via a native POST form to /api/download-file sends real HTTP headers:
  // Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document
  // Content-Disposition: attachment; filename="...docx"
  // X-Content-Type-Options: nosniff
  // which forces Android & iOS to recognize it 100% as a Microsoft Word document!
  if (
    typeof document !== 'undefined' &&
    isMobileDevice() &&
    (ext === 'docx' || ext === 'pptx' || ext === 'xlsx' || ext === 'pdf') &&
    arrayBuffer.byteLength <= 18 * 1024 * 1024
  ) {
    try {
      const base64 = arrayBufferToBase64(arrayBuffer);
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = '/api/download-file';
      form.style.display = 'none';

      const inputBase64 = document.createElement('input');
      inputBase64.type = 'hidden';
      inputBase64.name = 'base64';
      inputBase64.value = base64;
      form.appendChild(inputBase64);

      const inputName = document.createElement('input');
      inputName.type = 'hidden';
      inputName.name = 'fileName';
      inputName.value = fileName;
      form.appendChild(inputName);

      const inputMime = document.createElement('input');
      inputMime.type = 'hidden';
      inputMime.name = 'mimeType';
      inputMime.value = targetMime;
      form.appendChild(inputMime);

      document.body.appendChild(form);
      form.submit();
      setTimeout(() => {
        try {
          document.body.removeChild(form);
        } catch {
          // ignore
        }
      }, 4000);
      return;
    } catch (e) {
      console.warn('Mobile form download fallback to saveAs:', e);
    }
  }

  saveAs(typedBlob, fileName);
}
