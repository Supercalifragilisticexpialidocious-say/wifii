const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const root = path.join(__dirname);
const port = process.env.PORT || 8080;

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
};

const dhcpRouterHost = process.env.DHCP_ROUTER_HOST || '';
const dhcpRouterPort = process.env.DHCP_ROUTER_PORT || '';
const dhcpRouterProto = process.env.DHCP_ROUTER_PROTOCOL === 'https' ? 'https' : 'http';
const dhcpRouterPath = process.env.DHCP_ROUTER_PATH || '/dhcp_leases';
const dhcpRouterUser = process.env.DHCP_ROUTER_USER || '';
const dhcpRouterPass = process.env.DHCP_ROUTER_PASS || '';

function handler(req, res) {
  try {
    const decodedUrl = decodeURIComponent(req.url.split('?')[0]);

    // Profile JSON endpoint
    if (decodedUrl === '/api/profile') {
      const profile = {
        name: 'Your Name',
        title: 'Web Developer',
        bio: 'Edit this profile in server.js to customize.',
        email: 'you@example.com',
        github: ''
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(profile));
    }

    // Wi-Fi status endpoint
    if (decodedUrl === '/api/wifi') {
      return getWifiStatus((error, wifiData) => {
        const statusCode = error ? 500 : 200;
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(error ? { error: error.message } : wifiData));
      });
    }

    // Connected clients endpoint
    if (decodedUrl === '/api/clients') {
      return getConnectedClients((error, clients) => {
        const statusCode = error ? 500 : 200;
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(error ? { error: error.message } : { clients }));
      });
    }

    // Simple profile HTML page
    if (decodedUrl === '/profile') {
      const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Profile</title>
    <style>body{font-family:Arial,Helvetica,sans-serif;padding:20px;max-width:700px;margin:auto}pre{background:#f6f6f6;padding:10px;border-radius:6px}</style>
  </head>
  <body>
    <h1>Profile</h1>
    <div id="content">Loading…</div>
    <script>
      fetch('/api/profile').then(r=>r.json()).then(p=>{
        document.getElementById('content').innerHTML =
          '<h2>' + p.name + '</h2><p>' + p.title + '</p><p>' + p.bio + '</p><p><strong>Email:</strong> ' + p.email + '</p>';
      }).catch(()=>{document.getElementById('content').textContent='Failed to load profile.'});
    </script>
  </body>
</html>`;
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(html);
    }

    let safePath = path.normalize(decodedUrl).replace(/^\/+/, '');
    if (safePath === '') safePath = 'index.html';
    const filePath = path.join(root, safePath);

    if (!filePath.startsWith(root)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      return res.end('Forbidden');
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('Not Found');
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
    });
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Server error');
  }
}

function parseWindowsWifiOutput(stdout) {
  const lines = stdout.split(/\r?\n/).map(line => line.trim());
  const wifi = {};
  lines.forEach(line => {
    const [key, ...rest] = line.split(':');
    if (!key || rest.length === 0) return;
    const value = rest.join(':').trim();
    const normalized = key.trim().toLowerCase();
    if (normalized === 'state') wifi.state = value;
    if (normalized === 'ssid') wifi.ssid = value;
    if (normalized === 'bssid') wifi.bssid = value;
    if (normalized === 'signal') wifi.signal = value;
    if (normalized === 'radio type') wifi.radioType = value;
    if (normalized === 'channel') wifi.channel = value;
    if (normalized.startsWith('receive rate')) wifi.receiveRate = value;
    if (normalized.startsWith('transmit rate')) wifi.transmitRate = value;
  });
  return wifi;
}

function parseLinuxWifiOutput(stdout) {
  const lines = stdout.split(/\r?\n/).filter(Boolean);
  const first = lines.find(line => line.startsWith('yes:')) || lines[0] || '';
  const parts = first.split(':');
  const wifi = {
    state: 'connected',
    ssid: parts[1] || 'Unknown',
    signal: parts[2] ? `${parts[2]}%` : '',
    channel: parts[3] || '',
    receiveRate: parts[4] || '',
    transmitRate: ''
  };
  return wifi;
}

function getLocalNetworkInfo(callback) {
  if (process.platform === 'win32') {
    exec('ipconfig', { windowsHide: true, timeout: 5000 }, (err, stdout) => {
      if (err || !stdout) {
        return callback(new Error('Unable to determine local network info.'));
      }
      const ipMatch = stdout.match(/IPv4 Address[\.\s]*:\s*(\d+\.\d+\.\d+\.\d+)/i);
      const maskMatch = stdout.match(/Subnet Mask[\.\s]*:\s*(\d+\.\d+\.\d+\.\d+)/i);
      if (!ipMatch || !maskMatch) {
        return callback(new Error('Unable to determine local network info.'));
      }
      return callback(null, { ip: ipMatch[1], mask: maskMatch[1] });
    });
  } else {
    exec('ip addr', { timeout: 5000 }, (err, stdout) => {
      if (err || !stdout) {
        return callback(new Error('Unable to determine local network info.'));
      }
      const inetMatch = stdout.match(/inet\s+(\d+\.\d+\.\d+\.\d+)\/(\d+)/);
      if (!inetMatch) {
        return callback(new Error('Unable to determine local network info.'));
      }
      const ip = inetMatch[1];
      const prefix = Number(inetMatch[2]);
      const mask = prefix >= 0 && prefix <= 32
        ? `${((0xffffffff << (32 - prefix)) >>> 24) & 0xff}.${((0xffffffff << (32 - prefix)) >>> 16) & 0xff}.${((0xffffffff << (32 - prefix)) >>> 8) & 0xff}.${(0xffffffff << (32 - prefix)) >>> 0 & 0xff}`
        : '255.255.255.0';
      return callback(null, { ip, mask });
    });
  }
}

function getScanIpRange(localIp, mask) {
  const parts = localIp.split('.').map(n => parseInt(n, 10));
  if (parts.length !== 4 || parts.some(Number.isNaN)) {
    return [];
  }
  if (mask === '255.255.255.0') {
    return Array.from({ length: 254 }, (_, index) => `${parts[0]}.${parts[1]}.${parts[2]}.${index + 1}`);
  }
  return Array.from({ length: 254 }, (_, index) => `${parts[0]}.${parts[1]}.${parts[2]}.${index + 1}`);
}

function pingHost(ip) {
  return new Promise(resolve => {
    const command = process.platform === 'win32'
      ? `ping -n 1 -w 300 ${ip}`
      : `ping -c 1 -W 1 ${ip}`;
    exec(command, { windowsHide: true, timeout: 2000 }, err => resolve(!err));
  });
}

function filterAliveClients(clients, callback) {
  if (!clients || clients.length === 0) {
    return callback([]);
  }

  const alive = [];
  let completed = 0;

  clients.forEach(client => {
    pingHost(client.ip).then(isAlive => {
      if (isAlive) {
        alive.push(client);
      }
      completed += 1;
      if (completed === clients.length) {
        callback(alive);
      }
    }).catch(() => {
      completed += 1;
      if (completed === clients.length) {
        callback(alive);
      }
    });
  });
}

function scanLocalNetwork(existingClients, callback) {
  getLocalNetworkInfo((err, info) => {
    if (err || !info || !info.ip) {
      return callback();
    }
    const knownIps = new Set(existingClients.map(client => client.ip));
    const targets = getScanIpRange(info.ip, info.mask)
      .filter(ip => ip !== info.ip && !knownIps.has(ip) && !ip.endsWith('.255'));
    if (targets.length === 0) {
      return callback();
    }
    const concurrency = 20;
    let active = 0;
    let index = 0;

    function next() {
      while (active < concurrency && index < targets.length) {
        const ip = targets[index++];
        active += 1;
        pingHost(ip).finally(() => {
          active -= 1;
          if (index >= targets.length && active === 0) {
            callback();
          } else {
            next();
          }
        });
      }
      if (index >= targets.length && active === 0) {
        callback();
      }
    }

    next();
  });
}

function parseRouterDhcpResponse(raw) {
  if (!raw) return [];
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch (e) {
      const lines = raw.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      const entries = [];
      lines.forEach(line => {
        const match = line.match(/(\d+\.\d+\.\d+\.\d+).*?([0-9a-fA-F:-]{17})/);
        if (match) {
          entries.push({ ip: match[1], mac: match[2], source: 'dhcp' });
        }
      });
      return entries;
    }
  }
  if (Array.isArray(raw)) {
    return raw.map(item => ({
      ip: item.ip || item.address || item.host || '',
      mac: item.mac || item.hwaddr || item.hardware || '',
      source: 'dhcp'
    })).filter(item => item.ip && item.mac);
  }
  if (typeof raw === 'object' && raw !== null) {
    const leaseList = raw.leases || raw.clients || raw.dhcp || raw.data;
    if (Array.isArray(leaseList)) {
      return leaseList.map(item => ({
        ip: item.ip || item.address || item.host || '',
        mac: item.mac || item.hwaddr || item.hardware || '',
        source: 'dhcp'
      })).filter(item => item.ip && item.mac);
    }
  }
  return [];
}

function getRouterDhcpClients(callback) {
  if (!dhcpRouterHost) {
    return callback(null, null);
  }
  const client = dhcpRouterProto === 'https' ? https : http;
  const requestOptions = {
    hostname: dhcpRouterHost,
    port: dhcpRouterPort || (dhcpRouterProto === 'https' ? 443 : 80),
    path: dhcpRouterPath,
    method: 'GET',
    timeout: 10000,
    headers: {
      'Accept': 'application/json,text/plain,*/*'
    }
  };
  if (dhcpRouterUser && dhcpRouterPass) {
    const auth = Buffer.from(`${dhcpRouterUser}:${dhcpRouterPass}`).toString('base64');
    requestOptions.headers.Authorization = `Basic ${auth}`;
  }
  const req = client.request(requestOptions, res => {
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => {
      if (res.statusCode >= 400) {
        return callback(new Error(`DHCP router request failed: ${res.statusCode}`));
      }
      const clients = parseRouterDhcpResponse(data);
      return callback(null, clients);
    });
  });
  req.on('error', err => callback(err));
  req.on('timeout', () => {
    req.destroy();
    callback(new Error('DHCP router request timed out')); 
  });
  req.end();
}

function getWifiStatus(callback) {
  if (process.platform === 'win32') {
    exec('netsh wlan show interfaces', { windowsHide: true }, (err, stdout) => {
      if (err) {
        return callback(new Error('Unable to query Wi-Fi interface.'));
      }
      const wifi = parseWindowsWifiOutput(stdout);
      if (!wifi.state || wifi.state.toLowerCase() !== 'connected') {
        return callback(null, { connected: false, state: wifi.state || 'Disconnected' });
      }
      return callback(null, {
        connected: true,
        ssid: wifi.ssid || 'Unknown',
        bssid: wifi.bssid || '',
        state: wifi.state,
        signal: wifi.signal || '',
        radioType: wifi.radioType || '',
        channel: wifi.channel || '',
        receiveRate: wifi.receiveRate || '',
        transmitRate: wifi.transmitRate || ''
      });
    });
  } else {
    exec('nmcli -t -f ACTIVE,SSID,SIGNAL,CHAN,RATE dev wifi', { timeout: 5000 }, (err, stdout) => {
      if (err || !stdout) {
        return callback(new Error('Unable to query Wi-Fi interface.'));
      }
      const wifi = parseLinuxWifiOutput(stdout);
      return callback(null, {
        connected: true,
        ssid: wifi.ssid || 'Unknown',
        bssid: '',
        state: wifi.state,
        signal: wifi.signal || '',
        radioType: '',
        channel: wifi.channel || '',
        receiveRate: wifi.receiveRate || '',
        transmitRate: wifi.transmitRate || ''
      });
    });
  }
}

function getConnectedClients(callback) {
  const parseArp = stdout => {
    const clients = [];
    const isSkipEntry = (ip, mac) => {
      if (!ip || !mac) return true;
      const normalizedMac = mac.toLowerCase();
      if (normalizedMac === 'ff-ff-ff-ff-ff-ff' || normalizedMac === 'ff:ff:ff:ff:ff:ff') {
        return true;
      }
      if (normalizedMac.startsWith('01-00-5e') || normalizedMac.startsWith('01:00:5e')) {
        return true;
      }
      if (ip === '255.255.255.255') return true;
      if (ip.startsWith('224.') || ip.startsWith('239.')) return true;
      if (ip.endsWith('.255')) return true;
      return false;
    };

    stdout.split(/\r?\n/).forEach(rawLine => {
      const line = rawLine.trim();
      const winMatch = line.match(/^(\d+\.\d+\.\d+\.\d+)\s+([0-9a-fA-F:-]{17})\s+\w+/);
      const linuxMatch = line.match(/^\(?(\d+\.\d+\.\d+\.\d+)\)?\s+.*\s+at\s+([0-9a-fA-F:]{17})/);
      const ipmatch = line.match(/^(\d+\.\d+\.\d+\.\d+)/);
      if (winMatch) {
        const ip = winMatch[1];
        const mac = winMatch[2];
        if (!isSkipEntry(ip, mac)) {
          clients.push({ ip, mac, source: 'arp' });
        }
      } else if (linuxMatch) {
        const ip = linuxMatch[1];
        const mac = linuxMatch[2];
        if (!isSkipEntry(ip, mac)) {
          clients.push({ ip, mac, source: 'arp' });
        }
      } else if (ipmatch && line.includes('lladdr')) {
        const ip = ipmatch[1];
        const macMatch = line.match(/lladdr\s+([0-9a-fA-F:]{17})/);
        if (macMatch) {
          const mac = macMatch[1];
          if (!isSkipEntry(ip, mac)) {
            clients.push({ ip, mac, source: 'ip neigh' });
          }
        }
      }
    });
    return clients;
  };

  const refreshArp = (done) => {
    const onResult = (err, stdout) => {
      if (err || !stdout) {
        return done(null, []);
      }
      return done(null, parseArp(stdout));
    };

    if (process.platform === 'win32') {
      exec('arp -a', { windowsHide: true, timeout: 10000 }, onResult);
    } else {
      exec('arp -a', { timeout: 10000 }, (err, stdout) => {
        if (err || !stdout) {
          exec('ip neigh', { timeout: 5000 }, onResult);
        } else {
          onResult(null, stdout);
        }
      });
    }
  };

  const getFromDhcp = (done) => {
    getRouterDhcpClients((error, dhcpClients) => {
      if (error || !Array.isArray(dhcpClients) || dhcpClients.length === 0) {
        return done(null);
      }
      return done(dhcpClients);
    });
  };

  getFromDhcp((dhcpClients) => {
    if (dhcpClients && dhcpClients.length > 0) {
      return callback(null, dhcpClients);
    }

    const onResult = (err, stdout) => {
      if (err || !stdout) {
        return callback(null, []);
      }
      const currentClients = parseArp(stdout);
      filterAliveClients(currentClients, aliveClients => {
        if (aliveClients.length > 0) {
          return callback(null, aliveClients);
        }

        scanLocalNetwork(currentClients, () => {
          refreshArp(callback);
        });
      });
    };

    if (process.platform === 'win32') {
      exec('arp -a', { windowsHide: true, timeout: 10000 }, onResult);
    } else {
      exec('arp -a', { timeout: 10000 }, (err, stdout) => {
        if (err || !stdout) {
          exec('ip neigh', { timeout: 5000 }, onResult);
        } else {
          onResult(null, stdout);
        }
      });
    }
  });

  if (process.platform === 'win32') {
    exec('arp -a', { windowsHide: true, timeout: 10000 }, onResult);
  } else {
    exec('arp -a', { timeout: 10000 }, (err, stdout) => {
      if (err || !stdout) {
        exec('ip neigh', { timeout: 5000 }, onResult);
      } else {
        onResult(null, stdout);
      }
    });
  }
}

// Start HTTP server
const httpServer = http.createServer(handler);
httpServer.listen(port, () => {
  console.log(`HTTP server listening on port ${port}`);
});

// Try to enable HTTPS if cert files are present. Looks for common filenames used by mkcert or manual certs.
const certPairs = [
  ['localhost+2.pem', 'localhost+2-key.pem'],
  ['localhost.pem', 'localhost-key.pem'],
  ['cert.pem', 'key.pem']
];

for (const [certFile, keyFile] of certPairs) {
  const certPath = path.join(root, certFile);
  const keyPath = path.join(root, keyFile);
  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    try {
      const options = {
        cert: fs.readFileSync(certPath),
        key: fs.readFileSync(keyPath),
      };
      const httpsPort = process.env.HTTPS_PORT || 8443;
      https.createServer(options, handler).listen(httpsPort, () => {
        console.log(`HTTPS server listening on port ${httpsPort} using ${certFile} + ${keyFile}`);
      });
      break;
    } catch (e) {
      console.error('Failed to start HTTPS server:', e.message);
    }
  }
}
