# Bethlehem SDA 3v3 Tournament App

Next.js (App Router) + Drizzle ORM + Postgres. No auth anywhere, including `/admin` — URLs are the access control.

## Pages

| URL | Purpose |
| --- | --- |
| `/checkin` → `/checkin/[teamSlug]` | Volunteer check-in table |
| `/live` | Projected on the venue screen — live scores, standings, bracket, 3pt leaderboard |
| `/ref` → `/ref/[refSlug]` → `/match/[matchId]` | Ref scorekeeping |
| `/team` → `/team/[teamSlug]` | Player/captain schedule lookup |
| `/threept` | 3-point contest entry |
| `/admin` | Organizer dashboard — teams, format, schedule, refs, seeding, overrides, phase/reset |

## Local development

Requires a local Postgres (this was built against Homebrew `postgresql@14` on `localhost:5432`).

```bash
createdb threes_dev          # first time only
npm install
npm run db:push              # sync schema (drizzle-kit push, no migration files)
npm run db:seed              # inserts the Tournament row + 5 Courts (safe to re-run)
npm run dev
```

`.env.local` holds `DATABASE_URL` — the only environment-specific file. `npm run db:studio` opens Drizzle Studio if you want to browse the DB directly.

## Deploying tonight (Vercel + Vercel Postgres)

No deploy was run from this session — do this part yourself, it needs your login (~5 minutes):

1. **Push this project to a Git repo** (GitHub is easiest — Vercel's dashboard import flow expects one):

   ```bash
   git init && git add -A && git commit -m "Initial commit"
   ```

   Create a new repo on GitHub, then `git remote add origin <url> && git push -u origin main`.

   *(Alternative without GitHub: install the Vercel CLI — `npm i -g vercel` — then run `vercel` from this directory and follow the prompts. It deploys straight from your local files, no Git required. Steps 2–4 below are the same either way, just done from the CLI's project settings instead of clicking through the dashboard.)*

2. **Import the project** at [vercel.com/new](https://vercel.com/new) — select the repo, framework preset auto-detects as Next.js. Don't deploy yet if the dashboard offers to add Postgres first; otherwise deploy once, then continue below.

3. **Add Postgres**: in the Vercel project → **Storage** tab → **Create Database** → **Postgres** (Neon-backed). This automatically sets `DATABASE_URL` (and a few related env vars) on the project — no manual copy-paste needed.

4. **Push the schema to the new database.** From your local machine, pull the new env var down and run the same push/seed commands against it:

   ```bash
   vercel env pull .env.production.local
   DATABASE_URL=$(grep ^DATABASE_URL .env.production.local | cut -d= -f2-) npm run db:push
   DATABASE_URL=$(grep ^DATABASE_URL .env.production.local | cut -d= -f2-) npm run db:seed
   ```

   (Or open the Storage tab's built-in query console and run the equivalent SQL — `db:push`/`db:seed` is faster.)

5. **Redeploy** (Vercel → Deployments → ⋯ → Redeploy) so the running app picks up the new `DATABASE_URL`.

6. **Smoke-test** `/admin` on the live URL, add one team, confirm it shows up on `/checkin` — then do the full dry run from a phone on the venue WiFi before doors open.

The app code itself needs zero changes between local and deployed — same `pg`-driver code path either way (see `src/lib/db/index.ts`), just a different `DATABASE_URL`.

## Notable implementation notes

- **Odd headcounts in the random-pairing fallback format**: rather than some teams playing only 2 games, one randomly chosen "floater" team plays 3 fresh games and the 3 teams it's paired against get a bonus 4th game. Standings sort by win% (not raw wins) so this doesn't distort ranking. See `src/lib/algorithms/randomPairing.ts`.
- **Scorekeeping concurrency**: a ref's device holds a `lock_token` (in `localStorage` + the match row) after tapping Start; only that device can submit scores until admin unlocks it. See `src/app/api/matches/[id]/{start,score,final}/route.ts`.
- **Reset Tournament Data** wipes matches/scores/groups only — teams, rosters, payment/check-in status, refs, and courts are untouched.
