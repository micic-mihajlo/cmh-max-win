import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference as F } from "convex/server";
const c = new ConvexHttpClient("https://compassionate-puffin-914.convex.cloud");
const [cmd, a, b] = process.argv.slice(2);
const bots = ["Sarah", "Jen", "Tyler", "Kevin", "Brandon"].map((name, i) => ({ name, token: "ppbot-" + process.env.RUN + "-" + i }));
if (cmd === "enter") {
  for (const bt of bots) console.log(bt.name, JSON.stringify(await c.mutation(F("drops:enterDropByCode"), { deviceToken: bt.token, code: a, name: bt.name })));
}
if (cmd === "play") {
  const dropId = a, kitWord = b;
  const squads = {};
  for (const bt of bots) {
    const d = await c.query(F("drops:drop"), { deviceToken: bt.token, dropId });
    const code = d?.me?.squad?.code;
    const p = await c.query(F("passphrase:piece"), { deviceToken: bt.token, code });
    (squads[code] ??= []).push({ ...bt, p });
  }
  for (const [code, members] of Object.entries(squads)) {
    const slotCount = members[0].p.slotCount;
    const words = Array(slotCount).fill(kitWord);
    for (const m of members) words[m.p.position] = m.p.word;
    const full = members.length === slotCount;
    console.log(code, full ? "bots-only" : "kit squad", words.join(" "));
    const r1 = await c.mutation(F("passphrase:submitPassphrase"), { deviceToken: members[0].token, code, answer: words.join(" ") });
    console.log(" submit", JSON.stringify(r1));
    for (const m of members.slice(1)) console.log(" confirm", JSON.stringify(await c.mutation(F("passphrase:confirmPassphrase"), { deviceToken: m.token, code, revision: r1.revision })));
  }
}
