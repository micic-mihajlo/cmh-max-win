import * as Clipboard from 'expo-clipboard';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { Txt } from '@/components/signal/txt';
import { Caption, G, PrimaryButton, StudioScreen } from '@/components/showcase/studio-ui';
import { FontFamily, Space } from '@/constants/signal';
import type { ChallengeSummaryView } from '@/lib/contract';
import { Haptic, PressScale, Stagger } from '@/motion';

import { shareUrl, statusName, templateName } from './format';

// Right after publish: the join code is the hero, the share link sits under it.
export function Published({ c }: { c: ChallengeSummaryView }) {
  const code = c.joinCode ?? '';
  const url = shareUrl(code);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await Clipboard.setStringAsync(url);
    Haptic.tap();
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <StudioScreen
      kicker={`${templateName(c.config.templateId)} · ${statusName[c.status]}`}
      title={c.config.title}
      footer={
        <>
          <PrimaryButton variant="text" title="Share" onPress={() => Share.share({ message: `Join ${c.config.title} on SIGNAL: ${url}`, url })} />
          <PrimaryButton title="Host" onPress={() => router.push(`/studio/run/${c.challengeId}` as Href)} />
        </>
      }>
      <View style={styles.tiles} accessible accessibilityLabel={`Join code ${code.split('').join(' ')}`}>
        <Stagger from={8} stagger={45}>
          {code.split('').map((ch, i) => (
            <View key={i} style={styles.tile}>
              <Txt style={styles.letter}>{ch}</Txt>
            </View>
          ))}
        </Stagger>
      </View>
      <PressScale accessibilityRole="button" accessibilityLabel="Copy link" haptic="tap" scaleTo={0.98} onPress={copy}>
        <View style={styles.link}>
          <Txt variant="small" color={G.ink} numberOfLines={1} style={styles.flex}>
            {url.replace(/^https:\/\//, '')}
          </Txt>
          <Caption color={copied ? G.ink : G.inkSoft}>{copied ? 'Copied' : 'Copy'}</Caption>
        </View>
      </PressScale>
    </StudioScreen>
  );
}

const styles = StyleSheet.create({
  tiles: {
    flexDirection: 'row',
    gap: Space.s,
    marginTop: Space.xl,
    marginBottom: Space.s,
  },
  tile: {
    width: 64,
    height: 72,
    borderRadius: 12,
    backgroundColor: G.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    fontFamily: FontFamily.uiSemi,
    fontSize: 36,
    lineHeight: 44,
    color: G.ink,
    fontVariant: ['tabular-nums'],
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
    backgroundColor: G.fill,
    borderRadius: 14,
    paddingHorizontal: Space.l,
    minHeight: 52,
  },
  flex: { flex: 1 },
});
