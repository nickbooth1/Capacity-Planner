'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StandDataTable, StandStatsCards } from '@/features/stands';
import { EnhancedStandMapInterface } from '@/features/stands/components/EnhancedStandMapInterface';
import { useMapData } from '@/features/stands/hooks/useMapData';
import { MainNavigation } from '@/components/navigation/MainNavigation';
import { Plane } from 'lucide-react';
import type { MapFilters } from '@/features/stands/types/map';

const queryClient = new QueryClient();

function EnhancedStandsPageContent() {
  // TODO: Get from auth context
  const organizationId = 'example-org-id';

  // State for map and table synchronization
  const [selectedStandId, setSelectedStandId] = useState<string>();
  const [filters, setFilters] = useState<MapFilters>({});

  // Fetch map data
  const { data: mapData, isLoading, error } = useMapData();

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Navigation */}
      <MainNavigation />

      {/* Modern Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-xl">
                <Plane className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Stand Management</h1>
                <p className="text-gray-600 mt-1">
                  Manage airport stands with timeline visualization and historical tracking
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        {/* Stats Cards */}
        <StandStatsCards organizationId={organizationId} />

        {/* Enhanced Map Interface with Timeline */}
        {!isLoading && !error && mapData && (
          <div className="mt-8">
            <EnhancedStandMapInterface
              stands={mapData.stands}
              selectedStandId={selectedStandId}
              onStandSelect={setSelectedStandId}
              filters={filters}
            />
          </div>
        )}

        {/* Data Table */}
        <div className="mt-8">
          <StandDataTable
            organizationId={organizationId}
            selectedStandId={selectedStandId}
            onStandSelect={setSelectedStandId}
            onFiltersChange={setFilters}
          />
        </div>
      </div>
    </div>
  );
}

export default function EnhancedStandsPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <EnhancedStandsPageContent />
    </QueryClientProvider>
  );
}
