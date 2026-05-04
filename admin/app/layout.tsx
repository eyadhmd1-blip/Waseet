import type { Metadata } from 'next';
import './globals.css';
import { AdminShell } from './ui/admin-shell';

export const metadata: Metadata = {
  title: 'Waseet Admin',
  description: 'لوحة إدارة منصة وسيط',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className="h-full">
      <body className="h-full text-slate-100 antialiased bg-slate-950">
        <AdminShell>{children}</AdminShell>
      </body>
    </html>
  );
}
