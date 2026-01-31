import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mocks/server';
import { search } from './search';
import { setMockCookie } from '../test/setup';
import { ElasticIndex } from '@models';

describe('search API', () => {
  const errorHandler = vi.fn();

  beforeEach(() => {
    setMockCookie('THORIUM_TOKEN', 'test-token');
    errorHandler.mockClear();
  });

  it('returns results for valid query', async () => {
    const { entityList, entityCursor } = await search('test', errorHandler);
    expect(entityList.length).toBeGreaterThan(0);
    expect(errorHandler).not.toHaveBeenCalled();
  });

  it('returns empty for empty query', async () => {
    const { entityList } = await search('', errorHandler);
    expect(entityList).toEqual([]);
  });

  it('supports index filtering', async () => {
    const { entityList } = await search('test', errorHandler, [ElasticIndex.SampleResults]);
    expect(entityList).toBeInstanceOf(Array);
  });

  it('supports group filtering', async () => {
    const { entityList } = await search('test', errorHandler, undefined, ['mygroup']);
    expect(entityList).toBeInstanceOf(Array);
  });

  it('supports date range filtering', async () => {
    const { entityList } = await search('test', errorHandler, undefined, undefined, '2024-01-01', '2024-12-31');
    expect(entityList).toBeInstanceOf(Array);
  });

  it('returns cursor for pagination', async () => {
    server.use(
      http.get('**/search/', () => HttpResponse.json({ data: [{ id: 'r1' }], cursor: 'next-page' })),
    );
    const { entityCursor } = await search('test', errorHandler);
    expect(entityCursor).toBe('next-page');
  });

  it('handles errors gracefully', async () => {
    server.use(http.get('**/search/', () => HttpResponse.json({}, { status: 500 })));
    const { entityList } = await search('test', errorHandler);
    expect(entityList).toEqual([]);
    expect(errorHandler).toHaveBeenCalled();
  });
});
