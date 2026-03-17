import React, { useState, useEffect } from 'react';
import CustomerLogin from './CustomerLogin';
import CustomerDashboard from './CustomerDashboard';
import { loadBilling as loadBillingDB } from '../../utils/db';

const CUSTOMER_SESSION = 'bronet_customer_session';

export default function CustomerApp() {
  const [customer, setCustomer] = useState(null);
  const [billing,  setBilling]  = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    // Restore session
    try {
      const saved = sessionStorage.getItem(CUSTOMER_SESSION);
      if (saved) setCustomer(JSON.parse(saved));
    } catch {}
    // Load billing data
    loadBillingDB().then(d => setBilling(d || [])).catch(() => {});
    setLoading(false);
  }, []);

  const handleLogin = (cust) => {
    setCustomer(cust);
    sessionStorage.setItem(CUSTOMER_SESSION, JSON.stringify(cust));
  };

  const handleLogout = () => {
    setCustomer(null);
    sessionStorage.removeItem(CUSTOMER_SESSION);
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"/>
    </div>
  );

  return customer
    ? <CustomerDashboard customer={customer} billing={billing} onLogout={handleLogout}/>
    : <CustomerLogin onLogin={handleLogin}/>;
}
