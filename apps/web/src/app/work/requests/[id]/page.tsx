'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Edit,
  MapPin,
  Calendar,
  Clock,
  DollarSign,
  User,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from 'lucide-react';

// Mock data for development
const mockWorkRequest = {
  id: '1',
  title: 'Monthly safety inspection',
  description:
    'Comprehensive monthly safety inspection of stand equipment, markings, and operational systems. This includes checking jetbridge functionality, ground power units, and safety lighting systems.',
  status: 'submitted',
  priority: 'medium',
  urgency: 'scheduled',
  workType: 'inspection',
  category: 'routine',
  impactLevel: 'partial_restriction',

  // Asset Information
  assetId: 'stand-a01',
  assetCode: 'A01',
  assetName: 'Stand A01',
  assetType: 'stand',
  terminal: 'Terminal 1',

  // Scheduling
  requestedStartDate: '2024-02-15T08:00:00Z',
  requestedEndDate: '2024-02-15T12:00:00Z',
  estimatedDurationMinutes: 240,
  deadline: '2024-02-20T17:00:00Z',

  // Budget
  budgetCode: 'MAINT-2024-001',
  estimatedTotalCost: 2500,
  costCenter: 'MAINT-OPS',

  // Requestor Information
  requestorName: 'John Smith',
  requestorEmail: 'john.smith@airport.com',
  requestorPhone: '+44 161 123 4567',
  department: 'Maintenance Operations',

  // Safety and Location
  locationDetails: 'Jetbridge connection area and ground support equipment zone',
  safetyConsiderations:
    'High-visibility PPE required. Coordinate with ATC for aircraft movement restrictions during inspection.',

  // Metadata
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-15T10:00:00Z',
  submissionDate: '2024-01-15T10:30:00Z',
  version: 1,

  // Status History
  statusHistory: [
    {
      id: '1',
      fromStatus: null,
      toStatus: 'draft',
      reason: 'Work request created',
      changedBy: 'John Smith',
      changedAt: '2024-01-15T10:00:00Z',
    },
    {
      id: '2',
      fromStatus: 'draft',
      toStatus: 'submitted',
      reason: 'Work request submitted for review',
      changedBy: 'John Smith',
      changedAt: '2024-01-15T10:30:00Z',
    },
  ],

  // Comments
  comments: [
    {
      id: '1',
      text: 'Initial safety inspection request for February maintenance window.',
      commentedBy: 'John Smith',
      commentedAt: '2024-01-15T10:00:00Z',
      isInternal: false,
    },
  ],
};

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

export default function WorkRequestDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('details');

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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'rejected':
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{mockWorkRequest.title}</h1>
            <p className="text-gray-600">
              Request ID: {mockWorkRequest.id} • {mockWorkRequest.assetCode} -{' '}
              {mockWorkRequest.assetName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            className={`${statusColors[mockWorkRequest.status as keyof typeof statusColors]} text-white`}
          >
            {mockWorkRequest.status.replace('_', ' ')}
          </Badge>
          <Badge
            className={`${priorityColors[mockWorkRequest.priority as keyof typeof priorityColors]} text-white`}
          >
            {mockWorkRequest.priority}
          </Badge>
          {mockWorkRequest.status === 'draft' && (
            <Button
              onClick={() => router.push(`/work/requests/${params.id}/edit`)}
              className="flex items-center gap-2"
            >
              <Edit className="w-4 h-4" />
              Edit
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Details */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="comments">Comments</TabsTrigger>
              <TabsTrigger value="attachments">Attachments</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Work Request Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Work Type</label>
                      <p className="text-sm">{mockWorkRequest.workType}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Category</label>
                      <p className="text-sm">{mockWorkRequest.category}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Urgency</label>
                      <p className="text-sm">{mockWorkRequest.urgency}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Impact Level</label>
                      <p className="text-sm">{mockWorkRequest.impactLevel.replace('_', ' ')}</p>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-500">Description</label>
                    <p className="text-sm mt-1">{mockWorkRequest.description}</p>
                  </div>

                  {mockWorkRequest.locationDetails && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Location Details</label>
                      <p className="text-sm mt-1">{mockWorkRequest.locationDetails}</p>
                    </div>
                  )}

                  {mockWorkRequest.safetyConsiderations && (
                    <div>
                      <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-500" />
                        Safety Considerations
                      </label>
                      <p className="text-sm mt-1">{mockWorkRequest.safetyConsiderations}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Scheduling
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Requested Start</label>
                      <p className="text-sm">{formatDate(mockWorkRequest.requestedStartDate)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Requested End</label>
                      <p className="text-sm">{formatDate(mockWorkRequest.requestedEndDate)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Duration</label>
                      <p className="text-sm">{mockWorkRequest.estimatedDurationMinutes} minutes</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Deadline</label>
                      <p className="text-sm">{formatDate(mockWorkRequest.deadline)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    Budget Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Budget Code</label>
                      <p className="text-sm">{mockWorkRequest.budgetCode}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Cost Center</label>
                      <p className="text-sm">{mockWorkRequest.costCenter}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Estimated Cost</label>
                      <p className="text-sm font-semibold">
                        {formatCurrency(mockWorkRequest.estimatedTotalCost)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history">
              <Card>
                <CardHeader>
                  <CardTitle>Status History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {mockWorkRequest.statusHistory.map((entry, index) => (
                      <div key={entry.id} className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-1">{getStatusIcon(entry.toStatus)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium">
                              {entry.fromStatus
                                ? `${entry.fromStatus} → ${entry.toStatus}`
                                : entry.toStatus}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatDate(entry.changedAt)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">{entry.reason}</p>
                          <p className="text-xs text-gray-500">by {entry.changedBy}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="comments">
              <Card>
                <CardHeader>
                  <CardTitle>Comments</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {mockWorkRequest.comments.map((comment) => (
                      <div key={comment.id} className="border-l-4 border-blue-500 pl-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-medium">{comment.commentedBy}</span>
                          <span className="text-xs text-gray-500">
                            {formatDate(comment.commentedAt)}
                          </span>
                          {comment.isInternal && (
                            <Badge variant="outline" className="text-xs">
                              Internal
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-700">{comment.text}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="attachments">
              <Card>
                <CardHeader>
                  <CardTitle>Attachments</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <p className="text-gray-500">No attachments found.</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column - Summary */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Asset Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-500">Stand Code</label>
                <p className="text-sm font-semibold">{mockWorkRequest.assetCode}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Stand Name</label>
                <p className="text-sm">{mockWorkRequest.assetName}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Terminal</label>
                <p className="text-sm">{mockWorkRequest.terminal}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Asset Type</label>
                <p className="text-sm">{mockWorkRequest.assetType}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Requestor Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-500">Name</label>
                <p className="text-sm">{mockWorkRequest.requestorName}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Email</label>
                <p className="text-sm">{mockWorkRequest.requestorEmail}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Phone</label>
                <p className="text-sm">{mockWorkRequest.requestorPhone}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Department</label>
                <p className="text-sm">{mockWorkRequest.department}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {mockWorkRequest.status === 'draft' && (
                <Button
                  className="w-full"
                  onClick={() => router.push(`/work/requests/${params.id}/edit`)}
                >
                  Edit Request
                </Button>
              )}
              {mockWorkRequest.status === 'submitted' && (
                <>
                  <Button className="w-full" variant="default">
                    Approve Request
                  </Button>
                  <Button className="w-full" variant="outline">
                    Request Changes
                  </Button>
                </>
              )}
              <Button className="w-full" variant="outline">
                Add Comment
              </Button>
              <Button className="w-full" variant="outline">
                Export to PDF
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
