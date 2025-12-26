import React, { useState, useEffect, useRef } from 'react';
import { Check, Zap, Crown, CreditCard, Ticket, AlertCircle } from 'lucide-react';

interface PricingProps {
  onPlanSelect: (plan: string) => void;
  userEmail?: string;
}

const Pricing: React.FC<PricingProps> = ({ onPlanSelect, userEmail }) => {
  const [promoCode, setPromoCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [paypalLoaded, setPaypalLoaded] = useState(false);
  const paypalRef = useRef<HTMLDivElement>(null);

  // --- טעינת המערכת של PayPal ---
  useEffect(() => {
    if (window.paypal) {
        setPaypalLoaded(true);
        return;
    }

    const script = document.createElement("script");
    // ה-Client ID שלך מוטמע כאן:
    const clientId = "AWmyrNxDvPJHZjVa8ZJOaUdPZ1m5K-WnCu_jl0IYq4TGotsi0RinsrX1cV8K80H2pXrL20mUvEXnTRTY";
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=ILS`;
    script.async = true;
    script.onload = () => setPaypalLoaded(true);
    document.body.appendChild(script);
  }, []);

  // --- הצגת הכפתור של PayPal ---
  useEffect(() => {
    if (paypalLoaded && window.paypal && paypalRef.current) {
        paypalRef.current.innerHTML = "";

        window.paypal.Buttons({
            // הגדרת הסכום: 1 ש"ח לבדיקה
            createOrder: (data: any, actions: any) => {
                return actions.order.create({
                    purchase_units: [{
                        description: "בדיקת מערכת LingoLive (1 שח)",
                        amount: { value: "1.00", currency_code: "ILS" }
                    }]
                });
            },
            // הצלחה בתשלום
            onApprove: async (data: any, actions: any) => {
                const order = await actions.order.capture();
                console.log("Payment Successful:", order);
                
                // הודעה למשתמש ושדרוג
                alert("התשלום עבר בהצלחה! המערכת משדרגת את המנוי שלך...");
                await upgradeUserAfterPayment();
            },
            onError: (err: any) => {
                console.error("PayPal Error:", err);
                alert("הייתה בעיה בתשלום בפייפל. נסה שוב.");
            }
        }).render(paypalRef.current);
    }
  }, [paypalLoaded]);

  // שדרוג המשתמש לאחר תשלום מוצלח
  const upgradeUserAfterPayment = async () => {
      if (!userEmail) return;
      try {
          const res = await fetch('/api/upgrade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail, promoCode: 'PAYPAL_SUCCESS_BYPASS' }) 
          });
          
          if (res.ok) {
              onPlanSelect('PRO'); // מעביר את המשתמש פנימה
          } else {
              alert("התשלום עבר בפייפל, אך הייתה שגיאה בשדרוג באתר. אנא פנה לתמיכה.");
          }
      } catch(e) { 
          alert("שגיאת תקשורת לאחר התשלום.");
      }
  };

  const handlePromoCode = async () => {
    if (!promoCode) return;
    if (!userEmail) { alert("שגיאה בזיהוי משתמש"); return; }

    setLoading(true);
    try {
      const cleanCode = promoCode.replace(/\s/g, '').toLowerCase();
      const res = await fetch('/api/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, promoCode: cleanCode })
      });
      const data = await res.json();

      if (res.ok) {
        alert("הקוד התקבל! המנוי שודרג ל-PRO.");
        onPlanSelect('PRO');
      } else {
        alert(data.error || "קוד לא תקין");
      }
    } catch (e) { alert("שגיאת תקשורת"); } 
    finally { setLoading(false); }
  };

  return (
    <div className="h-full overflow-y-auto p-8 flex flex-col items-center gap-8 bg-[#0f172a] rtl font-['Inter'] text-white">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-black text-white">בדיקת תשלום (Live)</h2>
        <p className="text-slate-400">ה-ID שלך הוטמע. כפתור זה יחייב כרטיס אשראי אמיתי ב-1 ש"ח.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 w-full max-w-4xl">
        
        {/* --- כרטיס בדיקה (1 ש"ח) --- */}
        <div className="bg-slate-900 p-8 rounded-3xl border border-yellow-500/50 flex flex-col items-center text-center shadow-lg relative">
          <div className="absolute -top-3 bg-yellow-600 text-black px-3 py-1 rounded-full text-xs font-bold">מצב בדיקה פעיל</div>
          <div className="bg-slate-800 p-4 rounded-full mb-4"><AlertCircle size={24} className="text-yellow-400"/></div>
          <h3 className="text-xl font-bold mb-2">חיוב ניסיון</h3>
          <div className="text-3xl font-black mb-1">₪1.00</div>
          <p className="text-slate-400 text-xs mb-6">תשלום חד פעמי לבדיקת המערכת</p>
          
          <div className="w-full mb-4 min-h-[150px] flex items-center justify-center">
              {/* כאן יופיע הכפתור הצהוב של פייפל */}
              <div ref={paypalRef} className="w-full"></div>
              {!paypalLoaded && <p className="text-xs text-slate-500 animate-pulse">מתחבר ל-PayPal...</p>}
          </div>
          
          <p className="text-[10px] text-slate-500 mt-2 bg-slate-950 p-2 rounded">
              ✅ Client ID מחובר<br/>
              ✅ סכום חיוב: 1.00 ILS<br/>
              ⚠️ זהו תשלום אמיתי!
          </p>
        </div>

        {/* --- כרטיס PREMIUM (לא פעיל כרגע) --- */}
        <div className="bg-slate-900 p-8 rounded-3xl border border-indigo-500 relative flex flex-col items-center text-center shadow-2xl opacity-40 grayscale">
          <div className="absolute -top-4 bg-indigo-600 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider">מומלץ</div>
          <div className="bg-indigo-600/20 p-4 rounded-full mb-4"><Crown size={24} className="text-indigo-400"/></div>
          <h3 className="text-xl font-bold mb-2 text-white">PREMIUM</h3>
          <div className="text-3xl font-black mb-1 text-white">$142.80</div>
          <p className="text-slate-400 text-xs mb-6">לא פעיל כרגע</p>
          <button disabled className="w-full bg-slate-800 text-slate-400 py-3 rounded-xl font-bold flex items-center justify-center gap-2 mb-3 cursor-not-allowed">
             <CreditCard size={18}/> PayPal
          </button>
        </div>
      </div>

      {/* אזור קוד הטבה (עדיין עובד) */}
      <div className="w-full max-w-md bg-slate-900/80 p-6 rounded-2xl border border-white/10 mt-4 backdrop-blur-sm">
        <label className="text-sm font-bold text-slate-400 mb-2 block flex items-center gap-2">
            <Ticket size={16} className="text-indigo-400"/> או השתמש בקוד הטבה
        </label>
        <div className="flex gap-2">
            <input 
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder="למשל: gift10003"
                className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:border-indigo-500 text-center"
            />
            <button 
                onClick={handlePromoCode}
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-500 px-6 py-2 rounded-xl font-bold text-white transition-all disabled:opacity-50"
            >
                {loading ? 'הפעל' : 'הפעל'}
            </button>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
