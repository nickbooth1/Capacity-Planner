'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { MapPin, RotateCcw, Maximize2, Info } from 'lucide-react';
import { subDays } from 'date-fns/subDays';
import type { StandMapData, MapFilters } from '../types/map';
import { useTimelineStore } from '../stores/timelineStore';
import { StandDetailPanel } from './StandDetailPanel';
import { TimelineController } from './timeline/TimelineController';

// Dynamic import of map component to avoid SSR issues
const MapContainer = dynamic(() => import('./map/MapContainerOptimized'), {
  ssr: false,
  loading: () => (
    <div className="h-96 flex items-center justify-center bg-gray-50 rounded-lg">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading map...</p>
      </div>
    </div>
  ),
});

interface EnhancedStandMapInterfaceProps {
  stands: StandMapData[];
  selectedStandId?: string;
  onStandSelect: (standId: string) => void;
  filters: MapFilters;
}

export const EnhancedStandMapInterface: React.FC<EnhancedStandMapInterfaceProps> = React.memo(
  ({ stands, selectedStandId, onStandSelect, filters }) => {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [mapInstance, setMapInstance] = useState<any>(null);
    const [isMobile, setIsMobile] = useState(false);
    const [isMapCollapsed, setIsMapCollapsed] = useState(false);
    const [sidePanelOpen, setSidePanelOpen] = useState(false);

    // Timeline state from Zustand store
    const {
      currentDate,
      isPlaying,
      playbackSpeed,
      dateRange,
      timelineData,
      setCurrentDate,
      setIsPlaying,
      setPlaybackSpeed,
      setDateRange,
      loadTimelineData,
    } = useTimelineStore();

    // Initialize timeline with default date range (last 30 days)
    useEffect(() => {
      const endDate = new Date();
      const startDate = subDays(endDate, 30);
      setDateRange(startDate, endDate);
      setCurrentDate(endDate);
    }, [setDateRange, setCurrentDate]);

    // Load timeline data when date range changes
    useEffect(() => {
      if (dateRange.start && dateRange.end && stands.length > 0) {
        loadTimelineData(
          stands.map((s) => s.id),
          dateRange.start,
          dateRange.end
        );
      }
    }, [dateRange, stands, loadTimelineData]);

    // Get current status for each stand based on timeline position
    const standsWithTimelineStatus = useMemo(() => {
      return stands.map((stand) => {
        const standTimeline = timelineData[stand.id];
        if (!standTimeline || !currentDate) {
          return stand;
        }

        // Find the status at the current timeline position
        const timelinePoint = standTimeline
          .filter((point) => new Date(point.timestamp) <= currentDate)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

        return {
          ...stand,
          status: timelinePoint?.status || stand.status,
          timelineEvents: timelinePoint?.events || [],
        };
      });
    }, [stands, timelineData, currentDate]);

    // Filter stands based on current filters
    const filteredStands = useMemo(() => {
      return standsWithTimelineStatus.filter((stand) => {
        if (filters.status && stand.status !== filters.status) return false;
        if (filters.terminal && stand.terminal_code !== filters.terminal) return false;
        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          if (
            !stand.code.toLowerCase().includes(searchLower) &&
            !stand.name.toLowerCase().includes(searchLower)
          ) {
            return false;
          }
        }
        return true;
      });
    }, [standsWithTimelineStatus, filters]);

    // Calculate map bounds
    const bounds = useMemo(() => {
      if (filteredStands.length === 0) return null;

      const lats = filteredStands.map((s) => s.latitude);
      const lngs = filteredStands.map((s) => s.longitude);

      return {
        north: Math.max(...lats),
        south: Math.min(...lats),
        east: Math.max(...lngs),
        west: Math.min(...lngs),
      };
    }, [filteredStands]);

    // Handle marker click
    const handleMarkerClick = useCallback(
      (standId: string) => {
        onStandSelect(standId);
        setSidePanelOpen(true);
      },
      [onStandSelect]
    );

    // Reset map view
    const resetView = () => {
      if (mapInstance && bounds) {
        mapInstance.fitBounds(
          [
            [bounds.south, bounds.west],
            [bounds.north, bounds.east],
          ],
          { padding: [20, 20] }
        );
      }
    };

    // Toggle fullscreen
    const toggleFullscreen = () => {
      setIsFullscreen(!isFullscreen);
      // Announce fullscreen state for screen readers
      const message = !isFullscreen ? 'Entered fullscreen mode' : 'Exited fullscreen mode';
      announceToScreenReader(message);
    };

    // Toggle map collapse on mobile
    const toggleMapCollapse = () => {
      setIsMapCollapsed(!isMapCollapsed);
    };

    // Announce to screen readers
    const announceToScreenReader = (message: string) => {
      const announcement = document.createElement('div');
      announcement.setAttribute('role', 'status');
      announcement.setAttribute('aria-live', 'polite');
      announcement.className = 'sr-only';
      announcement.textContent = message;
      document.body.appendChild(announcement);
      setTimeout(() => document.body.removeChild(announcement), 1000);
    };

    // Handle responsive design
    useEffect(() => {
      const checkMobile = () => {
        setIsMobile(window.innerWidth < 768);
        // Auto-collapse on mobile if too many stands
        if (window.innerWidth < 768 && filteredStands.length > 50 && !isMapCollapsed) {
          setIsMapCollapsed(true);
        }
      };

      checkMobile();
      window.addEventListener('resize', checkMobile);
      return () => window.removeEventListener('resize', checkMobile);
    }, [filteredStands.length, isMapCollapsed]);

    // Handle keyboard navigation
    useEffect(() => {
      const handleKeyboard = (e: KeyboardEvent) => {
        // Escape key handling
        if (e.key === 'Escape' && isFullscreen) {
          setIsFullscreen(false);
          announceToScreenReader('Exited fullscreen mode');
          return;
        }

        // Only handle other keys when map is focused
        if (!document.activeElement?.closest('[data-map-container]')) return;

        switch (e.key) {
          case 'r':
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault();
              resetView();
              announceToScreenReader('Map view reset');
            }
            break;
          case 'f':
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault();
              toggleFullscreen();
            }
            break;
          case 'Tab':
            // Ensure tab navigation works within map
            break;
        }
      };

      document.addEventListener('keydown', handleKeyboard);
      return () => document.removeEventListener('keydown', handleKeyboard);
    }, [isFullscreen]);

    // Handle fullscreen styles
    useEffect(() => {
      if (isFullscreen) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = 'unset';
      }

      return () => {
        document.body.style.overflow = 'unset';
      };
    }, [isFullscreen]);

    const mapHeight = isFullscreen
      ? 'h-screen'
      : isMobile && !isMapCollapsed
        ? 'h-64'
        : 'h-[400px]';

    return (
      <div className="space-y-4">
        {/* Timeline Controller */}
        <TimelineController
          currentDate={currentDate}
          dateRange={dateRange}
          isPlaying={isPlaying}
          playbackSpeed={playbackSpeed}
          onDateChange={setCurrentDate}
          onPlayToggle={() => setIsPlaying(!isPlaying)}
          onSpeedChange={setPlaybackSpeed}
          onDateRangeChange={setDateRange}
          timelineData={timelineData}
        />

        {/* Enhanced Map */}
        <div
          className={`relative bg-white rounded-lg shadow-sm ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}
          role="region"
          aria-label="Interactive map showing aircraft stand locations"
          data-map-container
        >
          {/* Map Header */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center space-x-2 flex-1">
              <MapPin className="w-5 h-5 text-blue-600 flex-shrink-0" aria-hidden="true" />
              <h3 className="text-lg font-semibold">Stand Locations</h3>
              <span className="text-sm text-gray-500" aria-live="polite">
                ({filteredStands.length} stands)
              </span>
            </div>

            <div className="flex items-center space-x-2" role="toolbar" aria-label="Map controls">
              {isMobile && (
                <button
                  onClick={toggleMapCollapse}
                  className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors md:hidden"
                  aria-label={isMapCollapsed ? 'Expand map' : 'Collapse map'}
                  aria-expanded={!isMapCollapsed}
                >
                  <svg
                    className={`w-4 h-4 transition-transform ${isMapCollapsed ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
              )}

              <button
                onClick={resetView}
                className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                aria-label="Reset map view to show all stands"
                title="Reset View (Ctrl+R)"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={toggleFullscreen}
                className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                aria-label={isFullscreen ? 'Exit fullscreen mode' : 'Enter fullscreen mode'}
                title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Fullscreen (Ctrl+F)'}
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Map Container */}
          <div
            className={`${mapHeight} relative transition-all duration-300 ${isMapCollapsed ? 'h-0 overflow-hidden' : ''}`}
            aria-hidden={isMapCollapsed}
          >
            {bounds && !isMapCollapsed && (
              <MapContainer
                stands={filteredStands}
                bounds={bounds}
                selectedStandId={selectedStandId}
                onStandSelect={handleMarkerClick}
                onMapReady={setMapInstance}
              />
            )}
            {!bounds && filteredStands.length === 0 && !isMapCollapsed && (
              <div className="h-full flex items-center justify-center text-gray-500" role="status">
                <div className="text-center">
                  <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" aria-hidden="true" />
                  <p>No stands to display</p>
                </div>
              </div>
            )}
          </div>

          {/* Map Legend */}
          <div className="p-4 bg-gray-50" role="complementary" aria-label="Map legend">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div
                className="flex flex-wrap items-center gap-3 sm:gap-4"
                role="list"
                aria-label="Stand status indicators"
              >
                <div className="flex items-center space-x-2" role="listitem">
                  <div
                    className="w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-sm"
                    aria-hidden="true"
                  ></div>
                  <span className="text-sm text-gray-600">Operational</span>
                </div>
                <div className="flex items-center space-x-2" role="listitem">
                  <div
                    className="w-4 h-4 bg-yellow-500 rounded-full border-2 border-white shadow-sm"
                    aria-hidden="true"
                  ></div>
                  <span className="text-sm text-gray-600">Maintenance</span>
                </div>
                <div className="flex items-center space-x-2" role="listitem">
                  <div
                    className="w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-sm"
                    aria-hidden="true"
                  ></div>
                  <span className="text-sm text-gray-600">Closed</span>
                </div>
              </div>

              <div className="flex items-center space-x-1 text-xs text-gray-500">
                <Info className="w-3 h-3" aria-hidden="true" />
                <span className="hidden sm:inline">Click markers for details</span>
                <span className="sm:hidden">Tap markers for details</span>
              </div>
            </div>

            {/* Keyboard shortcuts help - hidden on mobile */}
            <div className="hidden md:block mt-3 pt-3">
              <p className="text-xs text-gray-500">
                Keyboard shortcuts:{' '}
                <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Ctrl+R</kbd> Reset view •
                <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs ml-2">Ctrl+F</kbd>{' '}
                Fullscreen •<kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs ml-2">Esc</kbd>{' '}
                Exit fullscreen
              </p>
            </div>
          </div>
        </div>

        {/* Side Panel */}
        <StandDetailPanel
          standId={selectedStandId || ''}
          open={sidePanelOpen && !!selectedStandId}
          onClose={() => setSidePanelOpen(false)}
          currentDate={currentDate}
        />
      </div>
    );
  }
);

EnhancedStandMapInterface.displayName = 'EnhancedStandMapInterface';
