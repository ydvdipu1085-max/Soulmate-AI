
export enum ChatMode {
  FAST = 'FAST', // gemini-2.5-flash-lite
  PRO = 'PRO', // gemini-3-pro-preview
  THINKING = 'THINKING', // gemini-3-pro-preview + thinkingBudget
  SEARCH = 'SEARCH', // gemini-3-flash-preview + googleSearch
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mode?: ChatMode;
  timestamp: number;
  sources?: { uri: string; title: string }[];
  isThinking?: boolean;
  imageUrl?: string;
}

export interface VoiceSessionState {
  isActive: boolean;
  isConnecting: boolean;
  error: string | null;
  userTranscription: string;
  aiTranscription: string;
}
