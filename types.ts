// src/types.ts
export interface Language { code: string; name: string; flag: string; }
export interface PracticeScenario { id: string; icon: string; title: string; systemInstruction: string; }
export enum ConnectionStatus { DISCONNECTED = 'disconnected', CONNECTING = 'connecting', CONNECTED = 'connected', }

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'he-IL', name: 'Hebrew', flag: '🇮🇱' },
  { code: 'en-US', name: 'English', flag: '🇺🇸' },
  { code: 'es-ES', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr-FR', name: 'French', flag: '🇫🇷' },
  { code: 'ar-SA', name: 'Arabic', flag: '🇸🇦' }
];

export const SCENARIOS: PracticeScenario[] = [
  { id: 'live', icon: '🎙️', title: 'mode_live', systemInstruction: 'Translate SOURCE_LANG to TARGET_LANG and vice-versa. Output ONLY translation.' },
  { id: 'simul', icon: '🎧', title: 'mode_simul', systemInstruction: 'Simultaneous interpreter. Translate fast from SOURCE_LANG to TARGET_LANG.' },
  { id: 'chat', icon: '💬', title: 'mode_chat', systemInstruction: 'Friendly chat in TARGET_LANG. Speak only target language.' },
  { id: 'learn', icon: '🎓', title: 'mode_learn', systemInstruction: 'Tutor for TARGET_LANG. Correct mistakes in SOURCE_LANG, then repeat in TARGET_LANG.' }
];
