import React, { useState, useEffect } from 'react';
import { CreditCard, CheckCircle, XCircle, Eye, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { loadPaymentProofs, savePaymentProof, loadBilling as loadBillingDB, saveAllBilling } from '../../utils/db';

const fmtRp = n => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',minimumFractionDigits:0}).format(n||0);
const fmtDate = d => { try { return format(new Date(d),'dd MMM yyyy HH:mm',{locale:idLocale}); } catch { return '-'; } };

export default function PaymentProofManagement() {
  const [proofs,   setProofs]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState('all');
  const [viewImg,  setViewImg]  = useState(null);
  const [note,     setNote]     = useState('');

  useEffect(() => {
    loadPaymentProofs().then(d => { setProofs(d||[]); setLoading(false); });
  }, []);

  const confirm = async (proof, status) => {
    const updated = { ...proof, status, admin_note: note, updated_at: new Date().toISOString() };
    await savePaymentProof(updated);
    setProofs(prev => prev.map(p => p.id===proof.id ? updated : p));

    if (status === 'confirmed') {
      // Update billing: set paidAt + add history
      try {
        // Read from localStorage first (most current), then Supabase
        let billingData = [];
        try { billingData = JSON.parse(localStorage.getItem('bronet_billing_v2') || '[]'); } catch {}
        if (!billingData.length) billingData = await loadBillingDB() || [];

        const now = new Date().toISOString();
        let found = false;
        const updatedBilling = billingData.map(b => {
          if (b.username !== proof.pppoe_username) return b;
          found = true;
          const history = Array.isArray(b.history) ? b.history : [];
          const histEntry = { paidAt: now, amount: Number(proof.amount)||0, note: 'Transfer dikonfirmasi admin' };
          return { ...b, paidAt: now, history: [...history, histEntry] };
        });

        if (found) {
          localStorage.setItem('bronet_billing_v2', JSON.stringify(updatedBilling));
          await saveAllBilling(updatedBilling);
          toast.success('✓ Pembayaran dikonfirmasi! Status tagihan customer terupdate.');
        } else {
          toast.success('Pembayaran dikonfirmasi! (Data billing tidak ditemukan, update manual di menu Tagihan)');
        }
      } catch(e) {
        console.error('Billing sync error:', e.message);
        toast.success('Pembayaran dikonfirmasi!');
      }
    } else {
      toast.error('Pembayaran ditolak. Customer akan diberitahu.');
    }
    setNote('');
  };

  const filtered = filter==='all' ? proofs : proofs.filter(p => p.status===filter);
  const pendingCount = proofs.filter(p => p.status==='pending').length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Bukti Pembayaran</h1>
          <p className="text-gray-500 text-sm mt-1">Konfirmasi bukti transfer dari customer</p>
        </div>
        {pendingCount > 0 && (
          <span className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-3 py-1.5 rounded-xl text-sm font-semibold">
            {pendingCount} menunggu konfirmasi
          </span>
        )}
      </div>

      <div className="flex gap-2">
        {['all','pending','confirmed','rejected'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={clsx('px-3 py-1.5 rounded-lg text-sm border transition-all',
              filter===s ? 'bg-primary/20 text-primary border-primary/40' : 'border-border text-gray-500 hover:text-gray-300')}>
            {s==='all'?'Semua':s==='pending'?'Menunggu':s==='confirmed'?'Dikonfirmasi':'Ditolak'}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? <div className="text-center py-10 text-gray-500">Memuat...</div>
        : filtered.length===0 ? <div className="text-center py-10 text-gray-600">Tidak ada data</div>
        : filtered.map(p => (
          <div key={p.id} className="border-b border-border/50 last:border-0 p-4">
            <div className="flex items-start gap-4">
              {/* Thumbnail */}
              <div onClick={() => setViewImg(p.image_base64||p.image_url)}
                className="w-20 h-16 rounded-xl overflow-hidden bg-darker flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity">
                {(p.image_base64||p.image_url)
                  ? <img src={p.image_base64||p.image_url} alt="bukti" className="w-full h-full object-cover"/>
                  : <div className="w-full h-full flex items-center justify-center text-gray-600"><CreditCard size={18}/></div>}
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-semibold">{p.full_name||p.pppoe_username}</span>
                  <span className="mono text-gray-500 text-xs">{p.pppoe_username}</span>
                  <span className={clsx('text-xs px-2 py-0.5 rounded-full ml-auto',
                    p.status==='pending'?'bg-yellow-500/20 text-yellow-400':
                    p.status==='confirmed'?'bg-green-500/20 text-green-400':'bg-red-500/20 text-red-400')}>
                    {p.status==='pending'?'Menunggu':p.status==='confirmed'?'✓ Dikonfirmasi':'✗ Ditolak'}
                  </span>
                </div>
                <div className="text-primary font-bold mt-1">{fmtRp(p.amount)}</div>
                <div className="text-xs text-gray-500 mt-0.5">{fmtDate(p.created_at)} · {p.note||''}</div>
              </div>
            </div>
            {p.status==='pending' && (
              <div className="mt-3 flex gap-2 items-center">
                <input value={note} onChange={e => setNote(e.target.value)}
                  className="input-cyber flex-1 px-3 py-1.5 rounded-lg text-xs" placeholder="Catatan (opsional)..."/>
                <button onClick={() => confirm(p,'confirmed')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 border border-green-500/30 text-xs font-semibold">
                  <CheckCircle size={13}/>Konfirmasi
                </button>
                <button onClick={() => confirm(p,'rejected')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold">
                  <XCircle size={13}/>Tolak
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {viewImg && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setViewImg(null)}>
          <img src={viewImg} alt="bukti bayar" className="max-w-full max-h-full rounded-2xl object-contain" style={{maxHeight:'90vh'}}/>
        </div>
      )}
    </div>
  );
}
