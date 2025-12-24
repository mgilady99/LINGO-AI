
import React from 'react';

interface AvatarProps { state: 'idle' | 'listening' | 'speaking' | 'thinking'; }

const Avatar: React.FC<AvatarProps> = ({ state }) => {
  const isSpeaking = state === 'speaking';
  const isListening = state === 'listening';
  
  return (
    <div className="relative w-48 h-48 md:w-56 md:h-56 shrink-0">
      <div className={`absolute inset-0 rounded-full blur-[50px] opacity-20 transition-all duration-700 ${isSpeaking ? 'bg-indigo-500 scale-150' : isListening ? 'bg-emerald-500 scale-125' : 'bg-slate-700 scale-100'}`} />
      <div className="relative w-full h-full rounded-full border-4 border-slate-800 overflow-hidden bg-slate-900 z-10 shadow-[0_0_60px_rgba(0,0,0,0.5)]">
        <img 
          src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=600" 
          className={`w-full h-full object-cover transition-transform duration-700 ${isSpeaking ? 'scale-110 brightness-110' : 'scale-100 grayscale-[0.2]'}`} 
          alt="AI Partner"
        />
        {state === 'thinking' && (
          <div className="absolute inset-0 bg-indigo-900/40 backdrop-blur-sm flex items-center justify-center gap-2">
            <div className="w-2.5 h-2.5 bg-white rounded-full animate-bounce" />
            <div className="w-2.5 h-2.5 bg-white rounded-full animate-bounce [animation-delay:0.2s]" />
            <div className="w-2.5 h-2.5 bg-white rounded-full animate-bounce [animation-delay:0.4s]" />
          </div>
        )}
      </div>
      {isSpeaking && (
        <div className="absolute -inset-4 border-2 border-indigo-500 rounded-full animate-ping opacity-20" />
      )}
    </div>
  );
};

export default Avatar;
