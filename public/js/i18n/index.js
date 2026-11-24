/**
 * Key-based UI localization: no matching against rendered German source text.
 */
import german from '../../locales/de.json' with {type: 'json'};
import english from '../../locales/en.json' with {type: 'json'};
import {escapeHtml} from '../ui/dom.js';

const DEFAULT_LANGUAGE = 'de';
const STORAGE_KEY = 'whisky-language';
const PRESENTATION_ATTRIBUTES =
  ['aria-label', 'aria-description', 'title', 'placeholder', 'alt'];
let language = DEFAULT_LANGUAGE;
let languages = Object.freeze({de: 'Deutsch'});
let translator = createTranslator(german, english);

/**
 * Formats message for presentation.
 *
 * @param {*} template Value used by this operation.
 * @param {*} params Value used by this operation.
 * @param {*} locale Value used by this operation.
 * @return {*} Entries transformed for the consuming code.
 */
function formatMessage(template, params, locale) {
  // A small ICU-compatible plural subset. Use Intl's language-specific
  // categories;
  // nested HTML and script content are never parsed or evaluated here.
  const plural = /\{([a-zA-Z]\w*),\s*plural,\s*((?:(?:zero|one|two|few|many|other)\s*\{[^{}]*\}\s*)+)\}/gu;
  const result = template.replace(plural, (_, key, choices) => {
    const value = Number(params[key]);
    if (!Number.isFinite(value)) return '';
    const forms = Object.fromEntries([...choices.matchAll(/(zero|one|two|few|many|other)\s*\{([^{}]*)\}/gu)]
      .map(([, name, message]) => [name, message]));
    const category = new Intl.PluralRules(locale).select(value);
    return (forms[category] ?? forms.other ?? '').replace(/#/gu,
      new Intl.NumberFormat(locale).format(value)
    );
  });
  return result.replace(/\{([a-zA-Z]\w*)\}/gu, (match, key) =>
    Object.hasOwn(params, key) ? String(params[key]) : match);
}

/**
 * Pure key lookup with English fallback and named placeholders.
 *
 * @param {!Object=} messages Messages used by this operation.
 * @param {*=} fallback Fallback used by this operation.
 * @param {string=} locale Locale used for formatting.
 * @return {Function} Value returned by the delegated operation.
 */
export function createTranslator(messages = {}, fallback = english, locale = DEFAULT_LANGUAGE) {
  return (key, params = {}) => {
    if (typeof key !== 'string') return key;
    const message = Object.hasOwn(messages, key) && typeof messages[key] ===
      'string' && messages[key].trim()
      ? messages[key] : fallback[key];
    if (typeof message !== 'string') return key;
    return formatMessage(
      message,
      params && typeof params === 'object' ? params : {},
      locale
    );
  };
}

/**
 * Resolves a localized message with optional interpolation values.
 *
 * @param {Function} key Key used to look up the value.
 * @param {!Object=} params Named values used when formatting the message.
 * @return {*} Result computed from the supplied inputs.
 */
export const t = (key, params = {}) => translator(key, params);

/**
 * HTML-template variant; user-controlled parameter strings are always escaped.
 *
 * @param {Function} key Key used to look up the value.
 * @param {!Object=} params Named values used when formatting the message.
 * @return {*} Entries transformed for the consuming code.
 */
export const tHtml = (key, params = {}) => t(key, Object.fromEntries(
  Object.entries(params).map(([name, value]) => [name, typeof value ===
    'string' ? escapeHtml(value) : value])
));

/**
 * Returns the currently selected application language.
 *
 * @return {string} Resulting text.
 */
export const currentLanguage = () => language;

/**
 * Lists language options made available by the application.
 *
 * @return {!Object} Structured result for the caller.
 */
export const availableLanguages = () => languages;

/**
 * Formats number for index.
 *
 * @param {*} number Number used by this operation.
 * @param {!Object} options Optional configuration for the operation.
 * @return {string} Resulting text.
 */
export const formatNumber = (number, options) =>
  new Intl.NumberFormat(language, options).format(number);

/**
 * Tests input text against the valid language pattern.
 *
 * @param {*} code Code used to identify a specific outcome.
 * @return {boolean} Whether the operation matched or succeeded.
 */
function validLanguage(code) {return /^[a-z]{2}(?:-[A-Z]{2})?$/u.test(code);}

/**
 * Derives the saved language result from the supplied values.
 * @return {string} Resulting text.
 */
function savedLanguage() {
  try {return localStorage.getItem(STORAGE_KEY);} catch {return null;}
}

/**
 * Applies a user-selected language and updates the interface.
 *
 * @param {string} code Stable identifier used for error handling.
 * @return {boolean} Whether the condition is satisfied.
 */
export function chooseLanguage(code) {
  if (!Object.hasOwn(languages, code)) return false;
  try {localStorage.setItem(STORAGE_KEY, code);} catch { /* private/restricted storage */}
  if (typeof location !== 'undefined') location.reload();
  return true;
}

/**
 * Locale files use the same stable keys; missing translations fall back to
 * English.
 *
 * @param {Function=} fetcher Fetcher used by this operation.
 * @return {!Promise<string>} Promise fulfilled when the operation completes.
 */
export async function initializeLanguage(fetcher = globalThis.fetch) {
  if (typeof fetcher !== 'function') return language;
  try {
    const response = await fetcher('/locales/index.json');
    if (response.ok) {
      const candidates = await response.json();
      if (candidates && typeof candidates === 'object' &&
        !Array.isArray(candidates)) {
        const entries = Object.entries(candidates).filter(([id, name]) =>
          validLanguage(id) && typeof name === 'string');
        languages = Object.freeze(Object.fromEntries([['de', 'Deutsch'], ...entries]));
      }
    }
  } catch { /* German is bundled with the application */}
  const fromQuery = typeof location !== 'undefined' ?
    new URLSearchParams(location.search).get('lang') : null;
  const requested = fromQuery || savedLanguage() || DEFAULT_LANGUAGE;
  language = Object.hasOwn(languages, requested) ? requested : DEFAULT_LANGUAGE;
  let messages = language === 'en' ? english : german;
  if (language !== DEFAULT_LANGUAGE) {
    try {
      const response = await fetcher(`/locales/${language}.json`);
      if (!response.ok) throw new Error('Language file unavailable');
      const catalog = await response.json();
      if (!catalog || typeof catalog !== 'object' ||
        Array.isArray(catalog)) throw new Error('Invalid language file');
      messages = catalog;
    } catch {language = 'en'; messages = english;}
  }
  translator = createTranslator(messages, english, language);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = language;
    document.title = t('app.meta.title');
    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = t('app.meta.description');
  }
  return language;
}

/**
 * Optional declarative bindings for static HTML, without text-node scanning.
 *
 * @param {*} element Element to process.
 */
function localizeElement(element) {
  const textKey = element.getAttribute('data-i18n');
  if (textKey) element.textContent = t(textKey);
  for (const attribute of PRESENTATION_ATTRIBUTES) {
    const key = element.getAttribute(`data-i18n-${attribute}`);
    if (key) element.setAttribute(attribute, t(key));
  }
}

/**
 * Replaces translatable DOM text and attributes for the active language.
 *
 * @param {!Element} root Root element or directory.
 */
export function translateDom(root) {
  if (!root || !root.querySelectorAll) return;
  if (root.nodeType === 1) localizeElement(root);
  for (const element of root.querySelectorAll('[data-i18n], [data-i18n-aria-label], [data-i18n-aria-description], [data-i18n-title], [data-i18n-placeholder], [data-i18n-alt]')) {
    localizeElement(element);
  }
}
