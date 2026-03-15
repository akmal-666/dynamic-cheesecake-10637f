import React, { useState } from 'react';
import { MessageCircle, Check, ExternalLink, Star, DollarSign, Zap, Shield, ChevronDown, ChevronUp, Copy } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';

const PROVIDERS = [
  {
    name: 'wa.me Link (Gratis)',
    price: 'Rp 0',
    badge: 'GRATIS',
    badgeColor: 'bg-green-500/20 text-green-400 border-green-500/30',
    rating: 4,
    pros: ['100% gratis selamanya', 'Tidak perlu registrasi', 'Langsung buka WA pelanggan', 'Sudah terintegrasi di Bronet'],
    cons: ['Harus klik manual per pelanggan', 'Tidak bisa kirim otomatis terjadwal', 'Membutuhkan HP/WA aktif'],
    desc: 'Cara bawaan Bronet. Saat klik tombol WA, browser buka link wa.me secara langsung.',
    status: 'active',
    link: 'https://wa.me',
    setup: [
      'Tidak perlu setup apapun',
      'Pastikan nomor HP pelanggan diisi dengan benar (format: 08xxx)',
      'Klik tombol ikon WhatsApp di tabel Tagihan',
      'Browser akan membuka WhatsApp Web / app dengan pesan siap kirim',
      'Klik Send di WhatsApp',
    ],
  },
  {
    name: 'Fonnte',
    price: 'Rp 40.000 / bulan',
    badge: 'PALING MURAH',
    badgeColor: 'bg-primary/20 text-primary border-primary/30',
    rating: 5,
    pros: ['API WA resmi Indonesia', 'Kirim otomatis tanpa klik manual', 'Bisa scheduling', '1000 pesan/hari di paket basic', 'Support WA non-business'],
    cons: ['Butuh bayar langganan', 'Perlu setup token API'],
    desc: 'Gateway WhatsApp Indonesia paling populer & murah. Rekomendasi untuk Bronet.',
    status: 'recommended',
    link: 'https://fonnte.com',
    apiEndpoint: 'https://api.fonnte.com/send',
    setup: [
      'Daftar di fonnte.com',
      'Beli paket (mulai Rp 40.000/bulan)',
      'Scan QR Code untuk hubungkan nomor WA Anda',
      'Salin Token API dari dashboard',
      'Masukkan token di Pengaturan Bronet → Tab WhatsApp',
      'Test kirim pesan dari dashboard Fonnte',
    ],
    apiExample: `// Contoh integrasi Fonnte di Bronet
fetch('https://api.fonnte.com/send', {
  method: 'POST',
  headers: { 'Authorization': 'TOKEN_FONNTE_ANDA' },
  body: new FormData() // dengan field: target, message
})`,
  },
  {
    name: 'Wablas',
    price: 'Rp 99.000 / bulan',
    badge: 'POPULER',
    badgeColor: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    rating: 4,
    pros: ['Fitur lengkap', 'Dashboard bagus', 'Support baik', 'Ada fitur broadcast'],
    cons: ['Lebih mahal dari Fonnte', 'Perlu verifikasi'],
    desc: 'Platform WA gateway dengan fitur lengkap dan dashboard yang mudah digunakan.',
    status: 'good',
    link: 'https://wablas.com',
    setup: [
      'Daftar di wablas.com',
      'Pilih paket yang sesuai',
      'Hubungkan nomor WA via QR scan',
      'Ambil API Token dari menu Settings',
      'Masukkan di Pengaturan Bronet',
    ],
  },
  {
    name: 'Zenziva',
    price: 'Rp 95.000 / bulan',
    badge: 'TERPERCAYA',
    badgeColor: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    rating: 4,
    pros: ['Sudah lama berdiri', 'Uptime tinggi', 'Support WhatsApp + SMS'],
    cons: ['Harga menengah', 'UI agak lama'],
    desc: 'Provider gateway SMS & WA yang sudah berdiri lama dengan uptime bagus.',
    status: 'good',
    link: 'https://www.zenziva.id',
    setup: [
      'Daftar di zenziva.id',
      'Pilih paket WhatsApp',
      'Scan QR untuk koneksi',
      'Ambil User & Apikey dari profile',
    ],
  },
];

function StarRating({ rating }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={13} className={i <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-700'} />
      ))}
    </div>
  );
}

function CodeBlock({ code }) {
  const copy = () => {
    navigator.clipboard.writeText(code);
    toast.success('Kode disalin!');
  };
  return (
    <div className="relative mt-3">
      <pre className="bg-darker border border-border rounded-xl p-4 text-xs text-green-400 mono overflow-x-auto">
        {code}
      </pre>
      <button onClick={copy} className="absolute top-2 right-2 p-1.5 rounded text-gray-500 hover:text-primary transition-colors">
        <Copy size={13} />
      </button>
    </div>
  );
}

export default function WhatsAppGuide() {
  const [expanded, setExpanded] = useState('fonnte');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Panduan Integrasi WhatsApp</h1>
        <p className="text-gray-500 text-sm mt-1">Pilih cara kirim reminder tagihan ke pelanggan via WhatsApp</p>
      </div>

      {/* Status current */}
      <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-start gap-3">
        <Check size={18} className="text-green-400 shrink-0 mt-0.5" />
        <div>
          <div className="text-green-400 font-semibold text-sm">Saat ini: wa.me Link sudah aktif</div>
          <div className="text-gray-400 text-xs mt-1">
            Bronet sudah menggunakan metode wa.me gratis. Klik tombol <MessageCircle size={12} className="inline mx-1" />
            di menu Tagihan untuk kirim reminder manual ke pelanggan.
          </div>
        </div>
      </div>

      {/* Comparison table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-white">Perbandingan Pilihan</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-darker/50">
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">PROVIDER</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">HARGA</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">OTOMATIS</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">RATING</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {PROVIDERS.map(p => (
                <tr key={p.name} className="table-row border-b border-border/50 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-white">{p.name}</div>
                  </td>
                  <td className="px-4 py-3 text-green-400 mono text-xs font-semibold">{p.price}</td>
                  <td className="px-4 py-3">
                    {p.status === 'active' ? (
                      <span className="text-yellow-400 text-xs">Manual</span>
                    ) : (
                      <span className="text-green-400 text-xs flex items-center gap-1"><Check size={12} />Otomatis</span>
                    )}
                  </td>
                  <td className="px-4 py-3"><StarRating rating={p.rating} /></td>
                  <td className="px-4 py-3">
                    <span className={clsx('px-2.5 py-1 rounded-full text-xs border font-semibold', p.badgeColor)}>
                      {p.badge}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail cards */}
      <div className="space-y-4">
        {PROVIDERS.map(p => (
          <div key={p.name} className="bg-card border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => setExpanded(expanded === p.name ? null : p.name)}
              className="w-full px-5 py-4 flex items-center gap-4 hover:bg-white/5 transition-colors text-left"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-white">{p.name}</span>
                  <span className={clsx('px-2 py-0.5 rounded-full text-xs border', p.badgeColor)}>{p.badge}</span>
                  {p.status === 'recommended' && (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 flex items-center gap-1">
                      <Star size={10} className="fill-yellow-400" />Rekomendasi
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-1">{p.desc}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-green-400 font-bold text-sm mono">{p.price}</div>
                {expanded === p.name ? <ChevronUp size={16} className="text-gray-400 ml-auto mt-1" /> : <ChevronDown size={16} className="text-gray-400 ml-auto mt-1" />}
              </div>
            </button>

            {expanded === p.name && (
              <div className="border-t border-border px-5 pb-5 pt-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-green-400 font-semibold uppercase tracking-wider mb-2">✓ Kelebihan</div>
                    <ul className="space-y-1.5">
                      {p.pros.map(pro => (
                        <li key={pro} className="flex items-start gap-2 text-xs text-gray-400">
                          <Check size={13} className="text-green-400 shrink-0 mt-0.5" />{pro}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="text-xs text-red-400 font-semibold uppercase tracking-wider mb-2">✗ Kekurangan</div>
                    <ul className="space-y-1.5">
                      {p.cons.map(con => (
                        <li key={con} className="flex items-start gap-2 text-xs text-gray-400">
                          <span className="text-red-400 shrink-0 mt-0.5">✗</span>{con}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-primary font-semibold uppercase tracking-wider mb-3">📋 Cara Setup</div>
                  <ol className="space-y-2">
                    {p.setup.map((step, i) => (
                      <li key={i} className="flex items-start gap-3 text-xs text-gray-400">
                        <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>

                {p.apiExample && (
                  <div>
                    <div className="text-xs text-primary font-semibold uppercase tracking-wider mb-1">💻 Contoh API</div>
                    <CodeBlock code={p.apiExample} />
                    <p className="text-xs text-gray-600 mt-2">
                      Fitur integrasi API otomatis ke Fonnte akan ditambahkan di update Bronet berikutnya.
                    </p>
                  </div>
                )}

                {p.link && (
                  <a href={p.link} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 text-sm transition-all">
                    <ExternalLink size={15} />Kunjungi {p.name}
                  </a>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Recommendation box */}
      <div className="bg-gradient-to-r from-primary/10 to-transparent border border-primary/30 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary shrink-0">
            <Zap size={24} />
          </div>
          <div>
            <h3 className="font-bold text-white mb-2">💡 Rekomendasi untuk Bronet</h3>
            <div className="text-gray-400 text-sm space-y-2">
              <p><span className="text-white font-semibold">Mulai dengan gratis:</span> Gunakan wa.me link yang sudah ada. Cukup untuk RT RW Net skala kecil (&lt;50 pelanggan).</p>
              <p><span className="text-white font-semibold">Upgrade ke Fonnte</span> jika ingin kirim reminder otomatis tanpa klik manual. Biaya Rp 40.000/bulan sangat worth untuk efisiensi operasional.</p>
              <p className="text-xs text-gray-500">
                Semua provider di atas menggunakan nomor WhatsApp Anda sendiri — tidak perlu WA Business API resmi Meta (yang mahal & ribet).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
