import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, Headphones, XCircle, ChevronRight, RefreshCw, Trash2, AlertCircle } from 'lucide-react';
import { ConnectionStatus, SUPPORTED_LANGUAGES, SCENARIOS, Language, PracticeScenario, TranscriptionEntry } from './types';
import { decode, decodeAudioData, createPcmBlob } from './services/audioService';
import Avatar from './components/Avatar';
import AudioVisualizer from './components/AudioVisualizer';
import transcriptitem from './components/transcriptitem'; 

const uiTranslations: Record<string, any> = {
  'en-US': { title: 'LingoLive Pro', native: 'Native Language', target: 'Translation/Learning', start: 'START', stop: 'STOP', feed: 'Live Feed', logs: 'Logs', scenarios: { simultaneous: 'LIVE TRANSLATE', translator: 'Simultaneous Translation', casual: 'CHAT', learn: 'LEARN' } },
  'he-IL': { title: 'לינגו-לייב פרו', native: 'שפת אם', target: 'שפת תרגום/למידה', start: 'התחל', stop: 'עצור', feed: 'תמלול חי', logs: 'לוגים', scenarios: { simultaneous: 'LIVE TRANSLATE', translator: 'תרגום סימולטני', casual: 'צ׳אט', learn: 'למידה' } },
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
    setInterimUserText('');
    setInterimModelText('');
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

      // הגדרת לוגיקה מחמירה לפי המודול שנבחר
      let sysInst = "";
      
      if (selectedScenario.id === 'simultaneous') {
        // LIVE TRANSLATE - שיחת 2 אנשים
        sysInst = `You are a conversation interpreter between ${nativeLang.name} and ${targetLang.name}. 
        When you hear ${nativeLang.name}, translate to ${targetLang.name}. 
        When you hear ${targetLang.name}, translate to ${nativeLang.name}. 
        Wait for a sentence to finish, then translate. Speak only the translation.`;
      } else if (selectedScenario.id === 'translator') {
        // SIMULTANEOUS TRANSLATION - הרצאות/נאומים
        sysInst = `You are a high-speed simultaneous interpreter for a lecture. 
        Listen to the speech and translate it INSTANTLY and CONTINUOUSLY into ${nativeLang.name}. 
        Do not wait for pauses. Start immediately and don't stop. Output ONLY translation.`;
      } else if (selectedScenario.id === 'casual') {
        // CHAT
        sysInst = `Act as a friendly chat partner. Speak ONLY in ${targetLang.name}. Do not translate or correct me.`;
      } else if (selectedScenario.id === 'learn') {
        // LEARN
        sysInst = `Act as a language tutor. Speak in ${targetLang.name}. After every response, provide a short grammar correction and pronunciation tip in brackets [].`;
      }

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.0-flash-exp',
        callbacks: {
          onopen: () => {
            setStatus(ConnectionStatus.CONNECTED);
            const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(2048, 1, 1);
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
            if (m.serverContent?.inputTranscription) setInterimUserText(prev => prev + m.serverContent!.inputTranscription!.text);
            if (m.serverContent?.outputTranscription) setInterimModelText(prev => prev + m.serverContent!.outputTranscription!.text);
            
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
          onerror: () => { setError('Error'); stopConversation(); },
          onclose: () => setStatus(ConnectionStatus.DISCONNECTED)
        },
        config: { 
          responseModalities: [Modality.AUDIO], 
          systemInstruction: sysInst,
          generationConfig: { temperature: 0.4 },
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } }
        }
      });
      activeSessionRef.current = await sessionPromise;
    } catch (e) { setError('Failed'); setStatus(ConnectionStatus.ERROR); }
  };

  if (hasKey === null) return <div className="h-screen bg-slate-950 flex items-center justify-center"><div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className={`h-screen bg-slate-950 flex flex-col text-slate-200 overflow-hidden ${isRTL ? 'rtl text-right' : 'ltr text-left'}`}>
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
        <div className="w-full md:w-[450px] flex flex-col p-6 gap-6 bg-slate-900/30 border-r border-white/5 overflow-y-auto scrollbar-thin">
          <div className="w-full bg-slate-900/90 rounded-[2rem] border border-white/10 p-5 flex flex-col gap-4 shadow-xl">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 bg-slate-800/40 p-2 rounded-[1.5rem]">
                <div className="flex-1 text-center">
                  <label className="text-[10px] font-black uppercase text-indigo-400 block mb-1">{ui.native}</label>
                  <select value={nativeLang.code} onChange={e => setNativeLang(SUPPORTED_LANGUAGES.find(l => l.code === e.target.value)!)} className="bg-slate-900 border-none rounded-xl py-2 text-sm font-bold text-center outline-none w-full">
                    {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
                  </select>
                </div>
                <ChevronRight size={16} className={`text-indigo-500 mt-4 ${isRTL ? 'rotate-180' : ''}`} />
                <div className="flex-1 text-center">
                   <label className="text-[10px] font-black uppercase text-indigo-400 block mb-1">{ui.target}</label>
                  <select value={targetLang.code} onChange={e => setTargetLang(SUPPORTED_LANGUAGES.find(l => l.code === e.target.value)!)} className="bg-slate-900 border-none rounded-xl py-2 text-sm font-bold text-center outline-none w-full">
                    {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {SCENARIOS.map(s => {
                const label = ui.scenarios[s.id as keyof typeof ui.scenarios] || s.title;
                return (
                  <button key={s.id} onClick={() => setSelectedScenario(s)} className={`py-6 px-2 rounded-2xl flex flex-col items-center gap-2 transition-all ${selectedScenario.id === s.id ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-800/40 text-slate-500'}`}>
                    <span className="text-3xl">{s.icon}</span>
                    <span className="font-black uppercase tracking-tighter text-center leading-tight text-base">
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-6 py-4">
            <Avatar state={status !== ConnectionStatus.CONNECTED ? 'idle' : isSpeaking ? 'speaking' : isMuted ? 'thinking' : 'listening'} />
            <button onClick={status === ConnectionStatus.CONNECTED ? stopConversation : startConversation} className="bg-indigo-600 px-10 py-5 rounded-full font-black text-xl shadow-xl flex items-center gap-3 hover:bg-indigo-500 transition-all">
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
