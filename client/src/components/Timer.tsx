import { useState, useEffect } from 'react';

interface Props {
  readonly startedAt: number;
  readonly timeoutSec: number;
}

function calcRemaining(startedAt: number, timeoutSec: number): number {
  return Math.max(0, timeoutSec - (Date.now() - startedAt) / 1000);
}

function barColor(fraction: number): string {
  if (fraction > 0.5) return '#22c55e';
  if (fraction > 0.2) return '#f59e0b';
  return '#ef4444';
}

export default function Timer({ startedAt, timeoutSec }: Props) {
  if (timeoutSec === 0) return null;
  const [remaining, setRemaining] = useState(() => calcRemaining(startedAt, timeoutSec));

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(calcRemaining(startedAt, timeoutSec));
    }, 500);
    return () => clearInterval(id);
  }, [startedAt, timeoutSec]);

  const fraction  = timeoutSec > 0 ? remaining / timeoutSec : 0;
  const barStyle  = {
    width: String(Math.round(fraction * 100)) + '%',
    backgroundColor: barColor(fraction),
  };

  return (
    <div className="timer-track">
      <div className="timer-bar" style={barStyle} />
    </div>
  );
}
