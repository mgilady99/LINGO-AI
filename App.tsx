import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, Headphones, XCircle, ChevronRight, RefreshCw, Trash2, AlertCircle } from 'lucide-react';
import { ConnectionStatus, SUPPORTED_LANGUAGES, SCENARIOS, Language, PracticeScenario, TranscriptionEntry } from './types';
import { decode, decodeAudioData, createPcmBlob } from './services/audioService';
import Avatar from './components/Avatar';
import AudioVisualizer from './components/AudioVisualizer';
import transcriptitem from './components/transcriptitem'; 

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

  // זיהוי מפתח מהסביבה של Vite
  useEffect(() => {
    const checkKey = () => {
      // ניסיון משיכה ישיר של המפתח שהזרקנו ב-Build Command
      const apiKey = import.meta.env.VITE_API_KEY;
      
      console.log("API Key Detection:", apiKey ? "Detected" : "NOT_AVAILABLE");
      
      if (apiKey && apiKey.length > 10) {
        setHasKey(true);
      } else {
        setHasKey(false);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    // @ts-ignore
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      const exists = await window.aistudio.hasSelectedApiKey();
      setHasKey(exists);
    } else {
      setError("Please ensure VITE_API_KEY is defined in Cloudflare Variables and Redeploy.");
    }
  };

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
    
    if (!apiKey) {
      handleSelectKey();
      return;
    }

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
              sessionPromise.then(s => {
                if (!isMutedRef.current && s) {
                  s.sendRealtimeInput({ media: pcmBlob });
                }
              });
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
              source.onended = () => { 
                sourcesRef.current.delete(source); 
                if (sourcesRef.current.size === 0) setIsSpeaking(false); 
              };
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }
            if (m.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => { try { s.stop(); } catch (e) {} });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setIsSpeaking(false);
            }
          },
          onerror: (e) => { 
            console.error("Session Error:", e);
            setError('Connection failed. Please check API Key.');
            stopConversation(); 
          },
          onclose: () => setStatus(ConnectionStatus.DISCONNECTED)
        },
        config: { 
          responseModalities: [Modality.AUDIO], 
          systemInstruction: "You are a helpful translation assistant.",
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } }
        }
      });
      activeSessionRef.current = await sessionPromise;
    } catch (e: any) { 
      console.error("Start Error:", e);
      setError('Connection failed.'); 
      setStatus(ConnectionStatus.ERROR); 
    }
  };

  if (hasKey === null) return <div className="h-screen bg-slate-950 flex items-center justify-center"><div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="h-screen bg-slate-950 flex flex-col text-slate-200 overflow-hidden font-['Inter'] safe-area-inset">
      <header className="p-4 flex items-center justify-between bg-slate-900/60 border-b border-white/5 backdrop-blur-2xl shrink-0 z-50">
        <div className="flex items-center gap-3">
           <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20"><Headphones size={20} /></div>
           <div className="flex flex-col text-left">
             <div className="flex items-center gap-2">
               <span className="font-black text-sm uppercase text-white">LingoLive Pro</span>
               <span className="text-[8px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded font-bold">v1.2.0</span>
             </div>
             <span className={`text-[10px] font-black uppercase ${status === 'CONNECTED' ? 'text-emerald-400' : 'text-slate-400'}`}>{status}</span>
           </div>
        </div>
        <div className="flex items-center gap-2">
           <button onClick={() => setTranscript([])} className="p-2.5 text-slate-500 hover:text-white transition-colors" title="Clear History"><Trash2 size={18} /></button>
           <button onClick={handleSelectKey} className="p-2.5 text-slate-500 hover:text-white bg-slate-800/50 rounded-lg transition-colors" title="Refresh Key"><RefreshCw size={18} /></button>
           {status === ConnectionStatus.CONNECTED && (
             <button onClick={stopConversation} className="bg-red-500/20 text-red-400 p-2.5 rounded-lg border border-red-500/20"><XCircle size={18} /></button>
           )}
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="w-full md:w-[450px] flex flex-col p-6 gap-6 bg-slate-900/30 border-r border-white/5 overflow-y-auto scrollbar-thin">
          {/* פאנל שליטה ושפות */}
          <div className="w-full bg-slate-900/90 rounded-[2rem] border border-white/10 p-5 flex flex-col gap-4 shadow-xl">
             <div className="flex items-center gap-2 bg-slate-800/40 p-2 rounded-[1.5rem]">
               <select value={nativeLang.code} onChange={e => setNativeLang(SUPPORTED_LANGUAGES.find(l => l.code === e.target.value)!)} className="bg-slate-900 border-none rounded-xl py-2 text-sm font-bold text-center w-full">
                 {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
               </select>
               <ChevronRight size={16} className="text-indigo-500" />
               <select value={targetLang.code} onChange={e => setTargetLang(SUPPORTED_LANGUAGES.find(l => l.code === e.target.value)!)} className="bg-slate-900 border-none rounded-xl py-2 text-sm font-bold text-center w-full">
                 {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
               </select>
             </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-6 py-4">
            <Avatar state={status !== ConnectionStatus.CONNECTED ? 'idle' : isSpeaking ? 'speaking' : isMuted ? 'thinking' : 'listening'} />
            <div className="w-full flex justify-center">
              {status === ConnectionStatus.CONNECTED ? (
                <div className="flex items-center gap-4">
                  <button onClick={() => setIsMuted(!isMuted)} className={`p-5 rounded-full border-2 ${isMuted ? 'bg-red-500' : 'bg-slate-800'}`}>
                    {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                  </button>
                  <button onClick={stopConversation} className="bg-white text-slate-950 px-8 py-4 rounded-full font-black text-sm uppercase">Stop Session</button>
                </div>
              ) : (
                <button onClick={startConversation} className="bg-indigo-600 px-10 py-5 rounded-full font-black flex items-center gap-3 text-lg shadow-2xl hover:bg-indigo-500 transition-all">
                  <Mic size={24} /> START SESSION
                </button>
              )}
            </div>
          </div>
          {error && <div className="text-red-400 text-xs font-bold bg-red-500/10 p-3 rounded-xl border border-red-500/20 text-center flex items-center gap-2 justify-center"><AlertCircle size={14} /> {error}</div>}
        </div>

        <div className="flex-1 flex flex-col bg-slate-950 p-4 md:p-8 overflow-hidden">
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
