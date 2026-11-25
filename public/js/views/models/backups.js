/**
 * Prepares backup profile summaries and recent jobs for presentation.
 * @param {!Object} dash Current backup dashboard data.
 * @return {!Object} Profiles, targets, jobs and related summaries.
 */
export function createBackupDashboardViewModel(dash) {
  const profiles = dash.profiles || [];
  const targets = dash.targets || [];
  const jobs = (dash.jobs || []).slice(0, 12);
  const profileRows = profiles.map(profile => ({
    profile,
    legacy: profile.format !== 'zip',
    snapshots: (dash.snapshots?.[profile.id] || []).slice(0, 15),
    last: jobs.find(j => j.profileId === profile.id && j.type === 'run'),
  }));
  return {profiles, targets, jobs, profileRows};
}
