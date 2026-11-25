import {t} from '../i18n/index.js';
import {composeMarkup} from '../ui/render-plan.js';
import {eyeIcon, eyeOffIcon} from '../ui/action-icons.js';
import {safe, typeName} from './warehouse-presentation.js';
import {loadTemplates} from '../ui/templates.js';
const renderTemplate = await loadTemplates('warehouse/warehouse.html');

/**
 * Aggregates input values for the selection panel calculation.
 *
 * @param {!Object} model Prepared furniture selection data.
 * @param {!Object=} options Options controlling the operation.
 * @return {!import('../ui/render-plan.js').RenderPlan} Furniture selection panel.
 */
export function renderWarehouseSelectionPanel(model, {isolate = false, compact = false, layoutOnly = false} = {}) {
  const {items, selectedCount, hasHidden} = model;
  if (!items.length) return renderTemplate('hint');
  return renderTemplate('warehouseBulkPanel', {
    compact: compact ? ' warehouse-bulk-panel--sidebar' : '',
    layoutOnly: layoutOnly ? t("warehouse.furniture.plural") : t("warehouse.selection.instructions"),
    span: layoutOnly ?
      renderTemplate('selectionPanelSpan', {length: items.length, }) :
      renderTemplate('warehouseBulkCount', {
        count: t("warehouse.selection.count", {selected: selectedCount, total: items.length}),
      }),
    warehouseShowAll: isolate ?
      renderTemplate('warehouseShowAll', {
        disabledAttributes: hasHidden ? {} : {"disabled": true},
      }) :
      '',
    furniture: composeMarkup(items.map(({furniture, occupied, visible, selected, current}) => {
      const actionLabel = t(
        "warehouse.visibility.accessibleLabel",
        {
          name: furniture.name,
          action: t(visible ? "warehouse.visibility.hide" : "warehouse.visibility.show"),
        }
      );
      const name = safe(furniture.name);
      const summary = t(
        "warehouse.furniture.summary",
        {
          type: safe(typeName(furniture.type)),
          shelves: furniture.shelves.length,
          bottles: occupied,
        }
      );
      const furnitureControl = layoutOnly
        ? renderTemplate('warehouseSelectFurniture', {
          id: safe(furniture.id),
          name: name,
          ariaCurrentAttributes: current ? {"aria-current": "true"} : {},
          furnitureName: name,
          summary: summary,
        })
        : renderTemplate('warehouseToggleFurniture', {
          id: safe(furniture.id),
          has: selected,
          ariaLabel: safe(t('warehouse.furniture.selectForBulkEdit', {name: furniture.name})),
          name: name,
          summary: summary,
        });
      return renderTemplate('warehouseBulkItem', {
        content: !layoutOnly && selected ? ' is-selected' : '',
        warehouseFurnitureId: current && layoutOnly ? ' is-current' : '',
        isolate: isolate && !visible ? ' is-hidden' : '',
        furnitureControl: furnitureControl,
        warehouseVisibilityToggle: isolate ?
          renderTemplate('warehouseVisibilityToggle', {
            id: safe(furniture.id),
            visible: visible,
            title: safe(actionLabel),
            ariaLabel: safe(actionLabel),
            visibilityIcon: visible ? eyeIcon : eyeOffIcon,
          }) : '',
      });
    })),
    selectionControls: layoutOnly ? '' :
      renderTemplate('warehouseBulkSelectAll', {
        disabledAttributes: selectedCount ? {} : {"disabled": true},
        clearDisabled: selectedCount ? {} : {"disabled": true},
        deleteAction: t("warehouse.bulk.deleteAction", {count: selectedCount}),
        manageDisabled: selectedCount ? {} : {"disabled": true},
        editAction: t("warehouse.bulk.editAction", {count: selectedCount}),
      }),
  });
}
