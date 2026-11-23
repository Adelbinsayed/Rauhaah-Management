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
  const [activeBadges, setActiveBadges] = useState<Set<string>>(new Set());

  useEffect(() => {
    const steps = [
      { pct: 25, delay: 300,  text: 'Connecting offline SQLite database…', badge: 'Inventory' },
      { pct: 50, delay: 900,  text: 'Verifying security credentials & session…', badge: 'Inventory' },
      { pct: 75, delay: 1500, text: 'Loading luxury catalog & pricing…', badge: 'POS' },
      { pct: 90, delay: 2100, text: 'Preparing POS counter register & reports…', badge: 'Reports' },
      { pct: 100, delay: 2600, text: 'Welcome back to Rauhaah. Live Peaceful.', badge: 'Blends' },
    ];

    const timers = steps.map((s) =>
      setTimeout(() => {
        setProgress(s.pct);
        setMsg(s.text);
        if (s.badge) {
          setActiveBadges((prev) => new Set([...prev, s.badge]));
        }
      }, s.delay)
    );

    const finishTimer = setTimeout(() => {
      onFinish?.();
    }, 3100);

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(finishTimer);
    };
  }, [onFinish]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-canvas select-none overflow-hidden animate-fade-in">
      <div className="w-full max-w-[580px] h-[360px] mx-4 bg-surface border border-hairline rounded-2xl flex flex-col relative overflow-hidden shadow-2xl">
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
            {['Inventory', 'POS', 'Reports', 'Blends'].map((b) => {
              const active = activeBadges.has(b);
              return (
                <span
                  key={b}
                  className={`px-3 py-1 border rounded-md text-xs font-medium transition-colors duration-200 ${
                    active
                      ? 'border-accent/40 bg-accent/10 text-accent font-semibold'
                      : 'border-hairline bg-raised text-ink-muted'
                  }`}
                >
                  {b}
                </span>
              );
            })}
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
