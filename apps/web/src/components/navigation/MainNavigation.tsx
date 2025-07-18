'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Plane,
  Wrench,
  Bell,
  User,
  Menu,
  BarChart3,
  Calendar,
  Settings,
  Database,
  Target,
  MapPin,
  Building,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

export function MainNavigation() {
  const pathname = usePathname();

  // Main navigation modules
  const mainNavItems = [
    {
      name: 'Assets',
      href: '/stands', // Default to stands for now
      icon: Database,
      description: 'Manage airport assets',
      subItems: [
        { name: 'Stands', href: '/stands', icon: Plane },
        { name: 'Gates', href: '/gates', icon: Target, disabled: true },
        { name: 'Airfield', href: '/airfield', icon: MapPin, disabled: true },
      ],
    },
    {
      name: 'Data',
      href: '/data',
      icon: BarChart3,
      description: 'Data management',
      disabled: true,
    },
    {
      name: 'Capacity',
      href: '/capacity',
      icon: Target,
      description: 'Capacity planning',
      disabled: true,
    },
    {
      name: 'Planning',
      href: '/planning',
      icon: Calendar,
      description: 'Strategic planning',
      disabled: true,
    },
    {
      name: 'Scenarios',
      href: '/scenarios',
      icon: Building,
      description: 'Scenario modeling',
      disabled: true,
    },
    {
      name: 'Work Scheduling',
      href: '/work-requests',
      icon: Wrench,
      description: 'Manage maintenance and work orders',
    },
    {
      name: 'Monitoring',
      href: '/monitoring',
      icon: BarChart3,
      description: 'System monitoring',
      disabled: true,
    },
    {
      name: 'Analytics',
      href: '/analytics',
      icon: BarChart3,
      description: 'Advanced analytics',
      disabled: true,
    },
  ];

  const getActiveModule = () => {
    if (
      pathname.startsWith('/stands') ||
      pathname.startsWith('/gates') ||
      pathname.startsWith('/airfield')
    ) {
      return 'Assets';
    }
    if (pathname.startsWith('/work-requests') || pathname.startsWith('/work')) {
      return 'Work Scheduling';
    }
    return null;
  };

  const activeModule = getActiveModule();

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-8 h-8 bg-blue-600 rounded-lg">
                <Plane className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-semibold text-gray-900">CapaCity™</span>
            </Link>
          </div>

          {/* Main Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {mainNavItems.map((item) => {
              const isActive = activeModule === item.name;
              const Icon = item.icon;

              if (item.disabled) {
                return (
                  <div
                    key={item.name}
                    className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-400 cursor-not-allowed"
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.name}</span>
                  </div>
                );
              }

              if (item.subItems) {
                return (
                  <DropdownMenu key={item.name}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className={`flex items-center space-x-2 px-3 py-2 text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.name}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48">
                      {item.subItems.map((subItem) => (
                        <DropdownMenuItem key={subItem.name} asChild disabled={subItem.disabled}>
                          <Link
                            href={subItem.href}
                            className={`flex items-center space-x-2 ${
                              subItem.disabled ? 'text-gray-400 cursor-not-allowed' : ''
                            }`}
                          >
                            <subItem.icon className="w-4 h-4" />
                            <span>{subItem.name}</span>
                            {subItem.disabled && (
                              <span className="ml-auto text-xs text-gray-400">Soon</span>
                            )}
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              }

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>

          {/* Right side - Notifications and User */}
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" className="relative">
              <Bell className="w-5 h-5 text-gray-600" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">
                3
              </span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-gray-600" />
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem>
                  <User className="w-4 h-4 mr-2" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <Button variant="ghost" size="sm">
                <Menu className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
