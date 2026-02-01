import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth, RequireAuth } from './auth';
import { setMockCookie, clearMockCookie } from '../test/setup';

// Test component that exposes auth context
function AuthConsumer() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="username">{auth.userInfo?.username ?? 'not-logged-in'}</span>
      <span data-testid="token">{auth.token ?? 'no-token'}</span>
    </div>
  );
}

function ProtectedPage() {
  return <div data-testid="protected">Protected Content</div>;
}

function LoginPage() {
  return <div data-testid="login">Login Page</div>;
}

describe('AuthProvider', () => {
  beforeEach(() => {
    clearMockCookie();
  });

  it('provides auth context to children', () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <AuthConsumer />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('username')).toBeInTheDocument();
  });

  it('throws error when useAuth is used outside AuthProvider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(
        <MemoryRouter>
          <AuthConsumer />
        </MemoryRouter>,
      );
    }).toThrow('useAuth must be used within a AuthProvider');

    consoleSpy.mockRestore();
  });

  it('shows not-logged-in state when no token cookie exists', async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <AuthConsumer />
        </AuthProvider>
      </MemoryRouter>,
    );

    // Without a token, user should show as not logged in
    await waitFor(() => {
      expect(screen.getByTestId('username')).toHaveTextContent('not-logged-in');
    });
  });

  it('fetches user info when token cookie exists', async () => {
    setMockCookie('THORIUM_TOKEN', 'test-token-123');

    render(
      <MemoryRouter>
        <AuthProvider>
          <AuthConsumer />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('username')).toHaveTextContent('testuser');
    });
  });
});

describe('RequireAuth', () => {
  beforeEach(() => {
    clearMockCookie();
  });

  it('redirects to /auth when no token exists', async () => {
    render(
      <MemoryRouter initialEntries={['/protected']}>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<LoginPage />} />
            <Route
              path="/protected"
              element={
                <RequireAuth>
                  <ProtectedPage />
                </RequireAuth>
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('login')).toBeInTheDocument();
    });
  });

  it('renders children when token exists', async () => {
    setMockCookie('THORIUM_TOKEN', 'test-token-123');

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<LoginPage />} />
            <Route
              path="/protected"
              element={
                <RequireAuth>
                  <ProtectedPage />
                </RequireAuth>
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('protected')).toBeInTheDocument();
    });
  });
});

describe('useAuth hook', () => {
  beforeEach(() => {
    clearMockCookie();
  });

  it('provides login function', () => {
    let authContext: ReturnType<typeof useAuth> | null = null;

    function CaptureAuth() {
      authContext = useAuth();
      return null;
    }

    render(
      <MemoryRouter>
        <AuthProvider>
          <CaptureAuth />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(authContext).not.toBeNull();
    expect(typeof authContext!.login).toBe('function');
  });

  it('provides logout function', () => {
    let authContext: ReturnType<typeof useAuth> | null = null;

    function CaptureAuth() {
      authContext = useAuth();
      return null;
    }

    render(
      <MemoryRouter>
        <AuthProvider>
          <CaptureAuth />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(authContext).not.toBeNull();
    expect(typeof authContext!.logout).toBe('function');
  });

  it('provides refreshUserInfo function', () => {
    let authContext: ReturnType<typeof useAuth> | null = null;

    function CaptureAuth() {
      authContext = useAuth();
      return null;
    }

    render(
      <MemoryRouter>
        <AuthProvider>
          <CaptureAuth />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(authContext).not.toBeNull();
    expect(typeof authContext!.refreshUserInfo).toBe('function');
  });

  it('logout clears user state', async () => {
    setMockCookie('THORIUM_TOKEN', 'test-token-123');

    let authContext: ReturnType<typeof useAuth> | null = null;

    function CaptureAuth() {
      authContext = useAuth();
      return (
        <div>
          <span data-testid="username">{authContext.userInfo?.username ?? 'not-logged-in'}</span>
        </div>
      );
    }

    render(
      <MemoryRouter>
        <AuthProvider>
          <CaptureAuth />
        </AuthProvider>
      </MemoryRouter>,
    );

    // Wait for user info to be fetched
    await waitFor(() => {
      expect(screen.getByTestId('username')).toHaveTextContent('testuser');
    });

    // Logout
    await authContext!.logout();

    // User should be cleared
    await waitFor(() => {
      expect(screen.getByTestId('username')).toHaveTextContent('not-logged-in');
    });
  });
});

describe('Role-based access', () => {
  beforeEach(() => {
    clearMockCookie();
  });

  it('user info includes role information', async () => {
    setMockCookie('THORIUM_TOKEN', 'test-token-123');

    let authContext: ReturnType<typeof useAuth> | null = null;

    function CaptureAuth() {
      authContext = useAuth();
      return <div data-testid="role">{authContext.userInfo?.role ? 'has-role' : 'no-role'}</div>;
    }

    render(
      <MemoryRouter>
        <AuthProvider>
          <CaptureAuth />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('role')).toHaveTextContent('has-role');
    });
  });
});
