import { useMemo } from 'react';

/**
 * A reusable hook for filtering an array by a predicate function.
 * Single responsibility: filter an array based on filter state.
 *
 * @param items - The array of items to filter
 * @param filters - The current filter state
 * @param filterFn - A predicate function that returns true if item matches filters
 * @returns The filtered array, memoized for performance
 */
export function useFilteredList<T, F>(
  items: T[],
  filters: F,
  filterFn: (item: T, filters: F) => boolean,
): T[] {
  return useMemo(() => items.filter((item) => filterFn(item, filters)), [items, filters, filterFn]);
}

export default useFilteredList;
