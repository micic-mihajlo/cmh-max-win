import { useEffect, useState } from 'react';

import { useReduced } from '@/motion';

// Counts from `from` to `to` over 600ms with an ease-out: the one count allowed past the 300ms rule, like Checking.
// Reduce Motion shows the final value at once.
export function useCount(to: number | null, from: number | null) {
  const reduced = useReduced();
  const [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    if (to === null || from === null || reduced || from === to) return;
    const start = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const t = Math.min(1, (now - start) / 600);
      setShown(Math.round(from + (to - from) * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [to, from, reduced]);
  if (to === null) return null;
  return shown ?? (reduced || from === null ? to : from);
}
