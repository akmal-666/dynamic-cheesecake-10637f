import { createClient } from '@supabase/supabase-js';

// Variabel ini diisi otomatis dari environment variable Netlify
// Anda set di: Netlify Dashboard → Site Settings → Environment Variables
const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || '';
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Jika belum dikonfigurasi, gunakan localStorage sebagai fallback
export const supabaseReady = !!(SUPABASE_URL && SUPABASE_ANON);

export const supabase = supabaseReady
  ? createClient(SUPABASE_URL, SUPABASE_ANON)
  : null;

// Helper: log jika supabase belum dikonfigurasi
export function checkSupabase(fnName) {
  if (!supabaseReady) {
    console.warn(`[Supabase] ${fnName}: belum dikonfigurasi, menggunakan localStorage`);
    return false;
  }
  return true;
}
