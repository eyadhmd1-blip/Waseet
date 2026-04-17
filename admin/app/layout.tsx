import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from './ui/sidebar';
import { TopBar } from './ui/topbar';

export const metadata: Metadata = {
  title: 'Waseet Admin',
  description: 'لوحة إدارة منصة وسيط',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className="h-full">
      <body className="h-full flex text-slate-100 antialiased bg-slate-950">
        <Sidebar />
        <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
