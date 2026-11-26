import {composeMarkup} from '../../ui/render-plan.js';
import {actionButton} from '../../ui/buttons.js';
import {t} from '../../i18n/index.js';
/**
 * Backup admin key is intentionally held in memory only, never in localStorage.
 */
import {query} from '../../ui/dom.js';
import {request, httpResponseError} from '../../api.js';
import {jobErrorText} from '../../i18n/job-errors.js';
import {toast} from '../../ui/notifications.js';
import {profileForm} from '../../views/backups.js';
import {loadTemplates} from '../../ui/templates.js';

const renderTemplate = await loadTemplates('backups/controller.html');

/**
 * Creates the backup-management controller with an in-memory administrator token and restore state.
 *
 * @param {!Object} options Optional configuration for the operation.
 * @return {!Object} Backup settings, job, password and restore operations.
 */
export function createBackupController({state, render, showModal, closeModal}) {
  let token = '';
  let restorePassword = '';
  let pollTimer = null;
  /**
   * Sends a backup API request with the current administrator token.
   *
   * @param {*} url URL of the resource being processed.
   * @param {!Object=} options Options controlling the operation.
   * @return {!Promise<*>} Decoded API response for the administrator-authorized backup request.
   */
  const get = (url, options = {}) => request(url, {
    ...options, headers: {...options.headers, 'X-Backup-Admin-Token': token},
  });

  /**
   * Rerenders the settings page only when no modal is open.
   */
  function redraw() {if (state.page === 'settings' && !state.modal) render();}

  /**
   * Reloads the backup dashboard and locks management if the server rejects the token.
   *
   * @param {boolean=} quiet Suppress the success notification during automatic refreshes.
   * @return {!Promise<*>} Completion of the dashboard refresh attempt.
   */
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
      else {
        state.backupError = err.message; if (!quiet) toast(err.message, true);
      }
    }
  }

  /**
   * Verifies an entered administrator token and opens the backup dashboard on success.
   *
   * @param {!Event} event Event that triggered this operation.
   * @return {!Promise<*>} Completion of the unlock attempt.
   */
  async function unlock(event) {
    event.preventDefault();
    const entered = /** @type {HTMLFormElement & {elements: {token: HTMLInputElement}}} */ (event.target).elements.token.value;
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

  /**
   * Clears backup credentials and dashboard data and stops job polling.
   */
  function lock() {
    token = '';
    restorePassword = '';
    state.backupUnlocked = false;
    state.backupDashboard = null;
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
    redraw();
  }

  /**
   * Opens the profile editor for an existing or new backup destination.
   *
   * @param {*} id Identifier of the affected record.
   * @return {*} Notification if the requested profile no longer exists; otherwise opens the editor.
   */
  function edit(id) {
    const profile = state.backupDashboard?.profiles.find(p => p.id === id);
    if (id && !profile) return toast(t("backups.profiles.notFound"), true);
    showModal(
      profile ? t("backups.profiles.edit") : t("backups.profiles.add"),
      profileForm(profile, state.backupDashboard?.remotes || [], state.backupDashboard?.targets || []),
      true
    );
    toggleFields(document.querySelector('#backup-profile-form'));
  }

  /**
   * Shows and enables only the storage fields relevant to the selected backup provider.
   *
   * @param {*} form Backup profile form containing provider-specific fields.
   */
  function toggleFields(form) {
    if (!form) return;
    const local = form.elements.provider.value === 'local';
    for (const row of form.querySelectorAll('[data-backup-local], [data-backup-cloud]')) {
      const display = row.hasAttribute('data-backup-local') ? local : !local;
      row.hidden = !display;
      for (const control of row.querySelectorAll('input, select')) control.disabled = !display;
    }
  }

  /**
   * Updates the controller state.
   *
   * @param {!KeyboardEvent} event Event that triggered the handler.
   */
  async function save(event) {
    event.preventDefault();
    const form = /** @type {HTMLFormElement} */ (event.target);
    /**
     * Looks up a named input in the backup profile form.
     *
     * @param {*} name Environment variable or setting name.
     * @return {*} Named form control used to collect backup settings.
     */
    const el = name => form.elements[name];
    const id = form.dataset.id;
    const input = {
      name: el('name').value.trim(), provider: el('provider').value,
      remote: el('provider').value === 'local' ? '' : el('remote').value.trim(),
      targetPath: el('provider').value === 'local' ? el('localTargetPath').value : el('cloudTargetPath').value.trim(),
      enabled: el('enabled').checked,
      schedule: {
        frequency: el('frequency').value,
        hour: Number(el('hour').value),
        minute: Number(el('minute').value),
        weekday: Number(el('weekday').value),
      },
      retention: {
        daily: Number(el('daily').value),
        weekly: Number(el('weekly').value),
        monthly: Number(el('monthly').value),
      },
    };
    const button = /** @type {HTMLButtonElement} */ (form.querySelector('[type="submit"]'));
    if (button.disabled) return;
    button.disabled = true;
    try {
      await get(
        id ? `/api/backups/${encodeURIComponent(id)}` : '/api/backups',
        {
          method: id ? 'PUT' : 'POST', body: JSON.stringify(input),
        }
      );
      closeModal();
      await refresh(true);
      toast(id ? t("backups.profiles.updated") : t("backups.profiles.created"));
    } catch (err) {toast(err.message, true); button.disabled = false;}
  }

  /**
   * Validates password confirmation and submits the backup encryption password.
   *
   * @param {!Event} event Event that triggered this operation.
   * @return {!Promise<*>} Completion of the password update attempt.
   */
  async function setPassword(event) {
    event.preventDefault();
    const form = /** @type {HTMLFormElement & {elements: {password: HTMLInputElement, confirm: HTMLInputElement, previous?: HTMLInputElement}}} */ (event.target);
    const password = form.elements.password.value;
    const confirm = form.elements.confirm.value;
    if (password !== confirm) return toast(t("backups.password.mismatch"), true);
    const button = /** @type {HTMLButtonElement} */ (form.querySelector('[type="submit"]'));
    button.disabled = true;
    try {
      await get('/api/backups/password', {
        method: 'POST', body: JSON.stringify({
          password, confirm, previous: form.elements.previous?.value || '',
        }),
      });
      form.reset(); await refresh(true);
      toast(t("backups.password.savedAdvice"));
    } catch (error) {toast(error.message, true); button.disabled = false;}
  }

  /**
   * Loads manual for controller.
   *
   * @return {!Promise<void>} Completion of requesting the manual backup archive and initiating its download.
   */
  async function downloadManual() {
    if (!token) return toast(t("backups.security.openManagementFirst"), true);
    try {
      const response = await fetch('/api/export/zip', {
        headers: {'X-Backup-Admin-Token': token}, cache: 'no-store',
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
      } finally {setTimeout(() => URL.revokeObjectURL(url), 60000);}
    } catch (error) {toast(error.message, true);}
  }

  /**
   * Serializes job data to JSON.
   *
   * @param {*} id Identifier of the affected record.
   * @param {*} type Type or category used to select behavior.
   * @param {!Object=} body Body content to validate or process.
   * @return {!Promise<*>} Completion of queueing the backup job and starting its status polling.
   */
  async function job(id, type, body = {}) {
    try {
      const queued = await get(
        `/api/backups/${encodeURIComponent(id)}/${type}`,
        {
          method: 'POST', body: JSON.stringify(body),
        }
      );
      toast(t("backups.jobs.started"));
      await refresh(true);
      watchJob(queued.id);
    } catch (err) {toast(err.message, true);}
  }

  /**
   * Polls a backup job until completion and opens prepared-archive handling when required.
   *
   * @param {*} id Identifier of the affected record.
   */
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
            try {promptPreparedZip(found.importId, found.filename);}
            catch (error) {toast(error.message, true);}
          } else {
            toast(
              found.state === 'success' ? (found.message || t("backups.jobs.succeeded")) : jobErrorText(found),
              found.state === 'failed'
            );
          }
        } else if (attempts >= 180) {
          clearInterval(pollTimer); pollTimer = null;
          toast(t("backups.jobs.runningLonger"));
        }
      } finally {pending = false;}
    }, 2000);
  }

  /**
   * Loads the controller state.
   *
   * @param {string} id Identifier used to select the relevant record.
   * @param {string} filename File name used to locate the resource.
   * @return {!Promise<void>} Completion of requesting the backup file and initiating its download.
   */
  async function download(id, filename) {
    if (!token) return toast(t("backups.security.unlockFirst"), true);
    const response = await fetch(
      `/api/backups/${encodeURIComponent(id)}/files/${encodeURIComponent(filename)}`,
      {
        headers: {'X-Backup-Admin-Token': token}, cache: 'no-store',
      }
    );
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
    } finally {setTimeout(() => URL.revokeObjectURL(url), 60000);}
  }

  /**
   * Renders zip preview for controller.
   *
   * @param {*} result Result to process.
   * @param {string} filename File name used to locate the resource.
   */
  function showZipPreview(result, filename) {
    showModal(
      t("backups.actions.validateAndRestoreZip"),
      renderTemplate('backupApplyZipForm', {
        id: result.id,
        filename: filename || t("backups.page.backupTitle"),
        bottlings: result.bottlings,
        bottles: result.bottles,
        distilleries: result.distilleries,
        restoredAssets: t("features.backups.restoredAssets", {count: result.files, size: (result.bytes / 1048576).toFixed(1)}),
        restoreId: result.id,
        closeModalButton: actionButton({
          label: t("common.actions.cancel"),
          action: 'close-modal',
        }),
      }),
      true
    );
  }

  /**
   * Prompts for the encryption password of a prepared restore archive.
   *
   * @param {*} id Identifier of the affected record.
   * @param {*} filename File path or name to process.
   */
  function promptPreparedZip(id, filename) {
    showModal(
      t("backups.password.zipEnter"),
      renderTemplate('backupUnlockZipForm', {
        id: id,
        filename: filename || 'Sicherung.zip',
        displayFilename: filename || '',
        closeModalButton: actionButton({
          label: t("common.actions.cancel"),
          action: 'close-modal',
        }),
      }),
      true
    );
  }

  /**
   * Submits the archive password and displays the verified import preview.
   *
   * @param {!Event} event Event that triggered this operation.
   * @return {!Promise<*>} Completion of the archive-unlock attempt.
   */
  async function unlockPrepared(event) {
    event.preventDefault();
    const form = /** @type {HTMLFormElement & {elements: {password: HTMLInputElement}}} */ (event.target);
    const password = form.elements.password.value;
    const button = /** @type {HTMLButtonElement} */ (form.querySelector('[type="submit"]'));
    button.disabled = true;
    try {
      const result = await get(
        `/api/backups/import-zip/${encodeURIComponent(form.dataset.id)}/unlock`,
        {
          method: 'POST', body: JSON.stringify({password}),
        }
      );
      restorePassword = password;
      showZipPreview(result, form.dataset.filename);
    } catch (error) {toast(error.message, true); button.disabled = false;}
  }

  /**
   * Loads prepared for controller.
   *
   * @param {string} id Identifier used to select the relevant record.
   */
  async function downloadPrepared(id) {
    if (!token) return;
    const response = await fetch(
      `/api/backups/import-zip/${encodeURIComponent(id)}/download`,
      {
        headers: {'X-Backup-Admin-Token': token}, cache: 'no-store',
      }
    );
    if (!response.ok) throw httpResponseError(response.status, await response.json().catch(() => ({})));
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement('a'); a.href = url; a.download = 'whisky-backup-wiederherstellung.zip';
      document.body.append(a); a.click(); a.remove();
    } finally {setTimeout(() => URL.revokeObjectURL(url), 60000);}
  }

  /**
   * Uploads a selected ZIP archive for validation using the administrator token.
   *
   * @param {!Event} event Event that triggered this operation.
   * @return {!Promise<*>} Completion of the upload and preview attempt.
   */
  async function uploadZip(event) {
    event.preventDefault();
    if (!token) return toast(t("backups.security.unlockFirst"), true);
    const form = /** @type {HTMLFormElement & {elements: {archive: HTMLInputElement, password: HTMLInputElement}}} */ (event.target);
    const file = form.elements.archive.files?.[0];
    if (!file) return;
    const button = /** @type {HTMLButtonElement} */ (form.querySelector('[type="submit"]'));
    button.disabled = true;
    try {
      const response = await fetch('/api/backups/import-zip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/zip',
          'X-Backup-Admin-Token': token,
          'X-Backup-Zip-Password': encodeURIComponent(form.elements.password.value),
        },
        body: file,
      });
      const result = await response.json();
      if (!response.ok) throw httpResponseError(response.status, result);
      restorePassword = form.elements.password.value;
      showZipPreview(result, file.name);
    } catch (error) {toast(error.message, true);}
    finally {button.disabled = false;}
  }

  /**
   * Applies the verified archive after explicit acknowledgment and reloads the application.
   *
   * @param {!Event} event Event that triggered this operation.
   * @return {!Promise<*>} Completion of the restore request.
   */
  async function applyZip(event) {
    event.preventDefault();
    const form = /** @type {HTMLFormElement & {elements: {acknowledge: HTMLInputElement}}} */ (event.target);
    if (!form.elements.acknowledge.checked) return;
    const button = /** @type {HTMLButtonElement} */ (form.querySelector('[type="submit"]'));
    button.disabled = true;
    try {
      await get(
        `/api/backups/import-zip/${encodeURIComponent(form.dataset.id)}/apply`,
        {
          method: 'POST',
          body: JSON.stringify({acknowledge: true, password: restorePassword}),
        }
      );
      restorePassword = ''; closeModal();
      window.location.reload();
    } catch (error) {toast(error.message, true); button.disabled = false;}
  }

  /**
   * Opens confirmation for deleting a backup profile without deleting its archives.
   *
   * @param {*} id Identifier of the affected record.
   */
  function remove(id) {
    const profile = state.backupDashboard?.profiles.find(p => p.id === id);
    if (!profile) return;
    showModal(
      t("backups.profiles.delete"),
      renderTemplate('removeP', {
        name: profile.name,
        closeModalButton: actionButton({
          label: t("common.actions.cancel"),
          action: 'close-modal',
        }),
        id: id,
      })
    );
  }

  /**
   * Deletes the selected profile, refreshes the dashboard and reports the result.
   *
   * @param {*} id Identifier of the affected record.
   * @return {!Promise<*>} Completion of the profile-deletion attempt.
   */
  async function confirmDelete(id) {
    try {
      await get(`/api/backups/${encodeURIComponent(id)}`, {method: 'DELETE'});
      closeModal(); await refresh(true);
      toast(t("backups.profiles.deletedArchivesKept"));
    } catch (err) {toast(err.message, true);}
  }

  /**
   * Opens the restore dialog with available snapshots and format-specific warnings.
   *
   * @param {*} id Identifier of the affected record.
   */
  function restore(id) {
    const profile = state.backupDashboard?.profiles.find(p => p.id === id);
    if (!profile) return;
    const snapshots = state.backupDashboard?.snapshots?.[id] || [];
    const zip = profile.format === 'zip';
    showModal(
      t("backups.actions.restoreBackup"),
      renderTemplate('backupRestoreForm', {
        id: id,
        name: profile.name,
        zip: zip ? t("backups.restore.validationBeforeOverwrite") : t("backups.legacy.resticConvertExplanation"),
        length: snapshots.length ?
          composeMarkup(snapshots.map(s =>
            renderTemplate('restoreOption', {
              id: s.id,
              shortId: s.shortId,
              toLocaleString: new Date(s.time).toLocaleString('de-DE'),
            }))) :
          renderTemplate('restoreOption2'),
        closeModalButton: actionButton({
          label: t("common.actions.cancel"),
          action: 'close-modal',
        }),
      }),
      true
    );
  }

  /**
   * Queues preparation of the selected snapshot after overwrite acknowledgment.
   *
   * @param {!Event} event Event that triggered this operation.
   * @return {!Promise<*>} Completion of the prepare-job request.
   */
  async function submitRestore(event) {
    event.preventDefault();
    const form = /** @type {HTMLFormElement & {elements: {acknowledge: HTMLInputElement, snapshotId: HTMLInputElement}}} */ (event.target);
    if (!form.elements.acknowledge.checked) return;
    const id = form.dataset.id;
    const snapshotId = form.elements.snapshotId.value;
    closeModal();
    await job(id, 'prepare', {snapshotId});
  }
  return {
    unlock,
    lock,
    refresh,
    edit,
    save,
    setPassword,
    downloadManual,
    unlockPrepared,
    job,
    download,
    downloadPrepared,
    toggleFields,
    uploadZip,
    applyZip,
    remove,
    confirmDelete,
    restore,
    submitRestore,
  };
}
