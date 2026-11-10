/* Path to Glory · desk (desk.html): player file, mentor calendar, staff tools. */
(function () {
  "use strict";
  const { $, $$, esc, pad } = UI;
  const S = { me: null, coaches: [], myCoach: null, tab: null, staffTab: "teams", teamOpen: null, coachEdit: null, pday: null };
  let watching = false;

  boot();
  API.onAuth(() => boot());
  UI.mountDemoBar();

  async function boot() {
    S.me = await API.session().catch(() => null);
    UI.mountAuth($("#auth"), S.me);
    if (!S.me) {
      $("#desk-head").innerHTML = "";
      $("#desk-tabs").innerHTML = "";
      $("#desk-body").innerHTML = '<article class="sheet gate"><span class="mono-label" style="color:var(--red-deep)">Faculty access · Path to Glory</span><h2>Log in to open your desk</h2>' +
        "<p>Your desk holds your team, your session requests and, for mentors, your calendar. Log in with the Discord account you'll use during the event.</p>" +
        '<button type="button" class="btn" id="gate-login">Log in with Discord</button></article>';
      $("#gate-login").onclick = e => UI.login(e.currentTarget);
      return;
    }
    const [coaches, teams] = await Promise.all([API.coaches().catch(() => []), API.teams().catch(() => [])]);
    S.coaches = coaches;
    S.myCoach = S.coaches.find(c => c.profile_id === S.me.id) || null;
    // the player file is for players: mentors, assistants and staff only get it if they're linked to a team
    S.isPlayer = (!S.myCoach && S.me.role !== "staff") || teams.some(t => (t.member_ids || []).includes(S.me.id));
    const tabs = [];
    if (S.myCoach) tabs.push(["coach", S.myCoach.kind === "assistant" ? "Coach calendar" : "Mentor calendar"]);
    if (S.isPlayer) tabs.push(["player", "Player file"]);
    if (S.me.role === "staff") tabs.push(["staff", "Staff"]);
    // someone with several roles sees one at a time, picked in the profile menu
    const want = location.hash.slice(1), has = v => tabs.some(t => t[0] === v);
    S.tab = has(want) ? want : has(UI.view()) ? UI.view() : has("staff") ? "staff" : tabs[0][0];
    UI.setView(S.tab);
    tabs.splice(0, tabs.length, tabs.find(t => t[0] === S.tab));
    $("#desk-tabs").innerHTML = tabs.map(t => '<button type="button" role="tab" class="dtab" data-tab="' + t[0] + '" aria-selected="' + (t[0] === S.tab) + '">' + esc(t[1]) + "</button>").join("");
    $("#desk-tabs").onclick = e => { const b = e.target.closest(".dtab"); if (b) { S.tab = b.dataset.tab; history.replaceState(null, "", "#" + S.tab); $$(".dtab").forEach(x => x.setAttribute("aria-selected", String(x === b))); render(); } };
    if (!watching) {
      addEventListener("hashchange", () => { const b = $('.dtab[data-tab="' + location.hash.slice(1) + '"]'); if (b) b.click(); });   // the profile menu's links, while already on the desk
      watching = true;
      API.watch("requests", () => render());
      API.watch("availability", () => { if (S.tab === "coach") render(); });
    }
    render();
  }

  /* ---------- the header: who you are, and the three numbers that matter on the tab you're on ----------
     Each number is a button that opens the part of the desk that handles it. */
  const T = iso => new Date(iso).getTime();
  const waitingIn = list => list.filter(r => r.status === "pending" && T(r.starts_at) > UI.now()).length;
  const nextIn = list => list.filter(r => r.status === "accepted" && T(r.ends_at) > UI.now()).sort((a, b) => T(a.starts_at) - T(b.starts_at))[0];
  const whenShort = r => r ? UI.date(r.starts_at, { weekday: "short" }) + " " + UI.time(r.starts_at) : "None booked";   // in the viewer's time, like the rest of the desk
  const plural = (n, one, many) => n === 1 ? one : many;
  async function headStats() {
    const now = UI.now();
    if (S.tab === "coach") {
      const c = S.myCoach, [reqs, hours] = await Promise.all([API.coachRequests(c.id), API.availability(c.id)]);
      const w = waitingIn(reqs), h = Math.round(hours.filter(x => T(x.ends_at) > now).reduce((n, x) => n + (T(x.ends_at) - Math.max(T(x.starts_at), now)) / 6e4, 0) / 30) / 2;
      return [{ v: w, k: plural(w, "Request waiting", "Requests waiting"), hot: w > 0, go: "coach:waiting" },
        { v: whenShort(nextIn(reqs)), k: "Next session", go: "coach:coming" },
        { v: h + " h", k: "Hours posted", hot: h === 0, go: "coach:hours" }];
    }
    if (S.tab === "staff") {
      const [reqs, hours] = await Promise.all([API.allRequests(), API.allAvailability()]);
      const w = waitingIn(reqs), b = reqs.filter(r => r.status === "accepted" && T(r.ends_at) > now).length;
      const none = S.coaches.filter(c => !hours.some(x => x.coach_id === c.id && T(x.ends_at) > now)).length;
      return [{ v: w, k: plural(w, "Request waiting", "Requests waiting"), hot: w > 0, go: "staff:requests" },
        { v: b, k: plural(b, "Session booked", "Sessions booked"), go: "staff:requests" },
        { v: none, k: plural(none, "Coach with no hours", "Coaches with no hours"), hot: none > 0, go: "staff:hours" }];
    }
    const [mine, teams] = await Promise.all([API.myRequests(), API.teams()]);
    const team = teams.find(t => (t.member_ids || []).includes(S.me.id)), w = waitingIn(mine);
    return [{ v: team ? team.name : "No team", k: "Your team", go: "player:team" },
      { v: whenShort(nextIn(mine)), k: "Next session", go: "player:reqs" },
      { v: w, k: plural(w, "Request waiting", "Requests waiting"), hot: w > 0, go: "player:reqs" }];
  }
  // player tab: your team (name, mentor, players, request button) sits along the bottom of the header
  async function headTeam() {
    if (S.tab === "coach" || S.tab === "staff") return "";
    const teams = await API.teams();
    const team = teams.find(t => (t.member_ids || []).includes(S.me.id));
    if (!team) return '<p>You\'re not on a team for this event.</p>';
    const coach = S.coaches.find(c => c.id === team.coach_id);
    return '<div><span class="mono-label">Your team</span><p class="dh-tname">' + esc(team.name) + "</p>" +
      "<p>Mentor: <b>" + esc(coach ? UI.coachName(coach) : "To be assigned") + "</b></p></div>" +
      '<ul class="dh-tplayers">' + (team.players || []).map(p => "<li>" + esc(p.ign) + "</li>").join("") + "</ul>" +
      (coach ? '<a class="btn" href="index.html?hours&coach=' + encodeURIComponent(coach.id) + '">Request a session with ' + esc(UI.bare(UI.coachName(coach))) + "</a>" : "");
  }
  let headTok = 0;
  async function renderHead() {
    const c = S.myCoach, roles = [], tok = ++headTok;
    if (c) roles.push((c.kind === "assistant" ? "Assistant " : "Mentor ") + pad(c.slot));
    if (S.isPlayer) roles.push("Player");
    if (S.me.role === "staff") roles.push("Staff");
    const head = $("#desk-head");
    if (!head.querySelector(".dhead")) head.innerHTML = '<header class="sheet dhead"><div class="dh-who">' + UI.avatar(S.me, 52) + '<div><span class="mono-label"></span><h1></h1><p class="dh-sub"></p></div></div><div class="dh-stats"></div><div class="dh-team" hidden></div></header>';
    head.querySelector(".mono-label").textContent = "Your desk · " + roles.join(" · ");
    head.querySelector("h1").textContent = UI.who(S.me);
    head.querySelector(".dh-sub").textContent = "@" + (S.me.username || "");
    const [stats, teamHtml] = await Promise.all([headStats().catch(() => []), headTeam().catch(() => "")]);
    if (tok !== headTok) return;   // a newer one is on its way
    const dt = head.querySelector(".dh-team"); dt.innerHTML = teamHtml; dt.hidden = !teamHtml;
    head.querySelector(".dh-stats").innerHTML = stats.map(s => '<button type="button" class="dh-stat' + (s.hot ? " hot" : "") + '" data-go="' + s.go + '" title="' + esc(s.v + " · " + s.k) + '"><b>' + esc(s.v) + "</b><span>" + esc(s.k) + "</span></button>").join("");
    head.onclick = e => { const b = e.target.closest("[data-go]"); if (b) go(b.dataset.go); };
  }
  // a header number: switch to its tab, then bring its part of the desk into view
  async function go(g) {
    const [tab, where] = g.split(":");
    if (tab === "staff") S.staffTab = where;
    S.tab = tab; history.replaceState(null, "", "#" + tab);
    $$(".dtab").forEach(x => x.setAttribute("aria-selected", String(x.dataset.tab === tab)));
    await render();
    if (tab === "coach" && where === "hours") PTGCoachCal.mode("hours");
    if (tab === "coach" && where === "waiting") {   // no cards anymore: the number opens the pop-up with every request waiting
      const w = (await API.coachRequests(S.myCoach.id)).filter(r => r.status === "pending" && new Date(r.starts_at) > new Date(UI.now())).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
      if (w.length) return PTGCoachCal.openReq(w[0].id, "*|pending");
    }
    const t = $({ coming: "#d-coming", hours: ".cc-hours", team: "#desk-head", reqs: "#d-reqs" }[where] || "#desk-tabs") || $("#desk-tabs");
    t.scrollIntoView({ block: "start" });   // straight there (a smooth scroll can be cut short while the desk redraws)
  }

  async function render() {
    if (!S.me) return;
    renderHead();   // its numbers follow the tab and the latest data
    const body = $("#desk-body");
    try {
      if (S.tab === "coach") await renderCoach(body);
      else if (S.tab === "staff") await renderStaff(body);
      else await renderPlayer(body);
    } catch (e) {
      body.innerHTML = '<p class="loading">Couldn\'t load this part of your desk: ' + esc(e.message) + "</p>";
    }
  }

  /* ================================================== player */
  async function renderPlayer(body) {
    const [reqs, teams] = await Promise.all([API.myRequests().catch(() => []), API.teams().catch(() => [])]);
    const team = teams.find(t => (t.member_ids || []).includes(S.me.id));
    const coach = team && S.coaches.find(c => c.id === team.coach_id);
    const now = new Date(UI.now());
    const upcoming = reqs.filter(r => new Date(r.ends_at) > now);
    // Your sessions: both weeks. Upcoming days show what's booked or waiting; days that are over show what happened
    // (done, expired). Click a day to list it below.
    const days = UI.eventDays(), dayOf = r => UI.dayOf(r.starts_at), longDate = y => UI.date(UI.etAt(y, 720), { weekday: "long", month: "long", day: "numeric" });
    const over = y => UI.etAt(y, UI.DAY_END).getTime() <= UI.now();
    const count = (n, w) => n ? '<span class="chip-st st-' + w + '">' + n + " " + w + "</span>" : "";
    const pcell = d => {
      const s = reqs.filter(r => dayOf(r) === d.ymd).map(UI.shown), n = k => s.filter(x => x === k).length, ev = d.events[0], sel = S.pday === d.ymd, was = over(d.ymd);
      return '<div class="cc-day' + (was ? " was" : "") + (sel ? " on" : "") + (d.ymd === UI.todayYmd() ? " today" : "") + '" data-pday="' + d.ymd + '">' +
        '<button type="button" class="hit" aria-pressed="' + sel + '" aria-label="' + esc(longDate(d.ymd)) + '"></button>' +
        '<span class="cd-top"><small>' + d.dow + "</small><b>" + d.n + "</b>" + (ev ? '<i class="evdot ' + ev.kind + '" title="' + esc(ev.title) + '"></i>' : "") + "</span>" +
        (n("accepted") ? '<span class="ses-btn cd-acc">' + n("accepted") + (n("accepted") === 1 ? " session" : " sessions") + "</span>" : "") +
        (n("pending") ? '<span class="ses-btn cd-pen">' + n("pending") + " waiting</span>" : "") +
        count(n("done"), "done") + count(n("expired"), "expired") + "</div>";
    };
    const pl = S.pday ? reqs.filter(r => dayOf(r) === S.pday).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)) : [];
    const dayList = !S.pday ? '<p class="empty-note">Click a day to see its sessions. Days that are over show what happened.</p>'
      : '<div class="cc-dhead"><h3>' + esc(longDate(S.pday)) + '</h3><button type="button" class="linkbtn js-pclose">Close</button></div>' +
        (pl.length ? reqTable(pl, "player") : '<p class="empty-note">' + (over(S.pday) ? "Nothing happened on this day." : "No sessions or requests on this day.") + "</p>");
    body.innerHTML =
      '<section class="sheet dpanel wide-panel" id="d-cal"><h2>Your sessions</h2>' +
        '<div class="cal2 cc-cal">' + [1, 2].map(w => '<span class="wkl">Week ' + w + "</span>" + days.filter(d => d.week === w).map(pcell).join("")).join("") + "</div>" +
        '<div class="cc-legend"><span><i class="lg acc"></i>Booked session</span><span><i class="lg pen"></i>Request waiting</span><span><i class="lg dn"></i>Done</span><span><i class="lg ex"></i>Expired</span><span><i class="evdot kickoff"></i>Kickoff</span><span><i class="evdot scrim"></i>Scrim day</span><span><i class="evdot mock"></i>Checkpoint</span></div>' +
        dayList + "</section>" +
      '<section class="sheet dpanel wide-panel" id="d-reqs"><div class="dp-head"><h2>Your session requests</h2><a class="btn" href="index.html?hours">Request a session</a></div>' +
        '<p class="muted">Times are in your time zone (' + esc(UI.tz) + ").</p>" +
        (upcoming.length ? reqTable(upcoming, "player") : '<p class="empty-note">No upcoming requests.</p>') +
      "</section>";
    body.onclick = e => {
      const c = e.target.closest(".js-cancel");
      if (c) return UI.act(c, async () => { await API.setRequestStatus(c.dataset.id, "cancelled"); await render(); }, "Request cancelled.");
      if (e.target.closest(".js-pclose")) { S.pday = null; return render(); }
      const d = e.target.closest("[data-pday]");
      if (d) { S.pday = S.pday === d.dataset.pday ? null : d.dataset.pday; render(); }
    };
  }

  // mode: "player" / "coach" (with Cancel), "past" / "coach-past" (no buttons). Statuses as they are now: a waiting
  // request nobody answered in time shows Expired, a booked session that's over shows Done.
  function reqTable(list, mode, teamName) {
    const from = mode === "coach" || mode === "coach-past";
    return '<div class="tbl"><table><thead><tr><th>When</th><th>' + (from ? "From" : "Coach") + "</th><th>Session</th><th>Status</th><th></th></tr></thead><tbody>" +
      list.map(r => { const s = UI.shown(r); return "<tr><td>" + esc(UI.range(r.starts_at, r.ends_at)) + "</td><td>" +
        (from ? esc(UI.party(r, teamName)) : esc(UI.bare(UI.coachName(r.coach)))) + "</td><td>" + (r.kind === "team" ? "Team review" : "Individual") +
        // a session the mentor wrote down (set up with the team on Discord, say)
        (r.by_coach ? '<div class="muted small">' + (from ? "Written by you" : "Booked by your mentor") + "</div>" : "") +
        (r.note ? '<div class="muted small">' + esc(r.note) + "</div>" : "") + "</td><td>" + UI.statusChip(s) + "</td><td>" +
        ((mode === "player" && r.requester_id === S.me.id && (s === "pending" || s === "accepted")) || (mode === "coach" && s === "accepted") ? '<button type="button" class="linkbtn js-cancel" data-id="' + esc(r.id) + '">Cancel</button>' : "") +
        "</td></tr>"; }).join("") + "</tbody></table></div>";
  }

  /* ================================================== coach calendar */
  async function renderCoach(body) {
    const c = S.myCoach;
    const [blocks, reqs, teams, profiles] = await Promise.all([API.availability(c.id), API.coachRequests(c.id), API.teams().catch(() => []), API.profiles().catch(() => [])]);
    const myTeam = teams.find(t => t.coach_id === c.id);
    const onTeam = r => !!(myTeam && (myTeam.member_ids || []).includes(r.requester_id));
    const now = new Date(UI.now());
    const pending = reqs.filter(r => r.status === "pending" && new Date(r.starts_at) > now);
    const upcoming = reqs.filter(r => r.status === "accepted" && new Date(r.ends_at) > now);
    // another waiting request at the same time (accepting one declines the other)
    const T = iso => new Date(iso).getTime();
    const overlaps = r => pending.some(x => x.id !== r.id && T(x.starts_at) < T(r.ends_at) && T(r.starts_at) < T(x.ends_at));


    body.innerHTML =
      // the calendar (Hours | Sessions) lives in coachcal.js
      '<section class="sheet dpanel wide-panel" id="cc-panel"></section>' +
      '<section class="sheet dpanel wide-panel" id="d-coming"><h2>Coming up</h2>' + (upcoming.length ? reqTable(upcoming, "coach", myTeam && myTeam.name) : '<p class="empty-note">No accepted sessions coming up.</p>') +
        "</section>";
    PTGCoachCal.mount($("#cc-panel"), { coach: c, blocks, reqs, teams, profiles, rerender: render });   // profiles: your team's names for Write a session

    // Requests waiting cards and Coming up (the calendar handles its own clicks)
    body.onclick = e => {
      const open = e.target.closest(".js-open");
      if (open) return PTGCoachCal.openReq(open.dataset.id, "*|pending");   // the list-and-details pop-up, with every waiting request
      // Cancel in Coming up: say what will happen first (UI.askRequest), then act
      const can = e.target.closest(".js-cancel-acc, .js-cancel"); if (!can) return;
      const r = reqs.find(x => x.id === can.dataset.id), t = r && (r.by_coach && r.kind === "team" ? myTeam : teams.find(x => (x.member_ids || []).includes(r.requester_id)));
      UI.askRequest({ r, status: "cancelled", team: t && t.name, reqs }).then(ok => ok && UI.act(can, async () => { await API.setRequestStatus(r.id, "cancelled"); await render(); }, "Session cancelled."));
    };
  }

  // the mentor / assistant file players see on the faculty page (staff only: Staff → Coaches → Edit file)
  function coachForm(c) {
    const v = k => esc(c[k] || "");
    return '<form class="cform" id="coach-form" data-id="' + esc(c.id) + '">' +
      '<label class="fld"><span class="k">Name on the badge</span><input name="name" maxlength="40" value="' + v("name") + '"></label>' +
      (c.kind === "mentor" ? '<label class="fld"><span class="k">Team / class name</span><input name="team_name" maxlength="40" value="' + v("team_name") + '"></label>'
                           : '<label class="fld"><span class="k">Role focus</span><input name="focus" maxlength="80" value="' + v("focus") + '"></label>') +
      '<label class="fld"><span class="k">Main character</span><input name="main_character" maxlength="40" value="' + v("main_character") + '"></label>' +
      '<label class="fld"><span class="k">Display skin</span><input name="display_skin" maxlength="60" value="' + v("display_skin") + '"></label>' +
      '<label class="fld wide"><span class="k">Character pool (comma separated, up to 8)</span><input name="pool" value="' + esc((c.pool || []).join(", ")) + '"></label>' +
      '<label class="fld wide"><span class="k">Playstyle</span><textarea name="playstyle" rows="2" maxlength="400">' + v("playstyle") + "</textarea></label>" +
      '<label class="fld wide"><span class="k">Competitive history (one per line, up to 8)</span><textarea name="history" rows="3">' + esc((c.history || []).join("\n")) + "</textarea></label>" +
      '<label class="fld wide"><span class="k">About me</span><textarea name="about" rows="3" maxlength="600">' + v("about") + "</textarea></label>" +
      '<div class="wide row-btns"><button type="submit" class="btn">Save file</button><button type="button" class="btn ghost js-close-file">Close</button></div></form>';
  }
  function wireCoachForm(c, after) {
    const f = $("#coach-form");
    f.onsubmit = e => {
      e.preventDefault();
      const g = k => (f.elements[k] ? f.elements[k].value.trim() : undefined);
      const patch = { name: g("name"), main_character: g("main_character"), display_skin: g("display_skin"), playstyle: g("playstyle"), about: g("about"),
        pool: g("pool").split(",").map(s => s.trim()).filter(Boolean).slice(0, 8),
        history: g("history").split("\n").map(s => s.trim()).filter(Boolean).slice(0, 8) };
      if (c.kind === "mentor") patch.team_name = g("team_name"); else patch.focus = g("focus");
      UI.act(f.querySelector('[type="submit"]'), async () => { await API.updateCoach(c.id, patch); if (after) await after(); }, "Saved. The faculty page shows it now.");
    };
  }

  /* ================================================== staff */
  async function renderStaff(body) {
    const sub = [["teams", "Teams"], ["coaches", "Coaches"], ["hours", "Hours"], ["requests", "Requests"], ["people", "People"], ["stats", "Sponsor stats"]];
    const head = '<div class="subtabs">' + sub.map(s => '<button type="button" class="stab" data-sub="' + s[0] + '" aria-pressed="' + (S.staffTab === s[0]) + '">' + s[1] + "</button>").join("") + "</div>";
    let inner = "";
    const [profiles, coaches] = await Promise.all([API.profiles(), API.coaches()]);
    S.coaches = coaches;
    const pName = id => { const p = profiles.find(x => x.id === id); return p ? UI.who(p) + " (@" + (p.username || "") + ")" : "Unknown"; };

    if (S.staffTab === "teams") {
      // Read only: teams, players, linked accounts and the team profile (basic information from the
      // signup form) are set by the organiser (supabase/schema.sql), not from the site.
      const teams = await API.teams();
      const t = teams.find(x => x.id === S.teamOpen) || teams[0];
      const coachOf = x => x.coach_id ? UI.bare(UI.coachName(coaches.find(c => c.id === x.coach_id))) : "None yet";
      const info = t ? Object.entries(t.info || {}).filter(([, v]) => v != null && String(v).trim()) : [];
      inner = '<p class="muted">Teams and players are set by the event organiser. To change something, message them.</p>' +
        (!teams.length ? '<p class="empty-note">No teams yet. They\'re added before the event starts.</p>' :
        '<div class="teams-admin"><div class="tlist">' + teams.map(x =>
          '<button type="button" class="tcard js-team" data-id="' + esc(x.id) + '" aria-pressed="' + (x === t) + '">' +
            '<span><b>' + esc(x.name) + '</b><span class="muted small">Mentor: ' + esc(coachOf(x)) + '</span><span class="small">' + esc((x.players || []).map(p => p.ign).join(", ")) + "</span></span></button>").join("") + "</div>" +
        // the selected team's profile
        '<article class="tprofile"><div class="tp-head"><div><span class="mono-label" style="color:var(--ink-soft)">Team profile</span><h3>' + esc(t.name) + '</h3><p class="muted">Mentor: <b>' + esc(coachOf(t)) + "</b></p></div></div>" +
          '<h4 class="tp-sub">Basic information</h4>' +
          (info.length ? '<dl class="tp-kv">' + info.map(([k, v]) => "<dt>" + esc(k) + "</dt><dd>" + esc(v) + "</dd>").join("") + "</dl>" : '<p class="muted small">No profile info yet. It comes from the signup form.</p>') +
          '<h4 class="tp-sub">Players</h4><ul class="tp-list">' + ((t.players || []).map(p => "<li><b>" + esc(p.ign) + "</b>" + (p.discord ? ' <span class="muted">@' + esc(p.discord) + "</span>" : "") + "</li>").join("") || '<li class="muted">No players listed.</li>') + "</ul>" +
          '<h4 class="tp-sub">Linked accounts</h4><ul class="tp-list">' + ((t.member_ids || []).map(id => "<li>" + esc(pName(id)) + "</li>").join("") || '<li class="muted">None linked yet.</li>') + "</ul>" +
        "</article></div>");
      body.innerHTML = head + '<section class="sheet dpanel wide-panel"><h2>Teams</h2>' + inner + "</section>";
      body.onclick = e => {
        if (stabClick(e)) return;
        const b = e.target.closest(".js-team");
        if (b) { S.teamOpen = b.dataset.id; render(); }
      };
      return;
    }

    if (S.staffTab === "coaches") {
      const editing = S.coachEdit && coaches.find(c => c.id === S.coachEdit);
      const slotOf = c => (c.kind === "assistant" ? "A" : "M") + pad(c.slot);
      inner = '<p class="muted">Link each slot to the coach\'s Discord account once they\'ve logged in here; linked coaches get the calendar on their desk. Mentor files are edited here only.</p><div class="tbl"><table><thead><tr><th>Slot</th><th>Coach</th><th>Discord account</th><th></th></tr></thead><tbody>' +
        coaches.map(c => '<tr data-id="' + esc(c.id) + '"' + (editing && editing.id === c.id ? ' class="on"' : "") + '><td><b>' + slotOf(c) + '</b><div class="small muted">' + esc(UI.cardId(c)) + "</div></td>" +
          "<td><b>" + esc(UI.bare(UI.coachName(c))) + '</b><div class="small muted">' + esc((c.kind === "mentor" ? c.team_name : c.focus) || "") + "</div></td>" +
          '<td><select class="cell-in" name="profile_id" aria-label="Discord account for ' + esc(slotOf(c)) + '"><option value="">Not linked</option>' + profiles.map(p => '<option value="' + esc(p.id) + '"' + (p.id === c.profile_id ? " selected" : "") + ">" + esc(UI.who(p)) + " @" + esc(p.username || "") + "</option>").join("") + "</select></td>" +
          '<td class="row-btns"><button type="button" class="btn ghost js-save-coach">Save link</button><button type="button" class="btn js-edit-file">Edit file</button></td></tr>').join("") + "</tbody></table></div>";
      body.innerHTML = head + '<section class="sheet dpanel wide-panel"><h2>Coaches</h2>' + inner + "</section>" +
        (editing ? '<section class="sheet dpanel wide-panel" id="file-panel"><h2>' + (editing.kind === "assistant" ? "Coach" : "Mentor") + " file · " + esc(UI.bare(UI.coachName(editing))) + " (" + slotOf(editing) + ')</h2><p class="muted">This is what players see on the faculty page.</p>' + coachForm(editing) + "</section>" : "");
      if (editing) wireCoachForm(editing, async () => { S.coachEdit = null; await boot(); });
      body.onclick = e => {
        if (stabClick(e)) return;
        const save = e.target.closest(".js-save-coach"), edit = e.target.closest(".js-edit-file"), close = e.target.closest(".js-close-file");
        if (close) { S.coachEdit = null; render(); return; }
        if (edit) {
          S.coachEdit = edit.closest("tr").dataset.id;
          render().then(() => { const p = $("#file-panel"); if (p) (window.PTGScroll ? PTGScroll.to(p) : p.scrollIntoView({ behavior: "smooth" })); });
          return;
        }
        if (!save) return;
        const tr = save.closest("tr");
        const patch = { profile_id: tr.querySelector('[name="profile_id"]').value || null };
        UI.act(save, async () => { await API.updateCoach(tr.dataset.id, patch); await boot(); }, "Coach saved.");
      };
      return;
    }

    if (S.staffTab === "people") {
      inner = '<p class="muted">Everyone who has logged in with Discord. Staff can see and change everything on this site.</p><div class="tbl"><table><thead><tr><th></th><th>Name</th><th>Discord ID</th><th>Coach slot</th><th>Role</th></tr></thead><tbody>' +
        profiles.map(p => { const c = coaches.find(x => x.profile_id === p.id); return "<tr><td>" + UI.avatar(p, 28) + "</td><td><b>" + esc(UI.who(p)) + '</b><div class="small muted">@' + esc(p.username || "") + '</div></td><td class="small">' + esc(p.discord_id || "") + "</td><td>" + (c ? (c.kind === "assistant" ? "A" : "M") + pad(c.slot) : '<span class="muted">—</span>') + "</td>" +
          '<td><select class="js-role" data-id="' + esc(p.id) + '"' + (p.id === S.me.id ? ' disabled title="You can\'t change your own role"' : "") + '><option value="player"' + (p.role === "player" ? " selected" : "") + '>Player</option><option value="staff"' + (p.role === "staff" ? " selected" : "") + ">Staff</option></select></td></tr>"; }).join("") + "</tbody></table></div>";
      body.innerHTML = head + '<section class="sheet dpanel wide-panel"><h2>People</h2>' + inner + "</section>";
      body.onclick = e => { stabClick(e); };
      body.onchange = e => { const s = e.target.closest(".js-role"); if (s) UI.act(s, async () => { await API.setRole(s.dataset.id, s.value); }, "Role updated."); };
      return;
    }

    if (S.staffTab === "stats") {
      // visit numbers from track.js, added up by the database (sponsor_stats in schema.sql)
      let s;
      try { s = await API.sponsorStats(); }
      catch (e) { body.innerHTML = head + '<section class="sheet dpanel wide-panel"><h2>Sponsor stats</h2><p class="empty-note">Could not load the numbers: ' + esc(e.message || String(e)) + "</p></section>"; body.onclick = e2 => { stabClick(e2); }; return; }
      PTGStats.render(body, head, s);
      body.onclick = e => {
        if (stabClick(e)) return;
        if (e.target.closest(".js-ss-refresh")) return render();
        const copy = e.target.closest(".js-ss-copy");
        if (copy) {
          const text = PTGStats.summary(s), out = body.querySelector(".ss-copy");
          out.hidden = false; out.textContent = text;
          if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => UI.toast("Summary copied. Paste it into a message or doc."), () => UI.toast("Select the summary below and copy it."));
          else UI.toast("Select the summary below and copy it.");
        }
      };
      return;
    }

    // Hours and Requests: the all-coaches calendars (staffcal.js)
    void pName;
    await PTGStaffCal.render(S.staffTab === "hours" ? "hours" : "requests", body, { head, coaches, rerender: render, onTab: stabClick });
  }

  function stabClick(e) {
    const s = e.target.closest(".stab");
    if (!s) return false;
    S.staffTab = s.dataset.sub;
    render();
    return true;
  }
})();
