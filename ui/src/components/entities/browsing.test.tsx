import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EntityList } from './browsing';
import { Filters } from '@models';

interface MockEntity {
  id: string;
  name: string;
}

function createMockEntity(id: number): MockEntity {
  return { id: `entity-${id}`, name: `Entity ${id}` };
}

function createMockFetchEntities(entities: MockEntity[], cursor: string | null = null) {
  return vi.fn().mockResolvedValue({
    entitiesList: entities,
    entitiesCursor: cursor,
  });
}

function renderEntityList(props: Partial<React.ComponentProps<typeof EntityList>> = {}) {
  const defaultProps: React.ComponentProps<typeof EntityList> = {
    type: 'Files',
    displayEntity: (entity: MockEntity, idx: number) => (
      <div key={entity.id} data-testid={`entity-${idx}`}>
        {entity.name}
      </div>
    ),
    entityHeaders: <div>Name</div>,
    filters: { limit: 10 },
    fetchEntities: createMockFetchEntities([]),
    loading: false,
    setLoading: vi.fn(),
    ...props,
  };

  return render(<EntityList {...defaultProps} />);
}

describe('EntityList', () => {
  describe('loading state', () => {
    it('hides content while loading', () => {
      renderEntityList({
        loading: true,
        entityHeaders: <div>Headers</div>,
      });

      expect(screen.queryByText('Headers')).not.toBeInTheDocument();
    });

    it('shows content when not loading', async () => {
      renderEntityList({
        loading: false,
        entityHeaders: <div>Headers</div>,
        filters: { limit: 10 },
        fetchEntities: createMockFetchEntities([createMockEntity(1)]),
      });

      await waitFor(() => {
        expect(screen.getByText('Headers')).toBeInTheDocument();
      });
    });
  });

  describe('empty state', () => {
    it('shows empty message with entity type', async () => {
      renderEntityList({
        type: 'Files',
        filters: { limit: 10 },
        fetchEntities: createMockFetchEntities([]),
      });

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('No Files Found');
      });
    });

    it('shows generic empty message when type not provided', async () => {
      renderEntityList({
        type: '',
        filters: { limit: 10 },
        fetchEntities: createMockFetchEntities([]),
      });

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('None Found');
      });
    });
  });

  describe('displaying entities', () => {
    it('renders each entity using displayEntity callback', async () => {
      const entities = [createMockEntity(1), createMockEntity(2)];

      renderEntityList({
        filters: { limit: 10 },
        fetchEntities: createMockFetchEntities(entities),
      });

      await waitFor(() => {
        expect(screen.getByText('Entity 1')).toBeInTheDocument();
        expect(screen.getByText('Entity 2')).toBeInTheDocument();
      });
    });

    it('renders headers when entities are loaded', async () => {
      renderEntityList({
        entityHeaders: <div>Column Header</div>,
        filters: { limit: 10 },
        fetchEntities: createMockFetchEntities([createMockEntity(1)]),
      });

      await waitFor(() => {
        expect(screen.getByText('Column Header')).toBeInTheDocument();
      });
    });
  });

  describe('pagination', () => {
    it('shows Back and Next buttons when entities exist', async () => {
      renderEntityList({
        filters: { limit: 10 },
        fetchEntities: createMockFetchEntities([createMockEntity(1)]),
      });

      await waitFor(() => {
        expect(screen.getByText('Back')).toBeInTheDocument();
        expect(screen.getByText('Next')).toBeInTheDocument();
      });
    });

    it('navigates to next page showing different entities', async () => {
      const user = userEvent.setup();
      const entities = Array.from({ length: 6 }, (_, i) => createMockEntity(i));

      renderEntityList({
        filters: { limit: 3 },
        fetchEntities: createMockFetchEntities(entities, 'has-more'),
      });

      await waitFor(() => {
        expect(screen.getByText('Entity 0')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Next'));

      await waitFor(() => {
        expect(screen.getByText('Entity 3')).toBeInTheDocument();
        expect(screen.queryByText('Entity 0')).not.toBeInTheDocument();
      });
    });

    it('navigates back to previous page', async () => {
      const user = userEvent.setup();
      const entities = Array.from({ length: 6 }, (_, i) => createMockEntity(i));

      renderEntityList({
        filters: { limit: 3 },
        fetchEntities: createMockFetchEntities(entities, 'has-more'),
      });

      await waitFor(() => {
        expect(screen.getByText('Entity 0')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Next'));
      await waitFor(() => {
        expect(screen.getByText('Entity 3')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Back'));
      await waitFor(() => {
        expect(screen.getByText('Entity 0')).toBeInTheDocument();
      });
    });

    it('fetches more data when reaching end of current results', async () => {
      const user = userEvent.setup();
      const fetchEntities = createMockFetchEntities([createMockEntity(1)], 'next-cursor');

      renderEntityList({
        filters: { limit: 1 },
        fetchEntities,
      });

      await waitFor(() => {
        expect(screen.getByText('Entity 1')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Next'));

      await waitFor(() => {
        // Second call to fetch more data
        expect(fetchEntities).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('error handling', () => {
    it('displays error message from fetch', async () => {
      const fetchEntities = vi.fn().mockImplementation((_filters, _cursor, errorHandler: (error: string) => void) => {
        errorHandler('Connection failed');
        return Promise.resolve({ entitiesList: [], entitiesCursor: null });
      });

      renderEntityList({
        filters: { limit: 10 },
        fetchEntities,
      });

      await waitFor(() => {
        expect(screen.getByText('Connection failed')).toBeInTheDocument();
      });
    });
  });

  describe('fetch behavior', () => {
    it('indicates loading state during fetch', async () => {
      const setLoading = vi.fn();

      renderEntityList({
        filters: { limit: 10 },
        fetchEntities: createMockFetchEntities([createMockEntity(1)]),
        setLoading,
      });

      await waitFor(() => {
        expect(setLoading).toHaveBeenCalledWith(true);
        expect(setLoading).toHaveBeenCalledWith(false);
      });
    });

    it('does not fetch with empty filters', () => {
      const fetchEntities = createMockFetchEntities([]);

      renderEntityList({
        filters: {} as Filters,
        fetchEntities,
      });

      expect(fetchEntities).not.toHaveBeenCalled();
    });
  });
});
