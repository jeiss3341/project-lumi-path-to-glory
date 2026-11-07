/* Path to Glory · shared UI helpers (both pages). */
(function () {
  "use strict";
  const C = window.PTG;
  const UI = {};
  const DAY = 864e5;

  UI.$ = (s, r) => (r || document).querySelector(s);
  UI.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  UI.esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  UI.pad = n => String(n).padStart(2, "0");
  // Show a value, or a [placeholder] when it's empty.
  UI.ph = (v, placeholder) => (v != null && String(v).trim()) ? UI.esc(v) : '<span class="ph">' + UI.esc(placeholder) + "</span>";

  /* ---------- time ----------
     The event runs on Eastern time. Each event day is an Eastern date, and coaches post hours
     from 8:00 AM to 4:00 AM the next morning, Eastern. Times are always shown to each viewer in
     their own time zone; only the day boundaries and the hours window are fixed to Eastern. */
  UI.EVENT_TZ = "America/New_York";
  UI.DAY_START = 8 * 60;    // 8:00 AM Eastern, minutes after midnight
  UI.DAY_END = 28 * 60;     // 4:00 AM Eastern the next morning
  UI.tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || "your time zone").replace(/_/g, " ");
  UI.ymd = d => d.getFullYear() + "-" + UI.pad(d.getMonth() + 1) + "-" + UI.pad(d.getDate());
  UI.time = iso => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  UI.date = (iso, o) => new Date(iso).toLocaleDateString("en-US", o || { weekday: "short", month: "short", day: "numeric" });
  UI.range = (a, b) => UI.date(a) + " · " + UI.time(a) + "–" + UI.time(b);
  const tzParts = (d, tz) => {
    const p = {};
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(d).forEach(x => { p[x.type] = x.value; });
    return p;
  };
  // minutes a time zone is ahead of UTC at that moment (Eastern in November: -300)
  const tzOffset = (d, tz) => { const p = tzParts(d, tz); return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) - Math.floor(d.getTime() / 6e4) * 6e4) / 6e4); };
  // the moment `mins` minutes after midnight Eastern on `ymd` (past 1440 runs into the next morning)
  UI.etAt = (ymd, mins) => {
    const [y, m, d] = ymd.split("-").map(Number);
    const guess = Date.UTC(y, m - 1, d, 0, mins);
    let t = guess - tzOffset(new Date(guess), UI.EVENT_TZ) * 6e4;
    t = guess - tzOffset(new Date(t), UI.EVENT_TZ) * 6e4;   // second pass settles daylight-saving edges
    return new Date(t);
  };
  UI.etYmd = d => { const p = tzParts(d, UI.EVENT_TZ); return p.year + "-" + p.month + "-" + p.day; };
  // the event day a moment belongs to: a day runs 4:00 AM to 4:00 AM Eastern, so 1 AM belongs to the evening before
  UI.dayOf = iso => UI.etYmd(new Date(new Date(iso).getTime() - (UI.DAY_END - 1440) * 6e4));
  // is the viewer on Eastern time right now (any zone that matches it, e.g. Toronto)?
  UI.onEastern = (d = new Date()) => d.getTimezoneOffset() === -tzOffset(d, UI.EVENT_TZ);
  // an Eastern time for a picker, plus the viewer's own time when they're elsewhere
  UI.etLabel = (ymd, mins) => {
    const d = UI.etAt(ymd, mins);
    const et = d.toLocaleTimeString("en-US", { timeZone: UI.EVENT_TZ, hour: "numeric", minute: "2-digit" });
    return UI.onEastern(d) ? et : et + " ET · " + UI.time(d) + " yours";
  };
  UI.dur = (a, b) => { const m = Math.round((new Date(b) - new Date(a)) / 6e4); return m % 60 ? (m >= 60 ? Math.floor(m / 60) + " h " : "") + (m % 60) + " min" : (m / 60) + (m === 60 ? " hour" : " hours"); };
  UI.eventDays = () => {
    const s = new Date(C.event.start + "T12:00:00"), out = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(s.getTime() + i * DAY);
      out.push({ ymd: UI.ymd(d), d, n: d.getDate(), dow: d.toLocaleDateString("en-US", { weekday: "short" }), week: i < 7 ? 1 : 2, events: C.schedule.filter(e => e.date === UI.ymd(d)) });
    }
    return out;
  };
  // ?today=2026-11-18 previews the site as of that date (testing only)
  const FAKE = (location.search.match(/[?&]today=(\d{4}-\d\d-\d\d)/) || [])[1];
  // today's event day (Eastern, rolling over at 4 AM)
  UI.todayYmd = () => FAKE || UI.dayOf(new Date());
  const dayNum = ymd => { const [y, m, d] = ymd.split("-").map(Number); return Math.round(Date.UTC(y, m - 1, d) / DAY); };
  UI.status = () => {
    const t = dayNum(UI.todayYmd()), s = dayNum(C.event.start), e = dayNum(C.event.end);
    if (t < s) return { phase: "before", days: s - t };
    if (t > e) return { phase: "after" };
    return { phase: "live", day: t - s + 1 };
  };
  UI.gcal = ev => {
    const next = new Date(new Date(ev.date + "T12:00:00").getTime() + DAY);
    const p = new URLSearchParams({ action: "TEMPLATE", text: "Path to Glory · " + ev.title, dates: ev.date.replace(/-/g, "") + "/" + UI.ymd(next).replace(/-/g, ""), details: ev.note });
    return "https://calendar.google.com/calendar/render?" + p.toString();
  };

  /* ---------- people & coaches ---------- */
  UI.who = p => p ? (p.display_name || p.username || "Player") : "Someone";
  UI.avatar = (p, size) => {
    size = size || 28;
    const name = UI.who(p);
    if (p && p.avatar_url) return '<img class="av" src="' + UI.esc(p.avatar_url) + '" alt="" width="' + size + '" height="' + size + '" referrerpolicy="no-referrer">';
    return '<span class="av av-ph" style="width:' + size + "px;height:" + size + "px;font-size:" + Math.round(size * 0.42) + 'px" aria-hidden="true">' + UI.esc(name.trim().charAt(0).toUpperCase() || "?") + "</span>";
  };
  UI.coachName = c => c ? (c.name && c.name.trim() ? c.name : "[" + (c.kind === "assistant" ? "Assistant " : "Mentor ") + UI.pad(c.slot) + "]") : "[Coach]";
  UI.coachTeam = c => c && c.team_name && c.team_name.trim() ? c.team_name : (c && c.kind === "assistant" ? "Any team" : "[Team TBA]");
  const bare = s => String(s).replace(/^\[|\]$/g, "");
  UI.bare = bare;

  UI.barcode = function (seed, w, h) {
    w = w || 120; h = h || 28;
    let s = 7;
    for (const c of String(seed)) s = (s * 31 + c.charCodeAt(0)) >>> 0;
    const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
    let x = 0, r = "";
    while (x < w) { const bw = 1 + Math.floor(rnd() * 3); if (rnd() > 0.32) r += '<rect x="' + x + '" width="' + bw + '" height="' + h + '"/>'; x += bw + 1; }
    return '<svg class="barcode" viewBox="0 0 ' + w + " " + h + '" preserveAspectRatio="none" aria-hidden="true" fill="currentColor">' + r + "</svg>";
  };

  // Art for a coach's ID badge: a file from PTG.art, else the Katja crop from the poster, else a placeholder.
  UI.art = function (c, o) {
    const file = c && C.art && C.art[c.id];
    if (file) {
      // uploaded art sits on the same dark grid as the Katja poster crop (.art-grid in styles.css)
      return '<div class="ptg-art art-grid" style="position:relative;overflow:hidden;width:100%;height:100%;background-color:#141416">' +
        '<img src="' + UI.esc(file) + '" alt="' + UI.esc((c.display_skin || UI.coachName(c)) + " display art") + '" style="display:block;width:100%;height:100%;object-fit:cover;object-position:50% 18%"></div>';
    }
    if (c && c.display_skin === "Training Director Katja") {
      o = Object.assign({ w: 440, cx: 1388, cy: 688, rot: 21 }, o || {});
      const k = "100cqw / " + o.w;
      return '<div class="ptg-art" style="position:relative;overflow:hidden;container-type:inline-size;width:100%;height:100%;background:#141416">' +
        '<img src="poster.webp" alt="Training Director Katja display art" style="position:absolute;left:50%;top:50%;width:calc(1600 * ' + k + ');max-width:none;height:auto;transform-origin:0 0;' +
        "transform:rotate(" + o.rot + "deg) translate(calc(-" + o.cx + " * " + k + "), calc(-" + o.cy + " * " + k + '))"></div>';
    }
    const base = (c && C.skins[c.display_skin]) || (c && c.name) || "?";
    return '<div class="ph-art"><span class="L">' + UI.esc(base.charAt(0)) + '</span><span class="cap">Display art<br>' + UI.esc((c && c.display_skin) || "To be chosen") + "</span></div>";
  };
  UI.badge = function (c) {
    return '<div class="badge"><div class="b-strip"><span>FACULTY ACCESS · PATH TO GLORY</span></div><div class="b-body">' +
      '<div class="b-top"><span class="b-dash"><i></i><i></i><i></i></span><span>ID // 2026</span></div>' +
      '<div class="b-role">' + (c.kind === "assistant" ? "Assistant" : "Instructor") + "</div>" +
      '<div class="b-row"><span class="b-id">' + UI.esc(c.badge_id) + "</span>" + UI.barcode(c.badge_id, 92, 24) + "</div>" +
      '<div class="b-art">' + UI.art(c) + "</div>" +
      '<div class="b-name"><small>NAME</small><b>[' + UI.esc(bare(UI.coachName(c))) + "]</b></div>" +
      '<span class="b-team">' + UI.esc(bare(UI.coachTeam(c))) + "</span></div></div>";
  };

  /* ---------- feedback ---------- */
  UI.toast = function (msg, kind) {
    let box = UI.$("#toasts");
    if (!box) { box = document.createElement("div"); box.id = "toasts"; box.setAttribute("role", "status"); box.setAttribute("aria-live", "polite"); document.body.appendChild(box); }
    const t = document.createElement("div");
    t.className = "toast" + (kind === "bad" ? " bad" : "");
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 400); }, kind === "bad" ? 6000 : 3500);
  };
  // Run an async action from a button: disables it, reports errors.
  UI.act = async function (btn, fn, okMsg) {
    if (btn) btn.disabled = true;
    try { const r = await fn(); if (okMsg) UI.toast(okMsg); return r; }
    catch (e) { UI.toast(e.message || String(e), "bad"); return undefined; }
    finally { if (btn) btn.disabled = false; }
  };

  /* ---------- who asked first, when waiting requests overlap ---------- */
  const ms = iso => new Date(iso).getTime();
  // r plus the other waiting requests for the same coach at an overlapping time, earliest sent first ([] when r isn't waiting)
  UI.overlapGroup = (r, reqs) => !r || r.status !== "pending" ? [] : (reqs || []).filter(x => x.coach_id === r.coach_id && x.status === "pending" &&
    (x.id === r.id || (ms(x.starts_at) < ms(r.ends_at) && ms(r.starts_at) < ms(x.ends_at)))).sort((a, b) => ms(a.created_at) - ms(b.created_at));
  UI.ord = n => n + ((n % 100 > 10 && n % 100 < 14) ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th");
  // r's place in its overlap group: "1st of 2", or "" when nothing overlaps
  UI.sentRank = (r, reqs) => { const g = UI.overlapGroup(r, reqs); return g.length > 1 ? UI.ord(g.findIndex(x => x.id === r.id) + 1) + " of " + g.length : ""; };
  // how much earlier or later x was sent than r: "1 day earlier", "3 h later"
  UI.sentGap = (x, r) => {
    const d = ms(x.created_at) - ms(r.created_at), m = Math.round(Math.abs(d) / 6e4);
    const t = m < 60 ? Math.max(1, m) + " min" : m < 1380 ? Math.round(m / 60) + " h" : Math.round(m / 1440) + (Math.round(m / 1440) === 1 ? " day" : " days");   // 23 h and up reads as days
    return d === 0 ? "sent at the same time" : "sent " + t + (d < 0 ? " earlier" : " later");
  };
  // when a request was sent, in the viewer's time: "Sat, Nov 7 · 5:02 PM"
  UI.sentAt = iso => UI.date(iso, { weekday: "short", month: "short", day: "numeric" }) + " · " + UI.time(iso);

  /* ---------- "are you sure?" before Accept / Decline / Cancel session (staff and coaches) ----------
     o.r: the request (with .requester) · o.status: "accepted" | "declined" | "cancelled"
     o.coach: the coach's name when staff act for them, left out when coaches act themselves ("your calendar")
     o.team: the player's team name · o.reqs: the coach's requests, to list waiting ones that accepting declines
     Resolves true on "Yes, …"; false on Go back, Esc or a click outside. */
  UI.askRequest = o => new Promise(done => {
    const r = o.r, esc = UI.esc, me = !o.coach;
    const A = { accepted: ["Accept", "Accept this request?", "Yes, accept"], declined: ["Decline", "Decline this request?", "Yes, decline"],
      cancelled: ["Cancel session", "Cancel this session?", "Yes, cancel session"] }[o.status];
    if (!r || !A) return done(false);
    const et = iso => new Date(iso).toLocaleTimeString("en-US", { timeZone: UI.EVENT_TZ, hour: "numeric", minute: "2-digit" });
    const T = iso => new Date(iso).getTime();
    const name = esc(UI.who(r.requester)), coach = esc(o.coach || ""), what = r.kind === "team" ? "team review" : "individual session";
    const cal = me ? "your calendar" : coach + "'s calendar";
    const when = esc(UI.date(UI.etAt(UI.dayOf(r.starts_at), 720), { weekday: "long", month: "long", day: "numeric" })) + " · " + et(r.starts_at) + "–" + et(r.ends_at) + " ET" +
      (UI.onEastern(new Date(r.starts_at)) ? "" : '<br><span class="muted">Your time: ' + esc(UI.time(r.starts_at) + "–" + UI.time(r.ends_at)) + "</span>");
    // accepting books the time, so other waiting requests that overlap it are declined (the database does the same)
    const clash = o.status !== "accepted" ? [] : (o.reqs || []).filter(x => x.id !== r.id && x.coach_id === r.coach_id && x.status === "pending" && T(x.starts_at) < T(r.ends_at) && T(r.starts_at) < T(x.ends_at));
    const undo = "There's no undo. If this is a mistake, " + name + " has to send the request again.";
    const pts = {
      accepted: ["The " + what + " is booked. It shows as Accepted on " + name + "'s desk and on " + cal + ".",
        me ? "Make sure you can make it. " + name + " will plan around it." : coach + " isn't asked first, so check with them if you're not sure they can make it."],
      declined: [name + "'s request moves to Declined. They see it on their desk.", "The time stays open for other requests.", undo],
      cancelled: ["The session comes off " + cal + " and shows as Cancelled on " + name + "'s desk.", "The time opens up again for new requests.",
        "Let " + name + (me ? "" : " and " + coach) + " know on Discord too, so nobody shows up for it.", undo]
    }[o.status];
    let d = document.getElementById("ask-dlg");
    if (!d) { d = document.createElement("dialog"); d.id = "ask-dlg"; d.setAttribute("aria-labelledby", "ask-dlg-title"); document.body.appendChild(d); }
    if (d.open) d.close();
    d.innerHTML = '<div class="sc-dtop"><div><span class="k">' + A[0] + (me ? "" : " · " + coach) + '</span><h3 id="ask-dlg-title">' + A[1] + "</h3></div>" + UI.statusChip(r.status) + "</div>" +
      '<p class="sc-ask-who"><b>' + name + "</b>" + (o.team ? " · " + esc(o.team) : "") + "<br>" + what.charAt(0).toUpperCase() + what.slice(1) + (me ? "" : " with " + coach) + "<br>" + when + "</p>" +
      '<h4 class="sc-ask-k">What happens</h4><ul class="sc-ask">' + pts.map(p => "<li>" + p + "</li>").join("") + "</ul>" +
      (clash.length ? '<p class="sc-ask-warn">' + (clash.length === 1 ? "1 other waiting request overlaps this time and will be declined:" : clash.length + " other waiting requests overlap this time and will be declined:") + "</p>" +
        '<ul class="sc-ask warn">' + clash.map(x => "<li>" + esc(UI.who(x.requester)) + " · " + et(x.starts_at) + "–" + et(x.ends_at) + " ET · " + UI.sentGap(x, r) + "</li>").join("") + "</ul>" : "") +
      '<div class="sc-dact"><button type="button" class="btn' + (o.status === "accepted" ? "" : " cc-danger") + '" data-ok>' + A[2] + "</button>" +
        '<button type="button" class="linkbtn" data-back>Go back</button></div>';
    let yes = false;
    d.onclick = e => { if (e.target.closest("[data-ok]")) { yes = true; d.close(); } else if (e.target === d || e.target.closest("[data-back]")) d.close(); };
    d.onclose = () => done(yes);
    d.showModal();
    d.querySelector("[data-back]").focus();   // the safe choice has focus, so Enter doesn't confirm by accident
  });
  UI.statusChip = s => '<span class="chip-st st-' + UI.esc(s) + '">' + UI.esc({ pending: "Waiting", accepted: "Accepted", declined: "Declined", cancelled: "Cancelled", waitlist: "Waitlist", withdrawn: "Withdrawn" }[s] || s) + "</span>";

  /* ---------- top bar: Discord login ---------- */
  UI.mountAuth = function (el, me) {
    if (!el) return;
    if (!me) {
      el.innerHTML = '<button type="button" class="cta discord" id="login-btn">Log in with Discord</button>';
      UI.$("#login-btn", el).onclick = e => UI.act(e.currentTarget, () => API.signIn());
      return;
    }
    el.innerHTML = '<a class="me-chip" href="desk.html" title="Open your desk">' + UI.avatar(me, 26) + "<span>" + UI.esc(UI.who(me)) + '</span></a><button type="button" class="cta ghost-cta" id="logout-btn">Log out</button>';
    UI.$("#logout-btn", el).onclick = e => UI.act(e.currentTarget, () => API.signOut());
  };
  UI.login = btn => UI.act(btn, () => API.signIn());

  /* ---------- demo mode bar ---------- */
  UI.mountDemoBar = function () {
    if (API.live || UI.$("#demo-bar")) return;
    const bar = document.createElement("div");
    bar.id = "demo-bar";
    const people = API.demo.people();
    const groups = [
      ["Staff", p => p.role === "staff", p => UI.who(p)],
      ["Mentors", p => p.coach && p.coach.kind === "mentor", p => UI.who(p) + " · Mentor " + UI.pad(p.coach.slot)],
      ["Assistant coaches", p => p.coach && p.coach.kind === "assistant", p => UI.who(p) + " · Assistant " + UI.pad(p.coach.slot)],
      ["Players", p => p.role !== "staff" && !p.coach, p => UI.who(p) + " · " + (p.team || "no team")]
    ];
    bar.innerHTML = '<b>Demo mode</b><span>Sample data, saved only in this browser.</span>' +
      '<label for="demo-who">View as</label><select id="demo-who"><option value="">Logged out</option>' +
      groups.map(([name, has, label]) => '<optgroup label="' + name + '">' + people.filter(has).map(p => '<option value="' + UI.esc(p.id) + '">' + UI.esc(label(p)) + "</option>").join("") + "</optgroup>").join("") + "</select>" +
      '<button type="button" id="demo-reset">Reset data</button>';
    document.body.appendChild(bar);
    const sel = UI.$("#demo-who");
    sel.value = API.demo.who() || "";
    sel.onchange = () => API.demo.setMe(sel.value);
    UI.$("#demo-reset").onclick = () => { API.demo.reset(); sel.value = API.demo.who() || ""; UI.toast("Demo data reset."); };
    API.onAuth(() => { sel.value = API.demo.who() || ""; });
  };

  window.UI = UI;
})();
