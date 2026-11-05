/* Path to Glory · site settings.
   Paste your Supabase project URL and anon (public) key from
   Supabase → Project Settings → API. The anon key is meant to be public:
   the access rules in supabase/schema.sql are what protect the data.

   Leave both empty to run in DEMO MODE: the whole site works with sample
   data that lives only in your own browser, and a bar at the bottom lets
   you switch between player, mentor and staff views. */
window.PTG_CONFIG = {
  supabaseUrl: "",
  supabaseAnonKey: ""
};
