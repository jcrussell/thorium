import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GraphControls, GraphControls as GraphControlsInterface } from './controls';
import { GraphLayout } from './layout';
import cytoscape from 'cytoscape';

// Create mock controls with default values
const createMockControls = (overrides: Partial<GraphControlsInterface> = {}): GraphControlsInterface => ({
  filterChildless: false,
  depth: 3,
  showEdgeLabels: true,
  showNodeLabels: true,
  selectedElement: null,
  showNodeInfo: false,
  autoRunLayout: true,
  layoutAlgorithm: GraphLayout.Fcose,
  ...overrides,
});

// Create mock cytoscape instance
const createMockCyInstance = (): React.RefObject<cytoscape.Core | null> => ({
  current: {
    layout: vi.fn().mockReturnValue({ run: vi.fn() }),
  } as unknown as cytoscape.Core,
});

describe('GraphControls', () => {
  describe('Depth Selector', () => {
    it('shows current depth value selected', () => {
      const controls = createMockControls({ depth: 5 });
      const updateControls = vi.fn();
      const cyInstance = createMockCyInstance();

      render(
        <GraphControls graphId="test-graph" controls={controls} updateControls={updateControls} cyInstance={cyInstance} />,
      );

      // User can see the current depth value
      const depthSelect = screen.getByRole('combobox');
      expect((depthSelect as HTMLSelectElement).value).toBe('5');
    });

    it('allows user to change graph depth', async () => {
      const user = userEvent.setup();
      const controls = createMockControls({ depth: 3 });
      const updateControls = vi.fn();
      const cyInstance = createMockCyInstance();

      render(
        <GraphControls graphId="test-graph" controls={controls} updateControls={updateControls} cyInstance={cyInstance} />,
      );

      // User changes depth to 7
      const depthSelect = screen.getByRole('combobox');
      await user.selectOptions(depthSelect, '7');

      // Depth change is applied
      expect(updateControls).toHaveBeenCalledWith({ type: 'depth', state: 7 });
    });
  });

  describe('Layout Selection', () => {
    it('shows current layout algorithm to user', () => {
      const controls = createMockControls({ layoutAlgorithm: GraphLayout.Circle });
      const updateControls = vi.fn();
      const cyInstance = createMockCyInstance();

      render(
        <GraphControls graphId="test-graph" controls={controls} updateControls={updateControls} cyInstance={cyInstance} />,
      );

      // User can see which layout is active
      expect(screen.getByText(/Layout.*circle/i)).toBeInTheDocument();
    });

    it('allows user to choose different layout algorithms', async () => {
      const user = userEvent.setup();
      const controls = createMockControls();
      const updateControls = vi.fn();
      const cyInstance = createMockCyInstance();

      render(
        <GraphControls graphId="test-graph" controls={controls} updateControls={updateControls} cyInstance={cyInstance} />,
      );

      // User opens layout menu and sees available options
      await user.click(screen.getByText(/Layout.*fcose/i));

      expect(screen.getByText('circle')).toBeInTheDocument();
      expect(screen.getByText('concentric')).toBeInTheDocument();
      expect(screen.getByText('elk')).toBeInTheDocument();
    });
  });

  describe('Export', () => {
    it('allows user to download graph as image', async () => {
      const user = userEvent.setup();
      const controls = createMockControls();
      const updateControls = vi.fn();
      const cyInstance = createMockCyInstance();

      render(
        <GraphControls graphId="test-graph" controls={controls} updateControls={updateControls} cyInstance={cyInstance} />,
      );

      // User clicks Download and sees export format options
      await user.click(screen.getByText('Download'));

      expect(screen.getByText('PNG')).toBeInTheDocument();
      expect(screen.getByText('JPEG')).toBeInTheDocument();
    });
  });

  describe('Label Toggles', () => {
    it('allows user to toggle node labels on/off', async () => {
      const user = userEvent.setup();
      const controls = createMockControls({ showNodeLabels: true });
      const updateControls = vi.fn();
      const cyInstance = createMockCyInstance();

      render(
        <GraphControls graphId="test-graph" controls={controls} updateControls={updateControls} cyInstance={cyInstance} />,
      );

      // User clicks to hide node labels
      await user.click(screen.getByLabelText('Node Labels'));

      expect(updateControls).toHaveBeenCalledWith({ type: 'showNodeLabels', state: false });
    });

    it('allows user to toggle edge labels on/off', async () => {
      const user = userEvent.setup();
      const controls = createMockControls({ showEdgeLabels: false });
      const updateControls = vi.fn();
      const cyInstance = createMockCyInstance();

      render(
        <GraphControls graphId="test-graph" controls={controls} updateControls={updateControls} cyInstance={cyInstance} />,
      );

      // User clicks to show edge labels
      await user.click(screen.getByLabelText('Edge Labels'));

      expect(updateControls).toHaveBeenCalledWith({ type: 'showEdgeLabels', state: true });
    });
  });

  describe('Randomize', () => {
    it('allows user to randomize graph layout', async () => {
      const user = userEvent.setup();
      const controls = createMockControls();
      const updateControls = vi.fn();
      const layoutMock = vi.fn().mockReturnValue({ run: vi.fn() });
      const cyInstance: React.RefObject<cytoscape.Core | null> = {
        current: { layout: layoutMock } as unknown as cytoscape.Core,
      };

      render(
        <GraphControls graphId="test-graph" controls={controls} updateControls={updateControls} cyInstance={cyInstance} />,
      );

      // User clicks to randomize layout
      await user.click(screen.getByRole('button', { name: /randomize/i }));

      // Layout is triggered on the graph
      expect(layoutMock).toHaveBeenCalled();
    });
  });
});
