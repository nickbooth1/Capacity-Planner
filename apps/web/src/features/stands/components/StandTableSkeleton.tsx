export function StandTableSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="h-10 w-80 bg-gray-200 rounded-lg animate-pulse"></div>
            <div className="h-8 w-20 bg-gray-200 rounded-lg animate-pulse"></div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="h-8 w-20 bg-gray-200 rounded-lg animate-pulse"></div>
            <div className="h-8 w-20 bg-gray-200 rounded-lg animate-pulse"></div>
            <div className="h-8 w-28 bg-gray-200 rounded-lg animate-pulse"></div>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="space-y-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center space-x-4">
              <div className="h-12 w-12 bg-gray-200 rounded-lg animate-pulse"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-3 w-16 bg-gray-200 rounded animate-pulse"></div>
              </div>
              <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-4 w-16 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
