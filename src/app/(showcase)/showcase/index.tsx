import { Link, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Card, Hairline, Screen, showcase } from '@/components/showcase/social/kit';
import { Txt } from '@/components/signal/txt';
import { Palette, Radius, Space } from '@/constants/signal';

const sections: { title: string; items: { href: Href; title: string; line: string; preview?: boolean }[] }[] = [
  {
    title: 'Players',
    items: [
      { href: '/showcase/sign-in' as Href, title: 'Sign in', line: 'Continue with Whop or Apple, claim a handle', preview: true },
      { href: '/showcase/profile' as Href, title: 'Profile', line: 'Stats, season packs, recent squads', preview: true },
      { href: '/showcase/creator' as Href, title: 'Creator page', line: "Nova's drops, season and next countdown", preview: true },
      { href: '/showcase/home' as Href, title: 'Following', line: 'Live now, upcoming drops, results', preview: true },
      { href: '/showcase/notifications' as Href, title: 'Notifications', line: 'Inbox and push banner', preview: true },
      { href: '/showcase/notification-settings' as Href, title: 'Notification settings', line: 'Drops and results, per creator', preview: true },
    ],
  },
  {
    title: 'Creators',
    items: [
      { href: '/studio' as Href, title: 'Creator studio', line: 'Your drops, players and season', preview: true },
      { href: '/studio/builder' as Href, title: 'Challenge builder', line: 'Write a case, split it into pieces' },
      { href: '/studio/generate' as Href, title: 'Generate a puzzle', line: 'Draft a case from a premise' },
      { href: '/studio/community' as Href, title: 'Community cases', line: 'Cases other creators shared', preview: true },
      { href: '/studio/preview' as Href, title: 'Player preview', line: 'See your case on a phone' },
    ],
  },
];

export default function ShowcaseIndex() {
  return (
    <Screen back={false}>
      <View style={[showcase.gutter, styles.head]}>
        <Txt variant="display">Explore SIGNAL</Txt>
        <Txt variant="body" color={Palette.paperMuted}>
          Where SIGNAL goes next. Every screen here runs on sample data.
        </Txt>
      </View>
      {sections.map((s) => (
        <View key={s.title} style={[showcase.gutter, styles.section]}>
          <Txt variant="name">{s.title}</Txt>
          <Card style={styles.card}>
            {s.items.map((item, i) => (
              <View key={item.title}>
                {i > 0 ? <Hairline /> : null}
                <Link href={item.href} style={styles.row}>
                  <View style={[showcase.row, styles.rowInner]}>
                    <View style={showcase.flex}>
                      <Txt variant="bodyStrong">{item.title}</Txt>
                      <Txt variant="small" color={Palette.paperMuted}>
                        {item.line}
                      </Txt>
                    </View>
                    {item.preview ? (
                      <View style={styles.tag}>
                        <Txt variant="label" color={Palette.paperMuted}>
                          Preview
                        </Txt>
                      </View>
                    ) : null}
                    <Txt variant="name" color={Palette.paperMuted}>
                      ›
                    </Txt>
                  </View>
                </Link>
              </View>
            ))}
          </Card>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: Space.s, marginTop: Space.s },
  section: { marginTop: Space.xxl, gap: Space.m },
  card: { paddingVertical: 0 },
  row: { paddingVertical: Space.l },
  rowInner: { width: '100%' },
  tag: { borderWidth: 1, borderColor: Palette.hairline, borderRadius: Radius.pill, paddingHorizontal: Space.s, paddingVertical: 2 },
});
