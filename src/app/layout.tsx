import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AppShell } from '@/components/layout/app-shell';
import { Toaster } from '@/components/ui/toaster';
import { DbProvider } from '@/components/db-provider';
import { SettingsProvider } from '@/components/settings-provider';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

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
      <body className={`${inter.variable} font-body antialiased bg-background`}>
        <SettingsProvider>
          <DbProvider>
            <AppShell>{children}</AppShell>
          </DbProvider>
          <Toaster />
        </SettingsProvider>
      </body>
    </html>
  );
}
