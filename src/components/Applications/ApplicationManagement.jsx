import React, { useState, useEffect } from 'react';
import { UserPlus, Phone, MessageSquare, CheckCircle, XCircle, Clock, RefreshCw, Eye } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { loadApplications, saveApplication } from '../../utils/db';
import { useApp } from '../../contexts/AppContext';

const STATUS = {
  pending:   { label:'Menunggu',    color:'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' },
  contacted: { label:'Dihubungi',   color:'text-blue-400 bg-blue-500/10 border-blue-500/30' },
  approved:  { label:'Disetujui',   color:'text-green-400 bg-green-500/10 border-green-500/30' },
  rejected:  { label:'Ditolak',     color:'text-red-400 bg-red-500/10 border-red-500/30' },
};

const fmtDate = d => { try { return format(new Date(d), 'dd MMM yyyy HH:mm', { locale: idLocale }); } catch { return '-'; } };

export default function ApplicationManagement() {
  const { settings } = useApp();
  const [apps,     setApps]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState('all');
  const [selected, setSelected] = useState(null);
  const [adminNote, setAdminNote] = useState('');
  const [saving,   setSaving]   = useState(false);

  useEffect(() => { fetchApps(); }, []);

  const fetchApps = async () => {
    setLoading(true);
    const data = await loadApplications();
    setApps(data || []);
    setLoading(false);
  };

  const updateStatus = async (app, status) => {
    setSaving(true);
    const updated = {
      ...app,
      status,
      admin_note: adminNote || app.admin_note || '',
      updated_at: new Date().toISOString(),
    };
    await saveApplication(updated);
    setApps(prev => prev.map(a => a.id === app.id ? updated : a));
    if (selected?.id === app.id) setSelected(updated);
    toast.success('Status diupdate!');
    setSaving(false);
  };

  const openWhatsApp = (app) => {
    const phone = (app.phone || '').replace(/\D/g, '');
    const waPhone = phone.startsWith('0') ? '62' + phone.slice(1) : phone;
    const pkg = app.profile ? `Paket: *${app.profile}*\n` : '';
    const addr = app.address ? `Alamat: ${app.address}\n` : '';
    const msg = `Halo *${app.full_name}*, terima kasih telah mendaftar sebagai pelanggan baru Bronet! 🌐\n\n${pkg}${addr}\nKami ingin mengkonfirmasi jadwal pemasangan internet Anda. Kapan waktu yang cocok?\n\nTerima kasih! 🙏`;
    window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`, '_blank');
    // Auto-update status to contacted
    if (app.status === 'pending') updateStatus(app, 'contacted');
  };

  const filtered = filter === 'all' ? apps : apps.filter(a => a.status === filter);
  const pendingCount = apps.filter(a => a.status === 'pending').length;

  return (
    <div className="flex gap-0 h-[calc(100vh-120px)] -mx-6 -my-4">
      {/* Left: list */}
      <div className="w-80 flex-shrink-0 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-semibold">Permohonan Pelanggan</h2>
            {pendingCount > 0 && (
              <span className="bg-yellow-500/20 text-yellow-400 text-xs px-2 py-1 rounded-full font-semibold">
                {pendingCount} baru
              </span>
            )}
          </div>
          <div className="flex gap-1 flex-wrap">
            {['all', ...Object.keys(STATUS)].map(s => (
              <button key={s} onClick={() => setFilter(s)}
                className={clsx('text-xs px-2.5 py-1 rounded-lg border transition-all',
                  filter === s ? 'bg-primary/20 text-primary border-primary/40' : 'border-border text-gray-500 hover:text-gray-300')}>
                {s === 'all' ? `Semua (${apps.length})` : `${STATUS[s].label} (${apps.filter(a => a.status === s).length})`}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? <div className="text-center py-10 text-gray-500 text-sm">Memuat...</div>
          : filtered.length === 0 ? <div className="text-center py-10 text-gray-600 text-sm">Tidak ada permohonan</div>
          : filtered.map(app => (
            <button key={app.id} onClick={() => { setSelected(app); setAdminNote(app.admin_note || ''); }}
              className={clsx('w-full text-left p-4 border-b border-border/50 hover:bg-darker transition-colors',
                selected?.id === app.id ? 'bg-primary/5 border-l-2 border-l-primary' : '')}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{app.full_name}</p>
                  <p className="text-gray-500 text-xs mono mt-0.5">{app.phone}</p>
                  {app.profile && <p className="text-primary text-xs mt-1">{app.profile}</p>}
                </div>
                <span className={clsx('text-xs px-2 py-0.5 rounded-full border flex-shrink-0 mt-0.5', STATUS[app.status]?.color)}>
                  {STATUS[app.status]?.label}
                </span>
              </div>
              <p className="text-gray-600 text-xs mt-1.5">{fmtDate(app.created_at)}</p>
            </button>
          ))}
        </div>

        <div className="p-3 border-t border-border">
          <button onClick={fetchApps} className="w-full flex items-center justify-center gap-2 py-2 text-xs text-gray-500 hover:text-gray-300">
            <RefreshCw size={12}/>Refresh
          </button>
        </div>
      </div>

      {/* Right: detail */}
      {!selected ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-600">
            <UserPlus size={40} className="mx-auto mb-3 opacity-30"/>
            <p className="text-sm">Pilih permohonan untuk melihat detail</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-white font-bold text-xl">{selected.full_name}</h3>
              <p className="text-gray-500 text-sm">{fmtDate(selected.created_at)}</p>
            </div>
            <span className={clsx('text-sm px-3 py-1.5 rounded-full border font-semibold', STATUS[selected.status]?.color)}>
              {STATUS[selected.status]?.label}
            </span>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'No. HP / WA', value: selected.phone, mono: true },
              { label: 'Paket Diminati', value: selected.profile || '-' },
            ].map(row => (
              <div key={row.label} className="bg-darker rounded-xl p-3.5">
                <p className="text-xs text-gray-500 mb-1">{row.label}</p>
                <p className={clsx('text-white font-semibold text-sm', row.mono && 'mono')}>{row.value}</p>
              </div>
            ))}
          </div>

          {selected.address && (
            <div className="bg-darker rounded-xl p-3.5">
              <p className="text-xs text-gray-500 mb-1">Alamat Pemasangan</p>
              <p className="text-white text-sm">{selected.address}</p>
            </div>
          )}

          {selected.note && (
            <div className="bg-darker rounded-xl p-3.5">
              <p className="text-xs text-gray-500 mb-1">Catatan dari Pemohon</p>
              <p className="text-gray-300 text-sm">{selected.note}</p>
            </div>
          )}

          {/* WhatsApp button — main CTA */}
          <button onClick={() => openWhatsApp(selected)}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-green-500/20 border border-green-500/40 text-green-400 font-semibold text-base hover:bg-green-500/30 transition-colors">
            <Phone size={20}/>
            Chat WhatsApp — {selected.phone}
          </button>

          {/* Admin note */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <h4 className="text-white font-semibold text-sm">Tindak Lanjut</h4>
            <textarea value={adminNote} onChange={e => setAdminNote(e.target.value)}
              rows={2} placeholder="Catatan untuk pelanggan (opsional)..."
              className="input-cyber w-full px-3 py-2.5 rounded-xl text-sm resize-none"/>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(STATUS).map(([k, v]) => (
                <button key={k} onClick={() => updateStatus(selected, k)} disabled={saving}
                  className={clsx('py-2.5 rounded-xl text-sm font-semibold border transition-all disabled:opacity-40',
                    selected.status === k ? v.color : 'border-border text-gray-500 hover:text-gray-300 hover:border-gray-500')}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
