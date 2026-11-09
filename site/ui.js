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
  UI.range = (a, b) => UI.date(a) + " · " + UI.time(a) + " – " + UI.time(b);
  // one formatter per time zone: making a new one each call is slow, and the planners call this thousands of times
  const FMT = {};
  const tzParts = (d, tz) => {
    const p = {};
    (FMT[tz] || (FMT[tz] = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })))
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
  // Previewing another day: ?today=2026-11-18 (and &at=21:00, Eastern; noon if left out), or in demo mode the demo
  // bar's Day picker, which sticks while you browse. The site then acts as if it's that moment (what's over, what's
  // waiting, what's next), and the clock keeps running from there. Off, it's the real time.
  const WHEN_KEY = "ptg-demo-when";
  let fakeDay = (location.search.match(/[?&]today=(\d{4}-\d\d-\d\d)/) || [])[1], fakeAt = 12 * 60;
  const at = location.search.match(/[?&]at=(\d\d?):(\d\d)/);
  if (fakeDay && at) fakeAt = +at[1] * 60 + +at[2];
  if (!fakeDay && window.API && !API.live) {
    try { const w = JSON.parse(localStorage.getItem(WHEN_KEY) || "null"); if (w && w.day) { fakeDay = w.day; fakeAt = w.at; } } catch (e) { /* no storage: real time */ }
  }
  const LOADED = Date.now();
  const FAKE_T = fakeDay ? UI.etAt(fakeDay, fakeAt < UI.DAY_END - 1440 ? fakeAt + 1440 : fakeAt).getTime() : null;   // 1 AM is the night of that day
  UI.now = () => FAKE_T == null ? Date.now() : FAKE_T + (Date.now() - LOADED);
  UI.previewing = () => FAKE_T != null;
  // today's event day (Eastern, rolling over at 4 AM)
  UI.todayYmd = () => UI.dayOf(new Date(UI.now()));
  // what a request is now: a waiting one nobody answered before it started has expired; a booked one that's over is done
  UI.shown = r => r.status === "pending" && new Date(r.starts_at).getTime() <= UI.now() ? "expired"
    : r.status === "accepted" && new Date(r.ends_at).getTime() <= UI.now() ? "done" : r.status;
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
  // who a session is with: the team's name for a team review the mentor wrote down, otherwise the player
  UI.party = (r, teamName) => r.by_coach && r.kind === "team" && teamName ? teamName : UI.who(r.requester);
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
    return '<div class="badge"><div class="b-strip"><span>FACULTY · PATH TO GLORY</span></div><div class="b-body">' +
      '<div class="b-top"><span class="b-dash"><i></i><i></i><i></i></span><span>ID // 2026</span></div>' +
      '<div class="b-role">' + (c.kind === "assistant" ? "Assistant" : "Instructor") + "</div>" +
      '<div class="b-row"><span class="b-id">' + UI.esc(c.badge_id) + "</span>" + UI.barcode(c.badge_id, 92, 24) + "</div>" +
      '<div class="b-art">' + UI.art(c) + "</div>" +
      '<div class="b-name"><small>NAME</small><div class="b-nameline"><b>[' + UI.esc(bare(UI.coachName(c))) + ']</b><span class="b-team">' + UI.esc(bare(UI.coachTeam(c))) + "</span></div></div></div></div>";
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
    const name = esc(UI.party(r, o.team)), coach = esc(o.coach || ""), what = r.kind === "team" ? "team review" : "individual session";
    const cal = me ? "your calendar" : coach + "'s calendar";
    const when = esc(UI.date(UI.etAt(UI.dayOf(r.starts_at), 720), { weekday: "long", month: "long", day: "numeric" })) + " · " + et(r.starts_at) + "–" + et(r.ends_at) + " ET" +
      (UI.onEastern(new Date(r.starts_at)) ? "" : '<br><span class="muted">Your time: ' + esc(UI.time(r.starts_at) + "–" + UI.time(r.ends_at)) + "</span>");
    // accepting books the time, so other waiting requests that overlap it are declined (the database does the same)
    const clash = o.status !== "accepted" ? [] : (o.reqs || []).filter(x => x.id !== r.id && x.coach_id === r.coach_id && x.status === "pending" && T(x.starts_at) < T(r.ends_at) && T(r.starts_at) < T(x.ends_at));
    const undo = r.by_coach ? "There's no undo, but " + (me ? "you" : coach) + " can write the session again."   // a session the mentor wrote down
      : "There's no undo. If this is a mistake, " + name + " has to send the request again.";
    const pts = {
      accepted: ["The " + what + " is booked. It shows as Accepted on " + name + "'s desk and on " + cal + ".",
        me ? "Make sure you can make it. " + name + " will plan around it." : coach + " isn't asked first, so check with them if you're not sure they can make it."],
      declined: [name + "'s request moves to Declined. They see it on their desk.", "The time stays open for other requests.", undo],
      cancelled: ["The session comes off " + cal + " and shows as Cancelled on " + name + "'s desk.", "The time opens up again for new requests.",
        "Let " + name + (me ? "" : " and " + coach) + " know on Discord too, so nobody shows up for it.", undo]
    }[o.status];
    let d = document.getElementById("ask-dlg");
    if (!d) { d = document.createElement("dialog"); d.id = "ask-dlg"; d.setAttribute("aria-labelledby", "ask-dlg-title"); document.body.appendChild(d); }
    d.innerHTML = '<div class="sc-dtop"><div><span class="k">' + A[0] + (me ? "" : " · " + coach) + '</span><h3 id="ask-dlg-title">' + A[1] + "</h3></div>" + UI.statusChip(r.status) + "</div>" +
      '<p class="sc-ask-who"><b>' + name + "</b>" + (o.team && !(r.by_coach && r.kind === "team") ? " · " + esc(o.team) : "") + "<br>" + what.charAt(0).toUpperCase() + what.slice(1) + (me ? "" : " with " + coach) + "<br>" + when + "</p>" +
      '<h4 class="sc-ask-k">What happens</h4><ul class="sc-ask">' + pts.map(p => "<li>" + p + "</li>").join("") + "</ul>" +
      (clash.length ? '<p class="sc-ask-warn">' + (clash.length === 1 ? "1 other waiting request overlaps this time and will be declined:" : clash.length + " other waiting requests overlap this time and will be declined:") + "</p>" +
        '<ul class="sc-ask warn">' + clash.map(x => "<li>" + esc(UI.who(x.requester)) + " · " + et(x.starts_at) + "–" + et(x.ends_at) + " ET · " + UI.sentGap(x, r) + "</li>").join("") + "</ul>" : "") +
      '<div class="sc-dact"><button type="button" class="btn' + (o.status === "accepted" ? "" : " cc-danger") + '" data-ok>' + A[2] + "</button>" +
        '<button type="button" class="linkbtn" data-back>Go back</button></div>';
    answer(d, done);
  });
  /* ---------- "are you sure?" for anything else (the mentor calendar's hours), same look as askRequest ----------
     o: { kicker, title, lead (html), points: [html], warn (html) + warnList: [html], yes, danger }
     Resolves true on yes; false on Go back, Esc or a click outside. */
  UI.ask = o => new Promise(done => {
    let d = document.getElementById("ask-dlg");
    if (!d) { d = document.createElement("dialog"); d.id = "ask-dlg"; d.setAttribute("aria-labelledby", "ask-dlg-title"); document.body.appendChild(d); }
    d.innerHTML = '<div class="sc-dtop"><div><span class="k">' + o.kicker + '</span><h3 id="ask-dlg-title">' + o.title + "</h3></div></div>" +
      (o.lead ? '<p class="sc-ask-who">' + o.lead + "</p>" : "") +
      '<h4 class="sc-ask-k">What happens</h4><ul class="sc-ask">' + o.points.map(p => "<li>" + p + "</li>").join("") + "</ul>" +
      (o.warn ? '<p class="sc-ask-warn">' + o.warn + '</p><ul class="sc-ask warn">' + (o.warnList || []).map(p => "<li>" + p + "</li>").join("") + "</ul>" : "") +
      '<div class="sc-dact"><button type="button" class="btn' + (o.danger ? " cc-danger" : "") + '" data-ok>' + o.yes + '</button><button type="button" class="linkbtn" data-back>Go back</button></div>';
    answer(d, done);
  });
  // the buttons answer straight away (the dialog's close event waits for the next frame); Esc answers "no"
  function answer(d, done) {
    if (d._finish) d._finish(false);   // a question still open gets "no"
    let settled = false;
    const finish = v => { if (settled) return; settled = true; d._finish = null; if (d.open) d.close(); done(v); };
    d._finish = finish;
    d.onclick = e => { if (e.target.closest("[data-ok]")) finish(true); else if (e.target === d || e.target.closest("[data-back]")) finish(false); };
    d.onclose = () => { if (!d.open && d._finish === finish) finish(false); };   // Esc (a late close event from an earlier question is ignored)
    if (!d.open) d.showModal();
    d.querySelector("[data-back]").focus();   // the safe choice has focus, so Enter doesn't confirm by accident
  }
  UI.statusChip = s => '<span class="chip-st st-' + UI.esc(s) + '">' + UI.esc({ pending: "Waiting", accepted: "Accepted", declined: "Declined", cancelled: "Cancelled", waitlist: "Waitlist", withdrawn: "Withdrawn", expired: "Expired", done: "Done" }[s] || s) + "</span>";

  /* ---------- top bar: Discord login ---------- */
  UI.mountAuth = function (el, me) {
    if (!el) return;
    if (!me) {
      el.innerHTML = '<button type="button" class="cta discord" id="login-btn">Log in with Discord</button>';
      UI.$("#login-btn", el).onclick = e => UI.act(e.currentTarget, () => API.signIn());
      return;
    }
    // the profile menu: opens on hover or click, and lists the same desk pages as the desk's tabs
    el.innerHTML = '<div class="me-menu"><button type="button" class="me-chip" aria-haspopup="true" aria-expanded="false">' + UI.avatar(me, 26) + "<span>" + UI.esc(UI.who(me)) + '</span><i class="me-caret" aria-hidden="true"></i></button>' +
      '<div class="me-pop"><div class="me-links"></div><button type="button" id="logout-btn">Log out</button></div></div>';
    UI.$("#logout-btn", el).onclick = e => UI.act(e.currentTarget, () => API.signOut());
    const menu = UI.$(".me-menu", el), chip = UI.$(".me-chip", el), links = UI.$(".me-links", el);
    const setOpen = on => { menu.classList.toggle("open", on); chip.setAttribute("aria-expanded", String(on)); };
    chip.onclick = () => setOpen(!menu.classList.contains("open"));
    menu.onclick = e => { if (e.target.closest("a")) setOpen(false); };
    menu.onpointerleave = e => { if (e.pointerType === "mouse") setOpen(false); };
    menu.onkeydown = e => { if (e.key === "Escape") { setOpen(false); chip.focus(); } };
    if (!UI.meMenuWired) {
      UI.meMenuWired = true;
      document.addEventListener("click", e => { const open = UI.$(".me-menu.open"); if (open && !open.contains(e.target)) { open.classList.remove("open"); UI.$(".me-chip", open).setAttribute("aria-expanded", "false"); } });
    }
    Promise.all([API.coaches(), API.teams()]).then(([coaches, teams]) => {
      const coach = coaches.find(c => c.profile_id === me.id), staff = me.role === "staff", onTeam = teams.some(t => (t.member_ids || []).includes(me.id));
      const items = [];
      if (coach) items.push(["desk.html#coach", coach.kind === "assistant" ? "Coach calendar" : "Mentor calendar"]);
      if (coach) items.push(["", "Session settings"]);
      if (onTeam || (!coach && !staff)) items.push(["desk.html#player", "Player file"]);
      if (staff) items.push(["desk.html#staff", "Staff"]);
      if (coach || staff || onTeam) items.push(["index.html?hours", "Office hours"]);   // only for people in the event
      links.innerHTML = items.map(i => i[0] ? '<a href="' + i[0] + '">' + UI.esc(i[1]) + "</a>" : '<button type="button" class="js-settings">' + UI.esc(i[1]) + "</button>").join("");
      const settings = UI.$(".js-settings", links);
      if (settings) settings.onclick = () => { setOpen(false); UI.sessionSettings(coach); };
    }).catch(() => { links.innerHTML = '<a href="desk.html">Your desk</a>'; });
  };
  UI.login = btn => UI.act(btn, () => API.signIn());

  // a coach's questions about the sessions they take; the defaults are the event's normal rules
  UI.sessionSettings = function (c) {
    const LENGTHS = [[30, "30 min"], [60, "1 h"], [90, "1.5 h"], [120, "2 h"]], KINDS = [["both", "Both"], ["team", "Team only"], ["individual", "Individual only"]];
    const v = { min: c.min_minutes || 30, max: c.max_minutes || 120, kinds: c.session_kinds || "both" };
    const d = document.createElement("dialog");
    d.className = "ss-pop";
    d.setAttribute("aria-labelledby", "ss-title");
    const seg = (key, label, opts) => '<div class="ss-q"><span id="ss-' + key + '">' + label + '</span><div class="bk-seg" role="group" aria-labelledby="ss-' + key + '">' +
      opts.map(([val, text]) => '<button type="button" data-k="' + key + '" data-v="' + val + '" aria-pressed="' + (v[key] === val) + '"' + ((key === "min" && val > v.max) || (key === "max" && val < v.min) ? " disabled" : "") + ">" + text + "</button>").join("") + "</div></div>";
    const paint = () => {
      d.innerHTML = '<h3 id="ss-title">Session settings</h3><p>Players only see what you allow here when they request time with you.</p>' +
        seg("min", "Shortest session", LENGTHS) + seg("max", "Longest session", LENGTHS) + seg("kinds", "Sessions you take", KINDS) +
        '<div class="ss-foot"><button type="button" class="ss-reset" data-reset>Back to defaults</button><span><button type="button" class="btn ghost" data-cancel>Cancel</button> <button type="button" class="btn" data-save>Save</button></span></div>';
    };
    d.onclick = e => {
      const b = e.target.closest("button");
      if (!b || b.disabled) return;
      if (b.dataset.k) { v[b.dataset.k] = b.dataset.k === "kinds" ? b.dataset.v : +b.dataset.v; paint(); }
      else if ("reset" in b.dataset) { Object.assign(v, { min: 30, max: 120, kinds: "both" }); paint(); }
      else if ("cancel" in b.dataset) d.close();
      else if ("save" in b.dataset) UI.act(b, async () => {
        await API.saveSessionSettings(c.id, v.min, v.max, v.kinds);
        Object.assign(c, { min_minutes: v.min, max_minutes: v.max, session_kinds: v.kinds });
        d.close();
      }, "Session settings saved.");
    };
    d.onclose = () => d.remove();
    paint();
    document.body.append(d);
    d.showModal();
  };

  /* ---------- demo mode bar ---------- */
  // the demo bar's Day and time menus: real time, the day before, each event day, the day after
  function dayPicker() {
    const days = UI.eventDays(), before = UI.ymd(new Date(days[0].d.getTime() - DAY)), after = UI.ymd(new Date(days[days.length - 1].d.getTime() + DAY));
    const label = ymd => UI.date(UI.etAt(ymd, 720), { weekday: "short", month: "short", day: "numeric" });
    const opts = [["", "Real time"], [before, label(before) + " · day before"]]
      .concat(days.map((d, i) => [d.ymd, label(d.ymd) + " · Day " + (i + 1) + (d.events[0] ? " · " + d.events[0].title : "")]))
      .concat([[after, label(after) + " · after the event"]]);
    const times = [[600, "10:00 AM"], [840, "2:00 PM"], [1080, "6:00 PM"], [1260, "9:00 PM"], [1410, "11:30 PM"], [120, "2:00 AM (that night)"]];
    const cur = fakeDay || "";
    return '<label for="demo-day">Day</label><select id="demo-day">' + opts.map(([v, l]) => '<option value="' + v + '"' + (v === cur ? " selected" : "") + ">" + UI.esc(l) + "</option>").join("") + "</select>" +
      '<select id="demo-at" aria-label="Time (Eastern)"' + (cur ? "" : " disabled") + ">" + times.map(([v, l]) => '<option value="' + v + '"' + (v === fakeAt ? " selected" : "") + ">" + l + " ET</option>").join("") + "</select>";
  }
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
      '<button type="button" id="demo-reset">Reset data</button>' + dayPicker();
    document.body.appendChild(bar);
    // Day / time: preview the site as of another moment (kept while you browse; reloads the page)
    const day = UI.$("#demo-day"), tm = UI.$("#demo-at");
    const keep = () => {
      try { if (day.value) localStorage.setItem(WHEN_KEY, JSON.stringify({ day: day.value, at: +tm.value })); else localStorage.removeItem(WHEN_KEY); } catch (e) { /* no storage */ }
      // drop any ?today= so the pick wins, and always really reload: a link that differs only by #section wouldn't
      const u = new URL(location.href);
      u.searchParams.delete("today"); u.searchParams.delete("at");
      if (u.href === location.href) location.reload(); else location.href = u.href;
    };
    day.onchange = keep; tm.onchange = keep;
    const sel = UI.$("#demo-who");
    sel.value = API.demo.who() || "";
    sel.onchange = () => API.demo.setMe(sel.value);
    UI.$("#demo-reset").onclick = () => { API.demo.reset(); sel.value = API.demo.who() || ""; UI.toast("Demo data reset."); };
    API.onAuth(() => { sel.value = API.demo.who() || ""; });
  };

  window.UI = UI;
})();
