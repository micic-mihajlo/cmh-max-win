# cmh-max-win
Capy hackathon project

## Convex backend

The backend lives in `convex/` and deploys to the dev deployment `compassionate-puffin-914` (https://compassionate-puffin-914.convex.cloud). The schema is a placeholder until the hackathon idea is picked.

### Setup

1. Get the dev deploy key for `compassionate-puffin-914` from the Convex dashboard (Settings → Deploy keys), or ask the team for it.
2. Export it in your shell, never in a committed file:

   ```sh
   export CONVEX_DEPLOY_KEY='dev:compassionate-puffin-914|...'
   ```

   On Capy, add it as a project environment variable instead so every machine gets it.
3. Install dependencies: `pnpm install`.

### Scripts

- `pnpm dev` runs `convex dev`: it watches `convex/` and pushes each change to the dev deployment. Add `--once` to push a single time.
- `pnpm deploy` runs `convex deploy`: a one-shot push to the deployment the key points at.
- `pnpm typecheck` type-checks the Convex functions.

Check the deployment with `npx convex run health:check`, which should return `{ "ok": true, "time": ... }`.

`convex dev` writes `.env.local`; it's gitignored, so keep it out of commits.
