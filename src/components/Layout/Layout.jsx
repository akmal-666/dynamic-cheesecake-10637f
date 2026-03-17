import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import {
  LayoutDashboard, Users, Sliders, CreditCard, Settings,
  Shield, ShieldCheck, MessageCircle, BarChart2, UserX, Package,
  Menu, X, LogOut, Wifi, WifiOff, ChevronRight,
  Image, Banknote, Ticket, Radio, ExternalLink, HelpCircle, Wrench, Upload, Users2
} from 'lucide-react';
import clsx from 'clsx';

const navItems = [
  // Monitoring
  { path: '/dashboard',  label: 'Dashboard Trafik',    icon: LayoutDashboard, permission: 'dashboard' },
  { path: '/users',      label: 'User PPPoE',           icon: Users,           permission: 'users' },
  { path: '/profiles',   label: 'Profil Paket',         icon: Sliders,         permission: 'profiles' },
  { path: '/remote',     label: 'Remote Router',        icon: Radio,           permission: 'remote' },
  // Tagihan
  { path: '/billing',    label: 'Tagihan & Reminder',   icon: CreditCard,      permission: 'billing' },
  // Laporan
  { path: '/financial',  label: 'Lap. Keuangan',        icon: BarChart2,       permission: 'reports' },
  { path: '/unpaid',     label: 'Lap. Belum Bayar',     icon: UserX,           permission: 'reports' },
  // Aset
  { path: '/assets',     label: 'Asset Management',     icon: Package,         permission: 'assets' },
  // Customer Portal
  { path: '/banners',    label: 'Banner Management',    icon: Image,           permission: 'banners' },
  { path: '/payment-info', label: 'Info Pembayaran',    icon: Banknote,        permission: 'payment-info' },
  { path: '/tickets',    label: 'Tiket Aduan',          icon: Ticket,          permission: 'tickets' },
  { path: '/customers',    label: 'Akun Customer Portal',  icon: Users,           permission: 'customers' },
  { path: '/faq',           label: 'FAQ / Knowledge Base',  icon: HelpCircle,      permission: 'banners' },
  { path: '/tech-schedule', label: 'Jadwal Teknisi',        icon: Wrench,          permission: 'tickets' },
  { path: '/payment-proofs',label: 'Bukti Pembayaran',      icon: Upload,          permission: 'billing-lunas' },
  // Admin
  { path: '/settings',   label: 'Pengaturan',           icon: Settings,        permission: 'settings' },
  { path: '/usermgmt',   label: 'User Management',      icon: Shield,          permission: 'usermgmt' },
  { path: '/roles',      label: 'Manajemen Role',       icon: ShieldCheck,     permission: 'roles' },
  { path: '/whatsapp',   label: 'Panduan WhatsApp',     icon: MessageCircle,   permission: 'settings' },
];

export default function Layout({ children }) {
  const { user, logout, hasPermission } = useAuth();
  const { connectionStatus } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isConnected = connectionStatus === 'connected';

  return (
    <div className="flex h-screen bg-dark overflow-hidden">
      {/* Sidebar */}
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-50 w-64 bg-darker border-r border-border flex flex-col transition-transform duration-300',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        'lg:relative lg:translate-x-0'
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
          <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30">
            <span className="text-primary font-mono font-bold text-xl">B</span>
          </div>
          <div>
            <div className="text-white font-bold text-lg leading-none">BRONET</div>
            <div className="text-primary/60 text-xs mono">RT RW Net Manager</div>
          </div>
        </div>

        {/* Connection status */}
        <div className="mx-4 mt-3 px-3 py-2 rounded-lg bg-card border border-border">
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Wifi size={14} className="text-green-400" />
            ) : (
              <WifiOff size={14} className="text-red-400" />
            )}
            <span className="text-xs mono">
              {isConnected ? (
                <span className="text-green-400">TERHUBUNG</span>
              ) : connectionStatus === 'checking' ? (
                <span className="text-yellow-400">MEMERIKSA...</span>
              ) : (
                <span className="text-red-400">TIDAK TERHUBUNG</span>
              )}
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 overflow-y-auto">
          {navItems.map(item => {
            if (!hasPermission(item.permission)) return null;
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={clsx(
                  'sidebar-item flex items-center gap-3 px-4 py-3 rounded-lg mb-1 text-sm transition-all',
                  active
                    ? 'active bg-primary/10 text-primary border-l-2 border-primary pl-[14px]'
                    : 'text-gray-400 hover:text-gray-200'
                )}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
                {active && <ChevronRight size={14} className="ml-auto" />}
              </Link>
            );
          })}
        </nav>

        {/* User info */}
        <div className="px-4 py-4 border-t border-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
              <span className="text-primary font-bold text-sm">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white truncate">{user?.name}</div>
              <div className="text-xs text-gray-500 capitalize">{user?.role}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-red-400 hover:bg-red-400/10 transition-colors text-sm"
          >
            <LogOut size={16} />
            Keluar
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="flex items-center gap-4 px-6 py-4 bg-darker border-b border-border shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-400 hover:text-white"
          >
            <Menu size={22} />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border text-xs mono">
              <div className={clsx(
                'w-2 h-2 rounded-full',
                isConnected ? 'bg-green-400 pulse-cyan' : 'bg-red-400'
              )} />
              <span className="text-gray-400">{isConnected ? 'Online' : 'Offline'}</span>
            </div>
            <div className="text-xs text-gray-500 hidden sm:block">
              {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 grid-bg">
          <div className="fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
