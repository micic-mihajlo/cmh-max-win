// SIGNAL drops race and load harness (CAP-25).
// Spins up N simulated entrants, each with its own ConvexClient and device token, enters them into a fresh drop,
// starts it through the internal demo control (npx convex run), then races every squad to the answer and checks
// the squad split, evidence gating, exactly-X winners, award visibility and the leaderboard, with timings.
//
//   node scripts/harness/drops-race.mjs --target local --n 10 --squad 3 --winners 2
//   node scripts/harness/drops-race.mjs --target dev --matrix --out results.json   (shared dev; needs CONVEX_DEPLOY_KEY)
//
// Function names follow src/lib/contract.ts; override with HARNESS_FNS='{"enter":"drops:enter",...}'.
import { ConvexClient } from "convex/browser";
import { makeFunctionReference as F } from "convex/server";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DEV_URL = "https://compassionate-puffin-914.convex.cloud";

const argv = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = argv.indexOf("--" + name);
  if (i < 0) return dflt;
  const v = argv[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
};
const TARGET = flag("target", "local");
const OUT = flag("out", null);
const VERBOSE = !!flag("verbose", false);

const FNS = {
  createDrop: "drops:createDrop",
  startNow: "drops:startNow",
  drop: "drops:drop",
  enter: "drops:enterDrop",
  leaderboard: "drops:leaderboard",
  myAward: "drops:myAward",
  myEvidence: "signal:myEvidence",
  room: "signal:room",
  setPresence: "signal:setPresence",
  setTheory: "signal:setTheory",
  lockIn: "signal:lockIn",
  ...JSON.parse(process.env.HARNESS_FNS ?? "{}"),
};

function deploymentUrl() {
  if (TARGET === "dev") return DEV_URL;
  if (process.env.HARNESS_URL) return process.env.HARNESS_URL;
  const env = readFileSync(resolve(ROOT, ".env.local"), "utf8");
  if (!/^CONVEX_DEPLOYMENT=anonymous/m.test(env)) throw new Error("--target local needs .env.local pointing at a local anonymous deployment");
  return env.match(/^EXPO_PUBLIC_CONVEX_URL=(.*)$/m)[1].trim();
}
const URL_ = deploymentUrl();

// Admin calls go through the CLI so internal functions stay internal. Local runs drop the deploy key so the CLI
// can only reach the local deployment in .env.local; dev runs require it. The key is never printed.
function convexRun(fn, args) {
  const env = { ...process.env };
  if (TARGET === "dev") {
    if (!env.CONVEX_DEPLOY_KEY) throw new Error("--target dev needs CONVEX_DEPLOY_KEY in the environment");
  } else delete env.CONVEX_DEPLOY_KEY;
  return new Promise((res, rej) =>
    execFile("npx", ["convex", "run", fn, JSON.stringify(args)], { cwd: ROOT, env, maxBuffer: 1 << 24 }, (e, stdout, stderr) => {
      if (e) return rej(new Error("convex run " + fn + " failed: " + (stderr || e.message).replace(/(prod|dev):[^\s|]+\|\S+/g, "[key]").slice(0, 600)));
      const t = stdout.trim();
      try { res(t ? JSON.parse(t) : null); } catch { res(t); }
    }),
  );
}

const now = () => Date.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (xs, p) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
};
const stats = (xs) => ({ n: xs.length, p50: pct(xs, 50), p95: pct(xs, 95), max: xs.length ? Math.max(...xs) : null });
const errCode = (e) => e?.data?.code ?? String(e?.message ?? e).slice(0, 200);
async function errOf(p) { try { await p; return null; } catch (e) { return errCode(e); } }

// Contract split: N=3 -> 3s, remainder 2 -> one duo, remainder 1 (n>=4) -> two duos. N=2 -> duos, remainder 1 -> one trio.
function expectedSplit(n, size) {
  if (n < 2) return [];
  if (size === 2) return n % 2 === 0 ? Array(n / 2).fill(2) : [...Array((n - 3) / 2).fill(2), 3];
  const r = n % 3;
  if (r === 0) return Array(n / 3).fill(3);
  if (r === 2) return [...Array((n - 2) / 3).fill(3), 2];
  return [...Array((n - 4) / 3).fill(3), 2, 2];
}

const PIECE_TEXT = {
  camera: /docking ring from 21:30/i,
  witness: /played Go with me/i,
  scene: /locked inside the clean room/i,
};

class Player {
  constructor(i, run) {
    this.i = i;
    this.name = "H" + String(i + 1).padStart(2, "0") + "-" + run.tag;
    this.token = "harness-" + randomUUID();
    this.c = new ConvexClient(URL_, { unsavedChangesWarning: false, logger: VERBOSE });
    this.run = run;
    this.subs = [];
    this.views = {};
    this.waiters = {};
    this.lbLog = [];
  }
  m(key, args) { return this.c.mutation(F(FNS[key]), { deviceToken: this.token, ...args }); }
  q(key, args) { return this.c.query(F(FNS[key]), { deviceToken: this.token, ...args }); }
  watch(key, args, slot = key) {
    this.waiters[slot] ??= [];
    const unsub = this.c.onUpdate(
      F(FNS[key]),
      { deviceToken: this.token, ...args },
      (v) => {
        const at = now();
        this.views[slot] = v;
        if (slot === "leaderboard" && v) this.lbLog.push({ at, rows: v.rows });
        this.waiters[slot] = this.waiters[slot].filter((w) => !w(v, at));
      },
      (e) => this.run.errors.push(this.name + " " + slot + " subscription: " + errCode(e)),
    );
    this.subs.push(unsub);
  }
  until(slot, pred, ms = 60000) {
    return new Promise((res, rej) => {
      const v = this.views[slot];
      if (v !== undefined && pred(v)) return res(now());
      const t = setTimeout(() => rej(new Error("timeout " + this.name + " waiting on " + slot)), ms);
      (this.waiters[slot] ??= []).push((v, at) => { if (pred(v)) { clearTimeout(t); res(at); return true; } return false; });
    });
  }
  async close() { this.subs.forEach((u) => u()); await this.c.close(); }
}

async function runScenario(sc) {
  const tag = randomUUID().slice(0, 6);
  const run = { tag, results: [], timings: {}, errors: [] };
  const rec = (name, pass, detail) => {
    run.results.push({ name, pass: !!pass, detail });
    console.log("  " + (pass ? "PASS" : "FAIL") + " " + name + (detail && (VERBOSE || !pass) ? " :: " + JSON.stringify(detail) : ""));
  };
  const { n, squadSize, winnerSlots, totalCents = 6000 } = sc;
  const dropId = "harness-" + tag;
  const t0 = now();
  console.log("\n== " + sc.name + ": n=" + n + " squadSize=" + squadSize + " X=" + winnerSlots + " drop=" + dropId);

  const players = Array.from({ length: n }, (_, i) => new Player(i, run));
  const outsider = new Player(999, run);
  try {
    await convexRun(FNS.createDrop, {
      dropId,
      title: "Harness " + tag,
      creatorName: "Harness",
      caseId: "aurora01",
      squadSize,
      startsAt: now() + 60 * 60 * 1000,
      bounty: { totalCents, currency: "usd", winnerSlots },
    });

    // Entry
    for (const p of players) p.watch("drop", { dropId });
    const tEnter = now();
    await Promise.all(players.map((p, k) => sleep(k * 5).then(() => p.m("enter", { dropId, name: p.name }))));
    run.timings.enterAllMs = now() - tEnter;
    await players[0].m("enter", { dropId, name: players[0].name });
    await Promise.all(players.map((p) => p.until("drop", (v) => v?.entrantCount === n && v.me.entered)));
    const dv = players[0].views.drop;
    const entryOrder = dv.entrants.map((e) => e.name);
    const byName = new Map(players.map((p) => [p.name, p]));
    players.forEach((p) => (p.entryIndex = entryOrder.indexOf(p.name)));
    rec("entry: count and names match, one isMe per phone, re-entering is idempotent, no tokens exposed",
      dv.status === "scheduled" && dv.entrantCount === n && entryOrder.length === n && entryOrder.every((x) => byName.has(x)) &&
      players.every((p) => p.views.drop.entrants.filter((e) => e.isMe).length === 1 && p.views.drop.entrants[p.entryIndex]?.isMe) &&
      players.every((p) => !JSON.stringify(dv).includes(p.token)),
      { status: dv.status, entrantCount: dv.entrantCount });

    for (const p of players) p.watch("leaderboard", { dropId });

    // Start
    const tStart = now();
    await convexRun(FNS.startNow, { dropId });
    const tCli = now();
    run.timings.startNowCliMs = tCli - tStart;
    const assigned = await Promise.all(players.map((p) => p.until("drop", (v) => v?.status !== "scheduled" && (!!v.me.squad || v.me.unmatched), 30000)));
    run.timings.squadVisibleAfterStart = stats(assigned.map((t) => t - tCli));

    rec("late entry after start -> DROP_CLOSED", (await errOf(outsider.m("enter", { dropId, name: "Late" }))) === "DROP_CLOSED");

    // Split
    const squads = new Map();
    for (const p of [...players].sort((a, b) => a.entryIndex - b.entryIndex)) {
      const s = p.views.drop.me.squad;
      if (!s) continue;
      if (!squads.has(s.code)) squads.set(s.code, { code: s.code, label: s.label, size: s.size, members: [] });
      squads.get(s.code).members.push(p);
    }
    const list = [...squads.values()];
    const want = expectedSplit(n, squadSize);
    const got = list.map((s) => s.members.length);
    const sortD = (a) => [...a].sort((x, y) => y - x).join("+");
    const unmatched = players.filter((p) => p.views.drop.me.unmatched).length;
    rec("split: squad sizes match the contract table and each squad's size field",
      sortD(got) === sortD(want) && list.every((s) => s.size === s.members.length) && unmatched === (n < 2 ? n : 0),
      { want: want.join("+") || "none", got: got.join("+") || "none", unmatched });
    const contiguous = list.every((s) => s.members.every((p, k) => k === 0 || p.entryIndex === s.members[k - 1].entryIndex + 1));
    rec("split: squads are contiguous runs of entry order", contiguous, { squads: list.map((s) => s.members.map((p) => p.entryIndex)) });

    if (n < 2) {
      const v = players[0].views.drop;
      rec("lone entrant: drop ends, entrant unmatched, no squad", v.status === "ended" && v.me.unmatched && !v.me.squad, { status: v.status });
      return run;
    }

    // Rooms and evidence
    for (const s of list) for (const p of s.members) p.watch("room", { code: s.code });
    await Promise.all(list.flatMap((s) => s.members.map((p) => p.until("room", (v) => !!v?.me))));
    const roomsOk = list.every((s) => s.members.every((p) => {
      const v = p.views.room;
      return v.squadSize === s.size && v.members.length === s.size && v.drop?.dropId === dropId && v.drop.squadLabel === s.label &&
        ["intro", "playing"].includes(v.status) && !v.isHost && v.caseId === "aurora01";
    }));
    rec("rooms: every member sees its squad room (intro, right size, drop label, aurora01, no host)", roomsOk,
      { statuses: [...new Set(players.map((p) => p.views.room?.status))] });

    const evidence = new Map();
    await Promise.all(players.map(async (p) => evidence.set(p, await p.q("myEvidence", { code: p.views.drop.me.squad.code }))));
    let gatingOk = true;
    const gatingDetail = [];
    for (const s of list) {
      const pieces = s.members.map((p) => (evidence.get(p) ?? []).map((d) => d.pieceId));
      const flat = pieces.flat();
      const full = flat.length === 3 && ["camera", "witness", "scene"].every((x) => flat.includes(x));
      const perPhone = s.size === 3 ? pieces.every((x) => x.length === 1) : pieces.map((x) => x.length).sort().join() === "1,2";
      const noLeak = s.members.every((p, k) => {
        const raw = JSON.stringify(evidence.get(p));
        return Object.entries(PIECE_TEXT).every(([id, re]) => pieces[k].includes(id) || !re.test(raw));
      });
      const rolesMatch = s.members.every((p, k) => p.views.room.members.find((m) => m.isMe)?.roles.length === pieces[k].length);
      const roomClean = s.members.every((p) => {
        const raw = JSON.stringify(p.views.room);
        return !/took the seed/i.test(raw) && !Object.values(PIECE_TEXT).some((re) => re.test(raw));
      });
      if (!(full && perPhone && noLeak && rolesMatch && roomClean)) { gatingOk = false; gatingDetail.push({ squad: s.label, pieces, full, perPhone, noLeak, rolesMatch, roomClean }); }
    }
    const foreign = list.length > 1 ? await list[1].members[0].q("myEvidence", { code: list[0].code }) : null;
    const outsiderEv = await outsider.q("myEvidence", { code: list[0].code });
    rec("evidence: each squad holds all 3 pieces once, each phone only its own, other squads and outsiders get none",
      gatingOk && !foreign?.length && !outsiderEv?.length,
      { failures: gatingDetail.slice(0, 3), foreignSquad: foreign, outsider: outsiderEv });
    const piecesBySquad = list.map((s) => s.members.map((p) => (evidence.get(p) ?? []).map((d) => d.pieceId).join("+")).join(" / "));
    run.timings.dealt = piecesBySquad;

    // Squad rooms start at intro; everyone marks ready to start playing.
    await Promise.all(players.filter((p) => p.views.room.status === "intro").map((p) => p.m("setPresence", { code: p.views.room.code, presence: "ready" })));
    await Promise.all(players.map((p) => p.until("room", (v) => v.status === "playing", 30000)));

    // Race
    const S = list.length;
    const wrongSquads = new Set(list.slice(0, sc.wrongSquads ?? 0).map((s) => s.code));
    const clean = list.filter((s) => !wrongSquads.has(s.code));
    const photo = Math.min(sc.photoFinish ?? Math.max(2, winnerSlots + 1), clean.length);
    const done = new Map();
    const lockOutcomes = [];
    const releaseAt = now() + (sc.raceLeadMs ?? 3000) + (sc.thinkMs ?? 0);
    const raceSquad = async (s, k) => {
      const first = s.members[0];
      const code = s.code;
      if (wrongSquads.has(code)) {
        const r = await first.m("setTheory", { code, culprit: "theo" });
        await Promise.all(s.members.map((p) => p.until("room", (v) => v.theory.revision === r.revision)));
        let res;
        for (const p of s.members) res = await p.m("lockIn", { code, revision: r.revision });
        await first.until("room", (v) => v.cooldownUntil != null);
        const cdLeft = first.views.room.cooldownUntil - now();
        const r2 = await first.m("setTheory", { code, culprit: "jun" });
        const cooldownErr = await errOf(first.m("lockIn", { code, revision: r2.revision }));
        lockOutcomes.push({ squad: s.label, outcome: res.outcome, nudge: res.nudge?.text, holder: res.nudge?.holder?.name, cooldownErr, cooldownLeftMs: cdLeft });
        await sleep(Math.max(0, first.views.room.cooldownUntil - now()) + 300);
      } else if (sc.thinkMs) {
        await sleep(Math.floor(Math.random() * sc.thinkMs));
      }
      const r = await first.m("setTheory", { code, culprit: "jun" });
      await Promise.all(s.members.map((p) => p.until("room", (v) => v.theory.revision === r.revision)));
      for (const p of s.members.slice(0, -1)) {
        const o = await p.m("lockIn", { code, revision: r.revision });
        if (o.outcome !== "locked") run.errors.push(s.label + " early lock-in outcome " + o.outcome);
      }
      // Photo-finish squads all hold their last lock-in for the same instant; the rest follow staggered.
      if (!wrongSquads.has(code)) {
        const at = k < photo ? releaseAt : releaseAt + (k - photo + 1) * (sc.staggerMs ?? 150);
        await sleep(Math.max(0, at - now()));
      }
      const last = s.members[s.members.length - 1];
      const sentAt = now();
      const o = await last.m("lockIn", { code, revision: r.revision });
      done.set(code, { sentAt, ackAt: now(), outcome: o.outcome });
    };
    const settled = await Promise.allSettled([...clean.map((s, k) => raceSquad(s, k)), ...list.filter((s) => wrongSquads.has(s.code)).map((s) => raceSquad(s, 0))]);
    settled.filter((x) => x.status === "rejected").forEach((x) => run.errors.push("race: " + errCode(x.reason)));
    const photoSends = clean.slice(0, photo).map((s) => done.get(s.code)?.sentAt).filter(Boolean);
    run.timings.photoFinish = { squads: photo, sendSpreadMs: photoSends.length ? Math.max(...photoSends) - Math.min(...photoSends) : null };
    run.timings.finalLockInAck = stats([...done.values()].map((x) => x.ackAt - x.sentAt));
    rec("race: every squad's final lock-in resolves", [...done.values()].filter((x) => x.outcome === "resolved").length === S,
      { outcomes: [...done.values()].map((x) => x.outcome), photo: run.timings.photoFinish });
    if (wrongSquads.size) rec("wrong pick: 'Not Theo.' nudge names the holder, cooldown set, early retry -> COOLDOWN",
      lockOutcomes.length === wrongSquads.size && lockOutcomes.every((x) => x.outcome === "wrong" && /^Not Theo\./.test(x.nudge ?? "") && x.holder && x.cooldownErr === "COOLDOWN" && x.cooldownLeftMs > 15000),
      lockOutcomes);

    // Leaderboard
    const X = Math.min(winnerSlots, S);
    await Promise.all(players.map((p) => p.until("leaderboard", (v) => v?.rows.filter((r) => r.rank != null).length === S, 30000)));
    await Promise.all(players.map((p) => p.until("room", (v) => v.status === "resolved" && v.drop?.rank != null, 30000)));
    const lb = players[0].views.leaderboard;
    const ranks = lb.rows.map((r) => r.rank);
    const strip = (v) => JSON.stringify(v.rows.map(({ isMine, ...r }) => r));
    const sameEverywhere = players.every((p) => strip(p.views.leaderboard) === strip(lb));
    const mineOk = players.every((p) => {
      const mine = p.views.leaderboard.rows.filter((r) => r.isMine);
      return mine.length === 1 && mine[0].squadLabel === p.views.drop.me.squad.label;
    });
    const byLabel = new Map(lb.rows.map((r) => [r.squadLabel, r]));
    const membersOk = list.every((s) => JSON.stringify([...(byLabel.get(s.label)?.memberNames ?? [])].sort()) === JSON.stringify(s.members.map((p) => p.name).sort()));
    const roomRankOk = list.every((s) => s.members.every((p) => p.views.room.drop.rank === byLabel.get(s.label)?.rank && p.views.room.drop.isWinner === byLabel.get(s.label)?.rank <= X));
    const solveMsMonotonic = lb.rows.every((r, k) => k === 0 || r.solveMs >= lb.rows[k - 1].solveMs);
    rec("leaderboard: ranks 1.." + S + ", exactly " + X + " winners, the rest solved, identical on every phone",
      JSON.stringify(ranks) === JSON.stringify(list.map((_, k) => k + 1)) &&
      lb.rows.filter((r) => r.status === "winner").length === X &&
      lb.rows.every((r) => (r.rank <= X ? r.status === "winner" : r.status === "solved")) &&
      lb.winnerSlots === winnerSlots && sameEverywhere,
      { ranks, statuses: lb.rows.map((r) => r.status), sameEverywhere });
    rec("leaderboard: isMine, member names and room rank/isWinner match the server", mineOk && membersOk && roomRankOk, { mineOk, membersOk, roomRankOk });
    rec("leaderboard: solveMs non-negative and non-decreasing by rank (commit order)", solveMsMonotonic && lb.rows.every((r) => r.solveMs >= 0), { solveMs: lb.rows.map((r) => r.solveMs) });
    if (wrongSquads.size) rec("leaderboard: wrong-guess squads ranked after the clean squads and carry their attempts",
      list.filter((s) => wrongSquads.has(s.code)).every((s) => byLabel.get(s.label).rank > clean.length && byLabel.get(s.label).attempts >= 1),
      { wrong: list.filter((s) => wrongSquads.has(s.code)).map((s) => byLabel.get(s.label)) });

    // Stability: once ranked, a squad's rank never changes on any phone.
    let reorder = 0;
    for (const p of players) {
      const seen = new Map();
      for (const { rows } of p.lbLog) for (const r of rows) {
        if (r.rank == null) continue;
        if (seen.has(r.squadLabel) && seen.get(r.squadLabel) !== r.rank) reorder++;
        seen.set(r.squadLabel, r.rank);
      }
    }
    await sleep(1500);
    const again = await players[players.length - 1].q("leaderboard", { dropId });
    rec("leaderboard: stable (no rank ever changed on any phone, re-read after 1.5s identical)", reorder === 0 && strip(again) === strip(lb), { reorder });

    // Latency from each final lock-in send until each phone's leaderboard shows that squad ranked.
    const lat = [];
    for (const s of list) {
      const sent = done.get(s.code)?.sentAt;
      if (!sent) continue;
      for (const p of players) {
        const hit = p.lbLog.find((e) => e.rows.some((r) => r.squadLabel === s.label && r.rank != null));
        if (hit) lat.push(hit.at - sent);
      }
    }
    run.timings.leaderboardUpdate = stats(lat);

    // Awards
    // Awards come from a scheduled action: wait until no winner's award is still pending.
    const tAward = now();
    let awards;
    for (;;) {
      awards = await Promise.all(players.map(async (p) => [p, await p.q("myAward", { code: p.views.drop.me.squad.code })]));
      const pending = awards.filter(([, a]) => a?.status === "pending").length;
      const winners = awards.filter(([, a]) => a).length;
      if ((winners && !pending) || now() - tAward > 15000) break;
      await sleep(250);
    }
    run.timings.awardReadyAfterRankMs = now() - tAward;
    let awardOk = true;
    const awardBad = [];
    for (const [p, a] of awards) {
      const row = byLabel.get(p.views.drop.me.squad.label);
      const size = p.views.drop.me.squad.size;
      const perPlayer = Math.floor(totalCents / winnerSlots / size);
      const ok = row.rank <= X
        ? !!a && a.place === row.rank && a.perPlayerCents === perPlayer && a.amountCents === perPlayer * size && a.redeemableCount === size &&
          (a.mode !== "concept" || (a.claimUrl === null && a.status === "ready" && /concept/i.test(a.label)))
        : a === null;
      if (!ok) { awardOk = false; awardBad.push({ squad: row.squadLabel, rank: row.rank, award: a }); }
    }
    const winnerCode = list.find((s) => byLabel.get(s.label).rank === 1).code;
    const loser = list.find((s) => byLabel.get(s.label).rank > X);
    const crossAward = loser ? await loser.members[0].q("myAward", { code: winnerCode }) : null;
    const outsiderWin = await outsider.q("myAward", { code: winnerCode });
    rec("awards: only winning squad members get theirs (place, share, per-player, redeemableCount); losers and outsiders get null",
      awardOk && crossAward === null && outsiderWin === null, { bad: awardBad.slice(0, 3), crossAward, outsiderWin, mode: awards.find(([, a]) => a)?.[1]?.mode });

    const final = await players[0].q("drop", { dropId });
    rec("drop: winnersSoFar consistent with the race", final.winnersSoFar === X || final.winnersSoFar === S, { winnersSoFar: final.winnersSoFar, status: final.status, X, S });
    rec("no client or subscription errors", run.errors.length === 0, { errors: run.errors.slice(0, 5) });
    return run;
  } catch (e) {
    rec("scenario completed without throwing", false, { error: errCode(e), errors: run.errors.slice(0, 5) });
    return run;
  } finally {
    run.timings.scenarioMs = now() - t0;
    for (const p of [...players, outsider]) await p.close().catch(() => {});
    console.log("  timings: " + JSON.stringify(run.timings));
  }
}

const MATRIX = [
  { name: "lone entrant", n: 1, squadSize: 3, winnerSlots: 1 },
  { name: "one duo", n: 2, squadSize: 3, winnerSlots: 1 },
  { name: "one trio", n: 3, squadSize: 3, winnerSlots: 1 },
  { name: "two duos", n: 4, squadSize: 3, winnerSlots: 1 },
  { name: "trio + duo", n: 5, squadSize: 3, winnerSlots: 1 },
  { name: "3+2+2, one squad guesses wrong first", n: 7, squadSize: 3, winnerSlots: 2, wrongSquads: 1 },
  { name: "duo target, odd n", n: 7, squadSize: 2, winnerSlots: 2 },
  { name: "10 entrants, 4-squad photo finish", n: 10, squadSize: 3, winnerSlots: 2, photoFinish: 4 },
  { name: "30 entrants, 10-squad photo finish", n: 30, squadSize: 3, winnerSlots: 3, photoFinish: 10 },
  { name: "30 entrants, staggered with think time", n: 30, squadSize: 3, winnerSlots: 3, photoFinish: 2, thinkMs: 3000, staggerMs: 300 },
];

const scenarios = flag("matrix", false)
  ? MATRIX
  : [{
      name: "custom",
      n: Number(flag("n", 10)),
      squadSize: Number(flag("squad", 3)),
      winnerSlots: Number(flag("winners", 2)),
      photoFinish: flag("photo", null) === null ? undefined : Number(flag("photo")),
      wrongSquads: Number(flag("wrong", 0)),
      thinkMs: Number(flag("think", 0)),
      staggerMs: Number(flag("stagger", 150)),
    }];

console.log("target=" + TARGET + " url=" + URL_);
const all = [];
for (const sc of scenarios) all.push({ scenario: sc, ...(await runScenario(sc)) });
const failed = all.flatMap((r) => r.results.filter((x) => !x.pass).map((x) => r.scenario.name + ": " + x.name));
const summary = { target: TARGET, url: URL_, at: new Date().toISOString(), passed: failed.length === 0, failed, runs: all };
if (OUT) { mkdirSync(dirname(resolve(OUT)), { recursive: true }); writeFileSync(resolve(OUT), JSON.stringify(summary, null, 2)); }
console.log("\n" + (failed.length ? "FAILED" : "ALL PASSED") + " (" + all.reduce((a, r) => a + r.results.length, 0) + " checks, " + failed.length + " failed)");
process.exit(failed.length ? 1 : 0);
