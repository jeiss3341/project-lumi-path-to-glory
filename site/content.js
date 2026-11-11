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
    { t: "Play and Compete!", d: "Designated scrim days each week, **the Mock Checkpoint Series on Saturday Nov 14,** then **the Final Checkpoint Series on Sunday Nov 22.**" }
  ],

  schedule: [
    { date: "2026-11-09", kind: "kickoff", short: "Day 1", title: "Event begins", note: "Teams meet their mentors and session requests open." },
    { date: "2026-11-11", kind: "scrim", short: "Scrim", title: "Scrim Day 1", note: "Scrim block. Mentors watch live or review after." },
    { date: "2026-11-12", kind: "scrim", fcfs: true, short: "FCFS", title: "FCFS Scrims", note: "Open scrims, first come first served. Grab a lobby in the Scrim Cord." },
    { date: "2026-11-13", kind: "scrim", short: "Scrim", title: "Scrim Day 2", note: "Scrim block, the last practice before the Mock Checkpoint Series." },
    { date: "2026-11-14", kind: "mock", short: "Mock", title: "Mock Checkpoint Series", note: "A full practice run of the checkpoint format. Checkpoint activates after 4 games, one fewer than the Final." },
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
    // a real seminar: { title: "Drafting 101", host: "Kazcross", when: "Thu, Nov 12 · 8 PM ET" }
    // a plain note: { label: "...", title: "...", note: "..." } (label replaces "Discord Stage" at the top)
    list: [
      { label: "Coming soon", title: "First seminar on the way", note: "Topics, hosts and dates go up here and in the Discord as soon as they're set." },
      { label: "Suggestion box", title: "What should we cover?", note: "Drafting, rotations, a character, macro… Tell your mentor or post it in the Discord." }
    ]
  },

  // TODO: paste real Discord invite links.
  links: [
    { name: "Project Lumi", tag: "Main Hub", d: "Announcements, schedules and team channels.", url: "https://discord.gg/zWs5GHFPT5", logo: "art/lumi-logo-sm.png" },
    { name: "Scrim Cord", tag: "Practice", d: "Scrim scheduling and lobbies.", url: "https://discord.gg/tbzPvX3Nj3" },
    { name: "Lumia Rumble", tag: "T2", d: "Tier 2 tournament circuit.", url: "https://discord.gg/Xk7dZS3YrV" },
    { name: "Eternal Return Challengers Hub", tag: "T1", d: "Tier 1 competitive hub.", url: "https://discord.gg/KP3JqAHK4v" }
  ],

  // Coach art: drop an image in site/art/ and map the coach slot to it here.
  // It fills the 4:5 art window on the ID badge (cropped to fit, anchored near the top).
  // m1 has no entry, so it keeps the crop from the event poster.
  art: {
    m1: "art/m1.png", // Markus (Actor)
    m2: "art/m2.webp", // Prison Officer Abigail (Dylan)
    m3: "art/fwitchu-card.png", // Irem (Fwitchu), irem2.png chosen by staff
    m4: "art/hresvelg.webp", // Jan (Hresvelg)
    m5: "art/isterio.webp", // Luke (Isterio)
    m6: "art/kazcross.webp", // Henry (Kazcross)
    m7: "art/magepower-original.png", // Alex (Magepower), exact alex2.png chosen by staff
    m8: "art/ioo-enhanced.webp", // Coraline (Ioo), Picsart-enhanced version chosen by staff
    a1: "art/a1.webp", // Blair (Baeksu)
    a2: "art/a2.webp", // Coraline (Jalja)
    a4: "art/a4-card.png", // Squortle, chosen by staff
    a9: "art/a9-original.png", // Chibiarc, chosen by staff, exact hyunwoo2.png
    a3: "art/a3-original.png", // CamperonDuty, chosen by staff, exact rozzi2.png
    a5: "art/a5-card.png", // Jignut, chosen by staff
    a6: "art/a6-card.png", // Kyroshoot, chosen by staff
    a7: "art/a7-original.png", // Superior, chosen by staff, exact sua2.png
    a8: "art/a8-original.png", // Nesious, chosen by staff, exact yumin2.png
  },
  // Headshots for the small assistant cards: square chibi crops in site/art/heads/.
  artHead: {
    a1: "art/heads/a1-icon.png", // Baeksu, chosen by staff
    a2: "art/heads/a2.webp",
    a4: "art/heads/a4-icon.png", // Squortle, chosen by staff
    a3: "art/heads/a3-icon.png", // CamperonDuty, chosen by staff
    a5: "art/heads/a5-icon.png", // Jignut, chosen by staff
    a6: "art/heads/a6-icon.png", // Kyroshoot, chosen by staff
    a7: "art/heads/a7-icon.png", // Superior, chosen by staff
    a8: "art/heads/a8-icon.webp", // Nesious, chosen by staff
    a9: "art/heads/a9-icon.png", // Chibiarc, chosen by staff
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
    Irem: "art/chars/irem.png",
    Leni: "art/chars/leni.png",
    Jan: "art/chars/jan.webp",
    Hisui: "art/chars/hisui.png",
    Luke: "art/chars/luke.png",
    Jackie: "art/chars/jackie.png",
    Henry: "art/chars/henry.png",
    Camilo: "art/chars/camilo.webp",
    Yumin: "art/chars/yumin.png",
    Craver: "art/chars/craver.png",
    Alex: "art/chars/alex.png",
    Fiora: "art/chars/fiora.png",
    Coraline: "art/chars/coraline.png",
    Celine: "art/chars/celine.png",
  },

  // Display skin → base character, for the placeholder art letter.
  skins: {
    "Training Director Katja": "Katja", "Instructor Fiora": "Fiora", "Researcher Barbara": "Barbara",
    "Student Council President Elena": "Elena", "Academy Laura": "Laura", "Academy Theodore": "Theodore",
    "Academy Estelle": "Estelle", "Transfer Student Bianca": "Bianca", "Rebellious Nicky": "Nicky",
    "Prison Officer Abigail": "Abigail", "Shoichi": "Shoichi", "Blair": "Blair", "Coraline": "Coraline", "Markus": "Markus", "Irem": "Irem", "Jan": "Jan", "Luke": "Luke", "Henry": "Henry", "Alex": "Alex",
    "Rozzi": "Rozzi", "Tsubame": "Tsubame", "Camilo": "Camilo", "Mai": "Mai", "Sua": "Sua", "Yumin": "Yumin", "Hyunwoo": "Hyunwoo"
  },
  // In-game test subject IDs, printed on the cards (from the official Eternal Return wiki's list of characters).
  subjects: {
    Katja: "24M-RFT75", Fiora: "14M-RFT02", Barbara: "16M-RFT15", Elena: "22M-RFT52", Laura: "21M-RFT49", Theodore: "23M-RFT65",
    Estelle: "22M-RFT58", Bianca: "20M-RFT45", Nicky: "20M-RFT43", Abigail: "23M-RFT70", Shoichi: "16M-RFT23", Blair: "25M-RFT87", Coraline: "26M-RFT90", Markus: "22M-RFT56", Irem: "22M-RFT64", Jan: "18M-RFT35", Luke: "18M-RFT36", Henry: "25M-RFT86", Alex: "14M-RFT13",
    Rozzi: "18M-RFT37", Tsubame: "23M-RFT73", Camilo: "16M-RFT25", Mai: "16M-RFT34", Sua: "17M-RFT33", Yumin: "24M-RFT80", Hyunwoo: "14M-RFT04"
  },

  // each mentor's dak.gg profile: clicking their name on the ID badge or the mentor file opens it
  dakgg: {
    m1: "https://dak.gg/er/players/PaidisThatActor",
    m2: "https://dak.gg/er/players/Dylannn",
    m3: "https://dak.gg/er/players/Fwitchu",
    m4: "https://dak.gg/er/players/AatroxMain",
    m5: "https://dak.gg/er/players/Isterio",
    m6: "https://dak.gg/er/players/kazcross",
    m7: "https://dak.gg/er/players/magepower",
    m8: "https://dak.gg/er/players/ioo",
    a1: "https://dak.gg/er/players/%EB%B0%B1%EC%88%98", // Baeksu (백수)
    a2: "https://dak.gg/er/players/popquiz",            // Jalja
    a3: "https://dak.gg/er/players/camperonduty",
    a4: "https://dak.gg/er/players/squortle",
    a5: "https://dak.gg/er/players/jignutjorgeston",
    a6: "https://dak.gg/er/players/kyroshoot",
    a7: "https://dak.gg/er/players/superior",
    a8: "https://dak.gg/er/players/nesious",
    a9: "https://dak.gg/er/players/chibiarc"
  },

  // Same starting slots as supabase/schema.sql (used by demo mode and as a fallback).
  coachSeed: [
    { id: "m1", kind: "mentor", slot: 1, badge_id: "INS-0471-RX", name: "Actor", team_name: "Trigger", display_skin: "Markus", art_fit: { x: -5.54, y: -9.47, z: 1.11 },
      playstyle: "I usually play the mage or ~~engage tank~~, either way I am running it down to make space for my teammates.",
      doodles: ["burst", "sparkles", "burger"], // red pencil doodles on the front of the file
      pool: ["Markus", "Niah", "Kenneth"],
      stats: [4, 4, 4, 5, 3, 5], // self-ratings from the coach form, 1–5: character flexibility, farming efficiency, aggressiveness, APM, patience, greed
      history: ["2 mickey mouses (ERCC S9, ERCT 1)", "some mcchickens (ERCS 2nd-3rd million times)"],
      about: "I play whatever's op on patch and good for team comp. 15 ranked games.\n\nStarted playing early access solos, stopped before official launch, came back season 4-5 and have played ercs every season since.",
      // back of the mentor file (flip side)
      coaching: "I am pretty light-hearted, the goal is simplify the game and I focus more on understanding win cons and mechanics. Macro is fake until you are in finals.",
      motto: "If you hit your abilities and dodge theirs you win!!!",
      games: ["Valorant", "EU4", "Barony", "RoR2", "Cluesbysam"],
      fun_fact: "I will be lower elo than the mentees when the event starts.",
      hobbies: ["Watching streams", "Video games in general", "LARPing", "Going for a run"],
      fav_teams: ["LFT · gwork", "GNS · DINA"] },
    // m2 from the Coach Infographic form (Nov 5)
    { id: "m2", kind: "mentor", slot: 2, badge_id: "INS-0472-KV", name: "Dylan", team_name: "Trigger", display_skin: "Prison Officer Abigail",
      playstyle: "My playstyle depends on my character and team comp, but I tend to lean greedy.",
      pool: ["Abigail", "Darko"],
      stats: [4, 3, 3, 2, 3, 4],
      pool_note: "but ive been kinda inting on darko recently",
      history: ["Finals ercs/ercc when {{baeksu|BREADSU}} doesnt sleep"], // {{old|new}} = red pencil correction
      doodles: ["smile"],
      foot_scribble: "# NORMS\nterrorist",
      about: "Hello, my name is Dylannn. I play Fighters and chuds till they buff abigail.",
      coaching: "This is my first time coaching a full team, so I’m still figuring out my style. I expect to be fairly hands-on and guide players closely, but I’ll also be blunt: if something is bad or I don’t like it, I’ll say so. I’ll also repeat feedback as many times as it takes for it to stick.",
      motto: "Head Empty",
      games: ["Epic Seven (i need a mentor)"],
      fun_fact: "I am not a norm terrorist actually rustska got 10k games",
      hobbies: ["Norms"],
      fav_teams: ["6789 · Squortle"] },
    // m3–m8 from the Coach Infographic form (Nov 9 export)
    { id: "m3", kind: "mentor", slot: 3, badge_id: "INS-0473-BL", name: "Fwitchu", team_name: "Uberman", display_skin: "Irem", art_fit: { x: 7.52, y: -6.01, z: 1.27 },
      playstyle: "I prefer to tempo out and make sure that the team is always strong on objectives.\n\nBig fan of triangle theory. I think limit-testing in practice is the best way to improve long-term. I play a variety of roles — ex. piggy bank that give all my credits away to my melee players /ᐠ ◞ ᆺ ◟マ",
      pool: ["Irem", "Leni"],
      stats: [3, 5, 5, 4, 2, 5],
      doodles: ["piggy", "fish", "catnap"],
      file_sticker: "art/stickers/fwitchu-cat.png", // sticker on the front of the file, under the character pool
      hist_sticker: "art/stickers/fwitchu-cat-pat.png", // sticker under the competitive history
      history: ["6x ERCS/ERCC Champion", "S7 Rank 1"],
      about: "I play mostly cat/supports/control mages. I've been playing ER since pre-season 4 but started playing more competitively around Season 3/4. I got my first win in Season 8 ERCC with Storytellers and have since won 5 times on Uberman.",
      coaching: "I'd like to give shorter, digestible reviews (<30 min) that focus on a main point of improvement or strategy. Will start out with broader concepts with a large focus on early game and then dive into specifics such as matchups later. I'll often reference KR vods for learning. Your team can choose what type of playstyle or comp archetype you want though!",
      motto: "rolls over ...zzz...",
      games: ["Friendslop", "civ 5", "maple", "grand archive", "league (used to)"],
      fun_fact: "I eat salmon ~3x a week\n/ᐠ • ˕ •マ 🐟",
      hobbies: ["I draw art and play guitar (but am bad)"],
      fav_teams: ["FN · E8"] },
    { id: "m4", kind: "mentor", slot: 4, badge_id: "INS-0474-EP", name: "Hresvelg", team_name: "uberman", display_skin: "Jan",
      playstyle: "Playstyle is a myth u either play correct or u play wrong",
      photo_sticker: "art/stickers/hresvelg-photo.webp", // photo stuck on the file under the playstyle
      back_sticker: "🫃", // emoji sticker on the back of the file, next to the motto
      pool: ["Jan", "Hisui"],
      stats: [2, 5, 4, 2, 2, 4],
      doodles: ["rightwrong", "housefire", "bird"],
      history: ["Plat 3 in apex legend"],
      about: "Me play chud chungus bruiser tank",
      coaching: "Am most serious erb player on the server",
      motto: "mpreg squortle",
      games: ["Angry birds 2", "Hearthstone"],
      fun_fact: "Fwitchu burned my house down",
      hobbies: ["playing eternal return", "playing angry birds 2", "rage baiting squortle"],
      fav_teams: ["uberman · hresvelg"] },
    { id: "m5", kind: "mentor", slot: 5, badge_id: "INS-0475-LA", name: "Isterio", team_name: "Blast", display_skin: "Luke",
      playstyle: "I play melees. Specifically I have been a Luke \"one-trick\" since Solos (EA S6) but recently I have branched out to play other melees.",
      pool: ["Luke", "Jackie"],
      stats: [2, 5, 5, 3, 3, 5],
      doodles: ["arrow", "nocoffee", "shuttle"],
      history: ["A few Final Lobbies in ERCS/ERCC (no wins yet D:)", "Season 8 Rank 1 NA (Rank 3 Global)"],
      about: "I play melees and I run at the enemy carries in a straight line.",
      coaching: "I am a chill guy but I WILL laugh at you if you do the funny.",
      motto: "Don't blame your teammates, always blame the game",
      games: ["Deadlock", "League"],
      fun_fact: "I don't drink coffee",
      hobbies: ["Reading bad Chinese light novels", "larping in ER streams", "playing badminton"],
      fav_teams: ["Pointy End · SeolDaBi"] },
    { id: "m6", kind: "mentor", slot: 6, badge_id: "INS-0476-TH", name: "Kazcross", team_name: "The Casting Desk", display_skin: "Henry",
      playstyle: "Primary/secondary IGL (in game leader), tend to play flex but my most proficient chars are often mages",
      pool: ["Henry", "Yumin", "Craver"],
      stats: [5, 3, 3, 3, 5, 4],
      doodles: ["mic", "btier", "wave"],
      history: ["Caster and analyst", "peaked top 10 NA", "top 1 Henry NA", "have coached various ERCS teams on draft"],
      about: "Official ER English caster. I commentate and watch NA, KR and APAC. Big fan of analyzing the game, I also do most Pro-fessors now so I've learned most new characters. I love teaching the game and have participated in previous coaching events! I also discuss the game with most top players to theorycraft compositions and character ideas.",
      coaching: "I'm very detail oriented and holistic with my approach to learning, I think a lot of learning is done by cultivating an environment to learn. I emphasize things you're doing out of game to help you in game",
      motto: "Your favorite player's favorite player's favorite caster",
      games: ["Deadlock", "CS", "Valorant"],
      fun_fact: "Peaked B tier on SSW teammate tier list",
      hobbies: ["Outside of gaming I'm a social advocate"],
      fav_teams: ["INCHEON WAVE", "Cadmus is my fav player tho"] },
    { id: "m7", kind: "mentor", slot: 7, badge_id: "INS-0477-ES", name: "Magepower", team_name: "6789", display_skin: "Alex", art_fit: { x: 5.95, y: -3.02, z: 1.65 },
      playstyle: "Flex. Alex. Played since EA s1.",
      pool: ["Alex", "Fiora"],
      stats: [4, 4, 3, 3, 4, 2],
      pool_note: "(idk markus, craver, anything op on patch)",
      history: ["ERCS winner."],
      about: "Killing excessive wildlife. Shotcaller, engage, frontline.",
      coaching: "I obsess over the small things.",
      motto: "Those held in highest esteem by most of the people are neither the great artists nor the great scientists, neither the great statesmen nor the great sports figures, but those who master a hard lot with their heads held high.",
      games: ["Maphul- suu - toriiii.", "Pretty much most things but shooters."],
      doodles: ["maple", "paw", "mountain"], // "maple": "Maphul" = MapleStory, so a maple leaf + little mushroom on the back of the file
      fun_fact: "I climb v8's.",
      hobbies: ["Bouldering."],
      fav_teams: ["Anyone who plays good ER."] },
    { id: "m8", kind: "mentor", slot: 8, badge_id: "INS-0478-BT", name: "Ioo", team_name: "6789", display_skin: "Coraline", subject_id: "21M-RFT48", art_fit: { x: 3.06, y: -30.43, z: 2.1 }, // Celine's ID, since Jalja shows Coraline's
      playstyle: "artillery and control mage player",
      pool: ["Coraline", "Celine"],
      stats: [4, 5, 3, 3, 4, 4],
      doodles: ["rings", "eye", "bowl", "plane"],
      history: ["3 rings"],
      about: "mages and 3 rings",
      coaching: "1-on-1 coaching, positioning and vision awareness",
      motto: "Buy vision or perish",
      games: ["gacha gaming", "occasional mmos", "roguelikes"],
      fun_fact: "I'm a foodie",
      hobbies: ["I like traveling"],
      fav_teams: ["NRG · Rioori"] },
    { id: "a1", kind: "assistant", slot: 1, badge_id: "AST-0511-RC", name: "Baeksu", team_name: "", no_team: true, display_skin: "Blair", focus: "Bruisers", pool: ["Blair", "Jackie", "Luke"], art_fit: { x: -7.62, y: -1.93, z: 1.18 }, head_fit: { x: -2.05, y: 25.13, z: 1.55 },
      sticker: "art/stickers/baeksu.webp", sticker_at: { top: "26%", tilt: -16 } }, // die-cut sticker that follows the drawing's outline
    { id: "a2", kind: "assistant", slot: 2, badge_id: "AST-0512-RC", name: "Jalja", team_name: "About 30", display_skin: "Coraline", focus: "Mages", pool: ["Coraline", "Eva"], art_fit: { x: 8.65, y: 0.87, z: 1.18 },
      sticker: "art/stickers/jalja.webp" }, // small chibi sticker on the card's empty right side
    { id: "a3", kind: "assistant", slot: 3, badge_id: "AST-0513-RC", name: "CamperonDuty", team_name: "Trigger", display_skin: "Rozzi", focus: "ADC", pool: ["Rozzi", "Tsubame", "Rio", "Katja"], art_fit: { x: -6.19, y: -9.67, z: 1.12 }, head_fit: { x: 1.37, y: 11.96, z: 1.33 } },
    { id: "a4", kind: "assistant", slot: 4, badge_id: "AST-0514-RC", name: "Squortle", team_name: "6789", display_skin: "Tsubame", focus: "ADC", pool: ["Rio", "Tsubame", "Rozzi", "Katja"], art_fit: { x: 2.19, y: -6.42, z: 1.19 }, head_fit: { x: -0.99, y: 13.6, z: 1.36 } },
    { id: "a5", kind: "assistant", slot: 5, badge_id: "AST-0515-RC", name: "Jignut", team_name: "Locked In", display_skin: "Camilo", focus: "Frontline / Bruisers", pool: ["Camilo", "Laura", "Hisui", "Markus"], art_fit: { x: 3.58, y: 4.37, z: 1.1 }, head_fit: { x: 1.78, y: 14.32, z: 1.35 } },
    { id: "a6", kind: "assistant", slot: 6, badge_id: "AST-0516-RC", name: "Kyroshoot", team_name: "6789", display_skin: "Mai", focus: "Flex", pool: ["Just ask and I'll give you good advice for every single one"], art_fit: { x: -3.19, y: -9.81, z: 1.17 }, head_fit: { x: 1.36, y: 10.45, z: 1.3 } },
    { id: "a7", kind: "assistant", slot: 7, badge_id: "AST-0517-RC", name: "Superior", team_name: "No Flame", display_skin: "Sua", focus: "Flex", pool: ["Sua", "Lucia"], art_fit: { x: 9.41, y: 28.45, z: 2.94 }, head_fit: { x: -0.16, y: 9.19, z: 1.3 } },
    { id: "a8", kind: "assistant", slot: 8, badge_id: "AST-0518-RC", name: "Nesious", team_name: "", no_team: true, display_skin: "Yumin", focus: "Mages / Support", pool: ["Yumin", "Silvia", "Leni"], art_fit: { x: -6.62, y: -9.33, z: 1.15 }, head_fit: { x: -1.05, y: 9.86, z: 1.28 } },
    { id: "a9", kind: "assistant", slot: 9, badge_id: "AST-0519-RC", name: "Chibiarc", team_name: "Uberman", display_skin: "Hyunwoo", focus: "Bruisers / Frontline", art_fit: { x: 1.29, y: 3, z: 1.07 }, head_fit: { x: -1.39, y: 10.68, z: 1.31 },
      playstyle: "Melee chungus.\n\nLowkey tho as long as its not triple ranged should be chill.",
      pool: ["Hyunwoo", "Shoichi"],
      pool_note: "(lol)",
      history: ["Some ercs wins[[!]]"], // [[…]] = added by hand in red pencil
      about: "Sometimes plays rank.\nSometimes stream.\nMaster of sleeping.",
      coaching: "Opposite of whatever fwitchu put here.\n\nI will say though I dont like sugarcoating things.",
      games: ["JRPGs", "League", "Single Player Games", "Turn based", "etc"],
      fun_fact: "mcdonald.",
      hobbies: ["GA (I like ga)"],
      fav_teams: ["N/a maybe gsxg?"],
      ps: ["play fat chungus for uberman", "Leni + hyunwoo", "Anything with more than 200 auto range is too hard"] }
  ]
};
