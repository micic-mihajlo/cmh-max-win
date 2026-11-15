import { Link, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Screen, showcase } from '@/components/showcase/social/kit';
import { Txt } from '@/components/signal/txt';
import { Palette, Space } from '@/constants/signal';

const sections: { title: string; items: { href: Href; title: string; line: string; preview?: boolean }[] }[] = [
  {
    title: 'Players',
    items: [
      { href: '/showcase/sign-in' as Href, title: 'Sign in', line: 'Whop or Apple, then a handle', preview: true },
      { href: '/showcase/profile' as Href, title: 'Profile', line: 'Stats, packs and squads', preview: true },
      { href: '/showcase/creator' as Href, title: 'Streamer page', line: "Nova's page with Follow", preview: true },
      { href: '/showcase/home' as Href, title: 'Following', line: 'Live now and coming up', preview: true },
      { href: '/showcase/notifications' as Href, title: 'Notifications', line: 'Going live and room starting', preview: true },
      { href: '/showcase/notification-settings' as Href, title: 'Notification settings', line: 'Per streamer', preview: true },
    ],
  },
  {
    title: 'Creators',
    items: [
      { href: '/studio' as Href, title: 'Creator studio', line: 'Drops, players, season', preview: true },
      { href: '/studio/builder' as Href, title: 'Challenge builder', line: 'Write a case in pieces' },
      { href: '/studio/generate' as Href, title: 'Generate a puzzle', line: 'Draft from a premise' },
      { href: '/studio/community' as Href, title: 'Community cases', line: 'Shared by creators', preview: true },
      { href: '/studio/preview' as Href, title: 'Player preview', line: 'Your case on a phone' },
    ],
  },
];

export default function ShowcaseIndex() {
  return (
    <Screen back={false}>
      <View style={[showcase.gutter, styles.head]}>
        <Txt variant="display">Explore</Txt>
      </View>
      {sections.map((s) => (
        <View key={s.title} style={[showcase.gutter, styles.section]}>
          <Txt variant="bodyStrong" color={Palette.paperMuted}>
            {s.title}
          </Txt>
          {s.items.map((item) => (
            <Link key={item.title} href={item.href} style={styles.row}>
              <View style={[showcase.row, styles.rowInner]}>
                <View style={showcase.flex}>
                  <Txt variant="bodyStrong">{item.title}</Txt>
                  <Txt variant="small" color={Palette.paperMuted} numberOfLines={1}>
                    {item.line}
                  </Txt>
                </View>
                {item.preview ? (
                  <Txt variant="small" color={Palette.paperMuted}>
                    Preview
                  </Txt>
                ) : null}
                <Txt variant="name" color={Palette.paperMuted}>
                  ›
                </Txt>
              </View>
            </Link>
          ))}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { marginTop: Space.s },
  section: { marginTop: Space.xxl, gap: Space.xs },
  row: { paddingVertical: Space.m },
  rowInner: { width: '100%' },
});
