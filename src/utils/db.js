/**
 * db.js — Database helper Bronet
 * Menggunakan Supabase jika tersedia, fallback ke localStorage
 * 
 * TABEL SUPABASE yang diperlukan (jalankan SQL di Supabase Dashboard):
 * Lihat file: supabase-schema.sql
 */

import { supabase, supabaseReady } from './supabase';

// ─── Fixed install ID — semua device pakai ID yang sama ─────────────────────
// Ini memungkinkan data sinkron di semua device (laptop, HP, tablet)
const INSTALL_ID = 'bronet_main';

// ─── SETTINGS ────────────────────────────────────────────────────────────────
const LS_SETTINGS = 'bronet_settings';
const DEFAULT_SETTINGS = {
  host: '', port: '80', username: '', password: '', connected: false, lastCheck: null,
};

export async function loadSettings() {
  if (supabaseReady) {
    const { data, error } = await supabase
      .from('bronet_settings')
      .select('*')
      .eq('install_id', INSTALL_ID)
      .single();
    if (!error && data) return { ...DEFAULT_SETTINGS, ...data.value };
  }
  try {
    const s = localStorage.getItem(LS_SETTINGS);
    return s ? { ...DEFAULT_SETTINGS, ...JSON.parse(s) } : DEFAULT_SETTINGS;
  } catch { return DEFAULT_SETTINGS; }
}

export async function saveSettings(settings) {
  const ls = JSON.stringify(settings);
  localStorage.setItem(LS_SETTINGS, ls);

  if (supabaseReady) {
    await supabase.from('bronet_settings').upsert(
      { install_id: INSTALL_ID, value: settings, updated_at: new Date().toISOString() },
      { onConflict: 'install_id' }
    );
  }
}

// ─── BILLING ─────────────────────────────────────────────────────────────────
const LS_BILLING = 'bronet_billing_v2';

export async function loadBilling() {
  if (supabaseReady) {
    const { data, error } = await supabase
      .from('bronet_billing')
      .select('*')
      .eq('install_id', INSTALL_ID);
    if (!error && data?.length) {
      // Map DB rows → billing array
      return data.map(row => ({
        username:      row.username,
        profile:       row.profile,
        price:         row.price,
        installDate:   row.install_date,
        dueDate:       row.due_date,
        paidAt:        row.paid_at,
        lastReminderAt:row.last_reminder_at,
        history:       row.history || [],
      }));
    }
  }
  try { return JSON.parse(localStorage.getItem(LS_BILLING) || '[]'); } catch { return []; }
}

export async function saveBillingRecord(record) {
  // Always save to localStorage
  const current = (() => { try { return JSON.parse(localStorage.getItem(LS_BILLING) || '[]'); } catch { return []; } })();
  const idx = current.findIndex(b => b.username === record.username);
  if (idx >= 0) current[idx] = record; else current.push(record);
  localStorage.setItem(LS_BILLING, JSON.stringify(current));

  if (supabaseReady) {
    await supabase.from('bronet_billing').upsert({
      install_id:       INSTALL_ID,
      username:         record.username,
      profile:          record.profile,
      price:            record.price || 0,
      install_date:     record.installDate || null,
      due_date:         record.dueDate || null,
      paid_at:          record.paidAt || null,
      last_reminder_at: record.lastReminderAt || null,
      history:          record.history || [],
      updated_at:       new Date().toISOString(),
    }, { onConflict: 'install_id,username' });
  }
}

export async function saveAllBilling(billingArray) {
  localStorage.setItem(LS_BILLING, JSON.stringify(billingArray));

  if (supabaseReady) {
    // Upsert all at once
    const rows = billingArray.map(record => ({
      install_id:       INSTALL_ID,
      username:         record.username,
      profile:          record.profile,
      price:            record.price || 0,
      install_date:     record.installDate || null,
      due_date:         record.dueDate || null,
      paid_at:          record.paidAt || null,
      last_reminder_at: record.lastReminderAt || null,
      history:          record.history || [],
      updated_at:       new Date().toISOString(),
    }));
    await supabase.from('bronet_billing').upsert(rows, { onConflict: 'install_id,username' });
  }
}

// ─── EXPENSES ─────────────────────────────────────────────────────────────────
const LS_EXPENSES = 'bronet_expenses';

export async function loadExpenses() {
  if (supabaseReady) {
    const { data, error } = await supabase
      .from('bronet_expenses')
      .select('*')
      .eq('install_id', INSTALL_ID)
      .order('date', { ascending: false });
    if (!error && data?.length) {
      return data.map(r => ({
        id: r.id, date: r.date, category: r.category,
        description: r.description, amount: r.amount, note: r.note,
      }));
    }
  }
  try { return JSON.parse(localStorage.getItem(LS_EXPENSES) || '[]'); } catch { return []; }
}

export async function saveExpenses(expenses) {
  localStorage.setItem(LS_EXPENSES, JSON.stringify(expenses));

  if (supabaseReady) {
    // Delete all then re-insert (simple approach for small dataset)
    await supabase.from('bronet_expenses').delete().eq('install_id', INSTALL_ID);
    if (expenses.length > 0) {
      await supabase.from('bronet_expenses').insert(
        expenses.map(e => ({
          id:          e.id,
          install_id:  INSTALL_ID,
          date:        e.date,
          category:    e.category,
          description: e.description,
          amount:      e.amount || 0,
          note:        e.note || '',
        }))
      );
    }
  }
}

// ─── ASSETS ──────────────────────────────────────────────────────────────────
const LS_ASSETS = 'bronet_assets';

export async function loadAssets() {
  if (supabaseReady) {
    const { data, error } = await supabase
      .from('bronet_assets')
      .select('*')
      .eq('install_id', INSTALL_ID);
    if (!error && data?.length) return data.map(r => ({ ...r }));
  }
  try { return JSON.parse(localStorage.getItem(LS_ASSETS) || '[]'); } catch { return []; }
}

export async function saveAssets(assets) {
  localStorage.setItem(LS_ASSETS, JSON.stringify(assets));

  if (supabaseReady) {
    await supabase.from('bronet_assets').delete().eq('install_id', INSTALL_ID);
    if (assets.length > 0) {
      await supabase.from('bronet_assets').insert(
        assets.map(a => ({
          ...a,
          install_id: INSTALL_ID,
          purchase_price: a.purchasePrice || 0,
          purchase_date:  a.purchaseDate || null,
          serial_no:      a.serialNo || null,
          assigned_to:    a.assignedTo || null,
        }))
      );
    }
  }
}

// ─── WEB USERS ────────────────────────────────────────────────────────────────
const LS_WEB_USERS = 'bronet_web_users';

export async function loadWebUsers() {
  if (supabaseReady) {
    const { data, error } = await supabase
      .from('bronet_web_users')
      .select('*')
      .eq('install_id', INSTALL_ID);
    if (error) { console.error('[DB] loadWebUsers error:', error.message); }
    else if (data?.length) {
      console.log('[DB] loadWebUsers got', data.length, 'users from Supabase');
      // Normalize snake_case → camelCase for React app
      return data.map(u => ({
        id:        u.id,
        username:  u.username,
        password:  u.password,
        name:      u.name,
        email:     u.email,
        role:      u.role,
        active:    u.active,
        createdAt: u.created_at,
      }));
    }
  }
  try {
    const s = localStorage.getItem(LS_WEB_USERS);
    return s ? JSON.parse(s) : [];
  } catch { return []; }
}

export async function saveWebUsers(users) {
  localStorage.setItem(LS_WEB_USERS, JSON.stringify(users));

  if (!supabaseReady) return;
  try {
    const { error: delErr } = await supabase
      .from('bronet_web_users')
      .delete()
      .eq('install_id', INSTALL_ID);
    if (delErr) { console.error('[DB] saveWebUsers delete error:', delErr.message); return; }

    if (users.length === 0) return;

    // Explicit mapping — only columns that exist in the table
    const rows = users.map(u => ({
      id:         String(u.id),
      install_id: INSTALL_ID,
      username:   u.username || '',
      password:   u.password || '',
      name:       u.name || '',
      email:      u.email || '',
      role:       u.role || 'operator',
      active:     u.active !== false,
      created_at: u.createdAt || u.created_at || new Date().toISOString(),
    }));

    const { error: insErr } = await supabase.from('bronet_web_users').insert(rows);
    if (insErr) { console.error('[DB] saveWebUsers insert error:', insErr.message); }
    else { console.log('[DB] saveWebUsers saved', rows.length, 'users to Supabase'); }
  } catch (e) { console.error('[DB] saveWebUsers exception:', e.message); }
}

// ─── ROLES ────────────────────────────────────────────────────────────────────
const LS_ROLES = 'bronet_roles';

export async function loadRoles() {
  if (supabaseReady) {
    const { data, error } = await supabase
      .from('bronet_roles')
      .select('*')
      .eq('install_id', INSTALL_ID);
    if (!error && data?.length) return data;
  }
  try {
    const s = localStorage.getItem(LS_ROLES);
    return s ? JSON.parse(s) : []; // empty = use defaults in AuthContext
  } catch { return []; }
}

export async function saveRoles(roles) {
  localStorage.setItem(LS_ROLES, JSON.stringify(roles));

  if (!supabaseReady) return;
  try {
    await supabase.from('bronet_roles').delete().eq('install_id', INSTALL_ID);
    if (roles.length === 0) return;
    const rows = roles.map(r => ({
      id:          String(r.id),
      install_id:  INSTALL_ID,
      label:       r.label || '',
      permissions: r.permissions || [],
      editable:    r.editable !== false,
    }));
    const { error } = await supabase.from('bronet_roles').insert(rows);
    if (error) { console.error('[DB] saveRoles error:', error.message); }
  } catch (e) { console.error('[DB] saveRoles exception:', e.message); }
}

// ─── REMINDER LOGS ────────────────────────────────────────────────────────────
const LS_LOGS = 'bronet_reminder_logs';

export async function loadLogs() {
  if (supabaseReady) {
    const { data, error } = await supabase
      .from('bronet_reminder_logs')
      .select('*')
      .eq('install_id', INSTALL_ID)
      .order('sent_at', { ascending: false })
      .limit(500);
    if (!error && data?.length) {
      return data.map(r => ({
        id: r.id, username: r.username, phone: r.phone,
        message: r.message, sentAt: r.sent_at,
      }));
    }
  }
  try { return JSON.parse(localStorage.getItem(LS_LOGS) || '[]'); } catch { return []; }
}

export async function saveLog(log) {
  const current = (() => { try { return JSON.parse(localStorage.getItem(LS_LOGS) || '[]'); } catch { return []; } })();
  const updated = [...current, log].slice(-500);
  localStorage.setItem(LS_LOGS, JSON.stringify(updated));

  if (supabaseReady) {
    await supabase.from('bronet_reminder_logs').insert({
      id:         log.id,
      install_id: INSTALL_ID,
      username:   log.username,
      phone:      log.phone,
      message:    log.message,
      sent_at:    log.sentAt,
    });
  }
}

export async function clearLogs() {
  localStorage.removeItem(LS_LOGS);
  if (supabaseReady) {
    await supabase.from('bronet_reminder_logs').delete().eq('install_id', INSTALL_ID);
  }
}
