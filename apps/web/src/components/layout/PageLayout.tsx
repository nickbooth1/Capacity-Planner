'use client';

import { ReactNode } from 'react';
import { MainNavigation } from '@/components/navigation/MainNavigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface PageLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
  icon?: ReactNode;
  breadcrumbs?: Array<{
    name: string;
    href?: string;
  }>;
  actions?: ReactNode;
  showBackButton?: boolean;
  backHref?: string;
}

export function PageLayout({
  children,
  title,
  description,
  icon,
  breadcrumbs,
  actions,
  showBackButton = false,
  backHref,
}: PageLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <MainNavigation />

      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-10">
        {/* Breadcrumbs */}
        {breadcrumbs && (
          <nav className="flex pt-6 pb-3" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-2 text-sm text-gray-500">
              {breadcrumbs.map((crumb, index) => (
                <li key={index} className="flex items-center">
                  {index > 0 && <span className="mx-2 text-gray-400">/</span>}
                  {crumb.href ? (
                    <Link href={crumb.href} className="hover:text-gray-700 transition-colors">
                      {crumb.name}
                    </Link>
                  ) : (
                    <span className="text-gray-900 font-medium">{crumb.name}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}

        {/* Page Header */}
        <div className="py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-5">
              {showBackButton && (
                <Link href={backHref || '/'}>
                  <Button variant="ghost" size="sm" className="flex items-center space-x-2">
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                  </Button>
                </Link>
              )}

              {icon && (
                <div className="flex items-center justify-center w-14 h-14 bg-blue-100 rounded-2xl">
                  {icon}
                </div>
              )}

              <div>
                <h1 className="text-4xl font-bold text-gray-900 tracking-tight">{title}</h1>
                {description && <p className="mt-2 text-lg text-gray-600">{description}</p>}
              </div>
            </div>

            {actions && <div className="flex items-center space-x-4">{actions}</div>}
          </div>
        </div>

        {/* Page Content */}
        <div className="pb-12">{children}</div>
      </div>
    </div>
  );
}
