import { t } from '../../i18n/index.js';
/** Backup admin key is intentionally held in memory only, never in localStorage. */
import { query, escapeHtml as h } from '../../ui/dom.js';
import { request, httpResponseError } from '../../api.js';
import { jobErrorText } from '../../i18n/job-errors.js';
import { toast } from '../../ui/notifications.js';
import { profileForm } from '../../views/backups.js';
export function createBackupController({ state, render, showModal, closeModal }) {
    let token = '';
    let restorePassword = '';
    let pollTimer = null;
    const get = (url, options = {}) => request(url, {
        ...options, headers: { ...options.headers, 'X-Backup-Admin-Token': token }
    });
    function redraw() { if (state.page === 'settings' && !state.modal) render(); }
    async function refresh(quiet = false) {
        if (!token) return;
        try {
            state.backupDashboard = await get('/api/backups');
            state.backupError = '';
            state.backupUnlocked = true;
            redraw();
            if (!quiet) toast(t("backups.status.refreshed"));
        } catch (err) {
            if (err.code === 'api.errors.backupManagementIsLockedAdministratorKeyRequired' || err.status === 401) lock();
            else { state.backupError = err.message; if (!quiet) toast(err.message, true); }
        }
    }
    async function unlock(event) {
        event.preventDefault();
        const entered = event.target.elements.token.value;
        if (!entered) return;
        token = entered;
        try {
            state.backupDashboard = await get('/api/backups');
            state.backupUnlocked = true;
            state.backupError = '';
            redraw();
        } catch (err) {
            token = '';
            state.backupError = err.message;
            state.backupUnlocked = false;
            redraw();
        }
    }
    function lock() {
        token = '';
        restorePassword = '';
        state.backupUnlocked = false;
        state.backupDashboard = null;
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = null;
        redraw();
    }
    function edit(id) {
        const profile = state.backupDashboard?.profiles.find(p => p.id === id);
        if (id && !profile) return toast(t("backups.profiles.notFound"), true);
        showModal(profile ? t("backups.profiles.edit") : t("backups.profiles.add"),
            profileForm(profile, state.backupDashboard?.remotes || [], state.backupDashboard?.targets || []), true);
        toggleFields(document.querySelector('#backup-profile-form'));
    }
    function toggleFields(form) {
        if (!form) return;
        const local = form.elements.provider.value === 'local';
        for (const row of form.querySelectorAll('[data-backup-local], [data-backup-cloud]')) {
            const display = row.hasAttribute('data-backup-local') ? local : !local;
            row.hidden = !display;
            for (const control of row.querySelectorAll('input, select')) control.disabled = !display;
        }
    }
    async function save(event) {
        event.preventDefault();
        const form = event.target;
        const el = name => form.elements[name];
        const id = form.dataset.id;
        const input = {
            name: el('name').value.trim(), provider: el('provider').value,
            remote: el('provider').value === 'local' ? '' : el('remote').value.trim(),
            targetPath: el('provider').value === 'local' ? el('localTargetPath').value : el('cloudTargetPath').value.trim(),
            enabled: el('enabled').checked,
            schedule: { frequency: el('frequency').value, hour: Number(el('hour').value),
                minute: Number(el('minute').value), weekday: Number(el('weekday').value) },
            retention: { daily: Number(el('daily').value), weekly: Number(el('weekly').value), monthly: Number(el('monthly').value) },
        };
        const button = form.querySelector('[type="submit"]');
        if (button.disabled) return;
        button.disabled = true;
        try {
            await get(id ? `/api/backups/${encodeURIComponent(id)}` : '/api/backups', {
                method: id ? 'PUT' : 'POST', body: JSON.stringify(input)
            });
            closeModal();
            await refresh(true);
            toast(id ? t("backups.profiles.updated") : t("backups.profiles.created"));
        } catch (err) { toast(err.message, true); button.disabled = false; }
    }
    async function setPassword(event) {
        event.preventDefault();
        const form = event.target;
        const password = form.elements.password.value;
        const confirm = form.elements.confirm.value;
        if (password !== confirm) return toast(t("backups.password.mismatch"), true);
        const button = form.querySelector('[type="submit"]');
        button.disabled = true;
        try {
            await get('/api/backups/password', { method: 'POST', body: JSON.stringify({
                password, confirm, previous: form.elements.previous?.value || ''
            }) });
            form.reset(); await refresh(true);
            toast(t("backups.password.savedAdvice"));
        } catch (error) { toast(error.message, true); button.disabled = false; }
    }
    async function downloadManual() {
        if (!token) return toast(t("backups.security.openManagementFirst"), true);
        try {
            const response = await fetch('/api/export/zip', {
                headers: { 'X-Backup-Admin-Token': token }, cache: 'no-store'
            });
            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                throw httpResponseError(response.status, body);
            }
            const disposition = response.headers.get('content-disposition') || '';
            const name = disposition.match(/filename="?([^";]+)"?/i)?.[1] || 'whisky-backup.zip';
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            try {
                const link = document.createElement('a');
                link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();
            } finally { setTimeout(() => URL.revokeObjectURL(url), 60000); }
        } catch (error) { toast(error.message, true); }
    }
    async function job(id, type, body = {}) {
        try {
            const queued = await get(`/api/backups/${encodeURIComponent(id)}/${type}`, {
                method: 'POST', body: JSON.stringify(body)
            });
            toast(t("backups.jobs.started"));
            await refresh(true);
            watchJob(queued.id);
        } catch (err) { toast(err.message, true); }
    }
    function watchJob(id) {
        if (pollTimer) clearInterval(pollTimer);
        let attempts = 0, pending = false;
        pollTimer = setInterval(async () => {
            if (pending || !token) return;
            pending = true;
            attempts++;
            try {
                await refresh(true);
                const found = state.backupDashboard?.jobs?.find(j => j.id === id);
                if (found && ['success', 'failed'].includes(found.state)) {
                    clearInterval(pollTimer); pollTimer = null;
                    if (found.state === 'success' && found.importId) {
                        try { promptPreparedZip(found.importId, found.filename); }
                        catch (error) { toast(error.message, true); }
                    } else {
                        toast(found.state === 'success' ? (found.message || t("backups.jobs.succeeded")) : jobErrorText(found.error), found.state === 'failed');
                    }
                } else if (attempts >= 180) {
                    clearInterval(pollTimer); pollTimer = null;
                    toast(t("backups.jobs.runningLonger"));
                }
            } finally { pending = false; }
        }, 2000);
    }
    async function download(id, filename) {
        if (!token) return toast(t("backups.security.unlockFirst"), true);
        const response = await fetch(`/api/backups/${encodeURIComponent(id)}/files/${encodeURIComponent(filename)}`, {
            headers: { 'X-Backup-Admin-Token': token }, cache: 'no-store'
        });
        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            return toast(httpResponseError(response.status, body).message, true);
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        try {
            const anchor = document.createElement('a');
            anchor.href = url; anchor.download = filename;
            document.body.append(anchor); anchor.click(); anchor.remove();
        } finally { setTimeout(() => URL.revokeObjectURL(url), 60000); }
    }
    function showZipPreview(result, filename) {
        showModal(t("backups.actions.validateAndRestoreZip"), `<form id="backup-apply-zip-form" data-id="${h(result.id)}">
          <p>${t("backups.summary.backupLabel")} <strong>${h(filename || t("backups.page.backupTitle"))}</strong></p>
          <p><strong>${result.bottlings}</strong> ${t("backups.summary.bottlingsLabel")} <strong>${result.bottles}</strong> ${t("backups.summary.bottlesLabel")} <strong>${result.distilleries}</strong> ${t("backups.summary.distilleriesLabel")}</p>
          <p>${t("features.backups.restoredAssets",{count:result.files,size:(result.bytes / 1048576).toFixed(1)})}</p>
          <p class="warning">${t("backups.restore.replaceIncludesAttachments")}</p>
          <label class="backup-checkbox"><input type="checkbox" name="acknowledge" required> ${t("backups.restore.confirmReplaceCollection")}</label>
          <div class="actions" style="justify-content:flex-end;margin-top:18px">
            <button class="btn" type="button" data-act="backup-download-prepared" data-id="${h(result.id)}">${t("backups.actions.downloadZip")}</button>
            <button class="btn" type="button" data-act="close-modal">${t("common.actions.cancel")}</button>
            <button class="btn danger" type="submit">${t("backups.actions.importBackup")}</button>
          </div></form>`, true);
    }
    function promptPreparedZip(id, filename) {
        showModal(t("backups.password.zipEnter"), `<form id="backup-unlock-zip-form" data-id="${h(id)}" data-filename="${h(filename || 'Sicherung.zip')}">
          <p>${t("backups.restore.savedArchive")} <strong>${h(filename || '')}</strong> ${t("backups.restore.openForPreview")}</p>
          <label class="form-field">${t("backups.password.archiveLabel")}<input type="password" name="password" autocomplete="off" placeholder="${t("backups.password.optionalForLegacy")}"></label>
          <div class="actions"><button type="button" class="btn" data-act="close-modal">${t("common.actions.cancel")}</button>
          <button type="submit" class="btn primary">${t("backups.actions.validateZip")}</button></div></form>`, true);
    }
    async function unlockPrepared(event) {
        event.preventDefault();
        const form = event.target;
        const password = form.elements.password.value;
        const button = form.querySelector('[type="submit"]');
        button.disabled = true;
        try {
            const result = await get(`/api/backups/import-zip/${encodeURIComponent(form.dataset.id)}/unlock`, {
                method: 'POST', body: JSON.stringify({ password })
            });
            restorePassword = password;
            showZipPreview(result, form.dataset.filename);
        } catch (error) { toast(error.message, true); button.disabled = false; }
    }
    async function downloadPrepared(id) {
        if (!token) return;
        const response = await fetch(`/api/backups/import-zip/${encodeURIComponent(id)}/download`, {
            headers: { 'X-Backup-Admin-Token': token }, cache: 'no-store'
        });
        if (!response.ok) throw httpResponseError(response.status, await response.json().catch(() => ({})));
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        try {
            const a = document.createElement('a'); a.href = url; a.download = 'whisky-backup-wiederherstellung.zip';
            document.body.append(a); a.click(); a.remove();
        } finally { setTimeout(() => URL.revokeObjectURL(url), 60000); }
    }
    async function uploadZip(event) {
        event.preventDefault();
        if (!token) return toast(t("backups.security.unlockFirst"), true);
        const form = event.target;
        const file = form.elements.archive.files?.[0];
        if (!file) return;
        const button = form.querySelector('[type="submit"]');
        button.disabled = true;
        try {
            const response = await fetch('/api/backups/import-zip', {
                method: 'POST', headers: { 'Content-Type': 'application/zip', 'X-Backup-Admin-Token': token, 'X-Backup-Zip-Password': encodeURIComponent(form.elements.password.value) }, body: file
            });
            const result = await response.json();
            if (!response.ok) throw httpResponseError(response.status, result);
            restorePassword = form.elements.password.value;
            showZipPreview(result, file.name);
        } catch (error) { toast(error.message, true); }
        finally { button.disabled = false; }
    }
    async function applyZip(event) {
        event.preventDefault();
        const form = event.target;
        if (!form.elements.acknowledge.checked) return;
        const button = form.querySelector('[type="submit"]');
        button.disabled = true;
        try {
            await get(`/api/backups/import-zip/${encodeURIComponent(form.dataset.id)}/apply`, {
                method: 'POST', body: JSON.stringify({ acknowledge: true, password: restorePassword })
            });
            restorePassword = ''; closeModal();
            window.location.reload();
        } catch (error) { toast(error.message, true); button.disabled = false; }
    }
    function remove(id) {
        const profile = state.backupDashboard?.profiles.find(p => p.id === id);
        if (!profile) return;
        showModal(t("backups.profiles.delete"), `<p>${t("backups.schedule.should")} <strong>${h(profile.name)}</strong> ${t("backups.confirmation.deleteSuffix")}</p>
        <p class="warning">${t("backups.profiles.deleteDoesNotDeleteArchives")}</p>
        <div class="actions" style="justify-content:flex-end;margin-top:20px">
        <button type="button" class="btn" data-act="close-modal">${t("common.actions.cancel")}</button>
        <button type="button" class="btn danger" data-act="backup-confirm-delete" data-id="${h(id)}">${t("backups.profiles.deleteAction")}</button></div>`);
    }
    async function confirmDelete(id) {
        try {
            await get(`/api/backups/${encodeURIComponent(id)}`, { method: 'DELETE' });
            closeModal(); await refresh(true); toast(t("backups.profiles.deletedArchivesKept"));
        } catch (err) { toast(err.message, true); }
    }
    function restore(id) {
        const profile = state.backupDashboard?.profiles.find(p => p.id === id);
        if (!profile) return;
        const snapshots = state.backupDashboard?.snapshots?.[id] || [];
        const zip = profile.format === 'zip';
        showModal(t("backups.actions.restoreBackup"), `<form id="backup-restore-form" data-id="${h(id)}">
        <p>${t("backups.profiles.label")} <strong>${h(profile.name)}</strong></p>
        <p class="muted">${zip ? t("backups.restore.validationBeforeOverwrite") : t("backups.legacy.resticConvertExplanation")}</p>
        <label class="form-field">${t("backups.archives.snapshot")}
        <select name="snapshotId" required>${snapshots.length ? snapshots.map(s => `<option value="${h(s.id)}">${h(s.shortId)} · ${h(new Date(s.time).toLocaleString('de-DE'))}</option>`).join('') : `<option value="latest">${t("backups.legacy.latestSnapshot")}</option>`}</select></label>
        <label class="backup-checkbox"><input type="checkbox" name="acknowledge" required> ${t("backups.restore.confirmInspectBackup")}</label>
        <div class="actions" style="justify-content:flex-end;margin-top:20px">
        <button type="button" class="btn" data-act="close-modal">${t("common.actions.cancel")}</button>
        <button type="submit" class="btn primary">${t("backups.restore.preparePreview")}</button></div></form>`, true);
    }
    async function submitRestore(event) {
        event.preventDefault();
        const form = event.target;
        if (!form.elements.acknowledge.checked) return;
        const id = form.dataset.id;
        const snapshotId = form.elements.snapshotId.value;
        closeModal();
        await job(id, 'prepare', { snapshotId });
    }
    return { unlock, lock, refresh, edit, save, setPassword, downloadManual, unlockPrepared, job, download, downloadPrepared, toggleFields, uploadZip, applyZip, remove, confirmDelete, restore, submitRestore };
}
