import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mocks/server';
import { AuthProvider } from '@utilities';
import LoginContainer from './login';
import { clearMockCookie } from '../test/setup';

function renderLoginPage(initialRoute = '/auth') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <AuthProvider>
        <Routes>
          <Route path="/auth" element={<LoginContainer />} />
          <Route path="/" element={<div data-testid="dashboard">Dashboard</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('Login Page', () => {
  beforeEach(() => {
    clearMockCookie();
  });

  describe('Login Flow', () => {
    it('user can enter credentials and click Login to navigate to dashboard', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      const usernameInput = screen.getByPlaceholderText('username');
      const passwordInput = screen.getByPlaceholderText('password');
      const loginButton = screen.getByRole('button', { name: /login/i });

      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, 'password123');
      await user.click(loginButton);

      await waitFor(() => {
        expect(screen.getByTestId('dashboard')).toBeInTheDocument();
      });
    });

    it('user can press Enter to submit login form', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      const usernameInput = screen.getByPlaceholderText('username');
      const passwordInput = screen.getByPlaceholderText('password');

      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, 'password123');
      // Component uses deprecated keyCode, so we use fireEvent with explicit keyCode
      fireEvent.keyDown(passwordInput, { key: 'Enter', keyCode: 13 });

      await waitFor(() => {
        expect(screen.getByTestId('dashboard')).toBeInTheDocument();
      });
    });

    it('failed login shows error message to user', async () => {
      server.use(
        http.post('**/users/auth', () => {
          return new HttpResponse(JSON.stringify({ message: 'Invalid credentials' }), {
            status: 401,
          });
        }),
      );

      const user = userEvent.setup();
      renderLoginPage();

      const usernameInput = screen.getByPlaceholderText('username');
      const passwordInput = screen.getByPlaceholderText('password');
      const loginButton = screen.getByRole('button', { name: /login/i });

      await user.type(usernameInput, 'baduser');
      await user.type(passwordInput, 'wrongpassword');
      await user.click(loginButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });

    it('banner displays when API returns one', async () => {
      server.use(
        http.get('**/banner', () => {
          return HttpResponse.json('System maintenance scheduled for tonight');
        }),
      );

      renderLoginPage();

      await waitFor(() => {
        expect(screen.getByText('System maintenance scheduled for tonight')).toBeInTheDocument();
      });
    });
  });

  describe('Registration Flow', () => {
    it('user can open registration modal', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      const registerLink = screen.getByRole('link', { name: /account/i });
      await user.click(registerLink);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Register')).toBeInTheDocument();
      });
    });

    it('submitting empty registration form shows warning', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      const registerLink = screen.getByRole('link', { name: /account/i });
      await user.click(registerLink);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/must specify a username and password/i)).toBeInTheDocument();
      });
    });

    it('successful registration navigates to dashboard', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      const registerLink = screen.getByRole('link', { name: /account/i });
      await user.click(registerLink);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const usernameInput = screen.getByPlaceholderText('Enter Username');
      const passwordInput = screen.getByPlaceholderText('Enter Password');
      const submitButton = screen.getByRole('button', { name: /submit/i });

      await user.type(usernameInput, 'newuser');
      await user.type(passwordInput, 'newpassword');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId('dashboard')).toBeInTheDocument();
      });
    });
  });
});
