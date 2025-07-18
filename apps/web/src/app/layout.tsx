import './global.css';

export const metadata = {
  title: 'CapaCity Planner',
  description: 'Airport capacity management platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
        <div id="portal-root" />
      </body>
    </html>
  );
}
