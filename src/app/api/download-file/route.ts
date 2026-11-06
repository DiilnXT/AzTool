import { NextRequest, NextResponse } from 'next/server';

const MIME_BY_EXT: Record<string, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ppt: 'application/vnd.ms-powerpoint',
  pdf: 'application/pdf',
  zip: 'application/zip',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

function sanitizeFileName(rawName: string): string {
  const cleaned = rawName.replace(/[\\/:*?"<>|]+/g, '_').trim();
  return cleaned || 'AzTool_Document.docx';
}

function toAsciiFallbackFileName(fileName: string): string {
  return fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9._-]+/g, '_');
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';

    let fileBytes: Uint8Array;
    let fileName = 'AzTool_TaiLieu.docx';
    let explicitMime = '';

    if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      const base64Data = String(formData.get('base64') || '');
      fileName = sanitizeFileName(String(formData.get('fileName') || 'AzTool_TaiLieu.docx'));
      explicitMime = String(formData.get('mimeType') || '');
      const buf = Buffer.from(base64Data, 'base64');
      fileBytes = new Uint8Array(buf);
    } else {
      const body = await req.json();
      const base64Data = String(body.base64 || '');
      fileName = sanitizeFileName(String(body.fileName || 'AzTool_TaiLieu.docx'));
      explicitMime = String(body.mimeType || '');
      const buf = Buffer.from(base64Data, 'base64');
      fileBytes = new Uint8Array(buf);
    }

    const ext = (fileName.split('.').pop() || 'docx').toLowerCase();
    const resolvedMime =
      MIME_BY_EXT[ext] ||
      explicitMime ||
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    const asciiName = toAsciiFallbackFileName(fileName);
    const encodedUtf8Name = encodeURIComponent(fileName);

    return new NextResponse(Buffer.from(fileBytes), {
      status: 200,
      headers: {
        'Content-Type': resolvedMime,
        'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedUtf8Name}`,
        'Content-Length': String(fileBytes.byteLength),
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Lỗi tải file' },
      { status: 500 }
    );
  }
}
