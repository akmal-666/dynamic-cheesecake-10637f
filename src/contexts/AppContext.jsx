import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { loadSettings, saveSettings as saveSettingsDB, saveTrafficBatch, loadTrafficHistory as loadTrafficHistoryDB, pruneTrafficHistory } from '../utils/db';

const AppContext = createContext(null);

const DEFAULT_SETTINGS = {
  host: '', port: '80', username: '', password: '', connected: false, lastCheck: null,
};

export function AppProvider({ children }) {
  // ── Settings: load synchronously from localStorage first ──────────────────
  const [settings, setSettings] = useState(() => {
    try {
      const s = localStorage.getItem('bronet_settings');
      return s ? { ...DEFAULT_SETTINGS, ...JSON.parse(s) } : DEFAULT_SETTINGS;
    } catch { return DEFAULT_SETTINGS; }
  });

  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  // ── Sync settings from DB on first load (for cross-device sharing) ─────────
  const initialSyncDone = useRef(false);
  useEffect(() => {
    loadSettings().then(dbSettings => {
      if (dbSettings && dbSettings.host && !initialSyncDone.current) {
        initialSyncDone.current = true;
        setSettings(prev => {
          // Only overwrite if DB has newer/different settings
          const merged = { ...DEFAULT_SETTINGS, ...dbSettings, connected: false };
          return merged;
        });
      } else {
        initialSyncDone.current = true;
      }
    }).catch(() => { initialSyncDone.current = true; });
  }, []);

  const [connectionStatus, setConnectionStatus] = useState('idle');
  const [trafficHistory, setTrafficHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bronet_traffic_history') || '[]'); } catch { return []; }
  });

  // Buffer for pending traffic points not yet flushed to DB
  const pendingTrafficRef = useRef([]);
  const lastFlushRef = useRef(Date.now());

  // ── Persist settings to localStorage + DB on change ──────────────────────
  const isFirstSettings = useRef(true);
  useEffect(() => {
    if (isFirstSettings.current) { isFirstSettings.current = false; return; }
    localStorage.setItem('bronet_settings', JSON.stringify(settings));
    // Save to DB (for cross-device sync) — exclude connection state
    const { connected, lastCheck, ...toSave } = settings;
    saveSettingsDB({ ...toSave, connected: false }).catch(console.error);
  }, [settings]);

  useEffect(() => {
    const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000; // 1 tahun
    const filtered = trafficHistory.filter(h => new Date(h.timestamp).getTime() > cutoff);
    localStorage.setItem('bronet_traffic_history', JSON.stringify(filtered));
  }, [trafficHistory]);

  // ── updateSettings: ONLY reset connection if credentials actually changed ──
  const updateSettings = useCallback((newSettings) => {
    setSettings(prev => {
      const credChanged =
        (newSettings.host     !== undefined && newSettings.host     !== prev.host)     ||
        (newSettings.port     !== undefined && newSettings.port     !== prev.port)     ||
        (newSettings.username !== undefined && newSettings.username !== prev.username) ||
        (newSettings.password !== undefined && newSettings.password !== prev.password);

      return {
        ...prev,
        ...newSettings,
        // Only disconnect if login credentials changed
        connected: credChanged ? false : prev.connected,
      };
    });
    if (
      (newSettings.host     && newSettings.host     !== settings.host)     ||
      (newSettings.port     && newSettings.port     !== settings.port)     ||
      (newSettings.username && newSettings.username !== settings.username) ||
      (newSettings.password && newSettings.password !== settings.password)
    ) {
      setConnectionStatus('idle');
    }
  }, [settings]);

  // ── callMikrotik: always reads latest settings from ref ───────────────────
  const callMikrotik = useCallback(async (path, method = 'GET', data = null) => {
    const s = settingsRef.current;
    try {
      const response = await fetch('/.netlify/functions/mikrotik', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host:     s.host,
          port:     parseInt(s.port) || 80,
          username: s.username,
          password: s.password,
          path, method, data,
        }),
      });

      const text = await response.text();
      let result = null;
      try { result = text ? JSON.parse(text) : null; } catch {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return { success: true, data: null };
      }

      if (!response.ok) {
        const msg  = result?.detail || result?.message
          || (typeof result?.error === 'string' ? result.error : null)
          || `HTTP ${response.status}`;
        const hint = result?.hint ? '\nSaran: ' + result.hint : '';
        throw new Error(String(msg) + hint);
      }
      return { success: true, data: result };
    } catch (err) {
      console.error('Mikrotik error:', err.message);
      return { success: false, error: err.message };
    }
  }, []); // reads settingsRef — no stale closure

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

  const saveTrafficData = useCallback((iface, rx, tx) => {
    const point = { timestamp: new Date().toISOString(), interface: iface, rx, tx };
    setTrafficHistory(prev => [...prev, point].slice(-10000));

    // Buffer for batch save to Supabase
    pendingTrafficRef.current.push(point);

    // Flush to Supabase every 2 minutes (120 seconds)
    const now = Date.now();
    if (now - lastFlushRef.current >= 300000) { // flush ke Supabase setiap 5 menit
      lastFlushRef.current = now;
      const toFlush = [...pendingTrafficRef.current];
      pendingTrafficRef.current = [];
      if (toFlush.length > 0) {
        saveTrafficBatch(toFlush).catch(console.error);
      }
    }
  }, []);

  const getTrafficHistory = useCallback((iface, hours = 1) => {
    const since = Date.now() - hours * 3600000;
    return trafficHistory.filter(h => h.interface === iface && new Date(h.timestamp).getTime() > since);
  }, [trafficHistory]);

  const clearTrafficHistory = useCallback(() => {
    setTrafficHistory([]);
    pendingTrafficRef.current = [];
    localStorage.removeItem('bronet_traffic_history');
    // Also clear from Supabase
    pruneTrafficHistory(0).catch(console.error);
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

export function useApp() { return useContext(AppContext); }
