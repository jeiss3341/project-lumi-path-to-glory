/* Path to Glory · site settings.
   The real address uses the real database. Everywhere else (the GitHub Pages copy, the Railway
   test address, this computer) runs in DEMO MODE: sample data that lives only in your own browser,
   with a bar at the bottom to switch between player, mentor and staff views.

   The publishable key is meant to be public: the access rules in supabase/schema.sql protect the data. */
(function () {
  const live = ["projectlumi.space", "pathtoglory.projectlumi.space"].includes(location.hostname);
  window.PTG_CONFIG = {
    supabaseUrl: live ? "https://yegxowpdrwvbeqwxagse.supabase.co" : "",
    supabaseAnonKey: live ? "sb_publishable_otvffR5I1NaiyT95Yh9oJw_KIlxFH0x" : ""
  };
})();
