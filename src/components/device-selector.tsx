'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { getDevices, getStoredDevice, storeDevice, type Device } from '@/lib/device-service';

interface DeviceSelectorProps {
  type: 'printer' | 'scanner' | 'pos';
  open: boolean;
  onClose: () => void;
  onSelect: (deviceId: string) => void;
}

export function DeviceSelector({ type, open, onClose, onSelect }: DeviceSelectorProps) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  const storedDeviceId = getStoredDevice(type);

  useEffect(() => {
    if (open) {
      loadDevices();
      setSelectedDeviceId(storedDeviceId);
    } else {
      // Reset state when closed
      setDevices([]);
      setError(null);
      setSelectedDeviceId(null);
    }
  }, [open, type, storedDeviceId]);

  const loadDevices = async () => {
    setLoading(true);
    setError(null);
    try {
      const deviceList = await getDevices(type);
      setDevices(deviceList);
      if (deviceList.length === 0) {
        setError(`No ${type} devices found. Please connect a device and try again.`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load devices');
      setDevices([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    storeDevice(type, deviceId);
    onSelect(deviceId);
    onClose();
  };

  const getTypeLabel = () => {
    switch (type) {
      case 'printer':
        return 'Printer';
      case 'scanner':
        return 'Barcode Scanner';
      case 'pos':
        return 'POS Device';
      default:
        return 'Device';
    }
  };

  const getConnectionBadgeColor = (connection: string) => {
    switch (connection) {
      case 'usb':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'bluetooth':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'serial':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Select {getTypeLabel()}</DialogTitle>
          <DialogDescription>
            Choose a device to use for {type === 'printer' ? 'printing receipts' : type === 'scanner' ? 'scanning barcodes' : 'POS transactions'}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="py-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading devices...</p>
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription className="mt-2">
                {error}
                {error.includes('not running') && (
                  <div className="mt-2 text-xs">
                    <p>To start the printer server:</p>
                    <ol className="list-decimal list-inside mt-1 space-y-1">
                      <li>Navigate to the printer-server directory</li>
                      <li>Run: <code className="bg-muted px-1 rounded">npm start</code></li>
                      <li>Or use the installed executable</li>
                    </ol>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          ) : devices.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <p>No devices found.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={loadDevices}
                className="mt-4"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {devices.map((device) => {
                const isSelected = device.id === selectedDeviceId;
                const isStored = device.id === storedDeviceId;

                return (
                  <button
                    key={device.id}
                    onClick={() => handleSelect(device.id)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50 hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-sm truncate">{device.name}</h4>
                          {isStored && (
                            <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${getConnectionBadgeColor(
                              device.connection
                            )}`}
                          >
                            {device.connection.toUpperCase()}
                          </span>
                          {device.connected && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              Connected
                            </span>
                          )}
                          {!device.connected && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">
                              Not Connected
                            </span>
                          )}
                        </div>
                        {device.manufacturer && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {device.manufacturer}
                            {device.product && ` • ${device.product}`}
                          </p>
                        )}
                      </div>
                      {isSelected && (
                        <div className="shrink-0">
                          <CheckCircle2 className="h-5 w-5 text-primary" />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex justify-between items-center pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={loadDevices}
              disabled={loading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

