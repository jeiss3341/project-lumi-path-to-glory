/* Path to Glory · "Live now" strip under the top bar.
   Shows every coach live on Twitch with [PTG] in their title (a [PTG] stream with an open mark,
   saved by Lumi-chan, supabase/vods.sql), each with a link to watch. Hidden when nobody is live.
   Checks again every minute. */
(function () {
  "use strict";
  const bar = document.querySelector(".topbar");
  if (!bar || !window.API || !API.vods) return;

  const css = document.createElement("style");
  css.textContent =
    ".live-strip{background:#120d0b;border-top:1px solid rgba(255,255,255,.08)}" +
    ".live-strip[hidden]{display:none}" +
    ".live-strip .wrap{display:flex;align-items:center;gap:10px 18px;flex-wrap:wrap;padding-block:8px;font:600 12px/1.2 var(--f-mono);letter-spacing:.1em;text-transform:uppercase;color:#f3f2ee}" +
    ".live-strip .lbl{display:inline-flex;align-items:center;gap:7px;color:#ff6a63}" +
    ".live-strip .lbl i{width:8px;height:8px;border-radius:50%;background:#ff4d45;box-shadow:0 0 0 0 rgba(255,77,69,.6);animation:livePulse 1.8s infinite}" +
    ".live-strip a{color:#f3f2ee;text-decoration:none;display:inline-flex;gap:8px;align-items:baseline}" +
    ".live-strip a b{font:800 13px/1 var(--f-display);letter-spacing:.04em}" +
    ".live-strip a span{color:#c9b9a3}" +
    ".live-strip a:hover span{color:#fff;text-decoration:underline;text-underline-offset:3px}" +
    "@keyframes livePulse{70%{box-shadow:0 0 0 7px rgba(255,77,69,0)}100%{box-shadow:0 0 0 0 rgba(255,77,69,0)}}" +
    "@media (prefers-reduced-motion:reduce){.live-strip .lbl i{animation:none}}";
  document.head.appendChild(css);

  const strip = document.createElement("div");
  strip.className = "live-strip";
  strip.hidden = true;
  strip.setAttribute("aria-label", "Coaches live now");
  bar.appendChild(strip);

  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  async function refresh() {
    try {
      const [vods, coaches] = await Promise.all([API.vods(), API.coaches()]);
      // live with [PTG] = the broadcast hasn't ended and [PTG] is still in the title (an open mark)
      const live = vods.filter(v => !v.ended_at && (v.marks || []).some(m => !m.ended_at));
      const seen = new Set(), rows = live.filter(v => !seen.has(v.coach_id) && seen.add(v.coach_id));
      if (!rows.length) { strip.hidden = true; return; }
      const name = id => { const c = coaches.find(x => x.id === id); return c ? UI.bare(UI.coachName(c)) : "Coach"; };
      strip.innerHTML = '<div class="wrap"><span class="lbl"><i aria-hidden="true"></i>Live now</span>' +
        rows.map(v => '<a href="https://twitch.tv/' + esc(v.twitch_login) + '" target="_blank" rel="noopener"><b>' + esc(name(v.coach_id)) + "</b><span>Watch ↗</span></a>").join("") + "</div>";
      strip.hidden = false;
    } catch (e) { strip.hidden = true; }   // never in the way: no strip if it can't load
  }
  refresh();
  setInterval(refresh, 60 * 1000);
})();
