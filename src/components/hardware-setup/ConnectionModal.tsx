'use client';

import React, { useState, useEffect } from 'react';
import { HardwareDevice, ModalStep } from './types';
import { Loader2, CheckCircle2, Wifi, Usb, Laptop2, AlertCircle } from 'lucide-react';
import { getDevices, storeDevice, type Device } from '@/lib/device-service';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ConnectionModalProps {
  device: HardwareDevice;
  isOpen: boolean;
  onClose: () => void;
  onConnect: (deviceId: string, deviceType: 'printer' | 'scanner' | 'pos') => void;
}

export const ConnectionModal: React.FC<ConnectionModalProps> = ({ device, isOpen, onClose, onConnect }) => {
  const [step, setStep] = useState<ModalStep>('searching');
  const [availableDevices, setAvailableDevices] = useState<Device[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Map device type to service type
  const getServiceType = (): 'printer' | 'scanner' | 'pos' => {
    if (device.id === 'printer') return 'printer';
    if (device.id === 'scanner') return 'scanner';
    return 'pos'; // card reader
  };

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('searching');
      setError(null);
      setAvailableDevices([]);
      searchForDevices();
    }
  }, [isOpen, device.id]);

  const searchForDevices = async () => {
    try {
      setStep('searching');
      setError(null);
      const serviceType = getServiceType();
      
      // Add minimum delay to show search screen (similar to original's 2500ms)
      const searchStartTime = Date.now();
      const devices = await getDevices(serviceType);
      const searchDuration = Date.now() - searchStartTime;
      const minDelay = 1500; // Minimum 1.5 seconds to show search screen
      
      if (searchDuration < minDelay) {
        await new Promise(resolve => setTimeout(resolve, minDelay - searchDuration));
      }
      
      if (devices.length === 0) {
        setStep('error');
        setError(`No ${device.name.toLowerCase()} devices found. Please connect a device and try again.`);
        return;
      }

      setAvailableDevices(devices);
      setStep('found');
    } catch (err: any) {
      console.error('Error searching for devices:', err);
      setStep('error');
      setError(err.message || 'Failed to search for devices');
    }
  };

  const connectDevice = async (deviceId: string) => {
    try {
      setStep('connecting');
      setError(null);
      
      const serviceType = getServiceType();
      const selectedDevice = availableDevices.find(d => d.id === deviceId);
      
      if (!selectedDevice) {
        throw new Error('Selected device not found');
      }

      // Store the device
      storeDevice(serviceType, deviceId, selectedDevice.connectionType);

      // Simulate a brief connection delay for UX
      await new Promise(resolve => setTimeout(resolve, 1000));

      setStep('success');
      
      // Close modal after success animation
      setTimeout(() => {
        onConnect(deviceId, serviceType);
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Error connecting device:', err);
      setStep('error');
      setError(err.message || 'Failed to connect device');
    }
  };


  if (!isOpen) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="w-[95vw] max-w-md mx-2 sm:mx-auto !z-[110]">
          <DialogHeader className="px-2 sm:px-0">
            <DialogTitle className="text-lg sm:text-xl">Connect {device.name}</DialogTitle>
          </DialogHeader>

          <div className="p-4 sm:p-6 md:p-8 flex flex-col items-center text-center min-h-[280px] sm:min-h-[320px] justify-center">
            
            {step === 'searching' && (
              <div className="animate-in fade-in duration-300 flex flex-col items-center">
                <div className="relative mb-4 sm:mb-6">
                  <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping opacity-75"></div>
                  <div className="relative bg-primary/10 p-4 sm:p-6 rounded-full">
                    <Loader2 className="w-10 h-10 sm:w-12 sm:h-12 text-primary animate-spin" />
                  </div>
                </div>
                <h4 className="text-lg sm:text-xl font-medium text-slate-900 mb-2 px-4">Looking for devices...</h4>
                <p className="text-sm sm:text-base text-slate-500 px-4">Ensure your {device.name.toLowerCase()} is turned on and nearby.</p>
              </div>
            )}

            {step === 'found' && (
              <div className="w-full animate-in slide-in-from-bottom-4 fade-in duration-300 px-2 sm:px-0">
                <div className="text-left mb-4">
                  <h4 className="text-xs sm:text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
                    {availableDevices.length === 1 ? 'Device Found' : `Devices Found (${availableDevices.length})`}
                  </h4>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {availableDevices.map((deviceItem) => (
                      <button
                        key={deviceItem.id}
                        onClick={() => connectDevice(deviceItem.id)}
                        className="w-full group flex items-center justify-between p-3 sm:p-4 border border-slate-200 rounded-xl active:border-primary active:shadow-md active:bg-primary/5 sm:hover:border-primary sm:hover:shadow-md sm:hover:bg-primary/5 transition-all cursor-pointer bg-white touch-target min-h-[60px]"
                      >
                        <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 group-active:bg-primary/10 sm:group-hover:bg-primary/10 transition-colors">
                            {deviceItem.connectionType === 'webusb' ? (
                              <Usb size={18} className="sm:w-5 sm:h-5 text-slate-600 group-active:text-primary sm:group-hover:text-primary" />
                            ) : deviceItem.connectionType === 'webhid' ? (
                              <Usb size={18} className="sm:w-5 sm:h-5 text-slate-600 group-active:text-primary sm:group-hover:text-primary" />
                            ) : (
                              <Wifi size={18} className="sm:w-5 sm:h-5 text-slate-600 group-active:text-primary sm:group-hover:text-primary" />
                            )}
                          </div>
                          <div className="text-left flex-1 min-w-0">
                            <p className="font-semibold text-sm sm:text-base text-slate-900 group-active:text-primary sm:group-hover:text-primary truncate">
                              {deviceItem.name}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                              {deviceItem.connectionType === 'webusb' ? 'WebUSB' :
                               deviceItem.connectionType === 'webhid' ? 'WebHID' :
                               'Server'} • Ready to pair
                            </p>
                          </div>
                        </div>
                        <span className="text-xs sm:text-sm font-medium text-primary opacity-100 sm:opacity-0 group-active:opacity-100 sm:group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2">
                          Connect
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-center text-slate-400 mt-4 sm:mt-8 px-2">
                  Don't see your device? <button onClick={searchForDevices} className="text-primary active:underline sm:hover:underline touch-target min-h-[44px]">Scan again</button>
                </p>
              </div>
            )}

            {step === 'connecting' && (
              <div className="animate-in fade-in duration-300 flex flex-col items-center px-4">
                <div className="mb-4 sm:mb-6 relative">
                  <Laptop2 className="w-14 h-14 sm:w-16 sm:h-16 text-slate-300" />
                  <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-1 shadow-sm">
                    <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 text-primary animate-spin" />
                  </div>
                </div>
                <h4 className="text-lg sm:text-xl font-medium text-slate-900 mb-2">Connecting...</h4>
                <p className="text-sm sm:text-base text-slate-500">Establishing secure connection...</p>
              </div>
            )}

            {step === 'success' && (
              <div className="animate-in zoom-in-95 fade-in duration-300 flex flex-col items-center px-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-green-100 rounded-full flex items-center justify-center mb-4 sm:mb-6">
                  <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-green-600" />
                </div>
                <h4 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">Connected!</h4>
                <p className="text-sm sm:text-base text-slate-500">Your {device.name.toLowerCase()} is ready to use.</p>
              </div>
            )}

            {step === 'error' && (
              <div className="animate-in fade-in duration-300 flex flex-col items-center px-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-red-100 rounded-full flex items-center justify-center mb-4 sm:mb-6">
                  <AlertCircle className="w-8 h-8 sm:w-10 sm:h-10 text-red-600" />
                </div>
                <h4 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">Connection Failed</h4>
                <p className="text-sm sm:text-base text-slate-500 mb-4 text-center">{error}</p>
                <Button onClick={searchForDevices} variant="outline" className="min-h-[44px] touch-target w-full sm:w-auto">
                  Try Again
                </Button>
              </div>
            )}

          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

