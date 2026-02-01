import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@utilities';
import Users from './browsing';
import { setMockCookie, clearMockCookie } from '../../test/setup';

function renderUsersPage() {
  return render(
    <MemoryRouter initialEntries={['/users']}>
      <AuthProvider>
        <Routes>
          <Route path="/users" element={<Users />} />
          <Route path="/auth" element={<div data-testid="login-page">Login</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('Users Browsing Page', () => {
  beforeEach(() => {
    clearMockCookie();
    setMockCookie('THORIUM_TOKEN', 'test-token');
  });

  describe('User Listing', () => {
    it('lists users with their roles displayed', async () => {
      renderUsersPage();

      await waitFor(() => {
        expect(screen.getByText('testuser')).toBeInTheDocument();
        expect(screen.getByText('admin')).toBeInTheDocument();
        expect(screen.getByText('analyst1')).toBeInTheDocument();
      });

      // Users can see role information displayed
      expect(screen.getByText('Admin')).toBeInTheDocument();
      expect(screen.getAllByText('User').length).toBeGreaterThanOrEqual(1);
    });

    it('lists users with their group memberships displayed', async () => {
      renderUsersPage();

      await waitFor(() => {
        expect(screen.getByText('testuser')).toBeInTheDocument();
      });

      // Check group badges are displayed
      const defaultBadges = screen.getAllByText('default');
      expect(defaultBadges.length).toBeGreaterThanOrEqual(1);
    });

    it('sorts users alphabetically by username', async () => {
      renderUsersPage();

      await waitFor(() => {
        expect(screen.getByText('admin')).toBeInTheDocument();
      });

      const userCards = screen.getAllByRole('heading', { level: 5 });
      const usernames = userCards.map((h) => h.textContent);
      const sortedUsernames = [...usernames].sort();
      expect(usernames).toEqual(sortedUsernames);
    });
  });

  describe('Role-Based Actions', () => {
    it('shows Role, Masquerade, and Delete buttons for each user', async () => {
      renderUsersPage();

      await waitFor(() => {
        expect(screen.getByText('testuser')).toBeInTheDocument();
      });

      // Each user should have these action buttons
      const roleButtons = screen.getAllByRole('button', { name: /role/i });
      const masqueradeButtons = screen.getAllByRole('button', { name: /masquerade/i });
      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });

      expect(roleButtons.length).toBe(3);
      expect(masqueradeButtons.length).toBe(3);
      expect(deleteButtons.length).toBe(3);
    });
  });

  describe('Edit Role Modal', () => {
    it('opens edit role modal when Role button is clicked', async () => {
      const user = userEvent.setup();
      renderUsersPage();

      await waitFor(() => {
        expect(screen.getByText('testuser')).toBeInTheDocument();
      });

      const roleButtons = screen.getAllByRole('button', { name: /^role$/i });
      await user.click(roleButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Edit Role')).toBeInTheDocument();
      });
    });

    it('edit role modal shows role dropdown with options', async () => {
      const user = userEvent.setup();
      renderUsersPage();

      await waitFor(() => {
        expect(screen.getByText('testuser')).toBeInTheDocument();
      });

      const roleButtons = screen.getAllByRole('button', { name: /^role$/i });
      await user.click(roleButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();

      // Check options
      const options = within(select).getAllByRole('option');
      const optionValues = options.map((o) => o.textContent);
      expect(optionValues).toContain('Admin');
      expect(optionValues).toContain('Analyst');
      expect(optionValues).toContain('Developer');
      expect(optionValues).toContain('User');
    });

    it('clicking Update saves the new role', async () => {
      const user = userEvent.setup();
      renderUsersPage();

      await waitFor(() => {
        expect(screen.getByText('testuser')).toBeInTheDocument();
      });

      // Click role button for testuser (third in sorted list after admin and analyst1)
      const roleButtons = screen.getAllByRole('button', { name: /^role$/i });
      await user.click(roleButtons[2]); // testuser is third when sorted

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // testuser is "User" role, change to Analyst (different from current)
      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'Analyst');

      // Button should be enabled now
      const updateButton = screen.getByRole('button', { name: /update/i });
      expect(updateButton).not.toBeDisabled();
      await user.click(updateButton);

      // Modal should close on success
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('Delete User', () => {
    it('shows confirmation modal when Delete button is clicked', async () => {
      const user = userEvent.setup();
      renderUsersPage();

      await waitFor(() => {
        expect(screen.getByText('testuser')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Confirm deletion?')).toBeInTheDocument();
      });
    });

    it('delete confirmation modal mentions the username being deleted', async () => {
      const user = userEvent.setup();
      renderUsersPage();

      await waitFor(() => {
        expect(screen.getByText('admin')).toBeInTheDocument();
      });

      // Find delete button for admin user (sorted: admin is first)
      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // The modal body contains the username in a <b> tag
      const modal = screen.getByRole('dialog');
      const boldElements = modal.querySelectorAll('b');
      const hasUsername = Array.from(boldElements).some((el) => el.textContent === 'admin');
      expect(hasUsername).toBe(true);
    });
  });

  describe('Masquerade', () => {
    it('shows confirmation modal when Masquerade button is clicked', async () => {
      const user = userEvent.setup();
      renderUsersPage();

      await waitFor(() => {
        expect(screen.getByText('testuser')).toBeInTheDocument();
      });

      const masqueradeButtons = screen.getAllByRole('button', { name: /masquerade/i });
      await user.click(masqueradeButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText(/Masquerade as/)).toBeInTheDocument();
      });
    });

    it('masquerade confirmation modal has Confirm button', async () => {
      const user = userEvent.setup();
      renderUsersPage();

      await waitFor(() => {
        expect(screen.getByText('testuser')).toBeInTheDocument();
      });

      const masqueradeButtons = screen.getAllByRole('button', { name: /masquerade/i });
      await user.click(masqueradeButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const confirmButton = within(screen.getByRole('dialog')).getByRole('button', { name: /confirm/i });
      expect(confirmButton).toBeInTheDocument();
    });
  });
});
