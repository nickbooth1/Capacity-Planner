import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StandForm } from './StandForm';
import { standApi } from '../api/stand-api';

// Mock the API
jest.mock('../api/stand-api');

const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>);
};

describe('StandForm', () => {
  const organizationId = 'test-org-id';
  const mockOnSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Create Mode', () => {
    it('should render all form fields', () => {
      renderWithQueryClient(
        <StandForm organizationId={organizationId} onSuccess={mockOnSuccess} />
      );

      expect(screen.getByLabelText('Code')).toBeInTheDocument();
      expect(screen.getByLabelText('Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Terminal')).toBeInTheDocument();
      expect(screen.getByLabelText('Status')).toBeInTheDocument();
      expect(screen.getByLabelText('Length (m)')).toBeInTheDocument();
      expect(screen.getByLabelText('Width (m)')).toBeInTheDocument();
      expect(screen.getByLabelText('Height (m)')).toBeInTheDocument();
      expect(screen.getByLabelText('Max Wingspan (m)')).toBeInTheDocument();
      expect(screen.getByLabelText('Max Length (m)')).toBeInTheDocument();
      expect(screen.getByLabelText('Max Weight (kg)')).toBeInTheDocument();
      expect(screen.getByLabelText('Latitude')).toBeInTheDocument();
      expect(screen.getByLabelText('Longitude')).toBeInTheDocument();
      expect(screen.getByText('Create Stand')).toBeInTheDocument();
    });

    it('should validate required fields', async () => {
      renderWithQueryClient(
        <StandForm organizationId={organizationId} onSuccess={mockOnSuccess} />
      );

      const submitButton = screen.getByText('Create Stand');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Code is required')).toBeInTheDocument();
        expect(screen.getByText('Name is required')).toBeInTheDocument();
      });
    });

    it('should submit form with valid data', async () => {
      const mockCreateResponse = {
        id: 'stand-1',
        code: 'A1',
        name: 'Stand A1',
        version: 1,
      };

      (standApi.createStand as jest.Mock).mockResolvedValue(mockCreateResponse);

      renderWithQueryClient(
        <StandForm organizationId={organizationId} onSuccess={mockOnSuccess} />
      );

      // Fill in required fields
      await userEvent.type(screen.getByLabelText('Code'), 'A1');
      await userEvent.type(screen.getByLabelText('Name'), 'Stand A1');
      await userEvent.type(screen.getByLabelText('Terminal'), 'Terminal 1');

      // Fill in dimensions
      await userEvent.type(screen.getByLabelText('Length (m)'), '60');
      await userEvent.type(screen.getByLabelText('Width (m)'), '30');

      // Select status
      fireEvent.click(screen.getByLabelText('Status'));
      fireEvent.click(screen.getByText('Operational'));

      // Submit form
      fireEvent.click(screen.getByText('Create Stand'));

      await waitFor(() => {
        expect(standApi.createStand).toHaveBeenCalledWith(
          organizationId,
          expect.objectContaining({
            code: 'A1',
            name: 'Stand A1',
            terminal: 'Terminal 1',
            status: 'operational',
            dimensions: {
              length: 60,
              width: 30,
            },
          })
        );
        expect(mockOnSuccess).toHaveBeenCalled();
      });
    });

    it('should handle API errors', async () => {
      (standApi.createStand as jest.Mock).mockRejectedValue(
        new Error('Stand with code A1 already exists')
      );

      renderWithQueryClient(
        <StandForm organizationId={organizationId} onSuccess={mockOnSuccess} />
      );

      await userEvent.type(screen.getByLabelText('Code'), 'A1');
      await userEvent.type(screen.getByLabelText('Name'), 'Stand A1');

      fireEvent.click(screen.getByText('Create Stand'));

      await waitFor(() => {
        expect(mockOnSuccess).not.toHaveBeenCalled();
      });
    });
  });

  describe('Edit Mode', () => {
    const mockStand = {
      id: 'stand-1',
      code: 'A1',
      name: 'Stand A1',
      terminal: 'Terminal 1',
      status: 'operational' as const,
      version: 1,
      dimensions: {
        length: 60,
        width: 30,
      },
      aircraftCompatibility: {
        maxWingspan: 65,
      },
      latitude: 51.47,
      longitude: -0.4543,
    };

    it('should populate form with existing stand data', () => {
      renderWithQueryClient(
        <StandForm organizationId={organizationId} stand={mockStand} onSuccess={mockOnSuccess} />
      );

      expect(screen.getByDisplayValue('A1')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Stand A1')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Terminal 1')).toBeInTheDocument();
      expect(screen.getByDisplayValue('60')).toBeInTheDocument();
      expect(screen.getByDisplayValue('30')).toBeInTheDocument();
      expect(screen.getByDisplayValue('65')).toBeInTheDocument();
      expect(screen.getByDisplayValue('51.47')).toBeInTheDocument();
      expect(screen.getByDisplayValue('-0.4543')).toBeInTheDocument();
      expect(screen.getByText('Update Stand')).toBeInTheDocument();
    });

    it('should submit update with changed data', async () => {
      const mockUpdateResponse = {
        ...mockStand,
        name: 'Updated Stand A1',
        version: 2,
      };

      (standApi.updateStand as jest.Mock).mockResolvedValue(mockUpdateResponse);

      renderWithQueryClient(
        <StandForm organizationId={organizationId} stand={mockStand} onSuccess={mockOnSuccess} />
      );

      // Update name
      const nameInput = screen.getByLabelText('Name');
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, 'Updated Stand A1');

      // Submit form
      fireEvent.click(screen.getByText('Update Stand'));

      await waitFor(() => {
        expect(standApi.updateStand).toHaveBeenCalledWith(
          mockStand.id,
          organizationId,
          expect.objectContaining({
            name: 'Updated Stand A1',
            version: mockStand.version,
          })
        );
        expect(mockOnSuccess).toHaveBeenCalled();
      });
    });
  });

  describe('Form Interactions', () => {
    it('should handle numeric input correctly', async () => {
      renderWithQueryClient(
        <StandForm organizationId={organizationId} onSuccess={mockOnSuccess} />
      );

      const lengthInput = screen.getByLabelText('Length (m)');
      await userEvent.type(lengthInput, '60.5');
      expect(lengthInput).toHaveValue(60.5);

      // Test invalid numeric input
      await userEvent.clear(lengthInput);
      await userEvent.type(lengthInput, 'abc');
      expect(lengthInput).toHaveValue(null);
    });

    it('should disable submit button while loading', async () => {
      (standApi.createStand as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      renderWithQueryClient(
        <StandForm organizationId={organizationId} onSuccess={mockOnSuccess} />
      );

      await userEvent.type(screen.getByLabelText('Code'), 'A1');
      await userEvent.type(screen.getByLabelText('Name'), 'Stand A1');

      fireEvent.click(screen.getByText('Create Stand'));

      await waitFor(() => {
        expect(screen.getByText('Saving...')).toBeInTheDocument();
        expect(screen.getByText('Saving...')).toBeDisabled();
      });
    });

    it('should reset form after successful creation', async () => {
      (standApi.createStand as jest.Mock).mockResolvedValue({
        id: 'stand-1',
        code: 'A1',
        name: 'Stand A1',
      });

      renderWithQueryClient(
        <StandForm organizationId={organizationId} onSuccess={mockOnSuccess} />
      );

      await userEvent.type(screen.getByLabelText('Code'), 'A1');
      await userEvent.type(screen.getByLabelText('Name'), 'Stand A1');

      fireEvent.click(screen.getByText('Create Stand'));

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
      });

      // Check that form fields are reset
      expect(screen.getByLabelText('Code')).toHaveValue('');
      expect(screen.getByLabelText('Name')).toHaveValue('');
    });
  });
});
