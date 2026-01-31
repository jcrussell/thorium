import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { getStatusBadge, getStatusIcon } from './reactions';

describe('reaction status utilities', () => {
  describe('getStatusBadge', () => {
    it.each([
      ['Completed', 'bg-success'],
      ['Failed', 'bg-danger'],
      ['Errored', 'bg-danger'],
      ['Running', 'bg-primary'],
      ['Created', 'bg-secondary'],
      ['Unknown', 'bg-secondary'],
    ])('renders %s status with %s styling', (status, expectedClass) => {
      const { container } = render(getStatusBadge(status));
      expect(container.querySelector('.badge')).toHaveClass(expectedClass);
    });
  });

  describe('getStatusIcon', () => {
    it.each([
      ['Completed', 'green'],
      ['Failed', 'red'],
      ['Running', 'blue'],
      ['Created', 'lightBlue'],
      ['Unknown', 'grey'],
    ])('renders %s icon in %s', (status, color) => {
      const { container } = render(getStatusIcon(status));
      expect(container.querySelector('svg')).toHaveAttribute('color', color);
    });
  });
});
