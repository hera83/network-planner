let state = { vlans: [], servers: [], workloads: [] };
const LAST_CHECK_STORAGE_KEY = 'networkPlanner:lastChecks';

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
  renderStats();
  renderVlans();
  renderServers();
  renderWorkloads();
}

function renderStats() {
  const el = document.getElementById('stats');
  el.innerHTML = `
    <div class="stat"><span>VLANs</span><strong>${state.vlans.length}</strong></div>
    <div class="stat"><span>Servere</span><strong>${state.servers.length}</strong></div>
    <div class="stat"><span>Workloads</span><strong>${state.workloads.length}</strong></div>
    <div class="stat"><span>Næste ledige infra VM ID</span><strong>${nextVmId(100,199)}</strong></div>
  `;
}

function renderVlans() {
  const tbody = document.getElementById('vlanTable');
  tbody.innerHTML = state.vlans.map(v => `
    <tr>
      <td>${escapeHtml(v.name)}</td>
      <td>${v.vlanId}</td>
      <td>${escapeHtml(v.subnet)}</td>
      <td>${escapeHtml(v.gateway)}</td>
      <td>${escapeHtml(v.purpose)}</td>
      <td>${escapeHtml(v.dhcpRange || '')}</td>
      <td class="row-actions">
        <button class="secondary" onclick='editVlan(${JSON.stringify(v).replace(/'/g, "&#39;")})'>Redigér</button>
        <button class="danger" onclick='deleteVlan(${v.id})'>Slet</button>
        ${renderLastCheckButton('vlan', v.id)}
      </td>
    </tr>`).join('');
}

function renderServers() {
  const tbody = document.getElementById('serverTable');
  tbody.innerHTML = state.servers.map(s => `
    <tr>
      <td>${escapeHtml(s.name)}</td>
      <td>${escapeHtml(s.role)}</td>
      <td>${escapeHtml(s.location || '')}</td>
      <td>${escapeHtml(s.managementIp)}</td>
      <td>${escapeHtml(s.serverNetworkIp || '')}</td>
      <td>${escapeHtml(s.iloIp || '')}</td>
      <td class="row-actions">
        <button class="secondary" onclick='editServer(${JSON.stringify(s).replace(/'/g, "&#39;")})'>Redigér</button>
        <button class="danger" onclick='deleteServer(${s.id})'>Slet</button>
        ${renderLastCheckButton('server', s.id)}
      </td>
    </tr>`).join('');
}

function renderWorkloads() {
  const filter = document.getElementById('searchInput').value.toLowerCase().trim();
  const filtered = state.workloads.filter(w => {
    const haystack = [w.name, w.workloadType, w.category, w.hostServer, w.ipAddress, w.operatingSystem].join(' ').toLowerCase();
    return haystack.includes(filter);
  });

  const tbody = document.getElementById('workloadTable');
  tbody.innerHTML = filtered.map(w => `
    <tr>
      <td>${escapeHtml(w.name)}</td>
      <td>${escapeHtml(w.workloadType)}</td>
      <td>${escapeHtml(w.category)}</td>
      <td>${escapeHtml(w.hostServer || '')}</td>
      <td>${w.vmId ?? ''}</td>
      <td>${escapeHtml(w.ipAddress || '')}</td>
      <td>${w.vlan ?? ''}</td>
      <td>${escapeHtml(w.operatingSystem || '')}</td>
      <td class="row-actions">
        <button class="secondary" onclick='editWorkload(${JSON.stringify(w).replace(/'/g, "&#39;")})'>Redigér</button>
        <button class="danger" onclick='deleteWorkload(${w.id})'>Slet</button>
        ${renderLastCheckButton('workload', w.id)}
      </td>
    </tr>`).join('');
}

function renderLastCheckButton(entityType, id) {
  const lastCheckAt = getLastCheck(entityType, id);
  const stale = isOlderThanSixMonths(lastCheckAt);
  const statusClass = stale ? 'last-check-stale' : 'last-check-fresh';
  const label = stale ? 'Last check (mangler)' : 'Last check (ok)';
  const hint = lastCheckAt ? `Sidst checket: ${formatDate(lastCheckAt)}` : 'Ikke checket endnu';

  return `<button class="last-check ${statusClass}" title="${escapeHtml(hint)}" onclick='markLastCheck("${entityType}", ${id})'>${label}</button>`;
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

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  return checkedAt < sixMonthsAgo;
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

  renderVlans();
  renderServers();
  renderWorkloads();
  toast('Last check opdateret');
}

function editVlan(v) {
  document.getElementById('vlanIdDb').value = v.id;
  document.getElementById('vlanName').value = v.name;
  document.getElementById('vlanId').value = v.vlanId;
  document.getElementById('vlanSubnet').value = v.subnet;
  document.getElementById('vlanGateway').value = v.gateway;
  document.getElementById('vlanPurpose').value = v.purpose;
  document.getElementById('vlanDhcpRange').value = v.dhcpRange || '';
}

function clearVlanForm() {
  document.getElementById('vlanForm').reset();
  document.getElementById('vlanIdDb').value = '';
}

function editServer(s) {
  document.getElementById('serverIdDb').value = s.id;
  document.getElementById('serverName').value = s.name;
  document.getElementById('serverRole').value = s.role;
  document.getElementById('serverLocation').value = s.location || '';
  document.getElementById('serverManagementIp').value = s.managementIp;
  document.getElementById('serverNetworkIp').value = s.serverNetworkIp || '';
  document.getElementById('serverIloIp').value = s.iloIp || '';
  document.getElementById('serverNotes').value = s.notes || '';
}

function clearServerForm() {
  document.getElementById('serverForm').reset();
  document.getElementById('serverIdDb').value = '';
}

function editWorkload(w) {
  document.getElementById('workloadIdDb').value = w.id;
  document.getElementById('workloadName').value = w.name;
  document.getElementById('workloadType').value = w.workloadType;
  document.getElementById('workloadCategory').value = w.category;
  document.getElementById('workloadHostServer').value = w.hostServer || '';
  document.getElementById('workloadVmId').value = w.vmId || '';
  document.getElementById('workloadIpAddress').value = w.ipAddress || '';
  document.getElementById('workloadVlan').value = w.vlan || '';
  document.getElementById('workloadOs').value = w.operatingSystem || '';
  document.getElementById('workloadDescription').value = w.description || '';
}

function clearWorkloadForm() {
  document.getElementById('workloadForm').reset();
  document.getElementById('workloadIdDb').value = '';
}

async function deleteVlan(id) {
  if (!confirm('Slet VLAN?')) return;
  await api(`/api/vlans/${id}`, { method: 'DELETE' });
  toast('VLAN slettet');
  await loadData();
}

async function deleteServer(id) {
  if (!confirm('Slet server?')) return;
  await api(`/api/servers/${id}`, { method: 'DELETE' });
  toast('Server slettet');
  await loadData();
}

async function deleteWorkload(id) {
  if (!confirm('Slet workload?')) return;
  await api(`/api/workloads/${id}`, { method: 'DELETE' });
  toast('Workload slettet');
  await loadData();
}

function nextVmId(start, end) {
  const used = new Set(state.workloads.filter(x => x.vmId != null).map(x => x.vmId));
  for (let i = start; i <= end; i++) {
    if (!used.has(i)) return i;
  }
  return 'Fuldt';
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

document.getElementById('refreshBtn').addEventListener('click', () => loadData());
document.getElementById('searchInput').addEventListener('input', renderWorkloads);

document.getElementById('vlanForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('vlanIdDb').value;
  const payload = {
    id: id ? Number(id) : 0,
    name: document.getElementById('vlanName').value,
    vlanId: Number(document.getElementById('vlanId').value),
    subnet: document.getElementById('vlanSubnet').value,
    gateway: document.getElementById('vlanGateway').value,
    purpose: document.getElementById('vlanPurpose').value,
    dhcpRange: document.getElementById('vlanDhcpRange').value || null
  };

  try {
    await api(id ? `/api/vlans/${id}` : '/api/vlans', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload)
    });
    clearVlanForm();
    toast('VLAN gemt');
    await loadData();
  } catch (error) {
    toast(error.message);
  }
});

document.getElementById('serverForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('serverIdDb').value;
  const payload = {
    id: id ? Number(id) : 0,
    name: document.getElementById('serverName').value,
    role: document.getElementById('serverRole').value,
    location: document.getElementById('serverLocation').value || null,
    managementIp: document.getElementById('serverManagementIp').value,
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
  const vlan = document.getElementById('workloadVlan').value;
  const payload = {
    id: id ? Number(id) : 0,
    name: document.getElementById('workloadName').value,
    workloadType: document.getElementById('workloadType').value,
    category: document.getElementById('workloadCategory').value,
    hostServer: document.getElementById('workloadHostServer').value || null,
    vmId: vmId ? Number(vmId) : null,
    ipAddress: document.getElementById('workloadIpAddress').value || null,
    vlan: vlan ? Number(vlan) : null,
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
