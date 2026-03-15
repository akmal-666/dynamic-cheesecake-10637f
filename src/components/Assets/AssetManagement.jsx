import React, { useState, useMemo, useEffect, useRef } from 'react';
import { exportXLSX, fmtRp, fmtDate } from '../../utils/exportXlsx';
import { loadAssets, saveAssets as saveAssetsDB } from '../../utils/db';
import {
  Package, Plus, Edit, Trash2, Download, Search, X, Check,
  AlertCircle, Wrench, Monitor, Wifi, Server, HardDrive, Zap
} from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import clsx from 'clsx';
import toast from 'react-hot-toast';

const ASSET_KEY = 'bronet_assets';
function getAssets()  { try { return JSON.parse(localStorage.getItem(ASSET_KEY) || '[]'); } catch { return []; } }
function saveAssets(d){ localStorage.setItem(ASSET_KEY, JSON.stringify(d)); }

const CATEGORIES = ['Router/Switch','Access Point','Server','Kabel/Aksesori','Perangkat Pelanggan','Kendaraan','Peralatan Kantor','Lainnya'];
const CONDITIONS  = ['Baik','Perlu Perhatian','Rusak','Tidak Aktif'];
const STATUSES    = ['Aktif','Dalam Perbaikan','Cadangan','Dihapuskan'];

const CAT_ICONS = {
  'Router/Switch':      Wifi,
  'Access Point':       Zap,
  'Server':             Server,
  'Kabel/Aksesori':     HardDrive,
  'Perangkat Pelanggan':Monitor,
  default:              Package,
};

const COND_COLOR = {
  'Baik':             'bg-green-500/15 text-green-400 border-green-500/30',
  'Perlu Perhatian':  'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  'Rusak':            'bg-red-500/15 text-red-400 border-red-500/30',
  'Tidak Aktif':      'bg-gray-500/15 text-gray-400 border-gray-500/30',
};

const STATUS_COLOR = {
  'Aktif':             'bg-green-500/10 text-green-400',
  'Dalam Perbaikan':   'bg-yellow-500/10 text-yellow-400',
  'Cadangan':          'bg-blue-500/10 text-blue-400',
  'Dihapuskan':        'bg-red-500/10 text-red-400',
};

const EMPTY_FORM = {
  name: '', category: 'Router/Switch', brand: '', model: '', serialNo: '',
  location: '', purchaseDate: '', purchasePrice: '', condition: 'Baik',
  status: 'Aktif', quantity: 1, notes: '', assignedTo: '',
};

function Modal({ open, onClose, title, children, maxW = 'max-w-2xl' }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 modal-backdrop flex items-center justify-center p-4"
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`bg-card border border-border rounded-2xl w-full ${maxW} max-h-[90vh] overflow-y-auto fade-in`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20}/></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children, required, span }) {
  return (
    <div className={span ? 'col-span-2' : ''}>
      <label className="block text-xs text-gray-400 mb-1.5">{label}{required && <span className="text-red-400 ml-1">*</span>}</label>
      {children}
    </div>
  );
}

export default function AssetManagement() {
  const [assets,     setAssetsState] = useState([]);
  const fileInputRef = useRef(null);
  useEffect(() => { loadAssets().then(d => { if(d?.length) setAssetsState(d); }).catch(()=>{}); }, []);
  const [search,     setSearch]      = useState('');
  const [filterCat,  setFilterCat]   = useState('all');
  const [filterCond, setFilterCond]  = useState('all');
  const [modalOpen,  setModalOpen]   = useState(false);
  const [editAsset,  setEditAsset]   = useState(null);
  const [delConfirm, setDelConfirm]  = useState(null);
  const [viewAsset,  setViewAsset]   = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [viewMode, setViewMode] = useState('table'); // table | card

  const setAssets = (d) => { setAssetsState(d); saveAssets(d); saveAssetsDB(d).catch(console.error); };

  const openAdd  = () => { setEditAsset(null); setForm({ ...EMPTY_FORM, purchaseDate: format(new Date(),'yyyy-MM-dd') }); setModalOpen(true); };
  const openEdit = (a) => { setEditAsset(a); setForm({ ...a }); setModalOpen(true); };

  const handleSave = () => {
    if (!form.name) return toast.error('Nama aset wajib diisi');
    const updated = editAsset
      ? assets.map(a => a.id === editAsset.id ? { ...form, id: editAsset.id, updatedAt: new Date().toISOString() } : a)
      : [...assets, { ...form, id: Date.now().toString(), createdAt: new Date().toISOString() }];
    setAssets(updated);
    toast.success(editAsset ? 'Aset diupdate!' : 'Aset ditambahkan!');
    setModalOpen(false);
  };

  const handleDel = (id) => {
    setAssets(assets.filter(a => a.id !== id));
    setDelConfirm(null); toast.success('Aset dihapus');
  };

  const downloadTemplate = () => {
    exportXLSX([{
      name: 'Template Aset',
      headers: ['Nama Aset*','Kategori','Merek','Model','No. Seri','Lokasi','Dipegang Oleh','Tanggal Beli (YYYY-MM-DD)','Harga Beli','Jumlah','Kondisi','Status','Catatan'],
      rows: [
        ['MikroTik hAP ac2','Router/Switch','MikroTik','hAP ac2','SN-001','Gardu RT03','Budi','2024-01-15','850000','1','Baik','Aktif','Contoh isian'],
        ['Kabel UTP Cat6 100m','Kabel/Aksesori','Belden','Cat6','-','Gudang','Admin','2024-02-01','350000','5','Baik','Aktif',''],
      ],
      colWidths: [22,16,12,14,14,16,14,24,12,8,14,14,20],
    }], 'Template-Import-Aset.xlsx');
    toast.success('Template berhasil didownload!');
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const ws = wb.worksheets[0];
      const imported = [];
      ws.eachRow((row, ri) => {
        if (ri === 1) return; // skip header
        const vals = row.values.slice(1); // ExcelJS row.values[0] is undefined
        if (!vals[0]) return; // skip empty rows
        imported.push({
          id:           Date.now().toString() + ri,
          name:         String(vals[0] || ''),
          category:     String(vals[1] || 'Lainnya'),
          brand:        String(vals[2] || ''),
          model:        String(vals[3] || ''),
          serialNo:     String(vals[4] || ''),
          location:     String(vals[5] || ''),
          assignedTo:   String(vals[6] || ''),
          purchaseDate: vals[7] ? String(vals[7]).substring(0,10) : '',
          purchasePrice:Number(vals[8]) || 0,
          quantity:     Number(vals[9]) || 1,
          condition:    String(vals[10] || 'Baik'),
          status:       String(vals[11] || 'Aktif'),
          notes:        String(vals[12] || ''),
          createdAt:    new Date().toISOString(),
        });
      });
      if (!imported.length) return toast.error('Tidak ada data ditemukan di file');
      setAssets(prev => {
        const merged = [...prev, ...imported];
        return merged;
      });
      toast.success(`${imported.length} aset berhasil diimport!`);
    } catch(err) {
      toast.error('Gagal import: ' + err.message);
    }
    e.target.value = '';
  };

  const doExport = () => {
    const totalValue = filteredAssets.reduce((s,a) => s + Number(a.purchasePrice||0) * Number(a.quantity||1), 0);
    exportXLSX([
      {
        name: 'Daftar Aset',
        headers: ['No','Nama Aset','Kategori','Merek','Model','No. Seri','Lokasi','Tgl Beli',
                  'Harga Beli','Qty','Total Nilai','Kondisi','Status','Dipegang','Catatan'],
        rows: filteredAssets.map((a,i) => [
          i+1, a.name, a.category, a.brand||'-', a.model||'-', a.serialNo||'-',
          a.location||'-', a.purchaseDate ? fmtDate(a.purchaseDate) : '-',
          fmtRp(a.purchasePrice), a.quantity||1,
          fmtRp(Number(a.purchasePrice||0)*Number(a.quantity||1)),
          a.condition, a.status, a.assignedTo||'-', a.notes||'-',
        ]),
        colWidths: [4,22,16,12,14,14,14,14,14,5,14,14,14,14,24],
      },
      {
        name: 'Ringkasan',
        headers: ['Kategori','Jumlah Unit','Total Nilai'],
        rows: [
          ...CATEGORIES.map(cat => {
            const items = assets.filter(a => a.category === cat);
            if (!items.length) return null;
            const qty   = items.reduce((s,a) => s + Number(a.quantity||1), 0);
            const value = items.reduce((s,a) => s + Number(a.purchasePrice||0)*Number(a.quantity||1), 0);
            return [cat, qty, fmtRp(value)];
          }).filter(Boolean),
          ['', '', ''],
          ['TOTAL', filteredAssets.reduce((s,a)=>s+Number(a.quantity||1),0), fmtRp(totalValue)],
        ],
        colWidths: [22, 14, 18],
      },
    ], `Asset-Management-${format(new Date(),'yyyyMMdd')}.xlsx`);
    toast.success('Export berhasil!');
  };

  // ── filtered ─────────────────────────────────────────────────────────────
  const filteredAssets = useMemo(() =>
    assets.filter(a => {
      const matchCat  = filterCat  === 'all' || a.category  === filterCat;
      const matchCond = filterCond === 'all' || a.condition === filterCond;
      const matchSrc  = !search || [a.name,a.brand,a.model,a.serialNo,a.location,a.assignedTo]
                          .some(v => v?.toLowerCase().includes(search.toLowerCase()));
      return matchCat && matchCond && matchSrc;
    }),
  [assets, filterCat, filterCond, search]);

  const totalValue = filteredAssets.reduce((s,a) => s + Number(a.purchasePrice||0)*Number(a.quantity||1), 0);

  const catStats = useMemo(() =>
    CATEGORIES.map(cat => ({
      cat,
      count: assets.filter(a => a.category === cat).length,
      value: assets.filter(a => a.category === cat).reduce((s,a) => s+Number(a.purchasePrice||0)*Number(a.quantity||1),0),
    })).filter(s => s.count > 0),
  [assets]);

  // ────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Asset Management</h1>
          <p className="text-gray-500 text-sm mt-1">{assets.length} aset · Nilai total {fmtRp(totalValue)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={downloadTemplate}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-gray-400 hover:text-white text-sm">
            <Download size={16}/>Template
          </button>
          <label className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 text-sm hover:bg-blue-500/30 cursor-pointer">
            <Download size={16}/>Import XLSX
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden"/>
          </label>
          <button onClick={doExport} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/20 text-green-400 border border-green-500/30 text-sm hover:bg-green-500/30">
            <Download size={16}/>Export XLSX
          </button>
          <button onClick={openAdd} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm">
            <Plus size={16}/>Tambah Aset
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label:'Total Aset', value: assets.length + ' item', color:'text-white' },
          { label:'Kondisi Baik', value: assets.filter(a=>a.condition==='Baik').length, color:'text-green-400' },
          { label:'Perlu Perhatian', value: assets.filter(a=>a.condition==='Perlu Perhatian'||a.condition==='Rusak').length, color:'text-yellow-400' },
          { label:'Total Nilai', value: fmtRp(totalValue), color:'text-primary' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center">
            <div className={`text-xl font-bold mono ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Category breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {catStats.map(({ cat, count, value }) => {
          const Icon = CAT_ICONS[cat] || CAT_ICONS.default;
          return (
            <button key={cat} onClick={() => setFilterCat(filterCat === cat ? 'all' : cat)}
              className={clsx('bg-card border rounded-xl p-3 text-left transition-all hover:border-primary/40',
                filterCat === cat ? 'border-primary/60 bg-primary/5' : 'border-border')}>
              <div className="flex items-center gap-2 mb-2">
                <Icon size={16} className={filterCat===cat ? 'text-primary' : 'text-gray-500'}/>
                <span className={clsx('text-xs font-semibold', filterCat===cat ? 'text-primary' : 'text-gray-300')}>{cat}</span>
              </div>
              <div className="text-lg font-bold mono text-white">{count}</div>
              <div className="text-xs text-gray-500">{fmtRp(value)}</div>
            </button>
          );
        })}
      </div>

      {/* Filter + Search */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama, merek, lokasi..."
            className="input-cyber w-full pl-9 pr-4 py-2.5 rounded-lg text-sm"/>
        </div>
        <select value={filterCond} onChange={e => setFilterCond(e.target.value)} className="input-cyber px-3 py-2.5 rounded-lg text-sm">
          <option value="all">Semua Kondisi</option>
          {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {(filterCat !== 'all' || filterCond !== 'all' || search) && (
          <button onClick={() => { setFilterCat('all'); setFilterCond('all'); setSearch(''); }}
            className="px-3 py-2 rounded-lg border border-border text-gray-400 hover:text-white text-sm flex items-center gap-1">
            <X size={14}/>Reset
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-darker/50">
              {['ASET','KATEGORI','MEREK/MODEL','LOKASI','TGL BELI','HARGA','QTY','KONDISI','STATUS','AKSI'].map((h,i) => (
                <th key={h} className={clsx('px-4 py-3 text-xs text-gray-500 font-medium', i===9?'text-right':'text-left')}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {!filteredAssets.length ? (
                <tr><td colSpan={10} className="text-center py-14 text-gray-600">
                  <Package size={40} className="mx-auto mb-3 opacity-30"/>
                  {assets.length === 0 ? 'Belum ada aset. Klik "Tambah Aset" untuk mulai.' : 'Tidak ada aset sesuai filter.'}
                </td></tr>
              ) : filteredAssets.map(a => {
                const Icon = CAT_ICONS[a.category] || CAT_ICONS.default;
                return (
                  <tr key={a.id} className="table-row border-b border-border/50 last:border-0 cursor-pointer" onClick={() => setViewAsset(a)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-darker flex items-center justify-center text-gray-500 border border-border shrink-0">
                          <Icon size={15}/>
                        </div>
                        <div>
                          <div className="font-semibold text-white text-sm">{a.name}</div>
                          {a.serialNo && <div className="text-xs text-gray-600 mono">{a.serialNo}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded">{a.category}</span></td>
                    <td className="px-4 py-3 text-xs text-gray-400">{[a.brand,a.model].filter(Boolean).join(' ')||'-'}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{a.location||'-'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 mono">{a.purchaseDate ? format(new Date(a.purchaseDate),'dd/MM/yyyy') : '-'}</td>
                    <td className="px-4 py-3 text-xs font-semibold mono text-white">{a.purchasePrice ? fmtRp(a.purchasePrice) : '-'}</td>
                    <td className="px-4 py-3 text-center text-xs mono text-gray-300">{a.quantity||1}</td>
                    <td className="px-4 py-3">
                      <span className={clsx('px-2 py-1 rounded-full text-xs border', COND_COLOR[a.condition]||COND_COLOR['Tidak Aktif'])}>
                        {a.condition}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx('px-2 py-1 rounded-md text-xs', STATUS_COLOR[a.status]||STATUS_COLOR['Cadangan'])}>
                        {a.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                        <button onClick={() => openEdit(a)} className="p-1.5 rounded-lg text-primary hover:bg-primary/10"><Edit size={14}/></button>
                        <button onClick={() => setDelConfirm(a.id)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-400/10"><Trash2 size={14}/></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredAssets.length > 0 && (
          <div className="px-4 py-3 border-t border-border text-xs text-gray-500 flex justify-between">
            <span>{filteredAssets.length} aset ditampilkan</span>
            <span>Total nilai: <span className="text-primary font-semibold">{fmtRp(totalValue)}</span></span>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editAsset ? 'Edit Aset' : 'Tambah Aset Baru'}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nama Aset" required span>
            <input value={form.name} onChange={e => setForm(p=>({...p,name:e.target.value}))}
              className="input-cyber w-full px-3 py-2.5 rounded-lg text-sm" placeholder="MikroTik hAP ac2"/>
          </Field>
          <Field label="Kategori" required>
            <select value={form.category} onChange={e => setForm(p=>({...p,category:e.target.value}))} className="input-cyber w-full px-3 py-2.5 rounded-lg text-sm">
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Jumlah (Qty)">
            <input type="number" min="1" value={form.quantity} onChange={e => setForm(p=>({...p,quantity:e.target.value}))} className="input-cyber w-full px-3 py-2.5 rounded-lg text-sm mono"/>
          </Field>
          <Field label="Merek">
            <input value={form.brand} onChange={e => setForm(p=>({...p,brand:e.target.value}))} className="input-cyber w-full px-3 py-2.5 rounded-lg text-sm" placeholder="MikroTik"/>
          </Field>
          <Field label="Model">
            <input value={form.model} onChange={e => setForm(p=>({...p,model:e.target.value}))} className="input-cyber w-full px-3 py-2.5 rounded-lg text-sm" placeholder="hAP ac2"/>
          </Field>
          <Field label="No. Seri / SN">
            <input value={form.serialNo} onChange={e => setForm(p=>({...p,serialNo:e.target.value}))} className="input-cyber w-full px-3 py-2.5 rounded-lg text-sm mono" placeholder="SN-001"/>
          </Field>
          <Field label="Lokasi">
            <input value={form.location} onChange={e => setForm(p=>({...p,location:e.target.value}))} className="input-cyber w-full px-3 py-2.5 rounded-lg text-sm" placeholder="RT 03 / Gardu Listrik"/>
          </Field>
          <Field label="Dipegang Oleh">
            <input value={form.assignedTo} onChange={e => setForm(p=>({...p,assignedTo:e.target.value}))} className="input-cyber w-full px-3 py-2.5 rounded-lg text-sm" placeholder="Budi / Teknisi"/>
          </Field>
          <Field label="Tanggal Beli">
            <input type="date" value={form.purchaseDate} onChange={e => setForm(p=>({...p,purchaseDate:e.target.value}))} className="input-cyber w-full px-3 py-2.5 rounded-lg text-sm mono"/>
          </Field>
          <Field label="Harga Beli (Rp)">
            <input type="number" value={form.purchasePrice} onChange={e => setForm(p=>({...p,purchasePrice:e.target.value}))} className="input-cyber w-full px-3 py-2.5 rounded-lg text-sm mono" placeholder="850000"/>
          </Field>
          <Field label="Kondisi">
            <select value={form.condition} onChange={e => setForm(p=>({...p,condition:e.target.value}))} className="input-cyber w-full px-3 py-2.5 rounded-lg text-sm">
              {CONDITIONS.map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={e => setForm(p=>({...p,status:e.target.value}))} className="input-cyber w-full px-3 py-2.5 rounded-lg text-sm">
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Catatan" span>
            <textarea value={form.notes} onChange={e => setForm(p=>({...p,notes:e.target.value}))} rows={2} className="input-cyber w-full px-3 py-2.5 rounded-lg text-sm" placeholder="Info tambahan..."/>
          </Field>
        </div>
        <div className="flex gap-3 mt-5 pt-4 border-t border-border">
          <button onClick={() => setModalOpen(false)} className="flex-1 py-2.5 rounded-lg border border-border text-gray-400 hover:text-white">Batal</button>
          <button onClick={handleSave} className="btn-primary flex-1 py-2.5 rounded-lg flex items-center justify-center gap-2">
            <Check size={16}/>{editAsset ? 'Simpan Perubahan' : 'Tambah Aset'}
          </button>
        </div>
      </Modal>

      {/* View Detail Modal */}
      <Modal open={!!viewAsset} onClose={() => setViewAsset(null)} title="Detail Aset" maxW="max-w-md">
        {viewAsset && (
          <div className="space-y-3">
            <div className="bg-darker rounded-xl border border-border p-4 text-center">
              {React.createElement(CAT_ICONS[viewAsset.category]||Package, { size:40, className:'mx-auto mb-2 text-primary' })}
              <div className="text-lg font-bold text-white">{viewAsset.name}</div>
              <div className="text-xs text-gray-500">{viewAsset.brand} {viewAsset.model}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                ['Kategori', viewAsset.category],
                ['No. Seri', viewAsset.serialNo||'-'],
                ['Lokasi', viewAsset.location||'-'],
                ['Dipegang', viewAsset.assignedTo||'-'],
                ['Tgl Beli', viewAsset.purchaseDate ? format(new Date(viewAsset.purchaseDate),'dd MMM yyyy',{locale:idLocale}) : '-'],
                ['Harga Beli', fmtRp(viewAsset.purchasePrice)],
                ['Jumlah', viewAsset.quantity||1],
                ['Total Nilai', fmtRp(Number(viewAsset.purchasePrice||0)*Number(viewAsset.quantity||1))],
              ].map(([k,v]) => (
                <div key={k} className="bg-darker rounded-lg p-3 border border-border/50">
                  <div className="text-xs text-gray-500 mb-0.5">{k}</div>
                  <div className="text-sm text-white font-semibold">{v}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <span className={clsx('flex-1 text-center py-2 rounded-lg text-xs border font-semibold', COND_COLOR[viewAsset.condition]||COND_COLOR['Tidak Aktif'])}>
                {viewAsset.condition}
              </span>
              <span className={clsx('flex-1 text-center py-2 rounded-lg text-xs font-semibold', STATUS_COLOR[viewAsset.status]||STATUS_COLOR['Cadangan'])}>
                {viewAsset.status}
              </span>
            </div>
            {viewAsset.notes && (
              <div className="bg-darker rounded-xl p-3 border border-border text-xs text-gray-400">{viewAsset.notes}</div>
            )}
            <div className="flex gap-2 pt-2">
              <button onClick={() => { setViewAsset(null); openEdit(viewAsset); }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-primary/40 text-primary hover:bg-primary/10 text-sm">
                <Edit size={15}/>Edit
              </button>
              <button onClick={() => setViewAsset(null)} className="flex-1 py-2.5 rounded-lg border border-border text-gray-400 text-sm">Tutup</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirm */}
      <Modal open={!!delConfirm} onClose={() => setDelConfirm(null)} title="Hapus Aset" maxW="max-w-sm">
        <div className="text-center py-4">
          <AlertCircle size={44} className="text-red-400 mx-auto mb-3"/>
          <p className="text-white mb-5">Yakin ingin menghapus aset ini?</p>
          <div className="flex gap-3">
            <button onClick={() => setDelConfirm(null)} className="flex-1 py-2.5 rounded-lg border border-border text-gray-400">Batal</button>
            <button onClick={() => handleDel(delConfirm)} className="btn-danger flex-1 py-2.5 rounded-lg">Hapus</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
