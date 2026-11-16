import { Nudges } from './case01';
import type { MemberView, Presence, Role, RoomView, SuspectId } from '@/lib/contract';

export type Who = 'ashley' | 'ryan' | 'emily';

const people: Record<Who, { memberId: string; name: string; role: Role; isHost: boolean }> = {
  ashley: { memberId: 'm_ashley', name: 'Ashley', role: 'detective', isHost: true },
  ryan: { memberId: 'm_ryan', name: 'Ryan', role: 'hacker', isHost: false },
  emily: { memberId: 'm_emily', name: 'Emily', role: 'witness', isHost: false },
};

export const whoByRole: Record<Role, Who> = { detective: 'ashley', hacker: 'ryan', witness: 'emily' };

type MemberSpec = { who: Who; role?: Role | null; roles?: Role[]; presence?: Presence };

export type RoomFixture = {
  me?: Who | null;
  members?: MemberSpec[];
  status?: RoomView['status'];
  culprit?: SuspectId | null;
  revision?: number;
  editedBy?: Who | null;
  locked?: Who[];
  attempts?: number;
  nudge?: Exclude<SuspectId, 'jun'> | null;
  checkedRevision?: number | null;
  lastCheck?: RoomView['lastCheck'];
  drop?: RoomView['drop'];
};

export function room({
  me = 'ashley',
  members = [{ who: 'ashley' }, { who: 'ryan' }, { who: 'emily' }],
  status = 'playing',
  culprit = null,
  revision = 1,
  editedBy = null,
  locked = [],
  attempts = 0,
  nudge = null,
  checkedRevision = null,
  lastCheck = null,
  drop = null,
}: RoomFixture = {}): RoomView {
  const list: MemberView[] = members.map(({ who, role, roles, presence }) => {
    const primary = role === undefined ? people[who].role : role;
    return {
    memberId: people[who].memberId,
    name: people[who].name,
    role: primary,
    roles: roles ?? (primary ? [primary] : []),
    presence: presence ?? (status === 'playing' && locked.includes(who) ? 'ready' : status === 'playing' ? 'reviewing' : 'online'),
    isHost: people[who].isHost,
    isMe: who === me,
    };
  });
  const mine = list.find((m) => m.isMe) ?? null;
  return {
    code: 'K7QX',
    status,
    squadSize: members.length === 2 ? 2 : 3,
    drop,
    cooldownUntil: null,
    caseId: 'case01',
    isHost: me ? people[me].isHost : false,
    me: mine ? { memberId: mine.memberId, role: mine.role, name: mine.name } : null,
    members: list,
    theory: {
      culprit,
      revision,
      lastEditedBy: editedBy ? { memberId: people[editedBy].memberId, name: people[editedBy].name } : null,
    },
    lockIns: locked.map((w) => ({ memberId: people[w].memberId, revision })),
    attempts,
    lastNudge: nudge ? { ...Nudges[nudge], revision: checkedRevision ?? revision } : null,
    checkedRevision,
    checkSeq: lastCheck?.seq ?? 0,
    lastCheck,
    reclaimableRoles: list.filter((m) => m.presence === 'offline' && m.role).map((m) => m.role as Role),
  };
}
