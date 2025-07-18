'use client';

import { useQuery } from '@tanstack/react-query';
import { workRequestApi } from '../api/work-request-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Calendar,
  Clock,
  User,
  MapPin,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Wrench,
  Building,
  FileText,
  Shield,
} from 'lucide-react';

interface WorkRequestDetailProps {
  organizationId: string;
  workRequestId: string;
}

export function WorkRequestDetail({ organizationId, workRequestId }: WorkRequestDetailProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['work-request', organizationId, workRequestId],
    queryFn: () => workRequestApi.getWorkRequest(organizationId, workRequestId),
  });

  const workRequest = data?.data;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading work request...</div>
      </div>
    );
  }

  if (error || !workRequest) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-600">Error loading work request</div>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'submitted':
        return <Clock className="w-4 h-4 text-blue-500" />;
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'in_progress':
        return <Wrench className="w-4 h-4 text-purple-500" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusVariant = (status: string): any => {
    switch (status) {
      case 'submitted':
        return 'secondary';
      case 'approved':
        return 'success';
      case 'rejected':
        return 'destructive';
      case 'in_progress':
        return 'default';
      case 'completed':
        return 'success';
      default:
        return 'secondary';
    }
  };

  const getPriorityVariant = (priority: string): any => {
    switch (priority) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'warning';
      case 'medium':
        return 'secondary';
      case 'low':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">{workRequest.title}</CardTitle>
              <p className="text-sm text-gray-500 mt-1">ID: {workRequest.id}</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                {getStatusIcon(workRequest.status)}
                <Badge variant={getStatusVariant(workRequest.status)} className="capitalize">
                  {workRequest.status.replace('_', ' ')}
                </Badge>
              </div>
              <Badge variant={getPriorityVariant(workRequest.priority)} className="capitalize">
                {workRequest.priority}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="w-5 h-5" />
                <span>Description</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 whitespace-pre-wrap">{workRequest.description}</p>
            </CardContent>
          </Card>

          {/* Asset Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Building className="w-5 h-5" />
                <span>Asset Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Asset Code</label>
                  <p className="text-lg font-semibold">{workRequest.assetCode}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Asset Name</label>
                  <p className="text-lg font-semibold">{workRequest.assetName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Asset Type</label>
                  <p className="text-lg font-semibold capitalize">{workRequest.assetType}</p>
                </div>
                {workRequest.locationDetails && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Location Details</label>
                    <p className="text-lg font-semibold">{workRequest.locationDetails}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Scheduling Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="w-5 h-5" />
                <span>Scheduling</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Start Date & Time</label>
                  <div className="flex items-center space-x-2 mt-1">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="font-semibold">
                        {formatDateTime(workRequest.requestedStartDate).date}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatDateTime(workRequest.requestedStartDate).time}
                      </p>
                    </div>
                  </div>
                </div>
                {workRequest.requestedEndDate && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">End Date & Time</label>
                    <div className="flex items-center space-x-2 mt-1">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="font-semibold">
                          {formatDateTime(workRequest.requestedEndDate).date}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatDateTime(workRequest.requestedEndDate).time}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Safety Considerations */}
          {workRequest.safetyConsiderations && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="w-5 h-5" />
                  <span>Safety Considerations</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 whitespace-pre-wrap">
                  {workRequest.safetyConsiderations}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Request Details */}
          <Card>
            <CardHeader>
              <CardTitle>Request Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Work Type</label>
                <p className="font-semibold capitalize">{workRequest.workType}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Category</label>
                <p className="font-semibold capitalize">{workRequest.category}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Urgency</label>
                <p className="font-semibold capitalize">{workRequest.urgency}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Impact Level</label>
                <p className="font-semibold capitalize">
                  {workRequest.impactLevel?.replace('_', ' ')}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Requestor Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="w-5 h-5" />
                <span>Requestor</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Name</label>
                <p className="font-semibold">{workRequest.requestorName}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Requested By</label>
                <p className="font-semibold">{workRequest.requestedBy}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Submitted</label>
                <p className="font-semibold">
                  {new Date(workRequest.createdAt).toLocaleDateString()}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full" variant="outline">
                Edit Request
              </Button>
              <Button className="w-full" variant="outline">
                Add Comment
              </Button>
              <Button className="w-full" variant="outline">
                View History
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
