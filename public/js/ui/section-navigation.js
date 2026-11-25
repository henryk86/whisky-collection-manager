import {composeMarkup} from './render-plan.js';
import {escapeHtml} from './dom.js';
import {loadTemplates} from './templates.js';

const renderTemplate = await loadTemplates(new URL('./templates/section-navigation.html', import.meta.url));


/**
 * Shared desktop sidebar and mobile selector for multi-section content pages.
 *
 * @param {!Object} options Optional configuration for the operation.
 * @param {*} content Content used by this operation.
 * @return {string} Resulting text.
 */
export function sectionWorkspace(
  {
    sections,
    activeId,
    action,
    itemAttribute,
    label,
    switchKind,
    desktopClass = ''
  },
  content
) {
  const safe = escapeHtml;
  const items = sections.map(section => ({id: String(section.id), label: String(section.label)}));
  const selected = items.some(item => item.id === activeId) ? activeId : items[0]?.id;
  const desktop = composeMarkup(items.map(item =>
    renderTemplate('sectionNavItem', {
      id: item.id === selected ? ' active' : '',
      safe: safe(action),
      itemAttribute: itemAttribute,
      safe2: safe(item.id),
      id2: item.id === selected ? ' aria-current="page"' : '',
      safe3: safe(item.label),
    })));
  const options = composeMarkup(items.map(item =>
    renderTemplate('optionsOption', {
      safe: safe(item.id),
      selected: item.id === selected ? ' selected' : '',
      safe2: safe(item.label),
    })));
  return renderTemplate('sectionWorkspace', {
    desktopClass: desktopClass ? ` ${safe(desktopClass)}` : '',
    safe: safe(label),
    desktop: desktop,
    safe2: safe(label),
    safe3: safe(switchKind),
    safe4: safe(label),
    options: options,
    content: content,
  });
}
