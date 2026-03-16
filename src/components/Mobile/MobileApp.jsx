import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, CreditCard, Package, History, User, ChevronRight, RefreshCw, CheckCircle, Clock, AlertCircle, ArrowDown, ArrowUp } from 'lucide-react';
import { formatBytes, parseComment, MOCK_PPP_SECRETS, MOCK_PPP_ACTIVE, MOCK_PPP_PROFILES } from '../../utils/mockData';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import clsx from 'clsx';

const MOBILE_KEY = 'bronet_mobile_session';

function Screen({ children, bg = 'bg-dark' }) {
  return <div className={`min-h-screen ${bg} pb-20`}>{children}</div>;
}

function BottomNav({ active, onChange }) {
  const items = [
    { id: 'home', icon: Wifi, label: 'Status' },
    { id: 'paket', icon: Package, label: 'Paket' },
    { id: 'tagihan', icon: CreditCard, label: 'Tagihan' },
    { id: 'riwayat', icon: History, label: 'Riwayat' },
    { id: 'profil', icon: User, label: 'Profil' },
  ];
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-darker border-t border-border flex">
      {items.map(item => (
        <button key={item.id} onClick={() => onChange(item.id)}
          className={clsx('flex-1 flex flex-col items-center py-2.5 text-xs transition-colors',
            active === item.id ? 'text-primary' : 'text-gray-500')}>
          <item.icon size={20} className="mb-1" />
          {item.label}
        </button>
      ))}
    </div>
  );
}

function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    const users = JSON.parse(localStorage.getItem('bronet_ppp_mock') || 'null') ||
      JSON.parse(JSON.stringify(MOCK_PPP_SECRETS));
    const found = users.find(u => u.name === username);
    if (!found) { setError('Username tidak ditemukan'); return; }
    if (found.password !== password) { setError('Password salah'); return; }
    const { phone, email } = parseComment(found.comment);
    sessionStorage.setItem(MOBILE_KEY, JSON.stringify({ ...found, phone, email }));
    onLogin({ ...found, phone, email });
  };

  return (
    <div className="min-h-screen bg-darker flex flex-col items-center justify-center p-6 grid-bg">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-card border border-primary/30 flex items-center justify-center mx-auto mb-4 glow">
            <Wifi size={36} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-white">BRONET</h1>
          <p className="text-gray-500 text-sm mono">Portal Pelanggan</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="text-base font-semibold text-white mb-5">Masuk ke Akun Anda</h2>
          {error && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              <AlertCircle size={16} />{error}
            </div>
          )}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Username PPPoE</label>
              <input value={username} onChange={e => setUsername(e.target.value)}
                className="input-cyber w-full px-4 py-3 rounded-xl mono text-sm" placeholder="username" required />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="input-cyber w-full px-4 py-3 rounded-xl mono text-sm" placeholder="password" required />
            </div>
            <button type="submit" className="btn-primary w-full py-3 rounded-xl font-semibold">Masuk</button>
          </form>
          <p className="text-xs text-gray-600 text-center mt-4">
            Gunakan username & password PPPoE Anda
          </p>
        </div>
      </div>
    </div>
  );
}

function HomeScreen({ user }) {
  const active = MOCK_PPP_ACTIVE.find(a => a.name === user.name);
  const isOnline = !!active;

  const profiles = JSON.parse(localStorage.getItem('bronet_profiles') || 'null') || MOCK_PPP_PROFILES;
  const profile = profiles.find(p => p.name === user.profile);

  return (
    <Screen>
      <div className="bg-gradient-to-br from-darker to-dark px-5 pt-12 pb-8">
        <p className="text-gray-400 text-sm">Selamat datang,</p>
        <h1 className="text-2xl font-bold text-white mono">{user.name}</h1>
      </div>

      {/* Connection status card */}
      <div className="mx-4 -mt-4 bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center',
              isOnline ? 'bg-green-500/15' : 'bg-red-500/15')}>
              {isOnline ? <Wifi size={24} className="text-green-400" /> : <WifiOff size={24} className="text-red-400" />}
            </div>
            <div>
              <div className={clsx('font-bold', isOnline ? 'text-green-400' : 'text-red-400')}>
                {isOnline ? 'Terhubung' : 'Tidak Terhubung'}
              </div>
              <div className="text-xs text-gray-500 mono">
                {isOnline ? `IP: ${active.address}` : 'Koneksi terputus'}
              </div>
            </div>
          </div>
          <div className={clsx('w-3 h-3 rounded-full', isOnline ? 'bg-green-400 pulse-cyan' : 'bg-red-400')} />
        </div>

        {isOnline && (
          <div className="grid grid-cols-2 gap-3 border-t border-border pt-4">
            <div className="bg-primary/5 rounded-xl p-3">
              <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                <ArrowDown size={12} className="text-primary" />Download
              </div>
              <div className="font-bold text-white mono">{formatBytes(active['rx-byte'])}</div>
            </div>
            <div className="bg-orange-500/5 rounded-xl p-3">
              <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                <ArrowUp size={12} className="text-orange-400" />Upload
              </div>
              <div className="font-bold text-white mono">{formatBytes(active['tx-byte'])}</div>
            </div>
            <div className="col-span-2 bg-card border border-border rounded-xl p-3">
              <div className="text-xs text-gray-500 mb-1">Uptime</div>
              <div className="font-bold text-white mono">{active.uptime}</div>
            </div>
          </div>
        )}
      </div>

      {/* Paket info */}
      {profile && (
        <div className="mx-4 mt-4 bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-white">Paket Aktif</h3>
            <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-lg mono">{profile.name}</span>
          </div>
          <div className="text-2xl font-bold text-primary mono mb-1">{profile['rate-limit'] || '-'}</div>
          {profile._description && <p className="text-xs text-gray-500">{profile._description}</p>}
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
            <span className="text-sm text-gray-400">Harga/Bulan</span>
            <span className="font-bold text-green-400 mono">
              {profile._price ? `Rp ${parseInt(profile._price).toLocaleString('id-ID')}` : '-'}
            </span>
          </div>
        </div>
      )}
    </Screen>
  );
}

function PaketScreen({ user }) {
  const profiles = JSON.parse(localStorage.getItem('bronet_profiles') || 'null') || MOCK_PPP_PROFILES;
  const current = profiles.find(p => p.name === user.profile);

  return (
    <Screen>
      <div className="px-5 pt-10 pb-6">
        <h1 className="text-xl font-bold text-white mb-1">Paket Internet</h1>
        <p className="text-gray-500 text-sm">Pilihan paket yang tersedia</p>
      </div>
      <div className="px-4 space-y-3">
        {profiles.filter(p => !p.disabled).map(p => (
          <div key={p['.id']} className={clsx(
            'rounded-2xl p-5 border transition-all',
            p.name === user.profile
              ? 'bg-primary/10 border-primary/50'
              : 'bg-card border-border'
          )}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-bold text-white mono">{p.name}</div>
                {p._description && <div className="text-xs text-gray-500 mt-0.5">{p._description}</div>}
              </div>
              {p.name === user.profile && (
                <span className="flex items-center gap-1 text-xs text-primary">
                  <CheckCircle size={14} />Aktif
                </span>
              )}
            </div>
            <div className="text-3xl font-black text-primary mono mb-1">{p['rate-limit'] || '-'}</div>
            <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-gray-500">
              <div>Session: <span className="text-gray-300">{p['session-timeout'] || '-'}</span></div>
              <div>Idle: <span className="text-gray-300">{p['idle-timeout'] || '-'}</span></div>
            </div>
            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
              <span className="text-sm text-gray-400">Harga</span>
              <span className={clsx('font-bold mono', p.name === user.profile ? 'text-green-400' : 'text-white')}>
                {p._price ? `Rp ${parseInt(p._price).toLocaleString('id-ID')}/bln` : '-'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Screen>
  );
}

function TagihanScreen({ user }) {
  const billing = JSON.parse(localStorage.getItem('bronet_billing') || '[]');
  const record = billing.find(b => b.username === user.name);
  const profiles = JSON.parse(localStorage.getItem('bronet_profiles') || 'null') || MOCK_PPP_PROFILES;
  const profile = profiles.find(p => p.name === user.profile);
  
  const getDueDate = () => {
    if (!record) return null;
    const now = new Date();
    let due = new Date(now.getFullYear(), now.getMonth(), record.dueDay || 1);
    if (due < now) due = new Date(now.getFullYear(), now.getMonth() + 1, record.dueDay || 1);
    return due;
  };
  const due = getDueDate();
  const daysLeft = due ? Math.floor((due - new Date()) / 86400000) : null;

  return (
    <Screen>
      <div className="px-5 pt-10 pb-6">
        <h1 className="text-xl font-bold text-white mb-1">Tagihan</h1>
        <p className="text-gray-500 text-sm">Status tagihan internet Anda</p>
      </div>
      <div className="px-4 space-y-4">
        {!record ? (
          <div className="bg-card border border-border rounded-2xl p-6 text-center">
            <CreditCard size={40} className="mx-auto mb-3 text-gray-600" />
            <p className="text-gray-400">Belum ada data tagihan.<br />Hubungi admin untuk informasi tagihan.</p>
          </div>
        ) : (
          <>
            <div className={clsx('rounded-2xl p-5 border',
              daysLeft < 0 ? 'bg-red-500/10 border-red-500/30' :
              daysLeft <= 3 ? 'bg-yellow-500/10 border-yellow-500/30' :
              'bg-green-500/10 border-green-500/30')}>
              <div className="flex items-center gap-3 mb-4">
                {daysLeft < 0 ? <AlertCircle size={24} className="text-red-400" /> :
                 daysLeft <= 3 ? <Clock size={24} className="text-yellow-400" /> :
                 <CheckCircle size={24} className="text-green-400" />}
                <div>
                  <div className={clsx('font-bold',
                    daysLeft < 0 ? 'text-red-400' : daysLeft <= 3 ? 'text-yellow-400' : 'text-green-400')}>
                    {daysLeft < 0 ? `Terlambat ${Math.abs(daysLeft)} hari` :
                     daysLeft === 0 ? 'Jatuh tempo hari ini!' :
                     `${daysLeft} hari lagi`}
                  </div>
                  <div className="text-xs text-gray-400">
                    Jatuh tempo: {due ? format(due, 'dd MMMM yyyy', { locale: id }) : '-'}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
                <div>
                  <div className="text-xs text-gray-400 mb-1">Paket</div>
                  <div className="font-semibold text-white mono">{user.profile}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-1">Harga</div>
                  <div className="font-semibold text-green-400 mono">
                    {profile?._price ? `Rp ${parseInt(profile._price).toLocaleString('id-ID')}` : '-'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-1">Tgl Jatuh Tempo</div>
                  <div className="font-semibold text-white">Tanggal {record.dueDay || 1}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-1">Terakhir Bayar</div>
                  <div className="font-semibold text-white text-xs">
                    {record.lastPaid ? format(new Date(record.lastPaid), 'dd MMM yyyy') : '-'}
                  </div>
                </div>
              </div>
            </div>
            {record.notes && (
              <div className="bg-card border border-border rounded-2xl p-4">
                <div className="text-xs text-gray-500 mb-1">Catatan dari Admin</div>
                <p className="text-sm text-gray-300">{record.notes}</p>
              </div>
            )}
          </>
        )}
        
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs text-gray-500 text-center">
            Untuk pembayaran dan informasi lebih lanjut,<br />hubungi admin Bronet.
          </p>
        </div>
      </div>
    </Screen>
  );
}

function RiwayatScreen({ user }) {
  const billing = JSON.parse(localStorage.getItem('bronet_billing') || '[]');
  const record = billing.find(b => b.username === user.name);

  return (
    <Screen>
      <div className="px-5 pt-10 pb-6">
        <h1 className="text-xl font-bold text-white mb-1">Riwayat Tagihan</h1>
        <p className="text-gray-500 text-sm">Riwayat pembayaran Anda</p>
      </div>
      <div className="px-4 space-y-3">
        {!record ? (
          <div className="bg-card border border-border rounded-2xl p-6 text-center text-gray-500">
            <History size={40} className="mx-auto mb-3 opacity-30" />
            <p>Belum ada riwayat</p>
          </div>
        ) : (
          <>
            {record.lastPaid && (
              <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-green-500/15 flex items-center justify-center">
                  <CheckCircle size={20} className="text-green-400" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Pembayaran Diterima</div>
                  <div className="text-xs text-gray-400 mono">
                    {format(new Date(record.lastPaid), 'dd MMMM yyyy HH:mm', { locale: id })}
                  </div>
                </div>
              </div>
            )}
            <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                <Package size={20} className="text-primary" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">Aktivasi Layanan</div>
                <div className="text-xs text-gray-400 mono">
                  {format(new Date(record.activatedAt), 'dd MMMM yyyy HH:mm', { locale: id })}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Screen>
  );
}

function ProfilScreen({ user, onLogout }) {
  const { phone, email } = parseComment(user.comment || '');
  return (
    <Screen>
      <div className="bg-gradient-to-br from-darker to-dark px-5 pt-12 pb-8 text-center">
        <div className="w-20 h-20 rounded-full bg-primary/20 border-2 border-primary/30 flex items-center justify-center mx-auto mb-3">
          <span className="text-primary font-bold text-2xl">{user.name.charAt(0).toUpperCase()}</span>
        </div>
        <h1 className="text-xl font-bold text-white mono">{user.name}</h1>
        <p className="text-gray-500 text-sm mt-1">{user.profile}</p>
      </div>
      <div className="px-4 space-y-3 mt-4">
        {[
          { label: 'Username', value: user.name },
          { label: 'Paket', value: user.profile },
          { label: 'No. HP', value: phone || '-' },
          { label: 'Email', value: email || '-' },
          { label: 'Service', value: user.service || 'pppoe' },
        ].map(row => (
          <div key={row.label} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-gray-400">{row.label}</span>
            <span className="text-sm text-white mono">{row.value}</span>
          </div>
        ))}
        <button onClick={onLogout}
          className="w-full py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 font-semibold mt-4 text-sm">
          Keluar
        </button>
      </div>
    </Screen>
  );
}

export default function MobileApp() {
  const [user, setUser] = useState(() => {
    const saved = sessionStorage.getItem(MOBILE_KEY);
    return saved ? JSON.parse(saved) : null;
  });
  const [screen, setScreen] = useState('home');

  const handleLogout = () => {
    sessionStorage.removeItem(MOBILE_KEY);
    setUser(null);
  };

  if (!user) return <LoginScreen onLogin={setUser} />;

  return (
    <div className="max-w-md mx-auto relative">
      {screen === 'home' && <HomeScreen user={user} />}
      {screen === 'paket' && <PaketScreen user={user} />}
      {screen === 'tagihan' && <TagihanScreen user={user} />}
      {screen === 'riwayat' && <RiwayatScreen user={user} />}
      {screen === 'profil' && <ProfilScreen user={user} onLogout={handleLogout} />}
      <BottomNav active={screen} onChange={setScreen} />
    </div>
  );
}
