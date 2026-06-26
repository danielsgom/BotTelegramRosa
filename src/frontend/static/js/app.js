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

async function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('d-none'));
    document.querySelectorAll('.navbar-nav .nav-link').forEach(link => link.classList.remove('active'));
    document.getElementById(tabId).classList.remove('d-none');
    document.querySelector(`a[href="#${tabId}"]`).classList.add('active');
    if (tabId === 'lotes-tab') await loadBatches();
    else if (tabId === 'mensajes-tab') { await loadUsersForChat(); await loadPredefinedAssets(); await loadQuickMessages(); }
    else if (tabId === 'links-tab') await loadStripLinks();
    else if (tabId === 'usuarios-tab') await loadUsers();
    else if (tabId === 'scheduler-tab') refreshSchedulerState();
    else if (tabId === 'logs-tab') { loadLogs(); _startLogsAutoRefresh(); }
    else if (tabId === 'vip-tab') loadVipConfig();
    else if (tabId === 'quick-messages-tab') { await loadQuickMessages(); await loadMessageBlocks(); }
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
    const preview = document.getElementById('messageImagePreview');
    if (preview) preview.style.display = 'none';
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
        const preview = document.getElementById('messageImagePreview');
        if (preview) {
            if (msg.image_url) {
                preview.querySelector('img').src = msg.image_url;
                preview.style.display = '';
            } else {
                preview.style.display = 'none';
            }
        }
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
                <div class="col-md-6"><strong>Próximo Envío:</strong><br>${state.next_send_at ? formatDate(state.next_send_at) : 'N/A'}</div>
            </div>
            <div class="alert alert-info">Último envío: ${state.last_sent_at ? formatDate(state.last_sent_at) : 'Nunca'}</div>`;
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
    if (isNaN(d)) return '—';
    // Always display in Madrid timezone
    return new Intl.DateTimeFormat('es-ES', {
        day: '2-digit', month: '2-digit', year: '2-digit',
        hour: '2-digit', minute: '2-digit',
        timeZone: 'Europe/Madrid'
    }).format(d);
}

function formatTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    return new Intl.DateTimeFormat('es-ES', {
        hour: '2-digit', minute: '2-digit',
        timeZone: 'Europe/Madrid'
    }).format(d);
}

function escHtml(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
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
    </table>
    <div class="d-grid">
        <button class="btn btn-primary" onclick="openUserMessages(${u.id})">
            <i class="bi bi-chat-text me-1"></i> Ver mensajes enviados
        </button>
    </div>`;
}

// ─── User Messages (chat history) ────────────────────────────────────────
const _msgStatusMap = {
    sent:    { icon: '✓', label: 'Enviado',    cls: 'text-success' },
    failed:  { icon: '✗', label: 'Fallido',    cls: 'text-danger' },
    pending: { icon: '⏳', label: 'Pendiente', cls: 'text-warning' },
};
const _langFlags = { es: '🇪🇸', en: '🇬🇧', pt: '🇵🇹', fr: '🇫🇷', de: '🇩🇪', it: '🇮🇹', ru: '🇷🇺' };

async function openUserMessages(userId) {
    const u = allUsers.find(x => x.id === userId);
    const name = u ? ([u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || `ID ${u.telegram_id}`) : `ID ${userId}`;
    const nameEl = document.getElementById('modalUserName');
    if (nameEl) nameEl.textContent = name;
    const body = document.getElementById('userMessagesBody');
    const meta = document.getElementById('userMessagesMeta');
    if (meta) meta.textContent = '';
    if (body) body.innerHTML = `<div class="text-center py-5 text-muted"><div class="spinner-border spinner-border-sm"></div> Cargando mensajes...</div>`;
    new bootstrap.Modal(document.getElementById('userMessagesModal')).show();
    try {
        const res = await fetch(`${API_BASE}/users/${userId}/messages`, { headers: { 'X-API-Token': apiToken } });
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        renderUserMessages(data.messages || [], name);
        if (meta) meta.textContent = `${(data.messages || []).length} mensaje(s) · Hora de Madrid`;
    } catch (e) {
        if (body) body.innerHTML = `<div class="text-center py-5 text-danger">Error al cargar los mensajes</div>`;
    }
}

function renderUserMessages(messages, userName) {
    const body = document.getElementById('userMessagesBody');
    if (!body) return;
    if (!messages.length) {
        body.innerHTML = `<div class="text-center py-5 text-muted"><div style="font-size:3rem">💬</div><p class="mb-0">No hay mensajes enviados a este usuario</p></div>`;
        return;
    }
    const bubbles = messages.map(msg => {
        const st = _msgStatusMap[msg.status] || { icon: '·', label: msg.status || '?', cls: 'text-muted' };
        const flag = _langFlags[(msg.language || '').toLowerCase()] || '🌐';
        let img = '';
        if (msg.image_url) {
            img = `<img src="${escHtml(msg.image_url)}" alt="" class="img-fluid rounded mb-2" style="max-height:280px;width:100%;object-fit:cover" onerror="this.style.display='none'">`;
        }
        let links = '';
        if (msg.links && msg.links.length) {
            const chips = msg.links.map(l =>
                `<a href="${escHtml(l.url)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-primary rounded-pill me-1 mb-1"><i class="bi bi-link-45deg"></i> ${escHtml(l.name)}</a>`
            ).join('');
            links = `<div class="mt-2 pt-2 border-top"><div class="text-muted small text-uppercase mb-1" style="letter-spacing:.05em">Enlaces de pago</div>${chips}</div>`;
        }
        const text = msg.text ? `<div class="mb-1" style="white-space:pre-wrap">${escHtml(msg.text)}</div>` : '';
        return `<div class="d-flex mb-3">
            <div class="flex-shrink-0 me-2 rounded-circle bg-primary d-flex align-items-center justify-content-center text-white" style="width:34px;height:34px">🤖</div>
            <div class="flex-grow-1" style="max-width:640px">
                <div class="small text-muted mb-1">Bot → ${escHtml(userName)} <span class="ms-1">${flag}</span></div>
                <div class="card border-0 shadow-sm">
                    <div class="card-header bg-light py-2 d-flex justify-content-between align-items-center">
                        <strong class="text-primary">${escHtml(msg.title || 'Mensaje')}</strong>
                        <span class="badge bg-secondary">Paso #${msg.sequence_order ?? '?'}</span>
                    </div>
                    <div class="card-body py-2">
                        ${img}
                        ${text}
                        ${links}
                    </div>
                    <div class="card-footer bg-white py-1 d-flex justify-content-between align-items-center">
                        <small class="${st.cls} fw-semibold">${st.icon} ${st.label}</small>
                        <small class="text-muted"><i class="bi bi-clock"></i> ${formatDate(msg.sent_at)}</small>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');
    body.innerHTML = `<div class="p-3" style="background:#f8f1f4">${bubbles}</div>`;
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

// ─── Manual Messaging Feature ────────────────────────────────────────────────

let currentUserId = null;
let currentUserTelegramId = null;
let allUsersChat = [];
let allPredefinedAssets = [];
let allStripeLinks = [];
let allQuickMessages = [];
let selectedAssetType = null;

async function loadUsersForChat() {
    try {
        const res = await fetch(`${API_BASE}/admin/users?limit=100`, {
            headers: { 'X-API-Token': apiToken }
        });
        if (!res.ok) throw new Error('Failed to load users');
        const data = await res.json();
        allUsersChat = data.users;
        renderUsersList();
    } catch (e) {
        console.error('Error loading users:', e);
        showAlert('Error al cargar usuarios', 'danger');
    }
}

function renderUsersList() {
    const list = document.getElementById('usersListChat');
    if (!allUsersChat.length) {
        list.innerHTML = '<div class="text-center text-muted p-3">Sin usuarios</div>';
        return;
    }
    
    const langFlags = {
        'es': '🇪🇸',
        'en': '🇬🇧',
        'pt': '🇵🇹'
    };
    
    list.innerHTML = allUsersChat.map(u => `
        <div class="list-group-item list-group-item-action p-2 cursor-pointer" onclick="selectUserForChat(${u.id}, ${u.telegram_id}, '${u.first_name || ''} ${u.last_name || ''}')">
            <div class="d-flex justify-content-between align-items-start">
                <div style="flex: 1;">
                    <div class="d-flex align-items-center gap-2">
                        <h6 class="mb-0">${u.first_name || u.username || 'User'}</h6>
                        <span class="badge bg-info" title="Idioma: ${u.language || 'es'}">${langFlags[u.language] || '🌍'} ${u.language ? u.language.toUpperCase() : 'ES'}</span>
                        ${u.unread_count > 0 ? `<span class="badge bg-danger">${u.unread_count}</span>` : ''}
                    </div>
                    <small class="text-muted">@${u.username || u.telegram_id}</small>
                    ${u.last_message_preview ? `<div class="small text-truncate mt-1">${u.last_message_preview}</div>` : ''}
                </div>
                <span class="badge bg-${u.is_vip ? 'gold' : 'secondary'} ms-2">
                    ${u.is_vip ? 'VIP' : 'Regular'}
                </span>
            </div>
        </div>
    `).join('');
}

function filterUsersForChat() {
    const search = document.getElementById('userSearchChat').value.toLowerCase();
    const filtered = allUsersChat.filter(u => 
        (u.first_name && u.first_name.toLowerCase().includes(search)) ||
        (u.last_name && u.last_name.toLowerCase().includes(search)) ||
        (u.username && u.username.toLowerCase().includes(search)) ||
        u.telegram_id.toString().includes(search)
    );
    allUsersChat = filtered;
    renderUsersList();
}

async function selectUserForChat(userId, telegramId, userName) {
    currentUserId = userId;
    currentUserTelegramId = telegramId;
    document.getElementById('chatUserName').textContent = userName;
    document.getElementById('chatUserInfo').textContent = `telegram_id: ${telegramId}`;
    document.getElementById('messageInputArea').style.display = 'block';
    document.getElementById('assetsPanelBtn').style.display = 'inline-block';
    
    // Fetch chat history
    try {
        const res = await fetch(`${API_BASE}/admin/users/${userId}/chat/history?limit=50`, {
            headers: { 'X-API-Token': apiToken }
        });
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        renderChatHistory(data.messages);
        
        // Mark messages as read
        await fetch(`${API_BASE}/admin/users/${userId}/chat/mark-read`, {
            method: 'POST',
            headers: { 'X-API-Token': apiToken }
        });
    } catch (e) {
        console.error('Error loading chat:', e);
        showAlert('Error al cargar historial', 'danger');
    }
}

function renderChatHistory(messages) {
    const chatDiv = document.getElementById('chatMessages');
    if (!messages || !messages.length) {
        chatDiv.innerHTML = '<div class="text-center text-muted mt-5">Sin mensajes previos</div>';
        return;
    }
    
    console.log('Rendering chat history, messages count:', messages.length);
    console.log('Messages:', messages);
    
    chatDiv.innerHTML = messages.map(m => {
        const isAdmin = m.sent_by === 'admin';
        const msgClass = isAdmin ? 'ms-auto bg-primary text-white' : 'me-auto bg-light';
        const icon = {
            'text': '💬',
            'audio': '🎵',
            'image': '🖼️',
            'video': '🎬',
            'link': '🔗'
        }[m.message_type] || '📨';
        
        let content = m.content || '';
        let preview = '';
        
        // Add file preview if available
        if (m.attachment_url) {
            const ext = m.attachment_url.split('.').pop().toLowerCase();
            const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
            const isAudio = ['mp3', 'wav', 'ogg', 'm4a'].includes(ext);
            const isVideo = ['mp4', 'webm', 'mov'].includes(ext);
            
            if (isImage) {
                preview = `<div class="mt-2"><img src="${m.attachment_url}" alt="Preview" style="max-width: 100%; max-height: 200px; border-radius: 4px;"></div>`;
            } else if (isAudio) {
                preview = `<div class="mt-2"><audio controls style="max-width: 100%; height: 30px;"><source src="${m.attachment_url}" type="audio/mpeg"></audio></div>`;
            } else if (isVideo) {
                preview = `<div class="mt-2"><video controls style="max-width: 100%; max-height: 200px; border-radius: 4px;"><source src="${m.attachment_url}" type="video/mp4"></video></div>`;
            } else {
                preview = `<div class="mt-2"><a href="${m.attachment_url}" target="_blank" class="btn btn-sm btn-outline-info">${icon} Ver archivo</a></div>`;
            }
        }
        
        const time = formatTime(m.created_at);
        const status = m.status === 'delivered' ? '✓✓' : (m.status === 'sent' ? '✓' : '✗');
        
        // Show unread indicator for user messages
        const unreadIndicator = !isAdmin && !m.is_read ? '<span class="badge bg-danger ms-2">No leído</span>' : '';
        
        return `
            <div class="d-flex mb-2">
                <div class="chat-message ${msgClass} p-2 rounded" style="max-width: 70%; word-wrap: break-word;">
                    ${content}
                    ${preview}
                    <div class="small mt-1" style="opacity: 0.7;">
                        ${time}
                        ${isAdmin ? `<span class="ms-2">${status}</span>` : ''}
                        ${unreadIndicator}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Scroll to bottom
    chatDiv.scrollTop = chatDiv.scrollHeight;
}

async function loadPredefinedAssets() {
    try {
        // Load predefined assets
        const resAssets = await fetch(`${API_BASE}/admin/predefined-assets`, {
            headers: { 'X-API-Token': apiToken }
        });
        if (!resAssets.ok) throw new Error('Failed to load assets');
        const dataAssets = await resAssets.json();
        allPredefinedAssets = dataAssets.assets || [];
        
        // Load stripe links
        const resLinks = await fetch(`${API_BASE}/admin/stripe-links`, {
            headers: { 'X-API-Token': apiToken }
        });
        if (!resLinks.ok) throw new Error('Failed to load links');
        const dataLinks = await resLinks.json();
        allStripeLinks = dataLinks.links || [];
    } catch (e) {
        console.error('Error loading assets:', e);
    }
}

function showPredefinedAssets(assetType) {
    selectedAssetType = assetType;
    const modal = new bootstrap.Modal(document.getElementById('assetsModal'));
    const filtered = allPredefinedAssets.filter(a => a.asset_type === assetType);
    
    const container = document.getElementById('assetsListContainer');
    if (!filtered.length) {
        container.innerHTML = `<div class="text-center text-muted">No hay ${assetType}s predefinidos</div>`;
    } else {
        container.innerHTML = `
            <div class="row">
                ${filtered.map(a => `
                    <div class="col-md-6 mb-2">
                        <div class="card p-2 cursor-pointer" onclick="selectAsset(${a.id})">
                            <h6>${a.name}</h6>
                            ${a.description ? `<small>${a.description}</small>` : ''}
                            ${a.file_url ? `<small class="text-muted">📎 ${a.file_url.split('/').pop()}</small>` : ''}
                            ${a.link_url ? `<small class="text-muted">🔗 ${a.link_url}</small>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    modal.show();
}

function selectAsset(assetId) {
    const asset = allPredefinedAssets.find(a => a.id === assetId);
    if (asset) {
        document.getElementById('messageText').value = asset.name;
        bootstrap.Modal.getInstance(document.getElementById('assetsModal')).hide();
        sendManualMessage(assetId);
    }
}

function showStripeLinks() {
    const modal = new bootstrap.Modal(document.getElementById('linksModal'));
    
    const container = document.getElementById('linksListContainer');
    if (!allStripeLinks.length) {
        container.innerHTML = `<div class="text-center text-muted">No hay links de pago predefinidos</div>`;
    } else {
        container.innerHTML = `
            <div class="list-group">
                ${allStripeLinks.map(link => `
                    <label class="list-group-item">
                        <input type="checkbox" class="form-check-input me-2 stripe-link-checkbox" value="${link.id}" data-name="${link.name}" data-url="${link.url}">
                        <strong>${link.name}</strong>
                        <small class="text-muted d-block">${link.url}</small>
                    </label>
                `).join('')}
            </div>
            <div class="mt-3 d-flex gap-2">
                <button class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancelar</button>
                <button class="btn btn-success btn-sm ms-auto" onclick="sendSelectedLinks()">Enviar Links Seleccionados</button>
            </div>
        `;
    }
    modal.show();
}

function sendSelectedLinks() {
    const checkboxes = document.querySelectorAll('.stripe-link-checkbox:checked');
    if (!checkboxes.length) {
        showAlert('Selecciona al menos un link', 'warning');
        return;
    }
    
    const linkIds = Array.from(checkboxes).map(cb => cb.value).join(',');
    bootstrap.Modal.getInstance(document.getElementById('linksModal')).hide();
    sendManualMessage(null, linkIds);
}

function showAddAssetForm() {
    // Create new asset modal
    const form = `
        <form id="newAssetForm">
            <div class="mb-2">
                <label>Nombre</label>
                <input type="text" class="form-control form-control-sm" id="newAssetName" required>
            </div>
            <div class="mb-2">
                <label>Categoría</label>
                <input type="text" class="form-control form-control-sm" id="newAssetCategory">
            </div>
            <div class="mb-2">
                <label>Descripción</label>
                <textarea class="form-control form-control-sm" id="newAssetDesc" rows="2"></textarea>
            </div>
            <div class="mb-2">
                <label>Archivo / Link</label>
                <input type="file" class="form-control form-control-sm" id="newAssetFile">
            </div>
            <button type="button" class="btn btn-primary btn-sm" onclick="createNewAsset('${selectedAssetType}')">Crear</button>
        </form>
    `;
    document.getElementById('assetsListContainer').innerHTML = form;
}

async function createNewAsset(assetType) {
    const name = document.getElementById('newAssetName').value;
    const category = document.getElementById('newAssetCategory').value;
    const desc = document.getElementById('newAssetDesc').value;
    const file = document.getElementById('newAssetFile').files[0];
    
    if (!name) {
        showAlert('Ingresa un nombre', 'warning');
        return;
    }
    
    const fd = new FormData();
    fd.append('name', name);
    fd.append('asset_type', assetType);
    fd.append('category', category);
    fd.append('description', desc);
    if (file) fd.append('file', file);
    if (assetType === 'link') fd.append('link_url', document.getElementById('newAssetFile').value);
    
    try {
        const res = await fetch(`${API_BASE}/admin/predefined-assets`, {
            method: 'POST',
            headers: { 'X-API-Token': apiToken },
            body: fd
        });
        if (!res.ok) throw new Error('Failed');
        showAlert('Archivo creado', 'success');
        await loadPredefinedAssets();
        showPredefinedAssets(assetType);
    } catch (e) {
        showAlert('Error al crear archivo: ' + e.message, 'danger');
    }
}

async function sendManualMessage(assetId = null, linkIds = null) {
    if (!currentUserId) {
        showAlert('Selecciona un usuario', 'warning');
        return;
    }
    
    const content = document.getElementById('messageText').value;
    if (!content && !assetId && !linkIds) {
        showAlert('Escribe un mensaje o selecciona un archivo/link', 'warning');
        return;
    }
    
    const fd = new FormData();
    if (content) fd.append('content', content);
    fd.append('message_type', 'text');
    if (assetId) fd.append('predefined_asset_id', assetId);
    if (linkIds) fd.append('strip_link_ids', linkIds);
    
    try {
        const res = await fetch(`${API_BASE}/admin/users/${currentUserId}/chat/message`, {
            method: 'POST',
            headers: { 'X-API-Token': apiToken },
            body: fd
        });
        if (!res.ok) throw new Error('Failed');
        document.getElementById('messageText').value = '';
        await selectUserForChat(currentUserId, currentUserTelegramId, document.getElementById('chatUserName').textContent);
        showAlert('Mensaje enviado', 'success');
    } catch (e) {
        showAlert('Error al enviar: ' + e.message, 'danger');
    }
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const fd = new FormData();
    fd.append('content', file.name);
    fd.append('message_type', 'file');
    fd.append('attachment', file);
    
    // Upload file with message
    fetch(`${API_BASE}/admin/users/${currentUserId}/chat/message`, {
        method: 'POST',
        headers: { 'X-API-Token': apiToken },
        body: fd
    }).then(res => {
        if (res.ok) {
            selectUserForChat(currentUserId, currentUserTelegramId, document.getElementById('chatUserName').textContent);
            showAlert('Archivo enviado', 'success');
        } else throw new Error('Upload failed');
    }).catch(e => showAlert('Error: ' + e.message, 'danger'));
    
    document.getElementById('fileUpload').value = '';
}

function toggleAssetsPanel() {
    // Can be expanded for more options later
}

// ─── Quick Messages Functions ──────────────────────────────────────────────

async function loadQuickMessages() {
    allQuickMessages = []; // clear first
    try {
        const res = await fetch(`${API_BASE}/admin/quick-messages`, {
            headers: { 'X-API-Token': apiToken }
        });
        if (!res.ok) throw new Error('Failed to load quick messages');
        const data = await res.json();
        allQuickMessages = data.messages || [];
        console.log(`[QuickMessages] Loaded ${allQuickMessages.length} messages`);
    } catch (e) {
        console.error('Error loading quick messages:', e);
    }
    // Always render after load attempt, even if empty
    if (typeof renderQuickMessagesAdmin === 'function') renderQuickMessagesAdmin();
}

function showQuickMessages() {
    const modal = new bootstrap.Modal(document.getElementById('quickMessagesModal'));
    
    const container = document.getElementById('quickMessagesListContainer');
    if (!allQuickMessages.length) {
        container.innerHTML = `<div class="text-center text-muted">No hay mensajes rápidos definidos</div>`;
    } else {
        container.innerHTML = `
            <div class="list-group">
                ${allQuickMessages.map(msg => `
                    <div class="list-group-item list-group-item-action p-2" onclick="selectQuickMessage(${msg.id})">
                        <div class="d-flex justify-content-between align-items-center">
                            <h6 class="mb-0">${msg.name}</h6>
                            <span class="badge bg-primary">ES</span>
                        </div>
                        <small class="text-muted d-block text-truncate">${msg.text_es}</small>
                        <div class="mt-1">
                            <small class="text-muted me-2">🇬🇧 ${msg.text_en.substring(0, 40)}...</small>
                        </div>
                        <div class="mt-1">
                            <small class="text-muted">🇵🇹 ${msg.text_pt.substring(0, 40)}...</small>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    modal.show();
}

function selectQuickMessage(msgId) {
    const msg = allQuickMessages.find(m => m.id === msgId);
    if (!msg || !currentUserId) return;
    
    // Get the user's language
    const user = allUsersChat.find(u => u.id === currentUserId);
    const lang = user ? user.language : 'es';
    
    // Select text based on user language
    let text;
    if (lang === 'en') {
        text = msg.text_en;
    } else if (lang === 'pt') {
        text = msg.text_pt;
    } else {
        text = msg.text_es; // Default Spanish
    }
    
    // Close modal and set text
    bootstrap.Modal.getInstance(document.getElementById('quickMessagesModal')).hide();
    document.getElementById('messageText').value = text;
    
    // Auto-send
    sendManualMessage();
}

function openCreateQuickMessageModal() {
    new bootstrap.Modal(document.getElementById('createQuickMessageModal')).show();
}

async function saveQuickMessage() {
    const name = document.getElementById('quickMessageName').value;
    const textEs = document.getElementById('quickMessageTextEs').value;
    const textEn = document.getElementById('quickMessageTextEn').value;
    const textPt = document.getElementById('quickMessageTextPt').value;
    
    if (!name || !textEs || !textEn || !textPt) {
        showAlert('Todos los campos son obligatorios', 'warning');
        return;
    }
    
    const fd = new FormData();
    fd.append('name', name);
    fd.append('text_es', textEs);
    fd.append('text_en', textEn);
    fd.append('text_pt', textPt);
    
    try {
        const res = await fetch(`${API_BASE}/admin/quick-messages`, {
            method: 'POST',
            headers: { 'X-API-Token': apiToken },
            body: fd
        });
        if (!res.ok) throw new Error('Failed');
        
        await loadQuickMessages();
        renderQuickMessagesAdmin();
        
        bootstrap.Modal.getInstance(document.getElementById('createQuickMessageModal')).hide();
        document.getElementById('quickMessageForm').reset();
        showAlert('Mensaje rápido guardado', 'success');
    } catch (e) {
        showAlert('Error al guardar: ' + e.message, 'danger');
    }
}

function renderQuickMessagesAdmin() {
    const container = document.getElementById('quickMessagesContainer');
    if (!container) return;
    
    if (!allQuickMessages.length) {
        container.innerHTML = '<div class="text-center text-muted">No hay mensajes rápidos definidos. Crea uno nuevo.</div>';
        return;
    }
    
    container.innerHTML = `
        <div class="table-responsive">
            <table class="table table-hover">
                <thead>
                    <tr>
                        <th>Nombre</th>
                        <th>🇪🇸 Español</th>
                        <th>🇬🇧 English</th>
                        <th>🇵🇹 Português</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${allQuickMessages.map(msg => `
                        <tr>
                            <td><strong>${msg.name}</strong></td>
                            <td><small>${msg.text_es.substring(0, 60)}${msg.text_es.length > 60 ? '...' : ''}</small></td>
                            <td><small>${msg.text_en.substring(0, 60)}${msg.text_en.length > 60 ? '...' : ''}</small></td>
                            <td><small>${msg.text_pt.substring(0, 60)}${msg.text_pt.length > 60 ? '...' : ''}</small></td>
                            <td>
                                <button class="btn btn-danger btn-sm" onclick="deleteQuickMessage(${msg.id})">
                                    <i class="bi bi-trash"></i>
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

async function deleteQuickMessage(msgId) {
    if (!confirm('¿Eliminar este mensaje rápido?')) return;
    
    try {
        const res = await fetch(`${API_BASE}/admin/quick-messages/${msgId}`, {
            method: 'DELETE',
            headers: { 'X-API-Token': apiToken }
        });
        if (!res.ok) throw new Error('Failed');
        
        await loadQuickMessages();
        renderQuickMessagesAdmin();
        showAlert('Mensaje eliminado', 'success');
    } catch (e) {
        showAlert('Error al eliminar: ' + e.message, 'danger');
    }
}

// ═══════════════════════════════════════════════════════════════════
//  Message Blocks  (Bloques de Mensajes Multi-Paso + Trilingüe)
// ═══════════════════════════════════════════════════════════════════

let allMessageBlocks = [];
let selectedBlockIdToSend = null;

async function loadMessageBlocks() {
    allMessageBlocks = []; // clear first to avoid stale data
    try {
        const res = await fetch(`${API_BASE}/admin/message-blocks`, {
            headers: { 'X-API-Token': apiToken }
        });
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        allMessageBlocks = data.blocks || [];
        console.log(`[Blocks] Loaded ${allMessageBlocks.length} blocks`);
    } catch (e) {
        console.error('[Blocks] Error loading:', e);
    }
    // Always render after load attempt, even if empty
    if (typeof renderMessageBlocksAdmin === 'function') renderMessageBlocksAdmin();
}

function renderMessageBlocksAdmin() {
    const container = document.getElementById('messageBlocksContainer');
    if (!container) return;

    if (!allMessageBlocks.length) {
        container.innerHTML = '<div class="text-center text-muted">No hay bloques de mensajes. Crea uno nuevo.</div>';
        return;
    }

    container.innerHTML = allMessageBlocks.map(block => {
        const stepCount = block.steps ? block.steps.length : 0;
        return `
            <div class="card mb-3 border-0 shadow-sm">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h6 class="card-title mb-1">${block.name}</h6>
                            <small class="text-muted d-block">${block.description || ''}</small>
                            <div class="mt-1">
                                <span class="badge bg-info text-dark">${stepCount} paso${stepCount !== 1 ? 's' : ''}</span>
                                ${block.category ? `<span class="badge bg-secondary ms-1">${block.category}</span>` : ''}
                            </div>
                        </div>
                        <div class="d-flex gap-1">
                            <button class="btn btn-sm btn-outline-primary" onclick="viewBlockSteps(${block.id})" title="Ver pasos">
                                <i class="bi bi-eye"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteMessageBlock(${block.id})" title="Eliminar">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function openCreateBlockModal() {
    document.getElementById('blockForm').reset();
    document.getElementById('blockEditId').value = '';
    const container = document.getElementById('blockStepsContainer');
    container.innerHTML = '';
    // Always start with at least 2 steps
    addBlockStep();
    addBlockStep();
    new bootstrap.Modal(document.getElementById('createBlockModal')).show();
}

let blockStepCounter = 0;

function addBlockStep() {
    blockStepCounter++;
    const container = document.getElementById('blockStepsContainer');
    const div = document.createElement('div');
    div.className = 'border rounded p-3 mb-2 step-item';
    div.dataset.stepId = blockStepCounter;
    div.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="fw-bold text-muted">Paso <span class="step-number">${container.children.length + 1}</span></span>
            <button type="button" class="btn btn-sm btn-outline-danger" onclick="this.closest('.step-item').remove(); reorderBlockSteps();">
                <i class="bi bi-trash"></i>
            </button>
        </div>
        <div class="mb-2">
            <label class="form-label small mb-1"><span class="badge bg-primary">ES</span></label>
            <textarea class="form-control form-control-sm step-text-es" rows="2" required placeholder="Texto en español..."></textarea>
        </div>
        <div class="mb-2">
            <label class="form-label small mb-1"><span class="badge bg-success">EN</span></label>
            <textarea class="form-control form-control-sm step-text-en" rows="2" required placeholder="Text in English..."></textarea>
        </div>
        <div class="mb-0">
            <label class="form-label small mb-1"><span class="badge bg-secondary">PT</span></label>
            <textarea class="form-control form-control-sm step-text-pt" rows="2" required placeholder="Texto em português..."></textarea>
        </div>
    `;
    container.appendChild(div);
    reorderBlockSteps();
}

function reorderBlockSteps() {
    const steps = document.querySelectorAll('#blockStepsContainer .step-item');
    steps.forEach((step, idx) => {
        step.querySelector('.step-number').textContent = idx + 1;
    });
}

async function saveMessageBlock() {
    const name = document.getElementById('blockName').value.trim();
    const category = document.getElementById('blockCategory').value.trim() || null;
    const description = document.getElementById('blockDescription').value.trim() || null;

    if (!name) {
        showAlert('El nombre del bloque es obligatorio', 'warning');
        return;
    }

    const stepElements = document.querySelectorAll('#blockStepsContainer .step-item');
    if (stepElements.length === 0) {
        showAlert('Añade al menos un paso al bloque', 'warning');
        return;
    }

    const steps = [];
    for (let i = 0; i < stepElements.length; i++) {
        const el = stepElements[i];
        const textEs = el.querySelector('.step-text-es').value.trim();
        const textEn = el.querySelector('.step-text-en').value.trim();
        const textPt = el.querySelector('.step-text-pt').value.trim();
        if (!textEs || !textEn || !textPt) {
            showAlert(`Completa todos los idiomas en el paso ${i + 1}`, 'warning');
            return;
        }
        steps.push({
            step_order: i + 1,
            text_es: textEs,
            text_en: textEn,
            text_pt: textPt
        });
    }

    const payload = { name, category, description, steps };

    try {
        const res = await fetch(`${API_BASE}/admin/message-blocks`, {
            method: 'POST',
            headers: {
                'X-API-Token': apiToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Failed');

        bootstrap.Modal.getInstance(document.getElementById('createBlockModal')).hide();
        showAlert('Bloque de mensajes guardado', 'success');
        await loadMessageBlocks();
        renderMessageBlocksAdmin();
    } catch (e) {
        showAlert('Error al guardar: ' + e.message, 'danger');
    }
}

async function deleteMessageBlock(blockId) {
    if (!confirm('¿Eliminar este bloque de mensajes? Se eliminarán también todos sus pasos.')) return;

    try {
        const res = await fetch(`${API_BASE}/admin/message-blocks/${blockId}`, {
            method: 'DELETE',
            headers: { 'X-API-Token': apiToken }
        });
        if (!res.ok) throw new Error('Failed');

        await loadMessageBlocks();
        renderMessageBlocksAdmin();
        showAlert('Bloque eliminado', 'success');
    } catch (e) {
        showAlert('Error al eliminar: ' + e.message, 'danger');
    }
}

function viewBlockSteps(blockId) {
    const block = allMessageBlocks.find(b => b.id === blockId);
    if (!block) return;

    document.getElementById('viewBlockTitle').textContent = `Pasos: ${block.name}`;
    const container = document.getElementById('viewBlockStepsContainer');
    container.innerHTML = `
        <div class="list-group">
            ${block.steps.map(step => `
                <div class="list-group-item">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="badge bg-primary">Paso ${step.step_order}</span>
                    </div>
                    <div class="mb-1"><span class="badge bg-primary me-1">ES</span> ${step.text_es}</div>
                    <div class="mb-1"><span class="badge bg-success me-1">EN</span> ${step.text_en}</div>
                    <div class="mb-0"><span class="badge bg-secondary me-1">PT</span> ${step.text_pt}</div>
                </div>
            `).join('')}
        </div>
    `;
    new bootstrap.Modal(document.getElementById('viewBlockStepsModal')).show();
}

// ─── Chat Integration: Send Message Block ────────────────────────────

function showMessageBlocks() {
    const modal = new bootstrap.Modal(document.getElementById('messageBlocksModal'));
    const container = document.getElementById('blocksListContainer');

    if (!allMessageBlocks.length) {
        container.innerHTML = `<div class="text-center text-muted">No hay bloques definidos</div>`;
        modal.show();
        return;
    }

    container.innerHTML = `
        <div class="list-group">
            ${allMessageBlocks.map(block => {
                const steps = block.steps || [];
                return `
                    <div class="list-group-item list-group-item-action p-2" onclick="selectMessageBlock(${block.id})">
                        <div class="d-flex justify-content-between align-items-center">
                            <h6 class="mb-0">${block.name}</h6>
                            <span class="badge bg-info text-dark">${steps.length} paso${steps.length !== 1 ? 's' : ''}</span>
                        </div>
                        <small class="text-muted d-block">${block.description || ''}</small>
                        <div class="mt-1">
                            <small class="text-muted">Paso 1: ${steps[0] ? steps[0].text_es.substring(0, 45) : ''}${steps[0] && steps[0].text_es.length > 45 ? '...' : ''}</small>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    modal.show();
}

function selectMessageBlock(blockId) {
    const block = allMessageBlocks.find(b => b.id === blockId);
    if (!block || !currentUserId) return;

    // Determine user language
    const user = allUsersChat.find(u => u.id === currentUserId);
    const lang = user ? (['es','en','pt'].includes(user.language) ? user.language : 'en') : 'es';

    selectedBlockIdToSend = blockId;

    // Close blocks modal and show preview
    bootstrap.Modal.getInstance(document.getElementById('messageBlocksModal')).hide();

    const previewContainer = document.getElementById('blockPreviewContainer');
    const steps = block.steps || [];
    previewContainer.innerHTML = steps.map((step, idx) => {
        const text = step[`text_${lang}`] || step.text_es;
        return `
            <div class="d-flex align-items-start mb-2">
                <span class="badge bg-primary me-2 mt-1">${idx + 1}</span>
                <div class="border rounded p-2 bg-light flex-grow-1">
                    <div class="small">${escapeHtml(text)}</div>
                </div>
            </div>
        `;
    }).join('');

    document.getElementById('blockPreviewTitle').textContent = `Enviar "${block.name}"`;
    new bootstrap.Modal(document.getElementById('blockPreviewModal')).show();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function confirmSendBlock() {
    if (!selectedBlockIdToSend || !currentUserId) return;

    const btn = document.getElementById('confirmSendBlockBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Enviando...';

    try {
        const res = await fetch(`${API_BASE}/admin/message-blocks/${selectedBlockIdToSend}/send/${currentUserId}`, {
            method: 'POST',
            headers: { 'X-API-Token': apiToken }
        });
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();

        bootstrap.Modal.getInstance(document.getElementById('blockPreviewModal')).hide();
        showAlert(`Bloque enviado: ${data.sent}/${data.total} mensajes`, 'success');
        await loadChatHistory(currentUserId);
    } catch (e) {
        showAlert('Error enviando bloque: ' + e.message, 'danger');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-send"></i> Enviar Bloque';
    }
}
