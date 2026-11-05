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
    if (!watching) {
      watching = true;
      API.watch("requests", () => refreshBooking());
      API.watch("availability", () => refreshBooking());
    }
  }

  const mentors = () => S.coaches.filter(c => c.kind === "mentor");
  const assistants = () => S.coaches.filter(c => c.kind === "assistant");
  const coachById = id => S.coaches.find(c => c.id === id);

  /* ================================================== static content */
  function renderStatic() {
    $("#lede").textContent = C.event.pitch;
    $("#goal-line").textContent = C.event.goal;
    $("#pitch").textContent = C.event.pitch;
    $("#prio").textContent = C.priority;
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

    $("#steps").innerHTML = C.steps.map(s => "<li><span><b>" + esc(s.t) + "</b>" + esc(s.d) + "</span></li>").join("");
    $("#roles").innerHTML = C.roles.map(r => "<p><b>" + esc(r.name) + "</b><br>" + esc(r.d) + (r.alt ? ' <span class="alt">(aka ' + esc(r.alt.replace(/\.$/, "")) + ")</span>" : "") + "</p>").join("");
    $("#after").innerHTML = "<b>After you apply</b>" + C.signupAfter.map(s => "<span>" + esc(s) + "</span>").join("<i>→</i>");

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
    const chip = ev => '<span class="chip ' + ev.kind + (ev.tentative ? " tbc" : "") + '">' + esc(ev.short) + "</span>";
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
      $("#fac-info").innerHTML =
        '<svg class="clip" viewBox="0 0 44 112" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" aria-hidden="true"><path d="M30 40 V96 a10 10 0 0 1 -20 0 V22 a14 14 0 0 1 28 0 V88 a4 4 0 0 1 -8 0 V40"/></svg>' +
        '<div class="info-top"><span>Mentor file ' + pad(m.slot) + " / " + pad(ms.length) + "</span><span>" + esc(m.badge_id) + "</span></div>" +
        "<h3>" + UI.ph(m.name, UI.coachName(m)) + "</h3>" +
        '<span class="team-tag">' + esc(UI.bare(UI.coachTeam(m))) + "</span>" +
        '<div class="info-grid">' +
          "<section><h4>Playstyle</h4><p>" + UI.ph(m.playstyle, "[One or two lines on how this mentor plays and what they focus on in review.]") + "</p></section>" +
          '<section><h4>Character pool</h4><div class="pool">' + (m.pool && m.pool.length ? m.pool.map(p => "<span>" + esc(p) + "</span>").join("") : '<span class="ph">[Main]</span><span class="ph">[Secondary]</span><span class="ph">[Pocket pick]</span>') + "</div></section>" +
          '<section><h4>Competitive history</h4><ul class="hist">' + (m.history && m.history.length ? m.history.map(h => "<li>" + esc(h) + "</li>").join("") : '<li><span class="ph">[ERCS qualifier · result]</span></li><li><span class="ph">[ERCC / T2 event · placement]</span></li>') + "</ul></section>" +
          "<section><h4>About me</h4><p>" + UI.ph(m.about, "[A short about-me written by the mentor.]") + "</p></section>" +
        "</div>" +
        '<div class="info-foot"><span>Main: ' + UI.ph(m.main_character, "[Main character]") + " · Display: " + UI.ph(m.display_skin, "[Display skin]") + '</span><a class="btn" href="#book" data-book="' + esc(m.id) + '">Request a session</a></div>';
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

  function renderAssist() {
    $("#assist").innerHTML = assistants().map(a =>
      '<div class="mini-badge"><div class="b-strip"><span>ROLE COACH · PTG</span></div><div class="mb-body">' +
      '<div class="b-top"><span class="b-dash"><i></i><i></i><i></i></span><span>' + esc(a.badge_id) + "</span></div>" +
      '<div class="mb-role">Assistant</div><div class="mb-name">[' + esc(UI.bare(UI.coachName(a))) + "]</div>" +
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
    box.classList.remove("single");
    if (!S.me) {
      box.innerHTML =
        '<article class="sheet app">' + appTop("Form PTG-T", "Team application") + '<p class="who">For full rosters. ' + esc(C.priority) + "</p>" + blanks(TEAM_Q) +
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
      '<p class="who">Applying as <b>@' + esc(S.me.username || UI.who(S.me)) + "</b>, team captain. " + esc(C.priority) + "</p>" +
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
