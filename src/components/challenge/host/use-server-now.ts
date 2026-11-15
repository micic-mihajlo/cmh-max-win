import { useCallback, useEffect, useRef, useState } from "react";

// The server's clock: now ticks four times a second while ticking; read() gives it on demand in effects.
export function useServerNow(
  serverNow: number | null | undefined,
  ticking: boolean,
) {
  const offset = useRef(0);
  const [now, setNow] = useState(() => serverNow ?? 0);
  useEffect(() => {
    if (serverNow) offset.current = serverNow - Date.now();
  }, [serverNow]);
  const read = useCallback(() => Date.now() + offset.current, []);
  useEffect(() => {
    if (!ticking) return;
    const tick = () => setNow(read());
    const id = setInterval(tick, 250);
    const first = setTimeout(tick, 0);
    return () => {
      clearInterval(id);
      clearTimeout(first);
    };
  }, [ticking, read]);
  return { now, read };
}
