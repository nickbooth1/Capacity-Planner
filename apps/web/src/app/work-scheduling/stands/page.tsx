'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MainNavigation } from '@/components/navigation/MainNavigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  Wrench,
  CheckCircle,
  Calendar,
  Plus,
  RefreshCw,
  Filter,
  MoreHorizontal,
  AlertTriangle,
  BarChart3,
  Target,
  Building,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';

const queryClient = new QueryClient();

// Mock data for the work scheduling dashboard
const mockStats = [
  {
    title: 'Pending Orders',
    value: 0,
    subtitle: 'Awaiting approval',
    icon: Clock,
    color: 'text-yellow-600',
  },
  {
    title: 'In Progress',
    value: 0,
    subtitle: 'Currently active',
    icon: Wrench,
    color: 'text-blue-600',
  },
  {
    title: 'Completed This Week',
    value: 0,
    subtitle: 'Successfully finished',
    icon: CheckCircle,
    color: 'text-green-600',
  },
  {
    title: 'Total This Week',
    value: 0,
    subtitle: 'New orders',
    icon: Calendar,
    color: 'text-purple-600',
  },
];

const mockWorkOrders = [
  {
    id: 'MNT-805227',
    stand: 'Stand 101',
    terminal: 'Terminal 1',
    workType: 'Emergency',
    priority: 'High',
    status: 'Approved',
    description: 'Test',
    requestedBy: 'Nick',
    scheduled: '02/07/2025',
    impact: 'No impact',
  },
];

function StandWorkSchedulingContent() {
  const [filter, setFilter] = useState('');

  const sidebarItems = [
    {
      name: 'Overview',
      href: '/work-scheduling',
      icon: BarChart3,
      description: 'Work scheduling dashboard',
    },
    {
      name: 'Stands',
      href: '/work-scheduling/stands',
      icon: Target,
      description: 'Stand maintenance and work orders',
      active: true,
    },
    {
      name: 'Gates',
      href: '/work-scheduling/gates',
      icon: Building,
      description: 'Gate maintenance',
      disabled: true,
    },
    {
      name: 'Facilities',
      href: '/work-scheduling/facilities',
      icon: Building,
      description: 'Facility maintenance',
      disabled: true,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <MainNavigation />

      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-white min-h-screen border-r border-gray-200">
          <div className="p-6">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-10 h-10 bg-orange-100 rounded-lg">
                <Wrench className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Work Scheduling</h2>
                <p className="text-sm text-gray-500">Manage maintenance and work orders</p>
              </div>
            </div>
          </div>

          <nav className="px-4 pb-4 space-y-2">
            {sidebarItems.map((item) => {
              const isActive = item.active;
              const Icon = item.icon;

              if (item.disabled) {
                return (
                  <div
                    key={item.name}
                    className="flex items-center space-x-3 px-4 py-3 text-sm font-medium text-gray-400 cursor-not-allowed"
                  >
                    <Icon className="w-5 h-5" />
                    <div className="flex-1">
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-gray-400">{item.description}</div>
                    </div>
                    <span className="text-xs px-2 py-1 bg-gray-100 text-gray-500 rounded">
                      Soon
                    </span>
                  </div>
                );
              }

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-orange-50 text-orange-700'
                      : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <div className="flex-1">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-gray-500">{item.description}</div>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-4">
              <Link href="/work-scheduling">
                <Button variant="ghost" size="sm" className="flex items-center space-x-2">
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Overview</span>
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Stand Work Scheduling</h1>
                <p className="text-gray-600 mt-1">
                  Manage work orders and maintenance schedules for aircraft stands
                </p>
              </div>
            </div>
            <Button className="flex items-center space-x-2">
              <Plus className="w-4 h-4" />
              <span>New Work Order</span>
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

          {/* Work Orders Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Stand Work Orders</CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    View and manage all work orders for aircraft stands
                  </p>
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
                  placeholder="Filter requestNumber..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="max-w-sm"
                />
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-700">
                        Work Order #
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Stand</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Terminal</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Work Type</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Priority</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Description</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">
                        Requested By
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Scheduled</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Impact</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockWorkOrders.map((order) => (
                      <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-4 px-4 font-medium text-gray-900">{order.id}</td>
                        <td className="py-4 px-4 text-gray-700">{order.stand}</td>
                        <td className="py-4 px-4 text-gray-700">{order.terminal}</td>
                        <td className="py-4 px-4">
                          <Badge variant="destructive" className="bg-red-100 text-red-800">
                            {order.workType}
                          </Badge>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center space-x-1">
                            <AlertTriangle className="w-4 h-4 text-orange-500" />
                            <span className="text-gray-700">{order.priority}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            {order.status}
                          </Badge>
                        </td>
                        <td className="py-4 px-4 text-gray-700">{order.description}</td>
                        <td className="py-4 px-4 text-gray-700">{order.requestedBy}</td>
                        <td className="py-4 px-4 text-gray-700">{order.scheduled}</td>
                        <td className="py-4 px-4 text-gray-700">{order.impact}</td>
                        <td className="py-4 px-4">
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-gray-700">0 of 1 row(s) selected.</p>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-700">Rows per page</span>
                  <select className="border border-gray-300 rounded px-2 py-1 text-sm">
                    <option>10</option>
                    <option>20</option>
                    <option>50</option>
                  </select>
                  <span className="text-sm text-gray-700">Page 1 of 1</span>
                  <div className="flex space-x-1">
                    <Button variant="outline" size="sm" disabled>
                      Previous
                    </Button>
                    <Button variant="outline" size="sm" disabled>
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function StandWorkSchedulingPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <StandWorkSchedulingContent />
    </QueryClientProvider>
  );
}
