import React, { useState, useEffect } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { MOCK_PPP_SECRETS, MOCK_PPP_PROFILES, parseComment } from '../../utils/mockData';
import {
  CreditCard, CheckCircle, Clock, AlertTriangle, RefreshCw,
  MessageCircle, Send, Trash2, Plus, X, Check, History,
  DollarSign, Calendar, Phone, BadgeCheck, Loader
} from 'lucide-react';
import { format, addDays, differenceInDays } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import clsx from 'clsx';
import toast from 'react-hot-toast';

// DB helper - Supabase + localStorage fallback
import { saveAllBilling, loadBilling as loadBillingDB, saveLog as saveLogDB, loadLogs as loadLogsDB, clearLogs as clearLogsDB } from '../../utils/db';

const BILLING_KEY  = 'bronet_billing_v2';
const WA_KEY       = 'bronet_wa_settings';

function getBilling()       { try { return JSON.parse(localStorage.getItem(BILLING_KEY) || '[]'); } catch { return []; } }
function saveBilling(d)     { localStorage.setItem(BILLING_KEY, JSON.stringify(d)); }
function getWASetting()     { try { return JSON.parse(localStorage.getItem(WA_KEY) || '{}'); } catch { return {}; } }
function saveWASetting(d)   { localStorage.setItem(WA_KEY, JSON.stringify(d)); }
function getLogs()          { try { return JSON.parse(localStorage.getItem('bronet_reminder_logs') || '[]'); } catch { return []; } }
function saveLogs(d)        { localStorage.setItem('bronet_reminder_logs', JSON.stringify(d.slice(-500))); }
function getProfileExtras() { try { return JSON.parse(localStorage.getItem('bronet_profile_extras') || '{}'); } catch { return {}; } }

function fmtRp(n) { return `Rp ${Number(n || 0).toLocaleString('id-ID')}`; }

function Modal({ open, onClose, title, children, maxW = 'max-w-lg' }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 modal-backdrop flex items-center justify-center p-4"
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`bg-card border border-border rounded-2xl w-full ${maxW} max-h-[90vh] overflow-y-auto fade-in`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20}/></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Status helpers
// ─────────────────────────────────────────────────────────────────────────────
function computeStatus(b) {
  if (!b) return 'no-data';
  if (b.paidAt) {
    // Check if paid date is within this month's cycle
    const dueDate = new Date(b.dueDate);
    const today   = new Date();
    if (today <= dueDate) return 'lunas'; // paid and not yet due again
  }
  const today    = new Date(); today.setHours(0,0,0,0);
  const dueDate  = new Date(b.dueDate); dueDate.setHours(0,0,0,0);
  const daysLeft = Math.ceil((dueDate - today) / 86400000);
  if (daysLeft < 0)  return 'overdue';
  if (daysLeft <= 3) return 'due-soon';
  return 'active';
}

const STATUS_CONFIG = {
  lunas:    { label: 'LUNAS', color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/30',  icon: BadgeCheck },
  active:   { label: 'Aktif', color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/30',    icon: Clock },
  'due-soon':{ label: 'Segera JT', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30', icon: AlertTriangle },
  overdue:  { label: 'Terlambat', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30',     icon: AlertTriangle },
  'no-data':{ label: 'Belum Ada', color: 'text-gray-500', bg: 'bg-gray-500/10 border-gray-500/30',  icon: CreditCard },
};

// ─────────────────────────────────────────────────────────────────────────────
export default function Billing() {
  const { callMikrotik } = useApp();
  const { hasPermission } = useAuth();
  const canMarkLunasGlobal = hasPermission('billing-lunas');
  const canSendWA = hasPermission('billing-wa');
  const [users,    setUsers]    = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [billing,  setBillingState] = useState([]);
  const billingRef = React.useRef([]); // always latest billing data
  const [waSettings, setWaSettings] = useState(() => ({
    provider: 'fonnte',
    token: '',
    senderNumber: '',
    template: 'Halo {nama},\n\nIni adalah pemberitahuan tagihan internet Bronet.\n\nDetail Tagihan:\n- Paket     : {paket}\n- Tagihan   : {harga}/bulan\n- Jatuh Tempo: {tanggal}\n\nMohon segera lakukan pembayaran sebelum jatuh tempo agar koneksi tidak terputus.\n\nTerima kasih,\nAdmin Bronet',
    ...getWASetting(),
  }));
  const [logs, setLogs] = useState(getLogs());
  const [loading,  setLoading]  = useState(true);
  const [filterStatus, setFilter] = useState('all');
  const [activeTab,    setTab]    = useState('tagihan');
  // modals
  const [lunasModal,   setLunasModal]   = useState(null); // { user, record }
  const [lunasNote,    setLunasNote]    = useState('');
  const [histModal,    setHistModal]    = useState(null); // record
  const [waSettModal,  setWaSettModal]  = useState(false);
  const [sendingWA,    setSendingWA]    = useState(false);
  const [testingWA,    setTestingWA]    = useState(false);

  // ── load ────────────────────────────────────────────────────────────
  const loadData = async () => {
    setLoading(true);
    try {
    // Re-read profileExtras fresh on every load (picks up price changes from Profiles menu)
    const profileExtras = getProfileExtras();
    const [usersR, profilesR] = await Promise.all([
      callMikrotik('/ppp/secret', 'GET'),
      callMikrotik('/ppp/profile', 'GET'),
    ]);
    const rawUsers    = (usersR.success && Array.isArray(usersR.data))    ? usersR.data    : MOCK_PPP_SECRETS;
    const rawProfiles = (profilesR.success && Array.isArray(profilesR.data)) ? profilesR.data : MOCK_PPP_PROFILES;
    setUsers(rawUsers);
    setProfiles(rawProfiles);

    // Init billing records from installDate
    // Use billingRef for latest data (includes Supabase data, not just localStorage)
    const cur = billingRef.current.length > 0 ? billingRef.current : getBilling();
    let changed = false;
    const updated = [...cur];
    rawUsers.forEach(u => {
      const exists = updated.find(b => b.username === u.name);
      const parsed = parseComment(u.comment);
      // installDate from comment, fallback to today
      const installDate = parsed.installDate || '';
      const extra = profileExtras[u.profile] || {};
      const prof  = rawProfiles.find(p => p.name === u.profile);
      // Resolusi harga: extras > profil Mikrotik > 0
      const price = Number(extra._price) || Number(prof?._price) || 0;

      // Calculate dueDate: same day-of-month as install, rolling monthly
      const calcDueDate = (iDate) => {
        const base = iDate ? new Date(iDate) : new Date();
        const installDay = base.getDate(); // e.g. 15
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        // Try this month first
        let due = new Date(today.getFullYear(), today.getMonth(), installDay);
        // If already passed, move to next month
        if (due <= today) {
          due = new Date(today.getFullYear(), today.getMonth() + 1, installDay);
        }
        return format(due, 'yyyy-MM-dd');
      };

      if (!exists) {
        updated.push({
          username:    u.name,
          profile:     u.profile,
          price: price,
          installDate: installDate || format(new Date(), 'yyyy-MM-dd'),
          dueDate:     calcDueDate(installDate || null),
          paidAt:      null,
          history:     [],
        });
        changed = true;
      } else {
        let needsUpdate = false;
        const upd = { ...exists };
        // ── Resolusi harga: ambil dari extras (prioritas) atau profile Mikrotik ──
        // extras = harga yang diset manual di menu Profil Paket
        const freshExtra = profileExtras[u.profile] || {};
        const freshProf  = rawProfiles.find(p => p.name === u.profile);
        const resolvedPrice = Number(freshExtra._price)  // dari extras
          || Number(freshProf?._price)                    // dari profil Mikrotik
          || Number(price)                                // dari awal loadData
          || 0;
        // Update jika harga berbeda dari yang tersimpan
        if (Number(upd.price) !== resolvedPrice) {
          upd.price = resolvedPrice;
          needsUpdate = true;
        }
        // Sync profile name if changed (user moved to different package)
        if (upd.profile !== u.profile) {
          upd.profile = u.profile;
          // Re-read price for new profile
          const newExtra = profileExtras[u.profile] || {};
          const newProf  = rawProfiles.find(p => p.name === u.profile);
          const profilePrice = Number(newExtra._price || newProf?._price || 0);
          upd.price = profilePrice;
          needsUpdate = true;
        }
        // Sync installDate if changed
        if (installDate && upd.installDate !== installDate) {
          upd.installDate = installDate;
          upd.dueDate = calcDueDate(installDate);
          needsUpdate = true;
        }
        // Fix missing dueDate (old records)
        if (!upd.dueDate || upd.dueDate === 'Invalid Date') {
          upd.dueDate = calcDueDate(upd.installDate || null);
          needsUpdate = true;
        }
        if (needsUpdate) {
          const idx = updated.indexOf(exists);
          updated[idx] = upd;
          changed = true;
        }
      }
    });
    // Always save updated billing with corrected prices
    billingRef.current = updated;
    setBillingState(updated);
    saveBilling(updated);
    if (changed) {
      // Sync to Supabase only when data actually changed
      saveAllBilling(updated).catch(console.error);
    }
    } catch(err) {
      console.error('Billing loadData error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Load billing from DB first
    loadBillingDB().then(saved => {
      if (saved && saved.length > 0) {
        billingRef.current = saved;
        setBillingState(saved);
        saveBilling(saved); // sync Supabase data to localStorage
      }
    }).catch(() => {});
    // Load logs from DB
    loadLogsDB().then(saved => {
      if (saved && saved.length > 0) setLogs(saved);
    }).catch(() => {});
    loadData();
  }, []);

  // ── H-2 auto detect ─────────────────────────────────────────────────
  useEffect(() => {
    if (!users.length) return;
    const todayStr = new Date().toISOString().split('T')[0];
    if (localStorage.getItem('bronet_last_auto_reminder') === todayStr) return;
    // Use billingRef for latest data (includes Supabase data, not just localStorage)
    const cur = billingRef.current.length > 0 ? billingRef.current : getBilling();
    const due2 = users.filter(u => {
      const b = cur.find(x => x.username === u.name);
      if (!b || b.paidAt) return false;
      const days = Math.ceil((new Date(b.dueDate) - new Date()) / 86400000);
      return days === 2;
    });
    if (due2.length > 0) {
      toast(`🔔 ${due2.length} tagihan jatuh tempo 2 hari lagi! Segera kirim reminder.`, { duration: 7000 });
      localStorage.setItem('bronet_last_auto_reminder', todayStr);
    }
  }, [users]);

  // ── helpers ─────────────────────────────────────────────────────────
  const getRecord = (username) => billing.find(b => b.username === username);

  const updateBilling = (newArr) => {
    billingRef.current = newArr;
    setBillingState(newArr);
    saveBilling(newArr);
    saveAllBilling(newArr).catch(console.error);
  };

  // ── LUNAS ───────────────────────────────────────────────────────────
  const confirmLunas = ({ user, record }) => {
    setLunasNote('Transfer bank'); // default note
    setLunasModal({ user, record });
  };

  const markLunas = () => {
    const { user, record } = lunasModal;
    const now = new Date().toISOString();
    const newHistory = [...(record.history || []), {
      paidAt:  now,
      amount:  record.price,
      note:    lunasNote || 'Pembayaran tagihan',
      dueDate: record.dueDate,
    }];
    // Next cycle: same day-of-month as installDate, next month
    const calcNextDue = (installDate, currentDue) => {
      const installDay = installDate ? new Date(installDate).getDate() : new Date(currentDue).getDate();
      const current = new Date(currentDue);
      // Next month, same day
      const next = new Date(current.getFullYear(), current.getMonth() + 1, installDay);
      return format(next, 'yyyy-MM-dd');
    };
    const nextDue = calcNextDue(record.installDate, record.dueDate);
    const updated = billing.map(b =>
      b.username === user.name
        ? { ...b, paidAt: now, dueDate: nextDue, history: newHistory }
        : b
    );
    updateBilling(updated);
    toast.success(`✅ ${user.name} ditandai LUNAS!`);
    setLunasModal(null);
  };

  // ── WA helpers ───────────────────────────────────────────────────────
  const buildMsg = (user, record) => {
    const { phone } = parseComment(user.comment);
    const due     = record?.dueDate ? new Date(record.dueDate) : null;
    const daysLeft = due ? Math.ceil((due - new Date()) / 86400000) : null;
    return waSettings.template
      .replace('{nama}',    user.name)
      .replace('{username}',user.name)
      .replace('{paket}',   user.profile || '-')
      .replace('{harga}',   fmtRp(record?.price))
      .replace('{tanggal}', due ? format(due, 'dd MMMM yyyy', { locale: idLocale }) : '-')
      .replace('{sisa}',    daysLeft !== null ? (daysLeft < 0 ? `TERLAMBAT ${Math.abs(daysLeft)} hari` : `${daysLeft} hari lagi`) : '-')
      .replace('{phone}',   phone || '-');
  };

  const cleanPhone = (p) => p.replace(/^0/, '62').replace(/\D/g, '');

  const openWAWeb = (user, record) => {
    const { phone } = parseComment(user.comment);
    if (!phone) return toast.error('No. HP belum diisi di data user');
    window.open(`https://wa.me/${cleanPhone(phone)}?text=${encodeURIComponent(buildMsg(user, record))}`, '_blank');
    addLog(user.name, phone, 'Reminder dikirim via WA Web (manual)');
  };

  const sendViaFonnte = async (user, record) => {
    const { phone } = parseComment(user.comment);
    if (!phone) return toast.error('No. HP belum diisi');
    if (!waSettings.token) return toast.error('Token Fonnte belum diisi di Pengaturan WA');
    setSendingWA(true);
    try {
      const body = new FormData();
      body.append('target', cleanPhone(phone));
      body.append('message', buildMsg(user, record));
      body.append('typing', 'true');
      body.append('delay', '2');
      const resp = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: { 'Authorization': waSettings.token },
        body,
      });
      const json = await resp.json();
      if (json.status === true) {
        toast.success(`✅ Pesan terkirim ke ${user.name} via Fonnte!`);
        addLog(user.name, phone, 'Reminder terkirim via Fonnte API');
      } else {
        toast.error('Fonnte error: ' + (json.reason || json.message || 'Unknown'));
      }
    } catch(e) {
      toast.error('Gagal koneksi ke Fonnte: ' + e.message);
    }
    setSendingWA(false);
  };

  const addLog = (username, phone, message) => {
    const newLogs = [...getLogs(), { id: Date.now(), username, phone, message, sentAt: new Date().toISOString() }];
    setLogs(newLogs);
    saveLogs(newLogs);
    saveLogDB({ id: Date.now(), username, phone, message, sentAt: new Date().toISOString() }).catch(console.error);
    // Update lastReminderAt so LUNAS button re-enables after reminder is sent
    const now = new Date().toISOString();
    const updBilling = billing.map(b =>
      b.username === username ? { ...b, lastReminderAt: now } : b
    );
    updateBilling(updBilling);
  };

  const testFonnte = async () => {
    if (!waSettings.token) return toast.error('Isi token Fonnte terlebih dahulu');
    if (!waSettings.testPhone) return toast.error('Isi nomor HP test');
    setTestingWA(true);
    try {
      const body = new FormData();
      body.append('target', cleanPhone(waSettings.testPhone));
      body.append('message', '✅ Test koneksi Fonnte dari Bronet berhasil!');
      const resp = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: { 'Authorization': waSettings.token },
        body,
      });
      const json = await resp.json();
      if (json.status === true) {
        toast.success('✅ Test berhasil! Pesan terkirim ke ' + waSettings.testPhone);
      } else {
        toast.error('Test gagal: ' + (json.reason || json.message || 'Token tidak valid?'));
      }
    } catch(e) {
      toast.error('Gagal: ' + e.message);
    }
    setTestingWA(false);
  };

  const bulkReminder = () => {
    const targets = users.filter(u => {
      const b = getRecord(u.name);
      const s = computeStatus(b);
      return s === 'due-soon' || s === 'overdue';
    });
    if (!targets.length) return toast('Tidak ada tagihan yang perlu diingatkan', { icon: 'ℹ️' });
    if (waSettings.token) {
      targets.forEach(u => sendViaFonnte(u, getRecord(u.name)));
    } else {
      targets.forEach(u => openWAWeb(u, getRecord(u.name)));
    }
    toast.success(`Mengirim reminder ke ${targets.length} pelanggan…`);
  };

  // ── filter ───────────────────────────────────────────────────────────
  const filtered = users.filter(u => {
    if (filterStatus === 'all') return true;
    return computeStatus(getRecord(u.name)) === filterStatus;
  });

  const countBy = (s) => users.filter(u => computeStatus(getRecord(u.name)) === s).length;

  // ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Tagihan & Reminder</h1>
          <p className="text-gray-500 text-sm mt-1">
            Kelola tagihan · {waSettings.token ? <span className="text-green-400">Fonnte aktif ✓</span> : <span className="text-yellow-400">WA manual (wa.me)</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setWaSettModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-gray-400 hover:text-white text-sm">
            <MessageCircle size={16} />Pengaturan WA
          </button>
          <button onClick={bulkReminder}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/20 text-green-400 border border-green-500/30 text-sm hover:bg-green-500/30">
            <Send size={16} />Kirim Semua Reminder
          </button>
          <button onClick={loadData} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-gray-400 hover:text-white text-sm">
            <RefreshCw size={16} className={loading ? 'spinner' : ''} />Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total User', value: users.length, icon: CreditCard, color: 'bg-primary/15 text-primary' },
          { label: 'LUNAS',       value: countBy('lunas'),    icon: BadgeCheck,    color: 'bg-green-500/15 text-green-400' },
          { label: 'Segera JT',   value: countBy('due-soon'), icon: Clock,         color: 'bg-yellow-500/15 text-yellow-400' },
          { label: 'Terlambat',   value: countBy('overdue'),  icon: AlertTriangle, color: 'bg-red-500/15 text-red-400' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${s.color}`}>
              <s.icon size={20} />
            </div>
            <div>
              <div className="text-2xl font-bold mono text-white">{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-darker p-1 rounded-xl w-fit border border-border">
        {[['tagihan','Tagihan', CreditCard],['logs','Log Reminder', History]].map(([k,l,Icon]) => (
          <button key={k} onClick={() => setTab(k)}
            className={clsx('flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all',
              activeTab === k ? 'bg-primary text-dark font-semibold' : 'text-gray-400 hover:text-white')}>
            <Icon size={14}/>{l}
          </button>
        ))}
      </div>

      {activeTab === 'tagihan' && (
        <>
          {/* Filter */}
          <div className="flex flex-wrap gap-2">
            {[['all','Semua'],['lunas','LUNAS'],['active','Aktif'],['due-soon','Segera JT'],['overdue','Terlambat']].map(([v,l]) => (
              <button key={v} onClick={() => setFilter(v)}
                className={clsx('px-3 py-1.5 rounded-lg text-xs border transition-all',
                  filterStatus === v ? 'bg-primary/20 text-primary border-primary/50' : 'border-border text-gray-400 hover:text-white')}>
                {l}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-darker/50">
                    {['STATUS','ID PELANGGAN','USERNAME','PAKET','HARGA','NO. HP','JATUH TEMPO','SISA','AKSI'].map(h => (
                      <th key={h} className={clsx('px-4 py-3 text-xs text-gray-500 font-medium', h === 'AKSI' ? 'text-right' : 'text-left')}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={9} className="text-center py-12 text-gray-600">
                      <RefreshCw size={24} className="spinner mx-auto mb-2"/>Memuat...
                    </td></tr>
                  ) : filtered.map(user => {
                    const record = getRecord(user.name);
                    const status = computeStatus(record);
                    const cfg    = STATUS_CONFIG[status] || STATUS_CONFIG['no-data'];
                    const { phone } = parseComment(user.comment);
                    const due    = record?.dueDate ? new Date(record.dueDate) : null;
                    const days   = due ? Math.ceil((due - new Date()) / 86400000) : null;
                    return (
                      <tr key={user['.id']} className="table-row border-b border-border/50 last:border-0">
                        <td className="px-4 py-3">
                          <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border font-semibold', cfg.bg, cfg.color)}>
                            <cfg.icon size={11}/>{cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {(() => { const { customerId, fullName } = parseComment(user.comment); return (
                            <div>
                              <div className="text-xs mono text-primary/80">{customerId || '-'}</div>
                              {fullName && <div className="text-xs text-gray-500">{fullName}</div>}
                            </div>
                          );})()}
                        </td>
                        <td className="px-4 py-3 mono font-medium text-white">{user.name}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 rounded-md bg-primary/10 text-primary text-xs mono">{user.profile}</span>
                        </td>
                        <td className="px-4 py-3 mono text-green-400 text-xs font-semibold">{fmtRp(record?.price)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 text-gray-400 text-xs mono">
                            <Phone size={11}/>{phone || '-'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <div className="text-gray-300 mono">{due ? format(due,'dd MMM yyyy',{locale:idLocale}) : '-'}</div>
                          {status === 'lunas' && record?.paidAt && (
                            <div className="text-green-500/70 text-xs mt-0.5">
                              Lunas {format(new Date(record.paidAt),'dd MMM',{locale:idLocale})}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {days !== null ? (
                            <span className={clsx('mono font-bold text-sm',
                              days < 0 ? 'text-red-400' : days <= 3 ? 'text-yellow-400' : 'text-green-400')}>
                              {days < 0 ? `${Math.abs(days)}h telat` : days === 0 ? 'Hari ini!' : `${days}h`}
                            </span>
                          ) : <span className="text-gray-600 text-xs">-</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {/* LUNAS button - disabled after lunas until next reminder */}
                            {(() => {
                              const reminderAfterLunas = record?.lastReminderAt && record?.paidAt
                                && new Date(record.lastReminderAt) > new Date(record.paidAt);
                              const canMarkLunas = canMarkLunasGlobal && (status !== 'lunas' || reminderAfterLunas);
                              if (!record) return null;
                              return (
                                <button
                                  onClick={() => canMarkLunas && confirmLunas({ user, record })}
                                  title={canMarkLunas ? 'Tandai LUNAS' : 'Sudah lunas. Kirim reminder dulu untuk aktifkan kembali.'}
                                  disabled={!canMarkLunas}
                                  className={clsx(
                                    'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border',
                                    canMarkLunas
                                      ? 'bg-green-500/15 text-green-400 border-green-500/30 hover:bg-green-500/25 cursor-pointer'
                                      : 'bg-gray-500/10 text-gray-600 border-gray-500/20 cursor-not-allowed opacity-50'
                                  )}>
                                  <BadgeCheck size={13}/>
                                  {status === 'lunas' && !reminderAfterLunas ? 'Lunas' : 'LUNAS'}
                                </button>
                              );
                            })()}
                            {/* WA Web */}
                            {phone && canSendWA && (
                              <button onClick={() => openWAWeb(user, record)} title="Kirim via WA Web"
                                className="p-1.5 rounded-lg text-green-400 hover:bg-green-400/10 transition-colors">
                                <MessageCircle size={15}/>
                              </button>
                            )}
                            {/* Fonnte send */}
                            {phone && canSendWA && waSettings.token && (
                              <button onClick={() => sendViaFonnte(user, record)} title="Kirim via Fonnte API"
                                disabled={sendingWA}
                                className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-400/10 transition-colors disabled:opacity-40">
                                {sendingWA ? <Loader size={15} className="spinner"/> : <Send size={15}/>}
                              </button>
                            )}
                            {/* History */}
                            {record?.history?.length > 0 && (
                              <button onClick={() => setHistModal(record)} title="Riwayat bayar"
                                className="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors">
                                <History size={15}/>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'logs' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Log Reminder ({logs.length})</h3>
            <button onClick={() => { saveLogs([]); setLogs([]); clearLogsDB().catch(console.error); toast.success('Log dibersihkan'); }}
              className="text-xs text-red-400 hover:text-red-300">Bersihkan</button>
          </div>
          <div className="divide-y divide-border max-h-[480px] overflow-y-auto">
            {logs.length === 0
              ? <div className="py-12 text-center text-gray-600">Belum ada log</div>
              : [...logs].reverse().map(l => (
                <div key={l.id} className="px-6 py-3 flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg bg-green-500/15 flex items-center justify-center text-green-400 shrink-0">
                    <MessageCircle size={14}/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white font-medium">{l.username}</div>
                    <div className="text-xs text-gray-500 truncate">{l.message} · {l.phone}</div>
                  </div>
                  <div className="text-xs text-gray-600 mono whitespace-nowrap">
                    {format(new Date(l.sentAt),'dd/MM HH:mm')}
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* ── LUNAS confirmation modal ─────────────────────────────────── */}
      <Modal open={!!lunasModal} onClose={() => setLunasModal(null)} title="Konfirmasi Pembayaran LUNAS">
        {lunasModal && (
          <div className="space-y-4">
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-center gap-3">
              <BadgeCheck size={36} className="text-green-400 shrink-0"/>
              <div>
                <div className="font-bold text-white">{lunasModal.user.name}</div>
                <div className="text-xs text-gray-400">{lunasModal.user.profile} · {fmtRp(lunasModal.record.price)}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-darker rounded-xl p-3 border border-border">
                <div className="text-gray-500 mb-1">Jatuh Tempo</div>
                <div className="text-white mono font-semibold">
                  {format(new Date(lunasModal.record.dueDate),'dd MMM yyyy',{locale:idLocale})}
                </div>
              </div>
              <div className="bg-darker rounded-xl p-3 border border-border">
                <div className="text-gray-500 mb-1">Tagihan</div>
                <div className="text-green-400 mono font-bold">{fmtRp(lunasModal.record.price)}</div>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Keterangan Pembayaran</label>
              <input value={lunasNote} onChange={e => setLunasNote(e.target.value)}
                className="input-cyber w-full px-3 py-2.5 rounded-lg text-sm"
                placeholder="Transfer BCA, tunai, dll..." />
              <p className="text-xs text-gray-600 mt-1.5">
                💬 Tandai lunas setelah pelanggan mengirim bukti pembayaran via WhatsApp
              </p>
            </div>
            <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 text-xs text-gray-400">
              📅 Setelah lunas, jatuh tempo berikutnya: <span className="text-primary font-semibold">
                {format(addDays(new Date(lunasModal.record.dueDate), 30),'dd MMMM yyyy',{locale:idLocale})}
              </span>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setLunasModal(null)}
                className="flex-1 py-2.5 rounded-lg border border-border text-gray-400 hover:text-white">Batal</button>
              <button onClick={markLunas}
                className="flex-1 py-2.5 rounded-lg bg-green-500 text-white font-bold hover:bg-green-400 transition-colors flex items-center justify-center gap-2">
                <BadgeCheck size={16}/>Konfirmasi LUNAS
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── History modal ────────────────────────────────────────────── */}
      <Modal open={!!histModal} onClose={() => setHistModal(null)} title={`Riwayat: ${histModal?.username}`}>
        <div className="space-y-3">
          {!histModal?.history?.length
            ? <div className="py-8 text-center text-gray-600">Belum ada riwayat</div>
            : [...(histModal?.history || [])].reverse().map((h, i) => (
              <div key={i} className="flex items-center gap-3 bg-darker rounded-xl p-4 border border-border">
                <div className="w-9 h-9 rounded-xl bg-green-500/15 flex items-center justify-center text-green-400 shrink-0">
                  <BadgeCheck size={18}/>
                </div>
                <div className="flex-1">
                  <div className="font-bold text-white mono">{fmtRp(h.amount)}</div>
                  <div className="text-xs text-gray-500">{h.note}</div>
                  {h.dueDate && <div className="text-xs text-gray-600 mt-0.5">Untuk JT: {h.dueDate}</div>}
                </div>
                <div className="text-xs text-gray-600 mono">{format(new Date(h.paidAt),'dd/MM/yy HH:mm')}</div>
              </div>
            ))
          }
        </div>
      </Modal>

      {/* ── WA Settings modal ────────────────────────────────────────── */}
      <Modal open={waSettModal} onClose={() => setWaSettModal(false)} title="Pengaturan WhatsApp" maxW="max-w-xl">
        <div className="space-y-5">

          {/* Provider selector */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Provider</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'manual', label: '🔗 wa.me (Gratis)', desc: 'Buka WA manual per pelanggan' },
                { value: 'fonnte', label: '⚡ Fonnte API', desc: 'Kirim otomatis, Rp 40rb/bln' },
              ].map(p => (
                <label key={p.value}
                  className={clsx('flex flex-col gap-1 px-4 py-3 rounded-xl border cursor-pointer transition-all',
                    waSettings.provider === p.value
                      ? 'bg-primary/15 border-primary/50 text-white'
                      : 'bg-darker border-border text-gray-400 hover:border-gray-500')}>
                  <input type="radio" name="provider" value={p.value} checked={waSettings.provider === p.value}
                    onChange={() => setWaSettings(s => ({...s, provider: p.value}))} className="hidden"/>
                  <span className="text-sm font-semibold">{p.label}</span>
                  <span className="text-xs opacity-70">{p.desc}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Fonnte config */}
          {waSettings.provider === 'fonnte' && (
            <div className="space-y-4 bg-darker/60 border border-border rounded-xl p-4">
              <div className="text-xs text-primary font-semibold uppercase tracking-wider mb-1">Konfigurasi Fonnte</div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-xs text-gray-400 space-y-1">
                <p className="font-semibold text-blue-400">📋 Cara mendapatkan Token Fonnte:</p>
                <p>1. Daftar di <span className="text-primary mono">fonnte.com</span></p>
                <p>2. Beli paket (mulai Rp 40.000/bulan)</p>
                <p>3. Dashboard → Device → Scan QR Code dengan HP Anda</p>
                <p>4. Dashboard → Token → Salin token ke field di bawah</p>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Token API Fonnte <span className="text-red-400">*</span></label>
                <input value={waSettings.token} onChange={e => setWaSettings(s => ({...s, token: e.target.value}))}
                  className="input-cyber w-full px-3 py-2.5 rounded-lg text-sm mono"
                  placeholder="Tempel token dari dashboard Fonnte..." />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Nomor HP untuk Test</label>
                <div className="flex gap-2">
                  <input value={waSettings.testPhone || ''} onChange={e => setWaSettings(s => ({...s, testPhone: e.target.value}))}
                    className="input-cyber flex-1 px-3 py-2.5 rounded-lg text-sm mono" placeholder="08123456789" />
                  <button onClick={testFonnte} disabled={testingWA}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 text-sm whitespace-nowrap disabled:opacity-40">
                    {testingWA ? <Loader size={14} className="spinner"/> : <Send size={14}/>}
                    Test Kirim
                  </button>
                </div>
                <p className="text-xs text-gray-600 mt-1">Klik Test Kirim untuk verifikasi koneksi Fonnte</p>
              </div>
            </div>
          )}

          {/* Template */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Template Pesan Reminder</label>
            <p className="text-xs text-gray-600 mb-1.5 leading-relaxed">
              Variabel: <span className="mono text-primary">{'{nama}'} {'{paket}'} {'{harga}'} {'{tanggal}'} {'{sisa}'} {'{username}'} {'{phone}'}</span>
            </p>
            <textarea value={waSettings.template} rows={8}
              onChange={e => setWaSettings(s => ({...s, template: e.target.value}))}
              className="input-cyber w-full px-3 py-2.5 rounded-lg text-sm mono" />
          </div>

          {/* Save */}
          <div className="flex gap-3 pt-2 border-t border-border">
            <button onClick={() => setWaSettModal(false)}
              className="flex-1 py-2.5 rounded-lg border border-border text-gray-400 hover:text-white text-sm">Tutup</button>
            <button onClick={() => { saveWASetting(waSettings); toast.success('Pengaturan WA disimpan!'); setWaSettModal(false); }}
              className="btn-primary flex-1 py-2.5 rounded-lg text-sm flex items-center justify-center gap-2">
              <Check size={16}/>Simpan
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
