import { Inter } from 'next/font/google';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const inter = Inter({ subsets: ['latin'] });

export default function WorkLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${inter.className} min-h-screen bg-gray-50`}>
      <nav className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-8">
              <Link href="/" className="text-xl font-bold text-gray-900">
                CapaCity Planner
              </Link>
              <div className="flex space-x-6">
                <Link href="/work" className="text-gray-700 hover:text-blue-600 font-medium">
                  Work Requests
                </Link>
                <Link href="/stands" className="text-gray-700 hover:text-blue-600 font-medium">
                  Stands
                </Link>
                <Link href="/admin" className="text-gray-700 hover:text-blue-600 font-medium">
                  Admin
                </Link>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Welcome, User</span>
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                U
              </div>
            </div>
          </div>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  );
}
