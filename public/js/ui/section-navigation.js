import {escapeHtml} from './dom.js';

/**
 * Shared desktop sidebar and mobile selector for multi-section content pages.
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
  const items = sections.map(section =>
    ({id: String(section.id), label: String(section.label)}));
  const selected = items.some(item => item.id === activeId) ? activeId :
    items[0]?.id;
  const desktop = items.map(item =>
    `<button type="button" class="section-nav-item${item.id === selected ?
      ' active' : ''}" data-act="${safe(action)}" ${itemAttribute}="${safe(item.id)}"${item.id === selected ? ' aria-current="page"' : ''}>${safe(item.label)}</button>`).join('');
  const options = items.map(item =>
    `<option value="${safe(item.id)}"${item.id === selected ? ' selected' :
      ''}>${safe(item.label)}</option>`).join('');
  return `<div class="section-workspace">
        <div class="section-workspace-navigation">
            <nav class="section-nav-desktop${desktopClass ?
      ` ${safe(desktopClass)}` :
      ''}" aria-label="${safe(label)}">${desktop}</nav>
            <label class="section-nav-mobile"><span>${safe(label)}</span>
                <select data-section-switch="${safe(switchKind)}" aria-label="${safe(label)}">${options}</select>
            </label>
        </div>
        <div class="section-workspace-content">${content}</div>
    </div>`;
}
