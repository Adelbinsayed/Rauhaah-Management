import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  onFinish?: () => void;
  statusMessage?: string;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onFinish,
  statusMessage,
}) => {
  const [progress, setProgress] = useState(15);
  const [msg, setMsg] = useState('Starting Rauhaah Management…');

  useEffect(() => {
    const steps = [
      { pct: 35, delay: 200, text: 'Initialising portable database…' },
      { pct: 65, delay: 500, text: 'Checking workspace & security…' },
      { pct: 85, delay: 800, text: 'Loading catalog & settings…' },
      { pct: 100, delay: 1100, text: 'Welcome back.' },
    ];

    const timers = steps.map((s) =>
      setTimeout(() => {
        setProgress(s.pct);
        setMsg(s.text);
      }, s.delay)
    );

    const finishTimer = setTimeout(() => {
      onFinish?.();
    }, 1350);

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(finishTimer);
    };
  }, [onFinish]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#202020] select-none overflow-hidden">
      <div className="w-full max-w-[580px] h-[360px] mx-4 bg-[#202020] border border-[#2e2e2e] rounded-2xl shadow-2xl flex flex-col relative overflow-hidden">
        {/* Golden Accent Top Bar */}
        <div className="h-[3px] bg-gradient-to-r from-[#c89a0a] via-[#EFB810] to-[#f5d060] shrink-0" />

        {/* Central Content */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 relative">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_45%,rgba(239,184,16,0.08)_0%,transparent_100%)] pointer-events-none" />

          {/* Logo */}
          <div className="mb-5 flex items-center justify-center">
            <img
              src="/assets/rauhaah-logo-white.png"
              alt="Rauhaah — Live Peaceful"
              className="max-w-[260px] max-h-[100px] object-contain drop-shadow-[0_4px_24px_rgba(239,184,16,0.25)]"
            />
          </div>

          <div className="w-9 h-[1px] bg-[#333] mb-5" />

          {/* Badges */}
          <div className="flex gap-2">
            {['Inventory', 'POS', 'Reports', 'Blends'].map((b) => (
              <span
                key={b}
                className="px-3 py-1 border border-[#333] rounded-full text-[10px] text-[#777] tracking-wider uppercase font-medium"
              >
                {b}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom Progress Bar & Status */}
        <div className="px-6 py-4 shrink-0 bg-[#1c1c1c]/50 border-t border-[#2a2a2a]/40">
          <div className="flex justify-between items-center mb-1.5 text-[11px]">
            <span className="text-[#888] font-mono">
              {statusMessage || msg}
            </span>
            <span className="text-[#555] font-mono">v1.0.0</span>
          </div>

          {/* Progress Track */}
          <div className="h-[3px] bg-[#2a2a2a] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#c89a0a] via-[#EFB810] to-[#f5d060] transition-all duration-300 ease-out rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="text-[10px] text-[#444] text-center mt-2 font-mono">
            &copy; 2026 Sooktec &bull; Rauhaah Management &bull; Offline Desktop POS
          </div>
        </div>
      </div>
    </div>
  );
};
