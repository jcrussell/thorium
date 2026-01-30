import React, { useRef, useEffect } from 'react';
import styled from 'styled-components';
import { OmnibarSuggestionsProps } from './types';

const DropdownContainer = styled.div<{ $visible: boolean }>`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 1000;
  display: ${(props) => (props.$visible ? 'block' : 'none')};
  background-color: var(--thorium-panel-bg);
  border: 1px solid var(--thorium-panel-border);
  border-top: none;
  border-radius: 0 0 4px 4px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  max-height: 200px;
  overflow-y: auto;
`;

const SuggestionItem = styled.div<{ $selected: boolean; $type: 'key' | 'value' }>`
  padding: 8px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: ${(props) => (props.$selected ? 'var(--thorium-highlight-panel-bg)' : 'transparent')};
  color: var(--thorium-text);
  border-left: 3px solid ${(props) => (props.$selected ? 'var(--thorium-info-secondary-bg)' : 'transparent')};

  &:hover {
    background-color: var(--thorium-highlight-panel-bg);
  }
`;

const SuggestionLabel = styled.span`
  flex: 1;
`;

const SuggestionType = styled.span`
  font-size: 0.75rem;
  color: var(--thorium-secondary-text);
  text-transform: uppercase;
`;

const KeyIcon = styled.span`
  color: var(--thorium-info-secondary-bg);
  font-weight: 600;
`;

const EmptyState = styled.div`
  padding: 12px;
  text-align: center;
  color: var(--thorium-secondary-text);
  font-size: 0.9rem;
`;

/**
 * Suggestions dropdown component
 */
const OmnibarSuggestions: React.FC<OmnibarSuggestionsProps> = ({ suggestions, selectedIndex, onSelect, visible }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLDivElement>(null);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedRef.current && containerRef.current) {
      const container = containerRef.current;
      const selected = selectedRef.current;
      const containerRect = container.getBoundingClientRect();
      const selectedRect = selected.getBoundingClientRect();

      if (selectedRect.bottom > containerRect.bottom) {
        selected.scrollIntoView({ block: 'nearest' });
      } else if (selectedRect.top < containerRect.top) {
        selected.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!visible) {
    return null;
  }

  if (suggestions.length === 0) {
    return (
      <DropdownContainer $visible={visible} ref={containerRef}>
        <EmptyState>No suggestions</EmptyState>
      </DropdownContainer>
    );
  }

  return (
    <DropdownContainer $visible={visible} ref={containerRef}>
      {suggestions.map((suggestion, index) => (
        <SuggestionItem
          key={`${suggestion.value}-${index}`}
          $selected={index === selectedIndex}
          $type={suggestion.type}
          ref={index === selectedIndex ? selectedRef : undefined}
          onClick={() => onSelect(suggestion)}
          onMouseDown={(e) => e.preventDefault()} // Prevent input blur
        >
          {suggestion.type === 'key' && <KeyIcon>:</KeyIcon>}
          <SuggestionLabel>{suggestion.display}</SuggestionLabel>
          <SuggestionType>{suggestion.type === 'key' ? 'filter' : suggestion.key}</SuggestionType>
        </SuggestionItem>
      ))}
    </DropdownContainer>
  );
};

export default OmnibarSuggestions;
