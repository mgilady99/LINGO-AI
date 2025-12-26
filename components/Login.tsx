import React, { useState } from 'react';
import { Mail, Lock, LogIn, UserPlus, Headphones } from 'lucide-react';

const Login: React.FC<{ onLoginSuccess: () => void }> = ({ onLoginSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // כאן נחבר בעתיד את ה-API שיצרנו ב-Cloudflare
    console.log("Submit:", { email, password, mode: isLogin ? 'login' : 'signup' });
    alert("נכנסת בהצלחה! (כרגע במצב פיתוח)");
    onLoginSuccess();
  };

  return (
    <div className="h-screen bg-slate-950 flex items-center justify-center p-4 font-['Inter'] rtl">
      <div className="w-full max-w-md bg-slate-900/90 rounded-[3rem] border border-white/10 p-10 shadow-2xl">
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-4">
            <Headphones size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter">LingoLive Pro</h1>
          <p className="text-slate-400 mt-2 font-bold">{isLogin ? 'ברוך השב! היכנס לחשבון' : 'צור חשבון חדש בחינם'}</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="relative">
            <Mail className="absolute right-4 top-4 text-slate-500" size={20} />
            <input 
              type="email" 
              placeholder="אימייל" 
              className="w-full bg-slate-800/50 border border-white/10 rounded-2xl py-4 pr-12 pl-4 text-white outline-none focus:border-indigo-500 transition-all font-bold"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="relative">
            <Lock className="absolute right-4 top-4 text-slate-500" size={20} />
            <input 
              type="password" 
              placeholder="סיסמה" 
              className="w-full bg-slate-800/50 border border-white/10 rounded-2xl py-4 pr-12 pl-4 text-white outline-none focus:border-indigo-500 transition-all font-bold"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button className="bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 mt-4 text-lg">
            {isLogin ? <LogIn size={20} /> : <UserPlus size={20} />}
            {isLogin ? 'התחבר עכשיו' : 'הירשם עכשיו'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-slate-400 hover:text-white text-sm font-bold transition-colors"
          >
            {isLogin ? 'אין לך חשבון? הירשם כאן' : 'כבר יש לך חשבון? התחבר כאן'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
