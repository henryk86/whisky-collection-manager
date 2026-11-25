import {composeMarkup} from '../ui/render-plan.js';
import {t} from '../i18n/index.js';
import {escapeHtml} from '../ui/dom.js';
import {loadTemplates} from '../ui/templates.js';

const renderTemplate = await loadTemplates(new URL('./templates/help-guides.html', import.meta.url));


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
 * Builds the localized help sections for the current screen.
 *
 * @param {*} topic Topic used by this operation.
 * @return {string} Resulting text.
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
