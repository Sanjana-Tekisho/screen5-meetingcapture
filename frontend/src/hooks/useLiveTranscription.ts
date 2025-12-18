import { useState, useEffect, useRef, useCallback } from 'react';
import { API_CONFIG } from '../config/constants';

export interface TranscriptEvent {
    type: 'word' | 'segment_complete' | 'transcription' | 'realtime_transcript' | 'error';
    text: string;
    speaker_id?: string | null;
    speaker?: string | null;
    is_final: boolean;
    start?: number;
    end?: number;
}

export interface TranscriptLine {
    id: string;
    speaker: string;
    text: string;
    timestamp: string;
    isHighlighted?: boolean;
}

interface UseLiveTranscriptionProps {
    isActive: boolean;
    defaultSpeaker?: string;
}

export const useLiveTranscription = ({
    isActive,
    defaultSpeaker = 'Speaker'
}: UseLiveTranscriptionProps) => {
    const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioStreamRef = useRef<MediaStream | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const speakerCounterRef = useRef<Map<string, number>>(new Map());
    const currentSegmentRef = useRef<{ speaker: string | null, words: string[], lineId: string | null }>({
        speaker: null,
        words: [],
        lineId: null
    });

    const getSpeakerName = useCallback((speakerId: string | null): string => {
        if (!speakerId) {
            return defaultSpeaker;
        }

        // If we haven't seen this speaker before, assign a number
        if (!speakerCounterRef.current.has(speakerId)) {
            const count = speakerCounterRef.current.size + 1;
            speakerCounterRef.current.set(speakerId, count);
        }

        const speakerNum = speakerCounterRef.current.get(speakerId);
        return `Speaker ${speakerNum}`;
    }, [defaultSpeaker]);

    const cleanup = useCallback(() => {
        // Disconnect audio nodes
        if (processorRef.current) {
            processorRef.current.disconnect();
            processorRef.current = null;
        }

        if (sourceRef.current) {
            sourceRef.current.disconnect();
            sourceRef.current = null;
        }

        // Close audio context
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close().catch(console.error);
            audioContextRef.current = null;
        }

        // Stop all audio tracks explicitly and release stream
        if (audioStreamRef.current) {
            audioStreamRef.current.getTracks().forEach(track => {
                track.stop();
                track.enabled = false;
            });
            audioStreamRef.current = null;
        }

        // Close WebSocket
        if (wsRef.current) {
            if (wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.close();
            }
            wsRef.current = null;
        }

        setIsConnected(false);
    }, []);

    useEffect(() => {
        if (!isActive) {
            cleanup();
            return;
        }

        // Initialize WebSocket connection
        const ws = new WebSocket(API_CONFIG.WEBSOCKET_URL);
        wsRef.current = ws;

        ws.onopen = async () => {
            console.log('WebSocket connected');
            setIsConnected(true);
            setError(null);

            try {
                // Request microphone access
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        channelCount: 1,
                        sampleRate: 16000,
                        echoCancellation: true,
                        noiseSuppression: true,
                    }
                });
                audioStreamRef.current = stream;

                // Create AudioContext for processing raw audio
                const audioContext = new AudioContext({ sampleRate: 16000 });
                audioContextRef.current = audioContext;

                const source = audioContext.createMediaStreamSource(stream);
                sourceRef.current = source;

                // Use ScriptProcessorNode to get raw PCM data
                const processor = audioContext.createScriptProcessor(4096, 1, 1);
                processorRef.current = processor;

                processor.onaudioprocess = (e) => {
                    if (ws.readyState === WebSocket.OPEN) {
                        const inputData = e.inputBuffer.getChannelData(0);

                        // Convert Float32Array to Int16Array (PCM 16-bit)
                        const pcmData = new Int16Array(inputData.length);
                        for (let i = 0; i < inputData.length; i++) {
                            const s = Math.max(-1, Math.min(1, inputData[i]));
                            pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                        }

                        // Send raw bytes directly
                        console.log(`Sending ${pcmData.buffer.byteLength} bytes of audio`);
                        ws.send(pcmData.buffer);
                    }
                };

                // Connect the audio graph
                source.connect(processor);
                processor.connect(audioContext.destination);

                console.log('Audio processing started');
            } catch (err) {
                console.error('Microphone access error:', err);
                setError('Failed to access microphone. Please check permissions.');
                cleanup();
            }
        };

        ws.onmessage = (event) => {
            try {
                const data: TranscriptEvent = JSON.parse(event.data);
                console.log('Received transcript event:', data);

                // Handle word events - accumulate by speaker
                if (data.type === 'word' && data.text && data.text.trim()) {
                    const speakerName = getSpeakerName(data.speaker_id);

                    // If same speaker, accumulate words
                    if (currentSegmentRef.current.speaker === speakerName && currentSegmentRef.current.lineId) {
                        currentSegmentRef.current.words.push(data.text.trim());

                        // Update the existing line with accumulated text
                        setTranscript(prev => {
                            return prev.map(line =>
                                line.id === currentSegmentRef.current.lineId
                                    ? { ...line, text: currentSegmentRef.current.words.join(' ') }
                                    : line
                            );
                        });
                    } else {
                        // Check if we can RESUME the last segment
                        setTranscript(prev => {
                            if (prev.length > 0) {
                                const lastLine = prev[prev.length - 1];
                                // Sticky Speaker: Merge if same name OR if new speaker is Unknown/null (assume continuation)
                                const isUnknown = !speakerName || speakerName === 'Unknown' || speakerName === 'Speaker' || speakerName === 'Unknown Speaker';

                                if (lastLine.speaker === speakerName || isUnknown) {
                                    // RESUME MERGE
                                    // Re-hydrate the ref to point to this line
                                    currentSegmentRef.current = {
                                        speaker: lastLine.speaker, // Keep original valid speaker name
                                        words: [...lastLine.text.split(' '), data.text.trim()],
                                        lineId: lastLine.id
                                    };

                                    return prev.map((line, idx) =>
                                        idx === prev.length - 1
                                            ? { ...line, text: line.text + ' ' + data.text.trim() }
                                            : line
                                    );
                                }
                            }

                            // New speaker - create new line
                            const timestamp = new Date().toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit'
                            });

                            const lineId = Date.now().toString() + Math.random();
                            currentSegmentRef.current = {
                                speaker: speakerName,
                                words: [data.text.trim()],
                                lineId: lineId
                            };

                            const newLine: TranscriptLine = {
                                id: lineId,
                                speaker: speakerName,
                                text: data.text.trim(),
                                timestamp: timestamp,
                                isHighlighted: false
                            };

                            return [...prev, newLine];
                        });
                    }
                }
                // Handle segment complete - finalize current segment
                else if (data.type === 'segment_complete') {
                    console.log('Segment complete:', data.text);
                    // Reset accumulator for next segment
                    currentSegmentRef.current = {
                        speaker: null,
                        words: [],
                        lineId: null
                    };
                }
                // Handle legacy transcription events
                else if (data.type === 'transcription' && data.text && data.text.trim()) {
                    const timestamp = new Date().toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                    });

                    const speakerName = getSpeakerName(data.speaker_id);

                    const newLine: TranscriptLine = {
                        id: Date.now().toString() + Math.random(),
                        speaker: speakerName,
                        text: data.text.trim(),
                        timestamp: timestamp,
                        isHighlighted: false
                    };

                    setTranscript(prev => [...prev, newLine]);
                }
                // Handle AssemblyAI realtime transcripts
                else if (data.type === 'realtime_transcript' && data.text) {
                    const speakerName = getSpeakerName(data.speaker);
                    const isFinal = data.is_final;
                    const text = data.text.trim();

                    if (!text) return;

                    setTranscript(prev => {
                        // Check if we are updating the current partial line
                        if (currentSegmentRef.current.lineId) {
                            // If we have an active line, update it
                            return prev.map(line =>
                                line.id === currentSegmentRef.current.lineId
                                    ? { ...line, text: text, speaker: speakerName }
                                    : line
                            );
                        }

                        // If no active line, create one
                        const timestamp = new Date().toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                        });

                        const lineId = Date.now().toString() + Math.random();
                        currentSegmentRef.current = {
                            speaker: speakerName,
                            words: [], // Not used for this mode, but keeping structure
                            lineId: lineId
                        };

                        const newLine: TranscriptLine = {
                            id: lineId,
                            speaker: speakerName,
                            text: text,
                            timestamp: timestamp,
                            isHighlighted: false
                        };

                        return [...prev, newLine];
                    });

                    // If this is a final transcript, reset the current segment so next message starts a new line
                    if (isFinal) {
                        currentSegmentRef.current = {
                            speaker: null,
                            words: [],
                            lineId: null
                        };
                    }
                }
                // Handle errors
                else if (data.type === 'error') {
                    console.error('Transcription error:', data.text);
                    setError(data.text);
                }
            } catch (err) {
                console.error('Failed to parse message:', err);
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            setError('Connection error occurred');
        };

        ws.onclose = (event) => {
            console.log('WebSocket closed', event.code, event.reason);
            setIsConnected(false);
            cleanup();
        };

        return () => {
            cleanup();
        };
    }, [isActive, cleanup, getSpeakerName]);

    const clearTranscript = useCallback(() => {
        setTranscript([]);
        speakerCounterRef.current.clear();
        currentSegmentRef.current = {
            speaker: null,
            words: [],
            lineId: null
        };
    }, []);

    return {
        transcript,
        setTranscript,
        isConnected,
        error,
        clearTranscript
    };
};
