
import React, { useState, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { MODELS, Icons } from '../constants';

export const AudioTranscriber: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await handleTranscription(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Recording error:', err);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const handleTranscription = async (blob: Blob) => {
    setIsLoading(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64data = (reader.result as string).split(',')[1];
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
          model: MODELS.TRANSCRIBE,
          contents: {
            parts: [
              { inlineData: { data: base64data, mimeType: 'audio/webm' } },
              { text: 'Please accurately transcribe this audio clip. Just return the text.' }
            ]
          }
        });
        setTranscription(response.text || 'No speech detected.');
      };
    } catch (err) {
      console.error('Transcription error:', err);
      setTranscription('Transcription failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Icons.Mic /> Audio Transcriber
        </h3>
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
            isRecording 
              ? 'bg-red-500/20 text-red-500 animate-pulse border border-red-500/50' 
              : 'bg-blue-600 text-white hover:bg-blue-500'
          }`}
        >
          {isRecording ? <><Icons.Stop /> Stop Recording</> : <><Icons.Mic /> Start Recording</>}
        </button>
      </div>

      <div className="bg-slate-950/50 border border-white/10 rounded-xl p-4 min-h-[100px] text-slate-300">
        {isLoading ? (
          <div className="flex items-center gap-2 text-slate-500">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></span>
            Transcribing...
          </div>
        ) : (
          transcription || "Recorded speech will appear here..."
        )}
      </div>
    </div>
  );
};
