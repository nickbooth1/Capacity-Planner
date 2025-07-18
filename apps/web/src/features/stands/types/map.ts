export interface StandMapData {
  id: string;
  code: string;
  name: string;
  latitude: number;
  longitude: number;
  status: 'operational' | 'maintenance' | 'closed';
  terminal_code: string;
  pier_code?: string;
  aircraft_size_category: string;
  max_weight_kg: number;
  power_supply: string[];
  ground_support: string[];
}

export interface StandsMapResponse {
  stands: StandMapData[];
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  } | null;
  center: {
    lat: number;
    lng: number;
  } | null;
  zoom: number;
}

export interface MapFilters {
  status?: string;
  terminal?: string;
  search?: string;
}
