import React, { useState } from 'react';
import { MeetingConfigurator } from './components/MeetingConfigurator';
import { OfflineMeetingInterface } from './components/OfflineMeetingInterface';
import { ShieldCheck, Command, Wifi, MapPin, ArrowRight } from 'lucide-react';

const App: React.FC = () => {
  const [view, setView] = useState<'LANDING' | 'CONFIG_VIRTUAL' | 'CONFIG_OFFLINE'>('LANDING');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 relative overflow-x-hidden font-sans selection:bg-blue-200">
      
      {/* --- Main Content --- */}
      <div className="relative z-10 min-h-screen flex flex-col items-center p-4 md:p-8">
        
        {/* Branding / Top Bar */}
        <div className="w-full flex justify-center pointer-events-none mb-6 mt-2">
           <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 shadow-sm">
             <ShieldCheck size={16} className="text-blue-600" />
             <span className="text-sm font-bold text-slate-700">LeadQ.ai</span>
           </div>
        </div>

        {/* --- VIEW: LANDING SCREEN --- */}
        {view === 'LANDING' && (
          <div className="w-full max-w-5xl flex flex-col items-center animate-in fade-in slide-in-from-bottom-8 duration-700 mt-12">
            
            {/* Header Text */}
            <div className="text-center mb-16 space-y-4">
              <h1 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight">
                Profile Detected: <span className="text-blue-600">Sarah Jones</span>
              </h1>
              <p className="text-lg md:text-xl text-slate-500 font-medium">
                Organization: <span className="text-slate-800">LeadQ Corp</span>
              </p>
            </div>

            {/* Choice Cards Container */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
              
              {/* Option A: Online */}
              <button 
                onClick={() => setView('CONFIG_VIRTUAL')}
                className="group relative h-80 rounded-[2rem] border border-slate-200 bg-white shadow-xl overflow-hidden text-left p-8 transition-all duration-300 hover:border-blue-400 hover:shadow-2xl flex flex-col justify-between hover:-translate-y-1"
              >
                 <div className="relative z-10">
                   <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                     <Wifi size={28} />
                   </div>
                   <h2 className="text-2xl font-bold text-slate-900 mb-2 group-hover:text-blue-700 transition-colors">
                     Schedule Virtual / <br/>Online Meeting
                   </h2>
                   <p className="text-slate-500 text-sm">Access neural link streaming and digital workshops.</p>
                 </div>

                 <div className="relative z-10 flex items-center text-xs font-bold uppercase tracking-widest text-slate-400 group-hover:text-blue-600 transition-colors">
                   <span>Initiate Protocol</span>
                   <ArrowRight size={14} className="ml-2 group-hover:translate-x-1 transition-transform" />
                 </div>
              </button>

              {/* Option B: Offline */}
              <button 
                onClick={() => setView('CONFIG_OFFLINE')}
                className="group relative h-80 rounded-[2rem] border border-slate-200 bg-white shadow-xl overflow-hidden text-left p-8 transition-all duration-300 hover:border-blue-400 hover:shadow-2xl flex flex-col justify-between hover:-translate-y-1"
              >
                 <div className="relative z-10">
                   <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                     <MapPin size={28} />
                   </div>
                   <h2 className="text-2xl font-bold text-slate-900 mb-2 group-hover:text-blue-700 transition-colors">
                     Schedule In-Person / <br/>Offline Meeting
                   </h2>
                   <p className="text-slate-500 text-sm">Physical venue logistics and on-site verification.</p>
                 </div>

                 <div className="relative z-10 flex items-center text-xs font-bold uppercase tracking-widest text-slate-400 group-hover:text-blue-600 transition-colors">
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
          <div className="w-full flex justify-center">
             <OfflineMeetingInterface onBack={() => setView('LANDING')} />
          </div>
        )}

        {/* Footer info */}
        <footer className={`mt-auto pt-6 text-center w-full pointer-events-none ${view === 'LANDING' ? 'block' : 'hidden'}`}>
           <div className="inline-flex items-center gap-2 text-[10px] text-slate-400 font-mono tracking-widest uppercase opacity-80">
             <Command size={12} />
             <span>LeadQ Systems • Authorized Personnel Only</span>
           </div>
        </footer>

      </div>
    </div>
  );
};

export default App;