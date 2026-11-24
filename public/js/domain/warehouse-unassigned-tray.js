/** A virtual staging shelf: only the current page is rendered, regardless of inventory size.
 * It is not persisted as furniture, and never creates a fictitious shelf ID.
 */
export const UNASSIGNED_WALL_PAGE_SIZE = 24;

/**
 * Paginates unassigned bottles for the selected room wall.
 *
 * @param {!Object} warehouse Warehouse model being processed.
 * @param {!Object=} options2 Destructured options for this operation.
 * @return {!Object} Structured result for the caller.
 */
export function unassignedWallPage(
  warehouse,
  {query = '', page = 1, pageSize = UNASSIGNED_WALL_PAGE_SIZE} = {}
) {
  const all = (warehouse?.bottles || []).filter(bottle =>
    !warehouse?.assignments?.[bottle.id]);
  const term = String(query).trim().toLocaleLowerCase('de');
  const filtered = term ? all.filter(bottle =>
    [bottle.name, bottle.number, bottle.id].some(value =>
      String(value ?? '').toLocaleLowerCase('de').includes(term))) : all;
  const size = Number.isSafeInteger(pageSize) && pageSize > 0 ?
    Math.min(pageSize, 100) : UNASSIGNED_WALL_PAGE_SIZE;
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const requested = Number.isSafeInteger(page) ? page : 1;
  const currentPage = Math.min(Math.max(1, requested), pages);
  return {
    total: all.length,
    filtered: filtered.length,
    page: currentPage,
    pages,
    items: filtered.slice((currentPage - 1) * size, currentPage * size),
  };
}
