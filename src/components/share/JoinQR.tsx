import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Txt } from '@/components/signal/txt';
import { FontFamily, Palette, Radius, Space } from '@/constants/signal';
import { shareUrlFor } from '@/lib/share-link';

export type JoinQRProps = {
  /** The challenge's join code, e.g. HostConsoleView.joinCode ('K7QM'). */
  code: string;
  /** HostConsoleView.shareUrl / ChallengeSummaryView.shareUrl. Falls back to https://signal-app-wine.vercel.app/c/<CODE>. */
  shareUrl?: string | null;
  /** 'card' for a phone screen; 'stage' for a stream overlay or the web host screen, with the code as big tiles beside the QR. */
  variant?: 'card' | 'stage';
  /** Largest QR side in points. The stage variant shrinks to fit its container. Defaults to 200 (card) and 360 (stage). */
  size?: number;
};

// The QR a streamer shows on stream. Ink on paper only: phone cameras read high-contrast dark-on-light fastest.
export function JoinQR({ code, shareUrl, variant = 'card', size }: JoinQRProps) {
  const url = shareUrl ?? shareUrlFor(code);
  const letters = code.toUpperCase().split('');
  const label = `Join code ${letters.join(' ')}. Scan the QR code to open ${url}`;
  const [width, setWidth] = useState<number | null>(null);

  if (variant === 'card') {
    const side = size ?? 200;
    const cardGap = Space.s;
    const cardTile = (side - cardGap * 3) / 4;
    return (
      <View style={styles.card} accessible accessibilityRole="image" accessibilityLabel={label}>
        <QRCode value={url} size={side} color={Palette.paper} backgroundColor={Palette.card} ecl="M" quietZone={4} />
        <View style={[styles.tilesRow, { width: side, gap: cardGap }]}>
          {letters.map((ch, i) => (
            <View key={i} style={[styles.tile, { width: cardTile, height: Math.round(cardTile * 1.18), borderRadius: Math.round(cardTile * 0.22) }]}>
              <Txt style={{ fontFamily: FontFamily.uiBold, fontSize: cardTile * 0.56, lineHeight: cardTile * 0.72, color: Palette.paper }}>{ch}</Txt>
            </View>
          ))}
        </View>
        <Txt variant="small" color={Palette.paperMuted}>
          Scan with your camera, or enter the code
        </Txt>
      </View>
    );
  }

  const max = size ?? 360;
  const gap = width ? Math.max(Space.l, Math.round(width * 0.05)) : Space.xl;
  const side = width ? Math.min(max, Math.floor((width - gap) / 2)) : max;
  const tileGap = Math.max(Space.s, Math.round(side * 0.05));
  const tile = (side - tileGap) / 2;

  return (
    <View
      style={styles.stage}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width - stagePadding * 2)}>
      <View style={[styles.stageRow, { gap }]}>
        <QRCode value={url} size={side} color={Palette.paper} backgroundColor={Palette.card} ecl="M" quietZone={0} />
        <View style={[styles.tiles, { width: side, height: side, gap: tileGap }]}>
          {letters.map((ch, i) => (
            <View key={i} style={[styles.tile, { width: tile, height: tile, borderRadius: Math.round(tile * 0.16) }]}>
              <Txt style={{ fontFamily: FontFamily.uiBold, fontSize: tile * 0.6, lineHeight: tile * 0.74, color: Palette.paper }}>{ch}</Txt>
            </View>
          ))}
        </View>
      </View>
      <Txt variant={side >= 240 ? 'bodyStrong' : 'small'} color={Palette.paperMuted} style={styles.stageLine}>
        {`Scan with your camera, or enter the code at ${url.replace(/^https:\/\//, '').replace(/\/c\/.*$/, '')}`}
      </Txt>
    </View>
  );
}

const stagePadding = Space.xl;

const styles = StyleSheet.create({
  card: {
    alignSelf: 'center',
    alignItems: 'center',
    gap: Space.l,
    padding: Space.xl,
    borderRadius: Radius.l,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.hairline,
    backgroundColor: Palette.card,
  },
  tilesRow: { flexDirection: 'row' },
  stage: {
    alignSelf: 'stretch',
    padding: stagePadding,
    gap: Space.l,
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.hairline,
    backgroundColor: Palette.card,
  },
  stageRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', alignContent: 'space-between', justifyContent: 'space-between' },
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: Palette.hairline,
    backgroundColor: Palette.ink,
  },
  stageLine: { textAlign: 'center' },
});
