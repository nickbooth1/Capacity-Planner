import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface TimelineDataPoint {
  timestamp: Date;
  status: string;
  events: TimelineEvent[];
}

export interface TimelineEvent {
  id: string;
  type: 'status_change' | 'maintenance_start' | 'maintenance_end';
  time: Date;
  status?: string;
  previousStatus?: string;
  reason?: string;
  changedBy?: string;
  metadata?: any;
}

interface TimelineState {
  currentDate: Date;
  dateRange: { start: Date; end: Date };
  isPlaying: boolean;
  playbackSpeed: number;
  timelineData: Record<string, TimelineDataPoint[]>;
  loading: boolean;
  error: string | null;
}

interface TimelineActions {
  setCurrentDate: (date: Date) => void;
  setDateRange: (start: Date, end: Date) => void;
  setIsPlaying: (playing: boolean) => void;
  setPlaybackSpeed: (speed: number) => void;
  loadTimelineData: (standIds: string[], start: Date, end: Date) => Promise<void>;
  clearTimelineData: () => void;
}

export const useTimelineStore = create<TimelineState & TimelineActions>()(
  devtools(
    (set, get) => ({
      // State
      currentDate: new Date(),
      dateRange: { start: new Date(), end: new Date() },
      isPlaying: false,
      playbackSpeed: 1,
      timelineData: {},
      loading: false,
      error: null,

      // Actions
      setCurrentDate: (date) => set({ currentDate: date }),

      setDateRange: (start, end) =>
        set({
          dateRange: { start, end },
          currentDate: end, // Set current date to end of range
        }),

      setIsPlaying: (playing) => set({ isPlaying: playing }),

      setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),

      loadTimelineData: async (standIds, start, end) => {
        set({ loading: true, error: null });

        try {
          const response = await fetch(
            `/api/stands/timeline?start=${start.toISOString()}&end=${end.toISOString()}&standIds=${standIds.join(',')}`
          );

          if (!response.ok) {
            throw new Error('Failed to load timeline data');
          }

          const result = await response.json();
          if (result.success) {
            set({ timelineData: result.data.stands, loading: false });
          } else {
            throw new Error(result.error || 'Failed to load timeline data');
          }
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Unknown error',
            loading: false,
          });
        }
      },

      clearTimelineData: () => set({ timelineData: {}, error: null }),
    }),
    {
      name: 'timeline-store',
    }
  )
);
