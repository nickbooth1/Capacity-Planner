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
} from '@tanstack/react-table';
import { Calendar, AlertCircle, Clock, CheckCircle, XCircle, Wrench, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { workRequestApi, type WorkRequestSummary } from '../api/work-request-api';
import Link from 'next/link';

interface WorkRequestsTableProps {
  organizationId: string;
  filters?: any;
}

export function WorkRequestsTable({ organizationId, filters }: WorkRequestsTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 20,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['work-requests', organizationId, pagination, columnFilters, sorting, filters],
    queryFn: () =>
      workRequestApi.getWorkRequests(organizationId, {
        page: pagination.pageIndex + 1,
        pageSize: pagination.pageSize,
        ...filters,
      }),
  });

  const requests = data?.data?.requests || [];
  const totalCount = data?.data?.pagination?.total || 0;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'submitted':
        return <Clock className="w-3 h-3 text-blue-500" />;
      case 'approved':
        return <CheckCircle className="w-3 h-3 text-green-500" />;
      case 'rejected':
        return <XCircle className="w-3 h-3 text-red-500" />;
      case 'in_progress':
        return <Wrench className="w-3 h-3 text-purple-500" />;
      case 'completed':
        return <CheckCircle className="w-3 h-3 text-green-600" />;
      default:
        return <AlertCircle className="w-3 h-3 text-gray-500" />;
    }
  };

  const getStatusVariant = (status: string): any => {
    switch (status) {
      case 'submitted':
        return 'secondary';
      case 'approved':
        return 'success';
      case 'rejected':
        return 'destructive';
      case 'in_progress':
        return 'default';
      case 'completed':
        return 'success';
      default:
        return 'secondary';
    }
  };

  const getPriorityVariant = (priority: string): any => {
    switch (priority) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'warning';
      case 'medium':
        return 'secondary';
      case 'low':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const columns: ColumnDef<WorkRequestSummary>[] = [
    {
      accessorKey: 'title',
      header: 'Request',
      cell: ({ row }) => (
        <div>
          <div className="font-semibold text-gray-900">{row.getValue('title')}</div>
          <div className="text-sm text-gray-500">ID: {row.original.id.slice(0, 8)}</div>
        </div>
      ),
    },
    {
      accessorKey: 'assetName',
      header: 'Asset',
      cell: ({ row }) => <div className="font-medium text-gray-900">{row.original.assetName}</div>,
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
              {status.replace('_', ' ')}
            </Badge>
          </div>
        );
      },
    },
    {
      accessorKey: 'priority',
      header: 'Priority',
      cell: ({ row }) => {
        const priority = row.getValue('priority') as string;
        return (
          <Badge variant={getPriorityVariant(priority)} className="capitalize">
            {priority}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'workType',
      header: 'Type',
      cell: ({ row }) => (
        <span className="text-sm text-gray-700 capitalize">{row.getValue('workType')}</span>
      ),
    },
    {
      accessorKey: 'requestedStartDate',
      header: 'Start Date',
      cell: ({ row }) => {
        const date = new Date(row.getValue('requestedStartDate'));
        return (
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <div className="text-sm text-gray-700">
              <div>{date.toLocaleDateString()}</div>
              <div className="text-xs text-gray-500">
                {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'requestedEndDate',
      header: 'End Date',
      cell: ({ row }) => {
        const endDate = row.original.requestedEndDate;
        if (!endDate) return <span className="text-gray-400 text-sm">-</span>;

        const date = new Date(endDate);
        return (
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <div className="text-sm text-gray-700">
              <div>{date.toLocaleDateString()}</div>
              <div className="text-xs text-gray-500">
                {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'requestorName',
      header: 'Requestor',
      cell: ({ row }) => (
        <span className="text-sm text-gray-700">{row.getValue('requestorName')}</span>
      ),
    },
    {
      id: 'actions',
      enableHiding: false,
      cell: ({ row }) => {
        const request = row.original;
        return (
          <div className="flex items-center space-x-1">
            <Link href={`/work-requests/${request.id}`}>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600"
              >
                <Eye className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data: requests,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onPaginationChange: setPagination,
    state: {
      sorting,
      columnFilters,
      pagination,
    },
    manualPagination: true,
    pageCount: Math.ceil(totalCount / pagination.pageSize),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading work requests...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-600">Error loading work requests</div>
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        {requests.length === 0 ? (
          <div className="text-center py-12">
            <Wrench className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No work requests found</p>
          </div>
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
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-gray-50 cursor-pointer">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {requests.length > 0 && (
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing {pagination.pageIndex * pagination.pageSize + 1} to{' '}
              {Math.min((pagination.pageIndex + 1) * pagination.pageSize, totalCount)} of{' '}
              {totalCount} requests
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
      )}
    </div>
  );
}
