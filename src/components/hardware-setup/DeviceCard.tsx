'use client';

import React from 'react';
import { HardwareDevice } from './types';
import { Check, Plus } from 'lucide-react';

interface DeviceCardProps {
  device: HardwareDevice;
  onClick: (device: HardwareDevice) => void;
}

export const DeviceCard: React.FC<DeviceCardProps> = ({ device, onClick }) => {
  const Icon = device.icon;
  const isConnected = device.status === 'connected';

  return (
    <button
      onClick={() => onClick(device)}
      disabled={isConnected}
      className={`
        group relative flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 rounded-xl sm:rounded-2xl border-2 transition-all duration-200 w-full min-h-[180px] sm:min-h-[200px] md:h-64 touch-target
        ${isConnected 
          ? 'bg-green-50/50 border-green-500 cursor-default' 
          : 'bg-white border-slate-200 active:border-primary active:shadow-lg active:scale-[0.98] sm:hover:border-primary sm:hover:shadow-lg sm:hover:-translate-y-1 cursor-pointer'
        }
      `}
    >
      {/* Status Badge */}
      <div className={`
        absolute top-2 right-2 sm:top-4 sm:right-4 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-colors
        ${isConnected ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-400 group-active:bg-primary/10 group-active:text-primary sm:group-hover:bg-primary/10 sm:group-hover:text-primary'}
      `}>
        {isConnected ? <Check size={14} strokeWidth={3} className="sm:w-4 sm:h-4" /> : <Plus size={14} strokeWidth={3} className="sm:w-4 sm:h-4" />}
      </div>

      {/* Icon */}
      <div className={`
        w-16 h-16 sm:w-20 sm:h-20 md:w-20 md:h-20 rounded-xl sm:rounded-2xl flex items-center justify-center mb-3 sm:mb-4 md:mb-6 transition-colors
        ${isConnected ? 'bg-green-100 text-green-600' : 'bg-slate-50 text-slate-600 group-active:bg-primary/10 group-active:text-primary sm:group-hover:bg-primary/10 sm:group-hover:text-primary'}
      `}>
        <Icon size={32} strokeWidth={1.5} className="sm:w-10 sm:h-10 md:w-10 md:h-10" />
      </div>

      {/* Text */}
      <div className="text-center space-y-1 px-2">
        <h3 className={`font-semibold text-base sm:text-lg ${isConnected ? 'text-green-900' : 'text-slate-900'}`}>
          {device.name}
        </h3>
        <p className={`text-xs sm:text-sm ${isConnected ? 'text-green-700' : 'text-slate-500'}`}>
          {isConnected ? (device.modelName || 'Connected') : 'Tap to connect'}
        </p>
      </div>
    </button>
  );
};

