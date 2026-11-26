/** @fileoverview Shared validation and normalization of template bindings. */
const attributeName = /^[a-zA-Z_:][\w:.-]*$/;
const tagName = /^(?:a|article|button|dd|div|dl|dt|h2|h3|p|section|span|strong)$/;
const booleanAttributes = new Set(['checked', 'disabled', 'hidden', 'open', 'required', 'selected', 'multiple', 'readonly', 'autofocus']);

/**
 * Validates a dynamic tag against the supported semantic element choices.
 * @param {*} value Application-selected element name.
 * @return {string} Validated tag name.
 */
export function checkedTag(value) {
  const name = String(value);
  if (!tagName.test(name)) throw new Error(`Invalid template tag: ${name}`);
  return name;
}

/**
 * Validates an attribute name, rejecting executable event attributes.
 * @param {string} name Attribute name.
 * @return {string} Validated name.
 */
export function checkedAttribute(name) {
  if (!attributeName.test(name) || /^on/i.test(name) || name.toLowerCase() === 'srcdoc') {
    throw new Error(`Invalid template attribute: ${name}`);
  }
  return name;
}

/**
 * Converts an attribute map into validated literal values. Nullish values
 * omit attributes; false only omits HTML boolean attributes (ARIA retains it).
 * @param {*} value Attribute map, not an HTML string.
 * @return {Array<[string, string, boolean]>} Validated name, literal value and boolean-attribute flag.
 */
export function attributeEntries(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new TypeError('Template attributes must be a plain object');
  }
  return Object.entries(value).flatMap(([name, item]) => {
    checkedAttribute(name);
    const flag = booleanAttributes.has(name.toLowerCase());
    if (item == null || (flag && item === false)) return [];
    if (!['string', 'number', 'boolean'].includes(typeof item)) {
      throw new TypeError(`Invalid template attribute value: ${name}`);
    }
    return [[name, flag && item === true ? '' : String(item), flag && item === true]];
  });
}
