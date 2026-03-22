import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppProvider } from './contexts/AppContext';
import Layout from './components/Layout/Layout';
import Login from './components/Login';
import Dashboard from './components/Dashboard/Dashboard';
import Users from './components/Users/Users';
import Profiles from './components/Profiles/Profiles';
import Billing from './components/Billing/Billing';
import Settings from './components/Settings/Settings';
import UserManagement from './components/UserManagement/UserManagement';
import Roles from './components/Roles/Roles';
import WhatsAppGuide from './components/WhatsApp/WhatsAppGuide';
import FinancialReport from './components/Reports/FinancialReport';
import UnpaidReport from './components/Reports/UnpaidReport';
import AssetManagement from './components/Assets/AssetManagement';
import BannerManagement from './components/Banners/BannerManagement';
import PaymentInfo from './components/PaymentInfo/PaymentInfo';
import TicketManagement from './components/Tickets/TicketManagement';
import RemoteRouter from './components/Remote/RemoteRouter';
import CustomerApp from './components/CustomerPortal/CustomerApp';
import CustomerAccounts from './components/Customers/CustomerAccounts';
import FAQManagement from './components/FAQ/FAQManagement';
import ApplicationManagement from './components/Applications/ApplicationManagement';
import TechScheduleManagement from './components/TechSchedule/TechScheduleManagement';
import PaymentProofManagement from './components/PaymentProofs/PaymentProofManagement';
import MobileApp from './components/Mobile/MobileApp';

// Full-screen loading spinner
function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-darker flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <div className="text-primary font-mono text-sm">BRONET</div>
      </div>
    </div>
  );
}

// Access denied page inside Layout
function AccessDenied() {
  return (
    <div className="flex items-center justify-center h-full min-h-[50vh]">
      <div className="text-center">
        <div className="text-5xl mb-4">🔒</div>
        <h2 className="text-white font-bold text-xl mb-2">Akses Ditolak</h2>
        <p className="text-gray-500 text-sm">Anda tidak memiliki izin untuk mengakses halaman ini.</p>
      </div>
    </div>
  );
}

// Single Layout wrapper — all authenticated pages go through here
function AuthLayout({ permission, children }) {
  const { user, loading, hasPermission } = useAuth();
  // Wait until auth state resolved
  if (loading) return <LoadingScreen />;
  if (!user)   return <Navigate to="/admin/login" replace />;
  return (
    <Layout>
      {permission && !hasPermission(permission) ? <AccessDenied /> : children}
    </Layout>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();
  const home = user ? '/admin/dashboard' : '/admin/login';

  // Show loading screen while auth state resolves
  if (loading) return <LoadingScreen />;

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/admin" element={user ? <Navigate to="/admin/dashboard" replace /> : <Navigate to="/admin/login" replace />} />
      <Route path="/admin/login" element={<Login />} />
      <Route path="/login"  element={<Navigate to="/admin/login" replace />} />
      <Route path="/mobile" element={<MobileApp />} />

      {/* Protected routes — all share one Layout */}

      <Route path="/admin/users"     element={<AuthLayout permission="users"><Users /></AuthLayout>} />
      <Route path="/admin/profiles"  element={<AuthLayout permission="profiles"><Profiles /></AuthLayout>} />
      <Route path="/admin/billing"   element={<AuthLayout permission="billing"><Billing /></AuthLayout>} />
      <Route path="/admin/settings"  element={<AuthLayout permission="settings"><Settings /></AuthLayout>} />
      <Route path="/admin/usermgmt"  element={<AuthLayout permission="usermgmt"><UserManagement /></AuthLayout>} />
      <Route path="/admin/roles"     element={<AuthLayout permission="roles"><Roles /></AuthLayout>} />
      <Route path="/admin/whatsapp"  element={<AuthLayout permission="settings"><WhatsAppGuide /></AuthLayout>} />
      <Route path="/admin/financial" element={<AuthLayout permission="reports"><FinancialReport /></AuthLayout>} />
      <Route path="/admin/unpaid"    element={<AuthLayout permission="reports"><UnpaidReport /></AuthLayout>} />
      <Route path="/admin/assets"    element={<AuthLayout permission="assets"><AssetManagement /></AuthLayout>} />
      <Route path="/admin/banners"   element={<AuthLayout permission="banners"><BannerManagement /></AuthLayout>} />
      <Route path="/admin/payment-info" element={<AuthLayout permission="payment-info"><PaymentInfo /></AuthLayout>} />
      <Route path="/admin/tickets"   element={<AuthLayout permission="tickets"><TicketManagement /></AuthLayout>} />
      <Route path="/admin/customers"  element={<AuthLayout permission="customers"><CustomerAccounts /></AuthLayout>} />
      <Route path="/admin/faq"         element={<AuthLayout permission="banners"><FAQManagement /></AuthLayout>} />
      <Route path="/admin/tech-schedule" element={<AuthLayout permission="tickets"><TechScheduleManagement /></AuthLayout>} />
      <Route path="/admin/payment-proofs" element={<AuthLayout permission="billing-lunas"><PaymentProofManagement /></AuthLayout>} />
      <Route path="/admin/applications" element={<AuthLayout permission="customers"><ApplicationManagement /></AuthLayout>} />
      <Route path="/admin/remote"    element={<AuthLayout permission="remote"><RemoteRouter /></AuthLayout>} />

      {/* Customer Portal — root URL only */}
      <Route path="/" element={<CustomerApp />} />

      {/* Fallbacks */}
      {/* Any unknown /admin/* → admin login, anything else → portal */}
      <Route path="/admin/*" element={<Navigate to="/admin/login" replace />} />
      <Route path="*" element={<CustomerApp />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppProvider>
          <AppRoutes />
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#111827',
                color: '#e5e7eb',
                border: '1px solid #1f2937',
                fontFamily: 'Syne, sans-serif',
                fontSize: '13px',
              },
              success: { iconTheme: { primary: '#10b981', secondary: '#111827' } },
              error:   { iconTheme: { primary: '#ef4444', secondary: '#111827' } },
            }}
          />
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
