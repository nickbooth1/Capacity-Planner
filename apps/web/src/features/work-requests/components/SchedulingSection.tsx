'use client';

import React, { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Calendar, Clock, AlertCircle, Calendar as CalendarIcon } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

import type { WorkRequestFormData } from '../validation/work-request-schema';

interface SchedulingSectionProps {
  className?: string;
}

const SchedulingSection: React.FC<SchedulingSectionProps> = ({ className }) => {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<WorkRequestFormData>();

  const [showAdvancedScheduling, setShowAdvancedScheduling] = useState(false);

  const requestedStartDate = watch('requestedStartDate');
  const requestedEndDate = watch('requestedEndDate');
  const estimatedDurationMinutes = watch('estimatedDurationMinutes');
  const deadline = watch('deadline');

  // Helper function to format date for input
  const formatDateForInput = (date: string | Date | undefined) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
  };

  // Helper function to calculate end date from start date and duration
  const calculateEndDate = (startDate: string, durationMinutes: number) => {
    if (!startDate || !durationMinutes) return '';
    const start = new Date(startDate);
    const end = new Date(start.getTime() + durationMinutes * 60000);
    return end.toISOString().slice(0, 16);
  };

  // Handle start date change
  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStartDate = e.target.value;
    setValue('requestedStartDate', newStartDate);

    // Auto-calculate end date if duration is set
    if (estimatedDurationMinutes) {
      const endDate = calculateEndDate(newStartDate, estimatedDurationMinutes);
      setValue('requestedEndDate', endDate);
    }
  };

  // Handle duration change
  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const duration = parseInt(e.target.value);
    setValue('estimatedDurationMinutes', duration);

    // Auto-calculate end date if start date is set
    if (requestedStartDate) {
      const endDate = calculateEndDate(requestedStartDate, duration);
      setValue('requestedEndDate', endDate);
    }
  };

  // Common duration presets
  const durationPresets = [
    { label: '1 hour', minutes: 60 },
    { label: '2 hours', minutes: 120 },
    { label: '4 hours', minutes: 240 },
    { label: '8 hours', minutes: 480 },
    { label: '1 day', minutes: 1440 },
    { label: '2 days', minutes: 2880 },
    { label: '1 week', minutes: 10080 },
  ];

  // Get minimum date (tomorrow)
  const getMinDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().slice(0, 16);
  };

  // Format duration for display
  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} minutes`;
    if (minutes < 1440) return `${Math.round(minutes / 60)} hours`;
    return `${Math.round(minutes / 1440)} days`;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Scheduling Information</h3>
        <p className="text-sm text-gray-600">
          Specify when the work should be performed and any scheduling constraints.
        </p>
      </div>

      {/* Basic Scheduling */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Work Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="requestedStartDate">Requested Start Date & Time *</Label>
              <Input
                id="requestedStartDate"
                type="datetime-local"
                min={getMinDate()}
                value={formatDateForInput(requestedStartDate)}
                onChange={handleStartDateChange}
                className="mt-1"
              />
              {errors.requestedStartDate && (
                <p className="text-sm text-red-600 mt-1">{errors.requestedStartDate.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="requestedEndDate">Requested End Date & Time</Label>
              <Input
                id="requestedEndDate"
                type="datetime-local"
                min={formatDateForInput(requestedStartDate)}
                value={formatDateForInput(requestedEndDate)}
                onChange={(e) => setValue('requestedEndDate', e.target.value)}
                className="mt-1"
              />
              {errors.requestedEndDate && (
                <p className="text-sm text-red-600 mt-1">{errors.requestedEndDate.message}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Optional - Will be calculated from duration if not provided
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="estimatedDurationMinutes">Estimated Duration</Label>
            <div className="flex gap-2 mt-1">
              <Input
                id="estimatedDurationMinutes"
                type="number"
                min="15"
                max="10080"
                placeholder="Duration in minutes"
                value={estimatedDurationMinutes || ''}
                onChange={handleDurationChange}
                className="flex-1"
              />
              <span className="flex items-center text-sm text-gray-500 px-2">minutes</span>
            </div>
            {errors.estimatedDurationMinutes && (
              <p className="text-sm text-red-600 mt-1">{errors.estimatedDurationMinutes.message}</p>
            )}
            {estimatedDurationMinutes && (
              <p className="text-xs text-gray-500 mt-1">
                {formatDuration(estimatedDurationMinutes)}
              </p>
            )}
          </div>

          {/* Duration Presets */}
          <div>
            <Label>Quick Duration Selection</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {durationPresets.map((preset) => (
                <Button
                  key={preset.minutes}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setValue('estimatedDurationMinutes', preset.minutes);
                    if (requestedStartDate) {
                      const endDate = calculateEndDate(requestedStartDate, preset.minutes);
                      setValue('requestedEndDate', endDate);
                    }
                  }}
                  className={
                    estimatedDurationMinutes === preset.minutes ? 'bg-blue-50 border-blue-300' : ''
                  }
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Schedule Summary */}
          {requestedStartDate && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Schedule Summary</h4>
              <div className="space-y-1 text-sm text-blue-800">
                <p>
                  <strong>Start:</strong> {new Date(requestedStartDate).toLocaleString()}
                </p>
                {requestedEndDate && (
                  <p>
                    <strong>End:</strong> {new Date(requestedEndDate).toLocaleString()}
                  </p>
                )}
                {estimatedDurationMinutes && (
                  <p>
                    <strong>Duration:</strong> {formatDuration(estimatedDurationMinutes)}
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deadline and Constraints */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Deadline & Constraints
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="deadline">Work Completion Deadline</Label>
            <Input
              id="deadline"
              type="datetime-local"
              min={formatDateForInput(requestedEndDate || requestedStartDate)}
              value={formatDateForInput(deadline)}
              onChange={(e) => setValue('deadline', e.target.value)}
              className="mt-1"
            />
            {errors.deadline && (
              <p className="text-sm text-red-600 mt-1">{errors.deadline.message}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Optional - Hard deadline for work completion
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAdvancedScheduling(!showAdvancedScheduling)}
            >
              {showAdvancedScheduling ? 'Hide' : 'Show'} Advanced Scheduling Options
            </Button>
          </div>

          {showAdvancedScheduling && (
            <div className="space-y-4 p-4 border rounded-lg">
              <div>
                <Label>Preferred Time Windows</Label>
                <p className="text-sm text-gray-600 mb-2">
                  Specify preferred times of day for this work (e.g., early morning, late evening)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant="outline" size="sm">
                    Early Morning (06:00-10:00)
                  </Button>
                  <Button type="button" variant="outline" size="sm">
                    Late Evening (18:00-22:00)
                  </Button>
                  <Button type="button" variant="outline" size="sm">
                    Overnight (22:00-06:00)
                  </Button>
                  <Button type="button" variant="outline" size="sm">
                    Business Hours (09:00-17:00)
                  </Button>
                </div>
              </div>

              <div>
                <Label>Blackout Periods</Label>
                <p className="text-sm text-gray-600 mb-2">
                  Specify periods when work cannot be performed
                </p>
                <Button type="button" variant="outline" size="sm">
                  Add Blackout Period
                </Button>
              </div>

              <div>
                <Label>Seasonal Constraints</Label>
                <p className="text-sm text-gray-600 mb-2">Any weather or seasonal considerations</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">Weather Dependent</Badge>
                  <Badge variant="outline">Winter Restrictions</Badge>
                  <Badge variant="outline">Summer Restrictions</Badge>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scheduling Warnings */}
      {requestedStartDate &&
        new Date(requestedStartDate) < new Date(Date.now() + 24 * 60 * 60 * 1000) && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Short Notice:</strong> This work is scheduled for less than 24 hours from now.
              Please ensure all necessary approvals and resources are available.
            </AlertDescription>
          </Alert>
        )}

      {deadline && requestedEndDate && new Date(deadline) < new Date(requestedEndDate) && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Deadline Conflict:</strong> The completion deadline is before the requested end
            date. Please adjust the schedule or deadline.
          </AlertDescription>
        </Alert>
      )}

      {estimatedDurationMinutes && estimatedDurationMinutes > 2880 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Extended Duration:</strong> This work is scheduled for more than 2 days.
            Consider breaking it into smaller work requests or ensure proper resource planning.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default SchedulingSection;
