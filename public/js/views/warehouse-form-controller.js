import {composeMarkup} from '../ui/render-plan.js';
import {appendContent} from '../ui/dom-renderer.js';
import {t} from '../i18n/index.js';
import {toast} from '../ui/notifications.js';
import {addActionLabel, arrowLeftIcon, arrowRightIcon} from '../ui/action-icons.js';
import {renderWarehouseAssignment, mountWarehouseAssignment} from '../ui/warehouse-assignment.js';
import {FRONT_KEYS, typeChoices, typeName, count, field, choices, footer, findFurniture} from './warehouse-presentation.js';
import {loadTemplates} from '../ui/templates.js';

const renderTemplate = await loadTemplates('warehouse/warehouse.html');

/**
 * Owns warehouse form creation and dialog-specific controls.
 * @param {!Object} options Dialog and current warehouse selection accessors.
 * @return {Function} Function opening a warehouse editor.
 */
export function createWarehouseFormController({w, currentRoom, selectedFurniture, selectedBottleIds, modal}) {
  /**
   * Prepares door compartment-range controls.
   *
   * @param {!Object=} range Value used by this operation.
   * @param {number=} count Number of requested or available entries.
   * @return {!import('../ui/render-plan.js').RenderPlan} Door compartment-range controls.
   */
  function doorRangeRow(range = {}, count = 0) {
    /**
     * Prepares numbered compartment choices with the chosen value selected.
     *
     * @param {*} chosen Value used by this operation.
     * @return {import('../ui/render-plan.js').RenderPlan|string} Numbered compartment choices with the chosen value selected (or scalar/empty text when no plan is needed).
     */
    const opts = (chosen) => composeMarkup(Array.from(
      {length: count},
      (_, i) => renderTemplate('optsOption', {
        i: i + 1,
        selectedAttributes: chosen === i + 1 ? {"selected": true} : {},
        numbered: t("warehouse.shelves.numbered", {index: i + 1, }),
      })
    ));
    return renderTemplate('warehouseDoorRange', {
      opts: opts(range.from || 1),
      endShelfOptions: opts(range.to || count),
      glassAttributes: range.front !== 'glass' ? {"selected": true} : {},
      glassSelected: range.front === 'glass' ? {"selected": true} : {},
      selectedAttributes: range.doorLeaves == null ? {"selected": true} : {},
      singleLeafSelected: range.doorLeaves === 1 ? {"selected": true} : {},
      doubleLeafSelected: range.doorLeaves === 2 ? {"selected": true} : {},
      defaultFrameSelected: range.glassFrame == null ? {"selected": true} : {},
      withFrameSelected: range.glassFrame === true ? {"selected": true} : {},
      withoutFrameSelected: range.glassFrame === false ? {"selected": true} : {},
    });
  }

  /**
   * Controls form for warehouse.
   *
   * @param {string} kind Resource kind selecting the relevant schema.
   * @param {string} id Identifier used to select the relevant record.
   * @param {!Object=} options3 Destructured options for this operation.
   * @return {void} Structured result assembled from the input data.
   */
  function openForm(kind, id, {replaceCurrent = false} = {}) {
    const data = w();
    let endpoint = '', method = 'POST', title = '', fields = '', shelfNavigation = '';
    if (kind === 'room') {
      const item = data.rooms.find(r => r.id === id);
      title = item ? t("warehouse.rooms.edit") : t("warehouse.rooms.create");
      endpoint = item ? `/api/warehouse/rooms/${item.id}` : '/api/warehouse/rooms'; method = item ? 'PATCH' : 'POST';
      fields = composeMarkup(
        field('name', t("warehouse.rooms.roomName"), item?.name || ''),
        field('width', t("warehouse.fields.widthMeters"), item?.width ?? 4, 'number', {step: '0.01', min: '1', max: '100'}),
        field('height', t("warehouse.fields.depthMeters"), item?.height ?? 4, 'number', {step: '0.01', min: '1', max: '100'})
      );
    } else if (kind === 'furniture') {
      const found = findFurniture(data, id);
      const room = found?.room || currentRoom();
      if (!room) return toast(t("warehouse.empty.createRoomFirst"), true);
      const item = found?.furniture;
      title = item ? t("warehouse.furniture.edit") : t("warehouse.furniture.add");
      endpoint = item ? `/api/warehouse/furniture/${item.id}` : `/api/warehouse/rooms/${room.id}/furniture`; method = item ? 'PATCH' : 'POST';
      fields = composeMarkup(field('name', t("warehouse.fields.name"), item?.name || t("warehouse.furniture.defaultShelfName")), choices('type', t("warehouse.fields.furnitureType"), typeChoices(), item?.type || 'regal'), field('x', t("warehouse.fields.positionXMeters"), item?.x ?? 0, 'number', {step: '0.01', min: '0'}), field('y', t("warehouse.fields.positionYMeters"), item?.y ?? 0, 'number', {step: '0.01', min: '0'}), field('width', t("warehouse.fields.widthMetersShort"), item?.width ?? 1, 'number', {min: '0.2', step: '0.01'}), field('depth', t("warehouse.fields.depthMetersShort"), item?.depth ?? 0.5, 'number', {min: '0.2', step: '0.01'}), choices(
        'rotation',
        t("warehouse.fields.rotation"),
        [[0, '0°'], [90, '90°'], [180, '180°'], [270, '270°']],
        item?.rotation ?? 0
      ), field(
        'elevation',
        t("warehouse.fields.bottomElevationMeters"),
        item?.elevation ?? 0,
        'number',
        {step: '0.01', min: '0', max: '10'}
      ), field(
        'itemHeight',
        t("warehouse.fields.furnitureHeightMeters"),
        item?.itemHeight ?? (item?.type === 'haengeregal' ? 0.4 : 1.8),
        'number',
        {step: '0.01', min: '0.1', max: '5'}
      ), choices(
        'doorLeaves',
        t("warehouse.walls.doorLeavesDefault"),
        [
          ['', t('warehouse.shelves.defaultWoodDoors')],
          ['1', t('warehouse.doors.singleLeaf')],
          ['2', t('warehouse.doors.doubleLeaf')],
        ],
        String(item?.doorLeaves ?? '')
      ), choices(
        'glassFrame',
        t("warehouse.walls.glassDoorFrameDefault"),
        [
          ['', t('warehouse.walls.withoutFrameDefault')],
          ['true', t('warehouse.walls.withFrame')],
          ['false', t('warehouse.walls.withoutFrame')],
        ],
        String(item?.glassFrame ?? '')
      ), (item?.shelves.length ?
        renderTemplate('warehouseDoorRanges', {
          doorRanges: composeMarkup((item.doorRanges || []).map(range => doorRangeRow(range, item.shelves.length))),
          addActionLabel: addActionLabel(t("warehouse.shelves.addDoorRange")),
        }) : ''), renderTemplate('warehouseWallOptions', {
          content: composeMarkup([
            ['leftSidePanel', t('warehouse.walls.leftPanel'), 'left'],
            ['rightSidePanel', t('warehouse.walls.rightPanel'), 'right'],
            ['backPanel', t('warehouse.walls.backPanel'), 'back'],
          ].map(([key, label, side]) =>
            renderTemplate('warehouseWallToggle', {
              key: key,
              checkedAttributes: item?.[key] === true ? {"checked": true} : {},
              side: side,
              label: label,
            }))),
        }), renderTemplate('hint5'));
    } else if (kind === 'furniture-bulk') {
      const room = currentRoom();
      const ids = selectedFurniture(room);
      if (!ids.length) return toast(t("warehouse.validation.selectFurnitureFirst"), true);
      title = t("warehouse.bulk.editTitle", {count: ids.length});
      endpoint = '/api/warehouse/furniture/bulk'; method = 'PATCH';
      /**
       * Prepares bulk-edit field wrapper.
       *
       * @param {*} control Value used by this operation.
       * @return {!import('../ui/render-plan.js').RenderPlan} Bulk-edit field wrapper.
       */
      const bulkField = (control) => renderTemplate('warehouseBulkField', {control: control, });

      /**
       * Prepares optional numeric bulk-edit input with the supplied constraints.
       *
       * @param {*} key Key used to select or group values.
       * @param {*} label Label shown to the user.
       * @param {*} constraints Value used by this operation.
       * @return {!import('../ui/render-plan.js').RenderPlan} Optional numeric bulk-edit input with the supplied constraints.
       */
      const optionalNumber = (key, label, constraints) =>
        renderTemplate('formField', {
          label: String(label ?? ''),
          key: key,
          constraints: constraints,
        });
      fields = composeMarkup(
        renderTemplate('hint6', {
          bulkDescription: t(
            "warehouse.selection.bulkDescription",
            {
              names: ids.map(id => room.furniture.find(f => f.id === id)?.name).map(name => String(name ?? '')).join(', '),
            }
          ),
        }),
        bulkField(renderTemplate('formField2', {
          content: composeMarkup([[0, '0°'], [90, '90°'],
          [180, '180°'], [270, '270°']].map(([value,
            label]) => renderTemplate('openFormOption', {
              value: value,
              label: label,
            }))),
        })),
        bulkField(optionalNumber('elevation', t('warehouse.fields.bottomElevationShort'), {step: '0.01', min: '0', max: '10'})),
        bulkField(optionalNumber('itemHeight', t('warehouse.fields.heightShort'), {step: '0.01', min: '0.1', max: '5'})),
        bulkField(optionalNumber('width', t('warehouse.fields.widthShort'), {step: '0.01', min: '0.2', max: '20'})),
        bulkField(optionalNumber('depth', t('warehouse.fields.depthShort'), {step: '0.01', min: '0.2', max: '20'})),
        bulkField(choices(
          'doorLeaves',
          t("warehouse.walls.doorLeavesFurnitureDefault"),
          [
            ['', t('warehouse.fields.unchanged')],
            ['1', t('warehouse.doors.singleLeaf')],
            ['2', t('warehouse.doors.doubleLeaf')],
            ['default', t('warehouse.walls.automatic')],
          ]
        )),
        bulkField(choices(
          'glassFrame',
          t("warehouse.walls.glassDoorFrameFurnitureDefault"),
          [
            ['', t('warehouse.fields.unchanged')],
            ['true', t('warehouse.walls.withFrame')],
            ['false', t('warehouse.walls.withoutFrame')],
            ['default', t('warehouse.walls.automatic')],
          ]
        )),
        composeMarkup(['leftSidePanel', 'rightSidePanel', 'backPanel'].map((key, i) =>
          bulkField(choices(
            key,
            [
              t('warehouse.walls.leftPanel'),
              t('warehouse.walls.rightPanel'),
              t('warehouse.walls.backPanel'),
            ][i],
            [
              ['', t('warehouse.fields.unchanged')],
              ['true', t('warehouse.walls.present')],
              ['false', t('warehouse.walls.absent')],
            ]
          )))),
        renderTemplate('hint7')
      );
    } else if (kind === 'shelf') {
      let found = null;
      for (const room of data.rooms) for (const furniture of room.furniture)
        for (const shelf of furniture.shelves) if (shelf.id === id) found = {shelf, furniture};
      const item = found?.shelf;
      const furnitureId = found?.furniture?.id || id;
      if (item) {
        const order = found.furniture.shelves.slice().reverse();
        const index = order.findIndex(shelf => shelf.id === id);
        shelfNavigation =
          renderTemplate('warehouseShelfEditorNavigation', {
            target: String((order[index - 1]?.id || '') ?? ''),
            disabledAttributes: index === 0 ? {"disabled": true} : {},
            arrowLeftIcon: arrowLeftIcon,
            position: t('warehouse.shelves.position', {current: index + 1, total: order.length}),
            nextShelfId: String((order[index + 1]?.id || '') ?? ''),
            nextDisabled: index === order.length - 1 ? {"disabled": true} : {},
            arrowRightIcon: arrowRightIcon,
          });
      }
      title = item ? t("warehouse.shelves.edit") : t("warehouse.shelves.add");
      endpoint = item ? `/api/warehouse/shelves/${item.id}` : `/api/warehouse/furniture/${furnitureId}/shelves`; method = item ? 'PATCH' : 'POST';
      fields = composeMarkup(field(
        'name',
        t("warehouse.shelves.name"),
        item?.name || t(
          'warehouse.shelves.numbered',
          {
            index: (findFurniture(data, furnitureId)?.furniture.shelves.length || 0) + 1,
          }
        )
      ), renderTemplate('formField3', {value: String((item?.capacity ?? '') ?? ''), }), choices(
        'front',
        t("warehouse.shelves.frontType"),
        [
          ['', t('warehouse.shelves.defaultFront')],
          ...['open', 'door', 'glass', 'drawer'].map(id => [id, t(FRONT_KEYS[id])]),
        ],
        item?.front ?? ''
      ), choices(
        'doorLeaves',
        t("warehouse.walls.doorLeaves"),
        [
          ['', t('warehouse.fields.furnitureDefaultAutomatic')],
          ['1', t('warehouse.doors.singleLeaf')],
          ['2', t('warehouse.doors.doubleLeaf')],
        ],
        String(item?.doorLeaves ?? '')
      ), choices(
        'glassFrame',
        t("warehouse.walls.glassDoorFrame"),
        [
          ['', t('warehouse.fields.furnitureDefaultWithoutFrame')],
          ['false', t('warehouse.walls.withoutFrame')],
          ['true', t('warehouse.walls.withFrame')],
        ],
        String(item?.glassFrame ?? '')
      ), renderTemplate('formField4', {value: String((item?.heightCm ?? '') ?? ''), }), renderTemplate('hint8'));
    } else if (kind === 'furniture-copy') {
      const found = findFurniture(data, id);
      if (!found) return toast(t("warehouse.furniture.notFound"), true);
      title = t('warehouse.furniture.copyTitle', {type: typeName(found.furniture.type)});
      endpoint = `/api/warehouse/furniture/${String(id ?? '')}/copy`;
      fields = composeMarkup(field(
        'name',
        t("warehouse.furniture.copyName"),
        t("warehouse.furniture.copyNameSuffix", {name: found.furniture.name})
      ), choices('roomId', t("warehouse.bottles.destinationRoom"), data.rooms.map(r => [r.id, r.name]), found.room.id), renderTemplate('warehouseCopyOption'), renderTemplate('hint9'));
    } else if (kind === 'shelf-copy') {
      let found = null;
      for (const room of data.rooms) for (const furniture of room.furniture)
        for (const shelf of furniture.shelves) {
          if (shelf.id === id) found = {shelf, furniture};
        }
      if (!found) return toast(t("warehouse.shelves.notFound"), true);
      title = t('warehouse.shelves.copyTitle');
      endpoint = `/api/warehouse/shelves/${String(id ?? '')}/copy`;
      fields = composeMarkup(field(
        'name',
        t("warehouse.furniture.copyName"),
        t("warehouse.furniture.copyNameSuffix", {name: found.shelf.name})
      ), choices(
        'furnitureId',
        t("warehouse.bottles.destinationFurniture"),
        data.rooms.flatMap(r => r.furniture.map(f => [f.id, `${r.name} / ${f.name}`])),
        found.furniture.id
      ), renderTemplate('hint10'));
    } else if (kind === 'assign-bulk') {
      const bottles = data.bottles.filter(b => selectedBottleIds().includes(b.id));
      if (!bottles.length) return toast(t('warehouse.bottles.bulkNothingSelected'), true);
      title = t('detail.fields.storageLocation');
      endpoint = '/api/warehouse/bottles/bulk'; method = 'POST';
      fields = renderWarehouseAssignment(data, bottles);
    } else if (kind === 'assign') {
      const bottle = data.bottles.find(b => b.id === id);
      if (!bottle) return toast(t("features.errors.bottleNotFound"), true);
      title = t('detail.fields.storageLocation'); endpoint = `/api/warehouse/bottles/${id}`; method = 'PUT';
      fields = renderWarehouseAssignment(data, bottle);
    }
    modal.showModal(
      title,
      renderTemplate('warehouseForm', {
        endpoint: String(endpoint ?? ''),
        method: method,
        kind: kind === 'furniture' && !id ? 'true' : 'false',
        bulk: kind === 'furniture-bulk',
        bottleBulk: kind === 'assign-bulk',
        includes: ['assign', 'assign-bulk'].includes(kind) ? ' warehouse-assignment-form' : '',
        shelfNavigation: shelfNavigation,
        fields: fields,
        footer: footer(),
      }),
      kind === 'assign',
      replaceCurrent ? 'replace' : true,
      '',
      ['assign', 'assign-bulk'].includes(kind) ? 'assignment' : ''
    );
    const formElement = document.querySelector('#warehouse-form');
    if (formElement?.tagName === 'FORM') formElement.dataset.initialValues = JSON.stringify([...new FormData(formElement).entries()]);
    if (kind === 'assign' || kind === 'assign-bulk') mountWarehouseAssignment(
      document.querySelector('#warehouse-form'),
      data,
      kind === 'assign-bulk' ? selectedBottleIds() : id
    );
    const editor = document.querySelector('.warehouse-door-ranges');
    if (editor) editor.addEventListener('click', event => {
      if (event.target.closest('.warehouse-door-range-remove')) event.target.closest('.warehouse-door-range')?.remove();
      if (event.target.closest('.warehouse-door-range-add')) {
        const list = editor.querySelector('.warehouse-door-range-list');
        const shelfCount = findFurniture(w(), id)?.furniture.shelves.length || 0;
        appendContent(list, doorRangeRow({}, shelfCount));
      }
    });
  }

  return openForm;
}
