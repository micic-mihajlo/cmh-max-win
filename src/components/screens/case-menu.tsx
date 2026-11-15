import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/signal/icon';
import { Button, Label } from '@/components/signal/primitives';
import { host } from '@/components/signal/room';
import { useMotionReduced } from '@/components/signal/settings';
import { Txt } from '@/components/signal/txt';
import { Palette, Radius, Space } from '@/constants/signal';
import type { RoomView } from '@/mocks/contract';

export type MenuMode = 'menu' | 'lobby' | 'confirm-restart' | 'confirm-leave';

export function CaseMenu({ room, mode }: { room: RoomView; mode: MenuMode }) {
  const insets = useSafeAreaInsets();
  const reduced = useMotionReduced();
  const hostName = host(room)?.name ?? 'the host';
  return (
    <>
      <Animated.View entering={reduced ? undefined : FadeIn} style={styles.scrim} />
      <Animated.View
        entering={reduced ? undefined : SlideInDown.springify().damping(20)}
        style={[styles.sheet, { paddingBottom: insets.bottom + Space.l }]}>
        <View style={styles.handle} />
        {mode === 'confirm-leave' ? (
          <View style={styles.confirm}>
            <Txt variant="title">Leave the case?</Txt>
            <Txt variant="body" color={Palette.paperMuted}>
              The case can’t finish without your evidence. Your seat stays open for you to come back to.
            </Txt>
            <Button title="Stay in the case" />
            <Button title="Leave anyway" variant="secondary" />
          </View>
        ) : mode === 'lobby' ? (
          <View style={styles.items}>
            <Label>{`Room ${room.code}`}</Label>
            <Item icon="link" title="Copy invite link" value="Opens the app" />
            <Item icon="speaker.slash" title="Sound" value="Off" />
            <Item icon="rectangle.portrait.and.arrow.right" title="Leave case" />
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
            <Button title="Restart case" variant="danger" />
            <Button title="Keep playing" variant="secondary" />
          </View>
        ) : (
          <View style={styles.items}>
            <Label>{`Case 01 · room ${room.code}`}</Label>
            <Item icon="doc.text" title="Shared briefing" />
            <Item icon="person.3" title="Suspect directory" />
            <Item icon="speaker.slash" title="Sound" value="Off" />
            {room.isHost ? (
              <Item icon="arrow.counterclockwise" title="Restart case" danger />
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
            <Item icon="rectangle.portrait.and.arrow.right" title="Leave case" muted />
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
}: {
  icon: Parameters<typeof Icon>[0]['name'];
  title: string;
  value?: string;
  danger?: boolean;
  muted?: boolean;
}) {
  const color = danger ? Palette.danger : muted ? Palette.paperMuted : Palette.paper;
  return (
    <Pressable accessibilityRole="button" style={styles.item}>
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
