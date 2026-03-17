import React, { useState, useEffect } from 'react';
import { HelpCircle, Plus, Edit, Trash2, Save, X, ChevronDown, ChevronUp } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { loadFAQ, saveFAQItems } from '../../utils/db';

const CATS = ['Koneksi','Tagihan','Akun','Perangkat','Layanan','Umum'];
const EMPTY = { id:'', category:'Umum', question:'', answer:'', sort_order:0, active:true };

export default function FAQManagement() {
  const [items, setItems]   = useState([]);
  const [modal, setModal]   = useState(false);
  const [form, setForm]     = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [expanded, setExp]  = useState(null);

  useEffect(() => { loadFAQ().then(d => setItems(d||[])); }, []);

  const persist = async (list) => { setItems(list); await saveFAQItems(list); };

  const openAdd  = () => { setForm({...EMPTY, id:'faq_'+Date.now()}); setEditId(null); setModal(true); };
  const openEdit = (f) => { setForm({...f}); setEditId(f.id); setModal(true); };

  const handleSave = async () => {
    if (!form.question || !form.answer) return toast.error('Pertanyaan dan jawaban wajib diisi');
    const updated = editId
      ? items.map(i => i.id===editId ? {...form} : i)
      : [...items, {...form, sort_order: items.length}];
    await persist(updated);
    toast.success(editId ? 'FAQ diupdate!' : 'FAQ ditambahkan!');
    setModal(false);
  };

  const grouped = CATS.reduce((acc, cat) => {
    acc[cat] = items.filter(i => i.category === cat);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">FAQ / Knowledge Base</h1>
          <p className="text-gray-500 text-sm mt-1">Kelola pertanyaan yang sering ditanyakan customer</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm">
          <Plus size={15}/>Tambah FAQ
        </button>
      </div>

      {CATS.map(cat => {
        const catItems = grouped[cat] || [];
        if (catItems.length === 0) return null;
        return (
          <div key={cat} className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-darker border-b border-border">
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">{cat}</span>
              <span className="text-xs text-gray-600 ml-2">({catItems.length})</span>
            </div>
            {catItems.map(f => (
              <div key={f.id} className="border-b border-border/50 last:border-0">
                <div className="flex items-center px-4 py-3 gap-3">
                  <button onClick={() => setExp(expanded===f.id ? null : f.id)} className="flex-1 text-left">
                    <p className={clsx('text-sm font-medium', f.active ? 'text-white' : 'text-gray-600')}>{f.question}</p>
                  </button>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(f)} className="p-1.5 text-blue-400 hover:bg-blue-400/10 rounded-lg"><Edit size={14}/></button>
                    <button onClick={async () => { if(window.confirm('Hapus FAQ ini?')) { await persist(items.filter(i=>i.id!==f.id)); toast.success('Dihapus'); }}} className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-lg"><Trash2 size={14}/></button>
                    <button onClick={() => setExp(expanded===f.id ? null : f.id)} className="p-1.5 text-gray-500">
                      {expanded===f.id ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                    </button>
                  </div>
                </div>
                {expanded===f.id && (
                  <div className="px-4 pb-3">
                    <p className="text-sm text-gray-400 bg-darker rounded-lg p-3">{f.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })}

      {items.length === 0 && (
        <div className="text-center py-12 text-gray-600">
          <HelpCircle size={36} className="mx-auto mb-3 opacity-30"/>
          <p>Belum ada FAQ. Klik "Tambah FAQ" untuk mulai.</p>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="text-white font-semibold">{editId?'Edit':'Tambah'} FAQ</h3>
              <button onClick={() => setModal(false)}><X size={20} className="text-gray-500"/></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Kategori</label>
                <select value={form.category} onChange={e => setForm(p=>({...p,category:e.target.value}))} className="input-cyber w-full px-3 py-2.5 rounded-lg text-sm">
                  {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Pertanyaan</label>
                <input value={form.question} onChange={e => setForm(p=>({...p,question:e.target.value}))} className="input-cyber w-full px-3 py-2.5 rounded-lg text-sm" placeholder="Pertanyaan yang sering ditanya..."/>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Jawaban</label>
                <textarea value={form.answer} onChange={e => setForm(p=>({...p,answer:e.target.value}))} rows={4} className="input-cyber w-full px-3 py-2.5 rounded-lg text-sm resize-none" placeholder="Jawaban lengkap..."/>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <div onClick={() => setForm(p=>({...p,active:!p.active}))}
                  className={clsx('w-10 h-5 rounded-full transition-colors relative', form.active ? 'bg-primary' : 'bg-gray-600')}>
                  <div className={clsx('w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all', form.active ? 'left-5' : 'left-0.5')}/>
                </div>
                <span className="text-sm text-gray-300">Tampilkan di portal customer</span>
              </label>
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
