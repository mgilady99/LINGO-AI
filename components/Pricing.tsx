import React, { useState } from 'react';
import { Check, Zap, Crown, Gift, ArrowRight } from 'lucide-react';

const Pricing: React.FC<{ onPlanSelect: (plan: string) => void }> = ({ onPlanSelect }) => {
  const [promoCode, setPromoCode] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const plans = [
    { id: 'FREE', name: 'חינם', price: '0', tokens: '5,000', icon: <Zap className="text-slate-400" />, color: 'slate' },
    { id: 'BASIC', name: 'Standard', price: '4.90', tokens: '20,000', icon: <Crown className="text-indigo-400" />, color: 'indigo' },
    { id: 'PRO', name: 'Premium', price: '11.90', tokens: '100,000', icon: <Crown className="text-amber-400" />, color: 'amber' }
  ];

  const handleRedeem = () => {
    if (promoCode === "MEIR12321") setIsSuccess(true);
    else alert("קוד לא תקין.");
  };

  return (
    <div className="fixed inset-0 bg-slate-950 text-slate-200 font-['Inter'] rtl overflow-y-auto">
      <div className="w-full max-w-md mx-auto px-4 py-8 pb-20 flex flex-col items-center">
        <h1 className="text-2xl font-black text-white mb-2 uppercase tracking-tighter">בחר מסלול</h1>
        <p className="text-slate-400 text-xs font-bold mb-8">הצטרף לקהילה שמתקשרת בכל שפה</p>

        <div className="w-full space-y-4 mb-8">
          {plans.map((plan) => (
            <div key={plan.id} className="bg-slate-900 border border-white/10 rounded-3xl p-5 shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <div className="text-2xl">{plan.icon}</div>
                <div className="text-left">
                  <span className="text-2xl font-black text-white">${plan.price}</span>
                  <span className="text-slate-500 text-[10px] block font-bold italic">לחודש בחיוב שנתי</span>
                </div>
              </div>
              <h2 className="text-xl font-black text-white mb-1">{plan.name}</h2>
              <p className="text-indigo-400 text-sm font-black mb-4">{plan.tokens} טוקנים</p>
              <button 
                onClick={() => onPlanSelect(plan.id)}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-3 rounded-2xl transition-all text-sm"
              >
                בחר מסלול
              </button>
            </div>
          ))}
        </div>

        <div className="w-full bg-slate-900/50 border border-white/5 rounded-3xl p-6 text-center shadow-2xl">
          {!isSuccess ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-center gap-2 text-slate-400 font-black text-xs">
                <Gift size={16} className="text-indigo-400" />
                <span>יש לך קוד הטבה?</span>
              </div>
              <input 
                type="text" placeholder="הכנס קוד כאן" 
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:border-indigo-500 font-bold text-center text-sm"
                value={promoCode} onChange={(e) => setPromoCode(e.target.value)}
              />
              <button onClick={handleRedeem} className="w-full bg-slate-800 py-3 rounded-xl font-black text-sm transition-all">הפעל קוד</button>
            </div>
          ) : (
            <div className="animate-in fade-in zoom-in duration-300">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <Check size={24} className="text-emerald-500" />
              </div>
              <h3 className="text-lg font-black text-white mb-1 uppercase tracking-tighter">הופעל בהצלחה!</h3>
              <p className="text-slate-400 font-bold mb-5 text-[10px]">שודרגת ל-Premium בחינם</p>
              <button 
                onClick={() => onPlanSelect('PRO')} 
                className="w-full bg-indigo-600 py-4 rounded-xl font-black text-lg flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/40"
              >
                עבור לאתר <ArrowRight size={20} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Pricing;
