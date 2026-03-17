import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RotateCcw, ExternalLink, Search, RefreshCw, Activity } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { useApp } from '../../contexts/AppContext';
import { parseComment } from '../../utils/mockData';

function fmtBytes(bps) {
  if (!bps || bps === 0) return '0 bps';
  if (bps >= 1e6) return (bps/1e6).toFixed(1) + ' Mbps';
  if (bps >= 1e3) return (bps/1e3).toFixed(0) + ' Kbps';
  return bps + ' bps';
}

export default function RemoteRouter() {
  const { callMikrotik, settings } = useApp();
  const [users,    setUsers]    = useState([]);
  const [active,   setActive]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [resetting, setResetting] = useState(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [usersR, activeR] = await Promise.all([
      callMikrotik('/ppp/secret', 'GET'),
      callMikrotik('/ppp/active', 'GET'),
    ]);
    if (usersR.success) setUsers(usersR.data || []);
    if (activeR.success) setActive(activeR.data || []);
    setLoading(false);
  };

  const resetConnection = async (username) => {
    if (!window.confirm(`Reset koneksi PPPoE untuk ${username}?`)) return;
    setResetting(username);
    // Find active session ID
    const session = active.find(a => a.name === username);
    if (session) {
      const result = await callMikrotik(`/ppp/active/${session['.id']}`, 'DELETE');
      if (result.success) {
        toast.success(`Koneksi ${username} berhasil direset`);
        setTimeout(fetchData, 1500);
      } else {
        toast.error('Gagal reset: ' + result.error);
      }
    } else {
      toast.error('User tidak sedang online');
    }
    setResetting(null);
  };

  const openWebFig = (userIp) => {
    if (!userIp) return toast.error('IP customer tidak tersedia');
    window.open(`http://${userIp}`, '_blank');
  };

  const openMikrotikWebFig = () => {
    window.open(`http://${settings.host}`, '_blank');
  };

  const getActiveSession = (name) => active.find(a => a.name === name);

  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    parseComment(u.comment).phone?.includes(search)
  );

  const onlineCount  = active.length;
  const offlineCount = users.length - onlineCount;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Remote Router</h1>
          <p className="text-gray-500 text-sm mt-1">Monitor & kelola koneksi customer</p>
        </div>
        <div className="flex gap-2">
          <button onClick={openMikrotikWebFig}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-gray-300 hover:text-white text-sm">
            <ExternalLink size={15}/>WebFig Mikrotik
          </button>
          <button onClick={fetchData} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary border border-primary/30 text-sm">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''}/>Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total User', value: users.length, color: 'text-white' },
          { label: 'Online',     value: onlineCount,  color: 'text-green-400' },
          { label: 'Offline',    value: offlineCount, color: 'text-gray-500' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center">
            <div className={clsx('text-3xl font-bold mono', s.color)}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Cari username atau no HP..."
          className="input-cyber w-full pl-10 pr-4 py-2.5 rounded-xl text-sm"/>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-darker">
              {['STATUS','USERNAME','PAKET','IP ADDRESS','RX / TX','AKSI'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs text-gray-500 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-500">Memuat data...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-600">Tidak ada data</td></tr>
            ) : filtered.map(u => {
              const session = getActiveSession(u.name);
              const isOnline = !!session;
              return (
                <tr key={u['.id']} className="border-b border-border/50 hover:bg-darker/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={clsx('w-2 h-2 rounded-full', isOnline ? 'bg-green-400' : 'bg-gray-600')}/>
                      <span className={clsx('text-xs mono', isOnline ? 'text-green-400' : 'text-gray-600')}>
                        {isOnline ? 'ONLINE' : 'OFFLINE'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 mono text-white text-sm">{u.name}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-1 rounded bg-primary/10 text-primary mono">{u.profile || '-'}</span>
                  </td>
                  <td className="px-4 py-3 mono text-xs text-gray-400">
                    {session ? (
                      <div>
                        <div>{session.address || '-'}</div>
                        <div className="text-gray-600 text-xs">{session['caller-id'] || ''}</div>
                      </div>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {session ? (
                      <div className="space-y-0.5">
                        <div className="text-blue-400">↓ {fmtBytes(parseInt(session['rx-byte']))}</div>
                        <div className="text-orange-400">↑ {fmtBytes(parseInt(session['tx-byte']))}</div>
                      </div>
                    ) : <span className="text-gray-600">-</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => resetConnection(u.name)}
                        disabled={resetting === u.name}
                        title="Reset koneksi PPPoE"
                        className={clsx('p-1.5 rounded-lg text-xs transition-colors flex items-center gap-1',
                          isOnline ? 'text-yellow-400 hover:bg-yellow-400/10' : 'text-gray-600 cursor-not-allowed')}>
                        <RotateCcw size={14} className={resetting === u.name ? 'animate-spin' : ''}/>
                      </button>
                      {session?.address && (
                        <button onClick={() => openWebFig(session.address)}
                          title="Buka WebFig router customer"
                          className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-400/10">
                          <ExternalLink size={14}/>
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
  );
}
