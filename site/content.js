/* Path to Glory · static event content (things that don't change at run time).
   People, teams, hours and requests live in the database. */
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

  goals: ["Learn from the best players", "Sharpen your game sense", "Grow with your team"],

  /* Step text marks: **words** = yellow highlighter, _words_ = red squiggle underline, \n = line break. */
  steps: [
    { t: "Meet your Mentor.", d: "Day 1, **Mon Nov 9**: every team meets the mentor coaching them for the two weeks." },
    { t: "Book Sessions...", d: "Mentors post their availability.\nPlayers book 30–120 minute team or individual reviews, like booking an office hour!" },
    { t: "Play and Compete!", d: "Designated scrim days each week, **the Mock Checkpoint Series on Sunday Nov 15,** then **the Final Checkpoint Series on Sunday Nov 22.**" }
  ],

  schedule: [
    { date: "2026-11-09", kind: "kickoff", short: "Day 1", title: "Event begins", note: "Teams meet their mentors and session requests open." },
    { date: "2026-11-11", kind: "scrim", short: "Scrim", title: "Scrim Day 1", note: "Weekday scrim block. Exact weekday to be confirmed.", tentative: true },
    { date: "2026-11-14", kind: "scrim", short: "Scrim", title: "Scrim Day 2", note: "Saturday scrim block. Mentors watch live or review after.", tentative: true },
    { date: "2026-11-15", kind: "mock", short: "Mock", title: "Mock Checkpoint Series", note: "A full practice run of the checkpoint format. Checkpoint activates after 4 games, one fewer than the Final." },
    { date: "2026-11-18", kind: "scrim", short: "Prio", title: "Prio Scrim Day 1", note: "Priority scrim block. Exact weekday to be confirmed.", tentative: true },
    { date: "2026-11-21", kind: "scrim", short: "Prio", title: "Prio Scrim Day 2", note: "Saturday priority scrims, the last practice before the Final Checkpoint Series.", tentative: true },
    { date: "2026-11-22", kind: "final", short: "Final", title: "Final Checkpoint Series", note: "The checkpoint that counts. Closes out the event." }
  ],

  roles: [
    { key: "staff", icon: "⚫", name: "Staff", d: "Oversee everything, monitor interactions, and keep the event moving smoothly." },
    { key: "mentor", icon: "🔴", name: "Mentors", d: "The 8 team coaches. Group review sessions, character-specific help, and any other questions from their team." },
    { key: "assistant", icon: "⭕", name: "Assistant Coaches", d: "Role and character specialists on standby. Team reviews, individual coaching and general help for players on any team." },
    { key: "player", icon: "⚪", name: "Players", d: "Developing players here to learn the game." }
  ],

  resources: [
    { t: "Recorded VOD reviews", d: "Mentors record team review sessions and share them publicly. Players are asked before their voice is recorded. If they say no, the coach mutes them and restates each question on the recording." },
    { t: "TL;DR notes", d: "Every review comes with a short written summary of what was covered, so players can come back to it later." },
    { t: "Open seminars", d: "Hour-long talks on a Discord Stage, followed by open Q&A. Suggest topics to your mentor or in the Discord." },
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
    { name: "Project Lumi", tag: "Main Hub", d: "Announcements, schedules and team channels.", url: "#" },
    { name: "Scrim Cord", tag: "Practice", d: "Scrim scheduling and lobbies.", url: "#" },
    { name: "Lumia Rumble", tag: "T2", d: "Tier 2 tournament circuit.", url: "#" },
    { name: "Eternal Return Challengers Hub", tag: "T1", d: "Tier 1 competitive hub.", url: "#" }
  ],

  // Coach art: drop an image in site/art/ and map the coach slot to it here.
  // It fills the 4:5 art window on the ID badge (cropped to fit, anchored near the top).
  // m1 has no entry, so it keeps the crop from the event poster.
  art: {
    m1: "art/m1.png", // Markus (Actor)
    m2: "art/m2.webp", // Prison Officer Abigail (Dylan)
    a1: "art/a1.webp", // Blair (Baeksu)
    a2: "art/a2.webp", // Coraline (Jalja)
    a4: "art/a4.webp", // Squortle
    a9: "art/m3.webp", // Shoichi (Chibiarc)
  },
  // Headshots for the small assistant cards: square chibi crops in site/art/heads/.
  artHead: {
    a1: "art/heads/a1.webp",
    a2: "art/heads/a2.webp",
    a4: "art/heads/a4.webp",
  },

  // Character pfps for the mentor files' character pool (shown black & white). Name must match the pool exactly.
  // Drop a square image in site/art/chars/ and add a line, e.g. Niah: "art/chars/niah.webp",
  charArt: {
    Niah: "art/chars/niah.png",
    Markus: "art/chars/markus.png",
    Kenneth: "art/chars/kenneth.webp",
    Abigail: "art/chars/abigail.webp",
    Darko: "art/chars/darko.webp",
    Hyunwoo: "art/chars/hyunwoo.png",
    Shoichi: "art/chars/shoichi.png",
  },

  // Display skin → base character, for the placeholder art letter.
  skins: {
    "Training Director Katja": "Katja", "Instructor Fiora": "Fiora", "Researcher Barbara": "Barbara",
    "Student Council President Elena": "Elena", "Academy Laura": "Laura", "Academy Theodore": "Theodore",
    "Academy Estelle": "Estelle", "Transfer Student Bianca": "Bianca", "Rebellious Nicky": "Nicky",
    "Prison Officer Abigail": "Abigail", "Shoichi": "Shoichi", "Blair": "Blair", "Coraline": "Coraline", "Markus": "Markus"
  },
  // In-game test subject IDs, printed on the cards (from the official Eternal Return wiki's list of characters).
  subjects: {
    Katja: "24M-RFT75", Fiora: "14M-RFT02", Barbara: "16M-RFT15", Elena: "22M-RFT52", Laura: "21M-RFT49", Theodore: "23M-RFT65",
    Estelle: "22M-RFT58", Bianca: "20M-RFT45", Nicky: "20M-RFT43", Abigail: "23M-RFT70", Shoichi: "16M-RFT23", Blair: "25M-RFT87", Coraline: "26M-RFT90", Markus: "22M-RFT56"
  },

  // Same starting slots as supabase/schema.sql (used by demo mode and as a fallback).
  coachSeed: [
    { id: "m1", kind: "mentor", slot: 1, badge_id: "INS-0471-RX", name: "Actor", team_name: "team not found", display_skin: "Markus",
      playstyle: "I usually play the mage or ~~engage tank~~, either way I am running it down to make space for my teammates.",
      doodles: ["burst", "sparkles", "burger"], // red pencil doodles on the front of the file
      pool: ["Markus", "Niah", "Kenneth"],
      history: ["2 mickey mouses (ERCC S9, ERCT 1)", "some mcchickens (ERCS 2nd-3rd million times)"],
      about: "I play whatever's op on patch and good for team comp. 15 ranked games.\n\nStarted playing early access solos, stopped before official launch, came back season 4-5 and have played ercs every season since.",
      // back of the mentor file (flip side)
      coaching: "I am pretty light-hearted, the goal is simplify the game and I focus more on understanding win cons and mechanics. Macro is fake until you are in finals.",
      motto: "If you hit your abilities and dodge theirs you win!!!",
      games: ["Valorant", "EU4", "Barony", "RoR2", "Cluesbysam"],
      fun_fact: "I will be lower elo than the mentees when the event starts.",
      hobbies: ["Watching streams", "Video games in general", "LARPing", "Going for a run"],
      fav_teams: ["LFT · gwork", "GNS · DINA"] },
    // m2 and m3 from the Coach Infographic form (responses 1 and 3, Nov 5)
    { id: "m2", kind: "mentor", slot: 2, badge_id: "INS-0472-KV", name: "Dylan", team_name: "Trigger", display_skin: "Prison Officer Abigail",
      playstyle: "My playstyle depends on my character and team comp, but I tend to lean greedy.",
      pool: ["Abigail", "Darko"],
      pool_note: "but ive been kinda inting on darko recently",
      history: ["Finals ercs/ercc when {{baeksu|BREADSU}} doesnt sleep"], // {{old|new}} = red pencil correction
      doodles: ["smile"],
      foot_scribble: "# NORMS\nterrorist",
      about: "Hello, my name is Dylannn. I play Fighters and chuds till they buff abigail.",
      coaching: "This is my first time coaching a full team, so I’m still figuring out my style. I expect to be fairly hands-on and guide players closely, but I’ll also be blunt: if something is bad or I don’t like it, I’ll say so. I’ll also repeat feedback as many times as it takes for it to stick.",
      games: ["Epic Seven (i need a mentor)"],
      fun_fact: "I am not a norm terrorist actually rustska got 10k games",
      hobbies: ["Norms"],
      fav_teams: ["6789 · Squortle"] },
    { id: "m3", kind: "mentor", slot: 3, badge_id: "INS-0473-BL", name: "Ioo", team_name: "", display_skin: "" },
    { id: "m4", kind: "mentor", slot: 4, badge_id: "INS-0474-EP", name: "Fwitchu", team_name: "", display_skin: "Student Council President Elena" },
    { id: "m5", kind: "mentor", slot: 5, badge_id: "INS-0475-LA", name: "Hresvelg", team_name: "", display_skin: "Academy Laura" },
    { id: "m6", kind: "mentor", slot: 6, badge_id: "INS-0476-TH", name: "Isterio", team_name: "", display_skin: "Academy Theodore" },
    { id: "m7", kind: "mentor", slot: 7, badge_id: "INS-0477-ES", name: "Kazcross", team_name: "", display_skin: "Academy Estelle" },
    { id: "m8", kind: "mentor", slot: 8, badge_id: "INS-0478-BT", name: "Magepower", team_name: "", display_skin: "Transfer Student Bianca" },
    { id: "a1", kind: "assistant", slot: 1, badge_id: "AST-0511-RC", name: "Baeksu", team_name: "", display_skin: "Blair",
      sticker: "art/stickers/baeksu.webp", sticker_at: { top: "26%", tilt: -16 } }, // die-cut sticker that follows the drawing's outline
    { id: "a2", kind: "assistant", slot: 2, badge_id: "AST-0512-RC", name: "Jalja", team_name: "", display_skin: "Coraline",
      sticker: "art/stickers/jalja.webp" }, // small chibi sticker on the card's empty right side
    { id: "a3", kind: "assistant", slot: 3, badge_id: "AST-0513-RC", name: "CamperonDuty", team_name: "", display_skin: "" },
    { id: "a4", kind: "assistant", slot: 4, badge_id: "AST-0514-RC", name: "Squortle", team_name: "", display_skin: "" },
    { id: "a5", kind: "assistant", slot: 5, badge_id: "AST-0515-RC", name: "Jignut", team_name: "", display_skin: "" },
    { id: "a6", kind: "assistant", slot: 6, badge_id: "AST-0516-RC", name: "Kyroshoot", team_name: "", display_skin: "" },
    { id: "a7", kind: "assistant", slot: 7, badge_id: "AST-0517-RC", name: "Superior", team_name: "", display_skin: "" },
    { id: "a8", kind: "assistant", slot: 8, badge_id: "AST-0518-RC", name: "Nesious", team_name: "", display_skin: "" },
    { id: "a9", kind: "assistant", slot: 9, badge_id: "AST-0519-RC", name: "Chibiarc", team_name: "", display_skin: "Shoichi",
      playstyle: "Melee chungus.\n\nLowkey tho as long as its not triple ranged should be chill.",
      pool: ["Hyunwoo", "Shoichi"],
      pool_note: "(lol)",
      history: ["Some ercs wins[[!]]"], // [[…]] = added by hand in red pencil
      doodles: ["chibi", "fries"],
      about: "Sometimes plays rank.\nSometimes stream.\nMaster of sleeping.",
      coaching: "Opposite of whatever fwitchu put here.\n\nI will say though I dont like sugarcoating things.",
      games: ["JRPGs", "League", "Single Player Games", "Turn based", "etc"],
      fun_fact: "mcdonald.",
      hobbies: ["GA (I like ga)"],
      fav_teams: ["N/a maybe gsxg?"],
      ps: ["play fat chungus for uberman", "Leni + hyunwoo", "Anything with more than 200 auto range is too hard"] }
  ]
};
