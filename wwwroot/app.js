let state = { servers: [], workloads: [] };
const LAST_CHECK_STORAGE_KEY = 'networkPlanner:lastChecks';
let sortState = { column: 'name', ascending: true };

const VM_ID_RANGES = [
  { start: 100, end: 199, label: 'Infrastructure', subnet: '10.64.10.0/24', gateway: '10.64.10.1' },
  { start: 200, end: 299, label: 'Netværksservices', subnet: '10.64.20.0/24', gateway: '10.64.20.1' },
  { start: 300, end: 399, label: 'Applikationer', subnet: '10.64.30.0/24', gateway: '10.64.30.1' },
  { start: 400, end: 499, label: 'Databaser', subnet: '10.64.40.0/24', gateway: '10.64.40.1' },
  { start: 500, end: 599, label: 'AI Services', subnet: '10.64.50.0/24', gateway: '10.64.50.1' },
  { start: 700, end: 799, label: 'LXC / Utility', subnet: '10.64.70.0/24', gateway: '10.64.70.1' },
  { start: 900, end: 999, label: 'Test / Lab', subnet: '10.64.90.0/24', gateway: '10.64.90.1' }
];

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  if (!response.ok) {
    let message = 'Ukendt fejl';
    try {
      const data = await response.json();
      message = data.message || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  if (response.status === 204) return null;
  return response.json();
}

async function loadData() {
  state = await api('/api/overview');
  renderVmIdGrid();
  renderServers();
  renderWorkloads();
}

function renderVmIdGrid() {
  const grid = document.getElementById('vmidGrid');
  grid.innerHTML = VM_ID_RANGES.map(range => {
    const nextId = getNextVmId(range.start, range.end);
    const nextIp = getNextIp(range.subnet);
    return `<div>
      <strong>${range.start}-${range.end}</strong>
      <span>${range.label}</span><br/>
      <small>ID: ${nextId}, IP: ${nextIp}</small>
    </div>`;
  }).join('');
}

function getNextVmId(start, end) {
  const used = new Set(state.workloads.filter(x => x.vmId != null).map(x => x.vmId));
  for (let i = start; i <= end; i++) {
    if (!used.has(i)) return i;
  }
  return 'Fuldt';
}

function getNextIp(subnet) {
  // Parse subnet (e.g., "10.64.20.0/24") to get base IP
  const baseIp = subnet.split('/')[0];
  const parts = baseIp.split('.');
  const baseOctet = parts[3];
  const prefix = parts.slice(0, 3).join('.');
  
  // Find all used IPs in this subnet
  const usedIps = new Set(state.workloads
    .filter(w => w.ipAddress && w.ipAddress.startsWith(prefix))
    .map(w => {
      const lastOctet = w.ipAddress.split('.')[3];
      return parseInt(lastOctet);
    }));
  
  // Start from 30 (skip gateway and first few addresses)
  for (let i = 30; i <= 254; i++) {
    if (!usedIps.has(i)) return `${prefix}.${i}`;
  }
  return 'Fuldt';
}

function renderServers() {
  const tbody = document.getElementById('serverTable');
  if (state.servers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--muted); padding: 2rem; font-style: italic;">Ingen servere registreret endnu</td></tr>';
    return;
  }
  tbody.innerHTML = state.servers.map(s => `
    <tr>
      <td>${escapeHtml(s.name)}</td>
      <td>${escapeHtml(s.role)}</td>
      <td>${escapeHtml(s.location || '')}</td>
      <td>${escapeHtml(s.serverNetworkIp || '')}</td>
      <td>${escapeHtml(s.iloIp || '')}</td>
      <td class="row-actions">
        <button class="icon-btn" onclick='editServer(${JSON.stringify(s).replace(/'/g, "&#39;")})' data-bs-toggle="tooltip" title="Redigér"><i class="bi bi-pencil-fill"></i></button>
        <button class="icon-btn danger" onclick='deleteServer(${s.id})' data-bs-toggle="tooltip" title="Slet"><i class="bi bi-trash"></i></button>
        ${renderLastCheckButton('server', s.id)}
      </td>
    </tr>`).join('');
}

function renderWorkloads() {
  const filter = document.getElementById('searchInput').value.toLowerCase().trim();
  let filtered = state.workloads.filter(w => {
    const haystack = [w.name, w.category, w.hostServer, w.ipAddress, w.operatingSystem].join(' ').toLowerCase();
    return haystack.includes(filter);
  });

  // Sort the workloads
  filtered = sortWorkloads(filtered);

  const tbody = document.getElementById('workloadTable');
  if (filtered.length === 0) {
    const message = state.workloads.length === 0 ? 'Ingen workloads registreret endnu' : 'Ingen workloads matcher søgningen';
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--muted); padding: 2rem; font-style: italic;">${message}</td></tr>`;
    updateSortIndicators();
    return;
  }
  tbody.innerHTML = filtered.map(w => `
    <tr>
      <td>${escapeHtml(w.name)}</td>
      <td>${escapeHtml(w.category)}</td>
      <td>${escapeHtml(w.hostServer || '')}</td>
      <td>${w.vmId ?? ''}</td>
      <td>${escapeHtml(w.ipAddress || '')}</td>
      <td>${escapeHtml(w.operatingSystem || '')}</td>
      <td class="row-actions">
        <button class="icon-btn" onclick='editWorkload(${JSON.stringify(w).replace(/'/g, "&#39;")})' data-bs-toggle="tooltip" title="Redigér"><i class="bi bi-pencil-fill"></i></button>
        <button class="icon-btn danger" onclick='deleteWorkload(${w.id})' data-bs-toggle="tooltip" title="Slet"><i class="bi bi-trash"></i></button>
        <button class="icon-btn" onclick='copyWorkloadNotes(${JSON.stringify(w).replace(/'/g, "&#39;")})' data-bs-toggle="tooltip" title="Notes"><i class="bi bi-sticky"></i></button>
        ${renderLastCheckButton('workload', w.id)}
      </td>
    </tr>`).join('');
  updateSortIndicators();
}

function renderLastCheckButton(entityType, id) {
  const lastCheckAt = getLastCheck(entityType, id);
  const stale = isOlderThanSixMonths(lastCheckAt);
  const statusClass = stale ? 'stale' : 'fresh';
  const title = stale ? 'Last check (mangler) - Sidst: ' + (lastCheckAt ? formatDate(lastCheckAt) : 'Aldrig') : 'Last check (ok) - Sidst: ' + (lastCheckAt ? formatDate(lastCheckAt) : 'Aldrig');

  return `<button class="icon-btn last-check-${statusClass}" data-bs-toggle="tooltip" title="${escapeHtml(title)}" onclick='markLastCheck("${entityType}", ${id})'><i class="bi bi-clock-history"></i></button>`;
}

function getLastCheck(entityType, id) {
  const all = readLastChecks();
  return all?.[entityType]?.[id] ?? null;
}

function readLastChecks() {
  try {
    return JSON.parse(localStorage.getItem(LAST_CHECK_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeLastChecks(value) {
  localStorage.setItem(LAST_CHECK_STORAGE_KEY, JSON.stringify(value));
}

function isOlderThanSixMonths(isoValue) {
  if (!isoValue) return true;
  const checkedAt = new Date(isoValue);
  if (Number.isNaN(checkedAt.getTime())) return true;

  const now = new Date();
  // Properly calculate 6 months ago by subtracting 6 months
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
  
  return checkedAt.getTime() < sixMonthsAgo.getTime();
}

function formatDate(isoValue) {
  const value = new Date(isoValue);
  if (Number.isNaN(value.getTime())) return 'Ukendt dato';
  return value.toLocaleDateString('da-DK');
}

function markLastCheck(entityType, id) {
  const all = readLastChecks();
  all[entityType] = all[entityType] || {};
  all[entityType][id] = new Date().toISOString();
  writeLastChecks(all);

  renderServers();
  renderWorkloads();
  toast('Last check opdateret');
}

function editServer(s) {
  document.getElementById('serverIdDb').value = s.id;
  document.getElementById('serverName').value = s.name;
  document.getElementById('serverRole').value = s.role;
  document.getElementById('serverLocation').value = s.location || '';
  document.getElementById('serverNetworkIp').value = s.serverNetworkIp || '';
  document.getElementById('serverIloIp').value = s.iloIp || '';
  document.getElementById('serverNotes').value = s.notes || '';
  updateServerFormMode();
}

function clearServerForm() {
  document.getElementById('serverForm').reset();
  document.getElementById('serverIdDb').value = '';
  updateServerFormMode();
}

function updateServerFormMode() {
  const id = document.getElementById('serverIdDb').value;
  const submitBtn = document.querySelector('#serverForm button[type="submit"]');
  const formTitle = document.querySelector('#serverFormTitle');
  
  if (id) {
    submitBtn.innerHTML = '<i class="bi bi-floppy-fill"></i> Opdater';
    submitBtn.setAttribute('title', 'Opdater server');
    if (formTitle) formTitle.textContent = 'Redigér server';
  } else {
    submitBtn.innerHTML = '<i class="bi bi-floppy-fill"></i> Gem ny';
    submitBtn.setAttribute('title', 'Gem ny server');
    if (formTitle) formTitle.textContent = 'Opret ny server';
  }
}

function editWorkload(w) {
  document.getElementById('workloadIdDb').value = w.id;
  document.getElementById('workloadName').value = w.name;
  document.getElementById('workloadCategory').value = w.category;
  document.getElementById('workloadHostServer').value = w.hostServer || '';
  document.getElementById('workloadVmId').value = w.vmId || '';
  document.getElementById('workloadIpAddress').value = w.ipAddress || '';
  document.getElementById('workloadOs').value = w.operatingSystem || '';
  document.getElementById('workloadDescription').value = w.description || '';
  updateWorkloadFormMode();
}

function clearWorkloadForm() {
  document.getElementById('workloadForm').reset();
  document.getElementById('workloadIdDb').value = '';
  updateWorkloadFormMode();
}

function updateWorkloadFormMode() {
  const id = document.getElementById('workloadIdDb').value;
  const submitBtn = document.querySelector('#workloadForm button[type="submit"]');
  const formTitle = document.querySelector('#workloadFormTitle');
  
  if (id) {
    submitBtn.innerHTML = '<i class="bi bi-floppy-fill"></i> Opdater';
    submitBtn.setAttribute('title', 'Opdater workload');
    if (formTitle) formTitle.textContent = 'Redigér workload';
  } else {
    submitBtn.innerHTML = '<i class="bi bi-floppy-fill"></i> Gem ny';
    submitBtn.setAttribute('title', 'Gem ny workload');
    if (formTitle) formTitle.textContent = 'Opret ny workload';
  }
}

async function deleteServer(id) {
  if (!confirm('Slet server?')) return;
  await api(`/api/servers/${id}`, { method: 'DELETE' });
  toast('Server slettet');
  await loadData();
}

function copyWorkloadNotes(workload) {
  const notes = `
Workload Notes for Proxmox
==========================

Navn: ${workload.name}
Kategori: ${workload.category}
Host Server: ${workload.hostServer || 'N/A'}
VM ID: ${workload.vmId || 'N/A'}
IP Adresse: ${workload.ipAddress || 'N/A'}
Operativsystem: ${workload.operatingSystem || 'N/A'}
Beskrivelse: ${workload.description || 'N/A'}

Oprettet i Network Planner
`.trim();

  // Try modern clipboard API first (works on localhost and HTTPS)
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(notes).then(() => {
      toast('Notes kopieret til clipboard!');
    }).catch(err => {
      // Fallback if clipboard API fails
      fallbackCopyTextToClipboard(notes);
    });
  } else {
    // Fallback for insecure contexts (HTTP)
    fallbackCopyTextToClipboard(notes);
  }
}

function fallbackCopyTextToClipboard(text) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.top = '0';
  textArea.style.left = '0';
  textArea.style.width = '2em';
  textArea.style.height = '2em';
  textArea.style.padding = '0';
  textArea.style.border = 'none';
  textArea.style.outline = 'none';
  textArea.style.boxShadow = 'none';
  textArea.style.background = 'transparent';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    const successful = document.execCommand('copy');
    if (successful) {
      toast('Notes kopieret til clipboard!');
    } else {
      showNotesDialog(text);
    }
  } catch (err) {
    showNotesDialog(text);
  }

  document.body.removeChild(textArea);
}

function showNotesDialog(text) {
  const message = 'Kunne ikke kopiere automatisk. Kopier teksten nedenfor:\n\n' + text;
  alert(message);
}

async function deleteWorkload(id) {
  if (!confirm('Slet workload?')) return;
  await api(`/api/workloads/${id}`, { method: 'DELETE' });
  toast('Workload slettet');
  await loadData();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 2500);
}

function sortWorkloads(workloads) {
  return [...workloads].sort((a, b) => {
    let aVal = a[sortState.column];
    let bVal = b[sortState.column];

    // Handle null/undefined values
    if (aVal == null) aVal = '';
    if (bVal == null) bVal = '';

    // Handle numeric sorting for vmId
    if (sortState.column === 'vmId') {
      aVal = aVal === '' ? Infinity : Number(aVal);
      bVal = bVal === '' ? Infinity : Number(bVal);
    } else {
      // String comparison (case insensitive)
      aVal = String(aVal).toLowerCase();
      bVal = String(bVal).toLowerCase();
    }

    if (aVal < bVal) return sortState.ascending ? -1 : 1;
    if (aVal > bVal) return sortState.ascending ? 1 : -1;
    return 0;
  });
}

function updateSortIndicators() {
  document.querySelectorAll('#workloadTable th.sortable').forEach(th => {
    const indicator = th.querySelector('.sort-indicator');
    if (th.dataset.sort === sortState.column) {
      indicator.textContent = sortState.ascending ? ' ▲' : ' ▼';
    } else {
      indicator.textContent = '';
    }
  });
}

function setupSortListeners() {
  document.querySelectorAll('#workloadTable th.sortable').forEach(th => {
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => {
      const column = th.dataset.sort;
      if (sortState.column === column) {
        sortState.ascending = !sortState.ascending;
      } else {
        sortState.column = column;
        sortState.ascending = true;
      }
      renderWorkloads();
      updateSortIndicators();
    });
  });
}

document.getElementById('refreshBtn').addEventListener('click', () => loadData());
document.getElementById('refreshBtn').innerHTML = '<i class="bi bi-arrow-clockwise"></i>';
document.getElementById('refreshBtn').setAttribute('data-bs-toggle', 'tooltip');
document.getElementById('refreshBtn').setAttribute('title', 'Opdater');
document.getElementById('searchInput').addEventListener('input', renderWorkloads);

document.getElementById('serverForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('serverIdDb').value;
  const payload = {
    id: id ? Number(id) : 0,
    name: document.getElementById('serverName').value,
    role: document.getElementById('serverRole').value,
    location: document.getElementById('serverLocation').value || null,
    managementIp: document.getElementById('serverNetworkIp').value || 'N/A',
    serverNetworkIp: document.getElementById('serverNetworkIp').value || null,
    iloIp: document.getElementById('serverIloIp').value || null,
    notes: document.getElementById('serverNotes').value || null
  };

  try {
    await api(id ? `/api/servers/${id}` : '/api/servers', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload)
    });
    clearServerForm();
    toast('Server gemt');
    await loadData();
  } catch (error) {
    toast(error.message);
  }
});

document.getElementById('workloadForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('workloadIdDb').value;
  const vmId = document.getElementById('workloadVmId').value;
  const ipAddress = document.getElementById('workloadIpAddress').value || null;
  
  // Check for duplicate IP
  if (ipAddress) {
    const isDuplicate = state.workloads.some(w => w.id !== Number(id || 0) && w.ipAddress === ipAddress);
    if (isDuplicate) {
      toast('Fejl: IP-adressen bruges allerede af en anden workload!');
      return;
    }
  }
  
  const payload = {
    id: id ? Number(id) : 0,
    name: document.getElementById('workloadName').value,
    category: document.getElementById('workloadCategory').value,
    hostServer: document.getElementById('workloadHostServer').value || null,
    vmId: vmId ? Number(vmId) : null,
    ipAddress: ipAddress,
    operatingSystem: document.getElementById('workloadOs').value || null,
    description: document.getElementById('workloadDescription').value || null
  };

  try {
    await api(id ? `/api/workloads/${id}` : '/api/workloads', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload)
    });
    clearWorkloadForm();
    toast('Workload gemt');
    await loadData();
  } catch (error) {
    toast(error.message);
  }
});

loadData().catch(error => toast(error.message));
setupSortListeners();
updateWorkloadFormMode(); // Initialize form mode on page load
updateServerFormMode(); // Initialize server form mode on page load

// Auto-fill VM ID and IP when category is selected
document.getElementById('workloadCategory').addEventListener('change', function() {
  const category = this.value;
  if (!category) return;
  
  const range = VM_ID_RANGES.find(r => r.label === category);
  if (!range) return;
  
  const nextVmId = getNextVmId(range.start, range.end);
  const nextIp = getNextIp(range.subnet);
  
  if (nextVmId !== 'Fuldt') {
    document.getElementById('workloadVmId').value = nextVmId;
  }
  if (nextIp !== 'Fuldt') {
    document.getElementById('workloadIpAddress').value = nextIp;
  }
});

// Initialize Bootstrap tooltips
const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
const tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
  return new bootstrap.Tooltip(tooltipTriggerEl);
});
