import { Plane, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  onAddStand: () => void;
}

export function EmptyState({ onAddStand }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
        <Plane className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">No stands found</h3>
      <p className="text-gray-600 text-center max-w-md mb-6">
        Get started by adding your first airport stand. You can manage capabilities, operational
        status, and more.
      </p>
      <Button
        onClick={() => {
          console.log('EmptyState Add button clicked');
          onAddStand();
        }}
        className="flex items-center space-x-2"
      >
        <Plus className="w-4 h-4" />
        <span>Add Your First Stand</span>
      </Button>
    </div>
  );
}
