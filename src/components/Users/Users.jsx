import React, { useState, useEffect } from 'react';
import { useApp } from '../../contexts/AppContext';
import { MOCK_PPP_SECRETS, MOCK_PPP_ACTIVE, parseComment, buildComment } from '../../utils/mockData';
import { Plus, Edit2, Trash2, Search, RefreshCw, User, Phone, Mail, Wifi, WifiOff, CheckCircle, XCircle, Eye, EyeOff, Copy, Package, Calendar } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const EMPTY_FORM = {
  name: '', password: '', profile: 'paket-10mbps', service: 'pppoe',
  phone: '', email: '', installDate: '', comment: '', disabled: false,
  'local-address': '192.168.1.1', 'remote-address': '',
};

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white">✕</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function FormField({ label, required, children, hint }) {
  return (
    <div className="mb-4">
      <label className="block text-sm text-gray-400 mb-1.5">
        {label}{required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-600 mt-1">{hint}</p>}
    </div>
  );
}

const LS_USERS_KEY = 'bronet_local_users';
function getLocalUsers() {
  try { return JSON.parse(localStorage.getItem(LS_USERS_KEY) || 'null'); } catch { return null; }
}
function saveLocalUsers(list) {
  localStorage.setItem(LS_USERS_KEY, JSON.stringify(list));
}

export default function Users() {
  const { callMikrotik } = useApp();
  const [users, setUsers] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [usingMikrotik, setUsingMikrotik] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [successInfo, setSuccessInfo] = useState(null);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [usersR, activeR, profilesR] = await Promise.all([
      callMikrotik('/ppp/secret', 'GET'),
      callMikrotik('/ppp/active', 'GET'),
      callMikrotik('/ppp/profile', 'GET'),
    ]);
    if (usersR.success && Array.isArray(usersR.data)) {
      setUsingMikrotik(true);
      setUsers(usersR.data);
      // Sync to localStorage
      saveLocalUsers(usersR.data);
    } else {
      setUsingMikrotik(false);
      // Fall back to localStorage, then mock
      const local = getLocalUsers();
      setUsers(local || MOCK_PPP_SECRETS);
    }
    setActiveUsers(activeR.success && Array.isArray(activeR.data) ? activeR.data : MOCK_PPP_ACTIVE);
    if (profilesR.success && Array.isArray(profilesR.data)) {
      setProfiles(profilesR.data);
    } else {
      const saved = localStorage.getItem('bronet_profiles');
      setProfiles(saved ? JSON.parse(saved) : []);
    }
    setLoading(false);
  };

  const openAdd = () => { setEditUser(null); setForm(EMPTY_FORM); setModalOpen(true); };
  const openEdit = (u) => {
    const { phone, email, installDate } = parseComment(u.comment);
    setEditUser(u);
    setForm({ ...u, phone, email, installDate, disabled: u.disabled === 'true' });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name,
      password: form.password,
      profile: form.profile,
      service: form.service || 'pppoe',
      comment: buildComment(form.phone, form.email, form.installDate),
      'local-address': form['local-address'],
      'remote-address': form['remote-address'],
      disabled: form.disabled ? 'true' : 'false',
    };
    let result;
    if (editUser) {
      result = await callMikrotik(`/ppp/secret/${editUser['.id']}`, 'PATCH', payload);
    } else {
      result = await callMikrotik('/ppp/secret', 'PUT', payload);
    }
    if (result.success) {
      setModalOpen(false);
      await loadAll();
      if (editUser) {
        toast.success('User berhasil diupdate di Mikrotik!');
      } else {
        setSuccessInfo({ ...payload, password: form.password, installDate: form.installDate });
      }
    } else if (!usingMikrotik) {
      // Offline/demo mode — save to localStorage
      setUsers(prev => {
        let updated;
        if (editUser) {
          updated = prev.map(u => u['.id'] === editUser['.id'] ? { ...u, ...payload } : u);
        } else {
          updated = [...prev, { ...payload, '.id': '*' + Date.now() }];
        }
        saveLocalUsers(updated);
        return updated;
      });
      setModalOpen(false);
      if (editUser) {
        toast.success('User diupdate (tersimpan lokal)');
      } else {
        setSuccessInfo({ ...payload, password: form.password, installDate: form.installDate });
      }
    } else {
      toast.error('Gagal menyimpan ke Mikrotik: ' + result.error);
    }
    setSaving(false);
  };

  const handleDelete = async (user) => {
    const result = await callMikrotik(`/ppp/secret/${user['.id']}`, 'DELETE');
    if (result.success) {
      setUsers(prev => prev.filter(u => u['.id'] !== user['.id']));
      toast.success('User berhasil dihapus dari Mikrotik!');
    } else if (!usingMikrotik) {
      // Offline mode — delete from localStorage
      setUsers(prev => {
        const updated = prev.filter(u => u['.id'] !== user['.id']);
        saveLocalUsers(updated);
        return updated;
      });
      toast.success('User dihapus (lokal)');
    } else {
      toast.error('Gagal menghapus: ' + result.error);
    }
    setDeleteConfirm(null);
  };

  const toggleDisable = async (user) => {
    const newState = user.disabled === 'true' ? 'false' : 'true';
    const result = await callMikrotik(`/ppp/secret/${user['.id']}`, 'PATCH', { disabled: newState });
    if (result.success || !usingMikrotik) {
      setUsers(prev => {
        const updated = prev.map(u => u['.id'] === user['.id'] ? { ...u, disabled: newState } : u);
        if (!usingMikrotik) saveLocalUsers(updated);
        return updated;
      });
      toast.success(newState === 'true' ? 'User dinonaktifkan' : 'User diaktifkan');
    } else {
      toast.error('Gagal: ' + result.error);
    }
  };

  const isOnline = (name) => activeUsers.some(a => a.name === name);

  const filtered = users.filter(u => {
    const { phone, email } = parseComment(u.comment);
    const matchSearch = search === '' ||
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      phone.includes(search) || email.toLowerCase().includes(search.toLowerCase()) ||
      u.profile?.toLowerCase().includes(search.toLowerCase());
    const online = isOnline(u.name);
    const matchStatus = filterStatus === 'all' ||
      (filterStatus === 'online' && online) ||
      (filterStatus === 'offline' && !online && u.disabled !== 'true') ||
      (filterStatus === 'disabled' && u.disabled === 'true');
    return matchSearch && matchStatus;
  });

  const profileOptions = profiles.length > 0 ? profiles : [
    { name: 'paket-5mbps' }, { name: 'paket-10mbps' }, { name: 'paket-20mbps' }, { name: 'paket-50mbps' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">User PPPoE</h1>
          <p className="text-gray-500 text-sm mt-1">Kelola user koneksi PPPoE</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadAll} disabled={loading} className="p-2 rounded-lg border border-border text-gray-400 hover:text-white transition-colors">
            <RefreshCw size={18} className={loading ? 'spinner' : ''} />
          </button>
          <button onClick={openAdd} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm">
            <Plus size={18} />Tambah User
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total User', value: users.length, color: 'text-white' },
          { label: 'Online', value: activeUsers.length, color: 'text-green-400' },
          { label: 'Nonaktif', value: users.filter(u => u.disabled === 'true').length, color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center">
            <div className={`text-2xl font-bold mono ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama, no. HP, email, profil..."
            className="input-cyber w-full pl-9 pr-4 py-2.5 rounded-lg text-sm" />
        </div>
        <div className="flex gap-2">
          {['all', 'online', 'offline', 'disabled'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={clsx('px-3 py-2 rounded-lg text-xs border transition-all capitalize',
                filterStatus === s ? 'bg-primary/20 text-primary border-primary/50' : 'border-border text-gray-400 hover:border-gray-500')}>
              {s === 'all' ? 'Semua' : s === 'online' ? 'Online' : s === 'offline' ? 'Offline' : 'Nonaktif'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-darker/50">
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">STATUS</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">USERNAME</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">PROFIL</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">NO. HP</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">EMAIL</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">SERVICE</th>
                <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">AKSI</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-600">
                  <RefreshCw size={24} className="spinner mx-auto mb-2" />Memuat data...
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-600">
                  <User size={32} className="mx-auto mb-2 opacity-30" />Tidak ada user ditemukan
                </td></tr>
              ) : filtered.map(u => {
                const online = isOnline(u.name);
                const { phone, email } = parseComment(u.comment);
                const disabled = u.disabled === 'true';
                return (
                  <tr key={u['.id']} className="table-row border-b border-border/50 last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={clsx('w-2 h-2 rounded-full',
                          disabled ? 'bg-gray-600' : online ? 'bg-green-400' : 'bg-yellow-500')} />
                        <span className={clsx('text-xs mono',
                          disabled ? 'text-gray-600' : online ? 'text-green-400' : 'text-yellow-500')}>
                          {disabled ? 'OFF' : online ? 'ON' : 'IDLE'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 mono font-medium text-white">{u.name}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-md bg-primary/10 text-primary text-xs mono">{u.profile}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 mono text-xs">{phone || '-'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{email || '-'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{u.service || 'pppoe'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => toggleDisable(u)}
                          className={clsx('p-1.5 rounded-lg transition-colors',
                            disabled ? 'text-green-400 hover:bg-green-400/10' : 'text-yellow-400 hover:bg-yellow-400/10')}
                          title={disabled ? 'Aktifkan' : 'Nonaktifkan'}>
                          {disabled ? <CheckCircle size={16} /> : <XCircle size={16} />}
                        </button>
                        <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-400/10 transition-colors">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => setDeleteConfirm(u)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-400/10 transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-border text-xs text-gray-500">
            Menampilkan {filtered.length} dari {users.length} user
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editUser ? 'Edit User PPPoE' : 'Tambah User PPPoE'}>
        <form onSubmit={handleSubmit} className="space-y-0">
          <div className="grid grid-cols-2 gap-x-4">
            <FormField label="Username" required>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="input-cyber w-full px-3 py-2.5 rounded-lg text-sm mono" required
                placeholder="username_pelanggan" disabled={!!editUser} />
            </FormField>
            <FormField label="Password" required>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  className="input-cyber w-full px-3 py-2.5 pr-9 rounded-lg text-sm mono" required placeholder="password" />
                <button type="button" onClick={() => setShowPass(p => !p)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-x-4">
            <FormField label="Profil" required>
              <select value={form.profile} onChange={e => setForm(p => ({ ...p, profile: e.target.value }))}
                className="input-cyber w-full px-3 py-2.5 rounded-lg text-sm" required>
                {profileOptions.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
            </FormField>
            <FormField label="Service">
              <select value={form.service} onChange={e => setForm(p => ({ ...p, service: e.target.value }))}
                className="input-cyber w-full px-3 py-2.5 rounded-lg text-sm">
                <option value="pppoe">pppoe</option>
                <option value="pptp">pptp</option>
                <option value="l2tp">l2tp</option>
                <option value="any">any</option>
              </select>
            </FormField>
          </div>
          <FormField label="No. HP" hint="Disimpan di field Comment Mikrotik (format: hp|email)">
            <div className="relative">
              <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                className="input-cyber w-full pl-8 pr-3 py-2.5 rounded-lg text-sm mono" placeholder="08xxxxxxxxxx" />
            </div>
          </FormField>
          <FormField label="Email" hint="Disimpan di field Comment Mikrotik (format: hp|email)">
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                className="input-cyber w-full pl-8 pr-3 py-2.5 rounded-lg text-sm" placeholder="email@example.com" />
            </div>
          </FormField>
          <FormField label="Tanggal Pemasangan" hint="Digunakan untuk hitung jatuh tempo tagihan (pemasangan + 30 hari)">
            <input type="date" value={form.installDate}
              onChange={e => setForm(p => ({ ...p, installDate: e.target.value }))}
              className="input-cyber w-full px-3 py-2.5 rounded-lg text-sm mono" />
          </FormField>
          <div className="grid grid-cols-2 gap-x-4">
            <FormField label="Local Address">
              <input value={form['local-address']} onChange={e => setForm(p => ({ ...p, 'local-address': e.target.value }))}
                className="input-cyber w-full px-3 py-2.5 rounded-lg text-sm mono" placeholder="192.168.1.1" />
            </FormField>
            <FormField label="Remote Address (Pool/IP)">
              <input value={form['remote-address']} onChange={e => setForm(p => ({ ...p, 'remote-address': e.target.value }))}
                className="input-cyber w-full px-3 py-2.5 rounded-lg text-sm mono" placeholder="dhcp-pool / 10.0.0.x" />
            </FormField>
          </div>
          <div className="flex items-center gap-3 py-2">
            <button type="button" onClick={() => setForm(p => ({ ...p, disabled: !p.disabled }))}
              className={clsx('w-10 h-5 rounded-full transition-colors relative', form.disabled ? 'bg-gray-600' : 'bg-green-500')}>
              <div className={clsx('absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform',
                form.disabled ? 'left-0.5' : 'left-5')} />
            </button>
            <span className="text-sm text-gray-400">{form.disabled ? 'User Nonaktif' : 'User Aktif'}</span>
          </div>
          <div className="flex gap-3 mt-6 pt-4 border-t border-border">
            <button type="button" onClick={() => setModalOpen(false)}
              className="flex-1 px-4 py-2.5 rounded-lg border border-border text-gray-400 hover:text-white text-sm transition-colors">
              Batal
            </button>
            <button type="submit" disabled={saving} className="flex-1 btn-primary px-4 py-2.5 rounded-lg text-sm disabled:opacity-50">
              {saving ? 'Menyimpan...' : editUser ? 'Update User' : 'Tambah User'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm modal */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Konfirmasi Hapus">
        <p className="text-gray-400 mb-2">Yakin ingin menghapus user:</p>
        <p className="font-bold text-white mono text-lg mb-6">{deleteConfirm?.name}</p>
        <div className="flex gap-3">
          <button onClick={() => setDeleteConfirm(null)}
            className="flex-1 px-4 py-2.5 rounded-lg border border-border text-gray-400 hover:text-white text-sm">
            Batal
          </button>
          <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 btn-danger px-4 py-2.5 rounded-lg text-sm">
            Hapus User
          </button>
        </div>
      </Modal>

      {/* Success Info Modal */}
      <Modal open={!!successInfo} onClose={() => setSuccessInfo(null)} title="✅ User PPPoE Berhasil Dibuat!">
        <div className="space-y-4">
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center">
            <CheckCircle size={40} className="text-green-400 mx-auto mb-2" />
            <p className="text-green-400 font-semibold">Berhasil ditambahkan!</p>
            <p className="text-gray-500 text-xs mt-1">Simpan informasi berikut dan berikan ke pelanggan</p>
          </div>
          <div className="bg-darker border border-border rounded-xl overflow-hidden">
            {[
              { icon: User, label: 'Username', value: successInfo?.name, mono: true },
              { icon: Eye, label: 'Password', value: successInfo?.password, mono: true },
              { icon: Package, label: 'Paket / Profile', value: successInfo?.profile },
              { icon: Calendar, label: 'Tanggal Pemasangan', value: successInfo?.installDate || 'Tidak diisi' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-0">
                <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center text-primary shrink-0">
                  <item.icon size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-500">{item.label}</div>
                  <div className={`text-white font-semibold text-sm ${item.mono ? 'mono' : ''}`}>{item.value || '-'}</div>
                </div>
                <button onClick={() => { navigator.clipboard.writeText(item.value || ''); }}
                  className="p-1.5 rounded text-gray-500 hover:text-primary transition-colors" title="Copy">
                  <Copy size={13} />
                </button>
              </div>
            ))}
          </div>
          {successInfo?.installDate && (
            <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 text-xs text-gray-400">
              📅 Jatuh tempo tagihan: <span className="text-primary font-semibold">
                {(() => {
                  try {
                    const d = new Date(successInfo.installDate);
                    d.setDate(d.getDate() + 30);
                    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
                  } catch { return '-'; }
                })()}
              </span>
              <br/>⏰ Reminder otomatis akan dikirim H-2 sebelum jatuh tempo.
            </div>
          )}
          <button onClick={() => setSuccessInfo(null)} className="btn-primary w-full py-2.5 rounded-lg font-semibold">
            Tutup
          </button>
        </div>
      </Modal>
    </div>
  );
}
