'use client';

import React, { useEffect, useRef } from 'react';
import { MapContainer as LeafletMapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { divIcon, Map as LeafletMap } from 'leaflet';
import type { StandMapData } from '../../types/map';
import 'leaflet/dist/leaflet.css';

interface MapContainerProps {
  stands: StandMapData[];
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  selectedStandId?: string;
  onStandSelect: (standId: string) => void;
  onMapReady: (map: LeafletMap) => void;
}

const MapContainer: React.FC<MapContainerProps> = ({
  stands,
  bounds,
  selectedStandId,
  onStandSelect,
  onMapReady,
}) => {
  const mapRef = useRef<LeafletMap | null>(null);

  // Create custom markers based on status
  const createMarkerIcon = (status: string, isSelected: boolean) => {
    const colors = {
      operational: '#10b981', // green
      maintenance: '#f59e0b', // yellow
      closed: '#ef4444', // red
    };

    const size = isSelected ? 32 : 24;
    const color = colors[status as keyof typeof colors] || '#6b7280';

    return divIcon({
      html: `
        <div style="
          width: ${size}px;
          height: ${size}px;
          background-color: ${color};
          border: 2px solid white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          ${isSelected ? 'box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.5);' : ''}
          transition: all 0.2s ease;
        ">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </div>
      `,
      className: 'custom-marker',
      iconSize: [size, size],
      iconAnchor: [size / 2, size],
    });
  };

  // Set initial bounds when map is ready
  useEffect(() => {
    if (mapRef.current && bounds) {
      mapRef.current.fitBounds(
        [
          [bounds.south, bounds.west],
          [bounds.north, bounds.east],
        ],
        { padding: [20, 20] }
      );
    }
  }, [bounds]);

  const center = {
    lat: (bounds.north + bounds.south) / 2,
    lng: (bounds.east + bounds.west) / 2,
  };

  return (
    <LeafletMapContainer
      center={[center.lat, center.lng]}
      zoom={14}
      className="h-full w-full"
      ref={(map) => {
        if (map) {
          mapRef.current = map;
          onMapReady(map);
        }
      }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {stands.map((stand) => (
        <Marker
          key={stand.id}
          position={[stand.latitude, stand.longitude]}
          icon={createMarkerIcon(stand.status, stand.id === selectedStandId)}
          eventHandlers={{
            click: () => onStandSelect(stand.id),
          }}
        >
          <Popup>
            <div className="p-2 min-w-[200px]">
              <h4 className="font-semibold text-base mb-2">{stand.code}</h4>
              <div className="space-y-1 text-sm">
                <p className="text-gray-600">{stand.name}</p>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Status:</span>
                  <span
                    className={`ml-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      stand.status === 'operational'
                        ? 'bg-green-100 text-green-800'
                        : stand.status === 'maintenance'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {stand.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Terminal:</span>
                  <span>{stand.terminal_code}</span>
                </div>
                {stand.pier_code && (
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Pier:</span>
                    <span>{stand.pier_code}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="font-medium">Size:</span>
                  <span>{stand.aircraft_size_category}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Max Weight:</span>
                  <span>{(stand.max_weight_kg / 1000).toFixed(0)}t</span>
                </div>
              </div>
              {stand.power_supply && stand.power_supply.length > 0 && (
                <div className="mt-2 pt-2 border-t">
                  <p className="text-xs text-gray-600">
                    <span className="font-medium">Power:</span> {stand.power_supply.join(', ')}
                  </p>
                </div>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </LeafletMapContainer>
  );
};

export default MapContainer;
