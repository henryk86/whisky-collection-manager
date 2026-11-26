import {createHelpViewModel} from './models/help.js';
import {composeMarkup} from '../ui/render-plan.js';
import {headingTitle, pageHeader} from '../ui/headers.js';
/** Contextual guidance belongs on this page, not on everyday work screens. */
import {t} from '../i18n/index.js';
import {backToCollectionButton} from '../ui/navigation-controls.js';
import {sectionWorkspace} from '../ui/section-navigation.js';
import {helpGuides} from './help-guides.js';
import {loadTemplates} from '../ui/templates.js';

const renderTemplate = await loadTemplates('help/help.html');


export const HELP_TOPICS = Object.freeze([
  {id: 'basics', items: 4},
  {id: 'bottlings', items: 6},
  {id: 'tastings', items: 8},
  {id: 'flights', items: 5},
  {id: 'storage', items: 7},
  {id: 'map', items: 3},
  {id: 'photos', items: 3},
  {id: 'analysis', items: 2},
  {id: 'backups', items: 4},
  {id: 'data', items: 4},
]);

/**
 * Help and Analytics share the same sidebar / mobile-selector layout.
 *
 * @param {string=} activeTopic Identifier of the help topic initially shown.
 * @return {!import('../ui/render-plan.js').RenderPlan} Help topic navigation and localized content panels.
 */
export function helpView(activeTopic = 'basics') {
  const {current, topics} = createHelpViewModel(HELP_TOPICS, activeTopic);
  const panels = composeMarkup(topics.map(topic => renderTemplate(
    'helpSection',
    {
      id: topic.id,
      ariaLabelledby: topic.id,
      hiddenAttributes: topic.id === current ? {} : {"hidden": true},
      headingTitle: headingTitle({
        title: topic.label,
        level: 2,
        className: 'analytics-section-title',
        id: `help-title-${topic.id}`,
      }),
      helpDescription: topic.id === 'basics' ? renderTemplate('helpDescription', {description: t('help.description'), }) : '',
      from: composeMarkup(topic.entries.map(entry => renderTemplate('li', {t: entry}))),
      helpGuides: helpGuides(topic.id),
    }
  )));
  const workspace = sectionWorkspace({
    sections: topics,
    activeId: current, action: 'help-tab', itemAttribute: 'data-help-topic',
    label: t('help.contents'), switchKind: 'help',
  }, renderTemplate('helpPanels', {panels: panels, }));
  return renderTemplate('analyticsPage', {
    pageHeader: pageHeader({
      title: t('navigation.help'),
      eyebrow: t('help.eyebrow'),
      intro: t('help.intro'),
      className: 'help-heading',
      actions: backToCollectionButton(),
    }),
    workspace: workspace,
  });
}

/**
 * Switch the visible help topic without losing the current page or scroll.
 *
 * @param {string} topicId Identifier of the help topic to activate.
 * @param {*} container Help workspace containing the topic navigation and content panels.
 * @return {boolean} Whether the condition is satisfied.
 */
export function activateHelpTopic(topicId, container) {
  if (!HELP_TOPICS.some(topic => topic.id === topicId) || !container) return false;
  for (const button of container.querySelectorAll('.section-nav-item[data-help-topic]')) {
    const active = button.dataset.helpTopic === topicId;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
  const selector = container.querySelector('[data-section-switch="help"]');
  if (selector) selector.value = topicId;
  for (const panel of container.querySelectorAll('.help-section')) panel.hidden = panel.id !== `help-panel-${topicId}`;
  return true;
}
