/** @fileoverview Clones static templates and binds values through the DOM. */
import {RenderPlan, SLOT, slotValue, scalarBinding} from './render-plan.js';
import {attributeEntries, checkedAttribute, checkedTag} from './bindings.js';

/**
 * Parsed template slot located by an inert marker in the static DOM.
 * @typedef {{mode: string, key: string}} SlotDescriptor
 */

/**
 * Original attribute name kept outside the static parser input.
 * @typedef {{name: string}} BoundAttribute
 */

/**
 * Static parser input and descriptors needed to bind a fresh clone.
 * @typedef {{markup: string, slots: SlotDescriptor[], boundAttributes: BoundAttribute[]}} PreparedTemplate
 */

const templates = new WeakMap();
const marker = /wcm-slot-(\d+)-end/g;
const htmlNamespace = 'http://www.w3.org/1999/xhtml';
const xlinkNamespace = 'http://www.w3.org/1999/xlink';
const xmlNamespace = 'http://www.w3.org/XML/1998/namespace';
/**
 * Builds parser-safe static markup with inert markers instead of user values.
 * Tag names and dynamic attribute names are validated structural choices.
 * @param {!RenderPlan} plan Template instance.
 * @return {!PreparedTemplate} Static markup and slot descriptors.
 * @throws {Error} If a tag, attribute name or structural slot is invalid.
 */
function prepare(plan) {
  const slots = [];
  const boundAttributes = [];
  const source = plan.source.replace(SLOT, (whole, mode, key) => {
    if (mode !== 'tag') return whole;
    return checkedTag(slotValue(plan, mode, key));
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
      const index = slots.push({mode, key}) - 1;
      if (quote) return `wcm-slot-${index}-end`;
      if (mode !== 'attrs') throw new Error('Invalid structural template slot');
      return ` data-wcm-slot-${index}-end=""`;
    });
    // Never give the HTML/SVG parser placeholder URLs, paths or numbers.
    return marked.replace(/\s+([\w:.-]+)\s*=\s*("[^"]*"|'[^']*')/g,
      (whole, name, quoted) => {
        if (!/wcm-slot-\d+-end/.test(quoted)) return whole;
        const index = boundAttributes.push({
          name: checkedAttribute(name),
        }) - 1;
        return ` data-wcm-bound-${index}=${quoted}`;
      });
  });
  return {markup, slots, boundAttributes};
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
  const key = `${context?.namespaceURI || htmlNamespace}:${context?.localName || 'template'}:${source}`;
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
  const namespace = name.startsWith('xlink:') ? xlinkNamespace : name.startsWith('xml:') ? xmlNamespace : null;
  if (namespace) element.setAttributeNS(namespace, name, value);
  else element.setAttribute(name, value);
}

/**
 * Binds a static clone in document order, recursively composing child plans.
 * @param {!Node} root Static clone or element.
 * @param {!RenderPlan} plan Template instance.
 * @param {!Array<SlotDescriptor>} slots Slot descriptors.
 * @param {!Array<BoundAttribute>} boundAttributes Dynamic attribute descriptors.
 * @param {!Document} doc Owning document.
 * @param {?Element} context Parent context for top-level slots.
 */
function bind(root, plan, slots, boundAttributes, doc, context) {
  if (root.nodeType === 1) {
    const element = /** @type {!Element} */ (root);
    for (const attr of [...element.attributes]) {
      const dynamic = attr.name.match(/^data-wcm-slot-(\d+)-end$/);
      const bound = attr.name.match(/^data-wcm-bound-(\d+)$/);
      if (bound) {
        const {name} = boundAttributes[Number(bound[1])];
        const value = attr.value;
        element.removeAttribute(attr.name);
        setAttribute(element, name, value.replace(marker, (_, index) => scalarBinding(plan, slots[Number(index)].mode, slots[Number(index)].key)));
      } else if (dynamic) {
        const {mode, key} = slots[Number(dynamic[1])];
        element.removeAttribute(attr.name);
        for (const [name, value] of attributeEntries(slotValue(plan, mode, key))) {
          setAttribute(element, name, value);
        }
      } else {
        const value = attr.value.replace(marker, (_, index) => scalarBinding(plan, slots[Number(index)].mode, slots[Number(index)].key));
        if (value !== attr.value) setAttribute(element, attr.name, value);
      }
    }
    context = element;
  } else if (root.nodeType === 8) {
    const comment = /** @type {!Comment} */ (root);
    const match = comment.data.match(/^wcm-slot-(\d+)-end$/);
    if (match) {
      const slot = slots[Number(match[1])];
      const value = slotValue(plan, slot.mode, slot.key);
      const fragment = slot.mode === 'content' ? materialize(/** @type {import('./render-plan.js').RenderContent} */(value), doc, context) : doc.createTextNode(scalarBinding(plan, slot.mode, slot.key));
      comment.replaceWith(fragment);
      return;
    }
  } else if (root.nodeType === 3) {
    // Raw-text elements such as textarea retain comment markers as text.
    const text = /** @type {!Text} */ (root);
    text.data = text.data.replace(/<!--wcm-slot-(\d+)-end-->/g, (_, index) => scalarBinding(plan, slots[Number(index)].mode, slots[Number(index)].key));
  }
  for (const child of [...root.childNodes]) {
    bind(child, plan, slots, boundAttributes, doc, context);
  }
}

/**
 * Produces fresh DOM nodes from a render plan. No dynamic HTML is parsed.
 * @param {import('./render-plan.js').RenderContent} value Render plan, native node, or literal text.
 * @param {!Document} doc Owning document.
 * @param {?Element=} context Parent parser context for static child templates.
 * @return {!Node} Fresh fragment or text node, or the supplied native node unchanged.
 */
export function materialize(value, doc, context = null) {
  if (value && typeof value === 'object' && 'nodeType' in value && value.nodeType && typeof value.cloneNode === 'function') return value;
  if (!(value instanceof RenderPlan)) {
    return doc.createTextNode(String(value ?? ''));
  }
  if (value.parts) {
    const group = doc.createDocumentFragment();
    for (const part of value.parts) group.append(materialize(part, doc, context));
    return group;
  }
  const {markup, slots, boundAttributes} = prepare(value);
  const fragment = cloneStatic(doc, context, markup);
  bind(fragment, value, slots, boundAttributes, doc, context);
  fragment.normalize();
  return fragment;
}

/**
 * Replaces a host's content with native nodes.
 * @param {!Element} host Target element.
 * @param {import('./render-plan.js').RenderContent} value Content to mount; existing native nodes are moved.
 */
export function replaceContent(host, value) {
  host.replaceChildren(materialize(value, host.ownerDocument, host));
}

/**
 * Appends native content without rebuilding existing nodes.
 * @param {!Element} host Target element.
 * @param {import('./render-plan.js').RenderContent} value Content to mount; existing native nodes are moved.
 */
export function appendContent(host, value) {
  host.append(materialize(value, host.ownerDocument, host));
}

/**
 * Replaces one element with native content in its original parent context.
 * @param {!Element} element Existing element.
 * @param {import('./render-plan.js').RenderContent} value Content to mount; existing native nodes are moved.
 */
export function replaceElement(element, value) {
  element.replaceWith(materialize(value, element.ownerDocument, element.parentElement));
}
