/* Path to Glory · desk (desk.html): player file, mentor calendar, staff tools. */
(function () {
  "use strict";
  const { $, $$, esc, pad } = UI;
  const S = { me: null, coaches: [], myCoach: null, tab: null, staffTab: "apps", day: null, teamDraft: null };
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
        "<p>Your desk holds your application, your session requests and, for mentors, your calendar. Log in with the Discord account you'll use during the event.</p>" +
        '<button type="button" class="btn" id="gate-login">Log in with Discord</button></article>';
      $("#gate-login").onclick = e => UI.login(e.currentTarget);
      return;
    }
    S.coaches = await API.coaches().catch(() => []);
    S.myCoach = S.coaches.find(c => c.profile_id === S.me.id) || null;
    const tabs = [];
    if (S.myCoach) tabs.push(["coach", S.myCoach.kind === "assistant" ? "Coach calendar" : "Mentor calendar"]);
    tabs.push(["player", "Player file"]);
    if (S.me.role === "staff") tabs.push(["staff", "Staff"]);
    const want = location.hash.slice(1);
    S.tab = tabs.some(t => t[0] === want) ? want : (tabs.some(t => t[0] === S.tab) ? S.tab : tabs[0][0]);
    renderHead();
    $("#desk-tabs").innerHTML = tabs.map(t => '<button type="button" role="tab" class="dtab" data-tab="' + t[0] + '" aria-selected="' + (t[0] === S.tab) + '">' + esc(t[1]) + "</button>").join("");
    $("#desk-tabs").onclick = e => { const b = e.target.closest(".dtab"); if (b) { S.tab = b.dataset.tab; history.replaceState(null, "", "#" + S.tab); $$(".dtab").forEach(x => x.setAttribute("aria-selected", String(x === b))); render(); } };
    if (!watching) {
      watching = true;
      API.watch("requests", () => render());
      API.watch("availability", () => { if (S.tab === "coach") render(); });
    }
    render();
  }

  function renderHead() {
    const c = S.myCoach;
    const roles = ['<span class="rchip">Player</span>'];
    if (c) roles.unshift('<span class="rchip green">' + (c.kind === "assistant" ? "Assistant " : "Mentor ") + pad(c.slot) + "</span>");
    if (S.me.role === "staff") roles.push('<span class="rchip red">Staff</span>');
    $("#desk-head").innerHTML = '<div class="id-card">' + UI.avatar(S.me, 64) +
      '<div><span class="mono-label">Your desk · ID // 2026</span><h1>' + esc(UI.who(S.me)) + "</h1>" +
      '<p class="mono-sub">@' + esc(S.me.username || "") + (c ? " · " + esc(c.badge_id) : "") + '</p><div class="rchips">' + roles.join("") + "</div></div>" +
      UI.barcode(S.me.id, 120, 34) + "</div>";
  }

  async function render() {
    if (!S.me) return;
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
    const [signup, reqs, teams] = await Promise.all([API.mySignup().catch(() => null), API.myRequests().catch(() => []), API.teams().catch(() => [])]);
    const team = teams.find(t => (t.member_ids || []).includes(S.me.id));
    const coach = team && S.coaches.find(c => c.id === team.coach_id);
    const now = new Date();
    const upcoming = reqs.filter(r => new Date(r.ends_at) > now);
    const past = reqs.filter(r => new Date(r.ends_at) <= now);
    const label = { pending: "Under review", waitlist: "Waitlist", accepted: "Accepted", declined: "Not this time", withdrawn: "Withdrawn" };
    body.innerHTML = '<div class="desk-grid">' +
      '<section class="sheet dpanel"><h2>Your application</h2>' +
        (signup ? '<div class="st-row"><span class="stamp' + (signup.status === "accepted" ? "" : " open") + '">' + esc(label[signup.status] || signup.status) + "</span><p>" +
          (signup.kind === "team" ? "Team application for <b>" + esc(signup.team_name) + "</b>" : "Solo application as <b>" + esc(signup.ign) + "</b>") +
          ", sent " + esc(UI.date(signup.created_at, { month: "short", day: "numeric" })) + ".</p></div>" +
          (signup.staff_note ? '<p class="note-box"><b>Note from staff:</b> ' + esc(signup.staff_note) + "</p>" : "") +
          '<a class="btn ghost" href="index.html#signup">' + (["pending", "waitlist", "withdrawn"].includes(signup.status) ? "View or edit it" : "View it") + "</a>"
          : '<p>You haven\'t applied yet.</p><a class="btn" href="index.html#signup">Apply as a team or solo</a>') +
      "</section>" +
      '<section class="sheet dpanel"><h2>Your team</h2>' +
        (team ? '<p class="big-name">' + esc(team.name) + '</p><p>Mentor: <b>' + esc(coach ? UI.coachName(coach) : "To be assigned") + "</b></p>" +
          '<ul class="plain">' + (team.players || []).map(p => "<li>" + esc(p.ign) + (p.discord ? ' <span class="muted">@' + esc(p.discord) + "</span>" : "") + "</li>").join("") + "</ul>" +
          (coach ? '<a class="btn" href="index.html?coach=' + encodeURIComponent(coach.id) + '#book">Request a session with ' + esc(UI.bare(UI.coachName(coach))) + "</a>" : "")
          : "<p>Staff haven't placed you on a team yet. Once they do, it shows here.</p>") +
      "</section></div>" +
      '<section class="sheet dpanel wide-panel"><div class="dp-head"><h2>Your session requests</h2><a class="btn" href="index.html#book">Request a session</a></div>' +
        '<p class="muted">Times are in your time zone (' + esc(UI.tz) + ").</p>" +
        (upcoming.length ? reqTable(upcoming, "player") : '<p class="empty-note">No upcoming requests.</p>') +
        (past.length ? '<details class="past"><summary>Past requests (' + past.length + ")</summary>" + reqTable(past, "past") + "</details>" : "") +
      "</section>";
    body.onclick = e => {
      const c = e.target.closest(".js-cancel");
      if (c) UI.act(c, async () => { await API.setRequestStatus(c.dataset.id, "cancelled"); await render(); }, "Request cancelled.");
    };
  }

  function reqTable(list, mode) {
    return '<div class="tbl"><table><thead><tr><th>When</th><th>' + (mode === "coach" ? "From" : "Coach") + "</th><th>Session</th><th>Status</th><th></th></tr></thead><tbody>" +
      list.map(r => "<tr><td>" + esc(UI.range(r.starts_at, r.ends_at)) + "</td><td>" +
        (mode === "coach" ? esc(UI.who(r.requester)) : esc(UI.bare(UI.coachName(r.coach)))) + "</td><td>" + (r.kind === "team" ? "Team review" : "Individual") +
        (r.note ? '<div class="muted small">' + esc(r.note) + "</div>" : "") + "</td><td>" + UI.statusChip(r.status) + "</td><td>" +
        (mode !== "past" && ["pending", "accepted"].includes(r.status) && (mode === "player" || r.status === "accepted") ? '<button type="button" class="linkbtn js-cancel" data-id="' + esc(r.id) + '">Cancel</button>' : "") +
        "</td></tr>").join("") + "</tbody></table></div>";
  }

  /* ================================================== coach calendar */
  async function renderCoach(body) {
    const c = S.myCoach;
    const [blocks, reqs, teams] = await Promise.all([API.availability(c.id), API.coachRequests(c.id), API.teams().catch(() => [])]);
    const myTeam = teams.find(t => t.coach_id === c.id);
    const onTeam = r => !!(myTeam && (myTeam.member_ids || []).includes(r.requester_id));
    const now = new Date();
    const days = UI.eventDays();
    if (!S.day) S.day = (days.find(d => d.ymd >= UI.todayYmd()) || days[0]).ymd;
    const pending = reqs.filter(r => r.status === "pending" && new Date(r.starts_at) > now);
    const upcoming = reqs.filter(r => r.status === "accepted" && new Date(r.ends_at) > now);
    const byDay = (list, ymd) => list.filter(x => UI.dayOf(x.starts_at) === ymd);
    const hours = ymd => byDay(blocks, ymd).reduce((m, b) => m + (new Date(b.ends_at) - new Date(b.starts_at)) / 36e5, 0);

    const slip = r => '<article class="slip">' +
      '<div class="slip-top">' + UI.avatar(r.requester, 30) + "<div><b>" + esc(UI.who(r.requester)) + '</b><span class="muted">@' + esc((r.requester && r.requester.username) || "") + "</span></div>" +
        (onTeam(r) ? '<span class="rchip green">Your team</span>' : '<span class="rchip">Other team</span>') + "</div>" +
      '<p class="slip-when">' + esc(UI.date(r.starts_at, { weekday: "long", month: "short", day: "numeric" })) + "<br><b>" + esc(UI.time(r.starts_at)) + " → " + esc(UI.time(r.ends_at)) + "</b> · " + esc(UI.dur(r.starts_at, r.ends_at)) + "</p>" +
      '<p class="slip-kind">' + (r.kind === "team" ? "Team review" : "Individual session") + "</p>" +
      (r.note ? '<p class="slip-note">“' + esc(r.note) + "”</p>" : "") +
      '<div class="slip-act"><button type="button" class="btn js-dec" data-id="' + esc(r.id) + '" data-s="accepted">Accept</button><button type="button" class="btn ghost js-dec" data-id="' + esc(r.id) + '" data-s="declined">Decline</button></div></article>';

    const dayCell = d => {
      const bl = byDay(blocks, d.ymd), acc = byDay(reqs.filter(r => r.status === "accepted"), d.ymd);
      const pen = byDay(pending, d.ymd);
      return '<button type="button" class="cday' + (d.ymd === S.day ? " on" : "") + (d.ymd === UI.todayYmd() ? " today" : "") + '" data-day="' + d.ymd + '" aria-pressed="' + (d.ymd === S.day) + '">' +
        '<span class="cd-top"><small>' + d.dow + "</small><b>" + d.n + "</b>" + (d.events[0] ? '<i class="evdot ' + d.events[0].kind + '" title="' + esc(d.events[0].title) + '"></i>' : "") + "</span>" +
        bl.map(b => '<span class="cd-block">' + esc(UI.time(b.starts_at)) + "–" + esc(UI.time(b.ends_at)) + "</span>").join("") +
        (acc.length ? '<span class="cd-acc">' + acc.length + (acc.length === 1 ? " session" : " sessions") + "</span>" : "") +
        (pen.length ? '<span class="cd-pen">' + pen.length + " waiting</span>" : "") + "</button>";
    };

    const d0 = days.find(d => d.ymd === S.day) || days[0];
    const dayItems = [].concat(
      byDay(blocks, S.day).map(b => ({ t: b.starts_at, html: '<li class="dv-block"><span class="dv-t">' + esc(UI.time(b.starts_at)) + " – " + esc(UI.time(b.ends_at)) + '</span><span>Posted hours · ' + esc(UI.dur(b.starts_at, b.ends_at)) + '</span><button type="button" class="linkbtn js-del" data-id="' + esc(b.id) + '">Remove</button></li>' })),
      byDay(reqs.filter(r => r.status === "accepted" || r.status === "pending"), S.day).map(r => ({ t: r.starts_at, html: '<li class="dv-' + r.status + '"><span class="dv-t">' + esc(UI.time(r.starts_at)) + " – " + esc(UI.time(r.ends_at)) + "</span><span>" + UI.statusChip(r.status) + " " + esc(UI.who(r.requester)) + " · " + (r.kind === "team" ? "Team review" : "Individual") + "</span>" +
        (r.status === "pending" && new Date(r.starts_at) > now ? '<span class="dv-act"><button type="button" class="linkbtn js-dec" data-id="' + esc(r.id) + '" data-s="accepted">Accept</button><button type="button" class="linkbtn js-dec" data-id="' + esc(r.id) + '" data-s="declined">Decline</button></span>'
          : r.status === "accepted" && new Date(r.ends_at) > now ? '<button type="button" class="linkbtn js-cancel-acc" data-id="' + esc(r.id) + '">Cancel</button>' : "<span></span>") + "</li>" }))
    ).sort((a, b) => a.t.localeCompare(b.t));

    const minOpts = (from, to, sel) => { let o = ""; for (let m = from; m <= to; m += 30) o += '<option value="' + m + '"' + (m === sel ? " selected" : "") + ">" + UI.minLabel(m) + "</option>"; return o; };

    body.innerHTML =
      '<section class="dpanel-flat"><div class="dp-head"><h2>Requests waiting <span class="count">' + pending.length + "</span></h2><span class=\"muted\">Times in your time zone (" + esc(UI.tz) + ")</span></div>" +
        (pending.length ? '<div class="slips">' + pending.map(slip).join("") + "</div>" : '<p class="empty-note on-dark">Nothing waiting. New requests show up here as players send them.</p>') + "</section>" +
      '<section class="sheet dpanel wide-panel"><div class="dp-head"><h2>Your calendar</h2><span class="muted">' + esc(UI.bare(UI.coachName(c))) + " · " + esc(c.badge_id) + "</span></div>" +
        '<div class="cal2">' + [1, 2].map(w => '<span class="wkl">Week ' + w + "</span>" + days.filter(d => d.week === w).map(dayCell).join("")).join("") + "</div>" +
        '<div class="dayview"><div><h3>' + esc(UI.date(d0.d, { weekday: "long", month: "long", day: "numeric" })) + "</h3>" +
          (d0.events.length ? '<p class="muted">' + d0.events.map(e => esc(e.title)).join(" · ") + "</p>" : "") +
          (dayItems.length ? '<ul class="dv-list">' + dayItems.map(x => x.html).join("") + "</ul>" : '<p class="empty-note">No hours posted for this day yet.</p>') + "</div>" +
          '<form class="sheet-in addhours" id="add-hours"><h3>Post hours</h3>' +
            '<div class="io2"><label>Hour in<select name="in">' + minOpts(0, 1410, 1200) + '</select></label><label>Hour out<select name="out">' + minOpts(30, 1440, 1380) + "</select></label></div>" +
            '<fieldset><legend>Also add the same hours to</legend><div class="daypick">' + days.map(d => '<label' + (d.ymd === S.day ? ' class="cur"' : "") + '><input type="checkbox" name="d" value="' + d.ymd + '"' + (d.ymd === S.day ? " checked disabled" : "") + "><span>" + d.dow.charAt(0) + "<b>" + d.n + "</b></span></label>").join("") + "</div>" +
            '<div class="quick"><button type="button" class="linkbtn" data-pick="wk">All weekdays</button><button type="button" class="linkbtn" data-pick="all">Every day</button><button type="button" class="linkbtn" data-pick="none">Clear</button></div></fieldset>' +
            '<button type="submit" class="btn">Post hours</button><p class="muted small">Players can request any 30 min to 2 hour stretch inside these hours.</p></form>' +
        "</div></section>" +
      '<section class="sheet dpanel wide-panel"><h2>Coming up</h2>' + (upcoming.length ? reqTable(upcoming, "coach") : '<p class="empty-note">No accepted sessions yet.</p>') + "</section>" +
      '<section class="sheet dpanel wide-panel"><h2>Your ' + (c.kind === "assistant" ? "coach" : "mentor") + ' file</h2><p class="muted">This is what players see on the faculty page.</p>' + coachForm(c) + "</section>";

    const f = $("#add-hours");
    f.onclick = e => {
      const p = e.target.closest("[data-pick]");
      if (!p) return;
      $$('input[name="d"]:not(:disabled)', f).forEach(i => {
        const dow = new Date(i.value + "T12:00:00").getDay();
        i.checked = p.dataset.pick === "all" || (p.dataset.pick === "wk" && dow !== 0 && dow !== 6);
      });
    };
    f.onsubmit = e => {
      e.preventDefault();
      const a = +f.elements.in.value, b = +f.elements.out.value;
      if (b <= a) return UI.toast("Hour out has to be after hour in.", "bad");
      if (b - a > 720) return UI.toast("Post 12 hours or less per block.", "bad");
      const list = [S.day].concat($$('input[name="d"]:checked:not(:disabled)', f).map(i => i.value));
      const blocksIn = list.map(ymd => ({ coach_id: c.id, starts_at: UI.atMin(ymd, a).toISOString(), ends_at: UI.atMin(ymd, b).toISOString() }))
        .filter(x => new Date(x.ends_at) > new Date());
      if (!blocksIn.length) return UI.toast("Those hours have already passed.", "bad");
      UI.act(f.querySelector('[type="submit"]'), async () => {
        const r = await API.addBlocks(blocksIn);
        if (r.failed.length) UI.toast(r.added.length + " posted, " + r.failed.length + " skipped: " + r.failed[0].error, "bad");
        else UI.toast(r.added.length === 1 ? "Hours posted." : r.added.length + " blocks of hours posted.");
        await render();
      });
    };
    wireCoachForm(c);

    body.onclick = e => {
      const day = e.target.closest(".cday"), dec = e.target.closest(".js-dec"), del = e.target.closest(".js-del"), can = e.target.closest(".js-cancel-acc, .js-cancel");
      if (day) { S.day = day.dataset.day; render(); }
      else if (dec) UI.act(dec, async () => { await API.setRequestStatus(dec.dataset.id, dec.dataset.s); await render(); }, dec.dataset.s === "accepted" ? "Accepted. It's on your calendar." : "Declined.");
      else if (del) UI.act(del, async () => { await API.deleteBlock(del.dataset.id); await render(); }, "Hours removed.");
      else if (can) UI.act(can, async () => { await API.setRequestStatus(can.dataset.id, "cancelled"); await render(); }, "Session cancelled.");
    };
  }

  function coachForm(c) {
    const v = k => esc(c[k] || "");
    return '<form class="cform" id="coach-form">' +
      '<label class="fld"><span class="k">Name on the badge</span><input name="name" maxlength="40" value="' + v("name") + '"></label>' +
      (c.kind === "mentor" ? '<label class="fld"><span class="k">Team / class name</span><input name="team_name" maxlength="40" value="' + v("team_name") + '"></label>'
                           : '<label class="fld"><span class="k">Role focus</span><input name="focus" maxlength="80" value="' + v("focus") + '"></label>') +
      '<label class="fld"><span class="k">Main character</span><input name="main_character" maxlength="40" value="' + v("main_character") + '"></label>' +
      '<label class="fld"><span class="k">Display skin</span><input name="display_skin" maxlength="60" value="' + v("display_skin") + '"></label>' +
      '<label class="fld wide"><span class="k">Character pool (comma separated, up to 8)</span><input name="pool" value="' + esc((c.pool || []).join(", ")) + '"></label>' +
      '<label class="fld wide"><span class="k">Playstyle</span><textarea name="playstyle" rows="2" maxlength="400">' + v("playstyle") + "</textarea></label>" +
      '<label class="fld wide"><span class="k">Competitive history (one per line, up to 8)</span><textarea name="history" rows="3">' + esc((c.history || []).join("\n")) + "</textarea></label>" +
      '<label class="fld wide"><span class="k">About me</span><textarea name="about" rows="3" maxlength="600">' + v("about") + "</textarea></label>" +
      '<div class="wide"><button type="submit" class="btn">Save file</button></div></form>';
  }
  function wireCoachForm(c) {
    const f = $("#coach-form");
    f.onsubmit = e => {
      e.preventDefault();
      const g = k => (f.elements[k] ? f.elements[k].value.trim() : undefined);
      const patch = { name: g("name"), main_character: g("main_character"), display_skin: g("display_skin"), playstyle: g("playstyle"), about: g("about"),
        pool: g("pool").split(",").map(s => s.trim()).filter(Boolean).slice(0, 8),
        history: g("history").split("\n").map(s => s.trim()).filter(Boolean).slice(0, 8) };
      if (c.kind === "mentor") patch.team_name = g("team_name"); else patch.focus = g("focus");
      UI.act(f.querySelector('[type="submit"]'), async () => {
        S.myCoach = await API.updateCoach(c.id, patch);
        renderHead();
      }, "Saved. The faculty page shows it now.");
    };
  }

  /* ================================================== staff */
  async function renderStaff(body) {
    const sub = [["apps", "Applications"], ["teams", "Teams"], ["coaches", "Coaches"], ["people", "People"], ["sessions", "Sessions"]];
    const head = '<div class="subtabs">' + sub.map(s => '<button type="button" class="stab" data-sub="' + s[0] + '" aria-pressed="' + (S.staffTab === s[0]) + '">' + s[1] + "</button>").join("") + "</div>";
    let inner = "";
    const [profiles, coaches] = await Promise.all([API.profiles(), API.coaches()]);
    S.coaches = coaches;
    const pName = id => { const p = profiles.find(x => x.id === id); return p ? UI.who(p) + " (@" + (p.username || "") + ")" : "Unknown"; };

    if (S.staffTab === "apps") {
      const apps = await API.signups();
      const order = { pending: 0, waitlist: 1, accepted: 2, declined: 3, withdrawn: 4 };
      apps.sort((a, b) => (order[a.status] - order[b.status]) || a.created_at.localeCompare(b.created_at));
      const counts = k => apps.filter(a => a.kind === k && a.status !== "withdrawn").length;
      inner = '<p class="muted">' + counts("team") + " team and " + counts("solo") + " solo applications. Priority: " + esc(window.PTG.priority) + "</p>" +
        (apps.length ? '<div class="apps">' + apps.map(a => {
          const prefs = (a.mentor_prefs || []).map(id => UI.bare(UI.coachName(coaches.find(c => c.id === id)))).join(", ");
          const detail = a.kind === "team"
            ? [["Players", (a.players || []).map(p => p.ign + (p.discord ? " @" + p.discord : "")).join(", ")], ["Qualifier lineup (3/4)", a.played_qualifier == null ? "" : a.played_qualifier ? "Yes" : "No"], ["T2 events", a.t2_events], ["Mentor preferences", prefs], ["Seminar topics", a.seminar_topics]]
            : [["Role and characters", a.main_role], ["Availability", a.availability], ["Experience", a.experience], ["Seminar topics", a.seminar_topics]];
          return '<details class="app-row"><summary><span class="kchip ' + a.kind + '">' + a.kind + "</span><b>" + esc(a.kind === "team" ? a.team_name : a.ign) + '</b><span class="muted">' + esc(UI.who(a.profile)) + " @" + esc((a.profile && a.profile.username) || "") + "</span>" +
            (a.kind === "team" && a.played_qualifier ? '<span class="rchip red">Priority</span>' : "<span></span>") + UI.statusChip(a.status) + "</summary>" +
            '<dl class="kv">' + detail.map(r => "<dt>" + esc(r[0]) + "</dt><dd>" + UI.ph(r[1], "—") + "</dd>").join("") + "<dt>Sent</dt><dd>" + esc(UI.date(a.created_at, { month: "short", day: "numeric" })) + "</dd></dl>" +
            '<div class="app-act"><label>Status <select class="js-status" data-id="' + esc(a.id) + '">' + ["pending", "accepted", "waitlist", "declined", "withdrawn"].map(s => '<option value="' + s + '"' + (s === a.status ? " selected" : "") + ">" + s + "</option>").join("") + "</select></label>" +
              '<label class="grow">Note to player <input class="js-note" data-id="' + esc(a.id) + '" maxlength="300" value="' + esc(a.staff_note || "") + '"></label>' +
              '<button type="button" class="btn ghost js-save-app" data-id="' + esc(a.id) + '">Save</button>' +
              (a.kind === "team" ? '<button type="button" class="btn js-make-team" data-id="' + esc(a.id) + '">Make team</button>' : "") + "</div></details>";
        }).join("") + "</div>" : '<p class="empty-note">No applications yet.</p>');
      body.innerHTML = head + '<section class="sheet dpanel wide-panel"><h2>Applications</h2>' + inner + "</section>";
      body.onclick = e => {
        if (stabClick(e)) return;
        const sv = e.target.closest(".js-save-app"), mk = e.target.closest(".js-make-team");
        if (sv) {
          const id = sv.dataset.id;
          UI.act(sv, async () => { await API.setSignupStatus(id, $('.js-status[data-id="' + id + '"]').value, $('.js-note[data-id="' + id + '"]').value.trim()); await render(); }, "Application updated.");
        }
        if (mk) {
          const a = apps.find(x => x.id === mk.dataset.id);
          S.teamDraft = { name: a.team_name, coach_id: a.mentor_prefs && a.mentor_prefs[0] || "", players: a.players || [], member_ids: [a.user_id], signup_id: a.id, sort: 0 };
          S.staffTab = "teams"; render();
        }
      };
      return;
    }

    if (S.staffTab === "teams") {
      const teams = await API.teams();
      const d = S.teamDraft || { name: "", coach_id: "", players: [], member_ids: [], sort: teams.length + 1 };
      const mentorsL = coaches.filter(c => c.kind === "mentor");
      inner = '<div class="teams-admin"><div>' + (teams.length ? teams.map(t => '<article class="tcard"><div><b>' + esc(t.name) + '</b><span class="muted">Mentor: ' + esc(t.coach_id ? UI.coachName(coaches.find(c => c.id === t.coach_id)) : "none") + "</span>" +
          '<span class="small">' + esc((t.players || []).map(p => p.ign).join(", ")) + '</span><span class="small muted">' + (t.member_ids || []).length + " linked accounts</span></div>" +
          '<div class="tc-act"><button type="button" class="linkbtn js-edit-team" data-id="' + esc(t.id) + '">Edit</button><button type="button" class="linkbtn js-del-team" data-id="' + esc(t.id) + '">Delete</button></div></article>').join("") : '<p class="empty-note">No teams yet.</p>') + "</div>" +
        '<form class="sheet-in" id="team-form"><h3>' + (d.id ? "Edit team" : "New team") + "</h3>" +
          '<label class="fld"><span class="k">Team name</span><input name="name" maxlength="40" required value="' + esc(d.name) + '"></label>' +
          '<label class="fld"><span class="k">Mentor</span><select name="coach_id"><option value="">None yet</option>' + mentorsL.map(m => '<option value="' + m.id + '"' + (m.id === d.coach_id ? " selected" : "") + ">" + esc(UI.bare(UI.coachName(m))) + "</option>").join("") + "</select></label>" +
          '<label class="fld"><span class="k">Players, one per line: in-game name @discord</span><textarea name="players" rows="5">' + esc((d.players || []).map(p => p.ign + (p.discord ? " @" + p.discord : "")).join("\n")) + "</textarea></label>" +
          '<fieldset class="fld"><legend class="k">Linked accounts (logged-in players on this team)</legend><div class="checks">' +
            profiles.map(p => '<label><input type="checkbox" name="member" value="' + esc(p.id) + '"' + ((d.member_ids || []).includes(p.id) ? " checked" : "") + "> " + esc(UI.who(p)) + ' <span class="muted">@' + esc(p.username || "") + "</span></label>").join("") + "</div></fieldset>" +
          '<label class="fld"><span class="k">Order on the rosters page</span><input name="sort" type="number" min="0" max="99" value="' + esc(d.sort || 0) + '"></label>' +
          '<div class="row-btns"><button type="submit" class="btn">Save team</button>' + (S.teamDraft ? '<button type="button" class="btn ghost js-new-team">New team instead</button>' : "") + "</div></form></div>";
      body.innerHTML = head + '<section class="sheet dpanel wide-panel"><h2>Teams</h2>' + inner + "</section>";
      const f = $("#team-form");
      f.onsubmit = e => {
        e.preventDefault();
        const players = f.elements.players.value.split("\n").map(l => l.trim()).filter(Boolean).map(l => { const m = l.match(/^(.*?)\s+@(\S+)$/); return m ? { ign: m[1].trim(), discord: m[2] } : { ign: l }; });
        const t = { id: d.id, name: f.elements.name.value.trim(), coach_id: f.elements.coach_id.value || null, players, member_ids: $$('input[name="member"]:checked', f).map(i => i.value), sort: +f.elements.sort.value || 0, signup_id: d.signup_id || null };
        UI.act(f.querySelector('[type="submit"]'), async () => { await API.saveTeam(t); S.teamDraft = null; await render(); }, "Team saved. It shows on the rosters page.");
      };
      body.onclick = e => {
        if (stabClick(e)) return;
        const ed = e.target.closest(".js-edit-team"), del = e.target.closest(".js-del-team"), nw = e.target.closest(".js-new-team");
        if (ed) { S.teamDraft = Object.assign({}, teams.find(t => t.id === ed.dataset.id)); render(); }
        if (nw) { S.teamDraft = null; render(); }
        if (del) UI.act(del, async () => { await API.deleteTeam(del.dataset.id); if (S.teamDraft && S.teamDraft.id === del.dataset.id) S.teamDraft = null; await render(); }, "Team deleted.");
      };
      return;
    }

    if (S.staffTab === "coaches") {
      inner = '<p class="muted">Link each slot to the mentor\'s Discord account once they\'ve logged in here. Linked coaches get the calendar on their desk.</p><div class="tbl"><table><thead><tr><th>Slot</th><th>Name</th><th>Team / focus</th><th>Discord account</th><th></th></tr></thead><tbody>' +
        coaches.map(c => '<tr data-id="' + esc(c.id) + '"><td><b>' + (c.kind === "assistant" ? "A" : "M") + pad(c.slot) + '</b><div class="small muted">' + esc(c.badge_id) + "</div></td>" +
          '<td><input class="cell-in" name="name" maxlength="40" value="' + esc(c.name || "") + '" aria-label="Name"></td>' +
          '<td><input class="cell-in" name="' + (c.kind === "mentor" ? "team_name" : "focus") + '" maxlength="40" value="' + esc((c.kind === "mentor" ? c.team_name : c.focus) || "") + '" aria-label="Team or focus"></td>' +
          '<td><select class="cell-in" name="profile_id" aria-label="Discord account"><option value="">Not linked</option>' + profiles.map(p => '<option value="' + esc(p.id) + '"' + (p.id === c.profile_id ? " selected" : "") + ">" + esc(UI.who(p)) + " @" + esc(p.username || "") + "</option>").join("") + "</select></td>" +
          '<td><button type="button" class="btn ghost js-save-coach">Save</button></td></tr>').join("") + "</tbody></table></div>";
      body.innerHTML = head + '<section class="sheet dpanel wide-panel"><h2>Coaches</h2>' + inner + "</section>";
      body.onclick = e => {
        if (stabClick(e)) return;
        const b = e.target.closest(".js-save-coach");
        if (!b) return;
        const tr = b.closest("tr"), patch = {};
        $$(".cell-in", tr).forEach(i => { patch[i.name] = i.name === "profile_id" ? (i.value || null) : i.value.trim(); });
        UI.act(b, async () => { await API.updateCoach(tr.dataset.id, patch); await boot(); }, "Coach saved.");
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

    // sessions
    const all = await API.allRequests();
    const now = new Date();
    const up = all.filter(r => new Date(r.ends_at) > now && r.status !== "cancelled" && r.status !== "declined");
    inner = '<p class="muted">Every upcoming request across all coaches. Times in your time zone (' + esc(UI.tz) + ").</p>" +
      (up.length ? '<div class="tbl"><table><thead><tr><th>When</th><th>Coach</th><th>Player</th><th>Session</th><th>Status</th></tr></thead><tbody>' +
        up.map(r => "<tr><td>" + esc(UI.range(r.starts_at, r.ends_at)) + "</td><td>" + esc(UI.bare(UI.coachName(r.coach))) + "</td><td>" + esc(UI.who(r.requester)) + "</td><td>" + (r.kind === "team" ? "Team review" : "Individual") + "</td><td>" + UI.statusChip(r.status) + "</td></tr>").join("") + "</tbody></table></div>"
        : '<p class="empty-note">No upcoming sessions yet.</p>');
    body.innerHTML = head + '<section class="sheet dpanel wide-panel"><h2>Sessions</h2>' + inner + "</section>";
    body.onclick = e => { stabClick(e); };
    void pName;
  }

  function stabClick(e) {
    const s = e.target.closest(".stab");
    if (!s) return false;
    S.staffTab = s.dataset.sub;
    render();
    return true;
  }
})();
