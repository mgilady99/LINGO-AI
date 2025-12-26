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
      await inputAudioContextRef.current.resume(); await outputAudioContextRef.current.resume();
