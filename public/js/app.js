// BlackRoad Domain Registry - Control Panel JavaScript

const API_BASE = 'http://lucidia:8090/api';
const DEPLOY_API = 'http://alice:9001/api';
const REFRESH_INTERVAL = 30000; // 30 seconds

let currentTab = 'domains';
let refreshTimer = null;

// --- Utility ---

function escapeHtml(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(String(str)));
    return div.innerHTML;
}

function showNotification(message, type) {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.className = `notification notification-${type || 'info'}`;
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
}

// --- Tab Navigation ---

document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        currentTab = tabName;

        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');

        loadTabData(tabName);
    });
});

function loadTabData(tabName) {
    switch (tabName) {
        case 'domains':
            loadDomains();
            break;
        case 'dns':
            loadDNSRecords();
            break;
        case 'deployments':
            loadDeployments();
            break;
        case 'ssl':
            loadSSLStatus();
            break;
        case 'analytics':
            loadAnalytics();
            break;
    }
}

// --- Domains ---

async function loadDomains() {
    const grid = document.getElementById('domains-grid');

    try {
        const response = await fetch(`${API_BASE}/domains`);
        const data = await response.json();

        if (data.success && data.domains && data.domains.length > 0) {
            grid.innerHTML = data.domains.map(domain => {
                const name = escapeHtml(domain.domain);
                const registrar = escapeHtml(domain.registrar || 'N/A');
                const status = escapeHtml(domain.status);
                const ns = (domain.nameservers || []).map(escapeHtml).join(', ');
                return `
                    <div class="domain-card">
                        <div class="domain-name">${name}</div>
                        <div class="domain-info">Registrar: ${registrar}</div>
                        <div class="domain-info">Status: ${status}</div>
                        <div class="domain-info">Nameservers: ${ns}</div>
                        <div class="domain-actions">
                            <button class="btn-primary btn-small" onclick="viewDomain('${name}')">View</button>
                            <button class="btn-secondary btn-small" onclick="editDNS('${name}')">DNS</button>
                            <button class="btn-secondary btn-small" onclick="deployDomain('${name}')">Deploy</button>
                        </div>
                    </div>
                `;
            }).join('');

            document.getElementById('domain-count').textContent = data.domains.length;
        } else {
            grid.innerHTML = '<div class="loading">No domains found. Add your first domain!</div>';
            document.getElementById('domain-count').textContent = '0';
        }
    } catch (error) {
        console.error('Error loading domains:', error);
        grid.innerHTML = '<div class="loading">Unable to connect to API. Check that road-registry-api is running on lucidia:8090.</div>';
    }
}

function viewDomain(domain) {
    // Switch to DNS tab filtered by this domain
    currentTab = 'dns';
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector('[data-tab="dns"]').classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById('dns-tab').classList.add('active');
    loadDNSRecordsForDomain(domain);
}

function editDNS(domain) {
    viewDomain(domain);
}

function deployDomain(domain) {
    showDeployModal(domain);
}

// --- DNS Records ---

async function loadDNSRecords() {
    const list = document.getElementById('records-list');

    try {
        const response = await fetch(`${API_BASE}/domains`);
        const data = await response.json();

        if (data.success && data.domains && data.domains.length > 0) {
            let allRecords = [];

            for (const domain of data.domains) {
                try {
                    const recordsResponse = await fetch(`${API_BASE}/domains/${encodeURIComponent(domain.domain)}/records`);
                    const recordsData = await recordsResponse.json();

                    if (recordsData.success && recordsData.records) {
                        allRecords = allRecords.concat(recordsData.records.map(r => ({
                            ...r,
                            domain: domain.domain
                        })));
                    }
                } catch (e) {
                    console.warn(`Failed to load records for ${domain.domain}:`, e);
                }
            }

            renderRecords(list, allRecords);
        } else {
            list.innerHTML = '<div class="loading">No domains found. Add a domain first.</div>';
        }
    } catch (error) {
        console.error('Error loading DNS records:', error);
        list.innerHTML = '<div class="loading">Unable to connect to API.</div>';
    }
}

async function loadDNSRecordsForDomain(domain) {
    const list = document.getElementById('records-list');
    list.innerHTML = '<div class="loading">Loading records...</div>';

    try {
        const response = await fetch(`${API_BASE}/domains/${encodeURIComponent(domain)}/records`);
        const data = await response.json();

        if (data.success && data.records) {
            const records = data.records.map(r => ({ ...r, domain }));
            renderRecords(list, records);
        } else {
            list.innerHTML = '<div class="loading">No records found for this domain.</div>';
        }
    } catch (error) {
        console.error('Error loading DNS records:', error);
        list.innerHTML = '<div class="loading">Unable to load records.</div>';
    }
}

function renderRecords(container, records) {
    if (records.length > 0) {
        container.innerHTML = `
            <div class="record-item record-header">
                <div>Type</div>
                <div>Name</div>
                <div>Value</div>
                <div>TTL</div>
                <div></div>
            </div>
        ` + records.map(record => `
            <div class="record-item">
                <div class="record-type">${escapeHtml(record.record_type)}</div>
                <div class="record-name">${escapeHtml(record.name)}</div>
                <div class="record-value">${escapeHtml(record.value)}</div>
                <div>${escapeHtml(record.ttl)}s</div>
                <button class="btn-secondary btn-small" onclick="deleteRecord('${escapeHtml(record.id)}', '${escapeHtml(record.domain)}')">Delete</button>
            </div>
        `).join('');

        document.getElementById('record-count').textContent = records.length;
    } else {
        container.innerHTML = '<div class="loading">No DNS records found.</div>';
        document.getElementById('record-count').textContent = '0';
    }
}

async function deleteRecord(recordId, domain) {
    if (!confirm(`Delete this DNS record?`)) return;

    try {
        const response = await fetch(`${API_BASE}/domains/${encodeURIComponent(domain)}/records/${encodeURIComponent(recordId)}`, {
            method: 'DELETE'
        });
        const data = await response.json();

        if (data.success) {
            showNotification('Record deleted', 'success');
            loadDNSRecords();
        } else {
            showNotification(`Error: ${data.error}`, 'error');
        }
    } catch (error) {
        showNotification(`Failed to delete record: ${error.message}`, 'error');
    }
}

// --- Deployments ---

async function loadDeployments() {
    const list = document.getElementById('deployments-list');

    try {
        const response = await fetch(`${API_BASE}/deployments`);
        const data = await response.json();

        if (data.success && data.deployments && data.deployments.length > 0) {
            list.innerHTML = data.deployments.map(deployment => {
                const statusClass = deployment.status === 'active' ? 'online' :
                                    deployment.status === 'failed' ? 'offline' : '';
                return `
                    <div class="record-item">
                        <div class="record-name">${escapeHtml(deployment.domain)}</div>
                        <div class="record-value">${escapeHtml(deployment.repo_url)}</div>
                        <div>${escapeHtml(deployment.branch)}</div>
                        <div class="pi-health ${statusClass}">${escapeHtml(deployment.status)}</div>
                        <div>${new Date(deployment.deployed_at).toLocaleDateString()}</div>
                    </div>
                `;
            }).join('');

            document.getElementById('deployment-count').textContent = data.deployments.length;
        } else {
            list.innerHTML = '<div class="loading">No deployments yet. Deploy your first site!</div>';
            document.getElementById('deployment-count').textContent = '0';
        }
    } catch (error) {
        console.error('Error loading deployments:', error);
        list.innerHTML = '<div class="loading">Unable to connect to API.</div>';
    }
}

// --- SSL ---

async function loadSSLStatus() {
    const list = document.getElementById('ssl-list');

    try {
        const response = await fetch(`${API_BASE}/domains`);
        const data = await response.json();

        if (data.success && data.domains && data.domains.length > 0) {
            list.innerHTML = `
                <div class="info-box">
                    <p>SSL certificates are automatically generated via Let's Encrypt during deployment.</p>
                    <p>Certificates auto-renew 30 days before expiration.</p>
                </div>
                <div class="records-list" style="margin-top: 16px;">
                    ${data.domains.map(d => `
                        <div class="record-item" style="grid-template-columns: 1fr 150px 150px;">
                            <div class="record-name">${escapeHtml(d.domain)}</div>
                            <div class="pi-health ${d.ssl ? 'online' : 'offline'}">${d.ssl ? 'Active' : 'No cert'}</div>
                            <button class="btn-primary btn-small" onclick="generateSSLFor('${escapeHtml(d.domain)}')">Generate</button>
                        </div>
                    `).join('')}
                </div>
            `;
        }
    } catch (error) {
        // Keep default info box content on error
    }
}

function generateSSL() {
    showNotification('Select a domain from the list to generate a certificate', 'info');
}

async function generateSSLFor(domain) {
    showNotification(`Requesting SSL certificate for ${domain}...`, 'info');

    try {
        const response = await fetch(`${DEPLOY_API}/ssl`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain })
        });
        const data = await response.json();

        if (data.success) {
            showNotification(`SSL certificate generated for ${domain}`, 'success');
            loadSSLStatus();
        } else {
            showNotification(`Error: ${data.error}`, 'error');
        }
    } catch (error) {
        showNotification(`Failed to generate certificate: ${error.message}`, 'error');
    }
}

// --- Analytics ---

async function loadAnalytics() {
    // Analytics tab uses static HTML for now; try to ping nodes for live status
    const nodes = document.querySelectorAll('.pi-health');
    // Static display is fine - real health checks would need a backend endpoint
}

// --- Modal Functions ---

function showAddDomainModal() {
    document.getElementById('add-domain-modal').classList.add('active');
}

function showAddRecordModal() {
    document.getElementById('add-record-modal').classList.add('active');

    // Populate domain select
    const select = document.getElementById('record-domain-select');
    if (select) {
        fetch(`${API_BASE}/domains`)
            .then(r => r.json())
            .then(data => {
                if (data.success && data.domains) {
                    select.innerHTML = data.domains.map(d =>
                        `<option value="${escapeHtml(d.domain)}">${escapeHtml(d.domain)}</option>`
                    ).join('');
                }
            })
            .catch(() => {});
    }
}

function showDeployModal(prefillDomain) {
    document.getElementById('deploy-modal').classList.add('active');

    if (prefillDomain) {
        const input = document.querySelector('#deploy-form [name="domain"]');
        if (input) input.value = prefillDomain;
    }

    // Populate domain select
    const select = document.getElementById('deploy-domain-select');
    if (select) {
        fetch(`${API_BASE}/domains`)
            .then(r => r.json())
            .then(data => {
                if (data.success && data.domains) {
                    select.innerHTML = data.domains.map(d =>
                        `<option value="${escapeHtml(d.domain)}" ${d.domain === prefillDomain ? 'selected' : ''}>${escapeHtml(d.domain)}</option>`
                    ).join('');
                }
            })
            .catch(() => {});
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Close modals on backdrop click
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
    }
});

// Close modals on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
    }
});

// --- Form Submissions ---

// Add Domain
document.getElementById('add-domain-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    const domainData = {
        domain: formData.get('domain'),
        registrar: formData.get('registrar'),
        nameservers: formData.get('nameservers').split(',').map(ns => ns.trim()).filter(Boolean)
    };

    try {
        const response = await fetch(`${API_BASE}/domains`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(domainData)
        });
        const data = await response.json();

        if (data.success) {
            closeModal('add-domain-modal');
            e.target.reset();
            loadDomains();
            showNotification(`Domain ${domainData.domain} added successfully!`, 'success');
        } else {
            showNotification(`Error: ${data.error}`, 'error');
        }
    } catch (error) {
        showNotification(`Error adding domain: ${error.message}`, 'error');
    }
});

// Add DNS Record
document.getElementById('add-record-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    const domain = formData.get('domain');
    const recordData = {
        record_type: formData.get('record_type'),
        name: formData.get('name'),
        value: formData.get('value'),
        ttl: parseInt(formData.get('ttl') || '3600', 10)
    };

    try {
        const response = await fetch(`${API_BASE}/domains/${encodeURIComponent(domain)}/records`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(recordData)
        });
        const data = await response.json();

        if (data.success) {
            closeModal('add-record-modal');
            e.target.reset();
            loadDNSRecords();
            showNotification('DNS record added!', 'success');
        } else {
            showNotification(`Error: ${data.error}`, 'error');
        }
    } catch (error) {
        showNotification(`Error adding record: ${error.message}`, 'error');
    }
});

// Deploy
document.getElementById('deploy-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    const deployData = {
        domain: formData.get('domain'),
        repo_url: formData.get('repo_url'),
        branch: formData.get('branch') || 'main',
        build_command: formData.get('build_command') || ''
    };

    try {
        const response = await fetch(`${DEPLOY_API}/deploy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(deployData)
        });
        const data = await response.json();

        if (data.success) {
            closeModal('deploy-modal');
            e.target.reset();
            loadDeployments();
            showNotification(`Deployment triggered for ${deployData.domain}!`, 'success');
        } else {
            showNotification(`Error: ${data.error}`, 'error');
        }
    } catch (error) {
        showNotification(`Deployment failed: ${error.message}`, 'error');
    }
});

// --- Auto-refresh ---

function startAutoRefresh() {
    stopAutoRefresh();
    refreshTimer = setInterval(() => {
        loadTabData(currentTab);
    }, REFRESH_INTERVAL);
}

function stopAutoRefresh() {
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
    }
}

// Pause refresh when tab is hidden
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        stopAutoRefresh();
    } else {
        loadTabData(currentTab);
        startAutoRefresh();
    }
});

// --- Init ---

loadDomains();
startAutoRefresh();
