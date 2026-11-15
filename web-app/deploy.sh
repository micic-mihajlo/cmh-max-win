#!/usr/bin/env bash
# Exports the Expo web build as a single-page app and deploys it to the Vercel project signal-app.
# app.json keeps web.output "server"; this overrides it to "single" for the export only.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

cp app.json app.json.bak
trap 'mv -f app.json.bak app.json' EXIT
node -e '
const fs = require("fs");
const config = JSON.parse(fs.readFileSync("app.json", "utf8"));
config.expo.web = { ...config.expo.web, output: "single" };
fs.writeFileSync("app.json", JSON.stringify(config, null, 2) + "\n");
'

export EXPO_PUBLIC_CONVEX_URL="$(grep '^EXPO_PUBLIC_CONVEX_URL=' .env | cut -d= -f2-)"
export EXPO_PUBLIC_CONVEX_SITE_URL="$(grep '^EXPO_PUBLIC_CONVEX_SITE_URL=' .env | cut -d= -f2-)"
: "${EXPO_PUBLIC_CONVEX_URL:?missing from .env}"
: "${EXPO_PUBLIC_CONVEX_SITE_URL:?missing from .env}"

rm -rf dist
corepack yarn expo export --platform web --output-dir dist
if ! grep -rq compassionate-puffin-914 dist/_expo; then
  echo "Convex URL is not inlined in dist/_expo; refusing to deploy" >&2
  exit 1
fi
cp web-app/vercel.json dist/vercel.json

cd dist
vercel link --yes --project signal-app
vercel deploy --prod --yes
