/** @fileoverview Clones static templates and binds values through the DOM. */
import {RenderPlan, SLOT, slotValue} from './render-plan.js';

const templates = new WeakMap();
const marker = /wcm-slot-(\d+)-end/g;
const tagName = new RegExp(
  '^(?:a|article|button|dd|div|dl|dt|h2|h3|p|section|span|strong)$');
const attributeName = /^[a-zA-Z_:][\w:.-]*$/;
const htmlNamespace = 'http://www.w3.org/1999/xhtml';
const xlinkNamespace = 'http://www.w3.org/1999/xlink';
const xmlNamespace = 'http://www.w3.org/XML/1998/namespace';
const entities = {'amp': '&', 'lt': '<', 'gt': '>', 'quot': '"', '#39': "'"};

/**
 * Decodes the five entities used by the former HTML escape helper once.
 * @param {*} value Previously escaped raw text or attribute value.
 * @return {string} Literal DOM text.
 */
function unescapeText(value) {
  return String(value).replace(/&(amp|lt|gt|quot|#39);/g,
    (_, name) => entities[name]);
}

/**
 * Rejects executable attributes and malformed dynamic attribute names.
 * @param {string} name Attribute name.
 * @return {string} Validated name.
 */
function checkedAttribute(name) {
  if (!attributeName.test(name) || /^on/i.test(name) ||
    name.toLowerCase() === 'srcdoc') {
    throw new Error(`Invalid template attribute: ${name}`);
  }
  return name;
}

/**
 * Converts old attribute-list bindings to DOM attributes without parsing HTML.
 * @param {!Element} element Target element.
 * @param {*} value Application-generated attribute list.
 */
function bindAttributes(element, value) {
  let remaining = String(value).trim();
  const pattern = /^([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/;
  while (remaining) {
    const match = remaining.match(pattern);
    if (!match) throw new Error('Invalid template attribute list');
    element.setAttribute(checkedAttribute(match[1]),
      unescapeText(match[2] ?? match[3] ?? match[4] ?? ''));
    remaining = remaining.slice(match[0].length).trim();
  }
}

/**
 * Builds parser-safe static markup with inert markers instead of user values.
 * Tag names and dynamic attribute names are validated structural choices.
 * @param {!RenderPlan} plan Template instance.
 * @return {!Object} Static markup and slot descriptors.
 */
function prepare(plan) {
  const slots = [];
  const boundAttributes = [];
  const source = plan.source.replace(SLOT, (whole, mode, key) => {
    if (mode !== 'tag') return whole;
    const value = String(slotValue(plan, mode, key));
    if (!tagName.test(value)) throw new Error(`Invalid template tag: ${value}`);
    return value;
  });
  const tokens = new RegExp([
    /<!--[^]*?-->/, /<\/?(?:[^>"']|"[^"]*"|'[^']*')+>/, SLOT,
  ].map(pattern => pattern.source).join('|'), 'g');
  const markup = source.replace(tokens, token => {
    if (token.startsWith('<!--')) return token;
    if (!token.startsWith('<')) {
      const [, mode, key] = [...token.matchAll(SLOT)][0];
      const index = slots.push({mode, key}) - 1;
      return `<!--wcm-slot-${index}-end-->`;
    }
    let quote = '';
    let previous = 0;
    const marked = token.replace(SLOT, (whole, mode, key, offset) => {
      for (const char of token.slice(previous, offset)) {
        if (quote) {
          if (char === quote) quote = '';
        } else if (char === '"' || char === "'") quote = char;
      }
      previous = offset + whole.length;
      if (!quote && /^\s*=/.test(token.slice(previous))) {
        return checkedAttribute(String(slotValue(plan, mode, key)));
      }
      const index = slots.push({mode, key}) - 1;
      if (quote) return `wcm-slot-${index}-end`;
      if (mode !== 'raw') throw new Error('Invalid structural template slot');
      return ` data-wcm-slot-${index}-end=""`;
    });
    // Never give the HTML/SVG parser placeholder URLs, paths or numbers.
    return marked.replace(/\s+([\w:.-]+)\s*=\s*("[^"]*"|'[^']*')/g,
      (whole, name, quoted) => {
        if (!/wcm-slot-\d+-end/.test(quoted)) return whole;
        const index = boundAttributes.push({
          name: checkedAttribute(name),
          value: unescapeText(quoted.slice(1, -1)),
        }) - 1;
        return ` data-wcm-bound-${index}=""`;
      });
  });
  return {markup, slots, boundAttributes};
}

/**
 * Resolves a marker to literal text. Raw values historically contained escaped
 * text; they are decoded once, never interpreted as markup.
 * @param {!RenderPlan} plan Template instance.
 * @param {!Object} slot Slot descriptor.
 * @return {string} Literal text for a node or attribute.
 */
function textValue(plan, slot) {
  const value = slotValue(plan, slot.mode, slot.key);
  if (value instanceof RenderPlan) {
    throw new Error(`Markup used in text or attribute: ${slot.key}`);
  }
  return slot.mode === 'raw' ? unescapeText(value) : String(value ?? '');
}

/**
 * Caches static DOM trees per document, parser context and structural variant.
 * @param {!Document} doc Owning document.
 * @param {?Element} context Parent element, for SVG/table/select namespaces.
 * @param {string} source Static markup with inert markers.
 * @return {!DocumentFragment} Fresh clone of the static structure.
 */
function cloneStatic(doc, context, source) {
  if (!templates.has(doc)) templates.set(doc, new Map());
  const cache = templates.get(doc);
  const key = `${context?.namespaceURI || htmlNamespace}:${context?.localName ||
    'template'}:${source}`;
  if (!cache.has(key)) {
    let fragment;
    if (context) {
      const range = doc.createRange();
      range.selectNodeContents(context);
      fragment = range.createContextualFragment(source);
    } else {
      const template = doc.createElement('template');
      template.innerHTML = source;
      fragment = template.content;
    }
    cache.set(key, fragment);
  }
  return cache.get(key).cloneNode(true);
}

/**
 * Updates an attribute without changing its namespace (for SVG/XML attributes).
 * @param {!Element} element Target element.
 * @param {string} name Attribute name.
 * @param {string} value Literal bound value.
 */
function setAttribute(element, name, value) {
  const namespace = name.startsWith('xlink:') ? xlinkNamespace :
    name.startsWith('xml:') ? xmlNamespace : null;
  if (namespace) element.setAttributeNS(namespace, name, value);
  else element.setAttribute(name, value);
}

/**
 * Binds a static clone in document order, recursively composing child plans.
 * @param {!Node} root Static clone or element.
 * @param {!RenderPlan} plan Template instance.
 * @param {!Array<!Object>} slots Slot descriptors.
 * @param {!Array<!Object>} boundAttributes Dynamic attribute descriptors.
 * @param {!Document} doc Owning document.
 * @param {?Element} context Parent context for top-level slots.
 */
function bind(root, plan, slots, boundAttributes, doc, context) {
  if (root.nodeType === 1) {
    for (const attr of [...root.attributes]) {
      const dynamic = attr.name.match(/^data-wcm-slot-(\d+)-end$/);
      const bound = attr.name.match(/^data-wcm-bound-(\d+)$/);
      if (bound) {
        const {name, value} = boundAttributes[Number(bound[1])];
        root.removeAttribute(attr.name);
        setAttribute(root, name, value.replace(marker, (_, index) =>
          textValue(plan, slots[Number(index)])));
      } else if (dynamic) {
        const {mode, key} = slots[Number(dynamic[1])];
        root.removeAttribute(attr.name);
        bindAttributes(root, slotValue(plan, mode, key));
      } else {
        const value = attr.value.replace(marker, (_, index) =>
          textValue(plan, slots[Number(index)]));
        if (value !== attr.value) setAttribute(root, attr.name, value);
      }
    }
    context = root;
  } else if (root.nodeType === 8) {
    const match = root.data.match(/^wcm-slot-(\d+)-end$/);
    if (match) {
      const slot = slots[Number(match[1])];
      const value = slotValue(plan, slot.mode, slot.key);
      const fragment = slot.mode === 'raw' ?
        materialize(value, doc, context) :
        doc.createTextNode(String(value ?? ''));
      root.replaceWith(fragment);
      return;
    }
  } else if (root.nodeType === 3) {
    // Raw-text elements such as textarea retain comment markers as text.
    root.data = root.data.replace(/<!--wcm-slot-(\d+)-end-->/g,
      (_, index) => textValue(plan, slots[Number(index)]));
  }
  for (const child of [...root.childNodes]) {
    bind(child, plan, slots, boundAttributes, doc, context);
  }
}

/**
 * Produces fresh DOM nodes from a render plan. No dynamic HTML is parsed.
 * @param {*} value Render plan, native node, or previously escaped text.
 * @param {!Document} doc Owning document.
 * @param {?Element=} context Parent parser context for static child templates.
 * @return {!Node} Detached DOM node or fragment.
 */
export function materialize(value, doc, context = null) {
  if (value?.nodeType && typeof value.cloneNode === 'function') return value;
  if (!(value instanceof RenderPlan)) {
    return doc.createTextNode(unescapeText(value ?? ''));
  }
  if (value.parts) {
    const group = doc.createDocumentFragment();
    for (const part of value.parts) group.append(materialize(part, doc,
      context));
    return group;
  }
  const {markup, slots, boundAttributes} = prepare(value);
  const fragment = cloneStatic(doc, context, markup);
  bind(fragment, value, slots, boundAttributes, doc, context);
  fragment.normalize();
  return fragment;
}

/**
 * Replaces a host's content with native nodes. The fallback is exclusively for
 * existing DOM-free test doubles receiving serialized template output.
 * @param {!Element} host Target element.
 * @param {*} value Render plan or native node.
 */
export function replaceContent(host, value) {
  if (!host.ownerDocument) {host.innerHTML = value; return;}
  host.replaceChildren(materialize(value, host.ownerDocument, host));
}

/**
 * Appends native content without rebuilding existing nodes.
 * @param {!Element} host Target element.
 * @param {*} value Render plan or native node.
 */
export function appendContent(host, value) {
  if (!host.ownerDocument) {
    if (host.insertAdjacentHTML) host.insertAdjacentHTML('beforeend', value);
    else host.innerHTML += value;
    return;
  }
  host.append(materialize(value, host.ownerDocument, host));
}

/**
 * Replaces one element with native content in its original parent context.
 * @param {!Element} element Existing element.
 * @param {*} value Render plan or native node.
 */
export function replaceElement(element, value) {
  element.replaceWith(materialize(value, element.ownerDocument,
    element.parentElement));
}
