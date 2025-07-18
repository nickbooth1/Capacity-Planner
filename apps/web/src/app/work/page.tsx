'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, RefreshCw, Search, Filter } from 'lucide-react';

// Mock data for development
const mockWorkRequests = [
  {
    id: '1',
    title: 'Monthly safety inspection',
    status: 'submitted',
    priority: 'medium',
    workType: 'inspection',
    assetCode: 'A01',
    assetName: 'Stand A01',
    requestorName: 'John Smith',
    requestedStartDate: '2024-02-15T08:00:00Z',
    estimatedCost: 2500,
    createdAt: '2024-01-15T10:00:00Z',
  },
  {
    id: '2',
    title: 'Jetbridge hydraulic repair',
    status: 'approved',
    priority: 'high',
    workType: 'repair',
    assetCode: 'B12',
    assetName: 'Stand B12',
    requestorName: 'Sarah Johnson',
    requestedStartDate: '2024-02-10T06:00:00Z',
    estimatedCost: 8500,
    createdAt: '2024-01-10T14:30:00Z',
  },
  {
    id: '3',
    title: 'Ground power unit maintenance',
    status: 'in_progress',
    priority: 'medium',
    workType: 'maintenance',
    assetCode: 'C05',
    assetName: 'Stand C05',
    requestorName: 'Mike Davis',
    requestedStartDate: '2024-02-08T09:00:00Z',
    estimatedCost: 1200,
    createdAt: '2024-01-08T11:15:00Z',
  },
];

const statusColors = {
  draft: 'bg-gray-500',
  submitted: 'bg-blue-500',
  under_review: 'bg-yellow-500',
  approved: 'bg-green-500',
  rejected: 'bg-red-500',
  in_progress: 'bg-purple-500',
  completed: 'bg-green-600',
  cancelled: 'bg-gray-600',
};

const priorityColors = {
  critical: 'bg-red-600',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
};

export default function WorkRequestsPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const filteredRequests = mockWorkRequests.filter((request) => {
    const matchesSearch =
      request.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.assetCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.requestorName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || request.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Work Requests</h1>
          <p className="text-gray-600">Manage and track your work requests</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button
            onClick={() => router.push('/work/requests/new')}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Request
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by title, asset, or requestor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="min-w-[150px]">
              <label className="block text-sm font-medium mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="under_review">Under Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div className="min-w-[150px]">
              <label className="block text-sm font-medium mb-2">Priority</label>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Priorities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Work Requests List */}
      <div className="space-y-4">
        {filteredRequests.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-gray-500">No work requests found.</p>
              <Button onClick={() => router.push('/work/requests/new')} className="mt-4">
                Create Your First Work Request
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredRequests.map((request) => (
            <Card key={request.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-2">{request.title}</h3>
                    <p className="text-sm text-gray-600 mb-2">
                      {request.assetCode} - {request.assetName}
                    </p>
                    <p className="text-sm text-gray-500">
                      Requested by {request.requestorName} on {formatDate(request.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex gap-2">
                      <Badge
                        className={`${statusColors[request.status as keyof typeof statusColors]} text-white`}
                      >
                        {request.status.replace('_', ' ')}
                      </Badge>
                      <Badge
                        className={`${priorityColors[request.priority as keyof typeof priorityColors]} text-white`}
                      >
                        {request.priority}
                      </Badge>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {request.workType}
                    </Badge>
                  </div>
                </div>

                <div className="flex justify-between items-center text-sm text-gray-600">
                  <div>
                    <span className="font-medium">Requested Start:</span>{' '}
                    {formatDate(request.requestedStartDate)}
                  </div>
                  <div>
                    <span className="font-medium">Estimated Cost:</span>{' '}
                    {formatCurrency(request.estimatedCost)}
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/work/requests/${request.id}`)}
                  >
                    View Details
                  </Button>
                  {request.status === 'draft' && (
                    <Button
                      size="sm"
                      onClick={() => router.push(`/work/requests/${request.id}/edit`)}
                    >
                      Edit
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Pagination */}
      {filteredRequests.length > 0 && (
        <div className="flex justify-center items-center gap-2 mt-6">
          <Button variant="outline" size="sm" disabled>
            Previous
          </Button>
          <span className="text-sm text-gray-600">Page 1 of 1</span>
          <Button variant="outline" size="sm" disabled>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
