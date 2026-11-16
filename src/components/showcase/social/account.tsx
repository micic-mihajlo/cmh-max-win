import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Txt } from '@/components/signal/txt';
import { Palette, Space } from '@/constants/signal';
import { useSignOutWhop, useWhopAccount } from '@/hooks/use-whop-account';
import { feedFixtures } from '@/mocks/showcase/feed-load';
import { PressScale } from '@/motion';

import { Avatar, Section, TextAction, showcase } from './kit';

export type AccountView = { username: string | null; displayName: string; avatarUrl: string | null };

export function AccountSection({
  account,
  bare,
  onSignIn,
  onSignOut,
}: {
  account: AccountView | null;
  bare?: boolean;
  onSignIn?: () => void;
  onSignOut: () => void;
}) {
  if (!account && !onSignIn) return null;
  const handle = account?.username ? `@${account.username}` : account?.displayName;
  return (
    <Section title="Account">
      {account ? (
        <View style={showcase.row}>
          {bare ? null : <Avatar initials={account.displayName.slice(0, 1)} uri={account.avatarUrl ?? undefined} size={44} />}
          <View style={showcase.flex}>
            <Txt variant="bodyStrong" numberOfLines={1}>
              {bare ? `Signed in as ${handle}` : account.displayName}
            </Txt>
            <Txt variant="caption" color={Palette.paperMuted} numberOfLines={1}>
              {bare ? 'Your Whop account' : handle}
            </Txt>
          </View>
          <View style={styles.signOut}>
            <TextAction title="Sign out" muted onPress={onSignOut} />
            <Txt variant="caption" color={Palette.paperMuted}>
              Only on this device
            </Txt>
          </View>
        </View>
      ) : (
        <PressScale accessibilityRole="button" scaleTo={0.98} haptic="tap" onPress={onSignIn} style={showcase.row}>
          {bare ? null : <Avatar initials="" size={44} />}
          <View style={showcase.flex}>
            <Txt variant="bodyStrong" numberOfLines={1}>
              Sign in with Whop
            </Txt>
            <Txt variant="caption" color={Palette.paperMuted} numberOfLines={1}>
              Keep your follows on every device
            </Txt>
          </View>
          <Txt variant="name" color={Palette.paperMuted} style={styles.chevron}>
            ›
          </Txt>
        </PressScale>
      )}
    </Section>
  );
}

const sampleAccount: AccountView = { displayName: 'Chris Walker', username: 'chris', avatarUrl: null };

export function Account({ bare }: { bare?: boolean }) {
  return feedFixtures ? <SampleAccount bare={bare} /> : <LiveAccount bare={bare} />;
}

function SampleAccount({ bare }: { bare?: boolean }) {
  const [account, setAccount] = useState<AccountView | null>(null);
  return <AccountSection account={account} bare={bare} onSignIn={() => setAccount(sampleAccount)} onSignOut={() => setAccount(null)} />;
}

function LiveAccount({ bare }: { bare?: boolean }) {
  const state = useWhopAccount();
  const signOut = useSignOutWhop();
  const a = state?.available ? state.account : null;
  if (!a) return null;
  return <AccountSection account={{ displayName: a.name, username: a.username, avatarUrl: a.avatarUrl }} bare={bare} onSignOut={() => void signOut()} />;
}

const styles = StyleSheet.create({
  chevron: { marginLeft: Space.s },
  signOut: { alignItems: 'flex-end', gap: 2 },
});
