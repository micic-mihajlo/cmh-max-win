import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/signal/primitives';
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

// End-of-drop retention: one tap to follow the host, then Remind me for their next drop.
export function HostFollow({ name, following, onFollow, next }: HostFollowProps) {
  if (!following) return <Button title={`Follow ${name}`} variant="secondary" onPress={onFollow} />;
  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <Txt variant="bodyStrong" numberOfLines={1}>{`Following ${name}`}</Txt>
        <Txt variant="small" color={Palette.paperMuted} numberOfLines={1}>
          {next ? `Next drop · ${when(next.startsAt)}` : `You’ll hear when ${name} goes live.`}
        </Txt>
      </View>
      {next ? (
        <PressScale accessibilityRole="button" haptic="tap" hitSlop={12} onPress={next.onRemind} disabled={next.reminded}>
          <Txt variant="bodyStrong" color={next.reminded ? Palette.paperMuted : Palette.paper}>
            {next.reminded ? 'Reminded' : 'Remind me'}
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
