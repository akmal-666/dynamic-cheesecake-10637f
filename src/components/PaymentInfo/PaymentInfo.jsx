import React, { useState, useEffect } from 'react';
import { CreditCard, Plus, Trash2, Edit, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { loadPaymentInfo, savePaymentInfo } from '../../utils/db';

const EMPTY = { id: '', bank_name: '', account_no: '', account_name: '', notes: '', active: true, sort_order: 0 };

export default function PaymentInfo() {
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm]   = useState(EMPTY);
  const [editId, setEditId] = useState(null);

  useEffect(() => { loadPaymentInfo().then(d => setItems(d || [])); }, []);

  const persist = async (list) => { setItems(list); await savePaymentInfo(list); };

  const openAdd  = () => { setForm({ ...EMPTY, id: 'pay_' + Date.now() }); setEditId(null); setModal(true); };
  const openEdit = (i) => { setForm({ ...i }); setEditId(i.id); setModal(true); };

  const handleSave = async () => {
    if (!form.bank_name || !form.account_no || !form.account_name)
      return toast.error('Nama bank, nomor rekening, dan nama pemilik wajib diisi');
    const updated = editId
      ? items.map(i => i.id === editId ? { ...form } : i)
      : [...items, { ...form, sort_order: items.length }];
    await persist(updated);
    toast.success(editId ? 'Info pembayaran diupdate!' : 'Info pembayaran ditambahkan!');
    setModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Info Pembayaran</h1>
          <p className="text-gray-500 text-sm mt-1">Rekening bank untuk pembayaran customer</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm">
          <Plus size={16}/>Tambah Rekening
        </button>
      </div>

      <div className="grid gap-3">
        {items.length === 0 && (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <CreditCard size={36} className="mx-auto text-gray-600 mb-3"/>
            <p className="text-gray-500">Belum ada info pembayaran.</p>
          </div>
        )}
        {items.map(item => (
          <div key={item.id} className="bg-card border border-border rounded-xl p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <CreditCard size={20} className="text-primary"/>
              </div>
              <div>
                <div className="font-semibold text-white">{item.bank_name}</div>
                <div className="mono text-primary text-sm">{item.account_no}</div>
                <div className="text-gray-400 text-xs">{item.account_name}</div>
                {item.notes && <div className="text-gray-600 text-xs mt-0.5">{item.notes}</div>}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => openEdit(item)} className="p-2 rounded-lg text-blue-400 hover:bg-blue-400/10"><Edit size={16}/></button>
              <button onClick={async () => { if(window.confirm('Hapus?')) { await persist(items.filter(i => i.id !== item.id)); toast.success('Dihapus'); }}}
                className="p-2 rounded-lg text-red-400 hover:bg-red-400/10"><Trash2 size={16}/></button>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="text-white font-semibold">{editId ? 'Edit' : 'Tambah'} Rekening Bank</h3>
              <button onClick={() => setModal(false)}><X size={20} className="text-gray-500"/></button>
            </div>
            <div className="p-5 space-y-3">
              {[
                { label: 'Nama Bank', key: 'bank_name', placeholder: 'BCA / Mandiri / BNI...' },
                { label: 'Nomor Rekening', key: 'account_no', placeholder: '1234567890', mono: true },
                { label: 'Nama Pemilik', key: 'account_name', placeholder: 'PT. AUDY MANDIRI INDONESIA' },
                { label: 'Catatan (opsional)', key: 'notes', placeholder: 'Konfirmasi transfer ke admin' },
              ].map(({ label, key, placeholder, mono }) => (
                <div key={key}>
                  <label className="block text-xs text-gray-400 mb-1.5">{label}</label>
                  <input value={form[key] || ''} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                    className={`input-cyber w-full px-3 py-2.5 rounded-lg text-sm ${mono ? 'mono' : ''}`}
                    placeholder={placeholder}/>
                </div>
              ))}
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
