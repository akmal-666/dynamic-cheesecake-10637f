import React, { useState } from 'react';
import { Eye, EyeOff, Smartphone, Lock, ArrowRight } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { findCustomerByPhone, saveCustomer } from '../../utils/db';

export default function CustomerLogin({ onLogin }) {
  const [step,     setStep]     = useState('login'); // login | set-password
  const [phone,    setPhone]    = useState('');
  const [password, setPassword] = useState('');
  const [newPass,  setNewPass]  = useState('');
  const [confPass, setConfPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [customer, setCustomer] = useState(null);

  const cleanPhone = (p) => p.replace(/\D/g, '').replace(/^0/, '62');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!phone || !password) return toast.error('Isi nomor HP dan password');
    setLoading(true);
    try {
      const cust = await findCustomerByPhone(phone);
      if (!cust) return toast.error('Nomor HP tidak terdaftar');
      if (!cust.active) return toast.error('Akun Anda nonaktif. Hubungi admin.');

      // Check password
      const ok = cust.password_hash === btoa(password); // simple encoding
      if (!ok) return toast.error('Password salah');

      // Must change password on first login
      if (cust.must_change_pw) {
        setCustomer(cust);
        setStep('set-password');
        return;
      }

      // Update last login
      const updated = { ...cust, last_login: new Date().toISOString() };
      await saveCustomer(updated);
      onLogin(updated);
      toast.success(`Selamat datang, ${cust.full_name || cust.pppoe_username}!`);
    } finally { setLoading(false); }
  };

  const handleSetPassword = async (e) => {
    e.preventDefault();
    if (newPass.length < 6) return toast.error('Password minimal 6 karakter');
    if (newPass !== confPass) return toast.error('Konfirmasi password tidak cocok');
    setLoading(true);
    try {
      const updated = {
        ...customer,
        password_hash: btoa(newPass),
        must_change_pw: false,
        last_login: new Date().toISOString(),
      };
      await saveCustomer(updated);
      onLogin(updated);
      toast.success('Password berhasil dibuat! Selamat datang.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#0a0f1a] to-[#0d1420] p-4">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center mx-auto mb-3">
          <span className="text-primary font-bold text-2xl mono">B</span>
        </div>
        <h1 className="text-white text-2xl font-bold">BRONET</h1>
        <p className="text-gray-500 text-sm mt-1">Portal Customer</p>
      </div>

      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6">
        {step === 'login' ? (
          <>
            <h2 className="text-white font-semibold text-lg mb-5">Login</h2>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Nomor HP</label>
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
          </>
        ) : (
          <>
            <div className="text-center mb-5">
              <div className="text-3xl mb-2">🔐</div>
              <h2 className="text-white font-semibold">Buat Password Baru</h2>
              <p className="text-gray-500 text-sm mt-1">Untuk keamanan, buat password baru sebelum masuk</p>
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
          </>
        )}
      </div>
      <p className="text-gray-700 text-xs mt-6">Username = Nomor HP yang didaftarkan saat pemasangan</p>
    </div>
  );
}
