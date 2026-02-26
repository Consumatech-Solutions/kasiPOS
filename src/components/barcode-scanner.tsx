'use client';

import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';
import ScannerDetector from 'js-scanner-detection';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Loader2, Camera, Keyboard, Search } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DeviceSelector } from '@/components/device-selector';
import { getStoredDevice, pollScanner, getDevices } from '@/lib/device-service';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

type ScanMode = 'camera' | 'device' | 'keyboard';

export function BarcodeScanner({ onScan, onClose, isOpen }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const keyboardScannerRef = useRef<ScannerDetector | null>(null);
  const [scanMode, setScanMode] = useState<ScanMode>('camera');
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | undefined>(undefined);
  const [showDeviceSelector, setShowDeviceSelector] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const pollingRef = useRef<boolean>(false);
  const { toast } = useToast();

  // Handle device scanner polling
  useEffect(() => {
    if (!isOpen || scanMode !== 'device') {
      pollingRef.current = false;
      setIsPolling(false);
      return;
    }

    const startDeviceScanning = async () => {
      const deviceId = getStoredDevice('scanner');
      
      if (!deviceId) {
        // Check if devices are available
        try {
          const devices = await getDevices('scanner');
          if (devices.length === 0) {
            setError('No scanner devices found. Please connect a scanner and try again.');
            return;
          }
          // Show device selector
          setShowDeviceSelector(true);
          return;
        } catch (err: any) {
          setError(err.message || 'Cannot connect to scanner server.');
          return;
        }
      }

      // Start polling
      setIsPolling(true);
      pollingRef.current = true;
      setError(null);

      const poll = async () => {
        while (pollingRef.current) {
          try {
            const result = await pollScanner(
              deviceId,
              () => {
                // Progress callback - scanner is waiting for barcode
              },
              500 // Poll every 500ms
            );
            
            // Successfully scanned
            pollingRef.current = false;
            setIsPolling(false);
            onScan(result);
            onClose();
            return;
          } catch (err: any) {
            if (err.message.includes('timeout') || err.message === 'TIMEOUT') {
              // Timeout is expected, continue polling
              await new Promise(resolve => setTimeout(resolve, 500));
              continue;
            } else {
              // Other error - stop polling
              pollingRef.current = false;
              setIsPolling(false);
              const errorMsg = err.message || 'Failed to scan barcode';
              setError(errorMsg);
              // Show toast with option to search for another device
              toast({
                variant: 'destructive',
                title: 'Scan failed',
                description: errorMsg,
                action: (
                  <ToastAction
                    altText="Search for another device"
                    onClick={() => {
                      setShowDeviceSelector(true);
                    }}
                  >
                    <Search className="mr-2 h-4 w-4" />
                    Search for another device
                  </ToastAction>
                ),
              });
              return;
            }
          }
        }
      };

      poll();
    };

    startDeviceScanning();

    return () => {
      pollingRef.current = false;
      setIsPolling(false);
    };
  }, [isOpen, scanMode, onScan, onClose]);

  // Handle keyboard/USB scanner detection (js-scanner-detection)
  useEffect(() => {
    if (!isOpen || scanMode !== 'keyboard') {
      if (keyboardScannerRef.current) {
        keyboardScannerRef.current.stopScanning();
        keyboardScannerRef.current = null;
      }
      return;
    }
    const detector = new ScannerDetector({
      onComplete: (barcode: string) => {
        if (keyboardScannerRef.current) {
          keyboardScannerRef.current.stopScanning();
          keyboardScannerRef.current = null;
        }
        onScan(barcode.trim());
        onClose();
      },
      timeBeforeScanTest: 100,
      avgTimeByChar: 30,
      minLength: 6,
      endChar: [9, 13],
      stopPropagation: true,
      preventDefault: true,
    });
    keyboardScannerRef.current = detector;
    return () => {
      detector.stopScanning();
      keyboardScannerRef.current = null;
    };
  }, [isOpen, scanMode, onScan, onClose]);

  // Handle camera scanning
  useEffect(() => {
    if (!isOpen || scanMode !== 'camera') {
      // Cleanup when dialog closes or mode changes
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
  }, [isOpen, scanMode, onScan, onClose]);

  const handleDeviceSelect = async (deviceId: string) => {
    // Device is already stored by DeviceSelector component
    // Start polling with the selected device
    setShowDeviceSelector(false);
    setIsPolling(true);
    pollingRef.current = true;
    setError(null);

    const poll = async () => {
      while (pollingRef.current) {
        try {
          const result = await pollScanner(
            deviceId,
            () => {
              // Progress callback
            },
            500
          );
          
          pollingRef.current = false;
          setIsPolling(false);
          onScan(result);
          onClose();
          return;
        } catch (err: any) {
          if (err.message.includes('timeout') || err.message === 'TIMEOUT') {
            await new Promise(resolve => setTimeout(resolve, 500));
            continue;
          } else {
            pollingRef.current = false;
            setIsPolling(false);
            const errorMsg = err.message || 'Failed to scan barcode';
            setError(errorMsg);
            // Show toast with option to search for another device
            toast({
              variant: 'destructive',
              title: 'Scan failed',
              description: errorMsg,
              action: (
                <ToastAction
                  altText="Search for another device"
                  onClick={() => {
                    setShowDeviceSelector(true);
                  }}
                >
                  <Search className="mr-2 h-4 w-4" />
                  Search for another device
                </ToastAction>
              ),
            });
            return;
          }
        }
      }
    };

    poll();
  };

  return (
    <div className="space-y-4">
      <Tabs value={scanMode} onValueChange={(value) => setScanMode(value as ScanMode)}>
        <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="keyboard" className="flex items-center gap-2">
            <Keyboard className="h-4 w-4" />
            Auto
          </TabsTrigger>
          <TabsTrigger value="camera" className="flex items-center gap-2">
            <Camera className="h-4 w-4" />
            Camera
          </TabsTrigger>
         
          <TabsTrigger value="device" className="flex items-center gap-2">
            <Camera className="h-4 w-4" />
            Scanner Device
          </TabsTrigger>
        </TabsList>

        <TabsContent value="camera" className="space-y-4">
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

          {error && scanMode === 'camera' && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {hasPermission === false && !error && scanMode === 'camera' && (
            <Alert variant="destructive">
              <AlertTitle>Camera Access Required</AlertTitle>
              <AlertDescription>
                Please allow camera access in your browser settings to use the scanner.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="keyboard" className="space-y-4">
          <div className="py-8 text-center">
            <Keyboard className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-semibold mb-2">USB / keyboard scanner</p>
            <p className="text-sm text-muted-foreground mb-4">
              Connect a barcode scanner that types like a keyboard. Click below to focus this area, then scan a barcode. The scan is detected automatically and will not be typed into any field.
            </p>
            <p className="text-xs text-muted-foreground">
              Detection uses fast key input; minimum 6 characters. Scan when this tab is active.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="device" className="space-y-4">
          {isPolling ? (
            <div className="py-12 text-center">
              <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-lg font-semibold">Waiting for barcode scan...</p>
              <p className="text-sm text-muted-foreground mt-2">
                Point your scanner at a barcode and scan it.
              </p>
            </div>
          ) : (
            <div className="py-8 text-center">
              <Camera className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-semibold mb-2">Ready to scan</p>
              <p className="text-sm text-muted-foreground mb-4">
                {getStoredDevice('scanner') 
                  ? 'Scanner device is connected. Click "Start Scanning" to begin.'
                  : 'No scanner device selected. Please select a device first.'}
              </p>
              {!getStoredDevice('scanner') && (
                <Button onClick={() => setShowDeviceSelector(true)} className="mt-2">
                  Select Scanner Device
                </Button>
              )}
            </div>
          )}

          {error && scanMode === 'device' && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription className="flex flex-col gap-2">
                <span>{error}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeviceSelector(true)}
                  className="w-full sm:w-auto self-start"
                >
                  <Search className="mr-2 h-4 w-4" />
                  Search for another device
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>
      </Tabs>

      <div className="flex justify-between gap-2">
        {scanMode === 'device' && !isPolling && getStoredDevice('scanner') && (
          <Button 
            variant="outline" 
            onClick={() => setShowDeviceSelector(true)}
          >
            Change Device
          </Button>
        )}
        <div className="flex gap-2 ml-auto">
          {scanMode === 'device' && isPolling && (
            <Button 
              variant="destructive" 
              onClick={() => {
                pollingRef.current = false;
                setIsPolling(false);
              }}
            >
              Stop Scanning
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>

      <DeviceSelector
        type="scanner"
        open={showDeviceSelector}
        onClose={() => setShowDeviceSelector(false)}
        onSelect={handleDeviceSelect}
      />
    </div>
  );
}
