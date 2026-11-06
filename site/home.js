/* Path to Glory · public site (index.html). */
(function () {
  "use strict";
  const { $, $$, esc, pad } = UI;
  const C = window.PTG;
  const S = { me: null, coaches: [], teams: [], signup: null, editing: false, myReqs: [] };
  const BK = { coach: null, day: null, start: null, end: null, blocks: [], busy: [] };
  const HALF = 30 * 6e4;
  let watching = false, bookingWired = false, fi = 0, ri = 0, animOK = false;

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
    S.signup = S.me ? await API.mySignup().catch(() => null) : null;
    S.editing = false;
    renderHeroBadge(); renderFaculty(); renderAssist(); renderRosters(); renderApply(); initBooking();
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
  // same text with the marks removed, for places that show it plain
  function plain(t) {
    return t.replace(/\*\*(.+?)\*\*/g, "$1").replace(/(^|[^\w])_(.+?)_(?=[^\w]|$)/g, "$1$2");
  }

  /* ================================================== static content */
  function renderStatic() {
    $("#lede").textContent = C.event.pitch;
    $("#goal-line").textContent = C.event.goal;
    $("#pitch").textContent = C.event.pitch;
    $("#prio").innerHTML = marks(C.priority);
    $("#tz").textContent = UI.tz;
    $("#ticket-stub").insertAdjacentHTML("afterbegin", UI.barcode("PTG-1116", 60, 40));
    const st = UI.status();
    $("#ticket-status").textContent = st.phase === "before" ? "Class starts in " + st.days + (st.days === 1 ? " day" : " days")
      : st.phase === "live" ? "In session · day " + st.day + " of 14" : "Class dismissed";

    let done = [];
    try { done = JSON.parse(localStorage.getItem("ptg:goals")) || []; } catch (e) { /* storage blocked */ }
    $("#goal-list").innerHTML = C.goals.map((g, i) => '<label for="goal-' + i + '"><input type="checkbox" id="goal-' + i + '"' + (done.includes(i) ? " checked" : "") + "><span>" + esc(g) + "</span></label>").join("");
    $("#goal-list").addEventListener("change", () => {
      const v = C.goals.map((_, i) => i).filter(i => document.getElementById("goal-" + i).checked);
      try { localStorage.setItem("ptg:goals", JSON.stringify(v)); } catch (e) { /* storage blocked */ }
    });

    $("#steps").innerHTML = C.steps.map(s => "<li><span><b>" + marks(s.t) + "</b>" + marks(s.d) + "</span></li>").join("");
    $("#roles").innerHTML = C.roles.map(r => "<p><b>" + (r.icon ? '<span class="role-dot" aria-hidden="true">' + r.icon + "</span>" : "") + esc(r.name) + "</b><br>" + esc(r.d) + (r.alt ? ' <span class="alt">(aka ' + esc(r.alt.replace(/\.$/, "")) + ")</span>" : "") + "</p>").join("");
    if ($("#after")) $("#after").innerHTML = "<b>After you apply</b>" + C.signupAfter.map(s => "<span>" + esc(s) + "</span>").join("<i>→</i>");

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
    const label = ["", "Week 1 · Scrims → Mock checkpoint", "Week 2 · Prio scrims → Real checkpoint"];
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

  function renderRosters() {
    const n = Math.max(8, S.teams.length);
    const slots = Array.from({ length: n }, (_, i) => S.teams[i] || null);
    $("#rost-tabs").innerHTML = slots.map((t, i) => '<button class="tab" role="tab" id="rt-' + i + '" aria-controls="rost-form" data-i="' + i + '">' + esc(t ? t.name : "Team " + pad(i + 1)) + "</button>").join("");
    function show(i, focus) {
      ri = (i + n) % n;
      const t = slots[ri];
      const coach = t && t.coach_id ? coachById(t.coach_id) : null;
      const players = t ? (t.players || []) : [];
      const rows = Array.from({ length: Math.max(4, players.length) }, (_, k) => players[k]);
      $("#rost-form").innerHTML =
        '<div class="form-top"><div><span class="mono-label" style="color:var(--ink-soft)">Team roster · ' + pad(ri + 1) + " / " + pad(n) + "</span><h3>" + (t ? esc(t.name) : '<span class="ph">[Team ' + pad(ri + 1) + "]</span>") + "</h3></div>" +
        (t ? '<span class="stamp">Confirmed</span>' : '<span class="stamp open">Slot open</span>') + "</div>" +
        '<div class="fields">' +
          '<div class="field coach"><span class="k">Coach</span><span class="v' + (coach && coach.name ? "" : " empty") + '">' + esc(coach ? UI.coachName(coach) : "To be assigned") + "</span></div>" +
          '<div class="field"><span class="k">Status</span><span class="v">' + (t ? "Locked in" : '<span class="ph">Awaiting signups</span>') + "</span></div>" +
          rows.map((p, k) => '<div class="field"><span class="k">Player ' + (k + 1) + (p && p.discord ? " · @" + esc(p.discord) : "") + '</span><span class="v' + (p ? "" : " empty") + '">' + (p ? esc(p.ign) : "open slot") + "</span></div>").join("") +
        "</div>";
      $$("#rost-tabs .tab").forEach((b, j) => { b.setAttribute("aria-selected", String(j === ri)); b.tabIndex = j === ri ? 0 : -1; });
      if (focus) document.getElementById("rt-" + ri).focus();
    }
    $("#rost-tabs").onclick = e => { const t = e.target.closest(".tab"); if (t) show(+t.dataset.i); };
    $("#rost-tabs").onkeydown = e => {
      if (e.key === "ArrowRight") { e.preventDefault(); show(ri + 1, true); }
      if (e.key === "ArrowLeft") { e.preventDefault(); show(ri - 1, true); }
    };
    $("#rost-sum").textContent = S.teams.length + " of " + n + " teams confirmed · open slots fill from team and solo applications";
    show(Math.min(ri, n - 1));
  }

  /* ================================================== sign up */
  const TEAM_Q = ["Team name", "Captain (your Discord account)", "Players 1–4 + sub (in-game name · Discord)", "Played ERCS/ERCC qualifiers with 3/4 of this lineup?", "T2 events played", "Mentor preferences: 1st, 2nd, 3rd", "Seminar topics you want covered"];
  const SOLO_Q = ["In-game name", "Main role and characters", "Availability Nov 9–22", "Comp experience, if any", "Seminar topics you want covered"];
  const blanks = arr => '<ol class="blanks">' + arr.map((f, i) => "<li><span>" + pad(i + 1) + "</span><span>" + esc(f) + "</span></li>").join("") + "</ol>";
  const appTop = (code, title) => '<div class="app-top"><div><span class="mono-label" style="color:var(--red-deep)">' + code + "</span><h3>" + title + '</h3></div><span class="form-no">FILE NO.1116<br>ID // 2026</span></div>';

  function renderApply() {
    const box = $("#apply");
    if (!box) return; // Sign up section removed from the page (2026-11-05); forms kept here in case it comes back
    box.classList.remove("single");
    if (!S.me) {
      box.innerHTML =
        '<article class="sheet app">' + appTop("Form PTG-T", "Team application") + '<p class="who">For full rosters. ' + esc(plain(C.priority)) + "</p>" + blanks(TEAM_Q) +
        '<div class="app-foot"><button type="button" class="btn js-login">Log in with Discord to apply</button></div></article>' +
        '<article class="sheet app">' + appTop("Form PTG-S", "Solo application") + '<p class="who">For individual players. Staff place solo signups together on a team, under one of the eight mentors.</p>' + blanks(SOLO_Q) +
        '<div class="app-foot"><button type="button" class="btn js-login">Log in with Discord to apply</button></div></article>';
      $$(".js-login", box).forEach(b => b.onclick = () => UI.login(b));
      return;
    }
    const s = S.signup;
    if (s && s.status !== "withdrawn" && !S.editing) {
      box.classList.add("single");
      box.innerHTML = statusSheet(s);
      const ed = $("#app-edit", box), wd = $("#app-withdraw", box);
      if (ed) ed.onclick = () => { S.editing = true; renderApply(); };
      if (wd) wd.onclick = () => UI.act(wd, async () => { S.signup = await API.setSignupStatus(s.id, "withdrawn"); renderApply(); }, "Application withdrawn.");
      return;
    }
    const lockTeam = s && S.editing && s.kind === "solo", lockSolo = s && S.editing && s.kind === "team";
    box.innerHTML = teamForm(s && s.kind === "team" ? s : null, lockTeam) + soloForm(s && s.kind === "solo" ? s : null, lockSolo);
    wireForm("#f-team", "team");
    wireForm("#f-solo", "solo");
    $$(".js-cancel-edit", box).forEach(b => b.onclick = () => { S.editing = false; renderApply(); });
  }

  function mentorOptions(sel) {
    return '<option value="">No preference</option>' + mentors().map(m => '<option value="' + esc(m.id) + '"' + (sel === m.id ? " selected" : "") + ">" + esc(UI.bare(UI.coachName(m))) + " · " + esc(UI.bare(UI.coachTeam(m))) + "</option>").join("");
  }
  const val = (s, k) => s && s[k] != null ? esc(s[k]) : "";

  function teamForm(s, locked) {
    const players = (s && s.players) || [];
    const prefs = (s && s.mentor_prefs) || [];
    if (locked) return '<article class="sheet app locked">' + appTop("Form PTG-T", "Team application") + '<p class="who">You applied solo. Withdraw that application first if you want to apply as a team instead.</p>' + blanks(TEAM_Q) + "</article>";
    return '<form class="sheet app" id="f-team" novalidate>' + appTop("Form PTG-T", "Team application") +
      '<p class="who">Applying as <b>@' + esc(S.me.username || UI.who(S.me)) + "</b>, team captain. " + esc(plain(C.priority)) + "</p>" +
      '<div class="fgrid">' +
        '<label class="fld wide"><span class="k">01 Team name</span><input name="team_name" maxlength="40" required value="' + val(s, "team_name") + '"></label>' +
        '<div class="fld wide"><span class="k">02 Players (in-game name · Discord username)</span><div class="prows">' +
          [0, 1, 2, 3, 4].map(i => '<div class="prow"><span class="pn">' + (i < 4 ? "P" + (i + 1) : "Sub") + '</span><input name="ign' + i + '" maxlength="40" placeholder="In-game name" aria-label="Player ' + (i + 1) + ' in-game name" value="' + esc((players[i] || {}).ign || "") + '"><input name="dc' + i + '" maxlength="40" placeholder="Discord" aria-label="Player ' + (i + 1) + ' Discord username" value="' + esc((players[i] || {}).discord || "") + '"></div>').join("") +
        "</div></div>" +
        '<fieldset class="fld"><legend class="k">03 Played ERCS/ERCC qualifiers with 3/4 of this lineup?</legend><div class="yn">' +
          '<label><input type="radio" name="pq" value="yes"' + (s && s.played_qualifier === true ? " checked" : "") + "> Yes</label>" +
          '<label><input type="radio" name="pq" value="no"' + (s && s.played_qualifier === false ? " checked" : "") + "> No</label></div></fieldset>" +
        '<label class="fld"><span class="k">04 T2 events played</span><input name="t2_events" maxlength="200" placeholder="Lumia Rumble, ..." value="' + val(s, "t2_events") + '"></label>' +
        '<div class="fld wide"><span class="k">05 Mentor preferences</span><div class="prefs">' +
          [0, 1, 2].map(i => '<label><span>' + ["1st", "2nd", "3rd"][i] + '</span><select name="pref' + i + '">' + mentorOptions(prefs[i]) + "</select></label>").join("") + "</div></div>" +
        '<label class="fld wide"><span class="k">06 Seminar topics you want covered</span><textarea name="seminar_topics" rows="2" maxlength="500">' + val(s, "seminar_topics") + "</textarea></label>" +
      "</div>" +
      '<div class="app-foot"><button class="btn" type="submit">' + (s ? "Save team application" : "Submit team application") + "</button>" + (S.editing ? '<button type="button" class="btn ghost js-cancel-edit">Cancel</button>' : "") + "</div></form>";
  }

  function soloForm(s, locked) {
    if (locked) return '<article class="sheet app locked">' + appTop("Form PTG-S", "Solo application") + '<p class="who">You applied as a team. Withdraw that application first if you want to apply solo instead.</p>' + blanks(SOLO_Q) + "</article>";
    return '<form class="sheet app" id="f-solo" novalidate>' + appTop("Form PTG-S", "Solo application") +
      '<p class="who">Applying as <b>@' + esc(S.me.username || UI.who(S.me)) + "</b>. Staff place solo players together on a team under one of the mentors.</p>" +
      '<div class="fgrid">' +
        '<label class="fld wide"><span class="k">01 In-game name</span><input name="ign" maxlength="40" required value="' + val(s, "ign") + '"></label>' +
        '<label class="fld wide"><span class="k">02 Main role and characters</span><input name="main_role" maxlength="120" placeholder="Support · Elena, Bianca" value="' + val(s, "main_role") + '"></label>' +
        '<label class="fld wide"><span class="k">03 Availability Nov 9–22</span><input name="availability" maxlength="200" placeholder="Weeknights after 8 PM" value="' + val(s, "availability") + '"></label>' +
        '<label class="fld wide"><span class="k">04 Comp experience, if any</span><input name="experience" maxlength="300" value="' + val(s, "experience") + '"></label>' +
        '<label class="fld wide"><span class="k">05 Seminar topics you want covered</span><textarea name="seminar_topics" rows="2" maxlength="500">' + val(s, "seminar_topics") + "</textarea></label>" +
      "</div>" +
      '<div class="app-foot"><button class="btn" type="submit">' + (s ? "Save solo application" : "Submit solo application") + "</button>" + (S.editing ? '<button type="button" class="btn ghost js-cancel-edit">Cancel</button>' : "") + "</div></form>";
  }

  function wireForm(sel, kind) {
    const f = $(sel);
    if (!f) return;
    f.onsubmit = e => {
      e.preventDefault();
      const fd = new FormData(f), g = k => String(fd.get(k) || "").trim();
      let data;
      if (kind === "team") {
        const players = [0, 1, 2, 3, 4].map(i => ({ ign: g("ign" + i), discord: g("dc" + i).replace(/^@/, "") })).filter(p => p.ign);
        if (!g("team_name")) return UI.toast("Give your team a name.", "bad");
        if (players.length < 3) return UI.toast("Add at least 3 players' in-game names.", "bad");
        const prefs = [g("pref0"), g("pref1"), g("pref2")].filter((v, i, a) => v && a.indexOf(v) === i);
        data = { kind, team_name: g("team_name"), players, played_qualifier: g("pq") === "yes" ? true : g("pq") === "no" ? false : null, t2_events: g("t2_events"), mentor_prefs: prefs, seminar_topics: g("seminar_topics") };
      } else {
        if (!g("ign")) return UI.toast("Add your in-game name.", "bad");
        data = { kind, ign: g("ign"), main_role: g("main_role"), availability: g("availability"), experience: g("experience"), seminar_topics: g("seminar_topics") };
      }
      if (S.signup && S.signup.status === "withdrawn") data.status = "pending";
      UI.act(f.querySelector('[type="submit"]'), async () => {
        S.signup = await API.saveSignup(data);
        S.editing = false;
        renderApply();
        $("#signup").scrollIntoView({ behavior: "smooth", block: "start" });
      }, "Application sent. Staff will review it.");
    };
  }

  function statusSheet(s) {
    const label = { pending: "Under review", waitlist: "Waitlist", accepted: "Accepted", declined: "Not this time" }[s.status] || s.status;
    const open = ["pending", "waitlist"].includes(s.status);
    const prefs = (s.mentor_prefs || []).map(id => UI.bare(UI.coachName(coachById(id)))).join(", ");
    const rows = s.kind === "team"
      ? [["Team", s.team_name], ["Players", (s.players || []).map(p => p.ign + (p.discord ? " (@" + p.discord + ")" : "")).join(", ")], ["Qualifier lineup", s.played_qualifier == null ? "" : s.played_qualifier ? "Yes" : "No"], ["T2 events", s.t2_events], ["Mentor preferences", prefs], ["Seminar topics", s.seminar_topics]]
      : [["In-game name", s.ign], ["Role and characters", s.main_role], ["Availability", s.availability], ["Experience", s.experience], ["Seminar topics", s.seminar_topics]];
    return '<article class="sheet app status-app">' + appTop(s.kind === "team" ? "Form PTG-T" : "Form PTG-S", s.kind === "team" ? "Team application" : "Solo application") +
      '<div class="st-row"><span class="stamp ' + (s.status === "accepted" ? "" : s.status === "declined" ? "" : "open") + '">' + esc(label) + "</span><p>" +
        (s.status === "accepted" ? "You're in. Your team and mentor show on your desk once staff assign them." :
         s.status === "declined" ? "Staff couldn't fit this application in. Message staff on Discord with questions." :
         s.status === "waitlist" ? "You're on the waitlist. Staff will move you in if a spot opens." :
         "Staff will review it. You can edit it until they decide.") + "</p></div>" +
      '<dl class="kv">' + rows.map(r => "<dt>" + esc(r[0]) + "</dt><dd>" + UI.ph(r[1], "—") + "</dd>").join("") +
        (s.staff_note ? "<dt>Note from staff</dt><dd>" + esc(s.staff_note) + "</dd>" : "") + "</dl>" +
      '<div class="app-foot">' + (open ? '<button type="button" class="btn" id="app-edit">Edit application</button><button type="button" class="btn ghost" id="app-withdraw">Withdraw</button>' : "") +
        '<a class="btn ghost" href="desk.html">Open your desk</a></div></article>';
  }

  /* ================================================== office hours */
  function initBooking() {
    const sel = $("#bk-who");
    const opt = c => '<option value="' + esc(c.id) + '">' + esc(UI.bare(UI.coachName(c))) + " · " + esc(UI.bare(UI.coachTeam(c))) + "</option>";
    sel.innerHTML = '<optgroup label="Mentors">' + mentors().map(opt).join("") + '</optgroup><optgroup label="Assistant coaches">' + assistants().map(opt).join("") + "</optgroup>";
    const asked = new URLSearchParams(location.search).get("coach");
    if (!BK.coach && asked && coachById(asked)) BK.coach = asked;
    if (!BK.coach || !coachById(BK.coach)) BK.coach = S.coaches.length ? S.coaches[0].id : null;
    sel.value = BK.coach || "";
    if (!bookingWired) {
      bookingWired = true;
      sel.onchange = () => { BK.coach = sel.value; BK.day = null; BK.start = BK.end = null; refreshBooking(); };
      $("#book-form").addEventListener("change", e => { if (e.target.name === "bk-kind") renderCard(); });
      $("#book-form").onsubmit = e => e.preventDefault();
      $("#book").addEventListener("click", onBookClick);
      $("#book").addEventListener("change", e => {
        if (e.target.id === "bk-in") { BK.start = e.target.value; BK.end = defaultEnd(BK.start); renderBooking(); }
        if (e.target.id === "bk-out") { BK.end = e.target.value; renderBooking(); }
      });
      document.addEventListener("click", e => {
        const b = e.target.closest("[data-book]");
        if (!b) return;
        BK.coach = b.dataset.book; BK.day = null; BK.start = BK.end = null;
        $("#bk-who").value = BK.coach;
        refreshBooking();
      });
    }
    refreshBooking();
  }

  async function refreshBooking() {
    const id = BK.coach;
    if (!id) return;
    const r = await Promise.all([
      API.availability(id).catch(() => []),
      API.busy(id).catch(() => []),
      S.me ? API.myRequests().catch(() => []) : Promise.resolve([])
    ]);
    if (id !== BK.coach) return;
    BK.blocks = r[0]; BK.busy = r[1]; S.myReqs = r[2];
    const days = UI.eventDays(), now = new Date();
    const hasOpen = ymd => slotsFor(ymd).some(s => s.st === "open" || s.st === "requested");
    if (!BK.day || !days.some(d => d.ymd === BK.day)) {
      BK.day = (days.find(d => d.ymd >= UI.todayYmd() && hasOpen(d.ymd)) || days.find(d => d.ymd >= UI.todayYmd()) || days[0]).ymd;
    }
    void now;
    renderBooking();
    renderMyReqs();
  }

  // Every half hour inside the coach's posted hours for one day, with its state.
  function slotsFor(ymd) {
    const now = new Date(), out = [];
    const mine = S.myReqs.filter(r => r.coach_id === BK.coach && (r.status === "pending" || r.status === "accepted"));
    BK.blocks.filter(b => UI.dayOf(b.starts_at) === ymd).sort((a, b) => a.starts_at.localeCompare(b.starts_at)).forEach((b, bi) => {
      const bEnd = new Date(b.ends_at);
      for (let t = new Date(b.starts_at); t.getTime() + HALF <= bEnd.getTime(); t = new Date(t.getTime() + HALF)) {
        const e = new Date(t.getTime() + HALF);
        const ov = x => new Date(x.starts_at) < e && t < new Date(x.ends_at);
        const my = mine.find(ov);
        let st = "open";
        if (t < now) st = "past";
        else if (my) st = my.status === "accepted" ? "mine-ok" : "mine";
        else if (BK.busy.some(x => x.status === "accepted" && ov(x))) st = "booked";
        else if (BK.busy.some(x => x.status === "pending" && ov(x))) st = "requested";
        out.push({ t, e, iso: t.toISOString(), st, block: bi });
      }
    });
    return out;
  }
  const pickable = s => s.st === "open" || s.st === "requested";
  function endOptions(slots, startIso) {
    const i = slots.findIndex(s => s.iso === startIso);
    if (i < 0) return [];
    const out = [];
    for (let j = i; j < slots.length && j < i + 4; j++) {
      if (slots[j].block !== slots[i].block || !pickable(slots[j])) break;
      out.push(slots[j].e.toISOString());
    }
    return out;
  }
  function defaultEnd(startIso) {
    const ends = endOptions(slotsFor(BK.day), startIso);
    return ends[1] || ends[0] || null;
  }

  function renderBooking() {
    const coach = coachById(BK.coach);
    if (!coach) return;
    const isA = coach.kind === "assistant";
    $("#bk-team").disabled = isA;
    if (isA) $("#bk-ind").checked = true;
    $("#bk-label").textContent = UI.bare(UI.coachName(coach)) + " · " + (BK.blocks.length ? "posted hours" : "no hours posted yet");
    $("#bk-hint").textContent = isA ? "Assistant coaches take individual sessions from players on any team. Every request waits for the coach to accept it."
      : "Every request waits for the mentor to accept it. Players from other teams can request time too.";

    const days = UI.eventDays();
    const hours = ymd => BK.blocks.filter(b => UI.dayOf(b.starts_at) === ymd).reduce((m, b) => m + (new Date(b.ends_at) - new Date(b.starts_at)) / 36e5, 0);
    $("#bk-days").innerHTML = [1, 2].map(w => '<span class="wkl">Week ' + w + "</span>" + days.filter(d => d.week === w).map(d => {
      const h = hours(d.ymd), ev = d.events[0];
      return '<button type="button" class="lday' + (h ? " has" : "") + '" data-day="' + d.ymd + '" aria-pressed="' + (d.ymd === BK.day) + '" aria-label="' +
        esc(UI.date(d.d, { weekday: "long", month: "long", day: "numeric" })) + (h ? ", " + h + " hours posted" : ", no hours posted") + (ev ? ", " + esc(ev.title) : "") + '"><small>' + d.dow + "</small><b>" + d.n + '</b><span class="sc">' + (h ? (Math.round(h * 10) / 10) + "h" : "") + "</span>" + (ev ? '<i class="evdot ' + ev.kind + '" title="' + esc(ev.title) + '"></i>' : "") + "</button>";
    }).join("")).join("");

    const slots = slotsFor(BK.day);
    if (BK.start && !slots.some(s => s.iso === BK.start && pickable(s))) BK.start = BK.end = null;
    if (BK.start && !endOptions(slots, BK.start).includes(BK.end)) BK.end = defaultEnd(BK.start);
    const sel0 = BK.start ? new Date(BK.start) : null, sel1 = BK.end ? new Date(BK.end) : null;
    const words = { open: "Open", requested: "Open · someone asked", booked: "Booked", mine: "Your request · waiting", "mine-ok": "Your session", past: "Past" };
    $("#bk-rows").innerHTML = slots.length ? slots.map((s, i) => {
      const inSel = sel0 && s.t >= sel0 && s.e <= sel1;
      const gap = i > 0 && slots[i - 1].block !== s.block ? " gap" : "";
      let cell;
      if (inSel && s.iso !== BK.start) cell = '<span class="cont">↳ continued</span>';
      else if (pickable(s)) cell = '<button type="button" class="slot' + (s.st === "requested" ? " req" : "") + '" data-start="' + s.iso + '" aria-pressed="' + (s.iso === BK.start) + '">' + (s.iso === BK.start ? "Hour in" : words[s.st]) + "</button>";
      else cell = '<span class="taken st-' + s.st + '">' + words[s.st] + "</span>";
      return '<li class="' + (inSel ? "sel" : "") + gap + '"><span class="t">' + UI.time(s.iso) + '</span><span class="s">' + cell + "</span></li>";
    }).join("") : '<li class="none"><span class="s">No hours posted for ' + esc(UI.date(BK.day + "T12:00:00", { weekday: "long", month: "short", day: "numeric" })) + ". Days with hours show how many under the date.</span></li>";
    renderCard();
  }

  function renderCard() {
    const coach = coachById(BK.coach);
    const card = $("#bk-card");
    if (!coach) { card.innerHTML = ""; return; }
    const slots = slotsFor(BK.day);
    const starts = slots.filter(pickable);
    const kind = (document.querySelector('input[name="bk-kind"]:checked') || {}).value || "team";
    let html = "<h3>Request card</h3>";
    if (!starts.length) {
      card.innerHTML = html + '<p class="note">' + esc(UI.bare(UI.coachName(coach))) + " has no open time on this day. Pick a day marked with hours.</p>";
      return;
    }
    const ends = BK.start ? endOptions(slots, BK.start) : [];
    html += "<dl><div><dt>With</dt><dd>" + esc(UI.bare(UI.coachName(coach))) + "</dd></div>" +
      "<div><dt>On</dt><dd>" + esc(UI.date(BK.day + "T12:00:00", { weekday: "long", month: "short", day: "numeric" })) + "</dd></div>" +
      '<div class="io"><label for="bk-in">Hour in</label><select id="bk-in"><option value="">Pick a time</option>' + starts.map(s => '<option value="' + s.iso + '"' + (s.iso === BK.start ? " selected" : "") + ">" + UI.time(s.iso) + "</option>").join("") + "</select></div>" +
      '<div class="io"><label for="bk-out">Hour out</label><select id="bk-out"' + (BK.start ? "" : " disabled") + ">" + (BK.start ? ends.map(e => '<option value="' + e + '"' + (e === BK.end ? " selected" : "") + ">" + UI.time(e) + "</option>").join("") : "<option>—</option>") + "</select></div>" +
      "<div><dt>Session</dt><dd>" + (kind === "team" ? "Team review" : "Individual") + (BK.start && BK.end ? " · " + UI.dur(BK.start, BK.end) : "") + "</dd></div></dl>";
    if (!S.me) html += '<button type="button" class="btn" id="bk-login">Log in with Discord to send</button><p class="note">Requests need a Discord login so your coach knows who is asking.</p>';
    else html += '<button type="button" class="btn" id="bk-send"' + (BK.start && BK.end ? "" : " disabled") + '>Send request</button><p class="note">The request waits until ' + esc(UI.bare(UI.coachName(coach))) + " accepts or declines it. Answers show on your desk.</p>";
    card.innerHTML = html;
  }

  function onBookClick(e) {
    const d = e.target.closest(".lday"), s = e.target.closest(".slot"), send = e.target.closest("#bk-send"), login = e.target.closest("#bk-login");
    if (d) { BK.day = d.dataset.day; BK.start = BK.end = null; renderBooking(); const n = $('.lday[data-day="' + BK.day + '"]'); if (n) n.focus(); }
    else if (s) { BK.start = s.dataset.start; BK.end = defaultEnd(BK.start); renderBooking(); const n = $('.slot[data-start="' + BK.start + '"]'); if (n) n.focus(); }
    else if (login) UI.login(login);
    else if (send) {
      const kind = (document.querySelector('input[name="bk-kind"]:checked') || {}).value || "team";
      UI.act(send, async () => {
        await API.requestSession({ coach_id: BK.coach, kind, starts_at: BK.start, ends_at: BK.end, note: $("#bk-note").value.trim() });
        $("#bk-note").value = "";
        BK.start = BK.end = null;
        await refreshBooking();
      }, "Request sent. You'll see the answer on your desk.");
    }
    const c = e.target.closest(".js-cancel-req");
    if (c) UI.act(c, async () => { await API.setRequestStatus(c.dataset.id, "cancelled"); await refreshBooking(); }, "Request cancelled.");
  }

  function renderMyReqs() {
    const box = $("#my-req");
    if (!S.me) { box.innerHTML = ""; return; }
    const now = new Date();
    const list = S.myReqs.filter(r => new Date(r.ends_at) > now && r.status !== "cancelled").slice(0, 6);
    box.innerHTML = '<div class="mine-head"><h3>Your requests</h3><a href="desk.html">All on your desk →</a></div>' +
      (list.length ? '<ul class="req-list">' + list.map(r =>
        "<li>" + UI.statusChip(r.status) + '<span class="rq-when">' + esc(UI.range(r.starts_at, r.ends_at)) + '</span><span class="rq-who">' + esc(UI.bare(UI.coachName(r.coach))) + " · " + (r.kind === "team" ? "Team review" : "Individual") + "</span>" +
        (["pending", "accepted"].includes(r.status) ? '<button type="button" class="linkbtn js-cancel-req" data-id="' + esc(r.id) + '">Cancel</button>' : "<span></span>") + "</li>").join("") + "</ul>"
        : '<p class="empty-note">No upcoming requests yet. Pick a coach and a time above.</p>');
  }
})();
