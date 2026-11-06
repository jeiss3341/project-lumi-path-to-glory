/* Path to Glory · hero lanyard swing-in.
   Model: a damped double pendulum. Arm 1 is the strap, hanging from an anchor above the top of the page (the topbar
   covers it); arm 2 is the clip + ID card, joined to the strap's end with friction so the two move as one firm piece.
   The strap is drawn as a curve that leaves the anchor along arm 1 and meets the clip along arm 2, which gives the
   bend of a real strap. A small springy stretch in the strap adds the catch when a moving hand stops.
   Everything is computed in the .lanyard's own (rotated) frame and the rest pose is the static layout, so every
   entrance ends exactly where the page already sits; then the inline styles are removed and the CSS takes over.

   Smooth on any display, safe under lag:
   - physics runs on a fixed 1/120 s step (RK4) with an accumulator, and each drawn frame interpolates between the
     last two steps, so the motion is the same at 30, 60, 120 or 144 Hz;
   - a long frame (lag spike, background tab) is capped at 0.1 s of simulation, so it never jumps or blows up;
   - per frame it changes only transforms and one SVG path, and the loop stops completely once it lands;
   - every entrance lands within ~3 s; prefers-reduced-motion skips it.
   Add ?swing to the URL for a picker to try the six entrances and to simulate 30 fps or lag spikes. */
(function () {
  "use strict";
  const DT = 1 / 120;          // physics step (s)
  const MAX_FRAME = 0.1;       // most simulated time per drawn frame (s)
  const LAND_AT = 2.6;         // start landing no later than this (s)
  const LAND_FOR = .42;        // landing blend (s)
  const R = Math.PI / 180, deg = r => r / R;
  const ease = {
    inCubic: t => t * t * t,
    outCubic: t => 1 - Math.pow(1 - t, 3),
    inOutCubic: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2
  };
  const lerp = (a, b, k) => a + (b - a) * k;

  /* ---------------------------------------------------------------- the six entrances
     a1/a2: starting angles of strap and card (degrees from straight down, + = to the right)
     w1/w2: starting angular speeds (deg/s); twist: [angle, speed] of the card spinning on the swivel
     hand(g, t): optional anchor path {x, y, done} while a hand brings it in */
  const VARIANTS = {
    1: { name: "Release", note: "Held out to the right with the strap bent, then let go: one swing past the middle, a small return, done.",
      a1: 58, a2: 96, w1: 0, w2: 0, twist: [14, 0] },
    2: { name: "Toss", note: "Thrown in from the right: sails across, swings back once and settles.",
      a1: 100, a2: 112, w1: -150, w2: -190, twist: [-10, -80] },
    3: { name: "Drop", note: "Hung on its hook quickly from above: it drops in, the strap catches with a little bounce and sways.",
      a1: 0, a2: 0, w1: 0, w2: 0, twist: [6, 50],
      // the hand falls at 60% of gravity (so the card still feels its weight), then stops dead on the hook
      hand: (g, t) => { const fall = .5 * .6 * PHYS.g * t * t, k = Math.min(fall / g.drop, 1); return { x: g.A.x + 120 * (1 - k), y: g.A.y - g.drop * (1 - k), done: k >= 1 }; } },
    4: { name: "Lower", note: "Lowered gently from above by hand, with a small sway as it comes to rest.",
      a1: 0, a2: 0, w1: 0, w2: 0, twist: [5, 0],
      hand: (g, t) => { const k = Math.min(t / 1.15, 1); return { x: g.A.x + 150 * (1 - ease.inOutSine(k)), y: g.A.y - g.drop * (1 - ease.outCubic(k)), done: k >= 1 }; } },
    5: { name: "Carry", note: "Carried in from the side and hung up: the card trails the hand, then swings once.",
      a1: 0, a2: 0, w1: 0, w2: 0, twist: [-8, 30],
      hand: (g, t) => { const k = ease.inOutCubic(Math.min(t / .9, 1)); return { x: g.A.x + 600 * (1 - k), y: g.A.y - 90 * Math.sin(Math.PI * k) - 30 * (1 - k), done: t >= .9 }; } },
    6: { name: "Spin", note: "Swings down from the top-left while spinning on the swivel, then unwinds and settles.",
      a1: -128, a2: -140, w1: 120, w2: 140, twist: [0, 720] }
  };

  /* ---------------------------------------------------------------- physics constants */
  const PHYS = {
    g: 15000,          // px/s² (scaled so a ~0.6 m lanyard swings at a natural pace on screen)
    m1: .35, m2: 1,    // strap end vs. clip + card
    c1: 2.4,           // air drag on the strap (1/s)
    cJ: 7.5,           // friction at the clip joint: strap and card move together, no flopping
    c2: 2.6,           // air drag on the card
    kE: 520, cE: 15,   // strap stretch: stiff, quickly damped (gives the catch bounce)
    kT: Math.pow(2 * Math.PI / 1.1, 2), cT: 5.5   // card twist on the swivel
  };

  /* ---------------------------------------------------------------- geometry of the rest pose (lanyard frame) */
  let G = null;
  function measure() {
    const lan = document.querySelector(".lanyard");
    if (!lan) return null;
    const strap = lan.querySelector(".strap"), hook = lan.querySelector(".hook"), holder = document.getElementById("hero-badge");
    if (!strap || !hook || !holder || !holder.firstElementChild) return null;
    const sx = strap.offsetLeft + strap.offsetWidth / 2, sTop = strap.offsetTop, sBot = sTop + strap.offsetHeight;
    // anchor: above the top of the screen (the topbar covers it on desktop), but never more than 260px above the
    // strap's top, so on phones (where the lanyard sits lower on the page) the strap doesn't become huge
    const viewTop = lan.getBoundingClientRect().top;
    const ay = Math.min(sTop - 40, Math.max(-viewTop - 80, sTop - 260));
    const cardTop = holder.offsetTop, cardH = holder.offsetHeight;
    return {
      lan, strap, hook, holder,
      clasp: hook.querySelector(".clasp"), back: hook.querySelector(".clasp-back"),
      knurl: document.getElementById("hw-knurl"),
      A: { x: sx, y: ay }, P: { x: sx, y: sBot },
      L1: sBot - ay,                                   // strap length
      L2: (cardTop - sBot) + cardH * .48,              // clip → card centre of mass
      hookOrigin: (sx - hook.offsetLeft) + "px 0px",
      holderOrigin: (sx - holder.offsetLeft) + "px " + (sBot - cardTop) + "px",
      textMid: sTop + strap.offsetHeight / 2 - ay,
      clipTop: sTop,                                   // the moving strap is cut where the real strap starts
      drop: Math.max(viewTop, 0) + cardTop + cardH + 160   // far enough up to start above the visible screen
    };
  }

  /* ---------------------------------------------------------------- simulation */
  // state: [th1, w1, th2, w2, e, ev] (radians, rad/s, stretch px, px/s)
  function deriv(s, gx, gy) {
    const { m1, m2, c1, cJ, c2, kE, cE } = PHYS, L1 = G.L1 + s[4], L2 = G.L2;
    // gravity (minus the hand's acceleration) may point a little sideways: measure angles from it
    const geff = Math.hypot(gx, gy), beta = Math.atan2(gx, gy);
    const t1 = s[0] - beta, t2 = s[2] - beta, w1 = s[1], w2 = s[3];
    const dlt = t1 - t2, den = 2 * m1 + m2 - m2 * Math.cos(2 * t1 - 2 * t2);
    let a1 = (-geff * (2 * m1 + m2) * Math.sin(t1) - m2 * geff * Math.sin(t1 - 2 * t2) - 2 * Math.sin(dlt) * m2 * (w2 * w2 * L2 + w1 * w1 * L1 * Math.cos(dlt))) / (L1 * den);
    let a2 = (2 * Math.sin(dlt) * (w1 * w1 * L1 * (m1 + m2) + geff * (m1 + m2) * Math.cos(t1) + w2 * w2 * L2 * m2 * Math.cos(dlt))) / (L2 * den);
    a1 += -c1 * w1 + cJ * .35 * (w2 - w1);
    a2 += -c2 * w2 - cJ * (w2 - w1);
    // strap stretch along its length: pulled by the component of effective gravity along the strap, springs back
    const along = (gx * Math.sin(s[0]) + gy * Math.cos(s[0])) - PHYS.g;
    const ea = -kE * s[4] - cE * s[5] + along * .15;
    return [w1, a1, w2, a2, s[5], ea];
  }
  function rk4(s, dt, gx, gy) {
    const add = (a, b, k) => a.map((v, i) => v + b[i] * k);
    const k1 = deriv(s, gx, gy), k2 = deriv(add(s, k1, dt / 2), gx, gy), k3 = deriv(add(s, k2, dt / 2), gx, gy), k4 = deriv(add(s, k3, dt), gx, gy);
    return s.map((v, i) => v + dt / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
  }

  let sim = null, raf = 0, overlay = null, pathEl = null;
  function start(variantId) {
    stop(true);
    const g = measure();
    if (!g) return false;
    G = g;
    const v = VARIANTS[variantId] || VARIANTS[1];
    const a0 = v.hand ? v.hand(g, 0) : { x: g.A.x, y: g.A.y, done: true };
    const st = [v.a1 * R, v.w1 * R, v.a2 * R, v.w2 * R, 0, 0];
    sim = { v, st, prev: st.slice(), anc: { x: a0.x, y: a0.y }, prevAnc: { x: a0.x, y: a0.y }, ancV: { x: 0, y: 0 },
      phi: v.twist[0], phiV: v.twist[1], prevPhi: v.twist[0], t: 0, acc: 0, last: 0, landing: false, land: 0, handDone: !v.hand };
    mountOverlay();
    setPending(false);
    // the card's GPU layer is permanent (will-change in styles.css), so nothing here turns layers on or off:
    // switching it on landing made the card's text visibly change weight. The twist is a 2D squeeze for the same reason.
    g.clasp.style.transformOrigin = g.back.style.transformOrigin = g.hookOrigin;
    g.holder.style.transformOrigin = g.holderOrigin;
    draw(1);
    raf = requestAnimationFrame(frame);
    return true;
  }

  function step(dt) {
    const s = sim, v = s.v;
    // the hand (anchor) and its acceleration, which the lanyard feels as a sideways/upward push
    s.prevAnc = { x: s.anc.x, y: s.anc.y };
    let ax = 0, ay = 0;
    if (v.hand) {
      const h = v.hand(G, s.t + dt);
      const vx = (h.x - s.anc.x) / dt, vy = (h.y - s.anc.y) / dt;
      ax = (vx - s.ancV.x) / dt; ay = Math.min((vy - s.ancV.y) / dt, PHYS.g * .8);   // never weightless
      s.ancV = { x: vx, y: vy }; s.anc = { x: h.x, y: h.y }; s.handDone = h.done;
      if (h.done) s.ancV = { x: 0, y: 0 };
    }
    s.prev = s.st;
    s.st = rk4(s.st, dt, -ax, PHYS.g - ay);
    // card twisting on the swivel
    s.prevPhi = s.phi;
    s.phiV += (-PHYS.kT * s.phi - PHYS.cT * s.phiV) * dt;
    s.phi += s.phiV * dt;
    s.t += dt;
  }

  function frame(stamp) {
    const s = sim;
    if (!s) return;
    if (!s.last) s.last = stamp;
    let dt = Math.max((stamp - s.last) / 1000, 0);
    s.last = stamp;
    // test modes from the picker: draw at ~30 fps, or block the main thread now and then
    if (testMode === "30" && stamp - (s.drawn || 0) < 31) { s.skipped = (s.skipped || 0) + dt; raf = requestAnimationFrame(frame); return; }
    dt = Math.min(dt + (s.skipped || 0), MAX_FRAME);
    s.skipped = 0;
    s.drawn = stamp;
    if (testMode === "lag" && Math.random() < .06) { const until = performance.now() + 120 + Math.random() * 160; while (performance.now() < until) {} }
    measureHz(stamp);
    s.acc += dt;
    while (s.acc >= DT) { step(DT); s.acc -= DT; }
    // land: once the swing is small (or at LAND_AT at the latest), ease the live motion into the exact rest pose
    if (!s.landing && ((s.t > .8 && nearlyStill()) || s.t > LAND_AT)) s.landing = true;
    if (s.landing) {
      s.land += dt / LAND_FOR;
      if (s.land >= 1) { stop(false); return; }
    }
    draw(s.acc / DT);
    raf = requestAnimationFrame(frame);
  }

  function nearlyStill() {
    const s = sim, st = s.st;
    return s.handDone && Math.abs(st[0]) < 4 * R && Math.abs(st[2]) < 4 * R && Math.abs(st[1]) < .7 && Math.abs(st[3]) < .7 && Math.abs(st[4]) < 3 && Math.abs(s.phi) < 8;
  }

  // the pose to draw: interpolated between the last two physics steps, and mixed into the rest pose while landing
  function pose(alpha) {
    const s = sim, k = s.landing ? ease.inOutSine(Math.min(s.land, 1)) : 0, keep = 1 - k;
    const th1 = lerp(s.prev[0], s.st[0], alpha) * keep, th2 = lerp(s.prev[2], s.st[2], alpha) * keep;
    const e = lerp(s.prev[4], s.st[4], alpha) * keep;
    const ax = lerp(lerp(s.prevAnc.x, s.anc.x, alpha), G.A.x, k), ay = lerp(lerp(s.prevAnc.y, s.anc.y, alpha), G.A.y, k);
    const phi = lerp(s.prevPhi, s.phi, alpha) * keep;
    const L1 = G.L1 + e;
    const P = { x: ax + Math.sin(th1) * L1, y: ay + Math.cos(th1) * L1 };
    return { A: { x: ax, y: ay }, P, th1, th2, phi, L1 };
  }

  function draw(alpha) {
    const g = G, p = pose(alpha);
    // strap: leaves the anchor along the strap's angle and arrives at the clip along the card's angle
    const h1 = p.L1 * .42, h2 = p.L1 * .38;
    const c1 = { x: p.A.x + Math.sin(p.th1) * h1, y: p.A.y + Math.cos(p.th1) * h1 };
    const c2 = { x: p.P.x - Math.sin(p.th2) * h2, y: p.P.y - Math.cos(p.th2) * h2 };
    pathEl.setAttribute("d", "M" + p.A.x.toFixed(1) + " " + p.A.y.toFixed(1) + "C" + c1.x.toFixed(1) + " " + c1.y.toFixed(1) + " " +
      c2.x.toFixed(1) + " " + c2.y.toFixed(1) + " " + p.P.x.toFixed(1) + " " + p.P.y.toFixed(1));
    // clip + card: one rigid body hanging from the strap's end
    const tf = "translate(" + (p.P.x - g.P.x).toFixed(2) + "px," + (p.P.y - g.P.y).toFixed(2) + "px) rotate(" + (-deg(p.th2)).toFixed(3) + "deg)";
    g.clasp.style.transform = g.back.style.transform = g.holder.style.transform = tf;
    const card = g.holder.firstElementChild;
    // twist on the swivel, drawn as a flat squeeze (cos of the twist angle) so the card stays 2D
    if (card) card.style.transform = Math.abs(p.phi) > .01 ? "scaleX(" + Math.max(.06, Math.abs(Math.cos(p.phi * R))).toFixed(4) + ")" : "";
    // the swivel's knurled band turns with the card's twist
    if (g.knurl) g.knurl.setAttribute("patternTransform", "translate(" + (p.phi * .09).toFixed(2) + " 0) rotate(45)");
  }

  function stop(silent) {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (G) {
      [G.clasp, G.back, G.holder].forEach(el => { el.style.transform = el.style.transformOrigin = ""; });
      const card = G.holder.firstElementChild;
      if (card) card.style.transform = "";
      if (G.knurl) G.knurl.setAttribute("patternTransform", "rotate(45)");
    }
    // landed: keep the same SVG strap, just straight, so its text doesn't re-render as different HTML text
    if (silent) unmountOverlay();
    else if (overlay) pathEl.setAttribute("d", "M" + G.A.x.toFixed(1) + " " + G.A.y.toFixed(1) + "L" + G.P.x.toFixed(1) + " " + G.P.y.toFixed(1));
    if (!silent && picker && sim) picker.querySelector("[data-state]").textContent = "Landed in " + sim.t.toFixed(1) + " s";
    sim = null;
  }
  function unmountOverlay() {
    if (overlay) { overlay.remove(); overlay = null; }
    if (G) G.strap.style.visibility = "";
  }
  // if the layout width changes later (window resized, phone rotated), hand the strap back to the page's own CSS
  let lastW = window.innerWidth;
  window.addEventListener("resize", () => { if (window.innerWidth !== lastW) { lastW = window.innerWidth; if (!sim) unmountOverlay(); } });

  // the strap drawn as an SVG path while it moves; it stays (straight) after landing, in place of the .strap div
  function mountOverlay() {
    const NS = "http://www.w3.org/2000/svg";
    overlay = document.createElementNS(NS, "svg");
    overlay.setAttribute("class", "swing-strap");
    overlay.setAttribute("aria-hidden", "true");
    pathEl = document.createElementNS(NS, "path");
    pathEl.setAttribute("id", "swing-strap-path");
    pathEl.setAttribute("fill", "none");
    pathEl.setAttribute("stroke", "#d6403a");
    pathEl.setAttribute("stroke-width", "28");
    const text = document.createElementNS(NS, "text");
    text.setAttribute("fill", "#3a0d0a");
    text.setAttribute("dominant-baseline", "central");
    text.setAttribute("style", "font:600 9px 'IBM Plex Mono',ui-monospace,Consolas,monospace;letter-spacing:.32em");
    const tp = document.createElementNS(NS, "textPath");
    tp.setAttribute("href", "#swing-strap-path");
    tp.setAttribute("text-anchor", "middle");
    tp.setAttribute("startOffset", G.textMid.toFixed(1));
    const words = (G.strap.textContent || "PATH TO GLORY").trim();
    tp.textContent = words + " · " + words;
    text.appendChild(tp);
    // nothing above the line where the static strap begins (hidden by the topbar on desktop, by the folder on phones)
    const clip = document.createElementNS(NS, "clipPath"), box = document.createElementNS(NS, "rect");
    clip.setAttribute("id", "swing-strap-clip");
    box.setAttribute("x", "-4000"); box.setAttribute("y", String(G.clipTop)); box.setAttribute("width", "8000"); box.setAttribute("height", "8000");
    clip.appendChild(box);
    const group = document.createElementNS(NS, "g");
    group.setAttribute("clip-path", "url(#swing-strap-clip)");
    group.append(pathEl, text);
    overlay.append(clip, group);
    G.lan.insertBefore(overlay, G.hook);
    G.strap.style.visibility = "hidden";
  }

  /* ---------------------------------------------------------------- start-up */
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const params = new URLSearchParams(location.search);
  let chosen = VARIANTS[+params.get("swing")] ? +params.get("swing") : 1, testMode = "off", played = false, picker = null;
  function setPending(on) { document.documentElement.classList.toggle("swing-pending", on); }

  // called by home.js once the hero badge is on the page; plays once per page load
  function play() {
    if (played) return;
    played = true;
    if (reduce) { setPending(false); return; }
    // on a first visit the card art and web fonts can still be downloading; if they land mid-swing, decoding the
    // art and swapping the fonts costs frames. So wait until they're ready (at most 1 s), then a painted frame.
    const ready = assetsReady(1000);
    const go = () => ready.then(() => requestAnimationFrame(() => requestAnimationFrame(() => { if (!start(chosen)) setPending(false); })));
    // start when the lanyard is actually on screen (at load on desktop; on phones, when scrolled to)
    const lan = document.querySelector(".lanyard");
    if (!lan || !("IntersectionObserver" in window)) return go();
    const io = new IntersectionObserver(entries => {
      if (entries.some(en => en.isIntersecting)) { io.disconnect(); clearTimeout(safety); go(); }
    }, { rootMargin: "0px 0px -25% 0px" });
    io.observe(lan);
  }
  // resolves once the hero card's images are decoded and the fonts are loaded, or after `cap` ms, whichever is first
  function assetsReady(cap) {
    const waits = Array.from(document.querySelectorAll("#hero-badge img"), img => img.decode ? img.decode().catch(() => {}) : null);
    if (document.fonts && document.fonts.ready) waits.push(document.fonts.ready.catch(() => {}));
    return Promise.race([Promise.all(waits), new Promise(r => setTimeout(r, cap))]);
  }
  // safety net: if the page never asks for the entrance (an error, no badge), show the lanyard anyway
  const safety = setTimeout(() => { if (!played) setPending(false); }, 5000);

  /* ---------------------------------------------------------------- picker (only with ?swing in the URL) */
  let hz = 0, hzN = 0, hzLast = 0;
  function measureHz(stamp) {
    if (hzLast) { const d = stamp - hzLast; if (d > 2 && d < 60) { hz = hz ? hz * .9 + (1000 / d) * .1 : 1000 / d; hzN++; } }
    hzLast = stamp;
    if (picker && hzN % 15 === 0) picker.querySelector("[data-hz]").textContent = hz ? "~" + Math.round(hz) + " fps drawn" : "";
  }
  function mountPicker() {
    const css = document.createElement("style");
    css.textContent = ".swing-picker{position:fixed;right:12px;bottom:72px;z-index:9999;width:min(330px,calc(100vw - 24px));background:#0f0b09f2;color:#f3f2ee;border:1px solid rgba(255,255,255,.18);box-shadow:0 18px 40px -12px #000;padding:12px;font:500 12px/1.4 'IBM Plex Mono',monospace}" +
      ".swing-picker b{display:block;font:800 13px/1 Archivo,sans-serif;letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px}" +
      ".swing-picker .row{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:8px}" +
      ".swing-picker button{font:inherit;color:inherit;background:#26201c;border:1px solid rgba(255,255,255,.2);padding:7px 6px;cursor:pointer}" +
      ".swing-picker button[aria-pressed=true]{background:#d6403a;border-color:#d6403a}" +
      ".swing-picker .note{color:#b7aa9d;min-height:3em;margin:0 0 8px}" +
      ".swing-picker .foot{display:flex;justify-content:space-between;gap:8px;color:#b7aa9d;margin-top:6px}";
    document.head.appendChild(css);
    picker = document.createElement("div");
    picker.className = "swing-picker";
    picker.innerHTML = "<b>Swing-in</b><div class='row'>" +
      Object.keys(VARIANTS).map(k => "<button type='button' data-k='" + k + "'>" + k + " " + VARIANTS[k].name + "</button>").join("") +
      "</div><p class='note' data-note></p><div class='row'>" +
      "<button type='button' data-m='off'>Normal</button><button type='button' data-m='30'>30 fps</button><button type='button' data-m='lag'>Lag spikes</button>" +
      "</div><button type='button' data-replay style='width:100%'>↻ Replay</button><div class='foot'><span data-state></span><span data-hz></span></div>";
    document.body.appendChild(picker);
    const sync = () => {
      picker.querySelectorAll("[data-k]").forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.k === chosen)));
      picker.querySelectorAll("[data-m]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.m === testMode)));
      picker.querySelector("[data-note]").textContent = VARIANTS[chosen].note;
    };
    const replay = () => {
      window.scrollTo({ top: 0, behavior: "instant" });
      picker.querySelector("[data-state]").textContent = "Playing";
      requestAnimationFrame(() => start(chosen));
    };
    picker.addEventListener("click", e => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.k) { chosen = +b.dataset.k; sync(); replay(); }
      else if (b.dataset.m) { testMode = b.dataset.m; sync(); replay(); }
      else if (b.hasAttribute("data-replay")) replay();
    });
    sync();
  }
  if (params.has("swing")) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountPicker); else mountPicker();
  }

  window.PTGSwing = { play, replay: k => start(k || chosen), variants: VARIANTS };
})();
