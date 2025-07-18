'use client';

import React from 'react';
import { format } from 'date-fns/format';
import { MapPin, Clock, Wrench, AlertTriangle } from 'lucide-react';
import { StandMapData } from '../../types/map';

interface StandTooltipProps {
  stand: StandMapData & {
    timelineEvents?: any[];
  };
  currentDate?: Date;
}

export const StandTooltip: React.FC<StandTooltipProps> = ({ stand, currentDate }) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'maintenance':
        return <Wrench className="w-4 h-4 text-yellow-600" />;
      case 'closed':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default:
        return <MapPin className="w-4 h-4 text-green-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'maintenance':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'closed':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-3 max-w-xs">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <h4 className="font-semibold text-gray-900">{stand.code}</h4>
          {getStatusIcon(stand.status)}
        </div>
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(stand.status)}`}
        >
          {stand.status}
        </span>
      </div>

      <p className="text-sm text-gray-600 mb-2">{stand.name}</p>

      <div className="space-y-1 text-xs text-gray-500">
        <div className="flex items-center justify-between">
          <span>Terminal:</span>
          <span className="font-medium">{stand.terminal_code || 'N/A'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Aircraft Size:</span>
          <span className="font-medium">{stand.aircraft_size_category}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Max Weight:</span>
          <span className="font-medium">{stand.max_weight_kg.toLocaleString()} kg</span>
        </div>
      </div>

      {/* Power and Ground Support */}
      {(stand.power_supply?.length > 0 || stand.ground_support?.length > 0) && (
        <div className="mt-2 pt-2">
          <div className="flex flex-wrap gap-1">
            {stand.power_supply?.map((power) => (
              <span
                key={power}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
              >
                {power}
              </span>
            ))}
            {stand.ground_support?.map((support) => (
              <span
                key={support}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800"
              >
                {support}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Timeline events */}
      {stand.timelineEvents && stand.timelineEvents.length > 0 && (
        <div className="mt-2 pt-2">
          <div className="flex items-center space-x-1 text-xs text-gray-500 mb-1">
            <Clock className="w-3 h-3" />
            <span>Recent Events:</span>
          </div>
          <div className="space-y-1">
            {stand.timelineEvents.slice(0, 2).map((event, index) => (
              <div key={index} className="text-xs text-gray-600">
                <span className="font-medium">
                  {event.type === 'status_change'
                    ? 'Status Change'
                    : event.type === 'maintenance_start'
                      ? 'Maintenance Started'
                      : 'Maintenance Ended'}
                </span>
                {event.reason && <span className="text-gray-500"> - {event.reason}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {currentDate && (
        <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500">
          <div className="flex items-center space-x-1">
            <Clock className="w-3 h-3" />
            <span>Timeline: {format(currentDate, 'MMM dd, HH:mm')}</span>
          </div>
        </div>
      )}
    </div>
  );
};
