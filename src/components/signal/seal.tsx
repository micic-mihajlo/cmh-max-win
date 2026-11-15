import { RoleMeta } from '@/constants/signal';
import type { Role } from '@/lib/contract';
import { Seal as MotionSeal } from '@/motion';

export function Seal({
  role,
  filled,
  size = 64,
  broken,
  play,
  haptic,
  initial,
}: {
  role: Role;
  filled: boolean;
  size?: number;
  broken?: boolean;
  play?: boolean;
  haptic?: boolean;
  initial?: string;
}) {
  const meta = RoleMeta[role];
  return (
    <MotionSeal
      locked={filled}
      color={meta.color}
      initial={initial ?? meta.glyph}
      size={size}
      dimmed={broken}
      play={play}
      haptic={haptic}
      accessibilityLabel={`${meta.label} ${filled ? 'locked in' : 'not locked in'}`}
    />
  );
}
