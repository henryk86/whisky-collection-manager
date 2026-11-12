import { t, tHtml, currentLanguage } from '../i18n/index.js';
/** One place for manual, scheduled and restorative backups. All archives are ZIP. */
import { escapeHtml as h } from '../ui/dom.js';

export const providerOptions = {
    local: 'USB / NAS / lokaler Ordner', dropbox: 'Dropbox', 'google-drive': 'Google Drive',
    onedrive: 'OneDrive', sftp: 'SFTP / VPS', s3: 'S3 / Backblaze B2', webdav: 'WebDAV', other: 'Andere Rclone-Verbindung'
};
const formatOf = p => p.format === 'zip' ? 'zip' : 'legacy';
const labelTime = value => value ? new Date(value).toLocaleString(currentLanguage()) : t("backups.status.notYet");
const scheduleText = p => {
    const s = p.schedule || {};
    const time = `${String(s.hour ?? 0).padStart(2,'0')}:${String(s.minute ?? 0).padStart(2,'0')}`;
    if (s.frequency === 'hourly') return t('backups.schedule.hourlyText',{minute:String(s.minute??0).padStart(2,'0')});
    if (s.frequency === 'weekly') return t('backups.schedule.weeklyText',{weekday:t(['backups.weekdays.shortSun','backups.weekdays.shortMon','backups.weekdays.shortTue','backups.weekdays.shortWed','backups.weekdays.shortThu','backups.weekdays.shortFri','backups.weekdays.shortSat'][s.weekday??0]),time});
    return t("backups.schedule.dailyText",{time});
};
const manual = unlocked => `<div class="backup-step"><h4>${t("backups.sections.downloadDirectly")}</h4>
  <p class="muted">${t("backups.export.encryptedZipDescription")}</p>
  ${unlocked ? `<button type="button" class="btn primary" data-act="backup-manual-download">${t("backups.export.downloadProtected")}</button>` : `<p class="hint">${t("backups.security.managementRequiredForDownload")}</p>`}
  <p class="hint">${t("backups.password.safeStorageAdvice")}</p></div>`;
export function renderBackupSection(state) {
    const dash = state.backupDashboard;
    if (!state.backupUnlocked || !dash) {
        return `<section class="panel section backup-management" id="backup-management">
        <div class="backup-head"><div><h3>${t("backups.page.title")}</h3><p class="muted">${t("backups.page.zipWorkflowDescription")}</p></div></div>
        ${manual(false)}
        <div class="backup-step"><h4>${t("backups.sections.automaticAndRestore")}</h4>
        <p class="muted">${t("backups.security.adminKeyRequiredForJobs")}</p>
        <form id="backup-unlock-form" class="backup-unlock">
          <label class="form-field">${t("backups.security.adminKey")}<input id="backup-admin-key" name="token" type="password" autocomplete="off" minlength="24" required placeholder="${t("backups.password.enterOnce")}"></label>
          <button type="submit" class="btn primary">${t("backups.security.openManagement")}</button>
        </form><p class="hint">${t("backups.security.adminKeySessionInfo")} <code>${'deploy/secrets/backup-admin-token'}</code>).</p>
        ${state.backupError ? `<p class="warning" role="alert">${h(state.backupError)}</p>` : ''}</div></section>`;
    }
    const profiles = dash.profiles || [];
    const targets = dash.targets || [];
    const jobs = (dash.jobs || []).slice(0, 12);
    const worker = dash.worker?.online ? `<span class="backup-status online">${t("backups.status.workerOnline")}</span>` : `<span class="backup-status offline">${t("backups.status.workerOffline")}</span>`;
    return `<section class="panel section backup-management" id="backup-management">
      <div class="backup-head"><div><h3>${t("backups.page.title")}</h3><p class="muted">${t("backups.page.zipAndTimezone",{zone:h(dash.timeZone || 'Europe/Berlin')})}</p></div>${worker}</div>
      ${manual(Boolean(dash.passwordConfigured))}
      <div class="backup-step"><h4>${t("backups.password.label")}</h4>
        <p class="${dash.passwordConfigured ? 'muted' : 'warning'}">${dash.passwordConfigured ? t("backups.password.encryptionEnabled") : t("backups.password.requiredBeforeBackup")}</p>
        <form id="backup-password-form" class="backup-form">
          ${dash.passwordConfigured ? `<label class="form-field">${t("backups.password.previous")}<input type="password" name="previous" autocomplete="off" required></label>` : ''}
          <label class="form-field">${dash.passwordConfigured ? t("backups.password.new") : t("backups.password.label")}<input type="password" name="password" autocomplete="new-password" minlength="14" maxlength="256" required></label>
          <label class="form-field">${t("backups.password.repeat")}<input type="password" name="confirm" autocomplete="new-password" minlength="14" maxlength="256" required></label>
          ${dash.passwordConfigured ? `<p class="warning">${t("backups.password.existingArchivesWarning")}</p>` : ''}
          <div class="actions"><button type="submit" class="btn">${dash.passwordConfigured ? t("backups.password.change") : t("backups.password.configure")}</button></div>
        </form>
      </div>
      <div class="backup-step"><div class="backup-head"><div><h4>${t("backups.sections.scheduledBackups")}</h4><p class="muted">${t("backups.targets.storageRetentionDescription")}</p></div></div>
        <p class="muted">${targets.length ? t("backups.targets.preparedLocalTargets",{targets:targets.map(item => item.label).join(', ')}) : `${t("backups.usb.mountInstructionBefore")} <code>sh deploy/setup-usb.sh</code> ${t("backups.usb.mountInstructionAfter")}`}</p>
        <div class="actions backup-tools"><button type="button" class="btn primary" data-act="backup-new">${t("backups.targets.configure")}</button>
          <button type="button" class="btn" data-act="backup-refresh">${t("backups.actions.refresh")}</button>
          <button type="button" class="btn" data-act="backup-lock">${t("backups.security.lock")}</button></div>
        ${!dash.worker?.online ? `<p class="warning">${t("backups.status.workerUnavailable")}</p>` : ''}
        <div class="backup-profiles">${profiles.length ? profiles.map(p => {
            const legacy = formatOf(p) === 'legacy';
            const snapshots = (dash.snapshots?.[p.id] || []).slice(0, 15);
            const last = jobs.find(j => j.profileId === p.id && j.type === 'run');
            return `<article class="backup-profile">
              <div class="backup-card-head"><strong>${h(p.name)}</strong><span class="backup-status ${legacy ? '' : p.enabled ? 'online' : ''}">${legacy ? t("backups.legacy.resticProfile") : p.enabled ? t("backups.schedule.enabled") : t("backups.schedule.manual")}</span></div>
              <p class="muted">${h(({local:t('backups.providers.local'),other:t('backups.providers.other')})[p.provider] || providerOptions[p.provider] || p.provider)} · ${h(p.provider === 'local' ? p.targetPath : `${p.remote}:${p.targetPath}`)}</p>
              ${legacy ? `<p class="warning">${t("backups.legacy.resticDeprecatedInfo")}</p>` : `<p class="muted">ZIP · ${h(p.enabled ? scheduleText(p) : t("backups.schedule.notConfigured"))} · ${t("backups.schedule.retentionSummary",{daily:p.retention.daily,weekly:p.retention.weekly,monthly:p.retention.monthly})}</p>`}
              <p class="backup-last">${tHtml("backups.jobs.lastJob",{summary:last ? `${labelTime(last.startedAt)} (${last.state})` : t("backups.jobs.none")})}</p>
              <div class="actions backup-card-actions">
                ${legacy ? '' : `<button class="btn small primary" data-act="backup-run" data-id="${h(p.id)}">${t("backups.actions.runNow")}</button>`}
                <button class="btn small" data-act="backup-snapshots" data-id="${h(p.id)}">${t("backups.archives.show")}</button>
                ${legacy ? `<button class="btn small" data-act="backup-restore" data-id="${h(p.id)}">${t("backups.legacy.restoreBackup")}</button>` : `<button class="btn small" data-act="backup-restore" data-id="${h(p.id)}">${t("backups.actions.restoreZip")}</button>`}
                <button class="btn small" data-act="backup-test" data-id="${h(p.id)}">${t("backups.targets.test")}</button>
                <button class="btn small" data-act="backup-check" data-id="${h(p.id)}">${t("backups.actions.verifyIntegrity")}</button>
                <button class="btn small" data-act="backup-edit" data-id="${h(p.id)}">${t("common.actions.edit")}</button>
                <button class="btn small danger" data-act="backup-delete" data-id="${h(p.id)}">${t("common.actions.delete")}</button>
              </div>
              ${snapshots.length ? `<div class="backup-snapshot-list"><strong>${t("backups.archives.existing")}</strong>${snapshots.map(s => `<div class="backup-snapshot"><span>${h(labelTime(s.time))}${s.size ? ` · ${h((s.size / 1048576).toFixed(1))} MiB` : ''}</span>
                ${!legacy && p.provider === 'local' ? `<button class="btn small" data-act="backup-download" data-id="${h(p.id)}" data-file="${h(s.filename)}">${t("backups.actions.download")}</button>` : ''}
                <button class="btn small" data-act="backup-prepare" data-id="${h(p.id)}" data-file="${h(s.id)}">${t("backups.actions.applyBackup")}</button></div>`).join('')}</div>` : `<p class="muted">${t("backups.empty.noSnapshots")}</p>`}
              </article>`;
        }).join('') : `<p class="muted">${t("backups.empty.noTargets")}</p>`}</div>
      </div>
      <div class="backup-step"><h4>${t("backups.sections.restoreBackup")}</h4>
        <p class="muted">${t("backups.restore.uploadInstructions")}</p>
        <form id="backup-import-zip-form" class="backup-unlock"><label class="form-field">${t("backups.export.zipFilenameLabel")}
          <input name="archive" type="file" accept=".zip,application/zip" required></label>
          <label class="form-field">${t("backups.password.zipArchiveLabel")}<input name="password" type="password" autocomplete="off" placeholder="${t("backups.password.optionalForLegacy")}"></label>
          <button class="btn primary" type="submit">${t("backups.actions.validateZipAndPreview")}</button></form>
        <p class="hint">${t("backups.restore.confirmationCreatesSafetyBackup")}</p>
      </div>
      <h4>${t("backups.jobs.recent")}</h4>
      <div class="backup-job-list" role="list">${jobs.length ? jobs.map(j => `<div class="backup-job" role="listitem">
        <span class="backup-job-state ${h(j.state)}">${j.state === 'success' ? '✓' : j.state === 'failed' ? '!' : '…'}</span>
        <div><strong>${h(({run:t('backups.jobs.run'),test:t('backups.jobs.test'),check:t('backups.jobs.check'),snapshots:t('backups.jobs.snapshots'),restore:t('backups.jobs.restore'),prepare:t('backups.jobs.prepare')})[j.type] || j.type)}</strong> <span class="muted">· ${h(profiles.find(p => p.id === j.profileId)?.name || t("backups.profiles.remoteProfileLabel"))} · ${h(labelTime(j.startedAt))}</span>
        ${j.error ? `<p class="backup-job-error">${h(j.error)}</p>` : ''}${j.message ? `<p class="muted">${h(j.message)}</p>` : ''}</div></div>`).join('') : `<p class="muted">${t("backups.empty.noJobs")}</p>`}</div>
    </section>`;
}
export function profileForm(profile = {}, remotes = [], targets = []) {
    const legacy = Boolean(profile.id && profile.format !== 'zip');
    const p = { provider: 'local', targetPath: 'usb/whisky-zip', enabled: false,
        schedule: { frequency: 'daily', hour: 2, minute: 0, weekday: 0 },
        retention: { daily: 7, weekly: 4, monthly: 12 }, ...profile };
    if (legacy) p.targetPath = `${p.targetPath}-zip`;
    const isLocal = p.provider === 'local';
    const options = targets.map(t => ({ value: `${t.name}/whisky-zip`, label: `${t.label} (${t.name})` }));
    if (isLocal && !options.some(o => o.value === p.targetPath)) options.unshift({ value: p.targetPath, label: t('backups.targets.fallback',{path:p.targetPath}) });
    return `<form id="backup-profile-form" data-id="${h(profile.id || '')}" class="backup-form">
      ${legacy ? `<p class="warning">${t("backups.legacy.resticKeptNewZipTarget")}</p>` : ''}
      <label class="form-field">${t("backups.profiles.name")}<input name="name" maxlength="80" required value="${h(p.name || '')}" placeholder="${t("backups.targets.placeholderName")}"></label>
      <label class="form-field">${t("backups.profiles.storageLocation")}<select name="provider">${Object.entries(providerOptions).map(([k,v]) => `<option value="${h(k)}" ${p.provider === k ? 'selected' : ''}>${h(({local:t('backups.providers.local'),other:t('backups.providers.other')})[k] || v)}</option>`).join('')}</select></label>
      <p class="hint">${t("backups.summary.formatLabel")} <strong>${t("backups.export.aes256Protection")}</strong> ${t("backups.password.centralConfigurationInfo")}</p>
      <label class="form-field" data-backup-local>${t("backups.usb.target")}<select name="localTargetPath">${options.map(t => `<option value="${h(t.value)}" ${t.value === p.targetPath ? 'selected' : ''}>${h(t.label)}</option>`).join('')}</select>
        <small>${t("backups.usb.requiresMountedDrive")}</small></label>
      <label class="form-field" data-backup-cloud>${t("backups.cloud.rcloneConnection")}<input name="remote" list="backup-remote-list" maxlength="50" value="${h(p.remote || '')}" placeholder="${t("backups.cloud.placeholderProvider")}">
        <datalist id="backup-remote-list">${remotes.map(item => `<option value="${h(item)}"></option>`).join('')}</datalist></label>
      <label class="form-field" data-backup-cloud>${t("backups.cloud.subfolder")}<input name="cloudTargetPath" maxlength="180" value="${h(isLocal ? 'whisky-backups' : p.targetPath)}" placeholder="${'whisky-backups'}"></label>
      <fieldset class="backup-fieldset"><legend>${t("backups.schedule.optionalCron")}</legend><div class="backup-form-grid">
        <label class="form-field">${t("backups.schedule.frequency")}<select name="frequency">${[['hourly',t('backups.schedule.hourly')],['daily',t('backups.schedule.daily')],['weekly',t('backups.schedule.weekly')]].map(([k,v]) => `<option value="${k}" ${p.schedule.frequency === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="form-field">${t("backups.schedule.hour")}<input name="hour" type="number" min="0" max="23" value="${p.schedule.hour}" required></label>
        <label class="form-field">${t("backups.schedule.minute")}<input name="minute" type="number" min="0" max="59" value="${p.schedule.minute}" required></label>
        <label class="form-field">${t("backups.schedule.weekday")}<select name="weekday">${['backups.weekdays.sun','backups.weekdays.mon','backups.weekdays.tue','backups.weekdays.wed','backups.weekdays.thu','backups.weekdays.fri','backups.weekdays.sat'].map(t).map((day,i) => `<option value="${i}" ${p.schedule.weekday === i ? 'selected' : ''}>${day}</option>`).join('')}</select></label>
      </div></fieldset>
      <fieldset class="backup-fieldset"><legend>${t("backups.settings.retention")}</legend><div class="backup-form-grid">${[['daily',t('backups.schedule.dailyRetention')],['weekly',t('backups.schedule.weeklyRetention')],['monthly',t('backups.schedule.monthlyRetention')]].map(([k,v]) => `<label class="form-field">${v}<input name="${k}" type="number" min="0" max="${{daily:366,weekly:104,monthly:120}[k]}" required value="${p.retention[k]}"></label>`).join('')}</div></fieldset>
      <label class="backup-checkbox"><input name="enabled" type="checkbox" ${legacy ? '' : p.enabled ? 'checked' : ''}> ${t("backups.schedule.enableAutomatic")}</label>
      <div class="actions" style="justify-content:flex-end;margin-top:18px"><button class="btn" type="button" data-act="close-modal">${t("common.actions.cancel")}</button><button class="btn primary" type="submit">${t("common.actions.save")}</button></div>
    </form>`;
}
