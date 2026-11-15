import { StyleSheet, View } from 'react-native';

import { Txt } from '@/components/signal/txt';
import { FontFamily, Palette, Space } from '@/constants/signal';

export function PushBanner({ app, when, title, body }: { app: string; when: string; title: string; body: string }) {
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <View style={styles.icon}>
        <Txt style={styles.iconLetter}>S</Txt>
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
        <Txt variant="small" color={Palette.paperMuted} style={styles.app}>
          {app}
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
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: Palette.hairline,
    shadowColor: '#1A1916',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  icon: { width: 38, height: 38, borderRadius: 9, backgroundColor: Palette.ember, alignItems: 'center', justifyContent: 'center' },
  iconLetter: { fontFamily: FontFamily.displayBold, fontSize: 22, lineHeight: 26, color: Palette.paper },
  body: { flex: 1, minWidth: 0 },
  top: { flexDirection: 'row', alignItems: 'center', gap: Space.s },
  title: { flex: 1 },
  app: { display: 'none' },
});
