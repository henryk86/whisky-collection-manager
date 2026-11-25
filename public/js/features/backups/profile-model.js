/** @fileoverview Presentation data for editing a backup profile. */
import {t} from '../../i18n/index.js';

export const providerOptions = {
  local: 'USB / NAS / lokaler Ordner',
  dropbox: 'Dropbox',
  'google-drive': 'Google Drive',
  onedrive: 'OneDrive',
  sftp: 'SFTP / VPS',
  s3: 'S3 / Backblaze B2',
  webdav: 'WebDAV',
  other: 'Andere Rclone-Verbindung',
};
/**
 * Resolves the provider names for the active language.
 *
 * @return {!Array<!Object>} Available provider values and display labels.
 */
function localizedProviders() {
  const labels = {
    local: t('backups.providers.local'),
    other: t('backups.providers.other'),
  };
  return Object.entries(providerOptions).map(([value, label]) => ({
    value,
    label: labels[value] || label,
  }));
}

/**
 * Normalizes profile defaults and derives the available form options.
 * Legacy profiles keep their original repository and start disabled.
 *
 * @param {!Object=} profile Existing or incomplete profile.
 * @param {!Array<string>=} remotes Available Rclone connections.
 * @param {!Array<!Object>=} targets Configured local storage targets.
 * @return {!Object} Display-ready profile without HTML or DOM dependencies.
 */
export function createProfileViewModel(
  profile = {}, remotes = [], targets = []
) {
  const legacy = Boolean(profile.id && profile.format !== 'zip');
  const provider = profile.provider ?? 'local';
  const path = profile.targetPath ?? 'usb/whisky-zip';
  const targetPath = legacy ? `${path}-zip` : path;
  const local = provider === 'local';
  const options = targets.map(({name, label}) => ({
    value: `${name}/whisky-zip`,
    label: `${label} (${name})`,
  }));
  if (local && !options.some(option => option.value === targetPath)) {
    options.unshift({
      value: targetPath,
      label: t('backups.targets.fallback', {path: targetPath}),
    });
  }
  const frequencies = [
    ['hourly', t('backups.schedule.hourly')],
    ['daily', t('backups.schedule.daily')],
    ['weekly', t('backups.schedule.weekly')],
  ].map(([value, label]) => ({value, label}));
  const weekdays = [
    'backups.weekdays.sun', 'backups.weekdays.mon', 'backups.weekdays.tue',
    'backups.weekdays.wed', 'backups.weekdays.thu', 'backups.weekdays.fri',
    'backups.weekdays.sat',
  ].map((key, value) => ({value, label: t(key)}));
  return {
    id: profile.id || '',
    name: profile.name || '',
    provider,
    providers: localizedProviders(),
    legacy,
    enabled: !legacy && Boolean(profile.enabled),
    targetPath,
    targets: options,
    remote: profile.remote || '',
    remotes,
    cloudTargetPath: local ? 'whisky-backups' : targetPath,
    frequencies,
    weekdays,
    schedule: {
      frequency: 'daily', hour: 2, minute: 0, weekday: 0,
      ...profile.schedule,
    },
    retention: {daily: 7, weekly: 4, monthly: 12, ...profile.retention},
  };
}
