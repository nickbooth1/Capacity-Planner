'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './admin.module.css';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Don't show navigation on login page
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
  };

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <h2>CapaCity Admin</h2>
        </div>
        <nav className={styles.nav}>
          <Link
            href="/admin/dashboard"
            className={`${styles.navLink} ${pathname === '/admin/dashboard' ? styles.active : ''}`}
          >
            Dashboard
          </Link>
          <Link
            href="/admin/organizations"
            className={`${styles.navLink} ${pathname.startsWith('/admin/organizations') ? styles.active : ''}`}
          >
            Organizations
          </Link>
          <Link
            href="/admin/entitlements"
            className={`${styles.navLink} ${pathname === '/admin/entitlements' ? styles.active : ''}`}
          >
            Entitlements
          </Link>
          <Link
            href="/admin/audit-log"
            className={`${styles.navLink} ${pathname === '/admin/audit-log' ? styles.active : ''}`}
          >
            Audit Log
          </Link>
        </nav>
        <button onClick={handleLogout} className={styles.logoutButton}>
          Logout
        </button>
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
