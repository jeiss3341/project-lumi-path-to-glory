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

  /* ---------- time (always the viewer's own time zone) ---------- */
  UI.tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || "your time zone").replace(/_/g, " ");
  UI.ymd = d => d.getFullYear() + "-" + UI.pad(d.getMonth() + 1) + "-" + UI.pad(d.getDate());
  UI.dayOf = iso => UI.ymd(new Date(iso));
  UI.time = iso => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  UI.date = (iso, o) => new Date(iso).toLocaleDateString("en-US", o || { weekday: "short", month: "short", day: "numeric" });
  UI.range = (a, b) => UI.date(a) + " · " + UI.time(a) + "–" + UI.time(b);
  UI.atMin = (ymd, mins) => { const p = ymd.split("-").map(Number); return new Date(p[0], p[1] - 1, p[2], 0, mins, 0, 0); };
  UI.minOf = d => d.getHours() * 60 + d.getMinutes();
  UI.minLabel = m => m >= 1440 ? "12:00 AM (next day)" : new Date(2000, 0, 1, 0, m).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  UI.dur = (a, b) => { const m = Math.round((new Date(b) - new Date(a)) / 6e4); return m % 60 ? (m >= 60 ? Math.floor(m / 60) + " h " : "") + (m % 60) + " min" : (m / 60) + (m === 60 ? " hour" : " hours"); };
  UI.eventDays = () => {
    const s = new Date(C.event.start + "T12:00:00"), out = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(s.getTime() + i * DAY);
      out.push({ ymd: UI.ymd(d), d, n: d.getDate(), dow: d.toLocaleDateString("en-US", { weekday: "short" }), week: i < 7 ? 1 : 2, events: C.schedule.filter(e => e.date === UI.ymd(d)) });
    }
    return out;
  };
  UI.todayYmd = () => UI.ymd(new Date());
  UI.status = () => {
    const t = new Date(); t.setHours(12, 0, 0, 0);
    const s = new Date(C.event.start + "T12:00:00"), e = new Date(C.event.end + "T12:00:00");
    if (t < s) return { phase: "before", days: Math.round((s - t) / DAY) };
    if (t > e) return { phase: "after" };
    return { phase: "live", day: Math.round((t - s) / DAY) + 1 };
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
    const label = p => UI.who(p) + (p.role === "staff" ? " (staff)" : p.id === "u-neotep" ? " (mentor 01)" : " (player)");
    bar.innerHTML = '<b>Demo mode</b><span>Sample data, saved only in this browser.</span>' +
      '<label for="demo-who">View as</label><select id="demo-who"><option value="">Logged out</option>' +
      people.map(p => '<option value="' + UI.esc(p.id) + '">' + UI.esc(label(p)) + "</option>").join("") + "</select>" +
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
