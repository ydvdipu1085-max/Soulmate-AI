
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { ChatMode, Message } from '../types';
import { MODELS, Icons } from '../constants';
import { decode, decodeAudioData } from '../services/audioUtils';

export const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<ChatMode>(ChatMode.PRO);
  const [isTyping, setIsTyping] = useState(false);
  const [isSpeakingId, setIsSpeakingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSpeak = async (msg: Message) => {
    if (isSpeakingId) return;
    
    setIsSpeakingId(msg.id);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: MODELS.TTS,
        contents: [{ parts: [{ text: `Read this message naturally: ${msg.content}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        const ctx = audioContextRef.current;
        const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.onended = () => setIsSpeakingId(null);
        source.start();
      } else {
        setIsSpeakingId(null);
      }
    } catch (err) {
      console.error('TTS error:', err);
      setIsSpeakingId(null);
    }
  };

  const executeGeneration = async (prompt: string, currentMode: ChatMode) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const lowerInput = prompt.toLowerCase();
    const isImageRequest = 
      (lowerInput.includes('generate') || lowerInput.includes('create') || lowerInput.includes('draw')) && 
      (lowerInput.includes('image') || lowerInput.includes('picture') || lowerInput.includes('photo'));

    let aiContent = "";
    let aiImageUrl: string | undefined = undefined;
    let sources: { uri: string; title: string }[] | undefined = undefined;

    if (isImageRequest) {
      const response = await ai.models.generateContent({
        model: MODELS.IMAGE,
        contents: {
          parts: [{ text: prompt }],
        },
        config: {
          imageConfig: { aspectRatio: "1:1" }
        }
      });

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          aiImageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        } else if (part.text) {
          aiContent += part.text;
        }
      }
      if (!aiContent && aiImageUrl) aiContent = "Here's the image you asked for!";
    } else {
      const config: any = {
        systemInstruction: 'You are Soulmate AI, a supportive and intelligent friend. Provide high-quality, thoughtful, and human-like responses. If asked about your creator, who built this app, or who developed this website, you must always state that the creator is Ram Kumar Baniya. Ram Kumar Baniya is a class 11 student at Shanti Namuna Secondary School, Manigram, Nepal.',
      };

      let modelName = MODELS.PRO;
      if (currentMode === ChatMode.FAST) modelName = MODELS.FAST;
      if (currentMode === ChatMode.THINKING) {
        config.thinkingConfig = { thinkingBudget: 32768 };
      }
      if (currentMode === ChatMode.SEARCH) {
        modelName = MODELS.SEARCH;
        config.tools = [{ googleSearch: {} }];
      }

      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config,
      });

      aiContent = response.text || "I'm not sure what to say, friend.";
      sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
        uri: chunk.web?.uri,
        title: chunk.web?.title
      })).filter(Boolean);
    }

    return { content: aiContent, imageUrl: aiImageUrl, sources };
  };

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      mode,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsTyping(true);

    try {
      const result = await executeGeneration(currentInput, mode);
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.content,
        mode,
        timestamp: Date.now(),
        sources: result.sources?.length ? result.sources : undefined,
        imageUrl: result.imageUrl,
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error: any) {
      handleChatError(error);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSaveEdit = async (id: string) => {
    if (!editText.trim() || isTyping) return;

    const messageIndex = messages.findIndex(m => m.id === id);
    if (messageIndex === -1) return;

    // Standard behavior: replace the prompt and clear all subsequent messages
    const updatedUserMsg = { ...messages[messageIndex], content: editText };
    const newMessages = messages.slice(0, messageIndex);
    setMessages([...newMessages, updatedUserMsg]);
    setEditingId(null);
    setIsTyping(true);

    try {
      const result = await executeGeneration(editText, updatedUserMsg.mode || mode);
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.content,
        mode: updatedUserMsg.mode || mode,
        timestamp: Date.now(),
        sources: result.sources?.length ? result.sources : undefined,
        imageUrl: result.imageUrl,
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error: any) {
      handleChatError(error);
    } finally {
      setIsTyping(false);
    }
  };

  const handleChatError = (error: any) => {
    console.error('Chat error:', error);
    const errorMessage = error?.message || '';
    if (errorMessage.includes("Requested entity was not found") || error?.status === "NOT_FOUND") {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: "It seems like I need a valid API key to use this specific model. Could you please select one?",
        timestamp: Date.now(),
      }]);
      if (window.aistudio?.openSelectKey) {
        window.aistudio.openSelectKey();
      }
    } else {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: "Sorry, I hit a snag. My brain is a bit fuzzy right now! Maybe try switching modes?",
        timestamp: Date.now(),
      }]);
    }
  };

  const startEditing = (msg: Message) => {
    setEditingId(msg.id);
    setEditText(msg.content);
  };

  return (
    <div className="flex h-[calc(100vh-160px)] flex-col glass-panel rounded-2xl overflow-hidden">
      <div className="flex border-b border-white/10 p-2 gap-2 bg-slate-900/50">
        {[
          { id: ChatMode.FAST, label: 'Fast', icon: <Icons.Bolt /> },
          { id: ChatMode.PRO, label: 'Pro', icon: <Icons.Sparkle /> },
          { id: ChatMode.THINKING, label: 'Deep', icon: <Icons.Brain /> },
          { id: ChatMode.SEARCH, label: 'Search', icon: <Icons.Search /> },
        ].map(m => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              mode === m.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-white/5'
            }`}
          >
            {m.icon}
            <span className="hidden sm:inline">{m.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4">
            <div className="p-4 rounded-full bg-slate-800/50">
              <Icons.Sparkle />
            </div>
            <p className="text-center max-w-xs">Start a text conversation with Soulmate AI. Choose a mode above!</p>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`relative group max-w-[85%] rounded-2xl px-4 py-3 ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white rounded-tr-none' 
                : 'bg-slate-800/80 text-slate-100 rounded-tl-none border border-white/5'
            }`}>
              {editingId === msg.id ? (
                <div className="flex flex-col gap-2 min-w-[200px]">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full bg-slate-900/50 border border-white/20 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    autoFocus
                    rows={Math.min(5, editText.split('\n').length + 1)}
                  />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditingId(null)} className="p-1 hover:bg-white/10 rounded" title="Cancel">
                      <Icons.X />
                    </button>
                    <button onClick={() => handleSaveEdit(msg.id)} className="p-1 bg-white/10 hover:bg-white/20 rounded" title="Save & Regenerate">
                      <Icons.Check />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-start gap-4">
                    <div className="prose prose-invert prose-sm max-w-none flex-1">
                      {msg.content}
                    </div>
                    <div className="flex gap-1 shrink-0 mt-1">
                      {msg.role === 'user' && (
                        <button 
                          onClick={() => startEditing(msg)}
                          className="p-1 rounded-full opacity-0 group-hover:opacity-100 hover:bg-white/10 text-white/70 transition-all"
                          title="Edit prompt"
                        >
                          <Icons.Edit />
                        </button>
                      )}
                      {msg.role === 'assistant' && (
                        <button 
                          onClick={() => handleSpeak(msg)}
                          className={`p-1 rounded-full hover:bg-white/10 transition-colors ${isSpeakingId === msg.id ? 'text-blue-400 animate-pulse' : 'text-slate-400'}`}
                          title="Speak message"
                        >
                          <Icons.Speaker />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {msg.imageUrl && (
                    <div className="mt-2 rounded-xl overflow-hidden border border-white/10">
                      <img 
                        src={msg.imageUrl} 
                        alt="Generated" 
                        className="w-full h-auto object-cover hover:scale-105 transition-transform duration-500 cursor-pointer"
                        onClick={() => window.open(msg.imageUrl, '_blank')}
                      />
                    </div>
                  )}
                </div>
              )}
              
              {msg.sources && !editingId && (
                <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap gap-2">
                  {msg.sources.map((s, idx) => (
                    <a key={idx} href={s.uri} target="_blank" rel="noopener noreferrer" 
                       className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full hover:bg-white/20 transition-colors">
                      {s.title || 'Source'}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-slate-800/80 rounded-2xl rounded-tl-none px-4 py-3 flex gap-1 items-center">
              <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"></span>
              <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
              <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="p-4 bg-slate-900/50 border-t border-white/10">
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Tell me what's on your mind or ask me to generate an image..."
            className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-600/50 text-slate-100 placeholder-slate-500 resize-none min-h-[50px] max-h-[150px]"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="absolute right-2 bottom-2 p-2 rounded-lg bg-blue-600 text-white disabled:opacity-50 disabled:bg-slate-700 transition-all hover:bg-blue-500"
          >
            <Icons.Send />
          </button>
        </div>
      </div>
    </div>
  );
};
