import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Play, 
  Pause, 
  Square, 
  FileText, 
  Mic, 
  Camera, 
  Send, 
  ChevronLeft, 
  User, 
  Building2,
  CheckCircle2,
  Loader2,
  Activity,
  PenTool,
  Users,
  ArrowRight,
  ShieldAlert,
  Star,
  Maximize2,
  Minimize2,
  Zap,
  Upload,
  Waves
} from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { generateMeetingMinutes } from '../services/geminiService';

interface OfflineMeetingInterfaceProps {
  onBack: () => void;
}

// Simple type augmentation for SpeechRecognition if not present
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
    webkitAudioContext: typeof AudioContext;
  }
}

interface TranscriptLine {
  id: string;
  speaker: string;
  text: string;
  timestamp: string;
  isHighlighted?: boolean;
}

export const OfflineMeetingInterface: React.FC<OfflineMeetingInterfaceProps> = ({ onBack }) => {
  // --------------------------------------------------------------------------
  // CONFIGURATION SECTION
  // --------------------------------------------------------------------------
  
  // FIXED: Assigned the key directly as a string.
  const ELEVEN_LABS_API_KEY = 'sk_842825f65ca04f2617075a0838c9b3d1f9e6335e36539555';

  // --------------------------------------------------------------------------

  // States
  const [status, setStatus] = useState<'IDLE' | 'RUNNING' | 'PAUSED' | 'ENDED'>('IDLE');
  const [seconds, setSeconds] = useState(0);
  const [notes, setNotes] = useState('');
  
  // Transcript State now holds structured objects
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [isTranscriptFullScreen, setIsTranscriptFullScreen] = useState(false);
  
  // Live Agent State (Gemini)
  const [useLiveAgent, setUseLiveAgent] = useState(false);
  const [liveAgentConnecting, setLiveAgentConnecting] = useState(false);
  
  // ElevenLabs Scribe State
  const [scribeProcessing, setScribeProcessing] = useState(false);

  const [momContent, setMomContent] = useState<string | null>(null);
  const [isGeneratingMOM, setIsGeneratingMOM] = useState(false);
  const [view, setView] = useState<'MAIN' | 'MOM' | 'SELFIE' | 'EMAIL'>('MAIN');
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  
  // Voice Input State (Manual Notes)
  const [isListening, setIsListening] = useState(false);
  const isListeningRef = useRef(false); 
  const recognitionRef = useRef<any>(null);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<'IDLE' | 'RUNNING' | 'PAUSED' | 'ENDED'>('IDLE');

  // Live API Refs (Gemini)
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sessionRef = useRef<any>(null);

  // Scribe Refs (ElevenLabs)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scribeTimeoutRef = useRef<any>(null);
  const isScribeActiveRef = useRef(false);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // --- AUDIO HELPERS ---
  const base64ToArrayBuffer = (base64: string) => {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  const floatTo16BitPCM = (input: Float32Array) => {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]));
        output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return output;
  };

  // --- ELEVENLABS SCRIBE INTEGRATION ---
  const startScribeRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      isScribeActiveRef.current = true;

      // Determine the best supported mime type for valid files
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
      }

      const recordSegment = () => {
        if (!isScribeActiveRef.current) return;

        // PAUSE LOGIC: If paused, verify periodically without recording
        if (statusRef.current === 'PAUSED') {
            scribeTimeoutRef.current = setTimeout(recordSegment, 1000);
            return;
        }

        const mediaRecorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = mediaRecorder;
        const localChunks: Blob[] = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            localChunks.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          if (localChunks.length > 0) {
            const blob = new Blob(localChunks, { type: mimeType });
            // Only send if blob has actual data
            if (blob.size > 0) {
                sendToElevenLabs(blob);
            }
          }
          // Recursively start next segment if still active
          if (isScribeActiveRef.current) {
             recordSegment();
          }
        };

        mediaRecorder.start();

        // Increase chunk size to 15 seconds for better diarization context
        scribeTimeoutRef.current = setTimeout(() => {
          if (mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
          }
        }, 15000); 
      };

      // Start the first segment
      recordSegment();

    } catch (err) {
      console.error("Error starting Scribe recording:", err);
      setStatus('IDLE');
    }
  };

  const stopScribeRecording = () => {
    isScribeActiveRef.current = false;
    
    if (scribeTimeoutRef.current) {
        clearTimeout(scribeTimeoutRef.current);
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
       mediaRecorderRef.current.stop();
    }
    
    // Stop all tracks to release microphone
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
    }
  };

  const sendToElevenLabs = async (audioBlob: Blob) => {
     setScribeProcessing(true);
     const formData = new FormData();
     
     // Determine extension based on blob type for the filename
     let extension = 'webm';
     if (audioBlob.type.includes('mp4')) extension = 'mp4';
     else if (audioBlob.type.includes('wav')) extension = 'wav';

     formData.append('file', audioBlob, `recording.${extension}`);
     formData.append('model_id', 'scribe_v1'); // Use ElevenLabs Scribe model
     formData.append('diarize', 'true');       // Enable Speaker Diarization
     formData.append('language_code', 'en');   // Force English Language

     try {
       const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
         method: 'POST',
         mode: 'cors', // Explicitly request CORS
         headers: {
           'xi-api-key': ELEVEN_LABS_API_KEY
           // Do NOT set Content-Type, browser sets it with boundary
         },
         body: formData
       });

       if (!response.ok) {
           const errorText = await response.text();
           console.error('Scribe API Error:', response.status, errorText);
           return;
       }

       const data = await response.json();
       
       if (data.text) {
          // If words are available with speaker tags
          if (data.words && data.words.length > 0) {
             // Simple grouping logic by speaker
             let currentSpeaker = data.words[0].speaker_id || "Speaker A";
             let currentText = "";
             const newLines: TranscriptLine[] = [];
             
             data.words.forEach((word: any, index: number) => {
                 const speaker = word.speaker_id || "Speaker A";
                 
                 // Map speaker IDs to friendly names if needed
                 let speakerName = speaker;
                 if (speaker === "speaker_0") speakerName = "Host";
                 else if (speaker === "speaker_1") speakerName = "Guest";
                 else if (speaker === "speaker_2") speakerName = "Participant";

                 if (speaker !== currentSpeaker && currentText) {
                    newLines.push({
                        id: Date.now().toString() + index,
                        speaker: currentSpeaker === "speaker_0" ? "Host" : currentSpeaker === "speaker_1" ? "Guest" : currentSpeaker === "speaker_2" ? "Participant" : currentSpeaker,
                        text: currentText.trim(),
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        isHighlighted: false
                    });
                    currentSpeaker = speaker;
                    currentText = "";
                 }
                 currentText += word.text + " ";
             });

             // Push final line
             if (currentText) {
                newLines.push({
                    id: Date.now().toString(),
                    speaker: currentSpeaker === "speaker_0" ? "Host" : currentSpeaker === "speaker_1" ? "Guest" : currentSpeaker === "speaker_2" ? "Participant" : currentSpeaker,
                    text: currentText.trim(),
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    isHighlighted: false
                });
             }
             
             setTranscript(prev => [...prev, ...newLines]);

          } else {
             // Fallback if no detailed diarization words
             setTranscript(prev => [...prev, {
                id: Date.now().toString(),
                speaker: "Detected Speaker",
                text: data.text,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                isHighlighted: false
             }]);
          }
       }

     } catch (err) {
       console.error("ElevenLabs Scribe Fetch Error:", err);
     } finally {
       setScribeProcessing(false);
     }
  };


  // --- GEMINI LIVE API LOGIC ---
  const startLiveSession = async () => {
    try {
      setLiveAgentConnecting(true);
      const apiKey = process.env.API_KEY || '';
      const ai = new GoogleGenAI({ apiKey });
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: {
          sampleRate: 16000,
          channelCount: 1
      }});

      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
            responseModalities: [Modality.AUDIO],
            inputAudioTranscription: { model: "gemini-2.5-flash" },
            outputAudioTranscription: { model: "gemini-2.5-flash" },
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
            },
            // Explicit instruction to enforce English
            systemInstruction: "You are the LeadQ Voice Node, a highly advanced corporate assistant. You are speaking with Sarah Jones. Keep responses concise and professional. You must speak and transcribe strictly in English, regardless of input accent."
        },
        callbacks: {
            onopen: () => {
                console.log("Live Session Connected");
                setLiveAgentConnecting(false);
                setStatus('RUNNING');

                const inputContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
                const source = inputContext.createMediaStreamSource(stream);
                const processor = inputContext.createScriptProcessor(4096, 1, 1);
                
                processor.onaudioprocess = (e) => {
                    // PAUSE LOGIC: Do not send data if paused
                    if (statusRef.current === 'PAUSED') return;

                    const inputData = e.inputBuffer.getChannelData(0);
                    const pcmData = floatTo16BitPCM(inputData);
                    let binary = '';
                    const bytes = new Uint8Array(pcmData.buffer);
                    const len = bytes.byteLength;
                    for (let i = 0; i < len; i++) {
                        binary += String.fromCharCode(bytes[i]);
                    }
                    const base64Data = btoa(binary);

                    sessionPromise.then(session => {
                        session.sendRealtimeInput({
                            media: {
                                mimeType: "audio/pcm",
                                data: base64Data
                            }
                        });
                    });
                };

                source.connect(processor);
                processor.connect(inputContext.destination);
                
                inputSourceRef.current = source;
                processorRef.current = processor;
            },
            onmessage: async (message: LiveServerMessage) => {
                const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                if (audioData && audioContextRef.current) {
                    const arrayBuffer = base64ToArrayBuffer(audioData);
                    const pcm16 = new Int16Array(arrayBuffer);
                    const float32 = new Float32Array(pcm16.length);
                    for(let i=0; i<pcm16.length; i++) {
                        float32[i] = pcm16[i] / 32768.0;
                    }
                    
                    const audioBuffer = audioContextRef.current.createBuffer(1, float32.length, 24000);
                    audioBuffer.getChannelData(0).set(float32);

                    const source = audioContextRef.current.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(audioContextRef.current.destination);
                    
                    if (nextStartTimeRef.current < audioContextRef.current.currentTime) {
                        nextStartTimeRef.current = audioContextRef.current.currentTime;
                    }
                    source.start(nextStartTimeRef.current);
                    nextStartTimeRef.current += audioBuffer.duration;
                }

                const inputTrans = message.serverContent?.inputTranscription?.text;
                const outputTrans = message.serverContent?.outputTranscription?.text;

                if (inputTrans || outputTrans) {
                     setTranscript(prev => {
                         const newLines = [...prev];
                         const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                         
                         const addOrUpdate = (speaker: string, text: string) => {
                             newLines.push({
                                 id: Date.now().toString() + Math.random(),
                                 speaker,
                                 text,
                                 timestamp: now,
                                 isHighlighted: false
                             });
                         };

                         if (inputTrans) addOrUpdate("Sarah Jones", inputTrans);
                         if (outputTrans) addOrUpdate("Voice Node", outputTrans);
                         return newLines;
                     });
                }
            },
            onclose: () => {
                setStatus('ENDED');
            },
            onerror: (err) => {
                console.error(err);
                setStatus('IDLE');
                setLiveAgentConnecting(false);
            }
        }
      });
      sessionRef.current = sessionPromise;

    } catch (e) {
        console.error(e);
        setLiveAgentConnecting(false);
    }
  };

  const stopLiveSession = async () => {
     if (processorRef.current) {
         processorRef.current.disconnect();
         processorRef.current = null;
     }
     if (inputSourceRef.current) {
         inputSourceRef.current.disconnect();
         inputSourceRef.current = null;
     }
     if (audioContextRef.current) {
         audioContextRef.current.close();
         audioContextRef.current = null;
     }
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (status === 'RUNNING') {
      interval = setInterval(() => {
        setSeconds(s => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    const container = scrollRef.current;
    if (container) {
       const { scrollTop, scrollHeight, clientHeight } = container;
       const isUserScrolledUp = scrollHeight - scrollTop - clientHeight > 150;
       if (!isUserScrolledUp) {
          transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
       }
    } else {
        transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcript, isTranscriptFullScreen]);

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
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
             setIsListening(false);
             isListeningRef.current = false;
          }
      };
      recognition.onend = () => {
        if (isListeningRef.current) {
           setTimeout(() => {
               if (!isListeningRef.current) return;
               try { recognition.start(); } catch (e) {}
           }, 100);
        } else {
           setIsListening(false);
        }
      };
      recognitionRef.current = recognition;
    }
    return () => {
      if (recognitionRef.current) recognitionRef.current.abort();
    };
  }, []);

  const toggleVoiceInput = () => {
    if (useLiveAgent && status === 'RUNNING') return;
    if (!recognitionRef.current) return;
    
    if (isListening) {
      isListeningRef.current = false;
      setIsListening(false);
      recognitionRef.current.stop();
    } else {
      isListeningRef.current = true;
      setIsListening(true);
      try { recognitionRef.current.start(); } catch (e) { setIsListening(false); isListeningRef.current = false; }
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

  const handleStart = () => {
      if (useLiveAgent) {
        startLiveSession();
      } else {
        // Start ElevenLabs Scribe
        startScribeRecording();
        setStatus('RUNNING');
      }
  };

  const handlePause = () => setStatus('PAUSED');
  const handleResume = () => setStatus('RUNNING');
  
  const handleEnd = () => {
    if (useLiveAgent) {
        stopLiveSession();
    } else {
        stopScribeRecording();
    }
    setStatus('ENDED');
    if (isListening) toggleVoiceInput();
  };

  const handleGenerateMOM = async () => {
    if (momContent) {
      setView('MOM');
      return;
    }
    setIsGeneratingMOM(true);
    const highlightedSegments = transcript.filter(t => t.isHighlighted).map(t => `${t.speaker} said: "${t.text}"`);
    const transcriptText = transcript.map(t => `${t.speaker}: ${t.text}`);
    const result = await generateMeetingMinutes(transcriptText, notes, 'Sarah Jones', highlightedSegments);
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
      console.error(err);
    }
  };

  const handleCaptureSelfie = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        setSelfieImage(canvasRef.current.toDataURL('image/png'));
        const stream = videoRef.current.srcObject as MediaStream;
        stream?.getTracks().forEach(track => track.stop());
      }
    }
  };
  
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelfieImage(reader.result as string);
        if (videoRef.current && videoRef.current.srcObject) {
           const stream = videoRef.current.srcObject as MediaStream;
           stream.getTracks().forEach(track => track.stop());
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const renderTranscriptPanel = (isFullScreen: boolean) => (
    <div className={`flex flex-col h-full relative group transition-all duration-300
        ${isFullScreen 
            ? 'w-full h-full bg-slate-50 pointer-events-auto' 
            : 'bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-xl'
        }`}>
       
       <div className={`flex-none p-6 border-b flex items-center justify-between z-50 shadow-sm relative
           ${isFullScreen ? 'bg-white/95 border-slate-200' : 'bg-slate-50 border-slate-200'}
       `}>
         <div className="flex items-center gap-3">
           <div className={`p-2 rounded-lg transition-colors ${useLiveAgent && status === 'RUNNING' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
              <Users size={18} />
           </div>
           <div>
               <span className="text-sm font-bold uppercase tracking-widest text-slate-900 block">
                  {useLiveAgent ? "Voice Node" : "Multi-Speaker Transcript"}
               </span>
               <div className="flex items-center gap-2">
                 {useLiveAgent && status === 'RUNNING' && (
                    <span className="text-[10px] text-red-500 font-mono animate-pulse">● LIVE AUDIO STREAM ACTIVE</span>
                 )}
                 {!useLiveAgent && status === 'RUNNING' && (
                    <span className="text-[10px] text-blue-500 font-mono flex items-center gap-1">
                      <Waves size={10} className="animate-pulse" /> RECORDING & DIARIZING
                    </span>
                 )}
                 {status === 'PAUSED' && (
                     <span className="text-[10px] text-amber-500 font-mono flex items-center gap-1">
                        <Pause size={10} /> PAUSED
                     </span>
                 )}
               </div>
           </div>
         </div>
         <div className="flex items-center gap-4">
             <div className="text-[10px] uppercase text-slate-400 tracking-wider hidden sm:block">
                Click line to highlight
             </div>
             {status === 'RUNNING' && <div className="flex gap-1">
                <span className={`w-1 h-1 rounded-full animate-bounce ${useLiveAgent ? 'bg-red-500' : 'bg-blue-500'}`} style={{ animationDelay: '0s' }}/>
                <span className={`w-1 h-1 rounded-full animate-bounce ${useLiveAgent ? 'bg-red-500' : 'bg-blue-500'}`} style={{ animationDelay: '0.1s' }}/>
                <span className={`w-1 h-1 rounded-full animate-bounce ${useLiveAgent ? 'bg-red-500' : 'bg-blue-500'}`} style={{ animationDelay: '0.2s' }}/>
             </div>}
             
             <button 
                onClick={() => setIsTranscriptFullScreen(!isTranscriptFullScreen)}
                className={`p-2 rounded-lg border transition-all duration-300 hover:scale-105
                    ${isFullScreen 
                        ? 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200' 
                        : 'bg-white text-slate-400 border-slate-200 hover:text-blue-500 hover:border-blue-200'
                    }`}
                title={isFullScreen ? "Minimize View" : "Expand to Full Screen"}
             >
                {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
             </button>
         </div>
       </div>
       
       <div 
         ref={scrollRef}
         className={`flex-1 overflow-y-auto p-6 space-y-6 relative z-0 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent overscroll-none min-h-0
            ${isFullScreen ? 'pb-40' : 'pb-6'} 
         `}
       >
          {transcript.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 gap-4">
              <Mic size={48} strokeWidth={1} />
              <p className="text-center">
                 {useLiveAgent ? "Waiting for Voice Node input..." : "Start recording to activate ElevenLabs Scribe."}
                 <br/><span className="text-xs opacity-70">(Speaker Diarization Active)</span>
              </p>
            </div>
          ) : (
            transcript.map((line, idx) => {
              const isSarah = line.speaker === "Sarah Jones"; 
              const isAI = line.speaker === "Voice Node" || line.speaker === "LeadQ AI"; 
              const isHost = line.speaker === "Host";

              return (
                <div 
                    key={idx} 
                    onClick={() => toggleHighlight(line.id)}
                    className={`flex flex-col gap-1 animate-in fade-in slide-in-from-left-2 duration-300 cursor-pointer group/line ${isSarah ? 'items-end' : 'items-start'} max-w-full`}
                >
                   <div className="flex items-center gap-2">
                     <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full 
                       ${isSarah ? 'bg-blue-50 text-blue-600' : isAI ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                       {line.speaker}
                     </span>
                     <span className="text-[10px] text-slate-400 font-mono">{line.timestamp}</span>
                   </div>
                   
                   <div className="relative max-w-full">
                        <div className={`p-4 rounded-2xl max-w-xl text-sm leading-relaxed shadow-sm transition-all duration-300 border break-words whitespace-pre-wrap
                            ${line.isHighlighted 
                                ? 'bg-amber-50 border-amber-200 text-amber-900 shadow-md scale-[1.02]' 
                                : isSarah 
                                    ? 'bg-blue-50 text-blue-900 rounded-tr-sm border-blue-100 hover:border-blue-300' 
                                    : isAI
                                        ? 'bg-red-50 text-red-900 rounded-tl-sm border-red-100 hover:border-red-300'
                                        : isHost 
                                            ? 'bg-emerald-50 text-emerald-900 rounded-tl-sm border-emerald-100 hover:border-emerald-300'
                                            : 'bg-white text-slate-700 rounded-tl-sm border-slate-100 hover:border-slate-300'
                            }`}>
                            {line.text}
                        </div>
                        
                        <div className={`absolute top-1/2 -translate-y-1/2 ${isSarah ? '-left-8' : '-right-8'} transition-all duration-300 ${line.isHighlighted ? 'opacity-100 scale-100' : 'opacity-0 scale-0 group-hover/line:opacity-50 group-hover/line:scale-100'}`}>
                            <Star size={16} className={line.isHighlighted ? "fill-amber-400 text-amber-400" : "text-slate-300"} />
                        </div>
                   </div>
                </div>
              );
            })
          )}
          {scribeProcessing && !useLiveAgent && (
             <div className="flex items-center gap-2 text-xs text-slate-400 ml-2 animate-pulse">
                <Loader2 size={12} className="animate-spin" /> Processing audio chunk...
             </div>
          )}
          <div ref={transcriptEndRef} />
       </div>
    </div>
  );

  const renderMOM = () => (
    <div className="w-full h-full flex flex-col space-y-6 animate-in fade-in slide-in-from-right duration-500 max-w-6xl mx-auto p-4 md:p-8">
      <div className="flex items-center justify-between border-b border-slate-200 pb-6">
        <div>
           <h2 className="text-3xl font-bold text-slate-900 mb-2">Meeting Minutes</h2>
           <p className="text-slate-500 text-sm">Generated by LeadQ AI • Includes Manual Notes & Highlights</p>
        </div>
        <button onClick={() => setView('MAIN')} className="text-sm text-slate-500 hover:text-slate-900 flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-full transition-colors border border-slate-200 hover:bg-slate-200">
           <ChevronLeft size={16} /> Back
        </button>
      </div>

      <div className="flex-1 bg-white rounded-2xl p-8 border border-slate-200 overflow-y-auto font-sans text-slate-600 leading-relaxed shadow-xl relative">
         <div className="prose prose-slate max-w-none whitespace-pre-wrap">
           {momContent}
         </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
         <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
               <ShieldAlert size={24} />
            </div>
            <div>
               <h3 className="text-slate-900 font-bold text-sm uppercase tracking-wide">Verification Protocol</h3>
               <p className="text-slate-500 text-xs mt-1">Select secure action to proceed:</p>
            </div>
         </div>

         <div className="flex items-center gap-4 w-full md:w-auto">
            <button 
              onClick={handleStartCamera}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all hover:scale-105 shadow-lg shadow-blue-200"
            >
               <Camera size={18} />
               <span>Verify Identity</span>
            </button>
            <button 
              onClick={() => setView('EMAIL')}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold border border-slate-200 transition-all"
            >
               <span>Skip & Draft Email</span>
               <ArrowRight size={18} />
            </button>
         </div>
      </div>
    </div>
  );

  const renderSelfie = () => (
    <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col items-center justify-center p-4 animate-in fade-in duration-300">
      <h2 className="text-3xl font-bold text-slate-900 mb-2 tracking-wide">Identity Verification</h2>
      <p className="text-slate-500 mb-8">Align your face within the frame or upload a photo</p>
      
      <div className="relative rounded-[32px] overflow-hidden border-4 border-slate-200 shadow-2xl bg-black max-w-4xl w-full aspect-video group">
        {selfieImage ? (
           <img src={selfieImage} alt="Captured Selfie" className="w-full h-full object-cover" />
        ) : (
           <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover transform scale-x-[-1]" />
        )}
        <canvas ref={canvasRef} className="hidden" />
        <input 
            type="file" 
            ref={fileInputRef} 
            accept="image/*" 
            className="hidden" 
            onChange={handleFileUpload}
        />
        
        {!selfieImage && (
           <>
              <div className="absolute inset-0 border-[40px] border-slate-100/10 pointer-events-none rounded-[28px]" />
              <div className="absolute bottom-8 left-0 right-0 flex justify-center items-center gap-6 z-10">
                <button 
                  onClick={triggerFileUpload}
                  className="w-14 h-14 rounded-full bg-slate-100/20 backdrop-blur-md border border-white/30 hover:bg-white/30 text-white flex items-center justify-center transition-all"
                  title="Upload Photo"
                >
                   <Upload size={24} />
                </button>
                <button 
                  onClick={handleCaptureSelfie}
                  className="w-20 h-20 rounded-full bg-white border-4 border-slate-200 shadow-lg hover:scale-110 transition-transform active:scale-95 ring-4 ring-blue-500/20 flex items-center justify-center"
                >
                   <div className="w-16 h-16 rounded-full border-2 border-slate-200" />
                </button>
                <div className="w-14" /> {/* Spacer for balance */}
              </div>
           </>
        )}

        {selfieImage && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center gap-6">
                <button 
                   onClick={() => { setSelfieImage(null); handleStartCamera(); }}
                   className="px-6 py-3 rounded-xl bg-white border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors shadow-sm"
                >
                   Retake
                </button>
                <button 
                   onClick={() => setView('EMAIL')}
                   className="px-8 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-xl transition-transform hover:scale-105 flex items-center gap-2"
                >
                   Proceed to Email Draft <ArrowRight size={18} />
                </button>
            </div>
        )}
      </div>
      <button onClick={() => setView('MOM')} className="text-slate-400 hover:text-slate-600 mt-8 uppercase tracking-widest text-xs font-bold transition-colors">
        Cancel & Return
      </button>
    </div>
  );

  const renderEmail = () => (
    <div className="w-full h-full flex flex-col space-y-6 animate-in slide-in-from-bottom duration-500 max-w-6xl mx-auto p-4 md:p-8">
       <div className="flex items-center justify-between border-b border-slate-200 pb-6">
        <div>
           <h2 className="text-3xl font-bold text-slate-900 mb-2">Secure Transmission</h2>
           <p className="text-slate-500 text-sm">Review final draft before sending to organization.</p>
        </div>
        <button onClick={() => setView('MOM')} className="text-sm text-slate-500 hover:text-slate-900 flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-full border border-slate-200">
           <ChevronLeft size={16} /> Back to MOM
        </button>
      </div>
      
      <div className="flex-1 bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col md:flex-row shadow-2xl">
        <div className="flex-1 p-8 space-y-6">
           <div className="grid grid-cols-1 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Recipient</label>
                <div className="text-slate-700 font-mono bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  info@leadq.ai
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Subject Line</label>
                <div className="text-slate-700 font-medium bg-slate-50 p-4 rounded-xl border border-slate-200">
                  Meeting Summary: Sarah Jones - {new Date().toLocaleDateString()}
                </div>
              </div>
           </div>
           <div className="space-y-2 flex-1 flex flex-col h-full">
             <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Content Body</label>
             <textarea 
               readOnly 
               value={momContent || ''}
               className="flex-1 w-full bg-slate-50 text-slate-600 text-sm p-6 rounded-xl border border-slate-200 resize-none focus:outline-none h-64 overflow-y-auto leading-relaxed"
             />
           </div>
        </div>
        <div className="w-full md:w-96 bg-slate-50 border-l border-slate-200 p-8 flex flex-col">
           <h3 className="text-xs font-bold uppercase text-slate-400 mb-6 tracking-wider">Attachments</h3>
           
           {selfieImage ? (
             <div className="relative group w-full aspect-square rounded-2xl overflow-hidden border border-slate-200 shadow-md mb-6 bg-white">
               <img src={selfieImage} alt="Selfie" className="w-full h-full object-cover" />
               <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex items-end p-4">
                 <span className="text-xs text-white font-mono flex items-center gap-2">
                   <CheckCircle2 size={12} className="text-emerald-400" /> ID Verified
                 </span>
               </div>
             </div>
           ) : (
             <div className="w-full aspect-square rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 gap-2 mb-6 bg-white">
               <ShieldAlert size={32} />
               <span className="text-xs uppercase tracking-widest text-center px-4">No Identity Verification</span>
             </div>
           )}

           <div className="mt-auto space-y-4">
              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                 <div className="text-xs text-slate-400 mb-1">Generated By</div>
                 <div className="text-sm text-slate-700 font-medium">LeadQ AI Core</div>
              </div>
           </div>
        </div>
      </div>
      <div className="flex justify-end gap-4 pb-4">
         <button 
           onClick={() => alert("Email Sent Successfully!")}
           className="px-8 py-4 rounded-xl bg-blue-600 text-white font-bold hover:shadow-lg hover:shadow-blue-200 transition-all transform hover:scale-105 flex items-center gap-3"
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
    <div className="w-full max-w-[1600px] mx-auto h-[85vh] flex flex-col gap-6 animate-in fade-in duration-700 p-2 md:p-4">
      <div className="flex-none flex items-center justify-between p-4 bg-white/80 backdrop-blur-md border border-slate-200 rounded-[32px] shadow-xl">
        <div className="flex items-center gap-6">
           <button onClick={onBack} className="p-3 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors text-slate-500 hover:text-slate-900 border border-slate-200">
             <ChevronLeft size={24} />
           </button>
           <div className="flex flex-col md:flex-row md:items-center md:gap-8 gap-2">
             <div>
               <div className="flex items-center gap-2 mb-1">
                 <User size={14} className="text-blue-500" />
                 <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Profile</span>
               </div>
               <h1 className="text-2xl font-bold text-slate-900 tracking-wide">Sarah Jones</h1>
             </div>
             <div className="hidden md:block h-10 w-px bg-slate-200" />
             <div>
               <div className="flex items-center gap-2 mb-1">
                 <Building2 size={14} className="text-cyan-500" />
                 <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Organization</span>
               </div>
               <h2 className="text-xl text-slate-600">LeadQ Corp</h2>
             </div>
           </div>
        </div>
        
        <div className="flex items-center gap-6">
            <div className="hidden lg:flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-xl border border-slate-200">
                <span className={`text-[10px] font-bold uppercase tracking-widest ${useLiveAgent ? 'text-slate-900' : 'text-slate-400'}`}>
                    Voice Node
                </span>
                <button 
                    onClick={() => {
                        if (status === 'RUNNING') return; 
                        setUseLiveAgent(!useLiveAgent);
                    }}
                    className={`relative w-10 h-5 rounded-full transition-colors duration-300 ${useLiveAgent ? 'bg-red-500 border-red-500' : 'bg-slate-300 border-transparent'} border`}
                >
                    <div className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform duration-300 shadow-sm ${useLiveAgent ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
            </div>

            <div className={`hidden md:flex items-center gap-4 px-6 py-3 rounded-xl border ${
              status === 'RUNNING' ? (useLiveAgent ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200') : 'bg-slate-100 border-slate-200'
            }`}>
               <div className="flex items-center gap-3">
                  <Activity className={status === 'RUNNING' ? (useLiveAgent ? 'text-red-500 animate-pulse' : 'text-blue-500 animate-pulse') : 'text-slate-400'} size={20} />
                  <span className={`text-xs font-bold uppercase tracking-widest ${status === 'RUNNING' ? (useLiveAgent ? 'text-red-500' : 'text-blue-500') : 'text-slate-500'}`}>
                    {status === 'IDLE' ? 'Ready' : status === 'RUNNING' ? (useLiveAgent ? 'Node Active' : 'Recording') : status === 'PAUSED' ? 'Paused' : 'Ended'}
                  </span>
               </div>
               <div className="w-px h-6 bg-slate-300" />
               <div className="font-mono text-2xl font-bold text-slate-900 w-20 text-center">{formatTime(seconds)}</div>
            </div>

            <div className="flex items-center bg-slate-100 rounded-xl border border-slate-200 p-1">
                <button
                    onClick={status === 'RUNNING' ? handlePause : status === 'PAUSED' ? handleResume : handleStart}
                    disabled={status === 'ENDED' || liveAgentConnecting}
                    className={`px-6 py-3 rounded-lg flex items-center gap-2 text-xs font-bold uppercase tracking-wider transition-all
                        ${status === 'RUNNING' 
                            ? 'bg-amber-100 text-amber-600 shadow-sm' 
                            : status === 'ENDED' || liveAgentConnecting
                                ? 'opacity-50 cursor-not-allowed text-slate-400' 
                                : useLiveAgent 
                                    ? 'bg-red-100 text-red-600 hover:bg-red-200'
                                    : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'}
                    `}
                >
                    {liveAgentConnecting ? <Loader2 size={14} className="animate-spin" /> : status === 'RUNNING' ? <Pause size={14} /> : useLiveAgent ? <Zap size={14} /> : <Play size={14} />}
                    <span>{liveAgentConnecting ? 'Connecting' : status === 'RUNNING' ? 'Pause' : status === 'PAUSED' ? 'Resume' : 'Start'}</span>
                </button>
                <div className="w-px h-6 bg-slate-300 mx-1" />
                <button
                    onClick={handleEnd}
                    disabled={status === 'IDLE' || status === 'ENDED'}
                    className={`px-6 py-3 rounded-lg flex items-center gap-2 text-xs font-bold uppercase tracking-wider transition-all
                        ${status === 'IDLE' || status === 'ENDED' 
                            ? 'opacity-50 cursor-not-allowed text-slate-400' 
                            : 'bg-red-100 text-red-600 hover:bg-red-200'}
                    `}
                >
                    <Square size={14} />
                    <span>Stop</span>
                </button>
             </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
        
        <div className="lg:col-span-7 h-full relative">
            {!isTranscriptFullScreen && renderTranscriptPanel(false)}
            
            {isTranscriptFullScreen && (
                <div className="w-full h-full rounded-[32px] border border-slate-200 bg-slate-50 flex items-center justify-center flex-col gap-4 text-slate-400 animate-pulse">
                   <Maximize2 size={32} />
                   <div className="uppercase tracking-widest text-xs font-bold">Expanded View Active</div>
                </div>
            )}
        </div>

        {isTranscriptFullScreen && createPortal(
            <div className="fixed inset-0 z-[9999] w-screen h-screen bg-slate-50 flex flex-col origin-center">
               {renderTranscriptPanel(true)}
            </div>,
            document.body
        )}

        <div className="lg:col-span-5 flex flex-col bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-xl relative h-full">
           <div className="flex-none p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50/50 z-20 relative">
             <div className="flex items-center gap-3">
               <div className="p-2 bg-purple-50 rounded-lg text-purple-600 border border-purple-100">
                  <PenTool size={18} />
               </div>
               <span className="text-sm font-bold uppercase tracking-widest text-slate-900">Manual Notes</span>
             </div>
             
             <button
                onClick={toggleVoiceInput}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all
                  ${isListening 
                    ? 'bg-red-100 text-red-600 border border-red-200' 
                    : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-200 hover:border-slate-300'
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
                    <Mic size={12} /> Dictate
                  </>
                )}
             </button>
           </div>

           <div className="flex-1 p-6 flex flex-col relative z-10 overflow-hidden">
              <textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Type key takeaways, or use Voice Input to dictate..."
                className="flex-1 w-full bg-transparent border-none focus:ring-0 text-slate-700 placeholder-slate-400 resize-none text-base leading-7 focus:outline-none"
                spellCheck={false}
              />
           </div>
           
           <div className="p-6 pt-0 bg-white border-t border-slate-100 z-20">
             <button
                onClick={handleGenerateMOM}
                disabled={status !== 'ENDED'}
                className={`w-full h-14 rounded-xl font-bold text-sm tracking-widest uppercase transition-all flex items-center justify-center gap-3
                   ${status === 'ENDED' 
                     ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 hover:scale-[1.02] hover:bg-blue-700' 
                     : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'}
                `}
             >
                {isGeneratingMOM ? <Loader2 className="animate-spin" /> : <FileText size={18} />}
                Click to View MOM
             </button>
           </div>
        </div>

      </div>
    </div>
  );
};