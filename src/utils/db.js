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

// ─── TRAFFIC HISTORY ─────────────────────────────────────────────────────────
// Simpan batch titik trafik ke Supabase
export async function saveTrafficBatch(points) {
  if (!supabaseReady || !points || points.length === 0) return;
  try {
    const rows = points.map(p => ({
      install_id:  INSTALL_ID,
      interface:   p.interface,
      rx:          Math.round(p.rx || 0),
      tx:          Math.round(p.tx || 0),
      recorded_at: p.timestamp,
    }));
    const { error } = await supabase.from('bronet_traffic_history').insert(rows);
    if (error) { console.error('[DB] saveTrafficBatch error:', error.message); }
    else { console.log('[DB] saveTrafficBatch saved', rows.length, 'points'); }
  } catch (e) { console.error('[DB] saveTrafficBatch exception:', e.message); }
}

// Load traffic history dari Supabase untuk rentang waktu tertentu
export async function loadTrafficHistory(interfaceName, hours = 1) {
  if (!supabaseReady) return null; // null = pakai localStorage

  try {
    const since = new Date(Date.now() - hours * 3600000).toISOString();
    const { data, error } = await supabase
      .from('bronet_traffic_history')
      .select('interface, rx, tx, recorded_at')
      .eq('install_id', INSTALL_ID)
      .eq('interface', interfaceName)
      .gte('recorded_at', since)
      .order('recorded_at', { ascending: true })
      .limit(10000);

    if (error) { console.error('[DB] loadTrafficHistory error:', error.message); return null; }
    return data.map(r => ({
      timestamp: r.recorded_at,
      interface: r.interface,
      rx: r.rx,
      tx: r.tx,
    }));
  } catch (e) { console.error('[DB] loadTrafficHistory exception:', e.message); return null; }
}

// Hapus data traffic lama (lebih dari N hari)
export async function pruneTrafficHistory(days = 365) {
  if (!supabaseReady) return;
  try {
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
    const { error } = await supabase
      .from('bronet_traffic_history')
      .delete()
      .eq('install_id', INSTALL_ID)
      .lt('recorded_at', cutoff);
    if (error) { console.error('[DB] pruneTrafficHistory error:', error.message); }
    else { console.log('[DB] pruneTrafficHistory: data older than', days, 'days removed'); }
  } catch (e) { console.error('[DB] pruneTrafficHistory exception:', e.message); }
}

// ─── BANNERS ─────────────────────────────────────────────────────────────────
const LS_BANNERS = 'bronet_banners';

export async function loadBanners() {
  if (supabaseReady) {
    const { data, error } = await supabase.from('bronet_banners')
      .select('*').eq('install_id', INSTALL_ID).eq('active', true)
      .order('sort_order', { ascending: true });
    if (!error && data?.length) return data;
  }
  try { return JSON.parse(localStorage.getItem(LS_BANNERS) || '[]'); } catch { return []; }
}

export async function saveBanners(banners) {
  localStorage.setItem(LS_BANNERS, JSON.stringify(banners));
  if (!supabaseReady) return;
  try {
    await supabase.from('bronet_banners').delete().eq('install_id', INSTALL_ID);
    if (banners.length > 0) {
      await supabase.from('bronet_banners').insert(banners.map(b => ({ ...b, install_id: INSTALL_ID })));
    }
  } catch(e) { console.error('[DB] saveBanners:', e.message); }
}

// ─── PAYMENT INFO ─────────────────────────────────────────────────────────────
const LS_PAYMENT = 'bronet_payment_info';

export async function loadPaymentInfo() {
  if (supabaseReady) {
    const { data, error } = await supabase.from('bronet_payment_info')
      .select('*').eq('install_id', INSTALL_ID).order('sort_order');
    if (!error && data?.length) return data;
  }
  try { return JSON.parse(localStorage.getItem(LS_PAYMENT) || '[]'); } catch { return []; }
}

export async function savePaymentInfo(items) {
  localStorage.setItem(LS_PAYMENT, JSON.stringify(items));
  if (!supabaseReady) return;
  try {
    await supabase.from('bronet_payment_info').delete().eq('install_id', INSTALL_ID);
    if (items.length > 0) {
      await supabase.from('bronet_payment_info').insert(items.map(i => ({ ...i, install_id: INSTALL_ID })));
    }
  } catch(e) { console.error('[DB] savePaymentInfo:', e.message); }
}

// ─── TICKETS ─────────────────────────────────────────────────────────────────
const LS_TICKETS = 'bronet_tickets';

export async function loadTickets() {
  if (supabaseReady) {
    const { data, error } = await supabase.from('bronet_tickets')
      .select('*').eq('install_id', INSTALL_ID)
      .order('created_at', { ascending: false });
    if (!error && data) {
      // Merge with localStorage (portal may have unsaved tickets)
      const local = (() => { try { return JSON.parse(localStorage.getItem(LS_TICKETS) || '[]'); } catch { return []; } })();
      const dbNos = new Set(data.map(t => t.ticket_no));
      const localOnly = local.filter(t => !dbNos.has(t.ticket_no));
      return [...localOnly, ...data];
    }
  }
  try { return JSON.parse(localStorage.getItem(LS_TICKETS) || '[]'); } catch { return []; }
}

export async function saveTicket(ticket) {
  // Save to localStorage with local id
  const all = (() => { try { return JSON.parse(localStorage.getItem(LS_TICKETS) || '[]'); } catch { return []; } })();
  const idx = all.findIndex(t => t.id === ticket.id || t.ticket_no === ticket.ticket_no);
  if (idx >= 0) all[idx] = ticket; else all.unshift(ticket);
  localStorage.setItem(LS_TICKETS, JSON.stringify(all));

  if (!supabaseReady) return;
  try {
    // Use ticket_no as TEXT id for Supabase (schema changed to TEXT primary key)
    const payload = {
      ...ticket,
      id: ticket.ticket_no, // use ticket_no as stable TEXT id
      install_id: INSTALL_ID,
    };

    const { error } = await supabase.from('bronet_tickets')
      .upsert(payload, { onConflict: 'id' });
    if (error) { console.error('[DB] saveTicket error:', error.message); }
    else { console.log('[DB] saveTicket saved:', ticket.ticket_no); }
  } catch(e) { console.error('[DB] saveTicket exception:', e.message); }
}

export async function loadTicketMessages(ticketId) {
  if (supabaseReady) {
    // ticket_id in messages is TEXT (ticket_no)
    const { data, error } = await supabase.from('bronet_ticket_messages')
      .select('*').eq('install_id', INSTALL_ID)
      .or(`ticket_id.eq.${ticketId},ticket_id.eq.${String(ticketId)}`)
      .order('created_at', { ascending: true });
    if (!error && data) return data;
  }
  return [];
}

export async function saveTicketMessage(msg) {
  if (!supabaseReady) return;
  try {
    const payload = {
      ...msg,
      id: String(msg.id), // ensure TEXT
      ticket_id: String(msg.ticket_id), // ensure TEXT ref
      install_id: INSTALL_ID,
    };
    await supabase.from('bronet_ticket_messages').insert(payload);
  } catch(e) { console.error('[DB] saveTicketMessage:', e.message); }
}

// ─── CUSTOMERS (portal login) ────────────────────────────────────────────────
const LS_CUSTOMERS = 'bronet_customers';

export async function loadCustomers() {
  if (supabaseReady) {
    const { data, error } = await supabase.from('bronet_customers')
      .select('*').eq('install_id', INSTALL_ID);
    if (!error && data) return data;
  }
  try { return JSON.parse(localStorage.getItem(LS_CUSTOMERS) || '[]'); } catch { return []; }
}

export async function saveCustomer(customer) {
  const all = (() => { try { return JSON.parse(localStorage.getItem(LS_CUSTOMERS) || '[]'); } catch { return []; } })();
  const idx = all.findIndex(c => c.id === customer.id);
  if (idx >= 0) all[idx] = customer; else all.push(customer);
  localStorage.setItem(LS_CUSTOMERS, JSON.stringify(all));
  if (!supabaseReady) return;
  try {
    await supabase.from('bronet_customers').upsert(
      { ...customer, install_id: INSTALL_ID },
      { onConflict: 'id' }
    );
  } catch(e) { console.error('[DB] saveCustomer:', e.message); }
}

export async function findCustomerByPhone(phone) {
  const clean = phone.replace(/\D/g, '');
  // Build all possible formats: 08xxx, 628xxx, 8xxx
  const variants = [
    clean,
    clean.startsWith('62') ? '0' + clean.slice(2) : clean,
    clean.startsWith('0')  ? '62' + clean.slice(1) : clean,
    clean.startsWith('0')  ? clean.slice(1) : clean,
  ];

  // Also search by pppoe_username in case phone wasn't set
  if (supabaseReady) {
    const { data } = await supabase.from('bronet_customers')
      .select('*').eq('install_id', INSTALL_ID);
    if (data?.length) {
      const found = data.find(c => {
        const cp = (c.phone || '').replace(/\D/g,'');
        return variants.some(v => cp === v || cp.includes(v) || v.includes(cp));
      });
      if (found) return found;
    }
  }

  // Fallback to localStorage
  const all = (() => { try { return JSON.parse(localStorage.getItem(LS_CUSTOMERS) || '[]'); } catch { return []; } })();
  return all.find(c => {
    const cp = (c.phone || '').replace(/\D/g,'');
    return variants.some(v => cp === v || cp.includes(v) || v.includes(cp));
  }) || null;
}
