import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/signal/icon';
import { Button, Label } from '@/components/signal/primitives';
import { host } from '@/components/signal/room';
import { useMotionReduced } from '@/components/signal/settings';
import { Txt } from '@/components/signal/txt';
import { Palette, Radius, Space } from '@/constants/signal';
import type { RoomView } from '@/lib/contract';
import { Sheet } from '@/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type MenuMode = 'menu' | 'lobby' | 'confirm-restart' | 'confirm-leave';

export type MenuActions = {
  onClose?: () => void;
  onShare?: () => void;
  onRestart?: () => void;
  onConfirmRestart?: () => void;
  onLeave?: () => void;
  onConfirmLeave?: () => void;
  onSuspects?: () => void;
};

export function CaseMenu({ room, mode, actions = {} }: { room: RoomView; mode: MenuMode; actions?: MenuActions }) {
  const insets = useSafeAreaInsets();
  const reduced = useMotionReduced();
  const hostName = host(room)?.name ?? 'the host';
  return (
    <>
      <AnimatedPressable accessibilityLabel="Close menu" onPress={actions.onClose} entering={Sheet.scrimIn} exiting={Sheet.scrimOut} style={styles.scrim} />
      <Animated.View
        entering={Sheet.enter(reduced)}
        exiting={Sheet.exit(reduced)}
        style={[styles.sheet, { paddingBottom: insets.bottom + Space.l }]}>
        <View style={styles.handle} />
        {mode === 'confirm-leave' ? (
          <View style={styles.confirm}>
            <Txt variant="title">Leave the case?</Txt>
            <Txt variant="body" color={Palette.paperMuted}>
              The case can’t finish without your evidence. Your seat stays open for you to come back to.
            </Txt>
            <Button title="Stay in the case" onPress={actions.onClose} />
            <Button title="Leave anyway" variant="secondary" onPress={actions.onConfirmLeave} />
          </View>
        ) : mode === 'lobby' ? (
          <View style={styles.items}>
            <Label>{`Room ${room.code}`}</Label>
            <Item icon="link" title="Share invite" value="Code first, link second" onPress={actions.onShare} />
            <Item icon="speaker.slash" title="Sound" value="Off" />
            <Item icon="rectangle.portrait.and.arrow.right" title="Leave case" onPress={actions.onConfirmLeave} />
          </View>
        ) : mode === 'confirm-restart' ? (
          <View style={styles.confirm}>
            <View style={styles.warnIcon}>
              <Icon name="arrow.counterclockwise" size={22} color={Palette.danger} />
            </View>
            <Txt variant="title">Restart Case 01?</Txt>
            <Txt variant="body" color={Palette.paperMuted}>
              Everyone goes back to the lobby with the same roles. The theory and lock-ins are cleared.
            </Txt>
            <Button title="Restart case" variant="danger" onPress={actions.onConfirmRestart} />
            <Button title="Keep playing" variant="secondary" onPress={actions.onClose} />
          </View>
        ) : (
          <View style={styles.items}>
            <Label>{room.drop ? `${room.drop.title} · ${room.drop.squadLabel}` : `Case 01 · room ${room.code}`}</Label>
            <Item icon="person.3" title="Suspect directory" onPress={actions.onSuspects} />
            <Item icon="speaker.slash" title="Sound" value="Off" />
            {room.drop ? null : room.isHost ? (
              <Item icon="arrow.counterclockwise" title="Restart case" danger onPress={actions.onRestart} />
            ) : (
              <View style={styles.item}>
                <Icon name="lock" size={18} color={Palette.paperFaint} />
                <View style={styles.flex}>
                  <Txt variant="bodyStrong" color={Palette.paperMuted}>
                    Restart case
                  </Txt>
                  <Txt variant="small" color={Palette.paperMuted}>
                    Only {hostName} (host) can restart.
                  </Txt>
                </View>
              </View>
            )}
            <Item icon="rectangle.portrait.and.arrow.right" title="Leave case" muted onPress={actions.onLeave} />
          </View>
        )}
      </Animated.View>
    </>
  );
}

function Item({
  icon,
  title,
  value,
  danger,
  muted,
  onPress,
}: {
  icon: Parameters<typeof Icon>[0]['name'];
  title: string;
  value?: string;
  danger?: boolean;
  muted?: boolean;
  onPress?: () => void;
}) {
  const color = danger ? Palette.danger : muted ? Palette.paperMuted : Palette.paper;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.item}>
      <Icon name={icon} size={18} color={color} />
      <Txt variant="bodyStrong" color={color} style={styles.flex}>
        {title}
      </Txt>
      {value ? (
        <Txt variant="small" color={Palette.paperMuted}>
          {value}
        </Txt>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(5,6,8,0.72)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Palette.panel,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderTopWidth: 1,
    borderColor: Palette.hairline,
    paddingHorizontal: Space.xl,
    paddingTop: Space.s,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: Palette.hairline, marginBottom: Space.l },
  items: { gap: 2 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.l,
    paddingVertical: Space.l,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.hairline,
  },
  confirm: { gap: Space.m, paddingBottom: Space.s },
  warnIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(224,122,107,0.14)',
  },
});
