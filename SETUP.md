# Path to Glory: event site

The Project Lumi pre-season mentor event site (Nov 9–22, 2026), in the Concept A "mentor file" design, with:

- **Discord login** for players, mentors and staff
- **Team and solo applications** (one per Discord account), reviewed by staff
- **A calendar for each mentor and assistant coach**: they post the hours they're free (hour in → hour out)
- **Session requests**: players pick an hour in and an hour out inside those hours; the coach **accepts or declines** each one
- **A staff desk** to review applications, build teams, link coach slots to Discord accounts, and see every session
- Optional **Discord pings**: the coach is pinged when a request arrives, and the player when it's answered

No Google Calendar involved. Everything runs on your own Supabase project (free tier is plenty).

## What's in here

| Path | What it is |
|---|---|
| `site/` | The website. Plain HTML/CSS/JS, no build step. Deploy this folder. |
| `site/index.html` + `home.js` | Public page: brief, sign up, schedule, faculty, office hours, rosters, notes, channels |
| `site/desk.html` + `desk.js` | Logged-in desk: player file, mentor calendar, staff tools |
| `site/api.js` | Data layer: live (Supabase) and demo (browser-only) modes behind one API |
| `site/content.js` | Static event content: schedule, roles, resources, Discord links, seminars |
| `site/config.js` | Your Supabase URL and anon key (empty = demo mode) |
| `supabase/schema.sql` | Database tables, access rules, booking checks, Discord pings, starting data |

## Try it now (demo mode)

With `config.js` left empty, the site runs on sample data stored only in your browser. A yellow bar at the bottom lets you switch between **logged out**, a **player** (Jeiss), a **mentor** (Neotep) and **staff**, so you can walk through the whole flow.

From the top folder of the project:

```bash
py -m http.server 8766 --directory site
```

Then open http://localhost:8766. ("Reset data" in the yellow bar puts the sample data back.)

## Go live (about 20 minutes)

You need: a free [Supabase](https://supabase.com) account, a Discord account, and somewhere to host static files.

1. **Create a Supabase project.** Pick a region near most of your players.
2. **Set up the database.** In Supabase, open *SQL Editor*, paste all of `supabase/schema.sql`, and run it.
3. **Create a Discord application.** Go to the [Discord Developer Portal](https://discord.com/developers/applications), click *New Application*, then open *OAuth2*:
   - Copy the **Client ID** and the **Client Secret** (reset it if needed).
   - Under *Redirects*, add `https://<your-project-ref>.supabase.co/auth/v1/callback` (find the exact URL in step 4).
4. **Turn on Discord login in Supabase.** *Authentication → Sign In / Providers → Discord*: enable it and paste the Client ID and Secret. The callback URL for step 3 is shown on this screen.
5. **Tell Supabase where your site lives.** *Authentication → URL Configuration*:
   - *Site URL*: your site's address, e.g. `https://ptg.example.com`
   - *Redirect URLs*: add `https://ptg.example.com/**` and, for local testing, `http://localhost:8766/**`
6. **Connect the site.** *Project Settings → API*: copy the **Project URL** and the **anon public** key into `site/config.js`. The anon key is meant to be public; the rules in `schema.sql` protect the data. Never put the Discord Client Secret or the Supabase service key in the site.
7. **Deploy the `site` folder** to any static host: Netlify (drag the folder onto app.netlify.com/drop), Cloudflare Pages, GitHub Pages or Vercel. Then update step 5 with the final address.
8. **Make yourself staff.** Log in on the site once with Discord, then run this in *SQL Editor*:
   ```sql
   update public.profiles set role = 'staff' where username = 'your-discord-username';
   ```
   After that, staff can promote others from *Desk → Staff → People*.
9. **Link the mentors.** Each mentor and assistant coach logs in once. Then in *Desk → Staff → Coaches*, pick their Discord account for their slot. They now get the calendar on their desk and can fill in their own mentor file (playstyle, pool, history, about me).

### Optional: Discord pings

Create a webhook in the channel where mentors and players should be pinged (*Server Settings → Integrations → Webhooks → New Webhook → Copy Webhook URL*), then run in *SQL Editor*:

```sql
insert into private.settings (key, value)
values ('discord_webhook_url', 'https://discord.com/api/webhooks/...')
on conflict (key) do update set value = excluded.value;
```

Pings use Discord's `<t:…>` timestamps, so each reader sees the time in their own time zone. The webhook URL stays in a private schema the website can't read.

## How booking works

1. A mentor posts hours on their desk, e.g. **8:00 PM → 11:00 PM**, and can copy the same hours to other days in one go.
2. A player opens *Office hours*, picks the coach and a day, then an **hour in** and an **hour out** (30 minutes to 2 hours) inside those hours, and sends the request with a note.
3. The request shows on the mentor's desk under **Requests waiting**, tagged *Your team* or *Other team*.
4. The mentor **accepts** or **declines**. Accepting books the time and automatically declines any other request that overlaps it.
5. Either side can cancel a booked session. Players see every answer on their desk.

The database enforces the rules no matter what the page does:
- requests must sit inside posted hours, can't be in the past, and can't overlap a booked session
- assistant coaches take individual sessions only
- players have at most 5 requests waiting at once
- only the coach, or staff, can accept or decline
- coaches can't remove hours that have booked sessions in them

All times are stored in UTC and shown in each viewer's own time zone.

## Editing content

- **Schedule, links, seminars, roles, resources**: `site/content.js`. Paste the real Discord invite links into `links`.
- **Mentor files**: each mentor edits their own on their desk; staff can edit names and teams in *Staff → Coaches*.
- **Teams and rosters**: *Staff → Applications → Make team*, or *Staff → Teams*.

## Known limits

- Teammates in a team application are typed in by the captain, not verified. Staff link real accounts to a team under *Staff → Teams → Linked accounts*, which is what makes requests show as *Your team*.
- The calendars cover the 14 event days (Nov 9–22).
- There are no email notifications. Use the Discord webhook for pings.
