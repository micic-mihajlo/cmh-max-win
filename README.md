# cmh-max-win

Capy hackathon project: an Expo (SDK 58) app with Expo Router and a Convex backend.

```sh
corepack enable
corepack yarn install
corepack yarn convex dev      # pushes convex/ and writes .env.local
corepack yarn start           # Expo dev server
```

Checks: `corepack yarn typecheck`, `corepack yarn expo lint`, `npx expo-doctor`. See [AGENTS.md](AGENTS.md) for Convex and Revyl phone builds.

Public pages (landing, privacy, terms) are static HTML in `web/`, deployed to https://signal-web-steel.vercel.app with `vercel deploy --prod` from that folder.
