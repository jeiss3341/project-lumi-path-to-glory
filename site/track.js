/* Path to Glory · visit counting for the Sponsor Stats and Team stats tabs (desk → Staff).
   A random visitor ID kept in this browser; when someone is logged in, their account too, so staff
   can see each player's time (visitors who aren't logged in stay anonymous). It records
   how long people stay, which sections they look at, and what they click (coach cards, characters,
   Discord invites, calendar adds). Saved through API.track: the real database on the real site,
   this browser only in demo mode. */
(function () {
  "use strict";
  if (!window.API || !API.track || window.top !== window.self) return;   // not inside the phone preview

  const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  let visitor = "";
  try { visitor = localStorage.getItem("ptg-visitor") || ""; if (!visitor) localStorage.setItem("ptg-visitor", visitor = rid()); } catch (e) { visitor = rid(); }
  const session = rid();
  const w = Math.min(screen.width || innerWidth, screen.height || innerHeight);
  const device = /Mobi|Android|iPhone/i.test(navigator.userAgent) && w < 600 ? "phone" : (/iPad|Tablet/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && w < 1100)) ? "tablet" : "computer";
  let tz = "";
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) { /* unknown */ }
  const source = (() => {
    let h = "";
    try { h = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, "") : ""; } catch (e) { /* bad referrer */ }
    if (!h || h === location.hostname) return "Direct";
    if (/discord/.test(h)) return "Discord";
    if (/google\./.test(h)) return "Google";
    if (/(^|\.)x\.com$|twitter/.test(h)) return "X / Twitter";
    if (/youtube/.test(h)) return "YouTube";
    if (/twitch/.test(h)) return "Twitch";
    if (/reddit/.test(h)) return "Reddit";
    return h.slice(0, 60);
  })();
  let loggedIn = false, profileId = null;
  // every row carries every field: the database turns down a batch whose rows have different fields
  // (that silently lost all the time-on-site rows, which go out together with the per-section ones).
  // profile_id: a logged-in visitor's account, so staff can see each player's time (Staff desk → Team stats).
  const base = () => ({ visitor, session, device, tz: tz.slice(0, 60), logged_in: loggedIn, profile_id: profileId, target: "", ms: 0, source: "" });
  const send = rows => { if (rows.length) API.track(rows.map(r => Object.assign(base(), r))); };
  const page = new URLSearchParams(location.search).has("hours") ? "Office hours" : "Home";

  // ---- the visit itself (once the login check is done, so it knows whether they're logged in) ----
  Promise.resolve(API.session && API.session()).catch(() => null).then(me => {
    loggedIn = !!me; profileId = me ? me.id : null;
    send([{ kind: "visit", target: page, source }]);
  });

  // ---- time on site and per section: counted each second while the tab is in front and the person is active ----
  const SECTIONS = { top: "Top of page", brief: "Brief", schedule: "Schedule", faculty: "Faculty", book: "Office hours", rosters: "Rosters", notes: "Field notes", channels: "Channels" };
  let total = 0, lastInput = Date.now();
  const secMs = {};
  ["scroll", "pointermove", "pointerdown", "keydown", "touchstart", "wheel"].forEach(t => addEventListener(t, () => { lastInput = Date.now(); }, { passive: true }));
  const current = () => {   // the section taking up the most of the screen
    let best = "top", bestH = 0;
    for (const id in SECTIONS) {
      if (id === "top") continue;
      const el = document.getElementById(id);
      if (!el || !el.offsetParent && el.offsetHeight === 0) continue;
      const r = el.getBoundingClientRect(), h = Math.min(innerHeight, r.bottom) - Math.max(0, r.top);
      if (h > bestH) { bestH = h; best = id; }
    }
    return bestH > innerHeight * 0.25 ? best : "top";
  };
  setInterval(() => {
    if (document.hidden || Date.now() - lastInput > 90000) return;   // away from the tab, or idle for 1.5 minutes
    total += 1000;
    const s = page === "Office hours" ? "book" : current();
    secMs[s] = (secMs[s] || 0) + 1000;
  }, 1000);
  const flush = () => {
    const rows = [];
    if (total) rows.push({ kind: "time", ms: Math.min(total, 3600000) });
    for (const s in secMs) if (secMs[s]) rows.push({ kind: "section", target: SECTIONS[s], ms: Math.min(secMs[s], 3600000) });
    total = 0;
    for (const s in secMs) secMs[s] = 0;
    send(rows);
  };
  document.addEventListener("visibilitychange", () => { if (document.hidden) flush(); });
  addEventListener("pagehide", flush);
  setInterval(flush, 60000);   // a long visit still reports every minute

  // ---- what people click ----
  const coachByName = name => {
    const C = window.PTG || {}, n = String(name || "").replace(/^\d+\s+/, "").replace(/^\[|\]$/g, "").trim().toLowerCase();
    const c = (C.coachSeed || []).find(x => (x.name || "").toLowerCase() === n);
    return c ? c.name : name;
  };
  const coachById = id => { const c = ((window.PTG || {}).coachSeed || []).find(x => x.id === id); return c ? c.name : id; };
  document.addEventListener("click", e => {
    const t = e.target;
    let x;
    if ((x = t.closest("#fac-tabs .tab"))) return send([{ kind: "coach", target: coachByName(x.textContent) }]);
    if ((x = t.closest(".as-hit, .as-pick"))) return send([{ kind: "coach", target: coachById(x.dataset.a) }]);
    if ((x = t.closest(".pool-chip"))) return send([{ kind: "char", target: (x.dataset.char || x.textContent).trim().slice(0, 80) }]);
    if ((x = t.closest(".js-flip"))) { const on = document.querySelector('#fac-tabs .tab[aria-selected="true"]'); return send([{ kind: "flip", target: on ? coachByName(on.textContent) : "" }]); }
    if ((x = t.closest("#channels a.link"))) { const h = x.querySelector("h3"); return send([{ kind: "discord", target: h ? h.textContent.trim() : "" }]); }
    if ((x = t.closest('a[href*="calendar.google.com"]'))) return send([{ kind: "gcal", target: (document.querySelector("#day-detail h3") || {}).textContent || "" }]);
    if ((x = t.closest('a[href*="hours&coach="]'))) { const m = /coach=([a-z0-9]+)/.exec(x.getAttribute("href")); return send([{ kind: "request", target: m ? coachById(m[1]) : "" }]); }
    if ((x = t.closest(".day, .agenda button"))) return send([{ kind: "day", target: x.dataset.iso || "" }]);
    if ((x = t.closest(".cta.discord, #gate-login"))) return send([{ kind: "login", target: page }]);
  }, true);
})();
