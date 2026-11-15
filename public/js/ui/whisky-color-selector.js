import { WHISKY_COLORS } from '../domain/whisky-colors.js';
import { glencairnSymbol } from './glencairn-icon.js';
import { t } from '../i18n/index.js';
import { escapeHtml } from './dom.js';

const COLOR_LABEL_KEYS = Object.freeze({
    new_make:'tasting.color.newMake',
    white_wine:'tasting.color.whiteWine',
    butter:'tasting.color.butter',
    straw:'tasting.color.straw',
    honey:'tasting.color.honey',
    gold:'tasting.color.gold',
    amber:'tasting.color.amber',
    reddish_brown:'tasting.color.reddishBrown',
    rust:'tasting.color.rust',
    copper:'tasting.color.copper',
    brandy:'tasting.color.brandy',
    chocolate:'tasting.color.chocolate',
});
export function whiskyColorSelector(selected) {
    return `<div class="whisky-color-selector" data-whisky-color="${escapeHtml(selected || '')}">
        <div class="whisky-color-grid" role="group" aria-label="${escapeHtml(t('tasting.color'))}">
            ${WHISKY_COLORS.map((item,i) => `<button class="whisky-color-choice${selected === item.key ? ' is-selected' : ''}" type="button" data-act="tasting-color" data-color-key="${item.key}" aria-pressed="${selected === item.key}" title="${escapeHtml(t(COLOR_LABEL_KEYS[item.key]))}">
                ${glencairnSymbol({liquidColor:item.hex,id:`color-glass-${i}`})}
                <span>${escapeHtml(t(COLOR_LABEL_KEYS[item.key]))}</span></button>`).join('')}
        </div>
    </div>`;
}

/** Non-interactive display of the recorded colour for a saved tasting. */
export function whiskyColorDisplay(selected) {
    const color=WHISKY_COLORS.find(item=>item.key===selected);
    if (!color) return '';
    return `<div class="tasting-readonly-color">${glencairnSymbol({liquidColor:color.hex,id:'readonly-whisky-color'})}<strong>${escapeHtml(t(COLOR_LABEL_KEYS[color.key]))}</strong></div>`;
}
