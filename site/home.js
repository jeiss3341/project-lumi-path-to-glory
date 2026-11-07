/* Path to Glory · public site (index.html). */
(function () {
  "use strict";
  const { $, $$, esc, pad } = UI;
  const C = window.PTG;
  const S = { me: null, coaches: [], teams: [], myReqs: [] };
  // office hours: the coach whose pop-up is open, the week shown, the picked start and length (half hours)
  const BK = { coach: null, wk: 1, start: null, len: 0, kind: "team", note: "", all: [], blocks: [], busy: [] };
  const HALF = 30 * 6e4;
  let watching = false, bookingWired = false, fi = 0, rv = null, animOK = false;

  renderStatic();
  boot();
  API.onAuth(() => boot());
  UI.mountDemoBar();
  if (!API.live && (window.PTG_CONFIG || {}).supabaseUrl) UI.toast("Couldn't reach the login service, so the site is showing demo data.", "bad");

  async function boot() {
    S.me = await API.session().catch(() => null);
    UI.mountAuth($("#auth"), S.me);
    const res = await Promise.all([
      API.coaches().catch(() => C.coachSeed.map(c => Object.assign({ pool: [], history: [] }, c))),
      API.teams().catch(() => [])
    ]);
    S.coaches = res[0]; S.teams = res[1];
    renderHeroBadge(); renderFaculty(); renderAssist(); renderRosters(); initBooking();
    if (window.PTGSwing) PTGSwing.play();   // hero lanyard swings in once the badge is on the page
    if (!watching) {
      watching = true;
      API.watch("requests", () => refreshBooking());
      API.watch("availability", () => refreshBooking());
    }
  }

  const mentors = () => S.coaches.filter(c => c.kind === "mentor");
  const assistants = () => S.coaches.filter(c => c.kind === "assistant");
  const coachById = id => S.coaches.find(c => c.id === id);

  // **words** → yellow highlighter, _words_ → red squiggle, \n → line break (applied after escaping)
  // (function declarations so they're ready before renderStatic() runs at the top)
  function marks(t) {
    return esc(t)
      .replace(/\*\*(.+?)\*\*/g, '<mark class="hl">$1</mark>')
      .replace(/(^|[^\w])_(.+?)_(?=[^\w]|$)/g, '$1<span class="squig">$2</span>')
      .replace(/\n/g, "<br>");
  }
  // text with blank lines → separate paragraphs; ~~words~~ → red pencil underline
  function paras(t) {
    return String(t).split(/\n\s*\n/).map(p => "<p>" + esc(p.trim()).replace(/\n/g, "<br>").replace(/~~(.+?)~~/g, '<span class="pencil-ul">$1</span>') + "</p>").join("");
  }
  // red pencil doodles for the mentor files (drawn with the #pencil filter, see styles.css .doodle)
  const DOODLE = {
    burst: '<svg class="doodle d-burst" viewBox="0 0 40 34" aria-hidden="true"><path d="M7 16 L4.5 5"/><path d="M15 21 L26 10.5"/><path d="M19 29.5 L35 27"/></svg>',
    sparkles: '<svg class="doodle d-spark" viewBox="0 0 64 40" aria-hidden="true"><path d="M17 3 C18 11 20 14 29 16 C20 18.5 18.5 21 17 30 C15.5 21 13.5 18.5 5 16.5 C13.5 14 15.5 11 17 3 Z"/><path d="M52 17 L51.5 33 M45 25.5 L59 24.5"/></svg>' +
      '<svg class="doodle d-plus" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 L11.5 22 M2.5 12.5 L21.5 11.5"/></svg>',
    burger: '<svg class="doodle d-burger" viewBox="0 0 64 50" aria-hidden="true">' +
      '<path d="M8 22 C8 9 20 4 33 4 C46 4 57 10 57 22 Z"/>' +                 // top bun
      '<path d="M22 11 l2 -1 M31 9 l2 0.5 M40 11 l2 1 M27 16 l1.5 -1 M36 16 l2 0"/>' + // sesame
      '<path d="M5 26 C9 23 12 29 16 26 C20 23 23 29 27 26 C31 23 34 29 38 26 C42 23 45 29 49 26 C53 23 56 29 60 26"/>' + // lettuce
      '<path d="M7 30 H58 C60 30 60 36 58 36 H7 C5 36 5 30 7 30 Z"/>' +       // patty
      '<path d="M9 39 H56 C56 45 50 47 45 47 H19 C13 47 9 45 9 39 Z"/>' +       // bottom bun
      '<path d="M48 4 L55 1.5 M52 8 L60 7"/></svg>',                             // little "fresh" marks
    // cat ears on the name + a chibi face peeking out under it
    // traced from the sketch: uneven "^" cat ears on the name, chibi face peeking out under it
    chibi: '<svg class="doodle d-chibi" viewBox="0 0 177 179" aria-hidden="true">' +
      '<path d="M25 21 L35 2.5 L51 17"/><path d="M32 20.5 Q35 16 38 19.5"/>' +                      // left ear + inner hook
      '<path d="M121 19 L141 6.5 L144 20"/><path d="M132 16 Q135 14.5 136 17 L137 21"/>' +            // right ear + inner hook
      '<g transform="translate(0 90)">' +
        '<path d="M11 8 C4 22 2 44 6 60 C8 70 12 76 15 81 L17 71 L27 79"/>' +                        // far-left hair, kicked-out end
        '<path d="M30 4 L18 24 L33 19 L35 31"/>' +                                                   // left "N" bangs
        '<path d="M71 3 C71 12 70 20 58 30"/>' +                                                     // centre strand
        '<path d="M71 22 L75.5 44 L82 31 L86.5 46 L98 40"/>' +                                       // middle zigzag bangs
        '<path d="M108 8 C110 20 116 27 128 32"/><path d="M141 25 L146 32 L156 32"/>' +              // right bangs + tuft
        '<path d="M151 4 C157 8 156 30 155 50 C154 64 152 76 152 84 L162 77 L166 82"/>' +           // right hair
        '<path d="M166 14 C171 30 173 55 171 80"/>' +                                                // far-right hair
        '<ellipse cx="49" cy="41" rx="19" ry="11"/><ellipse cx="121" cy="45" rx="24" ry="12.5"/>' +  // eyes
        '<ellipse class="fill" cx="48" cy="38.5" rx="5.5" ry="7.5"/><ellipse class="fill" cx="120" cy="39" rx="5.5" ry="7.5"/>' + // irises
        '<circle class="shine" cx="46.5" cy="36" r="1.6"/><circle class="shine" cx="118.5" cy="36.5" r="1.6"/>' +
        '<path d="M29 50 L29 62"/>' +                                                                // cheek edge
        '<path d="M32 63 C40 80 60 88 88 88 C112 88 132 80 141 66"/>' +                              // chin
        '<path d="M65 59 C68 64 72 64 76.5 61 C80 64 86 65 92 62.5"/>' +                             // cat mouth
        '<path d="M45 58 L45.5 62 M50 59 L50.5 62.5 M117 62 L117.5 66 M123 63 L123.5 66.5"/>' +      // blush ticks
      "</g></svg>",
    // traced from the sketch: tipped-over fries carton with a zigzag on it, fries spilling out
    fries: '<svg class="doodle d-fries" viewBox="0 0 132 104" aria-hidden="true">' +
      '<path d="M37 37 C55 25 75 12 92 3 C102 12 115 25 129 37 C112 48 95 60 77 72"/>' +   // carton
      '<path d="M37 37 C50 36 65 40 72 50 C75 58 76 64 77 72"/><path d="M37 37 C36 44 40 50 46 53"/>' + // opening + lip
      '<path d="M85 17 L78 31 L88 29 L85 40 L110 30"/>' +                                 // zigzag on the carton
      '<path d="M47 53 L33 64 L37 69 L52 58"/><path d="M50 64 L70 50 M53 68 L72 54"/>' +  // fries in the opening
      '<path d="M69 63 L73 66 L63 90 L49 87 Z"/>' +                                       // fat fry
      '<path d="M30 80 L35 83 L13 100 L3 97 Z"/></svg>'                                   // fry falling out
  };
  // competitive history line: a trailing "(...)" note drops onto its own line
  function histItem(h) {
    const m = String(h).match(/^(.*?)\s*(\([^()]*\))\s*$/);
    return m && m[1] ? "<li>" + fixes(esc(m[1])) + '<span class="hist-note">' + esc(m[2]) + "</span></li>" : "<li>" + fixes(esc(h)) + "</li>";
  }
  // {{old|new}} → old word struck through in red pencil with the correction scribbled underneath
  // [[text]] → text added by hand in red pencil (e.g. an extra "!")
  function fixes(html) {
    return html.replace(/\{\{(.+?)\|(.+?)\}\}/g, '<span class="pencil-fix"><s>$1</s><span class="fix" aria-label="corrected to $2">$2</span></span>')
      .replace(/\[\[(.+?)\]\]/g, (_, t) => t === "!"
        ? '<svg class="doodle d-bang" viewBox="0 0 10 28" role="img" aria-label="!"><path d="M5 2.5 L5 17"/><path d="M5 23.5 l.2 .3"/></svg>'
        : '<span class="pencil-add">' + t + "</span>");
  }
  // small black & white pfp for a character: art from PTG.charArt if there is a file, else a lettered placeholder
  function charPfp(name) {
    const file = name && C.charArt && C.charArt[name];
    if (file) return '<img src="' + esc(file) + '" alt="' + esc(name) + '">';
    return '<span class="pfp-ph" aria-hidden="true">' + esc((name || "?").charAt(0)) + "</span>";
  }
  /* ================================================== static content */
  function renderStatic() {
    $("#lede").textContent = C.event.pitch;
    $("#goal-line").textContent = C.event.goal;
    $("#pitch").textContent = C.event.pitch;
    $("#tz").textContent = UI.tz;
    $("#ticket-stub").insertAdjacentHTML("afterbegin", UI.barcode("PTG-1116", 60, 40));
    const st = UI.status();
    $("#ticket-status").textContent = st.phase === "before" ? "Class starts in " + st.days + (st.days === 1 ? " day" : " days")
      : st.phase === "live" ? "In session · day " + st.day + " of 14" : "Class dismissed";
    // ticket button counts down to the next checkpoint Sunday
    const big = C.schedule.find(e => (e.kind === "mock" || e.kind === "final") && e.date >= UI.todayYmd());
    let cta = "NOW IN SESSION";
    if (st.phase === "after") cta = "GGS · THANKS FOR PLAYING";
    else if (st.phase === "before") cta = "DAY 1 · MON NOV 9";
    else if (big) {
      const name = big.kind === "mock" ? "MOCK CHECKPOINT SERIES" : "FINAL CHECKPOINT SERIES";
      const n = Math.round((new Date(big.date + "T12:00:00") - new Date(UI.todayYmd() + "T12:00:00")) / 864e5);
      cta = name + "\n" + (n === 0 ? "TODAY" : n === 1 ? "TOMORROW" : "IN " + n + " DAYS");
    }
    $("#ticket-cta").textContent = cta;

    let done = [];
    try { done = JSON.parse(localStorage.getItem("ptg:goals")) || []; } catch (e) { /* storage blocked */ }
    $("#goal-list").innerHTML = C.goals.map((g, i) => '<label for="goal-' + i + '"><input type="checkbox" id="goal-' + i + '"' + (done.includes(i) ? " checked" : "") + "><span>" + esc(g) + "</span></label>").join("");
    $("#goal-list").addEventListener("change", () => {
      const v = C.goals.map((_, i) => i).filter(i => document.getElementById("goal-" + i).checked);
      try { localStorage.setItem("ptg:goals", JSON.stringify(v)); } catch (e) { /* storage blocked */ }
    });

    $("#steps").innerHTML = C.steps.map(s => "<li><span><b>" + marks(s.t) + "</b>" + marks(s.d) + "</span></li>").join("");
    $("#roles").innerHTML = C.roles.map(r => "<p><b>" + (r.icon ? '<span class="role-dot" aria-hidden="true">' + r.icon + "</span>" : "") + esc(r.name) + "</b><br>" + esc(r.d) + (r.alt ? ' <span class="alt">(aka ' + esc(r.alt.replace(/\.$/, "")) + ")</span>" : "") + "</p>").join("");

    renderSchedule();

    $("#res").innerHTML = C.resources.map(r => '<div class="index"><h3>' + esc(r.t) + "</h3><p>" + esc(r.d) + "</p></div>").join("");
    $("#expect").innerHTML = C.expectations.map(x => "<li>" + esc(x) + "</li>").join("");
    $("#sem-format").textContent = C.seminars.format;
    $("#sem").innerHTML = C.seminars.list.map(s => '<div class="sem"><span class="w">' + esc(C.seminars.where) + "</span><b>" + UI.ph("", s.title) + '</b><span class="d">Host: ' + UI.ph("", s.host) + "<br>" + UI.ph("", s.when) + "</span></div>").join("");
    $("#links").innerHTML = C.links.map(l =>
      '<a class="link" href="' + esc(l.url) + '" target="_blank" rel="noopener"><span class="tier"><span>' + esc(l.tag) + '</span></span><div class="lb"><h3>' + esc(l.name) + "</h3><p>" + esc(l.d) + '</p><span class="go">Join on Discord ↗</span></div></a>').join("");
  }

  function renderSchedule() {
    const days = UI.eventDays(), todayY = UI.todayYmd();
    let sel = (C.schedule.find(e => e.date >= todayY) || C.schedule[C.schedule.length - 1]).date;
    $("#dows").innerHTML = days.slice(0, 7).map(d => "<span>" + d.dow + "</span>").join("");
    const label = ["", "Week 1 · Scrims → Mock Checkpoint Series", "Week 2 · Prio scrims → Final Checkpoint Series"];
    // scrim days get the Project Lumi SCRIM sticker instead of a text tag,
    // slapped on at a random-looking spot and angle (seeded by the date, so it stays put between visits)
    const stickerSpot = ymd => {
      let h = 2166136261;
      for (const c of ymd) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
      const r = () => { // mulberry32
        h = (h + 0x6D2B79F5) | 0;
        let t = Math.imul(h ^ (h >>> 15), 1 | h);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      return "--sx:" + Math.round(2 + r() * 38) + "%;--sy:" + Math.round(38 + r() * 10) + "%;--sr:" + Math.round(-14 + r() * 28) + "deg";
    };
    const chip = ev => ev.kind === "scrim" ? '<img class="scrim-sticker" src="art/scrim-sticker.svg" alt="" width="240" height="240" style="' + stickerSpot(ev.date) + '">' : '<span class="chip ' + ev.kind + (ev.tentative ? " tbc" : "") + '">' + esc(ev.short) + "</span>";
    $("#weeks").innerHTML = [1, 2].map(w => '<div class="wk">' + label[w] + '</div><div class="week">' +
      days.filter(d => d.week === w).map(d => '<button class="day" data-iso="' + d.ymd + '" aria-pressed="false" aria-label="' +
        esc(UI.date(d.d, { weekday: "long", month: "long", day: "numeric" }) + (d.events.length ? ", " + d.events.map(e => e.title).join(", ") : ", open day")) + '"><span class="num">' + d.n + "</span>" +
        (d.ymd === todayY ? '<span class="today" title="Today"></span>' : "") + d.events.map(chip).join("") + "</button>").join("") + "</div>").join("");
    function detail() {
      const d = days.find(x => x.ymd === sel);
      $$(".day").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.iso === sel)));
      const body = d.events.length ? d.events.map(ev => "<h3>" + esc(ev.title) + "</h3>" + (ev.tentative ? '<span class="tbc-note">Tentative day</span>' : "") +
        "<p>" + esc(ev.note) + '</p><a class="btn" href="' + esc(UI.gcal(ev)) + '" target="_blank" rel="noopener">Add to Google Calendar ↗</a>').join("")
        : "<h3>Open day</h3><p>No group event. A good day to request a session with your mentor or an assistant coach.</p>";
      $("#day-detail").innerHTML = '<p class="dd-date">' + esc(UI.date(d.d, { weekday: "long", month: "long", day: "numeric" })) + "</p>" + body +
        '<ul class="agenda">' + C.schedule.map(ev => '<li><button data-iso="' + ev.date + '"' + (ev.date === sel ? ' aria-current="true"' : "") + '><span class="d">' +
          esc(UI.date(ev.date + "T12:00:00", { month: "short", day: "numeric" })) + '</span><span class="t">' + esc(ev.title) + "</span></button></li>").join("") + "</ul>";
    }
    $("#schedule").addEventListener("click", e => { const b = e.target.closest(".day, .agenda button"); if (b) { sel = b.dataset.iso; detail(); } });
    detail();
  }

  /* ================================================== faculty + rosters */
  function renderHeroBadge() {
    const m1 = mentors()[0];
    $("#hero-badge").innerHTML = m1 ? UI.badge(m1) : "";
  }

  function renderFaculty() {
    const ms = mentors();
    if (!ms.length) return;
    $("#fac-tabs").innerHTML = ms.map((m, i) => '<button class="tab" role="tab" id="ft-' + i + '" aria-controls="fac" aria-selected="false" data-i="' + i + '">' + pad(m.slot) + " " + esc(UI.bare(UI.coachName(m))) + "</button>").join("");
    function show(i, focus) {
      fi = (i + ms.length) % ms.length;
      const m = ms[fi];
      $("#fac-badge").innerHTML = UI.badge(m);
      const clip = '<svg class="clip" viewBox="0 0 44 112" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" aria-hidden="true"><path d="M30 40 V96 a10 10 0 0 1 -20 0 V22 a14 14 0 0 1 28 0 V88 a4 4 0 0 1 -8 0 V40"/></svg>';
      const top = side => '<div class="info-top"><span>Mentor file ' + pad(m.slot) + " / " + pad(ms.length) + side + "</span><span>" + esc(m.badge_id) + "</span></div>";
      const chips = (list, ph) => list && list.length ? list.map(p => "<span>" + esc(p) + "</span>").join("") : ph;
      const flipBtn = label => '<button type="button" class="flip-btn js-flip" aria-pressed="false">' + label + "</button>";
      const dz = k => (m.doodles || []).includes(k); // red pencil doodles this mentor's file gets
      const front =
        '<article class="sheet info face front">' + clip + top("") +
        "<h3>" + UI.ph(m.name, UI.coachName(m)) + (dz("burst") ? DOODLE.burst : "") + (dz("chibi") ? DOODLE.chibi : "") + "</h3>" +
        '<span class="team-tag">' + esc(UI.bare(UI.coachTeam(m))) + "</span>" +
        '<div class="info-grid">' +
          "<section><h4>Playstyle</h4>" + (m.playstyle ? paras(m.playstyle) : "<p>" + UI.ph("", "[One or two lines on how this mentor plays and what they focus on in review.]") + "</p>") + "</section>" +
          '<section class="pool-sec"><h4>Character pool</h4>' + (dz("sparkles") ? DOODLE.sparkles : "") + (dz("smile") ? '<span class="scribble s-smile" aria-hidden="true">^_^</span>' : "") + (dz("fries") ? DOODLE.fries : "") +
            (m.pool && m.pool.length
              ? '<div class="pfp" aria-live="polite">' + charPfp(m.pool[0]) + '</div><div class="pool pool-pick">' +
                m.pool.map((p, k) => '<button type="button" class="pool-chip' + (k ? "" : " on") + '" data-char="' + esc(p) + '">' + esc(p) + "</button>").join("") + "</div>" +
                (m.pool_note ? '<p class="pool-note">' + esc(m.pool_note) + "</p>" : "")
              : '<div class="pfp">' + charPfp("") + '</div><div class="pool"><span class="ph">[Main]</span><span class="ph">[Secondary]</span><span class="ph">[Pocket pick]</span></div>') +
          "</section>" +
          '<section class="hist-sec"><h4>Competitive history</h4><ul class="hist">' + (m.history && m.history.length ? m.history.map(histItem).join("") : '<li><span class="ph">[ERCS qualifier · result]</span></li><li><span class="ph">[ERCC / T2 event · placement]</span></li>') + "</ul>" + (dz("burger") ? DOODLE.burger : "") + "</section>" +
          "<section><h4>About me</h4>" + (m.about ? paras(m.about) : "<p>" + UI.ph("", "[A short about-me written by the mentor.]") + "</p>") + "</section>" +
        "</div>" +
        '<div class="info-foot"><span>Main: ' + UI.ph(m.main_character, "[Main character]") + " · Display: " + UI.ph(m.display_skin, "[Display skin]") + '</span><span class="foot-btns">' + flipBtn("Flip file ↻") + '<a class="btn" href="#book" data-book="' + esc(m.id) + '">Request a session</a></span>' +
          (m.foot_scribble ? '<span class="scribble s-foot" aria-hidden="true">' + esc(m.foot_scribble).replace(/\n/g, "<br>") + "</span>" : "") + "</div>" +
        "</article>";
      const back =
        '<article class="sheet info face back" inert>' + top(" · back") +
        '<div class="back-head"><h3>' + UI.ph(m.name, UI.coachName(m)) + '</h3><span class="stamp">Off the record</span></div>' +
        '<div class="info-grid">' +
          '<section class="wide"><h4>Coaching style</h4>' + (m.coaching ? paras(m.coaching) : "<p>" + UI.ph("", "[How this mentor likes to coach.]") + "</p>") +
            (m.motto ? '<p class="motto">“' + esc(m.motto) + "”</p>" : "") + "</section>" +
          '<section><h4>Other games played</h4><div class="pool">' + chips(m.games, '<span class="ph">[Game]</span><span class="ph">[Game]</span>') + "</div></section>" +
          '<section><h4>Favorite hobbies</h4><ul class="hist">' + (m.hobbies && m.hobbies.length ? m.hobbies.map(h => "<li>" + esc(h) + "</li>").join("") : '<li><span class="ph">[Hobby]</span></li>') + "</ul></section>" +
          '<section><h4>Fav teams</h4><ul class="hist">' + (m.fav_teams && m.fav_teams.length ? m.fav_teams.map(h => "<li>" + esc(h) + "</li>").join("") : '<li><span class="ph">[Team · player]</span></li>') + "</ul></section>" +
          '<section><h4>Fun fact</h4><p class="fun">' + UI.ph(m.fun_fact, "[Something fun about this mentor.]") + "</p></section>" +
          (m.ps && m.ps.length ? '<section class="wide"><h4>P.S.</h4><ul class="hist ps">' + m.ps.map(h => "<li>" + esc(h) + "</li>").join("") + "</ul></section>" : "") +
        "</div>" +
        '<div class="info-foot"><span>Click the file to flip it back</span>' + flipBtn("Flip back ↺") + "</div>" +
        "</article>";
      const box = $("#fac-info");
      box.classList.remove("flipped");
      box.innerHTML = '<div class="flip-card">' + front + back + "</div>";
      // the file is only as tall as the side facing up (no empty space under the shorter side)
      const fitFile = () => { const up = $(box.classList.contains("flipped") ? ".face.back" : ".face.front", box); if (up) $(".flip-card", box).style.height = up.offsetHeight + "px"; };
      fitFile();
      if (document.fonts) document.fonts.ready.then(fitFile); // web fonts can change the height once they load
      if (!window.__ptgFitFile) { window.__ptgFitFile = true; addEventListener("resize", () => { if (box.__fit) box.__fit(); }); }
      box.__fit = fitFile;
      // character pool: hovering (or tapping / tabbing to) a character swaps the pfp above the pool
      const pick = $(".pool-pick", box), pfp = $(".front .pfp", box);
      if (pick && pfp) {
        const showChar = chip => {
          if (!chip || chip.classList.contains("on")) return;
          $$(".pool-chip", pick).forEach(c => c.classList.toggle("on", c === chip));
          pfp.innerHTML = charPfp(chip.dataset.char);
        };
        pick.onmouseover = e => showChar(e.target.closest(".pool-chip"));
        pick.onfocusin = e => showChar(e.target.closest(".pool-chip"));
        pick.onclick = e => showChar(e.target.closest(".pool-chip"));
      }
      // flip on click anywhere on the file (links and buttons other than the flip button keep their own job)
      box.onclick = e => {
        if (e.target.closest("a, select, input, textarea") || (e.target.closest("button") && !e.target.closest(".js-flip"))) return;
        if (window.getSelection && String(window.getSelection()).length) return; // let people select text
        const on = box.classList.toggle("flipped");
        $$(".js-flip", box).forEach(b => b.setAttribute("aria-pressed", String(on)));
        $(".face.front", box).inert = on;  // only the side facing up can be read or tabbed into
        $(".face.back", box).inert = !on;
        fitFile();
        const target = $(on ? ".face.back .js-flip" : ".face.front .js-flip", box);
        if (e.target.closest(".js-flip") && target) target.focus({ preventScroll: true });
      };
      if (animOK) ["#fac-badge", "#fac-info"].forEach(s => { const el = $(s); el.classList.remove("swap"); void el.offsetWidth; el.classList.add("swap"); });
      $$("#fac-tabs .tab").forEach((t, j) => { t.setAttribute("aria-selected", String(j === fi)); t.tabIndex = j === fi ? 0 : -1; });
      if (focus) document.getElementById("ft-" + fi).focus();
    }
    $("#fac-tabs").onclick = e => { const t = e.target.closest(".tab"); if (t) show(+t.dataset.i); };
    $("#fac-tabs").onkeydown = e => {
      if (e.key === "ArrowRight") { e.preventDefault(); show(fi + 1, true); }
      if (e.key === "ArrowLeft") { e.preventDefault(); show(fi - 1, true); }
    };
    $("#prev").onclick = () => show(fi - 1);
    $("#next").onclick = () => show(fi + 1);
    show(Math.min(fi, ms.length - 1));
    animOK = true;
  }

  // wear and tear on some assistant badges so they don't all look fresh off the printer
  const WEAR = {
    scratches: '<path d="M118 9 L172 33"/><path class="faint" d="M128 6 L178 27"/><path d="M146 41 C158 45 172 47 192 54"/><path class="faint" d="M104 20 l9 3 M181 15 l6 4"/>',
    scuff: '<ellipse class="scuff" cx="26" cy="128" rx="44" ry="20"/><path d="M8 130 L62 108"/><path class="faint" d="M16 138 L54 121 M38 134 l16 -5"/><path d="M4 118 l6 -2"/>',
    gouge: '<path d="M4 76 C60 64 118 68 198 42"/><path class="faint" d="M10 81 C64 70 120 74 196 49"/><path class="faint" d="M70 30 l3 1 M150 96 l4 -1 M30 104 l2 2"/>',
    marked: '<rect class="tape" x="78" y="-6" width="48" height="16" transform="rotate(-4 102 2)"/><path class="ink" d="M156 64 l6 7 l15 -17"/><path class="faint" d="M168 70 L194 58"/>',
    nicks: '<path d="M196 92 l-7 3 M197 99 l-5 1"/><path class="faint" d="M60 14 L96 6 M120 128 L160 118"/><ellipse class="scuff" cx="178" cy="18" rx="26" ry="12"/>'
  };
  const WEAR_BY_SLOT = ["", "scratches", "", "scuff", "gouge", "", "marked", "nicks"]; // a1..a8; blank = clean card
  function renderAssist() {
    $("#assist").innerHTML = assistants().map((a, i) =>
      '<div class="mini-badge">' +
      (WEAR[WEAR_BY_SLOT[i % WEAR_BY_SLOT.length]] ? '<svg class="wear" viewBox="0 0 200 140" preserveAspectRatio="none" aria-hidden="true">' + WEAR[WEAR_BY_SLOT[i % WEAR_BY_SLOT.length]] + "</svg>" : "") +
      // optional sticker slapped on the empty right side (from the coach row, or the event content as a fallback)
      ((seed => {
        const s = a.sticker || seed.sticker, at = a.sticker_at || seed.sticker_at || {}; // sticker_at: { top: "30%", tilt: -14 }
        return s ? '<img class="mb-sticker" src="' + esc(s) + '" alt="" width="240" height="240" style="' +
          (at.top ? "top:" + esc(at.top) + ";" : "") + (at.tilt != null ? "--tilt:" + Number(at.tilt) + "deg" : "") + '">' : "";
      })(C.coachSeed.find(c => c.id === a.id) || {})) +
      '<div class="b-strip"><span>ROLE COACH · PTG</span></div><div class="mb-body">' +
      '<div class="b-top"><span class="b-dash"><i></i><i></i><i></i></span><span>' + esc(a.badge_id) + "</span></div>" +
      '<div class="mb-role">Assistant</div><div class="mb-name">[' + esc(UI.bare(UI.coachName(a))) + "]</div>" +
      // icon between the name and the role focus: art from PTG.art (e.g. a1: "art/a1.webp"), else an empty slot
      '<div class="mb-icon">' + (C.art && C.art[a.id] ? '<img src="' + esc(C.art[a.id]) + '" alt="' + esc(UI.bare(UI.coachName(a))) + ' icon">' : '<span class="mb-icon-ph" aria-hidden="true">?</span>') + "</div>" +
      '<div class="mb-focus">' + UI.ph(a.focus, "[Role focus]") + "<br>" + UI.ph((a.pool || []).join(", "), "[Characters or topics]") + "</div>" +
      '<div class="mb-foot"><span class="b-team">Any team</span><a href="#book" data-book="' + esc(a.id) + '">Request ›</a></div></div></div>').join("");
  }

  /* Rosters: every team in two columns. The Standings view unlocks once staff enter the first
     Mock Checkpoint Series placements (staff desk → Teams), and turns into final standings, with
     the champions on top, once Final Checkpoint Series placements are in. */
  function renderRosters() {
    const teams = S.teams;
    const mock = teams.some(t => t.mock_place), fin = teams.some(t => t.final_place);
    if (!mock) rv = "rosters";
    else if (!rv) rv = "standings";   // once results exist, open on standings
    const ev = k => C.schedule.find(e => e.kind === k);
    const day = (k, o) => { const e = ev(k); return e ? UI.date(e.date + "T12:00:00", o || { month: "short", day: "numeric" }).replace(",", "") : ""; };
    const ord = n => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th");
    const mentor = t => {
      const c = t.coach_id ? coachById(t.coach_id) : null;
      return c ? '<a class="rost-coach" data-id="' + esc(c.id) + '" href="?coach=' + encodeURIComponent(c.id) + '#book">' + esc(UI.bare(UI.coachName(c))) + "</a>" : '<span class="tba">To be assigned</span>';
    };
    const standings = rv === "standings";

    $("#rost-title").textContent = !standings ? "Team rosters" : fin ? "Final standings" : "Team standings";
    $("#rost-seg").innerHTML =
      '<button type="button" role="tab" data-v="rosters" aria-selected="' + !standings + '">Rosters</button>' +
      '<button type="button" role="tab" data-v="standings" aria-selected="' + standings + '"' + (mock ? "" : " disabled") + ">" +
        (mock ? 'Standings<span class="dot" aria-hidden="true"></span>' : "Standings · opens " + day("mock")) + "</button>";

    if (!standings) {
      $("#rost-view").innerHTML = teams.length
        ? '<div class="rost-cards">' + teams.map((t, i) =>
            '<div class="rc"><span class="n">' + pad(i + 1) + "</span><b>" + esc(t.name) + '</b><span class="co">Mentor · ' + mentor(t) + "</span>" +
            '<span class="pl">' + (t.players || []).map(p => esc(p.ign)).join(" · ") + "</span></div>").join("") + "</div>"
        : '<p class="rost-none">Teams are posted here on Day 1.</p>';
      $("#rost-sum").textContent = !teams.length ? "" : !mock
        ? teams.length + (teams.length === 1 ? " team" : " teams") + " · standings unlock after the Mock Checkpoint Series, " + day("mock", { weekday: "short", month: "short", day: "numeric" })
        : (fin ? "Final results are in" : "Mock results are in") + " · switch to Standings to see placements";
    } else {
      const key = fin ? "final_place" : "mock_place";
      const rows = teams.slice().sort((a, b) => (a[key] || 99) - (b[key] || 99) || (a.mock_place || 99) - (b.mock_place || 99));
      const res = n => '<td class="res' + (n === 1 ? " win" : n ? "" : " blank") + '">' + (n ? ord(n) : "—") + "</td>";
      const champ = fin && teams.find(t => t.final_place === 1);
      $("#rost-view").innerHTML =
        (champ ? '<div class="champ"><span class="champ-stamp">Champions</span><div><b>' + esc(champ.name) + "</b><span>Mentor · " +
          esc(champ.coach_id && coachById(champ.coach_id) ? UI.bare(UI.coachName(coachById(champ.coach_id))) : "To be assigned") + " · " +
          (champ.players || []).map(p => esc(p.ign)).join(" · ") + "</span></div></div>" : "") +
        '<table class="stable"><thead><tr><th>Place</th><th>Team</th><th class="mcol">Mentor</th><th class="c">Mock · ' + day("mock") + '</th><th class="c">Final · ' + day("final") + "</th></tr></thead><tbody>" +
        rows.map(t => '<tr><td class="n' + (t[key] === 1 ? " win" : "") + '">' + (t[key] ? ord(t[key]) : "—") + "</td>" +
          '<td class="tm">' + esc(t.name) + '<span class="m-in">Mentor · ' + mentor(t) + '</span></td><td class="co mcol">' + mentor(t) + "</td>" +
          res(t.mock_place) + res(t.final_place) + "</tr>").join("") + "</tbody></table>";
      $("#rost-sum").textContent = fin ? "Final standings · sorted by Final Checkpoint Series placement"
        : "Sorted by Mock Checkpoint Series placement · Final Checkpoint Series " + day("final", { weekday: "short", month: "short", day: "numeric" });
    }

    $("#rost-seg").onclick = e => {
      const b = e.target.closest("button[data-v]");
      if (b && !b.disabled) { rv = b.dataset.v; renderRosters(); }
    };
    // a mentor's name opens their office hours pop-up (see initBooking)
  }

  /* ================================================== office hours
     Coach cards on the page. A card opens a pop-up with that coach's week planner (half-hour rows, Eastern)
     and the request card beside it. Week 1 drops away once it's over; closing the pop-up starts the next
     one back on the first week. Mentors and assistant coaches both take team reviews and individual sessions. */
  const T = iso => new Date(iso).getTime();
  const etTime = iso => new Date(iso).toLocaleTimeString("en-US", { timeZone: UI.EVENT_TZ, hour: "numeric", minute: "2-digit" });
  const etShort = (a, b) => { const f = s => etTime(s).replace(":00", ""); const x = f(a), y = f(b); return x.slice(-2) === y.slice(-2) ? x.slice(0, -3) + "–" + y : x + "–" + y; };
  const dayShort = ymd => UI.date(UI.etAt(ymd, 720), { weekday: "short", month: "short", day: "numeric" });
  const EVENT_DAYS = UI.eventDays();
  const WEEK2 = EVENT_DAYS.find(d => d.week === 2).ymd;
  const weeks = () => UI.todayYmd() >= WEEK2 ? [2] : [1, 2];
  const LEN = ["30 min", "1 h", "1.5 h", "2 h"];

  function initBooking() {
    if (!bookingWired) {
      bookingWired = true;
      const pop = $("#bk-pop");
      $("#bk-cards").addEventListener("click", e => { const b = e.target.closest("[data-coach]"); if (b) openCoach(b.dataset.coach); });
      // "Request a session" on the faculty files and assistant badges, and mentor names in the rosters
      document.addEventListener("click", e => {
        const b = e.target.closest("[data-book], .rost-coach");
        const id = b && (b.dataset.book || b.dataset.id);
        if (!id || !coachById(id)) return;
        e.preventDefault();
        openCoach(id);
      });
      pop.addEventListener("click", onPopClick);
      pop.addEventListener("input", e => { if (e.target.id === "bk-note") BK.note = e.target.value; });
      pop.addEventListener("close", () => { BK.wk = weeks()[0]; BK.coach = null; });   // the next coach starts back on the first week
      $("#my-req").addEventListener("click", e => {
        const c = e.target.closest(".js-cancel-req");
        if (c) UI.act(c, async () => { await API.setRequestStatus(c.dataset.id, "cancelled"); await refreshBooking(); }, "Request cancelled.");
      });
      const asked = new URLSearchParams(location.search).get("coach");   // ?coach=m1 opens that coach right away
      if (asked && coachById(asked)) openCoach(asked);
    }
    refreshBooking();
  }

  // cards + "Your requests"; the open pop-up (if any) reloads its coach too
  async function refreshBooking() {
    const r = await Promise.all([API.allAvailability().catch(() => []), S.me ? API.myRequests().catch(() => []) : Promise.resolve([])]);
    BK.all = r[0]; S.myReqs = r[1];
    renderCards();
    renderMyReqs();
    if (BK.coach && $("#bk-pop").open) { await loadCoach(); paintPop(); }
  }

  function renderCards() {
    const now = Date.now();
    const card = c => {
      const next = BK.all.filter(b => b.coach_id === c.id && T(b.ends_at) > now).sort((a, b) => T(a.starts_at) - T(b.starts_at))[0];
      return '<button type="button" class="bk-card" data-coach="' + esc(c.id) + '"' + (next ? "" : " disabled") + "><b>" + esc(UI.bare(UI.coachName(c))) + "</b>" +
        "<span>" + (c.kind === "assistant" ? "Assistant coach · any team" : "Mentor · " + esc(UI.bare(UI.coachTeam(c)))) + "</span>" +
        "<em>" + (next ? "Next: " + esc(dayShort(UI.dayOf(next.starts_at))) + " · " + etShort(next.starts_at, next.ends_at) + " ET" : "No hours posted yet") + "</em></button>";
    };
    $("#bk-cards").innerHTML = '<div class="bk-top"><h3>Book office hours</h3><span>Pick a coach to see their week.</span></div>' +
      '<p class="bk-grp">Mentors</p><div class="bk-grid">' + mentors().map(card).join("") + "</div>" +
      '<p class="bk-grp">Assistant coaches</p><div class="bk-grid">' + assistants().map(card).join("") + "</div>";
  }

  async function openCoach(id) {
    const pop = $("#bk-pop");
    const myTeam = S.me && S.teams.some(t => (t.member_ids || []).includes(S.me.id));
    Object.assign(BK, { coach: id, start: null, len: 0, note: "", kind: myTeam ? "team" : "individual" });
    if (!pop.open) { pop.innerHTML = '<p class="loading">Loading ' + esc(UI.bare(UI.coachName(coachById(id)))) + "'s week…</p>"; pop.showModal(); }
    await loadCoach();
    if (BK.coach === id) paintPop();
  }
  async function loadCoach() {
    const id = BK.coach;
    const r = await Promise.all([API.availability(id).catch(() => []), API.busy(id).catch(() => []), S.me ? API.myRequests().catch(() => []) : Promise.resolve([])]);
    if (id !== BK.coach) return;
    BK.blocks = r[0]; BK.busy = r[1]; S.myReqs = r[2];
  }

  // every half hour inside the coach's hours on one day, with its state
  function slotsFor(ymd) {
    const now = Date.now(), out = [];
    const mine = S.myReqs.filter(r => r.coach_id === BK.coach && (r.status === "pending" || r.status === "accepted"));
    BK.blocks.filter(b => UI.dayOf(b.starts_at) === ymd).sort((a, b) => T(a.starts_at) - T(b.starts_at)).forEach((b, bi) => {
      for (let t = T(b.starts_at); t + HALF <= T(b.ends_at); t += HALF) {
        const e = t + HALF, ov = x => T(x.starts_at) < e && t < T(x.ends_at);
        const my = mine.find(ov);
        let st = "open";
        if (t < now) st = "past";
        else if (my) st = my.status === "accepted" ? "mine-ok" : "mine";
        else if (BK.busy.some(x => x.status === "accepted" && ov(x))) st = "booked";
        else if (BK.busy.some(x => x.status === "pending" && ov(x))) st = "requested";   // someone else is waiting; still open
        out.push({ t, e, iso: new Date(t).toISOString(), st, bi });
      }
    });
    return out;
  }
  const pickable = s => s.st === "open" || s.st === "requested";
  // how many half hours can follow a start (same block, still pickable, 2 hours at most)
  const maxLen = (sl, i) => { let n = 0; for (let j = i; j < sl.length && n < 4; j++) { if (sl[j].bi !== sl[i].bi || !pickable(sl[j])) break; n++; } return n; };
  const startDay = () => BK.start ? UI.dayOf(BK.start) : null;

  // Only players request sessions. Coaches (mentors and assistants) and staff get a view-only planner, unless
  // they're on a team themselves: the same rule as the desk's Player file. The database enforces it too.
  const canRequest = () => !S.me || S.teams.some(t => (t.member_ids || []).includes(S.me.id)) ||
    (S.me.role !== "staff" && !S.coaches.some(c => c.profile_id === S.me.id));

  // the week planner: days across, half hours down, only the times the coach has hours (gaps squeezed out)
  function planner() {
    const c = coachById(BK.coach), days = EVENT_DAYS.filter(d => d.week === BK.wk);
    const cell = {}, used = new Set();
    days.forEach(d => slotsFor(d.ymd).forEach(s => { const m = Math.round((s.t - UI.etAt(d.ymd, 0).getTime()) / 6e4); cell[d.ymd + "|" + m] = s; used.add(m); }));
    if (!used.size) return '<div class="bk-empty">' + esc(UI.bare(UI.coachName(c))) + " has no hours in Week " + BK.wk + (weeks().length > 1 ? ". Try the other week." : " yet.") + "</div>";
    const sel = BK.start ? T(BK.start) : 0, selEnd = sel + BK.len * HALF, ask = canRequest();
    const lab = m => { const h = Math.floor(m / 60) % 24, mm = m % 60; return (h % 12 || 12) + (mm ? ":" + pad(mm) : "") + " " + (h < 12 ? "AM" : "PM"); };
    const words = { mine: "Your request (waiting)", "mine-ok": "Your session", booked: "Booked", requested: "Someone's waiting", open: "Open" };
    let prev = null, rows = "";
    [...used].sort((a, b) => a - b).forEach(m => {
      if (prev != null && m - prev > 30) rows += '<tr class="gap"><th></th><td colspan="7"></td></tr>';   // hours nobody's free: squeezed out
      rows += '<tr><th class="tm">' + (m % 60 && prev === m - 30 ? "" : lab(m)) + "</th>" + days.map(d => {
        const s = cell[d.ymd + "|" + m];
        if (!s || s.st === "past") return '<td class="off"></td>';
        const label = esc(dayShort(d.ymd) + " · " + etTime(s.iso) + " ET · " + words[s.st]);
        if (!pickable(s) || !ask) return '<td><span class="is-' + s.st + '" title="' + label + '"></span></td>';   // view only: nothing to click
        const cls = s.t === sel ? "on" : s.t > sel && s.t < selEnd ? "in" : s.st === "requested" ? "req" : "";
        return '<td><button type="button" class="' + cls + '" data-start="' + s.iso + '" title="' + label + '" aria-label="' + label + '"></button></td>';
      }).join("") + "</tr>";
      prev = m;
    });
    return '<div class="bk-scroll"><table class="bk-wk"><thead><tr><th class="tm"></th>' + days.map(d => '<th class="' + (UI.todayYmd() > d.ymd ? "past" : "") + '">' + d.dow + "<b>" + d.n + "</b></th>").join("") + "</tr></thead><tbody>" + rows + "</tbody></table></div>" +
      '<div class="bk-key"><span><i class="open"></i>Open</span><span><i class="wait"></i>' + (ask ? "Someone's waiting (you can still ask)" : "Request waiting") + '</span><span><i class="is-booked"></i>Booked</span>' +
        (S.me && ask ? '<span><i class="is-mine"></i>Your request</span><span><i class="is-mine-ok"></i>Your session</span><span><i class="on"></i>Your pick</span>' : !S.me ? '<span><i class="on"></i>Your pick</span>' : "") + "</div>";
  }

  function requestCard() {
    const c = coachById(BK.coach), has = BK.start && BK.len, end = has ? new Date(T(BK.start) + BK.len * HALF).toISOString() : "";
    if (!canRequest()) {   // coaches and staff: a look at the week, no request card
      const own = c.profile_id && c.profile_id === S.me.id, staff = S.me.role === "staff";
      return '<div class="bk-req"><h4>View only</h4><p class="bk-note">' +
        (own ? "This is your week as players see it. Players request time with you here."
             : (staff ? "Staff" : "Coaches") + " don't request sessions. This is a look at " + esc(UI.bare(UI.coachName(c))) + "'s week.") + "</p>" +
        '<a class="btn" href="desk.html">Open your desk</a><p class="bk-fine">' + (staff ? "Requests are handled in Staff → Requests on your desk." : "You change your hours and answer requests on your desk.") + "</p></div>";
    }
    const sl = BK.start ? slotsFor(startDay()) : [], i = sl.findIndex(s => s.iso === BK.start), mx = i >= 0 ? maxLen(sl, i) : 0;
    const yours = has && !UI.onEastern(new Date(BK.start)) ? '<span class="bk-yours">' + esc(UI.time(BK.start) + "–" + UI.time(end)) + " your time</span>" : "";
    return '<div class="bk-req"><h4>Request card</h4><dl>' +
      "<div><dt>Coach</dt><dd>" + esc(UI.bare(UI.coachName(c))) + "</dd></div>" +
      "<div><dt>When</dt>" + (has ? "<dd>" + esc(dayShort(startDay())) + "<br>" + etTime(BK.start) + "–" + etTime(end) + " ET" + yours + "</dd>" : '<dd class="empty">Click a start time on the planner</dd>') + "</div></dl>" +
      '<div><span class="bk-lbl">How long</span>' + (BK.start ? '<div class="bk-seg" role="group" aria-label="How long">' + LEN.map((l, j) => '<button type="button" data-len="' + (j + 1) + '" aria-pressed="' + (BK.len === j + 1) + '"' + (j + 1 > mx ? " disabled" : "") + ">" + l + "</button>").join("") + "</div>"
        : '<p class="bk-fine">Pick a start time first.</p>') + "</div>" +
      '<div><span class="bk-lbl">Session</span><div class="bk-seg" role="group" aria-label="Session"><button type="button" data-kind="team" aria-pressed="' + (BK.kind === "team") + '">Team review</button><button type="button" data-kind="individual" aria-pressed="' + (BK.kind === "individual") + '">Individual</button></div></div>' +
      '<label><span class="bk-lbl">What do you want to work on?</span><textarea id="bk-note" maxlength="500" placeholder="Review our mock checkpoint VOD, trio rotations, …">' + esc(BK.note) + "</textarea></label>" +
      (S.me ? '<button type="button" class="btn" data-send' + (has ? "" : " disabled") + ">Send request</button>"
            : '<button type="button" class="btn" data-login>Log in with Discord to send</button>') +
      '<p class="bk-fine">' + (S.me ? esc(UI.bare(UI.coachName(c))) + " accepts or declines it. The answer shows on your desk." : "Requests need a Discord login so your coach knows who's asking.") + "</p></div>";
  }

  function paintPop() {
    const c = coachById(BK.coach), pop = $("#bk-pop");
    if (!c) return;
    const wks = weeks();
    pop.innerHTML = '<div class="bk-top"><div><span class="k">' + (c.kind === "assistant" ? "Assistant coach · any team" : "Mentor · " + esc(UI.bare(UI.coachTeam(c)))) + '</span><h3 id="bk-pop-title">' + esc(UI.bare(UI.coachName(c))) + "</h3></div>" +
      '<div class="bk-tools">' + (wks.length === 1 ? '<span class="bk-wk-only">Week 2</span>' : '<div class="bk-seg">' + wks.map(w => '<button type="button" data-wk="' + w + '" aria-pressed="' + (BK.wk === w) + '">Week ' + w + "</button>").join("") + "</div>") +
        '<button type="button" class="linkbtn" data-close>Close</button></div></div>' +
      '<div class="bk-body"><div><p class="bk-step">' + (canRequest() ? "Click a start time" : "Week view") + " · Eastern (ET)</p>" + planner() + "</div>" + requestCard() + "</div>";
  }

  function onPopClick(e) {
    const pop = $("#bk-pop");
    if (e.target === pop || e.target.closest("[data-close]")) return pop.close();
    const t = e.target.closest("[data-wk],[data-start],[data-len],[data-kind],[data-send],[data-login]");
    if (!t) return;
    if (t.dataset.wk) { BK.wk = +t.dataset.wk; BK.start = null; BK.len = 0; }
    else if (t.dataset.start) { const sl = slotsFor(UI.dayOf(t.dataset.start)), i = sl.findIndex(s => s.iso === t.dataset.start); BK.start = t.dataset.start; BK.len = Math.min(2, maxLen(sl, i)); }
    else if (t.dataset.len) BK.len = +t.dataset.len;
    else if (t.dataset.kind) BK.kind = t.dataset.kind;
    else if (t.hasAttribute("data-login")) return UI.login(t);
    else if (t.hasAttribute("data-send")) {
      return UI.act(t, async () => {
        await API.requestSession({ coach_id: BK.coach, kind: BK.kind, starts_at: BK.start, ends_at: new Date(T(BK.start) + BK.len * HALF).toISOString(), note: BK.note.trim() });
        BK.start = null; BK.len = 0; BK.note = "";
        await refreshBooking();   // the planner now shows it as your request
      }, "Request sent. You'll see the answer on your desk.");
    }
    paintPop();
  }

  function renderMyReqs() {
    const box = $("#my-req");
    if (!S.me || !canRequest()) { box.innerHTML = ""; return; }   // logged out, or a coach / staff: nothing to list
    const now = new Date();
    // only what's still waiting or booked; declined ones don't pile up here (they stay on the desk)
    const upcoming = S.myReqs.filter(r => new Date(r.ends_at) > now);
    const list = upcoming.filter(r => r.status === "pending" || r.status === "accepted").slice(0, 6);
    const declined = upcoming.filter(r => r.status === "declined").length;
    box.innerHTML = '<div class="mine-head"><h3>Your requests</h3><a href="desk.html">All on your desk →</a></div>' +
      (list.length ? '<ul class="req-list">' + list.map(r =>
        "<li>" + UI.statusChip(r.status) + '<span class="rq-when">' + esc(UI.range(r.starts_at, r.ends_at)) + '</span><span class="rq-who">' + esc(UI.bare(UI.coachName(r.coach))) + " · " + (r.kind === "team" ? "Team review" : "Individual") + "</span>" +
        '<button type="button" class="linkbtn js-cancel-req" data-id="' + esc(r.id) + '">Cancel</button></li>').join("") + "</ul>"
        : '<p class="empty-note">Nothing waiting or booked. Pick a coach above.</p>') +
      (declined ? '<p class="mine-note">' + declined + (declined === 1 ? " request was" : " requests were") + ' declined. <a href="desk.html">See them on your desk</a></p>' : "");
  }
})();
