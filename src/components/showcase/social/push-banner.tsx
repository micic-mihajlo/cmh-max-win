import { StyleSheet, View } from 'react-native';

import { Txt } from '@/components/signal/txt';
import { FontFamily, Palette, Space } from '@/constants/signal';

export function PushBanner({ app, when, title, body }: { app: string; when: string; title: string; body: string }) {
  return (
    <View style={styles.banner} accessibilityRole="alert" accessibilityLabel={`${app}: ${title}`}>
      <View style={styles.icon}>
        <Txt style={styles.iconLetter} color={Palette.ink}>
          s
        </Txt>
      </View>
      <View style={styles.body}>
        <View style={styles.top}>
          <Txt variant="smallStrong" style={styles.title} numberOfLines={1}>
            {title}
          </Txt>
          <Txt variant="small" color={Palette.paperMuted}>
            {when}
          </Txt>
        </View>
        <Txt variant="small" numberOfLines={2}>
          {body}
        </Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    gap: Space.m,
    padding: Space.m,
    borderRadius: 22,
    backgroundColor: Palette.card,
    shadowColor: '#161513',
    shadowOpacity: 0.06,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
  },
  icon: { width: 38, height: 38, borderRadius: 9, backgroundColor: Palette.paper, alignItems: 'center', justifyContent: 'center' },
  iconLetter: { fontFamily: FontFamily.displayBold, fontSize: 24, lineHeight: 28 },
  body: { flex: 1, minWidth: 0 },
  top: { flexDirection: 'row', alignItems: 'center', gap: Space.s },
  title: { flex: 1 },
});
