import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/mocks/server';
import { AuthProvider } from '@utilities';
import SystemStats from './system_stats';
import { setMockCookie, clearMockCookie } from '../../test/setup';

function renderSystemStatsPage() {
  return render(
    <MemoryRouter initialEntries={['/system/stats']}>
      <AuthProvider>
        <Routes>
          <Route path="/system/stats" element={<SystemStats />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('System Stats Page', () => {
  beforeEach(() => {
    clearMockCookie();
    setMockCookie('THORIUM_TOKEN', 'test-token');
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Stats Display', () => {
    it('displays global system stats', async () => {
      renderSystemStatsPage();

      await waitFor(() => {
        expect(screen.getByText('System')).toBeInTheDocument();
      });

      // Should display deadlines, running, and users counts
      expect(screen.getAllByText('Deadlines').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Running').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Users')).toBeInTheDocument();

      // Check the actual stat values from our mock (use getAllByText since values may appear in multiple tables)
      expect(screen.getAllByText('10').length).toBeGreaterThanOrEqual(1); // deadlines
      expect(screen.getAllByText('5').length).toBeGreaterThanOrEqual(1); // users
    });

    it('displays scaler stats for k8s, baremetal, and external', async () => {
      renderSystemStatsPage();

      await waitFor(() => {
        expect(screen.getByText('Scaler')).toBeInTheDocument();
      });

      expect(screen.getByText('k8s')).toBeInTheDocument();
      expect(screen.getByText('baremetal')).toBeInTheDocument();
      expect(screen.getByText('external')).toBeInTheDocument();
    });

    it('displays pipeline stats table', async () => {
      renderSystemStatsPage();

      await waitFor(() => {
        expect(screen.getByText('Pipeline')).toBeInTheDocument();
      });

      // Pipeline stats table should show column headers
      expect(screen.getByText('Group')).toBeInTheDocument();
      expect(screen.getByText('Stage Name')).toBeInTheDocument();
      expect(screen.getByText('Stage')).toBeInTheDocument();
      expect(screen.getByText('User')).toBeInTheDocument();
    });
  });

  describe('Search and Sort', () => {
    it('displays search input for filtering stats', async () => {
      renderSystemStatsPage();

      await waitFor(() => {
        expect(screen.getByText('Pipeline')).toBeInTheDocument();
      });

      // User can see a search input to filter the table
      expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
    });

    it('displays sortable column headers', async () => {
      renderSystemStatsPage();

      await waitFor(() => {
        expect(screen.getByText('Pipeline')).toBeInTheDocument();
      });

      // User can see column headers for sorting
      expect(screen.getByText('Group')).toBeInTheDocument();
      expect(screen.getByText('Created')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
      expect(screen.getByText('Failed')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('shows error alert when API fails', async () => {
      server.use(
        http.get('**/system/stats', () => {
          return new HttpResponse(JSON.stringify({ error: 'Server error' }), {
            status: 500,
          });
        }),
      );

      renderSystemStatsPage();

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });
  });
});
