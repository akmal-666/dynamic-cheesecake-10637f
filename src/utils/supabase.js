import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || 'https://eqgcftcxyiwwekdqofaq.supabase.co';
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxZ2NmdGN4eWl3d2VrZHFvZmFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1ODQxOTcsImV4cCI6MjA4OTE2MDE5N30.RNtQsKTBeW7BimGuR7MPRlDdNb8SsPcurSoWaeA1d4k';

export const supabaseReady = !!(SUPABASE_URL && SUPABASE_ANON);

export const supabase = supabaseReady
  ? createClient(SUPABASE_URL, SUPABASE_ANON)
  : null;

if (supabaseReady) {
  console.log('[Supabase] Connected:', SUPABASE_URL);
} else {
  console.warn('[Supabase] Tidak terkonfigurasi, pakai localStorage');
}
