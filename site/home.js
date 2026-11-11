/* Path to Glory · public site (index.html). */
(function () {
  "use strict";
  const { $, $$, esc, pad } = UI;
  const C = window.PTG;
  const S = { me: null, coaches: [], teams: [], myReqs: [] };
  // office hours: the coach whose pop-up is open, the week shown, the picked start and length (half hours)
  const BK = { coach: null, wk: 1, start: null, len: 0, kind: "team", note: "", all: [], blocks: [], busy: [] };
  const HALF = 30 * 6e4;
  let watching = false, bookingWired = false, fi = 0, rv = null, animOK = false;

  const HOURS_PAGE = document.documentElement.classList.contains("hours-page");
  if (HOURS_PAGE) {   // the other sections live on the main page
    document.title = "Office Hours · Path to Glory";
    $$('.topbar nav a[href^="#"], main a[href^="#"]').forEach(a => { a.setAttribute("href", "index.html" + a.getAttribute("href")); });
  }
  renderStatic();
  boot();
  // narrower than the computer layout: shrink the whole top section to fit, keeping its arrangement
  function scaleHero() {
    const w = document.documentElement.clientWidth, hero = $(".hero");
    hero.style.zoom = innerWidth <= 1120 && innerWidth > 640 ? Math.min(1, w / 1180) : "";   // phones have their own layout
  }
  scaleHero();
  addEventListener("resize", scaleHero);
  // the ticket stops just above the bottom of the window, on whatever screen this is (above the demo bar if it's showing)
  function fitHero() {
    const sheet = $(".hero-sheet"), ticket = $(".ticket");
    if (!sheet || !ticket || HOURS_PAGE) return;
    sheet.style.minHeight = "";
    if (innerWidth <= 1120) return;
    const zoom = parseFloat(getComputedStyle(document.documentElement).zoom) || 1, bar = $("#demo-bar");
    const blocked = bar && !bar.classList.contains("min") ? bar.getBoundingClientRect().height : 0;
    const room = innerHeight - blocked - 14 - (ticket.getBoundingClientRect().bottom + scrollY);
    if (room > 0) sheet.style.minHeight = sheet.offsetHeight + Math.min(room, 220) / zoom + "px";
  }
  addEventListener("resize", fitHero);
  addEventListener("load", () => { fitHero(); setTimeout(fitHero, 700); });
  if (document.fonts) document.fonts.ready.then(fitHero);
  API.onAuth(() => boot());
  UI.mountDemoBar();
  if (!API.live && (window.PTG_CONFIG || {}).supabaseUrl) UI.toast("Couldn't reach the login service, so the site is showing demo data.", "bad");

  async function boot() {
    S.me = await API.session().catch(() => null);
    UI.mountAuth($("#auth"), S.me);
    const res = await Promise.all([
      API.coaches().catch(() => C.coachSeed.map(c => Object.assign({ pool: [], history: [] }, c))),
      API.teams().catch(() => [])
    ]);
    S.coaches = res[0]; S.teams = res[1];
    if (HOURS_PAGE) {
      const inEvent = S.me && (S.me.role === "staff" || S.me.is_student || S.coaches.some(c => c.profile_id === S.me.id) || S.teams.some(t => (t.member_ids || []).includes(S.me.id)));
      $("#bk-locked").style.display = inEvent ? "none" : "";
      $("#bk-cards").style.display = $("#my-req").style.display = inEvent ? "" : "none";
    }
    renderHeroBadge(); renderFaculty(); renderAssist(); renderRosters(); initBooking(); fitHero();
    if (window.PTGSwing) PTGSwing.play();   // hero lanyard swings in once the badge is on the page
    if (!watching) {
      watching = true;
      API.watch("requests", () => refreshBooking());
      API.watch("availability", () => refreshBooking());
    }
  }

  const mentors = () => S.coaches.filter(c => c.kind === "mentor");
  const assistants = () => S.coaches.filter(c => c.kind === "assistant");
  const coachById = id => S.coaches.find(c => c.id === id);

  // **words** → yellow highlighter, _words_ → red squiggle, \n → line break (applied after escaping)
  // (function declarations so they're ready before renderStatic() runs at the top)
  function marks(t) {
    return esc(t)
      .replace(/\*\*(.+?)\*\*/g, '<mark class="hl">$1</mark>')
      .replace(/(^|[^\w])_(.+?)_(?=[^\w]|$)/g, '$1<span class="squig">$2</span>')
      .replace(/\n/g, "<br>");
  }
  // text with blank lines → separate paragraphs; ~~words~~ → red pencil underline
  function paras(t) {
    return String(t).split(/\n\s*\n/).map(p => "<p>" + esc(p.trim()).replace(/\n/g, "<br>").replace(/~~(.+?)~~/g, '<span class="pencil-ul">$1</span>') + "</p>").join("");
  }
  // red pencil doodles for the mentor files (drawn with the #pencil filter, see styles.css .doodle)
  const DOODLE = {
    burst: '<svg class="doodle d-burst" viewBox="0 0 40 34" aria-hidden="true"><path d="M7 16 L4.5 5"/><path d="M15 21 L26 10.5"/><path d="M19 29.5 L35 27"/></svg>',
    sparkles: '<svg class="doodle d-spark" viewBox="0 0 64 40" aria-hidden="true"><path d="M17 3 C18 11 20 14 29 16 C20 18.5 18.5 21 17 30 C15.5 21 13.5 18.5 5 16.5 C13.5 14 15.5 11 17 3 Z"/><path d="M52 17 L51.5 33 M45 25.5 L59 24.5"/></svg>' +
      '<svg class="doodle d-plus" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 L11.5 22 M2.5 12.5 L21.5 11.5"/></svg>',
    // Ioo: sparkles around the name (plus signs on the left, a little burst and a four-point star on the right)
    namesparks: '<svg class="doodle d-name" viewBox="0 0 200 90" aria-hidden="true"><path d="M6 5 V21 M-1 13 H14"/><path d="M8 50 V62 M2 56 H14"/><path d="M195 6 L193 18 M187 13 L201 11 M189 7 L200 17"/>' +
      '<path d="M169 54 C170 63 172 67 181 70 C172 73 170 77 169 87 C167 77 165 73 157 70 C165 67 167 63 169 54 Z"/></svg>',
    // Ioo: Espurr, traced from the designer's own pencil sketch (site/art/doodles/espurr.png is a transparent mask, drawn in the doodle red by styles.css .d-espurr)
    espurr: '<span class="doodle d-espurr" aria-hidden="true"></span>',
    burger: '<svg class="doodle d-burger" viewBox="0 0 64 50" aria-hidden="true">' +
      '<path d="M8 22 C8 9 20 4 33 4 C46 4 57 10 57 22 Z"/>' +                 // top bun
      '<path d="M22 11 l2 -1 M31 9 l2 0.5 M40 11 l2 1 M27 16 l1.5 -1 M36 16 l2 0"/>' + // sesame
      '<path d="M5 26 C9 23 12 29 16 26 C20 23 23 29 27 26 C31 23 34 29 38 26 C42 23 45 29 49 26 C53 23 56 29 60 26"/>' + // lettuce
      '<path d="M7 30 H58 C60 30 60 36 58 36 H7 C5 36 5 30 7 30 Z"/>' +       // patty
      '<path d="M9 39 H56 C56 45 50 47 45 47 H19 C13 47 9 45 9 39 Z"/>' +       // bottom bun
      '<path d="M48 4 L55 1.5 M52 8 L60 7"/></svg>',
    // MapleStory nod on the back of the file: a maple leaf and a little mushroom
    maple: '<svg class="doodle d-leaf" viewBox="0 0 48 54" aria-hidden="true"><path d="M24 2 L28.5 12 L34.5 8.5 L32.5 20.5 L42 16 L39.5 24.5 L46.5 27.5 L36.5 34.5 L38.5 41 L27 38.5 L26.5 44 L21.5 44 L21 38.5 L9.5 41 L11.5 34.5 L1.5 27.5 L8.5 24.5 L6 16 L15.5 20.5 L13.5 8.5 L19.5 12 Z"/><path d="M24 15 L24 52"/><path d="M24 27 L33 21 M24 27 L15 21 M24 35 L31 31 M24 35 L17 31"/></svg>' +
      '<svg class="doodle d-shroom" viewBox="0 0 44 42" aria-hidden="true"><path d="M4 22 C4 9 13 3 22 3 C31 3 40 9 40 22 C33 25.5 11 25.5 4 22 Z"/><circle cx="15" cy="12" r="3"/><circle cx="28" cy="10" r="2.2"/><circle cx="32" cy="17" r="1.8"/><path d="M14 24.5 C13 32 13 37 17 39 C21 40.5 26 40.5 29 38.5 C32 36 31 30 30 24.5"/><path d="M18.5 30 l0 3 M25.5 30 l0 3"/></svg>'                            // little "fresh" marks
  };
  // small red pencil doodles that sit beside a section heading; "at" says which heading. Each mentor picks theirs in `doodles` (content.js).
  const dzh = (w, h, inner) => '<svg class="doodle dz-h" viewBox="0 0 ' + w + " " + h + '" style="width:' + Math.round(34 * w / h) + 'px" aria-hidden="true">' + inner + "</svg>";
  const HEAD_DOODLES = {
    // Fwitchu
    piggy: { at: "play", svg: dzh(50, 48, '<ellipse cx="23" cy="29" rx="15" ry="11"/><path d="M37 25 h7 v8 h-7"/><path d="M14 20 L13 13 L21 18"/><path d="M13 38 v7 M20 40 v5 M28 40 v5 M34 37 v7"/><circle class="dot" cx="31" cy="25" r="1.4"/><path d="M18 19 h9"/><circle cx="23" cy="7" r="5"/><path d="M8 27 q-5 -1 -4 -5"/>') },
    fish: { at: "fun", svg: dzh(60, 48, '<path d="M4 24 C14 8 32 8 42 24 C32 40 14 40 4 24 Z"/><path d="M42 24 L56 12 L52 24 L56 36 Z"/><circle class="dot" cx="13" cy="21" r="1.8"/><path d="M21 15 q5 9 0 18"/>') },
    catnap: { at: "coach", svg: dzh(66, 48, '<path d="M8 42 C4 28 8 20 8 9 L18 16 C22 14 27 14 31 16 L41 9 C41 20 45 28 41 42 C32 47 17 47 8 42 Z"/><path d="M14 29 q4 3 8 0 M27 29 q4 3 8 0"/><path d="M22 36 q2.5 3 5 0"/><path d="M50 15 h8 l-8 10 h8 M58 3 h6 l-6 7 h6"/>') },
    // Hresvelg
    rightwrong: { at: "play", svg: dzh(50, 32, '<path d="M3 18 l7 9 l14 -22"/><path d="M31 8 l15 18 M46 8 l-15 18"/>') },
    housefire: { at: "fun", svg: dzh(52, 48, '<path d="M8 46 V24 L26 10 L44 24 V46 Z"/><path d="M21 46 V34 h10 v12"/><path d="M31 14 C29 8 34 7 34 2 C40 7 43 11 41 20"/><path d="M12 21 C10 14 16 12 15 6 C21 10 24 12 22 16"/>').replace('dz-h"', 'dz-h dz-up-sm"') },
    bird: { at: "games", svg: dzh(48, 46, '<circle cx="24" cy="29" r="15"/><path d="M22 14 L18 5 M25 14 L27 3"/><path d="M13 23 L22 27 M35 23 L26 27"/><circle class="dot" cx="18.5" cy="29" r="1.7"/><circle class="dot" cx="29.5" cy="29" r="1.7"/><path d="M20 33 L24 40 L29 33 Z"/>').replace('dz-h"', 'dz-h dz-up-sm"') },
    // Isterio
    arrow: { at: "play", svg: dzh(62, 34, '<path d="M2 17 H56"/><path d="M45 6 L58 17 L45 28"/><path d="M6 8 h12 M4 26 h10"/>') },
    nocoffee: { at: "fun", svg: dzh(48, 48, '<path d="M10 16 H34 V34 C34 40 30 43 26 43 H18 C14 43 10 40 10 34 Z"/><path d="M34 20 h5 c5 0 5 12 0 12 h-5"/><path d="M17 11 q-3 -3 0 -7 M26 11 q-3 -3 0 -7"/><path d="M4 5 L45 46"/>') },
    shuttle: { at: "hobbies", svg: dzh(48, 48, '<circle cx="13" cy="36" r="7.5"/><path d="M8 30 L22 3 C32 3 42 12 45 24 L19 40"/><path d="M13.5 28.5 L32 6 M17 31 L39 13 M20 34 L43 19"/>') },
    // Kazcross
    mic: { at: "about", svg: dzh(48, 48, '<rect x="17" y="3" width="14" height="25" rx="7"/><path d="M10 21 C10 36 38 36 38 21"/><path d="M24 33 V43 M15 45 H33"/><path d="M18 11 h12 M18 16 h12 M18 21 h12"/>').replace('dz-h"', 'dz-h dz-up"') },
    btier: { at: "fun", svg: dzh(46, 46, '<rect x="4" y="4" width="38" height="38" rx="3"/><path d="M16 12 V34 M16 12 h9 c8 0 8 11 0 11 h-9 M16 23 h10 c9 0 9 11 0 11 h-10"/>') },
    wave: { at: "teams", svg: dzh(60, 36, '<path d="M2 28 C7 8 24 2 31 14 C25 11 20 17 26 23 C33 29 44 24 49 18 C50 24 54 27 58 28"/><path d="M2 34 C14 30 22 36 32 33 S50 31 58 34"/>') },
    // Magepower (plus the maple leaf and mushroom)
    paw: { at: "play", svg: dzh(48, 48, '<ellipse cx="24" cy="33" rx="10" ry="8"/><circle cx="9" cy="23" r="3.8"/><circle cx="18" cy="13" r="3.8"/><circle cx="30" cy="13" r="3.8"/><circle cx="39" cy="23" r="3.8"/><path d="M6 5 L43 45"/>') },
    mountain: { at: "fun", svg: dzh(50, 46, '<path d="M2 44 L19 15 L27 28 L33 20 L48 44 Z"/><path d="M19 15 V3 L29 7 L19 11"/><path d="M15 22 l4 3 l4 -3"/>') },
    // Ioo
    rings: { at: "hist", svg: dzh(60, 34, '<circle cx="13" cy="17" r="10.5"/><circle cx="30" cy="17" r="10.5"/><circle cx="47" cy="17" r="10.5"/>') },
    eye: { at: "coach", svg: dzh(48, 40, '<path d="M3 24 C13 9 35 9 45 24 C35 39 13 39 3 24 Z"/><circle cx="24" cy="24" r="7"/><circle class="dot" cx="24" cy="24" r="2.8"/><path d="M24 7 V1 M12 11 L9 6 M36 11 L39 6"/>') },
    bowl: { at: "fun", svg: dzh(50, 46, '<path d="M6 24 H42 C42 36 34 44 24 44 C14 44 6 36 6 24 Z"/><path d="M28 22 L41 3 M33 22 L46 6"/><path d="M14 18 q-3 -3 0 -7 M22 18 q-3 -3 0 -7"/>') },
    plane: { at: "hobbies", svg: dzh(50, 46, '<path d="M4 24 L46 5 L36 42 L22 31 Z"/><path d="M46 5 L22 31 L20 42 L27 35"/>') }
  };
  // back of the instructor ID badge: the mentor's self-ratings (1–5) as a six-sided chart, laid out like the front of the card
  const STAT_LABELS = [["Character", "flexibility"], ["Farming", "efficiency"], ["Aggressiveness"], ["APM"], ["Patience"], ["Greed"]];
  function statChart(stats) {
    const cx = 150, cy = 212, R = 84, MAX = 5;
    const at = (i, r) => { const a = (-90 + 60 * i) * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
    const pts = r => [0, 1, 2, 3, 4, 5].map(i => at(i, r).map(n => n.toFixed(1)).join(",")).join(" ");
    const rings = [5, 4, 3, 2, 1].map(k => '<polygon class="st-ring' + (k % 2 ? " alt" : "") + '" points="' + pts(R * k / MAX) + '"/>').join("");
    const spokes = [0, 1, 2].map(i => { const a = at(i, R), b = at(i + 3, R); return '<line class="st-spoke" x1="' + a[0] + '" y1="' + a[1] + '" x2="' + b[0] + '" y2="' + b[1] + '"/>'; }).join("");
    const val = i => Math.max(0, Math.min(MAX, Number(stats[i]) || 0));
    const shape = [0, 1, 2, 3, 4, 5].map(i => at(i, R * val(i) / MAX).map(n => n.toFixed(1)).join(",")).join(" ");
    const dots = [0, 1, 2, 3, 4, 5].map(i => { const p = at(i, R * val(i) / MAX); return '<circle class="st-dot" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="5"/>'; }).join("");
    const SPOT = [[150, 44, 96], [240, 104, 153], [232, 284, 316], [150, 336, 372], [68, 284, 316], [60, 117, 153]];   // x, first label line, number baseline
    const labels = STAT_LABELS.map((lines, i) => lines.map((t, n) => '<text class="st-label" x="' + SPOT[i][0] + '" y="' + (SPOT[i][1] + n * 13) + '">' + t.toUpperCase() + "</text>").join("") +
      '<text class="st-num" x="' + SPOT[i][0] + '" y="' + SPOT[i][2] + '">' + pad(val(i)) + "</text>").join("");
    return '<svg class="st-chart" viewBox="0 0 300 420" aria-hidden="true">' + rings + spokes + '<polygon class="st-shape" points="' + shape + '"/>' + dots + labels + "</svg>";
  }
  function badgeBack(m, hint) {
    return '<div class="badge badge-back"><div class="b-strip"><span>FACULTY · PATH TO GLORY</span></div><div class="b-body">' +
      '<div class="b-top"><span class="b-dash"><i></i><i></i><i></i></span><span>ID // 2026</span></div>' +
      '<div class="b-role">Stats</div>' +
      '<div class="b-row"><span class="b-id">' + esc(UI.cardId(m)) + '</span><span class="b-rated">Self-rated / 05</span></div>' +
      '<div class="b-art">' + hint + '<div class="ptg-art art-grid" style="position:relative;overflow:hidden;width:100%;height:100%">' + statChart(m.stats) + "</div></div>" +
      '<div class="b-name"><small>NAME</small><div class="b-nameline"><b>[' + esc(UI.bare(UI.coachName(m))) + ']</b><span class="b-team">' + esc(UI.bare(UI.coachTeam(m))) + "</span></div></div></div></div>";
  }
  // an instructor ID badge that flips over to their stats (click, tap, Enter or Space); without stats it's the plain badge.
  // Used by the Faculty card and the swinging card at the top of the page. onTurn runs after each flip.
  function flipBadge(box, m, onTurn) {
    if (!(m.kind === "mentor" && m.stats && m.stats.length === 6)) { box.innerHTML = UI.badge(m); return; }
    const hint = '<span class="b-flip-hint in-row" aria-hidden="true">Flip ↻</span>';
    const who = UI.bare(UI.coachName(m));
    const said = STAT_LABELS.map((l, k) => l.join(" ").toLowerCase() + " " + m.stats[k] + " of 5").join(", ");
    box.innerHTML = '<div class="badge-flip" role="button" tabindex="0" aria-pressed="false" aria-label="' + esc(who + "'s ID badge. Flip it to see their stats: " + said) + '">' +
      '<div class="badge-card"><div class="badge-face">' + UI.badge(m) + '</div><div class="badge-face back">' + badgeBack(m, "") + "</div></div></div>";   // no Flip label on the Stats side
    $(".badge-face .b-row", box).insertAdjacentHTML("beforeend", hint);   // front: level with the Subject ID
    const flipper = $(".badge-flip", box);
    const turn = () => { flipper.setAttribute("aria-pressed", String(flipper.classList.toggle("flipped"))); if (onTurn) onTurn(); };
    flipper.onclick = e => { if (!e.target.closest("button, a")) turn(); };   // staff "Adjust art" and the dak.gg name link keep working
    flipper.onkeydown = e => { if (e.target === flipper && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); turn(); } };
  }
  // competitive history line: a trailing "(...)" note drops onto its own line
  function histItem(h) {
    const m = String(h).match(/^(.*?)\s*(\([^()]*\))\s*$/);
    return m && m[1] ? "<li>" + fixes(esc(m[1])) + '<span class="hist-note">' + esc(m[2]) + "</span></li>" : "<li>" + fixes(esc(h)) + "</li>";
  }
  // {{old|new}} → old word struck through in red pencil with the correction scribbled underneath
  // [[text]] → text added by hand in red pencil (e.g. an extra "!")
  function fixes(html) {
    return html.replace(/\{\{(.+?)\|(.+?)\}\}/g, '<span class="pencil-fix"><s>$1</s><span class="fix" aria-label="corrected to $2">$2</span></span>')
      .replace(/\[\[(.+?)\]\]/g, (_, t) => t === "!"
        ? '<svg class="doodle d-bang" viewBox="0 0 10 28" role="img" aria-label="!"><path d="M5 2.5 L5 17"/><path d="M5 23.5 l.2 .3"/></svg>'
        : '<span class="pencil-add">' + t + "</span>");
  }
  // small black & white pfp for a character: art from PTG.charArt if there is a file, else a lettered placeholder
  function charPfp(name) {
    const file = name && C.charArt && C.charArt[name];
    if (file) return '<img src="' + esc(file) + '" alt="' + esc(name) + '">';
    return '<span class="pfp-ph" aria-hidden="true">' + esc((name || "?").charAt(0)) + "</span>";
  }
  /* ================================================== static content */
  function renderStatic() {
    $("#lede").textContent = C.event.pitch;
    $("#goal-line").textContent = C.event.goal;
    $("#pitch").textContent = C.event.pitch;
    $("#ticket-stub").insertAdjacentHTML("afterbegin", UI.barcode("PTG-1014", 60, 40, "1014"));
    const st = UI.status();
    $("#ticket-status").textContent = st.phase === "before" ? "Class starts in " + st.days + (st.days === 1 ? " day" : " days")
      : st.phase === "live" ? "In session · day " + st.day + " of 14" : "Class dismissed";
    // ticket button counts down to the next checkpoint Sunday
    const big = C.schedule.find(e => (e.kind === "mock" || e.kind === "final") && e.date >= UI.todayYmd());
    let cta = "NOW IN SESSION";
    if (st.phase === "after") cta = "GGS · THANKS FOR PLAYING";
    else if (st.phase === "before" || st.day === 1) cta = "DAY 1 · MON NOV 9";   // before the event and all through the first day
    else if (big) {
      const name = big.kind === "mock" ? "MOCK CHECKPOINT SERIES" : "FINAL CHECKPOINT SERIES";
      const n = Math.round((new Date(big.date + "T12:00:00") - new Date(UI.todayYmd() + "T12:00:00")) / 864e5);
      cta = name + "\n" + (n === 0 ? "TODAY" : n === 1 ? "TOMORROW" : "IN " + n + " DAYS");
    }
    $("#ticket-cta").textContent = cta;

    let done = [];
    try { done = JSON.parse(localStorage.getItem("ptg:goals")) || []; } catch (e) { /* storage blocked */ }
    $("#goal-list").innerHTML = C.goals.map((g, i) => '<label for="goal-' + i + '"><input type="checkbox" id="goal-' + i + '"' + (done.includes(i) ? " checked" : "") + "><span>" + esc(g) + "</span></label>").join("");
    $("#goal-list").addEventListener("change", () => {
      const v = C.goals.map((_, i) => i).filter(i => document.getElementById("goal-" + i).checked);
      try { localStorage.setItem("ptg:goals", JSON.stringify(v)); } catch (e) { /* storage blocked */ }
    });

    $("#steps").innerHTML = C.steps.map(s => "<li><span><b>" + marks(s.t) + "</b>" + marks(s.d) + "</span></li>").join("");
    $("#roles").innerHTML = C.roles.map(r => "<p><b>" + (r.icon ? '<span class="role-dot" aria-hidden="true">' + r.icon + "</span>" : "") + esc(r.name) + "</b><br>" + esc(r.d) + (r.alt ? ' <span class="alt">(aka ' + esc(r.alt.replace(/\.$/, "")) + ")</span>" : "") + "</p>").join("");

    renderSchedule();

    $("#res").innerHTML = C.resources.map(r => '<div class="index"><h3>' + esc(r.t) + "</h3><p>" + esc(r.d) + "</p></div>").join("");
    $("#expect").innerHTML = C.expectations.map(x => "<li>" + esc(x) + "</li>").join("");
    $("#sem-format").textContent = C.seminars.format;
    $("#sem").innerHTML = C.seminars.list.map(s => '<div class="sem"><span class="w">' + esc(s.label || C.seminars.where) + "</span>" +
      (s.note ? "<b>" + esc(s.title) + '</b><span class="d n">' + esc(s.note) + "</span>"   // a plain note, e.g. "coming soon"
        : "<b>" + UI.ph("", s.title) + '</b><span class="d">Host: ' + UI.ph("", s.host) + "<br>" + UI.ph("", s.when) + "</span>") + "</div>").join("");
    $("#links").innerHTML = C.links.map(l =>
      '<a class="link' + (l.logo ? " has-logo" : "") + '" href="' + esc(l.url) + '" target="_blank" rel="noopener"><span class="tier"><span>' + esc(l.tag) + '</span></span><div class="lb"><h3>' + esc(l.name) + "</h3><p>" + esc(l.d) + '</p><span class="go">Join on Discord ↗</span></div>' +
      (l.logo ? '<img class="link-logo" src="' + esc(l.logo) + '" alt="" width="240" height="230">' : "") + "</a>").join("");
  }

  function renderSchedule() {
    const days = UI.eventDays(), todayY = UI.todayYmd();
    let sel = (C.schedule.find(e => e.date >= todayY) || C.schedule[C.schedule.length - 1]).date;
    $("#dows").innerHTML = days.slice(0, 7).map(d => "<span>" + d.dow + "</span>").join("");
    const label = ["", "Week 1 · Scrims → Mock Checkpoint Series", "Week 2 · Prio scrims → Final Checkpoint Series"];
    // scrim days get the Project Lumi SCRIM sticker instead of a text tag,
    // slapped on at a random-looking spot and angle (seeded by the date, so it stays put between visits)
    const stickerSpot = ymd => {
      let h = 2166136261;
      for (const c of ymd) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
      const r = () => { // mulberry32
        h = (h + 0x6D2B79F5) | 0;
        let t = Math.imul(h ^ (h >>> 15), 1 | h);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      const nudgeX = { "2026-11-19": 7 }[ymd] || 0;   // hand-placed tweaks, in % of the day's width (Nov 19 sat a little too far left)
      return "--sx:" + (Math.round(2 + r() * 38) + nudgeX) + "%;--sy:" + Math.round(38 + r() * 10) + "%;--sr:" + (ymd === "2026-11-18" ? -4 : Math.round(-14 + r() * 28)) + "deg";   // Nov 18 landed perfectly straight, so it gets a slight lean by hand
    };
    const chip = ev => ev.kind === "scrim" && !ev.fcfs ? '<img class="scrim-sticker" src="art/scrim-sticker.svg" alt="" width="240" height="240" style="' + stickerSpot(ev.date) + '">' : '<span class="chip ' + (ev.fcfs ? "fcfs" : ev.kind) + (ev.tentative ? " tbc" : "") + '">' + esc(ev.short) + "</span>";
    $("#weeks").innerHTML = [1, 2].map(w => '<div class="wk">' + label[w] + '</div><div class="week">' +
      days.filter(d => d.week === w).map(d => '<button class="day" data-iso="' + d.ymd + '" aria-pressed="false" aria-label="' +
        esc(UI.date(d.d, { weekday: "long", month: "long", day: "numeric" }) + (d.events.length ? ", " + d.events.map(e => e.title).join(", ") : ", open day")) + '"><span class="num">' + d.n + "</span>" +
        (d.ymd === todayY ? '<span class="today" title="Today"></span>' : "") + d.events.map(chip).join("") + "</button>").join("") + "</div>").join("");
    const scrimCord = C.links.find(l => /scrim/i.test(l.name));   // scrim days link to the Scrim Cord too
    function detail() {
      const d = days.find(x => x.ymd === sel);
      $$(".day").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.iso === sel)));
      const body = d.events.length ? d.events.map(ev => "<h3>" + esc(ev.title) + "</h3>" + (ev.tentative ? '<span class="tbc-note">Tentative day</span>' : "") +
        "<p>" + esc(ev.note) + '</p><div class="dd-acts"><a class="btn" href="' + esc(UI.gcal(ev)) + '" target="_blank" rel="noopener">Add to Google Calendar ↗</a>' + (ev.kind === "scrim" && scrimCord ? '<a class="btn ghost" href="' + esc(scrimCord.url) + '" target="_blank" rel="noopener">Scrim Hub ↗</a>' : "") + "</div>").join("")
        : "<h3>Open day</h3><p>No group event. A good day to request a session with your mentor or an assistant coach.</p>";
      $("#day-detail").innerHTML = '<p class="dd-date">' + esc(UI.date(d.d, { weekday: "long", month: "long", day: "numeric" })) + "</p>" + body +
        '<ul class="agenda">' + C.schedule.map(ev => '<li><button data-iso="' + ev.date + '"' + (ev.date === sel ? ' aria-current="true"' : "") + '><span class="d">' +
          esc(UI.date(ev.date + "T12:00:00", { month: "short", day: "numeric" })) + '</span><span class="t">' + esc(ev.title) + "</span></button></li>").join("") + "</ul>";
    }
    $("#schedule").addEventListener("click", e => { const b = e.target.closest(".day, .agenda button"); if (b) { sel = b.dataset.iso; detail(); } });
    detail();
  }

  /* ================================================== faculty + rosters */
  // the swinging card is a random mentor or assistant who has a picture, picked once per page load so a redraw can't change it.
  // This browser remembers the last 5 cards it showed and skips them, so a reload never repeats a recent one.
  let heroPick = null;
  const HERO_SKIP = 5, HERO_KEY = "ptg-hero-recent";
  function renderHeroBadge() {
    const ms = S.coaches.filter(c => UI.artSrc(c));
    let m = ms.find(x => x.id === heroPick);
    if (!m && ms.length) {
      let recent = [];
      try { recent = JSON.parse(localStorage.getItem(HERO_KEY)) || []; } catch (e) { /* storage blocked */ }
      const fresh = ms.filter(c => !recent.slice(-Math.min(HERO_SKIP, ms.length - 1)).includes(c.id));
      m = fresh[Math.floor(Math.random() * fresh.length)];
      try { localStorage.setItem(HERO_KEY, JSON.stringify(recent.concat(m.id).slice(-HERO_SKIP))); } catch (e) { /* storage blocked or full */ }
    }
    heroPick = m ? m.id : null;
    if (m) flipBadge($("#hero-badge"), m); else $("#hero-badge").innerHTML = "";   // instructors flip to their stats here too
    preloadArt();
  }

  // once the page has loaded, every card picture downloads in the background, so a card that switches in shows its art right away
  const artReady = new Map();
  function preloadArt() {
    const go = () => S.coaches.forEach(c => [UI.artSrc(c), UI.headSrc(c)].forEach(src => {
      if (!src || artReady.has(src)) return;
      const img = new Image();
      img.decoding = "async";
      img.src = src;
      artReady.set(src, img);   // kept, so the browser holds on to the decoded picture
    }));
    if (document.readyState === "complete") setTimeout(go, 300);
    else addEventListener("load", () => setTimeout(go, 300), { once: true });
  }

  /* Faculty moves to the next mentor every 12 seconds, on computers and tablets only (a phone's file is long enough
     that it would change while someone reads it). Any hover, focus or manual change starts the 12 seconds over,
     and it holds while the file is flipped or the section isn't mostly on screen. */
  const FAC_EVERY = 12000;
  const FAC = { timer: 0, hover: false, keys: false, seen: false, wired: false, next: null };
  function facSync() {
    clearTimeout(FAC.timer);
    const run = FAC.next && FAC.seen && !FAC.hover && !FAC.keys && !document.hidden && !AS_CALM && innerWidth > 640 && !$("#fac-info").classList.contains("flipped") && !$("#fac-badge .badge-flip.flipped");
    $(".fac-nav").classList.toggle("paused", !run);
    $("#fac-bar").innerHTML = "<i></i>";   // the bar starts over with the timer, and waits while paused
    if (run) FAC.timer = setTimeout(FAC.next, FAC_EVERY);
  }
  function wireFacultySlideshow() {
    if (FAC.wired) return;
    FAC.wired = true;
    [$("#fac"), $(".fac-nav")].forEach(el => {
      el.addEventListener("pointerenter", e => { if (e.pointerType !== "touch") { FAC.hover = true; facSync(); } });
      el.addEventListener("pointerleave", () => { FAC.hover = false; facSync(); });
      el.addEventListener("focusin", e => { FAC.keys = e.target.matches(":focus-visible"); facSync(); });
      el.addEventListener("focusout", () => { FAC.keys = false; facSync(); });
    });
    document.addEventListener("visibilitychange", facSync);
    new IntersectionObserver(es => { FAC.seen = es[es.length - 1].isIntersecting; facSync(); }, { threshold: .5 }).observe($("#fac"));
  }

  function renderFaculty() {
    const ms = mentors();
    if (!ms.length) return;
    $("#fac-tabs").innerHTML = ms.map((m, i) => '<button class="tab" role="tab" id="ft-' + i + '" aria-controls="fac" aria-selected="false" data-i="' + i + '">' + pad(m.slot) + " " + esc(UI.bare(UI.coachName(m))) + "</button>").join("");
    function show(i, focus) {
      fi = (i + ms.length) % ms.length;
      const m = ms[fi];
      // the ID badge flips over to the mentor's self-rated stats
      flipBadge($("#fac-badge"), m, facSync);   // the slideshow waits while the badge is turned over
      const top = side => '<div class="info-top"><span>Mentor file ' + pad(m.slot) + " / " + pad(ms.length) + side + "</span><span>" + esc(UI.cardId(m)) + "</span></div>";
      const chips = (list, ph) => list && list.length ? list.map(p => "<span>" + esc(p) + "</span>").join("") : ph;
      const flipBtn = label => '<button type="button" class="flip-btn js-flip" aria-pressed="false">' + label + "</button>";
      const dz = k => (m.doodles || []).includes(k); // red pencil doodles this mentor's file gets
      const dh = slot => (m.doodles || []).filter(k => HEAD_DOODLES[k] && HEAD_DOODLES[k].at === slot).map(k => HEAD_DOODLES[k].svg).join(""); // ones that sit beside a section heading
      const front =
        '<article class="sheet info face front">' + top("") +
        "<h3>" + UI.dakLink(m, UI.ph(m.name, UI.coachName(m))) + (dz("burst") ? DOODLE.burst : "") + (dz("namesparks") ? DOODLE.namesparks : "") + "</h3>" + (dz("espurr") ? DOODLE.espurr : "") +
        '<span class="team-tag">' + esc(UI.bare(UI.coachTeam(m))) + "</span>" +
        (m.name_sticker ? '<img class="name-sticker" src="' + esc(m.name_sticker) + '" alt="" width="280" height="280">' : "") +   // round pin up in the top-right, beside the name
        '<div class="info-grid' + (m.photo_sticker ? " has-photo" : "") + '">' +   // with a photo, Playstyle fills the left and the rest stacks on the right
          '<section class="play-sec"><h4>Playstyle' + dh("play") + "</h4>" + (m.playstyle ? paras(m.playstyle) : "<p>" + UI.ph("", "[One or two lines on how this mentor plays and what they focus on in review.]") + "</p>") +
            (m.photo_sticker ? '<img class="photo-sticker" src="' + esc(m.photo_sticker) + '" alt="" width="691" height="699">' : "") + "</section>" +
          '<section class="pool-sec"><h4>Character pool</h4>' + (dz("sparkles") ? DOODLE.sparkles : "") + (dz("smile") ? '<span class="scribble s-smile" aria-hidden="true">^_^</span>' : "") +
            (m.pool && m.pool.length
              ? '<div class="pfp" aria-live="polite">' + charPfp(m.pool[0]) + '</div><div class="pool pool-pick">' +
                m.pool.map((p, k) => '<button type="button" class="pool-chip' + (k ? "" : " on") + '" data-char="' + esc(p) + '">' + esc(p) + "</button>").join("") + "</div>" +
                (m.pool_note ? '<p class="pool-note">' + esc(m.pool_note) + "</p>" : "")
              : '<div class="pfp">' + charPfp("") + '</div><div class="pool"><span class="ph">[Main]</span><span class="ph">[Secondary]</span><span class="ph">[Pocket pick]</span></div>') +
            (m.file_sticker ? '<img class="file-sticker" src="' + esc(m.file_sticker) + '" alt="" width="200" height="200"' + (m.file_sticker_px ? ' style="width:' + Number(m.file_sticker_px) + 'px"' : "") + ">" : "") +
          "</section>" +
          '<section class="hist-sec"><h4>Competitive history' + dh("hist") + '</h4><ul class="hist">' + (m.history && m.history.length ? m.history.map(histItem).join("") : '<li><span class="ph">[ERCS qualifier · result]</span></li><li><span class="ph">[ERCC / T2 event · placement]</span></li>') + "</ul>" + (dz("burger") ? DOODLE.burger : "") +
            (m.hist_sticker ? '<img class="hist-sticker" src="' + esc(m.hist_sticker) + '" alt="" width="200" height="200">' : "") + "</section>" +
          "<section><h4>About me" + dh("about") + "</h4>" + (m.about ? paras(m.about) : "<p>" + UI.ph("", "[A short about-me written by the mentor.]") + "</p>") + "</section>" +
        "</div>" +
        '<div class="info-foot">' + (m.foot_sticker ? '<img class="foot-sticker" src="' + esc(m.foot_sticker) + '" alt="" width="440" height="209">' : "") + '<span class="foot-btns">' + flipBtn("Flip file ↻") + '<a class="btn" href="index.html?hours&coach=' + encodeURIComponent(m.id) + '">Request a session</a></span>' +
          (m.foot_scribble ? '<span class="scribble s-foot" aria-hidden="true">' + esc(m.foot_scribble).replace(/\n/g, "<br>") + "</span>" : "") + "</div>" +
        "</article>";
      const back =
        '<article class="sheet info face back" inert>' + top(" · back") +
        '<div class="back-head"><h3>' + UI.dakLink(m, UI.ph(m.name, UI.coachName(m))) + '</h3><span class="stamp">Off the record</span></div>' +
        '<div class="info-grid">' +
          '<section class="wide"><h4>Coaching style' + dh("coach") + "</h4>" + (m.coaching ? paras(m.coaching) : "<p>" + UI.ph("", "[How this mentor likes to coach.]") + "</p>") +
            (m.motto ? '<p class="motto">“' + esc(m.motto) + "”</p>" : "") +
            (m.back_sticker ? '<span class="back-sticker" aria-hidden="true">' + esc(m.back_sticker) + "</span>" : "") + "</section>" +
          '<section class="games-sec"><h4>Other games played' + dh("games") + "</h4>" + (dz("maple") ? DOODLE.maple : "") + '<div class="pool">' + chips(m.games, '<span class="ph">[Game]</span><span class="ph">[Game]</span>') + "</div></section>" +
          '<section><h4>Favorite hobbies' + dh("hobbies") + '</h4><ul class="hist">' + (m.hobbies && m.hobbies.length ? m.hobbies.map(h => "<li>" + esc(h) + "</li>").join("") : '<li><span class="ph">[Hobby]</span></li>') + "</ul></section>" +
          '<section><h4>Fav teams' + dh("teams") + '</h4><ul class="hist">' + (m.fav_teams && m.fav_teams.length ? m.fav_teams.map(h => "<li>" + esc(h) + "</li>").join("") : '<li><span class="ph">[Team · player]</span></li>') + "</ul></section>" +
          '<section><h4>Fun fact' + dh("fun") + '</h4><p class="fun">' + (m.fun_fact ? esc(m.fun_fact).replace(/\n/g, "<br>") : UI.ph("", "[Something fun about this mentor.]")) + "</p></section>" +
          (m.ps && m.ps.length ? '<section class="wide"><h4>P.S.</h4><ul class="hist ps">' + m.ps.map(h => "<li>" + esc(h) + "</li>").join("") + "</ul></section>" : "") +
        "</div>" +
        '<div class="info-foot"><span>Click the file to flip it back</span>' + flipBtn("Flip back ↺") + "</div>" +
        "</article>";
      const box = $("#fac-info");
      box.classList.remove("flipped");
      box.innerHTML = '<div class="flip-card">' + front + back + "</div>";
      // the file is only as tall as the side facing up (no empty space under the shorter side)
      // "Off the record" stays to the right of the name: next to a long name the stamp shrinks to fit (phones still stack them)
      const fitStamp = () => {
        const head = $(".back-head", box), st = $(".stamp", head), h = $("h3", head);
        st.style.fontSize = "";
        const room = head.clientWidth - h.offsetWidth - 16 - 6, frame = 40;   // gap, a little for the tilt, padding + border
        if (st.offsetWidth <= room) return;
        const size = parseFloat(getComputedStyle(st).fontSize) * (room - frame) / (st.offsetWidth - frame);
        if (size >= 13) st.style.fontSize = size + "px";
      };
      const fitFile = () => { fitStamp(); const up = $(box.classList.contains("flipped") ? ".face.back" : ".face.front", box); if (up) $(".flip-card", box).style.height = up.offsetHeight + "px"; };
      fitFile();
      if (document.fonts) document.fonts.ready.then(fitFile); // web fonts can change the height once they load
      if (!window.__ptgFitFile) { window.__ptgFitFile = true; addEventListener("resize", () => { if (box.__fit) box.__fit(); }); }
      box.__fit = fitFile;
      // character pool: hovering (or tapping / tabbing to) a character swaps the pfp above the pool
      const pick = $(".pool-pick", box), pfp = $(".front .pfp", box);
      if (pick && pfp) {
        const showChar = chip => {
          if (!chip || chip.classList.contains("on")) return;
          $$(".pool-chip", pick).forEach(c => c.classList.toggle("on", c === chip));
          pfp.innerHTML = charPfp(chip.dataset.char);
        };
        pick.onmouseover = e => showChar(e.target.closest(".pool-chip"));
        pick.onfocusin = e => showChar(e.target.closest(".pool-chip"));
        pick.onclick = e => showChar(e.target.closest(".pool-chip"));
      }
      // flip on click anywhere on the file (links and buttons other than the flip button keep their own job)
      box.onclick = e => {
        if (e.target.closest("a, select, input, textarea") || (e.target.closest("button") && !e.target.closest(".js-flip"))) return;
        if (window.getSelection && String(window.getSelection()).length) return; // let people select text
        const on = box.classList.toggle("flipped");
        $$(".js-flip", box).forEach(b => b.setAttribute("aria-pressed", String(on)));
        $(".face.front", box).inert = on;  // only the side facing up can be read or tabbed into
        $(".face.back", box).inert = !on;
        fitFile();
        const target = $(on ? ".face.back .js-flip" : ".face.front .js-flip", box);
        if (e.target.closest(".js-flip") && target) target.focus({ preventScroll: true });
        facSync();
      };
      if (animOK) ["#fac-badge", "#fac-info"].forEach(s => { const el = $(s); el.classList.remove("swap"); void el.offsetWidth; el.classList.add("swap"); });
      $$("#fac-tabs .tab").forEach((t, j) => { t.setAttribute("aria-selected", String(j === fi)); t.tabIndex = j === fi ? 0 : -1; });
      const onTab = document.getElementById("ft-" + fi);
      onTab.parentNode.scrollLeft = onTab.offsetLeft - 16;   // phones: the tabs scroll sideways, so keep this one in view
      if (focus) document.getElementById("ft-" + fi).focus();
      facSync();
    }
    $("#fac-tabs").onclick = e => { const t = e.target.closest(".tab"); if (t) show(+t.dataset.i); };
    $("#fac-tabs").onkeydown = e => {
      if (e.key === "ArrowRight") { e.preventDefault(); show(fi + 1, true); }
      if (e.key === "ArrowLeft") { e.preventDefault(); show(fi - 1, true); }
    };
    $("#prev").onclick = () => show(fi - 1);
    $("#next").onclick = () => show(fi + 1);
    FAC.next = () => show(fi + 1);
    $("#fac-count").textContent = ms.length + " mentors";
    wireFacultySlideshow();
    S.showMentor = id => { const i = ms.findIndex(m => m.id === id); if (i >= 0) show(i); };
    show(Math.min(fi, ms.length - 1));
    animOK = true;
  }

  // wear and tear on some assistant badges so they don't all look fresh off the printer
  const WEAR = {
    scratches: '<path d="M118 9 L172 33"/><path class="faint" d="M128 6 L178 27"/><path d="M146 41 C158 45 172 47 192 54"/><path class="faint" d="M104 20 l9 3 M181 15 l6 4"/>',
    scuff: '<ellipse class="scuff" cx="26" cy="128" rx="44" ry="20"/><path d="M8 130 L62 108"/><path class="faint" d="M16 138 L54 121 M38 134 l16 -5"/><path d="M4 118 l6 -2"/>',
    gouge: '<path d="M4 76 C60 64 118 68 198 42"/><path class="faint" d="M10 81 C64 70 120 74 196 49"/><path class="faint" d="M70 30 l3 1 M150 96 l4 -1 M30 104 l2 2"/>',
    marked: '<path class="ink" d="M156 64 l6 7 l15 -17"/><path class="faint" d="M168 70 L194 58"/>',
    nicks: '<path d="M196 92 l-7 3 M197 99 l-5 1"/><path class="faint" d="M60 14 L96 6 M120 128 L160 118"/><ellipse class="scuff" cx="178" cy="18" rx="26" ry="12"/>'
  };
  const WEAR_BY_SLOT = ["", "scratches", "", "scuff", "gouge", "", "marked", "nicks"]; // a1..a8; blank = clean card
  /* Assistant & role coaches: four small cards, sliding along every 8 seconds, and a tall card that snakes through them (or shows the coach you click).
     The slide stops while the mouse or keyboard is on the section, so nothing moves as you go to click. */
  const AS_EVERY = 8000, AS_CALM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const AS = { list: [], main: null, head: 0, busy: false, draw: 0, timer: 0, left: AS_EVERY, t0: 0, hover: false, keys: false, seen: false, wired: false };
  const asMoves = () => AS.list.length > 4;

  function assistCard(a, on) {
    const seed = C.coachSeed.find(c => c.id === a.id) || {}, name = UI.bare(UI.coachName(a));
    const wear = WEAR[WEAR_BY_SLOT[AS.list.indexOf(a) % WEAR_BY_SLOT.length]];
    const sticker = a.sticker || seed.sticker, at = a.sticker_at || seed.sticker_at || {}; // sticker_at: { top: "30%", tilt: -14 }
    return '<div class="mini-badge as-card' + (on ? " on" : "") + '">' +
      (wear ? '<svg class="wear" viewBox="0 0 200 140" preserveAspectRatio="none" aria-hidden="true">' + wear + "</svg>" : "") +
      // optional sticker slapped on the empty right side (from the coach row, or the event content as a fallback)
      (sticker ? '<img class="mb-sticker" src="' + esc(sticker) + '" alt="" width="240" height="240" style="' + (at.top ? "top:" + esc(at.top) + ";" : "") + (at.tilt != null ? "--tilt:" + Number(at.tilt) + "deg" : "") + '">' : "") +
      '<div class="b-strip"><span>FACULTY · PATH TO GLORY</span></div><div class="mb-body">' +
      '<div class="b-top"><span class="b-dash"><i></i><i></i><i></i></span><span>' + esc(UI.cardId(a)) + "</span></div>" +
      '<div class="mb-role">Assistant</div><div class="mb-nameline"><div class="mb-name">' + UI.dakLink(a, "[" + esc(name) + "]") + '</div><span class="b-team">' + esc(UI.bare(UI.coachTeam(a))) + "</span></div>" +
      // icon between the name and the role focus: a headshot from PTG.artHead (e.g. a1: "art/heads/a1.webp"), else an empty slot
      UI.headIcon(a, name) +
      '<div class="mb-focus">' + UI.ph(a.focus, "[Role focus]") + "<br>" + UI.ph((a.pool || []).join(", "), "[Characters or topics]") + "</div>" +
      '<div class="mb-foot"><a href="index.html?hours&coach=' + encodeURIComponent(a.id) + '">Request ›</a></div></div>' +
      '<button type="button" class="as-hit" data-a="' + esc(a.id) + '" aria-pressed="' + !!on + '" aria-label="Show ' + esc(name) + ' on the big card"></button></div>';
  }

  // the "next open" line on the tall card; runs again whenever the office hours reload
  function asOpen() {
    const el = $("#as-open");
    if (!el || !AS.main) return;
    const next = nextHours(AS.main);
    el.textContent = next ? hoursLabel(next) : "No hours posted yet";
  }
  function asPaintMain(fade) {
    const a = AS.main, box = $("#assist .as-main");
    box.innerHTML = '<article class="as-tall"><div class="as-badge">' + UI.badge(a) + '</div><div class="as-side"><dl class="as-facts"><dt>Role focus</dt><dd>' + UI.ph(a.focus, "[Role focus]") +
      "</dd><dt>Characters</dt><dd>" + UI.ph((a.pool || []).join(", "), "[Characters or topics]") +
      '</dd><dt>Next open</dt><dd id="as-open"></dd></dl><a class="as-go" href="index.html?hours&coach=' + encodeURIComponent(a.id) + '">Request a session ›</a></div></article>';
    if (fade) $(".as-badge", box).classList.add("swap");   // the same little rise as the Instructor card, on the wrapper so the card keeps its tilt
    asOpen();
  }
  function asMark() {
    $$("#assist .as-pick").forEach(t => t.setAttribute("aria-selected", String(t.dataset.a === AS.main.id)));
    $$("#assist .as-card").forEach(card => {
      const hit = $(".as-hit", card), on = hit.dataset.a === AS.main.id;
      card.classList.toggle("on", on);
      hit.setAttribute("aria-pressed", String(on));
    });
  }
  const asRestartBar = () => { const bar = $("#assist .as-bar"); if (bar) bar.innerHTML = "<i></i>"; };

  // two cards leave one side and two come in on the other; the cards already there just move over, so nothing redraws
  function asStep(right) {
    if (AS.busy || !asMoves()) return;
    const n = AS.list.length, track = $("#assist .as-track"), draw = AS.draw;
    const more = [0, 1].map(i => AS.list[(right ? AS.head - 2 + i + n : AS.head + 4 + i) % n]);
    track.insertAdjacentHTML(right ? "afterbegin" : "beforeend", more.map(a => assistCard(a, a === AS.main)).join(""));
    const finish = () => {
      if (draw !== AS.draw) return;   // the section was redrawn in the meantime
      for (let i = 0; i < 2; i++) (right ? track.lastElementChild : track.firstElementChild).remove();
      AS.head = (AS.head + (right ? -2 : 2) + n) % n;
      AS.busy = false;
    };
    if (AS_CALM) return finish();
    AS.busy = true;
    const off = "translateX(" + -(track.firstElementChild.offsetWidth + parseFloat(getComputedStyle(track).columnGap)) + "px)", still = "translateX(0)";
    const anim = track.animate(right ? [{ transform: off }, { transform: still }] : [{ transform: still }, { transform: off }], { duration: 520, easing: "cubic-bezier(.45,0,.2,1)", fill: "forwards" });
    anim.finished.then(() => { finish(); anim.cancel(); }, () => { if (draw === AS.draw) AS.busy = false; });
  }

  const asShouldRun = () => asMoves() && AS.seen && !AS.hover && !AS.keys && !document.hidden && !AS_CALM;
  function asSync() {
    const run = asShouldRun();
    $("#assist").classList.toggle("paused", !run);
    if (run && !AS.timer) {
      AS.t0 = Date.now();
      AS.timer = setTimeout(() => {
        AS.timer = 0; AS.left = AS_EVERY;
        // the big card snakes through the small cards' 2-row grid: down, right, up, right, down…
        // (small cards fill columns top then bottom; the track slides one column pair when the next card is off to the right)
        const n = AS.list.length, p = (AS.list.indexOf(AS.main) - AS.head + n) % n;
        if (n) {
          let q;
          if (p > 3) { q = 0; AS.down = true; }   // the big card isn't in view: start again at the top left
          else if (AS.down !== false ? p % 2 === 0 : p % 2 === 1) q = p ^ 1;   // same column, other row
          else { q = p + 2; AS.down = AS.down === false; }   // next column, same row, then turn around
          const next = AS.list[(AS.head + q) % n];
          if (q > 3) asStep(false);
          if (next !== AS.main) { AS.main = next; asPaintMain(true); asMark(); }
        }
        asRestartBar(); asSync();
      }, AS.left);
    } else if (!run && AS.timer) {
      clearTimeout(AS.timer); AS.timer = 0;
      AS.left = Math.max(200, AS.left - (Date.now() - AS.t0));
    }
  }
  function asResetTimer() {
    clearTimeout(AS.timer); AS.timer = 0; AS.left = AS_EVERY;
    asRestartBar(); asSync();
  }

  function renderAssist() {
    const box = $("#assist"), n = assistants().length;
    AS.list = assistants();
    AS.draw++; AS.busy = false;
    AS.head = n ? AS.head % n : 0;
    AS.main = AS.list.find(a => AS.main && a.id === AS.main.id) || AS.list[0] || null;
    if (!n) { box.innerHTML = ""; return; }
    AS.list.forEach(a => { if (C.artHead && C.artHead[a.id]) new Image().src = C.artHead[a.id]; });   // ready before a card slides in
    box.innerHTML = '<div class="as-tabs" role="group" aria-label="Assistant coaches">' +   // phones: every coach, one tap away
      AS.list.map(a => '<button type="button" class="tab as-pick" data-a="' + esc(a.id) + '" aria-selected="' + (a === AS.main) + '">' + pad(a.slot) + " " + esc(UI.bare(UI.coachName(a))) + "</button>").join("") + "</div>" +
      '<div class="as-left"><div class="as-view"><div class="as-track">' +
      Array.from({ length: Math.min(4, n) }, (_, i) => AS.list[(AS.head + i) % n]).map(a => assistCard(a, a === AS.main)).join("") + "</div></div>" +
      (asMoves() ? '<div class="as-meta"><span>' + n + ' coaches</span><div class="as-bar"><i></i></div><div class="arrows"><button type="button" class="arrow as-prev" aria-label="Previous coaches">←</button><button type="button" class="arrow as-next" aria-label="Next coaches">→</button></div></div>' : "") +
      '</div><div class="as-main" aria-live="polite"></div>';
    asPaintMain(false);
    if (!AS.wired) {
      AS.wired = true;
      box.addEventListener("click", e => {
        const hit = e.target.closest(".as-hit, .as-pick");
        if (hit) { AS.main = AS.list.find(a => a.id === hit.dataset.a); asPaintMain(true); asMark(); asResetTimer(); return; }
        const arrow = e.target.closest(".as-prev, .as-next");
        if (arrow) { asStep(arrow.classList.contains("as-prev")); asResetTimer(); }
      });
      box.addEventListener("pointerenter", e => { if (e.pointerType !== "touch") { AS.hover = true; asResetTimer(); } });   // hovering starts the 8 seconds over
      box.addEventListener("pointerleave", () => { AS.hover = false; asSync(); });
      box.addEventListener("focusin", e => { AS.keys = e.target.matches(":focus-visible"); asSync(); });
      box.addEventListener("focusout", () => { AS.keys = false; asSync(); });
      document.addEventListener("visibilitychange", asSync);
      new IntersectionObserver(es => { AS.seen = es[es.length - 1].isIntersecting; asSync(); }, { threshold: .25 }).observe(box);
    }
    asResetTimer();
  }

  /* Rosters: every team in two columns. The Standings view unlocks once staff enter the first
     Mock Checkpoint Series placements (staff desk → Teams), and turns into final standings, with
     the champions on top, once Final Checkpoint Series placements are in. */
  function renderRosters() {
    const teams = S.teams;
    const mock = teams.some(t => t.mock_place), fin = teams.some(t => t.final_place);
    if (!mock) rv = "rosters";
    else if (!rv) rv = "standings";   // once results exist, open on standings
    const ev = k => C.schedule.find(e => e.kind === k);
    const day = (k, o) => { const e = ev(k); return e ? UI.date(e.date + "T12:00:00", o || { month: "short", day: "numeric" }).replace(",", "") : ""; };
    const ord = n => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th");
    const mentor = t => {
      const c = t.coach_id ? coachById(t.coach_id) : null;
      return c ? '<a class="rost-coach" data-id="' + esc(c.id) + '" href="#faculty">' + esc(UI.bare(UI.coachName(c))) + "</a>" : '<span class="tba">To be assigned</span>';
    };
    const standings = rv === "standings";

    $("#rost-title").textContent = !standings ? "Team rosters" : fin ? "Final standings" : "Team standings";
    $("#rost-seg").innerHTML =
      '<button type="button" role="tab" data-v="rosters" aria-selected="' + !standings + '">Rosters</button>' +
      '<button type="button" role="tab" data-v="standings" aria-selected="' + standings + '"' + (mock ? "" : " disabled") + ">" +
        (mock ? 'Standings<span class="dot" aria-hidden="true"></span>' : "Standings · opens " + day("mock")) + "</button>";

    if (!standings) {
      $("#rost-view").innerHTML = teams.length
        ? '<div class="rost-cards">' + teams.map((t, i) =>
            '<div class="rc"><span class="n">' + pad(i + 1) + "</span><b>" + esc(t.name) + '</b><span class="co">Mentor · ' + mentor(t) + "</span>" +
            '<span class="pl">' + (t.players || []).map(p => esc(p.ign)).join(" · ") + "</span></div>").join("") + "</div>"
        : '<p class="rost-none">Teams are posted here on Day 1.</p>';
      $("#rost-sum").textContent = !teams.length ? "" : !mock
        ? teams.length + (teams.length === 1 ? " team" : " teams") + " · standings unlock after the Mock Checkpoint Series, " + day("mock", { weekday: "short", month: "short", day: "numeric" })
        : (fin ? "Final results are in" : "Mock results are in") + " · switch to Standings to see placements";
    } else {
      const key = fin ? "final_place" : "mock_place";
      const rows = teams.slice().sort((a, b) => (a[key] || 99) - (b[key] || 99) || (a.mock_place || 99) - (b.mock_place || 99));
      const res = n => '<td class="res' + (n === 1 ? " win" : n ? "" : " blank") + '">' + (n ? ord(n) : "—") + "</td>";
      const champ = fin && teams.find(t => t.final_place === 1);
      $("#rost-view").innerHTML =
        (champ ? '<div class="champ"><span class="champ-stamp">Champions</span><div><b>' + esc(champ.name) + "</b><span>Mentor · " +
          esc(champ.coach_id && coachById(champ.coach_id) ? UI.bare(UI.coachName(coachById(champ.coach_id))) : "To be assigned") + " · " +
          (champ.players || []).map(p => esc(p.ign)).join(" · ") + "</span></div></div>" : "") +
        '<table class="stable"><thead><tr><th>Place</th><th>Team</th><th class="mcol">Mentor</th><th class="c">Mock · ' + day("mock") + '</th><th class="c">Final · ' + day("final") + "</th></tr></thead><tbody>" +
        rows.map(t => '<tr><td class="n' + (t[key] === 1 ? " win" : "") + '">' + (t[key] ? ord(t[key]) : "—") + "</td>" +
          '<td class="tm">' + esc(t.name) + '<span class="m-in">Mentor · ' + mentor(t) + '</span></td><td class="co mcol">' + mentor(t) + "</td>" +
          res(t.mock_place) + res(t.final_place) + "</tr>").join("") + "</tbody></table>";
      $("#rost-sum").textContent = fin ? "Final standings · sorted by Final Checkpoint Series placement"
        : "Sorted by Mock Checkpoint Series placement · Final Checkpoint Series " + day("final", { weekday: "short", month: "short", day: "numeric" });
    }

    $("#rost-seg").onclick = e => {
      const b = e.target.closest("button[data-v]");
      if (b && !b.disabled) { rv = b.dataset.v; renderRosters(); }
    };
    // a mentor's name opens their office hours pop-up (see initBooking)
  }

  /* ================================================== office hours
     Coach cards on the page. A card opens a pop-up with that coach's week planner (half-hour rows, Eastern)
     and the request card beside it. Week 1 drops away once it's over; closing the pop-up starts the next
     one back on the first week. Mentors and assistant coaches both take team reviews and individual sessions. */
  const T = iso => new Date(iso).getTime();
  const etTime = iso => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })   // your own time;
  const etShort = (a, b) => { const f = s => etTime(s).replace(":00", ""); const x = f(a), y = f(b); return x.slice(-2) === y.slice(-2) ? x.slice(0, -3) + "–" + y : x + "–" + y; };
  const dayShort = ymd => UI.date(UI.etAt(ymd, 720), { weekday: "short", month: "short", day: "numeric" });
  const EVENT_DAYS = UI.eventDays();
  const WEEK2 = EVENT_DAYS.find(d => d.week === 2).ymd;
  const weeks = () => UI.todayYmd() >= WEEK2 ? [2] : [1, 2];
  const LEN = ["30 min", "1 h", "1.5 h", "2 h"];

  function initBooking() {
    if (!bookingWired) {
      bookingWired = true;
      const pop = $("#bk-pop");
      $("#bk-cards").addEventListener("click", e => { const b = e.target.closest("[data-coach]"); if (b) openCoach(b.dataset.coach); });
      // a mentor's name in the rosters opens their file in Faculty right away, then scrolls there.
      // Files differ in height and sit above the rosters, so the page is shifted by the same amount
      // in the same frame: the roster stays still instead of jumping.
      document.addEventListener("click", e => {
        const name = e.target.closest(".rost-coach");
        if (!name || !S.showMentor || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const fac = document.getElementById("faculty");
        if (!fac || !window.PTGScroll) { S.showMentor(name.dataset.id); return; }
        e.preventDefault();
        const before = name.getBoundingClientRect().top;
        S.showMentor(name.dataset.id);
        scrollBy(0, name.getBoundingClientRect().top - before);
        if (location.hash !== "#faculty") history.pushState(null, "", "#faculty");
        PTGScroll.to(fac);
      }, true);
      pop.addEventListener("click", onPopClick);
      pop.addEventListener("input", e => { if (e.target.id === "bk-note") BK.note = e.target.value; });
      pop.addEventListener("close", () => { BK.wk = weeks()[0]; BK.coach = null; });   // the next coach starts back on the first week
      $("#my-req").addEventListener("click", e => {
        const c = e.target.closest(".js-cancel-req");
        if (c) UI.act(c, async () => { await API.setRequestStatus(c.dataset.id, "cancelled"); await refreshBooking(); }, "Request cancelled.");
      });
      const asked = new URLSearchParams(location.search).get("coach");   // ?coach=m1 opens that coach right away
      if (asked && coachById(asked) && $("#bk-cards").style.display !== "none") openCoach(asked);
    }
    refreshBooking();
  }

  // cards + "Your requests"; the open pop-up (if any) reloads its coach too
  async function refreshBooking() {
    const r = await Promise.all([API.allAvailability().catch(() => []), S.me ? API.myRequests().catch(() => []) : Promise.resolve([])]);
    BK.all = r[0]; S.myReqs = r[1];
    renderCards();
    asOpen();
    renderMyReqs();
    if (BK.coach && $("#bk-pop").open) { await loadCoach(); paintPop(); }
  }

  const nextHours = c => BK.all.filter(b => b.coach_id === c.id && T(b.ends_at) > UI.now()).sort((a, b) => T(a.starts_at) - T(b.starts_at))[0];
  const hoursLabel = b => dayShort(UI.dayOf(b.starts_at)) + " · " + etShort(b.starts_at, b.ends_at) + " " + UI.TZ;

  function renderCards() {
    const card = c => {
      const next = nextHours(c);
      return '<button type="button" class="bk-card" data-coach="' + esc(c.id) + '"' + (next ? "" : " disabled") + "><b>" + esc(UI.bare(UI.coachName(c))) + "</b>" +
        "<span>" + esc(UI.bare(UI.coachTeam(c) || "")) + "</span>" +   // just the team: the section headings already say Mentors / Assistant coaches
        "<em>" + (next ? "Next: " + esc(hoursLabel(next)) : "No hours posted yet") + "</em></button>";
    };
    $("#bk-cards").innerHTML = '<div class="bk-top"><h3>Book office hours</h3><span>Times in ' + esc(UI.TZ) + (UI.tz ? " (" + esc(UI.tz) + ")" : "") + "</span></div>" +
      '<p class="bk-grp">Mentors</p><div class="bk-grid">' + mentors().map(card).join("") + "</div>" +
      '<p class="bk-grp">Assistant coaches</p><div class="bk-grid">' + assistants().map(card).join("") + "</div>";
  }

  async function openCoach(id) {
    const pop = $("#bk-pop");
    const myTeam = S.me && S.teams.some(t => (t.member_ids || []).includes(S.me.id));
    Object.assign(BK, { coach: id, start: null, len: 0, note: "", kind: myTeam ? "team" : "individual" });
    if (coachRules().kinds !== "both") BK.kind = coachRules().kinds;
    if (!pop.open) { pop.innerHTML = '<p class="loading">Loading ' + esc(UI.bare(UI.coachName(coachById(id)))) + "'s week…</p>"; pop.showModal(); }
    await loadCoach();
    if (BK.coach === id) paintPop();
  }
  async function loadCoach() {
    const id = BK.coach;
    const r = await Promise.all([API.availability(id).catch(() => []), API.busy(id).catch(() => []), S.me ? API.myRequests().catch(() => []) : Promise.resolve([])]);
    if (id !== BK.coach) return;
    BK.blocks = r[0]; BK.busy = r[1]; S.myReqs = r[2];
  }

  // every half hour inside the coach's hours on one day, with its state
  function slotsFor(ymd) {
    const now = UI.now(), out = [];
    const mine = S.myReqs.filter(r => r.coach_id === BK.coach && (r.status === "pending" || r.status === "accepted"));
    BK.blocks.filter(b => UI.dayOf(b.starts_at) === ymd).sort((a, b) => T(a.starts_at) - T(b.starts_at)).forEach((b, bi) => {
      for (let t = T(b.starts_at); t + HALF <= T(b.ends_at); t += HALF) {
        const e = t + HALF, ov = x => T(x.starts_at) < e && t < T(x.ends_at);
        const my = mine.find(ov);
        let st = "open";
        if (t < now) st = "past";
        else if (my) st = my.status === "accepted" ? "mine-ok" : "mine";
        else if (BK.busy.some(x => x.status === "accepted" && ov(x))) st = "booked";
        else if (BK.busy.some(x => x.status === "pending" && ov(x))) st = "requested";   // someone else is waiting; still open
        out.push({ t, e, iso: new Date(t).toISOString(), st, bi });
      }
    });
    return out;
  }
  const pickable = s => s.st === "open" || s.st === "requested";
  // how many half hours can follow a start (same block, still pickable, 2 hours at most)
  const maxLen = (sl, i) => { const top = coachRules().max; let n = 0; for (let j = i; j < sl.length && n < top; j++) { if (sl[j].bi !== sl[i].bi || !pickable(sl[j])) break; n++; } return n; };
  // what this coach takes, in half hours (their Session settings; the defaults are 30 minutes to 2 hours, both kinds)
  const coachRules = () => { const c = coachById(BK.coach) || {}; return { min: (c.min_minutes || 30) / 30, max: (c.max_minutes || 120) / 30, kinds: c.session_kinds || "both" }; };
  const startDay = () => BK.start ? UI.dayOf(BK.start) : null;

  // Only players request sessions. Coaches (mentors and assistants) and staff get a view-only planner, unless
  // they're on a team themselves: the same rule as the desk's Player file. The database enforces it too.
  const canRequest = () => !S.me || UI.isStudent(S.me, S.coaches, S.teams);   // players, plus coaches/staff on a team or marked "student too"

  // the week planner: days across, half hours down, only the times the coach has hours (gaps squeezed out)
  function planner() {
    const c = coachById(BK.coach), days = EVENT_DAYS.filter(d => d.week === BK.wk);
    const cell = {}, used = new Set();
    days.forEach(d => slotsFor(d.ymd).forEach((s, i, all) => { s.fits = maxLen(all, i) >= coachRules().min; const m = Math.round((s.t - UI.etAt(d.ymd, 0).getTime()) / 6e4); cell[d.ymd + "|" + m] = s; used.add(m); }));
    if (!used.size) return '<div class="bk-empty">' + esc(UI.bare(UI.coachName(c))) + " has no hours in Week " + BK.wk + (weeks().length > 1 ? ". Try the other week." : " yet.") + "</div>";
    const sel = BK.start ? T(BK.start) : 0, selEnd = sel + BK.len * HALF, ask = canRequest();
    const lab = m => { const l = UI.lmin(m), h = Math.floor(l / 60), mm = l % 60; return (h % 12 || 12) + (mm ? ":" + pad(mm) : "") + " " + (h < 12 ? "AM" : "PM"); };
    const words = { mine: "Your request (waiting)", "mine-ok": "Your session", booked: "Booked", requested: "Contested", open: "Open" };
    let prev = null, rows = "";
    [...used].sort((a, b) => a - b).forEach(m => {
      if (prev != null && m - prev > 30) rows += '<tr class="gap"><th></th><td colspan="7"></td></tr>';   // hours nobody's free: squeezed out
      rows += '<tr><th class="tm">' + (m % 60 && prev === m - 30 ? "" : lab(m)) + "</th>" + days.map(d => {
        const s = cell[d.ymd + "|" + m];
        if (!s || s.st === "past") return '<td class="off"></td>';
        const label = esc(dayShort(d.ymd) + " · " + etTime(s.iso) + " " + UI.TZ + " · " + words[s.st]);
        if (!pickable(s) || !ask || !s.fits) return '<td><span class="is-' + s.st + '" title="' + label + '"></span></td>';   // view only: nothing to click
        const cls = s.t === sel ? "on" : s.t > sel && s.t < selEnd ? "in" : s.st === "requested" ? "req" : "";
        return '<td><button type="button" class="' + cls + '" data-start="' + s.iso + '" title="' + label + '" aria-label="' + label + '"></button></td>';
      }).join("") + "</tr>";
      prev = m;
    });
    return '<div class="bk-scroll"><table class="bk-wk"><thead><tr><th class="tm"></th>' + days.map(d => '<th class="' + (UI.todayYmd() > d.ymd ? "past" : "") + '">' + d.dow + "<b>" + d.n + "</b></th>").join("") + "</tr></thead><tbody>" + rows + "</tbody></table></div>" +
      '<div class="bk-key"><span><i class="open"></i>Open</span><span><i class="wait"></i>' + (ask ? "Contested" : "Request waiting") + '</span><span><i class="is-booked"></i>Booked</span>' +
        (S.me && ask ? '<span><i class="is-mine"></i>Your request</span><span><i class="is-mine-ok"></i>Your session</span><span><i class="on"></i>Your pick</span>' : !S.me ? '<span><i class="on"></i>Your pick</span>' : "") + "</div>";
  }

  function requestCard() {
    const c = coachById(BK.coach), has = BK.start && BK.len, end = has ? new Date(T(BK.start) + BK.len * HALF).toISOString() : "";
    if (!canRequest()) {   // coaches and staff: a look at the week, no request card
      const own = c.profile_id && c.profile_id === S.me.id, staff = S.me.role === "staff";
      return '<div class="bk-req"><h4>View only</h4><p class="bk-note">' +
        (own ? "This is your week as players see it. Players request time with you here."
             : (staff ? "Staff" : "Coaches") + " don't request sessions. This is a look at " + esc(UI.bare(UI.coachName(c))) + "'s week.") + "</p>" +
        '<a class="btn" href="desk.html">Open your desk</a><p class="bk-fine">' + (staff ? "Requests are handled in Staff → Requests on your desk." : "You change your hours and answer requests on your desk.") + "</p></div>";
    }
    const sl = BK.start ? slotsFor(startDay()) : [], i = sl.findIndex(s => s.iso === BK.start), mx = i >= 0 ? maxLen(sl, i) : 0;
    const rules = coachRules(), who = esc(UI.bare(UI.coachName(c))), span = n => LEN[n - 1];
    // says so when this coach's Session settings narrow the choices
    const lenNote = rules.min > 1 || rules.max < 4 ? '<p class="bk-fine bk-rule">' + who + " only does " + (rules.min === rules.max ? span(rules.min) : span(rules.min) + "–" + span(rules.max)) + " sessions.</p>" : "";
    const kindNote = rules.kinds !== "both" ? '<p class="bk-fine bk-rule">' + who + " only does " + (rules.kinds === "team" ? "team reviews" : "individual sessions") + ".</p>" : "";
    const kindBtn = (k, t) => '<button type="button" data-kind="' + k + '" aria-pressed="' + (BK.kind === k) + '">' + t + "</button>";
    const yours = has && !UI.onEastern(new Date(BK.start)) ? '<span class="bk-yours">' + esc(UI.time(BK.start) + " – " + UI.time(end)) + " your time</span>" : "";
    return '<div class="bk-req"><h4>Request card</h4><dl>' +
      "<div><dt>Coach</dt><dd>" + esc(UI.bare(UI.coachName(c))) + "</dd></div>" +
      "<div><dt>When</dt>" + (has ? "<dd>" + esc(dayShort(startDay())) + "<br>" + etTime(BK.start) + " – " + etTime(end) + " " + UI.TZ + "</dd>" : '<dd class="empty">Click a start time on the planner</dd>') + "</div></dl>" +
      '<div><span class="bk-lbl">How long</span>' + (BK.start ? '<div class="bk-seg" role="group" aria-label="How long">' + LEN.map((l, j) => '<button type="button" data-len="' + (j + 1) + '" aria-pressed="' + (BK.len === j + 1) + '"' + (j + 1 > mx || j + 1 < rules.min ? " disabled" : "") + ">" + l + "</button>").join("") + "</div>"
        : '<p class="bk-fine">Pick a start time first.</p>') + lenNote + "</div>" +
      '<div><span class="bk-lbl">Session</span><div class="bk-seg" role="group" aria-label="Session">' + (rules.kinds !== "individual" ? kindBtn("team", "Team review") : "") + (rules.kinds !== "team" ? kindBtn("individual", "Individual") : "") + "</div>" + kindNote + "</div>" +
      '<label><span class="bk-lbl">What do you want to work on?</span><textarea id="bk-note" maxlength="500" placeholder="Review our mock checkpoint VOD, trio rotations, …">' + esc(BK.note) + "</textarea></label>" +
      (S.me ? '<button type="button" class="btn" data-send' + (has ? "" : " disabled") + ">Send request</button>"
            : '<button type="button" class="btn" data-login>Log in with Discord to send</button>') +
      '<p class="bk-fine">' + (S.me ? esc(UI.bare(UI.coachName(c))) + " accepts or declines it. The answer shows on your desk." : "Requests need a Discord login so your coach knows who's asking.") + "</p></div>";
  }

  function paintPop() {
    const c = coachById(BK.coach), pop = $("#bk-pop");
    if (!c) return;
    const wks = weeks();
    pop.innerHTML = '<div class="bk-top"><div><span class="k">' + (c.kind === "assistant" ? "Assistant coach" + (UI.coachTeam(c) ? " · " + esc(UI.bare(UI.coachTeam(c))) : "") : "Mentor · " + esc(UI.bare(UI.coachTeam(c)))) + '</span><h3 id="bk-pop-title">' + esc(UI.bare(UI.coachName(c))) + "</h3></div>" +
      '<div class="bk-tools">' + (wks.length === 1 ? '<span class="bk-wk-only">Week 2</span>' : '<div class="bk-seg">' + wks.map(w => '<button type="button" data-wk="' + w + '" aria-pressed="' + (BK.wk === w) + '">Week ' + w + "</button>").join("") + "</div>") +
        '<button type="button" class="linkbtn" data-close>Close</button></div></div>' +
      '<div class="bk-body"><div><p class="bk-step">' + (canRequest() ? "Click a start time" : "Week view") + " · Your time (" + UI.TZ + ")</p>" + planner() + "</div>" + requestCard() + "</div>";
  }

  function onPopClick(e) {
    const pop = $("#bk-pop");
    if (e.target === pop || e.target.closest("[data-close]")) return pop.close();
    const t = e.target.closest("[data-wk],[data-start],[data-len],[data-kind],[data-send],[data-login]");
    if (!t) return;
    if (t.dataset.wk) { BK.wk = +t.dataset.wk; BK.start = null; BK.len = 0; }
    else if (t.dataset.start) { const sl = slotsFor(UI.dayOf(t.dataset.start)), i = sl.findIndex(s => s.iso === t.dataset.start); BK.start = t.dataset.start; BK.len = Math.max(coachRules().min, Math.min(2, maxLen(sl, i))); }
    else if (t.dataset.len) BK.len = +t.dataset.len;
    else if (t.dataset.kind) BK.kind = t.dataset.kind;
    else if (t.hasAttribute("data-login")) return UI.login(t);
    else if (t.hasAttribute("data-send")) {
      return UI.act(t, async () => {
        await API.requestSession({ coach_id: BK.coach, kind: BK.kind, starts_at: BK.start, ends_at: new Date(T(BK.start) + BK.len * HALF).toISOString(), note: BK.note.trim() });
        BK.start = null; BK.len = 0; BK.note = "";
        await refreshBooking();   // the planner now shows it as your request
      }, "Request sent. You'll see the answer on your desk.");
    }
    paintPop();
  }

  function renderMyReqs() {
    const box = $("#my-req");
    if (!S.me || !canRequest()) { box.innerHTML = ""; return; }   // logged out, or a coach / staff: nothing to list
    const now = new Date(UI.now());
    // only what's still waiting or booked; declined ones don't pile up here (they stay on the desk)
    const upcoming = S.myReqs.filter(r => new Date(r.ends_at) > now);
    const list = upcoming.filter(r => UI.shown(r) === "pending" || UI.shown(r) === "accepted").slice(0, 6);   // an expired one drops off
    const declined = upcoming.filter(r => r.status === "declined").length;
    box.innerHTML = '<div class="mine-head"><h3>Your requests</h3><a href="desk.html">All on your desk →</a></div>' +
      (list.length ? '<ul class="req-list">' + list.map(r =>
        "<li>" + UI.statusChip(UI.shown(r)) + '<span class="rq-when">' + esc(UI.range(r.starts_at, r.ends_at)) + '</span><span class="rq-who">' + esc(UI.bare(UI.coachName(coachById(r.coach_id) || r.coach))) + " · " + (r.kind === "team" ? "Team review" : "Individual") + (r.by_coach ? " · booked by your mentor" : "") + "</span>" +
        (r.requester_id === S.me.id ? '<button type="button" class="linkbtn js-cancel-req" data-id="' + esc(r.id) + '">Cancel</button>' : "") + "</li>").join("") + "</ul>"
        : '<p class="empty-note">Nothing waiting or booked. Pick a coach above.</p>') +
      (declined ? '<p class="mine-note">' + declined + (declined === 1 ? " request was" : " requests were") + ' declined. <a href="desk.html">See them on your desk</a></p>' : "");
  }
})();
