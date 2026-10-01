const reportsList = document.querySelector('#reports-list');
const reportsStatus = document.querySelector('#reports-status');
const reportFormSection = document.querySelector('#report-form-section');
const reportForm = document.querySelector('#report-form');
const reportFormStatus = document.querySelector('#report-form-status');
const channelId = new URLSearchParams(location.search).get('channelId');
let editingReport = null;

async function loadUser() {
  const response = await fetch('/api/users/me');
  if (!response.ok) { location.href = '/login'; return false; }
  const user = await response.json();
  document.querySelector('#welcome').textContent = `Welcome, ${user.email}`;
  return true;
}

function formatReason(reason) {
  return reason.toLowerCase().split('_').map((word) => `${word[0].toUpperCase()}${word.slice(1)}`).join(' ');
}

function showToast(message, isError = false) {
  const toast = document.createElement('div');
  toast.className = `toast${isError ? ' toast-error' : ''}`;
  toast.textContent = message;
  document.body.append(toast);
  setTimeout(() => toast.remove(), 3000);
}

function createReportItem(report) {
  const item = document.createElement('article');
  item.className = 'report-item';
  const channel = document.createElement('h3');
  channel.textContent = report.channelId?.name || 'Channel unavailable';
  const reason = document.createElement('p');
  reason.textContent = `Reason: ${formatReason(report.reason)}`;
  const description = document.createElement('p');
  description.textContent = report.description;
  const status = document.createElement('p');
  status.className = 'report-status';
  status.textContent = report.status;
  const created = document.createElement('p');
  created.className = 'report-date';
  created.textContent = new Date(report.createdAt).toLocaleString();
  item.append(channel, reason, description, status, created);
      if (report.evidenceUrls?.length) {
        const evidenceBox = document.createElement('div');
        evidenceBox.className = 'report-evidence';
        report.evidenceUrls.forEach((url, index) => {
          const evidence = document.createElement('a');
          evidence.href = url;
          evidence.target = '_blank';
          evidence.rel = 'noopener';
          evidence.textContent = report.evidenceUrls.length > 1
            ? `View evidence image ${index + 1}`
            : 'View evidence image';
          evidenceBox.append(evidence);
        });
        item.append(evidenceBox);
      }
  
    const actions = document.createElement('div');
  actions.className = 'report-actions';

  const editButton = document.createElement('button');
  editButton.type = 'button';
  editButton.textContent = 'Edit';
  editButton.addEventListener('click', () => startEdit(report));

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'delete-button';
  deleteButton.textContent = 'Delete';
  deleteButton.addEventListener('click', async () => {
    if (!confirm('Delete this report? This cannot be undone.')) return;
    try {
      await deleteReport(report._id);
      if (editingReport?._id === report._id) stopEdit();
      await loadReports();
      showToast('Report has been successfully deleted.');
    } catch (error) {
      showToast(error.message, true);
    }
  });

  actions.append(editButton, deleteButton);
  item.append(actions);
  return item;
}

async function loadReports() {
  const response = await fetch('/api/reports');
  if (!response.ok) { reportsStatus.textContent = 'Could not load reports.'; return; }
  const { reports } = await response.json();
  reportsStatus.textContent = `${reports.length} report${reports.length === 1 ? '' : 's'}`;
  if (reports.length === 0) {
    reportsList.replaceChildren(Object.assign(document.createElement('p'), { className: 'empty-state', textContent: 'You have not reported a channel yet.' }));
    return;
  }
  reportsList.replaceChildren(...reports.map(createReportItem));
}

function startEdit(report) {
  editingReport = report;
  reportFormSection.hidden = false;
  document.querySelector('#report-form-title').textContent = 'Edit report';
  document.querySelector('#report-channel').textContent = report.channelId?.name || 'Channel unavailable';
  document.querySelector('#report-reason').value = report.reason;
  document.querySelector('#report-description').value = report.description;
  document.querySelector('#report-status').value = report.status;
  document.querySelector('#report-status-field').hidden = false;
  document.querySelector('#report-evidence-field').hidden = true;
  document.querySelector('#report-submit').textContent = 'Save changes';
  document.querySelector('#report-cancel').hidden = false;
  reportFormStatus.textContent = '';
  reportFormSection.scrollIntoView({ behavior: 'smooth' });
}

function stopEdit() {
  editingReport = null;
  reportForm.reset();
  document.querySelector('#report-form-title').textContent = 'Report a problem';
  document.querySelector('#report-channel').textContent = 'Report the selected channel.';
  document.querySelector('#report-status-field').hidden = true;
  document.querySelector('#report-evidence-field').hidden = false;
  document.querySelector('#report-submit').textContent = 'Submit report';
  document.querySelector('#report-cancel').hidden = true;
  reportFormSection.hidden = !channelId;
}

async function submitReport(event) {
  event.preventDefault();
    if (editingReport) {
    reportFormStatus.textContent = 'Saving changes…';
    try {
      await updateReport(editingReport._id, {
        reason: document.querySelector('#report-reason').value,
        description: document.querySelector('#report-description').value,
        status: document.querySelector('#report-status').value
      });
    } catch (error) {
      reportFormStatus.textContent = error.message;
      return;
    }
    stopEdit();
    await loadReports();
    return;
  }

  event.preventDefault();
  const formData = new FormData();
  formData.append('channelId', channelId);
  formData.append('reason', document.querySelector('#report-reason').value);
  formData.append('description', document.querySelector('#report-description').value);
  const evidence =
    document.querySelector('#report-evidence').files[0];
  // TODO v4.5 4:
  // Completa el nombre del campo utilizado para enviar la imagen.
  // Objetivo: relacionar el archivo del formulario con upload.single().
  // Resultado esperado: Multer reconocerá la evidencia enviada por el navegador.
  const evidenceFiles =
  document.querySelector('#report-evidence').files;

  for (const file of evidenceFiles) {
    formData.append('evidence', file);
  }

  reportFormStatus.textContent = 'Submitting report…';
  // TODO v4.5 5:
  // Completa el body de la petición utilizando el FormData construido.
  // Objetivo: enviar los campos de texto y la evidencia en una misma solicitud.
  // Resultado esperado: POST /api/reports recibirá correctamente multipart/form-data.
  const response = await fetch('/api/reports', {
    method: 'POST',
    body: formData
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    reportFormStatus.textContent = payload.error?.message || 'Could not submit the report.';
    return;
  }

  reportForm.reset();
  reportFormStatus.textContent = 'Report saved.';
  await loadReports();
}

function configureReportForm() {
  reportForm.addEventListener('submit', submitReport);
  document.querySelector('#report-cancel').addEventListener('click', stopEdit);
  if (!channelId) return;
  reportFormSection.hidden = false;
  document.querySelector('#report-channel-id').value = channelId;
  document.querySelector('#report-channel').textContent = 'Report the selected channel.';
}

async function updateReport(reportId, { reason, description, status }) {
  const response = await fetch(`/api/reports/${reportId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ reason, description, status })
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error?.message || 'Could not update the report.');
  }

  const { report } = await response.json();
  return report;
}

async function deleteReport(reportId) {
  const response = await fetch(`/api/reports/${reportId}`, {
    method: 'DELETE'
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error?.message || 'Could not delete the report.');
  }
}

document.querySelector('#logout').addEventListener('click', async () => { await fetch('/api/auth/logout', { method: 'POST' }); location.href = '/login'; });
async function start() { if (await loadUser()) { configureReportForm(); await loadReports(); } }
start();
