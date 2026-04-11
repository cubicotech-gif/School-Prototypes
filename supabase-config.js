// =============================================================
// Cubico School Prototypes — Supabase Config
// =============================================================
// Paste your Supabase values below ONCE. Used by every school.
//
// SAFETY: The anon key is designed to be public — it only allows
// the operations permitted by your RLS policies. Real security
// comes from RLS + the admin password gate.
//
// Where to find these values:
//   1. https://supabase.com → your project
//   2. Project Settings → API
//   3. Copy "Project URL" and "anon public" key
// =============================================================

window.CUBICO_CONFIG = {
  // Your Supabase project URL (e.g. https://abcdefg.supabase.co)
  SUPABASE_URL: "PASTE_YOUR_SUPABASE_PROJECT_URL_HERE",

  // Your Supabase anon (public) key — long string starting with "eyJ..."
  SUPABASE_ANON_KEY: "PASTE_YOUR_SUPABASE_ANON_PUBLIC_KEY_HERE",

  // Password for the admin upload pages.
  // CHANGE THIS to something only you know.
  ADMIN_PASSWORD: "cubico-2026",

  // Storage bucket name (must match the SQL setup — leave as is)
  STORAGE_BUCKET: "school-images",
};
