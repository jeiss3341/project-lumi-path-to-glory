# Design changes

A running list of design changes, newest first. Note anything that will need code or database work later, so Jeiss can pick it up.

## 2026-11-05
- Schedule: scrim days (Nov 11, 14, 18, 21) now show a Project Lumi "SCRIM" sticker (`site/art/scrim-sticker.svg`, the cat monitor logo with SCRIM in pixel letters) in place of the small Scrim/Prio tags, at a slightly different spot and angle on each day (seeded by the date, so it doesn't jump around between visits). The legend uses a mini sticker too, and "Tentative" is gone from the legend.
  - The "Days marked with a dashed tag are tentative…" sentence is removed from the Schedule intro. Scrim days are still tentative in `content.js`, but the calendar no longer marks that.
- Schedule intro: red squiggle under "two Sundays that count", and the "Days marked…" sentence moved to its own line. Squiggles in section headers use full red so they show on the dark desk.
- Removed the Sign up section (team and solo application forms) from the home page. Later sections are renumbered (Schedule is now 03 … Channels 08), and "Sign up" is gone from the top menu on both pages.
  - The "Signups open now!" ticket, the footer link and the desk's application buttons now go to The brief instead.
  - Needs a decision: there is no way to apply on the site any more. Players need another route (a Discord form, a link in the Sign Up! step, etc.). The form code is still in `site/home.js` (`renderApply`) and simply skips itself while the section is missing, so it can come back easily.
- The brief: fountain pen desk prop (`site/art/fountain-pen.svg`). Uncapped black pen with red trim and its cap, tucked under the Who's who paper with red ink leaking out onto the desk and a faint ink stain soaking into the paper's bottom edge. Decorative only (hidden from screen readers).

## 2026-11-04
- The brief: "How it runs" steps reworded and recapitalized (Sign Up!, Teams are Chosen., Pick your Coach, Book Sessions..., Play and Compete!).
  - New text marks for the steps and the Priority note in `site/content.js`: `**words**` = yellow highlighter, `_words_` = red squiggle underline. The application forms show the priority text without marks.
  - "Teams are Chosen." now just says "Teams will be picked and released!"; the priority rules live only in the Priority note.
  - Needs code check: "Book Sessions..." now says players book 30–60 minute reviews, but the booking form still asks for an hour in and an hour out. The two should match.
  - "Sign Up!" no longer mentions logging in with Discord (the Sign up section below still does).
- Who's who: role circles added (⚫ Staff, 🔴 Mentors, ⭕ Assistant Coaches, ⚪ Players).
- Link preview image added: `site/art/og.png` (made from `og-source.html`).
  - Needs code: `og:` and `twitter:` meta tags in `site/index.html` once the site has its real address.
- Fixed: the hero ID badge was squeezed into a thin strip, hiding the Katja art.
