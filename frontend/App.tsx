import React, { useState } from 'react';
import { MeetingConfigurator } from './components/MeetingConfigurator';
import { OfflineMeetingInterface } from './components/OfflineMeetingInterface';
import { ShieldCheck, Command, Wifi, MapPin, ArrowRight, X } from 'lucide-react';

const App: React.FC = () => {
  const [view, setView] = useState<'LANDING' | 'CONFIG_VIRTUAL' | 'CONFIG_OFFLINE'>('LANDING');

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white relative overflow-x-hidden font-sans selection:bg-cyan-500/30">
      
      {/* --- Ambient Background --- */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0b0f19] via-[#0f172a] to-[#1e1b4b]" />
        {/* Neon Glow Top Right */}
        <div className="absolute -top-40 -right-40 w-[800px] h-[800px] bg-purple-900/20 rounded-full blur-[120px] mix-blend-screen opacity-50" />
        {/* Neon Glow Bottom Left */}
        <div className="absolute -bottom-40 -left-40 w-[800px] h-[800px] bg-cyan-900/10 rounded-full blur-[120px] mix-blend-screen opacity-50" />
        {/* Cyber Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,#000_60%,transparent_100%)]" />
      </div>

      {/* --- Main Content --- */}
      <div className="relative z-10 min-h-screen flex flex-col items-center p-4 md:p-8">
        
        {/* Branding / Top Bar */}
        <div className="w-full flex justify-center pointer-events-none mb-6 mt-2">
           <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/5 backdrop-blur-md">
             <ShieldCheck size={14} className="text-cyan-400" />
             <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Nebula Intelligence v4.2</span>
           </div>
        </div>

        {/* --- VIEW: LANDING SCREEN --- */}
        {view === 'LANDING' && (
          <div className="w-full max-w-5xl flex flex-col items-center animate-in fade-in slide-in-from-bottom-8 duration-700 mt-12">
            
            {/* Header Text */}
            <div className="text-center mb-16 space-y-4">
              <h1 className="text-4xl md:text-5xl font-display font-bold text-white tracking-tight drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                Delegate Profile Detected: <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-purple-300">Sarah Jones</span>
              </h1>
              <p className="text-lg md:text-xl text-slate-400 font-light tracking-wide uppercase">
                Organization: <span className="text-white font-medium">Nebula Corp</span>
              </p>
            </div>

            {/* Choice Cards Container */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
              
              {/* Option A: Online */}
              <button 
                onClick={() => setView('CONFIG_VIRTUAL')}
                className="group relative h-80 rounded-[2rem] border border-cyan-500/30 bg-[#0f172a]/40 backdrop-blur-md overflow-hidden text-left p-8 transition-all duration-500 hover:scale-[1.02] hover:bg-cyan-950/20 hover:border-cyan-400 hover:shadow-[0_0_50px_-10px_rgba(34,211,238,0.3)] flex flex-col justify-between"
              >
                 <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                 
                 <div className="relative z-10">
                   <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                     <Wifi size={28} />
                   </div>
                   <h2 className="text-2xl font-display font-bold text-white mb-2 group-hover:text-cyan-300 transition-colors">
                     Schedule Virtual / <br/>Online Meeting
                   </h2>
                   <p className="text-slate-400 text-sm font-light">Access neural link streaming and digital workshops.</p>
                 </div>

                 <div className="relative z-10 flex items-center text-xs font-bold uppercase tracking-widest text-slate-500 group-hover:text-cyan-400 transition-colors">
                   <span>Initiate Protocol</span>
                   <ArrowRight size={14} className="ml-2 group-hover:translate-x-1 transition-transform" />
                 </div>
              </button>

              {/* Option B: Offline */}
              <button 
                onClick={() => setView('CONFIG_OFFLINE')}
                className="group relative h-80 rounded-[2rem] border border-purple-500/30 bg-[#0f172a]/40 backdrop-blur-md overflow-hidden text-left p-8 transition-all duration-500 hover:scale-[1.02] hover:bg-purple-950/20 hover:border-purple-400 hover:shadow-[0_0_50px_-10px_rgba(168,85,247,0.3)] flex flex-col justify-between"
              >
                 <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                 
                 <div className="relative z-10">
                   <div className="w-14 h-14 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                     <MapPin size={28} />
                   </div>
                   <h2 className="text-2xl font-display font-bold text-white mb-2 group-hover:text-purple-300 transition-colors">
                     Schedule In-Person / <br/>Offline Meeting
                   </h2>
                   <p className="text-slate-400 text-sm font-light">Physical venue logistics and on-site verification.</p>
                 </div>

                 <div className="relative z-10 flex items-center text-xs font-bold uppercase tracking-widest text-slate-500 group-hover:text-purple-400 transition-colors">
                   <span>Initiate Protocol</span>
                   <ArrowRight size={14} className="ml-2 group-hover:translate-x-1 transition-transform" />
                 </div>
              </button>

            </div>
          </div>
        )}

        {/* --- VIEW: ONLINE MEETING CONFIGURATOR (FULL PAGE) --- */}
        {view === 'CONFIG_VIRTUAL' && (
          <div className="w-full flex justify-center animate-in fade-in zoom-in-95 duration-500">
             <MeetingConfigurator onBack={() => setView('LANDING')} />
          </div>
        )}

        {/* --- VIEW: OFFLINE MEETING INTERFACE (FULL PAGE) --- */}
        {view === 'CONFIG_OFFLINE' && (
          /* Removed animations to prevent fixed positioning context issues for full screen transcript */
          <div className="w-full flex justify-center">
             <OfflineMeetingInterface onBack={() => setView('LANDING')} />
          </div>
        )}

        {/* Footer info */}
        <footer className={`mt-auto pt-6 text-center w-full pointer-events-none ${view === 'LANDING' ? 'block' : 'hidden'}`}>
           <div className="inline-flex items-center gap-2 text-[10px] text-slate-600 font-mono tracking-widest uppercase opacity-60">
             <Command size={12} />
             <span>Nebula Corp Systems • Authorized Personnel Only</span>
           </div>
        </footer>

      </div>
    </div>
  );
};

export default App;