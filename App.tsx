import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, Headphones, ChevronRight, ExternalLink, ShieldCheck, Settings, KeyRound, LogOut, Globe, ArrowLeftRight } from 'lucide-react';
import { ConnectionStatus, SUPPORTED_LANGUAGES, SCENARIOS, Language, PracticeScenario } from './types';
import { decode, decodeAudioData, createPcmBlob } from './services/audioService';
import Avatar from './components/Avatar';
import AudioVisualizer from './components/AudioVisualizer';
import Login from './components/Login';
import Pricing from './components/Pricing';
import Admin from './components/Admin';
import { translations } from './translations';

// --- רכיבי עזר ---

const ForgotPasswordView: React.FC<{ onBack: () => void, t: any }> = ({ onBack, t }) => {
  const [email, setEmail] = useState('');
  const handleSubmit = async () => {
    if(!email) return;
    try {
        const res = await fetch('/api/forgot-password', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email })
        });
        const data = await res.json();
        alert(data.message || "Email sent");
    } catch (e) { alert("Error"); }
  };
  return (
    <div className="flex h-screen items-center justify-center bg-[#0f172a] text-white font-['Inter']">
        <div className="w-full max-w-sm p-8 bg-[#1e293b] rounded-3xl border border-white/10 text-center shadow-2xl">
            <h2 className="text-2xl font-bold mb-4 flex items-center justify-center gap-2"><KeyRound className="text-indigo-500"/> {t('forgot_password')}</h2>
            <input className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 mb-4 text-center text-white outline-none" placeholder={t('email_placeholder')} value={email} onChange={e => setEmail(e.target.value)} />
            <button onClick={handleSubmit} className="w-full bg-indigo-600 py-3 rounded-xl font-bold mb-4">Send Link</button>
            <button onClick={onBack} className="text-slate-500 text-sm">{t('login_btn')}</button>
        </div>
    </div>
  );
};

const ResetPasswordView: React.FC<{ token: string, onSuccess: () => void }> = ({ token, onSuccess }) => {
    const [pass, setPass] = useState('');
    const handleReset = async () => {
        const res = await fetch('/api/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword: pass }) });
        if(res.ok) { alert('Password Changed!'); onSuccess(); } else alert('Error');
    };
    return (
        <div className="flex h-screen items-center justify-center bg-[#0f172a] text-white font-['Inter']">
            <div className="w-full max-w-sm p-8 bg-[#1e293b] rounded-3xl border border-white/10 text-center shadow-2xl">
                <h2 className="text-2xl font-bold mb-4">New Password</h2>
                <input type="password" className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 mb-4 text-center text-white" placeholder="..." value={pass} onChange={e => setPass(e.target.value)} />
                <button onClick={handleReset} className="w-full bg-green-600 py-3 rounded-xl font-bold">Update</button>
            </div>
        </div>
    );
};

// --- האפליקציה הראשית ---

const App: React.FC = () => {
  const [view, setView] = useState<'LOGIN' | 'PRICING' | 'APP' | 'ADMIN' | 'FORGOT' | 'RESET'>('LOGIN');
  const [userData, setUserData] = useState<any>(null);
  const [resetToken, setResetToken] = useState('');
  
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [targetLang, setTargetLang] = useState<Language>(SUPPORTED_LANGUAGES[0]);
  const [nativeLang, setNativeLang] = useState<Language>(SUPPORTED_LANGUAGES[1]);
  const [selectedScenario, setSelectedScenario] = useState<PracticeScenario>(SCENARIOS[0]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ads, setAds] = useState<any[]>([]);

  const activeSessionRef = useRef<any>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef(0);

  const t = (key: string) => {
    const langCode = nativeLang.code; 
    return translations[langCode]?.[key] || translations['en-US']?.[key] || key;
  };

  const dir = nativeLang.code === 'he-IL' || nativeLang.code === 'ar-SA' ? 'rtl' : 'ltr';

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (params.get('view') === 'RESET' && token) {
        setResetToken(token); setView('RESET'); window.history.replaceState({}, document.title, "/"); return;
    }

    const savedUserStr = localStorage.getItem('lingolive_user');
    if (savedUserStr) {
      try {
        const localUser = JSON.parse(savedUserStr);
        if (localUser && localUser.email) {
            handleLoginSuccess(localUser, false);
        }
      } catch (e) { localStorage.removeItem('lingolive_user'); }
    }

    fetch('/api/admin/settings').then(res => res.json()).then(data => {
        if(data.ads) setAds(data.ads);
        if(data.settings) {
            const getVal = (k: string) => data.settings.find((s: any) => s.key === k)?.value;
            const t = getVal('seo_title'); if(t) document.title = t;
            
            const gaId = getVal('google_analytics_id');
            if(gaId && !document.getElementById('ga-script')) {
                const s1 = document.createElement('script'); s1.id='ga-script'; s1.async=true; s1.src=`https://www.googletagmanager.com/gtag/js?id=${gaId}`;
                document.head.appendChild(s1);
                const s2 = document.createElement('script'); s2.innerHTML=`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`;
                document.head.appendChild(s2);
            }
            const consoleId = getVal('google_console_id');
            if (consoleId) {
                let content = consoleId.includes('content="') ? consoleId.match(/content="([^"]+)"/)?.[1] || consoleId : consoleId;
                if (!document.querySelector('meta[name="google-site-verification"]')) {
                    const metaTag = document.createElement('meta'); metaTag.setAttribute('name', 'google-site-verification'); metaTag.setAttribute('content', content); document.head.appendChild(metaTag);
                }
            }
            const gtmId = getVal('google_tag_manager_id');
            if (gtmId && !document.getElementById('gtm-script')) {
                const script = document.createElement('script'); script.id = 'gtm-script';
                script.innerHTML = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`;
                document.head.appendChild(script);
                const noscript = document.createElement('noscript');
                const iframe = document.createElement('iframe'); iframe.src = `https://www.googletagmanager.com/ns.html?id=${gtmId}`; iframe.height = "0"; iframe.width = "0"; iframe.style.display = "none"; iframe.style.visibility = "hidden"; noscript.appendChild(iframe); document.body.prepend(noscript);
            }
        }
    }).catch(() => {});
  }, []);

  const handleLoginSuccess = (user: any, shouldSave = true) => {
    if (shouldSave) localStorage.setItem('lingolive_user', JSON.stringify(user));
    setUserData(user);

    if (user.role === 'ADMIN' || user.email === 'mgilady@gmail.com') { setView('APP'); return; }
    if (['PRO', 'Pro', 'BASIC', 'ADVANCED'].includes(user.plan)) { setView('APP'); return; }
    if (user.tokens_used > 0) { setView('APP'); return; }
    setView('PRICING');
  };

  const handleLogout = () => {
    localStorage.removeItem('lingolive_user');
    setUserData(null);
    setView('LOGIN');
    if (activeSessionRef.current) stopConversation();
  };

  const stopConversation = useCallback(() => {
    if (activeSessionRef.current) { try { activeSessionRef.current.close(); } catch (e) {} activeSessionRef.current = null; }
    if (micStreamRef.current) { micStreamRef.current.getTracks().forEach(t => t.stop()); micStreamRef.current = null; }
    sourcesRef.current.clear();
    setStatus(ConnectionStatus.DISCONNECTED);
    setIsSpeaking(false);
  }, []);

  const startConversation = async () => {
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey) { alert("חסר מפתח API"); return; }
    try {
      setStatus(ConnectionStatus.CONNECTING);
      const ai = new GoogleGenAI({ apiKey });
      if (!inputAudioContextRef.current) inputAudioContextRef.current = new AudioContext({ sampleRate: 16000 });
      if (!outputAudioContextRef.current) outputAudioContextRef.current = new AudioContext({ sampleRate: 24000 });
      
      // חשוב: הפעלת אודיו כדי לשמוע את התשובה
      await inputAudioContextRef.current.resume(); 
      await outputAudioContextRef.current.resume();
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const outputCtx = outputAudioContextRef.current;
      const outputNode = outputCtx.createGain(); outputNode.connect(outputCtx.destination);

      // --- הגדרת המוח: החלפת ה-Placeholders בשפות שנבחרו ---
      // שימוש ב-Regex גלובלי (/g) כדי להחליף את כל המופעים של SOURCE_LANG ו-TARGET_LANG
      const instructions = selectedScenario.systemInstruction
        .replace(/SOURCE_LANG/g, nativeLang.name)
        .replace(/TARGET_LANG/g, targetLang.name);

      const sessionPromise = ai.live.connect({ 
        model: 'gemini-2.0-flash-exp', 
        config: { 
            responseModalities: [Modality.AUDIO], 
            // כאן נשלחת ההוראה הספציפית למודול
            systemInstruction: instructions,
            // בחירת קול נעים
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } }
        } 
      });
      activeSessionRef.current = await sessionPromise;
      
      const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
      const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(2048, 1, 1);
      scriptProcessor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0).slice();
          if (activeSessionRef.current) activeSessionRef.current.sendRealtimeInput({ media: createPcmBlob(inputData) });
      };
      source.connect(scriptProcessor); scriptProcessor.connect(inputAudioContextRef.current!.destination);

      (async () => {
          try {
            for await (const msg of activeSessionRef.current.listen()) {
                const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                if (audioData) {
                    setIsSpeaking(true);
                    nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                    const buffer = await decodeAudioData(decode(audioData), outputCtx, 24000, 1);
                    const audioSource = outputCtx.createBufferSource();
                    audioSource.buffer = buffer; audioSource.connect(outputNode);
                    audioSource.onended = () => { sourcesRef.current.delete(audioSource); if (sourcesRef.current.size === 0) setIsSpeaking(false); };
                    audioSource.start(nextStartTimeRef.current);
                    nextStartTimeRef.current += buffer.duration; sourcesRef.current.add(audioSource);
                }
            }
          } catch(e) {}
      })();

      setStatus(ConnectionStatus.CONNECTED);
    } catch (e) { setStatus(ConnectionStatus.DISCONNECTED); alert("תקלה בהתחברות"); }
  };

  if (view === 'FORGOT') return <ForgotPasswordView onBack={() => setView('LOGIN')} t={t} />;
  if (view === 'RESET') return <ResetPasswordView token={resetToken} onSuccess={() => setView('LOGIN')} />;
  
  if (view === 'LOGIN') return (
    <Login 
        onLoginSuccess={handleLoginSuccess} 
        onForgotPassword={() => setView('FORGOT')}
        nativeLang={nativeLang}
        setNativeLang={setNativeLang}
        t={t}
    />
  );
  
  if (view === 'PRICING') return (
      <div className={`relative h-screen ${dir}`} dir={dir}>
          <Pricing 
              onPlanSelect={(plan) => { if(userData) setUserData({...userData, plan}); setView('APP'); }} 
              userEmail={userData?.email}
              t={t} 
          />
          <button onClick={handleLogout} className={`fixed top-4 ${dir === 'rtl' ? 'left-4' : 'right-4'} z-50 bg-slate-800 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg hover:bg-red-500 flex items-center gap-2`}>
            <LogOut size={14}/> {t('logout')}
          </button>
      </div>
  );

  if (view === 'ADMIN') return <Admin onBack={() => window.location.reload()} />;

  return (
    <div className={`h-screen bg-slate-950 flex flex-col text-slate-200 overflow-hidden font-['Inter'] ${dir}`} dir={dir}>
      <header className="p-4 flex items-center justify-between bg-slate-900/60 border-b border-white/5 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg"><Headphones size={18} /></div>
          <span className="font-black text-sm uppercase tracking-tighter">LingoLive Pro</span>
        </div>
        <div className="flex items-center gap-3">
          {userData?.role === 'ADMIN' && (
            <button onClick={() => setView('ADMIN')} className="flex items-center gap-2 bg-white text-indigo-900 px-5 py-2 rounded-full font-black hover:bg-slate-200 transition-all shadow-[0_0_15px_rgba(255,255,255,0.3)] animate-pulse">
              <Settings size={16} /> {t('admin_panel')}
            </button>
          )}
          <div className="flex items-center gap-2 px-3 py-1 bg-indigo-600/20 border border-indigo-500/30 rounded-full">
            <ShieldCheck size={12} className="text-indigo-400" />
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{userData?.plan || 'FREE'}</span>
          </div>
          <button onClick={handleLogout} className="text-[10px] text-slate-500 hover:text-white underline">{t('logout')}</button>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="w-full md:w-[450px] flex flex-col p-4 gap-4 bg-slate-900/30 border-r border-white/5">
          <div className="bg-slate-900/90 rounded-[2rem] border border-white/10 p-5 flex flex-col gap-4 shadow-2xl">
            
            <div className="bg-slate-800/40 p-3 rounded-2xl">
              <div className="flex justify-between px-2 mb-2 text-xs font-black text-indigo-300 uppercase tracking-widest">
                  <span>{t('label_native')}</span>
                  <span>{t('label_target')}</span>
              </div>
              <div className="flex items-center gap-2">
                <select value={nativeLang.code} onChange={e => setNativeLang(SUPPORTED_LANGUAGES.find(l => l.code === e.target.value)!)} className="bg-slate-900 border border-white/10 rounded-lg px-2 py-3 text-sm font-black outline-none w-full text-center">
                  {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
                </select>
                <ArrowLeftRight size={16} className="text-indigo-500 shrink-0" />
                <select value={targetLang.code} onChange={e => setTargetLang(SUPPORTED_LANGUAGES.find(l => l.code === e.target.value)!)} className="bg-slate-900 border border-white/10 rounded-lg px-2 py-3 text-sm font-black outline-none w-full text-center">
                  {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
                </select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {SCENARIOS.map(s => (
                <button key={s.id} onClick={() => setSelectedScenario(s)} className={`py-4 rounded-2xl flex flex-col items-center gap-2 transition-all ${selectedScenario.id === s.id ? 'bg-indigo-600 text-white shadow-xl scale-[1.02]' : 'bg-slate-800/40 text-slate-500'}`}>
                  <span className="text-3xl">{s.icon}</span>
                  <span className="text-lg font-black uppercase text-center leading-tight px-1">
                      {t(s.title)}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-center py-6 flex-1 justify-center relative">
            <Avatar state={status === ConnectionStatus.CONNECTED ? (isSpeaking ? 'speaking' : 'listening') : 'idle'} />
            
            <button onClick={status === ConnectionStatus.CONNECTED ? stopConversation : startConversation} className={`mt-8 px-10 py-5 rounded-full font-black text-2xl shadow-2xl flex items-center gap-3 transition-all active:scale-95 ${status === ConnectionStatus.CONNECTED ? 'bg-red-500 hover:bg-red-600' : 'bg-indigo-600 hover:bg-indigo-500'}`}>
                <Mic size={32} /> 
                {status === ConnectionStatus.CONNECTED ? t('stop_conversation') : t('start_conversation')}
            </button>
            
            {(isSpeaking || status === ConnectionStatus.CONNECTED) && <AudioVisualizer isActive={true} color={isSpeaking ? "#6366f1" : "#10b981"} />}
          </div>
        </div>

        <div className="hidden md:flex flex-1 bg-slate-950 p-8 flex-col gap-6 items-center justify-start overflow-y-auto">
           {ads.length === 0 ? (
             <div className="w-full max-w-sm bg-slate-900 rounded-[3rem] border border-white/5 p-8 text-center shadow-2xl opacity-50"><p className="text-slate-500 text-sm">Loading...</p></div>
           ) : (
             ads.filter(ad => ad.is_active).map(ad => (
               <div key={ad.slot_id} className="w-full max-w-sm bg-slate-900 rounded-[3rem] border border-white/5 p-8 text-center shadow-2xl relative group hover:border-indigo-500/30 transition-colors">
                 {ad.image_url && <img src={ad.image_url} alt={ad.title} className="w-full h-40 object-cover rounded-2xl mb-4" />}
                 <h4 className="text-3xl font-black text-white mb-2">{ad.title}</h4>
                 <a href={ad.target_url} target="_blank" className="mt-4 bg-indigo-600/20 text-indigo-400 px-8 py-3 rounded-xl inline-flex items-center gap-2 font-bold text-lg hover:bg-indigo-600 hover:text-white transition-all">Link <ExternalLink size={18} /></a>
               </div>
             ))
           )}
        </div>
      </main>
    </div>
  );
};

export default App;
