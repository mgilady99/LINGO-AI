import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, Headphones, XCircle, ChevronRight, RefreshCw, Trash2, AlertCircle } from 'lucide-react';
import { ConnectionStatus, SUPPORTED_LANGUAGES, SCENARIOS, Language, PracticeScenario, TranscriptionEntry } from './types';
import { decode, decodeAudioData, createPcmBlob } from './services/audioService';
import Avatar from './components/Avatar';
import AudioVisualizer from './components/AudioVisualizer';
import transcriptitem from './components/transcriptitem'; 

// מילון תרגום דינמי לכל השפות הנתמכות
const getLocalizedUI = (langCode: string) => {
  const dicts: Record<string, any> = {
    'en-US': { title: 'LingoLive Pro', pair: 'Language Pair', from: 'From', to: 'To', start: 'START', stop: 'STOP', feed: 'Live Feed', logs: 'Logs', ongoing: 'Ongoing Translation' },
    'he-IL': { title: 'לינגו-לייב פרו', pair: 'צמד שפות', from: 'מ-', to: 'ל-', start: 'התחל', stop: 'עצור', feed: 'תמלול חי', logs: 'לוגים', ongoing: 'תרגום רציף' },
    'es-ES': { title: 'LingoLive Pro', pair: 'Par de idiomas', from: 'De', to: 'A', start: 'INICIAR', stop: 'PARAR', feed: 'Traducción', logs: 'Logs', ongoing: 'Traducción continua' },
    'fr-FR': { title: 'LingoLive Pro', pair: 'Paire de langues', from: 'De', to: 'À', start: 'DÉMARRER', stop: 'ARRÊTER', feed: 'Direct', logs: 'Logs', ongoing: 'Traduction continue' },
    'de-DE': { title: 'LingoLive Pro', pair: 'Sprachpaar', from: 'Von', to: 'Nach', start: 'STARTEN', stop: 'STOPPEN', feed: 'Live-Feed', logs: 'Logs', ongoing: 'Laufende Übersetzung' },
    'ar-XA': { title: 'لينغو لايف برو', pair: 'زوج اللغات', from: 'من', to: 'إلى', start: 'بدء', stop: 'إيقاف', feed: 'البث المباشر', logs: 'سجلات', ongoing: 'ترجمة مستمرة' },
    'zh-CN': { title: 'LingoLive 专业版', pair: '语言配对', from: '从', to: '到', start: '开始', stop: '停止', feed: '实时流', logs: '日志', ongoing: '持续翻译' },
    'ja-JP': { title: 'LingoLive プロ', pair: '言語ペア', from: 'から', to: 'まで', start: '開始', stop: '停止', feed: 'ライブ', logs: 'ログ', ongoing: '継続翻訳' },
    'ko-KR': { title: 'LingoLive 프로', pair: '언어 쌍', from: '에서', to: '으로', start: '시작', stop: '중지', feed: '라이브 피드', logs: '기록', ongoing: '지속적인 번역' },
    'it-IT': { title: 'LingoLive Pro', pair: 'Coppia di lingue', from: 'Da', to: 'A', start: 'AVVIA', stop: 'FERMA', feed: 'Live Feed', logs: 'Log', ongoing: 'Traduzione continua' },
    'pt-BR': { title: 'LingoLive Pro', pair: 'Par de idiomas', from: 'De', to: 'Para', start: 'INICIAR', stop: 'PARAR', feed: 'Feed ao vivo', logs: 'Logs', ongoing: 'Tradução contínua' },
    'hi-IN': { title: 'लिंगोलाइव प्रो', pair: 'भाषा जोड़ी', from: 'से', to: 'तक', start: 'शुरू करें', stop: 'बंद करें', feed: 'लाइव फीड', logs: 'लॉग', ongoing: 'निरंतर अनुवाद' }
  };
  return dicts[langCode] || dicts['en-US'];
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

  const ui = getLocalizedUI(nativeLang.code);
  const isRTL = nativeLang.code === 'he-IL' || nativeLang.code === 'ar-XA';

  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const activeSessionRef = useRef<any>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef(0);

  useEffect(() => { transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [transcript, interimUserText, interimModelText]);

  useEffect(() => {
    const checkKey = () => {
      const apiKey = import.meta.env.VITE_API_KEY;
      setHasKey(!!(apiKey && apiKey.length > 5));
    };
    checkKey();
  }, []);

  const stopConversation = useCallback(() => {
    if (activeSessionRef.current) { try { activeSessionRef.current.close(); } catch (e) {} activeSessionRef.current = null; }
    if (micStreamRef.current) { micStreamRef.current.getTracks().forEach(t => t.stop()); micStreamRef.current = null; }
    sourcesRef.current.forEach(s => { try { s.stop(); } catch (e) {} });
    sourcesRef.current.clear();
    setStatus(ConnectionStatus.DISCONNECTED);
    setIsSpeaking(false);
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

      // הנחיות תרגום דו-כיווניות קשיחות
      let sysInst = `
        STRICT SIMULTANEOUS INTERPRETER MODE.
        LANGUAGES: ${nativeLang.name} <-> ${targetLang.name}.
        1. If you hear ${nativeLang.name}, translate to ${targetLang.name}.
        2. If you hear ${targetLang.name}, translate to ${nativeLang.name}.
        3. Never repeat the source language.
        4. Translate immediately in real-time.
      `;
      
      if (selectedScenario.id === 'casual') sysInst = `Chat in ${targetLang.name} only.`;
      if (selectedScenario.id === 'learn') sysInst = `Tutor in ${targetLang.name}. Correct my grammar/pronunciation in brackets.`;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.0-flash-exp',
        callbacks: {
          onopen: () => {
            setStatus(ConnectionStatus.CONNECTED);
            const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0).slice();
              if (!isMuted && activeSessionRef.current) {
                activeSessionRef.current.sendRealtimeInput({ media: createPcmBlob(inputData) });
              }
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContextRef.current!.destination);
          },
          onmessage: async (m: LiveServerMessage) => {
            if (m.serverContent?.inputTranscription) {
              setInterimUserText(prev => prev + m.serverContent!.inputTranscription!.text);
            }
            if (m.serverContent?.outputTranscription) {
              setInterimModelText(prev => prev + m.serverContent!.outputTranscription!.text);
            }
            if (m.serverContent?.turnComplete) {
              setTranscript(prev => [...prev, { role: 'user', text: interimUserText, timestamp: new Date() }, { role: 'model', text: interimModelText, timestamp: new Date() }]);
              setInterimUserText(''); setInterimModelText('');
            }
            const audioData = m.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
              setIsSpeaking(true);
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              const buffer = await decodeAudioData(decode(audioData), outputCtx, 24000, 1);
              const source = outputCtx.createBufferSource();
              source.buffer = buffer; source.connect(outputNode);
              source.onended = () => { sourcesRef.current.delete(source); if (sourcesRef.current.size === 0) setIsSpeaking(false); };
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }
          },
          onerror: (e) => { setError('Connection failed'); stopConversation(); },
          onclose: () => setStatus(ConnectionStatus.DISCONNECTED)
        },
        config: { 
          responseModalities: [Modality.AUDIO], 
          systemInstruction: sysInst,
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } } // קול נשי צעיר
        }
      });
      activeSessionRef.current = await sessionPromise;
    } catch (e) { setError('Failed to start.'); setStatus(ConnectionStatus.ERROR); }
  };

  if (hasKey === null) return <div className="h-screen bg-slate-950 flex items-center justify-center"><div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className={`h-screen bg-slate-950 flex flex-col text-slate-200 overflow-hidden ${isRTL ? 'rtl' : 'ltr'}`}>
      <header className="p-4 flex items-center justify-between bg-slate-900/60 border-b border-white/5 backdrop-blur-2xl z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg"><Headphones size={20} /></div>
          <div className="flex flex-col">
            <span className="font-black text-sm uppercase">{ui.title}</span>
            <span className={`text-[10px] font-black uppercase ${status === 'CONNECTED' ? 'text-emerald-400' : 'text-slate-400'}`}>{status}</span>
          </div>
        </div>
        <button onClick={() => setTranscript([])} className="p-2 text-slate-500 hover:text-white"><Trash2 size={18} /></button>
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="w-full md:w-[450px] flex flex-col p-6 gap-6 bg-slate-900/30 border-r border-white/5 overflow-y-auto">
          <div className="w-full bg-slate-900/90 rounded-[2rem] border border-white/10 p-5 flex flex-col gap-4 shadow-xl">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black uppercase text-slate-500 px-1">{ui.pair}</label>
              <div className="flex items-center gap-2 bg-slate-800/40 p-2 rounded-[1.5rem]">
                <div className="flex-1 text-center">
                  <span className="text-[9px] font-black text-slate-400 block">{ui.from}</span>
                  <select value={nativeLang.code} onChange={e => setNativeLang(SUPPORTED_LANGUAGES.find(l => l.code === e.target.value)!)} className="bg-transparent border-none font-bold text-sm outline-none w-full text-center">
                    {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
                  </select>
                </div>
                <ChevronRight size={16} className={`text-indigo-500 ${isRTL ? 'rotate-180' : ''}`} />
                <div className="flex-1 text-center">
                  <span className="text-[9px] font-black text-slate-400 block">{ui.to}</span>
                  <select value={targetLang.code} onChange={e => setTargetLang(SUPPORTED_LANGUAGES.find(l => l.code === e.target.value)!)} className="bg-transparent border-none font-bold text-sm outline-none w-full text-center">
                    {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {SCENARIOS.map(s => (
                <button key={s.id} onClick={() => setSelectedScenario(s)} className={`py-5 px-2 rounded-2xl flex flex-col items-center gap-2 transition-all ${selectedScenario.id === s.id ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-800/40 text-slate-500'}`}>
                  <span className="text-xl">{s.icon}</span>
                  <span className="font-black uppercase tracking-tighter text-center leading-none text-sm">
                    {s.id === 'translator' ? ui.ongoing : ui.scenarios?.[s.id] || s.title}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-6">
            <Avatar state={status !== ConnectionStatus.CONNECTED ? 'idle' : isSpeaking ? 'speaking' : isMuted ? 'thinking' : 'listening'} />
            <button onClick={status === ConnectionStatus.CONNECTED ? stopConversation : startConversation} className="bg-indigo-600 px-10 py-5 rounded-full font-black text-lg shadow-xl flex items-center gap-3 hover:bg-indigo-500 transition-all">
              <Mic size={24} /> {status === ConnectionStatus.CONNECTED ? ui.stop : ui.start}
            </button>
            {(isSpeaking || (status === ConnectionStatus.CONNECTED && !isMuted)) && <AudioVisualizer isActive={true} color={isSpeaking ? "#6366f1" : "#10b981"} />}
          </div>
        </div>

        <div className="flex-1 flex flex-col bg-slate-950 p-4 md:p-8 overflow-hidden">
          <div className="flex items-center justify-between mb-4 px-2">
            <h3 className="text-sm font-black uppercase text-slate-500">{ui.feed}</h3>
            <span className="text-[10px] font-black bg-slate-800 px-2 py-1 rounded text-slate-400">{transcript.length} {ui.logs}</span>
          </div>
          <div className="flex-1 overflow-y-auto flex flex-col gap-2">
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
