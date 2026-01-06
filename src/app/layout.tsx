import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppShell } from '@/components/layout/app-shell';
import { Toaster } from '@/components/ui/toaster';
import { DbProvider } from '@/components/db-provider';

export const metadata: Metadata = {
  title: 'KasiPOS',
  description: 'Modern Point of Sale for small businesses.',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#2563EB',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <DbProvider>
          <AppShell>{children}</AppShell>
        </DbProvider>
        <Toaster />
      </body>
    </html>
  );
}
