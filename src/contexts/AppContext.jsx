import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AppContext = createContext(null);

const DEFAULT_SETTINGS = {
  host: '103.66.198.187',
  port: '80',
  username: 'audy_engin25',
  password: 'mandiri123!',
  apiPort: '8728',
  connected: false,
  lastCheck: null,
};

export function AppProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('bronet_settings');
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  });

  const [connectionStatus, setConnectionStatus] = useState('idle'); // idle, checking, connected, error
  const [trafficHistory, setTrafficHistory] = useState(() => {
    const saved = localStorage.getItem('bronet_traffic_history');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('bronet_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    // Keep only last 7 days of traffic history
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const filtered = trafficHistory.filter(h => new Date(h.timestamp).getTime() > sevenDaysAgo);
    localStorage.setItem('bronet_traffic_history', JSON.stringify(filtered));
  }, [trafficHistory]);

  const updateSettings = (newSettings) => {
    setSettings(prev => ({ ...prev, ...newSettings, connected: false }));
    setConnectionStatus('idle');
  };

  const callMikrotik = useCallback(async (path, method = 'GET', data = null) => {
    // Always use /.netlify/functions/mikrotik (works with `netlify dev` locally & production)
    const endpoint = '/.netlify/functions/mikrotik';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: settings.host,
          port: parseInt(settings.port) || 80,
          username: settings.username,
          password: settings.password,
          path,
          method,
          data,
        }),
      });

      // Parse response text first — Mikrotik sometimes returns non-JSON
      const text = await response.text();
      let result = null;
      try {
        result = text ? JSON.parse(text) : null;
      } catch {
        // Response was not JSON (HTML error page, etc.)
        if (!response.ok) {
          throw new Error(`Server tidak dapat dijangkau (HTTP ${response.status}). Pastikan Anda menjalankan dengan "netlify dev" bukan "npm run dev".`);
        }
        return { success: true, data: null };
      }

      if (!response.ok) {
        // Mikrotik REST API error format: { "detail": "...", "error": 400, "message": "..." }
        // Mikrotik REST error format: { detail, message, error, hint }
        const msg  = result?.detail || result?.message || (typeof result?.error === 'string' ? result.error : null) || `HTTP ${response.status}`;
        const hint = result?.hint ? '\n\nSaran: ' + result.hint : '';
        throw new Error(String(msg) + hint);
      }

      return { success: true, data: result };
    } catch (err) {
      console.error('Mikrotik API error:', err);
      return { success: false, error: err.message };
    }
  }, [settings]);

  const testConnection = useCallback(async () => {
    setConnectionStatus('checking');
    const result = await callMikrotik('/system/identity', 'GET');
    if (result.success) {
      setConnectionStatus('connected');
      setSettings(prev => ({ ...prev, connected: true, lastCheck: new Date().toISOString() }));
      return { success: true, data: result.data };
    } else {
      setConnectionStatus('error');
      setSettings(prev => ({ ...prev, connected: false }));
      return { success: false, error: result.error };
    }
  }, [callMikrotik]);

  const saveTrafficData = useCallback((interfaceName, rxBps, txBps) => {
    const entry = {
      timestamp: new Date().toISOString(),
      interface: interfaceName,
      rx: rxBps,
      tx: txBps,
    };
    setTrafficHistory(prev => {
      const updated = [...prev, entry];
      // Keep only last 10000 entries
      return updated.slice(-10000);
    });
  }, []);

  const getTrafficHistory = useCallback((interfaceName, hours = 1) => {
    const since = Date.now() - hours * 60 * 60 * 1000;
    return trafficHistory.filter(
      h => h.interface === interfaceName && new Date(h.timestamp).getTime() > since
    );
  }, [trafficHistory]);

  const clearTrafficHistory = useCallback(() => {
    setTrafficHistory([]);
    localStorage.removeItem('bronet_traffic_history');
  }, []);

  return (
    <AppContext.Provider value={{
      settings, updateSettings,
      connectionStatus, testConnection,
      callMikrotik,
      trafficHistory, saveTrafficData, getTrafficHistory, clearTrafficHistory,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
