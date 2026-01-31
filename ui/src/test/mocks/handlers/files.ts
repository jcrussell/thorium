import { http, HttpResponse } from 'msw';
import { createFullSample, createFileListResponse } from '../../utils/factories';

export const fileHandlers = [
  // GET /api/files - List files
  http.get('**/files', ({ request }) => {
    const url = new URL(request.url);
    const cursor = url.searchParams.get('cursor');
    return HttpResponse.json(createFileListResponse(3, cursor ? 'next-cursor' : null));
  }),

  // GET /api/files/details/ - List files with details
  http.get('**/files/details/', ({ request }) => {
    const url = new URL(request.url);
    const cursor = url.searchParams.get('cursor');
    return HttpResponse.json(createFileListResponse(3, cursor ? 'next-cursor' : null));
  }),

  // POST /api/files/ - Upload file
  http.post('**/files/', () => {
    return HttpResponse.json({
      sha256: 'abcd1234'.repeat(8),
      filename: 'uploaded-file.exe',
    });
  }),

  // GET /api/files/sample/:sha256/download - Download file (CaRT)
  http.get('**/files/sample/:sha256/download', () => {
    const content = new Uint8Array([0x43, 0x61, 0x52, 0x54]); // CaRT magic bytes
    return new HttpResponse(content, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="sample.cart"',
      },
    });
  }),

  // GET /api/files/sample/:sha256/download/zip - Download file (ZIP)
  http.get('**/files/sample/:sha256/download/zip', () => {
    const content = new Uint8Array([0x50, 0x4b, 0x03, 0x04]); // ZIP magic bytes
    return new HttpResponse(content, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="sample.zip"',
      },
    });
  }),

  // GET /api/files/sample/:sha256 - Get file details
  http.get('**/files/sample/:sha256', ({ params }) => {
    const sha256 = params.sha256 as string;
    return HttpResponse.json(createFullSample({ sha256 }));
  }),

  // POST /api/files/tags/:sha256 - Upload tags
  http.post('**/files/tags/:sha256', () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // DELETE /api/files/tags/:sha256 - Delete tags
  http.delete('**/files/tags/:sha256', () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // DELETE /api/files/sample/:sha256/:id - Delete submission
  http.delete('**/files/sample/:sha256/:id', () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // PATCH /api/files/sample/:sha256 - Update file submission
  http.patch('**/files/sample/:sha256', () => {
    return new HttpResponse(null, { status: 204 });
  }),
];
