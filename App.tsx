import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, Headphones, ChevronRight, ExternalLink, ShieldCheck, Settings, KeyRound, ArrowRight } from 'lucide-react';
import { ConnectionStatus, SUPPORTED_LANGUAGES, SCENARIOS, Language, PracticeScenario } from './types';
import { decode, decodeAudioData, createPcmBlob } from './services/audioService';
import Avatar from './components/Avatar';
import AudioVisualizer from './components/AudioVisualizer';
import Login from './components/Login';
import Pricing from './components/Pricing';
import Admin from './components/Admin';

// --- רכיבים פנימיים לשחזור סיסמה (כדי שהכל יהיה בקובץ אחד) ---

const ForgotPasswordView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [email, setEmail] = useState('');
  
  const handleSubmit = async () => {
    if(!email) return;
    try {
        const res = await fetch('/api/forgot-password', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await res.json();
        
        // בהדמיה (כי אין שרת מייל) - מציגים את הלינק למפתח
        if(data.devLink) {
            const link = window.location.origin + data.devLink;
            prompt("העתק את הלינק הזה (במציאות זה נשלח למייל):", link);
        } else {
            alert(data.message || "נשלח מייל שחזור (בדוק ב-Console אם אתה בפיתוח)");
        }
    } catch (e) {
        alert("שגיאת תקשורת");
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-[#0f172a] rtl text-white font-['Inter']">
        <div className="w-full max-w-sm p-8 bg-[#1e293b] rounded-3xl border border-white/10 text-center shadow-2xl">
            <h2 className="text-2xl font-bold mb-4 flex items-center justify-center gap-2"><KeyRound className="text-indigo-500"/> שחזור סיסמה</h2>
            <p className="text-slate-400 mb-6 text-sm">הכנס את האימייל שלך ונשלח לך קישור לאיפוס</p>
            <input className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 mb-4 text-center text-white outline-none focus:border-indigo-500" 
                   placeholder="אימייל" value={email} onChange={e => setEmail(e.target.value)} />
            <button onClick={handleSubmit} className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl font-bold mb-4 transition-all">שלח קישור</button>
            <button onClick={onBack} className="text-slate-500 text-sm hover:text-white">חזרה לכניסה</button>
        </div>
    </div>
  );
};

const ResetPasswordView: React.FC<{ token: string, onSuccess: () => void }> = ({ token, onSuccess }) => {
    const [pass, setPass] = useState('');
    const handleReset = async () => {
        try {
            const res = await fetch('/api/reset-password', {
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newPassword: pass })
            });
            if(res.ok) { 
                alert('הסיסמה שונתה בהצלחה! התחבר מחדש.'); 
                onSuccess(); 
            } else { 
                alert('שגיאה באיפוס או שהקישור פג תוקף'); 
            }
        } catch (e) {
            alert("שגיאת תקשורת");
        }
    };
    return (
        <div className="flex h-screen items-center justify-center bg-[#0f172a] rtl text-white font-['Inter']">
            <div className="w-full max-w-sm p-8 bg-[#1e293b] rounded-3xl border border-white/10 text-center shadow-2xl">
                <h2 className="text-2xl font-bold mb-4">יצירת סיסמה חדשה</h2>
                <input type="password" className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 mb-4 text-center text-white outline-none focus:border-indigo-500" 
                       placeholder="סיסמה חדשה" value={pass} onChange={e => setPass(e.target.value)} />
                <button onClick={handleReset} className="w-full bg-green-600 hover:bg-green-500 py-3 rounded-xl font-bold transition-all">עדכן סיסמה</button>
            </div>
        </div>
    );
};

// --- פונקציות עזר גלובליות ---

const updateMetaTag = (name: string, content: string) => {
  if (!content) return;
  let tag = document.querySelector(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', name);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
};

const injectGoogleAnalytics = (gaId: string) => {
  if (!gaId || document.getElementById('ga-script')) return;
  const script1 = document.createElement('script');
  script1.id = 'ga-script'; script1.async = true;
  script1.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
  document.head.appendChild(script1);
  const script2 = document.createElement('script');
  script2.innerHTML = `window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', '${gaId}');`;
  document.head.appendChild(script2);
};

// --- האפליקציה הראשית ---

const App: React.FC = () => {
  const [view, setView] = useState<'LOGIN' | 'PRICING' | 'APP' | 'ADMIN' | 'FORGOT' | 'RESET'>('LOGIN');
  const [userData, setUserData] = useState<any>(null);
  const [resetToken, setResetToken] = useState('');
  
  // משתני אפליקציה
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

  // --- טעינה ראשונית: שחזור סיסמה, זיכרון משתמש והגדרות ---
  useEffect(() => {
    // 1. בדיקה אם הגענו מלינק לאיפוס סיסמה
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const viewParam = params.get('view');
    
    if (viewParam === 'RESET' && token) {
        setResetToken(token);
        setView('RESET');
        window.history.replaceState({}, document.title, "/"); // ניקוי ה-URL
        return; // עוצרים כאן כדי לא לטעון משתמש
    }

    // 2. בדיקת "זיכרון" (LocalStorage) - כניסה אוטומטית
    const savedUser = localStorage.getItem('lingolive_user');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        handleLoginSuccess(user, false); // false = אל תשמור שוב כי כבר שמרנו
      } catch (e) {
        localStorage.removeItem('lingolive_user');
      }
    }

    // 3. טעינת הגדרות שרת (SEO, Ads)
    fetch('/api/admin/settings')
      .then(res => res.json())
      .then(data => {
        if(data.ads) setAds(data.ads);
        if(data.settings) {
          const getVal = (k: string) => data.settings.find((s: any) => s.key === k)?.value;
          const title = getVal('seo_title');
          if(title) document.title = title;
          updateMetaTag('description', getVal('seo_description'));
          updateMetaTag('keywords', getVal('seo_keywords'));
          updateMetaTag('google-site-verification', getVal('google_console_id'));
          injectGoogleAnalytics(getVal('google_analytics_id'));
        }
      }).catch(() => {});
  }, []);

  const handleLoginSuccess = (user: any, shouldSave = true) => {
    // מנהל נכנס תמיד
    if (user.email === 'mgilady@gmail.com') {
        const adminUser = { ...user, role: 'ADMIN', plan: 'PRO' };
        setUserData(adminUser);
        setView('APP');
        if (shouldSave) localStorage.setItem('lingolive_user', JSON.stringify(adminUser));
        return; 
    }

    setUserData(user);
    
    // שמירה בזיכרון הדפדפן
    if (shouldSave) localStorage.setItem('lingolive_user', JSON.stringify(user));

    if (user.role === 'ADMIN') setView('APP');
    else if (user.plan && user.plan !== 'FREE') setView('APP');
    else if (user.tokens_used > 0) setView('APP');
    else setView('PRICING');
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
    sourcesRef.current.forEach(s => { try { s.stop(); } catch (e) {} });
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const outputCtx = outputAudioContextRef.current;
      const outputNode = outputCtx.createGain(); outputNode.connect(outputCtx.destination);
      const sysInst = `ACT AS A PURE INTERPRETER. Translate between ${nativeLang.name} and ${targetLang.name}. Scenario: ${selectedScenario.title
