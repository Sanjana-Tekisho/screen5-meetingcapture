import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Search,
  Video,
  Calendar,
  ChevronDown,
  Link2,
  Share2,
  Loader2,
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
  FileText
} from 'lucide-react';
import { MeetingPlatform, DelegateProfile } from '../types';

interface MeetingConfiguratorProps {
  onBack: () => void;
}

const MOCK_DELEGATES: DelegateProfile[] = [
  { id: '1', name: 'Sarah Jones', organization: 'Nebula Corp', role: 'Chief Technology Officer', verified: true, email: 's.jones@nebula.com', phone: '+1 (555) 012-3456' },
  { id: '2', name: 'Michael Chen', organization: 'Quantum Systems', role: 'Lead Eng', verified: true },
  { id: '3', name: 'Elena Rodriguez', organization: 'Starlight Ventures', role: 'Director', verified: false },
];

const TIME_SLOTS = [
  "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM",
  "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM",
  "01:00 PM", "01:30 PM", "02:00 PM", "02:30 PM",
  "03:00 PM", "03:30 PM", "04:00 PM", "04:30 PM"
];

export const MeetingConfigurator: React.FC<MeetingConfiguratorProps> = ({ onBack }) => {
  const [selectedDelegate, setSelectedDelegate] = useState<DelegateProfile>(MOCK_DELEGATES[0]);

  // Single state to manage active dropdown ensuring z-index superiority
  const [activeDropdown, setActiveDropdown] = useState<'search' | 'platform' | 'time' | null>(null);

  const [platform, setPlatform] = useState<MeetingPlatform>(MeetingPlatform.MEET);
  const [selectedDate, setSelectedDate] = useState("2025-10-24");
  const [selectedTime, setSelectedTime] = useState("10:00 AM");

  // Tab State: 'SCHEDULE' or 'INSTANT' or 'POST_MEETING'
  const [meetingMode, setMeetingMode] = useState<'SCHEDULE' | 'INSTANT' | 'POST_MEETING'>('SCHEDULE');
  const [transcriptData, setTranscriptData] = useState<any>(null);
  const [meetingIdInput, setMeetingIdInput] = useState("test-id");

  const [isGenerating, setIsGenerating] = useState(false);
  const [linkGenerated, setLinkGenerated] = useState(false);
  const [shareMethod, setShareMethod] = useState("Select method...");

  // Update time automatically if "Instant" is selected
  useEffect(() => {
    if (meetingMode === 'INSTANT') {
      const now = new Date();
      setSelectedDate(now.toISOString().split('T')[0]);
      setSelectedTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
  }, [meetingMode]);

  /* DEBUG LOGGING STATE */
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const addLog = (msg: string) => setDebugLogs(prev => [...prev, `${new Date().toISOString().split('T')[1].slice(0, 8)}: ${msg}`]);

  /* New State for generated links */
  const [generatedMeetingUrl, setGeneratedMeetingUrl] = useState<string | null>(null);
  const [generatedEventLink, setGeneratedEventLink] = useState<string | null>(null);

  const handleGenerate = async () => {
    addLog("handleGenerate called");
    // alert("Debugging: Generate button clicked!"); // Visual confirmation for user

    setIsGenerating(true);
    setGeneratedMeetingUrl(null);
    setGeneratedEventLink(null);

    try {
      addLog("Fetching http://127.0.0.1:8000/google-meet/create");
      const response = await fetch('http://127.0.0.1:8000/google-meet/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: `Meeting with ${selectedDelegate.name}`,
          start_time: meetingMode === 'SCHEDULE' ? `${selectedDate}T${convertTo24Hour(selectedTime)}:00` : null,
          end_time: null, // Let backend decide default duration
        }),
      });

      addLog(`Response status: ${response.status}`);

      if (response.ok) {
        const data = await response.json();
        addLog("Data received successfully");
        setGeneratedMeetingUrl(data.meet_url);
        setGeneratedEventLink(data.event_link);
        setLinkGenerated(true);
      } else {
        const errorText = await response.text();
        addLog(`Error: ${response.status} - ${errorText}`);
        alert(`Error: Failed to create meeting. Status: ${response.status}`);
      }
    } catch (error: any) {
      addLog(`EXCEPTION: ${error.message}`);
      console.error("Error creating meeting:", error);
      alert(`Network Error: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Helper to convert "10:00 AM" to "10:00" (24h format) for ISO string
  const convertTo24Hour = (timeStr: string) => {
    const [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':');
    if (hours === '12') {
      hours = '00';
    }
    if (modifier === 'PM') {
      hours = (parseInt(hours, 10) + 12).toString();
    }
    return `${hours}:${minutes}`;
  };

  const handleFetchTranscript = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch(`http://127.0.0.1:8000/google-meet/transcript/${meetingIdInput}`);
      if (response.ok) {
        const data = await response.json();
        setTranscriptData(data);
      } else {
        console.error("Failed to fetch transcript");
      }
    } catch (error) {
      console.error("Error fetching transcript:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const platforms = [
    { id: MeetingPlatform.ZOOM, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { id: MeetingPlatform.MEET, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    { id: MeetingPlatform.TEAMS, color: 'text-indigo-400', bg: 'bg-indigo-400/10' },
  ];

  const shareOptions = [
    { label: 'Send via Email', icon: Mail },
    { label: 'Send via WhatsApp', icon: MessageSquare },
    { label: 'Send via Messages', icon: Smartphone },
    { label: 'Copy to Clipboard', icon: Copy },
  ];

  const currentPlatform = platforms.find(p => p.id === platform) || platforms[1];

  const toggleDropdown = (name: 'search' | 'platform' | 'time') => {
    setActiveDropdown(prev => prev === name ? null : name);
  };

  const handleTabChange = (mode: 'SCHEDULE' | 'INSTANT' | 'POST_MEETING') => {
    setMeetingMode(mode);
    setLinkGenerated(false); // Reset generation state
    setIsGenerating(false);
  };

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col gap-8 pb-32 animate-in fade-in duration-700">

      {/* DEBUG LOG DISPLAY */}
      <div className="fixed bottom-4 left-4 right-4 bg-black/90 p-4 rounded-xl border border-red-500/30 text-xs font-mono text-red-300 max-h-40 overflow-y-auto z-50 opacity-90">
        <div className="font-bold border-b border-red-500/20 mb-2 pb-1">DEBUG CONSOLE (Scroll for more)</div>
        {debugLogs.length === 0 ? <div className="text-slate-600">No logs yet... Click Generate Link.</div> : debugLogs.map((log, i) => (
          <div key={i}>{log}</div>
        ))}
      </div>

      {/* --- HEADER --- */}
      <div className="relative bg-[#1e293b]/60 backdrop-blur-xl border border-white/10 rounded-[32px] p-8 shadow-2xl overflow-hidden group">
        {/* Decorative Background */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/5 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2 pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">

          {/* Left: Identity Section */}
          <div className="flex items-start gap-6">
            <button onClick={onBack} className="mt-2 p-3 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors border border-white/5">
              <ChevronLeft size={24} />
            </button>

            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-slate-700 to-slate-800 border-2 border-white/10 shadow-2xl flex items-center justify-center text-3xl font-display font-bold text-white overflow-hidden">
                  {selectedDelegate.name.charAt(0)}
                </div>
                {selectedDelegate.verified && (
                  <div className="absolute -bottom-3 -right-3 bg-cyan-500 text-black p-1.5 rounded-full border-[6px] border-[#151c2f] shadow-lg" title="Verified Delegate">
                    <CheckCircle2 size={20} strokeWidth={3} />
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl md:text-4xl font-display font-bold text-white tracking-tight leading-none">
                    {selectedDelegate.name}
                  </h1>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-sm text-cyan-400 font-bold uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                    Verified Profile
                  </div>
                  <div className="text-slate-400 text-sm font-medium flex items-center gap-2">
                    <User size={14} />
                    {selectedDelegate.role}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Organization & Contact */}
          <div className="flex flex-col items-start md:items-end gap-3 w-full md:w-auto pl-[5.5rem] md:pl-0">
            <div className="flex items-center gap-3 bg-white/5 px-5 py-3 rounded-2xl border border-white/5">
              <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
                <Building2 size={20} />
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Organization</div>
                <div className="text-lg font-bold text-slate-200">{selectedDelegate.organization}</div>
              </div>
            </div>

            <div className="flex gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0f172a] border border-white/10 text-xs text-slate-400 font-mono">
                <Mail size={12} className="text-slate-500" />
                {selectedDelegate.email}
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0f172a] border border-white/10 text-xs text-slate-400 font-mono">
                <Phone size={12} className="text-slate-500" />
                {selectedDelegate.phone}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- MAIN CONTENT --- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Left Col: Configuration Form */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-6">

          <div className="bg-[#1e293b]/40 backdrop-blur-xl border border-white/10 rounded-[32px] overflow-hidden relative shadow-xl z-20">

            {/* TABS HEADER */}
            <div className="flex items-center border-b border-white/10 bg-black/20">
              <button
                onClick={() => handleTabChange('SCHEDULE')}
                className={`flex-1 py-6 text-sm font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-3
                     ${meetingMode === 'SCHEDULE'
                    ? 'bg-[#1e293b]/60 text-cyan-400 border-b-2 border-cyan-400'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}
                   `}
              >
                <CalendarClock size={16} />
                Schedule Future
              </button>
              <button
                onClick={() => handleTabChange('INSTANT')}
                className={`flex-1 py-6 text-sm font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-3
                     ${meetingMode === 'INSTANT'
                    ? 'bg-[#1e293b]/60 text-red-400 border-b-2 border-red-400 shadow-[inset_0_0_20px_rgba(239,68,68,0.1)]'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}
                   `}
              >
                <Zap size={16} className={meetingMode === 'INSTANT' ? "fill-red-400 animate-pulse" : ""} />
                Meeting Now
              </button>
              <button
                onClick={() => handleTabChange('POST_MEETING')}
                className={`flex-1 py-6 text-sm font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-3
                     ${meetingMode === 'POST_MEETING'
                    ? 'bg-[#1e293b]/60 text-purple-400 border-b-2 border-purple-400'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}
                   `}
              >
                <FileText size={16} />
                Post-Meeting
              </button>
            </div>

            <div className="p-8 md:p-10">
              <div className="space-y-10">
                {/* 1. Database Match */}
                <div className="space-y-4 relative">
                  <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">
                    <Search size={14} /> Internal Database Lookup
                  </label>

                  {/* Dynamic Z-Index High when active */}
                  <div className={`relative group ${activeDropdown === 'search' ? 'z-50' : 'z-30'}`}>
                    <div
                      onClick={() => toggleDropdown('search')}
                      className="w-full h-20 bg-[#020617]/50 border border-white/10 rounded-2xl flex items-center px-6 cursor-pointer hover:border-cyan-500/50 hover:bg-cyan-950/10 transition-all duration-300 shadow-inner group-hover:shadow-[0_0_20px_rgba(34,211,238,0.05)]"
                    >
                      <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 font-bold mr-4 border border-white/5">
                        {selectedDelegate.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Selected Profile</div>
                        <input
                          type="text"
                          value={selectedDelegate.name}
                          readOnly
                          className="bg-transparent border-none outline-none text-white w-full text-lg font-medium cursor-pointer"
                        />
                      </div>
                      <ChevronDown className={`text-slate-500 transition-transform duration-300 ${activeDropdown === 'search' ? 'rotate-180' : ''}`} size={20} />
                    </div>

                    {/* Dropdown */}
                    {activeDropdown === 'search' && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        {MOCK_DELEGATES.map(delegate => (
                          <div
                            key={delegate.id}
                            onClick={() => {
                              setSelectedDelegate(delegate);
                              setActiveDropdown(null);
                            }}
                            className="p-4 hover:bg-white/5 flex items-center gap-4 cursor-pointer transition-colors border-b border-white/5 last:border-0"
                          >
                            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-sm font-bold text-slate-400">
                              {delegate.name.charAt(0)}
                            </div>
                            <div className="flex-1">
                              <div className="text-base font-medium text-slate-200">{delegate.name}</div>
                              <div className="text-xs text-slate-500">{delegate.organization}</div>
                            </div>
                            {delegate.verified && <CheckCircle2 size={16} className="text-cyan-500" />}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
                  {/* Platform */}
                  <div className="space-y-4 relative">
                    <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">
                      <Video size={14} /> Platform
                    </label>
                    <div className={`relative ${activeDropdown === 'platform' ? 'z-50' : 'z-20'}`}>
                      <button
                        onClick={() => toggleDropdown('platform')}
                        className="w-full h-20 bg-[#020617]/50 border border-white/10 rounded-2xl flex items-center justify-between px-6 hover:border-cyan-500/50 hover:bg-cyan-950/10 transition-all shadow-inner text-left"
                      >
                        <div>
                          <div className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Service</div>
                          <div className="flex items-center gap-3">
                            <span className={`w-2 h-2 rounded-full ${currentPlatform.bg.replace('/10', '')} shadow-[0_0_10px_currentColor]`} />
                            <span className="text-slate-200 font-medium text-lg">{platform}</span>
                          </div>
                        </div>
                        <ChevronDown className={`text-slate-500 transition-transform ${activeDropdown === 'platform' ? 'rotate-180' : ''}`} size={20} />
                      </button>

                      {activeDropdown === 'platform' && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-[#0f172a] border border-white/10 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                          {platforms.map((p) => (
                            <div
                              key={p.id}
                              onClick={() => {
                                setPlatform(p.id);
                                setActiveDropdown(null);
                              }}
                              className="p-4 hover:bg-white/5 flex items-center gap-4 cursor-pointer transition-colors"
                            >
                              <Video size={16} className={p.color} />
                              <span className="text-sm text-slate-300">{p.id}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Date Picker - Only visible if SCHEDULE */}
                  {meetingMode === 'SCHEDULE' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                      <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">
                        <Calendar size={14} /> Date
                      </label>
                      <div className="w-full h-20 bg-[#020617]/50 border border-white/10 rounded-2xl flex items-center px-6 hover:border-cyan-500/50 transition-all group shadow-inner relative z-10">
                        <div className="flex-1">
                          <div className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Select Date</div>
                          <input
                            type="date"
                            className="bg-transparent border-none outline-none text-slate-200 w-full text-lg font-medium p-0 focus:ring-0 cursor-pointer"
                            style={{ colorScheme: 'dark' }}
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {meetingMode === 'INSTANT' && (
                    <div className="flex items-center justify-center p-4 border border-red-500/20 bg-red-500/5 rounded-2xl animate-in fade-in duration-300">
                      <div className="text-center">
                        <Zap size={24} className="mx-auto mb-2 text-red-400 animate-pulse" />
                        <div className="text-sm font-bold text-red-300 uppercase">Instant Mode Active</div>
                        <div className="text-xs text-red-400/60">Meeting will start immediately</div>
                      </div>
                    </div>
                  )}

                  {meetingMode === 'POST_MEETING' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                      <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">
                        <Link2 size={14} /> Meeting ID
                      </label>
                      <div className="w-full h-20 bg-[#020617]/50 border border-white/10 rounded-2xl flex items-center px-6 hover:border-cyan-500/50 transition-all group shadow-inner relative z-10">
                        <div className="flex-1">
                          <div className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Enter ID</div>
                          <input
                            type="text"
                            className="bg-transparent border-none outline-none text-slate-200 w-full text-lg font-medium p-0 focus:ring-0"
                            value={meetingIdInput}
                            onChange={(e) => setMeetingIdInput(e.target.value)}
                            placeholder="e.g. meet-abc-123"
                          />
                        </div>
                      </div>
                      {transcriptData && (
                        <div className="mt-4 p-4 bg-black/20 rounded-2xl border border-white/10 max-h-60 overflow-y-auto custom-scrollbar">
                          <div className="text-xs font-bold text-cyan-400 mb-2 uppercase tracking-wider">Transcript Preview</div>
                          {transcriptData.events?.map((event: any, idx: number) => (
                            <div key={idx} className="mb-3 text-sm">
                              <span className="text-slate-500 text-xs font-mono mr-2">[{event.start}s]</span>
                              <span className="text-slate-300">{event.text}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Time Picker - Only visible if SCHEDULE */}
                {meetingMode === 'SCHEDULE' && (
                  <div className="space-y-4 relative animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">
                      <Clock size={14} /> Time Slot
                    </label>
                    <div className={`relative ${activeDropdown === 'time' ? 'z-50' : 'z-10'}`}>
                      <button
                        onClick={() => toggleDropdown('time')}
                        className="w-full h-20 bg-[#020617]/50 border border-white/10 rounded-2xl flex items-center justify-between px-6 hover:border-cyan-500/50 hover:bg-cyan-950/10 transition-all shadow-inner text-left"
                      >
                        <div>
                          <div className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Start Time</div>
                          <div className="text-slate-200 font-medium text-lg">{selectedTime}</div>
                        </div>
                        <ChevronDown className={`text-slate-500 transition-transform ${activeDropdown === 'time' ? 'rotate-180' : ''}`} size={20} />
                      </button>

                      {activeDropdown === 'time' && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-[#0f172a] border border-white/10 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-60 overflow-y-auto custom-scrollbar">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-2">
                            {TIME_SLOTS.map((time) => (
                              <div
                                key={time}
                                onClick={() => {
                                  setSelectedTime(time);
                                  setActiveDropdown(null);
                                }}
                                className={`p-3 rounded-xl text-center cursor-pointer transition-colors text-sm font-medium
                                            ${selectedTime === time
                                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                  }
                                            `}
                              >
                                {time}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Actions & Distribution */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-6 z-10">

          {/* Generate Card */}
          <div className={`bg-gradient-to-b border rounded-[32px] p-8 flex flex-col shadow-[0_0_60px_-20px_rgba(0,0,0,0.3)] relative overflow-hidden transition-all duration-500
                ${meetingMode === 'INSTANT'
              ? 'from-red-950/40 to-[#0f172a] border-red-500/30'
              : 'from-cyan-950/40 to-[#0f172a] border-cyan-500/30'}
           `}>
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />

            <h3 className="text-lg font-display font-bold text-white mb-2 relative z-10">
              {meetingMode === 'INSTANT' ? 'Instant Access Protocol' : 'Secure Link Generation'}
            </h3>
            <p className="text-slate-400 text-sm mb-4 relative z-10 leading-relaxed">
              Create an encrypted access token for {platform} {meetingMode === 'INSTANT' ? 'immediately' : `at ${selectedTime}`}.
            </p>

            {linkGenerated && generatedMeetingUrl && (
              <div className="mb-4 relative z-10 animate-in fade-in slide-in-from-top-2 duration-500">
                <label className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1 block">Generated Link</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={generatedMeetingUrl}
                    className="w-full bg-black/40 border border-emerald-500/30 rounded-lg px-3 py-2 text-sm text-emerald-300 font-mono focus:outline-none focus:border-emerald-500/60"
                  />
                </div>
              </div>
            )}

            <button
              onClick={() => {
                if (linkGenerated && generatedMeetingUrl) {
                  window.open(generatedMeetingUrl, '_blank');
                  return;
                }
                if (meetingMode === 'POST_MEETING') {
                  handleFetchTranscript();
                } else {
                  handleGenerate();
                }
              }}
              disabled={isGenerating}
              className={`w-full h-20 relative overflow-hidden rounded-2xl font-display font-bold text-sm tracking-widest uppercase transition-all duration-500 z-10 group
                  ${linkGenerated
                  ? 'bg-emerald-500/10 border border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/20 cursor-pointer'
                  : meetingMode === 'INSTANT'
                    ? 'bg-red-500 hover:bg-red-400 text-black shadow-[0_0_40px_-10px_rgba(239,68,68,0.6)] border border-red-400 hover:scale-[1.02] active:scale-[0.98]'
                    : meetingMode === 'POST_MEETING'
                      ? 'bg-purple-500 hover:bg-purple-400 text-black shadow-[0_0_40px_-10px_rgba(168,85,247,0.6)] border border-purple-400 hover:scale-[1.02] active:scale-[0.98]'
                      : 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_40px_-10px_rgba(34,211,238,0.6)] border border-cyan-400 hover:scale-[1.02] active:scale-[0.98]'
                }`}
            >
              <div className="flex items-center justify-center gap-3">
                {isGenerating ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    <span>Encrypting...</span>
                  </>
                ) : linkGenerated ? (
                  <>
                    <Video size={24} />
                    <span className="text-lg">Join Meeting</span>
                  </>
                ) : (
                  <>
                    <Link2 size={24} className={meetingMode === 'INSTANT' ? "text-red-950" : "text-cyan-950"} />
                    <span className="text-base">
                      {meetingMode === 'INSTANT' ? 'Start Meeting Now'
                        : meetingMode === 'POST_MEETING' ? 'Fetch Transcript'
                          : 'Generate Link'}
                    </span>
                  </>
                )}
              </div>
            </button>
          </div>

          {/* Share Section */}
          <div className={`flex-1 bg-[#1e293b]/40 backdrop-blur-xl border border-white/10 rounded-[32px] p-8 transition-all duration-700 ${linkGenerated ? 'opacity-100 translate-y-0' : 'opacity-50 translate-y-4'}`}>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-white/5 rounded-lg text-slate-400">
                <Share2 size={18} />
              </div>
              <span className="text-sm font-bold uppercase tracking-widest text-slate-300">Distribution Channels</span>
            </div>

            <div className="space-y-3">
              {shareOptions.map((opt, idx) => (
                <button
                  key={idx}
                  disabled={!linkGenerated}
                  onClick={() => {
                    setShareMethod(opt.label);
                    if (opt.label === 'Copy to Clipboard' && generatedMeetingUrl) {
                      navigator.clipboard.writeText(generatedMeetingUrl);
                    }
                  }}
                  className={`w-full p-4 rounded-xl border flex items-center gap-4 transition-all duration-300 group
                       ${shareMethod === opt.label
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-white'
                      : 'bg-transparent border-white/5 text-slate-400 hover:bg-white/5 hover:border-white/10'
                    }
                       ${!linkGenerated ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                     `}
                >
                  <div className={`p-2 rounded-full ${shareMethod === opt.label ? 'bg-cyan-500 text-black' : 'bg-white/5 text-slate-400 group-hover:text-white'}`}>
                    <opt.icon size={16} />
                  </div>
                  <span className="text-sm font-medium">{opt.label}</span>
                  {shareMethod === opt.label && <CheckCircle2 size={16} className="ml-auto text-cyan-400" />}
                </button>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};