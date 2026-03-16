import React, { useState, useEffect } from 'react';
import { useApp } from '../../contexts/AppContext';
import { MOCK_PPP_PROFILES } from '../../utils/mockData';
import { Plus, Edit2, Trash2, RefreshCw, Sliders, DollarSign } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';

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

const EMPTY_FORM = {
  name: '', 'rate-limit': '10M/10M', 'local-address': '192.168.1.1',
  'remote-address': '', 'session-timeout': '30d', 'idle-timeout': '2h',
  'dns-server': '8.8.8.8,8.8.4.4', 'only-one': 'yes',
  'address-pool': '', comment: '',
  _price: '', _description: '',
};

const PROFILE_EXTRAS_KEY = 'bronet_profile_extras';

function getExtras() {
  try { return JSON.parse(localStorage.getItem(PROFILE_EXTRAS_KEY) || '{}'); } catch { return {}; }
}
function saveExtras(extras) {
  localStorage.setItem(PROFILE_EXTRAS_KEY, JSON.stringify(extras));
}

export default function Profiles() {
  const { callMikrotik } = useApp();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editProfile, setEditProfile] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [extras, setExtras] = useState(getExtras());

  useEffect(() => { loadProfiles(); }, []);

  const loadProfiles = async () => {
    setLoading(true);
    const result = await callMikrotik('/ppp/profile', 'GET');
    const extrasData = getExtras();
    if (result.success && Array.isArray(result.data)) {
      const withExtras = result.data.map(p => ({
        ...p,
        _price: extrasData[p.name]?._price || p._price || '',
        _description: extrasData[p.name]?._description || p._description || '',
      }));
      setProfiles(withExtras);
      localStorage.setItem('bronet_profiles', JSON.stringify(withExtras));
    } else {
      const saved = localStorage.getItem('bronet_profiles');
      setProfiles(saved ? JSON.parse(saved) : MOCK_PPP_PROFILES);
    }
    setExtras(extrasData);
    setLoading(false);
  };

  const openAdd = () => { setEditProfile(null); setForm(EMPTY_FORM); setModalOpen(true); };
  const openEdit = (p) => { setEditProfile(p); setForm({ ...EMPTY_FORM, ...p }); setModalOpen(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const mikrotikPayload = {
      name: form.name,
      'rate-limit': form['rate-limit'],
      'local-address': form['local-address'],
      'remote-address': form['remote-address'],
      'session-timeout': form['session-timeout'],
      'idle-timeout': form['idle-timeout'],
      'dns-server': form['dns-server'],
      'only-one': form['only-one'],
    };
    if (form['address-pool']) mikrotikPayload['address-pool'] = form['address-pool'];

    let result;
    if (editProfile) {
      result = await callMikrotik(`/ppp/profile/${editProfile['.id']}`, 'PATCH', mikrotikPayload);
    } else {
      result = await callMikrotik('/ppp/profile', 'PUT', mikrotikPayload);
    }

    // Save extras (price & description) locally
    const newExtras = { ...getExtras(), [form.name]: { _price: form._price, _description: form._description } };
    saveExtras(newExtras);
    setExtras(newExtras);

    const updatedProfile = { ...mikrotikPayload, _price: form._price, _description: form._description };
    let newProfiles;
    if (editProfile) {
      newProfiles = profiles.map(p => p['.id'] === editProfile['.id'] ? { ...p, ...updatedProfile } : p);
    } else {
      newProfiles = [...profiles, { ...updatedProfile, '.id': '*' + Date.now() }];
    }
    setProfiles(newProfiles);
    localStorage.setItem('bronet_profiles', JSON.stringify(newProfiles));

    toast.success(editProfile ? 'Profil berhasil diupdate!' : 'Profil berhasil ditambahkan!');
    setModalOpen(false);
    setSaving(false);
    await loadProfiles();
  };

  const handleDelete = async (profile) => {
    const result = await callMikrotik(`/ppp/profile/${profile['.id']}`, 'DELETE');
    if (result.success || !result.error?.includes('connect')) {
      const newProfiles = profiles.filter(p => p['.id'] !== profile['.id']);
      setProfiles(newProfiles);
      localStorage.setItem('bronet_profiles', JSON.stringify(newProfiles));
      toast.success('Profil berhasil dihapus!');
    } else {
      toast.error('Gagal menghapus: ' + result.error);
    }
    setDeleteConfirm(null);
  };

  const formatPrice = (price) => {
    if (!price) return '-';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(price);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Profil Paket</h1>
          <p className="text-gray-500 text-sm mt-1">Kelola profil paket PPPoE Mikrotik</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadProfiles} disabled={loading} className="p-2 rounded-lg border border-border text-gray-400 hover:text-white">
            <RefreshCw size={18} className={loading ? 'spinner' : ''} />
          </button>
          <button onClick={openAdd} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm">
            <Plus size={18} />Tambah Profil
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-600">
          <RefreshCw size={24} className="spinner mr-2" />Memuat profil...
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {profiles.map(p => (
            <div key={p['.id']} className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-colors group">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-bold text-white mono">{p.name}</h3>
                  {p._description && <p className="text-xs text-gray-500 mt-0.5">{p._description}</p>}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-400/10">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => setDeleteConfirm(p)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-400/10">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              
              <div className="space-y-2 mb-4">
                {[
                  { label: 'Rate Limit', value: p['rate-limit'] || '-' },
                  { label: 'Local Address', value: p['local-address'] || '-' },
                  { label: 'Session Timeout', value: p['session-timeout'] || '-' },
                  { label: 'Idle Timeout', value: p['idle-timeout'] || '-' },
                  { label: 'DNS Server', value: p['dns-server'] || '-' },
                  { label: 'Only One', value: p['only-one'] || '-' },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">{row.label}</span>
                    <span className="mono text-gray-300">{row.value}</span>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-border">
                <div className="flex items-center gap-2">
                  <DollarSign size={14} className="text-green-400" />
                  <span className="text-green-400 font-bold mono text-base">{formatPrice(p._price)}</span>
                  <span className="text-xs text-gray-600">/bulan</span>
                </div>
              </div>
            </div>
          ))}

          {profiles.length === 0 && (
            <div className="col-span-full text-center py-16 text-gray-600">
              <Sliders size={40} className="mx-auto mb-3 opacity-30" />
              <p>Belum ada profil. Klik "Tambah Profil" untuk memulai.</p>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editProfile ? 'Edit Profil' : 'Tambah Profil Baru'}>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Nama Profil <span className="text-red-400">*</span></label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="input-cyber w-full px-3 py-2.5 rounded-lg text-sm mono" required
                placeholder="paket-10mbps" disabled={!!editProfile} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Rate Limit <span className="text-red-400">*</span></label>
              <input value={form['rate-limit']} onChange={e => setForm(p => ({ ...p, 'rate-limit': e.target.value }))}
                className="input-cyber w-full px-3 py-2.5 rounded-lg text-sm mono" required placeholder="10M/10M" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Local Address</label>
              <input value={form['local-address']} onChange={e => setForm(p => ({ ...p, 'local-address': e.target.value }))}
                className="input-cyber w-full px-3 py-2.5 rounded-lg text-sm mono" placeholder="192.168.1.1" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Address Pool</label>
              <input value={form['address-pool']} onChange={e => setForm(p => ({ ...p, 'address-pool': e.target.value }))}
                className="input-cyber w-full px-3 py-2.5 rounded-lg text-sm mono" placeholder="dhcp-pool" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Session Timeout</label>
              <input value={form['session-timeout']} onChange={e => setForm(p => ({ ...p, 'session-timeout': e.target.value }))}
                className="input-cyber w-full px-3 py-2.5 rounded-lg text-sm mono" placeholder="30d" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Idle Timeout</label>
              <input value={form['idle-timeout']} onChange={e => setForm(p => ({ ...p, 'idle-timeout': e.target.value }))}
                className="input-cyber w-full px-3 py-2.5 rounded-lg text-sm mono" placeholder="2h" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">DNS Server</label>
              <input value={form['dns-server']} onChange={e => setForm(p => ({ ...p, 'dns-server': e.target.value }))}
                className="input-cyber w-full px-3 py-2.5 rounded-lg text-sm mono" placeholder="8.8.8.8,8.8.4.4" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Only One</label>
              <select value={form['only-one']} onChange={e => setForm(p => ({ ...p, 'only-one': e.target.value }))}
                className="input-cyber w-full px-3 py-2.5 rounded-lg text-sm">
                <option value="yes">yes</option>
                <option value="no">no</option>
                <option value="default">default</option>
              </select>
            </div>
          </div>
          <div className="border-t border-border pt-3 space-y-3">
            <p className="text-xs text-primary font-semibold">INFO HARGA (disimpan lokal)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Harga / Bulan (Rp)</label>
                <input type="number" value={form._price} onChange={e => setForm(p => ({ ...p, _price: e.target.value }))}
                  className="input-cyber w-full px-3 py-2.5 rounded-lg text-sm mono" placeholder="150000" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Deskripsi Paket</label>
                <input value={form._description} onChange={e => setForm(p => ({ ...p, _description: e.target.value }))}
                  className="input-cyber w-full px-3 py-2.5 rounded-lg text-sm" placeholder="Paket Standar 10 Mbps" />
              </div>
            </div>
          </div>
          <div className="flex gap-3 pt-3 border-t border-border">
            <button type="button" onClick={() => setModalOpen(false)}
              className="flex-1 px-4 py-2.5 rounded-lg border border-border text-gray-400 hover:text-white text-sm">Batal</button>
            <button type="submit" disabled={saving} className="flex-1 btn-primary px-4 py-2.5 rounded-lg text-sm disabled:opacity-50">
              {saving ? 'Menyimpan...' : editProfile ? 'Update Profil' : 'Tambah Profil'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Konfirmasi Hapus">
        <p className="text-gray-400 mb-2">Yakin ingin menghapus profil:</p>
        <p className="font-bold text-white mono text-lg mb-6">{deleteConfirm?.name}</p>
        <div className="flex gap-3">
          <button onClick={() => setDeleteConfirm(null)}
            className="flex-1 px-4 py-2.5 rounded-lg border border-border text-gray-400 hover:text-white text-sm">Batal</button>
          <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 btn-danger px-4 py-2.5 rounded-lg text-sm">Hapus Profil</button>
        </div>
      </Modal>
    </div>
  );
}
