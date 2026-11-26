import {inventory, provenance, profile, finance, timeline, quality, overview} from './analytics-sections.js';
import {filterControls} from './analytics-controls.js';
import {createAnalyticsViewModel} from './models/analytics.js';
import {composeMarkup} from '../ui/render-plan.js';

import {headingTitle, pageHeader} from '../ui/headers.js';
import {t} from '../i18n/index.js';
/**
 * Analytics dashboard and six thematic pages. All datasets come from pure
 * domain calculations.
 */

import {sectionWorkspace} from '../ui/section-navigation.js';
import {analysisOverviewIcon, analysisInventoryIcon, analysisOriginsIcon, analysisProfileIcon, analysisFinanceIcon, analysisTimelineIcon, analysisQualityIcon} from '../ui/action-icons.js';
import {loadTemplates} from '../ui/templates.js';

const renderTemplate = await loadTemplates('analytics/analytics.html');

export const ANALYSIS_PAGES = Object.freeze([
  {
    id: 'overview',
    /**
     * Reads the title property from the current state.
     * @return {*} Value returned by the delegated operation.
     */
    get title() {return t("analytics.navigation.overview");},
    /**
     * Reads the sub property from the current state.
     * @return {*} Value returned by the delegated operation.
     */
    get sub() {return t("analytics.summary.highlights");},
    icon: analysisOverviewIcon,
  },
  {
    id: 'inventory',
    /**
     * Reads the title property from the current state.
     * @return {*} Value returned by the delegated operation.
     */
    get title() {return t("analytics.inventory.collectionStock");},
    /**
     * Reads the sub property from the current state.
     * @return {*} Value returned by the delegated operation.
     */
    get sub() {return t("analytics.inventory.sectionDescription");},
    icon: analysisInventoryIcon,
  },
  {
    id: 'origins',
    /**
     * Reads the title property from the current state.
     * @return {*} Value returned by the delegated operation.
     */
    get title() {return t("analytics.origin.title");},
    /**
     * Reads the sub property from the current state.
     * @return {*} Value returned by the delegated operation.
     */
    get sub() {return t("analytics.origin.sectionDescription");},
    icon: analysisOriginsIcon,
  },
  {
    id: 'profile',
    /**
     * Reads the title property from the current state.
     * @return {*} Value returned by the delegated operation.
     */
    get title() {return t("analytics.profile.title");},
    /**
     * Reads the sub property from the current state.
     * @return {*} Value returned by the delegated operation.
     */
    get sub() {return t("analytics.profile.sectionDescription");},
    icon: analysisProfileIcon,
  },
  {
    id: 'finance',
    /**
     * Reads the title property from the current state.
     * @return {*} Value returned by the delegated operation.
     */
    get title() {return t("analytics.finance.title");},
    /**
     * Reads the sub property from the current state.
     * @return {*} Value returned by the delegated operation.
     */
    get sub() {return t("analytics.finance.pricesAndRetailers");},
    icon: analysisFinanceIcon,
  },
  {
    id: 'timeline',
    /**
     * Reads the title property from the current state.
     * @return {*} Value returned by the delegated operation.
     */
    get title() {return t("analytics.trends.tastingSection");},
    /**
     * Reads the sub property from the current state.
     * @return {*} Value returned by the delegated operation.
     */
    get sub() {return t("analytics.trends.sectionDescription");},
    icon: analysisTimelineIcon,
  },
  {
    id: 'quality',
    /**
     * Reads the title property from the current state.
     * @return {*} Value returned by the delegated operation.
     */
    get title() {return t("analytics.quality.title");},
    /**
     * Reads the sub property from the current state.
     * @return {*} Value returned by the delegated operation.
     */
    get sub() {return t("analytics.quality.sectionDescription");},
    icon: analysisQualityIcon,
  },
]);

/**
 * Creates the analytics page renderer using the latest filters and collection state.
 *
 * @param {{state: Object, shell: function(import('../ui/render-plan.js').RenderContent): void}} options Current application state and page mounting callback.
 * @return {function(): void} Renders and mounts the selected analytics section.
 */
export function createAnalyticsView({state, shell}) {
  return (
    /**
     * Computes the selected analytics ViewModel and mounts its page RenderPlan through the shell.
     */
    function renderAnalytics() {
      const {current, data, options} = createAnalyticsViewModel(state, ANALYSIS_PAGES);
      const contents = {
        /**
         * Prepares analytics overview for the current filters.
         * @return {!import('../ui/render-plan.js').RenderPlan} Analytics overview for the current filters.
         */
        overview: () => overview(data, ANALYSIS_PAGES),
        /**
         * Prepares inventory analysis for the current filters.
         * @return {import('../ui/render-plan.js').RenderPlan|string} Inventory analysis for the current filters (or scalar/empty text when no plan is needed).
         */
        inventory: () => inventory(data),
        /**
         * Prepares origin and distillery analysis for the current filters.
         * @return {import('../ui/render-plan.js').RenderPlan|string} Origin and distillery analysis for the current filters (or scalar/empty text when no plan is needed).
         */
        origins: () => provenance(data),
        /**
         * Prepares whisky and tasting profile analysis for the current filters.
         * @return {import('../ui/render-plan.js').RenderPlan|string} Whisky and tasting profile analysis for the current filters (or scalar/empty text when no plan is needed).
         */
        profile: () => profile(data),
        /**
         * Prepares financial analysis for the current filters.
         * @return {!import('../ui/render-plan.js').RenderPlan} Financial analysis for the current filters.
         */
        finance: () => finance(data, state),
        /**
         * Prepares timeline analysis for the current filters.
         * @return {import('../ui/render-plan.js').RenderPlan|string} Timeline analysis for the current filters (or scalar/empty text when no plan is needed).
         */
        timeline: () => timeline(data, state),
        /**
         * Prepares data-quality analysis for the current filters.
         * @return {import('../ui/render-plan.js').RenderPlan|string} Data-quality analysis for the current filters (or scalar/empty text when no plan is needed).
         */
        quality: () => quality(data),
      };
      const content = composeMarkup(
        filterControls(state, options),
        headingTitle({
          title: current.title,
          level: 2,
          className: 'analytics-section-title',
        }),
        contents[current.id]()
      );
      const workspace = sectionWorkspace({
        sections: ANALYSIS_PAGES.map(page => ({id: page.id, label: page.title})),
        activeId: current.id,
        action: 'analytics-section',
        itemAttribute: 'data-section',
        label: t('analytics.navigation.sections'),
        switchKind: 'analytics',
      }, content);
      shell(renderTemplate('analyticsPage', {
        pageHeader: pageHeader({
          title: t('navigation.analytics'),
          eyebrow: t('analytics.summary.eyebrow'),
          intro: t('analytics.summary.highlights'),
          className: 'analytics-page-heading',
        }),
        workspace: workspace,
      }));
    }
  );
}
