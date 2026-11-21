import { latestTasting } from '../../../shared/tasting-records.js';
import { displayPhotoPath } from '../../../shared/photo-images.js';
import { t } from '../i18n/index.js';
const bottleStatusText = status => t(({closed:'home.status.closed',open:'analytics.inventory.openedStatus',empty:'home.status.empty'})[status] || 'features.distilleries.unknownStatus');
const FACT_KEYS = Object.freeze({'Whisky-Kategorie':'forms.bottling.whiskyCategory','Marke':'forms.bottling.brandOrProductLine','Beteiligte Destillerien':'forms.bottling.participatingDistilleries','Zusammensetzung vollständig':'detail.facts.labelCompositionComplete','Alter':'forms.bottling.ageYears','Alkoholgehalt':'forms.bottling.abv','Erscheinungsjahr':'forms.bottling.releaseYear','Nennfüllmenge laut Abfüllung':'forms.bottling.nominalVolume','Abfüller':'forms.bottling.bottler','Region':'detail.facts.labelRegion','Land':'detail.facts.labelCountry','Fasstyp':'forms.bottling.caskType','Destilliert am':'forms.bottling.distillationDate','Abgefüllt am':'forms.bottling.bottlingDate','Fassnummer':'forms.bottling.caskNumber','Limitierte Auflage':'detail.facts.labelLimitedEdition','Whiskybase-ID':'forms.bottling.whiskybaseId'});
const factLabel = label => FACT_KEYS[label] ? t(FACT_KEYS[label]) : label;
import { escapeHtml } from '../ui/dom.js';
import { editIcon, deleteIcon, locationIcon, newBottlingIcon, addActionLabel } from '../ui/action-icons.js';
import { glencairnRatingSymbol } from '../ui/glencairn-icon.js';
import { imageUrl, formatValue, formatDate } from '../ui/format.js';
import { bottleStatusLabels, photoAccept } from '../domain/labels.js';

import { uploadPhotos } from '../features/photos.js';
import { uploadFiles, fileAccept, formatFileSize } from '../features/files.js';
import { toast } from '../ui/notifications.js';
import { attachPhotoSorting } from '../features/photo-order.js';
import { bottlingDetails, hasBottlingDetail } from '../domain/bottling-details.js';
import { bottlingOriginLabel } from '../domain/bottling-origin.js';
import { bottlingDistilleryIds } from '../domain/bottling-map-focus.js';
import { storagePath } from './warehouse.js';
export function createDetailView({ state, selectors, shell, navigate, action }) {
    const { bottles, coverPhoto, distilleryNames } = selectors;
    function detail() {
        const bottling = state.collection.bottlings.find(entry => entry.id === state.selected);
        if (!bottling) {
            navigate('home', null, {
                replace: true
            });
            return;
        }
        const latest = latestTasting(bottling);
        const tastingCount = bottling.tastings?.length || 0;
        const physicalBottles = bottles(bottling.id);
        const facts = bottlingDetails(bottling, distilleryNames, state.collection.distilleries);
        const originLabel = bottlingOriginLabel(bottling, distilleryNames);
        const relatedDistilleries = bottlingDistilleryIds(bottling);
        const statusText = bottling.completionStatus === 'complete' ? t("detail.status.complete") : t("detail.status.incomplete");
        const description = hasBottlingDetail(bottling.description) ? bottling.description : null;
        const whiskybaseUrl = hasBottlingDetail(bottling.whiskybaseUrl) ? bottling.whiskybaseUrl : null;
        const list = physicalBottles.map(entry => {
            const entryPhotos = entry.photos || [];
            const firstPhoto = entryPhotos[0];
            const storageShelfId = state.warehouse?.assignments[entry.id];
            const storageName = state.warehouse
                ? (storageShelfId ? storagePath(state.warehouse, storageShelfId)?.label || t('detail.fields.unassigned') : t('detail.fields.unassigned'))
                : null;
            const photoGallery = `<div class="bottle-photos" data-photo-list="${escapeHtml(entry.id)}">${(entry.photos || []).map(photo => `<div class="photo-tile" data-photo-tile data-photo-id="${escapeHtml(photo.id)}">
    <button type="button" class="photo-open" data-act="open-photo" title="${t("detail.photos.enlarge")}" aria-label="${t("detail.photos.openOverlay")}">
    <img draggable="false" src="${imageUrl(displayPhotoPath(photo))}" alt="${escapeHtml(t("detail.photos.bottleWithNumber",{kind:photo.source === 'whiskybase' ? t("whiskybase.images.reference") : t("detail.photos.personalPhoto"),number:entry.inventoryNumber||''}))}" loading="lazy">
    </button>
    <button class="photo-edit-trigger" type="button" data-act="photo-editor-open" data-id="${escapeHtml(entry.id)}" data-photo-id="${escapeHtml(photo.id)}" title="${t('photoEditor.title')}" aria-label="${t('photoEditor.title')}">${editIcon}</button>
    ${photo.cutout ? `<span class="photo-cutout-badge" title="${t('cutout.result')}">✦</span>` : ''}
    <button class="photo-remove" type="button" data-act="delete-photo" data-id="${escapeHtml(entry.id)}" data-photo-id="${escapeHtml(photo.id)}" aria-label="${t("ui.confirmations.deletePhoto")}">×</button>
    ${photo.source === 'whiskybase' ? `<span class="photo-source" title="${t('detail.photos.whiskybaseReferenceNotice')}">WB</span>` : ''}
    <div class="photo-controls">
    <button class="photo-move" type="button" data-act="move-photo" data-id="${escapeHtml(entry.id)}" data-photo-id="${escapeHtml(photo.id)}" data-dir="-1" aria-label="${t("detail.photos.moveForward")}">←</button>
    <button class="photo-drag-handle" type="button" data-photo-drag title="${t("detail.photos.reorderHint")}" aria-label="${t("detail.photos.reorderHint")}">⠿</button>
    <button class="photo-move" type="button" data-act="move-photo" data-id="${escapeHtml(entry.id)}" data-photo-id="${escapeHtml(photo.id)}" data-dir="1" aria-label="${t("detail.photos.moveBackward")}">→</button>
    </div>
    </div>`).join('')}</div><div class="bottle-photo-add-actions"><label class="photo-add">${addActionLabel(t("detail.actions.addPhotos"))}<input type="file" accept="${photoAccept}" multiple hidden data-bottle-photos="${escapeHtml(entry.id)}">
    </label><label class="photo-add photo-capture">${t('cutout.takePhoto')}<input type="file" accept="image/*" capture="environment" hidden data-bottle-photos="${escapeHtml(entry.id)}"></label>
    </div>`;
            return `<div class="bottle bottle-entry${firstPhoto ? ' has-photos' : ' without-photos'}${state.highlightBottleId === entry.id ? ' scanned-bottle' : ''}" id="bottle-${escapeHtml(entry.id)}">
                ${firstPhoto ? `<div class="bottle-entry-visual">
                    <button type="button" class="bottle-entry-main-photo" data-act="open-photo" data-bottle-photo-preview="${escapeHtml(entry.id)}" title="${t('detail.photos.enlarge')}" aria-label="${t('detail.photos.openOverlay')}">
                        <img draggable="false" src="${imageUrl(displayPhotoPath(firstPhoto))}" alt="${escapeHtml(t('detail.photos.bottleWithNumber',{kind:firstPhoto.source === 'whiskybase' ? t('whiskybase.images.reference') : t('detail.photos.personalPhoto'),number:entry.inventoryNumber || ''}))}">
                        ${firstPhoto.source === 'whiskybase' ? `<span class="bottle-main-source" title="${t('detail.photos.whiskybaseReferenceNotice')}">WB</span>` : ''}
                        ${firstPhoto.cutout ? `<span class="bottle-main-cutout" title="${t('cutout.result')}">✦</span>` : ''}
                    </button>
                </div>` : ''}
                <div class="bottle-entry-content">
                    <div class="bottle-entry-head">
                        <div class="bottle-entry-identity">
                            <strong>${entry.inventoryNumber ? `#${escapeHtml(entry.inventoryNumber)}` : t('imports.bottles.noInventoryNumber')}</strong>
                            <span class="badge ${escapeHtml(entry.status)}">${bottleStatusText(entry.status)}</span>
                            ${entry.volumeType === 'sample' ? '<span class="badge sample">Sample</span>' : ''}
                            ${entry.volumeMl != null ? `<span class="bottle-size">${escapeHtml(entry.volumeMl)} ml</span>` : ''}
                        </div>
                        <div class="actions bottle-entry-actions">
                            <button class="btn small" data-act="warehouse-assign" data-id="${escapeHtml(entry.id)}">${t('warehouse.bottles.relocate')}</button>
                            <button class="btn small" data-act="edit-bottle" data-id="${escapeHtml(entry.id)}">${editIcon}<span>${t('common.actions.edit')}</span></button>
                            <button class="btn small danger" data-act="delete-bottle" data-id="${escapeHtml(entry.id)}">${deleteIcon}<span>${t('common.actions.delete')}</span></button>
                        </div>
                    </div>
                    <h3 class="bottle-entry-data-title">${t('detail.sections.bottleData')}</h3>
                    <dl class="bottle-entry-facts">
                        <div><dt>${t('forms.bottle.type')}</dt><dd>${t(entry.volumeType === 'sample' ? 'forms.bottle.sampleBottle' : 'forms.bottle.normalBottle')}</dd></div>
                        ${entry.purchaseDate ? `<div><dt>${t('detail.meta.purchaseLabel')}</dt><dd>${escapeHtml(formatDate(entry.purchaseDate))}</dd></div>` : ''}
                        ${entry.openedAt ? `<div><dt>${t('forms.bottle.openingDate')}</dt><dd>${escapeHtml(formatDate(entry.openedAt))}</dd></div>` : ''}
                        ${entry.purchasePrice != null && entry.purchasePrice !== '' ? `<div><dt>${t('detail.meta.priceLabel')}</dt><dd>${escapeHtml(entry.purchasePrice)} ${escapeHtml(entry.currency || 'EUR')}</dd></div>` : ''}
                        ${storageName != null ? `<div><dt>${t('detail.fields.storageLocation')}</dt><dd>${storageShelfId ? `<button class="inline-link" data-act="warehouse-focus" data-id="${escapeHtml(storageShelfId)}" data-bottle-id="${escapeHtml(entry.id)}">${escapeHtml(storageName)}</button>` : escapeHtml(storageName)}</dd></div>` : ''}
                        ${entry.volumeMl != null ? `<div><dt>${t('detail.meta.volumeLabel')}</dt><dd>${escapeHtml(entry.volumeMl)} ml</dd></div>` : ''}
                        ${entry.merchant ? `<div><dt>${t('detail.meta.merchantLabel')}</dt><dd>${escapeHtml(entry.merchant)}</dd></div>` : ''}
                        ${hasBottlingDetail(entry.comment) ? `<div class="bottle-entry-comment"><dt>${t('forms.bottle.personalComment')}</dt><dd>${escapeHtml(entry.comment)}</dd></div>` : ''}
                    </dl>
                </div>
                <section class="bottle-entry-gallery" aria-label="${t('detail.sections.bottlePhotos', {count:entryPhotos.length})}">
                    <h4>${t('detail.sections.bottlePhotos', {count:entryPhotos.length})}</h4>
                    ${photoGallery}
                </section>
                    <section class="bottle-documents" aria-label="${t("detail.sections.attachments")}">
    <h4>${t("detail.statistics.attachmentCount", {count:(entry.files || []).length}).replace("&", "&amp;")}</h4>
    ${(entry.files || []).length ? `<ul class="document-list">${entry.files.map(file => `<li>
    <a href="/api/bottles/${encodeURIComponent(entry.id)}/files/${encodeURIComponent(file.id)}" download="${escapeHtml(file.name)}" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</a>
    <span class="muted document-size">${formatFileSize(file.size)}</span>
    <button class="btn small danger" type="button" data-act="delete-file" data-id="${escapeHtml(entry.id)}" data-file-id="${escapeHtml(file.id)}" aria-label="${t("detail.documents.deleteNamed",{name:escapeHtml(file.name)})}">${deleteIcon}<span>${t("common.actions.delete")}</span></button>
    </li>`).join('')}</ul>` : `<p class="hint">${t("detail.empty.noAttachments")}</p>`}
    <label class="document-add">${addActionLabel(t("detail.actions.addAttachments"))}
    <input type="file" accept="${fileAccept}" multiple data-bottle-files="${escapeHtml(entry.id)}">
    </label>
    </section>
            </div>`;
        }).join('');
        shell(`<button data-region="detail-back" class="inline-link" data-act="back">${t("detail.navigation.backToCollection")}</button>
    <div data-region="detail-bottling" class="section" style="margin-top:18px">
    <div class="section-head detail-page-head">
    <div>
    <div class="detail-heading-meta">${originLabel ? `<span class="card-kicker">${escapeHtml(originLabel)}</span><span class="detail-heading-separator" aria-hidden="true">·</span>` : ''}<span class="muted">${statusText}</span></div>
    <h2>${escapeHtml(bottling.name)}</h2>
    </div>
    <div class="actions detail-head-actions">
    ${relatedDistilleries.length ? `<button class="btn" type="button" data-act="bottling-map" title="${t("detail.map.showRelatedDistilleries")}">${locationIcon}<span>${relatedDistilleries.length > 1 ? t("detail.sections.mapLocations") : t("detail.actions.showOnMap")}</span></button>` : ''}
    <button class="btn" data-act="edit-bottling">${editIcon}<span>${t("common.actions.edit")}</span></button>
    <button class="btn danger" data-act="delete-bottling">${deleteIcon}<span>${t("common.actions.delete")}</span></button>
    </div>
    </div>
    <div class="two-col detail-summary-grid">
    <div class="detail-summary-photo">
    ${coverPhoto(bottling.id) ? `<button type="button" class="hero-photo hero-photo-open" data-act="open-photo" title="${t("detail.photos.enlargeBottle")}" aria-label="${t("detail.photos.openOverlay")}"><img src="${imageUrl(coverPhoto(bottling.id))}" alt="${t("ui.photos.bottlePhoto")}"></button>` : '<div class="hero-photo"><img class="image-placeholder" src="/assets/photo-placeholder.svg" alt="" aria-hidden="true"></div>'}
    </div>
    <div class="panel">
    <h3>${t("detail.sections.bottlingData")}</h3>
    ${facts.length ? `<div class="forms">${facts.map(([label, value, suffix = '']) => `<div>
    <span class="muted" style="font-size:12px">${factLabel(label)}</span>
    <div style="font-weight:650;margin-top:4px">${formatValue(value === "Ja" ? t("common.choices.yes") : value === "Nein" ? t("common.choices.no") : value)}${suffix ? ` ${suffix === "Jahre" ? t("detail.facts.yearSuffix") : suffix}` : ''}</div>
    </div>`).join('')}</div>` : (!description && !whiskybaseUrl ? `<p class="hint">${t("detail.empty.noAdditionalInformation")}</p>` : '')}${description ? `<hr class="divider">
    <h3>${t("detail.fields.comment")}</h3>
    <p>${escapeHtml(description)}</p>` : ''}${whiskybaseUrl ? `<hr class="divider">
    <a href="${escapeHtml(whiskybaseUrl)}" target="_blank" rel="noopener noreferrer">${t("detail.actions.openWhiskybase")}</a>` : ''}</div>
    </div>
    </div>
    <section data-region="detail-tastings" class="section tasting-summary" aria-label="${escapeHtml(t('tastings.title'))}">
        <div class="section-head">
            <h3>${escapeHtml(t('tastings.title'))}</h3>
            <button type="button" class="btn primary" data-act="tastings-new">${newBottlingIcon}<span>${escapeHtml(t(tastingCount ? 'tastings.add' : 'tastings.first'))}</span></button>
        </div>
        <div class="panel tasting-summary-card">
            <div class="tasting-summary-content">
                <div><span class="muted">${escapeHtml(t('tastings.latest'))}</span>
                <div class="tasting-summary-score">
                    ${latest?.rating != null ? `<span class="tasting-summary-glasses" aria-hidden="true">${Array.from({length:5},(_,i)=>glencairnRatingSymbol({fill:Math.max(0,Math.min(100,(Number(latest.rating)-i*20)*5)),id:`detail-tasting-${i}`})).join('')}</span>` : ''}
                    <div class="tasting-summary-rating">${latest ? (latest.rating == null ? escapeHtml(t('tasting.unrated')) : `${escapeHtml(latest.rating)} / 100`) : escapeHtml(t('tastings.none'))}</div>
                </div>
                ${latest ? `<span class="muted">${escapeHtml(formatDate(latest.tastedOn))} · ${escapeHtml(t('tastings.count',{count:tastingCount}))}</span>` : ''}</div>
                <div class="actions tasting-summary-actions">
                    <button type="button" class="btn" data-act="tastings-open" ${tastingCount === 1 ? `data-tasting-id="${escapeHtml(latest.id)}"` : ''}>${escapeHtml(t(tastingCount === 1 ? 'tastings.openOne' : 'tastings.openAll'))}</button>
                </div>
            </div>
        </div>
    </section>
    <div data-region="detail-physical-bottles" class="section">
    <div class="section-head">
    <h3>${t("detail.statistics.bottleAndSampleCount", {count:physicalBottles.length})}</h3>
    <button class="btn primary" data-act="add-bottle">${newBottlingIcon}<span>${escapeHtml(t('detail.actions.addAnotherBottle').replace(/^\+\s*/, ''))}</span></button>
    </div>
    <div class="bottle-entry-list">${list || `<div class="panel"><p class="muted">${t("detail.empty.noPhysicalBottles")}</p></div>`}</div>
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
            const result = await action(() => uploadFiles(input.dataset.bottleFiles, selected), {scope:'collection'});
            if (result.ok) toast(t("detail.notifications.filesSaved", {count:result.value}));
            return result.ok;
        }
        if (input.matches?.('input[data-bottle-photos]')) {
            const files = [...input.files];
            input.value = '';
            if (!files.length) return true;
            const result = await action(() => uploadPhotos(input.dataset.bottlePhotos, files), {scope:'collection'});
            if (result.ok) toast(t("detail.notifications.photosSaved", {count:files.length}));
            return result.ok;
        }
        return false;
    };
    return detail;
}
