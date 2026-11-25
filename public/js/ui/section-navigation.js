import {composeMarkup} from './render-plan.js';
import {escapeHtml} from './dom.js';
import {loadTemplates} from './templates.js';

const renderTemplate = await loadTemplates('components/section-navigation.html');


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
      act: safe(action),
      itemAttributes: {[itemAttribute]: item.id},
      ariaCurrentAttributes: item.id === selected ? {"aria-current": "page"} : {},
      label: safe(item.label),
    })));
  const options = composeMarkup(items.map(item =>
    renderTemplate('optionsOption', {
      value: safe(item.id),
      selectedAttributes: item.id === selected ? {"selected": true} : {},
      label: safe(item.label),
    })));
  return renderTemplate('sectionWorkspace', {
    desktopClass: desktopClass ? ` ${safe(desktopClass)}` : '',
    ariaLabel: safe(label),
    desktop: desktop,
    label: safe(label),
    sectionSwitch: safe(switchKind),
    navigationLabel: safe(label),
    options: options,
    content: content,
  });
}
