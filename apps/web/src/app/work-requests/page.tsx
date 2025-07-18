'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkRequestsTable } from '@/features/work-requests/components/WorkRequestsTable';
import { PageLayout } from '@/components/layout/PageLayout';
import { Wrench, Plus, Filter, Search, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';

const queryClient = new QueryClient();

function WorkRequestsPageContent() {
  const [globalFilter, setGlobalFilter] = useState('');

  // TODO: Get from auth context
  const organizationId = 'example-org-id';

  const breadcrumbs = [
    { name: 'Home', href: '/' },
    { name: 'Work Scheduling', href: '/work-requests' },
    { name: 'Requests' },
  ];

  const actions = (
    <>
      <Button variant="outline" size="sm" className="flex items-center space-x-2">
        <RefreshCw className="w-4 h-4" />
        <span>Refresh</span>
      </Button>
      <Link href="/work-requests/new">
        <Button size="sm" className="flex items-center space-x-2">
          <Plus className="w-4 h-4" />
          <span>New Work Request</span>
        </Button>
      </Link>
    </>
  );

  return (
    <PageLayout
      title="Work Scheduling"
      description="Manage maintenance requests and work orders"
      icon={<Wrench className="w-6 h-6 text-green-600" />}
      breadcrumbs={breadcrumbs}
      actions={actions}
    >
      <div className="space-y-10">
        {/* Search and Filters with improved design */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-8">
            <div className="flex items-center space-x-6">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  placeholder="Search work requests..."
                  value={globalFilter}
                  onChange={(e) => setGlobalFilter(e.target.value)}
                  className="pl-12 h-12 bg-gray-50 border-gray-200 focus:bg-white text-base"
                />
              </div>
              <Button variant="outline" className="flex items-center space-x-2 h-12 px-6">
                <Filter className="w-4 h-4" />
                <span>Filters</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Work Requests Table with improved design */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <WorkRequestsTable organizationId={organizationId} filters={{ search: globalFilter }} />
        </div>
      </div>
    </PageLayout>
  );
}

export default function WorkRequestsPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <WorkRequestsPageContent />
    </QueryClientProvider>
  );
}
