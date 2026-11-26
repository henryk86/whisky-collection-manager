import {composeMarkup} from '../ui/render-plan.js';
import {t} from '../i18n/index.js';
import {loadTemplates} from '../ui/templates.js';

const renderTemplate = await loadTemplates('help/help-guides.html');


// Only multi-step backup procedures warrant disclosure panels. Short guidance
// belongs in the existing numbered help text rather than a second one-item
// section.
export const HELP_GUIDES = Object.freeze({
  backups: [
    'setup',
    'manual',
    'usb',
    'nas',
    'dropbox',
    'onedrive',
    'other',
    'schedule',
    'restore',
  ],
});
/**
 * Prepares technical guides for the selected help topic.
 *
 * @param {*} topic Help topic identifier used to select the relevant guide content.
 * @return {import('../ui/render-plan.js').RenderPlan|string} Technical guides for the selected help topic (or scalar/empty text when no plan is needed).
 */
export function helpGuides(topic) {
  const guides = HELP_GUIDES[topic] || [];
  if (!guides.length) return '';
  return renderTemplate('helpTechnicalGuides', {
    guides: composeMarkup(guides.map(id =>
      renderTemplate('helpGuide', {
        t: t(`help.guide.${topic}.${id}.title`),
        from: composeMarkup(Array.from(
          {length: Number(t(`help.guide.${topic}.${id}.count`))},
          (_, index) => renderTemplate('li', {t: t(`help.guide.${topic}.${id}.${index + 1}`), })
        )),
      }))),
  });
}
