import {composeMarkup} from './render-plan.js';
import {loadTemplates} from './templates.js';

const renderTemplate = await loadTemplates('components/section-navigation.html');


/**
 * Shared desktop sidebar and mobile selector for multi-section content pages.
 *
 * @param {!Object} options Optional configuration for the operation.
 * @param {*} content Content used by this operation.
 * @return {!import('./render-plan.js').RenderPlan} Section workspace with desktop navigation and a mobile selector.
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
  const items = sections.map(section => ({id: String(section.id), label: String(section.label)}));
  const selected = items.some(item => item.id === activeId) ? activeId : items[0]?.id;
  const desktop = composeMarkup(items.map(item =>
    renderTemplate('sectionNavItem', {
      id: item.id === selected ? ' active' : '',
      act: String(action ?? ''),
      itemAttributes: {[itemAttribute]: item.id},
      ariaCurrentAttributes: item.id === selected ? {"aria-current": "page"} : {},
      label: String(item.label ?? ''),
    })));
  const options = composeMarkup(items.map(item =>
    renderTemplate('optionsOption', {
      value: String(item.id ?? ''),
      selectedAttributes: item.id === selected ? {"selected": true} : {},
      label: String(item.label ?? ''),
    })));
  return renderTemplate('sectionWorkspace', {
    desktopClass: desktopClass ? ` ${String(desktopClass ?? '')}` : '',
    ariaLabel: String(label ?? ''),
    desktop: desktop,
    label: String(label ?? ''),
    sectionSwitch: String(switchKind ?? ''),
    navigationLabel: String(label ?? ''),
    options: options,
    content: content,
  });
}
