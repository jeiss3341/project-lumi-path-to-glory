/* Path to Glory · Sponsor Stats (desk → Staff → Sponsor stats).
   PTGStats.compute(rows): adds up visit rows (from track.js) the same way supabase/schema.sql's sponsor_stats() does.
   PTGStats.sample():      made-up visits for demo mode, so the tab has something to show on the practice site.
   PTGStats.render(...):   draws the tab. */
(function () {
  "use strict";
  const ET = "America/New_York";
  const etParts = iso => {
    const p = {};
    new Intl.DateTimeFormat("en-CA", { timeZone: ET, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(iso)).forEach(x => { p[x.type] = x.value; });
    return { day: p.year + "-" + p.month + "-" + p.day, hour: +p.hour };
  };
  const REGION = { America: "Americas", Europe: "Europe", Asia: "Asia", Australia: "Oceania", Pacific: "Oceania", Africa: "Africa" };

  function compute(rows) {
    const visits = rows.filter(r => r.kind === "visit");
    const uniq = a => new Set(a).size;
    const sessOf = {};   // visitor -> sessions
    visits.forEach(r => { (sessOf[r.visitor] = sessOf[r.visitor] || new Set()).add(r.session); });
    const time = {};
    rows.filter(r => r.kind === "time").forEach(r => { time[r.session] = (time[r.session] || 0) + (r.ms || 0); });
    const tvals = Object.values(time);
    const group = (list, key, extra) => {
      const m = {};
      list.forEach(r => { const k = key(r); if (k === "" || k == null) return; const g = m[k] = m[k] || { name: k, n: 0, v: new Set(), ms: 0 }; g.n++; g.v.add(r.visitor); g.ms += r.ms || 0; });
      return Object.values(m).map(g => Object.assign({ name: g.name, n: g.n, visitors: g.v.size }, extra ? extra(g) : {})).sort((a, b) => b.n - a.n);
    };
    const top = k => group(rows.filter(r => r.kind === k), r => r.target || "").slice(0, 30);
    const days = {};
    visits.forEach(r => { const d = etParts(r.created_at).day; const g = days[d] = days[d] || { day: d, visits: 0, v: new Set() }; g.visits++; g.v.add(r.visitor); });
    const hours = Array.from({ length: 24 }, (_, h) => ({ h, visits: 0 }));
    visits.forEach(r => { hours[etParts(r.created_at).hour].visits++; });
    const firstVisit = {};
    visits.forEach(r => { if (!firstVisit[r.visitor] || r.created_at < firstVisit[r.visitor]) firstVisit[r.visitor] = r.created_at; });
    const byVisitor = (list, key) => group(Object.values(list.reduce((m, r) => { if (!m[r.visitor]) m[r.visitor] = r; return m; }, {})), key).map(g => ({ name: g.name, n: g.visitors }));
    return {
      visits: visits.length,
      visitors: uniq(visits.map(r => r.visitor)),
      returning: Object.values(sessOf).filter(s => s.size > 1).length,
      logged_in_visitors: uniq(visits.filter(r => r.logged_in).map(r => r.visitor)),
      avg_seconds: tvals.length ? Math.round(tvals.reduce((a, b) => a + b, 0) / tvals.length / 1000) : 0,
      total_hours: Math.round(tvals.reduce((a, b) => a + b, 0) / 36e4) / 10,
      total_seconds: Math.round(tvals.reduce((a, b) => a + b, 0) / 1000),
      bounce: tvals.length ? Math.round(100 * tvals.filter(x => x < 10000).length / tvals.length) : 0,
      days: Object.values(days).map(g => ({ day: g.day, visits: g.visits, visitors: g.v.size })).sort((a, b) => a.day < b.day ? -1 : 1),
      new_by_day: group(Object.entries(firstVisit).map(([v, t]) => ({ visitor: v, created_at: t })), r => etParts(r.created_at).day).map(g => ({ day: g.name, n: g.n })),
      hours,
      sections: group(rows.filter(r => r.kind === "section"), r => r.target, g => ({ seconds: Math.round(g.ms / 1000) })).sort((a, b) => b.seconds - a.seconds),
      coaches: top("coach"), chars: top("char"), discord: top("discord"), gcal: top("gcal"), requests: top("request"), flips: top("flip"),
      days_opened: top("day"), logins: rows.filter(r => r.kind === "login").length,
      pages: group(visits, r => r.target),
      sources: group(visits, r => r.source || "Direct"),
      devices: byVisitor(visits, r => r.device || "unknown"),
      regions: byVisitor(visits, r => REGION[(r.tz || "").split("/")[0]] || "Unknown"),
      zones: byVisitor(visits, r => (r.tz || "").split("/").pop().replace(/_/g, " ") || "Unknown").slice(0, 12)
    };
  }

  // ---- sample visits for demo mode (the same every time) ----
  function sample() {
    let seed = 20261109;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const pick = list => { let x = rnd() * list.reduce((a, b) => a + b[1], 0); for (const [v, w] of list) { if ((x -= w) <= 0) return v; } return list[0][0]; };
    const C = window.PTG || {}, coaches = (C.coachSeed || []).map(c => [c.name, c.kind === "mentor" ? 3 : 2]);
    const chars = [...new Set((C.coachSeed || []).flatMap(c => c.pool || []))].filter(n => n.length < 20).map(n => [n, 1]);
    const chans = (C.links || C.channels || []).map(l => [l.name, l.tag === "Main Hub" ? 4 : 1]);
    const events = (C.schedule || []).map(e => [e.title, e.kind === "final" || e.kind === "mock" ? 3 : 1]);
    const eventDays = new Set((C.schedule || []).map(e => e.date));
    const tzs = [["America/New_York", 30], ["America/Los_Angeles", 18], ["America/Chicago", 14], ["America/Toronto", 6], ["America/Denver", 4], ["Europe/London", 7], ["Europe/Berlin", 4], ["Asia/Seoul", 7], ["Asia/Manila", 5], ["Asia/Tokyo", 2], ["Australia/Sydney", 3]];
    const secs = [["Faculty", 34], ["Schedule", 18], ["Rosters", 14], ["Top of page", 12], ["Brief", 10], ["Field notes", 6], ["Channels", 4], ["Office hours", 6]];
    const rows = [], pool = [];
    const today = (window.UI && UI.todayYmd) ? UI.todayYmd() : new Date().toISOString().slice(0, 10);
    for (let d = new Date("2026-11-02T12:00:00Z"); d.toISOString().slice(0, 10) <= today && d.toISOString().slice(0, 10) <= "2026-11-22"; d = new Date(d.getTime() + 864e5)) {
      const ymd = d.toISOString().slice(0, 10), before = ymd < "2026-11-09";
      const n = Math.round((before ? 18 + rnd() * 20 : 55 + rnd() * 35) * (eventDays.has(ymd) ? 1.6 : 1));
      for (let i = 0; i < n; i++) {
        const back = pool.length && rnd() < 0.32, v = back ? pool[Math.floor(rnd() * pool.length)] : { id: "s" + rows.length, device: pick([["phone", 55], ["computer", 40], ["tablet", 5]]), tz: pick(tzs) };
        if (!back) pool.push(v);
        const h = Math.floor(pick([[9, 1], [12, 2], [15, 3], [18, 5], [20, 6], [22, 4], [0, 2]]) + rnd() * 2) % 24;
        const t = new Date(Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10), h + 5, Math.floor(rnd() * 60))).toISOString();
        const sess = "ss" + rows.length, base = { visitor: v.id, session: sess, device: v.device, tz: v.tz, logged_in: !before && rnd() < 0.25, created_at: t };
        const add = r => rows.push(Object.assign({}, base, r));
        add({ kind: "visit", target: rnd() < 0.9 ? "Home" : "Office hours", source: pick([["Discord", 55], ["Direct", 30], ["Google", 8], ["X / Twitter", 4], ["YouTube", 3]]) });
        const ms = rnd() < 0.18 ? Math.floor(2000 + rnd() * 7000) : Math.floor(25000 + Math.pow(rnd(), 2) * 480000);
        add({ kind: "time", ms });
        let left = ms;
        for (let k = 0; k < 4 && left > 1000; k++) { const part = k === 3 ? left : Math.floor(left * (0.3 + rnd() * 0.5)); add({ kind: "section", target: pick(secs), ms: part }); left -= part; }
        if (ms > 20000) {
          const clicks = Math.floor(rnd() * 5);
          for (let k = 0; k < clicks; k++) add({ kind: "coach", target: pick(coaches) });
          if (rnd() < 0.35 && chars.length) add({ kind: "char", target: pick(chars) });
          if (rnd() < 0.2) add({ kind: "flip", target: pick(coaches.filter(c => c[1] === 3)) });
          if (rnd() < 0.12 && chans.length) add({ kind: "discord", target: pick(chans) });
          if (rnd() < 0.06 && events.length) add({ kind: "gcal", target: pick(events) });
          if (rnd() < 0.3) add({ kind: "day", target: pick([...eventDays].map(x => [x, 1])) });
          if (!before && rnd() < 0.08) add({ kind: "request", target: pick(coaches) });
          if (rnd() < 0.05) add({ kind: "login", target: "Home" });
        }
      }
    }
    return rows;
  }

  // ---- the tab ----
  const css = document.createElement("style");
  css.textContent =
    ".ss-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:14px 0 6px}" +
    ".ss-tile{background:#fbfbf8;border:1px solid rgba(0,0,0,.12);padding:12px 14px}" +
    ".ss-tile b{display:block;font:800 26px/1.1 var(--f-display);color:var(--ink)}" +
    ".ss-tile span{font:500 12px/1.35 var(--f-mono);color:var(--ink-soft)}" +
    ".ss-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-top:14px}" +
    ".ss-box{background:#fbfbf8;border:1px solid rgba(0,0,0,.12);padding:12px 14px;min-width:0}" +
    ".ss-box h3{margin:0 0 4px;font:700 15px/1.2 var(--f-display);color:var(--ink)}" +
    ".ss-box p.ss-note{margin:0 0 8px;font:500 12px/1.4 var(--f-mono);color:var(--ink-soft)}" +
    ".ss-row{display:grid;grid-template-columns:minmax(0,9em) 1fr auto;gap:8px;align-items:center;margin:5px 0;font:500 13px/1.2 var(--f-display);color:var(--ink)}" +
    ".ss-row .l{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
    ".ss-row .bar{height:9px;background:rgba(0,0,0,.08)}.ss-row .bar i{display:block;height:100%;background:var(--red)}" +
    ".ss-row .n{font:600 12px/1 var(--f-mono);color:var(--ink-soft);text-align:right;min-width:3.5em}" +
    ".ss-days{display:flex;align-items:flex-end;gap:3px;height:150px;margin:6px 0 4px;padding-bottom:18px;position:relative}" +
    ".ss-days div{flex:1;position:relative;background:var(--red);min-width:4px}" +
    ".ss-days div.ev{background:var(--ink)}" +
    ".ss-days div span{position:absolute;bottom:-17px;left:50%;transform:translateX(-50%);font:500 9px/1 var(--f-mono);color:var(--ink-soft);white-space:nowrap}" +
    ".ss-hours{display:flex;align-items:flex-end;gap:2px;height:80px}.ss-hours i{flex:1;background:var(--red);min-height:1px}" +
    ".ss-hl{display:flex;justify-content:space-between;font:500 10px/1 var(--f-mono);color:var(--ink-soft);margin-top:3px}" +
    ".ss-top{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between}" +
    ".ss-sample{display:inline-block;background:#f2c94c;color:#2a2108;font:600 11px/1 var(--f-mono);padding:5px 8px;letter-spacing:.06em;text-transform:uppercase}" +
    ".ss-copy{white-space:pre-wrap;font:500 12px/1.5 var(--f-mono);background:#fbfbf8;border:1px dashed rgba(0,0,0,.25);padding:12px;margin-top:10px;max-height:260px;overflow:auto}";
  document.head.appendChild(css);

  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = n => Number(n || 0).toLocaleString("en-US");
  const dur = s => s >= 3600 ? (s / 3600).toFixed(1) + " h" : s >= 60 ? Math.floor(s / 60) + "m " + (s % 60) + "s" : s + "s";
  // total time watched: minutes while it's small (hours rounded to one decimal showed "0 h"); older databases only send hours
  const totalTime = s => s.total_seconds != null ? dur(s.total_seconds) : num(s.total_hours) + " h";
  const shortDay = ymd => new Date(ymd + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const bars = (list, valueOf, label, note) => {
    const max = Math.max(1, ...list.map(valueOf));
    return list.length ? list.map(x => '<div class="ss-row"><span class="l" title="' + esc(x.name) + '">' + esc(x.name) + '</span><span class="bar"><i style="width:' + (100 * valueOf(x) / max).toFixed(1) + '%"></i></span><span class="n">' + esc(label(x)) + "</span></div>").join("")
      : '<p class="ss-note">' + esc(note || "Nothing yet.") + "</p>";
  };
  const box = (title, note, inner) => '<div class="ss-box"><h3>' + esc(title) + "</h3>" + (note ? '<p class="ss-note">' + esc(note) + "</p>" : "") + inner + "</div>";

  function summary(s) {
    const top = (l, k = 3) => l.slice(0, k).map(x => x.name).join(", ") || "n/a";
    const days = s.days.slice().sort((a, b) => b.visits - a.visits)[0];
    const P = s.participation || {};
    return [
      "PATH TO GLORY · SITE STATS" + (s.sample ? " (SAMPLE NUMBERS)" : ""),
      "",
      "Reach",
      "- " + num(s.visits) + " visits from " + num(s.visitors) + " unique visitors (" + num(s.returning) + " came back more than once)",
      "- Busiest day: " + (days ? shortDay(days.day) + " (" + num(days.visits) + " visits)" : "n/a"),
      "- Top sources: " + top(s.sources),
      "- Regions: " + s.regions.map(r => r.name + " " + Math.round(100 * r.n / Math.max(1, s.visitors)) + "%").join(", "),
      "",
      "Engagement",
      "- Average time on site: " + dur(s.avg_seconds) + " · " + totalTime(s) + " watched in total (time tracking began Nov 10)",
      "- Most-viewed sections (since Nov 10): " + top(s.sections),
      "- Most-clicked coaches: " + top(s.coaches),
      "- Discord invite clicks: " + num(s.discord.reduce((a, b) => a + b.n, 0)) + " · calendar adds: " + num(s.gcal.reduce((a, b) => a + b.n, 0)),
      "",
      "Participation",
      "- " + num(P.accounts) + " accounts logged in · " + num(P.players) + " players on teams · " + num(P.coaches_linked) + " coaches",
      "- " + num(P.requested) + " session requests · " + num(P.booked) + " sessions booked · " + num(P.coach_hours) + " coach hours offered"
    ].join("\n");
  }

  function render(body, head, s) {
    const P = s.participation || {};
    const evDays = new Set(((window.PTG || {}).schedule || []).map(e => e.date));
    const maxDay = Math.max(1, ...s.days.map(d => d.visits)), maxH = Math.max(1, ...s.hours.map(h => h.visits));
    const sum = l => l.reduce((a, b) => a + b.n, 0);
    const pct = (n, of) => of ? Math.round(100 * n / of) + "%" : "0%";
    body.innerHTML = head + '<section class="sheet dpanel wide-panel"><div class="ss-top"><h2>Sponsor stats</h2><span>' +
      (s.sample ? '<span class="ss-sample">Demo · sample numbers</span> ' : "") +
      '<button type="button" class="btn ghost js-ss-refresh">Refresh</button> <button type="button" class="btn js-ss-copy">Copy summary for sponsors</button></span></div>' +
      '<p class="muted">Counted anonymously on every visit: no names or Discord accounts are stored. Times are Eastern.</p>' +
      '<div class="ss-tiles">' +
        [["Visits", num(s.visits)], ["Unique visitors", num(s.visitors)], ["Came back", num(s.returning) + " · " + pct(s.returning, s.visitors)],
         ["Avg time on site · since Nov 10", dur(s.avg_seconds)], ["Total time watched · since Nov 10", totalTime(s)], ["Left within 10 s · since Nov 10", s.bounce + "%"],
         ["Logged-in visitors", num(s.logged_in_visitors)], ["Discord invite clicks", num(sum(s.discord))], ["Calendar adds", num(sum(s.gcal))],
         ["Session requests", num(P.requested)], ["Sessions booked", num(P.booked)], ["Coach hours offered", num(P.coach_hours)]]
          .map(([l, v]) => '<div class="ss-tile"><b>' + esc(v) + "</b><span>" + esc(l) + "</span></div>").join("") + "</div>" +
      '<div class="ss-grid">' +
        '<div class="ss-box" style="grid-column:1/-1"><h3>Visits per day</h3><p class="ss-note">Black bars are event days (scrims and checkpoints).</p><div class="ss-days">' +
          (s.days.map(d => '<div class="' + (evDays.has(d.day) ? "ev" : "") + '" style="height:' + (100 * d.visits / maxDay).toFixed(1) + '%" title="' + esc(shortDay(d.day) + ": " + d.visits + " visits, " + d.visitors + " visitors") + '"><span>' + esc(shortDay(d.day).replace(/^\w+ /, "")) + "</span></div>").join("") || "") + "</div></div>" +
        box("Where people spend time", "Total time on each part of the page, counted since Nov 10", bars(s.sections, x => x.seconds, x => dur(x.seconds))) +
        box("Busiest hours (Eastern)", "", '<div class="ss-hours">' + s.hours.map(h => '<i style="height:' + (100 * h.visits / maxH).toFixed(1) + '%" title="' + h.h + ":00 · " + h.visits + ' visits"></i>').join("") + '</div><div class="ss-hl"><span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>11 PM</span></div>') +
        box("Most-clicked coaches", "Mentor tabs and assistant cards", bars(s.coaches.slice(0, 17), x => x.n, x => num(x.n))) +
        box("Characters clicked", "In mentors' character pools", bars(s.chars.slice(0, 12), x => x.n, x => num(x.n))) +
        box("Mentor files flipped", "", bars(s.flips.slice(0, 8), x => x.n, x => num(x.n))) +
        box("Request buttons clicked", "", bars(s.requests.slice(0, 12), x => x.n, x => num(x.n))) +
        box("Where visitors came from", "", bars(s.sources, x => x.n, x => num(x.n) + " · " + pct(x.n, s.visits))) +
        box("Devices", "Unique visitors", bars(s.devices, x => x.n, x => pct(x.n, s.visitors))) +
        box("Regions", "From each visitor's time zone", bars(s.regions, x => x.n, x => pct(x.n, s.visitors))) +
        box("Top time zones", "", bars(s.zones, x => x.n, x => num(x.n))) +
        box("Discord invites clicked", "", bars(s.discord, x => x.n, x => num(x.n))) +
        box("Calendar adds", "Add to Google Calendar", bars(s.gcal, x => x.n, x => num(x.n))) +
        box("Schedule days opened", "", bars(s.days_opened.slice(0, 10).map(x => Object.assign({}, x, { name: shortDay(x.name) })), x => x.n, x => num(x.n))) +
        box("Pages", "", bars(s.pages, x => x.n, x => num(x.n))) +
        box("Participation", "From logins, teams and bookings", bars([
          { name: "Accounts", n: P.accounts }, { name: "Staff", n: P.staff }, { name: "Players on teams", n: P.players }, { name: "Coaches linked", n: P.coaches_linked },
          { name: "Requests", n: P.requested }, { name: "Booked", n: P.booked }, { name: "Login clicks", n: s.logins }], x => x.n || 0, x => num(x.n))) +
      "</div>" +
      '<div class="ss-copy" hidden></div></section>';
  }

  window.PTGStats = { compute, sample, render, summary };
})();
