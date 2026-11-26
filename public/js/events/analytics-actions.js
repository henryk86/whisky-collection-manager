import {buildInsuranceExport} from '../features/insurance/export.js';
import {t} from '../i18n/index.js';
import {toast} from '../ui/notifications.js';
import {routeUrl} from '../navigation/routes.js';

/**
 * Builds the analytics actions for delegated application events.
 * @param {!Object} options Dependencies of the event group.
 * @return {!Object} Action handlers keyed by action name.
 */
export function createAnalyticsActions({navigate, state, render}) {
  let exporting = false;
  return {
    /**
     * Navigates to the analytics subsection specified by the action.
     * @param {!HTMLElement} button Action element carrying data-section.
     * @return {void} Navigation is synchronous; no result is consumed.
     */
    'analytics-section': button => navigate('analytics', button.dataset.section),

    /** Toggles the optional sample scope and clears the selected checklist filter. */
    'insurance-samples': () => {
      state.insuranceIncludeSamples = !state.insuranceIncludeSamples;
      state.insuranceMissing = 'all';
      render();
    },
    /** Filters the actionable list by one missing type of evidence. @param {!HTMLElement} button Checklist control. */
    'insurance-missing': button => {
      state.insuranceMissing = button.dataset.key;
      render();
    },
    /**
     * Creates the selected export locally from a fixed inventory snapshot.
     * @param {!HTMLButtonElement} button Export control.
     * @return {Promise<void>} Download initiation or localized error notification.
     */
    'insurance-export': async button => {
      if (exporting) return;
      exporting = true;
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      const snapshot = structuredClone({collection: state.collection, warehouse: state.warehouse, insuranceIncludeSamples: state.insuranceIncludeSamples});
      try {
        toast(t('insurance.exportWorking'));
        const {file, name} = await buildInsuranceExport(snapshot, button.dataset.format);
        const url = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } catch (error) {
        toast(t('insurance.exportFailed'), true);
      } finally {
        exporting = false;
        button.disabled = false;
        button.removeAttribute('aria-busy');
      }
    },
    /**
     * Handles the analytics reset interaction.
     */
    'analytics-reset': () => {
      state.analyticsFilters = {distillery: 'all', country: 'all', volumeType: 'all', status: 'all'};
      state.analyticsPeriod = 'month'; state.analyticsStartDate = ''; state.analyticsEndDate = '';
      history.replaceState({whiskyRoute: true}, '', routeUrl('analytics', state.selected));
      render();
    },

    /**
     * Handles the analytics distillery interaction.
     *
     * @param {*} button Button control involved in the interaction.
     */
    'analytics-distillery': button => {
      state.distillery = button.dataset.id; state.pageNumber = 1; navigate('home');
    },

    /**
     * Handles the analytics drill filter interaction.
     *
     * @param {*} button Button control involved in the interaction.
     */
    'analytics-drill-filter': button => {
      if (button.dataset.kind === 'country') {
        state.analyticsFilters.country = button.dataset.value;
        history.replaceState({whiskyRoute: true}, '', routeUrl('analytics', state.selected, state.analyticsFilters));
        render(); return;
      }
      if (button.dataset.kind === 'status' && ['closed', 'open', 'empty'].includes(button.dataset.value)) state.status = button.dataset.value;
      else if (button.dataset.kind === 'volumeType' && ['standard', 'sample'].includes(button.dataset.value)) state.volumeType = button.dataset.value;
      state.pageNumber = 1; navigate('home');
    },
  };
}
