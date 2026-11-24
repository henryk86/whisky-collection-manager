import {headingTitle, headerActions, sectionHeader, pageHeader, backNavigation} from '../ui/headers.js';
import {panel, detailField, detailGrid, emptyState, divider, actionToolbar, documentList, documentItem} from '../ui/content.js';
import {latestTasting} from '../../../shared/tasting-records.js';
import {displayPhotoPath} from '../../../shared/photo-images.js';
import {t} from '../i18n/index.js';
const bottleStatusText = status => t(({
  closed: 'home.status.closed',
  open: 'analytics.inventory.openedStatus',
  empty: 'home.status.empty',
})[status] || 'features.distilleries.unknownStatus');
const FACT_KEYS = Object.freeze({
  'Whisky-Kategorie': 'forms.bottling.whiskyCategory',
  'Marke': 'forms.bottling.brandOrProductLine',
  'Beteiligte Destillerien': 'forms.bottling.participatingDistilleries',
  'Zusammensetzung vollständig': 'detail.facts.labelCompositionComplete',
  'Alter': 'forms.bottling.ageYears',
  'Alkoholgehalt': 'forms.bottling.abv',
  'Erscheinungsjahr': 'forms.bottling.releaseYear',
  'Nennfüllmenge laut Abfüllung': 'forms.bottling.nominalVolume',
  'Abfüller': 'forms.bottling.bottler',
  'Region': 'detail.facts.labelRegion',
  'Land': 'detail.facts.labelCountry',
  'Fasstyp': 'forms.bottling.caskType',
  'Destilliert am': 'forms.bottling.distillationDate',
  'Abgefüllt am': 'forms.bottling.bottlingDate',
  'Fassnummer': 'forms.bottling.caskNumber',
  'Limitierte Auflage': 'detail.facts.labelLimitedEdition',
  'Whiskybase-ID': 'forms.bottling.whiskybaseId',
});
const factLabel = label => FACT_KEYS[label] ? t(FACT_KEYS[label]) : label;
import {escapeHtml} from '../ui/dom.js';
import {editIcon, deleteIcon, arrowDownIcon, locationIcon, newBottlingIcon, addActionLabel, closeIcon, arrowLeftIcon, arrowRightIcon, gripIcon, sparkleIcon} from '../ui/action-icons.js';
import {glencairnRatingSymbol} from '../ui/glencairn-icon.js';
import {flavorChart} from '../ui/flavor-profile.js';
import {imageUrl, formatValue, formatDate} from '../ui/format.js';
import {bottleStatusLabels, photoAccept} from '../domain/labels.js';

import {uploadPhotos} from '../features/photos.js';
import {uploadFiles, fileAccept, formatFileSize} from '../features/files.js';
import {toast} from '../ui/notifications.js';
import {attachPhotoSorting} from '../features/photo-order.js';
import {bottlingDetails, hasBottlingDetail} from '../domain/bottling-details.js';
import {bottlingOriginLabel} from '../domain/bottling-origin.js';
import {bottlingDistilleryIds} from '../domain/bottling-map-focus.js';
import {storagePath} from './warehouse.js';
export function createDetailView({state, selectors, shell, navigate, action}) {
  const {bottles, coverPhoto, distilleryNames} = selectors;
  function detail() {
    const bottling = state.collection.bottlings.find(entry => entry.id ===
      state.selected);
    if (!bottling) {
      navigate('home', null, {
        replace: true,
      });
      return;
    }
    const latest = latestTasting(bottling);
    const tastingCount = bottling.tastings?.length || 0;
    const tastingRadar = latest?.flavorProfile &&
      Object.values(latest.flavorProfile).some(Number.isInteger)
      ? flavorChart(latest.flavorProfile, {compact: true}) : '';
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
    const list = physicalBottles.map(entry => {
      const entryPhotos = entry.photos || [];
      const firstPhoto = entryPhotos[0];
      const storageShelfId = state.warehouse?.assignments[entry.id];
      const storageName = state.warehouse
        ? (storageShelfId ?
          storagePath(state.warehouse, storageShelfId)?.label ||
          t('detail.fields.unassigned') : t('detail.fields.unassigned'))
        : null;
      const photoGallery =
        `<div class="bottle-photos" data-photo-list="${escapeHtml(entry.id)}">${(entry.photos || []).map(photo => `<div class="photo-tile" data-photo-tile data-photo-id="${escapeHtml(photo.id)}">
    <button type="button" class="photo-open" data-act="open-photo" title="${t("detail.photos.enlarge")}" aria-label="${t("detail.photos.openOverlay")}">
    <img draggable="false" src="${imageUrl(displayPhotoPath(photo))}" alt="${escapeHtml(t(
          "detail.photos.bottleWithNumber",
          {
            kind: photo.source === 'whiskybase' ?
              t("whiskybase.images.reference") :
              t("detail.photos.personalPhoto"),
            number: entry.inventoryNumber || '',
          }
        ))}" loading="lazy">
    </button>
    <button class="photo-edit-trigger" type="button" data-act="photo-editor-open" data-id="${escapeHtml(entry.id)}" data-photo-id="${escapeHtml(photo.id)}" title="${t('photoEditor.title')}" aria-label="${t('photoEditor.title')}">${editIcon}</button>
    ${photo.cutout ? `<span class="photo-cutout-badge" title="${t('cutout.result')}">${sparkleIcon}</span>` : ''}
    <button class="photo-remove" type="button" data-act="delete-photo" data-id="${escapeHtml(entry.id)}" data-photo-id="${escapeHtml(photo.id)}" aria-label="${t("ui.confirmations.deletePhoto")}">${closeIcon}</button>
    ${photo.source === 'whiskybase' ?
            `<span class="photo-source" title="${t('detail.photos.whiskybaseReferenceNotice')}">WB</span>` : ''}
    <div class="photo-controls">
    <button class="photo-move" type="button" data-act="move-photo" data-id="${escapeHtml(entry.id)}" data-photo-id="${escapeHtml(photo.id)}" data-dir="-1" aria-label="${t("detail.photos.moveForward")}">${arrowLeftIcon}</button>
    <button class="photo-drag-handle" type="button" data-photo-drag title="${t("detail.photos.reorderHint")}" aria-label="${t("detail.photos.reorderHint")}">${gripIcon}</button>
    <button class="photo-move" type="button" data-act="move-photo" data-id="${escapeHtml(entry.id)}" data-photo-id="${escapeHtml(photo.id)}" data-dir="1" aria-label="${t("detail.photos.moveBackward")}">${arrowRightIcon}</button>
    </div>
    </div>`).join('')}</div><div class="bottle-photo-add-actions"><label class="photo-add">${addActionLabel(t("detail.actions.addPhotos"))}<input type="file" accept="${photoAccept}" multiple hidden data-bottle-photos="${escapeHtml(entry.id)}">
    </label><label class="photo-add photo-capture">${t('cutout.takePhoto')}<input type="file" accept="image/*" capture="environment" hidden data-bottle-photos="${escapeHtml(entry.id)}"></label>
    </div>`;
      return `<div class="bottle bottle-entry${firstPhoto ? ' has-photos' :
        ' without-photos'}${state.highlightBottleId === entry.id ?
          ' scanned-bottle' : ''}" id="bottle-${escapeHtml(entry.id)}">
                ${firstPhoto ? `<div class="bottle-entry-visual">
                    <button type="button" class="bottle-entry-main-photo" data-act="open-photo" data-bottle-photo-preview="${escapeHtml(entry.id)}" title="${t('detail.photos.enlarge')}" aria-label="${t('detail.photos.openOverlay')}">
                        <img draggable="false" src="${imageUrl(displayPhotoPath(firstPhoto))}" alt="${escapeHtml(t(
            'detail.photos.bottleWithNumber',
            {
              kind: firstPhoto.source === 'whiskybase' ?
                t('whiskybase.images.reference') :
                t('detail.photos.personalPhoto'),
              number: entry.inventoryNumber || '',
            }
          ))}">
                        ${firstPhoto.source === 'whiskybase' ?
            `<span class="bottle-main-source" title="${t('detail.photos.whiskybaseReferenceNotice')}">WB</span>` : ''}
                        ${firstPhoto.cutout ?
            `<span class="bottle-main-cutout" title="${t('cutout.result')}">${sparkleIcon}</span>` : ''}
                    </button>
                </div>` : ''}
                <div class="bottle-entry-content">
                    <div class="bottle-entry-head">
                        <div class="bottle-entry-identity">
                            <strong>${entry.inventoryNumber ?
          `#${escapeHtml(entry.inventoryNumber)}` :
          t('imports.bottles.noInventoryNumber')}</strong>
                            <span class="badge ${escapeHtml(entry.status)}">${bottleStatusText(entry.status)}</span>
                            ${entry.volumeType === 'sample' ?
          '<span class="badge sample">Sample</span>' : ''}
                            ${entry.volumeMl != null ?
          `<span class="bottle-size">${escapeHtml(entry.volumeMl)} ml</span>` : ''}
                        </div>
                        ${actionToolbar(`
                            <button class="btn small" data-act="warehouse-assign" data-id="${escapeHtml(entry.id)}">${t('warehouse.bottles.relocate')}</button>
                            <button class="btn small" data-act="edit-bottle" data-id="${escapeHtml(entry.id)}">${editIcon}<span>${t('common.actions.edit')}</span></button>
                            <button class="btn small danger" data-act="delete-bottle" data-id="${escapeHtml(entry.id)}">${deleteIcon}<span>${t('common.actions.delete')}</span></button>
                        `, {className: 'bottle-entry-actions'})}
                    </div>
                    ${headingTitle({
            title: t('detail.sections.bottleData'),
            className: 'bottle-entry-data-title',
          })}
                    ${detailGrid([
            detailField({
              label: t('forms.bottle.type'),
              value: t(entry.volumeType === 'sample' ?
                'forms.bottle.sampleBottle' : 'forms.bottle.normalBottle'),
            }),
            entry.purchaseDate ? detailField({
              label: t('detail.meta.purchaseLabel'),
              value: formatDate(entry.purchaseDate),
            }) : '',
            entry.openedAt ? detailField({
              label: t('forms.bottle.openingDate'),
              value: formatDate(entry.openedAt),
            }) : '',
            entry.emptiedAt ? detailField({
              label: t('forms.bottle.emptyDate'),
              value: formatDate(entry.emptiedAt),
            }) : '',
            entry.purchasePrice != null && entry.purchasePrice !== '' ?
              detailField({
                label: t('detail.meta.priceLabel'),
                value: `${entry.purchasePrice} ${entry.currency || 'EUR'}`,
              }) : '',
            storageName != null ? detailField({
              label: t('detail.fields.storageLocation'),
              value: storageShelfId ?
                `<button class="inline-link" data-act="warehouse-focus" data-id="${escapeHtml(storageShelfId)}" data-bottle-id="${escapeHtml(entry.id)}">${escapeHtml(storageName)}</button>` : storageName,
              valueHtml: Boolean(storageShelfId),
            }) : '',
            entry.volumeMl != null ?
              detailField({
                label: t('detail.meta.volumeLabel'),
                value: `${entry.volumeMl} ml`,
              }) : '',
            entry.merchant ?
              detailField({label: t('detail.meta.merchantLabel'), value: entry.merchant}) : '',
            hasBottlingDetail(entry.comment) ? detailField({
              label: t('forms.bottle.personalComment'),
              value: entry.comment,
              className: 'bottle-entry-comment',
            }) : '',
          ].join(''), {columns: 3, tag: 'dl', className: 'bottle-entry-facts'})}
                </div>
                <section class="bottle-entry-gallery" aria-label="${t(
            'detail.sections.bottlePhotos',
            {count: entryPhotos.length}
          )}">
                    <h4>${t(
            'detail.sections.bottlePhotos',
            {count: entryPhotos.length}
          )}</h4>
                    ${photoGallery}
                </section>
                    <section class="bottle-documents" aria-label="${t("detail.sections.attachments")}">
    <h4>${t(
            "detail.statistics.attachmentCount",
            {count: (entry.files || []).length}
          ).replace("&",
            "&amp;"
          )}</h4>
    ${(entry.files || []).length ? documentList(entry.files.map(file =>
            documentItem(`
    <button type="button" class="inline-link document-preview-link" data-act="preview-file" data-id="${escapeHtml(entry.id)}" data-file-id="${escapeHtml(file.id)}" data-file-name="${escapeHtml(file.name)}" title="${escapeHtml(t('detail.documents.openPreview'))}">${escapeHtml(file.name)}</button>
    <span class="muted document-size">${formatFileSize(file.size)}</span>
    <a class="btn small document-download" href="/api/bottles/${encodeURIComponent(entry.id)}/files/${encodeURIComponent(file.id)}" download="${escapeHtml(file.name)}" aria-label="${escapeHtml(t('detail.documents.downloadNamed', {name: file.name}))}">${arrowDownIcon}<span>${escapeHtml(t('detail.documents.download'))}</span></a>
    <button class="btn small danger" type="button" data-act="delete-file" data-id="${escapeHtml(entry.id)}" data-file-id="${escapeHtml(file.id)}" aria-label="${t("detail.documents.deleteNamed", {name: escapeHtml(file.name)})}">${deleteIcon}<span>${t("common.actions.delete")}</span></button>
    `))) : emptyState({description: t("detail.empty.noAttachments")})}
    <label class="document-add">${addActionLabel(t("detail.actions.addAttachments"))}
    <input type="file" accept="${fileAccept}" multiple data-bottle-files="${escapeHtml(entry.id)}">
    </label>
    </section>
            </div>`;
    }).join('');
    shell(`${backNavigation(
      "back",
      t("detail.navigation.backToCollection"),
      "detail-back"
    )}
    <div data-region="detail-bottling" class="section" style="margin-top:18px">
    ${pageHeader({
      title: bottling.name,
      period: false,
      className: 'detail-page-head',
      preTitle: `<div class="detail-heading-meta">${originLabel ?
        `<span class="card-kicker">${escapeHtml(originLabel)}</span><span class="detail-heading-separator" aria-hidden="true">·</span>` : ''}<span class="muted">${escapeHtml(statusText)}</span></div>`,
      copyClass: '',
      actions: headerActions(
        `${relatedDistilleries.length ?
          `<button class="btn" type="button" data-act="bottling-map" title="${t("detail.map.showRelatedDistilleries")}">${locationIcon}<span>${relatedDistilleries.length > 1 ? t("detail.sections.mapLocations") : t("detail.actions.showOnMap")}</span></button>` : ''}
    <button class="btn" data-act="edit-bottling">${editIcon}<span>${t("common.actions.edit")}</span></button>
    <button class="btn danger" data-act="delete-bottling">${deleteIcon}<span>${t("common.actions.delete")}</span></button>
    `,
        {className: 'detail-head-actions'}
      ),
    })}
    <div class="two-col detail-summary-grid">
    <div class="detail-summary-photo">
    ${coverPhoto(bottling.id) ?
        `<button type="button" class="hero-photo hero-photo-open" data-act="open-photo" title="${t("detail.photos.enlargeBottle")}" aria-label="${t("detail.photos.openOverlay")}"><img src="${imageUrl(coverPhoto(bottling.id))}" alt="${t("ui.photos.bottlePhoto")}"></button>` : '<div class="hero-photo"><img class="image-placeholder" src="/assets/photo-placeholder.svg" alt="" aria-hidden="true"></div>'}
    </div>
    ${panel({
          content: `
    ${headingTitle({title: t('detail.sections.bottlingData')})}
    ${facts.length ? detailGrid(
            facts.map(([label, value, suffix = '']) => detailField({
              label: factLabel(label),
              value: `${formatValue(value === "Ja" ? t("common.choices.yes") :
                value === "Nein" ? t("common.choices.no") :
                  value)}${suffix ? ` ${escapeHtml(suffix === "Jahre" ?
                    t("detail.facts.yearSuffix") : suffix)}` : ''}`,
              valueHtml: true, variant: 'fact',
            })).join(''),
            {columns: 2, className: 'forms'}
          ) : (!description && !whiskybaseUrl ?
            emptyState({description: t("detail.empty.noAdditionalInformation")}) : '')}${description ? `${divider()}
    ${headingTitle({title: t('detail.fields.comment')})}
    <p>${escapeHtml(description)}</p>` : ''}${whiskybaseUrl ? `${divider()}
    <a href="${escapeHtml(whiskybaseUrl)}" target="_blank" rel="noopener noreferrer">${t("detail.actions.openWhiskybase")}</a>` : ''}`,
        })}
    </div>
    </div>
    <section data-region="detail-tastings" class="section tasting-summary${latest ? '' : ' is-empty'}" aria-label="${escapeHtml(t('tastings.title'))}">
        ${sectionHeader({
          title: t('tastings.title'),
          className: 'tasting-summary-heading',
          description: latest ? '' : t('tastings.none'),
          descriptionClass: 'hint tasting-summary-empty',
          copyClass: 'tasting-summary-section-heading',
          actionsClass: 'tasting-summary-heading-actions',
          actions: `${latest ? '' :
            `<button type="button" class="btn" data-act="tastings-open">${escapeHtml(t('tastings.openAll'))}</button>`}
                <button type="button" class="btn primary" data-act="tastings-new">${newBottlingIcon}<span>${escapeHtml(t(tastingCount ? 'tastings.add' : 'tastings.first'))}</span></button>`,
        })}
        ${latest ? panel({
          className: 'tasting-summary-card', content: `
            <div class="tasting-summary-content">
                <div class="tasting-summary-main">
                    <span class="muted tasting-summary-lead">${escapeHtml(t('tastings.latest'))}</span>
                    <div class="tasting-summary-score">
                        ${latest.rating != null ?
              `<span class="tasting-summary-glasses" aria-hidden="true">${Array.from(
                {length: 5},
                (_, i) => glencairnRatingSymbol({
                  fill: Math.max(
                    0,
                    Math.min(100, (Number(latest.rating) - i * 20) * 5)
                  ),
                  id: `detail-tasting-${i}`,
                })
              ).join('')}</span>` : ''}
                        <div class="tasting-summary-rating">${latest.rating == null ? escapeHtml(t('tasting.unrated')) : `${escapeHtml(latest.rating)} / 100`}</div>
                    </div>
                    <span class="muted tasting-summary-meta">${escapeHtml(formatDate(latest.tastedOn))} · ${escapeHtml(t('tastings.count', {count: tastingCount}))}</span>
                    <div class="actions tasting-summary-actions">
                        <button type="button" class="btn" data-act="tastings-open" data-tasting-id="${escapeHtml(latest.id)}">${escapeHtml(t('tastings.openOne'))}</button>
                    </div>
                </div>
                ${tastingRadar ?
              `<div class="tasting-summary-radar">${tastingRadar}</div>` : ''}
                <div class="tasting-summary-notes${tastingNotes.length ?
              '' : ' is-empty'}"${tastingNotes.length ? '' :
                ' aria-hidden="true"'}>${tastingNotes.map(note => detailField({
                  label: note.label,
                  value: note.text,
                  variant: 'preview',
                  className: 'tasting-summary-note',
                  labelClass: 'tasting-summary-field-label',
                  valueClass: 'tasting-summary-note-value',
                })).join('')}</div>
            </div>
        `}) : ''}
    </section>
    <div data-region="detail-physical-bottles" class="section">
    ${sectionHeader({
                  title: t(
                    'detail.statistics.bottleAndSampleCount',
                    {count: physicalBottles.length}
                  ),
                  actionsBare: true,
                  actions: `<button class="btn primary" data-act="add-bottle">${newBottlingIcon}<span>${escapeHtml(t('detail.actions.addAnotherBottle').replace(/^\+\s*/,
                    ''
                  ))}</span></button>`,
                })}
    <div class="bottle-entry-list">${list ||
      `<div class="panel"><p class="muted">${t("detail.empty.noPhysicalBottles")}</p></div>`}</div>
    </div>`);
    attachPhotoSorting(action);
  }
  /** Delegated from events.js. Upload inputs may survive a partial re-render,
   * so they must never receive per-render listeners (duplicate uploads). */
  detail.handleUploadChange = async function handleUploadChange(event) {
    const input = event.target;
    if (input.matches?.('input[data-bottle-files]')) {
      const selected = [...input.files];
      input.value = '';
      if (!selected.length) return true;
      const result = await action(
        () => uploadFiles(input.dataset.bottleFiles, selected),
        {scope: 'collection'}
      );
      if (result.ok) toast(t("detail.notifications.filesSaved", {count: result.value}));
      return result.ok;
    }
    if (input.matches?.('input[data-bottle-photos]')) {
      const files = [...input.files];
      input.value = '';
      if (!files.length) return true;
      const result = await action(
        () => uploadPhotos(input.dataset.bottlePhotos, files),
        {scope: 'collection'}
      );
      if (result.ok) toast(t("detail.notifications.photosSaved", {count: files.length}));
      return result.ok;
    }
    return false;
  };
  return detail;
}
