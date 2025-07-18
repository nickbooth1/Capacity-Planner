import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, CheckCircle, Plane } from 'lucide-react';
import { standApi } from '../api/stand-api';

interface StandStatsCardsProps {
  organizationId: string;
}

export function StandStatsCards({ organizationId }: StandStatsCardsProps) {
  const { data: stands } = useQuery({
    queryKey: ['stands', organizationId],
    queryFn: () => standApi.getStands(organizationId, { page: 1, pageSize: 1000 }),
  });

  const standsData = stands?.data || [];

  const stats = React.useMemo(() => {
    const total = standsData.length;
    const operational = standsData.filter((s) => s.status === 'operational').length;
    const maintenance = standsData.filter((s) => s.status === 'maintenance').length;
    const closed = standsData.filter((s) => s.status === 'closed').length;

    return [
      {
        title: 'Total Stands',
        value: total,
        icon: Plane,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
      },
      {
        title: 'Operational',
        value: operational,
        icon: CheckCircle,
        color: 'text-green-600',
        bgColor: 'bg-green-50',
      },
      {
        title: 'Maintenance',
        value: maintenance,
        icon: AlertTriangle,
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
      },
      {
        title: 'Closed',
        value: closed,
        icon: Activity,
        color: 'text-red-600',
        bgColor: 'bg-red-50',
      },
    ];
  }, [standsData]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div
            key={index}
            className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 p-6"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">{stat.title}</p>
                <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
              </div>
              <div className={`${stat.bgColor} p-3 rounded-full`}>
                <Icon className={`w-6 h-6 ${stat.color}`} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
