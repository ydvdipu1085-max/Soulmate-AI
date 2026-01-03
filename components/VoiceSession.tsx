
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { decode, encode, decodeAudioData, createBlob } from '../services/audioUtils';
import { MODELS, Icons } from '../constants';
import { VoiceSessionState } from '../types';

interface SearchResult {
  uri: string;
  title: string;
}

export const VoiceSession: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [state, setState] = useState<VoiceSessionState>({
    isActive: false,
    isConnecting: true,
    error: null,
    userTranscription: '',
    aiTranscription: '',
  });

  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const sessionRef = useRef<any>(null);
  const audioContextInRef = useRef<AudioContext | null>(null);
  const audioContextOutRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const stopSession = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.close?.();
      sessionRef.current = null;
    }
    if (audioContextInRef.current) audioContextInRef.current.close();
    if (audioContextOutRef.current) audioContextOutRef.current.close();
    sourcesRef.current.forEach(s => s.stop());
    sourcesRef.current.clear();
    setState(prev => ({ ...prev, isActive: false, isConnecting: false }));
    onClose();
  }, [onClose]);

  const handleKeySetup = () => {
    if (window.aistudio?.openSelectKey) {
      window.aistudio.openSelectKey();
    }
  };

  useEffect(() => {
    const startSession = async () => {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        audioContextInRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        audioContextOutRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

        const sessionPromise = ai.live.connect({
          model: MODELS.LIVE,
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
            },
            tools: [{ googleSearch: {} }],
            systemInstruction: 'You are Sam, a warm, empathetic, and witty best friend. Keep responses natural, human-like, and relatively concise for audio flow. If anyone asks who created this app, website, or your AI, you must explicitly state that the creator is Ram Kumar Baniya. Ram Kumar Baniya is a class 11 student studying at Shanti Namuna Secondary School in Manigram, Nepal.',
            inputAudioTranscription: {},
            outputAudioTranscription: {},
          },
          callbacks: {
            onopen: () => {
              setState(prev => ({ ...prev, isActive: true, isConnecting: false, error: null }));
              const source = audioContextInRef.current!.createMediaStreamSource(stream);
              const scriptProcessor = audioContextInRef.current!.createScriptProcessor(4096, 1, 1);
              
              scriptProcessor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const pcmBlob = createBlob(inputData);
                sessionPromise.then(session => {
                  session.sendRealtimeInput({ media: pcmBlob });
                });
              };

              source.connect(scriptProcessor);
              scriptProcessor.connect(audioContextInRef.current!.destination);
            },
            onmessage: async (message: any) => {
              if (message.serverContent?.modelTurn?.parts[0]?.inlineData?.data) {
                const audioData = message.serverContent.modelTurn.parts[0].inlineData.data;
                const ctx = audioContextOutRef.current!;
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                
                const buffer = await decodeAudioData(decode(audioData), ctx, 24000, 1);
                const source = ctx.createBufferSource();
                source.buffer = buffer;
                source.connect(ctx.destination);
                source.onended = () => sourcesRef.current.delete(source);
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += buffer.duration;
                sourcesRef.current.add(source);
              }

              const groundingChunks = message.serverContent?.modelTurn?.groundingMetadata?.groundingChunks;
              if (groundingChunks) {
                const results = groundingChunks
                  .map((chunk: any) => ({ uri: chunk.web?.uri, title: chunk.web?.title }))
                  .filter((item: any) => item.uri);
                if (results.length > 0) {
                  setSearchResults(prev => [...prev, ...results]);
                  setIsSearching(false);
                }
              }

              if (message.toolCall?.functionCalls?.some((fc: any) => fc.name === 'google_search')) {
                setIsSearching(true);
              }

              if (message.serverContent?.inputTranscription) {
                setState(prev => ({ ...prev, userTranscription: message.serverContent!.inputTranscription!.text }));
                setSearchResults([]);
              }
              if (message.serverContent?.outputTranscription) {
                setState(prev => ({ ...prev, aiTranscription: (prev.aiTranscription + message.serverContent!.outputTranscription!.text) }));
              }
              if (message.serverContent?.turnComplete) {
                setIsSearching(false);
              }
              if (message.serverContent?.interrupted) {
                sourcesRef.current.forEach(s => s.stop());
                sourcesRef.current.clear();
                nextStartTimeRef.current = 0;
                setIsSearching(false);
              }
            },
            onerror: (e: any) => {
              console.error('Live session error:', e);
              const errorMsg = e?.message || e?.toString() || "";
              if (errorMsg.includes("Network error") || errorMsg.includes("NOT_FOUND") || errorMsg.includes("Requested entity was not found")) {
                setState(prev => ({ ...prev, error: 'API key selection required for live session.', isConnecting: false }));
                handleKeySetup();
              } else {
                setState(prev => ({ ...prev, error: 'Connection lost. Please try again.', isConnecting: false }));
              }
            },
            onclose: () => {
              setState(prev => ({ ...prev, isActive: false }));
            }
          }
        });

        sessionRef.current = await sessionPromise;
      } catch (err: any) {
        console.error("Connection catch:", err);
        const errorMsg = err.message || "";
        if (errorMsg.includes("Requested entity was not found") || errorMsg.includes("NOT_FOUND") || errorMsg.includes("Network error")) {
          setState(prev => ({ ...prev, error: 'Select a valid API key to start talking.', isConnecting: false }));
          handleKeySetup();
        } else {
          setState(prev => ({ ...prev, error: err.message, isConnecting: false }));
        }
      }
    };

    startSession();

    return () => {
      // Cleanup is usually handled by stopSession button but effect needs it too
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/90 p-6 backdrop-blur-xl">
      <div className="relative w-full max-w-lg flex flex-col items-center">
        
        <div className="relative mb-12 h-64 w-64">
          <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-3xl animate-pulse"></div>
          <div className="pulsing-sphere absolute inset-0 rounded-full border border-blue-400/30 flex items-center justify-center">
             <div className={`h-48 w-48 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 transition-all duration-700 ${isSearching ? 'opacity-40 scale-90 blur-lg' : 'opacity-80 shadow-[0_0_50px_rgba(59,130,246,0.5)]'}`}></div>
             {isSearching && (
               <div className="absolute inset-0 flex items-center justify-center animate-spin-slow">
                 <div className="text-white opacity-60"><Icons.Search /></div>
               </div>
             )}
          </div>
        </div>

        <div className="w-full space-y-4 text-center">
          {state.isConnecting && <p className="text-slate-400 animate-pulse font-medium">Connecting with Sam...</p>}
          {state.error && (
            <div className="space-y-4">
              <p className="text-red-400 font-medium">{state.error}</p>
              <button 
                onClick={handleKeySetup}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm border border-white/10 transition-colors"
              >
                Select API Key
              </button>
            </div>
          )}
          
          <div className="min-h-[2rem]">
            {state.userTranscription && (
              <p className="text-slate-300 italic opacity-80">"{state.userTranscription}"</p>
            )}
          </div>
          <div className="min-h-[3rem]">
            {state.aiTranscription && (
              <p className="text-xl font-medium text-white leading-relaxed">{state.aiTranscription}</p>
            )}
          </div>

          {searchResults.length > 0 && (
            <div className="pt-4 flex flex-wrap justify-center gap-2">
              {searchResults.map((res, i) => (
                <a key={i} href={res.uri} target="_blank" rel="noopener noreferrer" 
                   className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-1 rounded-full hover:bg-blue-500/40 transition-all">
                  {res.title || 'Source'}
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="mt-12 flex gap-6">
          <button 
            onClick={stopSession}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20 text-red-500 border border-red-500/50 hover:bg-red-500 hover:text-white transition-all duration-300 transform hover:scale-110 active:scale-95"
          >
            <Icons.Stop />
          </button>
        </div>
      </div>
    </div>
  );
};
