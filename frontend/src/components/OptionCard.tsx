import React from 'react';
import { AttendanceMode } from '../types';
import { Wifi, MapPin, ArrowRight } from 'lucide-react';

interface OptionCardProps {
  mode: AttendanceMode;
  selected: boolean;
  onSelect: (mode: AttendanceMode) => void;
  otherSelected: boolean;
}

export const OptionCard: React.FC<OptionCardProps> = ({ mode, selected, onSelect, otherSelected }) => {
  const isVirtual = mode === AttendanceMode.VIRTUAL;
  
  // Dynamic styles based on mode
  const baseClasses = "relative group overflow-hidden rounded-3xl border transition-all duration-300 ease-out cursor-pointer h-96 flex flex-col justify-between p-8 shadow-xl";
  
  const activeClasses = selected 
    ? "w-full scale-100 opacity-100 z-20 ring-4 ring-offset-2 ring-offset-slate-50 ring-blue-500 shadow-2xl" 
    : otherSelected 
      ? "w-0 opacity-0 p-0 overflow-hidden border-0 m-0" // Hide when other is selected
      : "w-full md:w-1/2 hover:w-[55%] hover:z-10 opacity-90 hover:opacity-100 bg-white hover:bg-slate-50"; // Default split state

  const colorClasses = isVirtual
    ? selected 
      ? "bg-blue-50 border-blue-200"
      : "border-slate-200 hover:border-blue-400"
    : selected
      ? "bg-blue-50 border-blue-200"
      : "border-slate-200 hover:border-blue-400";

  const Icon = isVirtual ? Wifi : MapPin;
  const title = isVirtual ? "Virtual / Online" : "Offline / On-site";
  const description = isVirtual 
    ? "Access the Neural Network directly. Stream sessions, VR networking, and digital workshops." 
    : "Physical presence required. Immersive on-site experience, haptic labs, and direct networking.";

  return (
    <div 
      className={`${baseClasses} ${activeClasses} ${colorClasses}`}
      onClick={() => !selected && onSelect(mode)}
    >
      <div className="relative z-10">
        <div className={`p-3 w-fit rounded-xl mb-4 transition-colors duration-300 ${
          isVirtual 
            ? "bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white" 
            : "bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white"
        }`}>
          <Icon size={32} />
        </div>
        <h2 className="text-3xl font-bold text-slate-900 mb-2 tracking-wide">
          {title}
        </h2>
        <p className="text-slate-500 font-medium leading-relaxed max-w-sm">
          {description}
        </p>
      </div>

      <div className="relative z-10 mt-8 flex items-center text-sm font-medium uppercase tracking-widest">
        <span className={`transition-all duration-300 text-blue-600`}>
          {selected ? "System Active" : "Initialize Protocol"}
        </span>
        <ArrowRight className={`ml-2 transition-transform duration-300 ${selected ? 'translate-x-0' : 'group-hover:translate-x-2'}`} size={16} />
      </div>
    </div>
  );
};