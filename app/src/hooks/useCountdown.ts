import { useEffect, useState } from 'react';

export interface Countdown {
  secondsLeft: number;
  running: boolean;
  done: boolean;
  pause: () => void;
  resume: () => void;
  restart: () => void;
}

export function useCountdown(totalSeconds: number, autoStart = true): Countdown {
  const total = totalSeconds * 1000;
  const [endAt, setEndAt] = useState<number | null>(() => (autoStart ? Date.now() + total : null));
  const [pausedLeft, setPausedLeft] = useState(total);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [endAt]);

  const left = endAt === null ? pausedLeft : Math.max(0, endAt - now);

  useEffect(() => {
    if (endAt !== null && left === 0) {
      setEndAt(null);
      setPausedLeft(0);
    }
  }, [endAt, left]);

  return {
    secondsLeft: Math.ceil(left / 1000),
    running: endAt !== null,
    done: left === 0,
    pause: () => {
      if (endAt === null) return;
      setPausedLeft(Math.max(0, endAt - Date.now()));
      setEndAt(null);
    },
    resume: () => {
      if (endAt !== null || pausedLeft === 0) return;
      setNow(Date.now());
      setEndAt(Date.now() + pausedLeft);
    },
    restart: () => {
      setNow(Date.now());
      setPausedLeft(total);
      setEndAt(Date.now() + total);
    },
  };
}

export function formatClock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
