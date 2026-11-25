import {hasBottlingDetail} from '../domain/bottling-details.js';
import {createDetailViewModel} from './models/detail.js';
import {composeMarkup} from '../ui/render-plan.js';
import {actionButton} from '../ui/buttons.js';
import {headingTitle, headerActions, sectionHeader, pageHeader, backNavigation}
  from '../ui/headers.js';
import {
  panel, detailField, detailGrid, emptyState, divider, actionToolbar,
  documentList, documentItem
} from '../ui/content.js';
import {displayPhotoPath} from '../../../shared/photo-images.js';
import {t} from '../i18n/index.js';
import {loadTemplates} from '../ui/templates.js';

const renderTemplate = await loadTemplates('detail/detail.html');

/**
 * Derives the bottle status text result from the supplied values.
 *
 * @param {*} status Status value determining the next action.
 * @return {*} Result computed from the supplied inputs.
 */
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
/**
 * Derives the fact label result from the supplied values.
 *
 * @param {*} label Label shown to the user.
 * @return {*} Result computed from the supplied inputs.
 */
const factLabel = label => FACT_KEYS[label] ? t(FACT_KEYS[label]) : label;
import {escapeHtml} from '../ui/dom.js';
import {
  editIcon, deleteIcon, arrowDownIcon, locationIcon, newBottlingIcon,
  addActionLabel, closeIcon, arrowLeftIcon, arrowRightIcon, gripIcon,
  sparkleIcon
} from '../ui/action-icons.js';
import {glencairnRatingSymbol} from '../ui/glencairn-icon.js';
import {flavorChart} from '../ui/flavor-profile.js';
import {imageUrl, formatValue, formatDate} from '../ui/format.js';
import {bottleStatusLabels, photoAccept} from '../domain/labels.js';

import {uploadPhotos} from '../features/photos.js';
import {uploadFiles, fileAccept, formatFileSize} from '../features/files.js';
import {toast} from '../ui/notifications.js';
import {attachPhotoSorting} from '../features/photo-order.js';
import {storagePath} from './warehouse.js';
/**
 * Creates detail view for detail.
 *
 * @param {!Object} options Optional configuration for the operation.
 * @return {!Object} Structured result for the caller.
 */
export function createDetailView({state, selectors, shell, navigate, action}) {
  const {bottles, coverPhoto, distilleryNames} = selectors;
  /**
   * Selects and transforms the detail records.
   */
  function detail() {
    const model = createDetailViewModel(state, selectors);
    if (!model) {
      navigate('home', null, {replace: true});
      return;
    }
    const {bottling, latest, tastingCount, tastingNotes, physicalBottles,
      facts, originLabel, relatedDistilleries, statusText, description,
      whiskybaseUrl} = model;
    const tastingRadar = latest?.flavorProfile && Object.values(latest.flavorProfile).some(Number.isInteger)
      ? flavorChart(latest.flavorProfile, {compact: true}) : '';
    const list = composeMarkup(physicalBottles.map(entry => {
      const entryPhotos = entry.photos || [];
      const firstPhoto = entryPhotos[0];
      const storageShelfId = state.warehouse?.assignments[entry.id];
      const storageName = state.warehouse
        ? (storageShelfId ?
          storagePath(state.warehouse, storageShelfId)?.label || t('detail.fields.unassigned') : t('detail.fields.unassigned'))
        : null;
      const photoGallery =
        renderTemplate('bottlePhotos', {
          id: entry.id,
          photos: composeMarkup((entry.photos || []).map(photo =>
            renderTemplate('photoTile', {
              id: photo.id,
              imageUrl: imageUrl(displayPhotoPath(photo)),
              bottleWithNumber: t(
                "detail.photos.bottleWithNumber",
                {
                  kind: photo.source === 'whiskybase' ? t("whiskybase.images.reference") : t("detail.photos.personalPhoto"),
                  number: entry.inventoryNumber || '',
                }
              ),
              id2: entry.id,
              photoId: photo.id,
              editIcon: editIcon,
              photoCutoutBadge: photo.cutout ? renderTemplate('photoCutoutBadge', {sparkleIcon: sparkleIcon, }) : '',
              id4: entry.id,
              id5: photo.id,
              closeIcon: closeIcon,
              photoSource: photo.source === 'whiskybase' ? renderTemplate('photoSource') : '',
              id6: entry.id,
              id7: photo.id,
              arrowLeftIcon: arrowLeftIcon,
              gripIcon: gripIcon,
              id8: entry.id,
              id9: photo.id,
              arrowRightIcon: arrowRightIcon,
            }))),
          addActionLabel: addActionLabel(t("detail.actions.addPhotos")),
          photoAccept: photoAccept,
          bottlePhotos: entry.id,
          id3: entry.id,
        });
      return renderTemplate('bottle', {
        firstPhoto: firstPhoto ? ' has-photos' : ' without-photos',
        highlightBottleId: state.highlightBottleId === entry.id ? ' scanned-bottle' : '',
        id: entry.id,
        openPhoto: firstPhoto ? renderTemplate('openPhoto', {
          id: entry.id,
          imageUrl: imageUrl(displayPhotoPath(firstPhoto)),
          bottleWithNumber: t(
            'detail.photos.bottleWithNumber',
            {
              kind: firstPhoto.source === 'whiskybase' ? t('whiskybase.images.reference') : t('detail.photos.personalPhoto'),
              number: entry.inventoryNumber || '',
            }
          ),
          bottleMainSource: firstPhoto.source === 'whiskybase' ? renderTemplate('bottleMainSource') : '',
          bottleMainCutout: firstPhoto.cutout ? renderTemplate('bottleMainCutout', {sparkleIcon: sparkleIcon, }) : '',
        }) : '',
        inventoryNumber: entry.inventoryNumber ? `#${escapeHtml(entry.inventoryNumber)}` : t('imports.bottles.noInventoryNumber'),
        status: entry.status,
        bottleStatusText: bottleStatusText(entry.status),
        badge: entry.volumeType === 'sample' ? renderTemplate('badge') : '',
        bottleSize: entry.volumeMl != null ? renderTemplate('bottleSize', {volumeMl: entry.volumeMl, }) : '',
        actionToolbar: actionToolbar(
          composeMarkup(
            "\n                            ",
            actionButton({
              label: t('warehouse.bottles.relocate'),
              action: 'warehouse-assign',
              size: 'small',
              data: {id: entry.id},
            }),
            "\n                            ",
            actionButton({
              label: t('common.actions.edit'),
              action: 'edit-bottle',
              size: 'small',
              data: {id: entry.id},
              icon: editIcon,
              wrapLabel: true,
            }),
            "\n                            ",
            actionButton({
              label: t('common.actions.delete'),
              action: 'delete-bottle',
              variant: 'destructive',
              size: 'small',
              data: {id: entry.id},
              icon: deleteIcon,
              wrapLabel: true,
            }),
            "\n                        "
          ),
          {className: 'bottle-entry-actions'}
        ),
        headingTitle: headingTitle({
          title: t('detail.sections.bottleData'),
          className: 'bottle-entry-data-title',
        }),
        detailGrid: detailGrid(composeMarkup([
          detailField({
            label: t('forms.bottle.type'),
            value: t(entry.volumeType === 'sample' ? 'forms.bottle.sampleBottle' : 'forms.bottle.normalBottle'),
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
              renderTemplate('warehouseFocus', {
                storageShelfId: storageShelfId,
                id: entry.id,
                storageName: storageName,
              }) : storageName,
            valueHtml: Boolean(storageShelfId),
          }) : '',
          entry.volumeMl != null ?
            detailField({
              label: t('detail.meta.volumeLabel'),
              value: `${entry.volumeMl} ml`,
            }) : '',
          entry.merchant ?
            detailField({
              label: t('detail.meta.merchantLabel'),
              value: entry.merchant,
            }) : '',
          hasBottlingDetail(entry.comment) ? detailField({
            label: t('forms.bottle.personalComment'),
            value: entry.comment,
            className: 'bottle-entry-comment',
          }) : '',
        ]), {columns: 3, tag: 'dl', className: 'bottle-entry-facts'}),
        bottlePhotos: t('detail.sections.bottlePhotos', {count: entryPhotos.length}),
        bottlePhotos2: t('detail.sections.bottlePhotos', {count: entryPhotos.length}),
        photoGallery: photoGallery,
        replace: t("detail.statistics.attachmentCount", {count: (entry.files || []).length}).replace("&", "&amp;"),
        length: (entry.files || []).length ? documentList(entry.files.map(file =>
          documentItem(renderTemplate('previewFile', {
            id: entry.id,
            fileId: file.id,
            name: file.name,
            openPreview: t('detail.documents.openPreview'),
            name2: file.name,
            formatFileSize: formatFileSize(file.size),
            encodeURIComponent: encodeURIComponent(entry.id),
            href: encodeURIComponent(file.id),
            name3: file.name,
            downloadNamed: t('detail.documents.downloadNamed', {name: file.name}),
            arrowDownIcon: arrowDownIcon,
            download: t('detail.documents.download'),
            deleteFileButton: actionButton({
              label: t('common.actions.delete'),
              action: 'delete-file',
              variant: 'destructive',
              size: 'small',
              data: {id: entry.id, 'file-id': file.id},
              ariaLabel: t('detail.documents.deleteNamed', {name: file.name, }),
              icon: deleteIcon,
              wrapLabel: true,
            }),
          })))) : emptyState({description: t("detail.empty.noAttachments")}),
        addActionLabel: addActionLabel(t("detail.actions.addAttachments")),
        fileAccept: fileAccept,
        bottleFiles: entry.id,
      });
    }));
    shell(renderTemplate('detail', {
      backNavigation: backNavigation("back", t("detail.navigation.backToCollection"), "detail-back"),
      pageHeader: pageHeader({
        title: bottling.name,
        period: false,
        className: 'detail-page-head',
        preTitle: renderTemplate('detailHeadingMeta', {
          cardKicker: originLabel ? renderTemplate('cardKicker', {originLabel: originLabel, }) : '',
          statusText: statusText,
        }),
        copyClass: '',
        actions: headerActions(
          composeMarkup(relatedDistilleries.length ?
            actionButton({
              label: relatedDistilleries.length > 1 ? t('detail.sections.mapLocations') : t('detail.actions.showOnMap'),
              action: 'bottling-map',
              title: t('detail.map.showRelatedDistilleries'),
              icon: locationIcon,
              wrapLabel: true,
            }) : '', "\n    ", actionButton({
              label: t('common.actions.edit'),
              action: 'edit-bottling',
              icon: editIcon,
              wrapLabel: true,
            }), "\n    ", actionButton({
              label: t('common.actions.delete'),
              action: 'delete-bottling',
              variant: 'destructive',
              icon: deleteIcon,
              wrapLabel: true,
            }), "\n    "),
          {className: 'detail-head-actions'}
        ),
      }),
      openPhoto: coverPhoto(bottling.id) ?
        renderTemplate('openPhoto2', {imageUrl: imageUrl(coverPhoto(bottling.id)), }) : renderTemplate('heroPhoto'),
      panel: panel({
        content: composeMarkup(
          "\n    ",
          headingTitle({title: t('detail.sections.bottlingData')}),
          "\n    ",
          facts.length ? detailGrid(
            composeMarkup(facts.map(([label, value, suffix = '']) =>
              detailField({
                label: factLabel(label),
                value: `${formatValue(value === "Ja" ? t("common.choices.yes") : value === "Nein" ? t("common.choices.no") : value)}${suffix ? ` ${escapeHtml(suffix === "Jahre" ? t("detail.facts.yearSuffix") : suffix)}` : ''}`,
                valueHtml: true, variant: 'fact',
              }))),
            {columns: 2, className: 'forms'}
          ) : (!description && !whiskybaseUrl ? emptyState({description: t("detail.empty.noAdditionalInformation")}) : ''),
          description ? renderTemplate('content', {
            divider: divider(),
            headingTitle: headingTitle({title: t('detail.fields.comment')}),
            description: description,
          }) : '',
          whiskybaseUrl ? renderTemplate('content2', {
            divider: divider(),
            whiskybaseUrl: whiskybaseUrl,
          }) : ''
        ),
      }),
      latest: latest ? '' : ' is-empty',
      title: t('tastings.title'),
      sectionHeader: sectionHeader({
        title: t('tastings.title'),
        className: 'tasting-summary-heading',
        description: latest ? '' : t('tastings.none'),
        descriptionClass: 'hint tasting-summary-empty',
        copyClass: 'tasting-summary-section-heading',
        actionsClass: 'tasting-summary-heading-actions',
        actions: composeMarkup(latest ? '' :
          actionButton({
            label: t('tastings.openAll'),
            action: 'tastings-open',
          }), "\n                ", actionButton({
            label: t(tastingCount ? 'tastings.add' : 'tastings.first'),
            action: 'tastings-new',
            variant: 'primary',
            icon: newBottlingIcon,
            wrapLabel: true,
          })),
      }),
      latest2: latest ? panel({
        className: 'tasting-summary-card',
        content: renderTemplate(
          'tastingSummaryContent',
          {
            latest: t('tastings.latest'),
            tastingSummaryGlasses: latest.rating != null ?
              renderTemplate('tastingSummaryGlasses', {
                from: composeMarkup(Array.from(
                  {length: 5},
                  (_, i) => glencairnRatingSymbol({
                    fill: Math.max(0, Math.min(100, (Number(latest.rating) - i * 20) * 5)),
                    id: `detail-tasting-${i}`,
                  })
                )),
              }) : '',
            rating: latest.rating == null ? escapeHtml(t('tasting.unrated')) : `${escapeHtml(latest.rating)} / 100`,
            formatDate: formatDate(latest.tastedOn),
            count: t('tastings.count', {count: tastingCount}),
            tastingsOpenButton: actionButton({
              label: t('tastings.openOne'),
              action: 'tastings-open',
              data: {'tasting-id': latest.id},
            }),
            tastingSummaryRadar: tastingRadar ? renderTemplate('tastingSummaryRadar', {tastingRadar: tastingRadar, }) : '',
            length: tastingNotes.length ? '' : ' is-empty',
            ariaHiddenAttributes: tastingNotes.length ? {} : {"aria-hidden": "true"},
            tastingNotes: composeMarkup(tastingNotes.map(note => detailField({
              label: note.label,
              value: note.text,
              variant: 'preview',
              className: 'tasting-summary-note',
              labelClass: 'tasting-summary-field-label',
              valueClass: 'tasting-summary-note-value',
            }))),
          }
        ),
      }) : '',
      sectionHeader2: sectionHeader({
        title: t('detail.statistics.bottleAndSampleCount', {count: physicalBottles.length}),
        actionsBare: true,
        actions: actionButton({
          label: t('detail.actions.addAnotherBottle').replace(/^\+\s*/, ''),
          action: 'add-bottle',
          variant: 'primary',
          icon: newBottlingIcon,
          wrapLabel: true,
        }),
      }),
      list: list || renderTemplate('panel'),
    }));
    attachPhotoSorting(action);
  }
  /**
   * Handles a file or photo upload from the delegated change event.
   *
   * Upload inputs can survive a partial rerender, so the handler must not
   * attach per-render listeners that would upload the same files twice.
   *
   * @param {!Event} event Change event from the upload input.
   * @return {!Promise<boolean>} Whether the event was handled successfully.
   */
  detail.handleUploadChange = async function handleUploadChange(event) {
    const input = event.target;
    if (input.matches?.('input[data-bottle-files]')) {
      const selected = [...input.files];
      input.value = '';
      if (!selected.length) return true;
      const result = await action(() => uploadFiles(input.dataset.bottleFiles, selected), {scope: 'collection'});
      if (result.ok) toast(t("detail.notifications.filesSaved", {count: result.value}));
      return result.ok;
    }
    if (input.matches?.('input[data-bottle-photos]')) {
      const files = [...input.files];
      input.value = '';
      if (!files.length) return true;
      const result = await action(() => uploadPhotos(input.dataset.bottlePhotos, files), {scope: 'collection'});
      if (result.ok) toast(t("detail.notifications.photosSaved", {count: files.length}));
      return result.ok;
    }
    return false;
  };
  return detail;
}
