// BotTelegramRosa Frontend - Batch Message System

const API_BASE = '/api';
let apiToken = localStorage.getItem('apiToken') || '';
let currentBatchId = null;
let _logsInterval = null;

document.addEventListener('DOMContentLoaded', function() {
    loadApiToken();
    const hasToken = apiToken && apiToken.length > 0;
    if (hasToken) {
        loadBatches();
        loadUsers();
        refreshSchedulerState();
    }
    setInterval(refreshSchedulerState, 60000);
});

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('d-none'));
    document.querySelectorAll('.navbar-nav .nav-link').forEach(link => link.classList.remove('active'));
    document.getElementById(tabId).classList.remove('d-none');
    document.querySelector(`a[href="#${tabId}"]`).classList.add('active');
    if (tabId === 'lotes-tab') loadBatches();
    else if (tabId === 'links-tab') loadStripLinks();
    else if (tabId === 'usuarios-tab') loadUsers();
    else if (tabId === 'scheduler-tab') refreshSchedulerState();
    else if (tabId === 'logs-tab') { loadLogs(); _startLogsAutoRefresh(); }
    else if (tabId === 'vip-tab') loadVipConfig();
    if (tabId !== 'logs-tab') _stopLogsAutoRefresh();
}

function showAlert(message, type = 'info') {
    const alertArea = document.getElementById('alertArea');
    const alertId = 'alert-' + Date.now();
    alertArea.insertAdjacentHTML('beforeend', `<div id="${alertId}" class="alert alert-${type} alert-dismissible fade show" role="alert">
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>`);
    setTimeout(() => { const el = document.getElementById(alertId); if (el) el.remove(); }, 5000);
}

function openCreateBatchModal() {
    document.getElementById('batchForm').reset();
    document.getElementById('batchModalTitle').textContent = 'Crear Nuevo Lote';
    const batchIdInput = document.getElementById('batchId');
    if (batchIdInput) batchIdInput.remove();
    new bootstrap.Modal(document.getElementById('createBatchModal')).show();
}

async function loadBatches() {
    try {
        const response = await fetch(`${API_BASE}/batches`, { headers: { 'X-API-Token': apiToken } });
        if (!response.ok) throw new Error('Failed to load batches');
        const data = await response.json();
        const batches = data.batches || [];
        let html = '';
        if (batches.length === 0) {
            html = '<div class="alert alert-info">No hay lotes. Crea uno para empezar.</div>';
        } else {
            batches.forEach(batch => {
                const statusBadge = batch.is_active
                    ? '<span class="badge bg-success">Activo</span>'
                    : '<span class="badge bg-secondary">Inactivo</span>';
                html += `<div class="card mb-3">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <div><h6 class="mb-0">#${batch.order} - ${batch.name}</h6><small class="text-muted">${batch.description || ''}</small></div>
                        <div>${statusBadge}<span class="badge bg-info">${batch.message_count || 0} mensajes</span></div>
                    </div>
                    <div class="card-body"><div id="messages-${batch.id}" class="messages-list"><small class="text-muted">Cargando mensajes...</small></div></div>
                    <div class="card-footer d-flex gap-2 justify-content-end">
                        <button class="btn btn-sm btn-primary" onclick="openAddMessageModal(${batch.id})"><i class="bi bi-plus"></i> Agregar Mensaje</button>
                        ${!batch.is_active ? `<button class="btn btn-sm btn-success" onclick="activateBatch(${batch.id})"><i class="bi bi-check-circle"></i> Activar</button>` : ''}
                        <button class="btn btn-sm btn-warning" onclick="editBatch(${batch.id})"><i class="bi bi-pencil"></i> Editar</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteBatch(${batch.id})"><i class="bi bi-trash"></i> Eliminar</button>
                    </div>
                </div>`;
            });
        }
        const container = document.getElementById('batchesContainer');
        if (container) container.innerHTML = html;
        batches.forEach(batch => loadBatchMessages(batch.id));
    } catch (error) {
        showAlert('Error al cargar lotes: ' + error.message, 'danger');
    }
}

async function loadBatchMessages(batchId) {
    try {
        const response = await fetch(`${API_BASE}/batches/${batchId}/messages`, { headers: { 'X-API-Token': apiToken } });
        if (!response.ok) throw new Error('Failed');
        const data = await response.json();
        const messages = data.messages || [];
        let html = '';
        if (messages.length === 0) {
            html = '<small class="text-muted">Sin mensajes en este lote</small>';
        } else {
            messages.forEach(msg => {
                const trans = msg.text_translations || {};
                const langBadges = ['es','en','pt'].filter(l => trans[l])
                    .map(l => `<span class="badge bg-${langColors[l] || 'secondary'} me-1">${l.toUpperCase()}</span>`).join('');
                html += `<div class="alert alert-light mb-2 d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1 me-2">
                        <strong>#${msg.sequence_order}:</strong> ${msg.title}
                        <div class="mt-1">${langBadges || '<span class="badge bg-light text-dark border">sin traducir</span>'}</div>
                        <small class="text-muted">${(trans.es || msg.text || '').substring(0, 60)}...</small>
                    </div>
                    <div class="d-flex gap-1 flex-shrink-0">
                        <button class="btn btn-sm btn-outline-warning" onclick="editMessage(${batchId}, ${msg.id})" title="Editar"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-sm btn-danger" onclick="deleteMessage(${batchId}, ${msg.id})" title="Eliminar"><i class="bi bi-trash"></i></button>
                    </div>
                </div>`;
            });
        }
        const el = document.getElementById(`messages-${batchId}`);
        if (el) el.innerHTML = html;
    } catch (error) {
        console.error('Error loading batch messages:', error);
    }
}

async function saveBatch() {
    const name = document.getElementById('batchName').value;
    const description = document.getElementById('batchDescription').value;
    const order = document.getElementById('batchOrder').value;
    const batchId = document.getElementById('batchId')?.value;
    if (!name || !order) { showAlert('Completa todos los campos', 'warning'); return; }
    try {
        const formData = new FormData();
        formData.append('name', name);
        formData.append('description', description);
        formData.append('order', order);
        const method = batchId ? 'PUT' : 'POST';
        const endpoint = batchId ? `/batches/${batchId}` : '/batches';
        const response = await fetch(`${API_BASE}${endpoint}`, { method, headers: { 'X-API-Token': apiToken }, body: formData });
        if (!response.ok) throw new Error('Failed to save batch');
        showAlert('Lote guardado exitosamente', 'success');
        document.getElementById('batchForm').reset();
        const batchIdInput = document.getElementById('batchId');
        if (batchIdInput) batchIdInput.remove();
        bootstrap.Modal.getInstance(document.getElementById('createBatchModal'))?.hide();
        loadBatches();
    } catch (error) {
        showAlert('Error al guardar lote: ' + error.message, 'danger');
    }
}

async function activateBatch(batchId) {
    try {
        const response = await fetch(`${API_BASE}/batches/${batchId}/activate`, { method: 'POST', headers: { 'X-API-Token': apiToken } });
        if (!response.ok) throw new Error('Failed');
        showAlert('Lote activado exitosamente', 'success');
        loadBatches();
    } catch (error) {
        showAlert('Error al activar lote: ' + error.message, 'danger');
    }
}

async function editBatch(batchId) {
    try {
        const response = await fetch(`${API_BASE}/batches/${batchId}`, { headers: { 'X-API-Token': apiToken } });
        if (!response.ok) throw new Error('Failed');
        const data = await response.json();
        const batch = data.batch;
        document.getElementById('batchName').value = batch.name;
        document.getElementById('batchDescription').value = batch.description;
        document.getElementById('batchOrder').value = batch.order;
        document.getElementById('batchModalTitle').textContent = 'Editar Lote';
        let idInput = document.getElementById('batchId');
        if (!idInput) {
            idInput = document.createElement('input');
            idInput.type = 'hidden'; idInput.id = 'batchId';
            document.getElementById('batchForm').appendChild(idInput);
        }
        idInput.value = batchId;
        new bootstrap.Modal(document.getElementById('createBatchModal')).show();
    } catch (error) {
        showAlert('Error: ' + error.message, 'danger');
    }
}

async function deleteBatch(batchId) {
    if (!confirm('¿Eliminar este lote y todos sus mensajes?')) return;
    try {
        const response = await fetch(`${API_BASE}/batches/${batchId}`, { method: 'DELETE', headers: { 'X-API-Token': apiToken } });
        if (!response.ok) throw new Error('Failed');
        showAlert('Lote eliminado exitosamente', 'success');
        loadBatches();
    } catch (error) {
        showAlert('Error al eliminar lote: ' + error.message, 'danger');
    }
}

function openCreateLinkModal() {
    document.getElementById('linkForm').reset();
    document.getElementById('linkModalTitle').textContent = 'Crear Nuevo Link';
    const linkIdInput = document.getElementById('linkId');
    if (linkIdInput) linkIdInput.remove();
    new bootstrap.Modal(document.getElementById('createLinkModal')).show();
}

async function loadStripLinks() {
    try {
        const response = await fetch(`${API_BASE}/stripe-links`, { headers: { 'X-API-Token': apiToken } });
        if (!response.ok) throw new Error('Failed');
        const data = await response.json();
        const links = data.links || [];
        window._linksData = {};
        links.forEach(l => { window._linksData[l.id] = l; });
        let html = '';
        if (links.length === 0) {
            html = '<div class="alert alert-info">Sin links de pago.</div>';
        } else {
            html = '<table class="table table-hover"><thead><tr><th>Nombre</th><th>Texto ES/EN/PT</th><th>Duración</th><th>ID Stripe</th><th>URL</th><th>Acciones</th></tr></thead><tbody>';
            links.forEach(link => {
                const trans = link.name_translations || {};
                const transText = [trans.es ? `ES: ${trans.es}` : '', trans.en ? `EN: ${trans.en}` : '', trans.pt ? `PT: ${trans.pt}` : ''].filter(Boolean).join(' | ') || '—';
                const durBadge = (link.duration_days > 0) ? `<span class="badge bg-info text-dark">${link.duration_days}d</span>` : '<span class="badge bg-dark">Vitalicio</span>';
                const stripeBadge = link.stripe_link_id ? `<small class="font-monospace">${link.stripe_link_id.substring(0, 20)}...</small>` : '<span class="text-danger small">⚠ Sin ID</span>';
                html += `<tr>
                    <td>${link.name}</td><td><small>${transText}</small></td><td>${durBadge}</td><td>${stripeBadge}</td>
                    <td><small>${link.url.substring(0, 35)}...</small></td>
                    <td>
                        <button class="btn btn-sm btn-warning" onclick="editLink(${link.id})"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-sm btn-danger" onclick="deleteLink(${link.id})"><i class="bi bi-trash"></i></button>
                    </td></tr>`;
            });
            html += '</tbody></table>';
        }
        const el = document.getElementById('linksTable');
        if (el) el.parentElement.innerHTML = html;
    } catch (error) {
        showAlert('Error al cargar links: ' + error.message, 'danger');
    }
}

async function saveLink() {
    const name = document.getElementById('linkName').value;
    const url = document.getElementById('linkUrl').value;
    const name_es = document.getElementById('linkNameEs').value;
    const name_en = document.getElementById('linkNameEn').value;
    const name_pt = document.getElementById('linkNamePt').value;
    const duration_days = parseInt(document.getElementById('linkDurationDays')?.value || '0', 10) || 0;
    const linkId = document.getElementById('linkId')?.value;
    if (!name || !url || !name_es) { showAlert('Completa los campos obligatorios', 'warning'); return; }
    try {
        const formData = new FormData();
        formData.append('name', name); formData.append('url', url);
        formData.append('name_es', name_es); formData.append('duration_days', duration_days);
        const stripe_link_id = document.getElementById('linkStripeId')?.value?.trim() || '';
        if (stripe_link_id) formData.append('stripe_link_id', stripe_link_id);
        if (name_en) formData.append('name_en', name_en);
        if (name_pt) formData.append('name_pt', name_pt);
        const method = linkId ? 'PUT' : 'POST';
        const endpoint = linkId ? `/stripe-links/${linkId}` : '/stripe-links';
        const response = await fetch(`${API_BASE}${endpoint}`, { method, headers: { 'X-API-Token': apiToken }, body: formData });
        if (!response.ok) throw new Error('Failed');
        showAlert('Link guardado exitosamente', 'success');
        document.getElementById('linkForm').reset();
        bootstrap.Modal.getInstance(document.getElementById('createLinkModal'))?.hide();
        loadStripLinks();
    } catch (error) {
        showAlert('Error al guardar link: ' + error.message, 'danger');
    }
}

function editLink(linkId) {
    const link = (window._linksData || {})[linkId];
    if (!link) { showAlert('Link no encontrado', 'danger'); return; }
    const trans = link.name_translations || {};
    document.getElementById('linkName').value = link.name;
    document.getElementById('linkUrl').value = link.url;
    document.getElementById('linkNameEs').value = trans.es || '';
    document.getElementById('linkNameEn').value = trans.en || '';
    document.getElementById('linkNamePt').value = trans.pt || '';
    const durEl = document.getElementById('linkDurationDays'); if (durEl) durEl.value = link.duration_days || 0;
    const stripeIdEl = document.getElementById('linkStripeId'); if (stripeIdEl) stripeIdEl.value = link.stripe_link_id || '';
    let idInput = document.getElementById('linkId');
    if (!idInput) { idInput = document.createElement('input'); idInput.type = 'hidden'; idInput.id = 'linkId'; document.getElementById('linkForm').appendChild(idInput); }
    idInput.value = linkId;
    document.getElementById('linkModalTitle').textContent = 'Editar Link';
    new bootstrap.Modal(document.getElementById('createLinkModal')).show();
}

async function deleteLink(linkId) {
    if (!confirm('¿Eliminar este link de pago?')) return;
    try {
        const response = await fetch(`${API_BASE}/stripe-links/${linkId}`, { method: 'DELETE', headers: { 'X-API-Token': apiToken } });
        if (!response.ok) throw new Error('Failed');
        showAlert('Link eliminado exitosamente', 'success');
        loadStripLinks();
    } catch (error) {
        showAlert('Error al eliminar link: ' + error.message, 'danger');
    }
}

function openAddMessageModal(batchId) {
    currentBatchId = batchId;
    document.getElementById('messageForm').reset();
    document.getElementById('messageModalTitle').textContent = 'Agregar Mensaje al Lote';
    const editId = document.getElementById('editMessageId'); if (editId) editId.remove();
    loadLinkCheckboxes();
    new bootstrap.Modal(document.getElementById('createMessageModal')).show();
}

async function editMessage(batchId, msgId) {
    currentBatchId = batchId;
    document.getElementById('messageForm').reset();
    document.getElementById('messageModalTitle').textContent = 'Editar Mensaje';
    let editIdInput = document.getElementById('editMessageId');
    if (!editIdInput) { editIdInput = document.createElement('input'); editIdInput.type = 'hidden'; editIdInput.id = 'editMessageId'; document.getElementById('messageForm').appendChild(editIdInput); }
    editIdInput.value = msgId;
    try {
        const res = await fetch(`${API_BASE}/batches/${batchId}/messages`, { headers: { 'X-API-Token': apiToken } });
        const data = await res.json();
        const msg = (data.messages || []).find(m => m.id === msgId);
        if (!msg) { showAlert('Mensaje no encontrado', 'danger'); return; }
        document.getElementById('messageTitle').value = msg.title;
        document.getElementById('messageSequenceOrder').value = msg.sequence_order;
        const trans = msg.text_translations || {};
        document.getElementById('messageTextEs').value = trans.es || msg.text || '';
        document.getElementById('messageTextEn').value = trans.en || '';
        document.getElementById('messageTextPt').value = trans.pt || '';
        await loadLinkCheckboxes();
        const selectedIds = (msg.strip_links || []).map(l => String(l.id));
        document.querySelectorAll('.strip-link-checkbox').forEach(cb => { cb.checked = selectedIds.includes(cb.value); });
        new bootstrap.Modal(document.getElementById('createMessageModal')).show();
    } catch (e) {
        showAlert('Error cargando mensaje: ' + e.message, 'danger');
    }
}

async function loadLinkCheckboxes() {
    try {
        const response = await fetch(`${API_BASE}/stripe-links`, { headers: { 'X-API-Token': apiToken } });
        if (!response.ok) throw new Error('Failed');
        const data = await response.json();
        const links = data.links || [];
        let html = links.length === 0
            ? '<small class="text-muted">No hay links disponibles.</small>'
            : links.map(link => {
                const trans = link.name_translations || {};
                const label = trans.es || link.name;
                return `<div class="form-check"><input class="form-check-input strip-link-checkbox" type="checkbox" value="${link.id}" id="link_${link.id}"><label class="form-check-label" for="link_${link.id}"><strong>${label}</strong> <small class="text-muted ms-1">${link.url.substring(0, 35)}...</small></label></div>`;
            }).join('');
        const el = document.getElementById('stripLinksCheckboxes'); if (el) el.innerHTML = html;
    } catch (error) {
        console.error('Error loading link checkboxes:', error);
    }
}

async function saveMessage() {
    if (!currentBatchId) { showAlert('No hay lote seleccionado', 'danger'); return; }
    const title = document.getElementById('messageTitle').value;
    const text_es = document.getElementById('messageTextEs').value;
    const text_en = document.getElementById('messageTextEn').value;
    const text_pt = document.getElementById('messageTextPt').value;
    const sequenceOrder = document.getElementById('messageSequenceOrder').value;
    const editMsgId = document.getElementById('editMessageId')?.value;
    if (!title || !text_es || !sequenceOrder) { showAlert('Completa los campos obligatorios', 'warning'); return; }
    const selectedLinkIds = Array.from(document.querySelectorAll('.strip-link-checkbox:checked')).map(cb => cb.value);
    const formData = new FormData();
    formData.append('title', title); formData.append('text_es', text_es);
    formData.append('text_en', text_en); formData.append('text_pt', text_pt);
    formData.append('sequence_order', parseInt(sequenceOrder));
    formData.append('strip_link_ids', JSON.stringify(selectedLinkIds));
    const imageFile = document.getElementById('messageImage').files[0];
    if (imageFile) formData.append('image', imageFile);
    const isEdit = !!editMsgId;
    const method = isEdit ? 'PUT' : 'POST';
    const endpoint = isEdit ? `${API_BASE}/batches/${currentBatchId}/messages/${editMsgId}` : `${API_BASE}/batches/${currentBatchId}/messages`;
    try {
        const response = await fetch(endpoint, { method, headers: { 'X-API-Token': apiToken }, body: formData });
        if (!response.ok) throw new Error('Failed');
        showAlert(isEdit ? 'Mensaje actualizado' : 'Mensaje agregado exitosamente', 'success');
        bootstrap.Modal.getInstance(document.getElementById('createMessageModal'))?.hide();
        loadBatches();
    } catch (error) {
        showAlert('Error al guardar mensaje: ' + error.message, 'danger');
    }
}

async function deleteMessage(batchId, messageId) {
    if (!confirm('¿Eliminar este mensaje?')) return;
    try {
        const response = await fetch(`${API_BASE}/batches/${batchId}/messages/${messageId}`, { method: 'DELETE', headers: { 'X-API-Token': apiToken } });
        if (!response.ok) throw new Error('Failed');
        showAlert('Mensaje eliminado exitosamente', 'success');
        loadBatches();
    } catch (error) {
        showAlert('Error al eliminar mensaje: ' + error.message, 'danger');
    }
}

async function refreshSchedulerState() {
    try {
        const response = await fetch(`${API_BASE}/batches/schedule/state`, { headers: { 'X-API-Token': apiToken } });
        if (!response.ok) throw new Error('Failed');
        const data = await response.json();
        const state = data.state;
        if (!state) {
            const el = document.getElementById('scheduleStateContainer');
            if (el) el.innerHTML = '<div class="alert alert-warning">El scheduler no ha sido inicializado aún.</div>';
            return;
        }
        const html = `
            <div class="row mb-3">
                <div class="col-md-6"><strong>Lote Actual:</strong><br>${state.current_batch ? `#${state.current_batch.id} - ${state.current_batch.name}` : 'N/A'}</div>
                <div class="col-md-6"><strong>Próximo Mensaje:</strong><br>${state.current_message ? state.current_message.title : 'N/A'}</div>
            </div>
            <div class="row mb-3">
                <div class="col-md-6"><strong>Índice Actual:</strong><br>${state.current_message_index} de ${state.current_batch?.total_messages || 0}</div>
                <div class="col-md-6"><strong>Próximo Envío:</strong><br>${state.next_send_at ? new Date(state.next_send_at).toLocaleString('es-ES') : 'N/A'}</div>
            </div>
            <div class="alert alert-info">Último envío: ${state.last_sent_at ? new Date(state.last_sent_at).toLocaleString('es-ES') : 'Nunca'}</div>`;
        const el = document.getElementById('scheduleStateContainer');
        if (el) el.innerHTML = html;
    } catch (error) {
        console.error('Error loading scheduler state:', error);
    }
}

let allUsers = [];
const langColors = { es: 'primary', en: 'success', fr: 'info', de: 'warning', it: 'danger', pt: 'secondary', ru: 'dark' };

function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function renderUsersTable(users) {
    const el = document.getElementById('usuariosTable');
    if (!el) return;
    if (!users.length) { el.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-3">Sin usuarios registrados</td></tr>'; return; }
    el.innerHTML = users.map(u => {
        const username = u.username ? `@${u.username}` : '—';
        const langBadge = `<span class="badge bg-${langColors[u.language] || 'secondary'}">${(u.language || '?').toUpperCase()}</span>`;
        let statusBadges = u.is_active ? '<span class="badge bg-success me-1">Activo</span>' : '<span class="badge bg-secondary me-1">Inactivo</span>';
        if (u.is_vip) statusBadges += '<span class="badge bg-warning text-dark">VIP</span>';
        let vipCell = '<span class="text-muted small">—</span>';
        if (u.is_vip) {
            if (u.vip_days_remaining === -1) vipCell = '<span class="badge bg-dark">Vitalicio</span>';
            else if (u.vip_days_remaining > 0) vipCell = `<span class="badge bg-success">${u.vip_days_remaining}d</span>`;
            else if (u.vip_days_remaining === 0 && u.vip_expires_at) vipCell = '<span class="badge bg-danger">Caducado</span>';
        }
        return `<tr style="cursor:pointer" onclick="openUserDetail(${u.id})">
            <td><small class="font-monospace text-muted">${u.telegram_id}</small></td>
            <td>${username}</td><td>${langBadge}</td><td>${statusBadges}</td><td>${vipCell}</td>
            <td><small>${formatDate(u.last_message_at)}</small></td>
            <td><button class="btn btn-sm btn-outline-secondary py-0 px-1" onclick="event.stopPropagation();openUserDetail(${u.id})"><i class="bi bi-eye"></i></button></td>
        </tr>`;
    }).join('');
}

function filterUsers() {
    const q = (document.getElementById('userSearch')?.value || '').toLowerCase();
    if (!q) { renderUsersTable(allUsers); return; }
    renderUsersTable(allUsers.filter(u => (u.first_name + ' ' + u.last_name + ' ' + u.username + ' ' + u.telegram_id).toLowerCase().includes(q)));
}

let _currentDetailUserId = null;

async function openUserDetail(userId) {
    _currentDetailUserId = userId;
    const u = allUsers.find(x => x.id === userId);
    if (!u) return;
    document.getElementById('userDetailTitle').textContent = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || `ID ${u.telegram_id}`;
    const resumeBtn = document.getElementById('userDetailResumeBtn');
    if (resumeBtn) resumeBtn.style.display = u.is_vip ? '' : 'none';
    const body = document.getElementById('userDetailBody');
    body.innerHTML = `<div class="text-center py-4"><div class="spinner-border"></div></div>`;
    new bootstrap.Modal(document.getElementById('userDetailModal')).show();
    body.innerHTML = `<table class="table table-sm">
        <tr><td>Telegram ID</td><td><code>${u.telegram_id}</code></td></tr>
        <tr><td>Username</td><td>${u.username ? `<a href="https://t.me/${u.username}" target="_blank">@${u.username}</a>` : '—'}</td></tr>
        <tr><td>Nombre</td><td>${[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'}</td></tr>
        <tr><td>Idioma</td><td><span class="badge bg-${langColors[u.language]||'secondary'}">${(u.language||'?').toUpperCase()}</span></td></tr>
        <tr><td>VIP</td><td>${u.is_vip ? (u.vip_days_remaining === -1 ? '<span class="badge bg-dark">Vitalicio</span>' : `<span class="badge bg-success">${u.vip_days_remaining}d</span>`) : 'No'}</td></tr>
        <tr><td>Lote actual</td><td>${u.current_batch_name || '—'}</td></tr>
        <tr><td>Step completado</td><td>${u.current_message_step || 0}</td></tr>
        <tr><td>Msgs enviados</td><td>${u.messages_sent_count}</td></tr>
        <tr><td>Registrado</td><td>${formatDate(u.joined_at)}</td></tr>
        <tr><td>Último mensaje</td><td>${formatDate(u.last_message_at)}</td></tr>
    </table>`;
}

async function resumeUserSequence() {
    if (!_currentDetailUserId) return;
    if (!confirm('¿Reanudar la secuencia de mensajes para este usuario? Se desactivará su estado VIP.')) return;
    try {
        const res = await fetch(`${API_BASE}/users/${_currentDetailUserId}/resume-sequence`, { method: 'POST', headers: { 'X-API-Token': apiToken } });
        if (!res.ok) throw new Error('Failed');
        showAlert('Secuencia reanudada', 'success');
        bootstrap.Modal.getInstance(document.getElementById('userDetailModal'))?.hide();
        loadUsers();
    } catch (e) {
        showAlert('Error: ' + e.message, 'danger');
    }
}

async function loadUsers() {
    try {
        const response = await fetch(`${API_BASE}/users`, { headers: { 'X-API-Token': apiToken } });
        if (!response.ok) throw new Error('Failed');
        const data = await response.json();
        allUsers = data.users || [];
        const countEl = document.getElementById('usersCount');
        if (countEl) countEl.textContent = allUsers.length;
        filterUsers();
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

function loadApiToken() {
    const token = localStorage.getItem('apiToken');
    if (token) { const el = document.getElementById('apiToken'); if (el) el.value = token; apiToken = token; }
}

function saveSettings() {
    const token = document.getElementById('apiToken').value;
    if (!token) { showAlert('El token API es requerido', 'warning'); return; }
    localStorage.setItem('apiToken', token);
    apiToken = token;
    showAlert('Configuración guardada exitosamente', 'success');
    setTimeout(() => { loadBatches(); loadUsers(); refreshSchedulerState(); }, 500);
}

const _levelColors = { INFO: '#4ec9b0', WARNING: '#ce9178', ERROR: '#f44747', DEBUG: '#9cdcfe' };

async function loadLogs() {
    const level = document.getElementById('logLevelFilter')?.value || '';
    const url = level ? `${API_BASE}/logs?limit=300&level=${level}` : `${API_BASE}/logs?limit=300`;
    try {
        const res = await fetch(url, { headers: { 'X-API-Token': apiToken } });
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        const logs = data.logs || [];
        const container = document.getElementById('logsContainer');
        if (!container) return;
        if (!logs.length) { container.innerHTML = '<span style="color:#6a9955">// Sin logs aún</span>'; return; }
        container.innerHTML = logs.map(e => {
            const color = _levelColors[e.level] || '#d4d4d4';
            return `<div><span style="color:#858585">${e.ts}</span> <span style="color:${color};font-weight:bold">[${e.level.padEnd(7)}]</span> <span style="color:#dcdcaa">${e.name}:</span> <span style="color:#d4d4d4">${escHtml(e.msg)}</span></div>`;
        }).join('');
    } catch (e) {
        const container = document.getElementById('logsContainer');
        if (container) container.innerHTML = `<span style="color:#f44747">Error: ${e.message}</span>`;
    }
}

function clearLogsView() {
    const container = document.getElementById('logsContainer');
    if (container) container.innerHTML = '<span style="color:#6a9955">// Vista limpiada</span>';
}

function _startLogsAutoRefresh() {
    _stopLogsAutoRefresh();
    _logsInterval = setInterval(() => { if (document.getElementById('logsAutoRefresh')?.checked) loadLogs(); }, 3000);
}

function _stopLogsAutoRefresh() {
    if (_logsInterval) { clearInterval(_logsInterval); _logsInterval = null; }
}

function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

async function loadVipConfig() {
    try {
        const res = await fetch(`${API_BASE}/vip-config`, { headers: { 'X-API-Token': apiToken } });
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        const cfg = data.config || {};
        const t = cfg.text_translations || {};
        const b = cfg.button_text_translations || {};
        document.getElementById('vipTextEs').value = t.es || '';
        document.getElementById('vipTextEn').value = t.en || '';
        document.getElementById('vipTextPt').value = t.pt || '';
        document.getElementById('vipButtonEs').value = b.es || '';
        document.getElementById('vipButtonEn').value = b.en || '';
        document.getElementById('vipButtonPt').value = b.pt || '';
        document.getElementById('vipInviteUrl').value = cfg.invite_url || '';
        const preview = document.getElementById('vipImagePreview');
        if (preview) preview.innerHTML = cfg.image_url ? `<img src="${cfg.image_url}" class="img-thumbnail" style="max-height:120px">` : '<small class="text-muted">Sin imagen cargada</small>';
    } catch (e) { console.error('Error loading VIP config:', e); }
}

async function saveVipConfig() {
    const statusEl = document.getElementById('vipSaveStatus');
    if (statusEl) statusEl.textContent = 'Guardando...';
    try {
        const fd = new FormData();
        fd.append('text_es', document.getElementById('vipTextEs').value);
        fd.append('text_en', document.getElementById('vipTextEn').value);
        fd.append('text_pt', document.getElementById('vipTextPt').value);
        fd.append('button_es', document.getElementById('vipButtonEs').value);
        fd.append('button_en', document.getElementById('vipButtonEn').value);
        fd.append('button_pt', document.getElementById('vipButtonPt').value);
        fd.append('invite_url', document.getElementById('vipInviteUrl').value);
        const imgInput = document.getElementById('vipImage');
        if (imgInput && imgInput.files[0]) fd.append('image', imgInput.files[0]);
        const res = await fetch(`${API_BASE}/vip-config`, { method: 'POST', headers: { 'X-API-Token': apiToken }, body: fd });
        if (!res.ok) throw new Error('Failed');
        showAlert('Mensaje VIP guardado correctamente', 'success');
        if (statusEl) statusEl.textContent = '✓ Guardado';
        loadVipConfig();
    } catch (e) {
        showAlert('Error al guardar: ' + e.message, 'danger');
        if (statusEl) statusEl.textContent = '';
    }
}
