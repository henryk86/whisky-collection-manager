import {latestTasting} from '../../../../shared/tasting-records.js';
import {t} from '../../i18n/index.js';
import {bottlingDetails, hasBottlingDetail}
  from '../../domain/bottling-details.js';
import {bottlingOriginLabel} from '../../domain/bottling-origin.js';
import {bottlingDistilleryIds} from '../../domain/bottling-map-focus.js';

/**
 * Prepares detail presentation data without rendering or mutating state.
 * @param {!Object} state Current collection and selected bottling.
 * @param {!Object} selectors Collection selectors.
 * @return {?Object} Prepared presentation data.
 */
export function createDetailViewModel(state, selectors) {
  const {bottles, distilleryNames} = selectors;
  const bottling = state.collection.bottlings.find(entry => entry.id ===
    state.selected);
  if (!bottling) return null;
  const latest = latestTasting(bottling);
  const tastingCount = bottling.tastings?.length || 0;
  const tastingNotes = ['nose', 'palate', 'finish'].map(key => ({
    label: t(`forms.bottling.${key}`),
    text: typeof latest?.tastingNotes?.[key] === 'string' ?
      latest.tastingNotes[key].trim() : '',
  })).filter(note => note.text);
  const physicalBottles = bottles(bottling.id);
  const facts = bottlingDetails(
    bottling,
    distilleryNames,
    state.collection.distilleries
  );
  const originLabel = bottlingOriginLabel(bottling, distilleryNames);
  const relatedDistilleries = bottlingDistilleryIds(bottling);
  const statusText = bottling.completionStatus === 'complete' ?
    t("detail.status.complete") : t("detail.status.incomplete");
  const description = hasBottlingDetail(bottling.description) ?
    bottling.description : null;
  const whiskybaseUrl = hasBottlingDetail(bottling.whiskybaseUrl) ?
    bottling.whiskybaseUrl : null;
  return {
    bottling, latest, tastingCount, tastingNotes, physicalBottles, facts,
    originLabel, relatedDistilleries, statusText, description, whiskybaseUrl,
  };
}
