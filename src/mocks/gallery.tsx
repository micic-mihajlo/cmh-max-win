import { useEffect, useState, type ReactElement } from 'react';

import { AgreementScreen } from '@/components/screens/agreement';
import { ClosedScreen } from '@/components/screens/closed';
import { CoverScreen } from '@/components/screens/cover';
import { DossierScreen, type DossierUi } from '@/components/screens/dossier';
import { IntroScreen } from '@/components/screens/intro';
import { LobbyScreen } from '@/components/screens/lobby';
import { NameEntryScreen } from '@/components/screens/name-entry';
import { OutcomeStage } from '@/components/screens/outcome-stage';
import { RevealScreen } from '@/components/screens/reveal';
import { ShelfScreen } from '@/components/screens/shelf';

import { Dossiers, Reveal } from './case01';
import type { Role, RoomView, SeasonPackView } from '@/lib/contract';
import { room, whoByRole, type RoomFixture } from './fixtures';
import { DropStates } from './drops';
import { HostStates } from './host';

export type MockState = {
  id: string;
  ref: string;
  section: string;
  title: string;
  render: () => ReactElement;
  display?: { typeScale?: number; reduceMotion?: boolean };
};

const playing = (over: RoomFixture = {}) => room({ status: 'playing', revision: 4, ...over });
const asRole = (role: Role, over: RoomFixture = {}) => playing({ me: whoByRole[role], ...over });
const dossier = (r: RoomView, ui?: DossierUi) => <DossierScreen room={r} pieces={r.me?.role ? [Dossiers[r.me.role]] : undefined} ui={ui} />;
const sheet = (r: RoomView, extra?: NonNullable<DossierUi['sheet']>) => dossier(r, { sheet: { expanded: true, ...extra } });
const lobby = (over: RoomFixture) => room({ status: 'lobby', ...over });
const wrong = (role: Role, pick: 'theo' | 'priya' | 'ines', attempts: number) =>
  asRole(role, { culprit: pick, revision: 5, editedBy: 'ravi', attempts, nudge: pick, checkedRevision: 5, lastCheck: { seq: attempts, result: 'wrong', at: 0 } });
const allLocked: RoomFixture = { culprit: 'jun', editedBy: 'ravi', locked: ['maya', 'ravi', 'lena'] };
const solved = room({ status: 'resolved', me: 'ravi', culprit: 'jun', revision: 7, attempts: 2, locked: ['maya', 'ravi', 'lena'], lastCheck: { seq: 2, result: 'correct', at: 0 } });
const crew = ['Maya', 'Ravi', 'Lena'];
const pack = (state: SeasonPackView['state'], environment: SeasonPackView['environment'] = null): SeasonPackView => ({ pack: 'season01', state, real: true, environment, error: null });

function LiveOutcome() {
  const before = asRole('witness', { culprit: 'theo', revision: 5, editedBy: 'ravi', locked: ['maya', 'ravi'] });
  const [r, setR] = useState(before);
  useEffect(() => {
    const t = setTimeout(() => setR(wrong('witness', 'theo', 1)), 900);
    return () => clearTimeout(t);
  }, []);
  return (
    <OutcomeStage room={r}>{r.lastNudge ? <AgreementScreen room={r} phase="wrong" /> : sheet(r)}</OutcomeStage>
  );
}

export const MockStates: MockState[] = [
  { id: '00-name-entry', ref: '0.1', section: 'First run', title: 'Name entry', render: () => <NameEntryScreen name="Ravi" /> },

  { id: '01-cover-first-launch', ref: '1.1', section: 'Cover', title: 'First launch', render: () => <CoverScreen active={null} /> },
  { id: '01-cover-rejoin', ref: '1.2', section: 'Cover', title: 'Returning · rejoin banner', render: () => <CoverScreen active={{ code: 'K7QX', status: 'playing', role: 'hacker' }} /> },
  { id: '01-cover-resolved', ref: '1.3', section: 'Cover', title: 'Returning · crew solved it', render: () => <CoverScreen active={{ code: 'K7QX', status: 'resolved', role: 'hacker' }} /> },
  { id: '01-cover-loading', ref: '1.4', section: 'Cover', title: 'Loading active room', render: () => <CoverScreen active={undefined} /> },
  { id: '01-cover-creating', ref: '1.12', section: 'Cover', title: 'Creating a room', render: () => <CoverScreen active={null} creating /> },
  { id: '01-join-empty', ref: '1.5', section: 'Cover', title: 'Join · empty', render: () => <CoverScreen active={null} join={{ code: '', phase: 'typing' }} /> },
  { id: '01-join-typing', ref: '1.6', section: 'Cover', title: 'Join · typing', render: () => <CoverScreen active={null} join={{ code: 'K7', phase: 'typing' }} /> },
  { id: '01-join-joining', ref: '1.7 / 1.11', section: 'Cover', title: 'Join · joining (or from a link)', render: () => <CoverScreen active={null} join={{ code: 'K7QX', phase: 'joining' }} /> },
  { id: '01-join-invalid', ref: '1.8', section: 'Cover', title: 'ROOM_NOT_FOUND', render: () => <CoverScreen active={null} join={{ code: 'K7QZ', phase: 'error', error: 'ROOM_NOT_FOUND' }} /> },
  { id: '01-join-full', ref: '1.9', section: 'Cover', title: 'ROOM_FULL', render: () => <CoverScreen active={null} join={{ code: 'K7QX', phase: 'error', error: 'ROOM_FULL' }} /> },
  { id: '01-join-started', ref: '1.10', section: 'Cover', title: 'CASE_STARTED', render: () => <CoverScreen active={null} join={{ code: 'K7QX', phase: 'error', error: 'CASE_STARTED' }} /> },
  {
    id: '01-join-reclaim',
    ref: 'LB-1',
    section: 'Cover',
    title: 'Pick your seat back',
    render: () => <CoverScreen active={null} join={{ code: 'K7QX', phase: 'reclaim', seats: [{ role: 'hacker', holder: 'Ravi' }] }} />,
  },
  { id: '01-join-no-seat', ref: 'LB-1', section: 'Cover', title: 'No free seat', render: () => <CoverScreen active={null} join={{ code: 'K7QX', phase: 'reclaim', seats: [] }} /> },

  { id: '02-lobby-host-alone', ref: '2.1', section: 'Lobby', title: 'Host alone · 0/3', render: () => <LobbyScreen room={lobby({ members: [{ who: 'maya', role: null }] })} /> },
  { id: '02-lobby-one-claimed', ref: '2.2', section: 'Lobby', title: '1/3 claimed · I need a role', render: () => <LobbyScreen room={lobby({ me: 'ravi', members: [{ who: 'maya' }, { who: 'ravi', role: null }] })} /> },
  { id: '02-lobby-two-claimed', ref: '2.3', section: 'Lobby', title: '2/3 claimed · waiting for one more', render: () => <LobbyScreen room={lobby({ members: [{ who: 'maya' }, { who: 'ravi' }] })} /> },
  {
    id: '02-lobby-role-taken',
    ref: '2.4',
    section: 'Lobby',
    title: 'ROLE_TAKEN',
    render: () => <LobbyScreen room={lobby({ me: 'lena', members: [{ who: 'maya' }, { who: 'ravi' }, { who: 'lena', role: null }] })} toast={{ text: 'Ravi just took Hacker. Pick another role.', tone: 'warn' }} />,
  },
  {
    id: '02-lobby-switching',
    ref: '2.5',
    section: 'Lobby',
    title: 'Switch role',
    render: () => <LobbyScreen room={lobby({ me: 'lena', members: [{ who: 'maya' }, { who: 'lena', role: 'hacker' }] })} toast={{ text: 'You’re the Hacker now. Witness is open again.', tone: 'good' }} />,
  },
  { id: '02-lobby-unpicked', ref: '2.6', section: 'Lobby', title: '3 joined · one hasn’t picked', render: () => <LobbyScreen room={lobby({ members: [{ who: 'maya' }, { who: 'ravi' }, { who: 'lena', role: null }] })} /> },
  { id: '02-lobby-ready-host', ref: '2.7', section: 'Lobby', title: 'All 3 filled · host', render: () => <LobbyScreen room={lobby({})} /> },
  { id: '02-lobby-waiting-nonhost', ref: '2.8', section: 'Lobby', title: 'All 3 filled · non-host', render: () => <LobbyScreen room={lobby({ me: 'ravi' })} /> },
  { id: '02-lobby-roles-not-filled', ref: '2.9', section: 'Lobby', title: 'ROLES_NOT_FILLED', render: () => <LobbyScreen room={lobby({ members: [{ who: 'maya' }, { who: 'ravi' }, { who: 'lena', role: null }] })} toast={{ text: 'Someone left their role. Wait for all three.', tone: 'warn' }} /> },
  { id: '02-lobby-player-offline', ref: '2.10', section: 'Lobby', title: 'Player away', render: () => <LobbyScreen room={lobby({ members: [{ who: 'maya' }, { who: 'ravi', presence: 'offline' }, { who: 'lena' }] })} /> },
  { id: '02-lobby-host-offline', ref: '2.11', section: 'Lobby', title: 'Host away', render: () => <LobbyScreen room={lobby({ me: 'lena', members: [{ who: 'maya', presence: 'offline' }, { who: 'ravi' }, { who: 'lena' }] })} /> },
  { id: '02-lobby-menu', ref: '2.12', section: 'Lobby', title: 'Room menu · leave', render: () => <LobbyScreen room={lobby({ me: 'ravi' })} menu /> },
  { id: '02-lobby-restarted', ref: '9.6', section: 'Lobby', title: 'After a restart', render: () => <LobbyScreen room={lobby({ me: 'ravi' })} toast={{ text: 'Maya restarted the case.' }} /> },

  { id: '03-intro-reading', ref: '3.1', section: 'Shared intro', title: 'Reading', render: () => <IntroScreen room={room({ status: 'intro' })} /> },
  {
    id: '03-intro-two-ready',
    ref: '3.2',
    section: 'Shared intro',
    title: '2 of 3 ready',
    render: () => <IntroScreen room={room({ status: 'intro', members: [{ who: 'maya', presence: 'ready' }, { who: 'ravi', presence: 'online' }, { who: 'lena', presence: 'ready' }] })} />,
  },
  {
    id: '03-intro-opening',
    ref: '3.3',
    section: 'Shared intro',
    title: 'All ready · opening',
    render: () => <IntroScreen opening room={room({ status: 'intro', members: [{ who: 'maya', presence: 'ready' }, { who: 'ravi', presence: 'ready' }, { who: 'lena', presence: 'ready' }] })} />,
  },
  {
    id: '03-intro-away',
    ref: '3.4',
    section: 'Shared intro',
    title: 'Someone away',
    render: () => <IntroScreen room={room({ status: 'intro', members: [{ who: 'maya', presence: 'ready' }, { who: 'ravi', presence: 'offline' }, { who: 'lena', presence: 'online' }] })} />,
  },

  { id: '04-dossier-detective', ref: '4.1', section: 'Dossier', title: 'Detective · no pick', render: () => dossier(asRole('detective', { revision: 1 })) },
  {
    id: '04-dossier-hacker',
    ref: '4.2 / 4.3',
    section: 'Dossier',
    title: 'Hacker · someone picked',
    render: () => dossier(asRole('hacker', { culprit: 'theo', editedBy: 'maya', members: [{ who: 'maya', presence: 'online' }, { who: 'ravi' }, { who: 'lena' }] })),
  },
  { id: '04-dossier-witness', ref: '4.2 / 4.6', section: 'Dossier', title: 'Witness · someone picked', render: () => dossier(asRole('witness', { culprit: 'theo', editedBy: 'ravi' })) },
  { id: '04-dossier-loading', ref: '4.4', section: 'Dossier', title: 'Loading', render: () => <DossierScreen room={asRole('hacker', { revision: 1 })} pieces={undefined} /> },
  { id: '04-suspects', ref: '4.5', section: 'Dossier', title: 'Suspect directory', render: () => dossier(asRole('witness', { revision: 1 }), { tab: 'suspects' }) },

  {
    id: '04-dossier-squad-of-2',
    ref: 'N',
    section: 'Dossier',
    title: 'Squad of 2 · I hold two pieces',
    render: () => (
      <DossierScreen room={room({ me: 'ravi', members: [{ who: 'maya' }, { who: 'ravi', roles: ['hacker', 'witness'] }], drop: { dropId: 'aurora-demo', title: 'The Aurora Seed', squadLabel: 'Squad 4', rank: null, isWinner: false } })} pieces={[Dossiers.hacker, Dossiers.witness]} />
    ),
  },
  {
    id: '05-theory-squad-of-2',
    ref: 'N',
    section: 'Theory sheet',
    title: 'Squad of 2 · 1 of 2 agree',
    render: () => (
      <DossierScreen
        room={room({ me: 'ravi', members: [{ who: 'maya' }, { who: 'ravi', roles: ['hacker', 'witness'] }], drop: { dropId: 'aurora-demo', title: 'The Aurora Seed', squadLabel: 'Squad 4', rank: null, isWinner: false }, culprit: 'jun', revision: 3, editedBy: 'maya', locked: ['maya'] })}
        pieces={[Dossiers.hacker, Dossiers.witness]}
        ui={{ sheet: { expanded: true } }}
      />
    ),
  },

  { id: '05-theory-empty', ref: '5.1', section: 'Theory sheet', title: 'Empty', render: () => sheet(asRole('hacker', { revision: 1 })) },
  { id: '05-theory-picked', ref: '5.2', section: 'Theory sheet', title: 'Pick made · 0 locked', render: () => sheet(asRole('hacker', { culprit: 'jun', editedBy: 'ravi' })) },
  {
    id: '05-theory-edited-live',
    ref: '5.3',
    section: 'Theory sheet',
    title: 'Edited live by another',
    render: () => sheet(asRole('witness', { culprit: 'theo', revision: 5, editedBy: 'ravi' }), { notice: { tone: 'info', title: 'Ravi changed it to Theo · lock-ins cleared' } }),
  },
  { id: '05-theory-locked-1', ref: '5.4', section: 'Theory sheet', title: 'Me locked · 1 of 3', render: () => sheet(asRole('hacker', { culprit: 'jun', editedBy: 'ravi', locked: ['ravi'] })) },
  { id: '05-theory-locked-2', ref: '5.5', section: 'Theory sheet', title: 'Me locked · 2 of 3', render: () => sheet(asRole('hacker', { culprit: 'jun', editedBy: 'ravi', locked: ['ravi', 'maya'] })) },
  { id: '05-theory-others-locked', ref: '5.6', section: 'Theory sheet', title: 'Two others locked · me not', render: () => sheet(asRole('witness', { culprit: 'jun', editedBy: 'ravi', locked: ['ravi', 'maya'] })) },
  {
    id: '05-theory-stale',
    ref: '5.7',
    section: 'Theory sheet',
    title: 'STALE_REVISION',
    render: () => sheet(asRole('witness', { culprit: 'ines', revision: 6, editedBy: 'maya' }), { notice: { tone: 'warn', title: 'The theory changed as you tapped.', text: 'Check it, then lock in again.' } }),
  },
  {
    id: '05-theory-clears-locks',
    ref: '5.8',
    section: 'Theory sheet',
    title: 'My edit would clear lock-ins',
    render: () => sheet(asRole('witness', { culprit: 'jun', editedBy: 'ravi', locked: ['ravi', 'maya'] }), { notice: { tone: 'warn', title: 'Changing this clears 2 lock-ins.' } }),
  },
  { id: '05-theory-pending', ref: '5.9', section: 'Theory sheet', title: 'Setting theory · pending', render: () => sheet(asRole('detective', { culprit: 'theo', editedBy: 'ravi' }), { pendingPick: 'priya' }) },
  { id: '05-theory-already-checked', ref: 'LB-2', section: 'Theory sheet', title: 'ALREADY_CHECKED', render: () => sheet(wrong('detective', 'theo', 1)) },
  {
    id: '05-theory-offline-tap',
    ref: 'LB-4',
    section: 'Theory sheet',
    title: 'Offline lock tap rejected',
    render: () => sheet(asRole('hacker', { culprit: 'jun', revision: 6, editedBy: 'maya' }), { notice: { tone: 'warn', title: 'You were offline when you tapped.', text: 'The theory moved on. Check it, then lock in again.' } }),
  },

  { id: '06-agreement-checking', ref: '6.1', section: 'Agreement', title: '3 of 3 · checking (every phone)', render: () => <AgreementScreen phase="checking" room={asRole('hacker', allLocked)} /> },
  {
    id: '06-agreement-squad-of-2',
    ref: 'N',
    section: 'Agreement',
    title: 'Squad of 2 · checking',
    render: () => <AgreementScreen phase="checking" room={room({ me: 'ravi', members: [{ who: 'maya' }, { who: 'ravi', roles: ['hacker', 'witness'] }], drop: { dropId: 'aurora-demo', title: 'The Aurora Seed', squadLabel: 'Squad 4', rank: null, isWinner: false }, culprit: 'jun', revision: 3, editedBy: 'maya', locked: ['maya', 'ravi'] })} />,
  },
  { id: '06-nudge-theo', ref: '6.2 / 6.5', section: 'Agreement', title: 'Wrong · Theo', render: () => <AgreementScreen phase="wrong" room={wrong('detective', 'theo', 1)} /> },
  { id: '06-nudge-priya', ref: '6.3', section: 'Agreement', title: 'Wrong · Priya', render: () => <AgreementScreen phase="wrong" room={wrong('detective', 'priya', 2)} /> },
  { id: '06-nudge-ines', ref: '6.4', section: 'Agreement', title: 'Wrong · Ines', render: () => <AgreementScreen phase="wrong" room={wrong('hacker', 'ines', 2)} /> },
  { id: '06-nudge-my-phone', ref: '6.6', section: 'Agreement', title: 'The nudged player’s phone', render: () => dossier(wrong('hacker', 'theo', 1), { highlight: 1 }) },
  { id: '06-nudge-collapsed', ref: '6.7', section: 'Agreement', title: 'After the theory changes', render: () => sheet(asRole('hacker', { culprit: 'ines', revision: 6, editedBy: 'lena', attempts: 1 })) },
  { id: '06-outcome-live', ref: 'seal sync', section: 'Agreement', title: 'Live: lastCheck lands → seal beat → nudge', render: () => <LiveOutcome /> },

  { id: '07-reveal-reconstruction', ref: '7.1', section: 'Reveal', title: 'Reconstruction', render: () => <RevealScreen room={solved} reveal={Reveal} page="reconstruction" /> },
  { id: '07-reveal-credits', ref: '7.2', section: 'Reveal', title: 'Credits', render: () => <RevealScreen room={solved} reveal={Reveal} page="credits" /> },
  { id: '07-reveal-choice', ref: '7.3', section: 'Reveal', title: 'Crew choice (preview)', render: () => <RevealScreen room={solved} reveal={Reveal} page="choice" choice="informant" /> },
  { id: '07-reveal-next', ref: '7.4', section: 'Reveal', title: 'Episode 02 hook', render: () => <RevealScreen room={solved} reveal={Reveal} page="next" /> },
  { id: '07-reveal-next-follow', ref: '7.4b', section: 'Reveal', title: 'Episode 02 hook · follow the host', render: () => <RevealScreen room={solved} reveal={Reveal} page="next" host={{ name: 'Nova', following: false }} /> },
  { id: '07-reveal-loading', ref: '7.5', section: 'Reveal', title: 'Reveal loading · hold seals', render: () => <AgreementScreen phase="checking" room={solved} /> },
  { id: '07-reveal-late', ref: '7.6', section: 'Reveal', title: 'Late arrival', render: () => <RevealScreen room={solved} reveal={Reveal} page="reconstruction" late /> },

  { id: '08-shelf-concept', ref: '8.1 / 8.2 / 8.3b', section: 'Season shelf', title: 'Concept pack card', render: () => <ShelfScreen attempts={2} crew={crew} pack={{ real: false }} /> },
  { id: '08-shelf-whop-locked', ref: '8.3a', section: 'Season shelf', title: 'Whop pack · locked', render: () => <ShelfScreen attempts={2} crew={crew} pack={pack('locked')} /> },
  { id: '08-shelf-whop-checkout', ref: '8.3a', section: 'Season shelf', title: 'Whop pack · checkout open', render: () => <ShelfScreen attempts={2} crew={crew} pack={pack('checkout')} /> },
  { id: '08-shelf-whop-verifying', ref: '8.3a', section: 'Season shelf', title: 'Whop pack · verifying', render: () => <ShelfScreen attempts={2} crew={crew} pack={pack('verifying')} /> },
  { id: '08-shelf-whop-owned', ref: '8.3a', section: 'Season shelf', title: 'Whop pack · owned', render: () => <ShelfScreen attempts={2} crew={crew} pack={pack('owned', 'sandbox')} /> },

  {
    id: '09-reconnecting',
    ref: '9.1 / LB-3',
    section: 'System',
    title: 'Reconnecting (my phone)',
    render: () => dossier(asRole('hacker', { culprit: 'theo', editedBy: 'maya' }), { banner: { tone: 'warn', title: 'Reconnecting…', text: 'Your place is saved.', busy: true } }),
  },
  {
    id: '09-player-away',
    ref: '9.2 / LB-5',
    section: 'System',
    title: 'Player stepped away',
    render: () =>
      dossier(asRole('detective', { culprit: 'theo', editedBy: 'lena', members: [{ who: 'maya' }, { who: 'ravi', presence: 'offline' }, { who: 'lena' }] }), {
        banner: { tone: 'info', title: 'Ravi stepped away.', text: 'The case waits for all three.' },
      }),
  },
  { id: '09-player-back', ref: '9.3', section: 'System', title: 'Player is back', render: () => dossier(asRole('detective', { culprit: 'theo', editedBy: 'lena' }), { toast: { text: 'Ravi is back.', tone: 'good' } }) },
  { id: '09-menu-host', ref: '9.4', section: 'System', title: 'Case menu · host', render: () => dossier(asRole('detective', { culprit: 'theo', editedBy: 'lena' }), { menu: 'menu' }) },
  { id: '09-restart-confirm', ref: '9.4', section: 'System', title: 'Restart confirm · host', render: () => dossier(asRole('detective', { culprit: 'theo', editedBy: 'lena' }), { menu: 'confirm-restart' }) },
  { id: '09-restart-nonhost', ref: '9.5', section: 'System', title: 'NOT_HOST · menu note', render: () => dossier(asRole('witness', { culprit: 'theo', editedBy: 'ravi' }), { menu: 'menu' }) },
  { id: '09-leave-confirm', ref: '9.7', section: 'System', title: 'Leave mid-case', render: () => dossier(asRole('witness', { culprit: 'theo', editedBy: 'ravi' }), { menu: 'confirm-leave' }) },
  { id: '09-room-closed', ref: '9.8', section: 'System', title: 'NOT_A_MEMBER · room gone', render: () => <ClosedScreen code="K7QX" /> },
  {
    id: '09-wrong-status',
    ref: '9.9',
    section: 'System',
    title: 'WRONG_STATUS',
    render: () => dossier(asRole('hacker', { culprit: 'theo', editedBy: 'maya' }), { toast: { text: 'That moment passed. Here’s where things are.' } }),
  },
  {
    id: '09-error',
    ref: '9.10',
    section: 'System',
    title: 'Any other error',
    render: () => <LobbyScreen room={lobby({ me: 'lena', members: [{ who: 'maya' }, { who: 'ravi' }, { who: 'lena', role: null }] })} toast={{ text: 'That didn’t go through. Try again.', tone: 'warn' }} />,
  },
  { id: '09-large-type', ref: '9.11', section: 'System', title: 'Large Dynamic Type', display: { typeScale: 1.45 }, render: () => dossier(asRole('hacker', { culprit: 'theo', editedBy: 'maya' })) },
  {
    id: '09-large-type-sheet',
    ref: '9.11',
    section: 'System',
    title: 'Large Dynamic Type · full-height sheet',
    display: { typeScale: 1.45 },
    render: () => sheet(asRole('hacker', { culprit: 'theo', editedBy: 'maya', locked: ['maya'] }), { fullHeight: true }),
  },
  { id: '09-reduce-motion', ref: '9.12', section: 'System', title: 'Reduce motion', display: { reduceMotion: true }, render: () => <AgreementScreen phase="checking" room={asRole('witness', allLocked)} /> },
  ...DropStates,
  ...HostStates,
];

export const mockById = (id: string) => MockStates.find((s) => s.id === id);
