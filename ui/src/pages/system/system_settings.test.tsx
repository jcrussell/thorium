import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/mocks/server';
import { AuthProvider } from '@utilities';
import SystemSettings from './system_settings';
import { setMockCookie, clearMockCookie } from '../../test/setup';

function renderSystemSettingsPage() {
  return render(
    <MemoryRouter initialEntries={['/system/settings']}>
      <AuthProvider>
        <Routes>
          <Route path="/system/settings" element={<SystemSettings />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('System Settings Page', () => {
  beforeEach(() => {
    clearMockCookie();
    setMockCookie('THORIUM_TOKEN', 'test-token');
  });

  describe('Settings Display', () => {
    it('displays system settings title', async () => {
      renderSystemSettingsPage();

      await waitFor(() => {
        expect(screen.getByText('System Settings')).toBeInTheDocument();
      });
    });

    it('displays settings in a table', async () => {
      renderSystemSettingsPage();

      await waitFor(() => {
        expect(screen.getByText('System Settings')).toBeInTheDocument();
      });

      // Settings from our mock should be displayed
      expect(screen.getByText('version')).toBeInTheDocument();
      expect(screen.getByText('1.0.0')).toBeInTheDocument();
      expect(screen.getByText('environment')).toBeInTheDocument();
      expect(screen.getByText('test')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('shows error alert when API fails', async () => {
      server.use(
        http.get('**/system/settings', () => {
          return new HttpResponse(JSON.stringify({ error: 'Server error' }), {
            status: 500,
          });
        }),
      );

      renderSystemSettingsPage();

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });
  });
});
