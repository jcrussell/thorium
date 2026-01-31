import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/mocks/server';
import { AuthProvider } from '@utilities';
import { EntityCreate, MetadataComponent } from './create';
import { BlankCreateDevice, CreateDevice, Entities } from '@models';
import { clearMockCookie, setMockCookie } from '../../test/setup';
import { createDevice } from '../../test/utils/factories';

// Mock metadata component for testing
const mockMetadata: MetadataComponent = () => <div data-testid="metadata-fields">Metadata Fields</div>;

function renderEntityCreate(initialRoute = '/create/device', locationState?: { entity?: any }) {
  const entries = locationState ? [{ pathname: initialRoute, state: locationState }] : [initialRoute];

  return render(
    <MemoryRouter initialEntries={entries}>
      <AuthProvider>
        <Routes>
          <Route
            path="/create/device"
            element={<EntityCreate<CreateDevice> blank={BlankCreateDevice} kind={Entities.Device} metadata={mockMetadata} />}
          />
          <Route path="/device/:entityID" element={<div data-testid="entity-details">Entity Details Page</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('EntityCreate', () => {
  beforeEach(() => {
    clearMockCookie();
    setMockCookie('THORIUM_TOKEN', 'test-token');
  });

  describe('form rendering', () => {
    it('displays entity kind in title', async () => {
      renderEntityCreate();

      await waitFor(() => {
        // The title appears in multiple places so use getAllByText
        const titles = screen.getAllByText(/New Device/i);
        expect(titles.length).toBeGreaterThan(0);
      });
    });

    it('displays name input field', async () => {
      renderEntityCreate();

      await waitFor(() => {
        expect(screen.getByText(/Name/)).toBeInTheDocument();
      });

      // Find the name input by its form control
      const nameInputs = screen.getAllByRole('textbox');
      expect(nameInputs.length).toBeGreaterThan(0);
    });

    it('displays groups selection field', async () => {
      renderEntityCreate();

      await waitFor(() => {
        expect(screen.getByText(/Groups/)).toBeInTheDocument();
      });
    });

    it('displays description field', async () => {
      renderEntityCreate();

      await waitFor(() => {
        expect(screen.getByText(/Description/)).toBeInTheDocument();
      });
    });

    it('displays metadata fields component', async () => {
      renderEntityCreate();

      await waitFor(() => {
        expect(screen.getByTestId('metadata-fields')).toBeInTheDocument();
      });
    });

    it('displays create button', async () => {
      renderEntityCreate();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument();
      });
    });
  });

  describe('form interaction', () => {
    it('user can enter a name', async () => {
      const user = userEvent.setup();
      renderEntityCreate();

      await waitFor(() => {
        expect(screen.getByText(/Name/)).toBeInTheDocument();
      });

      // Get first textbox which is the name field
      const nameInput = screen.getAllByRole('textbox')[0];
      await user.type(nameInput, 'My New Device');

      expect(nameInput).toHaveValue('My New Device');
    });

    it('user can enter a description', async () => {
      const user = userEvent.setup();
      renderEntityCreate();

      await waitFor(() => {
        expect(screen.getByText(/Description/)).toBeInTheDocument();
      });

      // Find the textarea for description
      const textareas = document.querySelectorAll('textarea');
      expect(textareas.length).toBeGreaterThan(0);

      await user.type(textareas[0], 'This is a test device');
      expect(textareas[0]).toHaveValue('This is a test device');
    });
  });

  describe('form submission', () => {
    it('successful creation navigates to entity details page', async () => {
      const user = userEvent.setup();
      renderEntityCreate();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument();
      });

      // Enter name
      const nameInput = screen.getAllByRole('textbox')[0];
      await user.type(nameInput, 'Test Device');

      // Click create
      const createButton = screen.getByRole('button', { name: /create/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByTestId('entity-details')).toBeInTheDocument();
      });
    });

    it('creation error shows alert message', async () => {
      server.use(
        http.post('**/entities/', () => {
          return HttpResponse.json({ error: 'Validation failed' }, { status: 400 });
        }),
      );

      const user = userEvent.setup();
      renderEntityCreate();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument();
      });

      const nameInput = screen.getAllByRole('textbox')[0];
      await user.type(nameInput, 'Test Device');

      const createButton = screen.getByRole('button', { name: /create/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });

    it('server error shows error alert', async () => {
      server.use(
        http.post('**/entities/', () => {
          return HttpResponse.json({ error: 'Internal server error' }, { status: 500 });
        }),
      );

      const user = userEvent.setup();
      renderEntityCreate();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', { name: /create/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });
  });

  describe('copy entity pre-population', () => {
    it('pre-fills form with existing entity data when copying', async () => {
      const existingDevice = createDevice({
        name: 'Original Device',
        description: 'Original description',
        groups: ['group1'],
      });

      renderEntityCreate('/create/device', { entity: existingDevice });

      await waitFor(() => {
        // Name should have "-copy" suffix when copying
        const nameInput = screen.getAllByRole('textbox')[0];
        expect(nameInput).toHaveValue('Original Device - copy');
      });
    });

    it('pre-fills description from copied entity', async () => {
      const existingDevice = createDevice({
        name: 'Original Device',
        description: 'Original description',
      });

      renderEntityCreate('/create/device', { entity: existingDevice });

      await waitFor(() => {
        const textareas = document.querySelectorAll('textarea');
        expect(textareas.length).toBeGreaterThan(0);
        expect(textareas[0]).toHaveValue('Original description');
      });
    });
  });
});
