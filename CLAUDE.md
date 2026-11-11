# Path to Glory site — working notes for Claude

Read this before changing or publishing anything. Jeiss owns the project; teammates (for example kattvngu, who does design changes and logs them in `DESIGN-CHANGES.md`) work on it too. Anyone working on the project may publish to the live site the same way.

## Two sites, two branches

| Branch | Site | What it is |
|---|---|---|
| `main` | Practice site: https://jeiss3341.github.io/project-lumi-path-to-glory/site/ | Demo mode, sample data in the browser. Updates ~1 min after a push. |
| `live` | Real site: https://projectlumi.space (also pathtoglory.projectlumi.space) | Real Supabase data and Discord login. Railway deploys the `live` branch automatically, ~1 min. |

The site itself is in `site/`. There is no build step: the files are served as they are.

## How to publish

1. **Get everyone's latest work first:** `git pull --rebase origin main` (several people push to `main`).
2. **"push" / "push to the demo"** → commit, then `git push origin main`. Practice site only.
3. **"push it live" / "push to live"** → only when the person in this session says so, in their own words, for this change. Then:
   - `git pull --rebase origin main`, then `git push origin main` (if anything is new), then **`git push origin main:live`**.
   - Everything on `main` goes live, including other people's changes. Before pushing, run `git log --oneline origin/live..origin/main` and tell the person in a few plain words what will go live.
   - Afterwards, check the real site really has it: fetch a changed file from `https://projectlumi.space/<file>` (add `?x=<random>` to skip caches) and compare it with the local file, or open the page. Railway takes about a minute.
4. **Before going live, open the page and check the browser console has no errors.** A broken file breaks the real site for everyone.

## Database changes (Supabase)

- SQL files live in `supabase/`. Claude can't run them: put the SQL on the clipboard (PowerShell `Set-Clipboard`) and the person pastes it into Supabase → SQL Editor → + New → Run (with nothing highlighted). End each file with a `select` that shows it worked.
- **Run the SQL before pushing site code that needs it to the live site.** New site code that sends a field the database doesn't have yet breaks that feature (it happened once: visit counting stopped until the SQL ran).
- After creating tables: `notify pgrst, 'reload schema';`.

## Things not to do

- Never commit private files: `Path-to-Glory-Access-List.xlsx`, `Path-to-Glory-*.sql`, anything with names + Discord IDs, passwords or keys. The repo is public.
- Never ask for or accept secrets in chat (Supabase password or keys, Discord or Twitch secrets).
- Lumi-chan (the Discord bot that tracks [PTG] Twitch streams) is a separate repo and Railway project (`jeiss3341/lumi-chan`, branch `ptg-tracker`). Changes to the site don't need anything there.
- In the Railway "Path To Glory" project, don't click "Update available" (a template update that could replace the site's code).
- Demo data lives in `site/api.js` → `demoApi()`. If you change it, bump the demo `KEY` (pick a higher number than the current one).

## Style

The owner wants plain language, one small step at a time, and proof (a check on the site) before saying something is done. Design: clean, readable sheet-style layouts in the site's own look (dark page, paper sheets, red accents).
