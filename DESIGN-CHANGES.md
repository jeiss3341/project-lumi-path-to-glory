# Design changes

A running list of design changes, newest first. Note anything that will need code or database work later, so Jeiss can pick it up.

## 2026-11-09
- Faculty: mentor files 03–08 filled in from the Coach Infographic form, front and back: 03 Fwitchu (Uberman), 04 Hresvelg (uberman), 05 Isterio (Blast), 06 Kazcross (The Casting Desk), 07 Magepower (6789), 08 Ioo (6789). Demo mentor logins renamed to match.
  - Chibiarc is no longer coaching: his file, Shoichi card art (`site/art/m3.webp`) and doodles (chibi face, ears, "!", fries) are removed. Mentor 03's card is back to the Researcher Barbara placeholder.
  - Form quotes added on the backs of Dylan's ("Head Empty") and Hresvelg's files. Magepower's back has a red pencil maple leaf and mushroom by Other Games ("Maphul" = MapleStory).
  - "Off the record" stamp stays to the right of the name: it shrinks to fit beside long names (`fitStamp` in `site/home.js`). On phones, long names still stack above it.
  - Red pencil doodles beside section headings, based on each mentor's answers (`HEAD_DOODLES` in `site/home.js`, picked per mentor in `doodles` in `site/content.js`): Fwitchu piggy bank, salmon, napping cat; Hresvelg tick and cross, house on fire, angry bird; Isterio straight arrow, no coffee, shuttlecock; Kazcross mic, B tier, wave; Magepower crossed-out paw, mountain; Ioo three rings, eye, noodle bowl, paper plane.
  - Still to come: instructor card art for 03–08 and character pfps for their pools (they show a letter for now).
  - Needs database: if Chibiarc's Discord is linked to `m3` in `access_list`, point it at Fwitchu's. Check that the `coaches` rows for m3–m8 are blank or match, since anything saved there overrides `site/content.js`.
- Faculty doodles adjusted after the mentor file footer changed: Dylan's "# NORMS terrorist" note moved to the empty left side of the footer (it was overlapping Request a session), and Actor's burger lifted above the dashed line.

## 2026-11-05
- Assistant & role coaches: now 8 assistants (a5–a8 added, badges AST-0515-RC … AST-0518-RC) in two rows of four (two per row on tablets, one on phones).
  - Needs database: re-run the coaches seed in `supabase/schema.sql` (a5–a8 were added there; existing rows are left alone).
- Assistant & role coaches: names filled in: 01 Baeksu, 02 Jalja, 03 CamperonDuty, 04 Squortle, 05 Jignut, 06 Kyroshoot, 07 Superior, 08 Nesious.
  - Stickers: Jalja has a round chibi sticker (`site/art/stickers/jalja.webp`), Baeksu has a die-cut bread-loaf sticker that follows the drawing's outline (`site/art/stickers/baeksu.webp`). Set by `sticker` on the coach in `coachSeed`; the site falls back to that even when the live row has no sticker.
  - Needs database: the live `coaches` rows a1–a8 need these names.
- Assistant & role coaches: wear on some badges for variety: 02 scratches, 04 scuffed corner, 05 long gouge, 07 tape residue + red pen tick, 08 nicks + scuff (01, 03, 06 stay clean). Set per slot in `WEAR_BY_SLOT` in `site/home.js`.
- Assistant & role coaches: each card has a small square icon between the name and the role focus (dark grid, red corner marks, "?" until art is added). Add art by putting `a1: "art/a1.webp"` (etc.) in the `art` list in `site/content.js`.
- Faculty: red pencil doodles on Chibiarc's file, redrawn to follow the designer's sketch closely: uneven cat ears on the name with a chibi face under it (N-shaped bangs, big oval eyes, cat mouth, blush ticks), a hand-added "!" after "Some ercs wins", and a tipped-over fries carton with a zigzag and spilling fries by the character pool.
  - New content options: `"chibi"` and `"fries"` in `doodles`, and `[[…]]` in comp history for something added by hand (`[[!]]` draws a pencil exclamation mark).
- Faculty: red pencil scribbles on Dylan's file: "^_^" by the character pool, "baeksu" struck through and corrected to "BREADSU" in comp history, and "# NORMS terrorist" by the buttons.
  - New content options: `{{old|new}}` in comp history for a struck-through correction, `"smile"` in `doodles`, and `foot_scribble` for a handwritten note in the file's footer.
- Faculty: red pencil doodles on Actor's file (burst by the name, sparkle + crosses around the character pool, a burger by the comp history, and a pencil underline under "engage tank"). Drawn as SVG with the `#pencil` filter.
  - Per mentor: add `doodles: ["burst", "sparkles", "burger"]` (any of them) in `site/content.js`, and wrap words in `~~…~~` in playstyle / about / coaching for the pencil underline. The demo needs "Reset data" to pick up changes.
- Faculty: mentor 02 is **Dylan** (team Trigger) and mentor 03 is **Chibiarc** (team uberman), filled in from the Coach Infographic form (responses 1 and 3) the same way as Actor, front and back.
  - New optional fields: `pool_note` (small line under the character pool, e.g. "(lol)") and `ps` (a P.S. list on the back, used for Chibiarc's extra answer).
  - Chibiarc's "Some ercs wins / Sometimes plays rank / Sometimes stream / Master of sleeping" answer is split: the ERCS line under Competitive history, the rest under About me.
  - Character pfps added for Abigail, Darko, Hyunwoo and Shoichi (`site/art/chars/`).
  - Instructor card display art: Dylan → Prison Officer Abigail (`site/art/m2.webp`), Chibiarc → Shoichi (`site/art/m3.webp`), cropped close (head to chest) from the full arts. Any uploaded badge art now sits on a dark charcoal grid with darker edges (`.art-grid`), matching the Katja poster crop. Their display skins changed from Instructor Fiora / Researcher Barbara, and both were added to the `skins` list.
  - Needs database: the live `coaches` rows for m2/m3 need `display_skin` updated to match.
  - Needs code + database (same as Actor): these details only live in `site/content.js` for demo mode; the live `coaches` rows for m2/m3 need them too, plus the new `pool_note` and `ps` fields.
- Faculty: mentor 01 is now **Actor** (green tag "team not found"), with playstyle, character pool, competitive history and a two-paragraph about-me. The demo mentor login is renamed Actor too.
- Faculty: the mentor file flips over (click the file or "Flip file ↻") to an "Off the record" back with coaching style + motto, other games played, favorite hobbies, fav teams and a fun fact. Empty fields show placeholders for the other mentors.
  - Needs code + database: Actor's details live in `site/content.js` (`coachSeed`), which only feeds demo mode. For the live site, the `coaches` row for m1 needs the same name/team/playstyle/pool/history/about, and new columns for `coaching`, `motto`, `games`, `fun_fact`, `hobbies`, `fav_teams`, plus fields for them in the mentor's desk profile form (`site/desk.js`).
  - People who opened the demo before will still see the old sample data until they press "Reset data" in the yellow demo bar.
- Faculty file details:
  - Competitive history: a trailing "(…)" note now sits on its own smaller line under the result.
  - Character pool: a 104px black & white pfp box beside a column of character names (sized so the row matches Playstyle, no gap), no name label. The flip file is only as tall as the side facing up; hovering (or tapping) a character swaps the pfp. Niah, Markus and Kenneth have art in `site/art/chars/` (122×160 originals, so they're a little soft at full size). Other characters show their initial until an image is added to `charArt` in `site/content.js`.
  - Back: the motto is straight, in Reenie Beanie (Google Fonts) with a graphite pencil texture (`#pencil` SVG filter in `site/index.html`). "Off the record" stamp is bigger with an ink-bleed effect (`#ink-bleed` filter).
  - Note: `background-clip:text` breaks the 3D flip in Chrome, so texture effects on the flip card use SVG filters instead.
- Schedule planner: now a cream ticket (`#f4eee0`) with a light paper-fiber texture and stamp-style half-circle notches down both sides, after a ticket reference. The shadow follows the notched shape. Smaller notches and tighter margins on phones. Day box outlines darkened (`#a8987a`) so the grid reads clearly.
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
