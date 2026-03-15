import { createClient } from '@supabase/supabase-js';

// Nilai ini diambil dari environment variable Netlify
// Atau di-hardcode sebagai fallback (untuk development)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
  || 'https://eqgcftcxyiwwekdqofaq.supabase.co';

const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabaseReady = !!(SUPABASE_URL && SUPABASE_ANON && SUPABASE_ANON !== 'GANTI_DENGAN_ANON_KEY_DARI_DASHBOARD');

export const supabase = supabaseReady
  ? createClient(SUPABASE_URL, SUPABASE_ANON)
  : null;

// Debug helper
if (supabaseReady) {
  console.log('[Supabase] Connected to:', SUPABASE_URL);
} else {
  console.warn('[Supabase] Belum dikonfigurasi — menggunakan localStorage');
}
