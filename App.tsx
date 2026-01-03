
import React, { useState, useEffect } from 'react';
import { VoiceSession } from './components/VoiceSession';
import { ChatInterface } from './components/ChatInterface';
import { AudioTranscriber } from './components/AudioTranscriber';
import { Icons } from './constants';

const App: React.FC = () => {
  const [showVoiceSession, setShowVoiceSession] = useState(false);
  const [hasKey, setHasKey] = useState<boolean>(true);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected);
      }
    };
    checkKey();
  }, []);

  const handleOpenKeySelector = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasKey(true);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center bg-slate-950 text-slate-100 pb-12">
      
      {/* Hero Section */}
      <header className="w-full max-w-6xl px-6 py-12 flex flex-col md:flex-row items-center justify-between gap-12">
        <div className="flex-1 space-y-6">
          <div className="flex justify-between items-start">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium">
              <Icons.Sparkle />
              <span>AI powered friendship</span>
            </div>
            {!hasKey && (
              <button 
                onClick={handleOpenKeySelector}
                className="flex items-center gap-2 text-xs text-orange-400 hover:text-orange-300 transition-colors"
              >
                <Icons.Key /> Setup Required
              </button>
            )}
          </div>
          <h1 className="text-5xl md:text-7xl font-outfit font-extrabold tracking-tight">
            Soulmate <span className="gradient-text">AI</span>
          </h1>
          <p className="text-xl text-slate-400 max-w-xl leading-relaxed">
            Your personal digital companion that listens, thinks, and grows with you. Available for real-time voice chat and deep thoughtful conversations.
          </p>
          <div className="flex flex-wrap gap-4 pt-4">
            <button
              onClick={() => setShowVoiceSession(true)}
              className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold text-lg shadow-xl shadow-blue-600/20 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-3"
            >
              <Icons.Mic /> Talk to Sam
            </button>
            <a href="#chat-section" className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold text-lg border border-white/5 transition-all">
              Text Chat
            </a>
          </div>
        </div>

        <div className="hidden lg:block relative flex-1 h-[400px]">
           <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-[100px] animate-pulse"></div>
           <div className="relative h-full w-full flex items-center justify-center">
             <div className="w-64 h-64 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-[40px] rotate-12 flex items-center justify-center shadow-2xl">
                <div className="scale-[3] text-white">
                  <Icons.Sparkle />
                </div>
             </div>
           </div>
        </div>
      </header>

      {/* Main Content Sections */}
      <main id="chat-section" className="w-full max-w-6xl px-6 grid grid-cols-1 lg:grid-cols-3 gap-8 pt-12">
        
        {/* Chat Tool */}
        <div className="lg:col-span-2">
           <ChatInterface />
        </div>

        {/* Sidebar Tools */}
        <div className="space-y-8">
          <AudioTranscriber />
          
          <div className="glass-panel rounded-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-lg font-bold">Capabilities</h4>
              {!hasKey && (
                <button onClick={handleOpenKeySelector} title="Select API Key" className="text-orange-400">
                  <Icons.Key />
                </button>
              )}
            </div>
            <ul className="space-y-4">
              <li className="flex gap-3">
                <div className="text-blue-400"><Icons.Brain /></div>
                <div>
                  <p className="font-medium">Deep Thinking</p>
                  <p className="text-xs text-slate-500">Complex logic and problem solving with gemini-3-pro.</p>
                </div>
              </li>
              <li className="flex gap-3">
                <div className="text-purple-400"><Icons.Search /></div>
                <div>
                  <p className="font-medium">Search Grounding</p>
                  <p className="text-xs text-slate-500">Real-time web access for up-to-date facts.</p>
                </div>
              </li>
              <li className="flex gap-3">
                <div className="text-orange-400"><Icons.Bolt /></div>
                <div>
                  <p className="font-medium">Instant Response</p>
                  <p className="text-xs text-slate-500">Optimized for low-latency conversations.</p>
                </div>
              </li>
            </ul>
          </div>
          
          {!hasKey && (
            <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-300 text-sm">
              <p className="flex items-center gap-2 mb-2 font-bold">
                <Icons.Key /> Action Needed
              </p>
              <p className="mb-3">To use high-quality models and real-time voice, please select a paid Google Cloud project API key.</p>
              <button 
                onClick={handleOpenKeySelector}
                className="w-full py-2 bg-orange-500 text-white rounded-lg font-bold hover:bg-orange-400 transition-colors"
              >
                Connect API Key
              </button>
              <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="block text-center mt-2 text-[10px] underline">
                Learn about billing
              </a>
            </div>
          )}
        </div>

      </main>

      {/* Voice Overlay */}
      {showVoiceSession && (
        <VoiceSession onClose={() => setShowVoiceSession(false)} />
      )}

      {/* Footer */}
      <footer className="mt-24 text-slate-600 text-sm">
        Soulmate AI &copy; {new Date().getFullYear()} • Powered by Gemini AI
      </footer>
    </div>
  );
};

export default App;
