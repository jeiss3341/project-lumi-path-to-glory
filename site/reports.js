/* Path to Glory · Session reports: [PTG] stream VODs shown as filed reports.
   One look everywhere: folder tabs on top (report no. + who it's for), a two-page sheet with the
   details and session log on the left and the Twitch player taped on the right.
     PTGReports.mountPublic(el)              home page section, every filed report
     PTGReports.mount(el, list, ctx, opts)   desk tabs: a player's Notes, a coach's Your VODs (opts.edit)
   VODs come from supabase/vods.sql (Lumi-chan saves them; coaches file them on their desk). */
(function () {
  "use strict";
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const css = document.createElement("style");
  css.textContent =
    ".rp-tabs{display:flex;gap:4px;overflow-x:auto;scrollbar-width:thin}" +
    ".rp-tab{flex:none;background:#c4ab84;color:var(--ink);border:0;font:600 11px/1 var(--f-mono);letter-spacing:.08em;text-transform:uppercase;padding:9px 12px;cursor:pointer;white-space:nowrap}" +
    ".rp-tab[aria-selected=true]{background-color:var(--paper);background-image:var(--grain)}" +
    ".rp-tab{transition:transform .15s}" +
    "@media (hover:hover) and (prefers-reduced-motion:no-preference){.rp-tab:not([aria-selected=true]):hover{transform:translateY(-3px)}}" +
    ".rp-tab .rp-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--red);margin-left:7px;vertical-align:1px}" +
    ".rp-file{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.35fr);box-shadow:var(--lift)}" +
    ".rp-left{padding:22px 24px;border-right:1px solid var(--paper-rule);min-width:0}" +
    ".rp-right{padding:30px 24px 22px;min-width:0}" +
    ".rp-meta{font:600 11px/1.4 var(--f-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--ink-soft)}" +
    ".rp-who{font:800 clamp(22px,2.6vw,30px)/1.05 var(--f-display);text-transform:uppercase;letter-spacing:.01em;margin:8px 0 4px;overflow-wrap:anywhere}" +
    ".rp-who.none{color:#8a8580}" +
    ".rp-kind{font:500 14px/1.4 var(--f-display);color:var(--ink-soft)}" +
    ".rp-lab{font:600 11px/1 var(--f-mono);letter-spacing:.14em;text-transform:uppercase;color:var(--red-deep);margin:16px 0 5px}" +
    ".rp-val{font:500 15px/1.35 var(--f-display)}" +
    ".rp-coach{font:800 20px/1.2 var(--f-display);text-transform:uppercase;letter-spacing:.02em}" +
    ".rp-log{list-style:none;margin:0;padding:0;border-top:1px dashed var(--paper-rule)}" +
    ".rp-log li{border-bottom:1px dashed var(--paper-rule);padding:6px 0;font:500 13px/1.35 var(--f-mono);display:flex;gap:10px;align-items:baseline}" +
    ".rp-log .t{color:var(--red-deep);background:none;border:0;padding:0;font:inherit;cursor:pointer;text-decoration:underline;text-decoration-color:transparent;text-underline-offset:3px}" +
    ".rp-log .t:hover{text-decoration-color:currentColor}" +
    ".rp-log .l{flex:1;min-width:0}.rp-log .l.empty{color:#8a8580}" +
    ".rp-ed{background:none;border:0;padding:0;margin-left:8px;font:600 11px/1 var(--f-mono);letter-spacing:.06em;color:var(--red-deep);text-decoration:underline;text-underline-offset:3px;cursor:pointer}" +
    ".rp-ex{background:#f8f7f4;border:1px solid var(--paper-rule);padding:9px 9px 11px;position:relative}" +
    ".rp-ex::before{content:'';position:absolute;top:-10px;left:42%;width:78px;height:18px;background:var(--red);opacity:.78}" +
    ".rp-video{aspect-ratio:16/9;background:#0d0b0a;position:relative;display:flex;align-items:center;justify-content:center;color:#e9e7e2;font:600 12px/1.4 var(--f-mono);letter-spacing:.06em;text-align:center}" +
    ".rp-video iframe{position:absolute;inset:0;width:100%;height:100%;border:0}" +
    ".rp-cap{font:600 11px/1 var(--f-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--ink-soft);margin-top:8px}" +
    ".rp-stamp{display:inline-block;margin-top:14px;font:600 11px/1 var(--f-mono);letter-spacing:.1em;text-transform:uppercase;padding:5px 9px;transform:rotate(-3deg);border:1.5px solid}" +
    ".rp-stamp.exp{color:#9a6512;border-color:#c9922e}.rp-stamp.ok{color:#2d7a4b;border-color:#2d7a4b}.rp-stamp.live{color:var(--red-deep);border-color:var(--red)}" +
    ".rp-note{font:500 13px/1.45 var(--f-display);color:var(--ink-soft);margin-top:12px}" +
    ".rp-need{background:#f3dcd9;color:#7d221d;font:600 12px/1.4 var(--f-mono);padding:8px 10px;margin-top:6px}" +
    ".rp-pick{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}" +
    ".rp-pick button{background:transparent;color:var(--ink);border:1.5px solid var(--ink);font:600 11px/1 var(--f-mono);letter-spacing:.06em;text-transform:uppercase;padding:8px 10px;cursor:pointer}" +
    ".rp-pick button:hover{background:var(--ink);color:#fff}" +
    ".rp-pick select,.rp-rename input{font:500 13px/1 var(--f-mono);height:34px;border:1.5px solid var(--ink);background:#fff;color:var(--ink);padding:0 8px;max-width:100%}" +
    ".rp-for{color:var(--ink-soft)}" +
    ".desk>*,#rp-all,.rp-wrap{min-width:0;max-width:100%}" +
    ".rp-coaches{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 22px}" +
    ".rp-cbtn{background:transparent;color:var(--paper);border:1.5px solid rgba(243,242,238,.45);font:700 13px/1 var(--f-display);letter-spacing:.06em;text-transform:uppercase;padding:10px 14px;cursor:pointer;display:inline-flex;gap:8px;align-items:center}" +
    ".rp-cbtn:hover{border-color:var(--paper)}" +
    ".rp-cbtn[aria-pressed=true]{background-color:var(--paper);background-image:var(--grain);color:var(--ink);border-color:var(--paper)}" +
    ".rp-cbtn .n{font:600 11px/1 var(--f-mono);opacity:.7}" +
    ".rp-older{flex:none;align-self:stretch;background:#c4ab84;color:var(--ink);border:0;font:600 11px/1 var(--f-mono);letter-spacing:.08em;text-transform:uppercase;padding:0 10px;cursor:pointer}" +
    ".rp-desc{font:400 14px/1.55 var(--f-display);color:var(--ink);margin:12px 0 0;max-width:46ch}" +
    ".rp-titleform{display:flex;flex-direction:column;margin-top:4px}.rp-titleform .rp-lab{margin-top:10px}" +
    ".rp-titleform input,.rp-titleform textarea{font:500 14px/1.4 var(--f-display);border:1.5px solid var(--ink);background:#fff;color:var(--ink);padding:7px 9px;width:100%;box-sizing:border-box;resize:vertical}" +
    ".rp-log li.rp-editrow{flex-wrap:wrap;gap:6px;padding:8px 0}" +
    ".rp-editrow input,.rp-editrow select{font:500 13px/1 var(--f-mono);height:32px;border:1.5px solid var(--ink);background:#fff;color:var(--ink);padding:0 7px;min-width:0}" +
    ".rp-editrow .js-rp-time{width:86px}.rp-editrow .js-rp-name{flex:1 1 140px}.rp-editrow select{flex:1 1 100%}" +
    ".rp-row-btns{display:flex;gap:4px;align-items:center}.rp-row-btns .rp-ed:first-child{margin-left:0}" +
    ".rp-empty{padding:28px 24px;font:500 15px/1.5 var(--f-display);color:var(--ink-soft)}" +
    "@media (max-width:760px){.rp-file{grid-template-columns:1fr}.rp-left{border-right:0;border-bottom:1px solid var(--paper-rule)}.rp-right{padding-top:28px}}";
  document.head.appendChild(css);

  /* ---------- small helpers ---------- */
  const T = iso => new Date(iso).getTime();
  const hms = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 3600) + ":" + String(Math.floor(s / 60) % 60).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); };
  const lengthOf = v => (T(v.ended_at || new Date(UI.now()).toISOString()) - T(v.started_at)) / 1000;
  const live = v => !v.ended_at;
  const filed = v => !!v.kind;
  const canEdit = (v, opts) => typeof opts.edit === "function" ? !!opts.edit(v) : !!opts.edit;
  const coachOf = (v, ctx) => (ctx.coaches || []).find(c => c.id === v.coach_id);
  const coachName = (v, ctx) => { const c = coachOf(v, ctx); return c ? UI.bare(UI.coachName(c)) : "Coach"; };
  // report numbers count up through every stream, oldest first, so a report keeps its number everywhere
  const numbers = all => { const m = {}; all.slice().sort((a, b) => T(a.started_at) - T(b.started_at)).forEach((v, i) => { m[v.id] = String(i + 1).padStart(3, "0"); }); return m; };
  const teamName = (v, ctx) => { const t = (ctx.teams || []).find(x => x.id === v.team_id); return t ? t.name : v.for_name || "A team"; };
  const whoFor = (v, ctx) => !filed(v) ? "" : v.kind === "team" ? teamName(v, ctx) : v.kind === "individual" ? (v.for_name || "A player") : (v.note || "General session");
  const kindLabel = (v, ctx) => !filed(v) ? "Not filed yet" : v.kind === "team" ? "Team review with " + coachName(v, ctx) : v.kind === "individual" ? "Individual session with " + coachName(v, ctx) : "General · " + coachName(v, ctx);
  const tabLabel = (v, ctx, no) => no + " " + (filed(v) ? (v.custom_title || (v.kind === "general" ? "General" : whoFor(v, ctx))) : UI.date(v.started_at, { month: "short", day: "numeric" }));
  const dayLabel = v => UI.date(v.started_at, { weekday: "short", month: "short", day: "numeric" });
  function stamp(v) {
    if (live(v)) return '<span class="rp-stamp live">Live now</span>';
    if (v.saved) return '<span class="rp-stamp ok">Saved as highlight</span>';
    if (v.expires_at) return '<span class="rp-stamp exp">On Twitch until ' + esc(UI.date(v.expires_at, { month: "short", day: "numeric" })) + "</span>";
    return "";
  }
  const offsetOf = (v, m) => Math.max(0, (T(m.started_at) - T(v.started_at)) / 1000);
  const twitchTime = s => { s = Math.round(s); return Math.floor(s / 3600) + "h" + Math.floor(s / 60) % 60 + "m" + s % 60 + "s"; };
  // the Twitch player: the VOD once there is one, the live channel while streaming, otherwise a note
  function player(v, at, autoplay) {
    const host = location.hostname || "localhost";
    if (v.vod_id && !/^demo/.test(v.vod_id)) return '<iframe title="Twitch VOD" allowfullscreen src="https://player.twitch.tv/?video=v' + esc(v.vod_id) + "&parent=" + esc(host) + "&autoplay=" + !!autoplay + (at ? "&time=" + twitchTime(at) : "") + '"></iframe>';
    if (live(v) && v.twitch_login) return '<iframe title="Twitch live stream" allowfullscreen src="https://player.twitch.tv/?channel=' + esc(v.twitch_login) + "&parent=" + esc(host) + '&autoplay=false&muted=true"></iframe>';
    if (v.vod_id) return "<span>Sample video<br>" + (at ? "▶ playing from " + hms(at) : "The real Twitch VOD plays here") + "</span>";
    return "<span>The VOD shows here once<br>Twitch has finished it</span>";
  }

  /* ---------- one report ---------- */
  function sheet(v, ctx, no, opts, state) {
    const edit = canEdit(v, opts), who = whoFor(v, ctx);
    const coach = coachOf(v, ctx);
    const marks = (v.marks || []).slice().sort((a, b) => T(a.started_at) - T(b.started_at));
    let left = '<div class="rp-meta">' + (filed(v) ? "Report " + no + " · " : "Stream · ") + esc(dayLabel(v)) + (filed(v) ? "" : " · " + esc(UI.time(v.started_at))) + "</div>";
    if (filed(v) && edit && state.titling === v.id) {
      // the coach's own title and description for the report (blank title = who it's for)
      left += '<div class="rp-titleform"><label class="rp-lab" for="rp-t">Title</label><input id="rp-t" class="js-rp-tin" value="' + esc(v.custom_title || "") + '" maxlength="80" placeholder="' + esc(who) + '">' +
        '<label class="rp-lab" for="rp-d">Description</label><textarea id="rp-d" class="js-rp-din" rows="4" maxlength="1000" placeholder="What you covered, what to watch for…">' + esc(v.description || "") + "</textarea>" +
        '<div class="rp-row-btns" style="margin-top:8px"><button type="button" class="rp-ed js-rp-tsave">save</button><button type="button" class="rp-ed js-rp-tstop">cancel</button></div></div>';
    } else if (filed(v)) {
      left += '<div class="rp-who">' + esc(v.custom_title || who) + (edit ? '<button type="button" class="rp-ed js-rp-title" style="vertical-align:middle">edit</button>' : "") + "</div>" +
        '<div class="rp-kind">' + esc(kindLabel(v, ctx)) + (v.custom_title ? " · " + esc(who) : "") + (edit ? '<button type="button" class="rp-ed js-rp-change">change</button>' : "") + "</div>" +
        (v.description ? '<p class="rp-desc">' + esc(v.description).replace(/\n/g, "<br>") + "</p>" : edit ? '<button type="button" class="rp-ed js-rp-title" style="margin:8px 0 0">+ Add a description</button>' : "");
    } else {
      left += '<div class="rp-who none">Not filed yet</div>';
    }
    if (edit && (!filed(v) || state.changing === v.id)) left += picker(v, ctx, state);
    if (filed(v) && coach) left += '<div class="rp-lab">Coach</div><div class="rp-val rp-coach">' + esc(coachName(v, ctx)) + "</div>";
    left += '<div class="rp-lab">Length</div><div class="rp-val">' + hms(lengthOf(v)) + (live(v) ? " so far" : "") + "</div>";
    // the log: one line per timestamp. A coach can add, edit or remove them, and file one for someone
    // else when a stream holds back-to-back sessions ("for Mareep").
    const forTag = m => m.kind ? ' <span class="rp-for">· for ' + esc(m.kind === "general" ? "General" : m.for_name || "someone") + "</span>" : "";
    const lines = marks.map(m => {
      const at = offsetOf(v, m);
      if (edit && state.editing === m.id) return editRow(v, ctx, m);
      return '<li><button type="button" class="t js-rp-seek" data-at="' + at + '" title="Play from here">› ' + hms(at) + '</button><span class="l' + (m.label ? "" : " empty") + '">' + esc(m.label || (edit ? "Name this part" : "[PTG] on")) + forTag(m) + "</span>" +
        (edit ? '<button type="button" class="rp-ed js-rp-edit" data-id="' + esc(m.id) + '">edit</button>' : "") + "</li>";
    }).join("");
    left += '<div class="rp-lab">Session log</div>' + (marks.length || (edit && state.editing === "new") ? '<ul class="rp-log">' + lines + (edit && state.editing === "new" ? editRow(v, ctx, null) : "") + "</ul>" : '<p class="rp-note" style="margin:0">No [PTG] parts recorded.</p>');
    if (edit && state.editing !== "new") left += '<button type="button" class="rp-ed js-rp-add" style="margin:10px 0 0">+ Add a timestamp</button>';
    if (edit && filed(v) && v.request_id) left += '<p class="rp-note">Matched to your booked session.</p>';
    const right = '<div class="rp-ex"><div class="rp-video" id="rp-video">' + player(v, state.at, state.play) + '</div><div class="rp-cap">Exhibit A · twitch.tv/' + esc(v.twitch_login || "") + "</div></div>" + stamp(v) +
      (edit && !live(v) ? '<div style="margin-top:12px"><button type="button" class="rp-ed js-rp-saved" style="margin:0">' + (v.saved ? "Undo: not saved as a highlight" : "I saved it as a Twitch highlight") + "</button></div>" : "");
    return '<div class="rp-file sheet"><div class="rp-left">' + left + '</div><div class="rp-right">' + right + "</div></div>";
  }

  // the people a coach can file things for: every team, and every logged-in player grouped by team
  function forOptions(ctx, cur) {
    const sel = v => v === cur ? " selected" : "";
    return '<optgroup label="Teams">' + (ctx.teams || []).map(t => '<option value="team:' + esc(t.id) + '"' + sel("team:" + t.id) + ">" + esc(t.name) + "</option>").join("") + "</optgroup>" +
      (ctx.teams || []).map(t => {
        const ppl = (t.member_ids || []).map(id => (ctx.profiles || []).find(p => p.id === id)).filter(Boolean);
        return ppl.length ? '<optgroup label="Players · ' + esc(t.name) + '">' + ppl.map(p => '<option value="player:' + esc(p.id) + '"' + sel("player:" + p.id) + ">" + esc(UI.who(p)) + "</option>").join("") + "</optgroup>" : "";
      }).join("") + '<option value="general"' + sel("general") + ">General</option>";
  }
  // one timestamp being added or edited: time into the video, its name, and who that part is for
  function editRow(v, ctx, m) {
    const at = m ? offsetOf(v, m) : 0, cur = m && m.kind ? (m.kind === "team" ? "team:" + m.team_id : m.kind === "individual" ? "player:" + m.profile_id : "general") : "";
    return '<li class="rp-editrow"><input class="js-rp-time" value="' + (m ? hms(at) : "") + '" placeholder="0:00:00" aria-label="Time into the video" inputmode="numeric">' +
      '<input class="js-rp-name" value="' + esc(m ? m.label : "") + '" maxlength="80" placeholder="Name this part" aria-label="Name">' +
      '<select class="js-rp-for" aria-label="Who this part is for"><option value="">Same as the report</option>' + forOptions(ctx, cur) + "</select>" +
      '<span class="rp-row-btns"><button type="button" class="rp-ed js-rp-keep" data-id="' + esc(m ? m.id : "new") + '">save</button><button type="button" class="rp-ed js-rp-stop">cancel</button>' +
      (m ? '<button type="button" class="rp-ed js-rp-del" data-id="' + esc(m.id) + '">remove</button>' : "") + "</span></li>";
  }
  // "1:02:15", "62:15" or "75" (seconds) → seconds; null if it isn't a time
  const parseTime = s => {
    const p = String(s).trim().split(":").map(x => x.trim());
    if (!p.length || p.length > 3 || p.some(x => !/^\d+$/.test(x))) return null;
    return p.reduce((n, x) => n * 60 + +x, 0);
  };

  // the coach's "who is this for" choice: their team, a team (assistants), a player, or General
  function picker(v, ctx, state) {
    const c = coachOf(v, ctx), own = c && c.kind === "mentor" ? (ctx.teams || []).find(t => t.coach_id === c.id) : null;
    const match = state.match && state.match[v.id];
    let h = !filed(v) ? '<div class="rp-need">' + (match ? "This matches your " + esc(UI.time(match.starts_at)) + " session with " + esc(match.label) + "." : "No booked session at this time.") + " Who is it for?</div>" : '<div class="rp-need">Who is it for?</div>';
    h += '<div class="rp-pick">';
    if (match) h += '<button type="button" class="js-rp-file" data-pick="match">' + esc(match.label) + "</button>";
    if (own && !(match && match.team_id === own.id && match.kind === "team")) h += '<button type="button" class="js-rp-file" data-pick="team:' + esc(own.id) + '">' + esc(own.name) + "</button>";
    if (state.more !== "team") h += '<button type="button" class="js-rp-more" data-more="team">' + (own ? "Another team…" : "A team…") + "</button>";
    if (state.more !== "player") h += '<button type="button" class="js-rp-more" data-more="player">A player…</button>';
    h += '<button type="button" class="js-rp-file" data-pick="general">General</button>';
    if (filed(v)) h += '<button type="button" class="js-rp-cancel" style="border-color:transparent">Cancel</button>';
    h += "</div>";
    if (state.more === "team") h += '<div class="rp-pick"><select class="js-rp-sel" aria-label="Team">' + (ctx.teams || []).map(t => '<option value="team:' + esc(t.id) + '">' + esc(t.name) + "</option>").join("") + '</select><button type="button" class="js-rp-file" data-pick="sel">File it</button></div>';
    if (state.more === "player") {
      const opts = (ctx.teams || []).map(t => {
        const ppl = (t.member_ids || []).map(id => (ctx.profiles || []).find(p => p.id === id)).filter(Boolean);
        return ppl.length ? '<optgroup label="' + esc(t.name) + '">' + ppl.map(p => '<option value="player:' + esc(p.id) + '">' + esc(UI.who(p)) + "</option>").join("") + "</optgroup>" : "";
      }).join("");
      h += '<div class="rp-pick">' + (opts ? '<select class="js-rp-sel" aria-label="Player">' + opts + '</select><button type="button" class="js-rp-file" data-pick="sel">File it</button>' : '<span class="rp-note" style="margin:0">No players have logged in yet.</span>') + "</div>";
    }
    return h;
  }

  /* ---------- tabs + the selected report, wired up ---------- */
  function mount(el, list, ctx, opts) {
    opts = opts || {};
    const no = numbers(ctx.all || list);
    const state = el.__rp || (el.__rp = { cur: null, at: 0, play: false, editing: null, changing: null, titling: null, more: null, match: {} });
    if (opts.edit) state.match = matches(list.filter(v => canEdit(v, opts)), ctx);
    const draw = () => {
      if (!list.length) { el.innerHTML = '<div class="sheet rp-empty">' + esc(opts.empty || "No session reports yet.") + "</div>"; return; }
      if (!list.some(v => v.id === state.cur)) state.cur = list[0].id;
      const v = list.find(x => x.id === state.cur);
      const MAX = 8, shown = list.slice(0, MAX), older = list.slice(MAX);
      if (!shown.some(x => x.id === state.cur)) shown.push(v);
      const olderMenu = older.length ? '<select class="rp-older js-rp-older" aria-label="Older reports"><option value="">Older (' + older.length + ") ▾</option>" +
        older.map(x => '<option value="' + esc(x.id) + '">' + esc(tabLabel(x, ctx, no[x.id]) + " · " + UI.date(x.started_at, { month: "short", day: "numeric" })) + "</option>").join("") + "</select>" : "";
      el.innerHTML = '<div class="rp-tabs" role="tablist" aria-label="Session reports">' + shown.map(x => '<button type="button" role="tab" class="rp-tab js-rp-tab" data-id="' + esc(x.id) + '" aria-selected="' + (x.id === state.cur) + '">' + esc(tabLabel(x, ctx, no[x.id])) + (canEdit(x, opts) && !filed(x) ? '<span class="rp-dot" title="Not filed yet"></span>' : "") + (live(x) ? " ●" : "") + "</button>").join("") + olderMenu + "</div>" +
        sheet(v, ctx, no[v.id], opts, state);
    };
    const save = async (patch, btn) => {
      try { await API.updateVod(state.cur, patch); const v = list.find(x => x.id === state.cur); Object.assign(v, patch); state.changing = null; state.titling = null; state.more = null; draw(); if (opts.onChange) opts.onChange(); }
      catch (e) { UI.toast(e.message || "Couldn't save that."); if (btn) btn.disabled = false; }
    };
    el.onclick = e => {
      const tab = e.target.closest(".js-rp-tab");
      if (tab) { state.cur = tab.dataset.id; state.at = 0; state.play = false; state.editing = state.changing = state.titling = state.more = null; draw(); return; }
      const v = list.find(x => x.id === state.cur);
      const seek = e.target.closest(".js-rp-seek");
      if (seek) { state.at = +seek.dataset.at; state.play = true; const box = el.querySelector("#rp-video"); if (box) box.innerHTML = player(v, state.at, true); return; }
      if (e.target.closest(".js-rp-change")) { state.changing = v.id; state.more = null; draw(); return; }
      if (e.target.closest(".js-rp-title")) { state.titling = v.id; draw(); const i = el.querySelector(".js-rp-tin"); if (i) i.focus(); return; }
      if (e.target.closest(".js-rp-tstop")) { state.titling = null; draw(); return; }
      const ts = e.target.closest(".js-rp-tsave");
      if (ts) { ts.disabled = true; save({ custom_title: el.querySelector(".js-rp-tin").value.trim().slice(0, 80), description: el.querySelector(".js-rp-din").value.trim().slice(0, 1000) }, ts); return; }
      if (e.target.closest(".js-rp-cancel")) { state.changing = null; state.more = null; draw(); return; }
      const more = e.target.closest(".js-rp-more");
      if (more) { state.more = more.dataset.more; draw(); return; }
      const ed = e.target.closest(".js-rp-edit");
      if (ed) { state.editing = ed.dataset.id; draw(); const i = el.querySelector(".js-rp-name"); if (i) i.focus(); return; }
      if (e.target.closest(".js-rp-add")) { state.editing = "new"; draw(); const i = el.querySelector(".js-rp-time"); if (i) i.focus(); return; }
      if (e.target.closest(".js-rp-stop")) { state.editing = null; draw(); return; }
      const keep = e.target.closest(".js-rp-keep");
      if (keep) { keepMark(v, keep.dataset.id, keep); return; }
      const del = e.target.closest(".js-rp-del");
      if (del) { removeMark(v, del.dataset.id, del); return; }
      if (e.target.closest(".js-rp-saved")) { save({ saved: !v.saved }); return; }
      const f = e.target.closest(".js-rp-file");
      if (f) {
        let pick = f.dataset.pick;
        if (pick === "sel") pick = (el.querySelector(".js-rp-sel") || {}).value || "";
        f.disabled = true;
        if (pick === "match") { const m = state.match[v.id]; save({ kind: m.kind, team_id: m.team_id || null, profile_id: m.profile_id || null, request_id: m.request_id, for_name: m.label, note: "" }, f); return; }
        if (pick === "general") { save({ kind: "general", team_id: null, profile_id: null, request_id: null, for_name: "" }, f); return; }
        const [k, id] = pick.split(":");
        if (k === "team") { const t = (ctx.teams || []).find(x => x.id === id); save({ kind: "team", team_id: id, profile_id: null, request_id: null, for_name: t ? t.name : "", note: "" }, f); return; }
        if (k === "player") { const p = (ctx.profiles || []).find(x => x.id === id); save({ kind: "individual", profile_id: id, team_id: null, request_id: null, for_name: p ? UI.who(p) : "", note: "" }, f); return; }
        f.disabled = false;
      }
    };
    // save the timestamp being added or edited: its time, name and who that part is for
    const keepMark = async (v, id, btn) => {
      const row = btn.closest(".rp-editrow"), s = parseTime(row.querySelector(".js-rp-time").value), len = lengthOf(v);
      if (s == null) { UI.toast("Type the time into the video, like 1:02:15."); row.querySelector(".js-rp-time").focus(); return; }
      if (s > len) { UI.toast("That's after the end of the video (" + hms(len) + ")."); row.querySelector(".js-rp-time").focus(); return; }
      const f = row.querySelector(".js-rp-for").value, [k, who] = f.split(":");
      const t = k === "team" ? (ctx.teams || []).find(x => x.id === who) : null, p = k === "player" ? (ctx.profiles || []).find(x => x.id === who) : null;
      const patch = { started_at: new Date(T(v.started_at) + s * 1000).toISOString(), label: row.querySelector(".js-rp-name").value.trim().slice(0, 80),
        kind: !f ? null : k === "team" ? "team" : k === "player" ? "individual" : "general", team_id: t ? t.id : null, profile_id: p ? p.id : null, for_name: t ? t.name : p ? UI.who(p) : "" };
      btn.disabled = true;
      try {
        if (id === "new") { const m = await API.addMark(Object.assign({ vod_id: v.id }, patch)); (v.marks = v.marks || []).push(Object.assign({ ended_at: null, manual: true }, patch, m)); }
        else { await API.updateMark(id, patch); Object.assign(v.marks.find(x => x.id === id), patch); }
        state.editing = null; draw(); if (opts.onChange) opts.onChange();
      } catch (e) { UI.toast(e.message || "Couldn't save that."); btn.disabled = false; }
    };
    const removeMark = async (v, id, btn) => {
      btn.disabled = true;
      try { await API.deleteMark(id); v.marks = v.marks.filter(x => x.id !== id); state.editing = null; draw(); if (opts.onChange) opts.onChange(); }
      catch (e) { UI.toast(e.message || "Couldn't remove that."); btn.disabled = false; }
    };
    el.onchange = e => {
      const o = e.target.closest(".js-rp-older");
      if (o && o.value) { state.cur = o.value; state.at = 0; state.play = false; state.editing = state.changing = state.titling = state.more = null; draw(); }
    };
    el.onkeydown = e => {
      const row = e.target.closest && e.target.closest(".rp-editrow");
      if (!row) return;
      if (e.key === "Enter" && e.target.tagName === "INPUT") { e.preventDefault(); const b = row.querySelector(".js-rp-keep"); if (b) b.click(); }
      if (e.key === "Escape") { state.editing = null; draw(); }
    };
    draw();
  }

  // an unfiled stream that overlaps one of the coach's booked sessions: suggest filing it for that session
  function matches(list, ctx) {
    const out = {};
    list.filter(v => !filed(v)).forEach(v => {
      const s = T(v.started_at), e = T(v.ended_at || new Date(UI.now()).toISOString());
      const r = (ctx.requests || []).filter(x => x.coach_id === v.coach_id && x.status === "accepted" && T(x.starts_at) < e && T(x.ends_at) > s)
        .sort((a, b) => Math.abs(T(a.starts_at) - s) - Math.abs(T(b.starts_at) - s))[0];
      if (!r) return;
      if (r.kind === "team") {
        const t = (ctx.teams || []).find(x => (x.member_ids || []).includes(r.requester_id)) || (ctx.teams || []).find(x => x.coach_id === r.coach_id);
        if (t) out[v.id] = { kind: "team", team_id: t.id, label: t.name, request_id: r.id, starts_at: r.starts_at };
      } else {
        const p = r.requester || (ctx.profiles || []).find(x => x.id === r.requester_id);
        out[v.id] = { kind: "individual", profile_id: r.requester_id, label: p ? UI.who(p) : "the player", request_id: r.id, starts_at: r.starts_at };
      }
    });
    return out;
  }

  /* ---------- the VODs page (vods.html): every filed report, for anyone logged in ---------- */
  async function mountAll(el) {
    const me = await API.session().catch(() => null);
    UI.mountAuth(document.getElementById("auth"), me);
    if (!me) {
      el.innerHTML = '<article class="sheet gate"><span class="mono-label" style="color:var(--red-deep)">Session reports · Path to Glory</span><h2>Log in to watch the VODs</h2>' +
        "<p>Session reports are for the Path to Glory community. Log in with Discord to watch them.</p>" +
        '<button type="button" class="btn" id="gate-login">Log in with Discord</button></article>';
      document.getElementById("gate-login").onclick = e => UI.login(e.currentTarget);
      return;
    }
    let all = [], coaches = [], teams = [];
    try { [all, coaches, teams] = await Promise.all([API.vods(), API.coaches(), API.teams()]); }
    catch (e) { el.innerHTML = '<div class="sheet rp-empty">Session reports couldn\'t load right now: ' + esc(e.message || e) + "</div>"; return; }
    const mineToEdit = v => me.role === "staff" || coaches.some(c => c.id === v.coach_id && c.profile_id === me.id);
    const profiles = coaches.some(c => c.profile_id === me.id) || me.role === "staff" ? await API.profiles().catch(() => []) : [];
    const list = all.filter(v => filed(v) || live(v) || mineToEdit(v));
    // one button per coach with reports, most reports first (your own first if you're a coach)
    const by = {};
    list.forEach(v => { (by[v.coach_id] = by[v.coach_id] || []).push(v); });
    const mine = coaches.find(c => c.profile_id === me.id);
    const ids = Object.keys(by).sort((a, b) => (mine && b === mine.id) - (mine && a === mine.id) || by[b].length - by[a].length);
    if (!ids.length) { el.innerHTML = '<div class="sheet rp-empty">No session reports yet. They appear here once coaches stream sessions with [PTG] in their title.</div>'; return; }
    if (!el.__coach || !by[el.__coach]) el.__coach = ids[0];
    const name = id => { const c = coaches.find(x => x.id === id); return c ? UI.bare(UI.coachName(c)) : "Coach"; };
    const draw = () => {
      el.innerHTML = '<div class="rp-coaches" role="group" aria-label="Coaches">' + ids.map(id => '<button type="button" class="rp-cbtn js-rp-coach" data-id="' + esc(id) + '" aria-pressed="' + (id === el.__coach) + '">' + esc(name(id)) + '<span class="n">' + by[id].length + "</span></button>").join("") + '</div><div class="rp-wrap"></div>';
      const box = el.querySelector(".rp-wrap");
      mount(box, by[el.__coach], { all, coaches, teams, profiles }, { edit: mineToEdit });
      el.querySelector(".rp-coaches").onclick = e => { const b = e.target.closest(".js-rp-coach"); if (b && b.dataset.id !== el.__coach) { el.__coach = b.dataset.id; draw(); } };
    };
    draw();
  }

  window.PTGReports = { mount, mountAll, filed };
  const page = document.getElementById("rp-all");
  if (page) {
    mountAll(page);
    if (API.onAuth) API.onAuth(() => mountAll(page));   // logging in or out (and the demo bar's account switch)
  }
})();
