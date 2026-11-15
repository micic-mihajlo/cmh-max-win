import { RoleMeta, RoleOrder } from '@/constants/signal';
import type { MemberView, RoomView } from '@/mocks/contract';

export function lockedIds(room: RoomView) {
  return new Set(room.lockIns.filter((l) => l.revision === room.theory.revision).map((l) => l.memberId));
}

export function seated(room: RoomView) {
  return RoleOrder.map((role) => ({ role, member: room.members.find((m) => m.role === role) ?? null }));
}

export function others(room: RoomView) {
  return room.members.filter((m) => !m.isMe);
}

export function host(room: RoomView) {
  return room.members.find((m) => m.isHost) ?? null;
}

export function joinNames(names: string[]) {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export function roleName(m: MemberView) {
  return m.role ? `${m.name} (${RoleMeta[m.role].label})` : m.name;
}
