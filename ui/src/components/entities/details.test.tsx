import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/mocks/server';
import { AuthProvider } from '@utilities';
import { EntityDetails, MetadataComponent } from './details';
import { BlankDevice, Device, Entities, Entity } from '@models';
import { clearMockCookie, setMockCookie } from '../../test/setup';
import { createDevice } from '../../test/utils/factories';
import { FaServer } from 'react-icons/fa';

// Mock metadata component for testing
const mockMetadata: MetadataComponent = (_entity, _pendingEntity, _handleUpdate, editing) => (
  <div data-testid="metadata-fields">{editing ? 'Editing Metadata' : 'Viewing Metadata'}</div>
);

// Mock icon function
const mockIcon = (size: number) => <FaServer size={size} data-testid="entity-icon" />;

// Mock getEntityDetails function
function createMockGetEntityDetails(entity: Device) {
  return vi.fn((entityID: string, setError: (err: string) => void, updateEntity: (entity: Device) => void) => {
    updateEntity(entity);
  });
}

function renderEntityDetails(
  initialRoute = '/device/device-123',
  getEntityDetails = createMockGetEntityDetails(createDevice({ id: 'device-123', name: 'Test Device' })),
) {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <AuthProvider>
        <Routes>
          <Route
            path="/device/:entityID"
            element={
              <EntityDetails<Device> getEntityDetails={getEntityDetails} blank={BlankDevice} metadata={mockMetadata} icon={mockIcon} />
            }
          />
          <Route path="/devices" element={<div data-testid="device-list">Device List Page</div>} />
          <Route path="/create/device" element={<div data-testid="create-device">Create Device Page</div>} />
          <Route path="/upload" element={<div data-testid="upload-page">Upload Page</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('EntityDetails', () => {
  beforeEach(() => {
    clearMockCookie();
    setMockCookie('THORIUM_TOKEN', 'test-token');
  });

  describe('viewing mode', () => {
    it('displays entity name', async () => {
      const device = createDevice({ id: 'device-123', name: 'My Router' });
      renderEntityDetails('/device/device-123', createMockGetEntityDetails(device));

      await waitFor(() => {
        // Name appears in multiple places (title and card), so use getAllByText
        const nameElements = screen.getAllByText('My Router');
        expect(nameElements.length).toBeGreaterThan(0);
      });
    });

    it('displays entity ID', async () => {
      const device = createDevice({ id: 'device-123', name: 'Test Device' });
      renderEntityDetails('/device/device-123', createMockGetEntityDetails(device));

      await waitFor(() => {
        expect(screen.getByText('device-123')).toBeInTheDocument();
      });
    });

    it('displays entity type', async () => {
      const device = createDevice({ id: 'device-123', kind: Entities.Device });
      renderEntityDetails('/device/device-123', createMockGetEntityDetails(device));

      await waitFor(() => {
        expect(screen.getByText('Device')).toBeInTheDocument();
      });
    });

    it('displays submitter', async () => {
      const device = createDevice({ id: 'device-123', submitter: 'admin-user' });
      renderEntityDetails('/device/device-123', createMockGetEntityDetails(device));

      await waitFor(() => {
        expect(screen.getByText('admin-user')).toBeInTheDocument();
      });
    });

    it('displays description', async () => {
      const device = createDevice({ id: 'device-123', description: 'A network router' });
      renderEntityDetails('/device/device-123', createMockGetEntityDetails(device));

      await waitFor(() => {
        expect(screen.getByText('A network router')).toBeInTheDocument();
      });
    });

    it('displays metadata fields', async () => {
      renderEntityDetails();

      await waitFor(() => {
        expect(screen.getByTestId('metadata-fields')).toBeInTheDocument();
        expect(screen.getByText('Viewing Metadata')).toBeInTheDocument();
      });
    });

    it('displays entity icon', async () => {
      renderEntityDetails();

      await waitFor(() => {
        expect(screen.getByTestId('entity-icon')).toBeInTheDocument();
      });
    });
  });

  describe('edit mode', () => {
    it('user can toggle to edit mode', async () => {
      const user = userEvent.setup();
      renderEntityDetails();

      await waitFor(() => {
        const nameElements = screen.getAllByText('Test Device');
        expect(nameElements.length).toBeGreaterThan(0);
      });

      // Find and click edit button (FaRegEdit icon button)
      const editButton = screen.getAllByRole('button')[0];
      await user.click(editButton);

      await waitFor(() => {
        expect(screen.getByText('Editing Metadata')).toBeInTheDocument();
      });
    });

    it('name field becomes editable in edit mode', async () => {
      const user = userEvent.setup();
      const device = createDevice({ id: 'device-123', name: 'Original Name' });
      renderEntityDetails('/device/device-123', createMockGetEntityDetails(device));

      await waitFor(() => {
        const nameElements = screen.getAllByText('Original Name');
        expect(nameElements.length).toBeGreaterThan(0);
      });

      // Click edit button
      const editButton = screen.getAllByRole('button')[0];
      await user.click(editButton);

      await waitFor(() => {
        // In edit mode, name should be in an input
        const nameInput = screen.getAllByRole('textbox')[0];
        expect(nameInput).toHaveValue('Original Name');
      });
    });

    it('cancel button discards changes and exits edit mode', async () => {
      const user = userEvent.setup();
      const device = createDevice({ id: 'device-123', name: 'Original Name' });
      renderEntityDetails('/device/device-123', createMockGetEntityDetails(device));

      await waitFor(() => {
        const nameElements = screen.getAllByText('Original Name');
        expect(nameElements.length).toBeGreaterThan(0);
      });

      // Enter edit mode
      const editButton = screen.getAllByRole('button')[0];
      await user.click(editButton);

      await waitFor(() => {
        expect(screen.getByText('Editing Metadata')).toBeInTheDocument();
      });

      // Modify name
      const nameInput = screen.getAllByRole('textbox')[0];
      await user.clear(nameInput);
      await user.type(nameInput, 'Modified Name');

      // Click cancel (first button in edit mode is now cancel/backspace)
      const cancelButton = screen.getAllByRole('button')[0];
      await user.click(cancelButton);

      await waitFor(() => {
        // Should show original name again and exit edit mode
        expect(screen.getByText('Viewing Metadata')).toBeInTheDocument();
      });
    });

    it('save button updates entity and exits edit mode', async () => {
      const user = userEvent.setup();
      const device = createDevice({ id: 'device-123', name: 'Original Name' });
      renderEntityDetails('/device/device-123', createMockGetEntityDetails(device));

      await waitFor(() => {
        const nameElements = screen.getAllByText('Original Name');
        expect(nameElements.length).toBeGreaterThan(0);
      });

      // Enter edit mode
      const editButton = screen.getAllByRole('button')[0];
      await user.click(editButton);

      await waitFor(() => {
        expect(screen.getByText('Editing Metadata')).toBeInTheDocument();
      });

      // In edit mode, there should be a save button (second button)
      const buttons = screen.getAllByRole('button');
      // Find the save button - it appears when in edit mode
      const saveButton = buttons[1];
      await user.click(saveButton);

      await waitFor(() => {
        // Should exit edit mode after successful save
        expect(screen.getByText('Viewing Metadata')).toBeInTheDocument();
      });
    });
  });

  describe('delete confirmation', () => {
    it('opens delete modal when delete button is clicked', async () => {
      const user = userEvent.setup();
      const device = createDevice({ id: 'device-123', name: 'Test Device' });
      renderEntityDetails('/device/device-123', createMockGetEntityDetails(device));

      await waitFor(() => {
        const nameElements = screen.getAllByText('Test Device');
        expect(nameElements.length).toBeGreaterThan(0);
      });

      // Find delete button (second button with trash icon)
      const buttons = screen.getAllByRole('button');
      const deleteButton = buttons[1];
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Confirm deletion')).toBeInTheDocument();
      });
    });

    it('shows entity name and ID in delete modal', async () => {
      const user = userEvent.setup();
      const device = createDevice({ id: 'device-123', name: 'My Important Device' });
      renderEntityDetails('/device/device-123', createMockGetEntityDetails(device));

      await waitFor(() => {
        const nameElements = screen.getAllByText('My Important Device');
        expect(nameElements.length).toBeGreaterThan(0);
      });

      const buttons = screen.getAllByRole('button');
      const deleteButton = buttons[1];
      await user.click(deleteButton);

      await waitFor(() => {
        const modal = screen.getByRole('dialog');
        expect(within(modal).getByText('My Important Device')).toBeInTheDocument();
        expect(within(modal).getByText('device-123')).toBeInTheDocument();
      });
    });

    it('cancel closes delete modal without deleting', async () => {
      const user = userEvent.setup();
      const device = createDevice({ id: 'device-123', name: 'Test Device' });
      renderEntityDetails('/device/device-123', createMockGetEntityDetails(device));

      await waitFor(() => {
        const nameElements = screen.getAllByText('Test Device');
        expect(nameElements.length).toBeGreaterThan(0);
      });

      // Open delete modal
      const buttons = screen.getAllByRole('button');
      const deleteButton = buttons[1];
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Click cancel
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      // Should still be on details page - name appears in multiple places
      const nameElements = screen.getAllByText('Test Device');
      expect(nameElements.length).toBeGreaterThan(0);
    });

    it('confirm deletes entity and navigates to list page', async () => {
      const user = userEvent.setup();
      const device = createDevice({ id: 'device-123', name: 'Test Device', kind: Entities.Device });
      renderEntityDetails('/device/device-123', createMockGetEntityDetails(device));

      await waitFor(() => {
        const nameElements = screen.getAllByText('Test Device');
        expect(nameElements.length).toBeGreaterThan(0);
      });

      // Open delete modal
      const buttons = screen.getAllByRole('button');
      const deleteButton = buttons[1];
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Click confirm
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByTestId('device-list')).toBeInTheDocument();
      });
    });
  });

  describe('error handling', () => {
    it('shows error when entity fetch fails', async () => {
      const getEntityDetails = vi.fn((entityID: string, setError: (err: string) => void, _updateEntity: any) => {
        setError('Entity not found');
      });

      renderEntityDetails('/device/device-123', getEntityDetails);

      await waitFor(() => {
        // There may be multiple alerts, check for the specific error message
        expect(screen.getByText('Entity not found')).toBeInTheDocument();
      });
    });

    it('shows error when update fails', async () => {
      server.use(
        http.patch('**/entities/:id', () => {
          return HttpResponse.json({ error: 'Update failed' }, { status: 403 });
        }),
      );

      const user = userEvent.setup();
      const device = createDevice({ id: 'device-123', name: 'Test Device' });
      renderEntityDetails('/device/device-123', createMockGetEntityDetails(device));

      await waitFor(() => {
        const nameElements = screen.getAllByText('Test Device');
        expect(nameElements.length).toBeGreaterThan(0);
      });

      // Enter edit mode
      const editButton = screen.getAllByRole('button')[0];
      await user.click(editButton);

      await waitFor(() => {
        expect(screen.getByText('Editing Metadata')).toBeInTheDocument();
      });

      // Modify name
      const nameInput = screen.getAllByRole('textbox')[0];
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Name');

      // Click save
      const saveButton = screen.getAllByRole('button')[1];
      await user.click(saveButton);

      await waitFor(() => {
        // Look for an alert containing error-related content
        const alerts = screen.getAllByRole('alert');
        const errorAlert = alerts.find((alert) => alert.classList.contains('alert-danger'));
        expect(errorAlert).toBeTruthy();
      });
    });

    it('shows error when delete fails', async () => {
      server.use(
        http.delete('**/entities/:id', () => {
          return HttpResponse.json({ error: 'Delete failed' }, { status: 403 });
        }),
      );

      const user = userEvent.setup();
      const device = createDevice({ id: 'device-123', name: 'Test Device' });
      renderEntityDetails('/device/device-123', createMockGetEntityDetails(device));

      await waitFor(() => {
        const nameElements = screen.getAllByText('Test Device');
        expect(nameElements.length).toBeGreaterThan(0);
      });

      // Open delete modal
      const buttons = screen.getAllByRole('button');
      const deleteButton = buttons[1];
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Click confirm
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);

      await waitFor(() => {
        // Look for an alert containing error-related content
        const alerts = screen.getAllByRole('alert');
        const errorAlert = alerts.find((alert) => alert.classList.contains('alert-danger'));
        expect(errorAlert).toBeTruthy();
      });
    });
  });

  describe('action buttons', () => {
    it('copy button navigates to create page with entity data', async () => {
      const user = userEvent.setup();
      const device = createDevice({ id: 'device-123', name: 'Test Device' });
      renderEntityDetails('/device/device-123', createMockGetEntityDetails(device));

      await waitFor(() => {
        const nameElements = screen.getAllByText('Test Device');
        expect(nameElements.length).toBeGreaterThan(0);
      });

      // Find copy button (third button - FaSquarePlus)
      const buttons = screen.getAllByRole('button');
      const copyButton = buttons[2];
      await user.click(copyButton);

      await waitFor(() => {
        expect(screen.getByTestId('create-device')).toBeInTheDocument();
      });
    });

    it('upload file button navigates to upload page', async () => {
      const user = userEvent.setup();
      const device = createDevice({ id: 'device-123', name: 'Test Device' });
      renderEntityDetails('/device/device-123', createMockGetEntityDetails(device));

      await waitFor(() => {
        const nameElements = screen.getAllByText('Test Device');
        expect(nameElements.length).toBeGreaterThan(0);
      });

      // Find upload button (fourth button - FaFileCirclePlus)
      const buttons = screen.getAllByRole('button');
      const uploadButton = buttons[3];
      await user.click(uploadButton);

      await waitFor(() => {
        expect(screen.getByTestId('upload-page')).toBeInTheDocument();
      });
    });
  });
});
