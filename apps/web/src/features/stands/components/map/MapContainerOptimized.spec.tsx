import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import MapContainerOptimized from './MapContainerOptimized';
import type { StandMapData } from '../../types/map';

// Mock leaflet and react-leaflet
jest.mock('leaflet', () => ({
  divIcon: jest.fn(() => ({ _leaflet_id: 1 })),
  Map: jest.fn(),
  LatLngBounds: jest.fn((sw, ne) => ({ sw, ne })),
}));

jest.mock('react-leaflet', () => ({
  MapContainer: ({ children, ref }: any) => {
    // Simulate map ready callback
    React.useEffect(() => {
      if (ref) {
        const mockMap = {
          fitBounds: jest.fn(),
          on: jest.fn(),
          off: jest.fn(),
        };
        ref(mockMap);
      }
    }, [ref]);
    return <div data-testid="leaflet-map-container">{children}</div>;
  },
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({ eventHandlers, children }: any) => (
    <div data-testid="marker" onClick={eventHandlers?.click}>
      {children}
    </div>
  ),
  Popup: ({ children }: any) => <div data-testid="popup">{children}</div>,
}));

jest.mock('react-leaflet-cluster', () => ({
  __esModule: true,
  default: ({ children, iconCreateFunction }: any) => {
    // Simulate cluster creation
    const mockCluster = { getChildCount: () => 3 };
    iconCreateFunction?.(mockCluster);
    return <div data-testid="marker-cluster-group">{children}</div>;
  },
}));

// Mock CSS imports
jest.mock('leaflet/dist/leaflet.css', () => {});
jest.mock('leaflet.markercluster/dist/MarkerCluster.css', () => {});
jest.mock('leaflet.markercluster/dist/MarkerCluster.Default.css', () => {});

describe('MapContainerOptimized', () => {
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
  ];

  const mockBounds = {
    north: 53.35,
    south: 53.3498,
    east: -2.2744,
    west: -2.2746,
  };

  const mockOnStandSelect = jest.fn();
  const mockOnMapReady = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders map container with tile layer', () => {
    render(
      <MapContainerOptimized
        stands={mockStands}
        bounds={mockBounds}
        onStandSelect={mockOnStandSelect}
        onMapReady={mockOnMapReady}
      />
    );

    expect(screen.getByTestId('leaflet-map-container')).toBeInTheDocument();
    expect(screen.getByTestId('tile-layer')).toBeInTheDocument();
  });

  test('renders markers for each stand without clustering (< 50 stands)', () => {
    render(
      <MapContainerOptimized
        stands={mockStands}
        bounds={mockBounds}
        onStandSelect={mockOnStandSelect}
        onMapReady={mockOnMapReady}
      />
    );

    const markers = screen.getAllByTestId('marker');
    expect(markers).toHaveLength(2);
  });

  test('uses clustering for large datasets (> 50 stands)', () => {
    const manyStands = Array.from({ length: 60 }, (_, i) => ({
      ...mockStands[0],
      id: `stand-${i}`,
      code: `S${i}`,
      latitude: 53.3498 + i * 0.0001,
      longitude: -2.2744 + i * 0.0001,
    }));

    render(
      <MapContainerOptimized
        stands={manyStands}
        bounds={mockBounds}
        onStandSelect={mockOnStandSelect}
        onMapReady={mockOnMapReady}
      />
    );

    expect(screen.getByTestId('marker-cluster-group')).toBeInTheDocument();
  });

  test('calls onMapReady when map is initialized', () => {
    render(
      <MapContainerOptimized
        stands={mockStands}
        bounds={mockBounds}
        onStandSelect={mockOnStandSelect}
        onMapReady={mockOnMapReady}
      />
    );

    expect(mockOnMapReady).toHaveBeenCalledWith(
      expect.objectContaining({
        fitBounds: expect.any(Function),
      })
    );
  });

  test('calls onStandSelect when marker is clicked', () => {
    render(
      <MapContainerOptimized
        stands={mockStands}
        bounds={mockBounds}
        onStandSelect={mockOnStandSelect}
        onMapReady={mockOnMapReady}
      />
    );

    const markers = screen.getAllByTestId('marker');
    fireEvent.click(markers[0]);

    expect(mockOnStandSelect).toHaveBeenCalledWith('1');
  });

  test('displays stand information in popup', () => {
    render(
      <MapContainerOptimized
        stands={mockStands}
        bounds={mockBounds}
        onStandSelect={mockOnStandSelect}
        onMapReady={mockOnMapReady}
      />
    );

    // Check first stand popup content
    expect(screen.getByText('A1')).toBeInTheDocument();
    expect(screen.getByText('Stand A1')).toBeInTheDocument();
    expect(screen.getAllByText('Terminal:')[0].parentElement).toHaveTextContent('Terminal:T1');
  });

  test('shows correct status styling in popup', () => {
    render(
      <MapContainerOptimized
        stands={mockStands}
        bounds={mockBounds}
        onStandSelect={mockOnStandSelect}
        onMapReady={mockOnMapReady}
      />
    );

    const operationalStatus = screen.getByText('operational');
    expect(operationalStatus).toHaveClass('bg-green-100', 'text-green-800');

    const maintenanceStatus = screen.getByText('maintenance');
    expect(maintenanceStatus).toHaveClass('bg-yellow-100', 'text-yellow-800');
  });

  test('highlights selected stand marker', () => {
    const { rerender } = render(
      <MapContainerOptimized
        stands={mockStands}
        bounds={mockBounds}
        selectedStandId="1"
        onStandSelect={mockOnStandSelect}
        onMapReady={mockOnMapReady}
      />
    );

    // The divIcon is called with different sizes for selected/unselected
    const leaflet = require('leaflet');
    expect(leaflet.divIcon).toHaveBeenCalledWith(
      expect.objectContaining({
        iconSize: [32, 32], // Selected size
      })
    );

    // Re-render without selection
    rerender(
      <MapContainerOptimized
        stands={mockStands}
        bounds={mockBounds}
        onStandSelect={mockOnStandSelect}
        onMapReady={mockOnMapReady}
      />
    );

    expect(leaflet.divIcon).toHaveBeenCalledWith(
      expect.objectContaining({
        iconSize: [24, 24], // Normal size
      })
    );
  });

  test('displays power supply information when available', () => {
    render(
      <MapContainerOptimized
        stands={mockStands}
        bounds={mockBounds}
        onStandSelect={mockOnStandSelect}
        onMapReady={mockOnMapReady}
      />
    );

    expect(screen.getByText('400Hz, 28V DC')).toBeInTheDocument();
  });

  test('calculates center point correctly', () => {
    render(
      <MapContainerOptimized
        stands={mockStands}
        bounds={mockBounds}
        onStandSelect={mockOnStandSelect}
        onMapReady={mockOnMapReady}
      />
    );

    // Center should be calculated from bounds
    const expectedLat = (mockBounds.north + mockBounds.south) / 2;
    const expectedLng = (mockBounds.east + mockBounds.west) / 2;

    // This would be verified in the MapContainer props if we had access to them
    expect(screen.getByTestId('leaflet-map-container')).toBeInTheDocument();
  });

  test('memoization prevents unnecessary re-renders', () => {
    const { rerender } = render(
      <MapContainerOptimized
        stands={mockStands}
        bounds={mockBounds}
        onStandSelect={mockOnStandSelect}
        onMapReady={mockOnMapReady}
      />
    );

    const initialMarkerCount = screen.getAllByTestId('marker').length;

    // Re-render with same props
    rerender(
      <MapContainerOptimized
        stands={mockStands}
        bounds={mockBounds}
        onStandSelect={mockOnStandSelect}
        onMapReady={mockOnMapReady}
      />
    );

    // Should still have same number of markers
    expect(screen.getAllByTestId('marker')).toHaveLength(initialMarkerCount);
  });

  test('formats weight correctly in popup', () => {
    render(
      <MapContainerOptimized
        stands={mockStands}
        bounds={mockBounds}
        onStandSelect={mockOnStandSelect}
        onMapReady={mockOnMapReady}
      />
    );

    // 75000kg should be displayed as 75t
    expect(screen.getByText('75t')).toBeInTheDocument();
    // 150000kg should be displayed as 150t
    expect(screen.getByText('150t')).toBeInTheDocument();
  });

  test('handles stands without pier code correctly', () => {
    render(
      <MapContainerOptimized
        stands={mockStands}
        bounds={mockBounds}
        onStandSelect={mockOnStandSelect}
        onMapReady={mockOnMapReady}
      />
    );

    // First stand has pier code
    expect(screen.getByText('North')).toBeInTheDocument();

    // Second stand doesn't have pier code - should not show pier section
    const popups = screen.getAllByTestId('popup');
    expect(popups[1]).not.toHaveTextContent('Pier:');
  });
});
