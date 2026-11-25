import {routeUrl} from '../navigation/routes.js';

/**
 * Builds the analytics actions for delegated application events.
 * @param {!Object} options Dependencies of the event group.
 * @return {!Object} Action handlers keyed by action name.
 */
export function createAnalyticsActions({navigate, state, render}) {
  return {
    /**
     * Handles the analytics section interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'analytics-section': button => navigate('analytics', button.dataset.section),

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
