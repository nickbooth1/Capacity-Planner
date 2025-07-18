'use client';

import { useRouter } from 'next/navigation';
import { WorkRequestForm } from '@/features/work-requests/components/WorkRequestForm';
import type { WorkRequestFormData } from '@/features/work-requests/validation/work-request-schema';

export default function NewWorkRequestPage() {
  const router = useRouter();

  const handleSubmit = async (data: WorkRequestFormData, isDraft: boolean = false) => {
    try {
      // TODO: Implement API call to create work request
      console.log('Submitting work request:', { ...data, isDraft });

      // Mock API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Redirect to work requests list on successful submission
      if (!isDraft) {
        router.push('/work');
      }
    } catch (error) {
      console.error('Error submitting work request:', error);
      // TODO: Add proper error handling/toast notifications
    }
  };

  const handleCancel = () => {
    router.push('/work');
  };

  return <WorkRequestForm mode="create" onSubmit={handleSubmit} onCancel={handleCancel} />;
}
