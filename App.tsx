import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, Headphones, ChevronRight, Trash2, ExternalLink } from 'lucide-react';
import { ConnectionStatus, SUPPORTED_LANGUAGES, SCENARIOS, Language, PracticeScenario } from './types';
import { decode, decodeAudioData, createPcmBlob } from './services/audioService';
import Avatar from './components/Avatar';
import AudioVisualizer from './components/AudioVisualizer';
import Login from './components/Login';
import Pricing from './components/Pricing';

const App: React.FC = () => {
  // --- ניהול מצבי תצוגה ---
  const [view, setView] = useState<'LOGIN' | 'PRICING' | 'APP'>('LOGIN');
  const [userPlan, setUserPlan] = useState<string>('FREE');

  // --- לוגיקת האפליקציה ---
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [targetLang, setTargetLang] = useState<Language>(SUPPORTED_LANGUAGES[0]);
  const [nativeLang, setNativeLang] = useState<Language>(SUPPORTED_LANGUAGES[1]);
  const [selectedScenario, setSelectedScenario] = useState<PracticeScenario>(SCENARIOS[0]);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const activeSessionRef = useRef<any>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef(0);

  // פונקציות מעבר
  const handleLoginSuccess = () => setView('PRICING');
  const handlePlanSelect = (plan: string) => {
    setUserPlan(plan);
    setView('APP'); // מעבר וודאי לאפליקציה
  };

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
      setStatus(ConnectionStatus.CONNECTING);
      const ai = new GoogleGenAI({ apiKey });
      if (!inputAudioContextRef.current) inputAudioContextRef.current = new AudioContext({ sampleRate: 16000 });
      if (!outputAudioContextRef.current) outputAudioContextRef.current = new AudioContext({ sampleRate: 24000 });
      await inputAudioContextRef.current.resume(); await outputAudioContextRef.current.resume();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const outputCtx = outputAudioContextRef.current;
      const outputNode = outputCtx.createGain(); outputNode.connect(outputCtx.destination);

      const sysInst = `Act as an expert interpreter between ${nativeLang.name} and ${targetLang.name}. Be fast and accurate.`;
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.0-flash-exp',
        callbacks: {
          onopen: () => {
            setStatus(ConnectionStatus.CONNECTED);
            const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(2048, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0).slice();
              if (activeSessionRef.current) activeSessionRef.current.sendRealtimeInput({ media: createPcmBlob(inputData) });
            };
            source.connect(scriptProcessor); scriptProcessor.connect(inputAudioContextRef.current!.destination);
          },
          onmessage: async (m: LiveServerMessage) => {
            const audioData = m.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
              setIsSpeaking(true);
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              const buffer = await decodeAudioData(decode(audioData), outputCtx, 24000, 1);
              const source = outputCtx.createBufferSource();
              source.buffer = buffer; source.connect(outputNode);
              source.onended = () => { sourcesRef.current.delete(source); if (sourcesRef.current.size === 0) setIsSpeaking(false); };
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration; sourcesRef.current.add(source);
            }
          },
          onclose: () => setStatus(ConnectionStatus.DISCONNECTED)
        },
        config: { 
          responseModalities: [Modality.AUDIO], 
          systemInstruction: sysInst,
          generationConfig: { temperature: 0.1 },
          speechConfig: { 
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } // חזרה לקול הנשי החביב
          }
        }
      });
      activeSessionRef.current = await sessionPromise;
    } catch (e) { setStatus(ConnectionStatus.DISCONNECTED); }
  };

  // --- ניהול התצוגה ---
  if (view === 'LOGIN') return <Login onLoginSuccess={handleLoginSuccess} />;
  if (view === 'PRICING') return <Pricing onPlanSelect={handlePlanSelect} />;

  return (
    <div className="h-screen bg-slate-950 flex flex-col text-slate-200 overflow-hidden rtl">
      <header className="p-4 flex items-center justify-between bg-slate-900/60 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center"><Headphones size={16} /></div>
          <span className="font-black text-xs uppercase tracking-tighter">LingoLive Pro</span>
        </div>
        <div className="px-3 py-1 bg-indigo-600/20 border border-indigo-500/30 rounded-full text-[10px] font-black text-indigo-400 uppercase">
          {userPlan} Plan
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="w-full md:w-[450px] flex flex-col p-4 gap-4 bg-slate-900/30 border-r border-white/5 overflow-y-auto">
          <div className="bg-slate-900/90 rounded-[2rem] border border-white/10 p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 bg-slate-800/40 p-2 rounded-2xl">
              <select value={nativeLang.code} onChange={e => setNativeLang(SUPPORTED_LANGUAGES.find(l => l.code === e.target.value)!)} className="bg-transparent text-[10px] font-bold outline-none w-full text-center">
                {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
              </select>
              <ChevronRight size={12} className="text-indigo-500" />
              <select value={targetLang.code} onChange={e => setTargetLang(SUPPORTED_LANGUAGES.find(l => l.code === e.target.value)!)} className="bg-transparent text-[10px] font-bold outline-none w-full text-center">
                {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {SCENARIOS.map(s => (
                <button key={s.id} onClick={() => setSelectedScenario(s)} className={`py-3 rounded-xl flex flex-col items-center gap-1 transition-all ${selectedScenario.id === s.id ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-800/40 text-slate-500'}`}>
                  <span className="text-lg">{s.icon}</span>
                  <span className="text-[9px] font-black uppercase tracking-tighter text-center">{s.title}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center py-4 flex-1 justify-center">
            <Avatar state={status === ConnectionStatus.CONNECTED ? (isSpeaking ? 'speaking' : 'listening') : 'idle'} />
            <button 
              onClick={status === ConnectionStatus.CONNECTED ? stopConversation : startConversation} 
              className={`mt-6 px-10 py-4 rounded-full font-black text-lg shadow-xl flex items-center gap-3 transition-all active:scale-95 ${status === ConnectionStatus.CONNECTED ? 'bg-red-500 hover:bg-red-600' : 'bg-indigo-600 hover:bg-indigo-500'}`}
            >
              <Mic size={24} /> {status === ConnectionStatus.CONNECTED ? 'הפסק' : 'התחל'}
            </button>
            {(isSpeaking || status === ConnectionStatus.CONNECTED) && <AudioVisualizer isActive={true} color={isSpeaking ? "#6366f1" : "#10b981"} />}
          </div>
        </div>

        {/* מרחב הפרסום של מאיר גלעדי */}
        <div className="hidden md:flex flex-1 bg-slate-950 p-6 flex-col gap-6">
          <div className="bg-slate-900 rounded-[2.5rem] border border-white/5 p-8 text-center shadow-2xl">
            <div className="w-14 h-14 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 text-white font-black text-xl">MG</div>
            <h4 className="text-2xl font-black text-white mb-1">מאיר גלעדי</h4>
            <p className="text-indigo-400 font-bold text-base mb-4">מומחה לנדל"ן מסחרי</p>
            <span className="text-slate-300 font-black text-xl block tracking-widest">052-2530087</span>
            <a href="https://mgilady.wixsite.com/meirgilady" target="_blank" className="text-indigo-500 underline text-sm mt-4 block font-bold">לאתר האינטרנט</a>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
