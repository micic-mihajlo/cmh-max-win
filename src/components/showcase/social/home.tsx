import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Txt } from '@/components/signal/txt';
import { FontFamily, Palette, Space } from '@/constants/signal';
import { creators, feed } from '@/mocks/showcase/social';
import { Enter } from '@/motion';

import { Avatar, Card, Hairline, Pill, Screen, Section, showcase } from './kit';

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
            <Txt variant="smallStrong">{c.name}</Txt>
          </Pressable>
        ))}
      </ScrollView>

      <Section title="Live now">
        {feed.live.map((l) => (
          <Enter key={l.id}>
            <Card style={styles.live}>
              <View style={showcase.row}>
                <View style={styles.liveDot} />
                <Txt variant="smallStrong" style={showcase.flex}>
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
              <View style={[showcase.row, styles.liveFoot]}>
                <Txt variant="smallStrong" style={showcase.flex}>
                  {l.stakes}
                </Txt>
                <Pill title="Join" tone="ember" style={styles.join} />
              </View>
            </Card>
          </Enter>
        ))}
      </Section>

      <Section title="Upcoming">
        <Card style={styles.list}>
          {feed.upcoming.map((u, i) => {
            const on = reminded.has(u.id);
            return (
              <View key={u.id}>
                {i > 0 ? <Hairline style={styles.gap} /> : null}
                <View style={showcase.row}>
                  <Avatar initials={u.initials} size={36} />
                  <View style={showcase.flex}>
                    <Txt variant="bodyStrong" numberOfLines={1}>
                      {u.title}
                    </Txt>
                    <Txt variant="small" color={Palette.paperMuted}>
                      {u.when} · {u.stakes}
                    </Txt>
                  </View>
                  <Pill title={on ? 'Reminded' : 'Remind me'} tone={on ? 'soft' : 'line'} onPress={() => toggle(u.id)} />
                </View>
              </View>
            );
          })}
        </Card>
      </Section>

      <Section title="Results">
        <Card style={styles.list}>
          {feed.results.map((r, i) => (
            <View key={r.id}>
              {i > 0 ? <Hairline style={styles.gap} /> : null}
              <View style={showcase.row}>
                <Avatar initials={r.initials} size={36} tone="card" />
                <View style={showcase.flex}>
                  <Txt variant="bodyStrong">{r.title}</Txt>
                  <Txt variant="small" color={Palette.paperMuted}>
                    {r.creator} · {r.line}
                  </Txt>
                  {r.you ? (
                    <Txt variant="smallStrong" color={Palette.emberDeep}>
                      {r.you}
                    </Txt>
                  ) : null}
                </View>
              </View>
            </View>
          ))}
        </Card>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  creators: { paddingHorizontal: Space.xl, gap: Space.l, paddingTop: Space.s },
  creator: { alignItems: 'center', gap: Space.xs },
  live: { gap: Space.s, padding: Space.xl, borderColor: Palette.ember },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Palette.danger },
  tiles: { flexDirection: 'row', gap: Space.s, marginTop: Space.xs },
  tile: {
    width: 48,
    height: 56,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Palette.hairline,
    backgroundColor: Palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLetter: { fontFamily: FontFamily.uiBold, fontSize: 26, lineHeight: 30, color: Palette.paper },
  liveFoot: { marginTop: Space.s },
  join: { minWidth: 96 },
  list: { paddingVertical: Space.l },
  gap: { marginVertical: Space.m },
});
