# Design changes

A running list of design changes, newest first. Note anything that will need code or database work later, so Jeiss can pick it up.

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
