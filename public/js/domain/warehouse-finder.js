/**
 * Read-only search across physical bottles and their actual shelf locations.
 */
export const WAREHOUSE_FINDER_PAGE_SIZE = 24;

const normalize = value => String(value ?? '').normalize('NFKC')
  .toLocaleLowerCase().trim();

export function findWarehouseBottles(
  warehouse,
  {
    query = '',
    placement = 'all',
    page = 1,
    pageSize = WAREHOUSE_FINDER_PAGE_SIZE
  } = {}
) {
  const locations = new Map();
  for (const room of warehouse?.rooms ||
    []) for (const furniture of room.furniture ||
      []) for (const shelf of furniture.shelves || []) {
        locations.set(
          shelf.id,
          {
            room,
            furniture,
            shelf,
            label: `${room.name} / ${furniture.name} / ${shelf.name}`,
          }
        );
      }
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const normalizedPlacement = ['all', 'assigned', 'unassigned']
    .includes(placement) ? placement : 'all';
  const results = (warehouse?.bottles || []).flatMap(bottle => {
    const place = locations.get(warehouse.assignments?.[bottle.id]) || null;
    if (normalizedPlacement === 'assigned' && !place) return [];
    if (normalizedPlacement === 'unassigned' && place) return [];
    const haystack = normalize([
      bottle.name,
      bottle.number,
      bottle.number ? `#${bottle.number}` : '',
      bottle.ageYears,
      bottle.releaseYear,
      bottle.caskType,
      bottle.volumeMl,
      place?.label,
    ].filter(value => value != null).join(' '));
    return terms.every(term => haystack.includes(term)) ?
      [{bottle, place}] : [];
  });
  results.sort((left, right) => left.bottle.name.localeCompare(
    right.bottle.name,
    undefined,
    {numeric: true}
  ) ||
    String(left.bottle.number ?? '').localeCompare(String(right.bottle
      .number ?? ''),
      undefined,
      {numeric: true}
    ));
  const size = Math.max(
    1,
    Math.min(100, Math.floor(pageSize) || WAREHOUSE_FINDER_PAGE_SIZE)
  );
  const pages = Math.max(1, Math.ceil(results.length / size));
  const currentPage = Math.max(1, Math.min(pages, Math.floor(Number(page)) || 1));
  return {
    items: results.slice((currentPage - 1) * size, currentPage * size),
    total: results.length,
    page: currentPage,
    pages,
  };
}
