import {composeMarkup} from '../ui/render-plan.js';
/** Room-wide, front-facing storage wall.  The physical geometry is a single
 * scale across every furniture item. Opposing floor-plan orientations do not
 * rotate the fronts or change their displayed sizes.
 */
import {furnitureHeight, shelfLevels, visibleShelfFront}
  from '../../../shared/warehouse-compartments.js';
import {wallFurnitureGroups} from '../domain/warehouse-wall-layout.js';
import {renderUnassignedTray} from './warehouse-unassigned-tray.js';
import {unassignedWallPage} from '../domain/warehouse-unassigned-tray.js';
import {t} from '../i18n/index.js';
import {bottleSymbol, num, safe} from './warehouse-presentation.js';
import {loadTemplates} from '../ui/templates.js';

const renderTemplate = await loadTemplates(
  new URL('./templates/warehouse-room-wall.html', import.meta.url));


/** Same number of screen pixels for every real-world metre in both axes. */
export const WALL_PIXELS_PER_METRE = 230;
/**
 * Calculates the px numeric value.
 *
 * @param {*} metres Value used by this operation.
 * @return {number} Calculated numeric value.
 */
const px = metres => Math.round(metres * WALL_PIXELS_PER_METRE * 100) / 100;

/**
 * Physical order by wall orientation and projected room position.
 *
 * @param {*} room Room model containing dimensions and furniture.
 * @return {!Array<*>} Resulting list of values.
 */
export function wallFurniture(room) {
  return wallFurnitureGroups(room).flatMap(group => group.items.map(item =>
    item.furniture));
}

/**
 * Renders warehouse room wall for warehouse room wall.
 *
 * @param {*} room Room model containing dimensions and furniture.
 * @param {!Object} warehouse Warehouse model being processed.
 * @param {!Array<*>=} selectedBottleIds Selected bottle ids used by this
 * operation.
 * @param {!Object=} unassignedOptions Unassigned options used by this
 * operation.
 * @return {string} Resulting text.
 */
export function renderWarehouseRoomWall(room, warehouse, selectedBottleIds =
  [], unassignedOptions = {}) {
  const groups = wallFurnitureGroups(room);
  const selected = new Set(selectedBottleIds);
  const focusedBottleId = unassignedOptions.focusBottleId || null;

  const occupantsByShelf = new Map();
  for (const bottle of warehouse.bottles || []) {
    const shelfId = warehouse.assignments?.[bottle.id];
    if (!shelfId) continue;
    if (!occupantsByShelf.has(shelfId)) occupantsByShelf.set(shelfId, []);
    occupantsByShelf.get(shelfId).push(bottle);
  }
  /**
   * Renders furniture for warehouse room wall.
   *
   * @param {!Object} options Optional configuration for the operation.
   * @param {*} stacked Stacked used by this operation.
   * @return {string} Resulting text.
   */
  const renderFurniture = ({furniture: item, offset}, stacked) => {
    const levels = shelfLevels(item);
    const height = furnitureHeight(item);
    const widthPx = px(Number(item.width ?? 1));
    const heightPx = px(height);
    const elevationPx = px(Number(item.elevation ?? 0));
    // The shelf contract returns BOTTOM-to-TOP levels, whereas the front
    // elevation is rendered TOP-to-BOTTOM. Explicit heights may leave real
    // unused space at the top of a cabinet: it is not another drop target.
    const usedCm = levels.reduce((sum, level) => sum + level.heightCm, 0);
    const clearanceCm = Math.max(0, height * 100 - usedCm);
    const clearance = clearanceCm > 0.001
      ? renderTemplate('warehouseWallClearance', {
        px: px(clearanceCm / 100),
        safe: safe(t('warehouse.shelves.remainingHe\
ight', {height: num(clearanceCm)})),
      })
      : '';
    // The action stays inside the physical furniture outline, overlaying the
    // first bay without changing any furniture or shelf dimensions.
    const editFurniture =
      renderTemplate('warehouseFurnitureManage', {
        safe: safe(item.id),
        safe2: safe(item.name),
        safe3: safe(t('warehouse.shelves.showForFu\
rniture', {name: item.name})),
      });
    const bays = composeMarkup(levels.slice().reverse().map((level, index) => {
      const shelf = level.shelf;
      const occupants = occupantsByShelf.get(shelf.id) || [];
      const front = visibleShelfFront(item, level.index);
      const frontName = t({
        open: 'warehouse.front.open',
        door: 'warehouse.front.woodDoor',
        glass: 'warehouse.front.glassDoor',
        drawer: 'warehouse.front.drawer',
      }[front] || 'warehouse.front.open');
      const bayHeight = px(level.heightCm / 100);
      const compact = bayHeight < 52;
      const tiny = bayHeight < 30;
      // A shelf keeps its real height. Reserve actual space for the label,
      // the top rail, padding and the bottom shelf board before sizing
      // photos: otherwise the bottom of a photo disappears under the rail.
      const titleHeight = tiny ? 0 : compact ? 12 : 24;
      const topPadding = index === 0 && !tiny ? 8 : tiny ? 1 : 3;
      const bottleHeight = Math.max(
        1,
        Math.min(72, bayHeight - titleHeight - topPadding - 4 - 5 - 2)
      );
      // The elevation only shows the front of a shelf. Reserve a REAL
      // space for the +N badge rather than positioning it over the last
      // photographed bottle. Never resize the physical shelf to fit it.
      const bottleWidth = Math.max(
        10,
        Math.round(Math.min(
          bottleHeight * .6,
          Math.max(12, Math.min(27, widthPx / 5.6))
        ))
      );
      const occupancy = shelf.capacity === 0 ? '' : shelf.capacity ===
        null ? `${occupants.length}` :
        `${occupants.length} / ${shelf.capacity}`;
      // 7px cabinet uprights and 4px bay padding on each side.
      const rowWidth = Math.max(0, widthPx - 22);
      const previewSlots = Math.max(1, Math.floor((rowWidth + 2) /
        (bottleWidth + 2)));
      const maxPreview = Math.min(5, previewSlots);
      const hasOverflow = occupants.length > maxPreview;
      const previewCount = hasOverflow
        // 27px for the badge and one 2px flex gap.
        ? Math.max(
          1,
          Math.min(
            maxPreview,
            Math.floor((rowWidth - 27) / (bottleWidth + 2))
          )
        )
        : maxPreview;
      const preview = occupants.slice(0, previewCount);
      // The shelf front only shows a handful of bottles. Make a searched
      // bottle visible even when it is further back in this same shelf.
      if (previewCount && focusedBottleId && occupants.some(b => b.id ===
        focusedBottleId)
        && !preview.some(b => b.id === focusedBottleId)) {
        preview[preview.length - 1] = occupants.find(b => b.id ===
          focusedBottleId);
      }
      const hiddenCount = occupants.length - preview.length;
      const isFocusedShelf = !!focusedBottleId && occupants.some(b =>
        b.id === focusedBottleId);
      return renderTemplate('warehouseShelf', {
        isFocusedShelf: isFocusedShelf ?
          ' is-find-focus' : '',
        compact: compact ? ' warehouse-wall-bay--compact' :
          '',
        tiny: tiny ? ' warehouse-wall-bay--tiny' : '',
        index: index === 0 ?
          ' warehouse-wall-bay--top' : '',
        capacity: shelf.capacity === 0 ?
          ' warehouse-wall-bay--unavailable' : '',
        safe: safe(
          shelf.id),
        capacity2: shelf.capacity ??
          'unlimited',
        capacity3: shelf.capacity === 0 ? '' :
          ` data-act="warehouse-shelf-view" tabindex="0" \
role="button" aria-label="${safe(`${item.name} / ${shelf.name} — ${t('wareho\
use.shelves.doubleClickHint')}`)}" title="${safe(`${item.name} / ${
shelf.name} · ${frontName}${occupancy ? ` · ${occupancy}` : ''} · ${
t('warehouse.shelves.doubleClickHint')}`)}"`,
        safe2: safe(front),
        bayHeight: bayHeight,
        bottleHeight: bottleHeight,
        bottleWidth: bottleWidth,
        safe3: safe(shelf.name
        ),
        safe4: safe(frontName),
        occupancy: occupancy ? ` · ${safe(
          occupancy)}` : '',
        preview: composeMarkup(preview.map(
          bottle => {
            const isFocusedBottle = bottle.id === focusedBottleId;
            const dimmed = isFocusedShelf && focusedBottleId &&
              !isFocusedBottle;
            return renderTemplate('warehouseWallBottle', {
              has: selected.has(bottle.id) ?
                ' is-selected' : '',
              isFocusedBottle: isFocusedBottle ?
                ' is-find-focus' :
                '',
              dimmed: dimmed ? ' is-find-dimmed' :
                '',
              bottleSymbol: bottleSymbol(
                bottle,
                {
                  selectable: true,
                  selected: selected.has(bottle.id),
                }
              ),
            });
          })),
        warehouseShelfOverflow: hiddenCount ?
          renderTemplate('warehouseShelfOverflow', {
            safe: safe(t(
              'warehouse.shelves.moreBottles', {count: hiddenCount})
            ),
            hiddenCount: hiddenCount,
          }) : '',
        content: !occupants.length ?
          (shelf.capacity === 0 ?
            renderTemplate('warehouseWallNoSpace') :
            renderTemplate('hint')) : '',
      });
    }));
    return renderTemplate('warehouseWallFurniture', {
      stacked: stacked ?
        ' warehouse-wall-furniture--stacked' :
        '',
      safe: safe(item.id
      ),
      widthPx: widthPx,
      heightPx: heightPx,
      elevationPx: elevationPx,
      px: px(offset),
      clearance: clearance,
      bays: bays,
      editFurniture: editFurniture,
    });
  };
  let previousOrientation = null;
  const cards = composeMarkup(groups.map(group => {
    const changeWall = previousOrientation !== null &&
      previousOrientation !== group.orientation;
    previousOrientation = group.orientation;
    const furnitureHtml = composeMarkup(group.items.map(entry =>
      renderFurniture(entry, group.items.length > 1)));
    return renderTemplate('warehouseWallStack', {
      length: group.items.length > 1 ?
        ' warehouse-wall-stack--layered' : '',
      changeWall: changeWall ?
        ' warehouse-wall-stack--new-direction' :
        '',
      orientation: group.orientation,
      px: px(
        group.width),
      px2: px(group.height
      ),
      furnitureHtml: furnitureHtml,
    });
  }));
  return renderTemplate('warehouseRoomWall', {
    focusedBottleId: focusedBottleId ?
      ' has-find-focus' : '',
    safe: safe(t('warehouse.wall.aria',
      {room: room.name})),
    safe2: safe(t(
      'warehouse.bottles.bulkTools')),
    safe3: safe(t('warehouse.bottles.bulkSelected', {count: selected.size})),
    expanded: unassignedOptions.expanded ? 'true' : 'false',
    safe4: safe(t('warehouse.wall.unassignedToggleHint')),
    unassignedTitle: t(
      'warehouse.wall.unassignedTitle',
      {count: unassignedWallPage(warehouse).total}
    ),
    size: selected.size ? '' :
      'disabled',
    size2: selected.size === 1 ? '' : 'disabled',
    size3: selected.size ? '' : 'disabled',
    unassignedTray: renderUnassignedTray(
      warehouse,
      selectedBottleIds,
      {...unassignedOptions, embedded: true}
    ),
    warehouseWallScroll: groups.length ?
      renderTemplate('warehouseWallScroll', {
        safe: safe(room.id
        ),
        safe2: safe(t(
          'warehouse.wall.scrollAria')),
        cards: cards,
      }) : renderTemplate('warehouseRoomWallEmpty'),
  });
}
