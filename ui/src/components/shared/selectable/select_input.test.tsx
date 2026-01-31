import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SelectInput from './select_input';

describe('SelectInput', () => {
  it('renders combobox element', () => {
    const onChange = vi.fn();

    render(<SelectInput onChange={onChange} disabled={false} />);

    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('renders with initial value', async () => {
    const onChange = vi.fn();

    render(<SelectInput onChange={onChange} disabled={false} value="Initial Value" />);

    // The value should be displayed in the single value container
    await waitFor(() => {
      expect(screen.getByText('Initial Value')).toBeInTheDocument();
    });
  });

  it('renders with options and can select one', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<SelectInput onChange={onChange} disabled={false} options={['Option A', 'Option B', 'Option C']} />);

    // Click to open the dropdown
    const input = screen.getByRole('combobox');
    await user.click(input);

    await waitFor(() => {
      expect(screen.getByText('Option A')).toBeInTheDocument();
      expect(screen.getByText('Option B')).toBeInTheDocument();
      expect(screen.getByText('Option C')).toBeInTheDocument();
    });
  });

  it('calls onChange when option is selected', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<SelectInput onChange={onChange} disabled={false} options={['Option A', 'Option B']} />);

    const input = screen.getByRole('combobox');
    await user.click(input);

    await waitFor(() => {
      expect(screen.getByText('Option A')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Option A'));

    expect(onChange).toHaveBeenCalledWith('Option A');
  });

  it('is disabled when disabled prop is true', () => {
    const onChange = vi.fn();

    const { container } = render(<SelectInput onChange={onChange} disabled={true} />);

    // When disabled, react-select sets aria-disabled on the control container
    const control = container.querySelector('[aria-disabled="true"]');
    expect(control).toBeInTheDocument();

    // The input itself should be disabled
    const input = container.querySelector('input');
    expect(input).toBeDisabled();
  });

  it('calls onCreate when new option is created', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onCreate = vi.fn();

    render(<SelectInput onChange={onChange} onCreate={onCreate} disabled={false} options={['Existing']} />);

    const input = screen.getByRole('combobox');
    await user.click(input);
    await user.type(input, 'New Option');

    // Press Enter to create the new option
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith('New Option');
      expect(onChange).toHaveBeenCalledWith('New Option');
    });
  });

  it('renders with provided className', () => {
    const onChange = vi.fn();

    const { container } = render(<SelectInput onChange={onChange} disabled={false} className="custom-class" />);

    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });
});
