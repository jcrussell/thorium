import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Search } from './search';
import { setMockCookie } from '../../test/setup';
import { createUserInfo } from '../../test/utils/factories';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@utilities';

vi.mock('@utilities', async () => {
  const actual = await vi.importActual('@utilities');
  return {
    ...actual,
    useAuth: () => ({
      userInfo: createUserInfo({ groups: ['default'] }),
      checkCookie: vi.fn(),
      setUserInfo: vi.fn(),
    }),
  };
});

// Only mock components that would make external calls
vi.mock('@components', async () => {
  const actual = await vi.importActual('@components');
  return {
    ...actual,
    BrowsingFilters: ({ disabled }: { disabled: boolean }) => (
      <div data-testid="filters">{disabled ? 'disabled' : 'enabled'}</div>
    ),
    EntityList: () => <div data-testid="results">Results</div>,
  };
});

function renderSearch() {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <Search />
      </AuthProvider>
    </BrowserRouter>,
  );
}

describe('Search', () => {
  beforeEach(() => {
    setMockCookie('THORIUM_TOKEN', 'test-token');
  });

  it('renders search input', () => {
    renderSearch();
    expect(screen.getByPlaceholderText('Search data in Thorium')).toBeInTheDocument();
  });

  it('accepts user input', async () => {
    const user = userEvent.setup();
    renderSearch();

    const input = screen.getByPlaceholderText('Search data in Thorium');
    await user.type(input, 'malware');

    expect(input).toHaveValue('malware');
  });

  it('shows results after entering query', async () => {
    const user = userEvent.setup();
    renderSearch();

    await user.type(screen.getByPlaceholderText('Search data in Thorium'), 'test');

    await waitFor(() => {
      expect(screen.getByTestId('results')).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('does not submit form on enter', async () => {
    const user = userEvent.setup();
    renderSearch();

    const input = screen.getByPlaceholderText('Search data in Thorium');
    await user.type(input, 'test{enter}');

    expect(input).toHaveValue('test');
  });
});
