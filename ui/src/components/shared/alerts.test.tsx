import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RenderErrorAlert, AlertBanner } from './alerts';

describe('RenderErrorAlert', () => {
  it('renders default error message when no message provided', () => {
    render(<RenderErrorAlert />);

    expect(
      screen.getByText(/An error occurred while rendering/),
    ).toBeInTheDocument();
  });

  it('renders custom error message when provided', () => {
    const customMessage = 'Something went wrong!';
    render(<RenderErrorAlert message={customMessage} />);

    expect(screen.getByText(customMessage)).toBeInTheDocument();
  });

  it('renders page-level alert by default', () => {
    const { container } = render(<RenderErrorAlert />);

    // Page alert has specific margin styling via styled-component
    const alert = container.querySelector('[role="alert"]');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveClass('alert-danger');
  });

  it('renders component-level alert when page is false', () => {
    const { container } = render(<RenderErrorAlert page={false} />);

    const alert = container.querySelector('[role="alert"]');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveClass('alert-danger');
  });

  it('renders message inside pre tag', () => {
    render(<RenderErrorAlert message="Error details" />);

    const preElement = screen.getByText('Error details');
    expect(preElement.tagName).toBe('PRE');
  });
});

describe('AlertBanner', () => {
  it('renders error status message', () => {
    render(
      <AlertBanner prefix="" errorStatus="Network Error" variant="danger" />,
    );

    expect(screen.getByText('Network Error')).toBeInTheDocument();
  });

  it('renders prefix with error status', () => {
    render(
      <AlertBanner
        prefix="API Error"
        errorStatus="Connection failed"
        variant="danger"
      />,
    );

    expect(screen.getByText('API Error: Connection failed')).toBeInTheDocument();
  });

  it('renders with danger variant class', () => {
    const { container } = render(
      <AlertBanner prefix="" errorStatus="Error" variant="danger" />,
    );

    const alert = container.querySelector('[role="alert"]');
    expect(alert).toHaveClass('alert-danger');
  });

  it('renders with warning variant class', () => {
    const { container } = render(
      <AlertBanner prefix="" errorStatus="Warning" variant="warning" />,
    );

    const alert = container.querySelector('[role="alert"]');
    expect(alert).toHaveClass('alert-warning');
  });

  it('renders with info variant class', () => {
    const { container } = render(
      <AlertBanner prefix="" errorStatus="Info message" variant="info" />,
    );

    const alert = container.querySelector('[role="alert"]');
    expect(alert).toHaveClass('alert-info');
  });

  it('is visible when initially rendered', () => {
    render(
      <AlertBanner prefix="" errorStatus="Visible alert" variant="info" />,
    );

    expect(screen.getByText('Visible alert')).toBeVisible();
  });
});
