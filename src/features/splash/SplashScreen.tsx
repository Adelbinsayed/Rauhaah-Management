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
      { pct: 100, delay: 1100, text: 'Ready' },
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-canvas select-none overflow-hidden">
      <div className="w-full max-w-[580px] h-[360px] mx-4 bg-surface border border-hairline rounded-2xl flex flex-col relative overflow-hidden">
        <div className="h-[2px] bg-accent shrink-0" />

        <div className="flex-1 flex flex-col items-center justify-center p-8 relative">
          <div className="mb-5 flex items-center justify-center">
            <img
              src="/assets/rauhaah-logo-white.png"
              alt="Rauhaah — Live Peaceful"
              className="hidden dark:block max-w-[260px] max-h-[100px] object-contain"
            />
            <img
              src="/assets/rauhaah-logo-dark.png"
              alt="Rauhaah — Live Peaceful"
              className="block dark:hidden max-w-[260px] max-h-[100px] object-contain"
            />
          </div>

          <div className="w-9 h-[1px] bg-hairline-strong mb-5" />

          <div className="flex gap-2">
            {['Inventory', 'POS', 'Reports', 'Blends'].map((b) => (
              <span
                key={b}
                className="px-3 py-1 border border-hairline bg-raised rounded-md text-xs text-ink-muted font-medium"
              >
                {b}
              </span>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 shrink-0 bg-sidebar border-t border-hairline">
          <div className="flex justify-between items-center mb-2 text-xs">
            <span className="text-ink-secondary font-mono">
              {statusMessage || msg}
            </span>
            <span className="text-ink-muted font-mono tabular-nums">v1.0.0</span>
          </div>

          <div className="h-[3px] bg-raised rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-[width] duration-300 ease-unslop rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="text-[11px] text-ink-muted text-center mt-2">
            &copy; 2026 Sooktec &bull; Rauhaah Management &bull; Offline Desktop POS
          </div>
        </div>
      </div>
    </div>
  );
};
