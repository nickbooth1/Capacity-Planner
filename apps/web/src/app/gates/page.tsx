'use client';

import { MainNavigation } from '@/components/navigation/MainNavigation';
import { AssetModuleSidebar } from '@/components/navigation/AssetModuleSidebar';
import { Target, Construction } from 'lucide-react';

export default function GatesPage() {
  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Navigation */}
      <MainNavigation />

      {/* Main Layout with Sidebar */}
      <div className="flex">
        {/* Left Sidebar */}
        <AssetModuleSidebar />

        {/* Main Content Area */}
        <div className="flex-1 bg-gray-50">
          {/* Header */}
          <div className="bg-white">
            <div className="px-8 py-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-xl">
                    <Target className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900">Gate Management</h1>
                    <p className="text-gray-600 mt-1">
                      Manage terminal gates and passenger boarding areas
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-8">
            <div className="bg-white rounded-xl shadow-sm p-12">
              <div className="text-center">
                <div className="flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mx-auto mb-4">
                  <Construction className="w-10 h-10 text-gray-400" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Coming Soon</h2>
                <p className="text-gray-600 mb-6">
                  Gate management functionality is currently under development.
                </p>
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    This module will include gate assignments, passenger flow management, and
                    integration with flight schedules.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
