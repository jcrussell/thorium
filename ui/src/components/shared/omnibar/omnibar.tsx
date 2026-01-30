import React, { useState, useRef, useCallback, KeyboardEvent } from 'react';
import styled from 'styled-components';
import { FaTimes, FaSearch } from 'react-icons/fa';
import { OmnibarProps, FilterState, Suggestion, DEFAULT_FILTER_STATE } from './types';
import { useOmnibarParser, filtersToQueryString, parseQueryString } from './use_omnibar_parser';
import OmnibarBadge from './omnibar_badge';
import OmnibarSuggestions from './omnibar_suggestions';

const OmnibarContainer = styled.div`
  position: relative;
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
`;

const InputWrapper = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  padding: 6px 12px;
  background-color: var(--thorium-panel-bg);
  border: 1px solid var(--thorium-panel-border);
  border-radius: 6px;
  min-height: 42px;
  cursor: text;

  &:focus-within {
    border-color: var(--thorium-info-secondary-bg);
    box-shadow: 0 0 0 2px rgba(48, 94, 242, 0.2);
  }
`;

const SearchIcon = styled.span`
  color: var(--thorium-secondary-text);
  display: flex;
  align-items: center;
  margin-right: 4px;
`;

const BadgesContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
`;

const Input = styled.input`
  flex: 1;
  min-width: 150px;
  border: none;
  background: transparent;
  color: var(--thorium-text);
  font-size: 0.95rem;
  padding: 4px 0;
  outline: none;

  &::placeholder {
    color: var(--thorium-secondary-text);
  }
`;

const ClearButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  padding: 4px;
  margin-left: auto;
  cursor: pointer;
  color: var(--thorium-secondary-text);
  border-radius: 4px;

  &:hover {
    color: var(--thorium-text);
    background-color: var(--thorium-highlight-panel-bg);
  }

  &:focus {
    outline: none;
  }
`;

const HelpText = styled.div`
  font-size: 0.75rem;
  color: var(--thorium-secondary-text);
  margin-top: 4px;
  text-align: center;
`;

/**
 * GitHub-style omnibar filter component
 */
const Omnibar: React.FC<OmnibarProps> = ({
  filters,
  onChange,
  onSubmit,
  availableGroups,
  availableScalers,
  availableCreators = [],
  availablePipelines = [],
  currentUser = '',
  placeholder = 'Filter... group:name scaler:K8s creator:@me is:generator',
}) => {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const { getSuggestions, applySuggestion, parseInput, extractFreeText, tokensToFilters } = useOmnibarParser(
    availableGroups,
    availableScalers,
    availableCreators,
    availablePipelines,
    currentUser,
  );

  // Get current suggestions based on input
  const suggestions = getSuggestions(inputValue, inputRef.current?.selectionStart || inputValue.length);

  // Check if there are any active filters
  const hasActiveFilters =
    filters.search ||
    filters.groups.length > 0 ||
    filters.excludeGroups.length > 0 ||
    filters.scalers.length > 0 ||
    filters.excludeScalers.length > 0 ||
    filters.generator !== null ||
    filters.creators.length > 0 ||
    filters.excludeCreators.length > 0 ||
    filters.used !== null ||
    filters.pipelines.length > 0 ||
    filters.excludePipelines.length > 0;

  /**
   * Parse current input and update filters
   */
  const parseAndUpdateFilters = useCallback(
    (input: string) => {
      const tokens = parseInput(input);
      const freeText = extractFreeText(input);
      const newFilters = tokensToFilters(tokens, freeText);
      onChange(newFilters);
    },
    [parseInput, extractFreeText, tokensToFilters, onChange],
  );

  /**
   * Handle input change
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    setShowSuggestions(true);
    setSelectedSuggestionIndex(0);

    // Real-time filter updates
    parseAndUpdateFilters(value);
  };

  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (showSuggestions && suggestions.length > 0) {
          setSelectedSuggestionIndex((prev) => (prev + 1) % suggestions.length);
        } else {
          setShowSuggestions(true);
        }
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (showSuggestions && suggestions.length > 0) {
          setSelectedSuggestionIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        }
        break;

      case 'Tab':
        if (showSuggestions && suggestions.length > 0 && suggestions[selectedSuggestionIndex]) {
          e.preventDefault();
          handleSelectSuggestion(suggestions[selectedSuggestionIndex]);
        }
        break;

      case 'Enter':
        e.preventDefault();
        if (showSuggestions && suggestions.length > 0 && suggestions[selectedSuggestionIndex]) {
          // If suggestions are visible and one is selected, apply it
          handleSelectSuggestion(suggestions[selectedSuggestionIndex]);
        } else {
          // Otherwise, submit the current filters
          setShowSuggestions(false);
          onSubmit(filters, filtersToQueryString(filters));
        }
        break;

      case 'Escape':
        setShowSuggestions(false);
        break;

      case 'Backspace':
        // If input is empty and we have filters, remove the last one
        if (inputValue === '' && hasActiveFilters) {
          e.preventDefault();
          removeLastFilter();
        }
        break;
    }
  };

  /**
   * Handle suggestion selection
   */
  const handleSelectSuggestion = (suggestion: Suggestion) => {
    const cursorPos = inputRef.current?.selectionStart || inputValue.length;
    const newInput = applySuggestion(inputValue, cursorPos, suggestion);
    setInputValue(newInput);
    setShowSuggestions(suggestion.type === 'key'); // Keep open for value input after key
    setSelectedSuggestionIndex(0);

    // Parse and update filters
    parseAndUpdateFilters(newInput);

    // Focus input and move cursor to end
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.selectionStart = newInput.length;
        inputRef.current.selectionEnd = newInput.length;
      }
    }, 0);
  };

  /**
   * Remove a specific filter
   */
  const removeFilter = (
    type: 'group' | 'scaler' | 'generator' | 'search' | 'creator' | 'used' | 'pipeline',
    value: string,
    negated?: boolean,
  ) => {
    const newFilters = { ...filters };

    switch (type) {
      case 'group':
        if (negated) {
          newFilters.excludeGroups = filters.excludeGroups.filter((g) => g !== value);
        } else {
          newFilters.groups = filters.groups.filter((g) => g !== value);
        }
        break;
      case 'scaler':
        if (negated) {
          newFilters.excludeScalers = filters.excludeScalers.filter((s) => s !== value);
        } else {
          newFilters.scalers = filters.scalers.filter((s) => s !== value);
        }
        break;
      case 'generator':
        newFilters.generator = null;
        break;
      case 'creator':
        if (negated) {
          newFilters.excludeCreators = filters.excludeCreators.filter((c) => c !== value);
        } else {
          newFilters.creators = filters.creators.filter((c) => c !== value);
        }
        break;
      case 'used':
        newFilters.used = null;
        break;
      case 'pipeline':
        if (negated) {
          newFilters.excludePipelines = filters.excludePipelines.filter((p) => p !== value);
        } else {
          newFilters.pipelines = filters.pipelines.filter((p) => p !== value);
        }
        break;
      case 'search':
        newFilters.search = '';
        break;
    }

    onChange(newFilters);
  };

  /**
   * Remove the last applied filter
   */
  const removeLastFilter = () => {
    const newFilters = { ...filters };

    // Priority: search, then booleans, then arrays in reverse order of addition
    if (filters.search) {
      newFilters.search = '';
    } else if (filters.used !== null) {
      newFilters.used = null;
    } else if (filters.generator !== null) {
      newFilters.generator = null;
    } else if (filters.excludePipelines.length > 0) {
      newFilters.excludePipelines = filters.excludePipelines.slice(0, -1);
    } else if (filters.pipelines.length > 0) {
      newFilters.pipelines = filters.pipelines.slice(0, -1);
    } else if (filters.excludeCreators.length > 0) {
      newFilters.excludeCreators = filters.excludeCreators.slice(0, -1);
    } else if (filters.creators.length > 0) {
      newFilters.creators = filters.creators.slice(0, -1);
    } else if (filters.excludeScalers.length > 0) {
      newFilters.excludeScalers = filters.excludeScalers.slice(0, -1);
    } else if (filters.scalers.length > 0) {
      newFilters.scalers = filters.scalers.slice(0, -1);
    } else if (filters.excludeGroups.length > 0) {
      newFilters.excludeGroups = filters.excludeGroups.slice(0, -1);
    } else if (filters.groups.length > 0) {
      newFilters.groups = filters.groups.slice(0, -1);
    }

    onChange(newFilters);
  };

  /**
   * Clear all filters
   */
  const clearAll = () => {
    setInputValue('');
    onChange(DEFAULT_FILTER_STATE);
  };

  /**
   * Handle click on wrapper to focus input
   */
  const handleWrapperClick = () => {
    inputRef.current?.focus();
  };

  /**
   * Handle focus
   */
  const handleFocus = () => {
    setShowSuggestions(true);
  };

  /**
   * Handle blur
   */
  const handleBlur = () => {
    // Delay hiding suggestions to allow click events on suggestions
    setTimeout(() => {
      setShowSuggestions(false);
    }, 150);
  };

  return (
    <OmnibarContainer>
      <InputWrapper onClick={handleWrapperClick}>
        <SearchIcon>
          <FaSearch size={14} />
        </SearchIcon>

        <BadgesContainer>
          {/* Group badges */}
          {filters.groups.map((group) => (
            <OmnibarBadge key={`group-${group}`} type="group" value={group} onRemove={() => removeFilter('group', group)} />
          ))}
          {filters.excludeGroups.map((group) => (
            <OmnibarBadge
              key={`excl-group-${group}`}
              type="group"
              value={group}
              negated
              onRemove={() => removeFilter('group', group, true)}
            />
          ))}

          {/* Scaler badges */}
          {filters.scalers.map((scaler) => (
            <OmnibarBadge key={`scaler-${scaler}`} type="scaler" value={scaler} onRemove={() => removeFilter('scaler', scaler)} />
          ))}
          {filters.excludeScalers.map((scaler) => (
            <OmnibarBadge
              key={`excl-scaler-${scaler}`}
              type="scaler"
              value={scaler}
              negated
              onRemove={() => removeFilter('scaler', scaler, true)}
            />
          ))}

          {/* Generator badge */}
          {filters.generator !== null && (
            <OmnibarBadge type="generator" value="generator" negated={!filters.generator} onRemove={() => removeFilter('generator', '')} />
          )}

          {/* Creator badges */}
          {filters.creators.map((creator) => (
            <OmnibarBadge key={`creator-${creator}`} type="creator" value={creator} onRemove={() => removeFilter('creator', creator)} />
          ))}
          {filters.excludeCreators.map((creator) => (
            <OmnibarBadge
              key={`excl-creator-${creator}`}
              type="creator"
              value={creator}
              negated
              onRemove={() => removeFilter('creator', creator, true)}
            />
          ))}

          {/* Used/Orphan badge */}
          {filters.used !== null && (
            <OmnibarBadge type="used" value={filters.used ? 'used' : 'orphan'} onRemove={() => removeFilter('used', '')} />
          )}

          {/* Pipeline badges */}
          {filters.pipelines.map((pipeline) => (
            <OmnibarBadge
              key={`pipeline-${pipeline}`}
              type="pipeline"
              value={pipeline}
              onRemove={() => removeFilter('pipeline', pipeline)}
            />
          ))}
          {filters.excludePipelines.map((pipeline) => (
            <OmnibarBadge
              key={`excl-pipeline-${pipeline}`}
              type="pipeline"
              value={pipeline}
              negated
              onRemove={() => removeFilter('pipeline', pipeline, true)}
            />
          ))}

          {/* Search text badge - only show if there's search text but no pending input */}
          {filters.search && !inputValue && (
            <OmnibarBadge type="search" value={filters.search} onRemove={() => removeFilter('search', '')} />
          )}
        </BadgesContainer>

        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={hasActiveFilters ? '' : placeholder}
          aria-label="Filter images"
          autoComplete="off"
        />

        {(hasActiveFilters || inputValue) && (
          <ClearButton onClick={clearAll} aria-label="Clear all filters" type="button">
            <FaTimes size={14} />
          </ClearButton>
        )}
      </InputWrapper>

      <OmnibarSuggestions
        suggestions={suggestions}
        selectedIndex={selectedSuggestionIndex}
        onSelect={handleSelectSuggestion}
        visible={showSuggestions && suggestions.length > 0}
      />

      <HelpText>Type group:, scaler:, creator:, pipeline:, or is: for filters. Press Enter to apply and sync to URL.</HelpText>
    </OmnibarContainer>
  );
};

export default Omnibar;
export { Omnibar, filtersToQueryString, parseQueryString };
export type { FilterState, OmnibarProps };
