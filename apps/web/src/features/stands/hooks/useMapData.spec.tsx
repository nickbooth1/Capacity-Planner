import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMapData } from './useMapData';
import type { StandsMapResponse } from '../types/map';

// Mock fetch
global.fetch = jest.fn();

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useMapData', () => {
  const mockMapResponse: StandsMapResponse = {
    stands: [
      {
        id: '1',
        code: 'A1',
        name: 'Stand A1',
        latitude: 53.3498,
        longitude: -2.2744,
        status: 'operational',
        terminal_code: 'T1',
        pier_code: 'North',
        aircraft_size_category: 'Medium',
        max_weight_kg: 75000,
        power_supply: ['400Hz'],
        ground_support: ['GPU'],
      },
    ],
    bounds: {
      north: 53.35,
      south: 53.3498,
      east: -2.2744,
      west: -2.2746,
    },
    center: {
      lat: 53.3499,
      lng: -2.2745,
    },
    zoom: 14,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('fetches map data successfully', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockMapResponse,
    });

    const { result } = renderHook(() => useMapData(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockMapResponse);
    expect(result.current.error).toBeNull();
  });

  test('handles fetch error', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    const { result } = renderHook(() => useMapData(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(new Error('Failed to fetch map data'));
    expect(result.current.data).toBeUndefined();
  });

  test('handles network error', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useMapData(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(new Error('Network error'));
    expect(result.current.data).toBeUndefined();
  });

  test('uses correct API endpoint', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockMapResponse,
    });

    renderHook(() => useMapData(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/stands/map',
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );
    });
  });

  test('uses custom API URL from environment variable', async () => {
    const originalEnv = process.env.NEXT_PUBLIC_API_URL;
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com';

    // Re-import to pick up new env var
    jest.resetModules();
    const { useMapData: useMapDataWithEnv } = require('./useMapData');

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockMapResponse,
    });

    renderHook(() => useMapDataWithEnv(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/api/stands/map',
        expect.any(Object)
      );
    });

    process.env.NEXT_PUBLIC_API_URL = originalEnv;
  });

  test('does not refetch on window focus', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockMapResponse,
    });

    renderHook(() => useMapData(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    // Simulate window focus
    window.dispatchEvent(new Event('focus'));

    // Should not trigger another fetch
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('respects stale time configuration', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockMapResponse,
    });

    const { result } = renderHook(() => useMapData(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Data should be considered fresh for 30 seconds
    expect(result.current.isStale).toBe(false);
  });

  test('returns correct data structure', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockMapResponse,
    });

    const { result } = renderHook(() => useMapData(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data).toHaveProperty('stands');
    expect(result.current.data).toHaveProperty('bounds');
    expect(result.current.data).toHaveProperty('center');
    expect(result.current.data).toHaveProperty('zoom');
    expect(result.current.data?.stands).toHaveLength(1);
  });
});
