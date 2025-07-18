import { API_BASE_URL } from '@/config/api';

export interface Pier {
  code: string;
  name: string;
  standRanges: string[];
}

export interface Terminal {
  id: string;
  code: string;
  name: string;
  standRanges: string[];
  piers: Pier[];
}

export interface Runway {
  id: string;
  code: string;
  name: string;
  length: number;
  width: number;
  surface: string;
}

export interface AirportConfiguration {
  id: string;
  organizationId: string;
  icaoCode?: string;
  iataCode?: string;
  timezone?: string;
  terminals: Terminal[];
  runways?: Runway[];
  metadata?: Record<string, any>;
}

export const airportApi = {
  async getAirportConfig(): Promise<AirportConfiguration> {
    const response = await fetch(`${API_BASE_URL}/api/airport-config`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch airport configuration');
    }

    const result = await response.json();
    return result.data;
  },
};
