import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mocks/server';
import { createEntity, getEntity, updateEntity, deleteEntity, listEntities } from './entities';
import { setMockCookie } from '../test/setup';
import { createDevice, createVendor, createEntityListResponse } from '../test/utils/factories';

describe('entities API', () => {
  beforeEach(() => {
    setMockCookie('THORIUM_TOKEN', 'test-token');
  });

  describe('createEntity', () => {
    function createEntityFormData() {
      const formData = new FormData();
      formData.append('name', 'New Device');
      formData.append('groups', JSON.stringify(['default']));
      return formData;
    }

    it('returns entity id on success', async () => {
      const errorHandler = vi.fn();

      const result = await createEntity(createEntityFormData(), errorHandler);

      expect(result).toHaveProperty('id');
      expect(result?.id).toBe('new-entity-uuid');
      expect(errorHandler).not.toHaveBeenCalled();
    });

    it('returns null and calls error handler on validation error', async () => {
      server.use(
        http.post('**/entities/', () => {
          return HttpResponse.json({ error: 'Name is required' }, { status: 400 });
        }),
      );

      const errorHandler = vi.fn();
      const result = await createEntity(createEntityFormData(), errorHandler);

      expect(result).toBeNull();
      expect(errorHandler).toHaveBeenCalled();
    });

    it('returns null and calls error handler on server error', async () => {
      server.use(
        http.post('**/entities/', () => {
          return HttpResponse.json({ error: 'Internal server error' }, { status: 500 });
        }),
      );

      const errorHandler = vi.fn();
      const result = await createEntity(createEntityFormData(), errorHandler);

      expect(result).toBeNull();
      expect(errorHandler).toHaveBeenCalled();
    });
  });

  describe('getEntity', () => {
    it('returns device entity on success', async () => {
      const mockDevice = createDevice({ id: 'device-123', name: 'Test Router' });
      server.use(
        http.get('**/entities/:id', () => {
          return HttpResponse.json(mockDevice);
        }),
      );

      const errorHandler = vi.fn();
      const result = await getEntity('device-123', errorHandler);

      expect(result).toBeDefined();
      expect(result?.id).toBe('device-123');
      expect(result?.name).toBe('Test Router');
      expect(errorHandler).not.toHaveBeenCalled();
    });

    it('returns vendor entity on success', async () => {
      const mockVendor = createVendor({ id: 'vendor-456', name: 'Acme Corp' });
      server.use(
        http.get('**/entities/:id', () => {
          return HttpResponse.json(mockVendor);
        }),
      );

      const errorHandler = vi.fn();
      const result = await getEntity('vendor-456', errorHandler);

      expect(result).toBeDefined();
      expect(result?.id).toBe('vendor-456');
      expect(result?.name).toBe('Acme Corp');
    });

    it('returns null and calls error handler when not found', async () => {
      server.use(
        http.get('**/entities/:id', () => {
          return HttpResponse.json({ error: 'Entity not found' }, { status: 404 });
        }),
      );

      const errorHandler = vi.fn();
      const result = await getEntity('nonexistent-id', errorHandler);

      expect(result).toBeNull();
      expect(errorHandler).toHaveBeenCalled();
    });

    it('returns null and calls error handler on server error', async () => {
      server.use(
        http.get('**/entities/:id', () => {
          return HttpResponse.json({ error: 'Server error' }, { status: 500 });
        }),
      );

      const errorHandler = vi.fn();
      const result = await getEntity('entity-id', errorHandler);

      expect(result).toBeNull();
      expect(errorHandler).toHaveBeenCalled();
    });
  });

  describe('updateEntity', () => {
    function createUpdateFormData() {
      const formData = new FormData();
      formData.append('name', 'Updated Device');
      return formData;
    }

    it('returns true when entity updated successfully', async () => {
      const errorHandler = vi.fn();

      const result = await updateEntity('entity-123', createUpdateFormData(), errorHandler);

      expect(result).toBe(true);
      expect(errorHandler).not.toHaveBeenCalled();
    });

    it('returns false and calls error handler on failure', async () => {
      server.use(
        http.patch('**/entities/:id', () => {
          return HttpResponse.json({ error: 'Forbidden' }, { status: 403 });
        }),
      );

      const errorHandler = vi.fn();
      const result = await updateEntity('entity-123', createUpdateFormData(), errorHandler);

      expect(result).toBe(false);
      expect(errorHandler).toHaveBeenCalled();
    });

    it('returns false and calls error handler when entity not found', async () => {
      server.use(
        http.patch('**/entities/:id', () => {
          return HttpResponse.json({ error: 'Entity not found' }, { status: 404 });
        }),
      );

      const errorHandler = vi.fn();
      const result = await updateEntity('nonexistent-id', createUpdateFormData(), errorHandler);

      expect(result).toBe(false);
      expect(errorHandler).toHaveBeenCalled();
    });
  });

  describe('deleteEntity', () => {
    it('returns true when entity deleted successfully', async () => {
      const errorHandler = vi.fn();

      const result = await deleteEntity('entity-123', errorHandler);

      expect(result).toBe(true);
      expect(errorHandler).not.toHaveBeenCalled();
    });

    it('returns false and calls error handler on failure', async () => {
      server.use(
        http.delete('**/entities/:id', () => {
          return HttpResponse.json({ error: 'Forbidden' }, { status: 403 });
        }),
      );

      const errorHandler = vi.fn();
      const result = await deleteEntity('entity-123', errorHandler);

      expect(result).toBe(false);
      expect(errorHandler).toHaveBeenCalled();
    });

    it('returns false and calls error handler when entity not found', async () => {
      server.use(
        http.delete('**/entities/:id', () => {
          return HttpResponse.json({ error: 'Entity not found' }, { status: 404 });
        }),
      );

      const errorHandler = vi.fn();
      const result = await deleteEntity('nonexistent-id', errorHandler);

      expect(result).toBe(false);
      expect(errorHandler).toHaveBeenCalled();
    });
  });

  describe('listEntities', () => {
    it('returns entities on success', async () => {
      const errorHandler = vi.fn();

      const result = await listEntities({ limit: 10 }, errorHandler, false, null);

      expect(result.entityList).toHaveLength(3);
      expect(result.entityList[0]).toHaveProperty('id');
      expect(result.entityList[0]).toHaveProperty('name');
      expect(errorHandler).not.toHaveBeenCalled();
    });

    it('returns cursor for pagination', async () => {
      server.use(
        http.get('**/entities', () => {
          return HttpResponse.json({
            data: [createDevice()],
            cursor: 'next-page-cursor',
          });
        }),
      );

      const errorHandler = vi.fn();
      const result = await listEntities({ limit: 10 }, errorHandler, false, null);

      expect(result.entityCursor).toBe('next-page-cursor');
    });

    it('returns detailed entity info when details=true', async () => {
      server.use(
        http.get('**/entities/details/', () => {
          return HttpResponse.json({
            data: [createDevice({ description: 'Detailed description' })],
            cursor: null,
          });
        }),
      );

      const errorHandler = vi.fn();
      const result = await listEntities({ limit: 10 }, errorHandler, true, null);

      expect(result.entityList[0]).toHaveProperty('metadata');
      expect(result.entityList[0]).toHaveProperty('description');
    });

    it('continues from cursor for next page', async () => {
      server.use(
        http.get('**/entities', ({ request }) => {
          const url = new URL(request.url);
          const cursor = url.searchParams.get('cursor');
          return HttpResponse.json({
            data: [createDevice({ name: cursor ? 'Page 2 Device' : 'Page 1 Device' })],
            cursor: cursor ? null : 'page-2-cursor',
          });
        }),
      );

      const errorHandler = vi.fn();
      const result = await listEntities({ limit: 10 }, errorHandler, false, 'page-1-cursor');

      expect(result.entityList).toHaveLength(1);
    });

    it('returns empty list on error', async () => {
      server.use(
        http.get('**/entities', () => {
          return HttpResponse.json({ error: 'Server error' }, { status: 500 });
        }),
      );

      const errorHandler = vi.fn();
      const result = await listEntities({ limit: 10 }, errorHandler, false, null);

      expect(result.entityList).toEqual([]);
      expect(errorHandler).toHaveBeenCalled();
    });
  });
});
