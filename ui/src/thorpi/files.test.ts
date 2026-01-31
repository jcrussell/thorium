import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mocks/server';
import { listFiles, uploadFile, getFile, getFileDetails, uploadTags, deleteTags, deleteSubmission, updateFileSubmission } from './files';
import { setMockCookie } from '../test/setup';
import { createTags } from '../test/utils/factories';

describe('files API', () => {
  beforeEach(() => {
    setMockCookie('THORIUM_TOKEN', 'test-token');
  });

  describe('listFiles', () => {
    it('returns files on success', async () => {
      const errorHandler = vi.fn();

      const result = await listFiles({ limit: 10 }, errorHandler);

      expect(result.files).toHaveLength(3);
      expect(result.files[0]).toHaveProperty('sha256');
      expect(errorHandler).not.toHaveBeenCalled();
    });

    it('returns cursor for pagination', async () => {
      server.use(
        http.get('**/files', () => {
          return HttpResponse.json({
            data: [{ sha256: 'test-hash' }],
            cursor: 'next-page-cursor',
          });
        }),
      );

      const errorHandler = vi.fn();
      const result = await listFiles({ limit: 10 }, errorHandler);

      expect(result.cursor).toBe('next-page-cursor');
    });

    it('returns detailed file info when details=true', async () => {
      server.use(
        http.get('**/files/details/', () => {
          return HttpResponse.json({
            data: [{ sha256: 'hash', submissions: [{ id: 'sub-1' }] }],
            cursor: null,
          });
        }),
      );

      const errorHandler = vi.fn();
      const result = await listFiles({ limit: 10 }, errorHandler, true);

      expect(result.files[0]).toHaveProperty('submissions');
    });

    it('continues from cursor for next page', async () => {
      server.use(
        http.get('**/files', () => {
          return HttpResponse.json({
            data: [{ sha256: 'page-2-file' }],
            cursor: 'page-3-cursor',
          });
        }),
      );

      const errorHandler = vi.fn();
      const result = await listFiles({ limit: 10 }, errorHandler, false, 'page-2-cursor');

      expect(result.files).toHaveLength(1);
      expect(result.cursor).toBe('page-3-cursor');
    });

    it('returns empty files and calls error handler on failure', async () => {
      server.use(
        http.get('**/files', () => {
          return HttpResponse.json({ error: 'Server error' }, { status: 500 });
        }),
      );

      const errorHandler = vi.fn();
      const result = await listFiles({ limit: 10 }, errorHandler);

      expect(result.files).toEqual([]);
      expect(errorHandler).toHaveBeenCalled();
    });
  });

  describe('uploadFile', () => {
    function createUploadContext() {
      const formData = new FormData();
      formData.append('file', new Blob(['test content']), 'test.txt');
      return {
        formData,
        errorHandler: vi.fn(),
        progressHandler: vi.fn(),
        controller: new AbortController(),
      };
    }

    it('returns sha256 on successful upload', async () => {
      const { formData, errorHandler, progressHandler, controller } = createUploadContext();

      const result = (await uploadFile(formData, errorHandler, progressHandler, controller)) as { sha256: string };

      expect(result).toHaveProperty('sha256');
      expect(errorHandler).not.toHaveBeenCalled();
    });

    it('returns existing file sha256 when file already exists (409)', async () => {
      server.use(
        http.post('**/files/', () => {
          return HttpResponse.json({ error: 'existing-file-hash' }, { status: 409 });
        }),
      );

      const { formData, errorHandler, progressHandler, controller } = createUploadContext();
      const result = (await uploadFile(formData, errorHandler, progressHandler, controller)) as { sha256: string };

      expect(result).toEqual({ sha256: 'existing-file-hash' });
    });

    it('calls error handler on server error', async () => {
      server.use(
        http.post('**/files/', () => {
          return HttpResponse.json({ error: 'Upload failed' }, { status: 500 });
        }),
      );

      const { formData, errorHandler, progressHandler, controller } = createUploadContext();
      await uploadFile(formData, errorHandler, progressHandler, controller);

      expect(errorHandler).toHaveBeenCalled();
    });
  });

  describe('getFile', () => {
    it('returns file as ArrayBuffer in CaRT format', async () => {
      const errorHandler = vi.fn();

      const result = await getFile('test-sha256', errorHandler);

      expect(result).toBeInstanceOf(ArrayBuffer);
      expect(errorHandler).not.toHaveBeenCalled();
    });

    it('returns file as ArrayBuffer in ZIP format', async () => {
      server.use(
        http.get('**/files/sample/:sha256/download/zip', () => {
          return new HttpResponse(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), {
            headers: { 'Content-Type': 'application/zip' },
          });
        }),
      );

      const errorHandler = vi.fn();
      const result = await getFile('test-sha256', errorHandler, 'Encrypted ZIP', 'password');

      expect(result).toBeInstanceOf(ArrayBuffer);
    });

    it('returns null and calls error handler when file not found', async () => {
      server.use(
        http.get('**/files/sample/:sha256/download', () => {
          return HttpResponse.json({ error: 'Not found' }, { status: 404 });
        }),
      );

      const errorHandler = vi.fn();
      const result = await getFile('nonexistent-hash', errorHandler);

      expect(result).toBeNull();
      expect(errorHandler).toHaveBeenCalled();
    });
  });

  describe('getFileDetails', () => {
    it('returns sample with hashes and submissions', async () => {
      const errorHandler = vi.fn();

      const result = (await getFileDetails('test-sha256', errorHandler)) as { sha256: string; submissions: unknown[] };

      expect(result.sha256).toBe('test-sha256');
      expect(result.submissions).toBeDefined();
      expect(errorHandler).not.toHaveBeenCalled();
    });

    it('returns null and calls error handler when not found', async () => {
      server.use(
        http.get('**/files/sample/:sha256', () => {
          return HttpResponse.json({ error: 'Sample not found' }, { status: 404 });
        }),
      );

      const errorHandler = vi.fn();

      await expect(getFileDetails('nonexistent-hash', errorHandler)).resolves.toBeNull();
      expect(errorHandler).toHaveBeenCalled();
    });
  });

  describe('uploadTags', () => {
    it('returns true when tags added successfully', async () => {
      const errorHandler = vi.fn();

      const result = await uploadTags('test-sha256', createTags(), errorHandler);

      expect(result).toBe(true);
      expect(errorHandler).not.toHaveBeenCalled();
    });

    it('returns false and calls error handler on failure', async () => {
      server.use(
        http.post('**/files/tags/:sha256', () => {
          return HttpResponse.json({ error: 'Forbidden' }, { status: 403 });
        }),
      );

      const errorHandler = vi.fn();
      const result = await uploadTags('test-sha256', createTags(), errorHandler);

      expect(result).toBe(false);
      expect(errorHandler).toHaveBeenCalled();
    });
  });

  describe('deleteTags', () => {
    it('returns true when tags deleted successfully', async () => {
      const errorHandler = vi.fn();

      const result = await deleteTags('test-sha256', createTags(), errorHandler);

      expect(result).toBe(true);
      expect(errorHandler).not.toHaveBeenCalled();
    });

    it('returns false and calls error handler on failure', async () => {
      server.use(
        http.delete('**/files/tags/:sha256', () => {
          return HttpResponse.json({ error: 'Forbidden' }, { status: 403 });
        }),
      );

      const errorHandler = vi.fn();
      const result = await deleteTags('test-sha256', createTags(), errorHandler);

      expect(result).toBe(false);
      expect(errorHandler).toHaveBeenCalled();
    });
  });

  describe('deleteSubmission', () => {
    it('returns true when submission deleted successfully', async () => {
      const errorHandler = vi.fn();

      const result = await deleteSubmission('test-sha256', 'submission-id', ['group1'], errorHandler);

      expect(result).toBe(true);
      expect(errorHandler).not.toHaveBeenCalled();
    });

    it('returns false and calls error handler on failure', async () => {
      server.use(
        http.delete('**/files/sample/:sha256/:id', () => {
          return HttpResponse.json({ error: 'Not found' }, { status: 404 });
        }),
      );

      const errorHandler = vi.fn();
      const result = await deleteSubmission('test-sha256', 'submission-id', [], errorHandler);

      expect(result).toBe(false);
      expect(errorHandler).toHaveBeenCalled();
    });
  });

  describe('updateFileSubmission', () => {
    it('returns true when submission updated successfully', async () => {
      const errorHandler = vi.fn();

      const result = await updateFileSubmission('test-sha256', { name: 'new-name' }, errorHandler);

      expect(result).toBe(true);
      expect(errorHandler).not.toHaveBeenCalled();
    });

    it('returns false and calls error handler on failure', async () => {
      server.use(
        http.patch('**/files/sample/:sha256', () => {
          return HttpResponse.json({ error: 'Forbidden' }, { status: 403 });
        }),
      );

      const errorHandler = vi.fn();
      const result = await updateFileSubmission('test-sha256', { name: 'new-name' }, errorHandler);

      expect(result).toBe(false);
      expect(errorHandler).toHaveBeenCalled();
    });
  });
});
