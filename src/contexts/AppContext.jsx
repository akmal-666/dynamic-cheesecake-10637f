import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { loadSettings, saveSettings as saveSettingsDB } from '../utils/db';

const AppContext = createContext(null);

const DEFAULT_SETTINGS = {
  host: '103.66.198.187',
  port: '80',
  username: 'audy_engin25',
  password: 'mandiri123!',
  connected: false,
  lastCheck: null,
};

export function AppProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('bronet_settings');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch { return DEFAULT_SETTINGS; }
  });

  // Sync from DB on first load (overrides localStorage with server data)
  useEffect(() => {
    loadSettings().then(dbSettings => {
      if (dbSettings && dbSettings.host) {
        setSettings(prev => ({ ...prev, ...dbSettings }));
      }
    }).catch(console.error);
  }, []); // eslint-disable-line

  // Keep a ref so callMikrotik always reads latest settings (avoids stale closure)
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  const [connectionStatus, setConnectionStatus] = useState('idle');
  const [trafficHistory, setTrafficHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('bronet_traffic_history') || '[]');
    } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem('bronet_settings', JSON.stringify(settings));
    saveSettingsDB(settings).catch(console.error);
  }, [settings]);

  useEffect(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const filtered = trafficHistory.filter(h => new Date(h.timestamp).getTime() > sevenDaysAgo);
    localStorage.setItem('bronet_traffic_history', JSON.stringify(filtered));
  }, [trafficHistory]);

  const updateSettings = (newSettings) => {
    setSettings(prev => {
      const merged = { ...prev, ...newSettings, connected: false };
      return merged;
    });
    setConnectionStatus('idle');
  };

  const callMikrotik = useCallback(async (path, method = 'GET', data = null) => {
    const s = settingsRef.current;
    // On Netlify production: /.netlify/functions/mikrotik
    // On local netlify dev: same path works
    const endpoint = '/.netlify/functions/mikrotik';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host:     s.host,
          port:     parseInt(s.port) || 80,
          username: s.username,
          password: s.password,
          path,
          method,
          data,
        }),
      });

      const text = await response.text();
      let result = null;
      try {
        result = text ? JSON.parse(text) : null;
      } catch {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} — server tidak dapat dijangkau`);
        }
        return { success: true, data: null };
      }

      if (!response.ok) {
        const msg  = result?.detail
          || result?.message
          || (typeof result?.error === 'string' ? result.error : null)
          || `HTTP ${response.status}`;
        const hint = result?.hint ? '\nSaran: ' + result.hint : '';
        throw new Error(String(msg) + hint);
      }

      return { success: true, data: result };
    } catch (err) {
      console.error('Mikrotik API error:', err);
      return { success: false, error: err.message };
    }
  }, []); // no deps — reads from ref

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

  const saveTrafficData = useCallback((interfaceName, rx, tx) => {
    setTrafficHistory(prev => [...prev, {
      timestamp: new Date().toISOString(),
      interface: interfaceName,
      rx, tx,
    }].slice(-10000));
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
