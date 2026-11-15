import { useEffect, useState } from 'react';

// A clock on the server's timeline: elapsed device time is added to the last serverNow, so every phone shows the same countdown.
export function useServerNow(serverNow: number) {
  const [tick, setTick] = useState({ from: serverNow, elapsed: 0 });
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setTick({ from: serverNow, elapsed: Date.now() - start }), 1000);
    return () => clearInterval(id);
  }, [serverNow]);
  return serverNow + (tick.from === serverNow ? tick.elapsed : 0);
}
