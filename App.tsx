import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, Headphones, ChevronRight, ExternalLink, ShieldCheck, Settings } from 'lucide-react';
import { ConnectionStatus, SUPPORTED_LANGUAGES, SCENARIOS, Language, PracticeScenario } from './types';
import { decode, decodeAudioData, createPcmBlob } from './services/audioService';
import Avatar from './components/Avatar';
import AudioVisualizer from './components/AudioVisualizer';
import Login from './components/Login';
import Pricing from './components/Pricing';
import Admin from './components/Admin'; // וודא שהקובץ קיים

const App: React.FC = () => {
  // מצבי האפליקציה
  const [view, setView] = useState<'LOGIN' | 'PRICING' | 'APP' | 'ADMIN'>('LOGIN');
  
  // שמירת נתוני המשתמש המחובר
  const [userData, setUserData] = useState<any>(null);
  
  // נתונים שוטפים
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [targetLang, setTargetLang] = useState<Language>(SUPPORTED_LANGUAGES[0]);
  const [nativeLang, setNativeLang] = useState<Language>(SUPPORTED_LANGUAGES[1]);
  const [selectedScenario, setSelectedScenario] = useState<PracticeScenario>(SCENARIOS[0]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ads, setAds] = useState<any[]>([]);

  // Refs לאודיו
  const activeSessionRef = useRef<any>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef(0);

  // טעינת הגדרות ופרסומות בעלייה
  useEffect(() => {
    fetch('/api/admin/settings').then(res => res.json()).then(data => {
      if(data.ads) setAds(data.ads);
      if(data.settings) {
        const seoTitle = data.settings.find((s: any) => s.key === 'seo_title');
        if(seoTitle) document.title = seoTitle.value;
      }
    }).catch(() => {}); // התעלמות משגיאות אם אין עדיין טבלאות
  }, []);

  // ניהול כניסה חכמה
  const handleLoginSuccess = (user: any) => {
    console.log("User logged in:", user); // לבדיקה בקונסול
    setUserData(user);

    // לוגיקה לניתוב המשתמש
    if (user.role === 'ADMIN') {
      // מנהל נכנס ישר לאפליקציה (עם כפתור ניהול)
      setView('APP');
    } else if (user.plan && user.plan !== 'FREE') {
      // משתמש משלם נכנס ישר לאפליקציה
      setView('APP');
    } else if (user.tokens_used > 0) {
      // משתמש שכבר השתמש במערכת נכנס לאפליקציה
      setView('APP');
    } else {
      // משתמש חדש לגמרי -> הצעת מחיר
      setView('PRICING');
    }
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

      const sysInst = `ACT AS A PURE INTERPRETER. Translate between ${nativeLang.name} and ${targetLang.name}. Scenario: ${selectedScenario.title}. No small talk.`;
      
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
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } }
        }
      });
      activeSessionRef.current = await sessionPromise;
    } catch (e) { setStatus(ConnectionStatus.DISCONNECTED); }
  };

  // ניתוב תצוגה
  if (view === 'LOGIN') return <Login onLoginSuccess={handleLoginSuccess} />;
  
  if (view === 'PRICING') return <Pricing onPlanSelect={(plan) => { 
      // עדכון התוכנית מקומית ומעבר לאפליקציה
      if(userData) setUserData({...userData, plan}); 
      setView('APP'); 
  }} />;

  if (view === 'ADMIN') return <Admin onBack={() => setView('APP')} />;

  // המסך הראשי
  return (
    <div className="h-screen bg-slate-950 flex flex-col text-slate-200 overflow-hidden rtl font-['Inter']">
      <header className="p-4 flex items-center justify-between bg-slate-900/60 border-b border-white/5 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg"><Headphones size={18} /></div>
          <span className="font-black text-sm uppercase tracking-tighter">LingoLive Pro</span>
        </div>
        
        <div className="flex items-center gap-3">
          {/* כפתור ניהול - מופיע רק למנהל */}
          {userData?.role === 'ADMIN' && (
            <button 
              onClick={() => setView('ADMIN')}
              className="flex items-center gap-1 text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-1 rounded-full font-bold hover:bg-red-500/30 transition-all"
            >
              <Settings size={12} /> ניהול
            </button>
          )}
          
          <div className="flex items-center gap-2 px-3 py-1 bg-indigo-600/20 border border-indigo-500/30 rounded-full">
            <ShieldCheck size={12} className="text-indigo-400" />
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{userData?.plan || 'FREE'}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="w-full md:w-[450px
