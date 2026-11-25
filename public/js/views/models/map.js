/**
 * Prepares the selected map site and its paginated bottlings.
 * @param {!Array<!Object>} sites Available distillery sites.
 * @param {string} selectedId Selected site identifier.
 * @param {string} search Bottling search text.
 * @param {number} page Requested page.
 * @param {number} pageLimit Maximum visible entries.
 * @return {!Object} Selected site and filtered entries.
 */
export function createMapSidebarViewModel(sites, selectedId, search, page,
  pageLimit) {
  const selected = sites.find(site => site.id === selectedId) || null;
  const filtered = selected ? selected.bottlings.filter(entry =>
    entry.name.toLocaleLowerCase('de')
      .includes(search.toLocaleLowerCase('de'))) : [];
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageLimit));
  const currentPage = Math.max(1, Math.min(page, totalPages));
  const subset = filtered.slice((currentPage - 1) * pageLimit, currentPage *
    pageLimit);
  return {selected, filtered, totalPages, currentPage, subset};
}
