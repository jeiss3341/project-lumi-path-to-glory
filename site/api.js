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

    // a mentor file comes from the database where staff have filled it in, and from content.js everywhere else
    const withSeed = rows => rows.map(r => {
      const seed = (window.PTG.coachSeed || []).find(c => c.id === r.id) || {}, out = Object.assign({}, seed, r);
      for (const k in seed) if (r[k] === "" || r[k] == null || (Array.isArray(r[k]) && !r[k].length)) out[k] = seed[k];
      return out;
    });
    API.coaches = () => q(sb.from("coaches").select("*").order("kind", { ascending: false }).order("slot")).then(withSeed);
    API.updateCoach = (id, patch) => q(sb.from("coaches").update(patch).eq("id", id).select().single());
    // a new file every time, so a card picture is never overwritten
    API.uploadArt = async (id, file) => {
      const ext = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }[file.type], path = id + "/" + Date.now() + "." + ext;
      const { error } = await sb.storage.from("card-art").upload(path, file, { contentType: file.type });
      if (error) throw new Error(error.message);
      return sb.storage.from("card-art").getPublicUrl(path).data.publicUrl;
    };

    API.teams = () => q(sb.from("teams").select("*").order("sort").order("created_at"));
    // teams are read only from the site: the organiser sets them (supabase/schema.sql)

    API.availability = coachId => q(sb.from("availability").select("*").eq("coach_id", coachId).order("starts_at"));
    API.allAvailability = () => q(sb.from("availability").select("*").order("starts_at"));
    API.addBlocks = async blocks => {
      const added = [], failed = [];
      for (const b of blocks) {
        try { added.push(await q(sb.from("availability").insert(b).select().single())); }
        catch (e) { failed.push({ block: b, error: e.message }); }
      }
      return { added, failed };
    };
    API.deleteBlock = id => q(sb.from("availability").delete().eq("id", id));
    API.saveHours = (c, b, s, e) => q(sb.rpc("save_hours", { c, b: b || null, s, e }));   // post or change hours; overlaps join (see schema.sql)
    API.removeHours = (c, s, e) => q(sb.rpc("remove_hours", { c, s, e }));                 // take a stretch out of a coach's hours (blocks split around it)
    API.busy = coachId => q(sb.rpc("coach_busy", { c: coachId }));

    API.myRequests = async () => {
      const me = await API.session();
      if (!me) return [];
      // your own requests, plus team reviews your mentor wrote down (the database only returns your team's)
      return q(sb.from("requests").select("*, coach:coaches(" + COACH_MINI + ")").or("requester_id.eq." + me.id + ",and(by_coach.is.true,kind.eq.team)").order("starts_at"));
    };
    API.coachRequests = coachId => q(sb.from("requests").select("*, requester:profiles(" + PROFILE + ")").eq("coach_id", coachId).order("starts_at"));
    API.allRequests = () => q(sb.from("requests").select("*, requester:profiles(" + PROFILE + "), coach:coaches(" + COACH_MINI + ")").order("starts_at"));
    API.requestSession = r => q(sb.from("requests").insert(r).select().single());
    API.saveSessionSettings = (c, mn, mx, k) => q(sb.rpc("save_session_settings", { c, mn, mx, k }));
    API.setRequestStatus = (id, status) => q(sb.from("requests").update({ status }).eq("id", id).select().single());
    // a mentor writes down a session set up with their own team: booked straight away (see schema.sql)
    API.writeSession = r => q(sb.rpc("write_session", { c: r.coach_id, p: r.kind === "team" ? null : r.requester_id, k: r.kind, s: r.starts_at, e: r.ends_at, n: r.note || "" }));

    API.profiles = () => q(sb.from("profiles").select(PROFILE).order("created_at"));
    API.setRole = (id, role) => q(sb.from("profiles").update({ role }).eq("id", id));

    // visit counting (track.js): sent straight to the table with keepalive, so it still arrives as the page closes
    API.track = rows => {
      try {
        fetch(cfg.supabaseUrl + "/rest/v1/site_events", { method: "POST", keepalive: true,
          headers: { apikey: cfg.supabaseAnonKey, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify(rows) }).catch(() => {});
      } catch (e) { /* never get in the visitor's way */ }
    };
    API.sponsorStats = () => q(sb.rpc("sponsor_stats"));   // staff only (schema.sql)
    return API;
  }

  /* ================================================================ DEMO */
  function demoApi() {
    const KEY = "ptg-demo-v33";   // bump when the sample data changes, so browsers drop their old copy
    const C = window.PTG;
    const API = { live: false };
    const authListeners = [], watchers = [];
    let S = load();

    function seed() {
      // A full mock event for testing: 8 teams, hours for every coach but one, and requests in every state.
      // Times are Eastern (the event is after daylight saving ends on Nov 1, so Eastern = UTC−5). Hours can be
      // fractional (20.5 = 8:30 PM) or past 24 (25 = 1 AM the next morning, still the same event day).
      const at = (ymd, h) => { const [y, mo, d] = ymd.split("-").map(Number); return new Date(Date.UTC(y, mo - 1, d, 5, Math.round(h * 60))).toISOString(); };
      const D = [];   // the 14 event days: D[0] Mon Nov 9 … D[6] Sun Nov 15 (Mock) … D[13] Sun Nov 22 (Final)
      const s0 = new Date(C.event.start + "T12:00:00Z");
      for (let i = 0; i < 14; i++) D.push(new Date(s0.getTime() + i * 864e5).toISOString().slice(0, 10));
      const WEEKDAYS = [0, 1, 2, 3, 4, 7, 8, 9, 10, 11], NOT_SUN = [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12], EVERY = [...Array(14).keys()];

      // ---- coach hours ----
      const availability = [];
      const hours = (coach, days, h1, h2) => days.forEach(i => availability.push({ id: rid(), coach_id: coach, starts_at: at(D[i], h1), ends_at: at(D[i], h2) }));
      hours("m1", WEEKDAYS, 20, 23); hours("m1", [5, 12], 14, 17);      // Actor: weeknights 8–11 PM, Saturday afternoons
      hours("m2", WEEKDAYS, 19, 22); hours("m2", [5], 13, 16);          // Dylan: weeknights 7–10 PM
      hours("m3", [0, 2, 4, 7, 9, 11], 21, 25);                         // Fwitchu: Mon / Wed / Fri, 9 PM–1 AM
      hours("m4", [1, 3, 5, 8, 10, 12], 18, 22);                        // Tue / Thu / Sat evenings
      hours("m5", NOT_SUN, 10, 12); hours("m5", NOT_SUN, 19, 21);       // two blocks a day
      hours("m6", [5, 6, 12, 13], 12, 18); hours("m6", [2, 9], 20, 22); // weekends + Wednesday nights
      hours("m7", [0, 1, 2, 3, 7, 8, 9, 10], 22, 26);                   // Mon–Thu, 10 PM–2 AM
      hours("m8", [7, 8, 9, 10, 11], 19, 23);                           // week 2 only
      hours("a1", WEEKDAYS, 18, 21);                                    // Baeksu
      hours("a2", [1, 3, 8, 10], 13, 17);                               // Jalja: Tue / Thu afternoons
      hours("a3", [5, 6, 12, 13], 12, 16);                              // CamperonDuty: weekends
      hours("a4", [0, 2, 7, 9], 20, 24); hours("a4", [4, 11], 15, 18);  // Squortle
      hours("a5", EVERY, 9, 11);                                        // Jignut: mornings
      hours("a6", [3, 4, 5], 21, 27);                                   // Kyroshoot: week 1 only, 9 PM–3 AM
      hours("a7", [2, 9], 10, 12); hours("a7", [2, 9], 15, 17); hours("a7", [2, 9], 21, 23); hours("a7", [5], 11, 13);   // Superior: split days
      hours("a9", [1, 3, 8, 10], 21, 24);                               // Chibiarc
      // a8 (Nesious) has no hours: tests "Hide coaches with no hours"

      // ---- accounts (one Discord login each) ----
      const P = (id, username, display_name, role) => ({ id, discord_id: String(1000 + profiles.length + 1), username, display_name, avatar_url: "", role: role || "player" });
      const profiles = [];
      [["u-staff", "lumi.staff", "Lumi Staff", "staff"],
       ["u-neotep", "actor", "Actor"], ["u-dylan", "dylannn", "Dylan"], ["u-fwitchu", "fwitchu", "Fwitchu"], ["u-chibi", "chibiarc", "Chibiarc"],
       ["u-m4", "hresvelg", "Hresvelg"], ["u-m5", "isterio", "Isterio"], ["u-m6", "kazcross", "Kazcross"],
       ["u-m7", "magepower", "Magepower"], ["u-m8", "ioo", "Ioo"],
       ["u-baeksu", "baeksu", "Baeksu"], ["u-jalja", "jalja", "Jalja"], ["u-camper", "camperonduty", "CamperonDuty"], ["u-squortle", "squortle", "Squortle"],
       ["u-jignut", "jignut", "Jignut"], ["u-kyro", "kyroshoot", "Kyroshoot"], ["u-superior", "superior", "Superior"],
       ["u-jeiss", "jeiss", "Jeiss"], ["u-irem", "irem-chan", "Irem-chan"], ["u-lumi", "lumi-chan", "Lumi-chan"],
       ["u-mochi", "mochi.er", "Mochi"], ["u-kairo", "kairo", "Kairo"], ["u-tofu", "tofu", "Tofu"],
       ["u-pixelle", "pixelle", "Pixelle"], ["u-juno", "juno", "Juno"],
       ["u-bunbun", "bunbun", "Bunbun"], ["u-saber", "saber", "Saber"],
       ["u-noodle", "noodle", "Noodle"], ["u-matcha", "matcha", "Matcha"], ["u-boba", "boba", "Boba"],
       ["u-zephyr", "zephyr", "Zephyr"], ["u-gale", "gale", "Gale"],
       ["u-rook", "rook", "Rook"], ["u-ember", "ember", "Ember"],
       ["u-solo", "newplayer", "New Player"]].forEach(a => profiles.push(P(...a)));
      const LINK = { m1: "u-neotep", m2: "u-dylan", m3: "u-fwitchu", m4: "u-m4", m5: "u-m5", m6: "u-m6", m7: "u-m7", m8: "u-m8",
        a1: "u-baeksu", a2: "u-jalja", a3: "u-camper", a4: "u-squortle", a5: "u-jignut", a6: "u-kyro", a7: "u-superior", a9: "u-chibi" };   // a8 stays unlinked

      // ---- teams (results: placements, shown on the site once that checkpoint's day has passed) ----
      const teams = [];
      const team = (id, name, coach_id, players, member_ids, info, mock, final) =>
        teams.push({ id, name, coach_id, players: players.map(([ign, discord]) => ({ ign, discord })), member_ids, sort: teams.length + 1, info, results: { mock, final } });
      // the 8 real teams (Path to Glory sheet); mentors get assigned later, so coach_id is null and the roster shows "To be assigned"
      team("t-funhavers", "Funhavers", null, [["Khaosfire", ""], ["AkaShado", ""], ["BILL123", ""], ["Yiunne", ""]], [], {});
      team("t-200adr", "200adr", null, [["Reioli", ""], ["Rightnwise", ""], ["GeorgeGargett", ""], ["Yuituri", ""]], [], {});
      team("t-labubu", "Labubu Manifesto", null, [["Asterlac", ""], ["Magecraft", ""], ["Lolking", ""], ["Neen", ""]], [], {});
      team("t-ojama", "Ojama Trio", null, [["Chabs", ""], ["April", ""], ["Matthew1rox", ""], ["DestelloJoker", ""]], [], {});
      team("t-pengu", "Pengu Industries", null, [["jeiss", ""], ["VioletSkyfire", ""], ["Marreep", ""], ["Vinnyt", ""]], ["u-jeiss"], {});
      team("t-sleeping", "Sleeping Forest", null, [["Ravenbergier", ""], ["Tides", ""], ["Speex", ""], ["Redflake", ""]], [], {});
      team("t-mango", "Mango Cats", null, [["Ardentq", ""], ["Keeperbeast", ""], ["Given", ""], ["Ariaza", ""]], [], {});
      team("t-sleepdeprived", "sleepdeprived", null, [["sleepun", ""], ["Maskedsamura1", ""], ["Ignis", ""], ["Silverace13", ""]], [], {});

      // ---- session requests ----
      const requests = [];
      const req = (coach_id, requester_id, kind, day, h1, h2, status, note) => {
        const starts_at = at(D[day], h1), sent = new Date(new Date(starts_at).getTime() - (1 + requests.length % 3) * 864e5 - 3 * 36e5);
        requests.push({ id: "r-" + (requests.length + 1), coach_id, requester_id, kind, starts_at, ends_at: at(D[day], h2), note: note || "", status,
          created_at: sent.toISOString(), decided_at: status === "pending" ? null : new Date(sent.getTime() + 5 * 36e5).toISOString() });
      };
      // mentors (team reviews and individual sessions)
      req("m1", "u-lumi", "team", 0, 20, 21.5, "accepted", "First team meeting: roles and comps");
      req("m1", "u-jeiss", "team", 1, 20, 21, "pending", "Review our mock checkpoint plan");
      req("m1", "u-solo", "individual", 1, 20.5, 21.5, "pending", "Where do I start?");   // overlaps the one above
      req("m1", "u-mochi", "individual", 2, 21.5, 22.5, "pending", "Second opinion on my Abigail");
      req("m1", "u-irem", "individual", 3, 21, 22, "accepted");
      req("m1", "u-jeiss", "team", 5, 14, 16, "accepted", "Scrim block VOD review");
      req("m1", "u-irem", "team", 7, 20, 21, "accepted", "Mock checkpoint debrief");
      req("m1", "u-lumi", "individual", 8, 22, 23, "pending", "Macro rotations");
      req("m1", "u-neotep", "team", 8, 20, 21, "accepted", "Draft practice, planned on Discord"); requests[requests.length - 1].by_coach = true;   // written by the mentor
      req("m1", "u-jeiss", "individual", 9, 20, 20.5, "declined", "Quick question on item builds");
      req("m1", "u-irem", "team", 11, 20, 22, "pending", "Final prep: drafts");
      req("m1", "u-lumi", "team", 12, 15, 16, "cancelled");
      req("m2", "u-mochi", "team", 0, 19, 20.5, "accepted", "Kickoff: who plays what");
      req("m2", "u-kairo", "individual", 1, 20, 21, "accepted", "Darko matchups");
      req("m2", "u-tofu", "team", 3, 19, 20, "pending", "Draft priorities for the mock checkpoint");
      req("m2", "u-lumi", "individual", 4, 21, 22, "pending", "Fighter laning");
      req("m2", "u-mochi", "team", 5, 13, 15, "accepted", "Scrim VOD review");
      req("m2", "u-kairo", "team", 7, 19, 20, "accepted", "Mock debrief");
      req("m2", "u-tofu", "individual", 9, 20, 21, "declined");
      req("m2", "u-mochi", "team", 10, 19, 21, "pending", "Final checkpoint plan");
      req("m3", "u-pixelle", "team", 0, 21, 22.5, "accepted", "Team intro and comp ideas");
      req("m3", "u-jeiss", "individual", 0, 23, 24, "declined", "Laning into Bianca");
      req("m3", "u-juno", "individual", 2, 22, 23, "accepted", "Melee spacing");
      req("m3", "u-pixelle", "team", 4, 23, 24.5, "pending", "Late-night scrim review");
      req("m3", "u-juno", "team", 7, 21, 22, "accepted", "Mock debrief");
      req("m3", "u-saber", "individual", 9, 22.5, 23.5, "pending", "Hyunwoo combos");
      req("m3", "u-pixelle", "team", 11, 21, 23, "pending", "Final prep");
      req("m4", "u-bunbun", "team", 1, 18, 19.5, "accepted", "Kickoff");
      req("m4", "u-saber", "team", 3, 19, 20, "pending", "Rotations after the first wildlife spawn");
      req("m4", "u-bunbun", "team", 8, 18, 19, "accepted", "Mock debrief");
      req("m4", "u-noodle", "individual", 10, 20, 21, "pending");
      req("m4", "u-saber", "team", 12, 18, 20, "cancelled", "Final checkpoint scrim review");
      req("m5", "u-noodle", "team", 0, 19, 20, "accepted", "Kickoff");
      req("m5", "u-matcha", "individual", 1, 10, 11, "accepted", "Support positioning");
      req("m5", "u-boba", "team", 4, 19, 21, "pending", "Scrim VOD review");
      req("m5", "u-matcha", "team", 8, 19, 20, "accepted", "Mock debrief");
      req("m5", "u-boba", "individual", 9, 10.5, 11.5, "declined");
      req("m5", "u-noodle", "team", 11, 19, 20.5, "pending", "Final plan");
      req("m6", "u-zephyr", "team", 2, 20, 21.5, "accepted", "Kickoff");
      req("m6", "u-gale", "individual", 5, 13, 14, "pending", "Ranged kiting");
      req("m6", "u-zephyr", "team", 9, 20, 22, "pending", "Mock debrief");
      req("m6", "u-gale", "team", 12, 14, 15, "accepted", "Final checkpoint scrim review");
      req("m7", "u-rook", "team", 0, 22, 23.5, "accepted", "Kickoff");
      req("m7", "u-ember", "individual", 1, 23, 24, "accepted", "Late-game fights");
      req("m7", "u-rook", "team", 3, 22.5, 23.5, "pending");
      req("m7", "u-ember", "team", 8, 22, 24, "pending", "Mock debrief");
      req("m7", "u-rook", "individual", 10, 24, 25, "declined");
      req("m8", "u-solo", "individual", 8, 19, 20, "pending", "Where do I start?");
      req("m8", "u-kairo", "individual", 10, 21, 22, "pending", "Second opinion before finals");
      // assistant coaches (team reviews and individual sessions, like mentors)
      req("a1", "u-tofu", "individual", 1, 18, 19, "accepted", "Abigail builds");
      req("a1", "u-juno", "individual", 2, 19, 20, "accepted");
      req("a1", "u-solo", "individual", 4, 18, 19, "pending", "Vision and warding basics");
      req("a1", "u-boba", "individual", 7, 18.5, 19.5, "pending");
      req("a1", "u-ember", "individual", 9, 20, 21, "cancelled");
      req("a2", "u-irem", "individual", 1, 14, 15, "cancelled", "Kiting practice");
      req("a2", "u-gale", "individual", 3, 13, 14, "accepted", "Kiting practice");
      req("a2", "u-matcha", "individual", 8, 15, 16.5, "pending");
      req("a3", "u-solo", "individual", 5, 13, 14, "accepted");
      req("a3", "u-zephyr", "individual", 6, 12, 13, "accepted", "Warm-up before the mock");
      req("a3", "u-saber", "individual", 12, 14, 15, "pending");
      req("a4", "u-kairo", "individual", 0, 21, 22, "accepted");
      req("a4", "u-pixelle", "individual", 4, 15, 16, "pending");
      req("a4", "u-lumi", "individual", 9, 22, 23, "pending");
      req("a5", "u-noodle", "individual", 1, 9, 10, "accepted", "Morning ranked review");
      req("a5", "u-rook", "individual", 3, 9.5, 10.5, "pending");
      req("a5", "u-jeiss", "individual", 10, 9, 10, "pending");
      req("a6", "u-bunbun", "individual", 3, 23, 24, "accepted");
      req("a6", "u-mochi", "individual", 5, 24, 25.5, "pending");
      req("a7", "u-juno", "individual", 2, 15, 16, "accepted");
      req("a7", "u-tofu", "individual", 9, 21, 22, "pending");

      return {
        v: 5, me: null, profiles,
        coaches: C.coachSeed.map(c => Object.assign({ profile_id: LINK[c.id] || null, focus: "", main_character: "", pool: [], playstyle: "", history: [], about: "" }, c)),
        teams, availability, requests
      };
    }
    function rid() { return Math.random().toString(36).slice(2, 10); }
    function load() {
      try { Object.keys(localStorage).filter(k => /^ptg-demo-v\d+$/.test(k) && k !== KEY).forEach(k => localStorage.removeItem(k)); } catch (e) { /* storage blocked */ }   // old sample data, so it doesn't fill the browser's storage
      try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 5) return s; } catch (e) { /* storage blocked */ }
      return seed();
    }
    function save() {
      try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { if (e.name === "QuotaExceededError" && window.UI) UI.toast("Demo storage is full, so your latest change won't stay after a refresh. Reset data clears it.", "bad"); }
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
    const now = () => new Date(window.UI ? UI.now() : Date.now());
    // a request that holds its time in a coach's hours: a booked session, or a waiting request that can still be
    // answered. Hours with one in them can't be removed or moved until it's declined or cancelled.
    const holds = r => r.status === "accepted" || (r.status === "pending" && new Date(r.starts_at) > now());
    const prof = id => S.profiles.find(p => p.id === id) || null;
    const coachMini = id => { const c = S.coaches.find(x => x.id === id); return c ? { id: c.id, kind: c.kind, slot: c.slot, name: c.name, team_name: c.team_name, badge_id: c.badge_id } : null; };

    API.demo = {
      // accounts for the "View as" menu, with the coach slot or team each one belongs to
      people: () => S.profiles.map(p => {
        const c = S.coaches.find(x => x.profile_id === p.id), t = S.teams.find(x => (x.member_ids || []).includes(p.id));
        return Object.assign(clone(p), { coach: c ? { kind: c.kind, slot: c.slot } : null, team: t ? t.name : "" });
      }),
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
    // same rules as the database's save_session_settings
    API.saveSessionSettings = (id, mn, mx, k) => {
      const c = S.coaches.find(x => x.id === id);
      if (!c) return fail("That coach doesn't exist.");
      if (!isStaff() && !isCoach(id)) return fail("You don't have permission to do that.");
      if (![30, 60, 90, 120].includes(mn) || ![30, 60, 90, 120].includes(mx) || mn > mx || !["both", "team", "individual"].includes(k)) return fail("Those settings don't work together.");
      Object.assign(c, { min_minutes: mn, max_minutes: mx, session_kinds: k }); save(); return wait(c);
    };
    API.updateCoach = (id, patch) => {
      const c = S.coaches.find(x => x.id === id);
      if (!c) return fail("That coach doesn't exist.");
      if (!isStaff()) return fail("Only staff can edit coach slots and mentor files.");   // same rule as the database
      if ("profile_id" in patch && patch.profile_id && S.coaches.some(x => x.id !== id && x.profile_id === patch.profile_id)) return fail("That account is already linked to another coach slot.");
      Object.assign(c, patch); save(); return wait(c);
    };
    // demo mode keeps pictures in this browser, which has little room, so it stores a smaller copy (the real site keeps the full file)
    API.uploadArt = async (id, file) => {
      if (!isStaff()) return fail("Only staff can change card art.");
      let picture;
      try { picture = await createImageBitmap(file); } catch (e) { return fail("Couldn't read that image. Try a different file."); }
      let out = "";
      for (const longest of [1000, 800, 600]) {
        const k = Math.min(1, longest / Math.max(picture.width, picture.height)), c = document.createElement("canvas");
        c.width = Math.round(picture.width * k);
        c.height = Math.round(picture.height * k);
        c.getContext("2d").drawImage(picture, 0, 0, c.width, c.height);
        out = c.toDataURL("image/webp", 0.85);
        if (out.length < 400000) break;
      }
      return out;
    };

    // sample placements show up once that checkpoint's day has passed (preview with ?today=2026-11-16 or 2026-11-23)
    const placed = t => {
      const today = window.UI ? UI.todayYmd() : "", day = k => (C.schedule.find(e => e.kind === k) || {}).date || "9999";
      const out = Object.assign({}, t, { mock_place: null, final_place: null }), r = t.results || {};
      if (today > day("mock")) out.mock_place = r.mock || null;
      if (today > day("final")) out.final_place = r.final || null;
      delete out.results; return out;
    };
    API.teams = () => wait(S.teams.slice().sort((a, b) => (a.sort || 0) - (b.sort || 0)).map(placed));

    API.availability = coachId => wait(S.availability.filter(b => b.coach_id === coachId).sort((a, b) => a.starts_at.localeCompare(b.starts_at)));
    API.allAvailability = () => wait(S.availability.slice().sort((a, b) => a.starts_at.localeCompare(b.starts_at)));
    API.addBlocks = async blocks => {
      const added = [], failed = [];
      for (const b of blocks) {
        if (!isStaff() && !isCoach(b.coach_id)) { failed.push({ block: b, error: "You don't have permission to do that." }); continue; }
        if (new Date(b.ends_at) <= new Date(b.starts_at)) { failed.push({ block: b, error: "Hour out has to be after hour in." }); continue; }
        // same rule as the database: inside one event day, 8 AM to 4 AM Eastern
        const UI = window.UI, day = UI && UI.dayOf(b.starts_at);
        if (day && (new Date(b.starts_at) < UI.etAt(day, UI.DAY_START) || new Date(b.ends_at) > UI.etAt(day, UI.DAY_END))) { failed.push({ block: b, error: "Hours have to be between 8 AM and 4 AM Eastern." }); continue; }
        if (S.availability.some(x => x.coach_id === b.coach_id && overlap(x.starts_at, x.ends_at, b.starts_at, b.ends_at))) { failed.push({ block: b, error: "That time overlaps hours or a session that's already there." }); continue; }
        const row = Object.assign({ id: rid() }, b); S.availability.push(row); added.push(clone(row));
      }
      save(); return { added, failed };
    };
    API.deleteBlock = id => {
      const b = S.availability.find(x => x.id === id);
      if (!b) return wait(null);
      if (!isStaff() && !isCoach(b.coach_id)) return fail("You don't have permission to do that.");
      if (S.requests.some(r => r.coach_id === b.coach_id && holds(r) && new Date(r.starts_at) >= new Date(b.starts_at) && new Date(r.ends_at) <= new Date(b.ends_at))) return fail("These hours have a session or a waiting request in them. Decline or cancel it first.");
      S.availability = S.availability.filter(x => x.id !== id); save(); return wait(null);
    };
    // same rules as the database's save_hours: post (blockId = null) or change a block; overlapping or
    // touching hours join into one block, and booked sessions and waiting requests have to stay inside
    API.saveHours = (coachId, blockId, starts_at, ends_at) => {
      if (!isStaff() && !isCoach(coachId)) return fail("You don't have permission to do that.");
      let s = new Date(starts_at), e = new Date(ends_at);
      if (e <= s) return fail("Hour out has to be after hour in.");
      const UI = window.UI, day = UI && UI.dayOf(starts_at);
      if (day && (s < UI.etAt(day, UI.DAY_START) || e > UI.etAt(day, UI.DAY_END))) return fail("Hours have to be between 8 AM and 4 AM Eastern.");
      const mine = S.availability.filter(x => x.coach_id === coachId);
      const old = blockId ? mine.find(x => x.id === blockId) : null;
      if (blockId && !old) return fail("Those hours don't exist anymore.");
      const joined = [];
      for (let grew = true; grew;) {
        grew = false;
        mine.forEach(x => {
          if (x === old || joined.includes(x)) return;
          const xs = new Date(x.starts_at), xe = new Date(x.ends_at);
          if (xs <= e && s <= xe) { joined.push(x); if (xs < s) s = xs; if (xe > e) e = xe; grew = true; }
        });
      }
      const gone = (old ? [old] : []).concat(joined);
      const inside = (r, a, b) => new Date(r.starts_at) >= a && new Date(r.ends_at) <= b;
      if (S.requests.some(r => r.coach_id === coachId && holds(r) && !inside(r, s, e) && gone.some(x => inside(r, new Date(x.starts_at), new Date(x.ends_at)))))
        return fail("A session or waiting request would be outside the new hours. Decline or cancel it first, or keep it inside.");
      S.availability = S.availability.filter(x => !gone.includes(x));
      const row = { id: rid(), coach_id: coachId, starts_at: s.toISOString(), ends_at: e.toISOString() };
      S.availability.push(row); save();
      return wait(Object.assign({ joined: joined.length }, row));
    };
    // same rules as the database's remove_hours: take a stretch of time out of a coach's hours, splitting blocks
    // around it; not while a booked session or a waiting request is in it
    API.removeHours = (coachId, starts_at, ends_at) => {
      if (!isStaff() && !isCoach(coachId)) return fail("You don't have permission to do that.");
      const s = new Date(starts_at), e = new Date(ends_at);
      if (e <= s) return fail("Hour out has to be after hour in.");
      if (S.requests.some(r => r.coach_id === coachId && holds(r) && new Date(r.starts_at) < e && new Date(r.ends_at) > s)) return fail("A session or waiting request is in those hours. Decline or cancel it first.");
      const hit = S.availability.filter(x => x.coach_id === coachId && new Date(x.starts_at) < e && new Date(x.ends_at) > s);
      S.availability = S.availability.filter(x => !hit.includes(x));
      hit.forEach(x => {
        if (new Date(x.starts_at) < s) S.availability.push({ id: rid(), coach_id: coachId, starts_at: x.starts_at, ends_at: s.toISOString() });
        if (new Date(x.ends_at) > e) S.availability.push({ id: rid(), coach_id: coachId, starts_at: e.toISOString(), ends_at: x.ends_at });
      });
      save(); return wait(null);
    };
    API.busy = coachId => wait(S.requests.filter(r => r.coach_id === coachId && ["pending", "accepted"].includes(r.status)).map(r => ({ starts_at: r.starts_at, ends_at: r.ends_at, status: r.status })));

    // your own requests, plus team reviews your mentor wrote down for your team
    const teamReview = r => r.by_coach && r.kind === "team" && S.teams.some(t => t.coach_id === r.coach_id && (t.member_ids || []).includes(S.me));
    API.myRequests = () => wait(S.me ? S.requests.filter(r => r.requester_id === S.me || teamReview(r)).map(r => Object.assign({}, r, { coach: coachMini(r.coach_id) })).sort((a, b) => a.starts_at.localeCompare(b.starts_at)) : []);
    API.coachRequests = coachId => (isStaff() || isCoach(coachId)) ? wait(S.requests.filter(r => r.coach_id === coachId).map(r => Object.assign({}, r, { requester: prof(r.requester_id) })).sort((a, b) => a.starts_at.localeCompare(b.starts_at))) : wait([]);
    API.allRequests = () => isStaff() ? wait(S.requests.map(r => Object.assign({}, r, { requester: prof(r.requester_id), coach: coachMini(r.coach_id) })).sort((a, b) => a.starts_at.localeCompare(b.starts_at))) : fail("You don't have permission to do that.");
    API.requestSession = r => {
      if (!S.me) return fail("Log in with Discord first.");
      const c = S.coaches.find(x => x.id === r.coach_id);
      if (!c) return fail("That coach doesn't exist.");
      // only players request: coaches and staff can't, unless they're on a team (same rule as the database)
      const onTeam = S.teams.some(t => (t.member_ids || []).includes(S.me));
      if (!onTeam && (isStaff() || S.coaches.some(x => x.profile_id === S.me))) return fail("Only players can request sessions.");
      const mins = (new Date(r.ends_at) - new Date(r.starts_at)) / 6e4;
      if (mins < 30 || mins > 120) return fail("Sessions run from 30 minutes to 2 hours.");
      if (mins < (c.min_minutes || 30) || mins > (c.max_minutes || 120)) return fail("That length is outside what this coach takes.");
      if ((c.session_kinds || "both") !== "both" && c.session_kinds !== r.kind) return fail("This coach doesn't take that kind of session.");
      if (new Date(r.starts_at) < new Date(window.UI ? UI.now() : Date.now())) return fail("That time has already passed.");
      if (!S.availability.some(b => b.coach_id === r.coach_id && new Date(b.starts_at) <= new Date(r.starts_at) && new Date(b.ends_at) >= new Date(r.ends_at))) return fail("That time is outside the hours this coach posted.");
      if (S.requests.some(x => x.coach_id === r.coach_id && x.status === "accepted" && overlap(x.starts_at, x.ends_at, r.starts_at, r.ends_at))) return fail("That time is already booked.");
      if (S.requests.filter(x => x.requester_id === S.me && x.status === "pending").length >= 5) return fail("You already have 5 requests waiting. Cancel one or wait for answers.");
      const row = { id: rid(), coach_id: r.coach_id, requester_id: S.me, kind: r.kind, starts_at: r.starts_at, ends_at: r.ends_at, note: (r.note || "").slice(0, 500), status: "pending", created_at: new Date(window.UI ? UI.now() : Date.now()).toISOString() };
      S.requests.push(row); save(); return wait(row);
    };
    // same rules as the database's write_session: a mentor writes down a session set up with their own team (a team
    // review, for the whole team) or one of its players (individual). It's booked straight away, inside their hours;
    // waiting requests at that time are declined, as when accepting.
    API.writeSession = r => {
      const c = S.coaches.find(x => x.id === r.coach_id);
      if (!c) return fail("That coach doesn't exist.");
      if (!isStaff() && !isCoach(c.id)) return fail("You don't have permission to do that.");
      const team = S.teams.find(t => t.coach_id === c.id);
      if (!team) return fail("Only mentors with a team can write sessions.");
      if (!["team", "individual"].includes(r.kind)) return fail("Pick team review or individual.");
      if (r.kind === "individual" && !(team.member_ids || []).includes(r.requester_id)) return fail("You can only write sessions for players on your own team.");
      const mins = (new Date(r.ends_at) - new Date(r.starts_at)) / 6e4;
      if (mins < 30 || mins > 240) return fail("Written sessions run from 30 minutes to 4 hours.");
      if (new Date(r.starts_at) < now()) return fail("That time has already passed.");
      if (!S.availability.some(b => b.coach_id === c.id && new Date(b.starts_at) <= new Date(r.starts_at) && new Date(b.ends_at) >= new Date(r.ends_at))) return fail("That time is outside your posted hours.");
      if (S.requests.some(x => x.coach_id === c.id && x.status === "accepted" && overlap(x.starts_at, x.ends_at, r.starts_at, r.ends_at))) return fail("That time is already booked.");
      const when = now().toISOString();
      S.requests.forEach(x => { if (x.coach_id === c.id && x.status === "pending" && overlap(x.starts_at, x.ends_at, r.starts_at, r.ends_at)) { x.status = "declined"; x.decided_at = when; } });
      const row = { id: rid(), coach_id: c.id, requester_id: r.kind === "team" ? c.profile_id : r.requester_id, kind: r.kind, starts_at: r.starts_at, ends_at: r.ends_at, note: (r.note || "").slice(0, 500),
        status: "accepted", by_coach: true, created_at: when, decided_at: when };
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
      r.status = status; r.decided_at = new Date(window.UI ? UI.now() : Date.now()).toISOString();
      if (status === "accepted") S.requests.forEach(x => { if (x.id !== id && x.coach_id === r.coach_id && x.status === "pending" && overlap(x.starts_at, x.ends_at, r.starts_at, r.ends_at)) { x.status = "declined"; x.decided_at = r.decided_at; } });
      save(); return wait(r);
    };

    API.profiles = () => S.me ? wait(S.profiles) : wait([]);
    API.setRole = (id, role) => {
      if (!isStaff()) return fail("You don't have permission to do that.");
      const p = prof(id); if (p) p.role = role; save(); return wait(null);
    };

    // visit counting: this browser's own visits are kept here, and the Sponsor Stats tab adds sample visits so it has something to show
    const EVENTS = "ptg-demo-events";
    API.track = rows => {
      try {
        const all = JSON.parse(localStorage.getItem(EVENTS) || "[]"), t = new Date().toISOString();
        rows.forEach(r => all.push(Object.assign({ created_at: t }, r)));
        localStorage.setItem(EVENTS, JSON.stringify(all.slice(-3000)));
      } catch (e) { /* storage blocked or full */ }
    };
    API.sponsorStats = () => {
      if (!isStaff()) return fail("Only staff can see sponsor stats.");
      let own = [];
      try { own = JSON.parse(localStorage.getItem(EVENTS) || "[]"); } catch (e) { /* none */ }
      const hrs = S.availability.reduce((n, b) => n + (new Date(b.ends_at) - new Date(b.starts_at)) / 36e5, 0);
      const part = { accounts: S.profiles.length, staff: S.profiles.filter(p => p.role === "staff").length,
        players: new Set(S.teams.flatMap(t => t.member_ids || [])).size, coaches_linked: S.coaches.filter(c => c.profile_id).length,
        requested: S.requests.filter(r => !r.by_coach).length, booked: S.requests.filter(r => r.status === "accepted").length, coach_hours: Math.round(hrs * 10) / 10 };
      return wait(Object.assign(window.PTGStats.compute(window.PTGStats.sample().concat(own)), { participation: part, sample: true }));
    };
    return API;
  }
})();
