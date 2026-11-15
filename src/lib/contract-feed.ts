// ---------- Follow feed and notifications for drops (CAP-45; signal/design/feed-notifications.md) ----------
// A streamer is whoever hosts drops from the host screen. streamerId is public and stable; the host's device
// token never leaves the server. Follows belong to the device, and to its Whop account when one is linked, so a
// follow made on one device shows on every device signed in to the same Whop account.
import type { BountyView } from './contract';

export type StreamerCardView = {
  streamerId: string;
  name: string; // the creatorName of their newest hosted drop
  avatarUrl?: string; // https; absent: draw the initial
  followerCount: number; // real follow rows only, never padded
  showFollowerCount?: boolean; // false under 3 followers: hide the count rather than show "1 follower"
  live: boolean;
  following: boolean; // this device (or its Whop account) follows them
};

// "Live now": the streamer opened a drop (hostDrop with no start time, or a scheduled drop's start time came), it
// hasn't ended, and it had an entry, lock-in or solve in the last 20 minutes. Derived on every read. Entries are open while dropStatus is 'scheduled'; 'live' means squads are dealt and racing.
export type FeedLiveRow = {
  streamerId: string;
  streamerName: string;
  dropId: string;
  title: string;
  joinCode: string; // tap joins with this code, no typing
  dropStatus: 'scheduled' | 'live';
  entrantCount: number;
  bounty: BountyView; // stakes line: "$200 · first 2 squads"
  liveSince: number; // ms epoch, server clock
};

// "Coming up": a hosted drop with a start time that hasn't opened yet. Soonest first.
export type FeedUpcomingRow = {
  streamerId: string;
  streamerName: string;
  dropId: string;
  title: string;
  joinCode: string;
  startsAt: number; // ms epoch, server clock
  bounty: BountyView;
  reminded: boolean;
  // "Lou and Ana are waiting": first names of up to 3 others already entered (or dealt into this device's squad).
  // Only for a device that tapped Remind me or entered; never this device or the host; absent when nobody's there.
  squadmates?: string[];
};

// A finished drop: the winning squad, and this device's own placement when it played.
export type FeedResultRow = {
  streamerId: string;
  streamerName: string;
  dropId: string;
  title: string;
  playerCount: number;
  endedAt: number; // the last solve, or the start time when nobody solved
  winner: { squadLabel: string; memberNames: string[]; solveMs: number } | null;
  mine: { place: number | null; perPlayerCents: number | null } | null; // null: this device didn't play
};

export type FollowingFeedView = {
  following: StreamerCardView[]; // empty: show "Follow a streamer to see their drops here."
  live: FeedLiveRow[]; // newest first
  upcoming: FeedUpcomingRow[]; // soonest first
  results: FeedResultRow[]; // newest first, at most 5
  serverNow: number;
};

export type StreamerPageView = StreamerCardView & {
  liveDrop: FeedLiveRow | null;
  nextDrop: FeedUpcomingRow | null; // "Next drop · Friday 9 pm"
  past: FeedResultRow[]; // last 3, newest first
  serverNow: number;
};

export type FollowResult = { following: boolean; followerCount: number };
export type PushPlatform = 'ios' | 'android';

// Push payloads, in the notification's data field. Exactly two kinds, at most one per device per drop.
// live: "Nova is live · The Aurora Seed" / "Join with K7QX." Opens the join screen with the code filled in.
// starting: "Nova's room opens in 2 minutes" / "Your squad is waiting." Opens the drop's waiting room.
// Sent to followers (live) and to devices that tapped Remind me or already entered (starting).
// squadmates (starting only, optional): first names of up to 3 others already waiting in, or dealt into, this
// device's drop or squad, never this device. "Lou and Ana are waiting". Absent when nobody else is there yet.
export type FeedPushData = { kind: 'live' | 'starting'; dropId: string; joinCode: string; streamerId: string; squadmates?: string[] };

export type UseFollowingFeed = () => FollowingFeedView | undefined;
export type UseStreamers = () => StreamerCardView[] | undefined; // "Find streamers": live first, then most followed
export type UseStreamerPage = (streamerId: string | null) => StreamerPageView | null | undefined; // null = no such streamer
export type UseStreamerForDrop = (dropId: string | null) => StreamerCardView | null | undefined; // null = not a hosted drop
// Idempotent both ways: following twice is one follow, unfollowing someone you don't follow is a no-op.
export type UseFollowStreamer = (streamerId: string) => { follow: () => Promise<FollowResult>; unfollow: () => Promise<FollowResult> };
// Remind me on an upcoming drop; idempotent. WRONG_STATUS when the drop has no start time or already opened.
export type UseRemindMe = (dropId: string) => { remind: () => Promise<void>; cancel: () => Promise<void> };
// After expo-notifications returns an Expo push token: register it on every launch (it refreshes the row) and
// remove it when the person turns notifications off. One token per device; with none, pushes are skipped.
export type UseRegisterPushToken = () => (args: { token: string; platform: PushPlatform }) => Promise<void>;
export type UseRemovePushToken = () => () => Promise<void>;
