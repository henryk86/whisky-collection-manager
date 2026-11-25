import {createBackupDashboardViewModel} from './models/backups.js';
import {composeMarkup} from '../ui/render-plan.js';
import {headingTitle} from '../ui/headers.js';
import {t, tHtml, currentLanguage} from '../i18n/index.js';
/**
 * One place for manual, scheduled and restorative backups. All archives are
 * ZIP.
 */
import {addActionLabel, successIcon, warningIcon, moreIcon}
  from '../ui/action-icons.js';
import {escapeHtml as h} from '../ui/dom.js';
import {jobErrorText} from '../i18n/job-errors.js';
import {loadTemplates} from '../ui/templates.js';
import {createProfileViewModel, providerOptions}
  from '../features/backups/profile-model.js';

const renderTemplate = await loadTemplates('backups/backups.html');


/**
 * Formats time for presentation.
 *
 * @param {*} value Value to process.
 * @return {*} Result computed from the supplied inputs.
 */
const labelTime = value => value ? new Date(value).toLocaleString(currentLanguage()) : t("backups.status.notYet");

/**
 * Builds the localized schedule text text for the current language.
 *
 * @param {*} p Point or data value used in the calculation.
 * @return {*} Value returned by the delegated operation.
 */
const scheduleText = p => {
  const s = p.schedule || {};
  const time = `${String(s.hour ?? 0).padStart(2, '0')}:${String(s.minute ?? 0).padStart(2, '0')}`;
  if (s.frequency === 'hourly') return t('backups.schedule.hourlyText', {minute: String(s.minute ?? 0).padStart(2, '0')});
  if (s.frequency === 'weekly') return t(
    'backups.schedule.weeklyText',
    {
      weekday: t([
        'backups.weekdays.shortSun',
        'backups.weekdays.shortMon',
        'backups.weekdays.shortTue',
        'backups.weekdays.shortWed',
        'backups.weekdays.shortThu',
        'backups.weekdays.shortFri',
        'backups.weekdays.shortSat',
      ][s.weekday ?? 0]),
      time,
    }
  );
  return t("backups.schedule.dailyText", {time});
};

/**
 * Builds the localized manual text for the current language.
 *
 * @param {*} unlocked Value used by this operation.
 * @return {string} Resulting text.
 */
const manual = unlocked =>
  renderTemplate('backupStep', {
    backupManualDownload: unlocked ? renderTemplate('backupManualDownload') : renderTemplate('hint'),
  });

/**
 * Renders backup section for backups.
 *
 * @param {!Object} state Current application state.
 * @return {string} Resulting text.
 */
export function renderBackupSection(state) {
  const dash = state.backupDashboard;
  if (!state.backupUnlocked || !dash) {
    return renderTemplate('backupManagement', {
      headingTitle: headingTitle({title: t('backups.page.title'), }),
      manual: manual(false),
      content: 'deploy/secrets/backup-admin-token',
      warning: state.backupError ? renderTemplate('warning', {backupError: state.backupError, }) : '',
    });
  }
  const {profiles, targets, jobs, profileRows} = createBackupDashboardViewModel(dash);
  const worker = dash.worker?.online ? renderTemplate('backupStatus') : renderTemplate('backupStatus2');
  return renderTemplate('backupManagement2', {
    headingTitle: headingTitle({title: t('backups.page.title'), }),
    zipAndTimezone: t("backups.page.zipAndTimezone", {zone: h(dash.timeZone || 'Europe/Berlin')}),
    worker: worker,
    manual: manual(Boolean(dash.passwordConfigured)),
    passwordConfigured: dash.passwordConfigured ? 'muted' : 'warning',
    passwordConfigured2: dash.passwordConfigured ? t("backups.password.encryptionEnabled") : t("backups.password.requiredBeforeBackup"),
    formField: dash.passwordConfigured ? renderTemplate('formField') : '',
    passwordConfigured3: dash.passwordConfigured ? t("backups.password.new") : t("backups.password.label"),
    warning: dash.passwordConfigured ? renderTemplate('warning2') : '',
    passwordConfigured4: dash.passwordConfigured ? t("backups.password.change") : t("backups.password.configure"),
    length: targets.length ? t("backups.targets.preparedLocalTargets", {targets: targets.map(item => item.label).join(', ')}) : renderTemplate('renderBackupSection'),
    addActionLabel: addActionLabel(t("backups.targets.configure")),
    warning2: !dash.worker?.online ? renderTemplate('warning3') : '',
    length2: profiles.length ?
      composeMarkup(profileRows.map(({profile: p, legacy, snapshots, last}) => {
        return renderTemplate('backupProfile', {
          name: p.name,
          legacy: legacy ? '' : p.enabled ? 'online' : '',
          legacy2: legacy ?
            t("backups.legacy.resticProfile") : p.enabled ? t("backups.schedule.enabled") : t("backups.schedule.manual"),
          content: ({
            local: t('backups.providers.local'),
            other: t('backups.providers.other'),
          })[p.provider] || providerOptions[p.provider] ||
            p.provider,
          provider: p.provider === 'local' ? p.targetPath : `${p.remote}:${p.targetPath}`,
          warning: legacy ?
            renderTemplate('warning4') : renderTemplate('muted', {
              enabled: p.enabled ? scheduleText(p) : t("backups.schedule.notConfigured"),
              retentionSummary: t(
                "backups.schedule.retentionSummary",
                {
                  daily: p.retention.daily,
                  weekly: p.retention.weekly,
                  monthly: p.retention.monthly,
                }
              ),
            }),
          lastJob: tHtml(
            "backups.jobs.lastJob",
            {
              summary: last ? `${labelTime(last.startedAt)} (${last.state})` : t("backups.jobs.none"),
            }
          ),
          legacy3: legacy ? '' : renderTemplate('backupRun', {id: p.id, }),
          id: p.id,
          backupRestore: legacy ? renderTemplate('backupRestore', {id: p.id, }) : renderTemplate('backupRestore2', {id: p.id, }),
          id2: p.id,
          id3: p.id,
          id4: p.id,
          id5: p.id,
          backupSnapshotList: snapshots.length ?
            renderTemplate('backupSnapshotList', {
              snapshots: composeMarkup(snapshots.map(s =>
                renderTemplate('backupSnapshot', {
                  labelTime: labelTime(s.time),
                  size: s.size ? ` · ${h((s.size / 1048576).toFixed(1))} MiB` : '',
                  backupDownload: !legacy && p.provider === 'local' ?
                    renderTemplate('backupDownload', {
                      id: p.id,
                      filename: s.filename,
                    }) : '',
                  id: p.id,
                  id2: s.id,
                }))),
            }) : renderTemplate('muted2'),
        });
      })) : renderTemplate('muted3'),
    length3: jobs.length ? composeMarkup(jobs.map(j =>
      renderTemplate('backupJob', {
        state: j.state,
        state2: j.state === 'success' ? successIcon : j.state === 'failed' ? warningIcon : moreIcon,
        content: ({
          run: t('backups.jobs.run'),
          test: t('backups.jobs.test'),
          check: t('backups.jobs.check'),
          snapshots: t('backups.jobs.snapshots'),
          restore: t('backups.jobs.restore'),
          prepare: t('backups.jobs.prepare'),
        })[j.type] || j.type,
        name: profiles.find(p => p.id === j.profileId)?.name || t("backups.profiles.remoteProfileLabel"),
        labelTime: labelTime(j.startedAt),
        backupJobError: j.state === 'failed' ? renderTemplate('backupJobError', {jobErrorText: jobErrorText(j), }) : '',
        muted: j.message ? renderTemplate('muted4', {message: j.message, }) : '',
      }))) :
      renderTemplate('muted5'),
  });
}

/**
 * Renders a list of options with a single selected value.
 *
 * @param {!Array<!Object>} options Value and label pairs.
 * @param {*} current The selected value.
 * @return {string} Rendered option elements.
 */
function renderOptions(options, current) {
  return composeMarkup(options.map(({value, label}) => renderTemplate(
    'profileOption',
    {
      value,
      label,
      selected: value === current ? 'selected' : '',
    }
  )));
}

/**
 * Renders the prepared backup profile form.
 *
 * @param {!Object=} profile Existing backup profile or new-profile defaults.
 * @param {!Array<string>=} remotes Available Rclone connection names.
 * @param {!Array<!Object>=} targets Configured local storage targets.
 * @return {string} Backup profile form markup.
 */
export function profileForm(profile = {}, remotes = [], targets = []) {
  const model = createProfileViewModel(profile, remotes, targets);
  const {schedule, retention} = model;
  return renderTemplate('backupProfileForm', {
    id: model.id,
    warning: model.legacy ? renderTemplate('legacyProfileWarning') : '',
    name: model.name,
    providerOptions: renderOptions(model.providers, model.provider),
    targetOptions: renderOptions(model.targets, model.targetPath),
    remote: model.remote,
    remoteOptions: composeMarkup(model.remotes.map(value => renderTemplate('remoteOption', {value}))),
    cloudTargetPath: model.cloudTargetPath,
    frequencyOptions: renderOptions(model.frequencies, schedule.frequency),
    hour: schedule.hour,
    minute: schedule.minute,
    weekdayOptions: renderOptions(model.weekdays, schedule.weekday),
    dailyRetention: retention.daily,
    weeklyRetention: retention.weekly,
    monthlyRetention: retention.monthly,
    enabled: model.enabled ? 'checked' : '',
  });
}
