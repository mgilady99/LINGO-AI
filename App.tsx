import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, Headphones, ChevronRight, ExternalLink, ShieldCheck, Settings } from 'lucide-react';
import { ConnectionStatus, SUPPORTED_LANGUAGES, SCENARIOS, Language, PracticeScenario } from './types';
import { decode, decodeAudioData, createPcmBlob } from './services/audioService';
import Avatar from './components/Avatar';
import AudioVisualizer from './components/AudioVisualizer';
import Login from './components/Login';
import Pricing from './components/Pricing';
import Admin from './components/Admin';

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

const App: React.FC = () => {
  const [view, setView] = useState<'LOGIN' | 'PRICING' | 'APP' | 'ADMIN'>('LOGIN');
  const [userData, setUserData] = useState<any>(null);
  
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

  // --- טעינה ראשונית: זיכרון משתמש + הגדרות ---
  useEffect(() => {
    // 1. בדיקת "זיכרון" (LocalStorage)
    const savedUser = localStorage.getItem('lingolive_user');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        handleLoginSuccess(user, false); // false = אל תשמור שוב כי כבר שמרנו
      } catch (e) {
        localStorage.removeItem('lingolive_user');
      }
    }

    // 2. טעינת הגדרות שרת
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
    
    // שמירה בזיכרון הדפדפן כדי לזכור לפעם הבאה
    if (shouldSave) localStorage.setItem('lingolive_user', JSON.stringify(user));

    if (user.role === 'ADMIN') setView('APP');
    else if (user.plan && user.plan !== 'FREE') setView('APP');
    else if (user.tokens_used > 0) setView('APP');
    else
