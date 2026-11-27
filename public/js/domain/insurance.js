import {readAnalyticsDate} from './analytics-period.js';

export const evidenceKeys = {
  number: 'insurance.number', price: 'insurance.price', date: 'insurance.date',
  photo: 'insurance.photo', receipt: 'insurance.receipt', location: 'insurance.location',
};

/**
 * Projects the current physical inventory into a documentation checklist.
 * Missing prices are not zero; external catalogue images and unclassified files
 * are not ownership evidence. Empty bottles never enter the report.
 * @param {import('../../../shared/types.js').Collection|null} collection Current collection.
 * @param {Object|null} warehouse Current storage document.
 * @param {boolean=} includeSamples Include nonempty physical samples.
 * @return {Object} Report rows, checklist counts and separate currency totals.
 */
export function insuranceInventory(collection, warehouse, includeSamples = false) {
  const locations = new Map();
  for (const room of warehouse?.rooms || []) {
    for (const furniture of room.furniture || []) {
      for (const shelf of furniture.shelves || []) {
        locations.set(shelf.id, {room: room.name, label: `${room.name} / ${furniture.name} / ${shelf.name}`});
      }
    }
  }
  const rows = (collection?.bottlings || []).flatMap(bottling => bottling.bottles.filter(bottle =>
    ['closed', 'open'].includes(bottle.status) && (includeSamples || bottle.volumeType !== 'sample')).map(bottle => {
      const photos = (bottle.photos || []).filter(photo => photo.path && photo.source !== 'whiskybase');
      const files = bottle.files || [];
      const place = locations.get(warehouse?.assignments?.[bottle.id]) || null;
      const checks = {
        number: Boolean(bottle.inventoryNumber?.trim()),
        price: typeof bottle.purchasePrice === 'number' && Number.isFinite(bottle.purchasePrice) && bottle.purchasePrice >= 0 && /^[A-Z]{3}$/.test(bottle.currency || ''),
        date: Boolean(readAnalyticsDate(bottle.purchaseDate)),
        photo: photos.length > 0,
        receipt: files.some(file => file.purchaseEvidence === true),
        location: Boolean(place),
      };
      return {bottlingId: bottling.id, name: bottling.fullName ?? bottling.name, abv: bottling.abv, volumeMl: bottle.volumeMl ?? bottling.volumeMl, bottle, photos, files, place, checks, complete: Object.values(checks).every(Boolean)};
    }));
  rows.sort((a, b) => String(a.bottle.inventoryNumber || '').localeCompare(String(b.bottle.inventoryNumber || ''), undefined, {numeric: true}) || a.name.localeCompare(b.name));
  const totals = new Map();
  for (const row of rows) {
    if (row.checks.price) {
      const currency = row.bottle.currency;
      totals.set(currency, (totals.get(currency) || 0) + row.bottle.purchasePrice);
    }
  }
  const keys = ['number', 'price', 'date', 'photo', 'receipt', 'location'];
  return {
    rows, counts: keys.map(key => ({key, count: rows.filter(row => row.checks[key]).length})),
    complete: rows.filter(row => row.complete).length,
    closed: rows.filter(row => row.bottle.status === 'closed').length,
    open: rows.filter(row => row.bottle.status === 'open').length,
    totals: [...totals].sort(([a], [b]) => a.localeCompare(b)),
  };
}
