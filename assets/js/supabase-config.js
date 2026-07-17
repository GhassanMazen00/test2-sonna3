// ============================================
// SUPABASE CONNECTION (public values — safe to expose)
// ============================================
//
// These two values are meant to be public. Your data is protected by the
// row-level security rules you set up in Supabase (public can read; only a
// logged-in admin can change). Never put the "service_role" / "secret" key here.
//
// To point the site at a different Supabase project later, just change these.

window.SUPABASE_URL = 'https://qtphintmxyncwlpxenha.supabase.co';
window.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0cGhpbnRteHluY3dscHhlbmhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1MDA3OTksImV4cCI6MjA5OTA3Njc5OX0.B4e6ghhmUHnrN0whaEAniVpBcE8wYhqAemnUj-SE1nw';

// Where all site content is stored (created by the SQL step)
window.SUPABASE_TABLE = 'site_content';

// Storage bucket that holds uploaded factory images/videos (create it in Supabase)
window.SUPABASE_BUCKET = 'media';

// Which payment provider's checkout Edge Function to call when a factory
// subscribes. Switch providers by changing this to e.g. 'paymob-checkout'.
window.PAYMENT_CHECKOUT_FN = 'kashier-checkout';

// The Edge Function that books a paid consultation (see the consultant section
// on the home page). Same Kashier setup as the verification checkout.
window.PAYMENT_CONSULT_FN = 'kashier-consult-checkout';
