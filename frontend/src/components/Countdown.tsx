import { useEffect, useState } from 'react';

/** mm:ss countdown from an ISO timestamp; calls onExpire when it hits zero. */
export function Countdown({ expiresAt, onExpire }: { expiresAt: string; onExpire?: () => void }) {
  const target = new Date(expiresAt).getTime();
  const [remaining, setRemaining] = useState(() => Math.max(0, target - Date.now()));

  useEffect(() => {
    const timer = setInterval(() => {
      const left = Math.max(0, target - Date.now());
      setRemaining(left);
      if (left <= 0) {
        clearInterval(timer);
        onExpire?.();
      }
    }, 500);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt]);

  const totalSeconds = Math.floor(remaining / 1000);
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');

  return (
    <span className={remaining < 60_000 ? 'font-mono text-red-400' : 'font-mono text-emerald-400'}>
      {mm}:{ss}
    </span>
  );
}