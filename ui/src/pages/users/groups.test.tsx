import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/mocks/server';
import { AuthProvider } from '@utilities';
import Groups from './groups';
import { setMockCookie, clearMockCookie } from '../../test/setup';
import { createAdminUser } from '../../test/utils/factories';

function renderGroupsPage() {
  return render(
    <MemoryRouter initialEntries={['/groups']}>
      <AuthProvider>
        <Routes>
          <Route path="/groups" element={<Groups />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('Groups Management Page', () => {
  beforeEach(() => {
    clearMockCookie();
    setMockCookie('THORIUM_TOKEN', 'test-token');

    // Set up mock for admin user to enable all group management features
    server.use(
      http.get('**/users/whoami', () => {
        return HttpResponse.json(createAdminUser({ groups: ['default'] }));
      }),
    );
  });

  describe('Group Listing', () => {
    it('lists groups user belongs to in accordion format', async () => {
      renderGroupsPage();

      await waitFor(() => {
        expect(screen.getByText('default')).toBeInTheDocument();
        expect(screen.getByText('test-group')).toBeInTheDocument();
      });
    });

    it('displays group count badge', async () => {
      renderGroupsPage();

      await waitFor(() => {
        expect(screen.getByText('default')).toBeInTheDocument();
      });

      // Badge shows count of groups (2 in our mock)
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('shows member count for each group', async () => {
      renderGroupsPage();

      await waitFor(() => {
        expect(screen.getByText('default')).toBeInTheDocument();
      });

      // Each group should show member count
      const memberTexts = screen.getAllByText(/Member/);
      expect(memberTexts.length).toBeGreaterThanOrEqual(1);
    });

    it('shows role badges for each group', async () => {
      renderGroupsPage();

      await waitFor(() => {
        expect(screen.getByText('default')).toBeInTheDocument();
      });

      // Admin user should see Owner badge since they own the group
      expect(screen.getAllByText('Owner').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Group Details', () => {
    it('displays membership sections when group accordion is expanded', async () => {
      const user = userEvent.setup();
      renderGroupsPage();

      await waitFor(() => {
        expect(screen.getByText('default')).toBeInTheDocument();
      });

      // Find and click the accordion button for the first group
      const accordionButtons = screen.getAllByRole('button');
      const groupButton = accordionButtons.find((btn) => btn.textContent?.includes('default'));
      if (groupButton) {
        await user.click(groupButton);
      }

      await waitFor(() => {
        // Should show role labels (these appear in the expanded accordion body)
        // Use getAllBy since multiple groups may be expanded
        expect(screen.getAllByText('Description').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('shows group description when accordion is expanded', async () => {
      const user = userEvent.setup();
      renderGroupsPage();

      await waitFor(() => {
        expect(screen.getByText('default')).toBeInTheDocument();
      });

      // Click the accordion button
      const accordionButtons = screen.getAllByRole('button');
      const groupButton = accordionButtons.find((btn) => btn.textContent?.includes('default'));
      if (groupButton) {
        await user.click(groupButton);
      }

      await waitFor(() => {
        // The description from our mock data should appear
        expect(screen.getAllByText('Default test group').length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('Group Management Buttons', () => {
    it('shows Update and Delete buttons for admin users', async () => {
      const user = userEvent.setup();
      renderGroupsPage();

      await waitFor(() => {
        expect(screen.getByText('default')).toBeInTheDocument();
      });

      // Click accordion to expand
      const accordionButtons = screen.getAllByRole('button');
      const groupButton = accordionButtons.find((btn) => btn.textContent?.includes('default'));
      if (groupButton) {
        await user.click(groupButton);
      }

      await waitFor(() => {
        // Multiple Update/Delete buttons may appear (one per group since alwaysOpen)
        expect(screen.getAllByRole('button', { name: /update/i }).length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByRole('button', { name: /delete/i }).length).toBeGreaterThanOrEqual(1);
      });
    });

    it('delete button shows confirmation modal', async () => {
      const user = userEvent.setup();
      renderGroupsPage();

      await waitFor(() => {
        expect(screen.getByText('default')).toBeInTheDocument();
      });

      // Click accordion to expand
      const accordionButtons = screen.getAllByRole('button');
      const groupButton = accordionButtons.find((btn) => btn.textContent?.includes('default'));
      if (groupButton) {
        await user.click(groupButton);
      }

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /delete/i }).length).toBeGreaterThanOrEqual(1);
      });

      // Get the first delete button
      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Confirm deletion?')).toBeInTheDocument();
      });
    });
  });

  describe('Create Group', () => {
    it('shows create group button', async () => {
      renderGroupsPage();

      await waitFor(() => {
        expect(screen.getByText('Groups')).toBeInTheDocument();
      });

      // The + button should be present
      const buttons = screen.getAllByRole('button');
      const createButton = buttons.find((btn) => btn.textContent === '+');
      expect(createButton).toBeInTheDocument();
    });
  });
});
