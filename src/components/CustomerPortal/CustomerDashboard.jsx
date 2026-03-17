import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Clock, CreditCard, MessageSquare, ChevronRight, LogOut, Key, Bell, Ticket, Phone, ExternalLink } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { loadBanners, loadPaymentInfo, loadTickets, saveTicket, saveTicketMessage, loadTicketMessages, saveCustomer } from '../../utils/db';

const fmtDate = (d) => { try { return format(new Date(d), 'dd MMMM yyyy', {locale:idLocale}); } catch { return '-'; } };
const fmtRp   = (n) => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',minimumFractionDigits:0}).format(n||0);

function Banner({ banners }) {
  const [idx, setIdx] = useState(0);
  const timerRef = useRef();
  const trackRef = useRef();

  useEffect(() => {
    if (banners.length < 2) return;
    timerRef.current = setInterval(() => setIdx(i => (i+1) % banners.length), 4000);
    return () => clearInterval(timerRef.current);
  }, [banners.length]);

  useEffect(() => {
    if (trackRef.current) {
      trackRef.current.style.transform = `translateX(-${idx * 100}%)`;
    }
  }, [idx]);

  if (!banners.length) return null;
  return (
    <div className="rounded-2xl overflow-hidden relative" style={{height:160}}>
      <div ref={trackRef} className="flex h-full"
        style={{transition:'transform 0.5s cubic-bezier(0.4,0,0.2,1)', width: `${banners.length * 100}%`}}>
        {banners.map((b, i) => (
          <div key={b.id} className="relative flex-shrink-0" style={{width:`${100/banners.length}%`}}>
            <img src={b.image_url} alt={b.title} className="w-full h-full object-cover"/>
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"/>
            <p className="absolute bottom-3 left-4 right-4 text-white font-semibold text-sm">{b.title}</p>
          </div>
        ))}
      </div>
      {banners.length > 1 && (
        <div className="absolute bottom-2 right-3 flex gap-1.5">
          {banners.map((_,i) => (
            <button key={i} onClick={() => setIdx(i)}
              style={{transition:'width 0.3s', width: i===idx ? 16 : 6}}
              className={clsx('h-1.5 rounded-full', i===idx ? 'bg-white' : 'bg-white/40')}/>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CustomerDashboard({ customer, billing, onLogout }) {
  const [page,     setPage]     = useState('home'); // home | payment | ticket | profile | change-pass
  const [banners,  setBanners]  = useState([]);
  const [payInfo,  setPayInfo]  = useState([]);
  const [tickets,  setTickets]  = useState([]);
  const [newTicket, setNewTicket] = useState({ title:'', desc:'', category:'Umum' });
  const [ticketMsg, setTicketMsg] = useState('');
  const [selTicket, setSelTicket] = useState(null);
  const [messages, setMessages]  = useState([]);
  const [csPhone,  setCsPhone]   = useState('');
  const [oldPass,  setOldPass]   = useState('');
  const [newPass,  setNewPass]   = useState('');
  const [confPass, setConfPass]  = useState('');
  const [saving,   setSaving]    = useState(false);

  const record = billing?.find(b => b.username === customer.pppoe_username);

  useEffect(() => {
    // Load WA CS number from settings
    try {
      const s = JSON.parse(localStorage.getItem('bronet_wa_settings') || '{}');
      if (s.csPhone) setCsPhone(s.csPhone);
      else if (s.testPhone) setCsPhone(s.testPhone);
    } catch {}
    loadBanners().then(d => setBanners((d||[]).filter(b => b.active)));
    loadPaymentInfo().then(d => setPayInfo(d||[]));
    // Load tickets for this customer
    loadTickets().then(d => {
      const myTickets = (d||[]).filter(t =>
        t.pppoe_username === customer.pppoe_username ||
        t.customer_id === customer.customer_id
      );
      setTickets(myTickets);
    });
  }, []);

  useEffect(() => {
    if (selTicket) {
      loadTicketMessages(selTicket.id).then(d => setMessages(d||[]));
    }
  }, [selTicket]);

  const submitTicket = async () => {
    if (!newTicket.title) return toast.error('Judul tiket wajib diisi');
    setSaving(true);
    try {
      const ticket = {
        id:             Date.now(),
        install_id:     'bronet_main',
        ticket_no:      `TKT-${format(new Date(),'yyyyMMdd')}-${Math.random().toString(36).slice(2,6).toUpperCase()}`,
        pppoe_username: customer.pppoe_username,
        customer_id:    customer.customer_id || customer.id,
        full_name:      customer.full_name || '',
        title:          newTicket.title,
        description:    newTicket.desc,
        category:       newTicket.category,
        status:         'open',
        priority:       'normal',
        created_at:     new Date().toISOString(),
        updated_at:     new Date().toISOString(),
      };
      await saveTicket(ticket);
      setTickets(prev => [ticket, ...prev]);
      setNewTicket({ title:'', desc:'', category:'Umum' });
      toast.success('Tiket berhasil dikirim! Admin akan segera menghubungi Anda.');
      setPage('ticket-list');
    } catch(e) {
      toast.error('Gagal kirim tiket: ' + e.message);
    }
    setSaving(false);
  };

  const sendTicketMsg = async () => {
    if (!ticketMsg.trim() || !selTicket) return;
    const msg = {
      id: Date.now(), ticket_id: selTicket.id,
      sender_type: 'customer', sender_name: customer.full_name || customer.pppoe_username,
      message: ticketMsg.trim(), created_at: new Date().toISOString(),
    };
    await saveTicketMessage(msg);
    setMessages(prev => [...prev, msg]);
    setTicketMsg('');
  };

  const changePassword = async () => {
    if (!oldPass || !newPass || !confPass) return toast.error('Semua field wajib diisi');
    if (customer.password_hash !== btoa(oldPass)) return toast.error('Password lama salah');
    if (newPass.length < 6) return toast.error('Password baru minimal 6 karakter');
    if (newPass !== confPass) return toast.error('Konfirmasi password tidak cocok');
    setSaving(true);
    const updated = { ...customer, password_hash: btoa(newPass) };
    await saveCustomer(updated);
    toast.success('Password berhasil diubah!');
    setOldPass(''); setNewPass(''); setConfPass('');
    setSaving(false);
  };

  const days = record?.dueDate ? Math.ceil((new Date(record.dueDate) - new Date()) / 86400000) : null;

  const navItems = [
    { key: 'home',        icon: Bell,         label: 'Beranda' },
    { key: 'payment',     icon: CreditCard,    label: 'Bayar' },
    { key: 'ticket-new',  icon: Ticket,        label: 'Tiket' },
    { key: 'ticket-list', icon: MessageSquare, label: 'Riwayat' },
    { key: 'profile',     icon: Key,           label: 'Profil' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0f1a] flex flex-col max-w-md mx-auto relative">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-white font-semibold text-sm">{customer.full_name || customer.pppoe_username}</p>
          <p className="text-primary text-xs mono">{customer.customer_id || customer.pppoe_username}</p>
        </div>
        <button onClick={onLogout} className="text-gray-500 hover:text-red-400 p-2">
          <LogOut size={18}/>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-20 px-4 py-4 space-y-4">
        {/* HOME */}
        {page === 'home' && (
          <>
            {/* Status card */}
            <div className={clsx('rounded-2xl p-5 border',
              days === null ? 'bg-card border-border'
              : days < 0 ? 'bg-red-500/10 border-red-500/30'
              : days <= 3 ? 'bg-yellow-500/10 border-yellow-500/30'
              : 'bg-green-500/10 border-green-500/30')}>
              <div className="flex items-center gap-2 mb-3">
                <Calendar size={18} className="text-primary"/>
                <span className="text-white font-semibold">Status Tagihan</span>
              </div>
              {record ? (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-sm">Paket</span>
                    <span className="text-white font-semibold mono">{record.profile}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-sm">Tagihan</span>
                    <span className="text-primary font-bold">{fmtRp(record.price)}/bln</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-sm">Jatuh Tempo</span>
                    <span className={clsx('font-semibold', days < 0 ? 'text-red-400' : days <= 3 ? 'text-yellow-400' : 'text-green-400')}>
                      {fmtDate(record.dueDate)}
                    </span>
                  </div>
                  {days !== null && (
                    <div className="text-center mt-3 py-2 rounded-xl bg-black/20">
                      <span className={clsx('font-bold text-lg', days < 0 ? 'text-red-400' : days <= 3 ? 'text-yellow-400' : 'text-green-400')}>
                        {days < 0 ? `${Math.abs(days)} hari terlambat` : days === 0 ? 'Jatuh tempo hari ini!' : `${days} hari lagi`}
                      </span>
                    </div>
                  )}
                </div>
              ) : <p className="text-gray-500 text-sm">Data tagihan tidak ditemukan</p>}
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setPage('payment')}
                className="bg-card border border-border rounded-2xl p-4 flex flex-col items-center gap-2 hover:border-primary/50 transition-colors">
                <CreditCard size={24} className="text-primary"/>
                <span className="text-white text-sm font-semibold">Bayar Tagihan</span>
              </button>
              <button onClick={() => setPage('ticket-new')}
                className="bg-card border border-border rounded-2xl p-4 flex flex-col items-center gap-2 hover:border-primary/50 transition-colors">
                <Ticket size={24} className="text-yellow-400"/>
                <span className="text-white text-sm font-semibold">Buat Tiket</span>
              </button>
            </div>

            {/* Banner - smooth auto slide */}
            <Banner banners={banners}/>

            {/* Riwayat pembayaran */}
            {record?.history?.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-4">
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <Clock size={16} className="text-primary"/>Riwayat Pembayaran
                </h3>
                <div className="space-y-2">
                  {record.history.slice(-5).reverse().map((h, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                      <div>
                        <p className="text-white text-sm">{fmtRp(h.amount)}</p>
                        <p className="text-gray-500 text-xs">{fmtDate(h.paidAt)}</p>
                      </div>
                      <span className="text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded-full">LUNAS</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* PAYMENT */}
        {page === 'payment' && (
          <div className="space-y-4">
            <h2 className="text-white font-bold text-lg">Informasi Pembayaran</h2>
            {record && (
              <div className="bg-primary/10 border border-primary/30 rounded-2xl p-4">
                <p className="text-gray-400 text-sm">Total yang harus dibayar:</p>
                <p className="text-primary text-3xl font-bold mono mt-1">{fmtRp(record.price)}</p>
                <p className="text-gray-500 text-xs mt-1">Jatuh tempo: {fmtDate(record.dueDate)}</p>
              </div>
            )}
            <p className="text-gray-400 text-sm">Transfer ke salah satu rekening berikut:</p>
            {payInfo.length === 0 && <p className="text-gray-600 text-sm">Info pembayaran belum diisi admin.</p>}
            {payInfo.map(bank => (
              <div key={bank.id} className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                    <CreditCard size={18} className="text-primary"/>
                  </div>
                  <span className="text-white font-bold">{bank.bank_name}</span>
                </div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">No. Rekening</span>
                    <span className="text-white font-bold mono">{bank.account_no}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Atas Nama</span>
                    <span className="text-white">{bank.account_name}</span>
                  </div>
                  {bank.notes && <p className="text-yellow-400 text-xs mt-2">{bank.notes}</p>}
                </div>
              </div>
            ))}
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 text-xs text-yellow-400">
              Status LUNAS akan diupdate setelah admin mengkonfirmasi pembayaran Anda.
            </div>
          </div>
        )}

        {/* NEW TICKET */}
        {page === 'ticket-new' && (
          <div className="space-y-4">
            <h2 className="text-white font-bold text-lg">Buat Tiket Aduan</h2>
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Kategori</label>
              <select value={newTicket.category} onChange={e => setNewTicket(p => ({...p, category: e.target.value}))}
                className="input-cyber w-full px-3 py-2.5 rounded-xl text-sm">
                {['Gangguan Internet','Tagihan','Perangkat','Permintaan Layanan','Umum'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Judul Masalah</label>
              <input value={newTicket.title} onChange={e => setNewTicket(p => ({...p, title: e.target.value}))}
                className="input-cyber w-full px-3 py-2.5 rounded-xl text-sm"
                placeholder="Contoh: Internet tidak bisa connect"/>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Deskripsi (opsional)</label>
              <textarea value={newTicket.desc} onChange={e => setNewTicket(p => ({...p, desc: e.target.value}))}
                rows={4} className="input-cyber w-full px-3 py-2.5 rounded-xl text-sm resize-none"
                placeholder="Jelaskan masalah Anda secara detail..."/>
            </div>
            <button onClick={submitTicket} disabled={saving}
              className="w-full btn-primary py-3 rounded-xl font-semibold disabled:opacity-50">
              {saving ? 'Mengirim...' : 'Kirim Tiket'}
            </button>
          </div>
        )}

        {/* TICKET LIST */}
        {page === 'ticket-list' && !selTicket && (
          <div className="space-y-3">
            <h2 className="text-white font-bold text-lg">Tiket Saya</h2>
            {tickets.length === 0 && (
              <div className="text-center py-12 text-gray-600">
                <Ticket size={36} className="mx-auto mb-3 opacity-30"/>
                <p>Belum ada tiket</p>
              </div>
            )}
            {tickets.map(t => (
              <button key={t.id} onClick={() => setSelTicket(t)}
                className="w-full bg-card border border-border rounded-2xl p-4 text-left hover:border-primary/40 transition-colors">
                <div className="flex items-start justify-between">
                  <p className="text-white font-semibold text-sm">{t.title}</p>
                  <span className={clsx('text-xs px-2 py-0.5 rounded-full ml-2 flex-shrink-0',
                    t.status==='open' ? 'bg-blue-500/20 text-blue-400' :
                    t.status==='in_progress' ? 'bg-yellow-500/20 text-yellow-400' :
                    t.status==='resolved' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400')}>
                    {t.status==='open'?'Open':t.status==='in_progress'?'Diproses':t.status==='resolved'?'Selesai':'Ditutup'}
                  </span>
                </div>
                <p className="text-gray-500 text-xs mt-1">{t.ticket_no} · {t.category}</p>
              </button>
            ))}
          </div>
        )}

        {/* TICKET DETAIL */}
        {page === 'ticket-list' && selTicket && (
          <div className="space-y-3">
            <button onClick={() => setSelTicket(null)} className="text-primary text-sm flex items-center gap-1">
              ← Kembali
            </button>
            <h2 className="text-white font-bold">{selTicket.title}</h2>
            <p className="text-gray-500 text-xs">{selTicket.ticket_no}</p>
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {messages.length === 0 && <p className="text-gray-600 text-sm text-center py-4">Belum ada balasan dari admin</p>}
              {messages.map(msg => (
                <div key={msg.id} className={clsx('flex', msg.sender_type==='admin' ? 'justify-start' : 'justify-end')}>
                  <div className={clsx('max-w-[80%] rounded-2xl px-4 py-2.5 text-sm',
                    msg.sender_type==='admin' ? 'bg-darker border border-border text-gray-300 rounded-tl-sm'
                    : 'bg-primary/20 text-white rounded-tr-sm')}>
                    <p className="text-xs opacity-60 mb-1">{msg.sender_name}</p>
                    <p>{msg.message}</p>
                  </div>
                </div>
              ))}
            </div>
            {selTicket.status !== 'closed' && (
              <div className="flex gap-2">
                <input value={ticketMsg} onChange={e => setTicketMsg(e.target.value)}
                  className="input-cyber flex-1 px-3 py-2.5 rounded-xl text-sm" placeholder="Tulis balasan..."/>
                <button onClick={sendTicketMsg} className="btn-primary px-4 rounded-xl text-sm">Kirim</button>
              </div>
            )}
          </div>
        )}

        {/* PROFILE */}
        {page === 'profile' && (
          <div className="space-y-4">
            <h2 className="text-white font-bold text-lg">Profil & Keamanan</h2>
            <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
              {[
                { label: 'Nama Lengkap', value: customer.full_name || '-' },
                { label: 'ID Pelanggan', value: customer.customer_id || '-' },
                { label: 'Username PPPoE', value: customer.pppoe_username },
                { label: 'No. HP', value: customer.phone || '-' },
                { label: 'Paket', value: customer.profile || '-' },
              ].map(row => (
                <div key={row.label} className="flex justify-between py-2 border-b border-border/50 last:border-0">
                  <span className="text-gray-500 text-sm">{row.label}</span>
                  <span className="text-white text-sm mono">{row.value}</span>
                </div>
              ))}
            </div>

            <h3 className="text-white font-semibold mt-4">Ubah Password</h3>
            <div className="space-y-3">
              {[
                { label: 'Password Lama', val: oldPass, set: setOldPass },
                { label: 'Password Baru', val: newPass, set: setNewPass },
                { label: 'Konfirmasi Password Baru', val: confPass, set: setConfPass },
              ].map(f => (
                <div key={f.label}>
                  <label className="text-xs text-gray-400 mb-1.5 block">{f.label}</label>
                  <input type="password" value={f.val} onChange={e => f.set(e.target.value)}
                    className="input-cyber w-full px-3 py-2.5 rounded-xl text-sm"/>
                </div>
              ))}
              <button onClick={changePassword} disabled={saving}
                className="w-full btn-primary py-3 rounded-xl font-semibold disabled:opacity-50">
                {saving ? 'Menyimpan...' : 'Ubah Password'}
              </button>
            </div>

            {/* CS WhatsApp */}
            <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4">
              <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                <Phone size={16} className="text-green-400"/>Customer Service
              </h3>
              <p className="text-gray-400 text-sm mb-3">Butuh bantuan? Chat langsung dengan tim kami.</p>
              <a href={`https://wa.me/${(csPhone||'').replace(/\D/g,'')}?text=${encodeURIComponent(`Halo admin Bronet, saya ${customer.full_name||customer.pppoe_username} (${customer.customer_id||customer.pppoe_username}). Saya butuh bantuan.`)}`}
                target="_blank" rel="noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-green-500/20 text-green-400 border border-green-500/30 text-sm font-semibold">
                <Phone size={15}/>Chat via WhatsApp
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-card border-t border-border flex">
        {navItems.map(item => (
          <button key={item.key} onClick={() => setPage(item.key)}
            className={clsx('flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors',
              page === item.key ? 'text-primary' : 'text-gray-500 hover:text-gray-300')}>
            <item.icon size={20}/>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
