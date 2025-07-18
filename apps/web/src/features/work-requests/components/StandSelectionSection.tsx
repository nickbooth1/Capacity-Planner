'use client';

import React, { useState, useEffect } from 'react';
import { useFormContext } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { Search, MapPin, Settings, AlertCircle, CheckCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

import type { StandSummaryForWorkRequest } from '../types';
import type { WorkRequestFormData } from '../validation/work-request-schema';

interface StandFilters {
  search: string;
  terminal: string;
  status: string[];
  includeMaintenanceSchedule: boolean;
}

interface StandSelectionSectionProps {
  onStandSelect?: (stand: StandSummaryForWorkRequest) => void;
  selectedStands?: StandSummaryForWorkRequest[];
  multiSelect?: boolean;
}

const StandSelectionSection: React.FC<StandSelectionSectionProps> = ({
  onStandSelect,
  selectedStands = [],
  multiSelect = false,
}) => {
  const {
    setValue,
    watch,
    formState: { errors },
  } = useFormContext<WorkRequestFormData>();
  const [filters, setFilters] = useState<StandFilters>({
    search: '',
    terminal: '',
    status: [],
    includeMaintenanceSchedule: true,
  });

  const selectedAssetId = watch('assetId');

  // Fetch stands from API
  const {
    data: standsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['stands-for-work-request', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.terminal) params.append('terminal', filters.terminal);
      if (filters.status.length > 0) {
        filters.status.forEach((status) => params.append('status', status));
      }
      params.append('includeMaintenanceSchedule', filters.includeMaintenanceSchedule.toString());
      params.append('page', '1');
      params.append('pageSize', '50');

      const response = await fetch(`/api/work/requests/assets/stands?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch stands');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch selected stand details
  const { data: selectedStandData } = useQuery({
    queryKey: ['stand-details', selectedAssetId],
    queryFn: async () => {
      if (!selectedAssetId) return null;
      const response = await fetch(`/api/work/requests/assets/stands/${selectedAssetId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch stand details');
      }
      return response.json();
    },
    enabled: !!selectedAssetId,
  });

  const stands = standsData?.data || [];
  const selectedStand = selectedStandData?.data;

  const handleStandSelect = (stand: StandSummaryForWorkRequest) => {
    setValue('assetId', stand.id);
    setValue('assetType', 'stand');
    onStandSelect?.(stand);
  };

  const handleFilterChange = (key: keyof StandFilters, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational':
        return 'bg-green-100 text-green-800';
      case 'maintenance':
        return 'bg-yellow-100 text-yellow-800';
      case 'closed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="stand-selection">Select Stand *</Label>
        <p className="text-sm text-gray-600">
          Choose the stand that requires work. You can search by stand code, name, or terminal.
        </p>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Search Stands
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="stand-search">Search</Label>
              <Input
                id="stand-search"
                placeholder="Search by code, name, or terminal..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="terminal-filter">Terminal</Label>
              <Select
                value={filters.terminal}
                onValueChange={(value) => handleFilterChange('terminal', value)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="All terminals" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All terminals</SelectItem>
                  <SelectItem value="T1">Terminal 1</SelectItem>
                  <SelectItem value="T2">Terminal 2</SelectItem>
                  <SelectItem value="T3">Terminal 3</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="status-filter">Status</Label>
              <Select
                value={filters.status[0] || ''}
                onValueChange={(value) => handleFilterChange('status', value ? [value] : [])}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All statuses</SelectItem>
                  <SelectItem value="operational">Operational</SelectItem>
                  <SelectItem value="maintenance">Under Maintenance</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load stands. Please try again.
            <Button variant="link" onClick={() => refetch()} className="ml-2 p-0 h-auto">
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Form Validation Error */}
      {errors.assetId && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errors.assetId.message}</AlertDescription>
        </Alert>
      )}

      {/* Stands Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-6 w-20 mb-2" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4 mb-4" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-6 w-20" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : stands.length === 0 ? (
          <div className="col-span-full text-center py-8">
            <p className="text-gray-500">No stands found matching your criteria.</p>
            <Button
              variant="outline"
              onClick={() =>
                setFilters({
                  search: '',
                  terminal: '',
                  status: [],
                  includeMaintenanceSchedule: true,
                })
              }
              className="mt-2"
            >
              Clear Filters
            </Button>
          </div>
        ) : (
          stands.map((stand: StandSummaryForWorkRequest) => (
            <Card
              key={stand.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedAssetId === stand.id ? 'ring-2 ring-blue-500 bg-blue-50' : ''
              }`}
              onClick={() => handleStandSelect(stand)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-lg">{stand.code}</h3>
                    <p className="text-sm text-gray-600">{stand.name}</p>
                  </div>
                  {selectedAssetId === stand.id && (
                    <CheckCircle className="w-5 h-5 text-blue-500" />
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">
                      {stand.terminal} - {stand.pier}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge className={getStatusColor(stand.status)}>
                      {stand.status.replace('_', ' ')}
                    </Badge>

                    {stand.capabilities?.aircraftSize && (
                      <Badge variant="outline">{stand.capabilities.aircraftSize}</Badge>
                    )}

                    {stand.capabilities?.hasPowerSupply && <Badge variant="outline">Power</Badge>}

                    {stand.capabilities?.hasGroundSupport && (
                      <Badge variant="outline">Ground Support</Badge>
                    )}
                  </div>

                  {stand.currentWorkRequests && stand.currentWorkRequests > 0 && (
                    <div className="text-xs text-amber-600">
                      ⚠️ {stand.currentWorkRequests} active work request(s)
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Selected Stand Details */}
      {selectedStand && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Selected Stand: {selectedStand.code}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-2">Basic Information</h4>
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="font-medium">Name:</span> {selectedStand.name}
                  </p>
                  <p>
                    <span className="font-medium">Location:</span> {selectedStand.terminal} -{' '}
                    {selectedStand.pier}
                  </p>
                  <p>
                    <span className="font-medium">Status:</span>
                    <Badge className={`ml-2 ${getStatusColor(selectedStand.status)}`}>
                      {selectedStand.status.replace('_', ' ')}
                    </Badge>
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Capabilities</h4>
                <div className="space-y-1 text-sm">
                  {selectedStand.capabilities?.aircraftSize && (
                    <p>
                      <span className="font-medium">Aircraft Size:</span>{' '}
                      {selectedStand.capabilities.aircraftSize}
                    </p>
                  )}
                  {selectedStand.capabilities?.maxWeight && (
                    <p>
                      <span className="font-medium">Max Weight:</span>{' '}
                      {selectedStand.capabilities.maxWeight} kg
                    </p>
                  )}
                  {selectedStand.capabilities && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedStand.capabilities.hasPowerSupply && (
                        <Badge variant="outline" className="text-xs">
                          Power Supply
                        </Badge>
                      )}
                      {selectedStand.capabilities.hasGroundSupport && (
                        <Badge variant="outline" className="text-xs">
                          Ground Support
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {selectedStand.currentWorkRequests && selectedStand.currentWorkRequests > 0 && (
              <div className="mt-4 p-3 bg-amber-50 rounded-lg">
                <h4 className="font-medium text-amber-800 mb-2">Active Work Requests</h4>
                <div className="text-sm text-amber-700">
                  This stand currently has {selectedStand.currentWorkRequests} active work
                  request(s). Please consider the impact on existing work when scheduling new
                  requests.
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default StandSelectionSection;
