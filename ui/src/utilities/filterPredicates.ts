/**
 * Filter state interface - matches the omnibar FilterState type.
 * Defined here to avoid circular dependencies between utilities and components.
 */
export interface FilterState {
  search: string;
  groups: string[];
  excludeGroups: string[];
  scalers: string[];
  excludeScalers: string[];
  generator: boolean | null;
  creators: string[];
  excludeCreators: string[];
  used: boolean | null;
  pipelines: string[];
  excludePipelines: string[];
}

/**
 * Pure filter predicate for Image objects.
 * Single responsibility: determine if an image matches the given filters.
 *
 * @param image - The image object to test
 * @param filters - The current filter state
 * @returns true if the image matches all filters
 */
export function matchesImageFilters(
  image: {
    name?: string;
    description?: string;
    group?: string;
    scaler?: string;
    generator?: boolean;
    creator?: string;
    used_by?: string[];
  },
  filters: FilterState,
): boolean {
  // Search filter - matches name or description
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    const nameMatch = image.name?.toLowerCase().includes(searchLower);
    const descMatch = image.description?.toLowerCase().includes(searchLower);
    if (!nameMatch && !descMatch) return false;
  }

  // Group inclusion filter
  if (filters.groups.length > 0 && !filters.groups.includes(image.group || '')) {
    return false;
  }

  // Group exclusion filter
  if (filters.excludeGroups.length > 0 && filters.excludeGroups.includes(image.group || '')) {
    return false;
  }

  // Scaler inclusion filter
  if (filters.scalers.length > 0 && !filters.scalers.includes(image.scaler || '')) {
    return false;
  }

  // Scaler exclusion filter
  if (filters.excludeScalers.length > 0 && filters.excludeScalers.includes(image.scaler || '')) {
    return false;
  }

  // Generator filter
  if (filters.generator !== null && image.generator !== filters.generator) {
    return false;
  }

  // Creator inclusion filter
  if (filters.creators.length > 0 && !filters.creators.includes(image.creator || '')) {
    return false;
  }

  // Creator exclusion filter
  if (filters.excludeCreators.length > 0 && filters.excludeCreators.includes(image.creator || '')) {
    return false;
  }

  // Used/Orphan filter (based on used_by field)
  if (filters.used !== null) {
    const isUsed = image.used_by && image.used_by.length > 0;
    if (filters.used && !isUsed) return false; // is:used but not used
    if (!filters.used && isUsed) return false; // is:orphan but is used
  }

  // Pipeline inclusion filter (used_by field)
  if (filters.pipelines.length > 0) {
    const usedByPipelines = image.used_by || [];
    const hasMatchingPipeline = filters.pipelines.some((p) => usedByPipelines.includes(p));
    if (!hasMatchingPipeline) return false;
  }

  // Pipeline exclusion filter
  if (filters.excludePipelines.length > 0) {
    const usedByPipelines = image.used_by || [];
    const hasExcludedPipeline = filters.excludePipelines.some((p) => usedByPipelines.includes(p));
    if (hasExcludedPipeline) return false;
  }

  return true;
}

/**
 * Pure filter predicate for Pipeline objects.
 * Single responsibility: determine if a pipeline matches the given filters.
 *
 * @param pipeline - The pipeline object to test
 * @param filters - The current filter state
 * @returns true if the pipeline matches all filters
 */
export function matchesPipelineFilters(
  pipeline: {
    name?: string;
    description?: string;
    group?: string;
    creator?: string;
  },
  filters: FilterState,
): boolean {
  // Search filter - matches name or description
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    const nameMatch = pipeline.name?.toLowerCase().includes(searchLower);
    const descMatch = pipeline.description?.toLowerCase().includes(searchLower);
    if (!nameMatch && !descMatch) return false;
  }

  // Group inclusion filter
  if (filters.groups.length > 0 && !filters.groups.includes(pipeline.group || '')) {
    return false;
  }

  // Group exclusion filter
  if (filters.excludeGroups.length > 0 && filters.excludeGroups.includes(pipeline.group || '')) {
    return false;
  }

  // Creator inclusion filter
  if (filters.creators.length > 0 && !filters.creators.includes(pipeline.creator || '')) {
    return false;
  }

  // Creator exclusion filter
  if (filters.excludeCreators.length > 0 && filters.excludeCreators.includes(pipeline.creator || '')) {
    return false;
  }

  return true;
}
