import React, { useState, useEffect } from 'react';
import { Globe, Users, Ticket, Settings, Activity, FileSpreadsheet } from 'lucide-react';

const Admin: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<'SETTINGS' | 'CODES' | 'USERS'>('SETTINGS');
  const [loading, setLoading] = useState(true);
  
  // נתונים
  const [ads, setAds] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [promoCodes, setPromoCodes] = useState<any[]>([]);
  
  // שדות SEO וניהול
  const [seoSettings, setSeoSettings] = useState({
    seo_title: '',
    seo_description: '',
    seo_keywords: '',
    google_analytics_id: '',
    google_console_id: '',
    google_tag_manager_id: '' // שדה חדש ל-GTM
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const settingsRes = await fetch('/api/admin/settings');
        if (settingsRes.ok) {
            const data = await settingsRes.json();
            setAds(Array.isArray(data.ads) ? data.ads : []);
            setUsersList(Array.isArray(data.users) ? data.users : []);
            
            const newSettings = { ...seoSettings };
            if (data.settings && Array.isArray(data.settings)) {
                data.settings.forEach((s: any) => {
                    // @ts-ignore
                    if (newSettings[s.key] !== undefined) newSettings[s.key] = s.value;
                });
            }
            setSeoSettings(newSettings);
        }
        try {
            const codesRes = await fetch('/api/admin/codes');
            if (codesRes.ok) setPromoCodes(await codesRes.json());
        } catch (e) {}

      } catch (err: any) { console.error(err); } 
      finally { setLoading(false); }
    };
    loadData();
  }, []);

  const saveAd = async (ad: any) => {
    await fetch('/api/admin/settings', { method: 'POST', body: JSON.stringify({ type: 'AD', data: ad }) });
    alert('הפרסומת עודכנה!');
  };

  const saveAllSEO = async () => {
      for (const [key, value] of Object.entries(seoSettings)) {
          await fetch('/api/admin/settings', { method: 'POST', body: JSON.stringify({ type: 'SETTING', data: { key, value } }) });
      }
      alert('הגדרות נשמרו בהצלחה!');
  };

  const downloadUsersCSV = () => {
    const headers = ['Email', 'Plan', 'Role', 'Tokens Used'];
    const csvContent = [headers.join(','), ...usersList.map(u => [u.email, u.plan, u.role, u.tokens_used].join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `users_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-950 text-white">טוען נתונים...</div>;

  return (
    <div className="h-screen overflow-y-auto bg-slate-950 text-slate-200 rtl font-['Inter'] p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-black text-indigo-400">פאנל ניהול</h1>
        <button onClick={onBack} className="bg-slate-800 px-4 py-2 rounded-xl border border-white/10 hover:bg-slate-700">חזרה לאתר</button>
      </div>

      <div className="flex gap-4 mb-8 border-b border-white/10 pb-4 overflow-x-auto">
        <button onClick={() => setActiveTab('SETTINGS')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'SETTINGS' ? 'bg-indigo-600 text-white' : 'bg-slate-900'}`}>
            <Settings size={18}/> הגדרות
        </button>
        <button onClick={() => setActiveTab('USERS')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'USERS' ? 'bg-indigo-600 text-white' : 'bg-slate-900'}`}>
            <Users size={18}/> משתמשים ({usersList.length})
        </button>
        <button onClick={() => setActiveTab('CODES')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'CODES' ? 'bg-indigo-600 text-white' : 'bg-slate-900'}`}>
            <Ticket size={18}/> קודים ({promoCodes.length})
        </button>
      </div>

      {activeTab === 'SETTINGS' && (
        <div className="space-y-8 max-w-5xl mx-auto animate-in fade-in">
            <div className="bg-slate-900 p-8 rounded-3xl border border-white/10 shadow-2xl">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-blue-400"><Globe/> הגדרות SEO וכלים</h3>
                <div className="space-y-5">
                    <div>
                        <label className="block text-sm font-bold text-slate-400 mb-2">כותרת האתר (Title)</label>
                        <input value={seoSettings.seo_title} onChange={e => setSeoSettings({...seoSettings, seo_title: e.target.value})} className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none" placeholder="כותרת האתר..." />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-400 mb-2">תיאור (Description)</label>
                        <textarea value={seoSettings.seo_description} onChange={e => setSeoSettings({...seoSettings, seo_description: e.target.value})} className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none h-20 resize-none" placeholder="תיאור קצר..." />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-400 mb-2">מילות מפתח</label>
                        <input value={seoSettings.seo_keywords} onChange={e => setSeoSettings({...seoSettings, seo_keywords: e.target.value})} className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none" placeholder="מילים מופרדות בפסיק..." />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-white/10 pt-4 mt-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Google Analytics ID</label>
                            <input value={seoSettings.google_analytics_id} onChange={e => setSeoSettings({...seoSettings, google_analytics_id: e.target.value})} className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white text-sm dir-ltr font-mono" placeholder="G-XXXXXXXXXX" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Google Console ID (HTML Tag)</label>
                            <input value={seoSettings.google_console_id} onChange={e => setSeoSettings({...seoSettings, google_console_id: e.target.value})} className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white text-sm dir-ltr font-mono" placeholder="הקוד מתוך ה-meta tag" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Google Tag Manager ID</label>
                            <input value={seoSettings.google_tag_manager_id} onChange={e => setSeoSettings({...seoSettings, google_tag_manager_id: e.target.value})} className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white text-sm dir-ltr font-mono" placeholder="GTM-XXXXXX" />
                        </div>
                    </div>

                    <button onClick={saveAllSEO} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg mt-4">שמור הגדרות</button>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pb-20">
              {[1, 2, 3, 4].map(id => {
                const ad = ads.find(a => a.slot_id === id) || { slot_id: id, title: '', image_url: '', target_url: '' };
                return (
                  <div key={id} className="bg-slate-900 p-5 rounded-3xl border border-white/10 flex flex-col gap-3 shadow-lg">
                    <span className="text-emerald-400 font-black text-xs uppercase tracking-wider">פרסומת {id}</span>
                    <input className="w-full bg-slate-950 border border-white/5 p-2 rounded-lg text-xs text-white" defaultValue={ad.title} onBlur={e => ad.title = e.target.value} placeholder="כותרת" />
                    <input className="w-full bg-slate-950 border border-white/5 p-2 rounded-lg text-xs text-slate-300 dir-ltr" defaultValue={ad.image_url} onBlur={e => ad.image_url = e.target.value} placeholder="URL תמונה" />
                    <input className="w-full bg-slate-950 border border-white/5 p-2 rounded-lg text-xs text-slate-300 dir-ltr" defaultValue={ad.target_url} onBlur={e => ad.target_url = e.target.value} placeholder="URL יעד" />
                    <button onClick={() => saveAd(ad)} className="mt-2 w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-xl text-xs font-black">עדכן</button>
                  </div>
                );
              })}
            </div>
        </div>
      )}

      {activeTab === 'USERS' && (
        <div className="animate-in fade-in">
           <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">רשימת משתמשים</h2>
              <button onClick={downloadUsersCSV} className="bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg"><FileSpreadsheet size={20}/> ייצוא לאקסל</button>
           </div>
           <div className="bg-slate-900 rounded-2xl border border-white/10 overflow-hidden">
               <table className="w-full text-right text-sm">
                   <thead className="bg-slate-800 text-slate-400 text-xs uppercase font-bold">
                       <tr><th className="px-6 py-4">אימייל</th><th className="px-6 py-4">תוכנית</th><th className="px-6 py-4">תפקיד</th><th className="px-6 py-4">שימוש</th></tr>
                   </thead>
                   <tbody className="divide-y divide-white/5">
                       {usersList.map((u, i) => (
                           <tr key={i} className="hover:bg-slate-800/50"><td className="px-6 py-4 dir-ltr text-right text-indigo-300 font-mono">{u.email}</td><td className="px-6 py-4">{u.plan}</td><td className="px-6 py-4">{u.role}</td><td className="px-6 py-4">{u.tokens_used}</td></tr>
                       ))}
                   </tbody>
               </table>
           </div>
        </div>
      )}

      {activeTab === 'CODES' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-in fade-in">
            {promoCodes.map((c) => (
                <div key={c.code} className={`p-3 border rounded-xl flex justify-between ${c.is_used ? 'bg-red-900/20 border-red-500/30' : 'bg-green-900/20 border-green-500/30'}`}>
                    <span className="font-mono font-bold text-sm">{c.code}</span>
                    <span className="text-[10px] uppercase font-bold">{c.is_used ? 'נוצל' : 'פנוי'}</span>
                </div>
            ))}
        </div>
      )}
    </div>
  );
};

export default Admin;
