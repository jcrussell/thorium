/**
 * Types for the GitHub-style omnibar filter component
 */

/** Represents the current filter state */
export interface FilterState {
  search: string; // Free text search
  groups: string[]; // Included groups
  excludeGroups: string[]; // Negated groups (-group:name)
  scalers: string[]; // Included scalers
  excludeScalers: string[]; // Negated scalers (-scaler:K8s)
  generator: boolean | null; // null = any, true = is:generator, false = -is:generator
  creators: string[]; // Included creators
  excludeCreators: string[]; // Negated creators (-creator:name)
  used: boolean | null; // null = any, true = is:used (has pipelines), false = is:orphan (no pipelines)
  pipelines: string[]; // Included pipelines (used_by)
  excludePipelines: string[]; // Negated pipelines (-pipeline:name)
}

/** A parsed token from the input */
export interface ParsedToken {
  key: string; // e.g., 'group', 'scaler', 'is'
  value: string; // e.g., 'malware', 'K8s', 'generator'
  negated: boolean; // true if prefixed with -
  raw: string; // Original matched string
}

/** Suggestion item for autocomplete */
export interface Suggestion {
  type: 'key' | 'value'; // Whether this is a filter key or value suggestion
  key?: string; // The filter key (for value suggestions)
  value: string; // The display/insert value
  display: string; // What to show in the dropdown
}

/** Props for the Omnibar component */
export interface OmnibarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  onSubmit: (filters: FilterState, queryString: string) => void;
  availableGroups: string[];
  availableScalers: string[];
  availableCreators?: string[];
  availablePipelines?: string[];
  currentUser?: string; // For @me shorthand expansion
  placeholder?: string;
}

/** Props for the badge component */
export interface OmnibarBadgeProps {
  type: 'group' | 'scaler' | 'generator' | 'search' | 'creator' | 'used' | 'pipeline';
  value: string;
  negated?: boolean;
  onRemove: () => void;
}

/** Props for the suggestions dropdown */
export interface OmnibarSuggestionsProps {
  suggestions: Suggestion[];
  selectedIndex: number;
  onSelect: (suggestion: Suggestion) => void;
  visible: boolean;
}

/** Filter key definitions for autocomplete */
export const FILTER_KEYS = ['group', 'scaler', 'creator', 'pipeline', 'is'] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];

/** Default/empty filter state */
export const DEFAULT_FILTER_STATE: FilterState = {
  search: '',
  groups: [],
  excludeGroups: [],
  scalers: [],
  excludeScalers: [],
  generator: null,
  creators: [],
  excludeCreators: [],
  used: null,
  pipelines: [],
  excludePipelines: [],
};
