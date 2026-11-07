/* Path to Glory · desk (desk.html): player file, mentor calendar, staff tools. */
(function () {
  "use strict";
  const { $, $$, esc, pad } = UI;
  const S = { me: null, coaches: [], myCoach: null, tab: null, staffTab: "teams", teamOpen: null, coachEdit: null };
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
    const roles = S.isPlayer ? ['<span class="rchip">Player</span>'] : [];
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
    const [reqs, teams] = await Promise.all([API.myRequests().catch(() => []), API.teams().catch(() => [])]);
    const team = teams.find(t => (t.member_ids || []).includes(S.me.id));
    const coach = team && S.coaches.find(c => c.id === team.coach_id);
    const now = new Date();
    const upcoming = reqs.filter(r => new Date(r.ends_at) > now);
    const past = reqs.filter(r => new Date(r.ends_at) <= now);
    body.innerHTML =
      '<section class="sheet dpanel wide-panel"><h2>Your team</h2>' +
        (team ? '<p class="big-name">' + esc(team.name) + '</p><p>Mentor: <b>' + esc(coach ? UI.coachName(coach) : "To be assigned") + "</b></p>" +
          '<ul class="plain">' + (team.players || []).map(p => "<li>" + esc(p.ign) + (p.discord ? ' <span class="muted">@' + esc(p.discord) + "</span>" : "") + "</li>").join("") + "</ul>" +
          (coach ? '<a class="btn" href="index.html?coach=' + encodeURIComponent(coach.id) + '#book">Request a session with ' + esc(UI.bare(UI.coachName(coach))) + "</a>" : "")
          : "<p>You're not on a team for this event.</p>") +
      "</section>" +
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
    const pending = reqs.filter(r => r.status === "pending" && new Date(r.starts_at) > now);
    const upcoming = reqs.filter(r => r.status === "accepted" && new Date(r.ends_at) > now);
    // another waiting request at the same time (accepting one declines the other)
    const T = iso => new Date(iso).getTime();
    const overlaps = r => pending.some(x => x.id !== r.id && T(x.starts_at) < T(r.ends_at) && T(r.starts_at) < T(x.ends_at));

    const slip = r => '<article class="slip">' +
      '<div class="slip-top">' + UI.avatar(r.requester, 30) + "<div><b>" + esc(UI.who(r.requester)) + '</b><span class="muted">@' + esc((r.requester && r.requester.username) || "") + "</span></div>" +
        (onTeam(r) ? '<span class="rchip green">Your team</span>' : '<span class="rchip">Other team</span>') + "</div>" +
      '<p class="slip-when">' + esc(UI.date(r.starts_at, { weekday: "long", month: "short", day: "numeric" })) + "<br><b>" + esc(UI.time(r.starts_at)) + " → " + esc(UI.time(r.ends_at)) + "</b> · " + esc(UI.dur(r.starts_at, r.ends_at)) + "</p>" +
      '<p class="slip-kind">' + (r.kind === "team" ? "Team review" : "Individual session") + "</p>" +
      // its own line, so it never wraps halfway
      (overlaps(r) ? '<em class="cc-otag slip-flag">Overlaps · sent ' + UI.sentRank(r, pending).split(" ")[0] + "</em>" : "") +
      (r.note ? '<p class="slip-note">“' + esc(r.note) + "”</p>" : "") +
      // accepting or declining happens in the Details pop-up
      '<div class="slip-act"><button type="button" class="linkbtn js-open" data-id="' + esc(r.id) + '">Details ›</button></div></article>';

    body.innerHTML =
      '<section class="dpanel-flat"><div class="dp-head"><h2>Requests waiting <span class="count">' + pending.length + "</span></h2><span class=\"muted\">Times in your time zone (" + esc(UI.tz) + ")</span></div>" +
        (pending.length ? '<div class="slips">' + pending.map(slip).join("") + "</div>" : '<p class="empty-note on-dark">Nothing waiting. New requests show up here as players send them.</p>') + "</section>" +
      // the calendar (Hours | Sessions) lives in coachcal.js
      '<section class="sheet dpanel wide-panel" id="cc-panel"></section>' +
      '<section class="sheet dpanel wide-panel"><h2>Coming up</h2>' + (upcoming.length ? reqTable(upcoming, "coach") : '<p class="empty-note">No accepted sessions yet.</p>') + "</section>";
    PTGCoachCal.mount($("#cc-panel"), { coach: c, blocks, reqs, teams, rerender: render });

    // Requests waiting cards and Coming up (the calendar handles its own clicks)
    body.onclick = e => {
      const open = e.target.closest(".js-open");
      if (open) return PTGCoachCal.openReq(open.dataset.id, "*|pending");   // the list-and-details pop-up, with every waiting request
      // Cancel in Coming up: say what will happen first (UI.askRequest), then act
      const can = e.target.closest(".js-cancel-acc, .js-cancel"); if (!can) return;
      const r = reqs.find(x => x.id === can.dataset.id), t = r && teams.find(x => (x.member_ids || []).includes(r.requester_id));
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
    const sub = [["teams", "Teams"], ["coaches", "Coaches"], ["hours", "Hours"], ["requests", "Requests"], ["people", "People"]];
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
        coaches.map(c => '<tr data-id="' + esc(c.id) + '"' + (editing && editing.id === c.id ? ' class="on"' : "") + '><td><b>' + slotOf(c) + '</b><div class="small muted">' + esc(c.badge_id) + "</div></td>" +
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
