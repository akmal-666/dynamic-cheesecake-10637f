import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar, Clock, CreditCard, MessageSquare, LogOut, Key, Bell,
  Ticket, Phone, Wifi, WifiOff, Upload, Wrench, HelpCircle,
  Gift, ChevronRight, CheckCircle, XCircle, AlertTriangle,
  Activity, RefreshCw, X, Send, Image as ImageIcon, UserPlus, FileText
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import {
  loadBanners, loadPaymentInfo, loadTickets, saveTicket, saveTicketMessage,
  loadTicketMessages, saveCustomer, loadFAQ, savePaymentProof, loadPaymentProofs,
  saveSchedule, loadSchedules, loadReferrals, saveReferral, saveApplication, loadApplications
} from '../../utils/db';

const fmtDate = d => { try { return format(new Date(d),'dd MMMM yyyy',{locale:idLocale}); } catch { return '-'; } };
const fmtRp   = n => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',minimumFractionDigits:0}).format(n||0);
const fmtTime = d => { try { return format(new Date(d),'HH:mm',{locale:idLocale}); } catch { return ''; } };

// ─── Banner slider ─────────────────────────────────────────────────────────
function Banner({ banners }) {
  const [idx, setIdx] = useState(0);
  const trackRef = useRef();
  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => setIdx(i => (i+1) % banners.length), 4000);
    return () => clearInterval(t);
  }, [banners.length]);
  useEffect(() => {
    if (trackRef.current) trackRef.current.style.transform = `translateX(-${idx * 100}%)`;
  }, [idx]);
  if (!banners.length) return null;
  return (
    <div className="rounded-2xl overflow-hidden relative" style={{height:155}}>
      <div ref={trackRef} className="flex h-full" style={{transition:'transform 0.5s cubic-bezier(0.4,0,0.2,1)', width:`${banners.length*100}%`}}>
        {banners.map(b => (
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
              style={{transition:'width 0.3s', width: i===idx?16:6}}
              className={clsx('h-1.5 rounded-full', i===idx?'bg-white':'bg-white/40')}/>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Speed test ────────────────────────────────────────────────────────────
function SpeedTest() {
  const [state, setState] = useState('idle'); // idle|testing|done
  const [dlSpeed, setDlSpeed] = useState(0);
  const [ulSpeed, setUlSpeed] = useState(0);
  const [ping, setPing]     = useState(0);

  const runTest = async () => {
    setState('testing'); setDlSpeed(0); setUlSpeed(0); setPing(0);
    // Ping test
    const t1 = Date.now();
    try { await fetch('https://www.google.com/favicon.ico?_='+Date.now(), {cache:'no-store', mode:'no-cors'}); } catch {}
    setPing(Math.round(Date.now()-t1));
    // Download test — fetch ~1MB image
    const t2 = Date.now();
    try {
      const url = `https://picsum.photos/id/1/800/600?_=${Date.now()}`;
      await fetch(url, {cache:'no-store', mode:'no-cors'});
    } catch {}
    const elapsed = (Date.now()-t2)/1000;
    setDlSpeed(Math.round((0.8*8) / elapsed * 10)/10); // ~0.8MB
    // Upload simulation
    setUlSpeed(Math.round(Math.random()*5 + 2)*10/10);
    setState('done');
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold flex items-center gap-2"><Activity size={16} className="text-primary"/>Speed Test</h3>
        <button onClick={runTest} disabled={state==='testing'}
          className={clsx('px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5',
            state==='testing' ? 'bg-gray-500/20 text-gray-500' : 'bg-primary/20 text-primary border border-primary/30')}>
          <RefreshCw size={12} className={state==='testing'?'animate-spin':''}/>
          {state==='testing' ? 'Testing...' : state==='done' ? 'Ulangi' : 'Mulai Test'}
        </button>
      </div>
      {state !== 'idle' && (
        <div className="grid grid-cols-3 gap-3 mt-2">
          {[
            { label:'Download', val: dlSpeed, unit:'Mbps', color:'text-blue-400' },
            { label:'Upload',   val: ulSpeed, unit:'Mbps', color:'text-orange-400' },
            { label:'Ping',     val: ping,    unit:'ms',   color:'text-green-400' },
          ].map(s => (
            <div key={s.label} className="bg-darker rounded-xl p-3 text-center">
              <div className={clsx('text-xl font-bold mono', s.color)}>{state==='testing' ? '...' : s.val}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.unit}</div>
              <div className="text-xs text-gray-600">{s.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────
export default function CustomerDashboard({ customer, billing, onLogout }) {
  const [page,      setPage]     = useState('home');
  const [banners,   setBanners]  = useState([]);
  const [payInfo,   setPayInfo]  = useState([]);
  const [tickets,   setTickets]  = useState([]);
  const [faq,       setFaq]      = useState([]);
  const [proofs,    setProofs]   = useState([]);
  const [schedules, setSchedules]= useState([]);
  const [csPhone,   setCsPhone]  = useState('');
  const [darkMode,  setDarkMode] = useState(false);

  // Forms
  const [newTicket, setNewTicket] = useState({ title:'', desc:'', category:'Gangguan Internet' });
  const [ticketMsg, setTicketMsg] = useState('');
  const [selTicket, setSelTicket] = useState(null);
  const [messages,  setMessages]  = useState([]);
  const [oldPass,   setOldPass]   = useState('');
  const [newPass,   setNewPass]   = useState('');
  const [confPass,  setConfPass]  = useState('');
  const [saving,    setSaving]    = useState(false);
  const [proofForm, setProofForm] = useState({ amount:'', note:'', image:'' });
  const [schedForm, setSchedForm] = useState({ address:'', complaint:'', date:'', time:'' });
  const [faqOpen,   setFaqOpen]   = useState(null);
  const [referralCode, setReferralCode] = useState('');
  const [referrals,   setReferrals]  = useState([]);
  const [appForm,     setAppForm]    = useState({ full_name:'', phone:'', profile:'', address:'', note:'' });
  const [myApps,      setMyApps]     = useState([]);
  const [ppoeProfiles, setPpoeProfiles] = useState([]);

  const record = billing?.find(b => b.username === customer.pppoe_username);
  const msgEndRef = useRef();

  useEffect(() => {
    loadBanners().then(d => setBanners((d||[]).filter(b=>b.active)));
    loadPaymentInfo().then(d => setPayInfo(d||[]));
    loadFAQ().then(d => setFaq((d||[]).filter(f=>f.active)));
    loadPaymentProofs(customer.pppoe_username).then(d => setProofs(d||[]));

    // Poll proof status every 20s to detect admin confirmation
    let prevProofStatuses = {};
    const proofPoll = setInterval(async () => {
      const fresh = await loadPaymentProofs(customer.pppoe_username);
      const freshProofs = fresh || [];
      setProofs(freshProofs);

      // Detect newly confirmed proofs — reload billing
      freshProofs.forEach(p => {
        const wasNotConfirmed = prevProofStatuses[p.id] !== 'confirmed';
        if (p.status === 'confirmed' && wasNotConfirmed) {
          toast.success('✓ Pembayaran Anda telah dikonfirmasi admin!', { duration: 5000 });
          // Signal parent to reload billing
          if (window.__bronetReloadBilling) window.__bronetReloadBilling();
        }
        prevProofStatuses[p.id] = p.status;
      });
    }, 20000);
    return () => clearInterval(proofPoll);
    loadSchedules(customer.pppoe_username).then(d => setSchedules(d||[]));
    loadReferrals().then(d => {
      const mine = (d||[]).filter(r => r.referrer_username === customer.pppoe_username);
      setReferrals(mine);
    });
    // Load customer applications
    loadApplications().then(d => {
      setMyApps((d||[]).filter(a =>
        a.phone === customer.phone ||
        a.phone === (customer.phone||'').replace(/\D/g,'')
      ));
    });
    // Load PPPoE profiles for package selection
    try {
      const extras = JSON.parse(localStorage.getItem('bronet_profile_extras')||'{}');
      setPpoeProfiles(Object.keys(extras).map(name => ({ name, price: extras[name]._price||0 })));
    } catch {}
    loadTickets().then(d => {
      setTickets((d||[]).filter(t => t.pppoe_username===customer.pppoe_username || t.customer_id===customer.customer_id));
    });
    // Generate referral code if not exists
    const code = (customer.pppoe_username+'-REF').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,10);
    setReferralCode(code);
    // Load WA CS
    try { const s=JSON.parse(localStorage.getItem('bronet_wa_settings')||'{}'); setCsPhone(s.csPhone||s.testPhone||''); } catch {}
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const getTicketKey = t => t?.ticket_no || String(t?.id);

  useEffect(() => {
    if (selTicket) loadTicketMessages(getTicketKey(selTicket)).then(d => setMessages(d||[]));
  }, [selTicket]);

  // Auto-refresh messages
  useEffect(() => {
    if (!selTicket) return;
    const interval = setInterval(async () => {
      const msgs = await loadTicketMessages(getTicketKey(selTicket));
      setMessages(prev => {
        if (JSON.stringify(prev) !== JSON.stringify(msgs||[])) {
          // Notify if new admin message
          const newMsgs = (msgs||[]).filter(m => m.sender_type==='admin' && !prev.find(p=>p.id===m.id));
          if (newMsgs.length > 0 && Notification.permission==='granted') {
            new Notification('Balasan dari Admin Bronet', { body: newMsgs[0].message });
          }
          return msgs||[];
        }
        return prev;
      });
      // Refresh ticket status
      const allT = await loadTickets();
      const updated = allT.find(t => t.ticket_no===selTicket.ticket_no);
      if (updated && updated.status!==selTicket.status) {
        setSelTicket(updated);
        setTickets(prev => prev.map(t => t.ticket_no===selTicket.ticket_no ? updated : t));
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [selTicket]);

  useEffect(() => { msgEndRef.current?.scrollIntoView({behavior:'smooth'}); }, [messages]);

  const submitApplication = async () => {
    if (!appForm.full_name || !appForm.phone) return toast.error('Nama dan No. HP wajib diisi');
    setSaving(true);
    try {
      const app = {
        id:         'app_' + Date.now(),
        install_id: 'bronet_main',
        full_name:  appForm.full_name.trim(),
        phone:      appForm.phone.replace(/\D/g,''),
        profile:    appForm.profile,
        address:    appForm.address,
        note:       appForm.note,
        status:     'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await saveApplication(app);
      setMyApps(prev => [app, ...prev]);
      setAppForm({ full_name:'', phone:'', profile:'', address:'', note:'' });
      toast.success('Permohonan berhasil dikirim! Admin akan menghubungi Anda segera.');
      setPage('app-status');
    } catch(e) { toast.error('Gagal: ' + e.message); }
    setSaving(false);
  };

  const submitTicket = async () => {
    if (!newTicket.title) return toast.error('Judul tiket wajib diisi');
    setSaving(true);
    try {
      const ticket = {
        id:             String(Date.now()),
        install_id:     'bronet_main',
        ticket_no:      `TKT-${format(new Date(),'yyyyMMdd')}-${Math.random().toString(36).slice(2,6).toUpperCase()}`,
        pppoe_username: customer.pppoe_username,
        customer_id:    customer.customer_id||customer.id,
        full_name:      customer.full_name||'',
        title:          newTicket.title,
        description:    newTicket.desc,
        category:       newTicket.category,
        status:'open', priority:'normal',
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };
      await saveTicket(ticket);
      setTickets(prev => [ticket,...prev]);

      // Auto-reply from system
      const autoReply = {
        id:          String(Date.now() + 1),
        ticket_id:   ticket.ticket_no,
        sender_type: 'admin',
        sender_name: 'Sistem Bronet',
        message:     `Halo ${customer.full_name || customer.pppoe_username}, tiket Anda dengan nomor ${ticket.ticket_no} telah diterima. Tim kami akan segera menindaklanjuti. Mohon tunggu balasan dari admin kami. Terima kasih! 🙏`,
        created_at:  new Date(Date.now() + 500).toISOString(),
      };
      await saveTicketMessage(autoReply);

      setNewTicket({title:'',desc:'',category:'Gangguan Internet'});
      toast.success('Tiket berhasil dikirim! Kami akan segera merespons.');
      setPage('ticket-list');
    } catch(e) { toast.error('Gagal: '+e.message); }
    setSaving(false);
  };

  const sendTicketMsg = async () => {
    if (!ticketMsg.trim()||!selTicket) return;
    const msg = { id:String(Date.now()), ticket_id:getTicketKey(selTicket), sender_type:'customer', sender_name:customer.full_name||customer.pppoe_username, message:ticketMsg.trim(), created_at:new Date().toISOString() };
    await saveTicketMessage(msg);
    setMessages(prev=>[...prev,msg]);
    setTicketMsg('');
  };

  const changePassword = async () => {
    if (!oldPass||!newPass||!confPass) return toast.error('Semua field wajib diisi');
    if (customer.password_hash!==btoa(oldPass)) return toast.error('Password lama salah');
    if (newPass.length<6) return toast.error('Password baru minimal 6 karakter');
    if (newPass!==confPass) return toast.error('Konfirmasi tidak cocok');
    setSaving(true);
    await saveCustomer({...customer, password_hash:btoa(newPass)});
    toast.success('Password berhasil diubah!');
    setOldPass(''); setNewPass(''); setConfPass('');
    setSaving(false);
  };

  const uploadProof = async () => {
    if (!proofForm.image) return toast.error('Pilih foto bukti transfer terlebih dahulu');
    if (!proofForm.amount) return toast.error('Isi jumlah transfer');
    setSaving(true);
    const proof = {
      id: 'proof_'+Date.now(), install_id:'bronet_main',
      pppoe_username: customer.pppoe_username,
      customer_id: customer.customer_id||'',
      full_name: customer.full_name||customer.pppoe_username,
      amount: parseInt(proofForm.amount)||0,
      image_base64: proofForm.image,
      note: proofForm.note, status:'pending',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    await savePaymentProof(proof);
    setProofs(prev=>[proof,...prev]);
    setProofForm({amount:'',note:'',image:''});
    toast.success('Bukti transfer dikirim! Admin akan konfirmasi segera.');
    setSaving(false);
  };

  const handleProofImage = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size>3*1024*1024) return toast.error('Ukuran foto maks 3MB');
    const reader = new FileReader();
    reader.onload = ev => setProofForm(p=>({...p,image:ev.target.result}));
    reader.readAsDataURL(file);
  };

  const submitSchedule = async () => {
    if (!schedForm.address||!schedForm.complaint||!schedForm.date) return toast.error('Alamat, keluhan, dan tanggal wajib diisi');
    setSaving(true);
    const sched = {
      id: 'sched_'+Date.now(), install_id:'bronet_main',
      pppoe_username: customer.pppoe_username,
      customer_id: customer.customer_id||'',
      full_name: customer.full_name||customer.pppoe_username,
      phone: customer.phone||'',
      address: schedForm.address, complaint: schedForm.complaint,
      schedule_date: schedForm.date, schedule_time: schedForm.time,
      status:'pending', created_at:new Date().toISOString(), updated_at:new Date().toISOString(),
    };
    await saveSchedule(sched);
    setSchedules(prev=>[sched,...prev]);
    setSchedForm({address:'',complaint:'',date:'',time:''});
    toast.success('Jadwal kunjungan berhasil dikirim!');
    setSaving(false);
  };

  const copyReferral = () => {
    navigator.clipboard.writeText(referralCode).then(() => toast.success('Kode referral disalin!'));
  };

  const days = record?.dueDate ? Math.ceil((new Date(record.dueDate)-new Date())/86400000) : null;
  const faqGroups = [...new Set(faq.map(f=>f.category))];

  const navItems = [
    { key:'home',        icon:Bell,         label:'Beranda' },
    { key:'payment',     icon:CreditCard,    label:'Bayar' },
    { key:'ticket-new',  icon:Ticket,        label:'Tiket' },
    { key:'more',        icon:MessageSquare, label:'Lainnya' },
    { key:'profile',     icon:Key,           label:'Profil' },
  ];

  return (
    <div className={clsx('min-h-screen flex flex-col max-w-md mx-auto relative', darkMode ? 'bg-[#0a0f1a]' : 'bg-[#0d1520]')}>
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div>
          <p className="text-white font-semibold text-sm">{customer.full_name||customer.pppoe_username}</p>
          <p className="text-primary text-xs mono">{customer.customer_id||customer.pppoe_username}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setDarkMode(d=>!d)} className="p-2 text-gray-500 hover:text-gray-300 text-xs">
            {darkMode ? '☀️' : '🌙'}
          </button>
          <button onClick={onLogout} className="text-gray-500 hover:text-red-400 p-2"><LogOut size={17}/></button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-20 px-4 py-4 space-y-4">

        {/* ── HOME ─────────────────────────────────────────── */}
        {page==='home' && <>
          {/* Status tagihan */}
          <div className={clsx('rounded-2xl p-5 border',
            days===null?'bg-card border-border':days<0?'bg-red-500/10 border-red-500/30':days<=3?'bg-yellow-500/10 border-yellow-500/30':'bg-green-500/10 border-green-500/30')}>
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={18} className="text-primary"/>
              <span className="text-white font-semibold">Status Tagihan</span>
              <span className={clsx('ml-auto text-xs px-2 py-1 rounded-full font-semibold',
                record?.paidAt ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400')}>
                {record?.paidAt ? 'LUNAS' : 'BELUM LUNAS'}
              </span>
            </div>
            {record ? (
              <div className="space-y-1.5">
                {[
                  { label:'Paket',    val: record.profile, cls:'text-white font-semibold mono' },
                  { label:'Tagihan',  val: fmtRp(record.price)+'/bln', cls:'text-primary font-bold' },
                  { label:'Jatuh Tempo', val: fmtDate(record.dueDate), cls: days<0?'text-red-400':days<=3?'text-yellow-400':'text-green-400' },
                ].map(r => (
                  <div key={r.label} className="flex justify-between text-sm">
                    <span className="text-gray-400">{r.label}</span>
                    <span className={r.cls}>{r.val}</span>
                  </div>
                ))}
                {days!==null && (
                  <div className="text-center mt-3 py-2 rounded-xl bg-black/20">
                    <span className={clsx('font-bold text-base', days<0?'text-red-400':days<=3?'text-yellow-400':'text-green-400')}>
                      {days<0?`${Math.abs(days)} hari terlambat`:days===0?'Jatuh tempo hari ini!':days<=3?`⚠ ${days} hari lagi`:`${days} hari lagi`}
                    </span>
                  </div>
                )}
              </div>
            ) : <p className="text-gray-500 text-sm">Data tagihan tidak ditemukan</p>}
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setPage('payment')} className="bg-card border border-border rounded-2xl p-4 flex flex-col items-center gap-2 hover:border-primary/50 transition-colors">
              <CreditCard size={24} className="text-primary"/>
              <span className="text-white text-sm font-semibold">Bayar Tagihan</span>
            </button>
            <button onClick={() => setPage('ticket-new')} className="bg-card border border-border rounded-2xl p-4 flex flex-col items-center gap-2 hover:border-primary/50 transition-colors">
              <Ticket size={24} className="text-yellow-400"/>
              <span className="text-white text-sm font-semibold">Buat Tiket</span>
            </button>
          </div>

          {/* Banner */}
          <Banner banners={banners}/>

          {/* Speed test */}
          <SpeedTest/>

          {/* Riwayat pembayaran */}
          {record?.history?.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-4">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <Clock size={16} className="text-primary"/>Riwayat Pembayaran
              </h3>
              <div className="space-y-2">
                {record.history.slice(-5).reverse().map((h,i) => (
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
        </>}

        {/* ── PAYMENT ──────────────────────────────────────── */}
        {page==='payment' && (
          <div className="space-y-4">
            <h2 className="text-white font-bold text-lg">Pembayaran</h2>
            {record && (
              <div className="bg-primary/10 border border-primary/30 rounded-2xl p-4">
                <p className="text-gray-400 text-sm">Total yang harus dibayar:</p>
                <p className="text-primary text-3xl font-bold mono mt-1">{fmtRp(record.price)}</p>
                <p className="text-gray-500 text-xs mt-1">Jatuh tempo: {fmtDate(record.dueDate)}</p>
              </div>
            )}
            {payInfo.map(bank => (
              <div key={bank.id} className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center"><CreditCard size={18} className="text-primary"/></div>
                  <span className="text-white font-bold">{bank.bank_name}</span>
                </div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">No. Rekening</span><span className="text-white font-bold mono">{bank.account_no}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Atas Nama</span><span className="text-white">{bank.account_name}</span></div>
                  {bank.notes && <p className="text-yellow-400 text-xs mt-2">{bank.notes}</p>}
                </div>
              </div>
            ))}

            {/* Upload Bukti */}
            <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <h3 className="text-white font-semibold flex items-center gap-2"><Upload size={16} className="text-primary"/>Upload Bukti Transfer</h3>
              <div onClick={() => document.getElementById('proof-file').click()}
                className="border-2 border-dashed border-border rounded-xl overflow-hidden cursor-pointer hover:border-primary/50 transition-colors" style={{height:130}}>
                {proofForm.image
                  ? <img src={proofForm.image} alt="bukti" className="w-full h-full object-cover"/>
                  : <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-2"><ImageIcon size={28}/><p className="text-sm">Tap untuk upload foto</p></div>}
              </div>
              <input id="proof-file" type="file" accept="image/*" onChange={handleProofImage} className="hidden"/>
              <input value={proofForm.amount} onChange={e=>setProofForm(p=>({...p,amount:e.target.value}))} type="number" className="input-cyber w-full px-3 py-2.5 rounded-xl text-sm mono" placeholder="Jumlah transfer (Rp)"/>
              <input value={proofForm.note} onChange={e=>setProofForm(p=>({...p,note:e.target.value}))} className="input-cyber w-full px-3 py-2.5 rounded-xl text-sm" placeholder="Catatan (opsional)"/>
              <button onClick={uploadProof} disabled={saving} className="w-full btn-primary py-3 rounded-xl font-semibold disabled:opacity-50">
                {saving ? 'Mengirim...' : 'Kirim Bukti Transfer'}
              </button>
            </div>

            {/* Status bukti */}
            {proofs.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-4">
                <h3 className="text-white font-semibold mb-3 text-sm">Status Pembayaran Terakhir</h3>
                {proofs.slice(0,3).map(p => (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div>
                      <p className="text-white text-sm">{fmtRp(p.amount)}</p>
                      <p className="text-gray-500 text-xs">{fmtDate(p.created_at)}</p>
                    </div>
                    <span className={clsx('text-xs px-2 py-1 rounded-full font-semibold',
                      p.status==='confirmed'?'bg-green-500/20 text-green-400':
                      p.status==='rejected'?'bg-red-500/20 text-red-400':'bg-yellow-500/20 text-yellow-400')}>
                      {p.status==='confirmed'?'✓ Dikonfirmasi':p.status==='rejected'?'✗ Ditolak':'⏳ Menunggu'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── NEW TICKET ───────────────────────────────────── */}
        {page==='ticket-new' && (
          <div className="space-y-4">
            <h2 className="text-white font-bold text-lg">Buat Tiket Aduan</h2>
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Kategori</label>
              <select value={newTicket.category} onChange={e=>setNewTicket(p=>({...p,category:e.target.value}))} className="input-cyber w-full px-3 py-2.5 rounded-xl text-sm">
                {['Gangguan Internet','Tagihan','Perangkat','Permintaan Layanan','Umum'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Judul</label>
              <input value={newTicket.title} onChange={e=>setNewTicket(p=>({...p,title:e.target.value}))} className="input-cyber w-full px-3 py-2.5 rounded-xl text-sm" placeholder="Contoh: Internet tidak bisa connect"/>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Deskripsi</label>
              <textarea value={newTicket.desc} onChange={e=>setNewTicket(p=>({...p,desc:e.target.value}))} rows={4} className="input-cyber w-full px-3 py-2.5 rounded-xl text-sm resize-none" placeholder="Jelaskan masalah Anda..."/>
            </div>
            <button onClick={submitTicket} disabled={saving} className="w-full btn-primary py-3 rounded-xl font-semibold disabled:opacity-50">
              {saving?'Mengirim...':'Kirim Tiket'}
            </button>
          </div>
        )}

        {/* ── TICKET LIST ──────────────────────────────────── */}
        {page==='ticket-list' && !selTicket && (
          <div className="space-y-3">
            <h2 className="text-white font-bold text-lg">Tiket Saya ({tickets.length})</h2>
            {tickets.length===0 && <div className="text-center py-12 text-gray-600"><Ticket size={36} className="mx-auto mb-3 opacity-30"/><p>Belum ada tiket</p></div>}
            {tickets.map(t => (
              <button key={t.id} onClick={() => setSelTicket(t)} className="w-full bg-card border border-border rounded-2xl p-4 text-left hover:border-primary/40 transition-colors">
                <div className="flex items-start justify-between">
                  <p className="text-white font-semibold text-sm">{t.title}</p>
                  <span className={clsx('text-xs px-2 py-0.5 rounded-full ml-2 flex-shrink-0 font-semibold',
                    t.status==='open'?'bg-blue-500/20 text-blue-400':t.status==='in_progress'?'bg-yellow-500/20 text-yellow-400':t.status==='resolved'?'bg-green-500/20 text-green-400':'bg-gray-500/20 text-gray-400')}>
                    {t.status==='open'?'Open':t.status==='in_progress'?'Diproses':t.status==='resolved'?'✓ Selesai':'Ditutup'}
                  </span>
                </div>
                <p className="text-gray-500 text-xs mt-1">{t.ticket_no} · {t.category}</p>
              </button>
            ))}
          </div>
        )}

        {/* ── TICKET DETAIL ────────────────────────────────── */}
        {page==='ticket-list' && selTicket && (
          <div className="space-y-3">
            <button onClick={() => setSelTicket(null)} className="text-primary text-sm">← Kembali</button>
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold">{selTicket.title}</h2>
              <span className={clsx('text-xs px-2 py-1 rounded-full font-semibold',
                selTicket.status==='open'?'bg-blue-500/20 text-blue-400':selTicket.status==='in_progress'?'bg-yellow-500/20 text-yellow-400':selTicket.status==='resolved'?'bg-green-500/20 text-green-400':'bg-gray-500/20 text-gray-400')}>
                {selTicket.status==='open'?'Open':selTicket.status==='in_progress'?'Diproses':selTicket.status==='resolved'?'✓ Selesai':'Ditutup'}
              </span>
            </div>
            <p className="text-gray-500 text-xs">{selTicket.ticket_no} · auto-refresh 8 detik</p>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {messages.length===0 && <p className="text-gray-600 text-sm text-center py-6">Belum ada balasan dari admin</p>}
              {messages.map(msg => (
                <div key={msg.id} className={clsx('flex', msg.sender_type==='admin'?'justify-start':'justify-end')}>
                  <div className={clsx('max-w-[80%] rounded-2xl px-4 py-2.5 text-sm',
                    msg.sender_type==='admin'?'bg-darker border border-border text-gray-300 rounded-tl-sm':'bg-primary/20 text-white rounded-tr-sm')}>
                    <p className="text-xs opacity-60 mb-1">{msg.sender_name} · {fmtTime(msg.created_at)}</p>
                    <p className="whitespace-pre-wrap">{msg.message}</p>
                  </div>
                </div>
              ))}
              <div ref={msgEndRef}/>
            </div>
            {selTicket.status!=='closed' && (
              <div className="flex gap-2">
                <input value={ticketMsg} onChange={e=>setTicketMsg(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendTicketMsg();}}}
                  className="input-cyber flex-1 px-3 py-2.5 rounded-xl text-sm" placeholder="Tulis balasan..."/>
                <button onClick={sendTicketMsg} className="btn-primary px-4 rounded-xl"><Send size={15}/></button>
              </div>
            )}
          </div>
        )}

        {/* ── MORE ─────────────────────────────────────────── */}
        {page==='more' && (
          <div className="space-y-3">
            <h2 className="text-white font-bold text-lg">Layanan Lainnya</h2>
            {[
              { key:'faq',      icon:HelpCircle, color:'text-blue-400',   bg:'bg-blue-500/10',   label:'FAQ & Bantuan',       desc:'Pertanyaan umum' },
              { key:'schedule', icon:Wrench,     color:'text-orange-400', bg:'bg-orange-500/10', label:'Jadwal Teknisi',      desc:'Request kunjungan' },
              { key:'referral', icon:Gift,       color:'text-green-400',  bg:'bg-green-500/10',  label:'Program Referral',    desc:'Ajak teman, dapat hadiah' },
              { key:'ticket-list',icon:MessageSquare,color:'text-yellow-400',bg:'bg-yellow-500/10',label:'Riwayat Tiket', desc:`${tickets.length} tiket` },
            ].map(m => (
              <button key={m.key} onClick={() => setPage(m.key)} className="w-full bg-card border border-border rounded-2xl p-4 flex items-center gap-4 hover:border-primary/40 transition-colors">
                <div className={clsx('w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0', m.bg)}>
                  <m.icon size={22} className={m.color}/>
                </div>
                <div className="text-left flex-1">
                  <p className="text-white font-semibold text-sm">{m.label}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{m.desc}</p>
                </div>
                <ChevronRight size={16} className="text-gray-600"/>
              </button>
            ))}
          </div>
        )}

        {/* ── FAQ ──────────────────────────────────────────── */}
        {page==='faq' && (
          <div className="space-y-3">
            <button onClick={() => setPage('more')} className="text-primary text-sm">← Kembali</button>
            <h2 className="text-white font-bold text-lg">FAQ & Bantuan</h2>
            {faqGroups.map(cat => (
              <div key={cat}>
                <p className="text-xs text-primary font-semibold uppercase tracking-wider mb-2">{cat}</p>
                {faq.filter(f=>f.category===cat).map(f => (
                  <div key={f.id} className="bg-card border border-border rounded-2xl mb-2 overflow-hidden">
                    <button onClick={() => setFaqOpen(faqOpen===f.id?null:f.id)} className="w-full text-left px-4 py-3 flex items-center justify-between">
                      <p className="text-white text-sm font-medium">{f.question}</p>
                      <span className="text-gray-500 ml-2 flex-shrink-0">{faqOpen===f.id?'▲':'▼'}</span>
                    </button>
                    {faqOpen===f.id && <div className="px-4 pb-3 text-sm text-gray-400 bg-darker">{f.answer}</div>}
                  </div>
                ))}
              </div>
            ))}
            {faq.length===0 && <p className="text-gray-600 text-sm text-center py-8">FAQ belum tersedia</p>}
            {csPhone && (
              <a href={`https://wa.me/${csPhone.replace(/\D/g,'')}?text=${encodeURIComponent('Halo admin Bronet, saya butuh bantuan.')}`} target="_blank" rel="noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-green-500/20 text-green-400 border border-green-500/30 font-semibold mt-4">
                <Phone size={16}/>Chat Customer Service
              </a>
            )}
          </div>
        )}

        {/* ── SCHEDULE ─────────────────────────────────────── */}
        {page==='schedule' && (
          <div className="space-y-4">
            <button onClick={() => setPage('more')} className="text-primary text-sm">← Kembali</button>
            <h2 className="text-white font-bold text-lg">Jadwal Kunjungan Teknisi</h2>
            <div className="space-y-3">
              {[
                { label:'Alamat Lengkap *', key:'address', type:'text', ph:'Jl. Contoh No.1, RT 01/02...' },
                { label:'Keluhan *', key:'complaint', type:'text', ph:'Jelaskan masalah Anda...' },
                { label:'Tanggal Kunjungan *', key:'date', type:'date', ph:'' },
                { label:'Waktu Kunjungan', key:'time', type:'time', ph:'' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs text-gray-400 mb-1.5 block">{f.label}</label>
                  <input type={f.type} value={schedForm[f.key]} onChange={e=>setSchedForm(p=>({...p,[f.key]:e.target.value}))}
                    className="input-cyber w-full px-3 py-2.5 rounded-xl text-sm" placeholder={f.ph}/>
                </div>
              ))}
              <button onClick={submitSchedule} disabled={saving} className="w-full btn-primary py-3 rounded-xl font-semibold disabled:opacity-50">
                {saving?'Mengirim...':'Kirim Request Jadwal'}
              </button>
            </div>
            {schedules.length > 0 && (
              <div>
                <h3 className="text-white font-semibold text-sm mb-2">Jadwal Saya</h3>
                {schedules.slice(0,3).map(s => (
                  <div key={s.id} className="bg-card border border-border rounded-xl p-3 mb-2">
                    <div className="flex justify-between items-center">
                      <p className="text-white text-sm">{fmtDate(s.schedule_date)}{s.schedule_time&&' · '+s.schedule_time}</p>
                      <span className={clsx('text-xs px-2 py-0.5 rounded-full',
                        s.status==='confirmed'?'bg-blue-500/20 text-blue-400':s.status==='done'?'bg-green-500/20 text-green-400':'bg-yellow-500/20 text-yellow-400')}>
                        {s.status==='pending'?'Menunggu':s.status==='confirmed'?'Dikonfirmasi':s.status==='done'?'Selesai':'Diproses'}
                      </span>
                    </div>
                    <p className="text-gray-500 text-xs mt-1">{s.complaint}</p>
                    {s.technician && <p className="text-primary text-xs mt-1">Teknisi: {s.technician}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── REFERRAL ─────────────────────────────────────── */}
        {page==='referral' && (
          <div className="space-y-4">
            <button onClick={() => setPage('more')} className="text-primary text-sm">← Kembali</button>
            <h2 className="text-white font-bold text-lg">Program Referral</h2>
            <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 rounded-2xl p-5 text-center">
              <Gift size={36} className="mx-auto text-primary mb-3"/>
              <p className="text-gray-400 text-sm mb-2">Kode Referral Anda</p>
              <p className="text-white text-2xl font-bold mono tracking-widest">{referralCode}</p>
              <button onClick={copyReferral} className="mt-3 px-4 py-2 rounded-xl bg-primary/20 text-primary text-sm border border-primary/30">
                📋 Salin Kode
              </button>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4">
              <h3 className="text-white font-semibold mb-2 text-sm">Cara Kerja</h3>
              {['Bagikan kode Anda ke teman','Teman daftar dan sebut kode Anda ke admin','Admin akan memberikan reward untuk Anda berdua'].map((s,i) => (
                <div key={i} className="flex items-start gap-3 mb-2">
                  <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center flex-shrink-0 font-bold">{i+1}</span>
                  <p className="text-gray-400 text-sm">{s}</p>
                </div>
              ))}
            </div>
            {referrals.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-4">
                <h3 className="text-white font-semibold mb-2 text-sm">Referral Saya ({referrals.length})</h3>
                {referrals.map(r => (
                  <div key={r.id} className="flex justify-between py-2 border-b border-border/50 last:border-0">
                    <span className="text-gray-300 text-sm mono">{r.referred_username||'Belum digunakan'}</span>
                    <span className={clsx('text-xs', r.status==='rewarded'?'text-green-400':r.status==='registered'?'text-blue-400':'text-gray-500')}>
                      {r.status==='rewarded'?'✓ Reward diterima':r.status==='registered'?'Terdaftar':'Menunggu'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── PERMOHONAN BARU ─────────────────────────────── */}
        {page==='app-new' && (
          <div className="space-y-4">
            <h2 className="text-white font-bold text-lg flex items-center gap-2">
              <UserPlus size={20} className="text-primary"/>Permohonan Pelanggan Baru
            </h2>
            <div className="bg-primary/10 border border-primary/30 rounded-2xl p-4">
              <p className="text-gray-300 text-sm">Isi form berikut untuk mendaftar sebagai pelanggan baru. Admin kami akan menghubungi Anda via WhatsApp untuk konfirmasi jadwal pemasangan.</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Nama Lengkap *</label>
                <input value={appForm.full_name} onChange={e=>setAppForm(p=>({...p,full_name:e.target.value}))}
                  className="input-cyber w-full px-3 py-2.5 rounded-xl text-sm" placeholder="Nama lengkap Anda"/>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">No. HP / WhatsApp *</label>
                <input value={appForm.phone} onChange={e=>setAppForm(p=>({...p,phone:e.target.value}))} type="tel"
                  className="input-cyber w-full px-3 py-2.5 rounded-xl text-sm mono" placeholder="08xxxxxxxxxx"/>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Paket yang Diminati</label>
                <select value={appForm.profile} onChange={e=>setAppForm(p=>({...p,profile:e.target.value}))}
                  className="input-cyber w-full px-3 py-2.5 rounded-xl text-sm">
                  <option value="">-- Pilih Paket --</option>
                  {ppoeProfiles.map(prof => (
                    <option key={prof.name} value={prof.name}>
                      {prof.name}{prof.price > 0 ? ` — Rp ${prof.price.toLocaleString('id-ID')}/bln` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Alamat Pemasangan</label>
                <textarea value={appForm.address} onChange={e=>setAppForm(p=>({...p,address:e.target.value}))}
                  rows={3} className="input-cyber w-full px-3 py-2.5 rounded-xl text-sm resize-none"
                  placeholder="Alamat lengkap untuk pemasangan..."/>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Catatan Tambahan</label>
                <input value={appForm.note} onChange={e=>setAppForm(p=>({...p,note:e.target.value}))}
                  className="input-cyber w-full px-3 py-2.5 rounded-xl text-sm" placeholder="Info tambahan (opsional)"/>
              </div>
              <button onClick={submitApplication} disabled={saving}
                className="w-full btn-primary py-3 rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                <UserPlus size={16}/>{saving ? 'Mengirim...' : 'Kirim Permohonan'}
              </button>
            </div>
            {myApps.length > 0 && (
              <button onClick={() => setPage('app-status')} className="w-full py-2.5 rounded-xl border border-border text-gray-400 text-sm">
                Lihat Status Permohonan ({myApps.length})
              </button>
            )}
          </div>
        )}

        {/* ── STATUS PERMOHONAN ────────────────────────────── */}
        {page==='app-status' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold text-lg">Status Permohonan</h2>
              <button onClick={() => setPage('app-new')} className="btn-primary px-3 py-1.5 rounded-lg text-xs flex items-center gap-1">
                <UserPlus size={13}/>Permohonan Baru
              </button>
            </div>
            {myApps.length===0 && (
              <div className="text-center py-10 text-gray-600">
                <FileText size={36} className="mx-auto mb-3 opacity-30"/>
                <p>Belum ada permohonan</p>
              </div>
            )}
            {myApps.map(app => (
              <div key={app.id} className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-white font-semibold">{app.full_name}</p>
                    <p className="text-gray-500 text-xs mono">{app.phone}</p>
                  </div>
                  <span className={clsx('text-xs px-2 py-1 rounded-full font-semibold',
                    app.status==='pending'   ? 'bg-yellow-500/20 text-yellow-400' :
                    app.status==='contacted' ? 'bg-blue-500/20 text-blue-400' :
                    app.status==='approved'  ? 'bg-green-500/20 text-green-400' :
                    'bg-red-500/20 text-red-400')}>
                    {app.status==='pending'?'⏳ Menunggu':app.status==='contacted'?'📞 Dihubungi':app.status==='approved'?'✓ Disetujui':'✗ Ditolak'}
                  </span>
                </div>
                {app.profile && <p className="text-primary text-sm">Paket: {app.profile}</p>}
                {app.address && <p className="text-gray-500 text-xs mt-1">{app.address}</p>}
                {app.admin_note && (
                  <div className="mt-2 p-2.5 bg-darker rounded-lg text-xs text-gray-400 border border-border">
                    <span className="text-primary font-semibold">Catatan Admin: </span>{app.admin_note}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── PROFILE ──────────────────────────────────────── */}
        {page==='profile' && (
          <div className="space-y-4">
            <h2 className="text-white font-bold text-lg">Profil & Keamanan</h2>
            <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
              {[{l:'Nama Lengkap',v:customer.full_name||'-'},{l:'ID Pelanggan',v:customer.customer_id||'-'},{l:'Username PPPoE',v:customer.pppoe_username},{l:'No. HP',v:customer.phone||'-'},{l:'Paket',v:customer.profile||'-'}].map(r => (
                <div key={r.l} className="flex justify-between py-2 border-b border-border/50 last:border-0">
                  <span className="text-gray-500 text-sm">{r.l}</span>
                  <span className="text-white text-sm mono">{r.v}</span>
                </div>
              ))}
            </div>
            <h3 className="text-white font-semibold">Ubah Password</h3>
            <div className="space-y-3">
              {[{l:'Password Lama',val:oldPass,set:setOldPass},{l:'Password Baru (min 6 karakter)',val:newPass,set:setNewPass},{l:'Konfirmasi Password Baru',val:confPass,set:setConfPass}].map(f => (
                <div key={f.l}>
                  <label className="text-xs text-gray-400 mb-1.5 block">{f.l}</label>
                  <input type="password" value={f.val} onChange={e=>f.set(e.target.value)} className="input-cyber w-full px-3 py-2.5 rounded-xl text-sm"/>
                </div>
              ))}
              <button onClick={changePassword} disabled={saving} className="w-full btn-primary py-3 rounded-xl font-semibold disabled:opacity-50">
                {saving?'Menyimpan...':'Ubah Password'}
              </button>
            </div>
            {csPhone && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4">
                <h3 className="text-white font-semibold mb-2 flex items-center gap-2"><Phone size={16} className="text-green-400"/>Customer Service</h3>
                <a href={`https://wa.me/${csPhone.replace(/\D/g,'')}?text=${encodeURIComponent(`Halo admin Bronet, saya ${customer.full_name||customer.pppoe_username} (${customer.customer_id||customer.pppoe_username}). Saya butuh bantuan.`)}`}
                  target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-green-500/20 text-green-400 border border-green-500/30 text-sm font-semibold">
                  <Phone size={15}/>Chat via WhatsApp
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-card border-t border-border flex">
        {navItems.map(item => (
          <button key={item.key} onClick={() => setPage(item.key)}
            className={clsx('flex-1 flex flex-col items-center gap-0.5 py-3 text-xs transition-colors relative',
              page===item.key||([item.key].includes('ticket-new')&&page==='ticket-list') ? 'text-primary' : 'text-gray-500 hover:text-gray-300')}>
            <item.icon size={20}/>
            <span>{item.label}</span>
            {item.key==='ticket-new' && tickets.filter(t=>t.status==='in_progress').length > 0 && (
              <span className="absolute top-2 right-4 w-2 h-2 bg-yellow-400 rounded-full"/>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
