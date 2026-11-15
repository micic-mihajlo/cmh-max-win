import { Link, Redirect } from 'expo-router';
import { Pressable, SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Atmosphere } from '@/components/signal/backdrop';
import { Label } from '@/components/signal/primitives';
import { Txt } from '@/components/signal/txt';
import { Palette, Radius, Space } from '@/constants/signal';
import type { MockState } from '@/mocks/gallery';
import { gallery } from '@/mocks/load';

const states = gallery?.MockStates ?? [];

const sections = states.reduce<{ title: string; data: MockState[] }[]>((acc, s) => {
  const last = acc[acc.length - 1];
  if (last?.title === s.section) last.data.push(s);
  else acc.push({ title: s.section, data: [s] });
  return acc;
}, []);

export default function Gallery() {
  if (!gallery) return <Redirect href="/" />;
  return (
    <View style={styles.root}>
      <Atmosphere />
      <SafeAreaView style={styles.flex} edges={['top']}>
        <SectionList
          sections={sections}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={
            <View style={styles.head}>
              <Label color={Palette.paperMuted}>Signal · state gallery</Label>
              <Txt variant="display">Every screen state</Txt>
              <Txt variant="small" color={Palette.paperMuted}>
                {states.length} states from STATE-MATRIX v2 plus Lane B’s battle-test (LB). Each opens the real screen on Case 01 fixtures.
              </Txt>
            </View>
          }
          renderSectionHeader={({ section }) => (
            <Label style={styles.sectionHead} color={Palette.paperMuted}>
              {section.title}
            </Label>
          )}
          renderItem={({ item }) => (
            <Link href={{ pathname: '/mocks/[state]', params: { state: item.id } }} asChild>
              <Pressable style={styles.row}>
                <Txt variant="smallStrong" color={Palette.paperMuted} style={styles.ref}>
                  {item.ref}
                </Txt>
                <View style={styles.flex}>
                  <Txt variant="bodyStrong">{item.title}</Txt>
                  <Txt variant="small" color={Palette.paperFaint}>
                    {item.id}
                  </Txt>
                </View>
              </Pressable>
            </Link>
          )}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Palette.ink },
  flex: { flex: 1 },
  list: { paddingHorizontal: Space.xl, paddingBottom: Space.xxxl, gap: 6 },
  head: { gap: Space.s, paddingTop: Space.l, paddingBottom: Space.s },
  sectionHead: { marginTop: Space.xl, marginBottom: Space.s },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
    padding: Space.m,
    borderRadius: Radius.m,
    backgroundColor: Palette.panel,
    borderWidth: 1,
    borderColor: Palette.hairline,
    marginBottom: 6,
  },
  ref: { width: 64, fontVariant: ['tabular-nums'] },
});
