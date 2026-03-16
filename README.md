# BRONET - RT RW Net Management System

Sistem manajemen RT RW Net berbasis web dengan integrasi Mikrotik REST API.

## Fitur Utama

1. **Dashboard Trafik** - Monitor real-time, pilih port/interface, filter custom, simpan history
2. **User PPPoE** - Tambah/edit/hapus user PPPoE (field lengkap Mikrotik), integrasi langsung
3. **Profil Paket** - Kelola profil PPP dengan flag harga
4. **Tagihan & Reminder** - Reminder via WhatsApp Web & WA Gateway API
5. **Pengaturan Koneksi** - Konfigurasi Mikrotik REST API
6. **User Management** - Role: Super Admin, Admin, Operator, Viewer
7. **Aplikasi Mobile** - Portal pelanggan di `/mobile` (PWA)

## Deploy ke Netlify

### Cara 1: Deploy via GitHub (Recommended)
1. Push folder `bronet` ke GitHub repository
2. Login ke [netlify.com](https://netlify.com)
3. New Site → Import from GitHub
4. Build command: `npm run build`
5. Publish directory: `dist`
6. Deploy!

### Cara 2: Netlify CLI
```bash
npm install -g netlify-cli
cd bronet
npm install
npm run build
netlify deploy --prod --dir=dist
```

### Cara 3: Drag & Drop
```bash
npm install
npm run build
```
Upload folder `dist` ke Netlify dashboard.

## Login Default
- **Admin**: `admin` / `admin123`
- **Operator**: `operator` / `op123`

## Akses Mobile App
Buka: `https://[domain-anda].netlify.app/mobile`
Login menggunakan username & password PPPoE pelanggan.

## Konfigurasi Mikrotik
1. Buka Settings di aplikasi
2. Isi IP: `103.66.198.187`, Port: `80`
3. Username: `audy_engin25`, Password: `mandiri123!`
4. Klik "Test Koneksi"

## Catatan Penting
- Koneksi Mikrotik membutuhkan REST API aktif (IP → Services → www)
- Field `comment` Mikrotik digunakan untuk menyimpan `noHP|email`
- Data harga profil disimpan di localStorage (tidak di Mikrotik)
- Data tagihan & history trafik disimpan di localStorage browser

