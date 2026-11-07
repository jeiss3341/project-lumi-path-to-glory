/* Path to Glory · shared event data for every site concept.
   Edit content here once; all four concept pages read window.PTG.
   Anything in [square brackets] is a placeholder waiting on real info. */
(function () {
  "use strict";
  const PTG = {};

  PTG.event = {
    org: "Project Lumi",
    name: "Path to Glory",
    type: "Pre-Season Mentor Event",
    year: 2026,
    start: "2026-11-09",
    end: "2026-11-22",
    file: "No.1116",
    goal: "Develop the ER competitive scene.",
    pitch: "Break down the barrier & create a bridge for developing players to talk and learn from the best teams in the ER Comp Scene.",
    signupUrl: "#",   // TODO: signup form link
    calendarUrl: "#"  // TODO: public Google Calendar link
  };

  PTG.goals = ["Learn from the best players", "2 Tourney Days", "2 Week Event"];

  PTG.steps = [
    { t: "Sign up", d: "Register as a full team, or sign up solo and get placed on a team with other individual players." },
    { t: "Teams are chosen", d: "Teams that played ERCS/ERCC qualifiers with ¾ of their original lineup, or played T2 events, get priority." },
    { t: "Pick your coach", d: "Chosen teams rank the mentors they want. Staff then distribute the 8 main mentors across the teams." },
    { t: "Book sessions", d: "Mentors post their availability. Players book 30–60 minute team or individual reviews, like booking a doctor's appointment." },
    { t: "Scrim and compete", d: "Scrim days each week, a Mock Checkpoint on Sunday Nov 15, then the Real Checkpoint on Sunday Nov 22." }
  ];

  PTG.priority = "Teams who played ERCS/ERCC qualifiers with ¾ of their original lineup, or who played T2 events, are prioritized.";

  // kind: kickoff | scrim | mock | final. tentative = day not locked yet.
  PTG.schedule = [
    { date: "2026-11-09", kind: "kickoff", short: "Day 1", title: "Event begins", note: "Teams meet their mentors and session booking opens." },
    { date: "2026-11-11", kind: "scrim", short: "Scrim", title: "Scrim Day 1", note: "Weekday scrim block. Exact weekday to be confirmed.", tentative: true },
    { date: "2026-11-14", kind: "scrim", short: "Scrim", title: "Scrim Day 2", note: "Saturday scrim block. Mentors watch live or review after.", tentative: true },
    { date: "2026-11-15", kind: "mock", short: "Mock", title: "Mock Checkpoint Tournament", note: "A full practice run of the checkpoint format. Mentors review the games with their teams afterwards." },
    { date: "2026-11-18", kind: "scrim", short: "Prio", title: "Prio Scrim Day 1", note: "Priority scrim block. Exact weekday to be confirmed.", tentative: true },
    { date: "2026-11-21", kind: "scrim", short: "Prio", title: "Prio Scrim Day 2", note: "Saturday priority scrims, the last practice before the real checkpoint.", tentative: true },
    { date: "2026-11-22", kind: "final", short: "Final", title: "Real Checkpoint Tournament", note: "The checkpoint that counts. Closes out the event." }
  ];

  PTG.roles = [
    { key: "staff", name: "Staff", d: "Oversee everything, monitor interactions, and keep the event moving smoothly." },
    { key: "mentor", name: "Mentors", d: "The 8 team coaches. Group review sessions, character-specific help, and any other questions from their team." },
    { key: "assistant", name: "Assistant Coaches", d: "Role and character specialists on standby. Individual coaching and general help for players on any team." },
    { key: "player", name: "Players", d: "Developing players here to learn the game.", alt: "Chuds learning the game." }
  ];

  const P = {
    main: "[Main character]",
    pool: ["[Main]", "[Secondary]", "[Pocket pick]"],
    style: "[One or two lines on how this mentor plays and what they focus on in review.]",
    history: ["[ERCS qualifier · result]", "[ERCC / T2 event · placement]"],
    about: "[A short about-me written by the mentor.]"
  };
  const M = (n, id, name, team, display, base, extra) =>
    Object.assign({ n, id, name, team, display, base }, P, extra || {});

  PTG.mentors = [
    M(1, "INS-0471-RX", "Neotep", "NeoChair", "Training Director Katja", "Katja", { hasArt: true }),
    M(2, "INS-0472-KV", "[Mentor 02]", "[Team TBA]", "Instructor Fiora", "Fiora"),
    M(3, "INS-0473-BL", "[Mentor 03]", "[Team TBA]", "Researcher Barbara", "Barbara"),
    M(4, "INS-0474-EP", "[Mentor 04]", "[Team TBA]", "Student Council President Elena", "Elena"),
    M(5, "INS-0475-LA", "[Mentor 05]", "[Team TBA]", "Academy Laura", "Laura"),
    M(6, "INS-0476-TH", "[Mentor 06]", "[Team TBA]", "Academy Theodore", "Theodore"),
    M(7, "INS-0477-ES", "[Mentor 07]", "[Team TBA]", "Academy Estelle", "Estelle"),
    M(8, "INS-0478-BT", "[Mentor 08]", "[Team TBA]", "Transfer Student Bianca", "Bianca")
  ];

  PTG.teams = [
    { name: "NeoChair", coach: "Neotep", players: ["Irem-chan", "Jeiss", "Lumi-chan", "Fwitchu"], status: "confirmed" }
  ];
  for (let i = 2; i <= 8; i++) {
    PTG.teams.push({ name: "[Team " + String(i).padStart(2, "0") + "]", coach: PTG.mentors[i - 1].name, players: [], status: "open" });
  }

  PTG.resources = [
    { t: "Recorded VOD reviews", d: "Mentors record team review sessions and share them publicly. Players are asked before their voice is recorded. If they say no, the coach mutes them and restates each question on the recording." },
    { t: "TL;DR notes", d: "Every review comes with a short written summary of what was covered, so players can come back to it later." },
    { t: "Open seminars", d: "Hour-long talks on a Discord Stage, followed by open Q&A. Tell us which topics you want covered in the signup form." },
    { t: "Role coach help", d: "Assistant coaches take questions from any team about their character or role, and run topic sessions of their own." }
  ];

  PTG.expectations = [
    "Run team review sessions through VODs or the in-game replay system",
    "Hold individual sessions when a player asks for one",
    "Answer questions and keep in touch with the team in a timely way",
    "Be free during or after scrims and tournaments to watch and review",
    "Post availability as bookable time slots"
  ];

  PTG.links = [
    { name: "Project Lumi", tag: "Main Hub", d: "Announcements, signups and team channels.", url: "#" },
    { name: "Scrim Cord", tag: "Practice", d: "Scrim scheduling and lobbies.", url: "#" },
    { name: "Lumia Rumble", tag: "T2", d: "Tier 2 tournament circuit.", url: "#" },
    { name: "Eternal Return Challengers Hub", tag: "T1", d: "Tier 1 competitive hub.", url: "#" }
  ];

  // Assistant / role coaches: individual sessions for players on any team.
  PTG.assistants = [
    { id: "AST-0511-RC", name: "[Assistant 01]", focus: "[Role focus]", covers: "[Characters or topics]" },
    { id: "AST-0512-RC", name: "[Assistant 02]", focus: "[Role focus]", covers: "[Characters or topics]" },
    { id: "AST-0513-RC", name: "[Assistant 03]", focus: "[Role focus]", covers: "[Characters or topics]" },
    { id: "AST-0514-RC", name: "[Assistant 04]", focus: "[Role focus]", covers: "[Characters or topics]" }
  ];

  PTG.seminars = {
    where: "Discord Stage",
    format: "A coach covers one topic for about an hour, then opens the floor for Q&A. Join the Stage and raise your hand to ask.",
    list: [
      { title: "[Seminar topic]", host: "[Coach]", when: "[Date & time TBA]" },
      { title: "[Seminar topic]", host: "[Coach]", when: "[Date & time TBA]" },
      { title: "[Seminar topic]", host: "[Coach]", when: "[Date & time TBA]" }
    ]
  };

  // Draft of what each signup form asks. Swap in the real form questions.
  PTG.signup = {
    team: ["Team name", "Captain / contact", "Players 1–4 (in-game names)", "Played ERCS/ERCC qualifiers with 3/4 of this lineup?", "T2 events played", "Mentor preferences: 1st, 2nd, 3rd", "Seminar topics you want covered"],
    solo: ["In-game name", "Main role and characters", "Availability Nov 9–22", "Comp experience, if any", "Seminar topics you want covered"],
    after: ["Signups close [date TBA]", "Teams chosen", "Teams rank mentors", "Mentors assigned", "Day 1 · Mon Nov 9"]
  };

  /* ---------- helpers ---------- */
  const DAY = 864e5;
  const pad = n => String(n).padStart(2, "0");
  const D = s => new Date(s + "T12:00:00");
  const ymd = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  PTG.D = D;
  PTG.ymd = ymd;

  PTG.esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  PTG.fmt = (iso, opts) => D(iso).toLocaleDateString("en-US", opts || { weekday: "short", month: "short", day: "numeric" });

  PTG.gcal = function (ev) {
    const next = new Date(D(ev.date).getTime() + DAY);
    const p = new URLSearchParams({
      action: "TEMPLATE",
      text: "Path to Glory · " + ev.title,
      dates: ev.date.replace(/-/g, "") + "/" + ymd(next).replace(/-/g, ""),
      details: ev.note + "\n\nProject Lumi · Path to Glory pre-season mentor event"
    });
    return "https://calendar.google.com/calendar/render?" + p.toString();
  };

  PTG.days = function () {
    const s = D(PTG.event.start), out = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(s.getTime() + i * DAY), iso = ymd(d);
      out.push({
        iso, d, n: d.getDate(), week: i < 7 ? 1 : 2,
        dow: d.toLocaleDateString("en-US", { weekday: "short" }),
        events: PTG.schedule.filter(e => e.date === iso)
      });
    }
    return out;
  };

  PTG.today = function () { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 12); };
  PTG.status = function () {
    const t = PTG.today(), s = D(PTG.event.start), e = D(PTG.event.end);
    if (t < s) return { phase: "before", days: Math.round((s - t) / DAY) };
    if (t > e) return { phase: "after" };
    return { phase: "live", day: Math.round((t - s) / DAY) + 1 };
  };

  // Deterministic barcode for ID cards and tickets.
  PTG.barcode = function (seed, w, h) {
    w = w || 120; h = h || 28;
    let s = 7;
    for (const c of String(seed)) s = (s * 31 + c.charCodeAt(0)) >>> 0;
    const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
    let x = 0, r = "";
    while (x < w) {
      const bw = 1 + Math.floor(rnd() * 3);
      if (rnd() > 0.32) r += '<rect x="' + x + '" width="' + bw + '" height="' + h + '"/>';
      x += bw + 1;
    }
    return '<svg class="barcode" viewBox="0 0 ' + w + " " + h + '" preserveAspectRatio="none" aria-hidden="true" fill="currentColor">' + r + "</svg>";
  };

  // Crops the Katja art out of the event poster (poster.webp), turned upright.
  // Wrap it in a box with a definite size; the crop scales to that box's width.
  PTG.art = function (m, o) {
    if (!m || !m.hasArt) return "";
    o = Object.assign({ w: 440, cx: 1388, cy: 688, rot: 21 }, o || {});
    const k = "100cqw / " + o.w;
    return '<div class="ptg-art" style="position:relative;overflow:hidden;container-type:inline-size;width:100%;height:100%;background:#141416">' +
      '<img src="poster.webp" alt="' + PTG.esc(m.display) + ' display art" style="position:absolute;left:50%;top:50%;width:calc(1600 * ' + k + ');max-width:none;height:auto;transform-origin:0 0;' +
      "transform:rotate(" + o.rot + "deg) translate(calc(-" + o.cx + " * " + k + "), calc(-" + o.cy + " * " + k + '))"></div>';
  };

  // Tiny localStorage wrapper that never throws.
  PTG.store = {
    get(k, f) { try { const v = localStorage.getItem("ptg:" + k); return v == null ? f : JSON.parse(v); } catch (e) { return f; } },
    set(k, v) { try { localStorage.setItem("ptg:" + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } }
  };

  window.PTG = PTG;
})();
