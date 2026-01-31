import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/mocks/server';
import FileDetailsContainer from './details';
import { setMockCookie } from '../../test/setup';
import { createFullSample, createUserInfo } from '../../test/utils/factories';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@utilities';

window.scrollTo = vi.fn();

// Minimal mocks - only what's needed for the component to render
vi.mock('react-select', () => ({ default: () => <select data-testid="select" /> }));

vi.mock('@components', async () => {
  const actual = await vi.importActual('@components');
  return {
    ...actual,
    AssociationGraph: () => null,
    AssociationTree: () => null,
    Results: () => <div>Results</div>,
    Comments: () => <div>Comments</div>,
    Download: () => <div>Download</div>,
    ReactionStatus: () => <div>Reaction Status</div>,
    RunPipelines: () => <div>Run Pipelines</div>,
    EditableTags: () => <div>Tags</div>,
  };
});

vi.mock('@utilities', async () => {
  const actual = await vi.importActual('@utilities');
  return {
    ...actual,
    useAuth: () => ({
      userInfo: createUserInfo({ groups: ['default'] }),
      checkCookie: vi.fn(),
      setUserInfo: vi.fn(),
    }),
    fetchGroups: vi.fn((cb) => cb({ default: { name: 'default', owner: 'admin' } })),
    isGroupAdmin: () => false,
    updateURLSection: vi.fn(),
    scrollToSection: vi.fn(),
  };
});

function renderPage(sha256 = 'a'.repeat(64)) {
  return render(
    <MemoryRouter initialEntries={[`/file/${sha256}`]}>
      <AuthProvider>
        <Routes>
          <Route path="/file/:sha256" element={<FileDetailsContainer />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('FileDetailsContainer', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setMockCookie('THORIUM_TOKEN', 'test-token');
    server.use(
      http.get('**/files/sample/:sha256', ({ params }) =>
        HttpResponse.json(createFullSample({ sha256: params.sha256 as string })),
      ),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('displays file hash after loading', async () => {
    const sha256 = 'a'.repeat(64);
    renderPage(sha256);
    await vi.advanceTimersByTimeAsync(100);

    await waitFor(() => {
      expect(screen.getByText(sha256)).toBeInTheDocument();
    });
  });

  it('displays hash type labels', async () => {
    renderPage();
    await vi.advanceTimersByTimeAsync(100);

    await waitFor(() => {
      expect(screen.getByText('SHA-256')).toBeInTheDocument();
      expect(screen.getByText('SHA-1')).toBeInTheDocument();
      expect(screen.getByText('MD5')).toBeInTheDocument();
    });
  });

  it('renders navigation tabs', async () => {
    renderPage();
    await vi.advanceTimersByTimeAsync(100);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Results' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Related' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Download' })).toBeInTheDocument();
    });
  });

  it('shows error when file not found', async () => {
    server.use(http.get('**/files/sample/:sha256', () => HttpResponse.json({}, { status: 404 })));

    renderPage('missing');
    await vi.advanceTimersByTimeAsync(100);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
