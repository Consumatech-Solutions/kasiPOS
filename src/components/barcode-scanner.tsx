'use client';

import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

export function BarcodeScanner({ onScan, onClose, isOpen }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    if (!isOpen) {
      // Cleanup when dialog closes
      if (codeReaderRef.current) {
        codeReaderRef.current.reset();
        codeReaderRef.current = null;
      }
      setIsScanning(false);
      setError(null);
      return;
    }

    // Initialize scanner when dialog opens
    const startScanning = async () => {
      try {
        setError(null);
        setIsScanning(true);
        setHasPermission(undefined);

        if (!videoRef.current) {
          setError('Video element not available');
          setIsScanning(false);
          return;
        }

        const codeReader = new BrowserMultiFormatReader();
        codeReaderRef.current = codeReader;

        // Get available video devices
        const videoInputDevices = await codeReader.listVideoInputDevices();
        
        if (videoInputDevices.length === 0) {
          setError('No camera devices found');
          setHasPermission(false);
          setIsScanning(false);
          return;
        }

        // Prefer back camera (environment) if available, otherwise use first device
        const backCamera = videoInputDevices.find(device => 
          device.label.toLowerCase().includes('back') || 
          device.label.toLowerCase().includes('rear') ||
          device.label.toLowerCase().includes('environment')
        );
        const selectedDeviceId = backCamera?.deviceId || videoInputDevices[0].deviceId;

        setHasPermission(true);

        // Start decoding from video device
        codeReader.decodeFromVideoDevice(
          selectedDeviceId,
          videoRef.current,
          (result, err) => {
            if (result) {
              const barcodeText = result.getText();
              codeReader.reset();
              codeReaderRef.current = null;
              setIsScanning(false);
              onScan(barcodeText);
              onClose();
            }
            if (err && !(err instanceof NotFoundException)) {
              // NotFoundException is normal - it means no barcode was found yet
              console.error('Scan error:', err);
            }
          }
        );
      } catch (err: any) {
        console.error('Error starting scanner:', err);
        setError(err.message || 'Failed to start camera');
        setHasPermission(false);
        setIsScanning(false);
        if (codeReaderRef.current) {
          codeReaderRef.current.reset();
          codeReaderRef.current = null;
        }
      }
    };

    startScanning();

    // Cleanup on unmount
    return () => {
      if (codeReaderRef.current) {
        codeReaderRef.current.reset();
        codeReaderRef.current = null;
      }
    };
  }, [isOpen, onScan, onClose]);

  return (
    <div className="space-y-4">
      <div className="relative w-full aspect-video rounded-md bg-muted overflow-hidden">
        <video 
          ref={videoRef} 
          className="w-full h-full object-cover"
          autoPlay 
          playsInline 
          muted
        />
        {isScanning && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="text-center text-white">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p>Scanning for barcode...</p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {hasPermission === false && !error && (
        <Alert variant="destructive">
          <AlertTitle>Camera Access Required</AlertTitle>
          <AlertDescription>
            Please allow camera access in your browser settings to use the scanner.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
