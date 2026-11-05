# Path to Glory

The website for **Path to Glory**, Project Lumi's pre-season mentor event for the Eternal Return competitive scene (Nov 9–22, 2026).

It has Discord login, team and solo signups, a calendar for each mentor, and session requests that mentors accept or decline. The design is "the mentor file": a case file on a desk, with ID badges, red tape and typewriter text.

## What's where

| Folder / file | What it is |
|---|---|
| `index.html` | Front page linking everything below |
| `site/` | The real website. Plain HTML, CSS and JavaScript, no build step |
| `site/art/` | Art: the link preview image, and mentor badge art as it arrives |
| `design-handoff.html` | Design handoff: art specs, colors, fonts, components, file map |
| `concepts/` | The four original design directions. A (`a-mentor-file.html`) was picked |
| `poster.webp` | The original event poster the design comes from |
| `og-source.html` | The page the link preview image is made from |
| `supabase/` | Database setup for the live version |
| `SETUP.md` | How to take the site live with Supabase and Discord login |
| `DESIGN-CHANGES.md` | Running list of design changes and code follow-ups |

## Look at it

**Online:** if GitHub Pages is on, open the repo's Pages address. The front page links to the site, the handoff and the concepts.

**On your computer:** from this folder, run

```bash
py -m http.server 8766
```

Then open http://localhost:8766. On a Mac, use `python3` instead of `py`.

The site runs in **demo mode** with sample data. Use the yellow bar at the bottom to view it as a player, a mentor or staff. Nothing you do there is saved anywhere except your own browser.

## Working on it

- **Design (current stage):** everything is open to change: art, styles, layout, page structure and wording. Start with `design-handoff.html`. Most of the look is in `site/styles.css` and `site/app.css`. Badges, forms, the booking card and the mentor calendar are built in `site/home.js`, `site/desk.js` and `site/ui.js`.
- **Keep demo mode working.** After a change, run the site and click through as a player, a mentor and staff.
- **Log what you change** in `DESIGN-CHANGES.md`, including anything that will need code or database work.
- **Never put secrets in this repo.** `site/config.js` stays empty until the site goes live (see `SETUP.md`).
