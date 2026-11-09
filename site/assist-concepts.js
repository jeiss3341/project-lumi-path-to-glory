/* Temporary: layouts for the Assistant & role coaches section, on the real cards and sample data.
   assist-concepts.html shows them all; assist-in-page.html shows them on the real site, under Faculty. */
(async function () {
  "use strict";
  const { esc } = UI, C = window.PTG, IN_PAGE = !!window.AC_IN_PAGE, EVERY = 4000, REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [coaches, hours] = await Promise.all([API.coaches(), API.allAvailability().catch(() => [])]);
  const A = coaches.filter(c => c.kind === "assistant");
  // ?n=10 tries the layouts with more coaches than the sample data has
  for (const n = +(new URLSearchParams(location.search).get("n") || 0); A.length < n;) A.push({ id: "x" + (A.length + 1), kind: "assistant", slot: A.length + 1, badge_id: "AST-05" + (11 + A.length) + "-RC", name: "" });
  const nm = a => UI.bare(UI.coachName(a)), by = id => A.find(a => a.id === id);
  const seed = a => C.coachSeed.find(c => c.id === a.id) || {};
  const book = a => "index.html?coach=" + encodeURIComponent(a.id) + "#book";
  const nextOpen = a => {
    const b = hours.filter(x => x.coach_id === a.id && new Date(x.ends_at).getTime() > UI.now()).sort((p, q) => p.starts_at.localeCompare(q.starts_at))[0];
    return b ? UI.date(b.starts_at, { weekday: "short", month: "short", day: "numeric" }) + " · " + UI.time(b.starts_at) + "–" + UI.time(b.ends_at) : "No hours posted yet";
  };

  /* the same wear, sticker and icon as the cards on the site */
  const WEAR = {
    scratches: '<path d="M118 9 L172 33"/><path class="faint" d="M128 6 L178 27"/><path d="M146 41 C158 45 172 47 192 54"/><path class="faint" d="M104 20 l9 3 M181 15 l6 4"/>',
    scuff: '<ellipse class="scuff" cx="26" cy="128" rx="44" ry="20"/><path d="M8 130 L62 108"/><path class="faint" d="M16 138 L54 121 M38 134 l16 -5"/><path d="M4 118 l6 -2"/>',
    gouge: '<path d="M4 76 C60 64 118 68 198 42"/><path class="faint" d="M10 81 C64 70 120 74 196 49"/><path class="faint" d="M70 30 l3 1 M150 96 l4 -1 M30 104 l2 2"/>',
    marked: '<path class="ink" d="M156 64 l6 7 l15 -17"/><path class="faint" d="M168 70 L194 58"/>',
    nicks: '<path d="M196 92 l-7 3 M197 99 l-5 1"/><path class="faint" d="M60 14 L96 6 M120 128 L160 118"/><ellipse class="scuff" cx="178" cy="18" rx="26" ry="12"/>'
  };
  const WEAR_BY_SLOT = ["", "scratches", "", "scuff", "gouge", "", "marked", "nicks"];
  const wear = a => { const w = WEAR[WEAR_BY_SLOT[A.indexOf(a) % WEAR_BY_SLOT.length]]; return w ? '<svg class="wear" viewBox="0 0 200 140" preserveAspectRatio="none" aria-hidden="true">' + w + "</svg>" : ""; };
  const sticker = a => { const s = a.sticker || seed(a).sticker, at = a.sticker_at || seed(a).sticker_at || {}; return s ? '<img class="mb-sticker" src="' + esc(s) + '" alt="" width="240" height="240" style="' + (at.top ? "top:" + esc(at.top) + ";" : "") + (at.tilt != null ? "--tilt:" + Number(at.tilt) + "deg" : "") + '">' : ""; };
  const icon = a => '<div class="mb-icon">' + (C.artHead && C.artHead[a.id] ? '<img src="' + esc(C.artHead[a.id]) + '" alt="">' : '<span class="mb-icon-ph" aria-hidden="true">?</span>') + "</div>";
  const nameLine = a => '<div class="mb-nameline"><div class="mb-name">[' + esc(nm(a)) + ']</div><span class="b-team">' + esc(UI.bare(UI.coachTeam(a))) + "</span></div>";
  const strip = '<div class="b-strip"><span>ROLE COACH · PTG</span></div>';
  const top = a => '<div class="b-top"><span class="b-dash"><i></i><i></i><i></i></span><span>' + esc(a.badge_id) + "</span></div>";
  const focus = a => '<div class="mb-focus">' + UI.ph(a.focus, "[Role focus]") + "<br>" + UI.ph((a.pool || []).join(", "), "[Characters or topics]") + "</div>";

  // the sub card: the one on the site, and clicking it shows that coach in the main section
  // data-c: its place in a checkerboard of two rows; data-p: its place in one row of alternating cards
  const sub = (a, on, i = A.indexOf(a)) => '<div class="mini-badge ac-sub' + (on ? " on" : "") + '" data-c="' + ((Math.floor(i / 2) + i) % 2) + '" data-p="' + (i % 2) + '">' + wear(a) + sticker(a) + strip + '<div class="mb-body">' + top(a) +
    '<div class="mb-role">Assistant</div>' + nameLine(a) + icon(a) + focus(a) +
    '<div class="mb-foot"><a href="' + book(a) + '">Request ›</a></div></div>' +
    '<button type="button" class="ac-hit" data-a="' + esc(a.id) + '" aria-pressed="' + on + '" aria-label="Show ' + esc(nm(a)) + ' in the main section"></button></div>';

  /* the main section, three ways */
  const bigBadge = a => '<article class="mini-badge ac-big">' + wear(a) + sticker(a) + strip + '<div class="mb-body">' + top(a) +
    '<div class="mb-role">Assistant</div>' + nameLine(a) + icon(a) + focus(a) +
    '<dl class="ac-facts"><dt>About</dt><dd>' + UI.ph(a.about, "[Short intro]") + "</dd><dt>Next open</dt><dd>" + esc(nextOpen(a)) + "</dd></dl>" +
    '<div class="ac-foot"><a class="ac-go" href="' + book(a) + '">Request a session ›</a></div></div></article>';
  const file = kraft => a => '<article class="' + (kraft ? "ac-file kraft" : "sheet ac-file") + '"><span class="mono-label">Role coach file · ' + esc(a.badge_id) + "</span>" +
    '<div class="ac-fh">' + icon(a) + "<div><h3>" + esc(nm(a)) + "</h3><p>Assistant · any team</p></div></div>" +
    '<dl class="sc-kv"><dt>Role focus</dt><dd>' + UI.ph(a.focus, "[Role focus]") + "</dd><dt>Characters</dt><dd>" + UI.ph((a.pool || []).join(", "), "[Characters or topics]") + "</dd><dt>Playstyle</dt><dd>" + UI.ph(a.playstyle, "[Playstyle]") + "</dd><dt>About</dt><dd>" + UI.ph(a.about, "[Short intro]") + "</dd><dt>Next open</dt><dd>" + esc(nextOpen(a)) + "</dd></dl>" +
    '<a class="btn" href="' + book(a) + '">Request a session</a></article>';
  const banner = a => '<article class="mini-badge ac-ban">' + wear(a) + strip + '<div class="ac-ban-body">' + icon(a) +
    "<div>" + top(a) + '<div class="mb-role">Assistant</div>' + nameLine(a) + focus(a) + "</div>" +
    '<div class="ac-ban-side"><dl class="ac-facts"><dt>About</dt><dd>' + UI.ph(a.about, "[Short intro]") + "</dd><dt>Next open</dt><dd>" + esc(nextOpen(a)) + '</dd></dl><a class="ac-go" href="' + book(a) + '">Request a session ›</a></div></div></article>';

  const tall = a => '<article class="ac-tall">' + UI.badge(a) + '<div class="ac-tall-side"><dl class="ac-facts"><dt>Role focus</dt><dd>' + UI.ph(a.focus, "[Role focus]") + "</dd><dt>Characters</dt><dd>" + UI.ph((a.pool || []).join(", "), "[Characters or topics]") + "</dd><dt>About</dt><dd>" + UI.ph(a.about, "[Short intro]") + "</dd><dt>Next open</dt><dd>" + esc(nextOpen(a)) + '</dd></dl><a class="ac-go" href="' + book(a) + '">Request a session ›</a></div></article>';

  const LAYOUTS = [
    { n: "Big badge", d: "The main section is the same badge, large. Every 4 seconds two cards slide off and two new ones come in.", main: bigBadge },
    { n: "Paper file", d: "The main section reads like the mentor files, with room for playstyle and an intro. The cards slide the same way.", main: file(false) },
    { n: "Only two cards", d: "A wider main section with just two cards showing. Both slide together and the next two come in.", main: bigBadge, cls: "two" },
    { n: "Rows take turns", d: "Four cards showing, but only one row moves each time: the top row slides, then the bottom row.", main: file(true), rows: true, cls: "rows" },
    { n: "Main on top", d: "The main section runs across the full width, with four cards in one row underneath. Two slide off each time. The Left and Right switch for the big section doesn't change this one.", main: banner, cls: "top" },
    { n: "Instructor card", d: "The main section is the tall card the mentors have, with the details beside it. Four small cards on the right.", main: tall },
    { n: "Instructor card, two cards", d: "The same tall card with more room for the details, and only two small cards showing.", main: tall, cls: "two" }
  ];

  // the same round arrows Faculty has
  const ARROWS = '<div class="arrows"><button type="button" class="arrow ac-arrow prev" aria-label="Previous coaches">←</button><button type="button" class="arrow ac-arrow" aria-label="Next coaches">→</button></div>';
  function mount(cfg, root) {
    const stage = root.querySelector(".ac-stage"), M = root.querySelector(".ac-main"), S = root.querySelector(".ac-subs"), L = root.querySelector(".ac-label"), bar = root.querySelector(".ac-bar");
    const n = A.length, views = [];
    S.innerHTML = '<div class="ac-view"><div class="ac-track"></div></div>' + (cfg.rows ? '<div class="ac-view"><div class="ac-track"></div></div>' : "");
    S.querySelectorAll(".ac-track").forEach(track => views.push({ track, vis: [] }));
    let main = A[0], head = 0, turn = 0, spare = [], busy = false, timer = 0, remain = EVERY, t0 = 0, hover = false, keyFocus = false, seen = false, lastSize = "";
    if (cfg.rows) { views[0].vis = A.slice(0, 2); views[1].vis = A.slice(2, 4); spare = A.slice(4); }
    const size = v => { const c = getComputedStyle(v.track); return { c: +c.getPropertyValue("--c"), r: +c.getPropertyValue("--r"), gap: parseFloat(c.columnGap) || 0 }; };
    const shown = v => { if (cfg.rows) return v.vis; const { c, r } = size(v); return Array.from({ length: c * r }, (_, i) => A[(head + i) % n]); };
    const toRight = () => document.body.dataset.dir === "right";
    const incoming = (v, right, back) => { if (cfg.rows) return back ? spare.slice(-2) : spare.slice(0, 2); if (right) return [0, 1].map(i => A[(head - 2 + i + n) % n]); const { c, r } = size(v); return [0, 1].map(i => A[(head + c * r + i) % n]); };
    const paintMain = anim => { M.innerHTML = cfg.main(main); if (anim) M.firstElementChild.classList.add("ac-in"); };
    const paintAll = () => { views.forEach(v => { v.track.innerHTML = shown(v).map(a => sub(a, a === main)).join(""); }); lastSize = views.map(v => { const z = size(v); return z.c + "x" + z.r; }).join(); };
    const mark = () => stage.querySelectorAll(".ac-sub").forEach(c => { const b = c.querySelector("[data-a]"), on = b.dataset.a === main.id; c.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
    const restartBar = () => { bar.innerHTML = "<i></i>"; };
    // two cards leave one side and two come in on the other; the cards already there just move over, so nothing redraws
    function step(right) {
      if (busy) return;
      // where rows take turns, the arrow against the slide direction undoes the last turn
      const back = cfg.rows && right !== toRight();
      if (back) turn = (turn + views.length - 1) % views.length;
      const v = cfg.rows ? views[turn] : views[0], { r, gap } = size(v), more = incoming(v, right, back);
      v.track.insertAdjacentHTML(right ? "afterbegin" : "beforeend", more.map(a => sub(a, a === main)).join(""));
      const dist = (2 / r) * (v.track.firstElementChild.offsetWidth + gap);
      const done = anim => {
        for (let i = 0; i < 2; i++) (right ? v.track.lastElementChild : v.track.firstElementChild).remove();
        if (anim) anim.cancel();
        if (cfg.rows) { const out = v.vis; if (back) { v.vis = spare.splice(-2); spare.unshift(...out); } else { v.vis = spare.splice(0, 2); spare.push(...out); turn = (turn + 1) % views.length; } }
        else head = (head + (right ? -2 : 2) + n) % n;
        busy = false;
      };
      if (REDUCED) return done(null);
      busy = true;
      const off = "translateX(" + (-dist) + "px)", still = "translateX(0)";
      const anim = v.track.animate(right ? [{ transform: off }, { transform: still }] : [{ transform: still }, { transform: off }], { duration: 520, easing: "cubic-bezier(.45,0,.2,1)", fill: "forwards" });
      anim.finished.then(() => done(anim), () => { busy = false; });
    }
    const want = () => seen && !hover && !keyFocus && !document.hidden && !REDUCED;
    function sync() {
      stage.classList.toggle("paused", !want());
      if (want()) { if (!timer) { t0 = Date.now(); timer = setTimeout(() => { timer = 0; remain = EVERY; step(toRight()); restartBar(); sync(); }, remain); } }
      else if (timer) { clearTimeout(timer); timer = 0; remain = Math.max(200, remain - (Date.now() - t0)); }
    }
    const reset = () => { if (timer) { clearTimeout(timer); timer = 0; } remain = EVERY; restartBar(); sync(); };
    stage.addEventListener("click", e => {
      const hit = e.target.closest("[data-a]");
      if (hit) { main = by(hit.dataset.a); paintMain(true); mark(); reset(); return; }
      // the left arrow brings in the cards to the left, so the row moves right; the right arrow is the opposite
      const go = e.target.closest(".ac-arrow");
      if (go) { step(go.classList.contains("prev")); reset(); }
    });
    stage.addEventListener("pointerenter", e => { if (e.pointerType !== "touch") { hover = true; sync(); } });
    stage.addEventListener("pointerleave", () => { hover = false; sync(); });
    stage.addEventListener("focusin", e => { keyFocus = e.target.matches(":focus-visible"); sync(); });
    stage.addEventListener("focusout", () => { keyFocus = false; sync(); });
    const off = new AbortController();
    document.addEventListener("visibilitychange", sync, { signal: off.signal });
    addEventListener("resize", () => { if (!busy && views.map(v => { const z = size(v); return z.c + "x" + z.r; }).join() !== lastSize) paintAll(); }, { signal: off.signal });
    const io = new IntersectionObserver(es => { seen = es[es.length - 1].isIntersecting; sync(); }, { threshold: .25 });
    io.observe(stage);
    L.textContent = n + " coaches";
    paintMain(false); paintAll(); restartBar();
    return () => { off.abort(); io.disconnect(); clearTimeout(timer); timer = 0; };   // used when the layout is swapped
  }

  const stageHTML = c => '<div class="ac-stage ' + (c.cls || "") + '"><div class="ac-main" aria-live="polite"></div>' +
    '<div class="ac-right"><div class="ac-subs"></div><div class="ac-meta"><span class="ac-label"></span><div class="ac-bar"></div>' + ARROWS + "</div></div></div>";
  const wire = (ctl, layout) => ctl.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.layout) layout(+b.dataset.layout);
    else { const key = ["side", "dir", "tilt"].find(k => b.dataset[k]); document.body.dataset[key] = b.dataset[key]; }
    b.parentNode.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
  });

  if (IN_PAGE) {
    const grid = document.getElementById("assist"), spot = document.createElement("div"), panel = document.createElement("div");
    const SIDES = [["left", "Left"], ["right", "Right"]], OPTIONS = [4, 5], seg = (label, key, val, opts = SIDES) => "<div" + (key === "side" ? ' class="ac-side"' : "") + ">" + label + ' <span class="bk-seg" role="group" aria-label="' + label + '">' +
      opts.map(([v, t]) => "<button type=\"button\" data-" + key + '="' + v + '" aria-pressed="' + (v === val) + '">' + t + "</button>").join("") + "</span></div>";
    grid.style.display = "none";   // home.js keeps drawing today's cards here; the layout shows in its place
    grid.after(spot);
    document.body.dataset.side = "left"; document.body.dataset.dir = "left"; document.body.dataset.tilt = "flat";
    panel.className = "ac-pick";
    panel.innerHTML = '<div class="ac-ctl"><div>Layout <span class="bk-seg" role="group" aria-label="Layout">' +
      OPTIONS.map(i => '<button type="button" data-layout="' + (i + 1) + '" aria-pressed="' + (i === 5) + '">' + (i + 1) + " " + esc(LAYOUTS[i].n) + "</button>").join("") + "</span></div>" +
      seg("Big section", "side", "left") + seg("Cards slide", "dir", "left") + seg("Small cards", "tilt", "flat", [["flat", "Straight"], ["one", "One way"], ["check", "Checkered"]]) + '<a href="assist-concepts.html">All 7 ›</a></div>';
    document.body.append(panel);
    const place = () => { const d = document.getElementById("demo-bar"); panel.style.bottom = (d ? d.offsetHeight : 0) + 12 + "px"; };
    place(); addEventListener("resize", place);
    let stop = null;
    const show = i => { if (stop) stop(); const c = LAYOUTS[i]; spot.innerHTML = stageHTML(c); stop = mount(c, spot); panel.querySelector(".ac-side").style.display = c.cls === "top" ? "none" : ""; };
    wire(panel.querySelector(".ac-ctl"), n => show(n - 1));
    show(5);
    const toFaculty = () => document.querySelector("#fac-badge").firstChild ? document.getElementById("faculty").scrollIntoView({ behavior: "instant" }) : setTimeout(toFaculty, 50);
    toFaculty();
    return;
  }

  const box = document.getElementById("concepts");
  box.innerHTML = LAYOUTS.map((c, i) => '<section class="ac-c"><h2><span>' + (i + 1) + "</span> · " + esc(c.n) + "</h2><p>" + esc(c.d) + "</p>" +
    stageHTML(c) + "</section>").join("");
  [...box.children].forEach((s, i) => mount(LAYOUTS[i], s));
  wire(document.querySelector(".ac-ctl"));
})();
