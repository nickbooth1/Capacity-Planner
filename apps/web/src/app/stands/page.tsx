'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StandDataTable } from '@/features/stands';
import { MainNavigation } from '@/components/navigation/MainNavigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Plane,
  Plus,
  Filter,
  RefreshCw,
  Target,
  Building,
  BarChart3,
  MapPin,
  Wrench,
  Clock,
  CheckCircle,
  Calendar,
} from 'lucide-react';
import Link from 'next/link';
import type { MapFilters } from '@/features/stands/types/map';

const queryClient = new QueryClient();

// Clean stats data matching the reference design
const mockStats = [
  {
    title: 'Total Stands',
    value: 27,
    subtitle: 'Operational',
    icon: Target,
    color: 'text-blue-600',
  },
  {
    title: 'Maintenance',
    value: 3,
    subtitle: 'Under maintenance',
    icon: Wrench,
    color: 'text-orange-600',
  },
  {
    title: 'Available',
    value: 24,
    subtitle: 'Ready for use',
    icon: CheckCircle,
    color: 'text-green-600',
  },
  {
    title: 'Closed',
    value: 0,
    subtitle: 'Out of service',
    icon: Building,
    color: 'text-red-600',
  },
];

function StandsPageContent() {
  const organizationId = 'example-org-id';
  const [filter, setFilter] = useState('');
  const [filters, setFilters] = useState<MapFilters>({});
  const [selectedStandId, setSelectedStandId] = useState<string>();

  const handleFilterChange = (newFilters: MapFilters) => {
    setFilters(newFilters);
  };

  const handleStandSelect = (standId: string) => {
    setSelectedStandId(standId);
  };

  const sidebarItems = [
    {
      name: 'Stands',
      href: '/stands',
      icon: Plane,
      description: 'Stand maintenance and work orders',
      active: true,
    },
    {
      name: 'Gates',
      href: '/gates',
      icon: Target,
      description: 'Gate maintenance',
      disabled: true,
    },
    {
      name: 'Airfield',
      href: '/airfield',
      icon: MapPin,
      description: 'Airfield maintenance',
      disabled: true,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <MainNavigation />

      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-white min-h-screen border-r border-gray-200">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-lg">
                <Building className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Asset Module</h2>
                <p className="text-sm text-gray-500">Manage airport assets</p>
              </div>
            </div>
          </div>

          <nav className="p-4">
            <div className="space-y-2">
              {sidebarItems.map((item) => {
                const isActive = item.active;
                const Icon = item.icon;

                if (item.disabled) {
                  return (
                    <div
                      key={item.name}
                      className="flex items-center px-3 py-4 rounded-lg cursor-not-allowed group"
                    >
                      <Icon className="w-5 h-5 text-gray-400 mr-3 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-400 truncate">
                          {item.name}
                        </div>
                        <div className="text-xs text-gray-400 truncate">{item.description}</div>
                      </div>
                      <span className="text-xs px-2 py-1 bg-gray-100 text-gray-500 rounded-full ml-2 flex-shrink-0">
                        Soon
                      </span>
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center px-3 py-4 rounded-lg transition-all duration-200 group ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 mr-3 flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{item.name}</div>
                      <div className="text-xs text-gray-500 truncate">{item.description}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Stand Management</h1>
                <p className="text-gray-600 mt-1">
                  Manage airport stands with timeline visualization and historical tracking
                </p>
              </div>
            </div>
            <Button className="flex items-center space-x-2">
              <Plus className="w-4 h-4" />
              <span>Add Stand</span>
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {mockStats.map((stat) => (
              <Card key={stat.title}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                      <p className="text-sm text-gray-500 mt-1">{stat.subtitle}</p>
                    </div>
                    <div className={`p-3 rounded-lg bg-gray-50 ${stat.color}`}>
                      <stat.icon className="w-6 h-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Stand Data Table - Main Focus */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Stand Data</CardTitle>
                  <p className="text-sm text-gray-600 mt-1">View and manage all airport stands</p>
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                  <Button variant="outline" size="sm">
                    <Filter className="w-4 h-4 mr-2" />
                    Filters
                  </Button>
                  <Button variant="outline" size="sm">
                    View
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Search and Filter */}
              <div className="mb-6">
                <Input
                  placeholder="Filter stands..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="max-w-sm"
                />
              </div>

              {/* Data Table */}
              <StandDataTable
                organizationId={organizationId}
                selectedStandId={selectedStandId}
                onStandSelect={handleStandSelect}
                onFiltersChange={handleFilterChange}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function StandsPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <StandsPageContent />
    </QueryClientProvider>
  );
}
