import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Wifi, Eye, EyeOff, AlertCircle } from 'lucide-react';

export default function Login() {
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();

  // Already logged in → redirect to dashboard
  if (!loading && user) return <Navigate to="/admin/dashboard" replace />;
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    await new Promise(r => setTimeout(r, 500));
    const result = login(form.username, form.password);
    setLoading(false);
    if (result.success) {
      navigate('/admin/dashboard');
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="min-h-screen bg-darker flex items-center justify-center grid-bg p-4">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-card border border-primary/30 mb-4 glow">
            <Wifi size={36} className="text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">BRONET</h1>
          <p className="text-gray-500 text-sm mono">RT RW Net Management System</p>
        </div>

        {/* Form card */}
        <div className="bg-card rounded-2xl border border-border p-8">
          <h2 className="text-lg font-semibold text-white mb-6">Masuk ke Dashboard</h2>

          {error && (
            <div className="flex items-center gap-2 mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Username</label>
              <input
                type="text"
                value={form.username}
                onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                className="input-cyber w-full px-4 py-3 rounded-lg mono text-sm"
                placeholder="Masukkan username"
                autoComplete="username"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  className="input-cyber w-full px-4 py-3 pr-12 rounded-lg mono text-sm"
                  placeholder="Masukkan password"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-dark border-t-transparent rounded-full spinner" />
                  Memproses...
                </span>
              ) : 'Masuk'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-border">
            <p className="text-xs text-gray-600 text-center">
              Default: admin / admin123 atau operator / op123
            </p>
          </div>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          © 2024 Bronet RT RW Net Management System
        </p>
      </div>
    </div>
  );
}
