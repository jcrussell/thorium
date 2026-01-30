import React from 'react';
import styled from 'styled-components';
import { FaTimes } from 'react-icons/fa';
import { OmnibarBadgeProps } from './types';

/**
 * Color mapping for badge types
 * - group: purple (matches existing group badge color)
 * - scaler: grey
 * - generator: blue
 * - creator: dark blue
 * - used: amber/orange (is:used / is:orphan)
 * - pipeline: teal
 * - search: green
 */
const getBadgeColors = (type: string, negated?: boolean) => {
  const colors: Record<string, { bg: string; hoverBg: string }> = {
    group: { bg: '#6a00db', hoverBg: '#5a00bb' },
    scaler: { bg: '#7e7c7c', hoverBg: '#6e6c6c' },
    generator: { bg: '#305ef2', hoverBg: '#2050d2' },
    creator: { bg: '#003359', hoverBg: '#002849' },
    used: { bg: '#e5913d', hoverBg: '#d5812d' },
    pipeline: { bg: '#008e74', hoverBg: '#007e64' },
    search: { bg: '#297b29', hoverBg: '#1f6b1f' },
  };

  const baseColors = colors[type] || colors.search;

  // Negated badges get a striped pattern or different style
  if (negated) {
    return {
      bg: baseColors.bg,
      hoverBg: baseColors.hoverBg,
      border: '2px dashed rgba(255, 255, 255, 0.5)',
    };
  }

  return {
    ...baseColors,
    border: 'none',
  };
};

const BadgeContainer = styled.span<{ $type: string; $negated?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  margin: 2px 4px 2px 0;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 500;
  color: white;
  background-color: ${(props) => getBadgeColors(props.$type, props.$negated).bg};
  border: ${(props) => getBadgeColors(props.$type, props.$negated).border};
  white-space: nowrap;
  user-select: none;

  &:hover {
    background-color: ${(props) => getBadgeColors(props.$type, props.$negated).hoverBg};
  }
`;

const RemoveButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  padding: 0;
  margin-left: 2px;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.8);
  line-height: 1;

  &:hover {
    color: white;
  }

  &:focus {
    outline: none;
  }
`;

const NegationPrefix = styled.span`
  opacity: 0.7;
  font-weight: 400;
`;

/**
 * Removable badge component for active filters
 */
const OmnibarBadge: React.FC<OmnibarBadgeProps> = ({ type, value, negated = false, onRemove }) => {
  // Format the display label
  const getLabel = () => {
    const prefix = type !== 'search' ? `${type}:` : '';
    return `${prefix}${value}`;
  };

  return (
    <BadgeContainer $type={type} $negated={negated}>
      {negated && <NegationPrefix>-</NegationPrefix>}
      {getLabel()}
      <RemoveButton onClick={onRemove} aria-label={`Remove ${type} filter: ${value}`} type="button">
        <FaTimes size={10} />
      </RemoveButton>
    </BadgeContainer>
  );
};

export default OmnibarBadge;
