import { useState, useCallback, useEffect, useRef } from 'react';

export interface PaginatedResult<T> {
  data: T[];
  cursor: number | null;
}

export interface PaginatedDataOptions<T> {
  /** Function that fetches paginated data */
  fetchFn: (cursor: number, limit: number) => Promise<PaginatedResult<T>>;
  /** Number of items to fetch per page (default: 50) */
  limit?: number;
  /** Whether to fetch initial data on mount (default: true) */
  fetchOnMount?: boolean;
}

export interface PaginatedDataResult<T> {
  /** The accumulated data from all fetches */
  data: T[];
  /** Whether data is currently being loaded */
  loading: boolean;
  /** Whether there is more data to load */
  hasMore: boolean;
  /** Error message if the fetch failed */
  error: string | null;
  /** Function to load the next page of data */
  loadMore: () => Promise<void>;
  /** Function to reset and reload from the beginning */
  reset: () => Promise<void>;
}

/**
 * A reusable hook for managing paginated data loading.
 * Single responsibility: manage cursor-based pagination state.
 *
 * @param options - Configuration for pagination behavior
 * @returns Paginated data state and control functions
 */
export function usePaginatedData<T>(options: PaginatedDataOptions<T>): PaginatedDataResult<T> {
  const { fetchFn, limit = 50, fetchOnMount = true } = options;

  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cursorRef = useRef<number>(0);
  const isMountedRef = useRef(true);

  // Track if we've done the initial fetch
  const initialFetchDone = useRef(false);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    setError(null);

    try {
      const result = await fetchFn(cursorRef.current, limit);

      if (!isMountedRef.current) return;

      setData((prev) => [...prev, ...result.data]);

      if (result.cursor === null) {
        setHasMore(false);
      } else {
        cursorRef.current = result.cursor;
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [fetchFn, limit, loading, hasMore]);

  const reset = useCallback(async () => {
    cursorRef.current = 0;
    setData([]);
    setHasMore(true);
    setError(null);

    // Trigger a fresh load
    setLoading(true);
    try {
      const result = await fetchFn(0, limit);

      if (!isMountedRef.current) return;

      setData(result.data);

      if (result.cursor === null) {
        setHasMore(false);
      } else {
        cursorRef.current = result.cursor;
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [fetchFn, limit]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Fetch on mount if enabled
  useEffect(() => {
    if (fetchOnMount && !initialFetchDone.current) {
      initialFetchDone.current = true;
      void loadMore();
    }
  }, [fetchOnMount, loadMore]);

  return {
    data,
    loading,
    hasMore,
    error,
    loadMore,
    reset,
  };
}

export default usePaginatedData;
