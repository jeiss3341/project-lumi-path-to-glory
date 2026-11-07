/* Path to Glory · the mentor's calendar on the desk (desk → Mentor calendar → Your calendar).
   Sessions: (opens first) both weeks; click a day to list its booked sessions and waiting requests.
   Hours:    opens on an overview of both weeks, just to look: your hours and each day's total. Click a day, or
             Change hours, for the week planner (Eastern, 8 AM to 4 AM, in half hours) with a side panel.
             + Add hours / − Remove hours says what dragging does; or type the times and pick the days in the panel.
             Nothing changes until you press Add / Remove and say yes. Booked sessions always keep their time.
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
  const pastCell = (ymd, m) => at(ymd, m + 30).getTime() <= Date.now();
  const dayOver = ymd => at(ymd, M1) <= new Date();
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
  const upcoming = ymd => D.blocks.filter(b => blockDay(b) === ymd && new Date(b.ends_at) > new Date()).sort((p, q) => T(p.starts_at) - T(q.starts_at));
  const reqsOn = ymd => D.reqs.filter(r => UI.dayOf(r.starts_at) === ymd && (r.status === "accepted" || r.status === "pending")).sort((p, q) => T(p.starts_at) - T(q.starts_at));
  const who = r => UI.who(r.requester);
  const teamOf = r => D.teams.find(x => (x.member_ids || []).includes(r.requester_id));
  // for the planner, worked out once per mount (it asks on every cell): your hours as half-hour cells, and each
  // waiting or booked request's day, minutes and cells
  let CUR = new Set(), LIVE = [], RD = new Map(), AT = new Map();
  function index() {
    CUR = new Set();
    D.blocks.forEach(b => { const y = blockDay(b), [a, e] = bm(b); for (let m = a; m < e; m += 30) CUR.add(key(y, m)); });
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
  const outside = (set, r) => { const d = RD.get(r.id); for (let m = d.a; m < d.b; m += 30) if (!set.has(key(d.y, m))) return true; return false; };
  // stretches of hours on a day: [[a, b], …] in minutes
  const runs = (set, y) => { const out = []; ROWS.forEach(m => { if (!set.has(key(y, m))) return; const l = out[out.length - 1]; if (l && l[1] === m) l[1] = m + 30; else out.push([m, m + 30]); }); return out; };
  const total = (set, y) => runs(set, y).reduce((n, r) => n + r[1] - r[0], 0);
  const runText = (set, y) => runs(set, y).map(r => span(...r)).join(", ");

  /* ---------- Sessions ---------- */
  function cell(d) {
    if (dayOver(d.ymd)) return '<div class="cc-day past"><span class="cd-top"><small>' + d.dow + "</small><b>" + d.n + "</b></span></div>";   // a day that's over: just its date
    const on = ST.open === d.ymd, up = upcoming(d.ymd), rq = reqsOn(d.ymd), ev = d.events[0];
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
  const legend = () => '<div class="cc-legend"><span><i class="lg hrs-tint"></i>Your hours</span><span><i class="lg acc"></i>Booked session</span><span><i class="lg pen"></i>Request waiting</span><span><i class="evdot kickoff"></i>Kickoff</span><span><i class="evdot scrim"></i>Scrim day</span><span><i class="evdot mock"></i>Checkpoint</span></div>';
  function sessionsView() {
    if (ST.open && dayOver(ST.open)) ST.open = null;
    if (!ST.open) return '<p class="empty-note">Click a day to see its sessions and requests.</p>';
    const list = reqsOn(ST.open), ev = D.days.find(d => d.ymd === ST.open).events[0];
    return '<div class="cc-dhead"><h3>' + esc(longDay(ST.open)) + '</h3><button type="button" class="linkbtn" data-closeday>Close</button></div>' + (ev ? '<p class="muted small">' + esc(ev.title) + "</p>" : "") +
      (list.length ? '<ul class="cc-list">' + list.map(r => '<li class="cc-row ' + (r.status === "accepted" ? "acc" : "pen") + '"><div class="cc-info"><span class="t">' + span(mins(r.starts_at, ST.open), mins(r.ends_at, ST.open)) + "</span><span>" + UI.statusChip(r.status) + " " + esc(who(r)) + " · " + (r.kind === "team" ? "Team review" : "Individual") + "</span></div>" +
        '<button type="button" class="cc-act" data-req="' + esc(r.id) + '" data-set="' + ST.open + '|all">Details ›</button></li>').join("") + "</ul>"
                  : '<p class="empty-note">No sessions or requests on this day.</p>');
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
    if (y === "*") return D.reqs.filter(x => x.status === s && new Date(x.starts_at) > new Date()).sort((p, q) => T(p.starts_at) - T(q.starts_at)).map(x => x.id);
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
    d.innerHTML = '<div class="cc-split">' + side + "<div>" + '<div class="sc-dtop"><div><span class="k">' + (pending ? "Request waiting for you" : r.status === "accepted" ? "Booked session" : "Request") + '</span><h3 id="cc-dlg-title">' + (r.kind === "team" ? "Team review" : "Individual session") + "</h3></div>" + UI.statusChip(r.status) + "</div>" +
      '<dl class="sc-kv">' +
        kv("When", esc(longDay(ymd)) + "<br><b>" + span(mins(r.starts_at, ymd), mins(r.ends_at, ymd)) + " ET</b> · " + esc(UI.dur(r.starts_at, r.ends_at)) + (UI.onEastern(new Date(r.starts_at)) ? "" : '<br><span class="muted">Your time: ' + esc(UI.time(r.starts_at) + "–" + UI.time(r.ends_at)) + "</span>")) +
        kv("From", esc(who(r)) + ' <span class="muted">@' + esc((r.requester && r.requester.username) || "") + "</span>" + (t ? "<br>" + esc(t.name) + (mine ? ' <span class="sc-tag">Your team</span>' : ' <span class="sc-tag other">Other team</span>') : '<br><span class="muted">Not on a team</span>')) +
        kv("Wants to work on", r.note ? "“" + esc(r.note) + "”" : '<span class="muted">No note added.</span>') +
        // when it was sent, and its place among overlapping requests ("2nd of 2")
        kv("Sent", esc(UI.sentAt(r.created_at)) + (also.length ? ' <span class="cc-otag">' + UI.sentRank(r, D.reqs) + "</span>" : "")) +
        // other requests for the same time, with who asked first: accepting this one declines them
        (also.length ? kv("Also waiting", '<ul class="sc-in">' + also.map(x => '<li><button type="button" class="linkbtn" data-req="' + esc(x.id) + '">' + span(mins(x.starts_at, ymd), mins(x.ends_at, ymd)) + " · " + esc(who(x)) + "</button>" +
            ' <span class="muted small">' + UI.sentGap(x, r) + "</span></li>").join("") +
          '</ul><span class="muted small">Same time as this one. Accepting this declines ' + (also.length === 1 ? "it" : "them") + ".</span>") : "") +
      "</dl>" +
      '<div class="sc-dact">' +
        (pending && new Date(r.starts_at) > new Date() ? '<button type="button" class="btn" data-do="accepted" data-id="' + esc(r.id) + '">Accept</button><button type="button" class="btn ghost" data-do="declined" data-id="' + esc(r.id) + '">Decline</button>' : "") +
        (r.status === "accepted" && new Date(r.ends_at) > new Date() ? '<button type="button" class="btn ghost" data-do="cancelled" data-id="' + esc(r.id) + '">Cancel session</button>' : "") +
        '<button type="button" class="linkbtn" data-do="close">Close</button></div>' + "</div></div>";
    if (!d.open) d.showModal();
    const cur = d.querySelector('.cc-srow[aria-current="true"]');   // keep focus on the picked row, so ↑ ↓ keep working
    if (cur) cur.focus();
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

  // what a draft changes: the hours after it, minutes per day, booked sessions it skips, waiting requests it leaves outside
  function changes(v) {
    const add = v.t === "add", next = new Set(CUR), per = [], skipped = [], waits = [];
    if (v.a == null || v.b == null || v.b <= v.a) return { next, per, skipped, waits, sum: 0 };
    v.days.forEach(y => {
      let n = 0;
      for (let m = v.a; m < v.b; m += 30) {
        const k = key(y, m);
        if (pastCell(y, m)) continue;
        if (add) { if (!next.has(k)) { next.add(k); n += 30; } }
        else if (next.has(k) && !booked(y, m)) { next.delete(k); n += 30; }
      }
      if (n) per.push({ y, n });
      if (!add) reqsIn(y, v.a, v.b).forEach(r => { if (r.status === "accepted") skipped.push(r); else if (!outside(CUR, r) && outside(next, r)) waits.push(r); });
    });
    return { next, per, skipped, waits, sum: per.reduce((n, p) => n + p.n, 0) };
  }
  // what to mark on the planner: the picked block or request, and the time a draft changes
  function marks() {
    const v = HP.view; let sel = null, dc = null;
    if (v.t === "block") sel = (y, m) => y === v.y && m >= v.a && m < v.b;
    if (v.t === "req") { const r = LIVE.find(x => x.id === v.id); if (r) { const y = rDay(r), [a, b] = rSpan(r); sel = (yy, m) => yy === y && m >= a && m < b; } }
    if (isDraft() && v.a != null && v.b != null) {
      dc = new Set();
      // only the time that actually changes: new hours when adding, your hours (not booked ones) when removing
      v.days.forEach(y => { for (let m = v.a; m < v.b; m += 30) if (!pastCell(y, m) && (v.t === "add" ? !CUR.has(key(y, m)) : CUR.has(key(y, m)) && !booked(y, m))) dc.add(key(y, m)); });
    }
    return { sel, dc };
  }
  function cls(y, m, f) {
    const k = key(y, m), rq = reqsAt(y, m), acc = rq.some(r => r.status === "accepted"), v = HP.view;
    const inRm = v.t === "rm" && v.a != null && v.days.includes(y) && m >= v.a && m < v.b;
    return [pastCell(y, m) ? "past" : "", CUR.has(k) ? "h" : "", acc ? "s" : "", rq.some(r => r.status === "pending") ? "w" : "",
      f.sel && f.sel(y, m) ? "sel" : "", f.dc && f.dc.has(k) ? v.t : "", inRm && acc ? "skip" : ""].filter(Boolean).join(" ");
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
  const hint = () => HP.tool === "add" ? "<b>Adding:</b> drag on the planner, or type the times in the panel. Click your hours or a session to see it."
                                       : "<b>Removing:</b> drag over your hours, click a block, or type the times in the panel.";
  const KEY = '<div class="hp-key"><h6 class="hp-sub">Key</h6><span><i class="h"></i>Your hours</span><span><i class="s"></i>Booked session</span><span><i class="w"></i>Request waiting</span>' +
    '<span><i class="add"></i>Adding</span><span><i class="rm"></i>Removing</span><span><i class="evdot kickoff"></i>Kickoff</span><span><i class="evdot scrim"></i>Scrim day</span><span><i class="evdot mock"></i>Checkpoint</span></div>';
  const plannerHTML = () => '<div class="hp-bar"><button type="button" class="linkbtn" data-ov>‹ Overview</button><div class="hp-tools">' + toolSw() + weekSw() + '</div></div><p class="hp-hint"></p>' +
    '<div class="hp-body"><div class="hp-scroll">' + table() + '</div><div class="hp-right"' + (HP.rightH ? ' style="min-height:' + HP.rightH + 'px"' : "") + '><aside class="hp-side"></aside>' + KEY + "</div></div>";
  // redraw the planner's marks, the side panel and the hint (without rebuilding the planner)
  function refresh() {
    const s = panel.querySelector(".hp-side"); if (!s) return;
    const f = marks(), v = HP.view;
    panel.querySelectorAll(".hp-pl td[data-y]").forEach(td => { const c = cls(td.dataset.y, +td.dataset.m, f); if (td.className !== c) td.className = c; });
    panel.querySelectorAll(".hp-pl thead [data-day]").forEach(b => b.parentNode.classList.toggle("on", v.t === "day" && v.y === b.dataset.day));
    s.className = "hp-side" + (v.t === "add" ? " is-add" : v.t === "rm" ? " is-rm" : "");
    s.innerHTML = side();
    const R = panel.querySelector(".hp-right"), k = R.querySelector(".hp-key");
    HP.rightH = Math.max(HP.rightH, s.offsetHeight + 14 + k.offsetHeight);
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
    const ds = wkDays(), inWk = LIVE.filter(r => ds.some(d => d.ymd === rDay(r))), h = weekTotal(CUR) / 60;
    return '<span class="hp-k">Week ' + HP.wk + " · " + esc(dayName(ds[0].ymd)) + " – " + esc(dayName(ds[ds.length - 1].ymd)) + "</span>" +
      '<div class="hp-stats"><div><b>' + (h % 1 ? h.toFixed(1) : h) + "</b><span>Hours</span></div><div><b>" + inWk.filter(r => r.status === "accepted").length + "</b><span>Booked</span></div><div><b>" + inWk.filter(r => r.status === "pending").length + "</b><span>Waiting</span></div></div>" +
      '<h6 class="hp-sub">Your hours</h6><ul class="hp-dlist">' + ds.map(d => {
        const rs = runs(CUR, d.ymd), n = total(CUR, d.ymd);
        return '<li><button type="button" data-day="' + d.ymd + '"' + (dayOver(d.ymd) ? ' class="over"' : "") + '><span class="d">' + d.dow + " " + d.n + '</span><span class="t' + (rs.length ? "" : " none") + '">' + (rs.length ? rs.map(r => short(...r)).join("<br>") : "No hours") + '</span><span class="n">' + (n ? hrs(n) : "") + "</span></button></li>";
      }).join("") + "</ul>" +
      (HP.view.note ? '<p class="hp-warn">' + esc(HP.view.note) + "</p>" : "") +
      '<h6 class="hp-sub">' + (rmTool() ? "Remove hours by time" : "Add hours by time") + "</h6>" + form({ days: [], a: null, b: null }) +
      '<p class="hp-mut">Pick the times and the days. You can also drag on the planner.</p>';
  }
  function sideRange(v) {
    const add = v.t === "add", c = changes(v), ready = v.a != null && v.b != null && v.days.length, dragging = !!(drag && drag.moved), y0 = v.days[0];
    let out = back() + '<span><em class="hp-badge ' + v.t + '">' + (add ? "+ Adding hours" : "− Removing hours") + "</em></span>";
    if (ready) out += '<p class="hp-big">' + span(v.a, v.b) + ' ET</p><p class="hp-mut">' + esc(daysLabel(v.days)) + " · " + hrs(v.b - v.a) + (v.days.length > 1 ? " a day" : "") + (yours(y0, v.a, v.b) ? "<br>" + esc(yours(y0, v.a, v.b)) : "") + "</p>";
    out += form(v);
    if (!ready) return out + '<p class="hp-mut">' + (v.a == null || v.b == null ? "Pick an hour in and an hour out" + (v.days.length ? "." : ", and the days.") : "Pick the days.") + '</p><div class="hp-acts"><button type="button" class="linkbtn" data-back>Cancel</button></div>';
    const joins = add && c.per.some(p => runs(c.next, p.y).length < runs(CUR, p.y).length + 1);
    out += '<dl class="hp-kv"><dt>' + (add ? "Adds" : "Removes") + "</dt><dd><b>" + (c.sum ? hrs(c.sum) : "Nothing") + "</b>" + (c.per.length > 1 ? " over " + c.per.length + " days" : "") + "</dd>" +
      "<dt>Week " + HP.wk + "</dt><dd>" + hrs(weekTotal(CUR)) + " → <b>" + hrs(weekTotal(c.next)) + "</b></dd></dl>" +
      // each changed day as it will be
      (c.per.length ? '<h6 class="hp-sub">Your hours after this</h6><ul class="hp-dlist static">' + c.per.map(p => { const rs = runs(c.next, p.y); return '<li><span class="d">' + esc(dayName(p.y)) + '</span><span class="t' + (rs.length ? "" : " none") + '">' + (rs.length ? rs.map(r => short(...r)).join("<br>") : "No hours") + '</span><span class="n">' + (rs.length ? hrs(total(c.next, p.y)) : "") + "</span></li>"; }).join("") + "</ul>" : "");
    if (!c.sum) out += '<p class="hp-mut">' + (add ? "These times are already your hours." : "None of your hours are in these times.") + "</p>";
    if (joins) out += '<p class="hp-mut">Hours that touch or overlap join into one block.</p>';
    if (c.skipped.length) out += '<p class="hp-warn">Booked sessions keep their time: ' + c.skipped.map(r => esc(who(r)) + " (" + esc(dayName(rDay(r))) + " " + short(...rSpan(r)) + ")").join(", ") + ". Cancel a session first to free it.</p>";
    if (c.waits.length) out += '<p class="hp-warn">' + (c.waits.length === 1 ? "1 waiting request" : c.waits.length + " waiting requests") + " would be outside your hours: " + c.waits.map(r => esc(who(r)) + " (" + esc(dayName(rDay(r))) + " " + short(...rSpan(r)) + ")").join(", ") + ". " + (c.waits.length === 1 ? "It stays" : "They stay") + " waiting, so you can still answer.</p>";
    out += dragging ? '<p class="hp-mut">Let go to check it over.</p>'
      : '<div class="hp-acts"><button type="button" class="btn' + (add ? "" : " cc-danger") + '" data-go' + (c.sum ? "" : " disabled") + ">" + (add ? "Add hours" : "Remove hours") + '</button><button type="button" class="linkbtn end" data-back>Cancel</button></div>';
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
      (E.err ? '<p class="hp-warn">' + esc(E.err) + "</p>" : "") +
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
    const future = new Date(pending ? r.starts_at : r.ends_at) > new Date();
    return back() + '<span class="hp-k">' + (pending ? "Request waiting" : "Booked session") + "</span><h5>" + (r.kind === "team" ? "Team review" : "Individual") + "</h5>" +
      '<dl class="hp-kv"><dt>When</dt><dd>' + esc(dayShort(y)) + "<br><b>" + span(a, b) + " ET</b> · " + hrs(b - a) + (yours(y, a, b) ? '<br><span class="hp-mut">' + esc(yours(y, a, b)) + "</span>" : "") + "</dd>" +
      "<dt>From</dt><dd>" + esc(who(r)) + (t ? "<br>" + esc(t.name) + (t.coach_id === ctx.coach.id ? ' <span class="sc-tag">Your team</span>' : ' <span class="sc-tag other">Other team</span>') : '<br><span class="hp-mut">Not on a team</span>') + "</dd>" +
      (r.note ? "<dt>Note</dt><dd>“" + esc(r.note) + "”</dd>" : "") +
      "<dt>Sent</dt><dd>" + esc(UI.sentAt(r.created_at)) + (also.length ? ' <span class="cc-otag">' + UI.sentRank(r, LIVE) + "</span>" : "") + "</dd>" +
      (also.length ? "<dt>Also waiting</dt><dd>" + also.map(x => '<button type="button" class="linkbtn" data-req="' + esc(x.id) + '">' + esc(who(x)) + '</button> <span class="hp-mut">' + UI.sentGap(x, r) + "</span>").join("<br>") + "</dd>" : "") + "</dl>" +
      (future ? '<div class="hp-acts">' + (pending ? '<button type="button" class="btn" data-ans="accepted">Accept</button><button type="button" class="btn ghost" data-ans="declined">Decline</button>' : '<button type="button" class="btn ghost" data-ans="cancelled">Cancel session</button>') + "</div>" : "");
  }
  const side = () => ({ add: sideRange, rm: sideRange, block: sideBlock, day: sideDay, req: sideReq }[HP.view.t] || sideWeek)(HP.view);

  /* ---------- Hours: saving (only after "are you sure?") ---------- */
  // the planner works in half hours: saving posts the new stretches and takes out the removed ones, day by day
  async function apply(next, days) {
    const diff = (A, B, y) => { const s = new Set(); ROWS.forEach(m => { const k = key(y, m); if (A.has(k) && !B.has(k)) s.add(k); }); return runs(s, y); };
    for (const y of days) {
      for (const [a, b] of diff(next, CUR, y)) await API.saveHours(ctx.coach.id, null, at(y, a).toISOString(), at(y, b).toISOString());
      for (const [a, b] of diff(CUR, next, y)) await API.removeHours(ctx.coach.id, at(y, a).toISOString(), at(y, b).toISOString());
    }
  }
  const commit = (next, days, view, msg) => UI.act(null, async () => {
    try { await apply(next, days); HP.view = view; }
    finally { await ctx.rerender(); }   // shows what's saved, even if something failed halfway
  }, msg);
  const waitWarn = n => n === 1 ? "This waiting request will be outside your hours. It stays waiting, so you can still answer it:" : "These waiting requests will be outside your hours. They stay waiting, so you can still answer them:";
  const waitLine = r => esc(who(r)) + " · " + esc(dayName(rDay(r))) + " " + span(...rSpan(r)) + " ET";
  async function confirmRange() {
    const v = HP.view, add = v.t === "add", c = changes(v);
    if (!c.sum) return;
    const ok = await UI.ask({
      kicker: add ? "Add hours" : "Remove hours", title: add ? "Add these hours?" : "Remove these hours?", danger: !add,
      lead: "<b>" + span(v.a, v.b) + " ET</b> · " + hrs(v.b - v.a) + (v.days.length > 1 ? " a day" : "") + "<br>" + esc(daysLabel(c.per.map(p => p.y))) + " · " + (add ? "adds " : "removes ") + hrs(c.sum) + (c.per.length > 1 ? " in all" : ""),
      points: [add ? "Players can request sessions in these times as soon as you add them." : "Players can't request these times anymore."]
        .concat(c.per.map(p => "<b>" + esc(dayName(p.y)) + "</b> " + (total(c.next, p.y) ? "becomes " + runText(c.next, p.y) + " (" + hrs(total(c.next, p.y)) + ")" : "has no hours left") + "."))
        .concat(c.skipped.length ? ["Booked sessions keep their time: " + c.skipped.map(r => esc(who(r))).join(", ") + "."] : [])
        .concat([add ? "You can change or remove them later." : "There's no undo, but you can add them again."]),
      warn: c.waits.length ? waitWarn(c.waits.length) : "", warnList: c.waits.map(waitLine),
      yes: add ? "Yes, add hours" : "Yes, remove hours"
    });
    if (!ok) return;
    const days = c.per.map(p => p.y);
    await commit(c.next, days, days.length === 1 ? { t: "day", y: days[0] } : { t: "week" },
      (add ? "Added " : "Removed ") + hrs(c.sum) + (days.length > 1 ? " over " + days.length + " days." : " on " + dayName(days[0]) + "."));
  }
  async function saveEdit() {
    const v = HP.view, E = v.edit, days = [v.y].concat(E.all ? sameAs(v.y, v.a, v.b) : []);
    for (const y of days) {   // booked sessions have to stay inside the new hours
      const lost = LIVE.find(r => r.status === "accepted" && rDay(r) === y && rSpan(r)[0] >= v.a && rSpan(r)[1] <= v.b && (rSpan(r)[0] < E.a || rSpan(r)[1] > E.b));
      if (lost) { E.err = "Can't change " + dayName(y) + ": " + who(lost) + "'s booked session (" + span(...rSpan(lost)) + ") would be outside the new hours. Cancel it first, or keep it inside."; return refresh(); }
    }
    const next = new Set(CUR);
    days.forEach(y => { for (let m = v.a; m < v.b; m += 30) if (!pastCell(y, m)) next.delete(key(y, m)); for (let m = E.a; m < E.b; m += 30) if (!pastCell(y, m)) next.add(key(y, m)); });
    const waits = LIVE.filter(r => r.status === "pending" && days.includes(rDay(r)) && !outside(CUR, r) && outside(next, r));
    const ok = await UI.ask({
      kicker: "Change hours", title: "Change these hours?",
      lead: "<b>" + span(v.a, v.b) + "</b> → <b>" + span(E.a, E.b) + " ET</b><br>" + esc(daysLabel(days)),
      points: ["Players see the new times right away."].concat(days.map(y => "<b>" + esc(dayName(y)) + "</b> becomes " + runText(next, y) + " (" + hrs(total(next, y)) + ").")),
      warn: waits.length ? waitWarn(waits.length) : "", warnList: waits.map(waitLine),
      yes: "Yes, change hours"
    });
    if (!ok) return;
    await commit(next, days, { t: "day", y: v.y }, "Changed " + span(v.a, v.b) + " to " + span(E.a, E.b) + " ET on " + daysLabel(days) + ".");
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
    if (rq.length) HP.view = { t: "req", id: rq[0].id };
    else if (run) HP.view = rmTool() ? { t: "rm", days: [y], a: run[0], b: run[1] } : { t: "block", y, a: run[0], b: run[1], edit: null };
    else if (rmTool()) HP.view = { t: "week", note: "Nothing to remove there. Click or drag over your hours." };
    else HP.view = { t: "add", days: [y], a: m, b: Math.min(m + 60, M1) };
    refresh();
  }
  // the label by the cursor while dragging: "+ 6:00 PM–9:30 PM · 3.5 h"
  const tag = () => { if (!TAG) { TAG = document.createElement("div"); TAG.className = "hp-tag"; TAG.hidden = true; document.body.appendChild(TAG); } return TAG; };
  function tagText() {
    const v = HP.view; if (!isDraft() || !drag) return;
    const t = tag(); t.className = "hp-tag " + v.t; t.hidden = false;
    t.textContent = (v.t === "add" ? "+ " : "− ") + span(v.a, v.b) + (v.days.length > 1 ? " · " + v.days.length + " days" : "") + " · " + hrs(changes(v).sum);
  }
  const tagAt = (x, y) => { const t = tag(); t.style.left = Math.max(8, Math.min(x + 16, innerWidth - t.offsetWidth - 8)) + "px"; t.style.top = (y + 20) + "px"; };
  // redraw at most once a frame, however fast the pointer moves
  const refreshSoon = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; refresh(); tagText(); }); };
  function down(e) {
    const td = e.target.closest(".hp-pl td[data-y]");
    if (!td || e.button !== 0 || td.classList.contains("past")) return;
    drag = { y0: td.dataset.y, m0: +td.dataset.m, y1: td.dataset.y, m1: +td.dataset.m, kind: HP.tool, touch: e.pointerType === "touch", moved: false };
    if (!drag.touch) e.preventDefault();   // touch keeps scrolling; a tap acts like a click
  }
  function move(e) {
    if (!drag || drag.touch) return;
    if (!(e.buttons & 1)) return end(e);   // the button was let go somewhere we didn't hear about
    const n = document.elementFromPoint(e.clientX, e.clientY), td = n && n.closest && n.closest(".hp-pl td[data-y]");
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
    if (d.moved) return refresh();   // the draft stays, with its details in the panel
    if (e.type === "pointerup") clickAt(d.y0, d.m0);
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
    if ((x = on("[data-req]"))) { HP.view = { t: "req", id: x.dataset.req }; return refresh(); }
    if (on("[data-addday]")) { HP.view = { t: "add", days: [HP.view.y], a: 1080, b: 1200 }; return refresh(); }
    if (on("[data-edit]")) { const v = HP.view; v.edit = { a: v.a, b: v.b, all: false, err: "" }; return refresh(); }
    if (on("[data-ecancel]")) { HP.view.edit = null; return refresh(); }
    if (on("[data-esave]")) return saveEdit();
    if (on("[data-rmblock]")) { const v = HP.view; HP.view = { t: "rm", days: [v.y], a: v.a, b: v.b }; return refresh(); }
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
    if (t.dataset.eio) { const E = HP.view.edit; E[t.dataset.eio] = +t.value; if (E.b <= E.a) E.b = Math.min(E.a + 60, M1); E.err = ""; return refresh(); }
    if (t.hasAttribute("data-also")) { HP.view.edit.all = t.checked; return refresh(); }
  }

  /* ---------- paint + events ---------- */
  function paint() {
    const hrsMode = ST.mode === "hours";
    const head = '<div class="dp-head"><h2>Your calendar</h2><div class="cc-mode" role="group" aria-label="Calendar view">' +
      '<button type="button" data-mode="sessions" aria-pressed="' + !hrsMode + '">Sessions</button><button type="button" data-mode="hours" aria-pressed="' + hrsMode + '">Hours</button></div></div>';
    if (!hrsMode) {
      panel.innerHTML = head + '<p class="muted small cc-hint">Click a day to see its booked sessions and waiting requests. Click it again to close.</p>' + grid() + legend() + sessionsView();
      return;
    }
    if (HP.page === "overview") { panel.innerHTML = head + overview(); return; }
    panel.innerHTML = head + plannerHTML();
    refresh();
  }
  function mount(el, deskCtx) {
    panel = el; ctx = deskCtx;
    D = { blocks: deskCtx.blocks, reqs: deskCtx.reqs, teams: deskCtx.teams, days: UI.eventDays() };
    index();
    if (!weeks().includes(HP.wk)) HP.wk = weeks()[0];
    paint();
    panel.onclick = e => {
      const on = s => e.target.closest(s); let x;
      if ((x = on("[data-mode]"))) {
        if (x.dataset.mode === "hours" && ST.mode !== "hours") { HP.page = "overview"; HP.view = { t: "week" }; }   // Hours opens on the overview
        ST.mode = x.dataset.mode; return paint();
      }
      if (ST.mode === "hours") return hoursClick(e);
      if ((x = on("[data-req]"))) return openReq(x.dataset.req, x.dataset.set || "");
      if ((x = on(".hit"))) { const y = x.dataset.day; ST.open = ST.open === y ? null : y; return paint(); }
      if (on("[data-closeday]")) { ST.open = null; return paint(); }
    };
    panel.onchange = e => { if (ST.mode === "hours") hoursChange(e); };
    panel.onpointerdown = e => { if (ST.mode === "hours") down(e); };
    panel.onpointermove = e => { if (ST.mode === "hours") move(e); };
    if (!wired) { wired = true; document.addEventListener("pointerup", end); document.addEventListener("pointercancel", end); }
  }

  window.PTGCoachCal = { mount, openReq };   // openReq: the desk's Requests waiting cards open the same pop-up
})();
