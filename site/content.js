/* Path to Glory · static event content (things that don't change at run time).
   People, teams, applications, hours and requests live in the database. */
window.PTG = {
  event: {
    org: "Project Lumi",
    name: "Path to Glory",
    type: "Pre-Season Mentor Event",
    start: "2026-11-09",
    end: "2026-11-22",
    goal: "Develop the ER competitive scene.",
    pitch: "Break down the barrier & create a bridge for developing players to talk and learn from the best teams in the ER Comp Scene."
  },

  goals: ["Learn from the best players", "2 Tourney Days", "2 Week Event"],

  /* Step text marks: **words** = yellow highlighter, _words_ = red squiggle underline, \n = line break. */
  steps: [
    { t: "Sign Up!", d: "Register as a **full team**, or _sign up solo_ and get placed on a team with other individual players." },
    { t: "Teams are Chosen.", d: "Teams will be picked and released!" },
    { t: "Pick your Coach", d: "Chosen teams rank the mentors they want.\nStaff then distribute the 8 main mentors across the teams." },
    { t: "Book Sessions...", d: "Mentors post their availability.\nPlayers book 30–60 minute team or individual reviews, like booking an office hour!" },
    { t: "Play and Compete!", d: "Designated scrim days each week, **a Mock Checkpoint on Sunday Nov 15,** then **the Real Checkpoint on Sunday Nov 22.**" }
  ],

  priority: "Teams who played _ERCS/ERCC qualifiers_ with ¾ of their original lineup, or who played T2 events, are prioritized.",

  schedule: [
    { date: "2026-11-09", kind: "kickoff", short: "Day 1", title: "Event begins", note: "Teams meet their mentors and session requests open." },
    { date: "2026-11-11", kind: "scrim", short: "Scrim", title: "Scrim Day 1", note: "Weekday scrim block. Exact weekday to be confirmed.", tentative: true },
    { date: "2026-11-14", kind: "scrim", short: "Scrim", title: "Scrim Day 2", note: "Saturday scrim block. Mentors watch live or review after.", tentative: true },
    { date: "2026-11-15", kind: "mock", short: "Mock", title: "Mock Checkpoint Tournament", note: "A full practice run of the checkpoint format. Mentors review the games with their teams afterwards." },
    { date: "2026-11-18", kind: "scrim", short: "Prio", title: "Prio Scrim Day 1", note: "Priority scrim block. Exact weekday to be confirmed.", tentative: true },
    { date: "2026-11-21", kind: "scrim", short: "Prio", title: "Prio Scrim Day 2", note: "Saturday priority scrims, the last practice before the real checkpoint.", tentative: true },
    { date: "2026-11-22", kind: "final", short: "Final", title: "Real Checkpoint Tournament", note: "The checkpoint that counts. Closes out the event." }
  ],

  roles: [
    { key: "staff", icon: "⚫", name: "Staff", d: "Oversee everything, monitor interactions, and keep the event moving smoothly." },
    { key: "mentor", icon: "🔴", name: "Mentors", d: "The 8 team coaches. Group review sessions, character-specific help, and any other questions from their team." },
    { key: "assistant", icon: "⭕", name: "Assistant Coaches", d: "Role and character specialists on standby. Individual coaching and general help for players on any team." },
    { key: "player", icon: "⚪", name: "Players", d: "Developing players here to learn the game.", alt: "Chuds learning the game." }
  ],

  resources: [
    { t: "Recorded VOD reviews", d: "Mentors record team review sessions and share them publicly. Players are asked before their voice is recorded. If they say no, the coach mutes them and restates each question on the recording." },
    { t: "TL;DR notes", d: "Every review comes with a short written summary of what was covered, so players can come back to it later." },
    { t: "Open seminars", d: "Hour-long talks on a Discord Stage, followed by open Q&A. Tell us which topics you want covered on your application." },
    { t: "Role coach help", d: "Assistant coaches take questions from any team about their character or role, and run topic sessions of their own." }
  ],

  expectations: [
    "Run team review sessions through VODs or the in-game replay system",
    "Hold individual sessions when a player asks for one",
    "Answer questions and keep in touch with the team in a timely way",
    "Be free during or after scrims and tournaments to watch and review",
    "Post availability as hour-in / hour-out blocks and answer requests"
  ],

  seminars: {
    where: "Discord Stage",
    format: "A coach covers one topic for about an hour, then opens the floor for Q&A. Join the Stage and raise your hand to ask.",
    list: [
      { title: "[Seminar topic]", host: "[Coach]", when: "[Date & time TBA]" },
      { title: "[Seminar topic]", host: "[Coach]", when: "[Date & time TBA]" },
      { title: "[Seminar topic]", host: "[Coach]", when: "[Date & time TBA]" }
    ]
  },

  // TODO: paste real Discord invite links.
  links: [
    { name: "Project Lumi", tag: "Main Hub", d: "Announcements, signups and team channels.", url: "#" },
    { name: "Scrim Cord", tag: "Practice", d: "Scrim scheduling and lobbies.", url: "#" },
    { name: "Lumia Rumble", tag: "T2", d: "Tier 2 tournament circuit.", url: "#" },
    { name: "Eternal Return Challengers Hub", tag: "T1", d: "Tier 1 competitive hub.", url: "#" }
  ],

  signupAfter: ["Staff review applications", "Teams chosen", "Mentors assigned", "Day 1 · Mon Nov 9"],

  // Coach art: drop an image in site/art/ and map the coach slot to it here.
  // It fills the 4:5 art window on the ID badge (cropped to fit, anchored near the top).
  // m1 has no entry, so it keeps the crop from the event poster.
  art: {
    // m2: "art/m2.webp",
    // a1: "art/a1.webp",
  },

  // Character pfps for the mentor files' character pool (shown black & white). Name must match the pool exactly.
  // Drop a square image in site/art/chars/ and add a line, e.g. Niah: "art/chars/niah.webp",
  charArt: {
    Niah: "art/chars/niah.png",
    Markus: "art/chars/markus.png",
    Kenneth: "art/chars/kenneth.webp",
  },

  // Display skin → base character, for the placeholder art letter.
  skins: {
    "Training Director Katja": "Katja", "Instructor Fiora": "Fiora", "Researcher Barbara": "Barbara",
    "Student Council President Elena": "Elena", "Academy Laura": "Laura", "Academy Theodore": "Theodore",
    "Academy Estelle": "Estelle", "Transfer Student Bianca": "Bianca", "Rebellious Nicky": "Nicky"
  },

  // Same starting slots as supabase/schema.sql (used by demo mode and as a fallback).
  coachSeed: [
    { id: "m1", kind: "mentor", slot: 1, badge_id: "INS-0471-RX", name: "Actor", team_name: "team not found", display_skin: "Training Director Katja",
      playstyle: "I usually play the mage or engage tank, either way I am running it down to make space for my teammates.",
      pool: ["Niah", "Markus", "Kenneth"],
      history: ["2 mickey mouses (ERCC S9, ERCT 1)", "some mcchickens (ERCS 2nd-3rd million times)"],
      about: "I play whatever's op on patch and good for team comp. 15 ranked games.\n\nStarted playing early access solos, stopped before official launch, came back season 4-5 and have played ercs every season since.",
      // back of the mentor file (flip side)
      coaching: "I am pretty light-hearted, the goal is simplify the game and I focus more on understanding win cons and mechanics. Macro is fake until you are in finals.",
      motto: "If you hit your abilities and dodge theirs you win!!!",
      games: ["Valorant", "EU4", "Barony", "RoR2", "Cluesbysam"],
      fun_fact: "I will be lower elo than the mentees when the event starts.",
      hobbies: ["Watching streams", "Video games in general", "LARPing", "Going for a run"],
      fav_teams: ["LFT · gwork", "GNS · DINA"] },
    { id: "m2", kind: "mentor", slot: 2, badge_id: "INS-0472-KV", name: "", team_name: "", display_skin: "Instructor Fiora" },
    { id: "m3", kind: "mentor", slot: 3, badge_id: "INS-0473-BL", name: "", team_name: "", display_skin: "Researcher Barbara" },
    { id: "m4", kind: "mentor", slot: 4, badge_id: "INS-0474-EP", name: "", team_name: "", display_skin: "Student Council President Elena" },
    { id: "m5", kind: "mentor", slot: 5, badge_id: "INS-0475-LA", name: "", team_name: "", display_skin: "Academy Laura" },
    { id: "m6", kind: "mentor", slot: 6, badge_id: "INS-0476-TH", name: "", team_name: "", display_skin: "Academy Theodore" },
    { id: "m7", kind: "mentor", slot: 7, badge_id: "INS-0477-ES", name: "", team_name: "", display_skin: "Academy Estelle" },
    { id: "m8", kind: "mentor", slot: 8, badge_id: "INS-0478-BT", name: "", team_name: "", display_skin: "Transfer Student Bianca" },
    { id: "a1", kind: "assistant", slot: 1, badge_id: "AST-0511-RC", name: "", team_name: "", display_skin: "" },
    { id: "a2", kind: "assistant", slot: 2, badge_id: "AST-0512-RC", name: "", team_name: "", display_skin: "" },
    { id: "a3", kind: "assistant", slot: 3, badge_id: "AST-0513-RC", name: "", team_name: "", display_skin: "" },
    { id: "a4", kind: "assistant", slot: 4, badge_id: "AST-0514-RC", name: "", team_name: "", display_skin: "" }
  ]
};
