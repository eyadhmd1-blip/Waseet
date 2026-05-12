import type { Metadata } from 'next';
import './globals.css';
import { AdminShell } from './ui/admin-shell';
import { ThemeProvider } from './ui/theme-provider';

export const metadata: Metadata = {
  title: 'Waseet Admin',
  description: 'لوحة إدارة منصة وسيط',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className="h-full" data-theme="dark" suppressHydrationWarning>
      <head>
        {/* Set theme before first paint to prevent flash */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            var t=localStorage.getItem('waseet-theme');
            if(t==='light'||t==='dark') document.documentElement.setAttribute('data-theme',t);
          })();
        `}} />
      </head>
      <body className="h-full text-slate-100 antialiased">
        <ThemeProvider>
          <AdminShell>{children}</AdminShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
