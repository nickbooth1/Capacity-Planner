import { useQuery } from '@tanstack/react-query';
import { StandsMapResponse } from '../types/map';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const useMapData = () => {
  return useQuery<StandsMapResponse>({
    queryKey: ['stands', 'map'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/stands/map`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch map data');
      }

      return response.json();
    },
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
  });
};
