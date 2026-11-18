import { WHISKY_COLORS, isCustomWhiskyColor, resolveWhiskyColor, whiskyPickerHex, whiskyPickerPosition } from '../../../shared/whisky-colors.js';
import { whiskyColorNameKey } from '../../../shared/whisky-color-names.js';
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

/** The original twelve shades remain unchanged. The additional picker stores its HEX value internally. */
export function whiskyCustomColorName(hex) {
    const key=whiskyColorNameKey(hex);
    return key ? t(`tasting.colorName.${key}`) : '';
}

export function whiskyColorSelector(selected) {
    const custom=isCustomWhiskyColor(selected);
    // Only an active custom colour may populate the preview and internal draft.
    // Fixed colours (and no selection) must not retain a custom shade.
    const hex=custom ? resolveWhiskyColor(selected).hex : '';
    const {x,y}=custom ? whiskyPickerPosition(hex) : {x:0.65,y:0.48};
    return `<div class="whisky-color-selector" data-whisky-color="${escapeHtml(selected || '')}">
        <div class="whisky-color-grid" role="group" aria-label="${escapeHtml(t('tasting.color'))}">
            ${WHISKY_COLORS.map((item,i) => `<button class="whisky-color-choice${selected === item.key ? ' is-selected' : ''}" type="button" data-act="tasting-color" data-color-key="${item.key}" aria-pressed="${selected === item.key}" title="${escapeHtml(t(COLOR_LABEL_KEYS[item.key]))}">
                ${glencairnSymbol({liquidColor:item.hex,id:`color-glass-${i}`})}
                <span>${escapeHtml(t(COLOR_LABEL_KEYS[item.key]))}</span></button>`).join('')}
        </div>
        <div class="whisky-custom-row${custom ? ' is-selected' : ''}" role="group" aria-label="${escapeHtml(t('tasting.colorCustom'))}">
            <div class="whisky-custom-preview">
                ${glencairnSymbol({liquidColor:hex || 'transparent',id:'custom-color-glass'})}
                <strong>${escapeHtml(t('tasting.colorCustom'))}</strong>
            </div>
            <div class="whisky-custom-controls">
                <div class="whisky-custom-area" data-whisky-picker-area tabindex="0" role="button"
                    aria-label="${escapeHtml(t('tasting.colorCustomPicker'))}" aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown"
                    style="--picker-x:${(x*100).toFixed(1)}%;--picker-y:${(y*100).toFixed(1)}%">
                    <span class="whisky-custom-cursor" aria-hidden="true"></span>
                </div>
                <output class="whisky-custom-name" data-whisky-custom-name aria-live="polite">${escapeHtml(whiskyCustomColorName(hex))}</output>
                <input type="hidden" data-whisky-custom-hex value="${hex}">
            </div>
        </div>
    </div>`;
}

/** Non-interactive display of the recorded colour for a saved tasting. */
export function whiskyColorDisplay(selected) {
    const color=resolveWhiskyColor(selected);
    if (!color) return '';
    const label=isCustomWhiskyColor(selected) ? whiskyCustomColorName(color.hex) : t(COLOR_LABEL_KEYS[color.key]);
    return `<div class="tasting-readonly-color">${glencairnSymbol({liquidColor:color.hex,id:'readonly-whisky-color'})}<strong>${escapeHtml(label)}</strong></div>`;
}
