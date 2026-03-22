import React, { useState } from 'react';
import { Eye, EyeOff, Smartphone, Lock, ArrowRight, UserPlus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { findCustomerByPhone, saveCustomer, saveApplication } from '../../utils/db';

export default function CustomerLogin({ onLogin }) {
  const [step,     setStep]     = useState('login'); // login | set-password | register | reg-success
  const [phone,    setPhone]    = useState('');
  const [password, setPassword] = useState('');
  const [newPass,  setNewPass]  = useState('');
  const [confPass, setConfPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [customer, setCustomer] = useState(null);
  const [regForm,  setRegForm]  = useState({ full_name:'', phone:'', profile:'', address:'', note:'' });

  const getProfiles = () => {
    try {
      const extras = JSON.parse(localStorage.getItem('bronet_profile_extras') || '{}');
      return Object.keys(extras).map(n => ({ name: n, price: extras[n]._price || 0 }));
    } catch { return []; }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!phone || !password) return toast.error('Isi nomor HP / username dan password');
    setLoading(true);
    try {
      let cust = await findCustomerByPhone(phone);
      if (!cust) {
        const { loadCustomers } = await import('../../utils/db');
        const all = await loadCustomers();
        cust = all.find(c => c.pppoe_username === phone.trim() || c.pppoe_username === phone.trim().toLowerCase()) || null;
      }
      if (!cust) { toast.error('Nomor HP / username tidak terdaftar. Hubungi admin.'); return; }
      if (!cust.active) { toast.error('Akun Anda nonaktif. Hubungi admin.'); return; }
      if (cust.password_hash !== btoa(password)) { toast.error('Password salah'); return; }
      if (cust.must_change_pw) { setCustomer(cust); setStep('set-password'); return; }
      const updated = { ...cust, last_login: new Date().toISOString() };
      await saveCustomer(updated);
      onLogin(updated);
      toast.success(`Selamat datang, ${cust.full_name || cust.pppoe_username}!`);
    } catch(err) { toast.error('Error: ' + err.message); }
    finally { setLoading(false); }
  };

  const handleSetPassword = async (e) => {
    e.preventDefault();
    if (newPass.length < 6) return toast.error('Password minimal 6 karakter');
    if (newPass !== confPass) return toast.error('Konfirmasi password tidak cocok');
    setLoading(true);
    try {
      const updated = { ...customer, password_hash: btoa(newPass), must_change_pw: false, last_login: new Date().toISOString() };
      await saveCustomer(updated);
      onLogin(updated);
      toast.success('Password berhasil dibuat! Selamat datang.');
    } finally { setLoading(false); }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!regForm.full_name || !regForm.phone) return toast.error('Nama dan No. HP wajib diisi');
    setLoading(true);
    try {
      const app = {
        id: 'app_' + Date.now(), install_id: 'bronet_main',
        full_name: regForm.full_name.trim(),
        phone:     regForm.phone.replace(/\D/g, ''),
        profile:   regForm.profile, address: regForm.address, note: regForm.note,
        status: 'pending', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };
      await saveApplication(app);
      toast.success('Permohonan dikirim! Admin akan menghubungi Anda via WhatsApp. 🎉');
      setStep('reg-success');
    } catch(e) { toast.error('Gagal: ' + e.message); }
    finally { setLoading(false); }
  };

  const profiles = getProfiles();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#0a0f1a] to-[#0d1420] p-4">
      {/* Logo */}
      <div className="mb-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center mx-auto mb-3">
          <span className="text-primary font-bold text-2xl mono">B</span>
        </div>
        <h1 className="text-white text-2xl font-bold">BRONET</h1>
        <p className="text-gray-500 text-sm mt-1">Portal Customer</p>
      </div>

      <div className="w-full max-w-sm">

        {/* ── LOGIN ─────────────────────────────────────────── */}
        {step === 'login' && (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <h2 className="text-white font-semibold text-lg">Login</h2>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Nomor HP / Username PPPoE</label>
                <div className="relative">
                  <Smartphone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                    className="input-cyber w-full pl-10 pr-4 py-3 rounded-xl text-sm mono"
                    placeholder="08xxxxxxxxxx" required/>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
                  <input type={showPass ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="input-cyber w-full pl-10 pr-10 py-3 rounded-xl text-sm"
                    placeholder="Password" required/>
                  <button type="button" onClick={() => setShowPass(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                    {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading}
                className="w-full btn-primary py-3 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                {loading ? 'Masuk...' : <><span>Masuk</span><ArrowRight size={16}/></>}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border"/>
              <span className="text-xs text-gray-600">belum berlangganan?</span>
              <div className="flex-1 h-px bg-border"/>
            </div>

            {/* Permohonan button */}
            <button onClick={() => setStep('register')}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-primary/40 text-primary font-semibold text-sm hover:bg-primary/10 transition-colors">
              <UserPlus size={17}/>
              Daftar Pelanggan Baru
            </button>
          </div>
        )}

        {/* ── SET PASSWORD ──────────────────────────────────── */}
        {step === 'set-password' && (
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="text-center mb-5">
              <div className="text-3xl mb-2">🔐</div>
              <h2 className="text-white font-semibold">Buat Password Baru</h2>
              <p className="text-gray-500 text-sm mt-1">Untuk keamanan, buat password sebelum masuk</p>
            </div>
            <form onSubmit={handleSetPassword} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Password Baru (min 6 karakter)</label>
                <input type={showPass ? 'text' : 'password'} value={newPass}
                  onChange={e => setNewPass(e.target.value)}
                  className="input-cyber w-full px-4 py-3 rounded-xl text-sm" placeholder="Password baru" required/>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Konfirmasi Password</label>
                <input type={showPass ? 'text' : 'password'} value={confPass}
                  onChange={e => setConfPass(e.target.value)}
                  className="input-cyber w-full px-4 py-3 rounded-xl text-sm" placeholder="Ulangi password" required/>
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                <input type="checkbox" onChange={() => setShowPass(p => !p)} className="rounded"/>
                Tampilkan password
              </label>
              <button type="submit" disabled={loading}
                className="w-full btn-primary py-3 rounded-xl font-semibold disabled:opacity-50">
                {loading ? 'Menyimpan...' : 'Simpan & Masuk'}
              </button>
            </form>
          </div>
        )}

        {/* ── REGISTER FORM ─────────────────────────────────── */}
        {step === 'register' && (
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold flex items-center gap-2">
                <UserPlus size={18} className="text-primary"/>Daftar Pelanggan Baru
              </h2>
              <button onClick={() => setStep('login')} className="text-gray-500 hover:text-white">
                <X size={18}/>
              </button>
            </div>
            <p className="text-gray-500 text-xs mb-4">Admin akan menghubungi Anda via WhatsApp untuk konfirmasi pemasangan.</p>

            <form onSubmit={handleRegister} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Nama Lengkap *</label>
                <input value={regForm.full_name} onChange={e => setRegForm(p=>({...p,full_name:e.target.value}))}
                  className="input-cyber w-full px-3 py-2.5 rounded-xl text-sm" placeholder="Nama lengkap" required/>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">No. HP / WhatsApp *</label>
                <input value={regForm.phone} onChange={e => setRegForm(p=>({...p,phone:e.target.value}))} type="tel"
                  className="input-cyber w-full px-3 py-2.5 rounded-xl text-sm mono" placeholder="08xxxxxxxxxx" required/>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Paket yang Diminati</label>
                <select value={regForm.profile} onChange={e => setRegForm(p=>({...p,profile:e.target.value}))}
                  className="input-cyber w-full px-3 py-2.5 rounded-xl text-sm">
                  <option value="">-- Pilih Paket --</option>
                  {profiles.map(prof => (
                    <option key={prof.name} value={prof.name}>
                      {prof.name}{prof.price > 0 ? ` — Rp ${prof.price.toLocaleString('id-ID')}/bln` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Alamat Pemasangan</label>
                <textarea value={regForm.address} onChange={e => setRegForm(p=>({...p,address:e.target.value}))}
                  rows={2} className="input-cyber w-full px-3 py-2.5 rounded-xl text-sm resize-none"
                  placeholder="Alamat lengkap untuk pemasangan..."/>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Catatan Tambahan</label>
                <input value={regForm.note} onChange={e => setRegForm(p=>({...p,note:e.target.value}))}
                  className="input-cyber w-full px-3 py-2.5 rounded-xl text-sm" placeholder="Info tambahan (opsional)"/>
              </div>
              <button type="submit" disabled={loading}
                className="w-full btn-primary py-3 rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                <UserPlus size={16}/>{loading ? 'Mengirim...' : 'Kirim Permohonan'}
              </button>
              <button type="button" onClick={() => setStep('login')}
                className="w-full py-2.5 rounded-xl border border-border text-gray-500 text-sm hover:text-gray-300">
                Sudah punya akun? Login
              </button>
            </form>
          </div>
        )}

        {/* ── SUCCESS ───────────────────────────────────────── */}
        {step === 'reg-success' && (
          <div className="bg-card border border-border rounded-2xl p-6 text-center space-y-4">
            <div className="text-5xl">🎉</div>
            <h2 className="text-white font-bold text-lg">Permohonan Terkirim!</h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              Terima kasih telah mendaftar. Tim kami akan menghubungi Anda via WhatsApp dalam waktu 1×24 jam untuk konfirmasi jadwal pemasangan.
            </p>
            <div className="bg-primary/10 border border-primary/30 rounded-xl p-3">
              <p className="text-primary text-sm">📞 {regForm.phone || '-'}</p>
              {regForm.profile && <p className="text-gray-400 text-xs mt-1">Paket: {regForm.profile}</p>}
            </div>
            <button onClick={() => { setStep('login'); setRegForm({full_name:'',phone:'',profile:'',address:'',note:''}); }}
              className="w-full btn-primary py-3 rounded-xl font-semibold">
              Kembali ke Login
            </button>
          </div>
        )}
      </div>

      <p className="text-gray-700 text-xs mt-6 text-center">
        Username = Nomor HP yang didaftarkan saat pemasangan
      </p>
    </div>
  );
}
