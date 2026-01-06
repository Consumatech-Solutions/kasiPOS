'use client';
import { usePwaInstall } from '@/hooks/use-pwa-install';
import { Button } from './ui/button';
import { Download } from 'lucide-react';

export default function PwaInstallButton() {
  const { canInstall, install } = usePwaInstall();

  if (!canInstall) {
    return null;
  }

  return (
    <Button onClick={install}>
      <Download className="mr-2 h-4 w-4" />
      Install App
    </Button>
  );
}
