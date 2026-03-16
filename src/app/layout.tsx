import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AppShell } from '@/components/layout/app-shell';
import { Toaster } from '@/components/ui/toaster';
import { SettingsProvider } from '@/components/settings-provider';
import { ClientDbProvider } from '@/components/client-db-provider';
import { QueryProvider } from '@/components/providers/query-provider';
import { CartProvider } from '@/components/providers/cart-provider';
import { DataPreloader } from '@/components/providers/data-preloader';
import { SyncStatusIndicator } from '@/components/sync-status-indicator';
import { HardwareSetupProvider } from '@/components/hardware-setup/HardwareSetupProvider';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'KasiPOS',
  description: 'Store admin app — Modern Point of Sale for small businesses. For store administrators only.',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/icon-192x192.svg',
    apple: '/icons/icon-192x192.svg',
  },
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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function() {
  function isChunkLoadError(msg) {
    if (!msg) return false;
    var s = String(msg);
    return s.indexOf('Loading chunk') !== -1 || s.indexOf('ChunkLoadError') !== -1 || s.indexOf('Loading CSS chunk') !== -1;
  }
  function tryReload() {
    try {
      if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('kasiPOS_chunkReload') === '1')
        return;
      sessionStorage.setItem('kasiPOS_chunkReload', '1');
      window.location.reload();
    } catch (e) {}
  }
  window.addEventListener('error', function(e) {
    if (isChunkLoadError(e.message)) { e.preventDefault(); tryReload(); }
  });
  window.addEventListener('unhandledrejection', function(e) {
    if (e.reason && isChunkLoadError(e.reason.message || e.reason)) { e.preventDefault(); tryReload(); }
  });
})();
`,
          }}
        />
      </head>
      <body className={`${inter.variable} font-body antialiased bg-background`}>
        <QueryProvider>
          <ClientDbProvider>
            <SettingsProvider>
              <HardwareSetupProvider>
                <CartProvider>
                  <DataPreloader />
                  <AppShell>{children}</AppShell>
                </CartProvider>
                <Toaster />
                <SyncStatusIndicator />
              </HardwareSetupProvider>
            </SettingsProvider>
          </ClientDbProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
