import { useCallback } from 'react';
import { FilterState, ParsedToken, Suggestion, FILTER_KEYS, DEFAULT_FILTER_STATE } from './types';

/**
 * Regex pattern to match filter tokens
 * Captures: (-?)(\w+):("[^"]*"|\S+)
 * - Optional negation prefix (-)
 * - Key (word characters)
 * - Colon separator
 * - Value (quoted string or non-whitespace)
 */
const TOKEN_PATTERN = /(-?)(\w+):("[^"]*"|[^\s]+)/g;

/**
 * Parse raw input string into tokens
 */
export function parseInput(input: string): ParsedToken[] {
  const tokens: ParsedToken[] = [];
  let match: RegExpExecArray | null;

  // Reset regex state
  TOKEN_PATTERN.lastIndex = 0;

  while ((match = TOKEN_PATTERN.exec(input)) !== null) {
    const negated = match[1] === '-';
    const key = match[2].toLowerCase();
    let value = match[3];

    // Remove surrounding quotes if present
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }

    tokens.push({
      key,
      value,
      negated,
      raw: match[0],
    });
  }

  return tokens;
}

/**
 * Extract free text (non-token) portion from input
 */
export function extractFreeText(input: string): string {
  // Remove all tokens from the input
  return input.replace(TOKEN_PATTERN, '').trim().replace(/\s+/g, ' ');
}

/**
 * Convert parsed tokens to FilterState
 * @param tokens - Parsed tokens from input
 * @param freeText - Free text search portion
 * @param currentUser - Current username for @me expansion
 */
export function tokensToFilters(tokens: ParsedToken[], freeText: string, currentUser: string = ''): FilterState {
  const filters: FilterState = { ...DEFAULT_FILTER_STATE, search: freeText };

  for (const token of tokens) {
    switch (token.key) {
      case 'group':
        if (token.negated) {
          filters.excludeGroups = [...filters.excludeGroups, token.value];
        } else {
          filters.groups = [...filters.groups, token.value];
        }
        break;

      case 'scaler':
        if (token.negated) {
          filters.excludeScalers = [...filters.excludeScalers, token.value];
        } else {
          filters.scalers = [...filters.scalers, token.value];
        }
        break;

      case 'is':
        if (token.value.toLowerCase() === 'generator') {
          filters.generator = !token.negated;
        }
        break;

      case 'generator': {
        // Support both generator:yes/no and is:generator syntax
        const isYes = ['yes', 'true', '1'].includes(token.value.toLowerCase());
        const isNo = ['no', 'false', '0'].includes(token.value.toLowerCase());
        if (isYes) {
          filters.generator = !token.negated;
        } else if (isNo) {
          filters.generator = token.negated;
        }
        break;
      }

      case 'creator': {
        // Expand @me to current user
        const creatorValue = token.value === '@me' && currentUser ? currentUser : token.value;
        if (token.negated) {
          filters.excludeCreators = [...filters.excludeCreators, creatorValue];
        } else {
          filters.creators = [...filters.creators, creatorValue];
        }
        break;
      }

      case 'pipeline':
        if (token.negated) {
          filters.excludePipelines = [...filters.excludePipelines, token.value];
        } else {
          filters.pipelines = [...filters.pipelines, token.value];
        }
        break;
    }

    // Handle is: keywords
    if (token.key === 'is') {
      const val = token.value.toLowerCase();
      if (val === 'used') {
        filters.used = !token.negated;
      } else if (val === 'orphan') {
        // is:orphan means NOT used by any pipeline
        filters.used = token.negated; // is:orphan = used:false, -is:orphan = used:true
      }
    }
  }

  return filters;
}

/**
 * Convert FilterState back to query string
 */
export function filtersToQueryString(filters: FilterState): string {
  const parts: string[] = [];

  // Groups
  for (const group of filters.groups) {
    const value = group.includes(' ') ? `"${group}"` : group;
    parts.push(`group:${value}`);
  }
  for (const group of filters.excludeGroups) {
    const value = group.includes(' ') ? `"${group}"` : group;
    parts.push(`-group:${value}`);
  }

  // Scalers
  for (const scaler of filters.scalers) {
    parts.push(`scaler:${scaler}`);
  }
  for (const scaler of filters.excludeScalers) {
    parts.push(`-scaler:${scaler}`);
  }

  // Generator
  if (filters.generator === true) {
    parts.push('is:generator');
  } else if (filters.generator === false) {
    parts.push('-is:generator');
  }

  // Creators
  for (const creator of filters.creators) {
    const value = creator.includes(' ') ? `"${creator}"` : creator;
    parts.push(`creator:${value}`);
  }
  for (const creator of filters.excludeCreators) {
    const value = creator.includes(' ') ? `"${creator}"` : creator;
    parts.push(`-creator:${value}`);
  }

  // Used/Orphan
  if (filters.used === true) {
    parts.push('is:used');
  } else if (filters.used === false) {
    parts.push('is:orphan');
  }

  // Pipelines
  for (const pipeline of filters.pipelines) {
    const value = pipeline.includes(' ') ? `"${pipeline}"` : pipeline;
    parts.push(`pipeline:${value}`);
  }
  for (const pipeline of filters.excludePipelines) {
    const value = pipeline.includes(' ') ? `"${pipeline}"` : pipeline;
    parts.push(`-pipeline:${value}`);
  }

  // Free text search
  if (filters.search) {
    parts.push(filters.search);
  }

  return parts.join(' ');
}

/**
 * Parse query string (from URL) to FilterState
 * @param queryString - The query string to parse
 * @param currentUser - Current username for @me expansion
 */
export function parseQueryString(queryString: string, currentUser: string = ''): FilterState {
  const tokens = parseInput(queryString);
  const freeText = extractFreeText(queryString);
  return tokensToFilters(tokens, freeText, currentUser);
}

/**
 * Get what the user is currently typing (for autocomplete context)
 */
export function getCurrentToken(input: string, cursorPos: number): { partial: string; isKey: boolean; key?: string; isNegated: boolean } {
  // Get the text before the cursor
  const textBeforeCursor = input.slice(0, cursorPos);

  // Find the start of the current "word" (after last space)
  const lastSpaceIndex = textBeforeCursor.lastIndexOf(' ');
  const currentWord = textBeforeCursor.slice(lastSpaceIndex + 1);

  // Check if negated
  const isNegated = currentWord.startsWith('-');
  const wordWithoutNegation = isNegated ? currentWord.slice(1) : currentWord;

  // Check if we're typing a value (after colon)
  const colonIndex = wordWithoutNegation.indexOf(':');
  if (colonIndex !== -1) {
    const key = wordWithoutNegation.slice(0, colonIndex).toLowerCase();
    const valueStart = wordWithoutNegation.slice(colonIndex + 1);
    return { partial: valueStart, isKey: false, key, isNegated };
  }

  // We're typing a key
  return { partial: wordWithoutNegation, isKey: true, isNegated };
}

/**
 * Custom hook for omnibar parsing functionality
 */
export function useOmnibarParser(
  availableGroups: string[],
  availableScalers: string[],
  availableCreators: string[] = [],
  availablePipelines: string[] = [],
  currentUser: string = '',
) {
  /**
   * Get suggestions based on current input context
   */
  const getSuggestions = useCallback(
    (input: string, cursorPos: number): Suggestion[] => {
      const context = getCurrentToken(input, cursorPos);
      const suggestions: Suggestion[] = [];

      if (context.isKey) {
        // Suggest filter keys
        const partialLower = context.partial.toLowerCase();
        for (const key of FILTER_KEYS) {
          if (key.startsWith(partialLower) || partialLower === '') {
            suggestions.push({
              type: 'key',
              value: `${context.isNegated ? '-' : ''}${key}:`,
              display: `${context.isNegated ? '-' : ''}${key}:`,
            });
          }
        }
      } else if (context.key) {
        // Suggest values for the current key
        const partialLower = context.partial.toLowerCase().replace(/^"/, '');

        switch (context.key) {
          case 'group':
            for (const group of availableGroups) {
              if (group.toLowerCase().includes(partialLower) || partialLower === '') {
                const value = group.includes(' ') ? `"${group}"` : group;
                suggestions.push({
                  type: 'value',
                  key: 'group',
                  value: `${context.isNegated ? '-' : ''}group:${value}`,
                  display: group,
                });
              }
            }
            break;

          case 'scaler':
            for (const scaler of availableScalers) {
              if (scaler.toLowerCase().includes(partialLower) || partialLower === '') {
                suggestions.push({
                  type: 'value',
                  key: 'scaler',
                  value: `${context.isNegated ? '-' : ''}scaler:${scaler}`,
                  display: scaler,
                });
              }
            }
            break;

          case 'is': {
            const isOptions = ['generator', 'used', 'orphan'];
            for (const opt of isOptions) {
              if (opt.includes(partialLower) || partialLower === '') {
                suggestions.push({
                  type: 'value',
                  key: 'is',
                  value: `${context.isNegated ? '-' : ''}is:${opt}`,
                  display: opt,
                });
              }
            }
            break;
          }

          case 'creator':
            // Add @me shorthand first if it matches
            if (currentUser && ('@me'.includes(partialLower) || partialLower === '')) {
              suggestions.push({
                type: 'value',
                key: 'creator',
                value: `${context.isNegated ? '-' : ''}creator:@me`,
                display: `@me (${currentUser})`,
              });
            }
            for (const creator of availableCreators) {
              if (creator.toLowerCase().includes(partialLower) || partialLower === '') {
                const value = creator.includes(' ') ? `"${creator}"` : creator;
                suggestions.push({
                  type: 'value',
                  key: 'creator',
                  value: `${context.isNegated ? '-' : ''}creator:${value}`,
                  display: creator,
                });
              }
            }
            break;

          case 'pipeline':
            for (const pipeline of availablePipelines) {
              if (pipeline.toLowerCase().includes(partialLower) || partialLower === '') {
                const value = pipeline.includes(' ') ? `"${pipeline}"` : pipeline;
                suggestions.push({
                  type: 'value',
                  key: 'pipeline',
                  value: `${context.isNegated ? '-' : ''}pipeline:${value}`,
                  display: pipeline,
                });
              }
            }
            break;

          case 'generator': {
            const boolValues = ['yes', 'no'];
            for (const val of boolValues) {
              if (val.includes(partialLower) || partialLower === '') {
                suggestions.push({
                  type: 'value',
                  key: 'generator',
                  value: `${context.isNegated ? '-' : ''}generator:${val}`,
                  display: val,
                });
              }
            }
            break;
          }
        }
      }

      return suggestions.slice(0, 10); // Limit to 10 suggestions
    },
    [availableGroups, availableScalers, availableCreators, availablePipelines, currentUser],
  );

  /**
   * Apply a suggestion to the input
   */
  const applySuggestion = useCallback((input: string, cursorPos: number, suggestion: Suggestion): string => {
    const textBeforeCursor = input.slice(0, cursorPos);
    const textAfterCursor = input.slice(cursorPos);

    // Find the start of the current word
    const lastSpaceIndex = textBeforeCursor.lastIndexOf(' ');
    const beforeWord = textBeforeCursor.slice(0, lastSpaceIndex + 1);

    // Build the new input
    return beforeWord + suggestion.value + (suggestion.type === 'value' ? ' ' : '') + textAfterCursor.trimStart();
  }, []);

  // Wrap tokensToFilters to automatically pass currentUser
  const tokensToFiltersWithUser = useCallback(
    (tokens: ParsedToken[], freeText: string) => tokensToFilters(tokens, freeText, currentUser),
    [currentUser],
  );

  return {
    parseInput,
    extractFreeText,
    tokensToFilters: tokensToFiltersWithUser,
    filtersToQueryString,
    parseQueryString,
    getCurrentToken,
    getSuggestions,
    applySuggestion,
  };
}

export default useOmnibarParser;
