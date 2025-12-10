import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Square,
  Clock,
  FileText,
  Mic,
  Camera,
  Send,
  ChevronLeft,
  User,
  Building2,
  CheckCircle2,
  Loader2,
  Download,
  Terminal,
  Activity,
  PenTool,
  MicOff,
  Users,
  ArrowRight,
  ShieldAlert,
  Star,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { generateMeetingMinutes } from '../services/geminiService';
import { useLiveTranscription } from '../hooks/useLiveTranscription';
import { TranscriptLine } from '../types';

interface OfflineMeetingInterfaceProps {
  onBack: () => void;
}

// Simple type augmentation for SpeechRecognition if not present
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}



export const OfflineMeetingInterface: React.FC<OfflineMeetingInterfaceProps> = ({ onBack }) => {
  // States
  const [status, setStatus] = useState<'IDLE' | 'RUNNING' | 'PAUSED' | 'ENDED'>('IDLE');
  const [seconds, setSeconds] = useState(0);
  const [notes, setNotes] = useState('');
  const [isTranscriptFullScreen, setIsTranscriptFullScreen] = useState(false);

  // Live Transcription Hook
  const {
    transcript,
    setTranscript,
    isConnected,
    error: transcriptionError
  } = useLiveTranscription({
    isActive: status === 'RUNNING',
    defaultSpeaker: 'Sarah Jones'
  });

  const [momContent, setMomContent] = useState<string | null>(null);
  const [isGeneratingMOM, setIsGeneratingMOM] = useState(false);
  const [view, setView] = useState<'MAIN' | 'MOM' | 'SELFIE' | 'EMAIL'>('MAIN');
  const [selfieImage, setSelfieImage] = useState<string | null>(null);

  // Voice Input State
  const [isListening, setIsListening] = useState(false);
  const isListeningRef = useRef(false);
  const recognitionRef = useRef<any>(null);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Timer Effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (status === 'RUNNING') {
      interval = setInterval(() => {
        setSeconds(s => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [status]);



  // Smart Auto-Scroll Effect
  useEffect(() => {
    const container = scrollRef.current;
    if (container) {
      const { scrollTop, scrollHeight, clientHeight } = container;
      // If the user is scrolled up (more than 100px from bottom), do NOT auto-scroll
      // This prevents "hiding away" content while reading history
      const isUserScrolledUp = scrollHeight - scrollTop - clientHeight > 100;

      if (!isUserScrolledUp) {
        transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      // Fallback for initial render
      transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcript]);

  // Voice Recognition Setup (Run Once)
  useEffect(() => {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + ' ';
          }
        }

        if (finalTranscript) {
          setNotes(prev => prev + (prev ? '\n' : '') + finalTranscript.trim());
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'aborted' || event.error === 'no-speech') return;

        console.error("Speech recognition error", event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setIsListening(false);
          isListeningRef.current = false;
          alert("Microphone access denied. Please allow microphone permissions in your browser settings.");
        }
      };

      recognition.onend = () => {
        if (isListeningRef.current) {
          setTimeout(() => {
            if (!isListeningRef.current) return;
            try {
              recognition.start();
            } catch (e) {
              console.log('Voice restart attempt failed', e);
              setIsListening(false);
              isListeningRef.current = false;
            }
          }, 100);
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
    } else {
      console.warn("Speech Recognition API not supported in this browser.");
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      alert("Browser does not support speech recognition.");
      return;
    }

    if (isListening) {
      isListeningRef.current = false;
      setIsListening(false);
      recognitionRef.current.stop();
    } else {
      isListeningRef.current = true;
      setIsListening(true);
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error("Start failed:", e);
        alert("Failed to start microphone. Please check permissions.");
        setIsListening(false);
        isListeningRef.current = false;
      }
    }
  };

  const toggleHighlight = (id: string) => {
    setTranscript(prev => prev.map(line =>
      line.id === id ? { ...line, isHighlighted: !line.isHighlighted } : line
    ));
  };

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const secs = (totalSeconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const handleStart = () => setStatus('RUNNING');
  const handlePause = () => setStatus('PAUSED');
  const handleResume = () => setStatus('RUNNING');
  const handleEnd = () => {
    setStatus('ENDED');
    if (isListening) toggleVoiceInput(); // Stop mic if ending meeting
  };

  const handleGenerateMOM = async () => {
    if (momContent) {
      setView('MOM');
      return;
    }
    setIsGeneratingMOM(true);

    // Extract highlighted segments
    const highlightedSegments = transcript
      .filter(t => t.isHighlighted)
      .map(t => `${t.speaker} said: "${t.text}"`);

    // Convert complex transcript object back to string for AI processing
    const transcriptText = transcript.map(t => `${t.speaker}: ${t.text}`);

    const result = await generateMeetingMinutes(
      transcriptText,
      notes,
      'Sarah Jones',
      highlightedSegments
    );

    setMomContent(result);
    setIsGeneratingMOM(false);
    setView('MOM');
  };

  const handleStartCamera = async () => {
    setView('SELFIE');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera error:", err);
      alert("Could not access camera. Please ensure permissions are granted.");
    }
  };

  const handleCaptureSelfie = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvasRef.current.toDataURL('image/png');
        setSelfieImage(dataUrl);

        // Stop stream
        const stream = videoRef.current.srcObject as MediaStream;
        stream?.getTracks().forEach(track => track.stop());
      }
    }
  };

  // --- SUB-VIEWS --- (MOM, SELFIE, EMAIL)
  const renderMOM = () => (
    <div className="w-full h-full flex flex-col space-y-6 animate-in fade-in slide-in-from-right duration-500 max-w-6xl mx-auto p-8">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-6">
        <div>
          <h2 className="text-3xl font-display font-bold text-white mb-2">Meeting Minutes & Summary</h2>
          <p className="text-slate-400 text-sm">Generated by Nebula AI • Includes Manual Notes & Highlights</p>
        </div>
        <button onClick={() => setView('MAIN')} className="text-sm text-slate-400 hover:text-white flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full transition-colors">
          <ChevronLeft size={16} /> Back
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 bg-black/40 backdrop-blur-xl rounded-2xl p-8 border border-white/10 overflow-y-auto font-sans text-slate-300 leading-relaxed shadow-2xl relative">
        <div className="prose prose-invert max-w-none whitespace-pre-wrap">
          {momContent}
        </div>
      </div>

      {/* Footer Choices */}
      <div className="bg-[#1e293b]/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-cyan-500/10 rounded-xl text-cyan-400">
            <ShieldAlert size={24} />
          </div>
          <div>
            <h3 className="text-white font-bold text-sm uppercase tracking-wide">Verification Protocol</h3>
            <p className="text-slate-400 text-xs mt-1">Select secure action to proceed:</p>
          </div>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          {/* CHOICE 1: Take Selfie */}
          <button
            onClick={handleStartCamera}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-all hover:scale-105 shadow-[0_0_20px_rgba(34,211,238,0.3)]"
          >
            <Camera size={18} />
            <span>Verify Identity (Selfie)</span>
          </button>

          {/* CHOICE 2: Skip to Email */}
          <button
            onClick={() => setView('EMAIL')}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold border border-white/5 transition-all hover:text-white"
          >
            <span>Skip & Draft Email</span>
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );

  const renderSelfie = () => (
    <div className="fixed inset-0 z-50 bg-[#0f172a] flex flex-col items-center justify-center p-4 animate-in fade-in duration-300">
      <h2 className="text-3xl font-display font-bold text-white mb-2 tracking-wide">Identity Verification</h2>
      <p className="text-slate-400 mb-8">Align your face within the frame</p>

      <div className="relative rounded-[32px] overflow-hidden border-4 border-cyan-500/30 shadow-[0_0_100px_rgba(34,211,238,0.2)] bg-black max-w-4xl w-full aspect-video group">

        {selfieImage ? (
          <img src={selfieImage} alt="Captured Selfie" className="w-full h-full object-cover" />
        ) : (
          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover transform scale-x-[-1]" />
        )}

        <canvas ref={canvasRef} className="hidden" />

        {!selfieImage && (
          <>
            <div className="absolute inset-0 border-[40px] border-black/20 pointer-events-none rounded-[28px] opacity-50" />
            <div className="absolute bottom-8 left-0 right-0 flex justify-center z-10">
              <button
                onClick={handleCaptureSelfie}
                className="w-20 h-20 rounded-full bg-white border-4 border-slate-300 shadow-lg hover:scale-110 transition-transform active:scale-95 ring-4 ring-cyan-500/30 flex items-center justify-center"
              >
                <div className="w-16 h-16 rounded-full border-2 border-black/10" />
              </button>
            </div>
          </>
        )}

        {selfieImage && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center gap-6">
            <button
              onClick={() => { setSelfieImage(null); handleStartCamera(); }}
              className="px-6 py-3 rounded-xl bg-white/10 text-white font-bold hover:bg-white/20 backdrop-blur-md transition-colors"
            >
              Retake
            </button>
            {/* PROCEED BUTTON */}
            <button
              onClick={() => setView('EMAIL')}
              className="px-8 py-3 rounded-xl bg-cyan-500 text-black font-bold hover:bg-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.6)] transition-transform hover:scale-105 flex items-center gap-2"
            >
              Proceed to Email Draft <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>

      <button onClick={() => setView('MOM')} className="text-slate-500 hover:text-white mt-8 uppercase tracking-widest text-xs font-bold transition-colors">
        Cancel & Return
      </button>
    </div>
  );

  const renderEmail = () => (
    <div className="w-full h-full flex flex-col space-y-6 animate-in slide-in-from-bottom duration-500 max-w-6xl mx-auto p-8">
      <div className="flex items-center justify-between border-b border-white/10 pb-6">
        <div>
          <h2 className="text-3xl font-display font-bold text-white mb-2">Secure Transmission</h2>
          <p className="text-slate-400 text-sm">Review final draft before sending to organization.</p>
        </div>
        <button onClick={() => setView('MOM')} className="text-sm text-slate-400 hover:text-white flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full">
          <ChevronLeft size={16} /> Back to MOM
        </button>
      </div>

      <div className="flex-1 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden flex flex-col md:flex-row shadow-2xl">
        <div className="flex-1 p-8 space-y-6">
          <div className="grid grid-cols-1 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">Recipient</label>
              <div className="text-white font-mono bg-black/40 p-4 rounded-xl border border-white/10 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                info@nebulacorp.com
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">Subject Line</label>
              <div className="text-white font-medium bg-black/40 p-4 rounded-xl border border-white/10">
                Meeting Summary: Sarah Jones - {new Date().toLocaleDateString()}
              </div>
            </div>
          </div>
          <div className="space-y-2 flex-1 flex flex-col h-full">
            <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">Content Body</label>
            <textarea
              readOnly
              value={momContent || ''}
              className="flex-1 w-full bg-black/40 text-slate-300 text-sm p-6 rounded-xl border border-white/10 resize-none focus:outline-none h-64 overflow-y-auto leading-relaxed"
            />
          </div>
        </div>
        <div className="w-full md:w-96 bg-black/40 border-l border-white/10 p-8 flex flex-col">
          <h3 className="text-xs font-bold uppercase text-slate-500 mb-6 tracking-wider">Attachments Encrypted</h3>

          {selfieImage ? (
            <div className="relative group w-full aspect-square rounded-2xl overflow-hidden border border-white/10 shadow-lg mb-6">
              <img src={selfieImage} alt="Selfie" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-4">
                <span className="text-xs text-white font-mono flex items-center gap-2">
                  <CheckCircle2 size={12} className="text-cyan-400" /> ID Verified
                </span>
              </div>
            </div>
          ) : (
            <div className="w-full aspect-square rounded-2xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center text-slate-500 gap-2 mb-6">
              <ShieldAlert size={32} />
              <span className="text-xs uppercase tracking-widest text-center px-4">No Identity Verification Attached</span>
            </div>
          )}

          <div className="mt-auto space-y-4">
            <div className="p-4 bg-white/5 rounded-xl border border-white/5">
              <div className="text-xs text-slate-400 mb-1">Generated By</div>
              <div className="text-sm text-white font-medium">Nebula AI Core</div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-4 pb-4">
        <button
          onClick={() => alert("Email Sent Successfully! Protocol Complete.")}
          className="px-8 py-4 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 text-white font-bold hover:shadow-[0_0_40px_rgba(168,85,247,0.5)] transition-all transform hover:scale-105 flex items-center gap-3"
        >
          Encrypt & Send <Send size={18} />
        </button>
      </div>
    </div>
  );

  if (view === 'MOM') return renderMOM();
  if (view === 'SELFIE') return renderSelfie();
  if (view === 'EMAIL') return renderEmail();

  return (
    // Fixed height calculation to fit within App.tsx padding (100vh - 4rem) and prevent window scroll
    <div className="w-full max-w-[1600px] mx-auto h-[calc(100vh-4rem)] flex flex-col gap-6 animate-in fade-in duration-700 p-4">
      {/* Header Bar */}
      <div className="flex-none flex items-center justify-between p-4 bg-[#0f172a]/80 backdrop-blur-md border border-white/10 rounded-2xl shadow-lg">
        <div className="flex items-center gap-6">
          <button onClick={onBack} className="p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors text-slate-400 hover:text-white border border-white/5">
            <ChevronLeft size={24} />
          </button>
          <div className="flex flex-col md:flex-row md:items-center md:gap-8 gap-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <User size={14} className="text-purple-400" />
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Delegate</span>
              </div>
              <h1 className="text-2xl font-display font-bold text-white tracking-wide">Sarah Jones</h1>
            </div>
            <div className="hidden md:block h-10 w-px bg-white/10" />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Building2 size={14} className="text-cyan-400" />
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Organization</span>
              </div>
              <h2 className="text-xl font-sans text-slate-200">Nebula Corp</h2>
            </div>
          </div>
        </div>

        {/* Status Pill & Top Controls */}
        <div className="flex items-center gap-6">

          {/* Timer & Status */}
          <div className={`flex items-center gap-4 px-6 py-3 rounded-xl border ${status === 'RUNNING' ? 'bg-red-950/30 border-red-500/30' : 'bg-black/40 border-white/10'
            }`}>
            <div className="flex items-center gap-3">
              <Activity className={status === 'RUNNING' ? 'text-red-500 animate-pulse' : 'text-slate-600'} size={20} />
              <span className={`text-xs font-bold uppercase tracking-widest ${status === 'RUNNING' ? 'text-red-400' : 'text-slate-500'}`}>
                {status === 'IDLE' ? 'Ready' : status === 'RUNNING' ? 'Recording' : status === 'PAUSED' ? 'Paused' : 'Ended'}
              </span>
            </div>
            <div className="w-px h-6 bg-white/10" />
            <div className="font-mono text-2xl font-bold text-white w-20 text-center">{formatTime(seconds)}</div>
          </div>

          {/* Controls Tabs (Start/Resume & Stop) */}
          <div className="flex items-center bg-black/40 rounded-xl border border-white/10 p-1">
            <button
              onClick={status === 'RUNNING' ? handlePause : status === 'PAUSED' ? handleResume : handleStart}
              disabled={status === 'ENDED'}
              className={`px-6 py-3 rounded-lg flex items-center gap-2 text-xs font-bold uppercase tracking-wider transition-all
                        ${status === 'RUNNING'
                  ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                  : status === 'ENDED'
                    ? 'opacity-50 cursor-not-allowed text-slate-500'
                    : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'}
                    `}
            >
              {status === 'RUNNING' ? <Pause size={14} /> : <Play size={14} />}
              <span>{status === 'RUNNING' ? 'Pause' : status === 'PAUSED' ? 'Resume' : 'Start'}</span>
            </button>
            <div className="w-px h-6 bg-white/10 mx-1" />
            <button
              onClick={handleEnd}
              disabled={status === 'IDLE' || status === 'ENDED'}
              className={`px-6 py-3 rounded-lg flex items-center gap-2 text-xs font-bold uppercase tracking-wider transition-all
                        ${status === 'IDLE' || status === 'ENDED'
                  ? 'opacity-50 cursor-not-allowed text-slate-500'
                  : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'}
                    `}
            >
              <Square size={14} />
              <span>Stop</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Workspace Grid - CHANGED LAYOUT TO 12 COLS */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">

        {/* LEFT PANEL: Transcript with Speaker Identification - SPANS 7 COLS (Larger) */}
        <div className={`flex flex-col overflow-hidden shadow-2xl relative group transition-all duration-300
            ${isTranscriptFullScreen
            ? 'fixed inset-0 z-[100] w-screen h-screen bg-[#0b0f19] rounded-none border-none' // Fixed full screen, solid background
            : 'lg:col-span-7 bg-black/40 backdrop-blur-md rounded-[24px] border border-white/10 h-full' // Grid cell, height full
          }`}>

          {/* Expand/Collapse Button - Floating but fixed relative to container */}
          <button
            onClick={() => setIsTranscriptFullScreen(!isTranscriptFullScreen)}
            className={`absolute bottom-6 left-6 z-[110] p-3 rounded-xl border border-white/10 text-slate-400 transition-all duration-300 hover:scale-110 shadow-lg
                  ${isTranscriptFullScreen
                ? 'bg-red-500/20 text-red-400 border-red-500/50 hover:bg-red-500/30'
                : 'bg-[#131b2e] hover:bg-cyan-500/20 hover:text-cyan-400 hover:border-cyan-500/50'
              }`}
            title={isTranscriptFullScreen ? "Minimize View" : "Expand to Full Screen"}
          >
            {isTranscriptFullScreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>

          {/* Decorative bg for full screen */}
          <div className={`absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-[100px] pointer-events-none ${isTranscriptFullScreen ? 'opacity-100' : 'opacity-0'}`} />

          {/* Header - Fixed Height, Z-Index High, Sticky Appearance */}
          <div className={`flex-none p-6 border-b border-white/5 flex items-center justify-between z-50 shadow-sm relative ${isTranscriptFullScreen ? 'bg-[#0b0f19]' : 'bg-[#131b2e]/95 backdrop-blur-md'}`}>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-500/10 rounded-lg text-cyan-400">
                <Users size={18} />
              </div>
              <span className="text-sm font-bold uppercase tracking-widest text-slate-300">Multi-Speaker Transcript</span>
              {/* Connection Status Indicator */}
              {status === 'RUNNING' && (
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${isConnected
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-amber-500/20 text-amber-400'
                  }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
                  {isConnected ? 'Live' : 'Connecting...'}
                </div>
              )}
            </div>
            <div className="flex items-center gap-4">
              {transcriptionError && (
                <div className="text-[10px] text-red-400 bg-red-500/10 px-3 py-1 rounded-full">
                  {transcriptionError}
                </div>
              )}
              <div className="text-[10px] uppercase text-slate-500 tracking-wider">
                Click line to highlight
              </div>
              {status === 'RUNNING' && <div className="flex gap-1">
                <span className="w-1 h-1 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                <span className="w-1 h-1 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <span className="w-1 h-1 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>}
            </div>
          </div>

          {/* Content - Grows to fill space, scrolls independently */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-6 space-y-6 relative z-0 pb-8 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent overscroll-contain"
          >
            {transcript.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 opacity-40 gap-4">
                <Mic size={48} strokeWidth={1} />
                <p>Audio stream inactive. Start meeting to initialize.</p>
              </div>
            ) : (
              transcript.map((line, idx) => {
                const isSarah = line.speaker === "Sarah Jones";
                return (
                  <div
                    key={idx}
                    onClick={() => toggleHighlight(line.id)}
                    className={`flex flex-col gap-1 animate-in fade-in slide-in-from-left-2 duration-300 cursor-pointer group/line ${isSarah ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full 
                           ${isSarah ? 'bg-cyan-500/20 text-cyan-400' : 'bg-purple-500/20 text-purple-400'}`}>
                        {line.speaker}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">{line.timestamp}</span>
                    </div>

                    <div className="relative">
                      <div className={`p-3 rounded-2xl max-w-xl text-sm leading-relaxed backdrop-blur-sm border shadow-sm transition-all duration-300
                                ${line.isHighlighted
                          ? 'bg-amber-500/20 border-amber-400/50 shadow-[0_0_15px_rgba(251,191,36,0.2)] text-amber-100 scale-[1.02]'
                          : isSarah
                            ? 'bg-cyan-950/30 text-cyan-100 rounded-tr-sm border-cyan-500/20 hover:border-cyan-400/40'
                            : 'bg-[#1e293b]/60 text-slate-200 rounded-tl-sm border-purple-500/20 hover:border-purple-400/40'
                        }`}>
                        {line.text}
                      </div>

                      {/* Star Icon */}
                      <div className={`absolute top-1/2 -translate-y-1/2 ${isSarah ? '-left-8' : '-right-8'} transition-all duration-300 ${line.isHighlighted ? 'opacity-100 scale-100' : 'opacity-0 scale-0 group-hover/line:opacity-50 group-hover/line:scale-100'}`}>
                        <Star size={16} className={line.isHighlighted ? "fill-amber-400 text-amber-400" : "text-slate-500"} />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={transcriptEndRef} />
          </div>
        </div>

        {/* RIGHT PANEL: Notes with Voice - SPANS 5 COLS (Smaller) */}
        <div className="lg:col-span-5 flex flex-col bg-[#1e293b]/50 backdrop-blur-md rounded-[24px] border border-white/10 overflow-hidden shadow-2xl relative h-full">
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/5 rounded-full blur-[100px] pointer-events-none" />

          <div className="flex-none p-6 border-b border-white/5 flex items-center justify-between bg-white/5 z-20 relative">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
                <PenTool size={18} />
              </div>
              <span className="text-sm font-bold uppercase tracking-widest text-slate-300">Manual Notes</span>
            </div>

            {/* Voice Notes Button */}
            <button
              onClick={toggleVoiceInput}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all
                  ${isListening
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                }
                `}
            >
              {isListening ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                  Listening...
                </>
              ) : (
                <>
                  <Mic size={12} /> Voice Input
                </>
              )}
            </button>
          </div>

          <div className="flex-1 p-6 flex flex-col relative z-10 overflow-hidden">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Type key takeaways, or use Voice Input to dictate..."
              className="flex-1 w-full bg-transparent border-none focus:ring-0 text-slate-200 placeholder-slate-600 resize-none text-base leading-7 focus:outline-none"
              spellCheck={false}
            />
          </div>
        </div>

      </div>

      {/* FOOTER: Controls Dock - ONLY MOM BUTTON */}
      <div className="flex-none h-24 bg-black/60 backdrop-blur-xl border-t border-white/10 flex items-center justify-center px-8 rounded-2xl mx-4 mb-2">
        <button
          onClick={handleGenerateMOM}
          disabled={status !== 'ENDED'}
          className={`w-full max-w-2xl h-14 rounded-xl font-display font-bold text-sm tracking-widest uppercase transition-all flex items-center justify-center gap-3
               ${status === 'ENDED'
              ? 'bg-gradient-to-r from-purple-600 to-cyan-600 text-white shadow-lg hover:shadow-cyan-500/20 hover:scale-[1.02]'
              : 'bg-white/5 text-slate-600 border border-white/5 cursor-not-allowed'}
            `}
        >
          {isGeneratingMOM ? <Loader2 className="animate-spin" /> : <FileText size={18} />}
          Click to View MOM
        </button>
      </div>
    </div>
  );
};