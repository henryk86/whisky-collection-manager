import {insuranceSection} from './insurance.js';
import {inventory, provenance, profile, finance, timeline, quality, overview} from './analytics-sections.js';
import {filterControls} from './analytics-controls.js';
import {createAnalyticsViewModel} from './models/analytics.js';
import {composeMarkup} from '../ui/render-plan.js';

import {headingTitle, pageHeader} from '../ui/headers.js';
import {t} from '../i18n/index.js';
/**
 * Analytics dashboard and seven thematic pages. All datasets come from pure
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
     * Resolves the analytics overview heading in the active language.
     * @return {*} Localized overview heading.
     */
    get title() {return t("analytics.navigation.overview");},
    /**
     * Resolves the analytics highlights description in the active language.
     * @return {*} Localized highlights description.
     */
    get sub() {return t("analytics.summary.highlights");},
    icon: analysisOverviewIcon,
  },
  {
    id: 'inventory',
    /**
     * Resolves the inventory analytics heading in the active language.
     * @return {*} Localized inventory heading.
     */
    get title() {return t("analytics.inventory.collectionStock");},
    /**
     * Resolves the inventory analytics description in the active language.
     * @return {*} Localized inventory description.
     */
    get sub() {return t("analytics.inventory.sectionDescription");},
    icon: analysisInventoryIcon,
  },
  {
    id: 'origins',
    /**
     * Resolves the origin analytics heading in the active language.
     * @return {*} Localized origin heading.
     */
    get title() {return t("analytics.origin.title");},
    /**
     * Resolves the origin analytics description in the active language.
     * @return {*} Localized origin description.
     */
    get sub() {return t("analytics.origin.sectionDescription");},
    icon: analysisOriginsIcon,
  },
  {
    id: 'profile',
    /**
     * Resolves the flavor-profile analytics heading in the active language.
     * @return {*} Localized profile heading.
     */
    get title() {return t("analytics.profile.title");},
    /**
     * Resolves the flavor-profile analytics description in the active language.
     * @return {*} Localized profile description.
     */
    get sub() {return t("analytics.profile.sectionDescription");},
    icon: analysisProfileIcon,
  },
  {
    id: 'finance',
    /**
     * Resolves the finance analytics heading in the active language.
     * @return {*} Localized finance heading.
     */
    get title() {return t("analytics.finance.title");},
    /**
     * Resolves the description of prices and retailers in the active language.
     * @return {*} Localized finance description.
     */
    get sub() {return t("analytics.finance.pricesAndRetailers");},
    icon: analysisFinanceIcon,
  },
  {
    id: 'timeline',
    /**
     * Resolves the tasting analytics heading in the active language.
     * @return {*} Localized tasting heading.
     */
    get title() {return t("analytics.trends.tastingSection");},
    /**
     * Resolves the tasting trends description in the active language.
     * @return {*} Localized tasting trends description.
     */
    get sub() {return t("analytics.trends.sectionDescription");},
    icon: analysisTimelineIcon,
  },
  {
    id: 'quality',
    /**
     * Resolves the quality analytics heading in the active language.
     * @return {*} Localized quality heading.
     */
    get title() {return t("analytics.quality.title");},
    /**
     * Resolves the quality analytics description in the active language.
     * @return {*} Localized quality description.
     */
    get sub() {return t("analytics.quality.sectionDescription");},
    icon: analysisQualityIcon,
  },
  {
    id: 'insurance',
    /** Returns the localized insurance heading. @return {string} Section title. */
    get title() {return t('insurance.title');},
    /** Returns the localized insurance description. @return {string} Section description. */
    get sub() {return t('insurance.description');},
    icon: analysisQualityIcon,
  },
]);

/**
 * Creates the analytics page renderer using the latest filters and collection state.
 *
 * @param {{state: Object, shell: (content: import('../ui/render-plan.js').RenderContent) => void}} options Current application state and page mounting callback.
 * @return {() => void} Renders and mounts the selected analytics section.
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
        /** Renders the unfiltered physical insurance inventory. @return {import('../ui/render-plan.js').RenderPlan|string} Insurance section. */
        insurance: () => insuranceSection(state),
      };
      const content = composeMarkup(
        current.id === 'insurance' ? '' : filterControls(state, options),
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
