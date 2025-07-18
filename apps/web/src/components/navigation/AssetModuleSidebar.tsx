'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plane, Building, Target, MapPin } from 'lucide-react';

export function AssetModuleSidebar() {
  const pathname = usePathname();

  const menuItems = [
    {
      name: 'Stands',
      href: '/stands',
      icon: Plane,
      description: 'Manage airport stands',
      active: true,
    },
    {
      name: 'Gates',
      href: '/gates',
      icon: Target,
      description: 'Manage terminal gates',
      active: false,
    },
    {
      name: 'Airfield',
      href: '/airfield',
      icon: MapPin,
      description: 'Manage airfield infrastructure',
      active: false,
    },
  ];

  return (
    <div className="w-64 bg-white min-h-full">
      {/* Module Header */}
      <div className="p-6">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-lg">
            <Building className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Asset Module</h2>
            <p className="text-sm text-gray-500">Manage airport assets</p>
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <nav className="px-4 pb-4 space-y-3">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          const isEnabled = item.active;

          return (
            <div key={item.href}>
              {isEnabled ? (
                <Link
                  href={item.href}
                  className={`
                    flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors
                    ${
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  <div className="flex-1">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-gray-500">{item.description}</div>
                  </div>
                </Link>
              ) : (
                <div className="flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-400 cursor-not-allowed">
                  <Icon className="w-5 h-5" />
                  <div className="flex-1">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-gray-400">Coming soon</div>
                  </div>
                  <span className="text-xs px-2 py-1 bg-gray-100 text-gray-500 rounded">Soon</span>
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
}
