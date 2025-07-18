import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
} from '@tanstack/react-table';
import {
  Search,
  Plus,
  Filter,
  Download,
  RefreshCw,
  Plane,
  MapPin,
  Activity,
  Calendar,
  Edit2,
  Trash2,
  MoreHorizontal,
  X,
  Wrench,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { standApi } from '../api/stand-api';
import { StandFormSimple } from './StandFormSimple';
import { StandFilters } from './StandFilters';
import { StandTableSkeleton } from './StandTableSkeleton';
import { EmptyState } from './EmptyState';
import type { Stand } from '../types';
import { useRouter } from 'next/navigation';

interface StandDataTableProps {
  organizationId: string;
  selectedStandId?: string;
  onStandSelect?: (standId: string) => void;
  onFiltersChange?: (filters: any) => void;
}

export function StandDataTable({
  organizationId,
  selectedStandId,
  onStandSelect,
  onFiltersChange,
}: StandDataTableProps) {
  const router = useRouter();
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 50,
  });
  const [globalFilter, setGlobalFilter] = React.useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [selectedStand, setSelectedStand] = React.useState<Stand | null>(null);

  // Debug modal state
  React.useEffect(() => {
    console.log(
      'Modal state changed - isCreateDialogOpen:',
      isCreateDialogOpen,
      'selectedStand:',
      selectedStand
    );
  }, [isCreateDialogOpen, selectedStand]);

  // Sync filters with parent component
  React.useEffect(() => {
    if (onFiltersChange) {
      const filters: any = {};

      // Extract status filter
      const statusFilter = columnFilters.find((f) => f.id === 'status');
      if (statusFilter) {
        filters.status = statusFilter.value;
      }

      // Extract terminal filter
      const terminalFilter = columnFilters.find((f) => f.id === 'terminalCode');
      if (terminalFilter) {
        filters.terminal = terminalFilter.value;
      }

      // Add search filter
      if (globalFilter) {
        filters.search = globalFilter;
      }

      onFiltersChange(filters);
    }
  }, [columnFilters, globalFilter, onFiltersChange]);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['stands', organizationId, pagination, columnFilters, sorting, globalFilter],
    queryFn: () =>
      standApi.getStands(organizationId, {
        page: pagination.pageIndex + 1,
        pageSize: pagination.pageSize,
        search: globalFilter,
        ...Object.fromEntries(columnFilters.map((filter) => [filter.id, filter.value])),
      }),
  });

  const stands = data?.data || [];
  const totalCount = data?.meta?.total || 0;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'operational':
        return <Activity className="w-3 h-3 text-green-500" />;
      case 'maintenance':
        return <Activity className="w-3 h-3 text-yellow-500" />;
      default:
        return <Activity className="w-3 h-3 text-red-500" />;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'operational':
        return 'success';
      case 'maintenance':
        return 'warning';
      default:
        return 'destructive';
    }
  };

  const columns: ColumnDef<Stand>[] = [
    {
      accessorKey: 'code',
      header: 'Stand Code',
      cell: ({ row }) => (
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-lg">
            <Plane className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <div className="font-semibold text-gray-900">{row.getValue('code')}</div>
            <div className="text-sm text-gray-500">{row.original.name}</div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'location',
      header: 'Location',
      cell: ({ row }) => (
        <div className="flex items-center space-x-2">
          <MapPin className="w-4 h-4 text-gray-400" />
          <div>
            <div className="font-medium text-gray-900">{row.original.terminal || 'Remote'}</div>
            <div className="text-sm text-gray-500">
              {row.original.pier ? `Pier ${row.original.pier}` : 'No pier'}
            </div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.getValue('status') as string;
        return (
          <div className="flex items-center space-x-2">
            {getStatusIcon(status)}
            <Badge variant={getStatusVariant(status)} className="capitalize">
              {status}
            </Badge>
          </div>
        );
      },
    },
    {
      accessorKey: 'capabilities',
      header: 'Capabilities',
      cell: ({ row }) => {
        const stand = row.original;
        const capabilities = stand.capabilities as any;
        return (
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="text-xs">
                {capabilities?.aircraftSize ? `Cat ${capabilities.aircraftSize}` : 'N/A'}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {capabilities?.maxWeight ? `${capabilities.maxWeight}t` : 'N/A'}
              </Badge>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ row }) => {
        const date = new Date(row.getValue('createdAt'));
        return (
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <div>
              <div className="text-sm font-medium text-gray-900">{date.toLocaleDateString()}</div>
              <div className="text-xs text-gray-500">{date.toLocaleTimeString()}</div>
            </div>
          </div>
        );
      },
    },
    {
      id: 'actions',
      enableHiding: false,
      cell: ({ row }) => {
        const stand = row.original;
        return (
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                // Navigate to work request creation with pre-filled stand data
                router.push(
                  `/work-requests/new?assetId=${stand.id}&assetType=stand&assetCode=${stand.code}&assetName=${encodeURIComponent(stand.name)}`
                );
              }}
              className="h-8 w-8 p-0 hover:bg-green-50 hover:text-green-600 group relative"
              title="Create Maintenance Request"
            >
              <Wrench className="h-4 w-4" />
              <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                Create Maintenance Request
              </span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                // Navigate to work requests list filtered by this stand
                router.push(`/work-requests?assetId=${stand.id}&assetCode=${stand.code}`);
              }}
              className="h-8 w-8 p-0 hover:bg-purple-50 hover:text-purple-600 group relative"
              title="View Maintenance History"
            >
              <Calendar className="h-4 w-4" />
              <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                View Maintenance History
              </span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                console.log('Edit button clicked for stand:', stand.id);
                setSelectedStand(stand);
              }}
              className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600 group relative"
              title="Edit Stand"
            >
              <Edit2 className="h-4 w-4" />
              <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                Edit Stand
              </span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteStand(stand.id);
              }}
              className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600 group relative"
              title="Delete Stand"
            >
              <Trash2 className="h-4 w-4" />
              <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                Delete Stand
              </span>
            </Button>
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data: stands,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: 'includesString',
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination,
      globalFilter,
    },
    manualPagination: true,
    pageCount: Math.ceil(totalCount / pagination.pageSize),
  });

  const handleDeleteStand = async (standId: string) => {
    try {
      await standApi.deleteStand(standId, organizationId);
      refetch();
    } catch (error) {
      console.error('Error deleting stand:', error);
    }
  };

  const handleStandCreated = () => {
    setIsCreateDialogOpen(false);
    refetch();
  };

  const handleStandUpdated = () => {
    setSelectedStand(null);
    refetch();
  };

  const handleExportData = () => {
    if (stands.length === 0) {
      console.log('No data to export');
      return;
    }

    // Create CSV content
    const headers = [
      'Code',
      'Name',
      'Terminal',
      'Pier',
      'Status',
      'Aircraft Size',
      'Max Weight',
      'Created',
    ];
    const csvContent = [
      headers.join(','),
      ...stands.map((stand) => {
        const capabilities = stand.capabilities as any;
        return [
          stand.code,
          stand.name,
          stand.terminal || 'Remote',
          stand.pier || '',
          stand.status,
          capabilities?.aircraftSize || '',
          capabilities?.maxWeight || '',
          new Date(stand.createdAt).toLocaleDateString(),
        ].join(',');
      }),
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `stands-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) return <StandTableSkeleton />;
  if (error) return <div className="text-center py-12 text-red-600">Error loading stands</div>;

  return (
    <div className="bg-white rounded-xl shadow-sm">
      {/* Enhanced Header */}
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search stands..."
                value={globalFilter ?? ''}
                onChange={(event) => setGlobalFilter(event.target.value)}
                className="pl-10 w-80 bg-gray-50 border-gray-200 focus:bg-white"
              />
            </div>
            <StandFilters columnFilters={columnFilters} setColumnFilters={setColumnFilters} />
          </div>
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center space-x-2"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportData}
              disabled={stands.length === 0}
              className="flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/work-requests')}
              className="flex items-center space-x-2 border-green-600 text-green-600 hover:bg-green-50"
            >
              <Wrench className="w-4 h-4" />
              <span>Work Requests</span>
            </Button>
            <Button
              onClick={() => {
                console.log('Add Stand button clicked');
                setIsCreateDialogOpen(true);
              }}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              <span>Add Stand</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {stands.length === 0 ? (
          <EmptyState onAddStand={() => setIsCreateDialogOpen(true)} />
        ) : (
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="bg-gray-50 text-gray-900 font-semibold">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => {
                const stand = row.original as Stand;
                const isSelected = selectedStandId === stand.id;
                return (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && 'selected'}
                    className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50 hover:bg-blue-100' : ''
                    }`}
                    onClick={(e) => {
                      // Prevent row click when clicking on action buttons
                      if ((e.target as HTMLElement).closest('button')) {
                        return;
                      }
                      onStandSelect?.(stand.id);
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-4">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Enhanced Pagination */}
      <div className="px-6 py-4 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <span>Showing</span>
            <span className="font-medium text-gray-900">
              {pagination.pageIndex * pagination.pageSize + 1}
            </span>
            <span>to</span>
            <span className="font-medium text-gray-900">
              {Math.min((pagination.pageIndex + 1) * pagination.pageSize, totalCount)}
            </span>
            <span>of</span>
            <span className="font-medium text-gray-900">{totalCount}</span>
            <span>stands</span>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {isCreateDialogOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]"
          onClick={() => setIsCreateDialogOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-6 max-w-4xl max-h-[90vh] overflow-y-auto relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Create New Stand</h3>
              <button
                onClick={() => setIsCreateDialogOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="relative">
              <StandFormSimple organizationId={organizationId} onSuccess={handleStandCreated} />
            </div>
          </div>
        </div>
      )}

      {!!selectedStand && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]"
          onClick={() => setSelectedStand(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-6 max-w-4xl max-h-[90vh] overflow-y-auto relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Edit Stand</h3>
              <button
                onClick={() => setSelectedStand(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="relative">
              <StandFormSimple
                organizationId={organizationId}
                stand={selectedStand}
                onSuccess={handleStandUpdated}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
