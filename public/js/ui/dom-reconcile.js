/**
 * Small, dependency-free keyed DOM reconciliation for explicitly opted-in page
 * regions. Unlike string outerHTML comparisons, this preserves unchanged
 * images, focus and event-bound controls while updating only changed nodes. No
 * direct event binding.
 *
 * @param {!Element} node DOM or syntax node to process.
 * @return {*} Stable reconciliation key for a keyed element, or no key for an unkeyed node.
 */
// Only photo *tiles* are keyed by photo ID. Their edit, delete and move
// controls share the same data-photo-id but must never be reconciled as
// interchangeable siblings (the old key discarded edit buttons on refresh).
const keyFor = node => node.nodeType === 1
  ? (node.getAttribute('data-region') || node.id ||
    (node.hasAttribute('data-photo-tile') ? `photo:${node.getAttribute('data-photo-id')}` : null))
  : null;

/**
 * Checks node type, element tag and reconciliation key before reusing an existing node.
 *
 * @param {*} a First entry or operand in the calculation.
 * @param {*} b Second entry or operand in the calculation.
 * @return {boolean} True when the existing node can be reused for the incoming node.
 */
function compatible(a, b) {
  return a?.nodeType === b?.nodeType && (a.nodeType !== 1 || (a.tagName === b.tagName && keyFor(a) === keyFor(b)));
}

/**
 * Installs event listeners for reconcile node interactions.
 *
 * @param {*} current Existing DOM node to update in place or replace for an imperative widget.
 * @param {*} next Next candidate state or entry.
 */
function reconcileNode(current, next) {
  // Imperative widgets own their event and animation lifecycle. A subtree
  // marked as an island is always remounted; the rest remains keyed/morphed.
  if (next.getAttribute?.('data-reconcile') === 'replace') {
    current.replaceWith(next.cloneNode(true));
    return;
  }
  if (current.isEqualNode(next)) return;
  if (current.nodeType !== 1) {
    if (current.nodeValue !== next.nodeValue) current.nodeValue = next.nodeValue;
    return;
  }
  // Preserve image layout during a source transition until the new image loads.
  const changingImage = current.tagName === 'IMG' && current.getAttribute('src') !== next.getAttribute('src');
  const container = changingImage ? current.parentElement : null;
  const priorHeight = container?.getBoundingClientRect().height || 0;
  const priorMinHeight = container?.style.minHeight || '';
  if (container && priorHeight) container.style.minHeight = `${priorHeight}px`;
  for (const attr of [...current.attributes]) if (!next.hasAttribute(attr.name)
  ) current.removeAttribute(attr.name);
  for (const attr of [...next.attributes]) if (current.getAttribute(attr.name) !== attr.value) current.setAttribute(attr.name, attr.value);
  if (changingImage && container && priorHeight) {
    /**
     * Restores the container's original minimum height after reconciliation.
     */
    const done = () => {container.style.minHeight = priorMinHeight;};
    if (current.complete && current.naturalWidth) requestAnimationFrame(done);
    else {
      current.addEventListener('load', done, {once: true});
      current.addEventListener('error', done, {once: true});
    }
  }
  // Do not reset text currently entered into a focused control.
  if (current === document.activeElement && ['INPUT', 'TEXTAREA'].includes(current.tagName)) return;
  reconcileChildren(current, next);
}

/**
 * Reorder keyed items by stable IDs, and patch unkeyed nodes by position.
 *
 * @param {*} current Current resource data to update.
 * @param {*} next Desired DOM container whose children define the target order and content.
 */
export function reconcileChildren(current, next) {
  const desired = [...next.childNodes];
  const keyed = new Map([...current.childNodes].filter(node => keyFor(node)).map(node => [keyFor(node), node]));
  let cursor = current.firstChild;
  for (const incoming of desired) {
    const key = keyFor(incoming);
    const existing = key ? keyed.get(key) : cursor;
    if (existing && compatible(existing, incoming)) {
      if (existing !== cursor) current.insertBefore(existing, cursor);
      reconcileNode(existing, incoming);
      cursor = existing.nextSibling;
    } else {
      const added = incoming.cloneNode(true);
      current.insertBefore(added, cursor);
      cursor = added.nextSibling;
    }
  }
  while (cursor) {
    const nextNode = cursor.nextSibling;
    current.removeChild(cursor);
    cursor = nextNode;
  }
}
