import React, { useState } from 'react';
import { Upload, ArrowLeft } from 'lucide-react';

const Admin: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [ads, setAds] = useState<any[]>([]);
  const [newAd, setNewAd] = useState({ title: '', target_url: '', image_base64: '' });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setNewAd({ ...newAd, image_base64: reader.result as string });
      reader.readAsDataURL(file);
    }
  };

  const addAd = () => {
    if (!newAd.image_base64) return alert("Please upload an image first");
    setAds([...ads, { ...newAd, id: Date.now() }]);
    setNewAd({ title: '', target_url: '', image_base64: '' });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <button onClick={onBack} className="flex items-center gap-2 mb-8 text-slate-400 hover:text-white"><ArrowLeft size={18}/> Back</button>
      <div className="max-w-xl mx-auto bg-slate-900 p-8 rounded-3xl border border-white/10">
        <h2 className="text-2xl font-black mb-6 uppercase tracking-tighter italic">Ad Manager</h2>
        <div className="space-y-4">
          <input type="text" placeholder="Ad Title" value={newAd.title} onChange={e => setNewAd({...newAd, title: e.target.value})} className="w-full bg-slate-800 rounded-xl px-4 py-3"/>
          <input type="text" placeholder="Link URL" value={newAd.target_url} onChange={e => setNewAd({...newAd, target_url: e.target.value})} className="w-full bg-slate-800 rounded-xl px-4 py-3"/>
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-2xl p-6 cursor-pointer hover:border-indigo-500">
            <Upload size={24} className="mb-2 text-indigo-400"/>
            <span className="text-xs font-bold">Upload Image</span>
            <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload}/>
          </label>
          {newAd.image_base64 && <img src={newAd.image_base64} className="h-20 rounded-lg mx-auto" alt="Preview"/>}
          <button onClick={addAd} className="w-full bg-indigo-600 py-4 rounded-xl font-black uppercase">Add Advertisement</button>
        </div>
      </div>
    </div>
  );
};

export default Admin;
