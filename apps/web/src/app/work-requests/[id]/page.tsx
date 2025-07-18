'use client';

import { useParams } from 'next/navigation';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MainNavigation } from '@/components/navigation/MainNavigation';
import { WorkRequestDetail } from '@/features/work-requests/components/WorkRequestDetail';
import { Wrench, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const queryClient = new QueryClient();

function WorkRequestDetailContent() {
  const params = useParams();
  const workRequestId = params?.id as string;

  // TODO: Get from auth context
  const organizationId = 'example-org-id';

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Navigation */}
      <MainNavigation />

      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/work-requests">
                <Button variant="ghost" size="sm" className="flex items-center space-x-2">
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Requests</span>
                </Button>
              </Link>
              <div className="flex items-center space-x-4">
                <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-xl">
                  <Wrench className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Work Request Details</h1>
                  <p className="text-gray-600 mt-1">View and manage work request information</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        <WorkRequestDetail organizationId={organizationId} workRequestId={workRequestId} />
      </div>
    </div>
  );
}

export default function WorkRequestDetailPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <WorkRequestDetailContent />
    </QueryClientProvider>
  );
}
