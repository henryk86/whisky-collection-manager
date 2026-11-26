import {composeMarkup} from './render-plan.js';
import {
  WHISKY_COLORS, isCustomWhiskyColor, resolveWhiskyColor,
  whiskyPickerHex, whiskyPickerPosition
}
  from '../../../shared/whisky-colors.js';
import {whiskyColorNameKey} from '../../../shared/whisky-color-names.js';
import {glencairnSymbol} from './glencairn-icon.js';
import {t} from '../i18n/index.js';
import {loadTemplates} from './templates.js';

const renderTemplate = await loadTemplates('components/whisky-color-selector.html');


const COLOR_LABEL_KEYS = Object.freeze({
  new_make: 'tasting.color.newMake',
  white_wine: 'tasting.color.whiteWine',
  butter: 'tasting.color.butter',
  straw: 'tasting.color.straw',
  honey: 'tasting.color.honey',
  gold: 'tasting.color.gold',
  amber: 'tasting.color.amber',
  reddish_brown: 'tasting.color.reddishBrown',
  rust: 'tasting.color.rust',
  copper: 'tasting.color.copper',
  brandy: 'tasting.color.brandy',
  chocolate: 'tasting.color.chocolate',
});

/**
 * The original twelve shades remain unchanged. The additional picker stores
 * its HEX value internally.
 *
 * @param {*} hex Hex used by this operation.
 * @return {*} Result computed from the supplied inputs.
 */
export function whiskyCustomColorName(hex) {
  const key = whiskyColorNameKey(hex);
  return key ? t(`tasting.colorName.${key}`) : '';
}

/**
 * Renders the selectable whisky-colour samples and selected glass.
 *
 * @param {*} selected Selected used by this operation.
 * @return {!import('./render-plan.js').RenderPlan} Whisky color samples, selected glass and custom-color controls.
 */
export function whiskyColorSelector(selected) {
  const custom = isCustomWhiskyColor(selected);
  // Only an active custom colour may populate the preview and internal draft.
  // Fixed colours (and no selection) must not retain a custom shade.
  const hex = custom ? resolveWhiskyColor(selected).hex : '';
  const {x, y} = custom ? whiskyPickerPosition(hex) : {x: 0.65, y: 0.48};
  return renderTemplate('whiskyColorSelector', {
    selected: selected || '',
    color: t('tasting.color'),
    colorOptions: composeMarkup(WHISKY_COLORS.map((item, i) =>
      renderTemplate('whiskyColorChoice', {
        selected: selected === item.key ? ' is-selected' : '',
        key: item.key,
        ariaPressed: selected === item.key,
        t: t(COLOR_LABEL_KEYS[item.key]),
        glencairnSymbol: glencairnSymbol({
          liquidColor: item.hex,
          id: `color-glass-${i}`,
        }),
        colorLabel: t(COLOR_LABEL_KEYS[item.key]),
      }))),
    custom: custom ? ' is-selected' : '',
    colorCustom: t('tasting.colorCustom'),
    glencairnSymbol: glencairnSymbol({
      liquidColor: hex || 'transparent', id: 'custom-color-glass',
    }),
    customColorLabel: t('tasting.colorCustom'),
    colorCustomPicker: t('tasting.colorCustomPicker'),
    toFixed: (x * 100).toFixed(1),
    pickerY: (y * 100).toFixed(1),
    whiskyCustomColorName: whiskyCustomColorName(hex),
    hex: hex,
  });
}

/**
 * Non-interactive display of the recorded colour for a saved tasting.
 *
 * @param {*} selected Selected used by this operation.
 * @return {import('./render-plan.js').RenderPlan|string} Read-only glass for the recorded whisky color (or scalar/empty text when no plan is needed).
 */
export function whiskyColorDisplay(selected) {
  const color = resolveWhiskyColor(selected);
  if (!color) return '';
  const label = isCustomWhiskyColor(selected) ? whiskyCustomColorName(color.hex) : t(COLOR_LABEL_KEYS[color.key]);
  return renderTemplate('tastingReadonlyColor', {
    glencairnSymbol: glencairnSymbol({
      liquidColor: color.hex, id: 'readonly-whisky-color',
    }),
    label: label,
  });
}
