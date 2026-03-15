import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Edit, Trash2, Shield, Check, X, AlertCircle, Lock, ChevronDown, ChevronUp } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 modal-backdrop flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

const ROLE_COLORS = [
  { value: 'cyan',   label: 'Cyan',   cls: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' },
  { value: 'green',  label: 'Hijau',  cls: 'bg-green-500/15 text-green-400 border-green-500/30' },
  { value: 'orange', label: 'Oranye', cls: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  { value: 'purple', label: 'Ungu',   cls: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  { value: 'red',    label: 'Merah',  cls: 'bg-red-500/15 text-red-400 border-red-500/30' },
  { value: 'gray',   label: 'Abu',    cls: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
];

function getRoleColor(roleId) {
  if (roleId === 'superadmin') return ROLE_COLORS[4];
  if (roleId === 'admin') return ROLE_COLORS[0];
  if (roleId === 'operator') return ROLE_COLORS[2];
  if (roleId === 'viewer') return ROLE_COLORS[5];
  return ROLE_COLORS[1];
}

export default function Roles() {
  const { roles, addRole, updateRole, deleteRole, webUsers, ALL_PAGES, user: currentUser } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [editRole, setEditRole] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [expandedRole, setExpandedRole] = useState(null);
  const [form, setForm] = useState({ id: '', label: '', permissions: [], color: 'green' });
  const [idError, setIdError] = useState('');

  const openAdd = () => {
    setEditRole(null);
    setForm({ id: '', label: '', permissions: ['dashboard'], color: 'green' });
    setIdError('');
    setModalOpen(true);
  };

  const openEdit = (role) => {
    setEditRole(role);
    setForm({ id: role.id, label: role.label, permissions: [...role.permissions], color: role.color || 'green' });
    setIdError('');
    setModalOpen(true);
  };

  const togglePermission = (key) => {
    setForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(key)
        ? prev.permissions.filter(p => p !== key)
        : [...prev.permissions, key],
    }));
  };

  const handleSave = () => {
    if (!form.label.trim()) return toast.error('Nama role wajib diisi');
    if (!editRole) {
      if (!form.id.trim()) return toast.error('ID role wajib diisi');
      if (!/^[a-z0-9_]+$/.test(form.id)) {
        setIdError('Hanya huruf kecil, angka, dan underscore');
        return;
      }
      if (roles.find(r => r.id === form.id)) {
        setIdError('ID sudah digunakan');
        return;
      }
      addRole({ id: form.id, label: form.label, permissions: form.permissions, color: form.color });
      toast.success('Role berhasil ditambahkan!');
    } else {
      updateRole(editRole.id, { label: form.label, permissions: form.permissions, color: form.color });
      toast.success('Role berhasil diupdate!');
    }
    setModalOpen(false);
  };

  const handleDelete = (roleId) => {
    const result = deleteRole(roleId);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Role berhasil dihapus!');
    }
    setDeleteConfirm(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Manajemen Role</h1>
          <p className="text-gray-500 text-sm mt-1">Kelola role dan hak akses pengguna website</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm">
          <Plus size={16} />Tambah Role
        </button>
      </div>

      {/* Role cards */}
      <div className="space-y-4">
        {roles.map(role => {
          const color = getRoleColor(role.id);
          const usersCount = webUsers.filter(u => u.role === role.id).length;
          const expanded = expandedRole === role.id;
          return (
            <div key={role.id} className="bg-card border border-border rounded-xl overflow-hidden">
              {/* Header */}
              <div className="px-5 py-4 flex items-center gap-4">
                <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center border', color.cls)}>
                  {role.id === 'superadmin' ? <Lock size={18} /> : <Shield size={18} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{role.label}</span>
                    <span className={clsx('px-2 py-0.5 rounded-full text-xs border mono', color.cls)}>{role.id}</span>
                    {!role.editable && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-gray-500/10 border border-gray-500/20 text-gray-500">
                        <Lock size={10} className="inline mr-1" />Terkunci
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {usersCount} user · {role.permissions.length} hak akses
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {role.editable && (
                    <>
                      <button onClick={() => openEdit(role)} className="p-2 rounded-lg text-primary hover:bg-primary/10 transition-all">
                        <Edit size={15} />
                      </button>
                      <button onClick={() => setDeleteConfirm(role)}
                        className="p-2 rounded-lg text-red-400 hover:bg-red-400/10 transition-all">
                        <Trash2 size={15} />
                      </button>
                    </>
                  )}
                  <button onClick={() => setExpandedRole(expanded ? null : role.id)}
                    className="p-2 rounded-lg text-gray-400 hover:text-white transition-all">
                    {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>
              </div>

              {/* Permissions grid */}
              {expanded && (
                <div className="px-5 pb-5 border-t border-border pt-4">
                  <div className="text-xs text-gray-500 mb-3 uppercase tracking-wider font-semibold">Hak Akses Menu</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {ALL_PAGES.map(page => {
                      const has = role.permissions.includes(page.key);
                      return (
                        <div key={page.key} className={clsx(
                          'flex items-center gap-2 px-3 py-2 rounded-lg border text-xs',
                          has ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-darker border-border/50 text-gray-600'
                        )}>
                          {has ? <Check size={13} /> : <X size={13} />}
                          <span>{page.label}</span>
                        </div>
                      );
                    })}
                  </div>
                  {/* Users with this role */}
                  {usersCount > 0 && (
                    <div className="mt-4">
                      <div className="text-xs text-gray-500 mb-2 uppercase tracking-wider font-semibold">User dengan Role Ini</div>
                      <div className="flex flex-wrap gap-2">
                        {webUsers.filter(u => u.role === role.id).map(u => (
                          <div key={u.id} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-darker rounded-lg border border-border text-xs">
                            <div className={clsx('w-1.5 h-1.5 rounded-full', u.active ? 'bg-green-400' : 'bg-red-400')} />
                            <span className="text-gray-300">{u.name}</span>
                            <span className="text-gray-600 mono">({u.username})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editRole ? `Edit Role: ${editRole.label}` : 'Tambah Role Baru'}>
        <div className="space-y-5">
          {!editRole && (
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">
                ID Role <span className="text-red-400">*</span>
                <span className="text-gray-600 text-xs ml-2">(huruf kecil, angka, underscore)</span>
              </label>
              <input value={form.id} onChange={e => { setForm(p => ({...p, id: e.target.value.toLowerCase()})); setIdError(''); }}
                className={clsx('input-cyber w-full px-3 py-2.5 rounded-lg text-sm mono',
                  idError && 'border-red-500/50')}
                placeholder="contoh: supervisor" />
              {idError && <p className="text-red-400 text-xs mt-1">{idError}</p>}
            </div>
          )}
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Nama Role <span className="text-red-400">*</span></label>
            <input value={form.label} onChange={e => setForm(p => ({...p, label: e.target.value}))}
              className="input-cyber w-full px-3 py-2.5 rounded-lg text-sm" placeholder="Supervisor" />
          </div>

          {/* Permission checkboxes */}
          <div>
            <label className="block text-sm text-gray-400 mb-3">Hak Akses Menu</label>
            <div className="grid grid-cols-1 gap-2">
              {ALL_PAGES.map(page => {
                const has = form.permissions.includes(page.key);
                return (
                  <label key={page.key} className={clsx(
                    'flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all',
                    has ? 'bg-primary/10 border-primary/40 text-white' : 'bg-darker border-border text-gray-400 hover:border-gray-500'
                  )}>
                    <div className={clsx('w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0',
                      has ? 'bg-primary border-primary' : 'border-gray-600')}>
                      {has && <Check size={12} className="text-dark" />}
                    </div>
                    <input type="checkbox" checked={has} onChange={() => togglePermission(page.key)} className="hidden" />
                    <div>
                      <div className="text-sm font-medium">{page.label}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 py-2.5 rounded-lg border border-border text-gray-400 hover:text-white">Batal</button>
            <button onClick={handleSave} className="btn-primary flex-1 py-2.5 rounded-lg flex items-center justify-center gap-2">
              <Check size={16} />{editRole ? 'Simpan Perubahan' : 'Buat Role'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Konfirmasi Hapus Role">
        <div className="text-center py-4">
          <AlertCircle size={48} className="text-red-400 mx-auto mb-4" />
          <p className="text-white mb-2">Hapus role <span className="text-primary mono">{deleteConfirm?.label}</span>?</p>
          <p className="text-gray-500 text-sm mb-6">Pastikan tidak ada user yang menggunakan role ini.</p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-lg border border-border text-gray-400">Batal</button>
            <button onClick={() => handleDelete(deleteConfirm.id)} className="btn-danger flex-1 py-2.5 rounded-lg">Hapus Role</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
