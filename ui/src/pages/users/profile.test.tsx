import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/mocks/server';
import { AuthProvider } from '@utilities';
import ProfileContainer from './profile';
import { setMockCookie, clearMockCookie } from '../../test/setup';
import { createUserInfo, createAdminUser } from '../../test/utils/factories';

function renderProfilePage() {
  return render(
    <MemoryRouter initialEntries={['/profile']}>
      <AuthProvider>
        <Routes>
          <Route path="/profile" element={<ProfileContainer />} />
          <Route path="/" element={<div data-testid="home">Home</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('User Profile Page', () => {
  beforeEach(() => {
    clearMockCookie();
    setMockCookie('THORIUM_TOKEN', 'test-token');
  });

  describe('Profile Display', () => {
    it('displays username', async () => {
      renderProfilePage();

      await waitFor(() => {
        expect(screen.getByText('testuser')).toBeInTheDocument();
      });
    });

    it('displays user groups as badges', async () => {
      server.use(
        http.get('**/users/whoami', () => {
          return HttpResponse.json(createUserInfo({ groups: ['default', 'security'] }));
        }),
      );

      renderProfilePage();

      await waitFor(() => {
        expect(screen.getByText('default')).toBeInTheDocument();
        expect(screen.getByText('security')).toBeInTheDocument();
      });
    });

    it('displays user role badge', async () => {
      server.use(
        http.get('**/users/whoami', () => {
          return HttpResponse.json(createAdminUser());
        }),
      );

      renderProfilePage();

      await waitFor(() => {
        expect(screen.getByText('Admin')).toBeInTheDocument();
      });
    });

    it('displays avatar component', async () => {
      renderProfilePage();

      await waitFor(() => {
        expect(screen.getByText('testuser')).toBeInTheDocument();
      });

      // Avatar should be rendered
      expect(document.querySelector('.MuiAvatar-root')).toBeInTheDocument();
    });
  });

  describe('Token Show/Hide', () => {
    it('shows token as hidden by default', async () => {
      renderProfilePage();

      await waitFor(() => {
        expect(screen.getByText('testuser')).toBeInTheDocument();
      });

      // Token should be hidden (asterisks)
      expect(screen.getByText(/\*{10,}/)).toBeInTheDocument();
    });

    it('shows Show button to reveal token', async () => {
      renderProfilePage();

      await waitFor(() => {
        expect(screen.getByText('testuser')).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /show/i })).toBeInTheDocument();
    });

    it('clicking Show reveals token and changes button to Hide', async () => {
      const user = userEvent.setup();
      renderProfilePage();

      await waitFor(() => {
        expect(screen.getByText('testuser')).toBeInTheDocument();
      });

      const showButton = screen.getByRole('button', { name: /show/i });
      await user.click(showButton);

      await waitFor(() => {
        // Token should now be visible
        expect(screen.getByText('test-token-123')).toBeInTheDocument();
        // Button should now say Hide
        expect(screen.getByRole('button', { name: /hide/i })).toBeInTheDocument();
      });
    });
  });

  describe('Revoke Token', () => {
    it('shows Revoke button', async () => {
      renderProfilePage();

      await waitFor(() => {
        expect(screen.getByText('testuser')).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /revoke/i })).toBeInTheDocument();
    });

    it('clicking Revoke shows confirmation modal', async () => {
      const user = userEvent.setup();
      renderProfilePage();

      await waitFor(() => {
        expect(screen.getByText('testuser')).toBeInTheDocument();
      });

      const revokeButton = screen.getByRole('button', { name: /revoke/i });
      await user.click(revokeButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Revoke Your Token?')).toBeInTheDocument();
      });
    });
  });

  describe('Theme Selector', () => {
    it('displays theme dropdown', async () => {
      renderProfilePage();

      await waitFor(() => {
        expect(screen.getByText('testuser')).toBeInTheDocument();
      });

      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('theme dropdown has Dark, Light, Ocean, and Automatic options', async () => {
      renderProfilePage();

      await waitFor(() => {
        expect(screen.getByText('testuser')).toBeInTheDocument();
      });

      const select = screen.getByRole('combobox');
      const options = select.querySelectorAll('option');
      const optionValues = Array.from(options).map((o) => o.textContent);

      expect(optionValues).toContain('Dark');
      expect(optionValues).toContain('Light');
      expect(optionValues).toContain('Ocean');
      expect(optionValues).toContain('Automatic');
    });

    it('shows current theme as selected', async () => {
      renderProfilePage();

      await waitFor(() => {
        expect(screen.getByText('testuser')).toBeInTheDocument();
      });

      const select = screen.getByRole('combobox');
      expect((select as HTMLSelectElement).value).toBe('Light'); // From our mock user
    });
  });
});
