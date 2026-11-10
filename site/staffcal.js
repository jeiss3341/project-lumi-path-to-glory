/* Path to Glory · staff calendars (desk → Staff → Hours and Requests).
   A timeline for each event day, 8 AM to 4 AM Eastern, with one row per mentor and assistant coach.
     Hours:    the hours every coach posted, with the sessions booked inside them. Day or week view.
     Requests: every request, coloured by status, with status / coach filters, a list view and a details pop-up.
   Both can be opened full-window ("Expand"); mentor and assistant groups fold away. */
(function () {
  "use strict";
  const { esc, pad } = UI;
  const SPAN = UI.DAY_END - UI.DAY_START;   // minutes across the timeline (8 AM → 4 AM = 1200)
  const ST = {                              // view settings, kept while the desk is open
    day: null, hView: "day", rView: "day", hide: false, full: false,
    closed: { mentor: false, assistant: false },
    show: { pending: true, accepted: true, declined: false, cancelled: false }, coach: ""
  };
  const WORD = { pending: "Waiting", accepted: "Booked", declined: "Declined", cancelled: "Cancelled" };
  let D = null, ctx = null, kind = "hours";   // fetched data, desk hooks, which calendar

  /* ---------- time helpers (everything on the timeline is Eastern) ---------- */
  const minsIn = (iso, ymd) => (new Date(iso) - UI.etAt(ymd, 0)) / 6e4;
  const pos = m => Math.max(0, Math.min(100, (m - UI.DAY_START) / SPAN * 100));
  const place = (a, b, ymd) => { const x = pos(minsIn(a, ymd)), y = pos(minsIn(b, ymd)); return "left:" + x + "%;width:" + Math.max(.6, y - x) + "%"; };
  const et = iso => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const etRange = (a, b) => et(a) + "–" + et(b);
  const etShort = (a, b) => { const f = s => et(s).replace(":00", ""); const x = f(a), y = f(b); return x.slice(-2) === y.slice(-2) ? x.slice(0, -3) + "–" + y : x + "–" + y; };
  const hours = ms => { const h = Math.round(ms / 36e5 * 10) / 10; return h + (h === 1 ? " hour" : " hours"); };
  const tickLabel = h => { const x = Math.floor(UI.lmin(h * 60) / 60); return (x % 12 || 12) + (x < 12 ? "a" : "p"); };

  /* ---------- coaches ---------- */
  const slot = c => (c.kind === "assistant" ? "A" : "M") + pad(c.slot);
  const cname = c => UI.bare(UI.coachName(c));
  const cmeta = c => slot(c) + ((c.kind === "mentor" ? c.team_name : c.focus) ? " · " + (c.kind === "mentor" ? c.team_name : c.focus) : "");
  const coachOf = id => D.coaches.find(c => c.id === id);
  const teamOf = uid => D.teams.find(t => (t.member_ids || []).includes(uid));
  // a team review the mentor wrote down belongs to the mentor's team; anything else to the player's
  const teamFor = r => r.by_coach && r.kind === "team" ? D.teams.find(t => t.coach_id === r.coach_id) : teamOf(r.requester_id);
  const whoOf = r => UI.party(r, (teamFor(r) || {}).name);

  /* ---------- data per day ---------- */
  const blocksOn = (ymd, cid) => D.avail.filter(b => UI.dayOf(b.starts_at) === ymd && (!cid || b.coach_id === cid));
  const reqsOn = (ymd, cid) => D.reqs.filter(r => UI.dayOf(r.starts_at) === ymd && (!cid || r.coach_id === cid));
  const shown = r => ST.show[r.status] && (!ST.coach || r.coach_id === ST.coach);

  /* ---------- pieces ---------- */
  function dayStrip(countLabel) {
    const today = UI.todayYmd();
    return '<div class="sc-days" role="group" aria-label="Event day">' + [1, 2].map(w => '<span class="sc-wk">Week ' + w + "</span>" + D.days.filter(d => d.week === w).map(d => {
      const lab = countLabel(d.ymd), ev = d.events[0];
      return '<button type="button" class="sc-day' + (d.ymd === today ? " today" : "") + '" data-day="' + d.ymd + '" aria-pressed="' + (d.ymd === ST.day) + '" aria-label="' + esc(UI.date(d.d, { weekday: "long", month: "long", day: "numeric" })) + (lab ? ", " + lab : "") + '">' +
        "<small>" + d.dow + "</small><b>" + d.n + "</b><span>" + (lab || "&nbsp;") + "</span>" + (ev ? '<i class="evdot ' + ev.kind + '" title="' + esc(ev.title) + '"></i>' : "") + "</button>";
    }).join("")).join("") + "</div>";
  }
  const seg = (name, cur, opts) => '<div class="sc-seg" role="group">' + opts.map(([v, l]) => '<button type="button" data-' + name + '="' + v + '" aria-pressed="' + (cur === v) + '">' + l + "</button>").join("") + "</div>";
  const fullBtn = () => '<button type="button" class="btn ghost sc-fullbtn" data-full>' + (ST.full ? "Close full view" : "Expand ⤢") + "</button>";
  const axis = () => '<div class="sc-row sc-axis"><span class="sc-name"><span class="k">' + UI.TZ + '</span></span><div class="sc-track">' +
    Array.from({ length: SPAN / 60 }, (_, i) => '<span class="sc-tick" style="left:' + (i * 60 / SPAN * 100) + '%">' + tickLabel(UI.DAY_START / 60 + i) + "</span>").join("") + "</div></div>";
  const nowLine = ymd => { if (ymd !== UI.todayYmd()) return ""; const m = minsIn(new Date(UI.now()).toISOString(), ymd); return m >= UI.DAY_START && m <= UI.DAY_END ? '<i class="sc-now" style="left:' + pos(m) + '%" title="Now"></i>' : ""; };
  // rows grouped into Mentors / Assistant coaches; `keep` decides which coaches show, `track` draws a row
  function grouped(keep, track) {
    return [["mentor", "Mentors"], ["assistant", "Assistant coaches"]].map(([k, label]) => {
      const list = D.coaches.filter(c => c.kind === k), rows = list.filter(keep), closed = ST.closed[k];
      return '<button type="button" class="sc-grp" data-grp="' + k + '" aria-expanded="' + !closed + '"><span>' + (closed ? "▸" : "▾") + "</span> " + label + ' <small>' + rows.length + " of " + list.length + "</small></button>" +
        (closed ? "" : rows.map(track).join(""));
    }).join("");
  }
  const row = (c, inner) => '<div class="sc-row"><span class="sc-name"><b>' + esc(cname(c)) + "</b><small>" + esc(cmeta(c)) + '</small></span><div class="sc-track">' + inner + "</div></div>";

  /* ---------- Hours ---------- */
  function hoursView() {
    const week = D.days.find(d => d.ymd === ST.day).week, wdays = D.days.filter(d => d.week === week);
    const strip = dayStrip(ymd => { const ms = blocksOn(ymd).reduce((s, b) => s + (new Date(b.ends_at) - new Date(b.starts_at)), 0); return ms ? Math.round(ms / 36e5) + "h" : ""; });
    const tools = '<div class="sc-tools">' + seg("hview", ST.hView === "day" ? "day" : "w" + week, [["day", "Day"], ["w1", "Week 1"], ["w2", "Week 2"]]) +
      '<label class="sc-check"><input type="checkbox" data-hide' + (ST.hide ? " checked" : "") + "> Hide coaches with no hours</label>" + fullBtn() + "</div>";
    const legend = '<div class="sc-legend"><span><i class="lg hrs"></i>Posted hours</span><span><i class="lg acc"></i>Booked session</span><span><i class="lg pen"></i>Request waiting</span><span>Click any bar for details</span></div>';
    let body;
    if (ST.hView === "day") {
      const d = ST.day;
      body = '<div class="sc-tl"><div class="sc-tl-in">' + axis() +
        grouped(c => !ST.hide || blocksOn(d, c.id).length, c => row(c,
          blocksOn(d, c.id).map(b => '<button type="button" class="sc-bar hrs" data-blk="' + esc(b.id) + '" style="' + place(b.starts_at, b.ends_at, d) + '" title="' + esc(cname(c) + " · " + etRange(b.starts_at, b.ends_at) + " ET") + '"><span>' + etShort(b.starts_at, b.ends_at) + "</span></button>").join("") +
          reqsOn(d, c.id).filter(r => r.status === "accepted" || r.status === "pending").map(r => '<button type="button" class="sc-bar ses ' + r.status + '" data-req="' + esc(r.id) + '" style="' + place(r.starts_at, r.ends_at, d) + '" title="' + esc(WORD[r.status] + " · " + whoOf(r) + " · " + etRange(r.starts_at, r.ends_at)) + '"></button>').join("") +
          nowLine(d))) + "</div></div>";
    } else {
      body = '<div class="sc-tl"><div class="sc-tl-in sc-week"><div class="sc-wrow sc-whead"><span class="sc-name"></span>' + wdays.map(d => '<span class="' + (d.ymd === ST.day ? "on" : "") + '">' + d.dow + " " + d.n + "</span>").join("") + "<span>Total</span></div>" +
        grouped(c => !ST.hide || wdays.some(d => blocksOn(d.ymd, c.id).length), c => {
          let total = 0;
          return '<div class="sc-wrow"><span class="sc-name"><b>' + esc(cname(c)) + "</b><small>" + esc(cmeta(c)) + "</small></span>" + wdays.map(d => {
            const bl = blocksOn(d.ymd, c.id), rq = reqsOn(d.ymd, c.id), acc = rq.filter(r => r.status === "accepted").length, pen = rq.filter(r => r.status === "pending").length;
            bl.forEach(b => { total += new Date(b.ends_at) - new Date(b.starts_at); });
            return '<button type="button" class="sc-wcell" data-goday="' + d.ymd + '" aria-label="' + esc(cname(c) + ", " + d.dow + " " + d.n) + '">' + (bl.length ? bl.map(b => '<span class="w-h">' + etShort(b.starts_at, b.ends_at) + "</span>").join("") : '<span class="w-none">—</span>') +
              (acc ? '<span class="w-acc">' + acc + " booked</span>" : "") + (pen ? '<span class="w-pen">' + pen + " waiting</span>" : "") + "</button>";
          }).join("") + '<span class="sc-total">' + (total ? hours(total) : "—") + "</span></div>";
        }) + "</div></div>";
    }
    return strip + tools + legend + body;
  }

  /* ---------- Requests ---------- */
  function requestsView() {
    const counts = {}; Object.keys(WORD).forEach(s => { counts[s] = D.reqs.filter(r => r.status === s && (!ST.coach || r.coach_id === ST.coach)).length; });
    const strip = dayStrip(ymd => { const n = reqsOn(ymd).filter(shown).length; return n ? n + (n === 1 ? " req" : " reqs") : ""; });
    const withReqs = D.coaches.filter(c => D.reqs.some(r => r.coach_id === c.id));
    const tools = '<div class="sc-tools">' + seg("rview", ST.rView, [["day", "Day"], ["list", "List"]]) +
      '<div class="sc-filters" role="group" aria-label="Show">' + Object.keys(WORD).map(s => '<button type="button" class="sc-fl ' + s + '" data-st="' + s + '" aria-pressed="' + ST.show[s] + '">' + WORD[s] + " <b>" + counts[s] + "</b></button>").join("") + "</div>" +
      '<label class="sc-check">Coach <select data-coach><option value="">All coaches</option>' + withReqs.map(c => '<option value="' + esc(c.id) + '"' + (ST.coach === c.id ? " selected" : "") + ">" + esc(cname(c)) + " (" + slot(c) + ")</option>").join("") + "</select></label>" + fullBtn() + "</div>";
    let body;
    if (ST.rView === "day") {
      const d = ST.day, list = reqsOn(d).filter(shown);
      body = '<div class="sc-legend"><span><i class="lg pen"></i>Waiting</span><span><i class="lg acc"></i>Booked</span><span><i class="lg dec"></i>Declined</span><span><i class="lg can"></i>Cancelled</span><span><i class="lg bg"></i>Coach\'s posted hours</span></div>' +
        (list.length ? '<div class="sc-tl"><div class="sc-tl-in">' + axis() +
          grouped(c => list.some(r => r.coach_id === c.id), c => row(c,
            blocksOn(d, c.id).map(b => '<span class="sc-bg" style="' + place(b.starts_at, b.ends_at, d) + '"></span>').join("") +
            list.filter(r => r.coach_id === c.id).map(r => '<button type="button" class="sc-bar req ' + r.status + '" data-req="' + esc(r.id) + '" style="' + place(r.starts_at, r.ends_at, d) + '" title="' + esc(WORD[r.status] + " · " + whoOf(r) + " · " + etRange(r.starts_at, r.ends_at) + " ET") + '"><span>' + esc(whoOf(r)) + "</span></button>").join("") +
            nowLine(d))) + "</div></div>"
          : '<p class="sc-none big">No requests on ' + esc(UI.date(D.days.find(x => x.ymd === d).d, { weekday: "long", month: "short", day: "numeric" })) + " with these filters.</p>");
    } else {
      const list = D.reqs.filter(shown).slice().sort((a, b) => a.starts_at.localeCompare(b.starts_at));
      const byDay = D.days.map(d => [d, list.filter(r => UI.dayOf(r.starts_at) === d.ymd)]).filter(([, l]) => l.length);
      body = byDay.length ? byDay.map(([d, l]) => '<h4 class="sc-lh">' + esc(UI.date(d.d, { weekday: "long", month: "long", day: "numeric" })) + (d.events[0] ? ' <small>' + esc(d.events[0].title) + "</small>" : "") + '</h4><ul class="sc-list">' +
        l.map(r => '<li><button type="button" class="sc-li" data-req="' + esc(r.id) + '"><span class="t">' + etRange(r.starts_at, r.ends_at) + ' <small>' + UI.TZ + '</small></span><span class="c">' + esc(cname(coachOf(r.coach_id))) + '</span><span class="p">' + esc(whoOf(r)) + " · " + (r.kind === "team" ? "Team review" : "Individual") + "</span>" + chip(r.status) + '<span class="more">Details ›</span></button></li>').join("") + "</ul>").join("")
        : '<p class="sc-none big">No requests match these filters.</p>';
    }
    return strip.replace('class="sc-days"', 'class="sc-days' + (ST.rView === "list" ? " dim" : "") + '"') + tools + body;
  }
  const chip = s => '<span class="chip-st st-' + s + '">' + WORD[s] + "</span>";

  /* ---------- pop-ups ---------- */
  function dlg() {
    let d = document.getElementById("sc-dlg");
    if (!d) {
      d = document.createElement("dialog"); d.id = "sc-dlg"; d.setAttribute("aria-labelledby", "sc-dlg-title"); document.body.appendChild(d);
      d.addEventListener("click", e => {
        if (e.target === d) return d.close();
        const go = e.target.closest("[data-req]"); if (go) return openReq(go.dataset.req);
        const b = e.target.closest("[data-do]"); if (!b) return;
        if (b.dataset.do === "close") return d.close();
        // Accept / Decline / Cancel session: say what will happen first (UI.askRequest), then act
        const r = D.reqs.find(x => x.id === b.dataset.id), s = b.dataset.do, t = r && teamFor(r);
        UI.askRequest({ r, status: s, coach: r && cname(coachOf(r.coach_id)), team: t && t.name, reqs: D.reqs }).then(ok => ok &&
          UI.act(b, async () => { await API.setRequestStatus(r.id, s); d.close(); await ctx.rerender(); },
            { accepted: "Accepted for the coach.", declined: "Declined for the coach.", cancelled: "Session cancelled." }[s]));
      });
    }
    return d;
  }
  const kv = (k, v) => "<dt>" + k + "</dt><dd>" + v + "</dd>";
  const yours = () => "";   // times are already in your own time zone
  function openReq(id) {
    const r = D.reqs.find(x => x.id === id); if (!r) return;
    const c = coachOf(r.coach_id), t = teamFor(r), d = dlg(), day = UI.dayOf(r.starts_at);
    const also = UI.overlapGroup(r, D.reqs).filter(x => x.id !== r.id);
    d.innerHTML = '<div class="sc-dtop"><div><span class="k">' + (r.by_coach ? "Written by " : "Request · ") + esc(cname(c)) + '</span><h3 id="sc-dlg-title">' + (r.kind === "team" ? "Team review" : "Individual session") + "</h3></div>" + chip(r.status) + "</div>" +
      '<dl class="sc-kv">' +
        kv("When", esc(UI.date(UI.etAt(day, 720), { weekday: "long", month: "long", day: "numeric" })) + "<br><b>" + etRange(r.starts_at, r.ends_at) + " " + UI.TZ + "</b> · " + esc(UI.dur(r.starts_at, r.ends_at)) + yours(r.starts_at, r.ends_at)) +
        kv("Coach", esc(cname(c)) + ' <span class="muted">' + esc(cmeta(c)) + "</span>") +
        kv(r.by_coach ? "With" : "From", r.by_coach && r.kind === "team" ? esc(whoOf(r)) + ' <span class="sc-tag">Coach\'s team</span>' : esc(UI.who(r.requester)) + ' <span class="muted">@' + esc((r.requester && r.requester.username) || "") + "</span>" + (t ? "<br>" + esc(t.name) + (t.coach_id === r.coach_id ? ' <span class="sc-tag">Coach\'s team</span>' : ' <span class="sc-tag other">Other team</span>') : '<br><span class="muted">Not on a team</span>')) +
        kv(r.by_coach ? "Note" : "Wants to work on", r.note ? "“" + esc(r.note) + "”" : '<span class="muted">No note added.</span>') +
        // when it was sent (or written down by the mentor), and its place among overlapping requests ("2nd of 2")
        (r.by_coach ? kv("Written", "By " + esc(cname(c)) + " · " + esc(UI.sentAt(r.created_at)))
                    : kv("Sent", esc(UI.sentAt(r.created_at)) + (also.length ? ' <span class="cc-otag">' + UI.sentRank(r, D.reqs) + "</span>" : ""))) +
        // other waiting requests for this coach at the same time, with who asked first
        (also.length ? kv("Also waiting", '<ul class="sc-in">' + also.map(x => '<li><button type="button" class="linkbtn" data-req="' + esc(x.id) + '">' + etRange(x.starts_at, x.ends_at) + " · " + esc(whoOf(x)) + "</button>" +
            ' <span class="muted small">' + UI.sentGap(x, r) + "</span></li>").join("") +
          '</ul><span class="muted small">Same time as this one. Accepting this declines ' + (also.length === 1 ? "it" : "them") + ".</span>") : "") +
        (r.decided_at ? kv(WORD[r.status], esc(UI.date(r.decided_at, { weekday: "short", month: "short", day: "numeric" }))) : "") +
      "</dl>" +
      '<div class="sc-dact">' +
        (r.status === "pending" ? '<button type="button" class="btn" data-do="accepted" data-id="' + esc(r.id) + '">Accept</button><button type="button" class="btn ghost" data-do="declined" data-id="' + esc(r.id) + '">Decline</button>' : "") +
        (r.status === "accepted" ? '<button type="button" class="btn ghost" data-do="cancelled" data-id="' + esc(r.id) + '">Cancel session</button>' : "") +
        '<button type="button" class="linkbtn" data-do="close">Close</button></div>' +
      (["pending", "accepted"].includes(r.status) ? '<p class="muted small">You\'re acting as staff. The player and ' + esc(cname(c)) + " see the change on their desks.</p>" : "");
    if (!d.open) d.showModal();
  }
  function openBlock(id) {
    const b = D.avail.find(x => x.id === id); if (!b) return;
    const c = coachOf(b.coach_id), d = dlg(), day = UI.dayOf(b.starts_at);
    const inside = D.reqs.filter(r => r.coach_id === b.coach_id && ["accepted", "pending"].includes(r.status) && r.starts_at >= b.starts_at && r.ends_at <= b.ends_at).sort((x, y) => x.starts_at.localeCompare(y.starts_at));
    d.innerHTML = '<div class="sc-dtop"><div><span class="k">Posted hours</span><h3 id="sc-dlg-title">' + esc(cname(c)) + "</h3></div></div>" +
      '<dl class="sc-kv">' +
        kv("When", esc(UI.date(UI.etAt(day, 720), { weekday: "long", month: "long", day: "numeric" })) + "<br><b>" + etRange(b.starts_at, b.ends_at) + " " + UI.TZ + "</b> · " + esc(UI.dur(b.starts_at, b.ends_at)) + yours(b.starts_at, b.ends_at)) +
        kv("Coach", esc(cmeta(c))) +
        kv("In these hours", inside.length ? '<ul class="sc-in">' + inside.map(r => '<li><button type="button" class="linkbtn" data-req="' + esc(r.id) + '">' + etRange(r.starts_at, r.ends_at) + " · " + esc(whoOf(r)) + "</button> " + chip(r.status) + "</li>").join("") + "</ul>" : '<span class="muted">Nothing booked or waiting yet.</span>') +
      '</dl><div class="sc-dact"><button type="button" class="linkbtn" data-do="close">Close</button></div>';
    if (!d.open) d.showModal();
  }

  /* ---------- paint + events ---------- */
  function paint() {
    const sec = ctx.body.querySelector("#sc-panel");
    sec.classList.toggle("sc-full", ST.full);
    document.documentElement.classList.toggle("sc-noscroll", ST.full);
    sec.innerHTML = '<div class="sc-top"><h2>' + (kind === "hours" ? "Hours" : "Requests") + '</h2><span class="muted small">' +
      (kind === "hours" ? "Every coach's posted hours and the sessions inside them." : "Every session request across all coaches.") + " Times in your time zone (" + UI.TZ + ").</span></div>" +
      (kind === "hours" ? hoursView() : requestsView());
  }
  async function render(which, body, deskCtx) {
    kind = which; ctx = Object.assign({ body }, deskCtx);
    const [avail, reqs, teams] = await Promise.all([API.allAvailability(), API.allRequests(), API.teams().catch(() => [])]);
    const days = UI.eventDays();
    D = { avail, reqs, teams, coaches: deskCtx.coaches, days };
    if (!ST.day || !days.some(d => d.ymd === ST.day)) {
      const today = UI.todayYmd();
      ST.day = (days.find(d => d.ymd >= today) || days[0]).ymd;
    }
    body.innerHTML = deskCtx.head + '<section class="sheet dpanel wide-panel sc-panel" id="sc-panel"></section>';
    paint();
    body.onclick = e => {
      if (ctx.onTab(e)) { ST.full = false; document.documentElement.classList.remove("sc-noscroll"); return; }
      const t = e.target, on = s => t.closest(s);
      let b;
      if ((b = on("[data-req]"))) return openReq(b.dataset.req);
      if ((b = on("[data-blk]"))) return openBlock(b.dataset.blk);
      if ((b = on("[data-day]"))) { ST.day = b.dataset.day; if (kind === "requests") ST.rView = "day"; }
      else if ((b = on("[data-goday]"))) { ST.day = b.dataset.goday; ST.hView = "day"; }
      else if ((b = on("[data-hview]"))) {   // Day, or a week (jumps to that week if the picked day is in the other one)
        const v = b.dataset.hview;
        if (v === "day") ST.hView = "day";
        else { const w = +v.slice(1); ST.hView = "week"; if (D.days.find(d => d.ymd === ST.day).week !== w) ST.day = D.days.find(d => d.week === w).ymd; }
      }
      else if ((b = on("[data-rview]"))) ST.rView = b.dataset.rview;
      else if ((b = on("[data-grp]"))) ST.closed[b.dataset.grp] = !ST.closed[b.dataset.grp];
      else if ((b = on("[data-st]"))) ST.show[b.dataset.st] = !ST.show[b.dataset.st];
      else if (on("[data-full]")) ST.full = !ST.full;
      else return;
      paint();
    };
    body.onchange = e => {
      if (e.target.matches("[data-hide]")) ST.hide = e.target.checked;
      else if (e.target.matches("[data-coach]")) ST.coach = e.target.value;
      else return;
      paint();
    };
  }
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && ST.full && !(document.getElementById("sc-dlg") || {}).open && ctx) { ST.full = false; paint(); }
  });

  window.PTGStaffCal = { render };
})();
