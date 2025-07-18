'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { standApi } from '@/features/stands/api/stand-api';
import { workRequestApi, type CreateWorkRequestData } from '../api/work-request-api';
import { AlertCircle } from 'lucide-react';

interface WorkRequestFormProps {
  organizationId: string;
  userId: string;
  prefilledData?: {
    assetId?: string;
    assetType?: string;
    assetCode?: string;
    assetName?: string;
  };
}

export function WorkRequestForm({ organizationId, userId, prefilledData }: WorkRequestFormProps) {
  const router = useRouter();
  const [selectedStandId, setSelectedStandId] = useState<string>(prefilledData?.assetId || '');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    workType: 'maintenance',
    category: 'routine',
    priority: 'medium',
    urgency: 'scheduled',
    impactLevel: 'no_impact',
    requestedStartDate: new Date().toISOString().split('T')[0],
    requestedStartTime: '09:00',
    requestedEndDate: new Date().toISOString().split('T')[0],
    requestedEndTime: '17:00',
    locationDetails: '',
    safetyConsiderations: '',
  });

  // Fetch all stands for dropdown
  const { data: standsData, isLoading: standsLoading } = useQuery({
    queryKey: ['stands-dropdown', organizationId],
    queryFn: () => standApi.getStands(organizationId, { pageSize: 200 }), // Get more stands for dropdown
    enabled: true,
  });

  // Set prefilled stand if provided
  useEffect(() => {
    if (prefilledData?.assetId) {
      setSelectedStandId(prefilledData.assetId);
    }
  }, [prefilledData]);

  // Create work request mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateWorkRequestData) =>
      workRequestApi.createWorkRequest(organizationId, userId, data),
    onSuccess: () => {
      router.push('/work-requests');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedStandId) {
      alert('Please select a stand');
      return;
    }

    // Validate start and end times
    const startDateTime = new Date(
      `${formData.requestedStartDate}T${formData.requestedStartTime}:00`
    );
    const endDateTime = new Date(`${formData.requestedEndDate}T${formData.requestedEndTime}:00`);

    if (endDateTime <= startDateTime) {
      alert('End date/time must be after start date/time');
      return;
    }

    // Format for API
    const startDateTimeString = `${formData.requestedStartDate}T${formData.requestedStartTime}:00`;
    const endDateTimeString = `${formData.requestedEndDate}T${formData.requestedEndTime}:00`;

    // Get selected stand details
    const selectedStandDetails = stands.find((s) => s.id === selectedStandId);

    const requestData: CreateWorkRequestData = {
      title: formData.title,
      description: formData.description,
      workType: formData.workType,
      category: formData.category,
      priority: formData.priority,
      urgency: formData.urgency,
      impactLevel: formData.impactLevel,
      locationDetails: formData.locationDetails,
      safetyConsiderations: formData.safetyConsiderations,
      assetId: selectedStandId,
      assetType: 'stand',
      requestedStartDate: startDateTimeString,
      requestedEndDate: endDateTimeString,
      // Include stand details for the mock API
      assetCode: selectedStandDetails?.code || 'UNKNOWN',
      assetName: selectedStandDetails?.name || 'Unknown Stand',
    };

    createMutation.mutate(requestData);
  };

  const stands = standsData?.data || [];
  const selectedStand = stands.find((s) => s.id === selectedStandId);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Stand Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Stand/Asset Selection *
        </label>

        {prefilledData?.assetId && selectedStand ? (
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-blue-900">Selected Stand</h3>
                <div className="mt-1 text-sm text-blue-700">
                  <span className="font-medium">{selectedStand.code}</span> - {selectedStand.name}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <select
            required
            value={selectedStandId}
            onChange={(e) => setSelectedStandId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            disabled={standsLoading}
          >
            <option value="">{standsLoading ? 'Loading stands...' : 'Select a stand'}</option>
            {stands
              .sort((a, b) => a.code.localeCompare(b.code))
              .map((stand: any) => (
                <option key={stand.id} value={stand.id}>
                  {stand.code} - {stand.name} ({stand.terminal || 'Remote'})
                </option>
              ))}
          </select>
        )}
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Work Request Title *</label>
        <Input
          required
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="Enter a descriptive title for the work request"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
        <textarea
          required
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          rows={4}
          placeholder="Describe the work that needs to be done..."
        />
      </div>

      {/* Work Type and Category */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Work Type *</label>
          <select
            required
            value={formData.workType}
            onChange={(e) => setFormData({ ...formData, workType: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="maintenance">Maintenance</option>
            <option value="inspection">Inspection</option>
            <option value="repair">Repair</option>
            <option value="modification">Modification</option>
            <option value="emergency">Emergency</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
          <select
            required
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="routine">Routine</option>
            <option value="corrective">Corrective</option>
            <option value="preventive">Preventive</option>
            <option value="emergency">Emergency</option>
          </select>
        </div>
      </div>

      {/* Priority and Urgency */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Priority *</label>
          <select
            required
            value={formData.priority}
            onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Urgency *</label>
          <select
            required
            value={formData.urgency}
            onChange={(e) => setFormData({ ...formData, urgency: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="routine">Routine</option>
            <option value="scheduled">Scheduled</option>
            <option value="immediate">Immediate</option>
          </select>
        </div>
      </div>

      {/* Impact Level */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Impact Level *</label>
        <select
          required
          value={formData.impactLevel}
          onChange={(e) => setFormData({ ...formData, impactLevel: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="no_impact">No Impact</option>
          <option value="partial_restriction">Partial Restriction</option>
          <option value="full_closure">Full Closure</option>
        </select>
      </div>

      {/* Start Date and Time */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Start Date & Time *</label>
        <div className="grid grid-cols-2 gap-4">
          <Input
            type="date"
            required
            value={formData.requestedStartDate}
            onChange={(e) => setFormData({ ...formData, requestedStartDate: e.target.value })}
          />
          <Input
            type="time"
            required
            value={formData.requestedStartTime}
            onChange={(e) => setFormData({ ...formData, requestedStartTime: e.target.value })}
          />
        </div>
      </div>

      {/* End Date and Time */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">End Date & Time *</label>
        <div className="grid grid-cols-2 gap-4">
          <Input
            type="date"
            required
            value={formData.requestedEndDate}
            onChange={(e) => setFormData({ ...formData, requestedEndDate: e.target.value })}
            min={formData.requestedStartDate}
          />
          <Input
            type="time"
            required
            value={formData.requestedEndTime}
            onChange={(e) => setFormData({ ...formData, requestedEndTime: e.target.value })}
          />
        </div>
      </div>

      {/* Additional Details */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Location Details</label>
        <Input
          value={formData.locationDetails}
          onChange={(e) => setFormData({ ...formData, locationDetails: e.target.value })}
          placeholder="Specific location information"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Safety Considerations
        </label>
        <textarea
          value={formData.safetyConsiderations}
          onChange={(e) => setFormData({ ...formData, safetyConsiderations: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          rows={3}
          placeholder="Any safety requirements or hazards..."
        />
      </div>

      {/* Error display */}
      {createMutation.isError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-700">Failed to create work request. Please try again.</span>
        </div>
      )}

      {/* Form Actions */}
      <div className="pt-6 flex items-center justify-end space-x-4 border-t">
        <Button type="button" variant="outline" onClick={() => router.push('/work-requests')}>
          Cancel
        </Button>
        <Button
          type="submit"
          className="bg-green-600 hover:bg-green-700"
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? 'Creating...' : 'Create Work Request'}
        </Button>
      </div>
    </form>
  );
}
