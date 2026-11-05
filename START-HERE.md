# Start here (co-designer)

Welcome to Path to Glory. This page gets you from zero to designing in a few minutes.

## 1. Look at it first (no setup)

Open these in your browser:

- Everything, linked from one page: https://jeiss3341.github.io/project-lumi-path-to-glory/
- The design handoff (specs, colors, fonts, your checklist): https://jeiss3341.github.io/project-lumi-path-to-glory/design-handoff.html
- The real website, demo mode: https://jeiss3341.github.io/project-lumi-path-to-glory/site/
- Concept A, the chosen style: https://jeiss3341.github.io/project-lumi-path-to-glory/concepts/a-mentor-file.html

On the website, use the yellow bar at the bottom to switch between player, mentor (Neotep) and staff.

## 2. Get your own copy

1. Install GitHub Desktop from https://desktop.github.com and sign in with your GitHub account.
2. Accept Jeiss's invite to the repo (it arrives by email and on github.com).
3. In GitHub Desktop: **File → Clone repository** → pick `jeiss3341/project-lumi-path-to-glory` → choose a folder → **Clone**.

## 3. Open it with Claude

Open the folder you just cloned in Claude Code (or the Code tab of the Claude desktop app), then paste this prompt. Replace the last line with what you want to do first.

```text
I'm the co-designer for Path to Glory, Project Lumi's pre-season mentor event site for the Eternal Return competitive scene (Nov 9–22, 2026).

This folder is our GitHub repo. Before doing anything:
1. Read README.md (what's where).
2. Read design-handoff.html (art specs, colors, fonts, components, open decisions).
3. Look at poster.webp (the original event poster) and concepts/a-mentor-file.html (the chosen style).
4. Read DESIGN-CHANGES.md (what has changed so far).

I have full control of the design: art, styles, layout, page structure and wording. You may change any file.

How we work:
- To preview, run: py -m http.server 8766   (on a Mac: python3 -m http.server 8766)
  then open http://localhost:8766 and click through the site as player, mentor and staff using the yellow demo bar.
- Keep demo mode working after every change.
- Most of the look is in site/styles.css and site/app.css. Badges, forms, the booking card and the mentor calendar are built in site/home.js, site/desk.js and site/ui.js.
- New mentor art goes in site/art/ (e.g. m2.webp), plus one line in the `art` list in site/content.js.
- Never put passwords, keys or tokens in any file. site/config.js stays empty.
- After each finished change: add a line to DESIGN-CHANGES.md (what changed, and anything that will need code or database work later), then tell me so I can commit and push it in GitHub Desktop.

My first task: [write it here, for example: plan the 7 missing mentor display arts]
```

## 4. Save and share your work

In GitHub Desktop: write a short summary of what you changed → **Commit to main** → **Push origin**. Jeiss sees it right away, and the online links update in a minute or two.

## Ideas for a first task

- Plan and make the 7 missing mentor display arts (m2–m8). The specs are in the handoff.
- Add the link preview tags to `site/index.html` so Discord shows `site/art/og.png`.
- Review the site on your phone and fix anything that feels off.
- Answer the open design decisions at the bottom of the handoff.
