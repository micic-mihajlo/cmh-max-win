import * as Haptics from 'expo-haptics';

function safe(run: () => Promise<void>) {
  try {
    run().catch(() => {});
  } catch {}
}

// One haptic per user-caused moment, fired on the same frame as its visual. Never the only feedback.
export const Haptic = {
  select: () => safe(() => Haptics.selectionAsync()),
  tap: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  thud: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
} as const;

export type HapticName = keyof typeof Haptic;
