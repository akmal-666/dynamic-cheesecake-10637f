import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit, Trash2, Save, X, RefreshCw, Key } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { loadCustomers, saveCustomer } from '../../utils/db';
import { useApp } from '../../contexts/AppContext';
import { parseComment } from '../../utils/mockData';

const EMPTY = {
  id: '', pppoe_username: '', phone: '', full_name: '',
  customer_id: '', profile: '', active: true, must_change_pw: true,
};

export default function CustomerAccounts() {
  const { callMikrotik } = useApp();
  const [customers, setCustomers] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState(false);
  const [form,      setForm]      = useState(EMPTY);
  const [editId,    setEditId]    = useState(null);
  const [search,    setSearch]    = useState('');
  const [syncing,   setSyncing]   = useState(false);

  useEffect(() => { fetchCustomers(); }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    const data = await loadCustomers();
    setCustomers(data || []);
    setLoading(false);
  };

  const syncFromPPPoE = async () => {
    setSyncing(true);
    const result = await callMikrotik('/ppp/secret', 'GET');
    if (!result.success) { toast.error('Gagal ambil data Mikrotik'); setSyncing(false); return; }

    const existing = await loadCustomers();
    const existingUsernames = new Set(existing.map(c => c.pppoe_username));
    let added = 0;

    for (const u of result.data) {
      if (existingUsernames.has(u.name)) continue;
      const { phone, fullName, customerId, installDate } = parseComment(u.comment);
      if (!phone) continue; // skip users without phone
      const cleanPh = phone.replace(/\D/g, '');
      const cust = {
        id:             'cust_' + u['.' + 'id'].replace('*', '') + '_' + Date.now(),
        pppoe_username: u.name,
        phone:          cleanPh,
        password_hash:  btoa(cleanPh.slice(-6) || '123456'),
        must_change_pw: true,
        full_name:      fullName || '',
        customer_id:    customerId || '',
        profile:        u.profile || '',
        active:         u.disabled !== 'true',
        created_at:     new Date().toISOString(),
      };
      await saveCustomer(cust);
      added++;
    }

    await fetchCustomers();
    toast.success(added > 0 ? `${added} akun customer berhasil dibuat!` : 'Semua user sudah memiliki akun');
    setSyncing(false);
  };

  const openAdd = () => {
    setForm({ ...EMPTY, id: 'cust_' + Date.now() });
    setEditId(null);
    setModal(true);
  };

  const openEdit = (c) => { setForm({ ...c }); setEditId(c.id); setModal(true); };

  const handleSave = async () => {
    if (!form.pppoe_username || !form.phone) return toast.error('Username PPPoE dan No. HP wajib diisi');
    const cleanPh = form.phone.replace(/\D/g, '');
    const customer = {
      ...form,
      phone: cleanPh,
      password_hash: form.password_hash || btoa(cleanPh.slice(-6) || '123456'),
    };
    await saveCustomer(customer);
    await fetchCustomers();
    toast.success(editId ? 'Akun diupdate!' : 'Akun berhasil dibuat!');
    setModal(false);
  };

  const resetPassword = async (c) => {
    const cleanPh = (c.phone || '').replace(/\D/g, '');
    const defaultPass = cleanPh.slice(-6) || '123456';
    const updated = { ...c, password_hash: btoa(defaultPass), must_change_pw: true };
    await saveCustomer(updated);
    await fetchCustomers();
    toast.success(`Password direset ke: ${defaultPass} (6 digit terakhir HP)`);
  };

  const toggleActive = async (c) => {
    await saveCustomer({ ...c, active: !c.active });
    await fetchCustomers();
  };

  const filtered = customers.filter(c =>
    c.pppoe_username?.includes(search) ||
    c.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search) ||
    c.customer_id?.includes(search)
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Akun Customer Portal</h1>
          <p className="text-gray-500 text-sm mt-1">Kelola akun login portal customer</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={syncFromPPPoE} disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-gray-300 hover:text-white text-sm disabled:opacity-50">
            <RefreshCw size={15} className={syncing ? 'animate-spin' : ''}/>
            {syncing ? 'Sinkronisasi...' : 'Sync dari PPPoE'}
          </button>
          <button onClick={openAdd} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm">
            <Plus size={15}/>Tambah Manual
          </button>
        </div>
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Cari username, nama, no HP..."
        className="input-cyber w-full px-4 py-2.5 rounded-xl text-sm"/>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-darker">
              {['STATUS','USERNAME PPPOE','NAMA / ID','NO. HP','PAKET','AKSI'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs text-gray-500 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-500">Memuat...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-600">
                {customers.length === 0 ? 'Belum ada akun. Klik "Sync dari PPPoE" untuk impor otomatis.' : 'Tidak ditemukan'}
              </td></tr>
            ) : filtered.map(c => (
              <tr key={c.id} className="border-b border-border/50 hover:bg-darker/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className={clsx('w-2 h-2 rounded-full', c.active ? 'bg-green-400' : 'bg-gray-600')}/>
                    <span className={clsx('text-xs', c.active ? 'text-green-400' : 'text-gray-500')}>
                      {c.active ? 'Aktif' : 'Nonaktif'}
                    </span>
                    {c.must_change_pw && (
                      <span className="text-xs text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded">Blm login</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 mono text-white text-sm">{c.pppoe_username}</td>
                <td className="px-4 py-3">
                  <div className="text-white text-sm">{c.full_name || '-'}</div>
                  <div className="text-xs text-primary/80 mono">{c.customer_id || '-'}</div>
                </td>
                <td className="px-4 py-3 mono text-gray-400 text-sm">{c.phone || '-'}</td>
                <td className="px-4 py-3">
                  {c.profile && <span className="text-xs px-2 py-1 rounded bg-primary/10 text-primary mono">{c.profile}</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => resetPassword(c)} title="Reset password"
                      className="p-1.5 rounded-lg text-yellow-400 hover:bg-yellow-400/10">
                      <Key size={14}/>
                    </button>
                    <button onClick={() => openEdit(c)}
                      className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-400/10">
                      <Edit size={14}/>
                    </button>
                    <button onClick={() => toggleActive(c)}
                      className={clsx('p-1.5 rounded-lg text-xs', c.active ? 'text-green-400 hover:bg-green-400/10' : 'text-gray-500 hover:bg-gray-400/10')}>
                      {c.active ? 'ON' : 'OFF'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="text-white font-semibold">{editId ? 'Edit' : 'Tambah'} Akun Customer</h3>
              <button onClick={() => setModal(false)}><X size={20} className="text-gray-500"/></button>
            </div>
            <div className="p-5 space-y-3">
              {[
                { label: 'Username PPPoE *', key: 'pppoe_username', ph: 'username pppoe', mono: true },
                { label: 'No. HP (untuk login) *', key: 'phone', ph: '08xxxxxxxxxx', mono: true },
                { label: 'Nama Lengkap', key: 'full_name', ph: 'Nama pelanggan' },
                { label: 'ID Pelanggan', key: 'customer_id', ph: 'BRN-XXXX', mono: true },
                { label: 'Paket', key: 'profile', ph: '20Mbps' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs text-gray-400 mb-1.5">{f.label}</label>
                  <input value={form[f.key] || ''} onChange={e => setForm(p => ({...p, [f.key]: e.target.value}))}
                    className={`input-cyber w-full px-3 py-2.5 rounded-lg text-sm ${f.mono ? 'mono' : ''}`}
                    placeholder={f.ph}/>
                </div>
              ))}
              <label className="flex items-center gap-2 cursor-pointer">
                <div onClick={() => setForm(p => ({...p, active: !p.active}))}
                  className={clsx('w-10 h-5 rounded-full transition-colors relative', form.active ? 'bg-primary' : 'bg-gray-600')}>
                  <div className={clsx('w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all', form.active ? 'left-5' : 'left-0.5')}/>
                </div>
                <span className="text-sm text-gray-300">Akun aktif</span>
              </label>
              <p className="text-xs text-gray-600">Password default = 6 digit terakhir No. HP. Customer wajib ganti saat pertama login.</p>
            </div>
            <div className="flex gap-3 p-5 border-t border-border">
              <button onClick={() => setModal(false)} className="flex-1 py-2.5 rounded-lg border border-border text-gray-400 text-sm">Batal</button>
              <button onClick={handleSave} className="btn-primary flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm">
                <Save size={15}/>Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
