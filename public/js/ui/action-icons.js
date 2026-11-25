import {escapeHtml} from './dom.js';
import {loadTemplates} from './templates.js';

const renderTemplate = await loadTemplates(
  new URL('./templates/action-icons.html', import.meta.url));

/** Shared accessible action icons: the header and hero reuse the same SVGs. */
export const newBottlingIcon =
  renderTemplate('newIcon');
/**
 * For translated add/create labels that previously carried a typed '+' glyph.
 *
 * @param {*} label Label shown to the user.
 * @return {string} Resulting text.
 */
export const addActionLabel = label =>
  renderTemplate('addActionLabel', {
    newBottlingIcon: newBottlingIcon,
    replace: String(
      label).replace(/^\+\s*/, ''),
  });

export const inventoryScanIcon =
  renderTemplate('scanIcon');

export const settingsIconPaths =
  renderTemplate('settingsIconPathsPath');
export const settingsIcon =
  renderTemplate('settingsIcon', {
    settingsIconPaths: settingsIconPaths,
  });

/**
 * Device-independent theme symbols: exactly the same SVG on desktop and mobile.
 */
export const themeSunIcon =
  renderTemplate('themeIcon');
export const themeMoonIcon =
  renderTemplate('themeIcon2');

/**
 * Consistent edit/delete icons for bottlings, physical bottles and attachments.
 */
export const editIcon =
  renderTemplate('actionIcon');

export const locationIcon =
  renderTemplate('actionIcon2');

export const deleteIcon =
  renderTemplate('actionIcon3');

/** Furniture isolation is a separate action from selecting its shelves. */
export const eyeIcon =
  renderTemplate('warehouseEyeIcon');
export const eyeOffIcon =
  renderTemplate('warehouseEyeIcon2');

/**
 * Traditional malt-kiln pagoda roof for map locations without physical bottles.
 */
export const pagodaRoofIcon =
  renderTemplate('mapPagodaIcon');

/** Closed distilleries get a visibly distinct crossed-out kiln symbol. */
export const closedDistilleryIcon =
  renderTemplate('mapPagodaIcon2');

/**
 * Reusable vector controls: no font-dependent arrow or chevron glyphs.
 *
 * @param {string} path Path to the resource.
 * @param {string=} extraClass Extra class used by this operation.
 * @return {string} Resulting text.
 */
const uiSymbol = (path, extraClass = '') =>
  renderTemplate('uiSymbol', {
    extraClass: extraClass ? ` ${extraClass}` :
      '',
    path: path,
  });

/**
 * Renders the downward-chevron icon markup for action controls.
 *
 * @param {string=} extraClass Extra class used by this operation.
 * @return {string} Resulting text.
 */
export const chevronDownIcon = (extraClass = '') =>
  uiSymbol(renderTemplate('chevronDownIconPath'), extraClass);
export const chevronRightIcon =
  uiSymbol(renderTemplate('chevronRightIconPath'));
export const chevronLeftIcon = uiSymbol(renderTemplate('chevronLeftIconPath'));
export const chevronsLeftIcon =
  uiSymbol(renderTemplate('chevronsLeftIconPath'));
export const chevronsRightIcon =
  uiSymbol(renderTemplate('chevronsRightIconPath'));
export const arrowLeftIcon = uiSymbol(renderTemplate('arrowLeftIconPath'));
export const arrowRightIcon = uiSymbol(renderTemplate('arrowRightIconPath'));
export const arrowUpIcon = uiSymbol(renderTemplate('arrowUpIconPath'));
export const arrowDownIcon = uiSymbol(renderTemplate('arrowDownIconPath'));
export const arrowsUpDownIcon =
  uiSymbol(renderTemplate('arrowsUpDownIconPath'));
export const closeIcon = uiSymbol(renderTemplate('closeIconPath'));
export const collectionTableIcon =
  uiSymbol(
    renderTemplate('collectionTableIconRect'));
export const collectionCardsIcon =
  uiSymbol(
    renderTemplate('collectionCardsIconRect'));
/**
 * Three tasting glasses make the planning action identifiable on both pages.
 */
export const helpCircleIcon =
  uiSymbol(
    renderTemplate('helpCircleIconCircle'));
export const flightPlanIcon =
  uiSymbol(
    renderTemplate('flightPlanIconPath'));
export const plusIcon = uiSymbol(renderTemplate('plusIconPath'));
export const minusIcon = uiSymbol(renderTemplate('minusIconPath'));
export const gripIcon = uiSymbol(
  renderTemplate('gripIconCircle'));
export const successIcon = uiSymbol(renderTemplate('successIconPath'));
export const warningIcon =
  uiSymbol(renderTemplate('warningIconPath'));
export const moreIcon = uiSymbol(
  renderTemplate('moreIconCircle'));
export const sparkleIcon =
  uiSymbol(
    renderTemplate('sparkleIconPath'));
export const analysisOverviewIcon =
  uiSymbol(
    renderTemplate('analysisOverviewIconRect'));
export const analysisInventoryIcon =
  uiSymbol(
    renderTemplate('analysisInventoryIconPath'));
export const analysisOriginsIcon =
  uiSymbol(
    renderTemplate('analysisOriginsIconCircle'));
export const analysisProfileIcon =
  uiSymbol(
    renderTemplate('analysisProfileIconPath'));
export const analysisFinanceIcon =
  uiSymbol(
    renderTemplate('analysisFinanceIconPath'));
export const analysisTimelineIcon =
  uiSymbol(renderTemplate('analysisTimelineIconPath'));
export const analysisQualityIcon =
  uiSymbol(
    renderTemplate('analysisQualityIconRect'));
