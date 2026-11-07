/* Path to Glory · the mentor's calendar on the desk (desk → Mentor calendar → Your calendar).
   Sessions: (opens first) click a day to list its booked sessions and waiting requests.
   Hours:    tick days to list their hours (Eastern, 8 AM to 4 AM). Edit a block (optionally on every day with the
             same hours), tick several to delete (after an "are you sure?"), or add new hours to every ticked day.
             Overlapping or touching hours join into one block, and booked sessions always stay inside.
   Hours that are over drop off, days that are over fade and lock, and the session / waiting chips open the request.
   Answering requests still happens in the Requests waiting cards above; booked sessions are listed in Coming up. */
(function () {
  "use strict";
  const { esc } = UI;
  // view state, kept while the desk is open
  const ST = { mode: "sessions", picked: null, open: null, a: null, b: null, edit: null, sel: new Set(), msg: "" };
  let D = null, panel = null, ctx = null;

  /* ---------- time (the calendar is Eastern; labels add the viewer's own time when they're elsewhere) ---------- */
  const mins = (iso, ymd) => Math.round((new Date(iso) - UI.etAt(ymd, 0)) / 6e4);
  const tm = m => { const h = Math.floor(m / 60) % 24, mm = m % 60; return (h % 12 || 12) + ":" + String(mm).padStart(2, "0") + " " + (h < 12 ? "AM" : "PM"); };
  const span = (a, b) => tm(a) + "–" + tm(b);
  const short = (a, b) => { const f = m => tm(m).replace(":00", ""); const x = f(a), y = f(b); return x.slice(-2) === y.slice(-2) ? x.slice(0, -3) + "–" + y : x + "–" + y; };
  const hrsLabel = m => (Math.round(m / 6) / 10) + " h";
  const ended = blk => new Date(blk.ends_at) <= new Date();
  const dayOver = ymd => UI.etAt(ymd, UI.DAY_END) <= new Date();
  const dayName = ymd => { const d = D.days.find(x => x.ymd === ymd); return d ? d.dow + " " + d.n : ymd; };
  const longDay = ymd => UI.date(UI.etAt(ymd, 720), { weekday: "long", month: "long", day: "numeric" });
  const shortList = ymds => { const ds = D.days.filter(d => ymds.includes(d.ymd)).map(d => d.dow + " " + d.n); return ds.length > 4 ? ds.slice(0, 3).join(", ") + " and " + (ds.length - 3) + " more" : ds.join(", ").replace(/, ([^,]*)$/, " and $1"); };

  /* ---------- data ---------- */
  const blockDay = b => UI.dayOf(b.starts_at);
  const bm = b => { const y = blockDay(b); return [mins(b.starts_at, y), mins(b.ends_at, y)]; };   // minutes after midnight Eastern
  const blocksOn = ymd => D.blocks.filter(b => blockDay(b) === ymd).sort((p, q) => new Date(p.starts_at) - new Date(q.starts_at));
  const upcoming = ymd => blocksOn(ymd).filter(b => !ended(b));
  const reqsOn = ymd => D.reqs.filter(r => UI.dayOf(r.starts_at) === ymd && (r.status === "accepted" || r.status === "pending")).sort((p, q) => new Date(p.starts_at) - new Date(q.starts_at));
  // other days' upcoming blocks with exactly the same hours
  const sameAs = b => { const [x, y] = bm(b), ymd = blockDay(b); return D.blocks.filter(o => o.id !== b.id && !ended(o) && blockDay(o) !== ymd && bm(o)[0] === x && bm(o)[1] === y); };
  const ticked = () => D.days.filter(d => ST.picked.includes(d.ymd) && !dayOver(d.ymd)).map(d => d.ymd);
  // join intervals that overlap or touch (minutes)
  const union = list => { const out = []; list.slice().sort((p, q) => p[0] - q[0]).forEach(([x, z]) => { const l = out[out.length - 1]; if (l && x <= l[1]) l[1] = Math.max(l[1], z); else out.push([x, z]); }); return out; };
  // booked sessions on a day that a set of hours would leave uncovered
  const orphans = (ymd, spans) => D.reqs.filter(r => r.status === "accepted" && UI.dayOf(r.starts_at) === ymd && !spans.some(([x, z]) => x <= mins(r.starts_at, ymd) && mins(r.ends_at, ymd) <= z));
  const who = r => UI.who(r.requester);

  /* ---------- time menus ---------- */
  function opts(ymd, from, to, sel) {
    let o = sel == null ? '<option value="" selected disabled>Pick a time</option>' : "";
    for (let m = from; m <= to; m += 30) o += '<option value="' + m + '"' + (m === sel ? " selected" : "") + ">" + esc(UI.etLabel(ymd, m)) + "</option>";
    return o;
  }
  // hour out only lists times after hour in
  const times = (pre, ymd, a, b) => '<div class="io2"><label>Hour in (ET)<select id="' + pre + '-in">' + opts(ymd, UI.DAY_START, UI.DAY_END - 30, a) + "</select></label>" +
    '<label>Hour out (ET)<select id="' + pre + '-out">' + opts(ymd, a != null ? a + 30 : UI.DAY_START + 30, UI.DAY_END, b) + "</select></label></div>";
  const ok = (a, b) => a != null && b != null && b > a;

  /* ---------- calendar ---------- */
  function cell(d) {
    if (dayOver(d.ymd)) return '<div class="cc-day past"><span class="cd-top"><small>' + d.dow + "</small><b>" + d.n + "</b></span></div>";   // a day that's over: just its date
    const hrs = ST.mode === "hours", on = hrs ? ST.picked.includes(d.ymd) : ST.open === d.ymd;
    const up = upcoming(d.ymd), shown = up.length > 2 ? up.slice(0, 1) : up;   // two chips at most, so busy days don't stretch the week
    const rq = reqsOn(d.ymd), acc = rq.filter(r => r.status === "accepted"), pen = rq.filter(r => r.status === "pending"), ev = d.events[0];
    // Sessions view: days with hours get a pale tan background and their time slot in the date row, so the sessions stand out
    const tint = !hrs && up.length;
    return '<div class="cc-day' + (on ? " on" : "") + (tint ? " has-hrs" : "") + (d.ymd === UI.todayYmd() ? " today" : "") + '">' +
      '<button type="button" class="hit" data-day="' + d.ymd + '" aria-pressed="' + on + '" aria-label="' + esc(longDay(d.ymd) + (tint ? ", your hours " + up.map(b => span(...bm(b))).join(", ") : "")) + '"></button>' +
      '<span class="cd-top"><small>' + d.dow + "</small><b>" + d.n + "</b>" +
        (tint ? '<span class="cd-hrs" title="Your hours: ' + esc(up.map(b => span(...bm(b))).join(", ")) + '">' + (up.length > 1 ? tm(bm(up[0])[0]).replace(":00", "") + " +" + (up.length - 1) : short(...bm(up[0]))) + "</span>" : "") +   // one slot: its range; several: first start + how many more
        (ev ? '<i class="evdot ' + ev.kind + '" title="' + esc(ev.title) + '"></i>' : "") + "</span>" +
      (hrs ? shown.map(b => { const [x, y] = bm(b); return '<button type="button" class="blk-btn' + (ST.edit && ST.edit.id === b.id ? " editing" : "") + '" data-edit="' + esc(b.id) + '" title="Edit ' + span(x, y) + '">' + short(x, y) + "</button>"; }).join("") +
        (up.length > shown.length ? '<span class="more-blk">+' + (up.length - shown.length) + " more</span>" : "") : "") +
      // session / waiting chips only in the Sessions view (Hours stays just about hours)
      (!hrs && acc.length ? '<button type="button" class="ses-btn cd-acc" data-req="' + esc(acc[0].id) + '" title="See the session">' + acc.length + (acc.length === 1 ? " session" : " sessions") + "</button>" : "") +
      (!hrs && pen.length ? '<button type="button" class="ses-btn cd-pen" data-req="' + esc(pen[0].id) + '" title="See the request">' + pen.length + " waiting</button>" : "") +
      (hrs ? '<span class="tick" aria-hidden="true">' + (on ? "✓" : "") + "</span>" : "") + "</div>";
  }
  const grid = () => '<div class="cal2 cc-cal">' + [1, 2].map(w => '<span class="wkl">Week ' + w + "</span>" + D.days.filter(d => d.week === w).map(cell).join("")).join("") + "</div>";
  // legend for each view: Hours shows only hours and event days; Sessions adds the session / waiting chips
  const legend = hrs => '<div class="cc-legend"><span><i class="lg ' + (hrs ? "hrs" : "hrs-tint") + '"></i>Your hours</span>' + (hrs ? "" : '<span><i class="lg acc"></i>Booked session</span><span><i class="lg pen"></i>Request waiting</span>') + '<span><i class="evdot kickoff"></i>Kickoff</span><span><i class="evdot scrim"></i>Scrim day</span><span><i class="evdot mock"></i>Checkpoint</span></div>';

  /* ---------- Hours ---------- */
  function editor(b) {
    const E = ST.edit, ymd = blockDay(b), [x, y] = bm(b), others = sameAs(b);
    return '<li class="cc-ed"><span class="k">Edit hours · ' + dayName(ymd) + " · now " + span(x, y) + "</span>" + times("cc-e", ymd, E.ea, E.eb) +
      (others.length ? '<label class="cc-also"><input type="checkbox" id="cc-eall"' + (E.all ? " checked" : "") + "> Also change the other " + others.length + (others.length === 1 ? " day" : " days") + " with " + span(x, y) + " (" + shortList(others.map(blockDay)) + ")</label>" : "") +
      (E.err ? '<p class="cc-err">' + esc(E.err) + "</p>" : "") +
      '<div class="row-btns"><button type="button" class="btn" data-esave>Save</button><button type="button" class="btn ghost" data-ecancel>Cancel</button><button type="button" class="linkbtn cc-rm" data-erm>Remove these hours</button></div></li>';
  }
  function hourRows(ymd) {
    const up = upcoming(ymd);   // hours that are over just drop off
    if (!up.length) return '<p class="empty-note">' + (blocksOn(ymd).length ? "This day's hours are over." : "No hours posted on this day yet.") + "</p>";
    return '<ul class="cc-list">' + up.map(b => {
      if (ST.edit && ST.edit.id === b.id) return editor(b);
      const [x, y] = bm(b), on = ST.sel.has(b.id);
      return '<li class="cc-row' + (on ? " picked" : "") + '"><label class="pick"><input type="checkbox" data-pick="' + esc(b.id) + '"' + (on ? " checked" : "") + ' aria-label="Select ' + esc(dayName(ymd) + " " + span(x, y)) + '"></label>' +
        // info on the left, the Edit column on the right is what opens the editor
        '<div class="cc-info"><span class="t">' + span(x, y) + "</span><span>Your hours · " + hrsLabel(y - x) + "</span></div>" +
        '<button type="button" class="cc-act" data-edit="' + esc(b.id) + '" aria-label="Edit ' + esc(dayName(ymd) + " " + span(x, y)) + '">Edit ›</button></li>';
    }).join("") + "</ul>";
  }
  function bulkBar(days) {
    const all = days.flatMap(y => upcoming(y).map(b => b.id)), n = all.filter(id => ST.sel.has(id)).length;
    if (!all.length) return "";
    // right-aligned: the message (or "N selected · Clear · Delete"), then "Select all" at the far right
    return '<div class="cc-bulk">' +
      (n ? "<b>" + n + ' selected</b><button type="button" class="linkbtn" data-bulkclear>Clear</button><button type="button" class="btn cc-danger" data-bulkdel>🗑 Delete</button>'
         : '<span class="muted small">Tick hours to delete several at once.</span>') +
      '<label class="pick-all">Select all<input type="checkbox" data-pickall' + (n === all.length ? " checked" : "") + "></label></div>";
  }
  function hoursView() {
    const days = ticked();
    ST.picked = days;
    [...ST.sel].forEach(id => { const b = D.blocks.find(x => x.id === id); if (!b || ended(b) || !days.includes(blockDay(b))) ST.sel.delete(id); });
    const ymd0 = days[0] || (D.days.find(d => !dayOver(d.ymd)) || D.days[0]).ymd;
    return '<h3 class="cc-sub">Hours on the days you ticked</h3>' + bulkBar(days) +
      (days.length ? days.map(y => '<div class="cc-dayblock"><h4>' + esc(longDay(y)) + "</h4>" + hourRows(y) + "</div>").join("") : '<p class="empty-note">Tick days on the calendar to see and change their hours.</p>') +
      '<h3 class="cc-sub">Add new hours to the ticked days</h3><div class="cc-add">' + times("cc", ymd0, ST.a, ST.b) +
        '<p class="cc-sum">' + (!days.length ? "No days ticked yet." : !ok(ST.a, ST.b) ? "<b>" + shortList(days) + "</b> · now pick an hour in and an hour out." : "<b>" + span(ST.a, ST.b) + " ET</b> on <b>" + shortList(days) + "</b>. Any hours they overlap join into one block.") + "</p>" +
        '<button type="button" class="btn" data-post' + (days.length && ok(ST.a, ST.b) ? "" : " disabled") + ">Post to " + days.length + (days.length === 1 ? " day" : " days") + "</button></div>";
  }

  /* ---------- Sessions ---------- */
  function sessionsView() {
    if (ST.open && dayOver(ST.open)) ST.open = null;
    if (!ST.open) return '<p class="empty-note">Click a day to see its sessions and requests.</p>';
    const list = reqsOn(ST.open), ev = D.days.find(d => d.ymd === ST.open).events[0];
    return '<div class="cc-dhead"><h3>' + esc(longDay(ST.open)) + '</h3><button type="button" class="linkbtn" data-closeday>Close</button></div>' + (ev ? '<p class="muted small">' + esc(ev.title) + "</p>" : "") +
      (list.length ? '<ul class="cc-list">' + list.map(r => '<li class="cc-row ' + (r.status === "accepted" ? "acc" : "pen") + '"><div class="cc-info"><span class="t">' + span(mins(r.starts_at, ST.open), mins(r.ends_at, ST.open)) + "</span><span>" + UI.statusChip(r.status) + " " + esc(who(r)) + " · " + (r.kind === "team" ? "Team review" : "Individual") + "</span></div>" +
        '<button type="button" class="cc-act" data-req="' + esc(r.id) + '">Details ›</button></li>').join("") + "</ul>"
                  : '<p class="empty-note">No sessions or requests on this day.</p>');
  }

  /* ---------- pop-ups ---------- */
  let onYes = null;
  function dlg() {
    let d = document.getElementById("cc-dlg");
    if (!d) {
      d = document.createElement("dialog"); d.id = "cc-dlg"; d.setAttribute("aria-labelledby", "cc-dlg-title"); document.body.appendChild(d);
      d.addEventListener("click", e => {
        if (e.target === d) return d.close();
        if (e.target.closest("[data-yes]")) { const f = onYes; onYes = null; d.close(); if (f) f(); return; }
        const b = e.target.closest("[data-do]"); if (!b) return;
        if (b.dataset.do === "close") return d.close();
        UI.act(b, async () => { await API.setRequestStatus(b.dataset.id, b.dataset.do); d.close(); await ctx.rerender(); },
          { accepted: "Accepted. It's on your calendar.", declined: "Declined.", cancelled: "Session cancelled." }[b.dataset.do]);
      });
    }
    return d;
  }
  const kv = (k, v) => "<dt>" + k + "</dt><dd>" + v + "</dd>";
  function openReq(id) {
    const r = D.reqs.find(x => x.id === id); if (!r) return;
    const ymd = UI.dayOf(r.starts_at), t = D.teams.find(x => (x.member_ids || []).includes(r.requester_id)), d = dlg();
    const mine = t && t.coach_id === ctx.coach.id, pending = r.status === "pending";
    d.innerHTML = '<div class="sc-dtop"><div><span class="k">' + (pending ? "Request waiting for you" : r.status === "accepted" ? "Booked session" : "Request") + '</span><h3 id="cc-dlg-title">' + (r.kind === "team" ? "Team review" : "Individual session") + "</h3></div>" + UI.statusChip(r.status) + "</div>" +
      '<dl class="sc-kv">' +
        kv("When", esc(longDay(ymd)) + "<br><b>" + span(mins(r.starts_at, ymd), mins(r.ends_at, ymd)) + " ET</b> · " + esc(UI.dur(r.starts_at, r.ends_at)) + (UI.onEastern(new Date(r.starts_at)) ? "" : '<br><span class="muted">Your time: ' + esc(UI.time(r.starts_at) + "–" + UI.time(r.ends_at)) + "</span>")) +
        kv("From", esc(who(r)) + ' <span class="muted">@' + esc((r.requester && r.requester.username) || "") + "</span>" + (t ? "<br>" + esc(t.name) + (mine ? ' <span class="sc-tag">Your team</span>' : ' <span class="sc-tag other">Other team</span>') : '<br><span class="muted">Not on a team</span>')) +
        kv("Wants to work on", r.note ? "“" + esc(r.note) + "”" : '<span class="muted">No note added.</span>') +
        kv("Sent", esc(UI.date(r.created_at, { weekday: "short", month: "short", day: "numeric" }))) +
      "</dl>" +
      '<div class="sc-dact">' +
        (pending && new Date(r.starts_at) > new Date() ? '<button type="button" class="btn" data-do="accepted" data-id="' + esc(r.id) + '">Accept</button><button type="button" class="btn ghost" data-do="declined" data-id="' + esc(r.id) + '">Decline</button>' : "") +
        (r.status === "accepted" && new Date(r.ends_at) > new Date() ? '<button type="button" class="btn ghost" data-do="cancelled" data-id="' + esc(r.id) + '">Cancel session</button>' : "") +
        '<button type="button" class="linkbtn" data-do="close">Close</button></div>';
    if (!d.open) d.showModal();
  }
  // "are you sure?" before deleting; hours with a booked session inside are kept
  function askDelete(ids) {
    const del = [], kept = [];
    ids.map(id => D.blocks.find(b => b.id === id)).filter(Boolean).sort((p, q) => new Date(p.starts_at) - new Date(q.starts_at)).forEach(b => {
      const ymd = blockDay(b), rest = blocksOn(ymd).filter(o => o.id !== b.id).map(bm), lost = orphans(ymd, rest);
      (lost.length ? kept : del).push({ b, ymd, lost });
    });
    const line = x => "<li>" + dayName(x.ymd) + " · " + span(...bm(x.b)) + "</li>";
    const d = dlg();
    onYes = () => UI.act(null, async () => {
      for (const x of del) await API.deleteBlock(x.b.id);
      ST.sel.clear(); ST.edit = null;
      UI.toast("Deleted " + del.length + (del.length === 1 ? " block" : " blocks") + " of hours." + (kept.length ? " Kept " + kept.length + " with booked sessions." : ""));
      await ctx.rerender();
    });
    d.innerHTML = '<div class="sc-dtop"><div><span class="k">Delete hours</span><h3 id="cc-dlg-title">' + (del.length ? "Delete " + del.length + (del.length === 1 ? " block" : " blocks") + " of hours?" : "Can't delete these") + "</h3></div></div>" +
      (del.length ? '<p class="cc-p">Are you sure? Players won\'t be able to request these times anymore, and this can\'t be undone.</p><ul class="cc-del">' + del.map(line).join("") + "</ul>" : "") +
      (kept.length ? '<p class="cc-err">' + (del.length ? "These stay, because each has a booked session inside. Cancel the session first:" : "Each of these has a booked session inside. Cancel the session first:") + '</p><ul class="cc-del kept">' + kept.map(x => "<li>" + dayName(x.ymd) + " · " + span(...bm(x.b)) + " · " + esc(who(x.lost[0])) + "</li>").join("") + "</ul>" : "") +
      '<div class="sc-dact">' + (del.length ? '<button type="button" class="btn cc-danger" data-yes>Yes, delete ' + del.length + "</button>" : "") + '<button type="button" class="linkbtn" data-do="close">' + (del.length ? "Cancel" : "Close") + "</button></div>";
    if (!d.open) d.showModal();
  }

  /* ---------- saving ---------- */
  async function saveEdit(btn) {
    const E = ST.edit, b = D.blocks.find(x => x.id === E.id);
    if (!b) { ST.edit = null; return paint(); }
    if (!ok(E.ea, E.eb)) { E.err = "Hour out has to be after hour in."; return paint(); }
    const targets = [b].concat(E.all ? sameAs(b) : []);
    // check every day first, so nothing half-saves: booked sessions have to stay inside the new hours
    for (const t of targets) {
      const ymd = blockDay(t), lost = orphans(ymd, union(blocksOn(ymd).filter(o => o.id !== t.id).map(bm).concat([[E.ea, E.eb]])));
      if (lost.length) { E.err = "Can't change " + dayName(ymd) + ": " + who(lost[0]) + "'s booked session (" + span(mins(lost[0].starts_at, ymd), mins(lost[0].ends_at, ymd)) + ") would be outside the new hours. Cancel it first, or keep it inside."; return paint(); }
    }
    const [x, y] = bm(b), msg = "Changed " + span(x, y) + " to " + span(E.ea, E.eb) + " ET on " + shortList(targets.map(blockDay)) + ".";
    await UI.act(btn, async () => {
      for (const t of targets) { const ymd = blockDay(t); await API.saveHours(ctx.coach.id, t.id, UI.etAt(ymd, E.ea).toISOString(), UI.etAt(ymd, E.eb).toISOString()); }
      ST.edit = null; await ctx.rerender();
    }, msg);
  }
  async function post(btn) {
    const days = ticked();
    if (!days.length || !ok(ST.a, ST.b)) return;
    const live = days.filter(y => UI.etAt(y, ST.b) > new Date()), skipped = days.length - live.length;   // no posting hours that are already over
    const joined = live.filter(y => blocksOn(y).some(o => { const [p, q] = bm(o); return p <= ST.b && ST.a <= q; })).length;
    const msg = (live.length ? "Added " + span(ST.a, ST.b) + " ET to " + live.length + (live.length === 1 ? " day." : " days.") : "Nothing added.") +
      (joined ? " On " + joined + (joined === 1 ? " day" : " days") + " it joined the hours already there." : "") +
      (skipped ? " Skipped " + skipped + (skipped === 1 ? " day" : " days") + " where that time is already over." : "");
    await UI.act(btn, async () => {
      for (const y of live) await API.saveHours(ctx.coach.id, null, UI.etAt(y, ST.a).toISOString(), UI.etAt(y, ST.b).toISOString());
      ST.a = ST.b = null; await ctx.rerender();   // days stay ticked so the new hours show in the list
    }, msg);
  }

  /* ---------- paint + events ---------- */
  function paint() {
    const hrs = ST.mode === "hours";
    panel.classList.toggle("cc-hours", hrs);
    panel.innerHTML = '<div class="dp-head"><h2>Your calendar</h2><div class="cc-mode" role="group" aria-label="Calendar view">' +
        '<button type="button" data-mode="sessions" aria-pressed="' + !hrs + '">Sessions</button><button type="button" data-mode="hours" aria-pressed="' + hrs + '">Hours</button></div></div>' +
      '<p class="muted small cc-hint">' + (hrs ? "Tick days to see and change their hours, or add new hours to all of them. Click a day again to untick it. Times are Eastern (ET), 8 AM to 4 AM."
                                              : "Click a day to see its booked sessions and waiting requests. Click it again to close.") + "</p>" +
      grid() + legend(hrs) + (hrs ? hoursView() : sessionsView());
  }
  function mount(el, deskCtx) {
    panel = el; ctx = deskCtx;
    D = { blocks: deskCtx.blocks, reqs: deskCtx.reqs, teams: deskCtx.teams, days: UI.eventDays() };
    if (!ST.picked) { const first = D.days.find(d => d.ymd >= UI.todayYmd() && !dayOver(d.ymd)); ST.picked = first ? [first.ymd] : []; }
    if (ST.edit && !D.blocks.some(b => b.id === ST.edit.id)) ST.edit = null;
    paint();
    panel.onclick = e => {
      const t = e.target, on = s => t.closest(s);
      let x;
      if ((x = on("[data-req]"))) return openReq(x.dataset.req);
      if ((x = on("[data-mode]"))) { ST.mode = x.dataset.mode; ST.edit = null; ST.sel.clear(); }
      else if ((x = on("[data-edit]"))) { const b = D.blocks.find(o => o.id === x.dataset.edit); if (!b) return; const [p, q] = bm(b); ST.edit = { id: b.id, ea: p, eb: q, all: false, err: "" }; if (!ST.picked.includes(blockDay(b))) ST.picked = ST.picked.concat(blockDay(b)); }
      else if ((x = on(".hit"))) { const y = x.dataset.day; if (ST.mode === "hours") ST.picked = ST.picked.includes(y) ? ST.picked.filter(v => v !== y) : ST.picked.concat(y); else ST.open = ST.open === y ? null : y; }
      else if (on("[data-closeday]")) ST.open = null;
      else if ((x = on("[data-esave]"))) return saveEdit(x);
      else if (on("[data-ecancel]")) ST.edit = null;
      else if (on("[data-erm]")) return askDelete([ST.edit.id]);
      else if (on("[data-bulkdel]")) return askDelete([...ST.sel]);
      else if (on("[data-bulkclear]")) ST.sel.clear();
      else if ((x = on("[data-post]"))) return post(x);
      else return;
      paint();
    };
    panel.onchange = e => {
      const t = e.target;
      if (t.matches("[data-pick]")) t.checked ? ST.sel.add(t.dataset.pick) : ST.sel.delete(t.dataset.pick);
      else if (t.matches("[data-pickall]")) { if (t.checked) ticked().forEach(y => upcoming(y).forEach(b => ST.sel.add(b.id))); else ST.sel.clear(); }
      else if (t.id === "cc-in") { ST.a = +t.value; if (ST.b != null && ST.b <= ST.a) ST.b = null; }
      else if (t.id === "cc-out") ST.b = +t.value;
      else if (t.id === "cc-e-in") { ST.edit.ea = +t.value; if (ST.edit.eb != null && ST.edit.eb <= ST.edit.ea) ST.edit.eb = null; ST.edit.err = ""; }
      else if (t.id === "cc-e-out") { ST.edit.eb = +t.value; ST.edit.err = ""; }
      else if (t.id === "cc-eall") ST.edit.all = t.checked;
      else return;
      paint();
    };
  }

  window.PTGCoachCal = { mount };
})();
