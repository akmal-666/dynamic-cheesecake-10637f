// Mock data for when Mikrotik is not connected (demo mode)

export const MOCK_INTERFACES = [
  { name: 'ether1', type: 'ether', 'actual-mtu': 1500, 'mac-address': 'D4:CA:6D:11:22:33', running: 'true', disabled: 'false' },
  { name: 'ether2', type: 'ether', 'actual-mtu': 1500, 'mac-address': 'D4:CA:6D:11:22:34', running: 'true', disabled: 'false' },
  { name: 'ether3-LAN', type: 'ether', 'actual-mtu': 1500, running: 'true', disabled: 'false' },
  { name: 'pppoe-out1', type: 'pppoe-out', running: 'true', disabled: 'false' },
  { name: 'bridge-LAN', type: 'bridge', running: 'true', disabled: 'false' },
  { name: 'wlan1', type: 'wlan', running: 'true', disabled: 'false' },
];

export const MOCK_PPP_SECRETS = [
  {
    '.id': '*1', name: 'pelanggan001', password: 'pass001', profile: 'paket-10mbps',
    service: 'pppoe', comment: '08123456789|pelanggan001@gmail.com|2024-01-01',
    disabled: 'false', 'local-address': '192.168.1.1', 'remote-address': '',
    'last-logged-out': '2024-01-10 08:30:00',
  },
  {
    '.id': '*2', name: 'pelanggan002', password: 'pass002', profile: 'paket-20mbps',
    service: 'pppoe', comment: '08234567890|pelanggan002@gmail.com|2024-01-05',
    disabled: 'false', 'local-address': '192.168.1.1', 'remote-address': '',
    'last-logged-out': '2024-01-09 14:20:00',
  },
  {
    '.id': '*3', name: 'pelanggan003', password: 'pass003', profile: 'paket-5mbps',
    service: 'pppoe', comment: '08345678901|pelanggan003@yahoo.com|2024-01-10',
    disabled: 'true', 'local-address': '192.168.1.1', 'remote-address': '',
    'last-logged-out': '2024-01-01 00:00:00',
  },
  {
    '.id': '*4', name: 'pelanggan004', password: 'pass004', profile: 'paket-50mbps',
    service: 'pppoe', comment: '08456789012|pelanggan004@gmail.com|2024-01-15',
    disabled: 'false', 'local-address': '192.168.1.1', 'remote-address': '',
    'last-logged-out': '2024-01-10 10:00:00',
  },
  {
    '.id': '*5', name: 'pelanggan005', password: 'pass005', profile: 'paket-10mbps',
    service: 'pppoe', comment: '08567890123|budi.santoso@gmail.com|2024-01-20',
    disabled: 'false', 'local-address': '192.168.1.1', 'remote-address': '',
    'last-logged-out': '2024-01-08 16:45:00',
  },
];

export const MOCK_PPP_ACTIVE = [
  { '.id': '*1', name: 'pelanggan001', address: '10.10.0.2', uptime: '1d2h30m', 'rx-byte': 1073741824, 'tx-byte': 536870912 },
  { '.id': '*2', name: 'pelanggan002', address: '10.10.0.3', uptime: '5h12m', 'rx-byte': 524288000, 'tx-byte': 262144000 },
  { '.id': '*4', name: 'pelanggan004', address: '10.10.0.4', uptime: '12h5m', 'rx-byte': 2147483648, 'tx-byte': 1073741824 },
  { '.id': '*5', name: 'pelanggan005', address: '10.10.0.5', uptime: '3h22m', 'rx-byte': 314572800, 'tx-byte': 157286400 },
];

export const MOCK_PPP_PROFILES = [
  {
    '.id': '*1', name: 'paket-5mbps', 'local-address': '192.168.1.1',
    'rate-limit': '5M/5M', 'session-timeout': '30d', 'idle-timeout': '1h',
    'dns-server': '8.8.8.8,8.8.4.4', 'only-one': 'yes',
    _price: 75000, _description: 'Paket Ekonomi 5 Mbps',
  },
  {
    '.id': '*2', name: 'paket-10mbps', 'local-address': '192.168.1.1',
    'rate-limit': '10M/10M', 'session-timeout': '30d', 'idle-timeout': '2h',
    'dns-server': '8.8.8.8,8.8.4.4', 'only-one': 'yes',
    _price: 120000, _description: 'Paket Standar 10 Mbps',
  },
  {
    '.id': '*3', name: 'paket-20mbps', 'local-address': '192.168.1.1',
    'rate-limit': '20M/20M', 'session-timeout': '30d', 'idle-timeout': '3h',
    'dns-server': '8.8.8.8,8.8.4.4', 'only-one': 'yes',
    _price: 200000, _description: 'Paket Premium 20 Mbps',
  },
  {
    '.id': '*4', name: 'paket-50mbps', 'local-address': '192.168.1.1',
    'rate-limit': '50M/50M', 'session-timeout': '30d', 'idle-timeout': '6h',
    'dns-server': '8.8.8.8,8.8.4.4', 'only-one': 'yes',
    _price: 450000, _description: 'Paket Ultra 50 Mbps',
  },
];

export function generateMockTraffic(interfaceName) {
  const now = Date.now();
  const points = [];
  for (let i = 59; i >= 0; i--) {
    const base = interfaceName === 'ether1' ? 50000000 : 10000000;
    points.push({
      time: new Date(now - i * 5000).toISOString(),
      rx: Math.floor(base * (0.5 + Math.random())),
      tx: Math.floor(base * 0.3 * (0.5 + Math.random())),
    });
  }
  return points;
}

export function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

export function formatBps(bps) {
  if (bps < 1000) return `${bps} bps`;
  if (bps < 1000000) return `${(bps / 1000).toFixed(1)} Kbps`;
  if (bps < 1000000000) return `${(bps / 1000000).toFixed(1)} Mbps`;
  return `${(bps / 1000000000).toFixed(1)} Gbps`;
}

export function parseComment(comment) {
  if (!comment) return { phone: '', email: '', installDate: '' };
  const parts = comment.split('|');
  return {
    phone: parts[0]?.trim() || '',
    email: parts[1]?.trim() || '',
    installDate: parts[2]?.trim() || '',
  };
}

export function buildComment(phone, email, installDate = '') {
  return `${phone}|${email}|${installDate}`;
}
