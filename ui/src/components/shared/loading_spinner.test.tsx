import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoadingSpinner } from './loading_spinner';

describe('LoadingSpinner', () => {
  it('renders spinner element', () => {
    const { container } = render(<LoadingSpinner loading={true} />);

    // The Spinner component from react-bootstrap
    const spinner = container.querySelector('.spinner-border');
    expect(spinner).toBeInTheDocument();
  });

  it('hides container when loading is false', () => {
    const { container } = render(<LoadingSpinner loading={false} />);

    // The container should have hidden attribute
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveAttribute('hidden');
  });

  it('shows container when loading is true', () => {
    const { container } = render(<LoadingSpinner loading={true} />);

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).not.toHaveAttribute('hidden');
  });

  it('has loading class on spinner', () => {
    const { container } = render(<LoadingSpinner loading={true} />);

    const spinner = container.querySelector('.loading');
    expect(spinner).toBeInTheDocument();
  });

  it('renders with border animation', () => {
    const { container } = render(<LoadingSpinner loading={true} />);

    const spinner = container.querySelector('.spinner-border');
    expect(spinner).toBeInTheDocument();
  });
});
