# Design changes

A running list of design changes, newest first. Note anything that will need code or database work later, so Jeiss can pick it up.

## 2026-11-11
- Access: "student too". A mentor, assistant or staff member can also be a student (player) without being on a team: they get the Student view (Player file) and can request individual sessions. Staff switch it on in Desk › Staff › People › "Student too" (or `is_student` in the access list before the person has logged in). One rule in `UI.isStudent` (`site/ui.js`) is used by the profile menu, the desk and the booking planner.
  - Needs database: run `supabase/student-access.sql` in Supabase BEFORE this goes live (adds `is_student` to profiles and the access list, and lets "student too" accounts request sessions). `schema.sql` and `access-list.sql` are updated to match.
  - The site now loads every profile column (`PROFILE = "*"` in `site/api.js`), so a new column can't break logging in.
  - Demo: the demo mentor (Neotep's demo account, shown as Actor) is "student too", so "View as" mentor shows both Mentor and Student. Demo data key bumped to v37.

## 2026-11-10
- Faculty: Ioo's red pencil doodles redrawn from the designer's sketch: sparkles around the name (two plus signs, a little burst and a four-point star: `namesparks`), the designer's own Espurr sketch top right with its two dashes (`espurr`; traced from the sketch into `site/art/doodles/espurr.png`, a transparent mask the site colors red, so it matches the drawing exactly), and a red underline under "3 rings" in About me (`~~3 rings~~`). The old three-rings doodle by Competitive history is removed. Shapes are in `DOODLE` in `site/home.js`; each mentor picks theirs in `doodles` in `site/content.js`.
- Faculty: Ioo's file has the three Pikmin walking along the footer's bottom-left (`site/art/stickers/ioo-pikmin.png`). New content option: `foot_sticker`. (An Espurr pin by the name was tried and taken back out; `name_sticker` still works for any mentor.)
- Faculty: Kazcross's About me splits into two paragraphs ("Big fan of analyzing the game…" starts the second).
- Faculty: Isterio's file has a pouting chibi sticker (`site/art/stickers/isterio-pout.png`) right of his character pool. The source image is only 96px, so it's shown at 104px to stay sharp (new option `file_sticker_px`). A bigger version of the image would let it be larger.
- Faculty: Hresvelg's file has a photo sticker (plush in the Costco hat, `site/art/stickers/hresvelg-photo.webp`) under his playstyle: white photo border, slight tilt, and the file grows taller to fit it. New content option: `photo_sticker` on any mentor in `site/content.js`.
  - Back of Hresvelg's file: a 🫃 emoji sticker (white outline, tilted) right of his "mpreg squortle" motto. New content option: `back_sticker` (any emoji).
  - On a file with a photo, Playstyle + photo take the whole left column and Character pool, Competitive history and About me stack on the right (computers and tablets; phones stay one column).
- Faculty: Fwitchu's playstyle splits into two paragraphs ("Big fan of triangle theory…" starts the second). A cat sticker (`site/art/stickers/fwitchu-cat.png`, white background cut out) sits in the empty space right of his character pool. New content option: `file_sticker` on any mentor in `site/content.js`.
  - Second Fwitchu sticker: the cat getting its head patted (`site/art/stickers/fwitchu-cat-pat.png`), under his competitive history. New content option: `hist_sticker`.
  - Fwitchu's fun fact: the kaomoji + fish sit on their own line. `fun_fact` now supports `\n` for a new line.
- Assistant & role coaches: names link to their dak.gg too (small cards, the tall card, and the swinging top card). Added a1–a8 to `dakgg` in `site/content.js`: Baeksu 백수, Jalja popquiz, CamperonDuty, Squortle, Jignut jignutjorgeston, Kyroshoot, Superior, Nesious, and a9 Chibiarc.
  - Needs info: confirm popquiz is Jalja's account.
- Landing page: when the swinging card at the top is an instructor, it now flips to their Stats too (click, tap, Enter or Space), same as the Faculty badge. Assistants' cards don't flip (no stats). Shared `flipBadge` in `site/home.js`.
- Project Lumi logo swapped for the brighter red version (same files: `site/art/lumi-logo.png` and `site/art/lumi-logo-sm.png`), so the Main Hub card, tab icon and link preview all use it.
- Faculty: each mentor's name (on the ID badge and on both sides of the mentor file) links to their dak.gg profile in a new tab. Links are in `dakgg` in `site/content.js` (m1 PaidisThatActor, m2 Dylannn, m3 Fwitchu, m4 AatroxMain, m5 Isterio, m6 kazcross, m7 magepower, m8 ioo). Clicking the name doesn't flip the badge or file.
- Channels: the Project Lumi (Main Hub) card shows the Project Lumi TV cat logo on its right side (`site/art/lumi-logo-sm.png`, set by `logo` on the link in `site/content.js`).
- Link preview + tab icon: now the Project Lumi TV cat logo (`site/art/lumi-logo.png`) instead of `og.png` and the "PTG" square. `og:`/`twitter:` meta tags added to `site/index.html`, pointing at `https://jeiss3341.github.io/project-lumi-path-to-glory/site/`.

## 2026-11-09
- Faculty: each instructor ID badge now flips (click or tap it, or Enter/Space) to a "Stats" back with a six-sided chart of the mentor's self-ratings from the coach form (character flexibility, farming efficiency, aggressiveness, APM, patience, greed; 1–5, stored as `stats` in `site/content.js`). The back is built like the front: red strip, ID box, grid window with corner marks, name and team tag. The Faculty slideshow waits while a badge is flipped.
- Faculty: instructor card art and character pool pictures: Fwitchu shows Irem (`site/art/fwitchu.webp`, pictures Irem and Leni), Hresvelg shows Jan (`site/art/hresvelg.webp`, pictures Jan and Hisui), Isterio shows Luke (`site/art/isterio.webp`, pictures Luke and Jackie), Kazcross shows Henry (`site/art/kazcross.webp`, pictures Henry and Camilo), Magepower shows Alex (`site/art/magepower.webp`, pictures Alex and Fiora), Ioo shows Coraline (`site/art/ioo.webp`, pictures Coraline and Celine; Coraline's subject ID was already listed).
  - Needs info: these cards show the file number (INS-…) until Irem's, Jan's, Luke's, Henry's and Alex's in-game subject IDs are added to `subjects` in `site/content.js`.
- Faculty: mentor files 03–08 filled in from the Coach Infographic form, front and back: 03 Fwitchu (Uberman), 04 Hresvelg (uberman), 05 Isterio (Blast), 06 Kazcross (The Casting Desk), 07 Magepower (6789), 08 Ioo (6789). Demo mentor logins renamed to match.
  - Mentor order is 03 Fwitchu, 04 Hresvelg, 05 Isterio, 06 Kazcross, 07 Magepower, 08 Ioo (this replaces the order from the "real mentor names" commit). Chibiarc stays as Assistant 09 with his Shoichi card art; his mentor doodles (chibi face, ears, fries) are removed. Mentor 03's card is back to the Researcher Barbara placeholder.
  - Form quotes added on the backs of Dylan's ("Head Empty") and Hresvelg's files. Magepower's back has a red pencil maple leaf and mushroom by Other Games ("Maphul" = MapleStory).
  - "Off the record" stamp stays to the right of the name: it shrinks to fit beside long names (`fitStamp` in `site/home.js`). On phones, long names still stack above it.
  - Red pencil doodles beside section headings, based on each mentor's answers (`HEAD_DOODLES` in `site/home.js`, picked per mentor in `doodles` in `site/content.js`): Fwitchu piggy bank, salmon, napping cat; Hresvelg tick and cross, house on fire, angry bird; Isterio straight arrow, no coffee, shuttlecock; Kazcross mic, B tier, wave; Magepower crossed-out paw, mountain; Ioo three rings, eye, noodle bowl, paper plane.
  - Still to come: instructor card art for 03–08 and character pfps for their pools (they show a letter for now).
  - Needs database: in `access_list`, make sure each mentor's Discord points at the right slot for this order (m3 Fwitchu … m8 Ioo) and Chibiarc's at `a9`. Check that the `coaches` rows for m3–m8 are blank or match, since anything saved there overrides `site/content.js`.
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
