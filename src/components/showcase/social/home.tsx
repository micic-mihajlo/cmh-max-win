import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Txt } from '@/components/signal/txt';
import { FontFamily, Palette, Space } from '@/constants/signal';
import { creators, feed } from '@/mocks/showcase/social';
import { Enter } from '@/motion';

import { Avatar, BigButton, Screen, Section, TextAction, Wash, showcase } from './kit';

export function HomeScreen() {
  const [reminded, setReminded] = useState(() => new Set(feed.upcoming.filter((u) => u.reminded).map((u) => u.id)));
  const toggle = (id: string) =>
    setReminded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <Screen
      title="Following"
      right={
        <Pressable accessibilityRole="button" accessibilityLabel="Profile" onPress={() => router.push('/showcase/profile' as Href)}>
          <Avatar initials="KM" size={28} />
        </Pressable>
      }>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.creators}>
        {creators.map((c) => (
          <Pressable key={c.id} accessibilityRole="button" style={styles.creator} onPress={() => router.push('/showcase/creator' as Href)}>
            <Avatar initials={c.initials} size={56} live={c.live} />
            <Txt variant="small">{c.name}</Txt>
          </Pressable>
        ))}
      </ScrollView>

      {feed.live.map((l) => (
        <Enter key={l.id} style={[showcase.gutter, styles.live]}>
          <View style={showcase.row}>
            <View style={styles.liveDot} />
            <Txt variant="small" color={Palette.paperMuted}>
              {l.creator} is live · {l.here} here
            </Txt>
          </View>
          <Txt variant="title">{l.title}</Txt>
          <View style={styles.tiles}>
            {l.code.split('').map((ch, i) => (
              <View key={i} style={styles.tile}>
                <Txt style={styles.tileLetter}>{ch}</Txt>
              </View>
            ))}
          </View>
          <Txt variant="small" color={Palette.paperMuted}>
            {l.stakes}
          </Txt>
          <BigButton title="Join" style={styles.join} />
        </Enter>
      ))}

      <Section title="Upcoming">
        <View style={showcase.list}>
          {feed.upcoming.map((u) => {
            const on = reminded.has(u.id);
            return (
              <View key={u.id} style={showcase.row}>
                <Avatar initials={u.initials} size={36} />
                <View style={showcase.flex}>
                  <Txt variant="bodyStrong" numberOfLines={1}>
                    {u.title}
                  </Txt>
                  <Txt variant="small" color={Palette.paperMuted}>
                    {u.when} · {u.stakes}
                  </Txt>
                </View>
                <TextAction title={on ? 'Reminded' : 'Remind me'} muted={on} onPress={() => toggle(u.id)} />
              </View>
            );
          })}
        </View>
      </Section>

      <Section title="Results">
        <View style={showcase.list}>
          {feed.results.map((r) => (
            <View key={r.id} style={showcase.row}>
              <Avatar initials={r.initials} size={36} />
              <View style={showcase.flex}>
                <Txt variant="bodyStrong">{r.title}</Txt>
                <Txt variant="small" color={Palette.paperMuted}>
                  {r.line}
                  {r.you ? ` · ${r.you}` : ''}
                </Txt>
              </View>
            </View>
          ))}
        </View>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  creators: { paddingHorizontal: Space.xl, gap: Space.l, paddingTop: Space.s },
  creator: { alignItems: 'center', gap: Space.xs },
  live: { gap: Space.m, marginTop: Space.xxl },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Palette.danger },
  tiles: { flexDirection: 'row', gap: Space.s },
  tile: { width: 56, height: 64, borderRadius: 12, backgroundColor: Wash.neutral, alignItems: 'center', justifyContent: 'center' },
  tileLetter: { fontFamily: FontFamily.displayBold, fontSize: 32, lineHeight: 38, color: Palette.paper },
  join: { marginTop: Space.xs },
});
