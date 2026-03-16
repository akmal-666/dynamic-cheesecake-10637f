import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { MOCK_PPP_SECRETS, MOCK_PPP_PROFILES, parseComment } from '../../utils/mockData';
import { exportXLSX, fmtRp, fmtDate } from '../../utils/exportXlsx';
import {
  UserX, Download, RefreshCw, Search, MessageCircle, Send,
  Filter, AlertTriangle, Phone, Calendar, X, Loader, Trash2
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import clsx from 'clsx';
import toast from 'react-hot-toast';

function getBilling()      { try { return JSON.parse(localStorage.getItem('bronet_billing_v2') || '[]'); } catch { return []; } }
function getWASetting()    { try { return JSON.parse(localStorage.getItem('bronet_wa_settings') || '{}'); } catch { return {}; } }
function getLogs()         { try { return JSON.parse(localStorage.getItem('bronet_reminder_logs') || '[]'); } catch { return []; } }
function saveLogs(d)       { localStorage.setItem('bronet_reminder_logs', JSON.stringify(d.slice(-500))); }
function getProfileExtras(){ try { return JSON.parse(localStorage.getItem('bronet_profile_extras') || '{}'); } catch { return {}; } }

export default function UnpaidReport() {
  const { callMikrotik } = useApp();
  const { hasPermission } = useAuth();
  const canDelete = hasPermission('delete-reports');
  const [users,   setUsers]   = useState([]);
  const [billing, setBilling] = useState(getBilling());
  const [loading, setLoading] = useState(false);
  const [search,  setSearch]  = useState('');
  const [filterType, setFilterType] = useState('all-unpaid'); // all-unpaid | overdue | due-soon | no-record
  const [sending, setSending] = useState(null);
  const waSettings    = getWASetting();
  const profileExtras = getProfileExtras();

  useEffect(() => {
    setLoading(true);
    callMikrotik('/ppp/secret','GET').then(r => {
      setUsers(r.success && Array.isArray(r.data) ? r.data : MOCK_PPP_SECRETS);
      setBilling(getBilling());
      setLoading(false);
    });
  }, []);

  // ── helpers ──────────────────────────────────────────────────────────────
  const getRecord = (username) => billing.find(b => b.username === username);

  const getUnpaidStatus = (record) => {
    if (!record) return 'no-record';
    if (record.paidAt) {
      const dueDate = new Date(record.dueDate);
      if (new Date() <= dueDate) return null; // paid & not yet overdue again → skip
    }
    const days = Math.ceil((new Date(record.dueDate) - new Date()) / 86400000);
    if (days < 0)  return 'overdue';
    if (days <= 7) return 'due-soon';
    return null; // not overdue yet
  };

  const getDaysOverdue = (record) => {
    if (!record?.dueDate) return null;
    return Math.ceil((new Date() - new Date(record.dueDate)) / 86400000);
  };

  // ── filtered list ────────────────────────────────────────────────────────
  const unpaidUsers = useMemo(() => {
    return users.filter(u => {
      const rec    = getRecord(u.name);
      const status = getUnpaidStatus(rec);
      if (!status) return false; // paid & ok
      if (filterType === 'overdue')   return status === 'overdue';
      if (filterType === 'due-soon')  return status === 'due-soon';
      if (filterType === 'no-record') return status === 'no-record';
      return true; // all-unpaid
    }).filter(u => {
      if (!search) return true;
      const { phone } = parseComment(u.comment);
      return u.name.toLowerCase().includes(search.toLowerCase()) || phone.includes(search);
    }).map(u => {
      const rec      = getRecord(u.name);
      const status   = getUnpaidStatus(rec);
      const { phone, email } = parseComment(u.comment);
      const daysOver = status === 'overdue' ? getDaysOverdue(rec) : null;
      const daysLeft = rec?.dueDate ? Math.ceil((new Date(rec.dueDate) - new Date()) / 86400000) : null;
      const extra    = profileExtras[u.profile] || {};
      const price    = extra._price || rec?.price || 0;
      return { user: u, rec, status, phone, email, daysOver, daysLeft, price };
    }).sort((a,b) => {
      if (a.status === 'overdue' && b.status !== 'overdue') return -1;
      if (b.status === 'overdue' && a.status !== 'overdue') return 1;
      return (b.daysOver||0) - (a.daysOver||0);
    });
  }, [users, billing, filterType, search]);

  const totalUnpaidAmount = unpaidUsers.reduce((s, { price }) => s + Number(price||0), 0);

  // ── WA send ──────────────────────────────────────────────────────────────
  const cleanPhone = (p) => p.replace(/^0/,'62').replace(/\D/g,'');

  const buildMsg = (row) => {
    const { user, rec, daysLeft } = row;
    const tmpl = waSettings.template || 'Halo *{nama}*, tagihan Bronet Anda jatuh tempo {tanggal}. Segera bayar!';
    const due  = rec?.dueDate ? new Date(rec.dueDate) : null;
    return tmpl
      .replace('{nama}',    user.name)
      .replace('{username}',user.name)
      .replace('{paket}',   user.profile || '-')
      .replace('{harga}',   fmtRp(row.price))
      .replace('{tanggal}', due ? format(due,'dd MMMM yyyy',{locale:idLocale}) : '-')
      .replace('{sisa}',    daysLeft !== null ? (daysLeft < 0 ? `TERLAMBAT ${Math.abs(daysLeft)} hari` : `${daysLeft} hari lagi`) : '-')
      .replace('{phone}',   row.phone || '-');
  };

  const sendWA = async (row) => {
    if (!row.phone) return toast.error('No. HP tidak tersedia');
    const phone = cleanPhone(row.phone);
    if (waSettings.token) {
      setSending(row.user.name);
      try {
        const body = new FormData();
        body.append('target', phone); body.append('message', buildMsg(row)); body.append('typing','true');
        const r = await fetch('https://api.fonnte.com/send', { method:'POST', headers:{ Authorization: waSettings.token }, body });
        const j = await r.json();
        if (j.status === true) { toast.success('Terkirim via Fonnte!'); addLog(row.user.name, row.phone, 'Reminder unpaid via Fonnte'); }
        else toast.error('Fonnte: ' + (j.reason || 'error'));
      } catch(e) { toast.error('Gagal: ' + e.message); }
      setSending(null);
    } else {
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(buildMsg(row))}`, '_blank');
      addLog(row.user.name, row.phone, 'Reminder unpaid via WA Web');
    }
  };

  const deleteBillingRecord = (username) => {
    const BILLING_KEY = 'bronet_billing_v2';
    try {
      const cur = JSON.parse(localStorage.getItem(BILLING_KEY) || '[]');
      const updated = cur.filter(b => b.username !== username);
      localStorage.setItem(BILLING_KEY, JSON.stringify(updated));
      setBilling(updated);
      toast.success('Data tagihan user dihapus');
    } catch(e) { toast.error('Gagal hapus'); }
  };

  const addLog = (username, phone, message) => {
    const nl = [...getLogs(), { id:Date.now(), username, phone, message, sentAt:new Date().toISOString() }];
    saveLogs(nl);
  };

  const bulkSend = () => {
    if (!unpaidUsers.length) return toast('Tidak ada user yang perlu diingatkan');
    unpaidUsers.forEach(row => { if (row.phone) sendWA(row); });
  };

  // ── export ───────────────────────────────────────────────────────────────
  const doExport = () => {
    exportXLSX([
      {
        name: 'User Belum Bayar',
        headers: ['No','ID Pelanggan','Nama Lengkap','Username','Paket','Harga/bln','No. HP','Email','Jatuh Tempo','Hari Telat/Sisa','Status','Disabled'],
        rows: unpaidUsers.map(({ user:u, rec, status, phone, email, price, daysOver, daysLeft },i) => {
          const parsed = parseComment(u.comment);
          return [
          i+1,
          parsed.customerId || '-',
          parsed.fullName || '-',
          u.name,
          u.profile,
          fmtRp(price),
          phone || '-',
          email || '-',
          rec?.dueDate ? fmtDate(rec.dueDate) : '-',
          status === 'overdue' ? `Telat ${daysOver} hari` : daysLeft !== null ? `Sisa ${daysLeft} hari` : '-',
          status === 'overdue' ? 'TERLAMBAT' : status === 'due-soon' ? 'SEGERA JT' : 'BELUM ADA DATA',
          u.disabled === 'true' ? 'Nonaktif' : 'Aktif',
          ];
        }),
        colWidths: [5,14,18,18,16,16,15,25,16,16,14,10],
      },
      {
        name: 'Ringkasan',
        headers: ['Keterangan','Jumlah'],
        rows: [
          ['Total User Belum Bayar', unpaidUsers.length],
          ['Total Tagihan Tertunggak', fmtRp(totalUnpaidAmount)],
          ['Terlambat', unpaidUsers.filter(r=>r.status==='overdue').length],
          ['Segera Jatuh Tempo', unpaidUsers.filter(r=>r.status==='due-soon').length],
          ['Tidak Ada Data', unpaidUsers.filter(r=>r.status==='no-record').length],
          ['', ''],
          ['Digenerate', format(new Date(),'dd/MM/yyyy HH:mm')],
        ],
        colWidths: [28, 22],
      },
    ], `Laporan-Belum-Bayar-${format(new Date(),'yyyyMMdd')}.xlsx`);
    toast.success('Export berhasil!');
  };

  const STATUS_CFG = {
    'overdue':   { label:'TERLAMBAT', bg:'bg-red-500/10 border-red-500/30 text-red-400' },
    'due-soon':  { label:'SEGERA JT', bg:'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' },
    'no-record': { label:'BLM ADA DATA', bg:'bg-gray-500/10 border-gray-500/30 text-gray-400' },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Laporan Belum Bayar</h1>
          <p className="text-gray-500 text-sm mt-1">{unpaidUsers.length} user · Tunggakan {fmtRp(totalUnpaidAmount)}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={bulkSend} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/20 text-green-400 border border-green-500/30 text-sm hover:bg-green-500/30">
            <Send size={16}/>{waSettings.token ? 'Blast via Fonnte' : 'Blast WA Web'}
          </button>
          <button onClick={doExport} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-sm hover:bg-emerald-500/30">
            <Download size={16}/>Export XLSX
          </button>
          <button onClick={() => { setLoading(true); callMikrotik('/ppp/secret','GET').then(r => { setUsers(r.success && Array.isArray(r.data)?r.data:MOCK_PPP_SECRETS); setBilling(getBilling()); setLoading(false); }); }}
            className="p-2 rounded-lg border border-border text-gray-400 hover:text-white">
            <RefreshCw size={18} className={loading ? 'spinner' : ''}/>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label:'Total Belum Bayar', value: unpaidUsers.length, color:'text-white' },
          { label:'Terlambat', value: unpaidUsers.filter(r=>r.status==='overdue').length, color:'text-red-400' },
          { label:'Segera JT (<7h)', value: unpaidUsers.filter(r=>r.status==='due-soon').length, color:'text-yellow-400' },
          { label:'Total Tunggakan', value: fmtRp(totalUnpaidAmount), color:'text-red-400' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center">
            <div className={`text-xl font-bold mono ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter + Search */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari username / no. HP..."
            className="input-cyber w-full pl-9 pr-4 py-2.5 rounded-lg text-sm"/>
        </div>
        <div className="flex gap-1">
          {[['all-unpaid','Semua'],['overdue','Terlambat'],['due-soon','Segera JT'],['no-record','No Data']].map(([v,l]) => (
            <button key={v} onClick={() => setFilterType(v)}
              className={clsx('px-3 py-2.5 rounded-lg text-xs border transition-all',
                filterType===v ? 'bg-primary/20 text-primary border-primary/50' : 'border-border text-gray-400 hover:text-white')}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-darker/50">
              {['STATUS','ID PELANGGAN','USERNAME','PAKET','HARGA','NO. HP','JATUH TEMPO','KETERLAMBATAN','AKSI'].map((h,i) => (
                <th key={h} className={clsx('px-4 py-3 text-xs text-gray-500 font-medium', i===7?'text-right':'text-left')}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-12 text-gray-600">
                  <RefreshCw size={22} className="spinner mx-auto mb-2"/>Memuat...
                </td></tr>
              ) : !unpaidUsers.length ? (
                <tr><td colSpan={9} className="text-center py-12 text-gray-600">
                  <UserX size={36} className="mx-auto mb-2 opacity-30"/>Semua user sudah lunas!
                </td></tr>
              ) : unpaidUsers.map(row => {
                const cfg = STATUS_CFG[row.status] || STATUS_CFG['no-record'];
                return (
                  <tr key={row.user['.id']} className="table-row border-b border-border/50 last:border-0">
                    <td className="px-4 py-3">
                      <span className={clsx('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border font-semibold', cfg.bg)}>
                        {row.status === 'overdue' && <AlertTriangle size={10}/>}
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {(() => { const { customerId, fullName } = parseComment(row.user.comment); return (
                        <div>
                          <div className="text-xs mono text-primary/80">{customerId || '-'}</div>
                          {fullName && <div className="text-xs text-gray-500">{fullName}</div>}
                        </div>
                      );})()}
                    </td>
                    <td className="px-4 py-3 mono font-medium text-white">{row.user.name}</td>
                    <td className="px-4 py-3"><span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded mono">{row.user.profile}</span></td>
                    <td className="px-4 py-3 text-red-400 font-bold mono text-xs">{fmtRp(row.price)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-gray-400 text-xs mono">
                        <Phone size={11}/>{row.phone || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 mono">
                      {row.rec?.dueDate ? format(new Date(row.rec.dueDate),'dd MMM yyyy',{locale:idLocale}) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      {row.status === 'overdue' ? (
                        <span className="text-red-400 font-bold mono">{row.daysOver} hari</span>
                      ) : row.daysLeft !== null ? (
                        <span className="text-yellow-400 mono">Sisa {row.daysLeft} hari</span>
                      ) : <span className="text-gray-600 text-xs">-</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {row.phone && (
                          <button onClick={() => sendWA(row)} disabled={sending === row.user.name}
                            title={waSettings.token ? 'Kirim via Fonnte' : 'Buka WA Web'}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-500/15 text-green-400 border border-green-500/30 hover:bg-green-500/25 text-xs transition-all disabled:opacity-40">
                            {sending === row.user.name ? <Loader size={12} className="spinner"/> : <MessageCircle size={12}/>}
                            Ingatkan
                          </button>
                        )}
                        {canDelete && row.rec && (
                          <button onClick={() => { if(window.confirm('Hapus data tagihan ' + row.user.name + '?')) deleteBillingRecord(row.user.name); }}
                            title="Hapus data tagihan user ini"
                            className="p-1.5 rounded-lg text-red-400 hover:bg-red-400/10 transition-colors">
                            <Trash2 size={14}/>
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
        {unpaidUsers.length > 0 && (
          <div className="px-4 py-3 border-t border-border text-xs text-gray-500 flex justify-between">
            <span>{unpaidUsers.length} user belum bayar</span>
            <span>Total tunggakan: <span className="text-red-400 font-semibold">{fmtRp(totalUnpaidAmount)}</span></span>
          </div>
        )}
      </div>
    </div>
  );
}
