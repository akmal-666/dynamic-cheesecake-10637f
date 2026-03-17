import React, { useState, useEffect, useRef } from 'react';
import { Image, Plus, Trash2, Edit, Eye, EyeOff, GripVertical, Save, X, ExternalLink } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { loadBanners, saveBanners } from '../../utils/db';

const EMPTY = { id: '', title: '', image_url: '', link_url: '', active: true, sort_order: 0 };

export default function BannerManagement() {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(false);
  const [form, setForm]         = useState(EMPTY);
  const [editId, setEditId]     = useState(null);
  const [preview, setPreview]   = useState(null);
  const fileRef = useRef();

  useEffect(() => {
    loadBanners().then(data => { setBanners(data || []); setLoading(false); });
  }, []);

  const persist = async (newList) => {
    setBanners(newList);
    await saveBanners(newList);
  };

  const openAdd = () => { setForm({ ...EMPTY, id: 'bnr_' + Date.now() }); setEditId(null); setPreview(null); setModal(true); };
  const openEdit = (b) => { setForm({ ...b }); setEditId(b.id); setPreview(b.image_url || null); setModal(true); };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error('Ukuran gambar maksimal 2MB');
    const reader = new FileReader();
    reader.onload = (ev) => {
      setForm(p => ({ ...p, image_url: ev.target.result }));
      setPreview(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!form.title) return toast.error('Judul banner wajib diisi');
    if (!form.image_url) return toast.error('Gambar banner wajib diupload');
    const updated = editId
      ? banners.map(b => b.id === editId ? { ...form } : b)
      : [...banners, { ...form, sort_order: banners.length }];
    await persist(updated);
    toast.success(editId ? 'Banner diupdate!' : 'Banner ditambahkan!');
    setModal(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus banner ini?')) return;
    await persist(banners.filter(b => b.id !== id));
    toast.success('Banner dihapus');
  };

  const toggleActive = async (id) => {
    await persist(banners.map(b => b.id === id ? { ...b, active: !b.active } : b));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Banner Management</h1>
          <p className="text-gray-500 text-sm mt-1">Kelola banner berjalan di portal customer (max 4)</p>
        </div>
        <button onClick={openAdd} disabled={banners.length >= 4}
          className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm disabled:opacity-40">
          <Plus size={16}/>Tambah Banner {banners.length >= 4 && '(Maks 4)'}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Memuat...</div>
      ) : banners.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Image size={40} className="mx-auto text-gray-600 mb-3"/>
          <p className="text-gray-500">Belum ada banner. Klik "Tambah Banner" untuk mulai.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {banners.map((b, i) => (
            <div key={b.id} className={clsx('bg-card border rounded-xl overflow-hidden flex',
              b.active ? 'border-border' : 'border-border/30 opacity-60')}>
              {/* Preview */}
              <div className="w-48 h-28 bg-darker flex-shrink-0 overflow-hidden">
                {b.image_url
                  ? <img src={b.image_url} alt={b.title} className="w-full h-full object-cover"/>
                  : <div className="w-full h-full flex items-center justify-center text-gray-600"><Image size={24}/></div>
                }
              </div>
              {/* Info */}
              <div className="flex-1 p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-darker text-gray-400 px-2 py-0.5 rounded mono">#{i+1}</span>
                    <span className={clsx('text-xs px-2 py-0.5 rounded-full',
                      b.active ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-500')}>
                      {b.active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </div>
                  <p className="text-white font-semibold mt-1">{b.title}</p>
                  {b.link_url && (
                    <p className="text-xs text-primary mono mt-0.5 truncate max-w-xs">{b.link_url}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleActive(b.id)}
                    className={clsx('p-2 rounded-lg transition-colors',
                      b.active ? 'text-green-400 hover:bg-green-400/10' : 'text-gray-500 hover:bg-gray-400/10')}>
                    {b.active ? <Eye size={16}/> : <EyeOff size={16}/>}
                  </button>
                  <button onClick={() => openEdit(b)} className="p-2 rounded-lg text-blue-400 hover:bg-blue-400/10">
                    <Edit size={16}/>
                  </button>
                  <button onClick={() => handleDelete(b.id)} className="p-2 rounded-lg text-red-400 hover:bg-red-400/10">
                    <Trash2 size={16}/>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="text-white font-semibold">{editId ? 'Edit Banner' : 'Tambah Banner'}</h3>
              <button onClick={() => setModal(false)} className="text-gray-500 hover:text-white"><X size={20}/></button>
            </div>
            <div className="p-5 space-y-4">
              {/* Upload area */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Gambar Banner <span className="text-red-400">*</span></label>
                <div onClick={() => fileRef.current.click()}
                  className="border-2 border-dashed border-border rounded-xl overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
                  style={{height: 160}}>
                  {preview
                    ? <img src={preview} alt="preview" className="w-full h-full object-cover"/>
                    : <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-2">
                        <Image size={32}/>
                        <p className="text-sm">Klik untuk upload gambar</p>
                        <p className="text-xs text-gray-600">Maks 2MB • JPG, PNG, WebP</p>
                      </div>
                  }
                </div>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden"/>
                {preview && (
                  <button onClick={() => { setPreview(null); setForm(p => ({ ...p, image_url: '' })); fileRef.current.value = ''; }}
                    className="text-xs text-red-400 hover:underline mt-1">Hapus gambar</button>
                )}
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Judul Banner <span className="text-red-400">*</span></label>
                <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  className="input-cyber w-full px-3 py-2.5 rounded-lg text-sm" placeholder="Contoh: Promo Lebaran 2025"/>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Link URL <span className="text-gray-600">(opsional)</span></label>
                <input value={form.link_url} onChange={e => setForm(p => ({ ...p, link_url: e.target.value }))}
                  className="input-cyber w-full px-3 py-2.5 rounded-lg text-sm mono" placeholder="https://..."/>
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <div onClick={() => setForm(p => ({ ...p, active: !p.active }))}
                  className={clsx('w-11 h-6 rounded-full transition-colors relative',
                    form.active ? 'bg-primary' : 'bg-gray-600')}>
                  <div className={clsx('w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all',
                    form.active ? 'left-5' : 'left-0.5')}/>
                </div>
                <span className="text-sm text-gray-300">Banner aktif</span>
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
