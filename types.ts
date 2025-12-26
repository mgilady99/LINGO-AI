export interface Language {
  code: string;
  name: string;
  flag: string;
  voiceName: string;
}

export interface PracticeScenario {
  id: string;
  icon: string;
  title: string; // המפתח לתרגום
  systemInstruction: string; // ההוראה ל-AI
}

export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'he-IL', name: 'Hebrew', flag: '🇮🇱', voiceName: 'he-IL-HilaNeural' },
  { code: 'en-US', name: 'English', flag: '🇺🇸', voiceName: 'en-US-Journey-D' },
  { code: 'es-ES', name: 'Spanish', flag: '🇪🇸', voiceName: 'es-ES-ElviraNeural' },
  { code: 'fr-FR', name: 'French', flag: '🇫🇷', voiceName: 'fr-FR-DeniseNeural' },
  { code: 'de-DE', name: 'German', flag: '🇩🇪', voiceName: 'de-DE-KatjaNeural' },
  { code: 'it-IT', name: 'Italian', flag: '🇮🇹', voiceName: 'it-IT-ElsaNeural' },
  { code: 'pt-BR', name: 'Portuguese', flag: '🇧🇷', voiceName: 'pt-BR-FranciscaNeural' },
  { code: 'zh-CN', name: 'Chinese', flag: '🇨🇳', voiceName: 'zh-CN-XiaoxiaoNeural' },
  { code: 'ja-JP', name: 'Japanese', flag: '🇯🇵', voiceName: 'ja-JP-NanamiNeural' },
  { code: 'ko-KR', name: 'Korean', flag: '🇰🇷', voiceName: 'ko-KR-SunHiNeural' },
  { code: 'ru-RU', name: 'Russian', flag: '🇷🇺', voiceName: 'ru-RU-SvetlanaNeural' },
  { code: 'ar-SA', name: 'Arabic', flag: '🇸🇦', voiceName: 'ar-SA-ZariyahNeural' },
  { code: 'hi-IN', name: 'Hindi', flag: '🇮🇳', voiceName: 'hi-IN-SwaraNeural' },
  { code: 'nl-NL', name: 'Dutch', flag: '🇳🇱', voiceName: 'nl-NL-ColetteNeural' }
];

// --- הגדרת המודולים המדויקת לפי בקשתך ---
export const SCENARIOS: PracticeScenario[] = [
  { 
    id: 'live', 
    icon: '🎙️', 
    title: 'mode_live', 
    // הוראה: תרגום דו-כיווני מדויק, רק מה שנאמר, בלי תוספות
    systemInstruction: 'You are a precise bi-directional translator. Listen to the input. If it is in SOURCE_LANG, translate it exactly to TARGET_LANG. If it is in TARGET_LANG, translate it exactly to SOURCE_LANG. Speak ONLY the translation. Do NOT add pleasantries, explanations, or fillers. Do not be "smart". Just translate exactly what was said.' 
  },
  { 
    id: 'simul', 
    icon: '🎧', 
    title: 'mode_simul', 
    // הוראה: תרגום סימולטני מהיר, ללא השהיות
    systemInstruction: 'You are a simultaneous interpreter translating from SOURCE_LANG to TARGET_LANG. Your goal is SPEED. Translate the speech stream continuously and instantly. Do not wait for full sentences or pause to think. Output the translation in real-time, matching the speaker\'s pace.' 
  },
  { 
    id: 'chat', 
    icon: '💬', 
    title: 'mode_chat', 
    // הוראה: שיחה רגילה בשפת היעד (ללא תרגום)
    systemInstruction: 'You are a friendly conversation partner. Do NOT translate. Hold a natural conversation entirely in TARGET_LANG. Listen to what the user says and respond with relevant questions or comments to keep the chat going. Act like a human friend chatting.' 
  },
  { 
    id: 'learn', 
    icon: '🎓', 
    title: 'mode_learn', 
    // הוראה: לימוד ותיקון טעויות
    systemInstruction: 'You are a language teacher teaching TARGET_LANG. Converse with the user. When the user speaks, listen for mistakes. If they make a mistake, explicitly say: "The correct way to say that is..." and repeat their sentence correctly. Then continue the conversation.' 
  }
];
