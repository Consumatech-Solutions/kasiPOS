'use client';

import { useState, useEffect } from 'react';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

interface PWAInstallProgressProps {
  isOpen: boolean;
  onComplete: () => void;
}

export function PWAInstallProgress({ isOpen, onComplete }: PWAInstallProgressProps) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'installing' | 'completed' | 'error'>('installing');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setProgress(0);
      setStatus('installing');
      setError(null);
      return;
    }

    // Simulate installation progress
    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += 10;
      if (currentProgress <= 90) {
        setProgress(currentProgress);
      } else {
        clearInterval(interval);
        // Check if service worker is ready
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready
            .then(() => {
              setProgress(100);
              setStatus('completed');
              setTimeout(() => {
                onComplete();
              }, 1500);
            })
            .catch((err) => {
              console.error('Service worker registration error:', err);
              setStatus('error');
              setError('Failed to register service worker');
            });
        } else {
          setStatus('error');
          setError('Service workers are not supported');
        }
      }
    }, 200);

    return () => clearInterval(interval);
  }, [isOpen, onComplete]);

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Installing App</DialogTitle>
          <DialogDescription>
            Downloading assets for offline use...
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {status === 'installing' && 'Downloading assets...'}
                {status === 'completed' && 'Installation complete!'}
                {status === 'error' && 'Installation failed'}
              </span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
          
          {status === 'installing' && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          
          {status === 'completed' && (
            <div className="flex items-center justify-center py-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          )}
          
          {status === 'error' && error && (
            <div className="flex items-center gap-2 text-sm text-destructive py-4">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
