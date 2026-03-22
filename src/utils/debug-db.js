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
    const { data, error } = await supabase.from('bronet_ticket_messages')
      .select('*').eq('install_id', INSTALL_ID)
      .eq('ticket_id', String(ticketId))
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


// ─── SYNC PORTAL CUSTOMER STATUS ─────────────────────────────────────────────
export async function disableCustomerByPPPoE(pppoeUsername) {
  console.log('[DB] disableCustomerByPPPoE:', pppoeUsername);
  // Update localStorage
  try {
    const all = JSON.parse(localStorage.getItem('bronet_customers') || '[]');
    const found = all.find(c => c.pppoe_username === pppoeUsername);
    console.log('[DB] localStorage customer found:', found ? 'YES' : 'NO', 'total:', all.length);
    const updated = all.map(c =>
      c.pppoe_username === pppoeUsername ? { ...c, active: false } : c
    );
    localStorage.setItem('bronet_customers', JSON.stringify(updated));
  } catch(e) { console.error('[DB] localStorage update error:', e); }
  // Update Supabase directly
  if (!supabaseReady) { console.warn('[DB] Supabase not ready'); return; }
  try {
    const { data, error, count } = await supabase.from('bronet_customers')
      .update({ active: false })
      .eq('install_id', INSTALL_ID)
      .eq('pppoe_username', pppoeUsername)
      .select();
    if (error) {
      console.error('[DB] disableCustomerByPPPoE SUPABASE ERROR:', error.message);
    } else {
      console.log('[DB] disableCustomerByPPPoE SUPABASE SUCCESS, rows updated:', data?.length, data);
    }
  } catch(e) { console.error('[DB] disableCustomerByPPPoE EXCEPTION:', e.message); }
}

export async function enableCustomerByPPPoE(pppoeUsername) {
  // Update localStorage
  try {
    const all = JSON.parse(localStorage.getItem('bronet_customers') || '[]');
    const updated = all.map(c =>
      c.pppoe_username === pppoeUsername ? { ...c, active: true } : c
    );
    localStorage.setItem('bronet_customers', JSON.stringify(updated));
  } catch {}
  // Update Supabase directly
  if (!supabaseReady) return;
  try {
    await supabase.from('bronet_customers')
      .update({ active: true })
      .eq('install_id', INSTALL_ID)
      .eq('pppoe_username', pppoeUsername);
    console.log('[DB] enableCustomerByPPPoE:', pppoeUsername);
  } catch(e) { console.error('[DB] enableCustomerByPPPoE:', e.message); }
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

  // Always fetch fresh from Supabase (catches active=false from disable/delete)
  if (supabaseReady) {
    const { data } = await supabase.from('bronet_customers')
      .select('*').eq('install_id', INSTALL_ID);
    if (data?.length) {
      // Search by phone
      const byPhone = data.find(c => {
        const cp = (c.phone || '').replace(/\D/g,'');
        return variants.some(v => cp === v || cp.includes(v) || v.includes(cp));
      });
      if (byPhone) return byPhone;
      // Search by pppoe_username (in case user types username not phone)
      const byUsername = data.find(c =>
        c.pppoe_username === phone.trim() ||
        c.pppoe_username === phone.trim().toLowerCase()
      );
      if (byUsername) return byUsername;
    }
  }

  // Fallback to localStorage
  const all = (() => { try { return JSON.parse(localStorage.getItem(LS_CUSTOMERS) || '[]'); } catch { return []; } })();
  return all.find(c => {
    const cp = (c.phone || '').replace(/\D/g,'');
    return variants.some(v => cp === v || cp.includes(v) || v.includes(cp));
  }) || null;
}

// ─── PAYMENT PROOFS ───────────────────────────────────────────────────────────
const LS_PROOFS = 'bronet_payment_proofs';
export async function loadPaymentProofs(username) {
  if (supabaseReady) {
    let q = supabase.from('bronet_payment_proofs').select('*').eq('install_id', INSTALL_ID).order('created_at', { ascending: false });
    if (username) q = q.eq('pppoe_username', username);
    const { data, error } = await q;
    if (!error && data) return data;
  }
  const all = (() => { try { return JSON.parse(localStorage.getItem(LS_PROOFS)||'[]'); } catch { return []; } })();
  return username ? all.filter(p => p.pppoe_username === username) : all;
}
export async function savePaymentProof(proof) {
  const all = (() => { try { return JSON.parse(localStorage.getItem(LS_PROOFS)||'[]'); } catch { return []; } })();
  const idx = all.findIndex(p => p.id === proof.id);
  if (idx >= 0) all[idx] = proof; else all.unshift(proof);
  localStorage.setItem(LS_PROOFS, JSON.stringify(all));
  if (!supabaseReady) return;
  try { await supabase.from('bronet_payment_proofs').upsert({ ...proof, install_id: INSTALL_ID }, { onConflict: 'id' }); }
  catch(e) { console.error('[DB] savePaymentProof:', e.message); }
}

// ─── TECHNICIAN SCHEDULES ────────────────────────────────────────────────────
const LS_SCHEDULES = 'bronet_technician_schedules';
export async function loadSchedules(username) {
  if (supabaseReady) {
    let q = supabase.from('bronet_technician_schedules').select('*').eq('install_id', INSTALL_ID).order('created_at', { ascending: false });
    if (username) q = q.eq('pppoe_username', username);
    const { data, error } = await q;
    if (!error && data) return data;
  }
  const all = (() => { try { return JSON.parse(localStorage.getItem(LS_SCHEDULES)||'[]'); } catch { return []; } })();
  return username ? all.filter(s => s.pppoe_username === username) : all;
}
export async function saveSchedule(sched) {
  const all = (() => { try { return JSON.parse(localStorage.getItem(LS_SCHEDULES)||'[]'); } catch { return []; } })();
  const idx = all.findIndex(s => s.id === sched.id);
  if (idx >= 0) all[idx] = sched; else all.unshift(sched);
  localStorage.setItem(LS_SCHEDULES, JSON.stringify(all));
  if (!supabaseReady) return;
  try { await supabase.from('bronet_technician_schedules').upsert({ ...sched, install_id: INSTALL_ID }, { onConflict: 'id' }); }
  catch(e) { console.error('[DB] saveSchedule:', e.message); }
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────
const LS_FAQ = 'bronet_faq';
export async function loadFAQ() {
  if (supabaseReady) {
    const { data, error } = await supabase.from('bronet_faq').select('*').eq('install_id', INSTALL_ID).order('sort_order');
    if (!error && data?.length) return data;
  }
  try { return JSON.parse(localStorage.getItem(LS_FAQ)||'[]'); } catch { return []; }
}
export async function saveFAQItems(items) {
  localStorage.setItem(LS_FAQ, JSON.stringify(items));
  if (!supabaseReady) return;
  try {
    await supabase.from('bronet_faq').delete().eq('install_id', INSTALL_ID);
    if (items.length > 0) await supabase.from('bronet_faq').insert(items.map(f => ({ ...f, install_id: INSTALL_ID })));
  } catch(e) { console.error('[DB] saveFAQItems:', e.message); }
}

// ─── REFERRALS ───────────────────────────────────────────────────────────────
const LS_REFERRALS = 'bronet_referrals';
export async function loadReferrals() {
  if (supabaseReady) {
    const { data, error } = await supabase.from('bronet_referrals').select('*').eq('install_id', INSTALL_ID).order('created_at', { ascending: false });
    if (!error && data) return data;
  }
  try { return JSON.parse(localStorage.getItem(LS_REFERRALS)||'[]'); } catch { return []; }
}
export async function saveReferral(ref) {
  const all = (() => { try { return JSON.parse(localStorage.getItem(LS_REFERRALS)||'[]'); } catch { return []; } })();
  const idx = all.findIndex(r => r.id === ref.id);
  if (idx >= 0) all[idx] = ref; else all.unshift(ref);
  localStorage.setItem(LS_REFERRALS, JSON.stringify(all));
  if (!supabaseReady) return;
  try { await supabase.from('bronet_referrals').upsert({ ...ref, install_id: INSTALL_ID }, { onConflict: 'id' }); }
  catch(e) { console.error('[DB] saveReferral:', e.message); }
}

// ─── PROFILE EXTRAS (harga profil — cross-device sync) ───────────────────────
// Disimpan di bronet_settings.value sebagai field JSON: { profile_extras: {...} }
const LS_PROFILE_EXTRAS = 'bronet_profile_extras';

export async function loadProfileExtras() {
  try {
    if (supabaseReady) {
      const { data, error } = await supabase.from('bronet_settings')
        .select('value').eq('install_id', INSTALL_ID).single();
      if (!error && data?.value?.profile_extras) {
        const extras = data.value.profile_extras;
        localStorage.setItem(LS_PROFILE_EXTRAS, JSON.stringify(extras));
        return extras;
      }
    }
  } catch(e) { console.error('[DB] loadProfileExtras:', e.message); }
  try { return JSON.parse(localStorage.getItem(LS_PROFILE_EXTRAS) || '{}'); } catch { return {}; }
}

export async function saveProfileExtras(extras) {
  console.log('[DB] saveProfileExtras START', Object.keys(extras));
  localStorage.setItem(LS_PROFILE_EXTRAS, JSON.stringify(extras));
  if (!supabaseReady) { console.warn('[DB] Supabase not ready - saved to localStorage only'); return; }
  try {
    const { data: cur, error: readErr } = await supabase.from('bronet_settings')
      .select('value').eq('install_id', INSTALL_ID).single();
    if (readErr) console.warn('[DB] read settings error:', readErr.message);
    const merged = { ...(cur?.value || {}), profile_extras: extras };
    const { error: writeErr } = await supabase.from('bronet_settings').upsert(
      { install_id: INSTALL_ID, value: merged, updated_at: new Date().toISOString() },
      { onConflict: 'install_id' }
    );
    if (writeErr) {
      console.error('[DB] saveProfileExtras WRITE ERROR:', writeErr.message, writeErr);
    } else {
      console.log('[DB] saveProfileExtras SUCCESS - saved to Supabase');
    }
  } catch(e) { console.error('[DB] saveProfileExtras EXCEPTION:', e.message); }
}
