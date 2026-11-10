/* Path to Glory · Team stats (desk → Staff → Team stats).
   Teams → one team's page (sessions by coach, its players, every session) → one player's page
   (who they signed up with, their sessions, their time on each part of the site).
   Sessions come from the requests table; time on the site from track.js rows saved with the
   player's account (supabase/player-stats.sql), which only exist from Nov 10 on. */
(function () {
  "use strict";
  const esc = UI.esc;

  const css = document.createElement("style");
  css.textContent =
    ".ts-back{background:none;border:0;padding:0;margin:0 0 10px;font:600 12px/1 var(--f-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-soft);cursor:pointer}" +
    ".ts-back:hover{color:var(--red)}" +
    ".ts-teams{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin-top:12px}" +
    ".ts-team{display:block;text-align:left;background:#fbfbf8;border:1px solid rgba(0,0,0,.12);border-left:4px solid var(--red);padding:12px 14px;cursor:pointer;font:inherit;color:var(--ink)}" +
    ".ts-team:hover{border-color:rgba(0,0,0,.3);border-left-color:var(--red)}" +
    ".ts-team b{display:block;font:800 17px/1.15 var(--f-display);text-transform:uppercase}" +
    ".ts-team span{display:block;font:500 12px/1.5 var(--f-mono);color:var(--ink-soft)}" +
    ".ts-tbl{width:100%;border-collapse:collapse;font:500 13px/1.3 var(--f-display);color:var(--ink)}" +
    ".ts-tbl th{text-align:left;font:600 11px/1 var(--f-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-soft);padding:6px 8px;border-bottom:1px solid rgba(0,0,0,.2)}" +
    ".ts-tbl td{padding:7px 8px;border-bottom:1px solid rgba(0,0,0,.08);vertical-align:top}" +
    ".ts-tbl td.n,.ts-tbl th.n{text-align:right;font-family:var(--f-mono);white-space:nowrap}" +
    ".ts-tbl tr.js-ts-player{cursor:pointer}.ts-tbl tr.js-ts-player:hover td{background:rgba(0,0,0,.04)}" +
    ".ts-tbl tr.js-ts-player td:first-child b{text-decoration:underline;text-decoration-color:rgba(0,0,0,.25);text-underline-offset:3px}" +
    ".ts-scroll{overflow-x:auto}" +
    ".ts-who{display:flex;align-items:center;gap:8px}" +
    ".ts-muted{color:var(--ink-soft)}" +
    ".ts-head{display:flex;align-items:center;gap:12px;margin:2px 0 4px}.ts-head h3{margin:0;font:800 26px/1.1 var(--f-display);text-transform:uppercase}";
  document.head.appendChild(css);

  const hrs = s => { const h = s / 3600; return (Math.round(h * 10) / 10) + " h"; };
  const len = r => (new Date(r.ends_at) - new Date(r.starts_at)) / 1000;
  const coachLabel = c => c ? UI.bare(UI.coachName(c)) : "Unknown coach";
  const seen = iso => iso ? UI.date(iso) + " · " + UI.time(iso) : "Not yet";
  const tile = (label, value) => '<div class="ss-tile"><b>' + esc(value) + "</b><span>" + esc(label) + "</span></div>";
  const box = (title, note, inner, wide) => '<div class="ss-box"' + (wide ? ' style="grid-column:1/-1"' : "") + "><h3>" + esc(title) + "</h3>" + (note ? '<p class="ss-note">' + esc(note) + "</p>" : "") + inner + "</div>";
  const bars = (list, valueOf, label, note) => {
    const max = Math.max(1, ...list.map(valueOf));
    return list.length ? list.map(x => '<div class="ss-row"><span class="l" title="' + esc(x.name) + '">' + esc(x.name) + '</span><span class="bar"><i style="width:' + (100 * valueOf(x) / max).toFixed(1) + '%"></i></span><span class="n">' + esc(label(x)) + "</span></div>").join("")
      : '<p class="ss-note">' + esc(note || "Nothing yet.") + "</p>";
  };
  const kindLabel = r => r.kind === "team" ? "Team review" : "Individual";

  // which team a session belongs to: the player's team, or the mentor's own team for a team review they wrote down
  function teamOf(r, teams) {
    const t = teams.find(x => (x.member_ids || []).includes(r.requester_id));
    if (t) return t;
    if (r.by_coach && r.kind === "team") return teams.find(x => x.coach_id === r.coach_id) || null;
    return null;
  }

  // one table of sessions
  function sessionTable(list, coaches, profiles, opts) {
    if (!list.length) return '<p class="ss-note">' + esc((opts && opts.none) || "No sessions yet.") + "</p>";
    const prof = id => profiles.find(p => p.id === id);
    return '<div class="ts-scroll"><table class="ts-tbl"><thead><tr><th>When</th><th>Coach</th><th>Type</th>' + (opts && opts.who ? "<th>Asked by</th>" : "") + '<th>Status</th><th class="n">Length</th></tr></thead><tbody>' +
      list.map(r => {
        const by = r.by_coach ? "Written by the coach" : UI.who(r.requester || prof(r.requester_id));
        return "<tr><td>" + esc(UI.range(r.starts_at, r.ends_at)) + "</td><td>" + esc(coachLabel(coaches.find(c => c.id === r.coach_id))) + "</td><td>" + kindLabel(r) + "</td>" +
          (opts && opts.who ? "<td>" + esc(by) + "</td>" : "") + "<td>" + UI.statusChip(UI.shown(r)) + '</td><td class="n">' + esc(hrs(len(r))) + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }

  // sessions grouped by coach: booked, waiting, hours booked
  function byCoach(list, coaches) {
    const m = {};
    list.forEach(r => {
      const g = m[r.coach_id] = m[r.coach_id] || { coach: coaches.find(c => c.id === r.coach_id), booked: 0, waiting: 0, other: 0, secs: 0 };
      const st = UI.shown(r);
      if (st === "accepted" || st === "done") { g.booked++; g.secs += len(r); }
      else if (st === "pending") g.waiting++;
      else g.other++;
    });
    const rows = Object.values(m).sort((a, b) => b.booked - a.booked || b.waiting - a.waiting);
    if (!rows.length) return '<p class="ss-note">No sessions with any coach yet.</p>';
    return '<div class="ts-scroll"><table class="ts-tbl"><thead><tr><th>Coach</th><th class="n">Booked</th><th class="n">Waiting</th><th class="n">Declined or cancelled</th><th class="n">Hours booked</th></tr></thead><tbody>' +
      rows.map(g => "<tr><td><b>" + esc(coachLabel(g.coach)) + '</b><div class="small ts-muted">' + esc(g.coach ? (g.coach.kind === "assistant" ? "Assistant coach" : "Mentor") : "") + '</div></td><td class="n">' + g.booked + '</td><td class="n">' + g.waiting + '</td><td class="n">' + g.other + '</td><td class="n">' + esc(hrs(g.secs)) + "</td></tr>").join("") +
      "</tbody></table></div>";
  }

  const counts = list => {
    const st = list.map(r => UI.shown(r));
    return { booked: st.filter(s => s === "accepted" || s === "done").length, waiting: st.filter(s => s === "pending").length,
      secs: list.filter(r => ["accepted", "done"].includes(UI.shown(r))).reduce((a, r) => a + len(r), 0) };
  };
  const NOTE_TIME = "Time on the site is counted from Nov 10, and only while the player is logged in.";

  /* ---- the list of teams ---- */
  function teamsView(d) {
    return '<section class="sheet dpanel wide-panel"><h2>Team stats</h2><p class="muted">Pick a team to see the sessions it has booked, which coaches they\'re with, and each player\'s activity. ' + NOTE_TIME + "</p>" +
      '<div class="ts-teams">' + d.teams.map(t => {
        const list = d.requests.filter(r => teamOf(r, d.teams) === t), c = counts(list);
        const secs = (t.member_ids || []).reduce((a, id) => a + ((d.players.find(p => p.profile_id === id) || {}).seconds || 0), 0);
        return '<button type="button" class="ts-team js-ts-team" data-id="' + esc(t.id) + '"><b>' + esc(t.name) + "</b>" +
          "<span>" + c.booked + " booked · " + c.waiting + " waiting</span>" +
          "<span>" + (t.member_ids || []).length + " of " + (t.players || []).length + " players logged in</span>" +
          "<span>" + esc(PTGStats.dur(secs)) + " on the site</span></button>";
      }).join("") + "</div></section>";
  }

  /* ---- one team ---- */
  function teamView(d, t) {
    const list = d.requests.filter(r => teamOf(r, d.teams) === t), c = counts(list);
    const mentor = d.coaches.find(x => x.id === t.coach_id);
    const members = (t.member_ids || []).map(id => d.profiles.find(p => p.id === id) || { id, display_name: "Unknown account" });
    const stat = id => d.players.find(p => p.profile_id === id) || {};
    const teamSecs = members.reduce((a, p) => a + (stat(p.id).seconds || 0), 0);
    const sections = {};
    members.forEach(p => (stat(p.id).sections || []).forEach(s => { sections[s.name] = (sections[s.name] || 0) + s.seconds; }));
    const secList = Object.entries(sections).map(([name, seconds]) => ({ name, seconds })).sort((a, b) => b.seconds - a.seconds);
    const notIn = (t.players || []).length - members.length;
    return '<section class="sheet dpanel wide-panel"><button type="button" class="ts-back js-ts-back">← All teams</button>' +
      '<div class="ts-head"><h3>' + esc(t.name) + '</h3></div><p class="muted">Mentor: <b>' + esc(coachLabel(mentor)) + "</b> · Players: " + esc((t.players || []).map(p => p.ign).join(", ") || "none listed") + "</p>" +
      '<div class="ss-tiles">' + tile("Sessions booked", c.booked) + tile("Waiting for an answer", c.waiting) + tile("Coaching hours booked", hrs(c.secs)) +
        tile("Players logged in", members.length + " of " + (t.players || []).length) + tile("Team time on the site", PTGStats.dur(teamSecs)) + "</div>" +
      '<div class="ss-grid">' +
        box("Sessions by coach", "Every coach this team has asked for or booked.", byCoach(list, d.coaches), true) +
        box("Players", "Click a player to see their own page." + (notIn > 0 ? " " + notIn + (notIn === 1 ? " player hasn't" : " players haven't") + " logged in yet, so they don't show here." : ""),
          members.length ? '<div class="ts-scroll"><table class="ts-tbl"><thead><tr><th>Player</th><th class="n">Sessions booked</th><th class="n">Waiting</th><th class="n">Time on site</th><th>Last seen</th></tr></thead><tbody>' +
            members.map(p => {
              const own = counts(d.requests.filter(r => r.requester_id === p.id && !r.by_coach)), s = stat(p.id);
              return '<tr class="js-ts-player" data-id="' + esc(p.id) + '" tabindex="0"><td><span class="ts-who">' + UI.avatar(p, 24) + "<b>" + esc(UI.who(p)) + '</b> <span class="small ts-muted">@' + esc(p.username || "") + '</span></span></td><td class="n">' + own.booked + '</td><td class="n">' + own.waiting + '</td><td class="n">' + esc(PTGStats.dur(s.seconds || 0)) + "</td><td>" + esc(seen(s.last_seen)) + "</td></tr>";
            }).join("") + "</tbody></table></div>"
          : '<p class="ss-note">Nobody on this team has logged in yet.</p>', true) +
        box("Where the team spends time", "Logged-in players only, since Nov 10.", bars(secList, x => x.seconds, x => PTGStats.dur(x.seconds), "No time recorded yet.")) +
        box("All sessions", "Newest first.", sessionTable(list.slice().sort((a, b) => (a.starts_at < b.starts_at ? 1 : -1)), d.coaches, d.profiles, { who: true }), true) +
      "</div></section>";
  }

  /* ---- one player ---- */
  function playerView(d, t, p) {
    const own = d.requests.filter(r => r.requester_id === p.id && !r.by_coach);
    const teamReviews = d.requests.filter(r => r.kind === "team" && teamOf(r, d.teams) === t && r.requester_id !== p.id);
    const c = counts(own), s = d.players.find(x => x.profile_id === p.id) || {};
    const days = (s.days || []).map(x => ({ name: new Date(x.day + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }), seconds: x.seconds }));
    return '<section class="sheet dpanel wide-panel"><button type="button" class="ts-back js-ts-team" data-id="' + esc(t.id) + '">← ' + esc(t.name) + "</button>" +
      '<div class="ts-head">' + UI.avatar(p, 40) + "<div><h3>" + esc(UI.who(p)) + '</h3><span class="small ts-muted">@' + esc(p.username || "") + " · " + esc(t.name) + "</span></div></div>" +
      '<div class="ss-tiles">' + tile("Sessions booked", c.booked) + tile("Waiting for an answer", c.waiting) + tile("Coaching hours booked", hrs(c.secs)) +
        tile("Visits while logged in", s.visits || 0) + tile("Time on the site", PTGStats.dur(s.seconds || 0)) + tile("Last seen", s.last_seen ? UI.date(s.last_seen) : "Not yet") + "</div>" +
      '<div class="ss-grid">' +
        box("Signed up with", "Their own requests and sessions, by coach.", byCoach(own, d.coaches), true) +
        box("Their sessions", "Newest first.", sessionTable(own.slice().sort((a, b) => (a.starts_at < b.starts_at ? 1 : -1)), d.coaches, d.profiles, { none: "They haven't asked for a session yet." }), true) +
        (teamReviews.length ? box("Team reviews for their team", "Asked for by a teammate or written by the mentor.", sessionTable(teamReviews.slice().sort((a, b) => (a.starts_at < b.starts_at ? 1 : -1)), d.coaches, d.profiles, { who: true }), true) : "") +
        box("Time on each part of the site", NOTE_TIME, bars(s.sections || [], x => x.seconds, x => PTGStats.dur(x.seconds), "No time recorded yet.")) +
        box("Time per day", "Eastern days.", bars(days, x => x.seconds, x => PTGStats.dur(x.seconds), "No time recorded yet.")) +
        box("Coaches they looked at", "Clicks on a coach's tab, card or file.", bars(s.coaches || [], x => x.n, x => String(x.n), "No coach clicks yet.")) +
        box("Characters they looked at", "Clicks on a character in a coach's pool.", bars(s.chars || [], x => x.n, x => String(x.n), "No character clicks yet.")) +
      "</div></section>";
  }

  // draws the tab; state lives in the desk (S.tsTeam, S.tsPlayer) so a refresh keeps the page you were on
  async function render(body, head, S, onTab, rerender) {
    let d;
    try {
      const [teams, profiles, coaches, requests, players] = await Promise.all([API.teams(), API.profiles(), API.coaches(), API.allRequests(), API.playerStats().catch(() => [])]);
      d = { teams, profiles, coaches, requests, players };
    } catch (e) {
      body.innerHTML = head + '<section class="sheet dpanel wide-panel"><h2>Team stats</h2><p class="empty-note">Could not load the numbers: ' + esc(e.message || String(e)) + "</p></section>";
      body.onclick = onTab;
      return;
    }
    const t = d.teams.find(x => x.id === S.tsTeam);
    const p = t && S.tsPlayer && (t.member_ids || []).includes(S.tsPlayer) ? (d.profiles.find(x => x.id === S.tsPlayer) || null) : null;
    body.innerHTML = head + (p ? playerView(d, t, p) : t ? teamView(d, t) : teamsView(d));
    const go = (team, player) => { S.tsTeam = team; S.tsPlayer = player; rerender().then(() => { const top = body.querySelector(".wide-panel"); if (top && top.getBoundingClientRect().top < 0) top.scrollIntoView({ block: "start" }); }); };
    body.onclick = e => {
      if (onTab(e)) return;
      if (e.target.closest(".js-ts-back")) return go(null, null);
      const tb = e.target.closest(".js-ts-team");
      if (tb) return go(tb.dataset.id, null);
      const pr = e.target.closest(".js-ts-player");
      if (pr) return go(S.tsTeam, pr.dataset.id);
    };
    body.onkeydown = e => {
      const pr = e.target.closest && e.target.closest(".js-ts-player");
      if (pr && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); go(S.tsTeam, pr.dataset.id); }
    };
  }

  window.PTGTeamStats = { render, teamOf };
})();
