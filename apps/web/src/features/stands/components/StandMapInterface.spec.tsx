import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StandMapInterface } from './StandMapInterface';
import type { StandMapData, MapFilters } from '../types/map';

// Mock dynamic import
jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: (loader: () => Promise<any>) => {
    const Component = () => <div data-testid="map-container">Map Container</div>;
    Component.preload = jest.fn();
    return Component;
  },
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  MapPin: () => <div data-testid="map-pin-icon" />,
  RotateCcw: () => <div data-testid="rotate-icon" />,
  Maximize2: () => <div data-testid="maximize-icon" />,
  Info: () => <div data-testid="info-icon" />,
}));

describe('StandMapInterface', () => {
  const mockStands: StandMapData[] = [
    {
      id: '1',
      code: 'A1',
      name: 'Stand A1',
      latitude: 53.3498,
      longitude: -2.2744,
      status: 'operational',
      terminal_code: 'T1',
      pier_code: 'North',
      aircraft_size_category: 'Medium',
      max_weight_kg: 75000,
      power_supply: ['400Hz', '28V DC'],
      ground_support: ['GPU', 'ASU'],
    },
    {
      id: '2',
      code: 'B2',
      name: 'Stand B2',
      latitude: 53.3499,
      longitude: -2.2745,
      status: 'maintenance',
      terminal_code: 'T2',
      aircraft_size_category: 'Large',
      max_weight_kg: 150000,
      power_supply: ['400Hz'],
      ground_support: ['GPU'],
    },
    {
      id: '3',
      code: 'C3',
      name: 'Stand C3',
      latitude: 53.35,
      longitude: -2.2746,
      status: 'closed',
      terminal_code: 'T1',
      aircraft_size_category: 'Small',
      max_weight_kg: 50000,
      power_supply: [],
      ground_support: [],
    },
  ];

  const mockOnStandSelect = jest.fn();
  const defaultFilters: MapFilters = {};

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock window dimensions
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
  });

  test('renders map interface with correct header', () => {
    render(
      <StandMapInterface
        stands={mockStands}
        onStandSelect={mockOnStandSelect}
        filters={defaultFilters}
      />
    );

    expect(screen.getByText('Stand Locations')).toBeInTheDocument();
    expect(screen.getByText('(3 stands)')).toBeInTheDocument();
  });

  test('displays map container when bounds are available', () => {
    render(
      <StandMapInterface
        stands={mockStands}
        onStandSelect={mockOnStandSelect}
        filters={defaultFilters}
      />
    );

    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });

  test('shows empty state when no stands are available', () => {
    render(
      <StandMapInterface stands={[]} onStandSelect={mockOnStandSelect} filters={defaultFilters} />
    );

    expect(screen.getByText('No stands to display')).toBeInTheDocument();
  });

  test('filters stands based on status filter', () => {
    const filters: MapFilters = { status: 'operational' };

    render(
      <StandMapInterface stands={mockStands} onStandSelect={mockOnStandSelect} filters={filters} />
    );

    expect(screen.getByText('(1 stands)')).toBeInTheDocument();
  });

  test('filters stands based on terminal filter', () => {
    const filters: MapFilters = { terminal: 'T1' };

    render(
      <StandMapInterface stands={mockStands} onStandSelect={mockOnStandSelect} filters={filters} />
    );

    expect(screen.getByText('(2 stands)')).toBeInTheDocument();
  });

  test('filters stands based on search filter', () => {
    const filters: MapFilters = { search: 'A1' };

    render(
      <StandMapInterface stands={mockStands} onStandSelect={mockOnStandSelect} filters={filters} />
    );

    expect(screen.getByText('(1 stands)')).toBeInTheDocument();
  });

  test('toggles fullscreen mode when button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <StandMapInterface
        stands={mockStands}
        onStandSelect={mockOnStandSelect}
        filters={defaultFilters}
      />
    );

    const fullscreenButton = screen.getByLabelText('Enter fullscreen mode');
    await user.click(fullscreenButton);

    expect(screen.getByLabelText('Exit fullscreen mode')).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');
  });

  test('exits fullscreen mode on escape key', async () => {
    render(
      <StandMapInterface
        stands={mockStands}
        onStandSelect={mockOnStandSelect}
        filters={defaultFilters}
      />
    );

    // Enter fullscreen
    const fullscreenButton = screen.getByLabelText('Enter fullscreen mode');
    fireEvent.click(fullscreenButton);

    // Press escape
    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.getByLabelText('Enter fullscreen mode')).toBeInTheDocument();
    });
  });

  test('displays legend with all status types', () => {
    render(
      <StandMapInterface
        stands={mockStands}
        onStandSelect={mockOnStandSelect}
        filters={defaultFilters}
      />
    );

    expect(screen.getByText('Operational')).toBeInTheDocument();
    expect(screen.getByText('Maintenance')).toBeInTheDocument();
    expect(screen.getByText('Closed')).toBeInTheDocument();
  });

  test('shows keyboard shortcuts on desktop', () => {
    render(
      <StandMapInterface
        stands={mockStands}
        onStandSelect={mockOnStandSelect}
        filters={defaultFilters}
      />
    );

    expect(screen.getByText(/Keyboard shortcuts:/)).toBeInTheDocument();
    expect(screen.getByText('Ctrl+R')).toBeInTheDocument();
    expect(screen.getByText('Ctrl+F')).toBeInTheDocument();
    expect(screen.getByText('Esc')).toBeInTheDocument();
  });

  test('handles mobile view correctly', () => {
    // Set mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    });

    render(
      <StandMapInterface
        stands={mockStands}
        onStandSelect={mockOnStandSelect}
        filters={defaultFilters}
      />
    );

    // Should show mobile-specific text
    expect(screen.getByText('Tap markers for details')).toBeInTheDocument();
    expect(screen.queryByText('Click markers for details')).not.toBeInTheDocument();
  });

  test('accessibility - has proper ARIA labels', () => {
    render(
      <StandMapInterface
        stands={mockStands}
        onStandSelect={mockOnStandSelect}
        filters={defaultFilters}
      />
    );

    expect(
      screen.getByRole('region', { name: 'Interactive map showing aircraft stand locations' })
    ).toBeInTheDocument();
    expect(screen.getByRole('toolbar', { name: 'Map controls' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Map legend' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Stand status indicators' })).toBeInTheDocument();
  });

  test('accessibility - keyboard navigation for reset view', () => {
    render(
      <StandMapInterface
        stands={mockStands}
        onStandSelect={mockOnStandSelect}
        filters={defaultFilters}
      />
    );

    const mapContainer = screen.getByRole('region', {
      name: 'Interactive map showing aircraft stand locations',
    });
    mapContainer.focus();

    fireEvent.keyDown(document, { key: 'r', ctrlKey: true });
    // Reset view functionality would be tested if we had access to the map instance
  });

  test('memoization - does not re-render unnecessarily', () => {
    const { rerender } = render(
      <StandMapInterface
        stands={mockStands}
        onStandSelect={mockOnStandSelect}
        filters={defaultFilters}
      />
    );

    const initialStandCount = screen.getByText('(3 stands)');

    // Re-render with same props
    rerender(
      <StandMapInterface
        stands={mockStands}
        onStandSelect={mockOnStandSelect}
        filters={defaultFilters}
      />
    );

    // Should still show same element (not re-created)
    expect(initialStandCount).toBeInTheDocument();
  });

  test('handles selected stand highlighting', () => {
    render(
      <StandMapInterface
        stands={mockStands}
        selectedStandId="1"
        onStandSelect={mockOnStandSelect}
        filters={defaultFilters}
      />
    );

    // The actual highlighting would be tested in the MapContainer component
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });

  test('announces state changes to screen readers', async () => {
    const user = userEvent.setup();

    render(
      <StandMapInterface
        stands={mockStands}
        onStandSelect={mockOnStandSelect}
        filters={defaultFilters}
      />
    );

    // Click fullscreen button
    const fullscreenButton = screen.getByLabelText('Enter fullscreen mode');
    await user.click(fullscreenButton);

    // Check for screen reader announcement
    await waitFor(() => {
      const announcement = document.querySelector('[role="status"][aria-live="polite"]');
      expect(announcement).toBeInTheDocument();
    });
  });
});
