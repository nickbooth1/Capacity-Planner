'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward, Calendar, Clock } from 'lucide-react';
import { format } from 'date-fns/format';
import { addHours } from 'date-fns/addHours';
import { subHours } from 'date-fns/subHours';
import * as d3 from 'd3';
import { Button } from '@/components/ui/button';
import type { TimelineDataPoint } from '../../stores/timelineStore';

interface TimelineControllerProps {
  currentDate: Date;
  dateRange: { start: Date; end: Date };
  isPlaying: boolean;
  playbackSpeed: number;
  onDateChange: (date: Date) => void;
  onPlayToggle: () => void;
  onSpeedChange: (speed: number) => void;
  onDateRangeChange: (start: Date, end: Date) => void;
  timelineData: Record<string, TimelineDataPoint[]>;
}

export const TimelineController: React.FC<TimelineControllerProps> = ({
  currentDate,
  dateRange,
  isPlaying,
  playbackSpeed,
  onDateChange,
  onPlayToggle,
  onSpeedChange,
  onDateRangeChange,
  timelineData,
}) => {
  const timelineRef = useRef<SVGSVGElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Timeline dimensions
  const dimensions = {
    width: 800,
    height: 60,
    margin: { top: 10, right: 20, bottom: 30, left: 20 },
  };

  // Create scales
  const xScale = d3
    .scaleTime()
    .domain([dateRange.start, dateRange.end])
    .range([dimensions.margin.left, dimensions.width - dimensions.margin.right]);

  const yScale = d3
    .scaleLinear()
    .domain([0, 1])
    .range([dimensions.height - dimensions.margin.bottom, dimensions.margin.top]);

  // Auto-play functionality
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      const nextDate = addHours(currentDate, playbackSpeed);
      if (nextDate <= dateRange.end) {
        onDateChange(nextDate);
      } else {
        onPlayToggle(); // Stop at end
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, currentDate, playbackSpeed, dateRange.end, onDateChange, onPlayToggle]);

  // Handle timeline drag
  const handleTimelineDrag = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging) return;

    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = event.clientX - rect.left;
    const newDate = xScale.invert(x);

    // Clamp to date range
    const clampedDate = new Date(
      Math.max(dateRange.start.getTime(), Math.min(dateRange.end.getTime(), newDate.getTime()))
    );

    onDateChange(clampedDate);
  };

  // Get all events for timeline visualization
  const allEvents = Object.values(timelineData)
    .flat()
    .filter((point) => point.events && point.events.length > 0);

  // Speed options
  const speedOptions = [0.5, 1, 2, 4, 8];

  return (
    <div className="bg-white rounded-xl shadow-sm">
      <div className="p-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold">Timeline Controller</h3>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="flex items-center space-x-1"
            >
              <Calendar className="w-4 h-4" />
              <span>Date Range</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4 pt-0">
        {/* Date Range Picker */}
        {showDatePicker && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 p-3 bg-gray-50 rounded-lg"
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="datetime-local"
                  value={format(dateRange.start, "yyyy-MM-dd'T'HH:mm")}
                  onChange={(e) => onDateRangeChange(new Date(e.target.value), dateRange.end)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="datetime-local"
                  value={format(dateRange.end, "yyyy-MM-dd'T'HH:mm")}
                  onChange={(e) => onDateRangeChange(dateRange.start, new Date(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </motion.div>
        )}

        {/* Timeline Visualization */}
        <div className="mb-4 overflow-x-auto">
          <svg
            ref={timelineRef}
            width={dimensions.width}
            height={dimensions.height}
            className="rounded cursor-pointer"
            onMouseDown={() => setIsDragging(true)}
            onMouseUp={() => setIsDragging(false)}
            onMouseLeave={() => setIsDragging(false)}
            onMouseMove={handleTimelineDrag}
          >
            {/* Timeline background */}
            <rect
              x={dimensions.margin.left}
              y={dimensions.margin.top}
              width={dimensions.width - dimensions.margin.left - dimensions.margin.right}
              height={dimensions.height - dimensions.margin.top - dimensions.margin.bottom}
              fill="#f8fafc"
            />

            {/* Event markers */}
            {allEvents.map((point, index) => (
              <circle
                key={index}
                cx={xScale(new Date(point.timestamp))}
                cy={yScale(0.5)}
                r={3}
                fill={point.events[0]?.type === 'maintenance_start' ? '#f59e0b' : '#10b981'}
                stroke="white"
                strokeWidth={1}
              />
            ))}

            {/* Current position indicator */}
            <line
              x1={xScale(currentDate)}
              y1={dimensions.margin.top}
              x2={xScale(currentDate)}
              y2={dimensions.height - dimensions.margin.bottom}
              stroke="#3b82f6"
              strokeWidth={2}
            />

            {/* Current position handle */}
            <circle
              cx={xScale(currentDate)}
              cy={yScale(0.5)}
              r={6}
              fill="#3b82f6"
              stroke="white"
              strokeWidth={2}
              className="cursor-grab active:cursor-grabbing"
            />

            {/* Time axis */}
            <g transform={`translate(0, ${dimensions.height - dimensions.margin.bottom})`}>
              {xScale.ticks(5).map((tick) => (
                <g key={tick.getTime()}>
                  <line x1={xScale(tick)} y1={0} x2={xScale(tick)} y2={5} stroke="#6b7280" />
                  <text x={xScale(tick)} y={18} textAnchor="middle" fontSize="12" fill="#6b7280">
                    {format(tick, 'MMM dd')}
                  </text>
                </g>
              ))}
            </g>
          </svg>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => onDateChange(subHours(currentDate, 1))}
              disabled={currentDate <= dateRange.start}
            >
              <SkipBack className="w-4 h-4" />
            </Button>

            <Button variant="default" size="icon" onClick={onPlayToggle}>
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={() => onDateChange(addHours(currentDate, 1))}
              disabled={currentDate >= dateRange.end}
            >
              <SkipForward className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Speed:</span>
            <select
              value={playbackSpeed}
              onChange={(e) => onSpeedChange(Number(e.target.value))}
              className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {speedOptions.map((speed) => (
                <option key={speed} value={speed}>
                  {speed}x
                </option>
              ))}
            </select>
          </div>

          <div className="text-sm text-gray-600">{format(currentDate, 'MMM dd, yyyy HH:mm')}</div>
        </div>
      </div>
    </div>
  );
};
