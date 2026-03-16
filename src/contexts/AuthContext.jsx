import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { loadWebUsers, saveWebUsers, loadRoles as loadRolesDB, saveRoles as saveRolesDB } from '../utils/db';

const AuthContext = createContext(null);

export const ALL_PAGES = [
  // ── Menu Utama ──────────────────────────────────────────────────────────────
  { key: 'dashboard', label: 'Dashboard Trafik', group: 'Monitoring' },
  { key: 'users',     label: 'User PPPoE — Lihat & Kelola', group: 'Monitoring' },
  { key: 'profiles',  label: 'Profil Paket — Lihat & Kelola', group: 'Monitoring' },

  // ── Tagihan ─────────────────────────────────────────────────────────────────
  { key: 'billing',        label: 'Tagihan & Reminder — Lihat', group: 'Tagihan' },
  { key: 'billing-lunas',  label: 'Tagihan — Tandai Lunas', group: 'Tagihan' },
  { key: 'billing-wa',     label: 'Tagihan — Kirim Reminder WA', group: 'Tagihan' },

  // ── Laporan ──────────────────────────────────────────────────────────────────
  { key: 'reports',        label: 'Laporan Keuangan & Tagihan', group: 'Laporan' },
  { key: 'delete-reports', label: 'Laporan — Hapus Data', group: 'Laporan' },

  // ── Aset ─────────────────────────────────────────────────────────────────────
  { key: 'assets',         label: 'Asset Management', group: 'Aset' },

  // ── Administrasi ─────────────────────────────────────────────────────────────
  { key: 'settings',       label: 'Pengaturan Koneksi Mikrotik', group: 'Admin' },
  { key: 'usermgmt',       label: 'User Management Web', group: 'Admin' },
  { key: 'roles',          label: 'Manajemen Role & Hak Akses', group: 'Admin' },
];

const DEFAULT_ROLES = [
  { id: 'superadmin', label: 'Super Admin', editable: false,
    permissions: ['dashboard','users','profiles','billing','billing-lunas','billing-wa','settings','usermgmt','roles','reports','delete-reports','assets'] },
  { id: 'admin', label: 'Admin', editable: true,
    permissions: ['dashboard','users','profiles','billing','billing-lunas','billing-wa','settings','reports','delete-reports','assets'] },
  { id: 'operator', label: 'Operator', editable: true,
    permissions: ['dashboard','users','billing','billing-lunas','billing-wa'] },
  { id: 'viewer', label: 'Viewer', editable: true,
    permissions: ['dashboard'] },
];

const DEFAULT_USERS = [
  { id: '1', username: 'admin',    password: 'admin123', name: 'Administrator',  role: 'superadmin', email: 'admin@bronet.id',    active: true, createdAt: new Date().toISOString() },
  { id: '2', username: 'operator', password: 'op123',    name: 'Operator Bronet', role: 'operator',   email: 'operator@bronet.id', active: true, createdAt: new Date().toISOString() },
];

// Sync read from localStorage (synchronous fallback)
function readLocalUsers() {
  try { const s = localStorage.getItem('bronet_web_users'); return s ? JSON.parse(s) : null; } catch { return null; }
}
function readLocalRoles() {
  try { const s = localStorage.getItem('bronet_roles'); return s ? JSON.parse(s) : null; } catch { return null; }
}

export const ROLES = Object.fromEntries(DEFAULT_ROLES.map(r => [r.id, { label: r.label, permissions: r.permissions }]));

export function AuthProvider({ children }) {
  const [user,     setUser]     = useState(null);
  // ── FIX: Initialize synchronously from localStorage (NOT from async DB function) ──
  const [webUsers, setWebUsers] = useState(() => readLocalUsers() || DEFAULT_USERS);
  const [roles,    setRoles]    = useState(() => readLocalRoles() || DEFAULT_ROLES);
  const [loading,  setLoading]  = useState(true);

  // Track whether initial DB load is done — prevents overwriting new data
  const dbSynced = useRef(false);

  // ── On mount: restore session, then sync from DB ───────────────────────────
  useEffect(() => {
    // 1. Restore session immediately from localStorage
    const savedUser = localStorage.getItem('bronet_current_user');
    if (savedUser) {
      try { setUser(JSON.parse(savedUser)); } catch {}
    }

    // 2. Sync from DB in background
    Promise.all([loadWebUsers(), loadRolesDB()])
      .then(([dbUsers, dbRoles]) => {
        // ── MERGE strategy: DB + local, local wins for newer items ──
        setWebUsers(prev => {
          if (!dbUsers || dbUsers.length === 0) return prev;
          // Build map from DB
          const dbMap = Object.fromEntries(dbUsers.map(u => [u.id, u]));
          // Keep all local users, overlay with DB for existing ones
          const localIds = new Set(prev.map(u => u.id));
          const merged = prev.map(u => dbMap[u.id] ? { ...dbMap[u.id], ...u } : u);
          // Add DB users that don't exist locally
          dbUsers.forEach(u => { if (!localIds.has(u.id)) merged.push(u); });
          localStorage.setItem('bronet_web_users', JSON.stringify(merged));
          return merged;
        });

        setRoles(prev => {
          if (!dbRoles || dbRoles.length === 0) return prev;
          const dbMap = Object.fromEntries(dbRoles.map(r => [r.id, r]));
          const localIds = new Set(prev.map(r => r.id));
          const merged = prev.map(r => dbMap[r.id] ? { ...dbMap[r.id], ...r } : r);
          dbRoles.forEach(r => { if (!localIds.has(r.id)) merged.push(r); });
          localStorage.setItem('bronet_roles', JSON.stringify(merged));
          return merged;
        });
      })
      .catch(console.error)
      .finally(() => {
        dbSynced.current = true;
        setLoading(false);
      });
  }, []);

  // ── Persist webUsers to localStorage + DB on every change (after initial load) ──
  const isFirstRenderUsers = useRef(true);
  useEffect(() => {
    if (isFirstRenderUsers.current) { isFirstRenderUsers.current = false; return; }
    localStorage.setItem('bronet_web_users', JSON.stringify(webUsers));
    saveWebUsers(webUsers).catch(console.error);
  }, [webUsers]);

  // ── Persist roles to localStorage + DB on every change ────────────────────
  const isFirstRenderRoles = useRef(true);
  useEffect(() => {
    if (isFirstRenderRoles.current) { isFirstRenderRoles.current = false; return; }
    localStorage.setItem('bronet_roles', JSON.stringify(roles));
    saveRolesDB(roles).catch(console.error);
  }, [roles]);

  // ── Login ──────────────────────────────────────────────────────────────────
  const login = (username, password) => {
    // Always read from state (which is already synced from DB)
    const found = webUsers.find(u =>
      u.username === username && u.password === password && u.active
    );
    if (found) {
      const { password: _, ...safe } = found;
      setUser(safe);
      localStorage.setItem('bronet_current_user', JSON.stringify(safe));
      return { success: true };
    }
    return { success: false, error: 'Username atau password salah' };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('bronet_current_user');
  };

  const getRoleById  = (id) => roles.find(r => r.id === id);

  const hasPermission = (page) => {
    if (!user) return false;
    if (user.role === 'superadmin') return true;
    const role = getRoleById(user.role);
    return role ? role.permissions.includes(page) : false;
  };

  // ── Web Users CRUD ─────────────────────────────────────────────────────────
  const addWebUser = (data) => {
    const newUser = { ...data, id: Date.now().toString(), createdAt: new Date().toISOString() };
    setWebUsers(prev => {
      const updated = [...prev, newUser];
      // Save immediately to localStorage and DB
      localStorage.setItem('bronet_web_users', JSON.stringify(updated));
      saveWebUsers(updated).catch(console.error);
      return updated;
    });
    return newUser;
  };
  const updateWebUser = (id, data) => {
    setWebUsers(prev => {
      const updated = prev.map(u => u.id === id ? { ...u, ...data } : u);
      localStorage.setItem('bronet_web_users', JSON.stringify(updated));
      saveWebUsers(updated).catch(console.error);
      return updated;
    });
    if (user?.id === id) {
      const updated = { ...user, ...data };
      setUser(updated);
      localStorage.setItem('bronet_current_user', JSON.stringify(updated));
    }
  };
  const deleteWebUser = (id) => {
    setWebUsers(prev => {
      const updated = prev.filter(u => u.id !== id);
      localStorage.setItem('bronet_web_users', JSON.stringify(updated));
      saveWebUsers(updated).catch(console.error);
      return updated;
    });
  };

  // ── Roles CRUD ─────────────────────────────────────────────────────────────
  const addRole = (data) => {
    const r = { ...data, id: data.id || `role_${Date.now()}`, editable: true };
    setRoles(prev => [...prev, r]);
    return r;
  };
  const updateRole = (id, data) => setRoles(prev => prev.map(r => r.id === id ? { ...r, ...data } : r));
  const deleteRole = (id) => {
    if (webUsers.filter(u => u.role === id).length > 0)
      return { error: `${webUsers.filter(u => u.role === id).length} user masih menggunakan role ini` };
    setRoles(prev => prev.filter(r => r.id !== id));
    return { success: true };
  };

  return (
    <AuthContext.Provider value={{
      user, login, logout, hasPermission, loading,
      webUsers, addWebUser, updateWebUser, deleteWebUser,
      roles, addRole, updateRole, deleteRole, getRoleById, ALL_PAGES,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
