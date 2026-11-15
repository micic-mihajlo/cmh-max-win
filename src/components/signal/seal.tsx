import { RoleMeta } from '@/constants/signal';
import type { Role } from '@/lib/contract';
import { Seal as MotionSeal } from '@/motion';

export function Seal({ role, filled, size = 64, broken, play }: { role: Role; filled: boolean; size?: number; broken?: boolean; play?: boolean }) {
  const meta = RoleMeta[role];
  return (
    <MotionSeal
      locked={filled}
      color={meta.color}
      initial={meta.glyph}
      size={size}
      dimmed={broken}
      play={play}
      accessibilityLabel={`${meta.label} ${filled ? 'locked in' : 'not locked in'}`}
    />
  );
}
