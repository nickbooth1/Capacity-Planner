import * as React from 'react';
import { Filter, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { airportApi } from '@/features/airport/api/airport-api';
import type { ColumnFiltersState } from '@tanstack/react-table';

interface StandFiltersProps {
  columnFilters: ColumnFiltersState;
  setColumnFilters: React.Dispatch<React.SetStateAction<ColumnFiltersState>>;
}

export function StandFilters({ columnFilters, setColumnFilters }: StandFiltersProps) {
  const [showFilters, setShowFilters] = React.useState(false);
  const [selectedTerminal, setSelectedTerminal] = React.useState<string | null>(null);

  const { data: airportConfig } = useQuery({
    queryKey: ['airport-config'],
    queryFn: () => airportApi.getAirportConfig(),
  });

  const updateFilter = (id: string, value: string | undefined) => {
    setColumnFilters((prev: ColumnFiltersState) => {
      const filtered = prev.filter((filter) => filter.id !== id);
      if (value) {
        return [...filtered, { id, value }];
      }
      return filtered;
    });
  };

  const removeFilter = (id: string) => {
    setColumnFilters((prev: ColumnFiltersState) => prev.filter((filter) => filter.id !== id));
  };

  const clearFilters = () => {
    setColumnFilters([]);
    setSelectedTerminal(null);
  };

  const getFilterValue = (id: string) => {
    return columnFilters.find((filter) => filter.id === id)?.value as string | undefined;
  };

  const activeFiltersCount = columnFilters.length;

  const getFilterLabel = (id: string, value: string) => {
    switch (id) {
      case 'status':
        return `Status: ${value}`;
      case 'terminal':
        return `Terminal: ${value}`;
      case 'pier':
        return `Pier: ${value}`;
      case 'aircraftCategory':
        return `Category: ${value}`;
      default:
        return `${id}: ${value}`;
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowFilters(!showFilters)}
        className="relative flex items-center space-x-2"
      >
        <Filter className="h-4 w-4" />
        <span>Filters</span>
        {activeFiltersCount > 0 && (
          <Badge variant="secondary" className="ml-2 h-5 w-5 rounded-full p-0 text-xs">
            {activeFiltersCount}
          </Badge>
        )}
      </Button>

      {/* Active Filter Chips */}
      {activeFiltersCount > 0 && (
        <div className="flex items-center space-x-2">
          {columnFilters.map((filter) => (
            <Badge key={filter.id} variant="secondary" className="flex items-center space-x-1 pr-1">
              <span className="text-xs">{getFilterLabel(filter.id, filter.value as string)}</span>
              <button
                onClick={() => removeFilter(filter.id)}
                className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-6 px-2">
            Clear all
          </Button>
        </div>
      )}

      {/* Filter Dropdowns */}
      {showFilters && (
        <div className="flex items-center gap-2">
          <Select
            value={getFilterValue('status') || ''}
            onValueChange={(value) => updateFilter('status', value || undefined)}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Status</SelectItem>
              <SelectItem value="operational">Operational</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={getFilterValue('terminal') || ''}
            onValueChange={(value) => {
              updateFilter('terminal', value || undefined);
              setSelectedTerminal(value || null);
              updateFilter('pier', undefined);
            }}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Terminal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Terminals</SelectItem>
              {airportConfig?.terminals.map((terminal) => (
                <SelectItem key={terminal.id} value={terminal.code}>
                  {terminal.name}
                </SelectItem>
              ))}
              <SelectItem value="Remote">Remote</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={getFilterValue('pier') || ''}
            onValueChange={(value) => updateFilter('pier', value || undefined)}
            disabled={!selectedTerminal || selectedTerminal === 'Remote'}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Pier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Piers</SelectItem>
              {(() => {
                const terminal = airportConfig?.terminals.find((t) => t.code === selectedTerminal);
                return (
                  terminal?.piers.map((pier) => (
                    <SelectItem key={pier.code} value={pier.code}>
                      {pier.name}
                    </SelectItem>
                  )) || []
                );
              })()}
            </SelectContent>
          </Select>

          <Select
            value={getFilterValue('aircraftCategory') || ''}
            onValueChange={(value) => updateFilter('aircraftCategory', value || undefined)}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Categories</SelectItem>
              <SelectItem value="A">Category A</SelectItem>
              <SelectItem value="B">Category B</SelectItem>
              <SelectItem value="C">Category C</SelectItem>
              <SelectItem value="D">Category D</SelectItem>
              <SelectItem value="E">Category E</SelectItem>
              <SelectItem value="F">Category F</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
