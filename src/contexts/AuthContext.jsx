import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const ALL_PAGES = [
  { key: 'dashboard', label: 'Dashboard Trafik' },
  { key: 'users',     label: 'User PPPoE' },
  { key: 'profiles',  label: 'Profil Paket' },
  { key: 'billing',   label: 'Tagihan & Reminder' },
  { key: 'settings',  label: 'Pengaturan' },
  { key: 'usermgmt',  label: 'User Management' },
  { key: 'roles',     label: 'Manajemen Role' },
  { key: 'reports',   label: 'Laporan Keuangan & Tagihan' },
  { key: 'assets',    label: 'Asset Management' },
  { key: 'delete-reports', label: 'Hapus Data Laporan' },
];

export { ALL_PAGES };

const DEFAULT_ROLES = [
  { id: 'superadmin', label: 'Super Admin', editable: false,
    permissions: ['dashboard','users','profiles','billing','settings','usermgmt','roles','reports','assets','delete-reports'] },
  { id: 'admin', label: 'Admin', editable: true,
    permissions: ['dashboard','users','profiles','billing','settings','reports','assets','delete-reports'] },
  { id: 'operator', label: 'Operator', editable: true,
    permissions: ['dashboard','users','billing'] },
  { id: 'viewer', label: 'Viewer', editable: true,
    permissions: ['dashboard'] },
];

const DEFAULT_USERS = [
  { id: '1', username: 'admin', password: 'admin123', name: 'Administrator',
    role: 'superadmin', email: 'admin@bronet.id', active: true, createdAt: new Date().toISOString() },
  { id: '2', username: 'operator', password: 'op123', name: 'Operator Bronet',
    role: 'operator', email: 'operator@bronet.id', active: true, createdAt: new Date().toISOString() },
];

function loadRoles() {
  try {
    const saved = localStorage.getItem('bronet_roles');
    return saved ? JSON.parse(saved) : DEFAULT_ROLES;
  } catch { return DEFAULT_ROLES; }
}
function saveRolesLS(roles) {
  localStorage.setItem('bronet_roles', JSON.stringify(roles));
}

// Legacy ROLES export for backward compat
export const ROLES = Object.fromEntries(
  DEFAULT_ROLES.map(r => [r.id, { label: r.label, permissions: r.permissions }])
);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [webUsers, setWebUsers] = useState(() => {
    const saved = localStorage.getItem('bronet_web_users');
    return saved ? JSON.parse(saved) : DEFAULT_USERS;
  });
  const [roles, setRoles] = useState(loadRoles);

  useEffect(() => {
    const savedUser = localStorage.getItem('bronet_current_user');
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  useEffect(() => {
    localStorage.setItem('bronet_web_users', JSON.stringify(webUsers));
  }, [webUsers]);

  useEffect(() => {
    saveRolesLS(roles);
  }, [roles]);

  const login = (username, password) => {
    const found = webUsers.find(u => u.username === username && u.password === password && u.active);
    if (found) {
      const { password: _, ...userWithoutPass } = found;
      setUser(userWithoutPass);
      localStorage.setItem('bronet_current_user', JSON.stringify(userWithoutPass));
      return { success: true };
    }
    return { success: false, error: 'Username atau password salah' };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('bronet_current_user');
  };

  const getRoleById = (roleId) => roles.find(r => r.id === roleId);

  const hasPermission = (page) => {
    if (!user) return false;
    // Always allow superadmin
    if (user.role === 'superadmin') return true;
    const role = getRoleById(user.role);
    if (!role) return false;
    return role.permissions.includes(page);
  };

  // Web users CRUD
  const addWebUser = (userData) => {
    const newUser = { ...userData, id: Date.now().toString(), createdAt: new Date().toISOString() };
    setWebUsers(prev => [...prev, newUser]);
    return newUser;
  };
  const updateWebUser = (id, userData) => {
    setWebUsers(prev => prev.map(u => u.id === id ? { ...u, ...userData } : u));
    // Update current session if editing self
    if (user?.id === id) {
      const updated = { ...user, ...userData };
      setUser(updated);
      localStorage.setItem('bronet_current_user', JSON.stringify(updated));
    }
  };
  const deleteWebUser = (id) => {
    setWebUsers(prev => prev.filter(u => u.id !== id));
  };

  // Roles CRUD
  const addRole = (roleData) => {
    const newRole = { ...roleData, id: roleData.id || `role_${Date.now()}`, editable: true };
    setRoles(prev => [...prev, newRole]);
    return newRole;
  };
  const updateRole = (id, roleData) => {
    setRoles(prev => prev.map(r => r.id === id ? { ...r, ...roleData } : r));
    // If current user has this role, refresh permission cache
    if (user?.role === id) {
      const updated = { ...user };
      setUser(updated);
      localStorage.setItem('bronet_current_user', JSON.stringify(updated));
    }
  };
  const deleteRole = (id) => {
    // Can't delete if users are assigned to it
    const usersWithRole = webUsers.filter(u => u.role === id);
    if (usersWithRole.length > 0) return { error: `${usersWithRole.length} user masih menggunakan role ini` };
    setRoles(prev => prev.filter(r => r.id !== id));
    return { success: true };
  };

  return (
    <AuthContext.Provider value={{
      user, login, logout, hasPermission,
      webUsers, addWebUser, updateWebUser, deleteWebUser,
      roles, addRole, updateRole, deleteRole, getRoleById, ALL_PAGES,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
