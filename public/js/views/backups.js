import {createBackupDashboardViewModel} from './models/backups.js';
import {composeMarkup} from '../ui/render-plan.js';
import {headingTitle} from '../ui/headers.js';
import {t, currentLanguage} from '../i18n/index.js';
/**
 * One place for manual, scheduled and restorative backups. All archives are
 * ZIP.
 */
import {addActionLabel, successIcon, warningIcon, moreIcon}
  from '../ui/action-icons.js';
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
 * Prepares manual backup and restore controls.
 *
 * @param {*} unlocked Value used by this operation.
 * @return {!import('../ui/render-plan.js').RenderPlan} Manual backup and restore controls.
 */
const manual = unlocked =>
  renderTemplate('backupStep', {
    backupManualDownload: unlocked ? renderTemplate('backupManualDownload') : renderTemplate('hint'),
  });

/**
 * Prepares backup dashboard section with profiles, jobs and storage information.
 *
 * @param {!Object} state Current application state.
 * @return {!import('../ui/render-plan.js').RenderPlan} Backup dashboard section with profiles, jobs and storage information.
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
  const {profiles, targets, jobRows, profileRows} = createBackupDashboardViewModel(dash);
  const worker = dash.worker?.online ? renderTemplate('backupStatus') : renderTemplate('backupStatus2');
  return renderTemplate('backupManagement2', {
    headingTitle: headingTitle({title: t('backups.page.title'), }),
    zipAndTimezone: t("backups.page.zipAndTimezone", {zone: String((dash.timeZone || 'Europe/Berlin') ?? '')}),
    worker: worker,
    manual: manual(Boolean(dash.passwordConfigured)),
    passwordConfigured: dash.passwordConfigured ? 'muted' : 'warning',
    encryptionStatus: dash.passwordConfigured ? t("backups.password.encryptionEnabled") : t("backups.password.requiredBeforeBackup"),
    formField: dash.passwordConfigured ? renderTemplate('formField') : '',
    passwordFieldLabel: dash.passwordConfigured ? t("backups.password.new") : t("backups.password.label"),
    warning: dash.passwordConfigured ? renderTemplate('warning2') : '',
    passwordActionLabel: dash.passwordConfigured ? t("backups.password.change") : t("backups.password.configure"),
    length: targets.length ? t("backups.targets.preparedLocalTargets", {targets: targets.map(item => item.label).join(', ')}) : renderTemplate('renderBackupSection'),
    addActionLabel: addActionLabel(t("backups.targets.configure")),
    workerWarning: !dash.worker?.online ? renderTemplate('warning3') : '',
    profileList: profiles.length ?
      composeMarkup(profileRows.map(({profile: p, legacy, snapshots, last}) => {
        return renderTemplate('backupProfile', {
          name: p.name,
          legacy: legacy ? '' : p.enabled ? 'online' : '',
          scheduleStatus: legacy ?
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
          lastJob: t(
            "backups.jobs.lastJob",
            {
              summary: last ? `${labelTime(last.startedAt)} (${last.state})` : t("backups.jobs.none"),
            }
          ),
          runAction: legacy ? '' : renderTemplate('backupRun', {id: p.id, }),
          id: p.id,
          backupRestore: legacy ? renderTemplate('backupRestore', {id: p.id, }) : renderTemplate('backupRestore2', {id: p.id, }),
          restoreProfileId: p.id,
          editProfileId: p.id,
          deleteProfileId: p.id,
          profileActionId: p.id,
          backupSnapshotList: snapshots.length ?
            renderTemplate('backupSnapshotList', {
              snapshots: composeMarkup(snapshots.map(s =>
                renderTemplate('backupSnapshot', {
                  labelTime: labelTime(s.time),
                  size: s.size ? ` · ${String(((s.size / 1048576).toFixed(1)) ?? '')} MiB` : '',
                  backupDownload: !legacy && p.provider === 'local' ?
                    renderTemplate('backupDownload', {
                      id: p.id,
                      filename: s.filename,
                    }) : '',
                  id: p.id,
                  file: s.id,
                }))),
            }) : renderTemplate('muted2'),
        });
      })) : renderTemplate('muted3'),
    jobList: jobRows.length ? composeMarkup(jobRows.map(({job: j, profileName}) =>
      renderTemplate('backupJob', {
        state: j.state,
        statusIcon: j.state === 'success' ? successIcon : j.state === 'failed' ? warningIcon : moreIcon,
        content: ({
          run: t('backups.jobs.run'),
          test: t('backups.jobs.test'),
          check: t('backups.jobs.check'),
          snapshots: t('backups.jobs.snapshots'),
          restore: t('backups.jobs.restore'),
          prepare: t('backups.jobs.prepare'),
        })[j.type] || j.type,
        name: profileName || t("backups.profiles.remoteProfileLabel"),
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
 * @return {import('../ui/render-plan.js').RenderPlan|string} Select options with the current value selected (or scalar/empty text when no plan is needed).
 */
function renderOptions(options, current) {
  return composeMarkup(options.map(({value, label}) => renderTemplate(
    'profileOption',
    {
      value,
      label,
      selectedAttributes: value === current ? {"selected": true} : {},
    }
  )));
}

/**
 * Renders the prepared backup profile form.
 *
 * @param {import('../../../shared/backup-profile-types.js').BackupProfileDraft=} profile Existing backup profile or new-profile defaults.
 * @param {!Array<string>=} remotes Available Rclone connection names.
 * @param {import('../../../shared/backup-profile-types.js').BackupTarget[]=} targets Configured local storage targets.
 * @return {!import('../ui/render-plan.js').RenderPlan} Backup profile editor with storage, schedule and retention controls.
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
    checkedAttributes: model.enabled ? {"checked": true} : {},
  });
}
