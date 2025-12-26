import React, { useState, useEffect } from 'react';
import { Save, Image as ImageIcon, Globe, Users, Lock, ArrowRight, BarChart, Search, Ticket, CheckCircle, XCircle, Copy, AlertTriangle } from 'lucide-react';

const Admin: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<'SETTINGS' | 'CODES'>('SETTINGS');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // נתונים
  const [ads, setAds] = useState<any[]>([]);
  const [stats, setStats] = useState({ total_users: 0 });
  const [promoCodes, setPromoCodes] = useState<any[]>([]);
  const [newPass, setNewPass] = useState('');

  // שדות SEO
  const [seoSettings, setSeoSettings] = useState({
    seo_title: '',
    seo_description: '',
    seo_keywords: '',
    google_analytics_id: '',
    google_console_id: ''
  });

  // טעינה מוגנת
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // 1. טעינת הגדרות
        const settingsRes = await fetch('/api/admin/settings');
        if (settingsRes.ok) {
            const data = await settingsRes.json();
            setAds(Array.isArray(data.ads) ? data.ads : []);
            setStats(data.stats || { total_users: 0 });
            
            const newSettings = { ...seoSettings };
            if (Array.isArray(data.settings)) {
                data.settings.forEach((s: any) => {
                    // @ts-ignore
                    if (newSettings[s.key] !== undefined) newSettings[s.key] = s.value;
                });
            }
            setSeoSettings(newSettings);
        }

        // 2. טעינת קודים (עם הגנה)
        try {
            const codesRes = await fetch('/api/admin/codes');
            if (codesRes.ok) {
                const codesData = await codesRes.json();
                setPromoCodes(Array.isArray(codesData) ? codesData : []);
            }
        } catch (e) {
            console.warn("Could not load codes", e);
        }

      } catch (err: any) {
        console.error(err);
        setError("שגיאה בטעינת הנתונים: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const saveAllSEO = async () => {
    try {
        for (const [key, value] of Object.entries(seoSettings)) {
        await fetch('/api/admin/settings', {
            method: 'POST', body: JSON.stringify({ type: 'SETTING', data: { key, value } })
        });
        }
        alert('ההגדרות נשמרו!');
    } catch(e) { alert('שגיאה בשמירה'); }
  };

  const saveAd = async (ad: any) => {
    await fetch('/api/admin/settings', {
      method: 'POST', body: JSON.stringify({ type: 'AD', data: ad })
    });
    alert('הפרסומת עודכנה!');
  };

  const changePassword = async () => {
    alert("פונקציה זו תעבוד כשתחבר את שינוי הסיסמה בשרת.");
  };

  if (loading) return <div className="h-screen flex items-center justify-center text-white bg-slate-950">טוען פאנל ניהול...</div>;
  
  if (error) return (
      <div className="h-screen flex flex-col items-center justify-center text-white bg-slate-950 gap-4">
          <AlertTriangle size={48} className="text-red-500" />
          <h2 className="text-2xl font-bold">שגיאה בטעינת האדמין</h2>
          <p className="text-slate-400">{error}</p>
          <button onClick={onBack} className="bg-slate-800 px-6 py-2 rounded-full">חזרה לאתר</button>
      </div>
  );

  return (
    <div className="h-screen overflow-y-auto bg-slate-950 text-slate-200 rtl font-['Inter'] p-8 scrollbar-thin scrollbar-thumb-indigo-600 scrollbar-track-slate-900">
      
      {/* כותרת עליונה */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-black flex items-center gap-2 text-indigo-400">
          <Users className="text-indigo-500" /> פאנל ניהול
        </h1>
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white font-bold transition-colors bg-slate-900 px-4 py-2 rounded-xl border border-white/5">
          <ArrowRight size={18}/> חזרה לאתר
        </button>
      </div>

      {/* תפריט לשוניות */}
      <div className="flex gap-4 mb-8 border-b border-white/10 pb-4">
        <button onClick={() => setActiveTab('SETTINGS')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'SETTINGS' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'}`}>
          <Settings size={18}/> הגדרות ופרסומות
        </button>
        <button onClick={() => setActiveTab('CODES')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'CODES' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'}`}>
          <Ticket size={18}/> קודי הטבה ({promoCodes.length})
        </button>
      </div>

      {/* תוכן: לשונית קודים */}
      {activeTab === 'CODES' && (
        <div className="animate-in fade-in slide-in-from-bottom-4">
           <div className="bg-slate-900/50 p-6 rounded-3xl border border-white/5">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2"><Ticket size={20} className="text-yellow-400"/> רשימת קודים</h2>
                <div className="text-sm text-slate-400">
                  סה"כ: <span className="text-white font-bold">{promoCodes.length}</span> | 
                  פנויים: <span className="text-green-400 font-bold">{promoCodes.filter(c => c.is_used === 0).length}</span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {promoCodes.length === 0 ? <p>אין קודים להצגה או שגיאה בטעינה</p> : promoCodes.map((code) => (
                  <div key={code.code} className={`p-4 rounded-xl border flex items-center justify-between ${code.is_used ? 'bg-red-900/10 border-red-500/20 opacity-60' : 'bg-slate-800 border-white/5'}`}>
                    <div className="flex flex-col">
                      <span className="font-mono font-bold text-lg tracking-wider select-all">{code.code}</span>
                      <span className={`text-[10px] font-bold uppercase flex items-center gap-1 ${code.is_used ? 'text-red-400' : 'text-green-400'}`}>
                        {code.is_used ? "נוצל" : "פנוי"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
           </div>
        </div>
      )}

      {/* תוכן: לשונית הגדרות */}
      {activeTab === 'SETTINGS' && (
        <div className="animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-slate-900 p-6 rounded-3xl border border-white/5 mb-8 inline-block shadow-lg">
            <p className="text-slate-400 text-xs font-bold uppercase mb-1">משתמשים רשומים</p>
            <p className="text-4xl font-black text-white">{stats.total_users}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            <section className="bg-slate-900/50 p-6 rounded-3xl border border-white/5 space-y-4">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Globe size={20} className="text-blue-400"/> SEO וכלים</h2>
              <div><label className="text-xs font-bold text-slate-500 block mb-1">כותרת</label><input value={seoSettings.seo_title} onChange={e => setSeoSettings({...seoSettings, seo_title: e.target.value})} className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none"/></div>
              <div><label className="text-xs font-bold text-slate-500 block mb-1">Analytics ID</label><input value={seoSettings.google_analytics_id} onChange={e => setSeoSettings({...seoSettings, google_analytics_id: e.target.value})} className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-sm dir-ltr"/></div>
              <button onClick={saveAllSEO} className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-bold text-white shadow-lg mt-4">שמור הגדרות</button>
            </section>
          </div>

          <section className="pb-20">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><ImageIcon size={20} className="text-emerald-400"/> ניהול פרסומות</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(id => {
                const ad = ads.find(a => a.slot_id === id) || { slot_id: id, title: '', image_url: '', target_url: '' };
                return (
                  <div key={id} className="bg-slate-900 p-5 rounded-3xl border border-white/10 flex flex-col gap-3 shadow-xl">
                    <span className="text-emerald-400 font-black text-xs uppercase tracking-wider">מיקום {id}</span>
                    <input className="w-full bg-slate-950 border border-white/5 p-2 rounded-lg text-xs text-white" defaultValue={ad.title} onBlur={e => ad.title = e.target.value} placeholder="כותרת" />
                    <input className="w-full bg-slate-950 border border-white/5 p-2 rounded-lg text-xs text-slate-300 dir-ltr" defaultValue={ad.image_url} onBlur={e => ad.image_url = e.target.value} placeholder="URL תמונה" />
                    <button onClick={() => saveAd(ad)} className="mt-2 w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-xl text-xs font-black shadow-lg">עדכן</button>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default Admin;
