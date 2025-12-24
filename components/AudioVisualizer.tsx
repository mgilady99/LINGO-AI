
import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  isActive: boolean;
  color: string;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isActive, color }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    const bars = 16;
    const barWidth = canvas.width / bars;
    
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = color;

      for (let i = 0; i < bars; i++) {
        // Create a pulsating effect when active, otherwise small static bars
        const baseHeight = isActive ? Math.random() * canvas.height * 0.7 + 5 : 4;
        const x = i * barWidth;
        const width = barWidth - 2;
        const y = (canvas.height - baseHeight) / 2;
        
        ctx.beginPath();
        ctx.roundRect(x, y, width, baseHeight, 2);
        ctx.fill();
      }

      animationId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationId);
  }, [isActive, color]);

  return (
    <canvas 
      ref={canvasRef} 
      width={100} 
      height={30} 
      className={`transition-opacity duration-500 ${isActive ? 'opacity-100' : 'opacity-20'}`}
    />
  );
};

export default AudioVisualizer;
