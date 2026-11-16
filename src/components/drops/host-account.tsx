import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Txt } from '@/components/signal/txt';
import { Palette, Radius, Space } from '@/constants/signal';
import { useMyHostedDrops, useSignInToHost } from '@/hooks/use-host-account';
import { useSignOutWhop, useWhopAccount } from '@/hooks/use-whop-account';
import type { WhopSignInResult } from '@/lib/contract';
import { PressScale } from '@/motion';

const FAILED: Partial<Record<WhopSignInResult, string>> = {
  cancelled: 'Sign-in was cancelled. You can still host from this phone.',
  error: 'Whop sign-in didn’t go through. You can still host from this phone.',
  unavailable: 'Whop sign-in isn’t set up here yet. You can still host from this phone.',
};

// Optional host identity: signing in with Whop lets any signed-in device reopen and run this host's drops.
// Hosting never waits on it.
export function HostAccount() {
  const account = useWhopAccount();
  const drops = useMyHostedDrops();
  const signIn = useSignInToHost('host');
  const signOut = useSignOutWhop();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!account?.available) return null;
  const open = (drops ?? []).filter((d) => d.status !== 'finished');
  return (
    <View style={styles.card}>
      {account.account ? (
        <View style={styles.row}>
          <Txt variant="small" color={Palette.paperMuted} style={styles.flex} numberOfLines={1}>
            {`Hosting as ${account.account.username ? '@' + account.account.username : account.account.name}`}
          </Txt>
          <PressScale accessibilityRole="button" onPress={() => signOut()} haptic="tap">
            <Txt variant="smallStrong">Sign out</Txt>
          </PressScale>
        </View>
      ) : (
        <PressScale
          accessibilityRole="button"
          disabled={busy}
          haptic="tap"
          style={styles.signIn}
          onPress={async () => {
            setBusy(true);
            setError(null);
            try {
              const result = await signIn();
              if (result !== 'linked') setError(FAILED[result] ?? FAILED.error!);
            } catch {
              setError(FAILED.error!);
            } finally {
              setBusy(false);
            }
          }}>
          <Txt variant="smallStrong">{busy ? 'Opening Whop…' : 'Sign in with Whop to host from any device'}</Txt>
        </PressScale>
      )}
      {error ? (
        <Txt variant="small" color={Palette.danger}>
          {error}
        </Txt>
      ) : null}
      {open.length ? (
        <View style={styles.list}>
          <Txt variant="small" color={Palette.paperMuted}>
            Your live drops
          </Txt>
          {open.map((d) => (
            <PressScale
              key={d.dropId}
              accessibilityRole="button"
              haptic="tap"
              style={styles.drop}
              onPress={() => router.push({ pathname: '/drop/[id]/host', params: { id: d.dropId } })}>
              <View style={styles.flex}>
                <Txt variant="bodyStrong">{d.title}</Txt>
                <Txt variant="small" color={Palette.paperMuted}>
                  {`${d.code} · ${d.players} here · ${d.status === 'live' ? 'racing' : 'waiting'}`}
                </Txt>
              </View>
              <Txt variant="smallStrong" color={Palette.ember}>
                Reopen
              </Txt>
            </PressScale>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: Space.m },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Space.m },
  signIn: {
    height: 44,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.hairline,
    backgroundColor: Palette.panelRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { gap: Space.s },
  drop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
    padding: Space.l,
    borderRadius: Radius.m,
    backgroundColor: Palette.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.hairline,
  },
});
