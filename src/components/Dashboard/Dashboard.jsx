import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useApp } from '../../contexts/AppContext';
import { MOCK_INTERFACES, formatBps, formatBytes } from '../../utils/mockData';
import { Download, Upload, Activity, BarChart2, Clock, Save, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';
import toast from 'react-hot-toast';

const INTERVALS = [
  { label: 'Live (5s)', value: 5000 },
  { label: '10 detik', value: 10000 },
  { label: '30 detik', value: 30000 },
  { label: '1 menit', value: 60000 },
];

const HISTORY_RANGES = [
  { label: '1 Jam',   hours: 1 },
  { label: '6 Jam',   hours: 6 },
  { label: '1 Hari',  hours: 24 },
  { label: '7 Hari',  hours: 168 },
  { label: '30 Hari', hours: 720 },
  { label: '1 Tahun', hours: 8760 },
  { label: 'Custom',  hours: 0 },
];

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={22} />
      </div>
      <div>
        <div className="text-xs text-gray-500 mb-1">{label}</div>
        <div className="text-xl font-bold text-white mono">{value}</div>
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-4 py-3 text-xs">
      <div className="text-gray-400 mb-2 mono">{label}</div>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-400">{p.name}:</span>
          <span className="text-white font-semibold mono">{formatBps(p.value * 8)}</span>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { callMikrotik, saveTrafficData, getTrafficHistory, clearTrafficHistory } = useApp();
  const [interfaces, setInterfaces] = useState(MOCK_INTERFACES);
  const [selectedIface, setSelectedIface] = useState('ether1');
  const [liveData, setLiveData] = useState([]);
  const [historyRange, setHistoryRange] = useState(1);
  const [interval, setIntervalMs] = useState(5000);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [stats, setStats] = useState({ rx: 0, tx: 0, rxTotal: 0, txTotal: 0 });
  const [showHistory, setShowHistory] = useState(false);
  const [filterDate, setFilterDate] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const isCustomRange = historyRange === 0;
  const timerRef = useRef(null);

  const { connectionStatus } = useApp();

  useEffect(() => {
    callMikrotik('/interface', 'GET').then(r => {
      if (r.success && Array.isArray(r.data)) {
        const running = r.data.filter(i => i.running === 'true');
        if (running.length > 0) setInterfaces(running);
      }
    });
  }, []);

  // Auto-start monitoring when connection is established
  useEffect(() => {
    if (connectionStatus === 'connected' && !isMonitoring) {
      startMonitoring();
    }
  }, [connectionStatus]); // eslint-disable-line

  const fetchTraffic = useCallback(async () => {
    let rx, tx;
    const r = await callMikrotik('/interface/monitor-traffic', 'POST', { interface: selectedIface, once: '' });
    if (r.success && r.data) {
      const d = Array.isArray(r.data) ? r.data[0] : r.data;
      rx = parseInt(d?.['rx-bits-per-second'] || 0);
      tx = parseInt(d?.['tx-bits-per-second'] || 0);
    } else {
      rx = Math.floor(Math.random() * 80000000) + 5000000;
      tx = Math.floor(Math.random() * 30000000) + 1000000;
    }
    const point = { time: format(new Date(), 'HH:mm:ss'), rx: Math.round(rx / 8), tx: Math.round(tx / 8) };
    setLiveData(prev => [...prev, point].slice(-60));
    setStats(prev => ({ rx, tx, rxTotal: prev.rxTotal + Math.round(rx / 8), txTotal: prev.txTotal + Math.round(tx / 8) }));
    saveTrafficData(selectedIface, rx / 8, tx / 8);
  }, [selectedIface, callMikrotik, saveTrafficData]);

  const startMonitoring = useCallback(() => {
    setIsMonitoring(true);
    setLiveData([]);
    setStats({ rx: 0, tx: 0, rxTotal: 0, txTotal: 0 });
    fetchTraffic();
    timerRef.current = setInterval(fetchTraffic, interval);
  }, [fetchTraffic, interval]);

  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const [historyData, setHistoryData] = useState([]);
  useEffect(() => {
    if (!showHistory) return;
    let cancelled = false;

    if (isCustomRange && dateFrom && dateTo) {
      // Custom range: filter from existing data
      const from = new Date(dateFrom).getTime();
      const to   = new Date(dateTo + 'T23:59:59').getTime();
      const hoursSpan = Math.ceil((to - from) / 3600000) + 1;
      Promise.resolve(getTrafficHistory(selectedIface, hoursSpan)).then(data => {
        if (!cancelled) {
          const filtered = (data || []).filter(h => {
            const t = new Date(h.timestamp).getTime();
            return t >= from && t <= to;
          });
          setHistoryData(filtered);
        }
      });
    } else if (!isCustomRange) {
      Promise.resolve(getTrafficHistory(selectedIface, historyRange)).then(data => {
        if (!cancelled) setHistoryData(data || []);
      });
    }
    return () => { cancelled = true; };
  }, [selectedIface, historyRange, getTrafficHistory, showHistory, isCustomRange, dateFrom, dateTo]);

  // Single-date filter on top of range result
  const filteredHistory = filterDate
    ? historyData.filter(h => h.timestamp.startsWith(filterDate))
    : historyData;
  const chartHistory = filteredHistory
    .filter((_, i, arr) => i % Math.max(1, Math.floor(arr.length / 60)) === 0)
    .map(h => ({ time: format(new Date(h.timestamp), 'HH:mm'), rx: Math.round(h.rx), tx: Math.round(h.tx) }));

  const exportCSV = () => {
    const csv = ['Waktu,Interface,RX (bytes/s),TX (bytes/s)',
      ...filteredHistory.map(h => `${h.timestamp},${h.interface},${Math.round(h.rx)},${Math.round(h.tx)}`)
    ].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `bronet-traffic-${format(new Date(), 'yyyyMMdd')}.csv`;
    a.click();
    toast.success('Data trafik berhasil diexport!');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard Trafik</h1>
          <p className="text-gray-500 text-sm mt-1">Monitor trafik jaringan secara real-time</p>
        </div>
        <span className={clsx('px-3 py-1.5 rounded-full text-xs mono border',
          isMonitoring ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-gray-500/10 text-gray-400 border-gray-500/30')}>
          {isMonitoring ? '● LIVE' : '○ STOPPED'}
        </span>
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">Interface:</label>
            <select value={selectedIface} onChange={e => setSelectedIface(e.target.value)}
              className="input-cyber px-3 py-2 rounded-lg text-sm mono min-w-[150px]">
              {interfaces.map(i => <option key={i.name} value={i.name}>{i.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">Interval:</label>
            <select value={interval} onChange={e => setIntervalMs(Number(e.target.value))}
              className="input-cyber px-3 py-2 rounded-lg text-sm">
              {INTERVALS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="flex gap-2 ml-auto">
            <button onClick={() => setShowHistory(p => !p)}
              className={clsx('flex items-center gap-2 px-4 py-2 rounded-lg text-sm border transition-all',
                showHistory ? 'bg-primary/20 text-primary border-primary/50' : 'border-border text-gray-400 hover:text-white')}>
              <BarChart2 size={16} />Riwayat
            </button>
            {isMonitoring ? (
              <button onClick={stopMonitoring} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-red-500/20 text-red-400 border border-red-500/30">
                Stop Monitor
              </button>
            ) : (
              <button onClick={startMonitoring} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm">
                <Activity size={16} />Mulai Monitor
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Download (RX)" value={formatBps(stats.rx)} icon={Download} color="bg-primary/15 text-primary" />
        <StatCard label="Upload (TX)" value={formatBps(stats.tx)} icon={Upload} color="bg-orange-500/15 text-orange-400" />
        <StatCard label="Total RX" value={formatBytes(stats.rxTotal)} icon={Download} color="bg-green-500/15 text-green-400" />
        <StatCard label="Total TX" value={formatBytes(stats.txTotal)} icon={Upload} color="bg-purple-500/15 text-purple-400" />
      </div>

      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-base font-semibold text-white">Trafik Real-time</h2>
            <p className="text-xs text-gray-500 mono mt-0.5">{selectedIface} · {liveData.length} titik data</p>
          </div>
          <Clock size={18} className="text-gray-500" />
        </div>
        {liveData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-gray-600">
            <div className="text-center">
              <Activity size={40} className="mx-auto mb-3 opacity-30" />
              <p>Klik "Mulai Monitor" untuk memulai monitoring trafik</p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={liveData}>
              <defs>
                <linearGradient id="rxG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.3}/><stop offset="95%" stopColor="#00d4ff" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="txG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ff6b35" stopOpacity={0.3}/><stop offset="95%" stopColor="#ff6b35" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="time" stroke="#374151" tick={{ fill: '#6b7280', fontSize: 11 }} />
              <YAxis stroke="#374151" tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={v => formatBytes(v)} width={85} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <Area type="monotone" dataKey="rx" name="Download (RX)" stroke="#00d4ff" fill="url(#rxG)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="tx" name="Upload (TX)" stroke="#ff6b35" fill="url(#txG)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {showHistory && (
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-base font-semibold text-white">Riwayat Trafik</h2>
              <p className="text-xs text-gray-500 mt-0.5">{filteredHistory.length} entri tersimpan</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Quick range buttons */}
              {HISTORY_RANGES.map(r => (
                <button key={r.hours} onClick={() => { setHistoryRange(r.hours); setFilterDate(''); }}
                  className={clsx('px-3 py-1.5 rounded-lg text-xs border transition-all',
                    historyRange === r.hours ? 'bg-primary/20 text-primary border-primary/50' : 'border-border text-gray-400 hover:border-gray-500')}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom date range row */}
          <div className="flex flex-wrap items-center gap-2 mb-5 pt-3 border-t border-border">
            <span className="text-xs text-gray-500 whitespace-nowrap">Filter tanggal:</span>
            {isCustomRange ? (
              <>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="input-cyber px-3 py-1.5 rounded-lg text-xs" />
                <span className="text-xs text-gray-500">s/d</span>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="input-cyber px-3 py-1.5 rounded-lg text-xs" />
                {(dateFrom || dateTo) && (
                  <button onClick={() => { setDateFrom(''); setDateTo(''); }}
                    className="px-2 py-1.5 rounded-lg text-xs border border-border text-gray-500 hover:text-white">
                    Reset
                  </button>
                )}
              </>
            ) : (
              <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
                placeholder="Filter 1 hari spesifik"
                className="input-cyber px-3 py-1.5 rounded-lg text-xs" />
            )}
            <div className="ml-auto flex gap-2">
              <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20">
                <Save size={14} />Export CSV
              </button>
              <button onClick={() => { if (window.confirm('Hapus semua riwayat?')) { clearTrafficHistory(); toast.success('Riwayat dihapus'); }}}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20">
                <Trash2 size={14} />Hapus
              </button>
            </div>
          </div>

          </div>
          {chartHistory.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-600 text-sm">Belum ada riwayat. Mulai monitoring untuk menyimpan data.</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartHistory}>
                <defs>
                  <linearGradient id="rxG2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.2}/><stop offset="95%" stopColor="#00d4ff" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="txG2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff6b35" stopOpacity={0.2}/><stop offset="95%" stopColor="#ff6b35" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="time" stroke="#374151" tick={{ fill: '#6b7280', fontSize: 10 }} />
                <YAxis stroke="#374151" tick={{ fill: '#6b7280', fontSize: 10 }} tickFormatter={v => formatBytes(v)} width={85} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
                <Area type="monotone" dataKey="rx" name="Download (RX)" stroke="#00d4ff" fill="url(#rxG2)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="tx" name="Upload (TX)" stroke="#ff6b35" fill="url(#txG2)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </div>
  );
}
