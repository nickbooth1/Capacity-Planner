'use client';

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns/format';
import {
  X,
  MapPin,
  Settings,
  History,
  Network,
  Edit,
  FileText,
  Download,
  Calendar,
  Wrench,
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  Building,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface StandDetailPanelProps {
  standId: string;
  open: boolean;
  onClose: () => void;
  currentDate?: Date;
}

interface StandDetails {
  id: string;
  code: string;
  name: string;
  status: string;
  terminal: string;
  pier?: string;
  latitude: number;
  longitude: number;
  capabilities: any;
  maintenanceRecords?: any[];
  statusHistory?: any[];
  adjacentStands?: any[];
}

export const StandDetailPanel: React.FC<StandDetailPanelProps> = ({
  standId,
  open,
  onClose,
  currentDate,
}) => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [standDetails, setStandDetails] = useState<StandDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && standId) {
      loadStandDetails();
    }
  }, [standId, open]);

  const loadStandDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/stands/${standId}/details`);
      if (!response.ok) {
        throw new Error('Failed to load stand details');
      }
      const result = await response.json();
      setStandDetails(result.success ? result.data : null);
    } catch (err) {
      console.error('Failed to load stand details:', err);
      setError(err instanceof Error ? err.message : 'Failed to load stand details');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'operational':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'maintenance':
        return <Wrench className="w-4 h-4 text-yellow-600" />;
      case 'closed':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default:
        return <MapPin className="w-4 h-4 text-gray-600" />;
    }
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

  const renderOverviewTab = () => {
    if (!standDetails) return null;

    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm font-medium">Code:</span>
              <span className="text-sm">{standDetails.code}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-medium">Name:</span>
              <span className="text-sm">{standDetails.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-medium">Terminal:</span>
              <span className="text-sm">{standDetails.terminal || 'N/A'}</span>
            </div>
            {standDetails.pier && (
              <div className="flex justify-between">
                <span className="text-sm font-medium">Pier:</span>
                <span className="text-sm">{standDetails.pier}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-sm font-medium">Coordinates:</span>
              <span className="text-sm">
                {standDetails.latitude.toFixed(6)}, {standDetails.longitude.toFixed(6)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Capabilities</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm font-medium">Aircraft Size:</span>
              <span className="text-sm">{standDetails.capabilities?.aircraftSize || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-medium">Max Weight:</span>
              <span className="text-sm">
                {standDetails.capabilities?.maxWeight
                  ? `${(standDetails.capabilities.maxWeight / 1000).toFixed(0)}t`
                  : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-medium">Power Supply:</span>
              <span className="text-sm">
                {standDetails.capabilities?.hasPowerSupply ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-medium">Ground Support:</span>
              <span className="text-sm">
                {standDetails.capabilities?.hasGroundSupport ? 'Yes' : 'No'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderMaintenanceTab = () => {
    if (!standDetails) return null;

    const maintenanceRecords = standDetails.maintenanceRecords || [];

    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Active Maintenance</CardTitle>
            <CardDescription>Current and upcoming maintenance activities</CardDescription>
          </CardHeader>
          <CardContent>
            {maintenanceRecords.filter((m) => new Date(m.scheduledEndTime) > new Date()).length ===
            0 ? (
              <p className="text-sm text-gray-500">No active maintenance scheduled</p>
            ) : (
              <div className="space-y-3">
                {maintenanceRecords
                  .filter((m) => new Date(m.scheduledEndTime) > new Date())
                  .map((record) => (
                    <div key={record.id} className="border rounded-lg p-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">{record.description}</p>
                          <div className="flex items-center space-x-2 text-xs text-gray-500">
                            <Calendar className="w-3 h-3" />
                            <span>
                              {format(new Date(record.scheduledStartTime), 'MMM dd, HH:mm')} -
                              {format(new Date(record.scheduledEndTime), 'MMM dd, HH:mm')}
                            </span>
                          </div>
                          {record.maintenanceType && (
                            <Badge variant="outline" className="text-xs">
                              {record.maintenanceType}
                            </Badge>
                          )}
                        </div>
                        {record.priority && (
                          <Badge
                            className={cn(
                              'text-xs',
                              record.priority === 3
                                ? 'bg-red-100 text-red-800'
                                : record.priority === 2
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-green-100 text-green-800'
                            )}
                          >
                            P{record.priority}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Maintenance History</CardTitle>
            <CardDescription>Past maintenance activities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {maintenanceRecords
                .filter((m) => new Date(m.scheduledEndTime) <= new Date())
                .slice(0, 5)
                .map((record) => (
                  <div key={record.id} className="border rounded-lg p-3">
                    <p className="text-sm font-medium">{record.description}</p>
                    <div className="flex items-center space-x-2 text-xs text-gray-500 mt-1">
                      <Calendar className="w-3 h-3" />
                      <span>{format(new Date(record.scheduledStartTime), 'MMM dd, yyyy')}</span>
                      {record.actualDurationHours && (
                        <>
                          <Clock className="w-3 h-3" />
                          <span>{record.actualDurationHours}h</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderHistoryTab = () => {
    if (!standDetails) return null;

    const statusHistory = standDetails.statusHistory || [];

    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Status Change History</CardTitle>
            <CardDescription>Recent status changes for this stand</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {statusHistory.length === 0 ? (
                <p className="text-sm text-gray-500">No status changes recorded</p>
              ) : (
                statusHistory.slice(0, 10).map((change) => (
                  <div key={change.id} className="border rounded-lg p-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(change.status)}
                          <span className="text-sm font-medium">Changed to {change.status}</span>
                        </div>
                        {change.reason && <p className="text-xs text-gray-600">{change.reason}</p>}
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <div className="flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{format(new Date(change.changedAt), 'MMM dd, yyyy HH:mm')}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <User className="w-3 h-3" />
                            <span>{change.changedByUser?.name || 'System'}</span>
                          </div>
                        </div>
                      </div>
                      {change.previousStatus && (
                        <Badge variant="outline" className="text-xs">
                          From: {change.previousStatus}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderAdjacencyTab = () => {
    if (!standDetails) return null;

    const adjacentStands = standDetails.adjacentStands || [];

    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Adjacent Stands</CardTitle>
            <CardDescription>Stands that are operationally adjacent to this stand</CardDescription>
          </CardHeader>
          <CardContent>
            {adjacentStands.length === 0 ? (
              <p className="text-sm text-gray-500">No adjacent stands configured</p>
            ) : (
              <div className="space-y-3">
                {adjacentStands.map((adj) => (
                  <div key={adj.adjacentStandId} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">
                          {adj.adjacentStand.code} - {adj.adjacentStand.name}
                        </p>
                        <div className="flex items-center space-x-2">
                          <Badge className={getStatusColor(adj.adjacentStand.status)}>
                            {adj.adjacentStand.status}
                          </Badge>
                          {adj.constraintType && (
                            <Badge variant="outline" className="text-xs">
                              {adj.constraintType}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {adj.impactLevel && (
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs',
                            adj.impactLevel === 'high'
                              ? 'border-red-500 text-red-700'
                              : adj.impactLevel === 'medium'
                                ? 'border-yellow-500 text-yellow-700'
                                : 'border-green-500 text-green-700'
                          )}
                        >
                          {adj.impactLevel} impact
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: MapPin },
    { id: 'maintenance', label: 'Maintenance', icon: Settings },
    { id: 'history', label: 'History', icon: History },
    { id: 'adjacency', label: 'Adjacency', icon: Network },
  ];

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-hidden flex flex-col">
        <SheetHeader className="space-y-0">
          {standDetails && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-4 h-4 rounded-full ${
                      standDetails.status === 'operational'
                        ? 'bg-green-500'
                        : standDetails.status === 'maintenance'
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                    }`}
                  />
                  <div>
                    <SheetTitle className="text-xl">{standDetails.code}</SheetTitle>
                    <SheetDescription>{standDetails.name}</SheetDescription>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2 mt-3">
                <Badge className={getStatusColor(standDetails.status)}>{standDetails.status}</Badge>
                {currentDate && (
                  <span className="text-xs text-gray-500">
                    as of {format(currentDate, 'MMM dd, HH:mm')}
                  </span>
                )}
              </div>
            </>
          )}
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col mt-6">
          <TabsList className="grid w-full grid-cols-4">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger key={tab.id} value={tab.id} className="flex items-center space-x-2">
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : error ? (
              <div className="text-center text-red-600 p-4">
                <p>{error}</p>
                <Button variant="outline" size="sm" onClick={loadStandDetails} className="mt-2">
                  Retry
                </Button>
              </div>
            ) : (
              <>
                <TabsContent value="overview" className="mt-0">
                  {renderOverviewTab()}
                </TabsContent>
                <TabsContent value="maintenance" className="mt-0">
                  {renderMaintenanceTab()}
                </TabsContent>
                <TabsContent value="history" className="mt-0">
                  {renderHistoryTab()}
                </TabsContent>
                <TabsContent value="adjacency" className="mt-0">
                  {renderAdjacencyTab()}
                </TabsContent>
              </>
            )}
          </div>
        </Tabs>

        <div className="border-t pt-4 mt-4 flex justify-end space-x-2">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm">
            <FileText className="w-4 h-4 mr-2" />
            Maintenance
          </Button>
          <Button size="sm">
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

// Helper function
function cn(...inputs: (string | boolean | undefined)[]) {
  return inputs.filter(Boolean).join(' ');
}
