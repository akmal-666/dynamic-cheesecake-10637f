import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Clock, CheckCircle, AlertCircle, ChevronDown, Send, RefreshCw, Filter } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { loadTickets, saveTicket, loadTicketMessages, saveTicketMessage } from '../../utils/db';
import { useAuth } from '../../contexts/AuthContext';

const STATUS = {
  open:        { label: 'Open',        color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
  in_progress: { label: 'Diproses',   color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' },
  resolved:    { label: 'Selesai',    color: 'text-green-400 bg-green-500/10 border-green-500/30' },
  closed:      { label: 'Ditutup',    color: 'text-gray-400 bg-gray-500/10 border-gray-500/30' },
};

const PRIORITY = {
  low:    { label: 'Rendah',  color: 'text-gray-400' },
  normal: { label: 'Normal',  color: 'text-blue-400' },
  high:   { label: 'Tinggi', color: 'text-yellow-400' },
  urgent: { label: 'Urgent',  color: 'text-red-400' },
};

function fmtDate(d) {
  if (!d) return '-';
  try { return format(new Date(d), 'dd MMM yyyy HH:mm', { locale: idLocale }); } catch { return d; }
}

export default function TicketManagement() {
  const { user } = useAuth();
  const [tickets,  setTickets]  = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply,    setReply]    = useState('');
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState('all');
  const [sending,  setSending]  = useState(false);
  const msgEndRef = useRef();

  useEffect(() => { fetchTickets(); }, []);
  useEffect(() => { if (selected) fetchMessages(selected); }, [selected]);
  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const fetchTickets = async () => {
    setLoading(true);
    const data = await loadTickets();
    setTickets(data || []);
    setLoading(false);
  };

  const fetchMessages = async (ticket) => {
    const key = ticket?.ticket_no || String(ticket?.id || ticket);
    const msgs = await loadTicketMessages(key);
    setMessages(msgs || []);
  };

  const updateStatus = async (ticket, status) => {
    const updated = { ...ticket, status, updated_at: new Date().toISOString(),
      ...(status === 'resolved' ? { resolved_at: new Date().toISOString() } : {}) };
    await saveTicket(updated);
    setTickets(prev => prev.map(t => t.id === ticket.id ? updated : t));
    if (selected?.id === ticket.id) setSelected(updated);
    toast.success('Status tiket diupdate');
  };

  const sendReply = async () => {
    if (!reply.trim() || !selected) return;
    setSending(true);
    const msg = {
      id:          String(Date.now()),
      ticket_id:   selected.ticket_no || String(selected.id), // use ticket_no for consistency
      sender_type: 'admin',
      sender_name: user?.name || 'Admin',
      message:     reply.trim(),
      created_at:  new Date().toISOString(),
    };
    await saveTicketMessage(msg);
    setMessages(prev => [...prev, msg]);
    setReply('');
    // Auto update status to in_progress if still open
    if (selected.status === 'open') await updateStatus(selected, 'in_progress');
    setSending(false);
  };

  const filtered = filter === 'all' ? tickets : tickets.filter(t => t.status === filter);

  return (
    <div className="flex gap-0 h-[calc(100vh-120px)] -mx-6 -my-4">
      {/* Left: ticket list */}
      <div className="w-80 flex-shrink-0 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="text-white font-semibold text-base">Tiket Aduan</h2>
          <div className="flex gap-1 mt-3 flex-wrap">
            {['all','open','in_progress','resolved','closed'].map(s => (
              <button key={s} onClick={() => setFilter(s)}
                className={clsx('text-xs px-2.5 py-1 rounded-lg border transition-all',
                  filter === s ? 'bg-primary/20 text-primary border-primary/40' : 'border-border text-gray-500 hover:text-gray-300')}>
                {s === 'all' ? 'Semua' : STATUS[s]?.label}
                {s === 'all' ? ` (${tickets.length})` : ` (${tickets.filter(t => t.status === s).length})`}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? <div className="text-center py-8 text-gray-500 text-sm">Memuat...</div>
          : filtered.length === 0 ? <div className="text-center py-8 text-gray-600 text-sm">Tidak ada tiket</div>
          : filtered.map(t => (
            <button key={t.id} onClick={() => setSelected(t)}
              className={clsx('w-full text-left p-4 border-b border-border/50 hover:bg-darker transition-colors',
                selected?.id === t.id ? 'bg-primary/5 border-l-2 border-l-primary' : '')}>
              <div className="flex items-start justify-between gap-2">
                <span className="text-white text-sm font-medium line-clamp-1">{t.title}</span>
                <span className={clsx('text-xs px-2 py-0.5 rounded-full border flex-shrink-0', STATUS[t.status]?.color)}>
                  {STATUS[t.status]?.label}
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                <span className="mono">{t.pppoe_username || t.customer_id || '-'}</span>
                <span>·</span>
                <span>{fmtDate(t.created_at)}</span>
              </div>
              <div className="text-xs mt-1">
                <span className={PRIORITY[t.priority]?.color}>{PRIORITY[t.priority]?.label}</span>
                <span className="text-gray-600 ml-2">{t.category}</span>
              </div>
            </button>
          ))}
        </div>
        <div className="p-3 border-t border-border">
          <button onClick={fetchTickets} className="w-full flex items-center justify-center gap-2 py-2 text-xs text-gray-500 hover:text-gray-300">
            <RefreshCw size={12}/>Refresh
          </button>
        </div>
      </div>

      {/* Right: ticket detail */}
      {!selected ? (
        <div className="flex-1 flex items-center justify-center text-gray-600">
          <div className="text-center">
            <MessageSquare size={40} className="mx-auto mb-3 opacity-30"/>
            <p className="text-sm">Pilih tiket untuk melihat detail</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="p-5 border-b border-border">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-white font-semibold">{selected.title}</h3>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  <span className="mono">{selected.ticket_no}</span>
                  <span>·</span>
                  <span>{selected.pppoe_username}</span>
                  <span>·</span>
                  <span>{fmtDate(selected.created_at)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select value={selected.status}
                  onChange={e => updateStatus(selected, e.target.value)}
                  className="input-cyber text-xs px-3 py-1.5 rounded-lg">
                  {Object.entries(STATUS).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
                <select value={selected.priority}
                  onChange={async e => {
                    const updated = { ...selected, priority: e.target.value };
                    await saveTicket(updated);
                    setTickets(prev => prev.map(t => t.id === selected.id ? updated : t));
                    setSelected(updated);
                  }}
                  className="input-cyber text-xs px-3 py-1.5 rounded-lg">
                  {Object.entries(PRIORITY).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
            </div>
            {selected.description && (
              <div className="mt-3 p-3 bg-darker rounded-lg text-sm text-gray-400 border border-border">
                {selected.description}
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-gray-600 text-sm py-4">Belum ada balasan</div>
            )}
            {messages.map(msg => (
              <div key={msg.id} className={clsx('flex', msg.sender_type === 'admin' ? 'justify-end' : 'justify-start')}>
                <div className={clsx('max-w-[70%] rounded-2xl px-4 py-2.5 text-sm',
                  msg.sender_type === 'admin'
                    ? 'bg-primary/20 text-white rounded-tr-sm'
                    : 'bg-darker border border-border text-gray-300 rounded-tl-sm')}>
                  <div className="text-xs mb-1 opacity-60">{msg.sender_name} · {fmtDate(msg.created_at)}</div>
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                </div>
              </div>
            ))}
            <div ref={msgEndRef}/>
          </div>

          {/* Reply box */}
          {selected.status !== 'closed' && (
            <div className="p-4 border-t border-border">
              <div className="flex gap-3">
                <textarea value={reply} onChange={e => setReply(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) sendReply(); }}
                  rows={2} placeholder="Tulis balasan... (Ctrl+Enter untuk kirim)"
                  className="input-cyber flex-1 px-3 py-2.5 rounded-xl text-sm resize-none"/>
                <button onClick={sendReply} disabled={!reply.trim() || sending}
                  className="btn-primary px-4 rounded-xl disabled:opacity-40 flex items-center gap-2 text-sm">
                  <Send size={15}/>{sending ? 'Kirim...' : 'Kirim'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
