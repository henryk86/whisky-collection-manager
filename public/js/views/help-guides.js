import {t} from '../i18n/index.js';
import {escapeHtml} from '../ui/dom.js';

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
export function helpGuides(topic) {
  const guides = HELP_GUIDES[topic] || [];
  if (!guides.length) return '';
  return `<div class="help-technical-guides">${guides.map(id =>
    `<details class="help-guide"><summary>${escapeHtml(t(`help.guide.${topic}.${id}.title`))}</summary><ol>${Array.from(
      {length: Number(t(`help.guide.${topic}.${id}.count`))},
      (_, index) => `<li>${escapeHtml(t(`help.guide.${topic}.${id}.${index +
        1}`))}</li>`
    ).join('')}</ol></details>`).join('')}</div>`;
}
