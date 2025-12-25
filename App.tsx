import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, Headphones, XCircle, ChevronRight, RefreshCw, Trash2, AlertCircle } from 'lucide-react';
import { ConnectionStatus, SUPPORTED_LANGUAGES, SCENARIOS, Language, PracticeScenario, TranscriptionEntry } from './types';
import { decode, decodeAudioData, createPcmBlob } from './services/audioService';
import Avatar from './components/Avatar';
import AudioVisualizer from './components/AudioVisualizer';
import transcriptitem from './components/transcriptitem'; 

// מילון תרגום מקיף לממשק המשתמש (UI)
const uiTranslations: Record<string, any> = {
  'en-US': { title: 'LingoLive Pro', langPair: 'Language Pair', from: 'From', to: 'To', start: 'START SESSION', stop: 'STOP SESSION', feed: 'Live Feed', logs: 'Logs', scenarios: { simultaneous: 'LIVE TRANSLATE', translator: 'Ongoing Translation', casual: 'CHAT', learn: 'LEARN' } },
  'he-IL': { title: 'לינגו-לייב פרו', langPair: 'צמד שפות', from: 'מ-', to: 'ל-', start: 'התחל שיחה', stop: 'עצור שיחה', feed: 'תמלול חי', logs: 'לוגים', scenarios: { simultaneous: 'תרגום חי', translator: 'תרגום רציף', casual: 'צ׳אט', learn: 'למידה' } },
  'ar-XA': { title: 'لينغو لايف برو', langPair: 'زوج اللغات', from: 'من', to: 'إلى', start: 'بدء الجلسة', stop: 'إيقاف الجلسة', feed: 'البث المباشر', logs: 'سجلات', scenarios: { simultaneous: 'ترجمة فورية', translator: 'ترجمة مستمرة', casual: 'דרדשה', learn: 'تعلم' } },
  'fr-FR': { title: 'LingoLive Pro', langPair: 'Paire de langues', from: 'De', to: 'À', start: 'DÉMARRER', stop: 'ARRÊTER', feed: 'Flux en direct', logs: 'Logs', scenarios: { simultaneous: 'TRADUCTION LIVE', translator: 'Traduction Continue', casual: 'CHAT', learn: 'APPRENDRE' } },
  'de-DE': { title: 'LingoLive Pro', langPair: 'Sprachpaar', from: 'Von', to: 'Nach', start: 'STARTEN', stop: 'STOPPEN', feed: 'Live-Feed', logs: 'Protokolle', scenarios: { simultaneous: 'LIVE-ÜBERSETZUNG', translator: 'Laufende Übersetzung', casual: 'CHAT', learn: 'LERNEN' } },
  'es-ES': { title: 'LingoLive Pro', langPair: 'Par de idiomas', from: 'De', to: 'A', start: 'INICIAR', stop: 'DETENER', feed: 'Transmisión en vivo', logs: 'Registros', scenarios: { simultaneous: 'TRADUCCIÓN EN VIVO', translator: 'Traducción Continua', casual: 'CHAT', learn: 'APRENDER' } },
  'ru-RU': { title: 'LingoLive Pro', langPair: 'Языковая пара', from: 'Из', to: 'В', start: 'НАЧАТЬ', stop: 'СТОП', feed: 'Живой эфир', logs: 'Логи', scenarios: { simultaneous: 'ЖИВОЙ ПЕРЕВОД', translator: 'Постоянный перевод', casual: 'ЧАТ', learn: 'УЧИТЬСЯ' } },
  'zh-CN': { title: 'LingoLive 专业版', langPair: '语言配对', from: '从', to: '到', start: '开始会话', stop: '停止会话', feed: '实时馈送', logs: '日志', scenarios: { simultaneous: '实时翻译', translator: '持续翻译', casual: '聊天', learn: '学习' } },
  'ja-JP': { title: 'LingoLive プロ', langPair: '言語ペア', from: 'から', to: 'まで', start: 'セッション開始', stop: 'セッション停止', feed: 'ライブフィード', logs: 'ログ', scenarios: { simultaneous: 'ライブ翻訳', translator: '継続的な翻訳', casual: 'チャット', learn: '学習' } },
  'ko-KR': { title: 'LingoLive 프로', langPair: '언어 쌍', from: '에서', to: '으로', start: '세션 시작', stop: '세션 중지', feed: '라이브 피드', logs: '기록', scenarios: { simultaneous: '실시간 번역', translator: '지속적인 번역', casual: '채팅', learn: '학습' } },
  'it-IT': { title: 'LingoLive Pro', langPair: 'Coppia di lingue', from: 'Da', to: 'A', start: 'AVVIA', stop: 'FERMA', feed: 'Feed dal vivo', logs: 'Log', scenarios: { simultaneous: 'TRADUZIONE LIVE', translator: 'Traduzione Continua', casual: 'CHAT', learn: 'IMPARA' } },
  'pt-BR': { title: 'LingoLive Pro', langPair: 'Par de idiomas', from: 'De', to: 'Para', start: 'INICIAR', stop: 'PARAR', feed: 'Feed ao vivo', logs: 'Logs', scenarios: { simultaneous: 'TRADUÇÃO AO VIVO', translator: 'Tradução Contínua', casual: 'CHAT', learn: 'APRENDER' } },
  'hi-IN': { title: 'लिंगोलाइव प्रो', langPair: 'भाषा जोड़ी', from: 'से', to: 'तक', start: 'सत्र शुरू करें', stop: 'सत्र रोकें', feed: 'लाइव फीड', logs: 'लॉग', scenarios: { simultaneous: 'लाइव अनुवाद', translator: 'निरंतर अनुवाद', casual: 'चैट', learn: 'सीखें' } }
};

const App: React.FC = () => {
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [targetLang, setTargetLang] = useState<Language>(SUPPORTED_LANGUAGES[0]);
  const [nativeLang, setNativeLang] = useState<Language>(SUPPORTED_LANGUAGES[1]);
  const [selectedScenario, setSelectedScenario] = useState<PracticeScenario>(SCENARIOS[0]);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptionEntry[]>([]);
  const [interimUserText, setInterimUserText] = useState('');
  const [interimModelText, setInterimModelText] = useState('');

  const ui = uiTranslations[nativeLang.code] || uiTranslations['en-US'];
  const isRTL = nativeLang.code === 'he-IL' || nativeLang.code === 'ar-XA';

  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const isMutedRef = useRef(isMuted);
  const currentInputTranscription = useRef('');
  const currentOutputTranscription = useRef('');

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, interimUserText, interimModelText]);

  useEffect(() => {
    const checkKey = () => {
      const apiKey = import.meta.env.VITE_API_KEY;
      if (apiKey && apiKey.length > 5) setHasKey(true);
      else setHasKey(false);
    };
    checkKey();
  }, []);

  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const activeSessionRef = useRef<any>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  const stopConversation = useCallback(() => {
    if (activeSessionRef.current) {
      try { activeSessionRef.current.close(); } catch (e) {}
      activeSessionRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }
    sourcesRef.current.forEach(source => { try { source.stop(); } catch (e) {} });
    sourcesRef.current.clear();
    setStatus(ConnectionStatus.DISCONNECTED);
    setIsSpeaking(false);
    nextStartTimeRef.current = 0;
    setInterimUserText('');
    setInterimModelText('');
    currentInputTranscription.current = '';
    currentOutputTranscription.current = '';
  }, []);

  const startConversation = async () => {
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey) return;

    try {
      setError(null);
      setStatus(ConnectionStatus.CONNECTING);
      const ai = new GoogleGenAI({ apiKey });
      
      if (!inputAudioContextRef.current) inputAudioContextRef.current = new AudioContext({ sampleRate: 16000 });
      if (!outputAudioContextRef.current) outputAudioContextRef.current = new AudioContext({ sampleRate: 24000 });

      await inputAudioContextRef.current.resume();
      await outputAudioContextRef.current.resume();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      
      const outputCtx = outputAudioContextRef.current;
      const outputNode = outputCtx.createGain();
      outputNode.connect(outputCtx.destination);

      let systemInstruction = `
        STRICT OPERATING MODE: SIMULTANEOUS INTERPRETER.
        SOURCE LANGUAGE: ${nativeLang.name}
        TARGET LANGUAGE: ${targetLang.name}
        
        DIRECTIONS:
        1. Translate immediately when you hear speech. 
        2. DO NOT wait for pauses. Translate in real-time chunks.
        3. If you hear ${nativeLang.name}, speak ${targetLang.name}.
        4. If you hear ${targetLang.name}, speak ${nativeLang.name}.
        5. Output ONLY the translation. No meta-talk.
      `;

      if (selectedScenario.id === 'casual') systemInstruction = `Conversational partner in ${targetLang.name}.`;
      if (selectedScenario.id === 'learn') systemInstruction = `Language tutor for ${targetLang.name}. Correct my mistakes.`;
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.0-flash-exp',
        callbacks: {
          onopen: () => {
            setStatus(ConnectionStatus.CONNECTED);
            const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0).slice();
              const pcmBlob = createPcmBlob(inputData);
              sessionPromise.then(s => { if (!isMutedRef.current && s) s.sendRealtimeInput({ media: pcmBlob }); });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContextRef.current!.destination);
          },
          onmessage: async (m: LiveServerMessage) => {
            if (m.serverContent?.inputTranscription) {
              currentInputTranscription.current += m.serverContent.inputTranscription.text;
              setInterimUserText(currentInputTranscription.current);
            }
            if (m.serverContent?.outputTranscription) {
              currentOutputTranscription.current += m.serverContent.outputTranscription.text;
              setInterimModelText(currentOutputTranscription.current);
            }
            if (m.serverContent?.turnComplete) {
              setTranscript(prev => {
                const newEntries: TranscriptionEntry[] = [...prev];
                if (currentInputTranscription.current) newEntries.push({ role: 'user', text: currentInputTranscription.current, timestamp: new Date() });
                if (currentOutputTranscription.current) newEntries.push({ role: 'model', text: currentOutputTranscription.current, timestamp: new Date() });
                return newEntries;
              });
              currentInputTranscription.current = '';
              currentOutputTranscription.current = '';
              setInterimUserText('');
              setInterimModelText('');
            }
            const audioData = m.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
              setIsSpeaking(true);
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              const buffer = await decodeAudioData(decode(audioData), outputCtx, 24000, 1);
              const source = outputCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(outputNode);
              source.onended = () => { sourcesRef.current.delete(source); if (sourcesRef.current.size === 0) setIsSpeaking(false); };
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }
          },
          onerror: () => { setError('Connection Error'); stopConversation(); },
          onclose: () => setStatus(ConnectionStatus.DISCONNECTED)
        },
        config: { 
          responseModalities: [Modality.AUDIO], 
          systemInstruction,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } }
        }
      });
      activeSessionRef.current = await sessionPromise;
    } catch (e: any) { setError('Connection failed.'); setStatus(ConnectionStatus.ERROR); }
  };

  if (hasKey === null) return <div className="h-screen bg-slate-950 flex items-center justify-center"><div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className={`h-screen bg-slate-950 flex flex-col text-slate-200 overflow-hidden font-['Inter'] safe-area-inset ${isRTL ? 'rtl text-right' : 'ltr text-left'}`}>
      <header className="p-4 flex items-center justify-between bg-slate-900/60 border-b border-white/5 backdrop-blur-2xl shrink-0 z-50">
        <div className="flex items-center gap-3">
           <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center"><Headphones size={20} /></div>
           <div className="flex flex-col">
             <div className="flex items-center gap-2">
               <span className="font-black text-sm uppercase text-white">{ui.title}</span>
               <span className="text-[8px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded font-bold">v1.2.0</span>
             </div>
             <span className={`text-[10px] font-black uppercase ${status === 'CONNECTED' ? 'text-emerald-400' : 'text-slate-400'}`}>{status}</span>
           </div>
        </div>
        <div className="flex items-center gap-2">
           <button onClick={() => setTranscript([])} className="p-2.5 text-slate-500 hover:text-white transition-colors"><Trash2 size={18} /></button>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="w-full md:w-[450px] flex flex-col p-6 gap-6 bg-slate-900/30 border-r border-white/5 overflow-y-auto scrollbar-thin">
          <div className="w-full bg-slate-900/90 rounded-[2rem] border border-white/10 p-5 flex flex-col gap-4 shadow-xl">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">{ui.langPair}</label>
              <div className="flex items-center gap-2 bg-slate-800/40 p-2 rounded-[1.5rem]">
                <div className="flex flex-col flex-1 overflow-hidden">
                  <span className="text-[8px] text-center text-slate-400 font-black mb-1 uppercase">{ui.from}</span>
                  <select value={nativeLang.code} onChange={e => setNativeLang(SUPPORTED_LANGUAGES.find(l => l.code === e.target.value)!)} className="bg-slate-900 border-none rounded-xl py-2 text-sm font-bold text-center outline-none w-full">
                    {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
                  </select>
                </div>
                <ChevronRight size={16} className={`text-indigo-500 ${isRTL ? 'rotate-180' : ''}`} />
                <div className="flex flex-col flex-1 overflow-hidden">
                  <span className="text-[8px] text-center text-slate-400 font-black mb-1 uppercase">{ui.to}</span>
                  <select value={targetLang.code} onChange={e => setTargetLang(SUPPORTED_LANGUAGES.find(l => l.code === e.target.value)!)} className="bg-slate-900 border-none rounded-xl py-2 text-sm font-bold text-center outline-none w-full">
                    {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              {SCENARIOS.map(s => {
                const isTranslator = s.id === 'translator';
                return (
                  <button key={s.id} onClick={() => setSelectedScenario(s)} className={`py-6 px-2 rounded-2xl flex flex-col items-center gap-1 transition-all ${selectedScenario.id === s.id ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-800/40 text-slate-500'}`}>
                    <span className="text-2xl">{s.icon}</span>
                    <span className={`font-black uppercase tracking-tighter text-center leading-tight ${isTranslator ? 'text-sm' : 'text-[10px]'}`}>
                      {isTranslator ? "Ongoing Translation" : ui.scenarios[s.id as keyof typeof ui.scenarios] || s.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-6 py-4">
            <Avatar state={status !== ConnectionStatus.CONNECTED ? 'idle' : isSpeaking ? 'speaking' : isMuted ? 'thinking' : 'listening'} />
            <button onClick={status === ConnectionStatus.CONNECTED ? stopConversation : startConversation} className="bg-indigo-600 px-10 py-5 rounded-full font-black flex items-center gap-3 text-lg shadow-2xl hover:bg-indigo-500">
              <Mic size={24} /> {status === ConnectionStatus.CONNECTED ? ui.stop : ui.start}
            </button>
            {(isSpeaking || (status === ConnectionStatus.CONNECTED && !isMuted)) && <AudioVisualizer isActive={true} color={isSpeaking ? "#6366f1" : "#10b981"} />}
          </div>
        </div>

        <div className="flex-1 flex flex-col bg-slate-950 p-4 md:p-8 overflow-hidden">
          <div className="flex items-center justify-between mb-4 px-2">
            <h3 className="text-sm font-black text-slate-500 uppercase tracking-[0.2em]">{ui.feed}</h3>
            <span className="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-400 font-bold">{transcript.length} {ui.logs}</span>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin flex flex-col gap-2 pr-2">
            {transcript.map((entry, idx) => <transcriptitem key={idx} entry={entry} />)}
            {interimUserText && <transcriptitem entry={{role: 'user', text: interimUserText, timestamp: new Date()}} />}
            {interimModelText && <transcriptitem entry={{role: 'model', text: interimModelText, timestamp: new Date()}} />}
            <div ref={transcriptEndRef} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
