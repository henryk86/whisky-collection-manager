/** Room-wide, front-facing storage wall.  The physical geometry is a single
 * scale across every furniture item. Opposing floor-plan orientations do not
 * rotate the fronts or change their displayed sizes.
 */
import { furnitureHeight, shelfLevels, visibleShelfFront } from '../domain/warehouse-compartments.js';
import { wallFurnitureGroups } from '../domain/warehouse-wall-layout.js';
import { renderUnassignedTray } from './warehouse-unassigned-tray.js';
import { unassignedWallPage } from '../domain/warehouse-unassigned-tray.js';
import { t } from '../i18n/index.js';
import { bottleSymbol, num, safe } from './warehouse-presentation.js';

/** Same number of screen pixels for every real-world metre in both axes. */
export const WALL_PIXELS_PER_METRE = 230;
const px = metres => Math.round(metres * WALL_PIXELS_PER_METRE * 100) / 100;

/** Physical order by wall orientation and projected room position. */
export function wallFurniture(room) {
    return wallFurnitureGroups(room).flatMap(group => group.items.map(item => item.furniture));
}

export function renderWarehouseRoomWall(room, warehouse, selectedBottleIds = [], unassignedOptions = {}) {
    const groups = wallFurnitureGroups(room);
    const selected = new Set(selectedBottleIds);

    const occupantsByShelf = new Map();
    for (const bottle of warehouse.bottles || []) {
        const shelfId = warehouse.assignments?.[bottle.id];
        if (!shelfId) continue;
        if (!occupantsByShelf.has(shelfId)) occupantsByShelf.set(shelfId, []);
        occupantsByShelf.get(shelfId).push(bottle);
    }
    const renderFurniture = ({ furniture: item, offset }, stacked) => {
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
            ? `<div class="warehouse-wall-clearance" style="--wall-clearance-height:${px(clearanceCm / 100)}px" title="${safe(t('warehouse.shelves.remainingHeight', {height:num(clearanceCm)}))}" aria-hidden="true"></div>`
            : '';
        // The action stays inside the physical furniture outline, overlaying the
        // first bay without changing any furniture or shelf dimensions.
        const editFurniture = `<button type="button" class="warehouse-wall-furniture-edit" data-act="warehouse-furniture-manage" data-id="${safe(item.id)}" title="${safe(item.name)}" aria-label="${safe(t('warehouse.shelves.showForFurniture',{name:item.name}))}"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>`;
        const bays = levels.slice().reverse().map((level, index) => {
            const shelf = level.shelf;
            const occupants = occupantsByShelf.get(shelf.id) || [];
            const front = visibleShelfFront(item, level.index);
            const frontName = t({open:'warehouse.front.open',door:'warehouse.front.woodDoor',glass:'warehouse.front.glassDoor',drawer:'warehouse.front.drawer'}[front] || 'warehouse.front.open');
            const bayHeight = px(level.heightCm / 100);
            const compact = bayHeight < 52;
            const tiny = bayHeight < 30;
            const bottleHeight = Math.max(8, Math.min(72, bayHeight - (tiny ? 2 : compact ? 16 : 34)));
            // One visible row represents the front of a physical shelf. A 50-cm
            // bay should display roughly 4-5 bottle fronts, never all depth rows.
            const bottleWidth = Math.max(10, Math.round(Math.min(bottleHeight * .6, Math.max(12,Math.min(27,widthPx / 5.6)))));
            const occupancy = shelf.capacity === 0 ? '' : shelf.capacity === null ? `${occupants.length}` : `${occupants.length} / ${shelf.capacity}`;
            const previewSlots = Math.max(0,Math.floor((widthPx - 14) / (bottleWidth + 2)));
            const previewCount = Math.min(5,previewSlots);
            const preview = occupants.slice(0,previewCount);
            const hiddenCount = occupants.length - preview.length;
            return `<div class="warehouse-shelf warehouse-wall-bay${compact ? ' warehouse-wall-bay--compact' : ''}${tiny ? ' warehouse-wall-bay--tiny' : ''}${index === 0 ? ' warehouse-wall-bay--top' : ''}${shelf.capacity === 0 ? ' warehouse-wall-bay--unavailable' : ''}" data-shelf-id="${safe(shelf.id)}" data-capacity="${shelf.capacity ?? 'unlimited'}"${shelf.capacity === 0 ? '' : ` data-act="warehouse-shelf-view" tabindex="0" role="button" aria-label="${safe(`${item.name} / ${shelf.name} — ${t('warehouse.shelves.doubleClickHint')}`)}" title="${safe(`${item.name} / ${shelf.name} · ${frontName}${occupancy ? ` · ${occupancy}` : ''} · ${t('warehouse.shelves.doubleClickHint')}`)}"`} data-front="${safe(front)}" style="--wall-bay-height:${bayHeight}px;--wall-bottle-height:${bottleHeight}px;--wall-bottle-width:${bottleWidth}px">
                <div class="warehouse-wall-bay-title"><strong>${safe(shelf.name)}</strong><span>${safe(frontName)}${occupancy ? ` · ${safe(occupancy)}` : ''}</span></div>
                <div class="warehouse-bottle-silhouettes">${preview.map(bottle => `<span class="warehouse-wall-bottle${selected.has(bottle.id) ? ' is-selected' : ''}">${bottleSymbol(bottle, {selectable:true, selected:selected.has(bottle.id)})}</span>`).join('')}${hiddenCount ? `<span class="warehouse-shelf-overflow" aria-label="${safe(t('warehouse.shelves.moreBottles',{count:hiddenCount}))}">+${hiddenCount}</span>` : ''}${!occupants.length ? (shelf.capacity === 0 ? `<span class="warehouse-wall-no-space">${t('warehouse.wall.noSpace')}</span>` : `<span class="hint">${t('warehouse.shelves.empty')}</span>`) : ''}</div>
            </div>`;
        }).join('');
        return `<section class="warehouse-wall-furniture${stacked ? ' warehouse-wall-furniture--stacked' : ''}" data-furniture-id="${safe(item.id)}" style="--wall-furniture-width:${widthPx}px;--wall-furniture-height:${heightPx}px;--wall-elevation:${elevationPx}px;--wall-offset-x:${px(offset)}px">
            <div class="warehouse-wall-furniture-body">${clearance}${bays}</div>
            ${editFurniture}
        </section>`;
    };
    let previousOrientation = null;
    const cards = groups.map(group => {
        const changeWall = previousOrientation !== null && previousOrientation !== group.orientation;
        previousOrientation = group.orientation;
        const furnitureHtml = group.items.map(entry => renderFurniture(entry, group.items.length > 1)).join('');
        return `<div class="warehouse-wall-stack${group.items.length > 1 ? ' warehouse-wall-stack--layered' : ''}${changeWall ? ' warehouse-wall-stack--new-direction' : ''}" data-facing="${group.orientation}" style="--wall-stack-width:${px(group.width)}px;--wall-stack-height:${px(group.height)}px">${furnitureHtml}</div>`;
    }).join('');
    return `<section class="warehouse-room-wall" aria-label="${safe(t('warehouse.wall.aria',{room:room.name}))}">
        <div class="warehouse-wall-controls">
            <div class="warehouse-bottle-bulk-tools" aria-label="${safe(t('warehouse.bottles.bulkTools'))}">
                <span class="warehouse-bottle-selection-count" aria-live="polite">${safe(t('warehouse.bottles.bulkSelected',{count:selected.size}))}</span>
                <button type="button" class="warehouse-unassigned-toggle" aria-controls="warehouse-wall-unassigned-content" aria-expanded="${unassignedOptions.expanded ? 'true' : 'false'}" title="${safe(t('warehouse.wall.unassignedToggleHint'))}">
                    <span class="warehouse-unassigned-toggle-chevron" aria-hidden="true"></span>${t('warehouse.wall.unassignedTitle',{count:unassignedWallPage(warehouse).total})}
                </button>
                <button type="button" class="btn small warehouse-bottles-select-clear" data-act="warehouse-bottles-select-clear" ${selected.size ? '' : 'disabled'}>${t('warehouse.selection.clear')}</button>
                <button type="button" class="btn small warehouse-bottles-preview-selected" data-act="warehouse-bottles-preview-selected" ${selected.size === 1 ? '' : 'disabled'}>${t('warehouse.bottles.detailsTitle')}</button>
                <button type="button" class="btn small primary warehouse-bottles-assign-selected" data-act="warehouse-bottles-assign-selected" ${selected.size ? '' : 'disabled'}>${t('warehouse.bottles.bulkAssignAction')}</button>
            </div>
            ${renderUnassignedTray(warehouse, selectedBottleIds, {...unassignedOptions, embedded:true})}
        </div>
        ${groups.length ? `<div class="warehouse-wall-scroll" data-room-id="${safe(room.id)}" tabindex="0" role="region" aria-label="${safe(t('warehouse.wall.scrollAria'))}">
            <div class="warehouse-wall-surface"><div class="warehouse-wall-furniture-list">${cards}</div></div>
        </div>` : `<div class="warehouse-room-wall-empty"><p class="hint">${t('warehouse.wall.noFurniture')}</p></div>`}
    </section>`;
}
