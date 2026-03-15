import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { loadWebUsers, saveWebUsers, loadRoles as loadRolesDB, saveRoles as saveRolesDB } from '../utils/db';

const AuthContext = createContext(null);

export const ALL_PAGES = [
  { key: 'dashboard',      label: 'Dashboard Trafik' },
  { key: 'users',          label: 'User PPPoE' },
  { key: 'profiles',       label: 'Profil Paket' },
  { key: 'billing',        label: 'Tagihan & Reminder' },
  { key: 'settings',       label: 'Pengaturan' },
  { key: 'usermgmt',       label: 'User Management' },
  { key: 'roles',          label: 'Manajemen Role' },
  { key: 'reports',        label: 'Laporan Keuangan & Tagihan' },
  { key: 'assets',         label: 'Asset Management' },
  { key: 'delete-reports', label: 'Hapus Data Laporan' },
];

const DEFAULT_ROLES = [
  { id: 'superadmin', label: 'Super Admin', editable: false,
    permissions: ['dashboard','users','profiles','billing','settings','usermgmt','roles','reports','assets','delete-reports'] },
  { id: 'admin',    label: 'Admin',    editable: true,
    permissions: ['dashboard','users','profiles','billing','settings','reports','assets','delete-reports'] },
  { id: 'operator', label: 'Operator', editable: true,
    permissions: ['dashboard','users','billing'] },
  { id: 'viewer',   label: 'Viewer',   editable: true,
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

    // 2. Sync from DB in background (Supabase if configured, else localStorage already loaded above)
    Promise.all([loadWebUsers(), loadRolesDB()])
      .then(([dbUsers, dbRoles]) => {
        if (dbUsers && dbUsers.length > 0) {
          setWebUsers(dbUsers);
          // Also write to localStorage so other tabs/devices get it
          localStorage.setItem('bronet_web_users', JSON.stringify(dbUsers));
        }
        if (dbRoles && dbRoles.length > 0) {
          setRoles(dbRoles);
          localStorage.setItem('bronet_roles', JSON.stringify(dbRoles));
        }
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
    setWebUsers(prev => [...prev, newUser]);
    return newUser;
  };
  const updateWebUser = (id, data) => {
    setWebUsers(prev => prev.map(u => u.id === id ? { ...u, ...data } : u));
    if (user?.id === id) {
      const updated = { ...user, ...data };
      setUser(updated);
      localStorage.setItem('bronet_current_user', JSON.stringify(updated));
    }
  };
  const deleteWebUser = (id) => setWebUsers(prev => prev.filter(u => u.id !== id));

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
