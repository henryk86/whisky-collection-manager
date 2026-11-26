import {currentLanguage} from '../i18n/index.js';
import {escapeHtml} from './dom.js';
/**
 * Encodes an application-relative stored image path for display.
 *
 * @param {?string} p Stored relative image path, or no path.
 * @return {string} Root-relative URI or empty text if the path is absent.
 */
export const imageUrl = p => p ? `/${encodeURI(p)}` : '';

/**
 * Formats missing scalar values as a dash and escapes other values.
 *
 * @param {*} n Display value; null, undefined and empty text indicate missing data.
 * @return {string} Escaped value or the missing-value dash.
 */
export const formatValue = n => n == null || n === '' ? '–' : escapeHtml(n);

/**
 * Formats a date in the current application language.
 *
 * @param {string|number|Date|null|undefined} val Date value; falsy values indicate missing dates.
 * @return {string} Localized date or the missing-value dash.
 */
export const formatDate = val => val ? new Date(val).toLocaleDateString(currentLanguage()) : '–';
