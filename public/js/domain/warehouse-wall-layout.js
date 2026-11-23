import {furnitureHeight} from '../../../shared/warehouse-compartments.js';
import {furnitureFootprint} from './warehouse-3d-model.js';

/** Flatten four facing directions into adjacent front elevations. Furniture
 * retains its physical order on each wall; overlapping front projections
 * linked by vertical support belong in the SAME elevation group, including
 * a wide wall cabinet over several narrow lower cabinets.
 */
const natural = new Intl.Collator(undefined, {numeric: true, sensitivity: 'base'});
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const angle = furniture => ((finite(furniture.rotation) % 360) + 360) % 360;
const overlap = (a, b) => Math.max(0, Math.min(a[1], b[1]) - Math.max(a[0], b[0]));

function position(furniture) {
  const orientation = angle(furniture);
  const x = finite(furniture.x);
  const y = finite(furniture.y);
  const width = Math.max(.01, finite(furniture.width, 1));
  const depth = Math.max(.01, finite(furniture.depth, .5));
  const footprint = furnitureFootprint({...furniture, width, depth, rotation: orientation});
  // Opposite-facing units are viewed from the opposite side, so their
  // horizontal reading direction is reversed, not the shelf numbering.
  const left = orientation === 180 ? -x - footprint.width
    : orientation === 270 ? -y - footprint.depth
      : orientation === 90 ? y : x;
  return {
    furniture, orientation, xRange: [x, x + footprint.width],
    yRange: [y, y + footprint.depth], left, right: left + width,
    bottom: Math.max(0, finite(furniture.elevation)),
    top: Math.max(0, finite(furniture.elevation)) + furnitureHeight(furniture),
    hasPosition: Number.isFinite(Number(furniture.x)) && Number.isFinite(Number(furniture.y))
      && furniture.x != null && furniture.y != null,
  };
}

function verticallySeparate(a, b) {
  return a.top <= b.bottom + .015 || b.top <= a.bottom + .015;
}
function sameFootprint(a, b) {
  if (!a.hasPosition || !b.hasPosition || a.orientation !== b.orientation) return false;
  const x = overlap(a.xRange, b.xRange);
  const y = overlap(a.yRange, b.yRange);
  const minWidth = Math.min(a.xRange[1] - a.xRange[0], b.xRange[1] - b.xRange[0]);
  const minDepth = Math.min(a.yRange[1] - a.yRange[0], b.yRange[1] - b.yRange[0]);
  return x >= .6 * minWidth && y >= .6 * minDepth;
}
function shouldStack(a, b) {return sameFootprint(a, b) && verticallySeparate(a, b);}

/** Geometry groups in display order; items contain their front-projection left
 * and physical bottom/top. No mutation of warehouse furniture or assignments.
 */
export function wallFurnitureGroups(room) {
  const entries = (room?.furniture || []).filter(furniture => furniture.shelves?.length).map(position);
  const visited = new Set();
  const groups = [];
  for (const entry of entries) {
    if (visited.has(entry)) continue;
    const group = [entry];
    visited.add(entry);
    for (let i = 0; i < group.length; i++) {
      for (const next of entries) {
        if (visited.has(next) || !shouldStack(group[i], next)) continue;
        // Connect by *physical support*, not by comparing every pair:
        // one wide upper cabinet may span TWO lower cabinets at the
        // same elevation. Those lower cabinets overlap in height with
        // each other but must share the same wall column with the top.
        visited.add(next);
        group.push(next);
      }
    }
    const left = Math.min(...group.map(item => item.left));
    const right = Math.max(...group.map(item => item.right));
    group.sort((a, b) => a.bottom - b.bottom || natural.compare(a.furniture.name || '', b.furniture.name || ''));
    groups.push({
      orientation: entry.orientation, left, width: right - left,
      height: Math.max(...group.map(item => item.top)),
      items: group.map(item => ({...item, offset: item.left - left})),
    });
  }
  const orientations = [0, 90, 180, 270];
  groups.sort((a, b) => orientations.indexOf(a.orientation) - orientations.indexOf(b.orientation)
    || a.left - b.left
    || natural.compare(a.items[0].furniture.name || '', b.items[0].furniture.name || '')
    || String(a.items[0].furniture.id).localeCompare(String(b.items[0].furniture.id)));
  return groups;
}
