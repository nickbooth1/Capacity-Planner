import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StandDataTable } from './StandDataTable';
import { standApi } from '../api/stand-api';

// Mock the API
jest.mock('../api/stand-api');

// Mock the child components
jest.mock('./StandForm', () => ({
  StandForm: ({ onSuccess }: any) => (
    <div data-testid="stand-form">
      <button onClick={onSuccess}>Mock Submit</button>
    </div>
  ),
}));

jest.mock('./StandFilters', () => ({
  StandFilters: ({ columnFilters, setColumnFilters }: any) => (
    <div data-testid="stand-filters">
      <button onClick={() => setColumnFilters([{ id: 'status', value: 'operational' }])}>
        Filter Operational
      </button>
    </div>
  ),
}));

const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>);
};

describe('StandDataTable', () => {
  const organizationId = 'test-org-id';
  const mockStandsResponse = {
    data: [
      {
        id: 'stand-1',
        code: 'A1',
        name: 'Stand A1',
        terminal: 'Terminal 1',
        status: 'operational',
        dimensions: { length: 60, width: 30 },
        aircraftCompatibility: { compatibleCategories: ['A', 'B', 'C'] },
        createdAt: '2024-01-01T00:00:00Z',
      },
      {
        id: 'stand-2',
        code: 'A2',
        name: 'Stand A2',
        terminal: 'Terminal 2',
        status: 'maintenance',
        dimensions: { length: 55, width: 28 },
        aircraftCompatibility: { compatibleCategories: ['B', 'C'] },
        createdAt: '2024-01-02T00:00:00Z',
      },
    ],
    meta: {
      total: 2,
      page: 1,
      pageSize: 50,
      totalPages: 1,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (standApi.getStands as jest.Mock).mockResolvedValue(mockStandsResponse);
  });

  describe('Data Display', () => {
    it('should display stands in a table', async () => {
      renderWithQueryClient(<StandDataTable organizationId={organizationId} />);

      await waitFor(() => {
        expect(screen.getByText('A1')).toBeInTheDocument();
        expect(screen.getByText('Stand A1')).toBeInTheDocument();
        expect(screen.getByText('Terminal 1')).toBeInTheDocument();
        expect(screen.getByText('operational')).toBeInTheDocument();
        expect(screen.getByText('60m × 30m')).toBeInTheDocument();
        expect(screen.getByText('A, B, C')).toBeInTheDocument();
      });

      expect(screen.getByText('A2')).toBeInTheDocument();
      expect(screen.getByText('Stand A2')).toBeInTheDocument();
      expect(screen.getByText('Terminal 2')).toBeInTheDocument();
      expect(screen.getByText('maintenance')).toBeInTheDocument();
      expect(screen.getByText('55m × 28m')).toBeInTheDocument();
      expect(screen.getByText('B, C')).toBeInTheDocument();
    });

    it('should display loading state', () => {
      (standApi.getStands as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      renderWithQueryClient(<StandDataTable organizationId={organizationId} />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should display error state', async () => {
      (standApi.getStands as jest.Mock).mockRejectedValue(new Error('Failed to fetch'));

      renderWithQueryClient(<StandDataTable organizationId={organizationId} />);

      await waitFor(() => {
        expect(screen.getByText('Error loading stands')).toBeInTheDocument();
      });
    });

    it('should display empty state', async () => {
      (standApi.getStands as jest.Mock).mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, pageSize: 50, totalPages: 0 },
      });

      renderWithQueryClient(<StandDataTable organizationId={organizationId} />);

      await waitFor(() => {
        expect(screen.getByText('No results.')).toBeInTheDocument();
      });
    });
  });

  describe('Search and Filtering', () => {
    it('should search stands', async () => {
      renderWithQueryClient(<StandDataTable organizationId={organizationId} />);

      await waitFor(() => {
        expect(screen.getByText('A1')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search stands...');
      await userEvent.type(searchInput, 'A1');

      await waitFor(() => {
        expect(standApi.getStands).toHaveBeenLastCalledWith(
          organizationId,
          expect.objectContaining({ search: 'A1' })
        );
      });
    });

    it('should apply filters', async () => {
      renderWithQueryClient(<StandDataTable organizationId={organizationId} />);

      await waitFor(() => {
        expect(screen.getByText('A1')).toBeInTheDocument();
      });

      // Click filter button from mocked StandFilters
      fireEvent.click(screen.getByText('Filter Operational'));

      await waitFor(() => {
        expect(standApi.getStands).toHaveBeenLastCalledWith(
          organizationId,
          expect.objectContaining({ status: 'operational' })
        );
      });
    });
  });

  describe('CRUD Operations', () => {
    it('should open create dialog', async () => {
      renderWithQueryClient(<StandDataTable organizationId={organizationId} />);

      await waitFor(() => {
        expect(screen.getByText('A1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Add Stand'));

      expect(screen.getByText('Create New Stand')).toBeInTheDocument();
      expect(screen.getByTestId('stand-form')).toBeInTheDocument();
    });

    it('should refresh data after creating stand', async () => {
      renderWithQueryClient(<StandDataTable organizationId={organizationId} />);

      await waitFor(() => {
        expect(screen.getByText('A1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Add Stand'));

      // Click mock submit button
      fireEvent.click(screen.getByText('Mock Submit'));

      await waitFor(() => {
        expect(standApi.getStands).toHaveBeenCalledTimes(2); // Initial + refetch
      });
    });

    it('should open edit dialog when clicking edit', async () => {
      renderWithQueryClient(<StandDataTable organizationId={organizationId} />);

      await waitFor(() => {
        expect(screen.getByText('A1')).toBeInTheDocument();
      });

      const firstRow = screen.getByText('A1').closest('tr');
      const editButton = within(firstRow!).getByText('Edit');
      fireEvent.click(editButton);

      expect(screen.getByText('Edit Stand')).toBeInTheDocument();
      expect(screen.getByTestId('stand-form')).toBeInTheDocument();
    });

    it('should delete stand', async () => {
      (standApi.deleteStand as jest.Mock).mockResolvedValue(undefined);

      renderWithQueryClient(<StandDataTable organizationId={organizationId} />);

      await waitFor(() => {
        expect(screen.getByText('A1')).toBeInTheDocument();
      });

      const firstRow = screen.getByText('A1').closest('tr');
      const deleteButton = within(firstRow!).getByText('Delete');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(standApi.deleteStand).toHaveBeenCalledWith('stand-1', organizationId);
        expect(standApi.getStands).toHaveBeenCalledTimes(2); // Initial + refetch
      });
    });
  });

  describe('Pagination', () => {
    it('should display pagination info', async () => {
      renderWithQueryClient(<StandDataTable organizationId={organizationId} />);

      await waitFor(() => {
        expect(screen.getByText('Showing 2 of 2 stands')).toBeInTheDocument();
      });
    });

    it('should handle pagination navigation', async () => {
      (standApi.getStands as jest.Mock).mockResolvedValue({
        ...mockStandsResponse,
        meta: { total: 100, page: 1, pageSize: 50, totalPages: 2 },
      });

      renderWithQueryClient(<StandDataTable organizationId={organizationId} />);

      await waitFor(() => {
        expect(screen.getByText('A1')).toBeInTheDocument();
      });

      const nextButton = screen.getByText('Next');
      expect(nextButton).not.toBeDisabled();

      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(standApi.getStands).toHaveBeenLastCalledWith(organizationId, expect.any(Object));
      });
    });

    it('should disable pagination buttons appropriately', async () => {
      renderWithQueryClient(<StandDataTable organizationId={organizationId} />);

      await waitFor(() => {
        expect(screen.getByText('A1')).toBeInTheDocument();
      });

      const previousButton = screen.getByText('Previous');
      const nextButton = screen.getByText('Next');

      expect(previousButton).toBeDisabled(); // First page
      expect(nextButton).toBeDisabled(); // Only one page
    });
  });

  describe('Status Badge Display', () => {
    it('should display correct badge variants for status', async () => {
      renderWithQueryClient(<StandDataTable organizationId={organizationId} />);

      await waitFor(() => {
        const operationalBadge = screen.getByText('operational');
        const maintenanceBadge = screen.getByText('maintenance');

        expect(operationalBadge).toHaveClass('bg-primary');
        expect(maintenanceBadge).toHaveClass('bg-secondary');
      });
    });
  });

  describe('Dimension Display', () => {
    it('should format dimensions correctly', async () => {
      renderWithQueryClient(<StandDataTable organizationId={organizationId} />);

      await waitFor(() => {
        expect(screen.getByText('60m × 30m')).toBeInTheDocument();
        expect(screen.getByText('55m × 28m')).toBeInTheDocument();
      });
    });

    it('should handle missing dimensions', async () => {
      (standApi.getStands as jest.Mock).mockResolvedValue({
        data: [
          {
            id: 'stand-3',
            code: 'A3',
            name: 'Stand A3',
            dimensions: null,
            createdAt: '2024-01-01T00:00:00Z',
          },
        ],
        meta: { total: 1, page: 1, pageSize: 50, totalPages: 1 },
      });

      renderWithQueryClient(<StandDataTable organizationId={organizationId} />);

      await waitFor(() => {
        expect(screen.getByText('-')).toBeInTheDocument();
      });
    });
  });
});
