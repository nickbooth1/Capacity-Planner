'use client';

import React from 'react';
import { useFormContext } from 'react-hook-form';
import { FileText, AlertTriangle, Info, Wrench } from 'lucide-react';

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
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

import type { WorkRequestFormData } from '../validation/work-request-schema';

interface RequestDetailsSectionProps {
  className?: string;
}

const RequestDetailsSection: React.FC<RequestDetailsSectionProps> = ({ className }) => {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<WorkRequestFormData>();

  const workType = watch('workType');
  const priority = watch('priority');
  const urgency = watch('urgency');
  const impactLevel = watch('impactLevel');
  const title = watch('title');
  const description = watch('description');

  const getWorkTypeIcon = (type: string) => {
    switch (type) {
      case 'maintenance':
        return <Wrench className="w-4 h-4" />;
      case 'inspection':
        return <FileText className="w-4 h-4" />;
      case 'repair':
        return <AlertTriangle className="w-4 h-4" />;
      case 'modification':
        return <Info className="w-4 h-4" />;
      case 'emergency':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'immediate':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'scheduled':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'routine':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'full_closure':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'partial_restriction':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'no_impact':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleTitleSuggestion = (workType: string) => {
    const suggestions = {
      maintenance: 'Routine maintenance - ',
      inspection: 'Safety inspection - ',
      repair: 'Repair work - ',
      modification: 'Modification work - ',
      emergency: 'Emergency repair - ',
    };

    if (!title || title.length < 5) {
      setValue('title', suggestions[workType as keyof typeof suggestions] || '');
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Work Request Details</h3>
        <p className="text-sm text-gray-600">
          Provide detailed information about the work request including type, priority, and
          description.
        </p>
      </div>

      {/* Work Classification */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Work Classification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="workType">Work Type *</Label>
              <Select
                value={workType}
                onValueChange={(value) => {
                  setValue('workType', value as any);
                  handleTitleSuggestion(value);
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select work type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="maintenance">
                    <div className="flex items-center gap-2">
                      <Wrench className="w-4 h-4" />
                      Maintenance
                    </div>
                  </SelectItem>
                  <SelectItem value="inspection">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Inspection
                    </div>
                  </SelectItem>
                  <SelectItem value="repair">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Repair
                    </div>
                  </SelectItem>
                  <SelectItem value="modification">
                    <div className="flex items-center gap-2">
                      <Info className="w-4 h-4" />
                      Modification
                    </div>
                  </SelectItem>
                  <SelectItem value="emergency">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      Emergency
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              {errors.workType && (
                <p className="text-sm text-red-600 mt-1">{errors.workType.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="category">Category *</Label>
              <Select
                value={watch('category')}
                onValueChange={(value) => setValue('category', value as any)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="routine">Routine</SelectItem>
                  <SelectItem value="corrective">Corrective</SelectItem>
                  <SelectItem value="preventive">Preventive</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                </SelectContent>
              </Select>
              {errors.category && (
                <p className="text-sm text-red-600 mt-1">{errors.category.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="priority">Priority *</Label>
              <Select
                value={priority}
                onValueChange={(value) => setValue('priority', value as any)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              {errors.priority && (
                <p className="text-sm text-red-600 mt-1">{errors.priority.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="urgency">Urgency *</Label>
              <Select value={urgency} onValueChange={(value) => setValue('urgency', value as any)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select urgency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate">Immediate</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="routine">Routine</SelectItem>
                </SelectContent>
              </Select>
              {errors.urgency && (
                <p className="text-sm text-red-600 mt-1">{errors.urgency.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="impactLevel">Impact Level *</Label>
              <Select
                value={impactLevel}
                onValueChange={(value) => setValue('impactLevel', value as any)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select impact level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_closure">Full Closure</SelectItem>
                  <SelectItem value="partial_restriction">Partial Restriction</SelectItem>
                  <SelectItem value="no_impact">No Impact</SelectItem>
                </SelectContent>
              </Select>
              {errors.impactLevel && (
                <p className="text-sm text-red-600 mt-1">{errors.impactLevel.message}</p>
              )}
            </div>
          </div>

          {/* Classification Summary */}
          {(workType || priority || urgency || impactLevel) && (
            <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg">
              {workType && (
                <Badge variant="outline" className="flex items-center gap-1">
                  {getWorkTypeIcon(workType)}
                  {workType}
                </Badge>
              )}
              {priority && (
                <Badge className={getPriorityColor(priority)}>{priority} Priority</Badge>
              )}
              {urgency && <Badge className={getUrgencyColor(urgency)}>{urgency} Urgency</Badge>}
              {impactLevel && (
                <Badge className={getImpactColor(impactLevel)}>
                  {impactLevel.replace('_', ' ')} Impact
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Request Information */}
      <Card>
        <CardHeader>
          <CardTitle>Request Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title">Request Title *</Label>
            <Input
              id="title"
              placeholder="Enter a clear, descriptive title for the work request"
              {...register('title')}
              className="mt-1"
            />
            {errors.title && <p className="text-sm text-red-600 mt-1">{errors.title.message}</p>}
            <p className="text-xs text-gray-500 mt-1">{title?.length || 0}/200 characters</p>
          </div>

          <div>
            <Label htmlFor="description">Detailed Description *</Label>
            <Textarea
              id="description"
              placeholder="Provide a detailed description of the work to be performed, including specific requirements, procedures, and expected outcomes"
              {...register('description')}
              className="mt-1 min-h-[120px]"
            />
            {errors.description && (
              <p className="text-sm text-red-600 mt-1">{errors.description.message}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">{description?.length || 0}/5000 characters</p>
          </div>

          <div>
            <Label htmlFor="locationDetails">Location Details</Label>
            <Textarea
              id="locationDetails"
              placeholder="Specify the exact location within the stand where work will be performed (e.g., 'North side jetbridge connection', 'Underground utilities area')"
              {...register('locationDetails')}
              className="mt-1"
            />
            {errors.locationDetails && (
              <p className="text-sm text-red-600 mt-1">{errors.locationDetails.message}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Optional - Provide specific location details if needed
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Safety Considerations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Safety Considerations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="safetyConsiderations">Safety Hazards & Requirements</Label>
            <Textarea
              id="safetyConsiderations"
              placeholder="Describe any safety hazards, required PPE, special procedures, or safety precautions that must be taken during this work"
              {...register('safetyConsiderations')}
              className="mt-1"
            />
            {errors.safetyConsiderations && (
              <p className="text-sm text-red-600 mt-1">{errors.safetyConsiderations.message}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Include any safety hazards, required PPE, lockout/tagout procedures, or special safety
              requirements
            </p>
          </div>

          {/* Safety Reminder */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Safety Reminder:</strong> All work must comply with airport safety regulations
              and organizational safety policies. Ensure proper permits, safety equipment, and
              personnel training are in place before work begins.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Business Rule Validation */}
      {priority === 'critical' && urgency === 'routine' && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Validation Warning:</strong> Critical priority work requests typically require
            immediate or scheduled urgency, not routine urgency.
          </AlertDescription>
        </Alert>
      )}

      {workType === 'emergency' && priority !== 'critical' && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Validation Warning:</strong> Emergency work requests typically require critical
            priority.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default RequestDetailsSection;
