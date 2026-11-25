

/**
 * Builds the backup actions for delegated application events.
 * @param {!Object} options Dependencies of the event group.
 * @return {!Object} Action handlers keyed by action name.
 */
export function createBackupActions({backup}) {
  return {
    /**
     * Handles the backup refresh interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'backup-refresh': () => backup.refresh(),

    /**
     * Handles the backup manual download interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'backup-manual-download': () => backup.downloadManual(),

    /**
     * Handles the backup lock interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'backup-lock': () => backup.lock(),

    /**
     * Handles the backup new interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'backup-new': () => backup.edit(),

    /**
     * Handles the backup edit interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'backup-edit': button => backup.edit(button.dataset.id),

    /**
     * Handles the backup run interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'backup-run': button => backup.job(button.dataset.id, 'run'),

    /**
     * Handles the backup test interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'backup-test': button => backup.job(button.dataset.id, 'test'),

    /**
     * Handles the backup check interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'backup-check': button => backup.job(button.dataset.id, 'check'),

    /**
     * Handles the backup snapshots interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'backup-snapshots': button => backup.job(button.dataset.id, 'snapshots'),

    /**
     * Handles the backup restore interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'backup-restore': button => backup.restore(button.dataset.id),

    /**
     * Handles the backup prepare interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'backup-prepare': button => backup.job(button.dataset.id, 'prepare', {snapshotId: button.dataset.file}),

    /**
     * Handles the backup download prepared interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'backup-download-prepared': button =>
      backup.downloadPrepared(button.dataset.id),

    /**
     * Handles the backup download interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'backup-download': button => backup.download(button.dataset.id, button.dataset.file),

    /**
     * Handles the backup delete interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'backup-delete': button => backup.remove(button.dataset.id),

    /**
     * Handles the backup confirm delete interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'backup-confirm-delete': button => backup.confirmDelete(button.dataset.id),
  };
}
