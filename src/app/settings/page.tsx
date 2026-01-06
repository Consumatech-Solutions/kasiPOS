'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import PwaInstallButton from '@/components/pwa-install-button';
import { Smartphone } from 'lucide-react';

export default function SettingsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Settings</CardTitle>
        <CardDescription>Manage your application settings.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Smartphone className="w-5 h-5" />
              Install App
            </h3>
            <p className="text-sm text-muted-foreground">Install KasiPOS on your device for a native-like experience and offline access.</p>
          </div>
          <PwaInstallButton />
        </div>
      </CardContent>
    </Card>
  );
}
