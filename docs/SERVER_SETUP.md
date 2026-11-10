# Server setup and safe rollout

The website no longer reads or writes the database directly. Every request goes
to `/api/*` (Vercel functions in `api/`, logic in `server/`). The server checks a
signed, HttpOnly session cookie and only then uses the Supabase service-role key.

| Route | Who | What |
|---|---|---|
| `/api/session` | anyone | Sign in with a hub token or the master key, check, sign out |
| `/api/attempts` | signed in | A student reads and saves only their own runs; staff can for any email |
| `/api/run-session` | signed in | The live copy of a run in progress (same ownership rule) |
| `/api/leaderboard` | signed in | Students see classmates as pseudonyms, staff see emails |
| `/api/staff` | trainer, admin | All attempts, live runs, stale count |
| `/api/admin` | admin | Delete a student, a batch, or stale live rows |

## Environment variables (Vercel → Settings → Environment Variables)

| Name | Required | Notes |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Supabase → Project Settings → API keys. Server only. |
| `SESSION_SECRET` | yes | 32+ random characters: `openssl rand -hex 32` |
| `SUPABASE_URL` | no | Falls back to `VITE_SUPABASE_URL` |
| `MASTER_KEY` | no | Emergency staff sign-in. 16+ characters. Unset = turned off. |
| `HUB_URL` | no | Defaults to `https://ksstudentshub.vercel.app` |

Never give a server value a `VITE_` prefix: Vite would ship it to every browser.
For local development put them in `.env.local` (ignored by git). `.env` is
committed and must hold only the public `VITE_` values.

## Rollout order (nothing is deleted at any step)

1. Set the environment variables above on Vercel.
2. Deploy this branch as a **preview**. Launch it through a hub-style link or
   `/login?master=<key>`, play a run to the end, check it appears in Admin,
   Trainer, Leaderboard and the student profile.
3. Merge and deploy to production. The old open policies are still in place,
   so a student with an old tab open keeps saving; old tabs reload onto the new
   version when they next change page.
4. When no class is running (Admin → "Live now" is empty), apply
   `supabase/migrations/20261108090000_lock_down_blinkit_tables.sql`. It only
   removes the "Anyone can ..." policies; the undo SQL is in the file.
5. Check: the anon key can no longer read `attempts` (the Supabase security
   advisor should stop flagging the open policies), and a fresh run still saves.

## If a student's sign-in ends mid-run

Sessions last 12 hours. If one ends, a banner asks the student to relaunch from
the hub. Their run is kept in the browser, and relaunching with the same email
keeps it; the results page retries the save on its next visit.
