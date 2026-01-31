import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mocks/server';
import { createReaction, deleteReaction, getReaction, getReactionLogs, getReactionStageLogs, listReactions } from './reactions';
import { setMockCookie } from '../test/setup';

describe('reactions API', () => {
  const errorHandler = vi.fn();

  beforeEach(() => {
    setMockCookie('THORIUM_TOKEN', 'test-token');
    errorHandler.mockClear();
  });

  describe('createReaction', () => {
    const validReaction = { pipeline: 'test-pipeline', group: 'default', samples: ['sha256'], args: {}, sla: 30 };

    it('returns reaction on success', async () => {
      const result = await createReaction(validReaction, errorHandler);
      expect(result).toHaveProperty('id');
      expect(errorHandler).not.toHaveBeenCalled();
    });

    it('handles permission denied', async () => {
      server.use(http.post('**/reactions/', () => HttpResponse.json({}, { status: 403 })));
      const result = await createReaction(validReaction, errorHandler);
      expect(result).toBeNull();
      expect(errorHandler).toHaveBeenCalled();
    });
  });

  describe('getReaction', () => {
    it('returns reaction details', async () => {
      const result = await getReaction('default', 'uuid-123', errorHandler);
      expect(result).toMatchObject({ id: 'uuid-123', group: 'default' });
      expect(errorHandler).not.toHaveBeenCalled();
    });

    it('handles not found', async () => {
      server.use(http.get('**/reactions/:group/:uuid', () => HttpResponse.json({}, { status: 404 })));
      const result = await getReaction('default', 'missing', errorHandler);
      expect(result).toBeNull();
      expect(errorHandler).toHaveBeenCalled();
    });
  });

  describe('listReactions', () => {
    it('returns list by pipeline', async () => {
      const result = await listReactions('default', errorHandler, 'my-pipeline');
      expect(result.reactions).toBeInstanceOf(Array);
      expect(errorHandler).not.toHaveBeenCalled();
    });

    it('returns detailed list when requested', async () => {
      const result = await listReactions('default', errorHandler, 'my-pipeline', '', true);
      expect(result.details[0]).toHaveProperty('pipeline');
    });

    it('handles errors', async () => {
      server.use(http.get('**/reactions/list/:group/:pipeline/', () => HttpResponse.json({}, { status: 500 })));
      const result = await listReactions('default', errorHandler, 'pipeline');
      expect(result).toBeNull();
      expect(errorHandler).toHaveBeenCalled();
    });
  });

  describe('getReactionLogs', () => {
    it('returns logs array', async () => {
      const result = await getReactionLogs('default', 'uuid', errorHandler);
      expect(result).toBeInstanceOf(Array);
    });

    it('handles errors', async () => {
      server.use(http.get('**/reactions/logs/:group/:uuid', () => HttpResponse.json({}, { status: 404 })));
      const result = await getReactionLogs('default', 'missing', errorHandler);
      expect(result).toBeNull();
      expect(errorHandler).toHaveBeenCalled();
    });
  });

  describe('getReactionStageLogs', () => {
    it('returns stage logs', async () => {
      const result = await getReactionStageLogs('default', 'uuid', 'stage', errorHandler);
      expect(result).toBeInstanceOf(Array);
    });

    it('returns empty array when no logs', async () => {
      server.use(http.get('**/reactions/logs/:group/:uuid/:stage', () => HttpResponse.json({ logs: [] })));
      const result = await getReactionStageLogs('default', 'uuid', 'stage', errorHandler);
      expect(result).toEqual([]);
    });
  });

  describe('deleteReaction', () => {
    it('returns true on success', async () => {
      const result = await deleteReaction('default', 'uuid', errorHandler);
      expect(result).toBe(true);
      expect(errorHandler).not.toHaveBeenCalled();
    });

    it('returns false on permission denied', async () => {
      server.use(http.delete('**/reactions/:group/:uuid', () => HttpResponse.json({}, { status: 403 })));
      const result = await deleteReaction('default', 'uuid', errorHandler);
      expect(result).toBe(false);
      expect(errorHandler).toHaveBeenCalled();
    });
  });
});
