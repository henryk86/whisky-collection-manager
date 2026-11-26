

/**
 * Builds the backup actions for delegated application events.
 * @param {!Object} options Dependencies of the event group.
 * @return {!Object} Action handlers keyed by action name.
 */
export function createBackupActions({backup}) {
  return {
    /**
     * Reloads the unlocked backup dashboard.
     * @return {Promise<void>} Resolves after the dashboard refresh or error handling.
     */
    'backup-refresh': () => backup.refresh(),

    /**
     * Downloads the manually created collection backup.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'backup-manual-download': () => backup.downloadManual(),

    /**
     * Clears the active backup administration session.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'backup-lock': () => backup.lock(),

    /**
     * Opens a new backup-profile form.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'backup-new': () => backup.edit(),

    /**
     * Opens the selected backup profile for editing.
     * @param {!HTMLElement} button Action element carrying data-id.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'backup-edit': button => backup.edit(button.dataset.id),

    /**
     * Queues a backup run for the selected profile.
     * @param {!HTMLElement} button Action element carrying data-id.
     * @return {Promise<void>} Resolves after queuing and refreshing the dashboard or reporting an error.
     */
    'backup-run': button => backup.job(button.dataset.id, 'run'),

    /**
     * Queues a connectivity test for the selected backup profile.
     * @param {!HTMLElement} button Action element carrying data-id.
     * @return {Promise<void>} Resolves after queuing and refreshing the dashboard or reporting an error.
     */
    'backup-test': button => backup.job(button.dataset.id, 'test'),

    /**
     * Queues a repository integrity check for the selected profile.
     * @param {!HTMLElement} button Action element carrying data-id.
     * @return {Promise<void>} Resolves after queuing and refreshing the dashboard or reporting an error.
     */
    'backup-check': button => backup.job(button.dataset.id, 'check'),

    /**
     * Queues retrieval of snapshots for the selected profile.
     * @param {!HTMLElement} button Action element carrying data-id.
     * @return {Promise<void>} Resolves after queuing and refreshing the dashboard or reporting an error.
     */
    'backup-snapshots': button => backup.job(button.dataset.id, 'snapshots'),

    /**
     * Opens the selected profile's restore flow.
     * @param {!HTMLElement} button Action element carrying data-id.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'backup-restore': button => backup.restore(button.dataset.id),

    /**
     * Queues preparation of the selected snapshot for download.
     * @param {!HTMLElement} button Action element carrying data-id, data-file.
     * @return {Promise<void>} Resolves after queuing and refreshing the dashboard or reporting an error.
     */
    'backup-prepare': button => backup.job(button.dataset.id, 'prepare', {snapshotId: button.dataset.file}),

    /**
     * Downloads the prepared backup artifact identified by the action.
     * @param {!HTMLElement} button Action element carrying data-id.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'backup-download-prepared': button =>
      backup.downloadPrepared(button.dataset.id),

    /**
     * Downloads the selected file from the specified backup profile.
     * @param {!HTMLElement} button Action element carrying data-id, data-file.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'backup-download': button => backup.download(button.dataset.id, button.dataset.file),

    /**
     * Starts the profile-removal confirmation flow.
     * @param {!HTMLElement} button Action element carrying data-id.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'backup-delete': button => backup.remove(button.dataset.id),

    /**
     * Confirms removal of the selected backup profile.
     * @param {!HTMLElement} button Action element carrying data-id.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'backup-confirm-delete': button => backup.confirmDelete(button.dataset.id),
  };
}
