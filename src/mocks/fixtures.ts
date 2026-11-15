import { Nudges } from './case01';
import type { MemberView, Presence, Role, RoomView, SuspectId } from '@/lib/contract';

export type Who = 'maya' | 'ravi' | 'lena';

const people: Record<Who, { memberId: string; name: string; role: Role; isHost: boolean }> = {
  maya: { memberId: 'm_maya', name: 'Maya', role: 'detective', isHost: true },
  ravi: { memberId: 'm_ravi', name: 'Ravi', role: 'hacker', isHost: false },
  lena: { memberId: 'm_lena', name: 'Lena', role: 'witness', isHost: false },
};

export const whoByRole: Record<Role, Who> = { detective: 'maya', hacker: 'ravi', witness: 'lena' };

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
  me = 'maya',
  members = [{ who: 'maya' }, { who: 'ravi' }, { who: 'lena' }],
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
