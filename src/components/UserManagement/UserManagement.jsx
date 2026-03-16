import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Edit2, Trash2, Shield, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white">✕</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

const ROLE_COLORS = {
  superadmin: 'bg-red-500/10 text-red-400 border-red-500/30',
  admin: 'bg-primary/10 text-primary border-primary/30',
  operator: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  viewer: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
};

const EMPTY_FORM = { username: '', password: '', name: '', email: '', role: 'operator', active: true };

export default function UserManagement() {
  const { user: currentUser, webUsers, addWebUser, updateWebUser, deleteWebUser, roles } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showPass, setShowPass] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const openAdd = () => { setEditUser(null); setForm(EMPTY_FORM); setModalOpen(true); };
  const openEdit = (u) => { setEditUser(u); setForm({ ...u, password: '' }); setModalOpen(true); };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!editUser && !form.password) { toast.error('Password wajib diisi'); return; }
    if (editUser) {
      const updateData = { ...form };
      if (!updateData.password) delete updateData.password;
      updateWebUser(editUser.id, updateData);
      toast.success('User berhasil diupdate!');
    } else {
      if (webUsers.find(u => u.username === form.username)) {
        toast.error('Username sudah digunakan');
        return;
      }
      addWebUser(form);
      toast.success('User berhasil ditambahkan!');
    }
    setModalOpen(false);
  };

  const handleDelete = (user) => {
    if (user.id === currentUser.id) { toast.error('Tidak bisa menghapus akun sendiri'); return; }
    deleteWebUser(user.id);
    toast.success('User dihapus');
    setDeleteConfirm(null);
  };

  const toggleActive = (user) => {
    if (user.id === currentUser.id) { toast.error('Tidak bisa menonaktifkan akun sendiri'); return; }
    updateWebUser(user.id, { active: !user.active });
    toast.success(user.active ? 'User dinonaktifkan' : 'User diaktifkan');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">User Management</h1>
          <p className="text-gray-500 text-sm mt-1">Kelola akun dan hak akses pengguna web</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm">
          <Plus size={18} />Tambah User
        </button>
      </div>



      {/* Users table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-medium text-white">Daftar Pengguna ({webUsers.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-darker/50">
                <th className="text-left px-4 py-3 text-xs text-gray-500">STATUS</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500">NAMA</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500">USERNAME</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500">EMAIL</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500">ROLE</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500">DIBUAT</th>
                <th className="text-right px-4 py-3 text-xs text-gray-500">AKSI</th>
              </tr>
            </thead>
            <tbody>
              {webUsers.map(u => (
                <tr key={u.id} className={clsx('table-row border-b border-border/50 last:border-0',
                  u.id === currentUser.id && 'bg-primary/5')}>
                  <td className="px-4 py-3">
                    <span className={clsx('w-2 h-2 rounded-full inline-block', u.active ? 'bg-green-400' : 'bg-gray-600')} />
                  </td>
                  <td className="px-4 py-3 font-medium text-white">
                    {u.name}
                    {u.id === currentUser.id && <span className="ml-2 text-xs text-primary mono">(Anda)</span>}
                  </td>
                  <td className="px-4 py-3 mono text-gray-400">{u.username}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{u.email || '-'}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 rounded-md text-xs border mono bg-primary/10 text-primary border-primary/20">
                      {roles.find(r => r.id === u.role)?.label || u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs mono">
                    {new Date(u.createdAt).toLocaleDateString('id-ID')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => toggleActive(u)}
                        className={clsx('p-1.5 rounded-lg transition-colors',
                          u.active ? 'text-yellow-400 hover:bg-yellow-400/10' : 'text-green-400 hover:bg-green-400/10')}>
                        {u.active ? <XCircle size={16} /> : <CheckCircle size={16} />}
                      </button>
                      <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-400/10">
                        <Edit2 size={16} />
                      </button>
                      {u.id !== currentUser.id && (
                        <button onClick={() => setDeleteConfirm(u)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-400/10">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editUser ? 'Edit User' : 'Tambah User Baru'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Nama Lengkap <span className="text-red-400">*</span></label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              className="input-cyber w-full px-3 py-2.5 rounded-lg text-sm" required placeholder="Nama Lengkap" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Username <span className="text-red-400">*</span></label>
              <input value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                className="input-cyber w-full px-3 py-2.5 rounded-lg text-sm mono" required
                placeholder="username" disabled={!!editUser} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">
                Password {!editUser && <span className="text-red-400">*</span>}
                {editUser && <span className="text-gray-600 text-xs ml-1">(kosong = tidak diubah)</span>}
              </label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  className="input-cyber w-full px-3 py-2.5 pr-9 rounded-lg text-sm mono"
                  placeholder={editUser ? '(tidak diubah)' : 'password'} required={!editUser} />
                <button type="button" onClick={() => setShowPass(p => !p)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Email</label>
            <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              className="input-cyber w-full px-3 py-2.5 rounded-lg text-sm" placeholder="email@example.com" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Role <span className="text-red-400">*</span></label>
            <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
              className="input-cyber w-full px-3 py-2.5 rounded-lg text-sm">
              {roles.map(r => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setForm(p => ({ ...p, active: !p.active }))}
              className={clsx('w-10 h-5 rounded-full transition-colors relative', form.active ? 'bg-green-500' : 'bg-gray-600')}>
              <div className={clsx('absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform',
                form.active ? 'left-5' : 'left-0.5')} />
            </button>
            <span className="text-sm text-gray-400">{form.active ? 'User Aktif' : 'User Nonaktif'}</span>
          </div>
          <div className="flex gap-3 pt-3 border-t border-border">
            <button type="button" onClick={() => setModalOpen(false)}
              className="flex-1 px-4 py-2.5 rounded-lg border border-border text-gray-400 text-sm">Batal</button>
            <button type="submit" className="flex-1 btn-primary px-4 py-2.5 rounded-lg text-sm">
              {editUser ? 'Update User' : 'Tambah User'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Konfirmasi Hapus">
        <p className="text-gray-400 mb-2">Yakin ingin menghapus user:</p>
        <p className="font-bold text-white text-lg mb-6">{deleteConfirm?.name} <span className="mono text-gray-500">(@{deleteConfirm?.username})</span></p>
        <div className="flex gap-3">
          <button onClick={() => setDeleteConfirm(null)}
            className="flex-1 px-4 py-2.5 rounded-lg border border-border text-gray-400 text-sm">Batal</button>
          <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 btn-danger px-4 py-2.5 rounded-lg text-sm">Hapus</button>
        </div>
      </Modal>
    </div>
  );
}
