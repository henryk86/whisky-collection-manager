/** Contextual guidance belongs on this page, not on everyday work screens. */
import { t } from '../i18n/index.js';
import { escapeHtml } from '../ui/dom.js';
import { backToCollectionButton } from '../ui/navigation-controls.js';
import { sectionWorkspace } from '../ui/section-navigation.js';

export const HELP_TOPICS = Object.freeze([
    { id: 'basics', items: 4 },
    { id: 'bottlings', items: 4 },
    { id: 'storage', items: 5 },
    { id: 'map', items: 3 },
    { id: 'photos', items: 3 },
    { id: 'analysis', items: 2 },
    { id: 'backups', items: 4 },
    { id: 'data', items: 4 },
]);

/** Help and Analytics share the same sidebar / mobile-selector layout. */
export function helpView(activeTopic = 'basics') {
    const current = HELP_TOPICS.some(topic => topic.id === activeTopic) ? activeTopic : 'basics';
    const title = id => escapeHtml(t(`help.${id}.title`));
    const panels = HELP_TOPICS.map(topic => `
        <section class="help-section" id="help-panel-${topic.id}" aria-labelledby="help-title-${topic.id}"${topic.id === current ? '' : ' hidden'}>
            <h2 class="analytics-section-title" id="help-title-${topic.id}">${title(topic.id)}</h2>
            <div class="help-content-panel">
                ${topic.id === 'basics' ? `<p class="help-description muted">${escapeHtml(t('help.description'))}</p>` : ''}
                <ol class="help-steps">${Array.from({length:topic.items}, (_, index) => `<li>${escapeHtml(t(`help.${topic.id}.${index + 1}`))}</li>`).join('')}</ol>
            </div>
        </section>`).join('');
    const workspace = sectionWorkspace({
        sections: HELP_TOPICS.map(topic => ({id:topic.id,label:t(`help.${topic.id}.title`)})),
        activeId:current, action:'help-tab', itemAttribute:'data-help-topic',
        label:t('help.contents'), switchKind:'help',
    }, `<div class="help-panels">${panels}</div>`);
    return `<div class="analytics-page help-page">
        <header class="section-head help-heading">
            <div class="page-heading-copy"><span class="eyebrow dark">${escapeHtml(t('help.eyebrow'))}</span>
                <h2>${escapeHtml(t('navigation.help'))}<span class="heading-period">.</span></h2>
                <p class="intro">${escapeHtml(t('help.intro'))}</p></div>
            ${backToCollectionButton}
        </header>
        ${workspace}
    </div>`;
}

/** Switch the visible help topic without losing the current page or scroll. */
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
