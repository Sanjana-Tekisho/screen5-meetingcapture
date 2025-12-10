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
  const baseClasses = "relative group overflow-hidden rounded-3xl border transition-all duration-500 ease-out cursor-pointer h-96 flex flex-col justify-between p-8";
  
  const activeClasses = selected 
    ? "w-full scale-100 opacity-100 z-20 ring-2 ring-offset-2 ring-offset-[#0f172a]" 
    : otherSelected 
      ? "w-0 opacity-0 p-0 overflow-hidden border-0 m-0" // Hide when other is selected
      : "w-full md:w-1/2 hover:w-[55%] hover:z-10 opacity-90 hover:opacity-100"; // Default split state

  const colorClasses = isVirtual
    ? selected 
      ? "bg-cyan-950/30 border-cyan-400 ring-cyan-400 shadow-[0_0_50px_rgba(34,211,238,0.3)]"
      : "bg-slate-800/40 border-white/10 hover:border-cyan-400/50 hover:bg-cyan-950/20 hover:shadow-[0_0_30px_rgba(34,211,238,0.2)]"
    : selected
      ? "bg-purple-950/30 border-purple-500 ring-purple-500 shadow-[0_0_50px_rgba(168,85,247,0.3)]"
      : "bg-slate-800/40 border-white/10 hover:border-purple-500/50 hover:bg-purple-950/20 hover:shadow-[0_0_30px_rgba(168,85,247,0.2)]";

  const Icon = isVirtual ? Wifi : MapPin;
  const title = isVirtual ? "Virtual / Online" : "Offline / On-site";
  const description = isVirtual 
    ? "Access the Neural Network directly. Stream sessions, VR networking, and digital workshops." 
    : "Physical presence required. Immersive on-site experience, haptic labs, and direct networking.";

  return (
    <div 
      className={`${baseClasses} ${activeClasses} ${colorClasses} backdrop-blur-md`}
      onClick={() => !selected && onSelect(mode)}
    >
      {/* Abstract Background Glow */}
      <div className={`absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl transition-opacity duration-700 ${
        selected ? 'opacity-40' : 'opacity-10 group-hover:opacity-20'
      } ${isVirtual ? 'bg-cyan-500' : 'bg-purple-600'}`} />

      <div className="relative z-10">
        <div className={`p-3 w-fit rounded-xl mb-4 transition-colors duration-300 ${
          isVirtual 
            ? "bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-400 group-hover:text-cyan-950" 
            : "bg-purple-500/10 text-purple-400 group-hover:bg-purple-400 group-hover:text-purple-950"
        }`}>
          <Icon size={32} />
        </div>
        <h2 className="text-3xl font-display font-bold text-white mb-2 tracking-wide">
          {title}
        </h2>
        <p className="text-slate-300 font-light leading-relaxed max-w-sm">
          {description}
        </p>
      </div>

      <div className="relative z-10 mt-8 flex items-center text-sm font-medium uppercase tracking-widest">
        <span className={`transition-all duration-300 ${
           isVirtual ? "text-cyan-400" : "text-purple-400"
        }`}>
          {selected ? "System Active" : "Initialize Protocol"}
        </span>
        <ArrowRight className={`ml-2 transition-transform duration-300 ${selected ? 'translate-x-0' : 'group-hover:translate-x-2'}`} size={16} />
      </div>
    </div>
  );
};
