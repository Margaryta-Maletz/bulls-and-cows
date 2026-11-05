import { useState, useEffect } from 'react';

interface Props {
  readonly startedAt: number;
  readonly timeoutSec: number;
}

function calcRemaining(startedAt: number, timeoutSec: number): number {
  return Math.max(0, timeoutSec - (Date.now() - startedAt) / 1000);
}

export default function Timer({ startedAt, timeoutSec }: Props) {
  const [remaining, setRemaining] = useState(() => calcRemaining(startedAt, timeoutSec));

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(calcRemaining(startedAt, timeoutSec));
    }, 500);
    return () => clearInterval(id);
  }, [startedAt, timeoutSec]);

  return <progress value={remaining} max={timeoutSec} />;
}
