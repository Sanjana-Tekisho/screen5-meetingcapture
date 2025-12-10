import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  Video, 
  Calendar, 
  ChevronDown, 
  Link2,
  Copy,
  Mail,
  MessageSquare,
  Smartphone,
  ChevronLeft,
  User,
  Building2,
  Phone,
  Clock,
  Zap,
  CalendarClock,
  Loader2
} from 'lucide-react';
import { MeetingPlatform, DelegateProfile } from '../types';

interface MeetingConfiguratorProps {
  onBack: () => void;
}

const MOCK_DELEGATES: DelegateProfile[] = [
  { id: '1', name: 'Sarah Jones', organization: 'LeadQ Corp', role: 'Chief Technology Officer', verified: true, email: 's.jones@leadq.ai', phone: '+1 (555) 012-3456' },
  { id: '2', name: 'Michael Chen', organization: 'Quantum Systems', role: 'Lead Eng', verified: true },
  { id: '3', name: 'Elena Rodriguez', organization: 'Starlight Ventures', role: 'Director', verified: false },
];

// Generate 30-minute intervals for the full day
const generateTimeSlots = () => {
  const slots = [];
  for (let i = 0; i < 24; i++) {
    const hour = i % 12 === 0 ? 12 : i % 12;
    const ampm = i < 12 ? 'AM' : 'PM';
    
    // Hour:00
    slots.push(`${hour.toString().padStart(2, '0')}:00 ${ampm}`);
    // Hour:30
    slots.push(`${hour.toString().padStart(2, '0')}:30 ${ampm}`);
  }
  return slots;
};

const TIME_SLOTS = generateTimeSlots();

export const MeetingConfigurator: React.FC<MeetingConfiguratorProps> = ({ onBack }) => {
  const [selectedDelegate, setSelectedDelegate] = useState<DelegateProfile>(MOCK_DELEGATES[0]);
  const [activeDropdown, setActiveDropdown] = useState<'search' | 'platform' | 'time' | null>(null);
  const [platform, setPlatform] = useState<MeetingPlatform>(MeetingPlatform.MEET);
  const [selectedDate, setSelectedDate] = useState("2025-10-24");
  const [selectedTime, setSelectedTime] = useState("10:00 AM");
  const [meetingMode, setMeetingMode] = useState<'SCHEDULE' | 'INSTANT'>('SCHEDULE');
  const [isGenerating, setIsGenerating] = useState(false);
  const [linkGenerated, setLinkGenerated] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');

  useEffect(() => {
    if (meetingMode === 'INSTANT') {
      const now = new Date();
      setSelectedDate(now.toISOString().split('T')[0]);
      setSelectedTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
    // Reset state when switching modes
    setLinkGenerated(false);
    setGeneratedLink('');
  }, [meetingMode]);

  const handleGenerate = () => {
    setIsGenerating(true);
    
    // Generate a unique ID based on mode and time to ensure links are different
    const prefix = meetingMode === 'INSTANT' ? 'inst' : 'sch';
    const randomId = Math.random().toString(36).substring(2, 7);
    const timestamp = Date.now().toString().slice(-4);
    const link = `leadq.meet/${prefix}-${randomId}-${timestamp}`;

    setTimeout(() => {
      setGeneratedLink(link);
      setIsGenerating(false);
      setLinkGenerated(true);
    }, 1500);
  };

  const platforms = [
    { id: MeetingPlatform.ZOOM, color: 'text-blue-500', bg: 'bg-blue-50' },
    { id: MeetingPlatform.MEET, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { id: MeetingPlatform.TEAMS, color: 'text-indigo-500', bg: 'bg-indigo-50' },
  ];

  const shareOptions = [
    { label: 'Send via WhatsApp', icon: MessageSquare },
    { label: 'Send via Messages', icon: Smartphone },
    { label: 'Copy to Clipboard', icon: Copy },
  ];

  const currentPlatform = platforms.find(p => p.id === platform) || platforms[1];

  const toggleDropdown = (name: 'search' | 'platform' | 'time') => {
    setActiveDropdown(prev => prev === name ? null : name);
  };

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col gap-8 pb-32 animate-in fade-in duration-700">
      
      {/* --- HEADER --- */}
      <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-xl overflow-hidden">
         <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div className="flex items-start gap-6">
               <button onClick={onBack} className="mt-2 p-3 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition-colors border border-slate-200">
                 <ChevronLeft size={24} />
               </button>

               <div className="flex items-center gap-6">
                 <div className="relative">
                   <div className="w-24 h-24 rounded-3xl bg-slate-100 border-2 border-white shadow-lg flex items-center justify-center text-3xl font-bold text-slate-700 overflow-hidden">
                      {selectedDelegate.name.charAt(0)}
                   </div>
                   {selectedDelegate.verified && (
                     <div className="absolute -bottom-3 -right-3 bg-blue-500 text-white p-1.5 rounded-full border-[4px] border-white shadow-md" title="Verified User">
                       <CheckCircle2 size={20} strokeWidth={3} />
                     </div>
                   )}
                 </div>

                 <div>
                   <div className="flex items-center gap-3 mb-2">
                     <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight leading-none">
                       {selectedDelegate.name}
                     </h1>
                   </div>
                   <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-sm text-blue-600 font-bold uppercase tracking-wider">
                         <User size={14} /> <span>Profile Verified</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                         <Building2 size={14} /> <span>{selectedDelegate.organization}</span>
                         <span className="text-slate-300">|</span>
                         <span>{selectedDelegate.role}</span>
                      </div>
                   </div>
                 </div>
               </div>
            </div>

            <div className="flex flex-col gap-3">
               <div className="flex items-center gap-2 text-slate-500 text-sm bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                  <Mail size={14} /> {selectedDelegate.email}
               </div>
               <div className="flex items-center gap-2 text-slate-500 text-sm bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                  <Phone size={14} /> {selectedDelegate.phone}
               </div>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* --- LEFT: CONFIGURATION PANEL --- */}
        <div className="lg:col-span-8 space-y-6">
           {/* Mode Tabs */}
           <div className="flex p-1 bg-slate-100 rounded-2xl border border-slate-200 w-fit">
              <button 
                onClick={() => setMeetingMode('SCHEDULE')}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all ${
                  meetingMode === 'SCHEDULE' 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <CalendarClock size={16} /> Schedule
              </button>
              <button 
                onClick={() => setMeetingMode('INSTANT')}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all ${
                  meetingMode === 'INSTANT' 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Zap size={16} className={meetingMode === 'INSTANT' ? 'text-amber-500' : ''} /> Instant Meeting
              </button>
           </div>

           <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-xl">
              <h2 className="text-xl font-bold text-slate-900 mb-8 flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-lg text-slate-600"><Video size={20} /></div>
                Session Configuration
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Platform Selection */}
                <div className="space-y-3 relative z-30">
                   <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Platform</label>
                   <div className="relative">
                      <button 
                        onClick={() => toggleDropdown('platform')}
                        className="w-full flex items-center justify-between bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-900 p-4 rounded-2xl transition-all"
                      >
                         <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${currentPlatform.bg} ${currentPlatform.color}`}>
                               <Video size={18} />
                            </div>
                            <span className="font-medium">{platform}</span>
                         </div>
                         <ChevronDown size={18} className={`text-slate-400 transition-transform ${activeDropdown === 'platform' ? 'rotate-180' : ''}`} />
                      </button>
                      
                      {activeDropdown === 'platform' && (
                        <div className="absolute top-full mt-2 left-0 w-full bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 z-50">
                           {platforms.map(p => (
                             <button
                               key={p.id}
                               onClick={() => { setPlatform(p.id); setActiveDropdown(null); }}
                               className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors text-slate-700 hover:text-slate-900"
                             >
                                <div className={`p-2 rounded-lg ${p.bg} ${p.color}`}>
                                   <Video size={16} />
                                </div>
                                <span>{p.id}</span>
                                {platform === p.id && <CheckCircle2 size={16} className="ml-auto text-blue-500" />}
                             </button>
                           ))}
                        </div>
                      )}
                   </div>
                </div>

                {/* Date Selection */}
                <div className="space-y-3 relative z-20">
                   <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Date</label>
                   <div className="relative group">
                      <input 
                        type="date"
                        disabled={meetingMode === 'INSTANT'}
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-full bg-slate-50 text-slate-900 border border-slate-200 p-4 rounded-2xl focus:outline-none focus:border-blue-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-blue-500 transition-colors" size={18} />
                   </div>
                </div>

                {/* Time Selection */}
                <div className="space-y-3 relative z-10 md:col-span-2">
                   <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Time Slot</label>
                   {meetingMode === 'INSTANT' ? (
                      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center gap-3">
                         <Clock size={18} />
                         <span className="font-medium">Starts Immediately ({selectedTime})</span>
                      </div>
                   ) : (
                     <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 pr-2">
                        {TIME_SLOTS.map(time => (
                           <button 
                              key={time}
                              onClick={() => setSelectedTime(time)}
                              className={`p-2 text-xs rounded-xl font-medium border transition-all ${
                                selectedTime === time 
                                  ? 'bg-slate-900 text-white border-slate-900 shadow-md' 
                                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-100'
                              }`}
                           >
                              {time}
                           </button>
                        ))}
                     </div>
                   )}
                </div>

              </div>
           </div>
        </div>

        {/* --- RIGHT: ACTION PANEL --- */}
        <div className="lg:col-span-4 flex flex-col gap-6">
           
           {/* Generate Card */}
           <div className={`flex-1 bg-white border border-slate-200 rounded-[32px] p-8 shadow-xl flex flex-col items-center justify-center text-center transition-all duration-500 relative overflow-hidden ${linkGenerated ? 'ring-2 ring-emerald-500/20' : ''}`}>
              {linkGenerated ? (
                 <div className="w-full animate-in zoom-in duration-500">
                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mx-auto mb-6 shadow-sm">
                       <CheckCircle2 size={40} />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-2">Link Generated</h3>
                    <p className="text-slate-500 mb-8">Session initialized successfully.</p>
                    
                    <div className="w-full bg-slate-50 rounded-xl p-4 flex items-center justify-between border border-slate-200 mb-6 group cursor-pointer hover:border-emerald-400 transition-colors">
                       <div className="flex items-center gap-3 overflow-hidden">
                          <div className="p-2 bg-white rounded-lg border border-slate-200 text-slate-400">
                             <Link2 size={16} />
                          </div>
                          <span className="text-sm text-slate-600 font-mono truncate">{generatedLink}</span>
                       </div>
                       <Copy size={16} className="text-slate-400 group-hover:text-emerald-500 transition-colors" />
                    </div>

                    <div className="space-y-3">
                       <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block text-left ml-1">Share Invitation</label>
                       {shareOptions.map((opt) => (
                          <button key={opt.label} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors text-slate-600 hover:text-slate-900 text-sm font-medium text-left">
                             <opt.icon size={16} /> {opt.label}
                          </button>
                       ))}
                    </div>
                 </div>
              ) : (
                 <div className="w-full">
                    <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mx-auto mb-6">
                       {isGenerating ? <Loader2 size={32} className="animate-spin" /> : <Link2 size={32} />}
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-2">Generate Session</h3>
                    <p className="text-slate-500 mb-8">Create secure neural link for {selectedDelegate.name}.</p>
                    <button 
                      onClick={handleGenerate}
                      disabled={isGenerating}
                      className="w-full py-4 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg"
                    >
                      {isGenerating ? 'Initializing...' : 'Create Meeting Link'}
                    </button>
                 </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};