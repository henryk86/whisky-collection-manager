/**
 * Key-based UI localization: no matching against rendered German source text.
 */
import german from '../../locales/de.json' with {type: 'json'};
import english from '../../locales/en.json' with {type: 'json'};

const DEFAULT_LANGUAGE = 'de';
const STORAGE_KEY = 'whisky-language';
const PRESENTATION_ATTRIBUTES = ['aria-label', 'aria-description', 'title', 'placeholder', 'alt'];
let language = DEFAULT_LANGUAGE;
/** @type {Readonly<Record<string, string>>} */
let languages = Object.freeze({de: 'Deutsch'});
let translator = createTranslator(german, english);

/**
 * Expands the supported ICU plural syntax and named placeholders. Uses
 * locale-specific plural categories and number formatting; never evaluates code
 * or HTML.
 *
 * @param {string} template Message from the translation catalog.
 * @param {!Object} params Placeholder values indexed by name.
 * @param {string} locale BCP 47 locale for plural and number formatting.
 * @return {string} Interpolated message; unknown named placeholders are
 *     retained.
 */
function formatMessage(template, params, locale) {
  // A small ICU-compatible plural subset. Use Intl's language-specific
  // categories;
  // nested HTML and script content are never parsed or evaluated here.
  const plural =
    new RegExp(
      '\\{([a-zA-Z]\\w*),\\s*plural,\\s*((?:(?:ze' + 'ro|one|two|few|many|other)\\s*\\{[^{}]*\\}' + '\\s*)+)\\}',
      'gu'
    );
  const result = template.replace(plural, (_, key, choices) => {
    const value = Number(params[key]);
    if (!Number.isFinite(value)) return '';
    const forms = Object.fromEntries([...choices.matchAll(/(zero|one|two|few|many|other)\s*\{([^{}]*)\}/gu)].map(([, name, message]) => [name, message]));
    const category = new Intl.PluralRules(locale).select(value);
    return (forms[category] ?? forms.other ?? '').replace(/#/gu, new Intl.NumberFormat(locale).format(value));
  });
  return result.replace(/\{([a-zA-Z]\w*)\}/gu, (match, key) => Object.hasOwn(params, key) ? String(params[key]) : match);
}

/**
 * Builds a key-based translator with an English fallback and locale-aware
 * placeholder expansion. Missing keys return the key itself.
 *
 * @param {!Record<string, string>=} messages Preferred message catalog.
 * @param {!Record<string, string>=} fallback Catalog used for missing or empty
 *     entries.
 * @param {string=} locale Locale used for plural and number formatting.
 * @return {(key: string, params?: Record<string, *>) => string} Lookup function accepting a catalog key and optional interpolation values.
 */
export function createTranslator(messages = {}, fallback = english,
  locale = DEFAULT_LANGUAGE) {
  return (key, params = {}) => {
    if (typeof key !== 'string') return key;
    const message = Object.hasOwn(messages, key) && typeof messages[key] === 'string' && messages[key].trim()
      ? messages[key] : fallback[key];
    if (typeof message !== 'string') return key;
    return formatMessage(message, params && typeof params === 'object' ? params : {}, locale);
  };
}

/**
 * Resolves a key using the active translator and optional interpolation values.
 *
 * @param {string} key Stable catalog key.
 * @param {!Object=} params Named values used when formatting the message.
 * @return {string} Translated text, or the key if no message is available.
 */
export const t = (key, params = {}) => translator(key, params);

/**
 * Returns the active application locale.
 *
 * @return {string} Selected locale code.
 */
export const currentLanguage = () => language;

/**
 * Lists the language options from the last loaded language registry.
 *
 * @return {!Record<string, string>} Frozen mapping of locale codes to labels.
 */
export const availableLanguages = () => languages;

/**
 * Formats a number using the active application locale.
 *
 * @param {number} number Value to display.
 * @param {!Object=} options Intl.NumberFormat options.
 * @return {string} Locale-specific number representation.
 */
export const formatNumber = (number, options) => new Intl.NumberFormat(language, options).format(number);

/**
 * Checks the supported language registry key syntax: a two-letter language with
 * an optional uppercase two-letter region.
 *
 * @param {string} code Candidate language identifier.
 * @return {boolean} True when the identifier matches the supported syntax.
 */
function validLanguage(code) {return /^[a-z]{2}(?:-[A-Z]{2})?$/u.test(code);}

/**
 * Reads the preferred locale from local storage if storage is accessible.
 *
 * @return {?string} Stored locale or null when missing or inaccessible.
 */
function savedLanguage() {
  try {return localStorage.getItem(STORAGE_KEY);} catch {return null;}
}

/**
 * Persists a registered language and reloads the application if running in a
 * browser.
 *
 * @param {string} code Requested locale from the language registry.
 * @return {boolean} True when the requested locale is registered.
 */
export function chooseLanguage(code) {
  if (!Object.hasOwn(languages, code)) return false;
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch { /* private/restricted storage */}
  if (typeof location !== 'undefined') location.reload();
  return true;
}

/**
 * Loads the language registry and requested catalog, falling back to the
 * bundled language files on failure. Updates document language and metadata.
 *
 * @param {Function=} fetcher Fetch-compatible function for loading locale JSON.
 * @return {!Promise<string>} Locale actually activated.
 */
export async function initializeLanguage(fetcher = globalThis.fetch) {
  if (typeof fetcher !== 'function') return language;
  try {
    const response = await fetcher('/locales/index.json');
    if (response.ok) {
      const candidates = await response.json();
      if (candidates && typeof candidates === 'object' && !Array.isArray(candidates)) {
        const entries = Object.entries(candidates).filter(([id, name]) => validLanguage(id) && typeof name === 'string');
        languages = Object.freeze(Object.fromEntries([['de', 'Deutsch'], ...entries]));
      }
    }
  } catch { /* German is bundled with the application */}
  const fromQuery = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('lang') : null;
  const requested = fromQuery || savedLanguage() || DEFAULT_LANGUAGE;
  language = Object.hasOwn(languages, requested) ? requested : DEFAULT_LANGUAGE;
  let messages = language === 'en' ? english : german;
  if (language !== DEFAULT_LANGUAGE) {
    try {
      const response = await fetcher(`/locales/${language}.json`);
      if (!response.ok) throw new Error('Language file unavailable');
      const catalog = await response.json();
      if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) throw new Error('Invalid language file');
      messages = catalog;
    } catch {language = 'en'; messages = english;}
  }
  translator = createTranslator(messages, english, language);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = language;
    document.title = t('app.meta.title');
    const description = /** @type {HTMLMetaElement|null} */ (document.querySelector('meta[name="description"]'));
    if (description) description.content = t('app.meta.description');
  }
  return language;
}

/**
 * Applies declarative translation keys to an element's text and supported
 * presentation attributes.
 *
 * @param {!Element} element Element containing data-i18n attributes.
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
 * Applies declarative translations to the root and its descendants without
 * scanning or translating arbitrary text nodes.
 *
 * @param {!Element} root DOM subtree to localize.
 */
export function translateDom(root) {
  if (!root || !root.querySelectorAll) return;
  if (root.nodeType === 1) localizeElement(root);
  for (const element of root.querySelectorAll(
    '[data-i18n], [data-i18n-aria-label], [data-i18n-aria-description], [data-i18n-title], [data-i18n-placeholder], [data-i18n-alt]')) {
    localizeElement(element);
  }
}
