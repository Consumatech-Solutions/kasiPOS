import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AppShell } from '@/components/layout/app-shell';
import { Toaster } from '@/components/ui/toaster';
import { SettingsProvider } from '@/components/settings-provider';
import { ClientDbProvider } from '@/components/client-db-provider';
import { QueryProvider } from '@/components/providers/query-provider';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'KasiPOS',
  description: 'Modern Point of Sale for small businesses.',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#2563EB',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-body antialiased bg-background`}>
        <QueryProvider>
          <ClientDbProvider>
            <SettingsProvider>
              <AppShell>{children}</AppShell>
              <Toaster />
            </SettingsProvider>
          </ClientDbProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
