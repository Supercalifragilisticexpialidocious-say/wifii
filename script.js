const navItems = document.querySelectorAll('.nav-item');
const sections = document.querySelectorAll('.page-section');

function setActiveSection(sectionId) {
    sections.forEach(section => {
        section.classList.toggle('active', section.id === sectionId);
    });

    navItems.forEach(item => {
        item.classList.toggle('active', item.dataset.section === sectionId);
    });
}

function updateText(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

function parseSignalQuality(signal) {
    if (!signal) return 'Unknown';
    const value = parseInt(signal, 10);
    if (Number.isNaN(value)) return signal;
    if (value >= 85) return 'Excellent';
    if (value >= 65) return 'Good';
    if (value >= 45) return 'Fair';
    return 'Weak';
}

function formatClientsTable(clients) {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;

    if (!clients || clients.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3">No devices discovered yet.</td></tr>';
        return;
    }

    tbody.innerHTML = clients.map(client => {
        return `<tr><td>${client.ip}</td><td>${client.mac}</td><td>${client.source}</td></tr>`;
    }).join('');
}

async function fetchJson(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            return null;
        }
        return await response.json();
    } catch (error) {
        console.error('Fetch failed:', error);
        return null;
    }
}

async function loadWifiStatus() {
    const data = await fetchJson('/api/wifi');
    if (!data) {
        updateText('wifi-status', 'Unable to load Wi-Fi');
        updateText('ssid-value', 'N/A');
        updateText('signal-value', 'N/A');
        updateText('status-value', 'Error');
        updateText('channel-value', 'N/A');
        updateText('receive-rate-value', 'N/A');
        updateText('transmit-rate-value', 'N/A');
        updateText('radio-type-value', 'N/A');
        updateText('health-summary', 'Wi-Fi data unavailable.');
        return null;
    }

    if (!data.connected) {
        updateText('wifi-status', 'Disconnected');
        updateText('ssid-value', 'N/A');
        updateText('signal-value', 'N/A');
        updateText('status-value', data.state || 'Disconnected');
        updateText('channel-value', 'N/A');
        updateText('receive-rate-value', 'N/A');
        updateText('transmit-rate-value', 'N/A');
        updateText('radio-type-value', 'N/A');
        updateText('health-summary', 'Not connected to Wi-Fi.');
        updateText('summary-network', 'Disconnected');
        updateText('summary-signal', 'N/A');
        return data;
    }

    updateText('wifi-status', `${data.ssid} • ${data.state}`);
    updateText('ssid-value', data.ssid || 'Unknown');
    updateText('signal-value', data.signal || 'Unknown');
    updateText('status-value', data.state || 'Connected');
    updateText('channel-value', data.channel || 'N/A');
    updateText('receive-rate-value', data.receiveRate || 'N/A');
    updateText('transmit-rate-value', data.transmitRate || 'N/A');
    updateText('radio-type-value', data.radioType || 'N/A');

    const quality = parseSignalQuality(data.signal);
    updateText('health-summary', `Signal quality is ${quality}.`);
    updateText('summary-network', data.ssid || 'Unknown');
    updateText('summary-signal', data.signal || 'N/A');

    return data;
}

async function loadClients() {
    const data = await fetchJson('/api/clients');
    if (!data || !data.clients) {
        formatClientsTable([]);
        updateText('client-count-value', '0');
        updateText('summary-clients', '0');
        return [];
    }

    formatClientsTable(data.clients);
    updateText('client-count-value', String(data.clients.length));
    updateText('device-count-value', String(data.clients.length));
    updateText('summary-clients', String(data.clients.length));
    return data.clients;
}

function updateAnalytics(wifi, clients) {
    const time = new Date().toLocaleTimeString();
    updateText('last-refresh-value', time);

    const quality = wifi && wifi.signal ? parseSignalQuality(wifi.signal) : 'Unknown';
    updateText('signal-quality-value', quality);

    const details = [];
    if (wifi) {
        details.push(`SSID: ${wifi.ssid || 'Unknown'}`);
        details.push(`Channel: ${wifi.channel || 'N/A'}`);
        details.push(`Rate: ${wifi.receiveRate || 'N/A'} / ${wifi.transmitRate || 'N/A'}`);
        details.push(`State: ${wifi.state || 'Disconnected'}`);
    }
    if (clients) {
        details.push(`Detected ${clients.length} device(s) on the local network.`);
    }
    updateText('analytics-detail', details.join(' \n '));
    updateText('analytics-trend', `Latest signal quality: ${quality}.`);
}

async function refreshAll() {
    const wifi = await loadWifiStatus();
    const clients = await loadClients();
    updateAnalytics(wifi, clients);
}

navItems.forEach(item => {
    item.addEventListener('click', () => {
        setActiveSection(item.dataset.section);
    });
});

setActiveSection('dashboard');
refreshAll();
setInterval(refreshAll, 5000);
