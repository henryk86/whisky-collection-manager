import {insuranceInventory, evidenceKeys} from '../domain/insurance.js';
import {t} from '../i18n/index.js';
import {composeMarkup} from '../ui/render-plan.js';
import {actionButton} from '../ui/buttons.js';
import {actionToolbar} from '../ui/content.js';
import {loadTemplates} from '../ui/templates.js';
import {metric, metricGrid, panel, detailsTable, bottlingLink, money, number} from './analytics-components.js';

const renderTemplate = await loadTemplates('analytics/insurance.html');

/**
 * Renders the insurance checklist and export controls independently of the analytics filters.
 * @param {!Object} state Current collection, warehouse and insurance view settings.
 * @return {import('../ui/render-plan.js').RenderPlan|string} Insurance analysis panel.
 */
export function insuranceSection(state) {
  const data = insuranceInventory(state.collection, state.warehouse, state.insuranceIncludeSamples);
  const count = data.rows.length;
  const missing = state.insuranceMissing || 'all';
  const outstanding = data.rows.filter(row => missing === 'all' ? !row.complete : !row.checks[missing]);
  const coverage = count ? `${number(data.complete / count * 100)} %` : '–';
  return composeMarkup(
    renderTemplate('scope', {button: actionButton({label: t(state.insuranceIncludeSamples ? 'insurance.excludeSamples' : 'insurance.includeSamples'), action: 'insurance-samples', attributes: {'aria-pressed': String(Boolean(state.insuranceIncludeSamples))}})}),
    metricGrid([
      metric(t('insurance.stock'), number(count), `${t('home.status.closed')}: ${data.closed} · ${t('analytics.inventory.openedStatus')}: ${data.open}`),
      metric(t('insurance.value'), data.totals.map(([currency, value]) => money(value, currency)).join(' / ') || '–'),
      metric(t('insurance.complete'), coverage, `${data.complete} / ${count}`),
      metric(t('insurance.outstanding'), number(count - data.complete)),
    ]),
    panel(t('insurance.checklist'), renderTemplate('checks', {
      rows: composeMarkup(data.counts.map(({key, count: present}) => renderTemplate('check', {
        label: present === count ? renderTemplate('checkLabel', {label: t(evidenceKeys[key])}) : renderTemplate('checkAction', {label: t(evidenceKeys[key]), key, description: t('insurance.filterMissing', {label: t(evidenceKeys[key]), count: count - present}), pressed: String(missing === key)}),
        count: `${present} / ${count}`, percent: count ? present / count * 100 : 0,
      }))),
    }), t('insurance.evidenceNote')),
    panel(missing === 'all' ? t('insurance.outstanding') : `${t('insurance.outstanding')} – ${t(evidenceKeys[missing])}`, composeMarkup(
      actionToolbar(actionButton({label: t('insurance.showAllMissing'), action: 'insurance-missing', data: {key: 'all'}, size: 'small', attributes: {'aria-pressed': String(missing === 'all')}}), {className: 'analytics-insurance-filter-actions'}),
      detailsTable([t('insurance.number'), t('analytics.table.bottle'), t('insurance.outstanding')], outstanding.map(row => [row.bottle.inventoryNumber || '–', bottlingLink({id: row.bottlingId, bottleId: row.bottle.id, name: row.name}), Object.keys(evidenceKeys).filter(key => !row.checks[key]).map(key => t(evidenceKeys[key])).join(', ')]))
    )),
    panel(t('insurance.export'), actionToolbar(composeMarkup([
      actionButton({label: t('insurance.summaryPdf'), action: 'insurance-export', data: {format: 'summary'}, variant: 'primary', disabled: !count}),
      actionButton({label: t('insurance.detailPdf'), action: 'insurance-export', data: {format: 'detail'}, disabled: !count}),
      actionButton({label: t('insurance.packageZip'), action: 'insurance-export', data: {format: 'zip'}, disabled: !count}),
    ]), {className: 'analytics-insurance-export-actions'}), t('insurance.exportNote'))
  );
}
