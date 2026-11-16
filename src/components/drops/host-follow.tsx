import { StyleSheet, View } from 'react-native';

import { Txt } from '@/components/signal/txt';
import { Palette, Space } from '@/constants/signal';
import { PressScale } from '@/motion';

export type HostFollowProps = {
  name: string;
  following: boolean;
  onFollow?: () => void;
  next: { startsAt: number; reminded: boolean; onRemind?: () => void } | null; // the host's next scheduled drop
};

// 'Fri 9 pm', or 'Fri 9:30 pm' off the hour.
function when(at: number) {
  const d = new Date(at);
  const day = d.toLocaleDateString('en-US', { weekday: 'short' });
  const h = d.getHours() % 12 || 12;
  const m = d.getMinutes() ? ':' + String(d.getMinutes()).padStart(2, '0') : '';
  return day + ' ' + h + m + (d.getHours() < 12 ? ' am' : ' pm');
}

// End-of-drop retention: one row that morphs in place. Follow the host, then Remind me for their next drop.
export function HostFollow({ name, following, onFollow, next }: HostFollowProps) {
  const action = !following ? { title: 'Follow', quiet: false, onPress: onFollow } : next ? { title: next.reminded ? 'Reminded' : 'Remind me', quiet: next.reminded, onPress: next.onRemind } : null;
  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <Txt variant="bodyStrong" numberOfLines={1}>
          {following ? `Following ${name}` : `Follow ${name}`}
        </Txt>
        <Txt variant="small" color={Palette.paperMuted} numberOfLines={1}>
          {next ? `Next drop · ${when(next.startsAt)}` : following ? `You’ll hear when ${name} goes live.` : `Hear when ${name} goes live.`}
        </Txt>
      </View>
      {action ? (
        <PressScale accessibilityRole="button" haptic="tap" hitSlop={12} onPress={action.onPress} disabled={action.quiet}>
          <Txt variant="bodyStrong" color={action.quiet ? Palette.paperMuted : Palette.paper}>
            {action.title}
          </Txt>
        </PressScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Space.m, minHeight: 52 },
});
