import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mocks/server';
import { authUserPass, whoami, logout, createUser } from './users';
import { setMockCookie } from '../test/setup';

describe('users API', () => {
  beforeEach(() => {
    setMockCookie('THORIUM_TOKEN', 'test-token');
  });

  describe('authUserPass', () => {
    it('returns auth response on successful login', async () => {
      const errorHandler = vi.fn();

      const result = await authUserPass('testuser', 'password123', errorHandler);

      expect(result).not.toBeNull();
      expect(result?.token).toBe('test-token-123');
      expect(errorHandler).not.toHaveBeenCalled();
    });

    it('calls error handler on authentication failure', async () => {
      // Override with a handler that returns an error
      server.use(
        http.post('**/users/auth', () => {
          return HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }),
      );

      const errorHandler = vi.fn();

      const result = await authUserPass('baduser', 'wrongpass', errorHandler);

      expect(result).toBeNull();
      expect(errorHandler).toHaveBeenCalledWith(expect.stringContaining('Failed to Password Auth'));
    });
  });

  describe('whoami', () => {
    it('returns user info on success', async () => {
      const result = await whoami();

      expect(result).not.toBeNull();
      expect(result?.username).toBe('testuser');
      expect(result?.email).toBe('testuser@example.com');
    });

    it('returns null on error', async () => {
      server.use(
        http.get('**/users/whoami', () => {
          return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }),
      );

      const result = await whoami();

      expect(result).toBeNull();
    });
  });

  describe('logout', () => {
    it('returns successful response', async () => {
      const result = await logout();

      expect(result.status).toBe(200);
    });
  });

  describe('createUser', () => {
    it('returns auth response on successful user creation', async () => {
      const errorHandler = vi.fn();

      const result = await createUser('newuser', 'newuser@example.com', 'password123', 'User', errorHandler);

      expect(result).not.toBeNull();
      expect(result?.token).toBe('test-token-123');
      expect(errorHandler).not.toHaveBeenCalled();
    });

    it('calls error handler on creation failure', async () => {
      server.use(
        http.post('**/users/', () => {
          return HttpResponse.json({ error: 'User already exists' }, { status: 400 });
        }),
      );

      const errorHandler = vi.fn();

      const result = await createUser('existinguser', 'existing@example.com', 'password', 'User', errorHandler);

      expect(result).toBeNull();
      expect(errorHandler).toHaveBeenCalled();
    });
  });
});
