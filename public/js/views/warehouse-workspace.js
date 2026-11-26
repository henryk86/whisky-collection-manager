import {t} from '../i18n/index.js';
import {composeMarkup} from '../ui/render-plan.js';
import {headerActions, headingTitle, pageHeader} from '../ui/headers.js';
import {sectionWorkspace} from '../ui/section-navigation.js';
import {WAREHOUSE_CAMERAS} from '../domain/warehouse-3d-model.js';
import {addActionLabel} from '../ui/action-icons.js';
import {renderWarehouseRoomWall} from './warehouse-room-wall.js';
import {renderWarehouseFinder} from './warehouse-finder.js';
import {renderWarehouseSelectionPanel} from './warehouse-selection-panel.js';
import {CAMERA_KEYS, ROOM_SECTION_KEYS, typeName, num, capacityLabel, bottleLabel, roomDiagram} from './warehouse-presentation.js';
import {loadTemplates} from '../ui/templates.js';
const renderTemplate = await loadTemplates('warehouse/warehouse.html');

/**
 * Renders the warehouse workspace using prepared room, selection and finder data.
 * @param {!Object} model Current warehouse workspace model.
 * @return {!import('../ui/render-plan.js').RenderPlan} Warehouse page.
 */
export function renderWarehouseWorkspace(model) {
  const {data, summary, roomModel, room, furniture, section, selection, selectedBottleIds, tray, focus, withoutShelves, finder} = model;
  const {total, assigned, overallCapacity, roomCount, furnitureCount} = summary;
  /** @type {import('../ui/render-plan.js').RenderPlan|string} */
  let content = '';
  if (section === 'overview') {
    content =
      renderTemplate('stats', {
        length: roomCount,
        reduce: furnitureCount,
        assigned: assigned,
        total: total,
        unlimited: overallCapacity.unlimited ? ` ${t('warehouse.capacity.unlimitedExtra', {count: overallCapacity.unlimited})}` : '',
        shelves: overallCapacity.shelves === 0 ? '–' :
          overallCapacity.unlimited && overallCapacity.defined === 0 ?
            t('warehouse.capacity.open') :
            `${overallCapacity.defined}${overallCapacity.unlimited ? '+' : ''}`,
        headingTitle: headingTitle({title: t('warehouse.rooms.yourRooms'), }),
        rooms: composeMarkup(roomModel.rooms.map(({room, capacity: cap}) => {
          return renderTemplate('warehouseSelectRoom', {
            id: String(room.id ?? ''),
            previewRoomId: String(room.id ?? ''),
            name: String(room.name ?? ''),
            furnitureAndDimensions: t(
              "warehouse.rooms.furnitureAndDimensions",
              {
                count: room.furniture.length,
                width: num(room.width),
                depth: num(room.height),
              }
            ),
            summary: t("warehouse.capacity.summary", {capacity: capacityLabel(cap)}),
            count: t("warehouse.occupancy.count", {count: cap.occupied}),
          });
        })) ||
          renderTemplate('hint3'),
        addActionLabel: addActionLabel(t("warehouse.rooms.createWithPlus")),
        unassignedCount: t("warehouse.bottles.unassignedCount", {count: total - assigned}),
      });
  } else if (section === 'rooms' || section === 'shelves') {
    const roomManagementActions = section === 'rooms'
      ? renderTemplate('warehouseRoomNew', {
        addActionLabel: addActionLabel(t("warehouse.rooms.addWithPlus")),
        warehouseRoomEdit: room ? renderTemplate('warehouseRoomEdit', {
          id: String(room.id ?? ''),
          deleteRoomId: String(room.id ?? ''),
        }) : '',
      })
      : '';
    content = renderTemplate('warehouseRoomToolbar', {
      rooms: composeMarkup(data.rooms.map(r => renderTemplate('renderOption', {
        value: String(r.id ?? ''),
        selectedAttributes: r.id === room?.id ? {"selected": true} : {},
        name: String(r.name ?? ''),
      }))),
      roomManagementActions: roomManagementActions,
    });
    if (room) {
      const cap = roomModel.rooms.find(item => item.room.id === room.id).capacity;
      const roomSummary =
        renderTemplate('warehouseRoomSummary', {
          name: String(room.name ?? ''),
          gridDimensions: t("warehouse.rooms.gridDimensions", {width: num(room.width), height: num(room.height)}),
          capacityLabel: capacityLabel(cap),
          occupied: cap.occupied,
          bottleUnit: cap.occupied === 1 ? t("forms.bottle.title") : t("forms.bottle.plural"),
        });
      const {level, planMode, planCorner, zoom} = roomModel;
      const viewSwitch =
        renderTemplate('warehouseViewSwitch', {
          planMode: planMode === '2d' ? ' primary' : '',
          ariaPressed: planMode === '2d',
          threeDimensionalClass: planMode === '3d' ? ' primary' : '',
          threeDimensionalPressed: planMode === '3d',
        });
      const planFilter = planMode === '2d' ?
        renderTemplate('warehousePlanFilter', {
          allAttributes: level === 'all' ? {"selected": true} : {},
          floorAttributes: level === 'floor' ? {"selected": true} : {},
          elevatedAttributes: level === 'elevated' ? {"selected": true} : {},
        }) : renderTemplate('warehousePlanFilter2', {
          content: composeMarkup([100, 150, 200].map(z => renderTemplate(
            'planFilterOption',
            {
              z: z,
              selectedAttributes: z === zoom ? {"selected": true} : {},
              zoomLabel: z,
            }
          ))),
        });
      const cornerButtons = planMode === '3d' ?
        renderTemplate('warehouseCameraToolbar', {
          cameraButtons: composeMarkup(WAREHOUSE_CAMERAS.map(([id,
            label]) => renderTemplate('smallButton', {
              planCorner: planCorner === id ? ' primary' : '',
              id: id,
              ariaPressed: planCorner === id,
              t: t(CAMERA_KEYS[id]),
            }))),
        }) : '';
      const planToolbar =
        renderTemplate('warehousePlanTools', {
          viewSwitch: viewSwitch,
          cornerButtons: cornerButtons,
          planFilter: planFilter,
          warehouseFurnitureNew: section === 'rooms' ?
            renderTemplate('warehouseFurnitureNew', {addActionLabel: addActionLabel(t('warehouse.furniture.place')), }) : '',
        });
      const plan = planMode === '3d' ?
        renderTemplate('warehouseThreeViewport') : roomDiagram(room, {...data, focusFurnitureId: furniture?.id}, level);
      if (section === 'rooms') {
        // Room plans own spatial layout only: 2D/3D positioning,
        // camera and visibility. All furniture/shelf editing and
        // physical bottle work lives in Regale & Fächer.
        content = composeMarkup(content,
          roomSummary,
          planToolbar,
          (planMode === '3d'
            ? renderTemplate('warehousePlanWorkspace', {
              plan: plan,
              selectionPanel: renderWarehouseSelectionPanel(selection, {isolate: true, compact: true, layoutOnly: true}),
            })
            : composeMarkup(plan, renderWarehouseSelectionPanel(selection, {layoutOnly: true}))),
          renderTemplate(
            'warehouseSectionBoundary',
            {
              furniture: furniture ? ' warehouse-plan-focus' : '',
              warehousePlanFocusInfo: furniture
                ? renderTemplate('warehousePlanFocusInfo', {
                  name: String(furniture.name ?? ''),
                  furnitureType: String(typeName(furniture.type) ?? ''),
                  num: num(furniture.x),
                  positionY: num(furniture.y),
                  bottomElevation: num(furniture.elevation ?? 0),
                })
                : '',
              warehouseFurnitureManage: furniture ? renderTemplate('warehouseFurnitureManage', {id: String(furniture.id ?? ''), }) : '',
            }
          )
        );
      } else {
        const createButton =
          renderTemplate('warehouseFurnitureNew2', {
            id: String(room.id ?? ''),
            addActionLabel: addActionLabel(t('warehouse.furniture.place')),
          });
        const manageButton = renderTemplate('warehouseFurnitureBulk');
        const {focusBottle, focusPlace, inRoom, canReturn, returnLabelKey} = focus;
        const findReturn = canReturn
          ? renderTemplate('warehouseReturnFind', {
            t: t(returnLabelKey),
            warehouseFindReturnLabel: inRoom ?
              renderTemplate('warehouseFindReturnLabel', {
                highlighted: t('warehouse.find.highlighted', {name: bottleLabel(focusBottle), location: focusPlace.label}),
              }) :
              '',
            title: t('warehouse.find.clearHighlight'),
            ariaLabel: t('warehouse.find.clearHighlight'),
          }) : '';
        // The physical wall intentionally omits furniture without shelves.
        // Provide
        // a direct first-shelf action so a newly placed unit is not stranded.
        const firstShelfActions = withoutShelves.length
          ? renderTemplate('warehouseUnconfiguredFurniture', {
            withoutShelves: composeMarkup(withoutShelves.map(item =>
              renderTemplate(
                'warehouseUnconfiguredItem',
                {
                  name: String(item.name ?? ''),
                  id: String(item.id ?? ''),
                  addActionLabel: addActionLabel(t('warehouse.shelves.addWithPlus')),
                }
              ))),
          })
          : '';
        content = composeMarkup(content,
          roomSummary,
          findReturn,
          renderTemplate(
            'warehouseShelvesToolbar',
            {
              headingTitle: headingTitle({title: t('warehouse.navigation.shelves'), }),
              headerActions: headerActions(composeMarkup(manageButton, createButton)),
            }
          ),
          firstShelfActions,
          renderWarehouseRoomWall(
            room,
            data,
            selectedBottleIds,
            {
              ...tray,
              focusBottleId: inRoom ? focusBottle.id : null,
            }
          )
        );
      }
    } else content = composeMarkup(content, renderTemplate('hint4'));
  } else {
    content = renderWarehouseFinder({
      ...finder,
    });
  }
  const warehouseTabs = ['overview', 'rooms', 'shelves', 'find'].map(id => [id, t(ROOM_SECTION_KEYS[id])]);
  const workspace = sectionWorkspace(
    {
      sections: warehouseTabs.map(([id, label]) => ({id, label})),
      activeId: section,
      action: 'warehouse-section',
      itemAttribute: 'data-section',
      label: t('warehouse.rooms.storageAreas'),
      switchKind: 'warehouse',
      desktopClass: 'warehouse-tabs',
    },
    composeMarkup(headingTitle({
      title: t(ROOM_SECTION_KEYS[section] || ROOM_SECTION_KEYS.overview),
      level: 2,
      className: 'analytics-section-title',
    }), content)
  );
  return renderTemplate('analyticsPage', {
    pageHeader: pageHeader({
      title: t('warehouse.page.title'),
      eyebrow: t('warehouse.page.eyebrow'),
      intro: t('warehouse.page.intro'),
      className: 'warehouse-heading',
    }),
    workspace: workspace,
  });
}
