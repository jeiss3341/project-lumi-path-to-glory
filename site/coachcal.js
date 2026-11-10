/* Path to Glory · the mentor's calendar on the desk (desk → Mentor calendar → Your calendar).
   Sessions: (opens first) both weeks; click a day to list its booked sessions and waiting requests.
   Hours:    opens on an overview of both weeks, just to look: your hours and each day's total. Click a day, or
             Change hours, for the week planner (Eastern, 8 AM to 4 AM, in half hours) with a side panel.
             + Add hours / − Remove hours says what dragging does; or type the times and pick the days in the panel.
             Nothing changes until you press Add / Remove and say yes. Hours with a booked session or a waiting request
             in them stay locked (can't be removed or moved) until that's declined or cancelled.
   + Write a session (Sessions): a week planner where the mentor picks from their own free hours (up to 4 hours) to write
             down a session they set up with their own team, so every session is on the site. Booked straight away.
   Days that are over fade and lock, and week 1 drops off once it's over. Requests are answered in the request
   pop-up (openReq), which the Requests waiting cards above open too, or in the planner's side panel. */
(function () {
  "use strict";
  const { esc } = UI;
  // view state, kept while the desk is open
  const ST = { mode: "sessions", open: null };
  // the Hours view: overview or planner, the planner's week, what dragging does, what the side panel shows,
  // and the side column's height (it only grows, so the page doesn't jump while you work near the bottom)
  const HP = { page: "overview", wk: null, tool: "add", view: { t: "week" }, rightH: 0 };
  let D = null, panel = null, ctx = null;

  /* ---------- time (the calendar is Eastern; labels add the viewer's own time when they're elsewhere) ---------- */
  const ZC = new Map(), z = ymd => { let v = ZC.get(ymd); if (v == null) ZC.set(ymd, v = UI.etAt(ymd, 0).getTime()); return v; };   // midnight Eastern, worked out once per day
  const at = (ymd, m) => new Date(z(ymd) + m * 6e4);
  const mins = (iso, ymd) => Math.round((new Date(iso) - z(ymd)) / 6e4);
  const tm = m => { const h = Math.floor(m / 60) % 24, mm = m % 60; return (h % 12 || 12) + ":" + String(mm).padStart(2, "0") + " " + (h < 12 ? "AM" : "PM"); };
  const span = (a, b) => tm(a) + "–" + tm(b);
  const short = (a, b) => { const f = m => tm(m).replace(":00", ""); const x = f(a), y = f(b); return x.slice(-2) === y.slice(-2) ? x.slice(0, -3) + "–" + y : x + "–" + y; };
  const hrs = n => n < 60 ? (n ? n + " min" : "0 h") : (n % 60 ? (n / 60).toFixed(1) : n / 60) + " h";
  const M0 = UI.DAY_START, M1 = UI.DAY_END, ROWS = []; for (let m = M0; m < M1; m += 30) ROWS.push(m);
  const steps = (a, b) => { const o = []; for (let m = a; m <= b; m += 30) o.push(m); return o; };
  const pastCell = (ymd, m) => at(ymd, m + 30).getTime() <= UI.now();
  const dayOver = ymd => at(ymd, M1) <= new Date(UI.now());
  const dayName = ymd => { const d = D.days.find(x => x.ymd === ymd); return d ? d.dow + " " + d.n : ymd; };
  const longDay = ymd => UI.date(at(ymd, 720), { weekday: "long", month: "long", day: "numeric" });
  const dayShort = ymd => UI.date(at(ymd, 720), { weekday: "short", month: "short", day: "numeric" });
  const yours = (ymd, a, b) => UI.onEastern(at(ymd, a)) ? "" : "Your time: " + UI.time(at(ymd, a)) + "–" + UI.time(at(ymd, b));
  const key = (ymd, m) => ymd + "|" + m;
  // several days: "Thu, Nov 12" · "Mon 16 – Fri 20 · 5 days" · "Mon 16, Wed 18"
  function daysLabel(ys) {
    const s = ys.slice().sort(), ix = s.map(y => D.days.findIndex(d => d.ymd === y));
    if (s.length === 1) return dayShort(s[0]);
    if (s.length > 2 && ix.every((v, i) => !i || v === ix[i - 1] + 1)) return dayName(s[0]) + " – " + dayName(s[s.length - 1]) + " · " + s.length + " days";
    return s.map(dayName).join(", ");
  }
  // week 1 drops off once it's over
  const weeks = () => UI.todayYmd() >= D.days.find(d => d.week === 2).ymd ? [2] : [1, 2];

  /* ---------- data ---------- */
  const T = iso => new Date(iso).getTime();
  const blockDay = b => UI.dayOf(b.starts_at);
  const bm = b => { const y = blockDay(b); return [mins(b.starts_at, y), mins(b.ends_at, y)]; };   // minutes after midnight Eastern
  const upcoming = ymd => D.blocks.filter(b => blockDay(b) === ymd && new Date(b.ends_at) > new Date(UI.now())).sort((p, q) => T(p.starts_at) - T(q.starts_at));
  const reqsOn = ymd => D.reqs.filter(r => UI.dayOf(r.starts_at) === ymd && (r.status === "accepted" || r.status === "pending")).sort((p, q) => T(p.starts_at) - T(q.starts_at));
  const who = r => UI.party(r, (teamOf(r) || {}).name);
  // a team review the mentor wrote down belongs to the mentor's team; anything else to the player's
  const teamOf = r => r.by_coach && r.kind === "team" ? D.teams.find(x => x.coach_id === r.coach_id) : D.teams.find(x => (x.member_ids || []).includes(r.requester_id));
  // for the planner, worked out once per mount (it asks on every cell): your hours as half-hour cells, and each
  // waiting or booked request's day, minutes and cells
  // CUR is the planner's working copy (changes pile up there); SAVED is what's in the database. Save changes sends the difference.
  let CUR = new Set(), SAVED = new Set(), LIVE = [], RD = new Map(), AT = new Map();
  function index() {
    SAVED = new Set();
    D.blocks.forEach(b => { const y = blockDay(b), [a, e] = bm(b); for (let m = a; m < e; m += 30) SAVED.add(key(y, m)); });
    CUR = new Set(SAVED);
    LIVE = D.reqs.filter(r => r.status === "pending" || r.status === "accepted").sort((p, q) => T(p.starts_at) - T(q.starts_at));
    RD = new Map(); AT = new Map();
    LIVE.forEach(r => {
      const y = UI.dayOf(r.starts_at), a = mins(r.starts_at, y), b = mins(r.ends_at, y);
      RD.set(r.id, { y, a, b });
      for (let m = a; m < b; m += 30) { const k = key(y, m); if (!AT.has(k)) AT.set(k, []); AT.get(k).push(r); }
    });
    AT.forEach(l => l.sort((p, q) => (q.status === "accepted") - (p.status === "accepted") || T(p.created_at) - T(q.created_at)));   // booked first, then who asked first
  }
  const rDay = r => RD.get(r.id).y;
  const rSpan = r => { const d = RD.get(r.id); return [d.a, d.b]; };
  const reqsIn = (y, a, b) => LIVE.filter(r => { const d = RD.get(r.id); return d.y === y && d.a < b && a < d.b; });
  const NONE = [], reqsAt = (y, m) => AT.get(key(y, m)) || NONE;
  const booked = (y, m) => reqsAt(y, m).some(r => r.status === "accepted");
  // a request that holds its time: a booked session that isn't over, or a waiting request that can still be answered.
  // Hours with one in them can't be removed or moved until it's declined or cancelled (the database checks too).
  const holds = r => r.status === "accepted" ? T(r.ends_at) > UI.now() : T(r.starts_at) > UI.now();
  const held = (y, m) => reqsAt(y, m).some(holds);
  // stretches of hours on a day: [[a, b], …] in minutes
  const runs = (set, y) => { const out = []; ROWS.forEach(m => { if (!set.has(key(y, m))) return; const l = out[out.length - 1]; if (l && l[1] === m) l[1] = m + 30; else out.push([m, m + 30]); }); return out; };
  const total = (set, y) => runs(set, y).reduce((n, r) => n + r[1] - r[0], 0);
  const runText = (set, y) => runs(set, y).map(r => span(...r)).join(", ");

  /* ---------- Sessions ---------- */
  // what happened on a day: sessions done, requests that expired, and ones declined or cancelled for that day
  const histOn = ymd => D.reqs.filter(r => UI.dayOf(r.starts_at) === ymd && (["done", "expired"].includes(UI.shown(r)) || ["declined", "cancelled"].includes(r.status)))
    .sort((p, q) => T(p.starts_at) - T(q.starts_at));
  const count = (n, w) => '<span class="chip-st st-' + w + '">' + n + " " + w + "</span>";
  function cell(d) {
    const on = ST.open === d.ymd, ev = d.events[0];
    if (dayOver(d.ymd)) {
      // a day that's over: how many sessions were done and how many requests expired; click it to see the day
      const h = histOn(d.ymd), done = h.filter(r => UI.shown(r) === "done").length, exp = h.filter(r => UI.shown(r) === "expired").length;
      return '<div class="cc-day was' + (on ? " on" : "") + '"><button type="button" class="hit" data-day="' + d.ymd + '" aria-pressed="' + on + '" aria-label="' + esc(longDay(d.ymd) + ": " + done + " done, " + exp + " expired") + '"></button>' +
        '<span class="cd-top"><small>' + d.dow + "</small><b>" + d.n + "</b>" + (ev ? '<i class="evdot ' + ev.kind + '" title="' + esc(ev.title) + '"></i>' : "") + "</span>" +
        (done ? count(done, "done") : "") + (exp ? count(exp, "expired") : "") + "</div>";
    }
    const up = upcoming(d.ymd), rq = reqsOn(d.ymd);
    const acc = rq.filter(r => r.status === "accepted"), pen = rq.filter(r => r.status === "pending");
    // days with hours get a pale tan background and their time slot in the date row, so the sessions stand out
    const tint = up.length > 0;
    return '<div class="cc-day' + (on ? " on" : "") + (tint ? " has-hrs" : "") + (d.ymd === UI.todayYmd() ? " today" : "") + '">' +
      '<button type="button" class="hit" data-day="' + d.ymd + '" aria-pressed="' + on + '" aria-label="' + esc(longDay(d.ymd) + (tint ? ", your hours " + up.map(b => span(...bm(b))).join(", ") : "")) + '"></button>' +
      '<span class="cd-top"><small>' + d.dow + "</small><b>" + d.n + "</b>" +
        (tint ? '<span class="cd-hrs" title="Your hours: ' + esc(up.map(b => span(...bm(b))).join(", ")) + '">' + (up.length > 1 ? tm(bm(up[0])[0]).replace(":00", "") + " +" + (up.length - 1) : short(...bm(up[0]))) + "</span>" : "") +   // one slot: its range; several: first start + how many more
        (ev ? '<i class="evdot ' + ev.kind + '" title="' + esc(ev.title) + '"></i>' : "") + "</span>" +
      // opens the first one; the pop-up lists the day's ones down its left side
      (acc.length ? '<button type="button" class="ses-btn cd-acc" data-req="' + esc(acc[0].id) + '" data-set="' + d.ymd + '|accepted" title="See ' + (acc.length === 1 ? "the session" : "the " + acc.length + " sessions") + '">' + acc.length + (acc.length === 1 ? " session" : " sessions") + "</button>" : "") +
      (pen.length ? '<button type="button" class="ses-btn cd-pen" data-req="' + esc(pen[0].id) + '" data-set="' + d.ymd + '|pending" title="See ' + (pen.length === 1 ? "the request" : "the " + pen.length + " requests") + '">' + pen.length + " waiting</button>" : "") + "</div>";
  }
  const grid = () => '<div class="cal2 cc-cal">' + [1, 2].map(w => '<span class="wkl">Week ' + w + "</span>" + D.days.filter(d => d.week === w).map(cell).join("")).join("") + "</div>";
  const legend = () => '<div class="cc-legend"><span><i class="lg hrs-tint"></i>Your hours</span><span><i class="lg acc"></i>Booked session</span><span><i class="lg pen"></i>Request waiting</span>' +
    '<span><i class="lg dn"></i>Done</span><span><i class="lg ex"></i>Expired</span><span><i class="evdot kickoff"></i>Kickoff</span><span><i class="evdot scrim"></i>Scrim day</span><span><i class="evdot mock"></i>Checkpoint</span></div>';
  function sessionsView() {
    if (!ST.open) return '<p class="empty-note">Click a day to see its sessions and requests. Days that are over show what happened.</p>';
    // a day that's over lists what happened (done, expired, declined, cancelled); otherwise what's booked and waiting
    const list = dayOver(ST.open) ? histOn(ST.open) : reqsOn(ST.open), ev = D.days.find(d => d.ymd === ST.open).events[0];
    return '<div class="cc-dhead"><h3>' + esc(longDay(ST.open)) + '</h3><button type="button" class="linkbtn" data-closeday>Close</button></div>' + (ev ? '<p class="muted small">' + esc(ev.title) + "</p>" : "") +
      (list.length ? '<ul class="cc-list">' + list.map(r => '<li class="cc-row ' + ({ accepted: "acc", done: "acc", pending: "pen" }[UI.shown(r)] || "gone") + '"><div class="cc-info"><span class="t">' + span(mins(r.starts_at, ST.open), mins(r.ends_at, ST.open)) + "</span><span>" + UI.statusChip(UI.shown(r)) + " " + esc(who(r)) + " · " + (r.kind === "team" ? "Team review" : "Individual") + (r.by_coach ? ' <span class="muted">· written by you</span>' : "") + "</span></div>" +
        '<button type="button" class="cc-act" data-req="' + esc(r.id) + '" data-set="' + ST.open + '|all">Details ›</button></li>').join("") + "</ul>"
                  : '<p class="empty-note">' + (dayOver(ST.open) ? "Nothing happened on this day." : "No sessions or requests on this day.") + "</p>");
  }

  /* ---------- the request pop-up ---------- */
  const PG = { ids: [], key: "", cur: "" };   // the requests listed down the left of the pop-up
  function dlg() {
    let d = document.getElementById("cc-dlg");
    if (!d) {
      d = document.createElement("dialog"); d.id = "cc-dlg"; d.setAttribute("aria-labelledby", "cc-dlg-title"); document.body.appendChild(d);
      d.addEventListener("close", () => d.classList.remove("wide"));
      d.addEventListener("click", e => {
        if (e.target === d) return d.close();
        const go = e.target.closest("[data-req]"); if (go) return openReq(go.dataset.req);
        const b = e.target.closest("[data-do]"); if (!b) return;
        if (b.dataset.do === "close") return d.close();
        // Accept / Decline / Cancel session: say what will happen first (UI.askRequest), then act
        const r = D.reqs.find(x => x.id === b.dataset.id), s = b.dataset.do, t = r && teamOf(r);
        UI.askRequest({ r, status: s, team: t && t.name, reqs: D.reqs }).then(ok => ok &&
          UI.act(b, async () => { await API.setRequestStatus(r.id, s); d.close(); await ctx.rerender(); },
            { accepted: "Accepted. It's on your calendar.", declined: "Declined.", cancelled: "Session cancelled." }[s]));
      });
      // ↑ ↓ move through the list on the left
      d.addEventListener("keydown", e => {
        if ((e.key === "ArrowUp" || e.key === "ArrowDown") && e.target.closest(".cc-side")) {
          e.preventDefault();
          const j = PG.ids.indexOf(PG.cur) + (e.key === "ArrowUp" ? -1 : 1);
          if (j >= 0 && j < PG.ids.length) openReq(PG.ids[j]);
        }
      });
    }
    return d;
  }
  const kv = (k, v) => "<dt>" + k + "</dt><dd>" + v + "</dd>";
  // other waiting requests at the same time as r (accepting one declines the others)
  const clashes = r => D.reqs.filter(x => x.id !== r.id && x.status === "pending" && T(x.starts_at) < T(r.ends_at) && T(r.starts_at) < T(x.ends_at));
  // The request pop-up: the list on the left, the picked one on the right. set is what the list holds:
  //   "ymd|pending" / "ymd|accepted"  a day's "2 waiting" / "2 sessions" chip
  //   "ymd|all"                       Details › in a day's list
  //   "*|pending"                     every upcoming request waiting (Details › on a Requests waiting card)
  // Left out, the list stays as it was (or becomes the request's day).
  function setIds(set) {
    const [y, s] = set.split("|");
    if (y === "*") return D.reqs.filter(x => x.status === s && new Date(x.starts_at) > new Date(UI.now())).sort((p, q) => T(p.starts_at) - T(q.starts_at)).map(x => x.id);
    return reqsOn(y).filter(x => s === "all" || x.status === s).map(x => x.id);
  }
  function openReq(id, set) {
    const r = D.reqs.find(x => x.id === id); if (!r) return;
    const ymd = UI.dayOf(r.starts_at);
    if (set) { PG.key = set; PG.ids = setIds(set); }
    if (!PG.ids.includes(id)) { PG.key = ymd + "|all"; PG.ids = setIds(PG.key); if (!PG.ids.includes(id)) PG.ids = [id]; }
    PG.cur = id;
    const t = teamOf(r), d = dlg();
    const mine = t && t.coach_id === ctx.coach.id, pending = r.status === "pending", also = pending ? clashes(r) : [];
    const [ky, ks] = PG.key.split("|"), n = PG.ids.length, all = ky === "*";
    const what = ks === "pending" ? (n === 1 ? " request waiting" : " requests waiting") : ks === "accepted" ? (n === 1 ? " booked session" : " booked sessions") : " on this day";
    let lastDay = "";
    const side = '<aside class="cc-side"><h4>' + (all ? "All requests waiting<br>" + n + " in total" : esc(dayShort(ky)) + "<br>" + n + what) + "</h4><ul>" +
      PG.ids.map(x => D.reqs.find(q => q.id === x)).filter(Boolean).map(q => {
        const qy = UI.dayOf(q.starts_at), head = all && qy !== lastDay ? '<li class="cc-sday">' + esc(dayShort(qy)) + "</li>" : "";
        lastDay = qy;
        return head + '<li><button type="button" class="cc-srow ' + (q.status === "accepted" ? "acc" : "pen") + '" data-req="' + esc(q.id) + '" aria-current="' + (q.id === id) + '">' +
          "<b>" + span(mins(q.starts_at, qy), mins(q.ends_at, qy)) + "</b><span>" + esc(who(q)) + " · " + (q.kind === "team" ? "Team review" : "Individual") + "</span>" +
          (q.status === "pending" && clashes(q).length ? '<em class="cc-otag">Overlaps · sent ' + UI.sentRank(q, D.reqs).split(" ")[0] + "</em>" : "") + "</button></li>";
      }).join("") + "</ul></aside>";
    d.classList.add("wide");
    d.innerHTML = '<div class="cc-split">' + side + "<div>" + '<div class="sc-dtop"><div><span class="k">' + ({ pending: "Request waiting for you", expired: "Expired: nobody answered in time", accepted: "Booked session", done: "Session done" }[UI.shown(r)] || "Request") + '</span><h3 id="cc-dlg-title">' + (r.kind === "team" ? "Team review" : "Individual session") + "</h3></div>" + UI.statusChip(UI.shown(r)) + "</div>" +
      '<dl class="sc-kv">' +
        kv("When", esc(longDay(ymd)) + "<br><b>" + span(mins(r.starts_at, ymd), mins(r.ends_at, ymd)) + " ET</b> · " + esc(UI.dur(r.starts_at, r.ends_at)) + (UI.onEastern(new Date(r.starts_at)) ? "" : '<br><span class="muted">Your time: ' + esc(UI.time(r.starts_at) + "–" + UI.time(r.ends_at)) + "</span>")) +
        kv(r.by_coach ? "With" : "From", r.by_coach && r.kind === "team" ? esc(who(r)) + ' <span class="sc-tag">Your team</span>' : esc(who(r)) + ' <span class="muted">@' + esc((r.requester && r.requester.username) || "") + "</span>" + (t ? "<br>" + esc(t.name) + (mine ? ' <span class="sc-tag">Your team</span>' : ' <span class="sc-tag other">Other team</span>') : '<br><span class="muted">Not on a team</span>')) +
        kv(r.by_coach ? "Note" : "Wants to work on", r.note ? "“" + esc(r.note) + "”" : '<span class="muted">No note added.</span>') +
        // when it was sent (or written by you), and its place among overlapping requests ("2nd of 2")
        (r.by_coach ? kv("Written", "By you · " + esc(UI.sentAt(r.created_at))) : kv("Sent", esc(UI.sentAt(r.created_at)) + (also.length ? ' <span class="cc-otag">' + UI.sentRank(r, D.reqs) + "</span>" : ""))) +
        // other requests for the same time, with who asked first: accepting this one declines them
        (also.length ? kv("Also waiting", '<ul class="sc-in">' + also.map(x => '<li><button type="button" class="linkbtn" data-req="' + esc(x.id) + '">' + span(mins(x.starts_at, ymd), mins(x.ends_at, ymd)) + " · " + esc(who(x)) + "</button>" +
            ' <span class="muted small">' + UI.sentGap(x, r) + "</span></li>").join("") +
          '</ul><span class="muted small">Same time as this one. Accepting this declines ' + (also.length === 1 ? "it" : "them") + ".</span>") : "") +
      "</dl>" +
      '<div class="sc-dact">' +
        (pending && new Date(r.starts_at) > new Date(UI.now()) ? '<button type="button" class="btn" data-do="accepted" data-id="' + esc(r.id) + '">Accept</button><button type="button" class="btn ghost" data-do="declined" data-id="' + esc(r.id) + '">Decline</button>' : "") +
        (r.status === "accepted" && new Date(r.ends_at) > new Date(UI.now()) ? '<button type="button" class="btn ghost" data-do="cancelled" data-id="' + esc(r.id) + '">Cancel session</button>' : "") +
        '<button type="button" class="linkbtn" data-do="close">Close</button></div>' + "</div></div>";
    if (!d.open) d.showModal();
    const cur = d.querySelector('.cc-srow[aria-current="true"]');   // keep focus on the picked row, so ↑ ↓ keep working
    if (cur) cur.focus();
  }

  /* ---------- Write a session: one the mentor set up with a player on their own team (on Discord, say) ----------
     A week planner like Hours, but only your own free hours can be picked (30 minutes to 4 hours). Booked straight
     away, so every session is written down on the site. A team review is for the whole team and shows on all their
     desks; an individual session is with one player. Waiting requests at that time are declined. */
  const MAX_LEN = 240;
  const W = { wk: null, y: null, a: null, b: null, kind: "team", p: null, note: "", rightH: 0 };
  let wdrag = null, wraf = 0;
  const myTeam = () => D.teams.find(t => t.coach_id === ctx.coach.id) || null;
  const members = t => (t.member_ids || []).map(id => D.profiles.find(p => p.id === id)).filter(Boolean);
  // a half hour you can book: in your hours, not started yet, nothing booked in it
  const free = (y, m) => CUR.has(key(y, m)) && at(y, m).getTime() >= UI.now() && !booked(y, m);
  const lengths = (y, m) => { const o = []; for (let n = 30; n <= MAX_LEN && free(y, m + n - 30); n += 30) o.push(n); return o; };
  const wHasFree = w => D.days.some(d => d.week === w && !dayOver(d.ymd) && ROWS.some(m => free(d.ymd, m)));
  const wClash = () => W.y == null ? [] : LIVE.filter(r => r.status === "pending" && rDay(r) === W.y && rSpan(r)[0] < W.b && W.a < rSpan(r)[1]);
  const wClear = () => { W.y = W.a = W.b = null; };
  // the pick is dropped if its time stopped being free (a session got booked while the page was open)
  function wCheck() { if (W.y == null) return; for (let m = W.a; m < W.b; m += 30) if (!free(W.y, m)) return wClear(); }
  // a drag from m0 to m1: stops at anything that isn't free, and at the longest a session can be
  function wSpan(y, m0, m1) {
    let a = m0, b = m0 + 30;
    if (m1 > m0) while (b <= m1 && b - a < MAX_LEN && free(y, b)) b += 30;
    else while (a - 30 >= m1 && b - a < MAX_LEN && free(y, a - 30)) a -= 30;
    return [a, b];
  }

  // only time you can actually pick is tan, so anything tan answers a click
  function wCls(y, m) {
    const can = free(y, m);
    return [pastCell(y, m) ? "past" : "", can ? "h can" : "", booked(y, m) ? "s" : "", can && reqsAt(y, m).some(r => r.status === "pending") ? "w" : "",
      W.y === y && m >= W.a && m < W.b ? "pick" : ""].filter(Boolean).join(" ");
  }
  // only the part of the day your hours are in (whole hours), so the rows can be taller and easier to hit
  function wRows() {
    let lo = M1, hi = M0;
    D.days.filter(d => d.week === W.wk && !dayOver(d.ymd)).forEach(d => runs(CUR, d.ymd).forEach(r => { lo = Math.min(lo, r[0]); hi = Math.max(hi, r[1]); }));
    if (lo >= hi) return ROWS;
    lo = Math.floor(lo / 60) * 60; hi = Math.ceil(hi / 60) * 60;
    return ROWS.filter(m => m >= lo && m < hi);
  }
  const wTip = (y, m) => { const rq = reqsAt(y, m); return dayName(y) + " · " + tm(m) + " ET · " + (rq.length ? rq.map(r => (r.status === "accepted" ? "Booked: " : "Waiting: ") + who(r)).join(", ") : free(y, m) ? "Free to book" : CUR.has(key(y, m)) ? "Already started" : "Not in your hours"); };
  function wTable() {
    const ds = D.days.filter(d => d.week === W.wk);
    return '<table class="hp-pl wp"><thead><tr><th class="tm"></th>' + ds.map(d => '<th class="' + [d.ymd === UI.todayYmd() ? "today" : "", dayOver(d.ymd) ? "over" : ""].join(" ") + '"><span class="wd" title="' + esc(longDay(d.ymd) + (d.events[0] ? " · " + d.events[0].title : "")) + '">' + d.dow + "<b>" + d.n + "</b>" + (d.events[0] ? '<i class="evdot ' + d.events[0].kind + '"></i>' : "") + "</span></th>").join("") + "</tr></thead><tbody>" +
      wRows().map(m => '<tr class="' + (m % 60 ? "hf" : "hr") + '"><th class="tm">' + (m % 60 ? "" : tm(m).replace(":00", "")) + "</th>" + ds.map(d => '<td class="' + wCls(d.ymd, m) + '" data-y="' + d.ymd + '" data-m="' + m + '" title="' + esc(wTip(d.ymd, m)) + '"></td>').join("") + "</tr>").join("") +
      "</tbody></table>";
  }
  const WKEY = '<div class="hp-key"><h6 class="hp-sub">Key</h6><span><i class="h"></i>Your hours</span><span><i class="pick"></i>Your pick</span><span><i class="s"></i>Booked session</span><span><i class="w"></i>Request waiting</span>' +
    '<span><i class="off"></i>Can\'t be picked</span><span><i class="evdot kickoff"></i>Kickoff</span><span><i class="evdot scrim"></i>Scrim day</span><span><i class="evdot mock"></i>Checkpoint</span></div>';
  function wHTML() {
    const seg = weeks().length === 1 ? '<span class="bk-wk-only">Week 2</span>' : '<div class="bk-seg">' + weeks().map(w => '<button type="button" data-wwk="' + w + '" aria-pressed="' + (W.wk === w) + '">Week ' + w + "</button>").join("") + "</div>";
    return '<div class="hp-bar"><button type="button" class="linkbtn" data-wback>‹ Sessions</button><div class="hp-tools">' + seg + "</div></div>" +
      '<p class="hp-hint pick"><b>Writing a session:</b> drag on your hours to pick a time, up to 4 hours. Click a time to start with 1 hour.</p>' +
      '<div class="hp-body"><div class="hp-scroll">' + wTable() + '</div><div class="hp-right"' + (W.rightH ? ' style="min-height:' + W.rightH + 'px"' : "") + '><aside class="hp-side is-pick"></aside>' + WKEY + "</div></div>";
  }
  function wSide() {
    const t = myTeam(), ms = members(t), head = '<span class="hp-k">Write a session · ' + esc(t.name) + "</span>";
    if (W.y == null) {
      const none = !weeks().some(wHasFree), other = weeks().find(w => w !== W.wk && wHasFree(w));
      return head + "<h5>Pick a time</h5><p class=\"hp-mut\">For a session you set up with your team yourselves, like on Discord, so it's written down here too. It's booked straight away.</p>" +
        (none ? '<p class="hp-warn">You have no free hours coming up. Add hours first in the Hours view.</p>'
          : !wHasFree(W.wk) ? '<p class="hp-warn">No free hours left in week ' + W.wk + ". Try week " + other + ".</p>"
          : "<p>Drag on your hours (the tan times). A session runs from 30 minutes to 4 hours.</p>");
    }
    const a = W.a, b = W.b, clash = wClash(), opt = (v, label, on) => '<option value="' + esc(v) + '"' + (on ? " selected" : "") + ">" + esc(label) + "</option>";
    return head + '<p class="hp-big">' + span(a, b) + ' ET</p><p class="hp-mut">' + esc(dayShort(W.y)) + " · " + hrs(b - a) + (yours(W.y, a, b) ? "<br>" + esc(yours(W.y, a, b)) : "") + "</p>" +
      (b - a === MAX_LEN ? '<p class="hp-mut">4 hours is the longest a session can be.</p>' : "") +
      '<div class="hp-io"><label>Hour in (ET)<select data-wf="a">' + ROWS.filter(m => free(W.y, m)).map(m => opt(m, tm(m), m === a)).join("") + "</select></label>" +
        '<label>Hour out (ET)<select data-wf="b">' + lengths(W.y, a).map(n => opt(a + n, tm(a + n), a + n === b)).join("") + "</select></label></div>" +
      '<div class="hp-fld"><span class="hp-sub">Session</span><div class="bk-seg" role="group" aria-label="Session"><button type="button" data-wkind="team" aria-pressed="' + (W.kind === "team") + '">Team review</button>' +
        '<button type="button" data-wkind="individual" aria-pressed="' + (W.kind === "individual") + '">Individual</button></div></div>' +
      // a team review is for the whole team; only an individual session needs a player
      (W.kind === "team" ? '<p class="hp-mut">Everyone on ' + esc(t.name) + " sees it on their desk.</p>"
        : ms.length ? '<label class="hp-fld"><span class="hp-sub">Player</span><select data-wf="p">' + ms.map(p => opt(p.id, UI.who(p) + " @" + (p.username || ""), p.id === W.p)).join("") + "</select></label>" +
          '<p class="hp-mut">It shows on their desk. They can cancel it there.</p>'
        : '<p class="hp-warn">Nobody on ' + esc(t.name) + " has linked their Discord account yet, so there's no player to pick.</p>") +
      '<label class="hp-fld"><span class="hp-sub">Note (optional)</span><input data-wnote maxlength="500" placeholder="What it\'s about" value="' + esc(W.note) + '"></label>' +
      (clash.length ? '<p class="hp-warn">' + (clash.length === 1 ? "A waiting request is at this time. Booking this declines it:" : clash.length + " waiting requests are at this time. Booking this declines them:") + "<br>" + clash.map(r => esc(who(r)) + " · " + span(...rSpan(r))).join("<br>") + "</p>" : "") +
      '<div class="hp-acts"><button type="button" class="btn" data-wbook' + (W.kind === "individual" && !ms.length ? " disabled" : "") + '>Book session</button><button type="button" class="linkbtn end" data-wclear>Clear</button></div>';
  }
  // redraw the marks and the side panel (without rebuilding the planner), keeping focus on what was just changed
  function wRefresh(focus) {
    const s = panel.querySelector(".hp-side"); if (!s) return;
    panel.querySelectorAll(".hp-pl td[data-y]").forEach(td => { const c = wCls(td.dataset.y, +td.dataset.m); if (td.className !== c) td.className = c; });
    s.innerHTML = wSide();
    const R = panel.querySelector(".hp-right"), k = R.querySelector(".hp-key");
    W.rightH = Math.max(W.rightH, s.offsetHeight + 14 + k.offsetHeight);   // only grows, so the page doesn't jump while you work
    R.style.minHeight = W.rightH + "px";
    const f = focus && s.querySelector(focus); if (f) f.focus();
  }
  function openWrite() {
    const t = myTeam(); if (!t) return;
    const ms = members(t), cap = (t.info || {}).Captain, dayWk = ST.open && !dayOver(ST.open) ? D.days.find(d => d.ymd === ST.open).week : null;
    wClear();
    Object.assign(W, { wk: dayWk && weeks().includes(dayWk) && wHasFree(dayWk) ? dayWk : (weeks().find(wHasFree) || weeks()[0]), kind: "team", note: "", rightH: 0, p: (ms.find(p => UI.who(p) === cap) || ms[0] || {}).id || null });
    ST.mode = "write"; paint();
  }
  async function wBook(btn) {
    const t = myTeam(), whole = W.kind === "team", p = whole ? null : D.profiles.find(x => x.id === W.p); if (!t || (!whole && !p) || W.y == null) return;
    const y = W.y, a = W.a, b = W.b, clash = wClash(), name = esc(whole ? t.name : UI.who(p));
    const ok = await UI.ask({
      kicker: "Write a session", title: "Book this session?",
      lead: "<b>" + (whole ? "Team review" : "Individual session") + "</b> · " + name + (whole ? "" : " · " + esc(t.name)) + "<br>" + esc(longDay(y)) + " · " + span(a, b) + " ET" +
        (yours(y, a, b) ? '<br><span class="muted">' + esc(yours(y, a, b)) + "</span>" : ""),
      points: whole ? ["It's booked straight away. It shows as Accepted on every " + name + " player's desk and on your calendar.", "Players can't request this time anymore.", "You can cancel it from your calendar."]
        : ["It's booked straight away. It shows as Accepted on " + name + "'s desk and on your calendar.", "Players can't request this time anymore.", name + " can cancel it from their desk, and so can you."],
      warn: clash.length ? (clash.length === 1 ? "1 waiting request at this time will be declined:" : clash.length + " waiting requests at this time will be declined:") : "",
      warnList: clash.map(r => esc(who(r)) + " · " + span(...rSpan(r)) + " ET"),
      yes: "Yes, book it"
    });
    if (!ok) return;
    await UI.act(btn, async () => {
      await API.writeSession({ coach_id: ctx.coach.id, requester_id: whole ? null : p.id, kind: W.kind, starts_at: at(y, a).toISOString(), ends_at: at(y, b).toISOString(), note: W.note.trim() });
      ST.mode = "sessions"; ST.open = y; wClear(); await ctx.rerender();
    }, whole ? "Booked. It's on your calendar and your team's desks." : "Booked. It's on your calendar and " + UI.who(p) + "'s desk.");
  }
  function writeClick(e) {
    const on = s => e.target.closest(s); let x;
    if (on("[data-wback]")) { ST.mode = "sessions"; return paint(); }
    if ((x = on("[data-wwk]"))) { W.wk = +x.dataset.wwk; wClear(); return paint(); }
    if ((x = on("[data-wkind]"))) { W.kind = x.dataset.wkind; return wRefresh('[data-wkind="' + W.kind + '"]'); }
    if (on("[data-wclear]")) { wClear(); return wRefresh(); }
    if ((x = on("[data-wbook]"))) return wBook(x);
  }
  function writeChange(e) {
    const f = e.target.dataset.wf; if (!f) return;
    if (f === "p") W.p = e.target.value;
    else if (f === "b") W.b = +e.target.value;
    else { const len = W.b - W.a; W.a = +e.target.value; const ls = lengths(W.y, W.a); W.b = W.a + (ls.includes(len) ? len : ls[ls.length - 1]); }
    wRefresh('[data-wf="' + f + '"]');
  }
  // dragging only ever picks free time, on one day; a click (or a tap on a phone) starts with an hour, or what fits
  function wDown(e) {
    const td = e.target.closest(".hp-pl td[data-y]");
    if (!td || e.button !== 0 || !free(td.dataset.y, +td.dataset.m)) return;
    wdrag = { y: td.dataset.y, m0: +td.dataset.m, m1: +td.dataset.m, touch: e.pointerType === "touch", moved: false };
    if (!wdrag.touch) e.preventDefault();   // touch keeps scrolling; a tap acts like a click
  }
  function wTag() { if (!wdrag || W.y == null) return; const t = tag(); t.className = "hp-tag pick"; t.hidden = false; t.textContent = span(W.a, W.b) + " · " + hrs(W.b - W.a); }
  function wMove(e) {
    if (!wdrag || wdrag.touch) return;
    if (!(e.buttons & 1)) return wEnd({ type: "pointerup" });   // the button was let go without us hearing: it still counts as the click it was
    // the cell the pointer is on (e.target: right even when the page is zoomed, where clientX/Y and elementFromPoint disagree)
    const n = e.target, td = n && n.closest && n.closest(".hp-pl td[data-y]");
    if (td && panel.contains(td) && td.dataset.y === wdrag.y && +td.dataset.m !== wdrag.m1) {
      wdrag.m1 = +td.dataset.m; wdrag.moved = true;
      [W.a, W.b] = wSpan(wdrag.y, wdrag.m0, wdrag.m1); W.y = wdrag.y;
      if (!wraf) wraf = requestAnimationFrame(() => { wraf = 0; wRefresh(); wTag(); });
    }
    if (wdrag.moved) tagAt(e.clientX, e.clientY);
  }
  function wEnd(e) {
    if (!wdrag) return;
    const d = wdrag; wdrag = null;
    if (TAG) TAG.hidden = true;
    if (wraf) { cancelAnimationFrame(wraf); wraf = 0; }
    if (d.moved) return wRefresh();
    if (e.type !== "pointerup") return;
    const ls = lengths(d.y, d.m0);
    W.y = d.y; W.a = d.m0; W.b = d.m0 + (ls.includes(60) ? 60 : ls[ls.length - 1]);
    wRefresh();
  }

  /* ---------- Hours: the overview (just to look) ---------- */
  function overview() {
    const cellO = d => {
      const rs = runs(CUR, d.ymd), n = total(CUR, d.ymd), ev = d.events[0];
      if (dayOver(d.ymd)) return '<div class="cc-day past"><span class="cd-top"><small>' + d.dow + "</small><b>" + d.n + "</b></span></div>";
      return '<div class="cc-day' + (d.ymd === UI.todayYmd() ? " today" : "") + '"><button type="button" class="hit" data-ovday="' + d.ymd + '" aria-label="' + esc(longDay(d.ymd) + ": " + (rs.length ? rs.map(r => span(...r)).join(", ") : "no hours") + ". Change this day") + '"></button>' +
        '<span class="cd-top"><small>' + d.dow + "</small><b>" + d.n + "</b>" + (ev ? '<i class="evdot ' + ev.kind + '" title="' + esc(ev.title) + '"></i>' : "") + "</span>" +
        rs.map(r => '<span class="blk-btn">' + short(...r) + "</span>").join("") +
        (n ? '<span class="hp-ovtot">' + hrs(n) + "</span>" : "") + "</div>";
    };
    return '<div class="hp-bar"><p class="muted small">Your hours for both weeks. Click a day to change it. Times are Eastern (ET), 8 AM to 4 AM.</p><button type="button" class="btn" data-edithours>Change hours</button></div>' +
      '<div class="cal2 cc-cal hp-ov">' + weeks().map(w => {
        const ds = D.days.filter(d => d.week === w), h = ds.reduce((n, d) => n + total(CUR, d.ymd), 0) / 60;
        return '<span class="wkl">Week ' + w + " · " + (h % 1 ? h.toFixed(1) : h) + (h === 1 ? " hour" : " hours") + "</span>" + ds.map(cellO).join("");
      }).join("") + "</div>" +
      '<div class="cc-legend"><span><i class="lg hrs"></i>Your hours</span><span><i class="evdot kickoff"></i>Kickoff</span><span><i class="evdot scrim"></i>Scrim day</span><span><i class="evdot mock"></i>Checkpoint</span></div>';
  }

  /* ---------- Hours: the planner ---------- */
  let drag = null, raf = 0, TAG = null, wired = false;
  const wkDays = () => D.days.filter(d => d.week === HP.wk);
  const openDays = () => wkDays().filter(d => !dayOver(d.ymd)).map(d => d.ymd);
  const weekTotal = set => wkDays().reduce((n, d) => n + total(set, d.ymd), 0);
  const isDraft = () => HP.view.t === "add" || HP.view.t === "rm";
  const rmTool = () => HP.tool === "rm";
  const sameAs = (y, a, b) => D.days.filter(d => d.ymd !== y && !dayOver(d.ymd) && runs(CUR, d.ymd).some(r => r[0] === a && r[1] === b)).map(d => d.ymd);

  // what a draft changes: the hours after it and minutes per day; when removing, the sessions and waiting requests in
  // the way (it can't go ahead until they're declined or cancelled)
  function changes(v) {
    const add = v.t === "add", next = new Set(CUR), per = [], held = [];
    if (v.a == null || v.b == null || v.b <= v.a) return { next, per, held, sum: 0 };
    v.days.forEach(y => {
      let n = 0;
      for (let m = v.a; m < v.b; m += 30) {
        const k = key(y, m);
        if (pastCell(y, m)) continue;
        if (add) { if (!next.has(k)) { next.add(k); n += 30; } }
        else if (next.has(k)) { next.delete(k); n += 30; }
      }
      if (n) per.push({ y, n });
      if (!add) reqsIn(y, v.a, v.b).forEach(r => { if (holds(r)) held.push(r); });
    });
    return { next, per, held, sum: per.reduce((n, p) => n + p.n, 0) };
  }
  // what to mark on the planner: the picked block or request, and the time a draft changes
  function marks() {
    const v = HP.view; let sel = null, dc = null;
    if (v.t === "block") sel = (y, m) => y === v.y && m >= v.a && m < v.b;
    if (v.t === "req") { const r = LIVE.find(x => x.id === v.id); if (r) { const y = rDay(r), [a, b] = rSpan(r); sel = (yy, m) => yy === y && m >= a && m < b; } }
    if (isDraft() && v.a != null && v.b != null) {
      dc = new Set();
      // only the time that actually changes: new hours when adding, your hours when removing (sessions and waiting
      // requests in the way get an outline instead)
      v.days.forEach(y => { for (let m = v.a; m < v.b; m += 30) if (!pastCell(y, m) && (v.t === "add" ? !CUR.has(key(y, m)) : CUR.has(key(y, m)) && !held(y, m))) dc.add(key(y, m)); });
    }
    return { sel, dc };
  }
  function cls(y, m, f) {
    const k = key(y, m), rq = reqsAt(y, m), acc = rq.some(r => r.status === "accepted"), v = HP.view;
    const inRm = v.t === "rm" && v.a != null && v.days.includes(y) && m >= v.a && m < v.b;
    return [pastCell(y, m) ? "past" : "", CUR.has(k) ? "h" : "", acc ? "s" : "", rq.some(r => r.status === "pending") ? "w" : "",
      f.sel && f.sel(y, m) ? "sel" : "", 
      // dragging back over hours you just took out shows them as your hours again (that's what letting go does)
      f.dc && f.dc.has(k) ? (v.t === "add" && SAVED.has(k) ? "h" : v.t) : CUR.has(k) && !SAVED.has(k) ? "add" : !CUR.has(k) && SAVED.has(k) ? "rm" : "", inRm && !pastCell(y, m) && held(y, m) ? "skip" : ""].filter(Boolean).join(" ");
  }
  const tip = (y, m) => { const rq = reqsAt(y, m); return dayName(y) + " · " + tm(m) + " ET · " + (rq.length ? rq.map(r => (r.status === "accepted" ? "Booked: " : "Waiting: ") + who(r)).join(", ") : CUR.has(key(y, m)) ? "Your hours" : "Free"); };
  function table() {
    const f = marks(), ds = wkDays();
    return '<table class="hp-pl"><thead><tr><th class="tm"></th>' + ds.map(d => '<th class="' + [d.ymd === UI.todayYmd() ? "today" : "", dayOver(d.ymd) ? "over" : ""].join(" ") + '">' +
        '<button type="button" data-day="' + d.ymd + '" title="' + esc(longDay(d.ymd) + (d.events[0] ? " · " + d.events[0].title : "")) + '">' + d.dow + "<b>" + d.n + "</b>" + (d.events[0] ? '<i class="evdot ' + d.events[0].kind + '"></i>' : "") + "</button></th>").join("") + "</tr></thead><tbody>" +
      ROWS.map(m => '<tr class="' + (m % 60 ? "hf" : "hr") + '"><th class="tm">' + (m % 60 ? "" : tm(m).replace(":00", "")) + "</th>" + ds.map(d => '<td class="' + cls(d.ymd, m, f) + '" data-y="' + d.ymd + '" data-m="' + m + '" title="' + esc(tip(d.ymd, m)) + '"></td>').join("") + "</tr>").join("") +
      "</tbody></table>";
  }
  const weekSw = () => weeks().length === 1 ? '<span class="bk-wk-only">Week 2</span>' : '<div class="bk-seg">' + weeks().map(w => '<button type="button" data-wk="' + w + '" aria-pressed="' + (HP.wk === w) + '">Week ' + w + "</button>").join("") + "</div>";
  const toolSw = () => '<div class="hp-tool" role="group" aria-label="What dragging does"><button type="button" data-tool="add" aria-pressed="' + (HP.tool === "add") + '">+ Add hours</button><button type="button" data-tool="rm" aria-pressed="' + (HP.tool === "rm") + '">− Remove hours</button></div>';
  // one tool: click or drag on empty time to add hours; click or drag on your hours to take them away
  const hint = () => "<b>Click or drag on empty time</b> to add hours. <b>Click or drag on your hours</b> to remove them. Click a session to see it. Hours with a session or waiting request in them stay until you decline or cancel it.";
  const KEY = '<div class="hp-key"><h6 class="hp-sub">Key</h6><span><i class="h"></i>Your hours</span><span><i class="s"></i>Booked session</span><span><i class="w"></i>Request waiting</span>' +
    '<span><i class="add"></i>Adding</span><span><i class="rm"></i>Removing</span><span><i class="evdot kickoff"></i>Kickoff</span><span><i class="evdot scrim"></i>Scrim day</span><span><i class="evdot mock"></i>Checkpoint</span></div>';
  const plannerHTML = () => '<div class="hp-bar"><button type="button" class="linkbtn" data-ov>‹ Overview</button><div class="hp-tools">' + weekSw() + '</div></div><p class="hp-hint"></p>' +
    '<div class="hp-body"><div class="hp-scroll">' + table() + '</div><div class="hp-right"' + (HP.rightH ? ' style="min-height:' + HP.rightH + 'px"' : "") + '><div class="hp-save" hidden></div><aside class="hp-side"></aside>' + KEY + "</div></div>";
  // changes not saved yet: what they add up to, and one button that saves them all
  function unsaved() {
    const plus = [...CUR].filter(k => !SAVED.has(k)).length * 30, minus = [...SAVED].filter(k => !CUR.has(k)).length * 30;
    const days = D.days.map(d => d.ymd).filter(y => ROWS.some(m => CUR.has(key(y, m)) !== SAVED.has(key(y, m))));
    return { plus, minus, days };
  }
  function saveBar() {
    const u = unsaved(); if (!u.days.length) return "";
    return '<b>Changes not saved yet</b><span>' + [u.plus ? "+ " + hrs(u.plus) : "", u.minus ? "− " + hrs(u.minus) : ""].filter(Boolean).join(" · ") + " · " + esc(daysLabel(u.days)) + "</span>" +
      '<div class="hp-acts"><button type="button" class="btn" data-saveall>Save changes</button><button type="button" class="linkbtn end" data-undoall>Undo all</button></div>';
  }
  // redraw the planner's marks, the side panel and the hint (without rebuilding the planner)
  function refresh() {
    const s = panel.querySelector(".hp-side"); if (!s) return;
    const f = marks(), v = HP.view;
    panel.querySelectorAll(".hp-pl td[data-y]").forEach(td => { const c = cls(td.dataset.y, +td.dataset.m, f); if (td.className !== c) td.className = c; });
    panel.querySelectorAll(".hp-pl thead [data-day]").forEach(b => b.parentNode.classList.toggle("on", v.t === "day" && v.y === b.dataset.day));
    s.className = "hp-side" + (v.t === "add" ? " is-add" : v.t === "rm" ? " is-rm" : "");
    s.innerHTML = side(); s.hidden = !s.innerHTML;
    const R = panel.querySelector(".hp-right"), k = R.querySelector(".hp-key"), sv = R.querySelector(".hp-save");
    sv.innerHTML = saveBar(); sv.hidden = !sv.innerHTML;
    HP.rightH = Math.max(HP.rightH, s.offsetHeight + 14 + k.offsetHeight + (sv.hidden ? 0 : sv.offsetHeight + 14));
    R.style.minHeight = HP.rightH + "px";
    const h = panel.querySelector(".hp-hint"); h.className = "hp-hint" + (rmTool() ? " rm" : ""); h.innerHTML = hint();
  }

  /* ---------- Hours: the side panel ---------- */
  const back = () => '<button type="button" class="linkbtn hp-back" data-back>‹ Back to week ' + HP.wk + "</button>";
  const rows = list => '<ul class="hp-rows">' + list.map(r => '<li><button type="button" class="cc-srow ' + (r.status === "accepted" ? "acc" : "pen") + '" data-req="' + esc(r.id) + '"><b>' + span(...rSpan(r)) + "</b><span>" +
    esc(who(r)) + " · " + (r.status === "accepted" ? "Booked" : "Waiting") + " · " + (r.kind === "team" ? "Team review" : "Individual") + "</span></button></li>").join("") + "</ul>";
  // hour in / hour out and the days: the same boxes for typed times and for a drag
  function form(v) {
    const sel = (io, from, to, val) => '<select data-io="' + io + '">' + (val == null ? '<option value="" selected disabled>Pick</option>' : "") + steps(from, to).map(m => '<option value="' + m + '"' + (m === val ? " selected" : "") + ">" + tm(m) + "</option>").join("") + "</select>";
    const open = openDays();
    return '<div class="hp-io"><label>Hour in (ET)' + sel("a", M0, M1 - 30, v.a) + "</label><label>Hour out (ET)" + sel("b", v.a != null ? v.a + 30 : M0 + 30, M1, v.b) + "</label></div>" +
      '<div class="hp-dpick" role="group" aria-label="Days">' + wkDays().map(d => '<button type="button" data-dchip="' + d.ymd + '" aria-pressed="' + v.days.includes(d.ymd) + '"' + (dayOver(d.ymd) ? " disabled" : "") + ">" + d.dow + " " + d.n + "</button>").join("") +
      '<button type="button" class="all" data-dall aria-pressed="' + (open.length > 0 && open.every(y => v.days.includes(y))) + '">All week</button></div>';
  }
  function sideWeek() {
    return "";   // nothing picked: no panel (the owner didn't want the week summary here)
  }
  function sideRange(v) {
    const add = v.t === "add", c = changes(v), ready = v.a != null && v.b != null && v.days.length, dragging = !!(drag && drag.moved), y0 = v.days[0];
    let out = back() + '<span><em class="hp-badge ' + v.t + '">' + (add ? "+ Adding hours" : "− Removing hours") + '</em> <button type="button" class="linkbtn" data-flip>' + (add ? "Remove these times instead" : "Add these times instead") + "</button></span>";
    if (ready) out += '<p class="hp-big">' + span(v.a, v.b) + ' ET</p><p class="hp-mut">' + esc(daysLabel(v.days)) + " · " + hrs(v.b - v.a) + (v.days.length > 1 ? " a day" : "") + (yours(y0, v.a, v.b) ? "<br>" + esc(yours(y0, v.a, v.b)) : "") + "</p>";
    out += form(v);
    if (!ready) return out + '<p class="hp-mut">' + (v.a == null || v.b == null ? "Pick an hour in and an hour out" + (v.days.length ? "." : ", and the days.") : "Pick the days.") + '</p><div class="hp-acts"><button type="button" class="linkbtn" data-back>Cancel</button></div>';
    // removing: sessions and waiting requests in these times lock it until they're declined or cancelled
    if (c.held.length) return out + '<p class="hp-warn"><b>Decline or cancel ' + (c.held.length === 1 ? "this" : "these") + " first.</b> Hours with a booked session or a waiting request in them can't be removed. Click one to answer it.</p>" + rows(c.held) +
      (dragging ? "" : '<div class="hp-acts"><button type="button" class="btn cc-danger" data-go disabled>Remove hours</button><button type="button" class="linkbtn end" data-back>Cancel</button></div>');
    const joins = add && c.per.some(p => runs(c.next, p.y).length < runs(CUR, p.y).length + 1);
    out += '<dl class="hp-kv"><dt>' + (add ? "Adds" : "Removes") + "</dt><dd><b>" + (c.sum ? hrs(c.sum) : "Nothing") + "</b>" + (c.per.length > 1 ? " over " + c.per.length + " days" : "") + "</dd>" +
      "<dt>Week " + HP.wk + "</dt><dd>" + hrs(weekTotal(CUR)) + " → <b>" + hrs(weekTotal(c.next)) + "</b></dd></dl>" +
      // each changed day as it will be
      (c.per.length ? '<h6 class="hp-sub">Your hours after this</h6><ul class="hp-dlist static">' + c.per.map(p => { const rs = runs(c.next, p.y); return '<li><span class="d">' + esc(dayName(p.y)) + '</span><span class="t' + (rs.length ? "" : " none") + '">' + (rs.length ? rs.map(r => short(...r)).join("<br>") : "No hours") + '</span><span class="n">' + (rs.length ? hrs(total(c.next, p.y)) : "") + "</span></li>"; }).join("") + "</ul>" : "");
    if (!c.sum) out += '<p class="hp-mut">' + (add ? "These times are already your hours." : "None of your hours are in these times.") + "</p>";
    if (joins) out += '<p class="hp-mut">Hours that touch or overlap join into one block.</p>';
    out += dragging ? '<p class="hp-mut">Let go to check it over.</p>'
      : '<div class="hp-acts"><button type="button" class="btn' + (add ? "" : " cc-danger") + '" data-go' + (c.sum ? "" : " disabled") + ">" + (add ? "Add to planner" : "Remove from planner") + '</button><button type="button" class="linkbtn end" data-back>Cancel</button></div>';
    return out;
  }
  function sideBlock(v) {
    if (!runs(CUR, v.y).some(r => r[0] === v.a && r[1] === v.b)) { HP.view = { t: "week" }; return sideWeek(); }
    const inside = reqsIn(v.y, v.a, v.b), same = sameAs(v.y, v.a, v.b), E = v.edit, over = pastCell(v.y, v.b - 30);
    const sel = (io, from, to, val) => '<select data-eio="' + io + '">' + steps(from, to).map(m => '<option value="' + m + '"' + (m === val ? " selected" : "") + ">" + tm(m) + "</option>").join("") + "</select>";
    const out = back() + '<span class="hp-k">Your hours</span><h5>' + esc(dayShort(v.y)) + '</h5><p class="hp-big">' + span(v.a, v.b) + ' ET</p><p class="hp-mut">' + hrs(v.b - v.a) + (yours(v.y, v.a, v.b) ? "<br>" + esc(yours(v.y, v.a, v.b)) : "") + "</p>" +
      '<h6 class="hp-sub">In these hours</h6>' + (inside.length ? rows(inside) : '<p class="hp-mut">Nothing booked or waiting yet.</p>') +
      (same.length ? '<p class="hp-mut">Same hours on ' + (same.length > 4 ? same.length + " other days" : same.map(dayName).join(", ")) + ".</p>" : "");
    if (over) return out + '<p class="hp-mut">These hours are over.</p>';
    if (!E) return out + '<div class="hp-acts"><button type="button" class="btn ghost" data-edit>Change times</button><button type="button" class="btn ghost" data-rmblock>Remove hours</button></div>';
    return out + '<h6 class="hp-sub">Change times</h6><div class="hp-io"><label>Hour in (ET)' + sel("a", M0, M1 - 30, E.a) + "</label><label>Hour out (ET)" + sel("b", E.a + 30, M1, E.b) + "</label></div>" +
      (same.length ? '<label class="hp-also"><input type="checkbox" data-also' + (E.all ? " checked" : "") + "> Also change the " + (same.length === 1 ? "other day" : same.length + " other days") + " with these hours (" + same.map(dayName).join(", ") + ")</label>" : "") +
      (E.lost && E.lost.length ? '<p class="hp-warn"><b>Decline or cancel ' + (E.lost.length === 1 ? "this" : "these") + " first, or keep " + (E.lost.length === 1 ? "it" : "them") + " inside the new times.</b> " + (E.lost.length === 1 ? "It's" : "They're") + " outside the times you picked. Click one to answer it.</p>" + rows(E.lost) : "") +
      '<div class="hp-acts"><button type="button" class="btn" data-esave' + (E.a === v.a && E.b === v.b ? " disabled" : "") + '>Save changes</button><button type="button" class="linkbtn end" data-ecancel>Cancel</button></div>';
  }
  function sideDay(v) {
    const d = D.days.find(x => x.ymd === v.y), rs = runs(CUR, v.y), list = reqsIn(v.y, M0, M1);
    return back() + '<span class="hp-k">Day</span><h5>' + esc(longDay(v.y)) + "</h5>" + (d.events[0] ? '<p class="hp-mut">' + esc(d.events[0].title) + "</p>" : "") +
      '<h6 class="hp-sub">Your hours · ' + (rs.length ? hrs(total(CUR, v.y)) : "none") + "</h6>" +
      (rs.length ? '<ul class="hp-dlist two">' + rs.map(r => '<li><button type="button" data-block="' + v.y + "|" + r[0] + "|" + r[1] + '"><span class="t">' + span(...r) + '</span><span class="n">' + hrs(r[1] - r[0]) + "</span></button></li>").join("") + "</ul>" : '<p class="hp-mut">No hours on this day yet.</p>') +
      '<h6 class="hp-sub">Sessions and requests</h6>' + (list.length ? rows(list) : '<p class="hp-mut">None on this day.</p>') +
      (dayOver(v.y) ? "" : '<div class="hp-acts"><button type="button" class="btn ghost" data-addday>+ Add hours on this day</button></div>');
  }
  function sideReq(v) {
    const r = LIVE.find(x => x.id === v.id); if (!r) { HP.view = { t: "week" }; return sideWeek(); }
    const y = rDay(r), [a, b] = rSpan(r), t = teamOf(r), pending = r.status === "pending";
    const also = pending ? LIVE.filter(x => x.id !== r.id && x.status === "pending" && T(x.starts_at) < T(r.ends_at) && T(r.starts_at) < T(x.ends_at)) : [];
    const future = new Date(pending ? r.starts_at : r.ends_at) > new Date(UI.now());
    return back() + '<span class="hp-k">' + (pending ? "Request waiting" : "Booked session") + "</span><h5>" + (r.kind === "team" ? "Team review" : "Individual") + "</h5>" +
      '<dl class="hp-kv"><dt>When</dt><dd>' + esc(dayShort(y)) + "<br><b>" + span(a, b) + " ET</b> · " + hrs(b - a) + (yours(y, a, b) ? '<br><span class="hp-mut">' + esc(yours(y, a, b)) + "</span>" : "") + "</dd>" +
      "<dt>" + (r.by_coach ? "With" : "From") + "</dt><dd>" + (r.by_coach && r.kind === "team" ? esc(who(r)) + ' <span class="sc-tag">Your team</span>' : esc(who(r)) + (t ? "<br>" + esc(t.name) + (t.coach_id === ctx.coach.id ? ' <span class="sc-tag">Your team</span>' : ' <span class="sc-tag other">Other team</span>') : '<br><span class="hp-mut">Not on a team</span>')) + "</dd>" +
      (r.note ? "<dt>Note</dt><dd>“" + esc(r.note) + "”</dd>" : "") +
      (r.by_coach ? "<dt>Written</dt><dd>By you · " + esc(UI.sentAt(r.created_at)) + "</dd>"
                  : "<dt>Sent</dt><dd>" + esc(UI.sentAt(r.created_at)) + (also.length ? ' <span class="cc-otag">' + UI.sentRank(r, LIVE) + "</span>" : "") + "</dd>") +
      (also.length ? "<dt>Also waiting</dt><dd>" + also.map(x => '<button type="button" class="linkbtn" data-req="' + esc(x.id) + '">' + esc(who(x)) + '</button> <span class="hp-mut">' + UI.sentGap(x, r) + "</span>").join("<br>") + "</dd>" : "") + "</dl>" +
      (future ? '<div class="hp-acts">' + (pending ? '<button type="button" class="btn" data-ans="accepted">Accept</button><button type="button" class="btn ghost" data-ans="declined">Decline</button>' : '<button type="button" class="btn ghost" data-ans="cancelled">Cancel session</button>') + "</div>" : "");
  }
  const side = () => ({ add: sideRange, rm: sideRange, block: sideBlock, day: sideDay, req: sideReq }[HP.view.t] || sideWeek)(HP.view);

  /* ---------- Hours: saving (only after "are you sure?") ---------- */
  // the planner works in half hours: saving posts the new stretches and takes out the removed ones, day by day
  async function apply(next, days) {
    const diff = (A, B, y) => { const s = new Set(); ROWS.forEach(m => { const k = key(y, m); if (A.has(k) && !B.has(k)) s.add(k); }); return runs(s, y); };
    for (const y of days) {
      for (const [a, b] of diff(next, SAVED, y)) await API.saveHours(ctx.coach.id, null, at(y, a).toISOString(), at(y, b).toISOString());
      for (const [a, b] of diff(SAVED, next, y)) await API.removeHours(ctx.coach.id, at(y, a).toISOString(), at(y, b).toISOString());
    }
  }
  const commit = (next, days, view, msg) => UI.act(null, async () => {
    try { await apply(next, days); HP.view = view; }
    finally { await ctx.rerender(); }   // shows what's saved, even if something failed halfway
  }, msg);
  // a draft goes onto the planner straight away; nothing is saved until Save changes
  function stage() {
    // times with a session or waiting request are skipped (they stay), so a click or drag never gets stuck
    const v = HP.view, next = new Set(CUR);
    if (v.a != null && v.b != null) v.days.forEach(y => { for (let m = v.a; m < v.b; m += 30) { if (pastCell(y, m)) continue; if (v.t === "add") next.add(key(y, m)); else if (!held(y, m)) next.delete(key(y, m)); } });
    CUR = next; HP.view = { t: "week" }; refresh();
  }
  async function saveAll() {
    const u = unsaved(); if (!u.days.length) return;
    const ok = await UI.ask({
      kicker: "Save hours", title: "Save these changes?",
      lead: [u.plus ? "Adds " + hrs(u.plus) : "", u.minus ? "removes " + hrs(u.minus) : ""].filter(Boolean).join(", ") + "<br>" + esc(daysLabel(u.days)),
      points: u.days.map(y => "<b>" + esc(dayName(y)) + "</b> " + (total(CUR, y) ? "becomes " + runText(CUR, y) + " (" + hrs(total(CUR, y)) + ")" : "has no hours left") + ".")
        .concat(["Players see the new hours right away."]),
      yes: "Yes, save"
    });
    if (!ok) return;
    await commit(CUR, u.days, { t: "week" }, "Saved your hours.");
  }
  const confirmRange = () => stage();
  function saveEdit() {
    const v = HP.view, E = v.edit, days = [v.y].concat(E.all ? sameAs(v.y, v.a, v.b) : []);
    // booked sessions and waiting requests have to stay inside the new hours, or be declined or cancelled first
    E.lost = LIVE.filter(r => holds(r) && days.includes(rDay(r)) && rSpan(r)[0] >= v.a && rSpan(r)[1] <= v.b && (rSpan(r)[0] < E.a || rSpan(r)[1] > E.b));
    if (E.lost.length) return refresh();
    const next = new Set(CUR);
    days.forEach(y => { for (let m = v.a; m < v.b; m += 30) if (!pastCell(y, m)) next.delete(key(y, m)); for (let m = E.a; m < E.b; m += 30) if (!pastCell(y, m)) next.add(key(y, m)); });
    CUR = next; HP.view = { t: "day", y: v.y }; return refresh();   // saved with the rest by Save changes
  }

  /* ---------- Hours: clicking and dragging ---------- */
  // a drag covers the same times on every day it crosses
  function rangeOf(d) {
    const ds = wkDays().map(x => x.ymd), i = ds.indexOf(d.y0), j = ds.indexOf(d.y1);
    return { t: d.kind, days: ds.slice(Math.min(i, j), Math.max(i, j) + 1).filter(y => !dayOver(y)), a: Math.min(d.m0, d.m1), b: Math.max(d.m0, d.m1) + 30 };
  }
  // a click (or a tap on a phone): a session or request opens; your hours open (or, removing, get marked); an empty time starts an hour of new hours
  function clickAt(y, m) {
    const rq = reqsAt(y, m), run = runs(CUR, y).find(r => m >= r[0] && m < r[1]);
    if (rq.length) return openReq(rq[0].id, y + "|all");   // the full pop-up: that day's requests on the left, so overlaps show
    else if (run) HP.view = { t: "rm", days: [y], a: m, b: Math.min(m + 60, run[1]) };   // clicking your hours takes that hour away
    else HP.view = { t: "add", days: [y], a: m, b: Math.min(m + 60, M1) };
    HP.tool = HP.view.t === "rm" ? "rm" : "add";
    refresh();
  }
  // the label by the cursor while dragging: "+ 6:00 PM–9:30 PM · 3.5 h"
  const tag = () => { if (!TAG) { TAG = document.createElement("div"); TAG.className = "hp-tag"; TAG.hidden = true; document.body.appendChild(TAG); } return TAG; };
  function tagText() {
    const v = HP.view; if (!isDraft() || !drag) return;
    const t = tag(); t.className = "hp-tag " + v.t; t.hidden = false;
    const c = changes(v);
    t.textContent = (v.t === "add" ? "+ " : "− ") + span(v.a, v.b) + (v.days.length > 1 ? " · " + v.days.length + " days" : "") + " · " + hrs(c.sum) + (c.held.length ? " · " + c.held.length + " to answer first" : "");
  }
  // the page may be zoomed (styles.css), and a fixed element's left and top are in zoomed pixels
  const tagAt = (x, y) => { const t = tag(), z = parseFloat(getComputedStyle(document.documentElement).zoom) || 1; t.style.left = Math.max(8, Math.min(x + 16, innerWidth - t.offsetWidth * z - 8)) / z + "px"; const d = drag || wdrag, up = d && d.m1 < d.m0;   // dragging up: the label goes above the cursor, so it never covers what you just marked
    t.style.top = (up ? y - 20 - t.offsetHeight * z : y + 20) / z + "px"; };
  // redraw at most once a frame, however fast the pointer moves
  const refreshSoon = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; refresh(); tagText(); }); };
  function down(e) {
    const td = e.target.closest(".hp-pl td[data-y]");
    if (!td || e.button !== 0 || td.classList.contains("past")) return;
    // starting on your hours removes, starting on empty time adds
    HP.tool = CUR.has(key(td.dataset.y, +td.dataset.m)) ? "rm" : "add";
    drag = { y0: td.dataset.y, m0: +td.dataset.m, y1: td.dataset.y, m1: +td.dataset.m, kind: HP.tool, touch: e.pointerType === "touch", moved: false };
    if (!drag.touch) e.preventDefault();   // touch keeps scrolling; a tap acts like a click
  }
  function move(e) {
    if (!drag || drag.touch) return;
    if (!(e.buttons & 1)) return end({ type: "pointerup" });   // the button was let go without us hearing: it still counts as the click it was
    // the cell the pointer is on (e.target: right even when the page is zoomed, where clientX/Y and elementFromPoint disagree)
    const n = e.target, td = n && n.closest && n.closest(".hp-pl td[data-y]");
    if (td && panel.contains(td) && (td.dataset.y !== drag.y1 || +td.dataset.m !== drag.m1)) {
      drag.y1 = td.dataset.y; drag.m1 = +td.dataset.m; drag.moved = true;
      HP.view = rangeOf(drag); refreshSoon();
    }
    if (drag.moved) tagAt(e.clientX, e.clientY);
  }
  function end(e) {
    if (!drag) return;
    const d = drag; drag = null;
    if (TAG) TAG.hidden = true;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (d.moved) return stage();   // goes on the planner; Save changes saves it all
    if (e.type === "pointerup") { clickAt(d.y0, d.m0); if (isDraft()) stage(); }
  }
  // typed times and day buttons edit the draft (starting one from the week view)
  function draftEdit(fn) {
    if (!isDraft()) HP.view = { t: rmTool() ? "rm" : "add", days: [], a: null, b: null };
    fn(HP.view); refresh();
  }
  const openPlanner = view => { HP.page = "edit"; HP.view = view; HP.rightH = 0; paint(); };
  function hoursClick(e) {
    const on = s => e.target.closest(s); let x;
    if ((x = on("[data-ovday]"))) { const y = x.dataset.ovday; HP.wk = D.days.find(d => d.ymd === y).week; return openPlanner({ t: "day", y }); }
    if (on("[data-edithours]")) return openPlanner({ t: "week" });
    if (on("[data-ov]")) { HP.page = "overview"; HP.view = { t: "week" }; return paint(); }
    if ((x = on("[data-wk]"))) { HP.wk = +x.dataset.wk; HP.view = { t: "week" }; return paint(); }
    if ((x = on("[data-tool]"))) { HP.tool = x.dataset.tool; HP.view = { t: "week" }; return paint(); }
    if ((x = on("[data-dchip]"))) { const y = x.dataset.dchip; return draftEdit(v => { v.days = v.days.includes(y) ? v.days.filter(q => q !== y) : v.days.concat(y).sort(); }); }
    if (on("[data-dall]")) return draftEdit(v => { const open = openDays(); v.days = open.every(y => v.days.includes(y)) ? [] : open; });
    if ((x = on("[data-day]"))) { HP.view = { t: "day", y: x.dataset.day }; return refresh(); }
    if (on("[data-back]")) { HP.view = { t: "week" }; return refresh(); }
    if ((x = on("[data-block]"))) { const [y, a, b] = x.dataset.block.split("|"); HP.view = { t: "block", y, a: +a, b: +b, edit: null }; return refresh(); }
    if ((x = on("[data-req]"))) { const r = LIVE.find(q => q.id === x.dataset.req); return openReq(x.dataset.req, r ? rDay(r) + "|all" : ""); }
    if (on("[data-addday]")) { HP.view = { t: "add", days: [HP.view.y], a: 1080, b: 1200 }; return refresh(); }
    if (on("[data-edit]")) { const v = HP.view; v.edit = { a: v.a, b: v.b, all: false, lost: null }; return refresh(); }
    if (on("[data-ecancel]")) { HP.view.edit = null; return refresh(); }
    if (on("[data-esave]")) return saveEdit();
    if (on("[data-rmblock]")) { const v = HP.view; HP.view = { t: "rm", days: [v.y], a: v.a, b: v.b }; return refresh(); }
    if (on("[data-saveall]")) return saveAll();
    if (on("[data-undoall]")) { CUR = new Set(SAVED); HP.view = { t: "week" }; return refresh(); }
    if (on("[data-flip]")) { const v = HP.view; v.t = HP.tool = v.t === "add" ? "rm" : "add"; return refresh(); }
    if (on("[data-go]")) return confirmRange();
    if ((x = on("[data-ans]"))) {
      // Accept / Decline / Cancel session: say what will happen first (UI.askRequest), then act
      const r = LIVE.find(q => q.id === HP.view.id), t = r && teamOf(r), s = x.dataset.ans;
      return UI.askRequest({ r, status: s, team: t && t.name, reqs: D.reqs }).then(ok => ok &&
        UI.act(x, async () => { await API.setRequestStatus(r.id, s); await ctx.rerender(); },
          { accepted: "Accepted. It's on your calendar.", declined: "Declined.", cancelled: "Session cancelled." }[s]));
    }
  }
  function hoursChange(e) {
    const t = e.target;
    if (t.dataset.io) return draftEdit(v => { v[t.dataset.io] = +t.value; if (t.dataset.io === "a" && (v.b == null || v.b <= v.a)) v.b = Math.min(v.a + 60, M1); });
    if (t.dataset.eio) { const E = HP.view.edit; E[t.dataset.eio] = +t.value; if (E.b <= E.a) E.b = Math.min(E.a + 60, M1); E.lost = null; return refresh(); }
    if (t.hasAttribute("data-also")) { HP.view.edit.all = t.checked; HP.view.edit.lost = null; return refresh(); }
  }

  /* ---------- paint + events ---------- */
  function paint() {
    // one page: the sessions calendar on top, your hours under it
    const head = '<div class="dp-head"><h2>Your calendar</h2></div>';
    const sessions = '<div class="cc-hintrow"><p class="muted small cc-hint">Click a day to see its booked sessions and waiting requests. Click it again to close.</p></div>' + grid() + legend() + sessionsView();
    const hours = '<div class="cc-hours"><h3 class="cc-hours-h">Your hours</h3>' + (HP.page === "overview" ? overview() : plannerHTML()) + "</div>";
    panel.innerHTML = head + sessions + hours;
    if (HP.page !== "overview") refresh();
  }
  function mount(el, deskCtx) {
    panel = el; ctx = deskCtx;
    D = { blocks: deskCtx.blocks, reqs: deskCtx.reqs, teams: deskCtx.teams, profiles: deskCtx.profiles || [], days: UI.eventDays() };
    index();
    if (!weeks().includes(HP.wk)) HP.wk = weeks()[0];
    paint();
    panel.onclick = e => {
      const on = s => e.target.closest(s); let x;
      const inHours = !!on(".cc-hours");
      if (inHours) return hoursClick(e);
      if ((x = on("[data-req]"))) return openReq(x.dataset.req, x.dataset.set || "");
      if ((x = on(".hit"))) { const y = x.dataset.day; ST.open = ST.open === y ? null : y; return paint(); }
      if (on("[data-closeday]")) { ST.open = null; return paint(); }
    };
    panel.onchange = e => { if (e.target.closest(".cc-hours")) hoursChange(e); };
    panel.onpointerdown = e => down(e);
    panel.onpointermove = e => move(e);
    if (!wired) { wired = true; ["pointerup", "pointercancel"].forEach(t => { document.addEventListener(t, end); document.addEventListener(t, wEnd); }); }
  }

  // the desk header's "Hours posted" brings your hours into view (they're always on the page now)
  function mode() { if (panel && D) paint(); }

  window.PTGCoachCal = { mount, openReq, mode };   // openReq: the desk's Requests waiting cards open the same pop-up
})();
