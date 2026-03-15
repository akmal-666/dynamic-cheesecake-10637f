import React, { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { Settings as SettingsIcon, Wifi, WifiOff, Eye, EyeOff,
  CheckCircle, AlertCircle, RefreshCw, Save, Info, ExternalLink,
  ChevronDown, ChevronUp, Terminal, MessageCircle, Send, Loader } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';

const WA_KEY = 'bronet_wa_settings';
function getWASetting() { try { return JSON.parse(localStorage.getItem(WA_KEY) || '{}'); } catch { return {}; } }
function saveWASetting(d) { localStorage.setItem(WA_KEY, JSON.stringify(d)); }

const DEFAULT_TEMPLATE = `Halo {nama},

Ini adalah pemberitahuan tagihan internet Bronet.

Detail Tagihan:
- Paket      : {paket}
- Tagihan    : {harga}/bulan
- Jatuh Tempo: {tanggal}

Mohon segera lakukan pembayaran sebelum jatuh tempo agar koneksi tidak terputus.

Terima kasih,
Admin Bronet`;

function InfoBox({ title, children, color = 'primary' }) {
  const [open, setOpen] = useState(false);
  const clrMap = {
    primary: 'border-primary/20 bg-primary/5 text-primary',
    yellow:  'border-yellow-500/20 bg-yellow-500/5 text-yellow-400',
    red:     'border-red-500/20 bg-red-500/5 text-red-400',
    green:   'border-green-500/20 bg-green-500/5 text-green-400',
  };
  return (
    <div className={clsx('border rounded-xl overflow-hidden', clrMap[color])}>
      <button onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-left">
        <span>{title}</span>
        {open ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
      </button>
      {open && <div className="px-4 pb-4 text-xs text-gray-400 space-y-1.5">{children}</div>}
    </div>
  );
}

const COMMON_PORTS = ['80', '8080', '443', '8443'];

export default function Settings() {
  const { settings, updateSettings, testConnection, connectionStatus } = useApp();
  const [form, setForm] = useState({ ...settings });
  const [activeTab, setActiveTab] = useState('mikrotik');
  const [waForm, setWaForm] = useState(() => ({
    provider: 'manual', token: '', testPhone: '', template: DEFAULT_TEMPLATE, ...getWASetting()
  }));
  const [testingWA, setTestingWA] = useState(false);
  const [showPass, setShowPass]     = useState(false);
  const [testing, setTesting]       = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [diag, setDiag]             = useState(null); // detailed diagnostic

  const saveWASettings = () => {
    saveWASetting(waForm);
    toast.success('Pengaturan WA disimpan!');
  };

  const testFonnte = async () => {
    if (!waForm.token) return toast.error('Isi token Fonnte terlebih dahulu');
    if (!waForm.testPhone) return toast.error('Isi nomor HP test');
    setTestingWA(true);
    try {
      const body = new FormData();
      body.append('target', waForm.testPhone.replace(/^0/, '62').replace(/\D/g, ''));
      body.append('message', 'Test koneksi Fonnte dari Bronet berhasil!');
      const r = await fetch('https://api.fonnte.com/send', {
        method: 'POST', headers: { Authorization: waForm.token }, body,
      });
      const j = await r.json();
      if (j.status === true) toast.success('Test berhasil! Pesan terkirim.');
      else toast.error('Test gagal: ' + (j.reason || 'Token tidak valid?'));
    } catch(e) { toast.error('Gagal: ' + e.message); }
    setTestingWA(false);
  };

  const handleSave = () => {
    updateSettings(form);
    toast.success('Pengaturan disimpan!');
    setTestResult(null);
    setDiag(null);
  };

  const handleTest = async () => {
    updateSettings({ ...form });
    setTesting(true);
    setTestResult(null);
    setDiag(null);
    await new Promise(r => setTimeout(r, 300));
    const result = await testConnection();
    setTesting(false);
    setTestResult(result);

    if (result.success) {
      toast.success('Berhasil terhubung ke Mikrotik!');
    } else {
      // Try to extract diagnostic info
      const err = result.error || '';
      let diagInfo = null;
      if (err.includes('404') || err.includes('ditemukan')) {
        diagInfo = {
          type: '404',
          msg: 'Path REST API tidak ditemukan',
          steps: [
            'Buka Winbox → IP → Services',
            'Pastikan service "www" aktif (centang enable) di port 80',
            'RouterOS harus versi 7.1 ke atas untuk mendukung REST API',
            'Coba akses manual: http://' + form.host + ':' + form.port + '/rest/system/identity',
          ]
        };
      } else if (err.includes('401') || err.includes('password') || err.includes('Login')) {
        diagInfo = {
          type: '401',
          msg: 'Username / password salah',
          steps: [
            'Pastikan username dan password Mikrotik benar',
            'Coba login ke Winbox dengan kredensial yang sama',
            'Pastikan user memiliki akses group "full" atau "read"',
          ]
        };
      } else if (err.includes('Timeout') || err.includes('timeout')) {
        diagInfo = {
          type: 'timeout',
          msg: 'Mikrotik tidak merespon (Timeout)',
          steps: [
            'Pastikan IP ' + form.host + ' dapat dijangkau dari internet',
            'Cek firewall Mikrotik — port ' + form.port + ' harus terbuka untuk akses luar',
            'Winbox → IP → Firewall → pastikan tidak ada rule yang memblokir port ' + form.port,
            'Coba ping IP dari komputer: ping ' + form.host,
          ]
        };
      } else if (err.includes('Koneksi gagal') || err.includes('ECONNREFUSED')) {
        diagInfo = {
          type: 'refused',
          msg: 'Koneksi ditolak — port ' + form.port + ' tidak terbuka',
          steps: [
            'Pastikan service "www" aktif di Mikrotik (IP → Services)',
            'Coba port lain: 8080 atau 8443',
            'Cek apakah ada NAT/firewall di depan Mikrotik',
          ]
        };
      }
      setDiag(diagInfo);
    }
  };

  const isConnected = connectionStatus === 'connected';

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Pengaturan</h1>
        <p className="text-gray-500 text-sm mt-1">Koneksi Mikrotik & Template WhatsApp</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-darker p-1 rounded-xl w-fit border border-border">
        {[['mikrotik','Koneksi Mikrotik',SettingsIcon],['whatsapp','Template WhatsApp',MessageCircle]].map(([k,l,Icon]) => (
          <button key={k} onClick={() => setActiveTab(k)}
            className={clsx('flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all',
              activeTab===k ? 'bg-primary text-dark font-semibold' : 'text-gray-400 hover:text-white')}>
            <Icon size={14}/>{l}
          </button>
        ))}
      </div>

      {activeTab === 'mikrotik' && <>
      {/* Status banner */
      <div className={clsx('flex items-center gap-4 p-4 rounded-xl border',
        isConnected          ? 'bg-green-500/10 border-green-500/30' :
        testResult?.success === false ? 'bg-red-500/10 border-red-500/30' :
        'bg-card border-border'
      )}>
        {isConnected ? <CheckCircle size={22} className="text-green-400 shrink-0"/> :
         testResult?.success === false ? <AlertCircle size={22} className="text-red-400 shrink-0"/> :
         <WifiOff size={22} className="text-gray-500 shrink-0"/>}
        <div className="min-w-0">
          <div className="font-semibold text-white text-sm">
            {isConnected ? 'Terhubung ke Mikrotik' :
             testResult?.success === false ? 'Koneksi gagal' :
             'Belum ditest'}
          </div>
          <div className="text-xs text-gray-400 mono truncate mt-0.5">
            {isConnected
              ? `${settings.host}:${settings.port} — OK`
              : testResult?.error
              ? testResult.error.split('\n')[0]
              : 'Isi pengaturan dan klik Test Koneksi'}
          </div>
        </div>
      </div>

      {/* Diagnostic panel */}
      {diag && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 text-red-400 font-semibold text-sm mb-3">
            <AlertCircle size={16}/>
            {diag.msg}
          </div>
          <ol className="space-y-1.5 list-none">
            {diag.steps.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-400">
                <span className="w-5 h-5 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center shrink-0 font-bold text-xs">{i+1}</span>
                {s}
              </li>
            ))}
          </ol>
          {diag.type === '404' && (
            <div className="mt-3 pt-3 border-t border-red-500/20 text-xs text-gray-500">
              Coba URL manual di browser: 
              <span className="mono text-primary ml-1">
                http://{form.host}:{form.port}/rest/system/identity
              </span>
            </div>
          )}
        </div>
      )}

      {/* Main form */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <SettingsIcon size={16} className="text-primary"/>Konfigurasi
        </h2>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="block text-xs text-gray-400 mb-1.5">IP Address / Hostname <span className="text-red-400">*</span></label>
            <input value={form.host} onChange={e => setForm(p => ({...p, host: e.target.value}))}
              className="input-cyber w-full px-3 py-2.5 rounded-lg text-sm mono" placeholder="192.168.1.1"/>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Port</label>
            <div className="flex gap-1">
              <input value={form.port} onChange={e => setForm(p => ({...p, port: e.target.value}))}
                className="input-cyber flex-1 min-w-0 px-3 py-2.5 rounded-lg text-sm mono" placeholder="80"/>
            </div>
            <div className="flex gap-1 mt-1">
              {COMMON_PORTS.map(p => (
                <button key={p} onClick={() => setForm(prev => ({...prev, port: p}))}
                  className={clsx('text-xs px-1.5 py-0.5 rounded transition-all',
                    form.port === p ? 'bg-primary text-dark font-bold' : 'bg-darker text-gray-500 hover:text-gray-300')}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Username <span className="text-red-400">*</span></label>
            <input value={form.username} onChange={e => setForm(p => ({...p, username: e.target.value}))}
              className="input-cyber w-full px-3 py-2.5 rounded-lg text-sm mono" placeholder="admin" autoComplete="off"/>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Password <span className="text-red-400">*</span></label>
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} value={form.password}
                onChange={e => setForm(p => ({...p, password: e.target.value}))}
                className="input-cyber w-full px-3 py-2.5 pr-10 rounded-lg text-sm mono"
                placeholder="password" autoComplete="new-password"/>
              <button type="button" onClick={() => setShowPass(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
              </button>
            </div>
          </div>
        </div>

        {/* URL preview */}
        <div className="flex items-center gap-2 px-3 py-2 bg-darker rounded-lg border border-border">
          <Terminal size={13} className="text-gray-600 shrink-0"/>
          <span className="text-xs text-gray-600 mono truncate">
            URL: http://{form.host || 'host'}:{form.port || '80'}/rest/system/identity
          </span>
        </div>

        <div className="flex gap-3 pt-1 border-t border-border">
          <button onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border text-gray-300 hover:text-white text-sm">
            <Save size={15}/>Simpan
          </button>
          <button onClick={handleTest} disabled={testing}
            className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm disabled:opacity-50 flex-1 justify-center">
            {testing
              ? <><RefreshCw size={15} className="spinner"/>Menguji koneksi...</>
              : <><Wifi size={15}/>Test Koneksi</>}
          </button>
        </div>
      </div>

      {/* Troubleshooting guide */}
      <div className="space-y-2">
        <InfoBox title="📋 Cara mengaktifkan REST API di Mikrotik" color="primary">
          <p className="text-primary font-semibold mb-1">Persyaratan: RouterOS versi 7.1 ke atas</p>
          <p>1. Buka <span className="mono text-white">Winbox</span> → IP → Services</p>
          <p>2. Pastikan service <span className="mono text-white">www</span> aktif dan port = <span className="mono text-white">80</span></p>
          <p>3. System → Users → pastikan user punya group <span className="mono text-white">full</span></p>
          <p>4. Test manual di browser: <span className="mono text-white">http://[IP]/rest/system/identity</span></p>
          <p>5. Jika Mikrotik di belakang router lain, buat port forwarding ke port 80</p>
        </InfoBox>

        <InfoBox title="❓ Kenapa error 404?" color="yellow">
          <p>404 = server Mikrotik merespon tapi path REST tidak ditemukan.</p>
          <p className="mt-1 font-semibold text-yellow-400">Kemungkinan penyebab:</p>
          <p>• RouterOS versi &lt; 7.1 — REST API belum ada (hanya tersedia di v7.1+)</p>
          <p>• Service <span className="mono">www</span> di-disable di IP → Services</p>
          <p>• Port yang dikonfigurasi salah (bukan port www yang aktif)</p>
          <p className="mt-1 font-semibold text-yellow-400">Solusi cepat:</p>
          <p>• Update RouterOS ke versi 7.x terbaru via Winbox → System → Packages</p>
          <p>• Aktifkan service www: IP → Services → www → centang Enable</p>
        </InfoBox>

        <InfoBox title="🔐 Kenapa error 401 (Unauthorized)?" color="red">
          <p>Username atau password salah, atau user tidak punya akses API.</p>
          <p className="mt-1">• Cek ulang username dan password</p>
          <p>• Winbox → System → Users → pastikan group = <span className="mono text-white">full</span></p>
          <p>• Mikrotik default username = <span className="mono text-white">admin</span>, password = kosong</p>
        </InfoBox>

        <InfoBox title="⏱ Kenapa Timeout?" color="yellow">
          <p>Mikrotik tidak merespon dalam 10 detik.</p>
          <p className="mt-1">• Pastikan IP {form.host} bisa diakses dari luar (ping test)</p>
          <p>• Cek Firewall Mikrotik: IP → Firewall → Filter — pastikan tidak ada rule yang drop port {form.port}</p>
          <p>• Jika menggunakan ISP dengan CGNAT, IP publik mungkin bukan milik Anda langsung</p>
        </InfoBox>
      </div>
    </div>
  );
}
