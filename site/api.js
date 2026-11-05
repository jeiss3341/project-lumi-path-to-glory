/* Path to Glory · data layer.
   window.API has one set of async functions with two backends:
   - LIVE: Supabase (Discord login + Postgres with the rules in supabase/schema.sql)
   - DEMO: sample data in this browser's localStorage, with the same rules,
           so the site can be tried before Supabase is set up. */
(function () {
  "use strict";
  const cfg = window.PTG_CONFIG || {};
  const canLive = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase && window.supabase.createClient);
  window.API = canLive ? liveApi() : demoApi();

  /* ================================================================ LIVE */
  function liveApi() {
    const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    const API = { live: true };
    const authListeners = [];
    let sessP = null, lastUid;

    function friendly(e) {
      const code = e && e.code;
      if (code === "23P01") return "That time overlaps hours or a session that's already there.";
      if (code === "23505") return "You already have one of those.";
      if (code === "42501") return "You don't have permission to do that.";
      if (code === "23514") return "Something is missing or too long. Check the fields and try again.";
      return (e && e.message) || "Something went wrong. Try again.";
    }
    async function q(p) {
      const { data, error } = await p;
      if (error) throw new Error(friendly(error));
      return data;
    }
    const PROFILE = "id,discord_id,username,display_name,avatar_url,role";
    const COACH_MINI = "id,kind,slot,name,team_name,badge_id";

    API.session = () => sessP || (sessP = (async () => {
      const { data } = await sb.auth.getSession();
      const s = data && data.session;
      if (!s) return null;
      const p = await q(sb.from("profiles").select(PROFILE).eq("id", s.user.id).maybeSingle()).catch(() => null);
      const md = s.user.user_metadata || {};
      return p || { id: s.user.id, discord_id: md.provider_id || null, username: md.name || "", display_name: md.full_name || md.name || "", avatar_url: md.avatar_url || "", role: "player" };
    })());
    sb.auth.onAuthStateChange((evt, s) => {
      const uid = s && s.user ? s.user.id : null;
      if (uid === lastUid) return;
      const first = lastUid === undefined;
      lastUid = uid; sessP = null;
      if (!first) setTimeout(() => authListeners.forEach(f => f(evt)), 0);
    });
    API.onAuth = f => authListeners.push(f);
    API.signIn = async () => {
      const { error } = await sb.auth.signInWithOAuth({
        provider: "discord",
        options: { redirectTo: location.href.split("#")[0] }
      });
      if (error) throw new Error(friendly(error));
    };
    API.signOut = async () => { await sb.auth.signOut(); sessP = null; };
    API.watch = (table, cb) => {
      const ch = sb.channel("ptg-" + table + "-" + Math.random().toString(36).slice(2))
        .on("postgres_changes", { event: "*", schema: "public", table }, () => cb())
        .subscribe();
      return () => sb.removeChannel(ch);
    };

    API.coaches = () => q(sb.from("coaches").select("*").order("kind", { ascending: false }).order("slot"));
    API.updateCoach = (id, patch) => q(sb.from("coaches").update(patch).eq("id", id).select().single());

    API.teams = () => q(sb.from("teams").select("*").order("sort").order("created_at"));
    API.saveTeam = t => {
      const body = { name: t.name, coach_id: t.coach_id || null, players: t.players || [], member_ids: t.member_ids || [], sort: t.sort || 0, signup_id: t.signup_id || null };
      return t.id ? q(sb.from("teams").update(body).eq("id", t.id).select().single())
                  : q(sb.from("teams").insert(body).select().single());
    };
    API.deleteTeam = id => q(sb.from("teams").delete().eq("id", id));

    API.mySignup = async () => {
      const me = await API.session();
      if (!me) return null;
      return q(sb.from("signups").select("*").eq("user_id", me.id).maybeSingle());
    };
    API.saveSignup = async d => {
      const mine = await API.mySignup();
      return mine ? q(sb.from("signups").update(d).eq("id", mine.id).select().single())
                  : q(sb.from("signups").insert(d).select().single());
    };
    API.setSignupStatus = (id, status, staff_note) => {
      const body = { status };
      if (staff_note !== undefined) body.staff_note = staff_note;
      return q(sb.from("signups").update(body).eq("id", id).select().single());
    };
    API.signups = () => q(sb.from("signups").select("*, profile:profiles(" + PROFILE + ")").order("created_at"));

    API.availability = coachId => q(sb.from("availability").select("*").eq("coach_id", coachId).order("starts_at"));
    API.addBlocks = async blocks => {
      const added = [], failed = [];
      for (const b of blocks) {
        try { added.push(await q(sb.from("availability").insert(b).select().single())); }
        catch (e) { failed.push({ block: b, error: e.message }); }
      }
      return { added, failed };
    };
    API.deleteBlock = id => q(sb.from("availability").delete().eq("id", id));
    API.busy = coachId => q(sb.rpc("coach_busy", { c: coachId }));

    API.myRequests = async () => {
      const me = await API.session();
      if (!me) return [];
      return q(sb.from("requests").select("*, coach:coaches(" + COACH_MINI + ")").eq("requester_id", me.id).order("starts_at"));
    };
    API.coachRequests = coachId => q(sb.from("requests").select("*, requester:profiles(" + PROFILE + ")").eq("coach_id", coachId).order("starts_at"));
    API.allRequests = () => q(sb.from("requests").select("*, requester:profiles(" + PROFILE + "), coach:coaches(" + COACH_MINI + ")").order("starts_at"));
    API.requestSession = r => q(sb.from("requests").insert(r).select().single());
    API.setRequestStatus = (id, status) => q(sb.from("requests").update({ status }).eq("id", id).select().single());

    API.profiles = () => q(sb.from("profiles").select(PROFILE).order("created_at"));
    API.setRole = (id, role) => q(sb.from("profiles").update({ role }).eq("id", id));
    return API;
  }

  /* ================================================================ DEMO */
  function demoApi() {
    const KEY = "ptg-demo-v1";
    const C = window.PTG;
    const API = { live: false };
    const authListeners = [], watchers = [];
    let S = load();

    function seed() {
      const at = (ymd, h, m) => { const [y, mo, d] = ymd.split("-").map(Number); return new Date(y, mo - 1, d, h, m || 0).toISOString(); };
      const days = [];
      const s0 = new Date(C.event.start + "T12:00:00");
      for (let i = 0; i < 14; i++) { const d = new Date(s0.getTime() + i * 864e5); const dow = d.getDay(); if (dow !== 0 && dow !== 6) days.push(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0")); }
      const availability = [];
      ["m1", "m2", "a1"].forEach((c, k) => days.forEach(ymd => availability.push({ id: rid(), coach_id: c, starts_at: at(ymd, 20 - k), ends_at: at(ymd, 23 - k) })));
      return {
        v: 1, me: null,
        profiles: [
          { id: "u-staff", discord_id: "1001", username: "lumi.staff", display_name: "Lumi Staff", avatar_url: "", role: "staff" },
          { id: "u-neotep", discord_id: "1002", username: "actor", display_name: "Actor", avatar_url: "", role: "player" },
          { id: "u-jeiss", discord_id: "1003", username: "jeiss", display_name: "Jeiss", avatar_url: "", role: "player" },
          { id: "u-rustska", discord_id: "1004", username: "rustska", display_name: "Rustska", avatar_url: "", role: "player" },
          { id: "u-solo", discord_id: "1005", username: "newplayer", display_name: "New Player", avatar_url: "", role: "player" }
        ],
        coaches: C.coachSeed.map(c => Object.assign({ profile_id: c.id === "m1" ? "u-neotep" : null, focus: "", main_character: "", pool: [], playstyle: "", history: [], about: "" }, c)),
        teams: [{ id: "t-neochair", name: "NeoChair", coach_id: "m1", players: [{ ign: "Rustska" }, { ign: "Jeiss" }, { ign: "Jast107" }, { ign: "Fwitchu" }], member_ids: ["u-jeiss", "u-rustska"], signup_id: "s-1", sort: 1 }],
        signups: [
          { id: "s-1", user_id: "u-rustska", kind: "team", team_name: "NeoChair", players: [{ ign: "Rustska", discord: "rustska" }, { ign: "Jeiss", discord: "jeiss" }, { ign: "Jast107", discord: "" }, { ign: "Fwitchu", discord: "" }], played_qualifier: true, t2_events: "Lumia Rumble", mentor_prefs: ["m1"], seminar_topics: "Late-game rotations", status: "accepted", created_at: new Date(2026, 10, 1).toISOString() },
          { id: "s-2", user_id: "u-solo", kind: "solo", ign: "NewPlayer", main_role: "Support · Elena, Bianca", availability: "Weeknights after 8 PM", experience: "First comp event", seminar_topics: "Vision and warding", status: "pending", players: [], mentor_prefs: [], created_at: new Date(2026, 10, 3).toISOString() }
        ],
        availability,
        requests: [
          { id: "r-1", coach_id: "m1", requester_id: "u-jeiss", kind: "team", starts_at: at(days[1], 20), ends_at: at(days[1], 21), note: "Review our mock checkpoint plan", status: "pending", created_at: new Date().toISOString() },
          { id: "r-2", coach_id: "m1", requester_id: "u-rustska", kind: "individual", starts_at: at(days[3], 21), ends_at: at(days[3], 22), note: "", status: "accepted", created_at: new Date().toISOString() }
        ]
      };
    }
    function rid() { return Math.random().toString(36).slice(2, 10); }
    function load() {
      try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) return s; } catch (e) { /* storage blocked */ }
      return seed();
    }
    function save() {
      try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage blocked */ }
      watchers.forEach(w => setTimeout(w.cb, 0));
    }
    window.addEventListener("storage", e => { if (e.key === KEY) { S = load(); watchers.forEach(w => w.cb()); } });
    const clone = x => JSON.parse(JSON.stringify(x));
    const wait = v => new Promise(r => setTimeout(() => r(clone(v)), 60));
    const fail = m => Promise.reject(new Error(m));
    const me = () => S.profiles.find(p => p.id === S.me) || null;
    const isStaff = () => !!me() && me().role === "staff";
    const isCoach = c => !!S.me && S.coaches.some(x => x.id === c && x.profile_id === S.me);
    const overlap = (a1, a2, b1, b2) => new Date(a1) < new Date(b2) && new Date(b1) < new Date(a2);
    const prof = id => S.profiles.find(p => p.id === id) || null;
    const coachMini = id => { const c = S.coaches.find(x => x.id === id); return c ? { id: c.id, kind: c.kind, slot: c.slot, name: c.name, team_name: c.team_name, badge_id: c.badge_id } : null; };

    API.demo = {
      people: () => clone(S.profiles),
      who: () => S.me,
      setMe: id => { S.me = id || null; save(); authListeners.forEach(f => setTimeout(() => f("SIGNED_IN"), 0)); },
      reset: () => { S = seed(); save(); authListeners.forEach(f => setTimeout(() => f("SIGNED_IN"), 0)); }
    };
    API.session = () => wait(me());
    API.onAuth = f => authListeners.push(f);
    API.signIn = async () => API.demo.setMe("u-jeiss");
    API.signOut = async () => API.demo.setMe(null);
    API.watch = (table, cb) => { const w = { table, cb }; watchers.push(w); return () => watchers.splice(watchers.indexOf(w), 1); };

    API.coaches = () => wait(S.coaches.slice().sort((a, b) => (a.kind === b.kind ? a.slot - b.slot : a.kind === "mentor" ? -1 : 1)));
    API.updateCoach = (id, patch) => {
      const c = S.coaches.find(x => x.id === id);
      if (!c) return fail("That coach doesn't exist.");
      if (!isStaff() && !isCoach(id)) return fail("You don't have permission to do that.");
      if (!isStaff() && ["id", "kind", "slot", "badge_id", "profile_id"].some(k => k in patch && patch[k] !== c[k])) return fail("Only staff can change coach slots or who a slot is linked to.");
      if ("profile_id" in patch && patch.profile_id && S.coaches.some(x => x.id !== id && x.profile_id === patch.profile_id)) return fail("That account is already linked to another coach slot.");
      Object.assign(c, patch); save(); return wait(c);
    };

    API.teams = () => wait(S.teams.slice().sort((a, b) => (a.sort || 0) - (b.sort || 0)));
    API.saveTeam = t => {
      if (!isStaff()) return fail("You don't have permission to do that.");
      if (!t.name || !t.name.trim()) return fail("Give the team a name.");
      let row = t.id && S.teams.find(x => x.id === t.id);
      if (!row) { row = { id: rid() }; S.teams.push(row); }
      Object.assign(row, { name: t.name, coach_id: t.coach_id || null, players: t.players || [], member_ids: t.member_ids || [], sort: t.sort || 0, signup_id: t.signup_id || null });
      save(); return wait(row);
    };
    API.deleteTeam = id => { if (!isStaff()) return fail("You don't have permission to do that."); S.teams = S.teams.filter(t => t.id !== id); save(); return wait(null); };

    API.mySignup = () => wait(S.me ? S.signups.find(s => s.user_id === S.me) || null : null);
    API.saveSignup = d => {
      if (!S.me) return fail("Log in with Discord first.");
      if (d.kind === "team" && !(d.team_name || "").trim()) return fail("Give your team a name.");
      if (d.kind === "solo" && !(d.ign || "").trim()) return fail("Add your in-game name.");
      let s = S.signups.find(x => x.user_id === S.me);
      if (s && ["accepted", "declined"].includes(s.status)) return fail("Staff have already decided this application. Message staff to change it.");
      if (!s) { s = { id: rid(), user_id: S.me, created_at: new Date().toISOString(), status: "pending" }; S.signups.push(s); }
      const status = d.status === "withdrawn" ? "withdrawn" : s.status === "withdrawn" ? "pending" : s.status;
      Object.assign(s, d, { status, updated_at: new Date().toISOString() });
      save(); return wait(s);
    };
    API.setSignupStatus = (id, status, staff_note) => {
      const s = S.signups.find(x => x.id === id);
      if (!s) return fail("That application doesn't exist.");
      const own = s.user_id === S.me && status === "withdrawn" && ["pending", "waitlist"].includes(s.status);
      if (!isStaff() && !own) return fail("Only staff can change an application's status.");
      s.status = status; if (staff_note !== undefined) s.staff_note = staff_note;
      save(); return wait(s);
    };
    API.signups = () => isStaff() ? wait(S.signups.map(s => Object.assign({}, s, { profile: prof(s.user_id) }))) : fail("You don't have permission to do that.");

    API.availability = coachId => wait(S.availability.filter(b => b.coach_id === coachId).sort((a, b) => a.starts_at.localeCompare(b.starts_at)));
    API.addBlocks = async blocks => {
      const added = [], failed = [];
      for (const b of blocks) {
        if (!isStaff() && !isCoach(b.coach_id)) { failed.push({ block: b, error: "You don't have permission to do that." }); continue; }
        if (new Date(b.ends_at) <= new Date(b.starts_at)) { failed.push({ block: b, error: "Hour out has to be after hour in." }); continue; }
        if (S.availability.some(x => x.coach_id === b.coach_id && overlap(x.starts_at, x.ends_at, b.starts_at, b.ends_at))) { failed.push({ block: b, error: "That time overlaps hours or a session that's already there." }); continue; }
        const row = Object.assign({ id: rid() }, b); S.availability.push(row); added.push(clone(row));
      }
      save(); return { added, failed };
    };
    API.deleteBlock = id => {
      const b = S.availability.find(x => x.id === id);
      if (!b) return wait(null);
      if (!isStaff() && !isCoach(b.coach_id)) return fail("You don't have permission to do that.");
      if (S.requests.some(r => r.coach_id === b.coach_id && r.status === "accepted" && new Date(r.starts_at) >= new Date(b.starts_at) && new Date(r.ends_at) <= new Date(b.ends_at))) return fail("These hours have booked sessions. Cancel those sessions first.");
      S.availability = S.availability.filter(x => x.id !== id); save(); return wait(null);
    };
    API.busy = coachId => wait(S.requests.filter(r => r.coach_id === coachId && ["pending", "accepted"].includes(r.status)).map(r => ({ starts_at: r.starts_at, ends_at: r.ends_at, status: r.status })));

    API.myRequests = () => wait(S.me ? S.requests.filter(r => r.requester_id === S.me).map(r => Object.assign({}, r, { coach: coachMini(r.coach_id) })).sort((a, b) => a.starts_at.localeCompare(b.starts_at)) : []);
    API.coachRequests = coachId => (isStaff() || isCoach(coachId)) ? wait(S.requests.filter(r => r.coach_id === coachId).map(r => Object.assign({}, r, { requester: prof(r.requester_id) })).sort((a, b) => a.starts_at.localeCompare(b.starts_at))) : wait([]);
    API.allRequests = () => isStaff() ? wait(S.requests.map(r => Object.assign({}, r, { requester: prof(r.requester_id), coach: coachMini(r.coach_id) })).sort((a, b) => a.starts_at.localeCompare(b.starts_at))) : fail("You don't have permission to do that.");
    API.requestSession = r => {
      if (!S.me) return fail("Log in with Discord first.");
      const c = S.coaches.find(x => x.id === r.coach_id);
      if (!c) return fail("That coach doesn't exist.");
      if (c.kind === "assistant" && r.kind !== "individual") return fail("Assistant coaches take individual sessions only.");
      const mins = (new Date(r.ends_at) - new Date(r.starts_at)) / 6e4;
      if (mins < 30 || mins > 120) return fail("Sessions run from 30 minutes to 2 hours.");
      if (new Date(r.starts_at) < new Date()) return fail("That time has already passed.");
      if (!S.availability.some(b => b.coach_id === r.coach_id && new Date(b.starts_at) <= new Date(r.starts_at) && new Date(b.ends_at) >= new Date(r.ends_at))) return fail("That time is outside the hours this coach posted.");
      if (S.requests.some(x => x.coach_id === r.coach_id && x.status === "accepted" && overlap(x.starts_at, x.ends_at, r.starts_at, r.ends_at))) return fail("That time is already booked.");
      if (S.requests.filter(x => x.requester_id === S.me && x.status === "pending").length >= 5) return fail("You already have 5 requests waiting. Cancel one or wait for answers.");
      const row = { id: rid(), coach_id: r.coach_id, requester_id: S.me, kind: r.kind, starts_at: r.starts_at, ends_at: r.ends_at, note: (r.note || "").slice(0, 500), status: "pending", created_at: new Date().toISOString() };
      S.requests.push(row); save(); return wait(row);
    };
    API.setRequestStatus = (id, status) => {
      const r = S.requests.find(x => x.id === id);
      if (!r) return fail("That request doesn't exist.");
      const ok = isStaff()
        || (isCoach(r.coach_id) && r.status === "pending" && ["accepted", "declined"].includes(status))
        || (isCoach(r.coach_id) && r.status === "accepted" && status === "cancelled")
        || (r.requester_id === S.me && ["pending", "accepted"].includes(r.status) && status === "cancelled");
      if (!ok) return fail("You can't change this request.");
      if (status === "accepted" && S.requests.some(x => x.id !== id && x.coach_id === r.coach_id && x.status === "accepted" && overlap(x.starts_at, x.ends_at, r.starts_at, r.ends_at))) return fail("That time overlaps hours or a session that's already there.");
      r.status = status; r.decided_at = new Date().toISOString();
      if (status === "accepted") S.requests.forEach(x => { if (x.id !== id && x.coach_id === r.coach_id && x.status === "pending" && overlap(x.starts_at, x.ends_at, r.starts_at, r.ends_at)) { x.status = "declined"; x.decided_at = r.decided_at; } });
      save(); return wait(r);
    };

    API.profiles = () => S.me ? wait(S.profiles) : wait([]);
    API.setRole = (id, role) => {
      if (!isStaff()) return fail("You don't have permission to do that.");
      const p = prof(id); if (p) p.role = role; save(); return wait(null);
    };
    return API;
  }
})();
