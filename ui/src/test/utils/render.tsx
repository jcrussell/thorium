import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@utilities';

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  route?: string;
  useMemoryRouter?: boolean;
}

function AllProviders({ children }: { children: React.ReactNode }) {
  return (
    <BrowserRouter>
      <AuthProvider>{children}</AuthProvider>
    </BrowserRouter>
  );
}

function createMemoryRouterWrapper(route: string) {
  return function MemoryRouterWrapper({ children }: { children: React.ReactNode }) {
    return (
      <MemoryRouter initialEntries={[route]}>
        <AuthProvider>{children}</AuthProvider>
      </MemoryRouter>
    );
  };
}

export function renderWithProviders(ui: ReactElement, { route = '/', useMemoryRouter = false, ...options }: CustomRenderOptions = {}) {
  const Wrapper = useMemoryRouter ? createMemoryRouterWrapper(route) : AllProviders;

  return {
    ...render(ui, { wrapper: Wrapper, ...options }),
  };
}

// Re-export everything from testing-library
export * from '@testing-library/react';
export { renderWithProviders as render };
