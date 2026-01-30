import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, afterAll, vi } from 'vitest';
import { server } from './mocks/server';

// Start MSW server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));

// Reset handlers and cleanup after each test
afterEach(() => {
  cleanup();
  server.resetHandlers();
});

// Close server after all tests
afterAll(() => server.close());

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock document.cookie
let mockCookie = '';
Object.defineProperty(document, 'cookie', {
  get: vi.fn(() => mockCookie),
  set: vi.fn((value: string) => {
    // Handle cookie clearing (max-age=0)
    if (value.includes('max-age=0')) {
      const name = value.split('=')[0];
      mockCookie = mockCookie
        .split(';')
        .filter((c) => !c.trim().startsWith(name + '='))
        .join(';');
    } else {
      // Parse and set the cookie
      const parts = value.split(';');
      const nameValue = parts[0];
      // Remove existing cookie with same name if present
      const name = nameValue.split('=')[0];
      mockCookie = mockCookie
        .split(';')
        .filter((c) => c.trim() && !c.trim().startsWith(name + '='))
        .concat([nameValue])
        .filter(Boolean)
        .join('; ');
    }
  }),
});

// Export helper to set mock cookie for tests
export function setMockCookie(name: string, value: string) {
  mockCookie = `${name}=${value}`;
}

export function clearMockCookie() {
  mockCookie = '';
}
