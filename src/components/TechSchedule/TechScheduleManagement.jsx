import React, { useState, useEffect } from 'react';
import { Wrench, Clock, CheckCircle, XCircle, RefreshCw, User } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { loadSchedules, saveSchedule } from '../../utils/db';

const STATUS = {
  pending:     { label:'Menunggu',     color:'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' },
  confirmed:   { label:'Dikonfirmasi', color:'text-blue-400 bg-blue-500/10 border-blue-500/30' },
  in_progress: { label:'Sedang Dikerjakan', color:'text-orange-400 bg-orange-500/10 border-orange-500/30' },
  done:        { label:'Selesai',      color:'text-green-400 bg-green-500/10 border-green-500/30' },
  cancelled:   { label:'Dibatalkan',   color:'text-gray-400 bg-gray-500/10 border-gray-500/30' },
};

export default function TechScheduleManagement() {
  const [schedules, setSchedules] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState('all');
  const [selected,  setSelected]  = useState(null);
  const [tech,      setTech]      = useState('');
  const [adminNote, setAdminNote] = useState('');

  useEffect(() => {
    loadSchedules().then(d => { setSchedules(d||[]); setLoading(false); });
  }, []);

  const updateStatus = async (sched, status) => {
    const updated = { ...sched, status, technician: tech||sched.technician, admin_note: adminNote||sched.admin_note, updated_at: new Date().toISOString() };
    await saveSchedule(updated);
    setSchedules(prev => prev.map(s => s.id===sched.id ? updated : s));
    if (selected?.id === sched.id) setSelected(updated);
    toast.success('Status jadwal diupdate');
  };

  const filtered = filter==='all' ? schedules : schedules.filter(s => s.status===filter);
  const fmtDate = (d) => { try { return format(new Date(d),'dd MMM yyyy',{locale:idLocale}); } catch { return d||'-'; } };

  return (
    <div className="flex gap-0 h-[calc(100vh-120px)] -mx-6 -my-4">
      {/* Left */}
      <div className="w-80 flex-shrink-0 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="text-white font-semibold text-base">Jadwal Teknisi</h2>
          <div className="flex gap-1 mt-3 flex-wrap">
            {['all',...Object.keys(STATUS)].map(s => (
              <button key={s} onClick={() => setFilter(s)}
                className={clsx('text-xs px-2 py-1 rounded-lg border transition-all',
                  filter===s ? 'bg-primary/20 text-primary border-primary/40' : 'border-border text-gray-500 hover:text-gray-300')}>
                {s==='all'?`Semua (${schedules.length})`:STATUS[s]?.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? <div className="text-center py-8 text-gray-500 text-sm">Memuat...</div>
          : filtered.length===0 ? <div className="text-center py-8 text-gray-600 text-sm">Tidak ada jadwal</div>
          : filtered.map(s => (
            <button key={s.id} onClick={() => { setSelected(s); setTech(s.technician||''); setAdminNote(s.admin_note||''); }}
              className={clsx('w-full text-left p-4 border-b border-border/50 hover:bg-darker transition-colors',
                selected?.id===s.id ? 'bg-primary/5 border-l-2 border-l-primary' : '')}>
              <div className="flex items-start justify-between gap-2">
                <span className="text-white text-sm font-medium line-clamp-1">{s.full_name||s.pppoe_username}</span>
                <span className={clsx('text-xs px-2 py-0.5 rounded-full border flex-shrink-0', STATUS[s.status]?.color)}>
                  {STATUS[s.status]?.label}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1 mono">{s.pppoe_username}</p>
              <p className="text-xs text-primary mt-1">{fmtDate(s.schedule_date)} {s.schedule_time && `· ${s.schedule_time}`}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Right */}
      {!selected ? (
        <div className="flex-1 flex items-center justify-center text-gray-600">
          <div className="text-center"><Wrench size={40} className="mx-auto mb-3 opacity-30"/><p className="text-sm">Pilih jadwal untuk detail</p></div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <h3 className="text-white font-bold text-lg">{selected.full_name || selected.pppoe_username}</h3>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label:'Username PPPoE', value: selected.pppoe_username },
              { label:'No. HP', value: selected.phone||'-' },
              { label:'Tanggal', value: fmtDate(selected.schedule_date) },
              { label:'Waktu', value: selected.schedule_time||'-' },
            ].map(row => (
              <div key={row.label} className="bg-darker rounded-xl p-3">
                <p className="text-xs text-gray-500">{row.label}</p>
                <p className="text-white text-sm font-medium mt-0.5">{row.value}</p>
              </div>
            ))}
          </div>
          {selected.address && (
            <div className="bg-darker rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">Alamat</p>
              <p className="text-white text-sm">{selected.address}</p>
            </div>
          )}
          {selected.complaint && (
            <div className="bg-darker rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">Keluhan</p>
              <p className="text-white text-sm">{selected.complaint}</p>
            </div>
          )}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <h4 className="text-white font-semibold text-sm">Tindak Lanjut Admin</h4>
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Nama Teknisi</label>
              <input value={tech} onChange={e => setTech(e.target.value)} className="input-cyber w-full px-3 py-2 rounded-lg text-sm" placeholder="Nama teknisi yang ditugaskan"/>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Catatan Admin</label>
              <textarea value={adminNote} onChange={e => setAdminNote(e.target.value)} rows={2} className="input-cyber w-full px-3 py-2 rounded-lg text-sm resize-none" placeholder="Catatan untuk customer..."/>
            </div>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(STATUS).map(([k,v]) => (
                <button key={k} onClick={() => updateStatus(selected, k)}
                  className={clsx('px-3 py-1.5 rounded-lg text-xs border transition-all',
                    selected.status===k ? v.color : 'border-border text-gray-500 hover:text-gray-300')}>
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
