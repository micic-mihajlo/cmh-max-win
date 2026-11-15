import { useEffect, useState } from 'react';

import { Txt } from '@/components/signal/txt';
import { FontFamily } from '@/constants/signal';

const pad = (n: number) => String(n).padStart(2, '0');

export function Countdown({ seconds, size = 40 }: { seconds: number; size?: number }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    const id = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  const text = `${pad(Math.floor(left / 3600))}:${pad(Math.floor((left % 3600) / 60))}:${pad(left % 60)}`;
  return (
    <Txt accessibilityLabel={`Starts in ${text}`} style={{ fontFamily: FontFamily.uiBold, fontSize: size, lineHeight: size * 1.15, letterSpacing: -1, fontVariant: ['tabular-nums'] }}>
      {text}
    </Txt>
  );
}
