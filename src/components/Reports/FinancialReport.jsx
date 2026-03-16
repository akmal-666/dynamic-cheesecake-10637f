import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../contexts/AppContext';
import { loadExpenses, saveExpenses as saveExpensesDB } from '../../utils/db';
import { useAuth } from '../../contexts/AuthContext';
import { MOCK_PPP_SECRETS, MOCK_PPP_PROFILES, parseComment } from '../../utils/mockData';
import { exportXLSX, fmtRp, fmtDate } from '../../utils/exportXlsx';
import {
  TrendingUp, TrendingDown, DollarSign, Plus, Edit, Trash2,
  Download, RefreshCw, X, Check, AlertCircle, BarChart2,
  ChevronLeft, ChevronRight, Filter
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths, addMonths } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import clsx from 'clsx';
import toast from 'react-hot-toast';

const EXP_KEY = 'bronet_expenses';
function getExpenses() { try { return JSON.parse(localStorage.getItem(EXP_KEY) || '[]'); } catch { return []; } }
function saveExpenses(d) { localStorage.setItem(EXP_KEY, JSON.stringify(d)); }

function getBilling() { try { return JSON.parse(localStorage.getItem('bronet_billing_v2') || '[]'); } catch { return []; } }

const EXP_CATEGORIES = ['Operasional','Internet Upstream','Peralatan','Listrik','Maintenance','Gaji','Lainnya'];

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 modal-backdrop flex items-center justify-center p-4"
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20}/></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

const EMPTY_EXP = { date: format(new Date(),'yyyy-MM-dd'), category: 'Operasional', description: '', amount: '', note: '' };

export default function FinancialReport() {
  const { callMikrotik } = useApp();
  const { hasPermission } = useAuth();
  const canDelete = hasPermission('delete-reports');
  const [users, setUsers]     = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [billing,  setBilling]  = useState(getBilling());
  const [loading,  setLoading]  = useState(false);
  const [curMonth, setCurMonth] = useState(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [editExp,   setEditExp]   = useState(null);
  const [delConfirm, setDelConfirm] = useState(null);
  const [form, setForm] = useState(EMPTY_EXP);
  const [activeTab, setActiveTab] = useState('ringkasan');

  const profileExtras = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('bronet_profile_extras') || '{}'); } catch { return {}; }
  }, []);

  useEffect(() => {
    loadExpenses().then(saved => { if(saved?.length) setExpenses(saved); }).catch(()=>{});
    setLoading(true);
    Promise.all([callMikrotik('/ppp/secret','GET'), callMikrotik('/ppp/profile','GET')]).then(([ur,pr]) => {
      setUsers(ur.success && Array.isArray(ur.data) ? ur.data : MOCK_PPP_SECRETS);
      setProfiles(pr.success && Array.isArray(pr.data) ? pr.data : MOCK_PPP_PROFILES);
      setBilling(getBilling());
      setLoading(false);
    });
  }, []);

  // ── computed ──────────────────────────────────────────────────────────────
  const monthStr = format(curMonth, 'yyyy-MM');

  const monthIncome = useMemo(() => {
    return billing.filter(b => {
      if (!b.history?.length) return false;
      return b.history.some(h => h.paidAt?.startsWith(monthStr));
    }).reduce((sum, b) => {
      const paid = b.history.filter(h => h.paidAt?.startsWith(monthStr));
      return sum + paid.reduce((s, h) => s + Number(h.amount || 0), 0);
    }, 0);
  }, [billing, monthStr]);

  const monthExpense = useMemo(() =>
    expenses.filter(e => e.date?.startsWith(monthStr)).reduce((s, e) => s + Number(e.amount || 0), 0),
  [expenses, monthStr]);

  const monthProfit = monthIncome - monthExpense;

  // Last 6 months chart data
  const chartData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const m = subMonths(curMonth, 5 - i);
      const ms = format(m, 'yyyy-MM');
      const inc = billing.filter(b => b.history?.some(h => h.paidAt?.startsWith(ms)))
        .reduce((sum, b) => sum + b.history.filter(h => h.paidAt?.startsWith(ms)).reduce((s,h) => s + Number(h.amount||0), 0), 0);
      const exp = expenses.filter(e => e.date?.startsWith(ms)).reduce((s,e) => s + Number(e.amount||0), 0);
      return { month: format(m,'MMM yy',{locale:idLocale}), income: inc, expense: exp, profit: inc - exp };
    });
  }, [billing, expenses, curMonth]);

  // Income detail this month
  const incomeDetail = useMemo(() =>
    billing.filter(b => b.history?.some(h => h.paidAt?.startsWith(monthStr))).map(b => ({
      username: b.username,
      profile: b.profile,
      amount: b.history.filter(h => h.paidAt?.startsWith(monthStr)).reduce((s,h) => s + Number(h.amount||0), 0),
      paidAt: b.history.find(h => h.paidAt?.startsWith(monthStr))?.paidAt,
      note:   b.history.find(h => h.paidAt?.startsWith(monthStr))?.note || '',
    })),
  [billing, monthStr]);

  // Expense this month
  const expenseMonth = expenses.filter(e => e.date?.startsWith(monthStr));

  // ── expense CRUD ────────────────────────────────────────────────────────
  const openAdd  = () => { setEditExp(null); setForm({ ...EMPTY_EXP, date: format(new Date(),'yyyy-MM-dd') }); setModalOpen(true); };
  const openEdit = (e) => { setEditExp(e); setForm({ ...e }); setModalOpen(true); };

  const handleSave = () => {
    if (!form.description || !form.amount) return toast.error('Deskripsi dan nominal wajib diisi');
    const updated = editExp
      ? expenses.map(e => e.id === editExp.id ? { ...form, id: editExp.id } : e)
      : [...expenses, { ...form, id: Date.now().toString() }];
    setExpenses(updated); saveExpenses(updated); saveExpensesDB(updated).catch(console.error);
    toast.success(editExp ? 'Pengeluaran diupdate!' : 'Pengeluaran ditambahkan!');
    setModalOpen(false);
  };

  const handleDel = (id) => {
    const updated = expenses.filter(e => e.id !== id);
    setExpenses(updated); saveExpenses(updated); saveExpensesDB(updated).catch(console.error);
    setDelConfirm(null); toast.success('Dihapus');
  };

  // ── export ───────────────────────────────────────────────────────────────
  const exportMonth = () => {
    const label = format(curMonth, 'MMMM yyyy', { locale: idLocale });
    exportXLSX([
      {
        name: 'Ringkasan',
        headers: ['Keterangan', 'Jumlah'],
        rows: [
          ['LAPORAN KEUANGAN ' + label.toUpperCase(), ''],
          ['', ''],
          ['PEMASUKAN', fmtRp(monthIncome)],
          ['PENGELUARAN', fmtRp(monthExpense)],
          ['LABA BERSIH', fmtRp(monthProfit)],
          ['', ''],
          ['Total User Aktif', users.filter(u => u.disabled !== 'true').length],
          ['User Bayar Bulan Ini', incomeDetail.length],
        ],
        colWidths: [30, 20],
      },
      {
        name: 'Detail Pemasukan',
        headers: ['No','Username','Paket','Nominal','Tanggal Bayar','Keterangan'],
        rows: incomeDetail.map((d,i) => [
          i+1, d.username, d.profile, fmtRp(d.amount),
          d.paidAt ? format(new Date(d.paidAt),'dd/MM/yyyy HH:mm') : '-', d.note
        ]),
        colWidths: [5, 20, 18, 18, 22, 30],
      },
      {
        name: 'Detail Pengeluaran',
        headers: ['No','Tanggal','Kategori','Deskripsi','Nominal','Catatan'],
        rows: expenseMonth.map((e,i) => [
          i+1, fmtDate(e.date), e.category, e.description, fmtRp(e.amount), e.note || ''
        ]),
        colWidths: [5, 15, 18, 30, 18, 30],
      },
      {
        name: 'Rekap 6 Bulan',
        headers: ['Bulan','Pemasukan','Pengeluaran','Laba Bersih'],
        rows: chartData.map(d => [d.month, fmtRp(d.income), fmtRp(d.expense), fmtRp(d.profit)]),
        colWidths: [15, 18, 18, 18],
      },
    ], `Laporan-Keuangan-${format(curMonth,'yyyy-MM')}.xlsx`);
    toast.success('Export berhasil!');
  };

  // ────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Laporan Keuangan</h1>
          <p className="text-gray-500 text-sm mt-1">Rekap pemasukan, pengeluaran & laba bersih</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportMonth} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/20 text-green-400 border border-green-500/30 text-sm hover:bg-green-500/30">
            <Download size={16}/>Export XLSX
          </button>
          <button onClick={openAdd} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm">
            <Plus size={16}/>Tambah Pengeluaran
          </button>
        </div>
      </div>

      {/* Month Navigator */}
      <div className="flex items-center gap-3 bg-card border border-border rounded-xl p-3 w-fit">
        <button onClick={() => setCurMonth(m => subMonths(m,1))} className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5">
          <ChevronLeft size={18}/>
        </button>
        <span className="text-white font-semibold text-base min-w-[160px] text-center">
          {format(curMonth,'MMMM yyyy',{locale:idLocale})}
        </span>
        <button onClick={() => setCurMonth(m => addMonths(m,1))} disabled={format(addMonths(curMonth,1),'yyyy-MM') > format(new Date(),'yyyy-MM')}
          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-30">
          <ChevronRight size={18}/>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label:'Total Pemasukan', value: fmtRp(monthIncome), icon: TrendingUp,   color:'bg-green-500/15 text-green-400' },
          { label:'Total Pengeluaran', value: fmtRp(monthExpense), icon: TrendingDown, color:'bg-red-500/15 text-red-400' },
          { label:'Laba Bersih', value: fmtRp(monthProfit), icon: DollarSign,
            color: monthProfit >= 0 ? 'bg-primary/15 text-primary' : 'bg-orange-500/15 text-orange-400' },
        ].map(c => (
          <div key={c.label} className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${c.color}`}>
              <c.icon size={22}/>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">{c.label}</div>
              <div className="text-xl font-bold text-white mono">{c.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="text-sm font-semibold text-white mb-5">Tren 6 Bulan Terakhir</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937"/>
            <XAxis dataKey="month" stroke="#374151" tick={{ fill:'#9ca3af', fontSize:11 }}/>
            <YAxis stroke="#374151" tick={{ fill:'#9ca3af', fontSize:11 }} tickFormatter={v => 'Rp '+Math.round(v/1000)+'k'} width={70}/>
            <Tooltip contentStyle={{ background:'#111827', border:'1px solid #1f2937', borderRadius:8 }}
                     formatter={(v,n) => [fmtRp(v), n==='income'?'Pemasukan':n==='expense'?'Pengeluaran':'Laba']}
                     labelStyle={{ color:'#9ca3af' }}/>
            <Bar dataKey="income"  name="income"  fill="#10b981" radius={[4,4,0,0]}/>
            <Bar dataKey="expense" name="expense" fill="#ef4444" radius={[4,4,0,0]}/>
            <Bar dataKey="profit"  name="profit"  fill="#00d4ff" radius={[4,4,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-3 justify-center text-xs text-gray-500">
          {[['#10b981','Pemasukan'],['#ef4444','Pengeluaran'],['#00d4ff','Laba']].map(([c,l]) => (
            <div key={l} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={{ background: c }}/>
              {l}
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-darker p-1 rounded-xl w-fit border border-border">
        {[['ringkasan','Ringkasan'],['pemasukan','Pemasukan'],['pengeluaran','Pengeluaran']].map(([k,l]) => (
          <button key={k} onClick={() => setActiveTab(k)}
            className={clsx('px-4 py-2 rounded-lg text-sm transition-all',
              activeTab===k ? 'bg-primary text-dark font-semibold' : 'text-gray-400 hover:text-white')}>
            {l}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'ringkasan' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-4">Breakdown Pengeluaran</div>
            {EXP_CATEGORIES.map(cat => {
              const total = expenseMonth.filter(e => e.category === cat).reduce((s,e) => s + Number(e.amount||0), 0);
              if (!total) return null;
              const pct = monthExpense ? Math.round(total/monthExpense*100) : 0;
              return (
                <div key={cat} className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">{cat}</span>
                    <span className="text-white mono">{fmtRp(total)} <span className="text-gray-500">({pct}%)</span></span>
                  </div>
                  <div className="h-1.5 bg-darker rounded-full overflow-hidden">
                    <div className="h-full bg-red-400 rounded-full transition-all" style={{ width: pct+'%' }}/>
                  </div>
                </div>
              );
            })}
            {!expenseMonth.length && <div className="text-gray-600 text-sm text-center py-4">Belum ada pengeluaran</div>}
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-4">Top Pemasukan User</div>
            {incomeDetail.sort((a,b) => b.amount-a.amount).slice(0,8).map(d => (
              <div key={d.username} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                <div>
                  <div className="text-sm text-white mono">{d.username}</div>
                  <div className="text-xs text-gray-500">{d.profile}</div>
                </div>
                <div className="text-green-400 font-semibold mono text-sm">{fmtRp(d.amount)}</div>
              </div>
            ))}
            {!incomeDetail.length && <div className="text-gray-600 text-sm text-center py-4">Belum ada pemasukan</div>}
          </div>
        </div>
      )}

      {activeTab === 'pemasukan' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <span className="text-sm font-semibold text-white">{incomeDetail.length} transaksi · {fmtRp(monthIncome)}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-darker/50">
                {[...['Username','Paket','Nominal','Tanggal Bayar','Keterangan'], ...(canDelete ? [''] : [])].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-gray-500 font-medium">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {!incomeDetail.length
                  ? <tr><td colSpan={5} className="text-center py-10 text-gray-600">Belum ada pemasukan bulan ini</td></tr>
                  : incomeDetail.map((d,i) => (
                    <tr key={i} className="table-row border-b border-border/50 last:border-0">
                      <td className="px-4 py-3 mono font-medium text-white">{d.username}</td>
                      <td className="px-4 py-3"><span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded mono">{d.profile}</span></td>
                      <td className="px-4 py-3 text-green-400 font-bold mono text-sm">{fmtRp(d.amount)}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs mono">{d.paidAt ? format(new Date(d.paidAt),'dd/MM/yyyy HH:mm') : '-'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{d.note || '-'}</td>
                      {canDelete && (
                        <td className="px-4 py-3">
                          <button onClick={() => { if(window.confirm('Hapus data pemasukan ini?')) deleteIncomeEntry(d.username, d.paidAt); }}
                            className="p-1.5 rounded-lg text-red-400 hover:bg-red-400/10 transition-colors">
                            <Trash2 size={14}/>
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'pengeluaran' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <span className="text-sm font-semibold text-white">{expenseMonth.length} transaksi · {fmtRp(monthExpense)}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-darker/50">
                {['Tanggal','Kategori','Deskripsi','Nominal','Catatan','Aksi'].map((h,i) => (
                  <th key={h} className={clsx('px-4 py-3 text-xs text-gray-500 font-medium', i===5?'text-right':'text-left')}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {!expenseMonth.length
                  ? <tr><td colSpan={6} className="text-center py-10 text-gray-600">Belum ada pengeluaran bulan ini</td></tr>
                  : expenseMonth.sort((a,b) => new Date(b.date)-new Date(a.date)).map(e => (
                    <tr key={e.id} className="table-row border-b border-border/50 last:border-0">
                      <td className="px-4 py-3 text-xs mono text-gray-400">{fmtDate(e.date)}</td>
                      <td className="px-4 py-3"><span className="px-2 py-1 bg-red-500/10 text-red-400 text-xs rounded border border-red-500/20">{e.category}</span></td>
                      <td className="px-4 py-3 text-white text-sm">{e.description}</td>
                      <td className="px-4 py-3 text-red-400 font-bold mono text-sm">{fmtRp(e.amount)}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{e.note||'-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(e)} className="p-1.5 rounded-lg text-primary hover:bg-primary/10"><Edit size={14}/></button>
                          <button onClick={() => setDelConfirm(e.id)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-400/10"><Trash2 size={14}/></button>
                        </div>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Expense Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editExp ? 'Edit Pengeluaran' : 'Tambah Pengeluaran'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Tanggal <span className="text-red-400">*</span></label>
              <input type="date" value={form.date} onChange={e => setForm(p=>({...p,date:e.target.value}))} className="input-cyber w-full px-3 py-2.5 rounded-lg text-sm"/>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Kategori</label>
              <select value={form.category} onChange={e => setForm(p=>({...p,category:e.target.value}))} className="input-cyber w-full px-3 py-2.5 rounded-lg text-sm">
                {EXP_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Deskripsi <span className="text-red-400">*</span></label>
            <input value={form.description} onChange={e => setForm(p=>({...p,description:e.target.value}))} className="input-cyber w-full px-3 py-2.5 rounded-lg text-sm" placeholder="Bayar listrik, beli kabel, dll"/>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Nominal (Rp) <span className="text-red-400">*</span></label>
            <input type="number" value={form.amount} onChange={e => setForm(p=>({...p,amount:e.target.value}))} className="input-cyber w-full px-3 py-2.5 rounded-lg text-sm mono" placeholder="150000"/>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Catatan</label>
            <textarea value={form.note} onChange={e => setForm(p=>({...p,note:e.target.value}))} className="input-cyber w-full px-3 py-2.5 rounded-lg text-sm" rows={2} placeholder="Opsional..."/>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 py-2.5 rounded-lg border border-border text-gray-400">Batal</button>
            <button onClick={handleSave} className="btn-primary flex-1 py-2.5 rounded-lg flex items-center justify-center gap-2"><Check size={16}/>{editExp?'Update':'Tambah'}</button>
          </div>
        </div>
      </Modal>
      <Modal open={!!delConfirm} onClose={() => setDelConfirm(null)} title="Hapus Pengeluaran">
        <div className="text-center py-4">
          <AlertCircle size={44} className="text-red-400 mx-auto mb-3"/>
          <p className="text-white mb-5">Yakin ingin menghapus pengeluaran ini?</p>
          <div className="flex gap-3">
            <button onClick={() => setDelConfirm(null)} className="flex-1 py-2.5 rounded-lg border border-border text-gray-400">Batal</button>
            <button onClick={() => handleDel(delConfirm)} className="btn-danger flex-1 py-2.5 rounded-lg">Hapus</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
