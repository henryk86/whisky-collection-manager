import {currentLanguage} from '../i18n/index.js';
import {escapeHtml} from './dom.js';
/**
 * Constructs an application-safe URL for an image path.
 *
 * @param {*} p P used by this operation.
 * @return {string} Resulting text.
 */
export const imageUrl = p => p ? `/${encodeURI(p)}` : '';

/**
 * Formats value for format.
 *
 * @param {*} n N used by this operation.
 * @return {string} Resulting text.
 */
export const formatValue = n => n == null || n === '' ? '–' : escapeHtml(n);

/**
 * Formats date for format.
 *
 * @param {*} val Val used by this operation.
 * @return {string} Resulting text.
 */
export const formatDate = val => val ? new Date(val).toLocaleDateString(currentLanguage()) : '–';
