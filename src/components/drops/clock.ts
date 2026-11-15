import { useEffect, useState } from 'react';

// Server time, ticking each second. offset comes from useServerOffset() (ms to add to Date.now(), null until
// measured); query results are cached, so countdowns never read a server timestamp off a query.
export function useServerClock(offset: number | null) {
  const [device, setDevice] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setDevice(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return device + (offset ?? 0);
}
