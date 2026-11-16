import { usePathname } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Txt } from '@/components/signal/txt';
import { Palette, Space } from '@/constants/signal';
import { useSignInWithWhop, useSignOutWhop, useWhopAccount } from '@/hooks/use-whop-account';
import { feedFixtures } from '@/mocks/showcase/feed-load';
import { PressScale } from '@/motion';

import { Avatar, Section, TextAction, showcase } from './kit';

export type AccountView = { username: string | null; displayName: string; avatarUrl: string | null };

export function AccountSection({
  account,
  bare,
  note,
  onSignIn,
  onSignOut,
}: {
  account: AccountView | null;
  bare?: boolean;
  note?: string;
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
              {note ?? 'Keep your follows on every device'}
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

type AccountState = { account: AccountView | null; note?: string; onSignIn: () => void; onSignOut: () => void } | null;

function useSampleAccount(): AccountState {
  const [account, setAccount] = useState<AccountView | null>(null);
  return { account, onSignIn: () => setAccount(sampleAccount), onSignOut: () => setAccount(null) };
}

function useLiveAccount(): AccountState {
  const state = useWhopAccount();
  const signIn = useSignInWithWhop(usePathname().replace(/^\//, ''));
  const signOut = useSignOutWhop();
  const [note, setNote] = useState<string>();
  if (!state?.available) return null;
  const a = state.account;
  const start = async () => {
    setNote('Opening Whop…');
    const result = await signIn().catch(() => 'error' as const);
    setNote(result === 'linked' || result === 'cancelled' ? undefined : "Couldn't sign in. Try again.");
  };
  return {
    account: a && { displayName: a.displayName, username: a.username, avatarUrl: a.avatarUrl },
    note,
    onSignIn: () => void start(),
    onSignOut: () => void signOut(),
  };
}

export const useAccount = feedFixtures ? useSampleAccount : useLiveAccount;

export function Account() {
  const state = useAccount();
  return state ? <AccountSection {...state} /> : null;
}

const styles = StyleSheet.create({
  chevron: { marginLeft: Space.s },
  signOut: { alignItems: 'flex-end', gap: 2 },
});
