'use client';

import { useSearchParams } from 'next/navigation';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MainNavigation } from '@/components/navigation/MainNavigation';
import { WorkRequestForm } from '@/features/work-requests/components/WorkRequestForm';
import { Wrench, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const queryClient = new QueryClient();

function NewWorkRequestContent() {
  const searchParams = useSearchParams();

  // Get pre-filled data from URL params
  const assetId = searchParams.get('assetId');
  const assetType = searchParams.get('assetType');
  const assetCode = searchParams.get('assetCode');
  const assetName = searchParams.get('assetName');

  // TODO: Get from auth context
  const organizationId = 'example-org-id';
  const userId = 'test-user-id';

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
                  <span>Back</span>
                </Button>
              </Link>
              <div className="flex items-center space-x-4">
                <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-xl">
                  <Wrench className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">New Work Request</h1>
                  <p className="text-gray-600 mt-1">Create a new maintenance or work request</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <WorkRequestForm
              organizationId={organizationId}
              userId={userId}
              prefilledData={
                assetId
                  ? {
                      assetId: assetId || undefined,
                      assetType: assetType || undefined,
                      assetCode: assetCode || undefined,
                      assetName: assetName || undefined,
                    }
                  : undefined
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NewWorkRequestPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <NewWorkRequestContent />
    </QueryClientProvider>
  );
}
