import { displayPhotoPath } from '../domain/photo-images.js';
import { t } from '../i18n/index.js';
const bottleStatusText = status => t(({closed:'home.status.closed',open:'analytics.inventory.openedStatus',empty:'home.status.empty'})[status] || 'features.distilleries.unknownStatus');
const FACT_KEYS = Object.freeze({'Whisky-Kategorie':'forms.bottling.whiskyCategory','Marke':'forms.bottling.brandOrProductLine','Beteiligte Destillerien':'forms.bottling.participatingDistilleries','Zusammensetzung vollständig':'detail.facts.labelCompositionComplete','Alter':'forms.bottling.ageYears','Alkoholgehalt':'forms.bottling.abv','Erscheinungsjahr':'forms.bottling.releaseYear','Nennfüllmenge laut Abfüllung':'forms.bottling.nominalVolume','Abfüller':'forms.bottling.bottler','Region':'detail.facts.labelRegion','Land':'detail.facts.labelCountry','Fasstyp':'forms.bottling.caskType','Destilliert am':'forms.bottling.distillationDate','Abgefüllt am':'forms.bottling.bottlingDate','Fassnummer':'forms.bottling.caskNumber','Limitierte Auflage':'detail.facts.labelLimitedEdition'});
const factLabel = label => FACT_KEYS[label] ? t(FACT_KEYS[label]) : label;
import { escapeHtml, queryAll } from '../ui/dom.js';
import { editIcon, deleteIcon, locationIcon } from '../ui/action-icons.js';
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
const displayBottleMeta = entry => [entry.purchaseDate ? t('detail.meta.purchaseDate', {date:formatDate(entry.purchaseDate)}) : null, entry.purchasePrice != null && entry.purchasePrice !== '' ? `${entry.purchasePrice} ${entry.currency || 'EUR'}` : null].filter(Boolean).join(' · ');
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
        const physicalBottles = bottles(bottling.id);
        const facts = bottlingDetails(bottling, distilleryNames, state.collection.distilleries);
        const originLabel = bottlingOriginLabel(bottling, distilleryNames);
        const relatedDistilleries = bottlingDistilleryIds(bottling);
        const statusText = bottling.completionStatus === 'complete' ? t("detail.status.complete") : t("detail.status.incomplete");
        const description = hasBottlingDetail(bottling.description) ? bottling.description : null;
        const whiskybaseUrl = hasBottlingDetail(bottling.whiskybaseUrl) ? bottling.whiskybaseUrl : null;
        const list = physicalBottles.map(entry => `<div class="bottle bottle-entry${state.highlightBottleId === entry.id ? ' scanned-bottle' : ''}" id="bottle-${escapeHtml(entry.id)}">
    <div class="info">
    <strong>${entry.inventoryNumber ? `#${escapeHtml(entry.inventoryNumber)}` : t("whiskybase.bottles.noInventoryNumber")} <span class="badge ${entry.status}">${bottleStatusText(entry.status)}</span>${entry.volumeType === 'sample' ? '<span class="badge sample">Sample</span>' : ''}${entry.volumeMl != null ? `<span class="bottle-size">${escapeHtml(entry.volumeMl)} ml</span>` : ''}
    </strong>${displayBottleMeta(entry) ? `<span class="bottle-meta">${escapeHtml(displayBottleMeta(entry))}</span>` : ''}${state.warehouse ? `<span class="bottle-meta">${t("detail.fields.storagePrefix")} ${state.warehouse.assignments[entry.id] ? `<button class="inline-link" data-act="warehouse-focus" data-id="${escapeHtml(state.warehouse.assignments[entry.id])}">${escapeHtml(storagePath(state.warehouse, state.warehouse.assignments[entry.id])?.label || t("detail.fields.unassigned"))}</button>` : t("detail.fields.unassigned")}</span>` : ''}<div class="bottle-photos" data-photo-list="${escapeHtml(entry.id)}">${(entry.photos || []).map(photo => `<div class="photo-tile" data-photo-tile data-photo-id="${escapeHtml(photo.id)}">
    <button type="button" class="photo-open" data-act="open-photo" title="${t("detail.photos.enlarge")}" aria-label="${t("detail.photos.openOverlay")}">
    <img src="${imageUrl(displayPhotoPath(photo))}" alt="${t("detail.photos.bottleWithNumber",{kind:photo.source === 'whiskybase' ? t("whiskybase.images.reference") : t("detail.photos.personalPhoto"),number:entry.inventoryNumber||''})}" loading="lazy">
    </button>
    <button class="photo-cutout" type="button" data-act="cutout-open" data-id="${escapeHtml(entry.id)}" data-photo-id="${escapeHtml(photo.id)}" title="${t('cutout.title')}" aria-label="${t('cutout.title')}">${t('cutout.button')}</button>
    ${photo.cutout ? `<span class="photo-cutout-badge" title="${t('cutout.result')}">✦</span>` : ''}
    <button class="photo-remove" type="button" data-act="delete-photo" data-id="${entry.id}" data-photo-id="${photo.id}" aria-label="${t("ui.confirmations.deletePhoto")}">×</button>
    ${photo.source === 'whiskybase' ? `<span class="photo-source" title="${t('detail.photos.whiskybaseReferenceNotice')}">WB</span>` : ''}
    <div class="photo-controls">
    <button class="photo-move" type="button" data-act="move-photo" data-id="${escapeHtml(entry.id)}" data-photo-id="${escapeHtml(photo.id)}" data-dir="-1" aria-label="${t("detail.photos.moveForward")}">←</button>
    <span class="photo-drag-handle" draggable="true" data-photo-drag title="${t("detail.photos.reorderHint")}">⠿</span>
    <button class="photo-move" type="button" data-act="move-photo" data-id="${escapeHtml(entry.id)}" data-photo-id="${escapeHtml(photo.id)}" data-dir="1" aria-label="${t("detail.photos.moveBackward")}">→</button>
    </div>
    </div>`).join('')}<label class="photo-add">${t("detail.actions.addPhotos")}<input type="file" accept="${photoAccept}" multiple hidden data-bottle-photos="${entry.id}">
    </label><label class="photo-add photo-capture">${t('cutout.takePhoto')}<input type="file" accept="image/*" capture="environment" hidden data-bottle-photos="${escapeHtml(entry.id)}"></label>
    </div>
    <small class="muted">${t("detail.statistics.photoCount", {count:(entry.photos || []).length})}</small>
    <section class="bottle-documents" aria-label="${t("detail.sections.attachments")}">
    <h4>${t("detail.statistics.attachmentCount", {count:(entry.files || []).length}).replace("&", "&amp;")}</h4>
    ${(entry.files || []).length ? `<ul class="document-list">${entry.files.map(file => `<li>
    <a href="/api/bottles/${encodeURIComponent(entry.id)}/files/${encodeURIComponent(file.id)}" download="${escapeHtml(file.name)}" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</a>
    <span class="muted document-size">${formatFileSize(file.size)}</span>
    <button class="btn small danger" type="button" data-act="delete-file" data-id="${escapeHtml(entry.id)}" data-file-id="${escapeHtml(file.id)}" aria-label="${t("detail.documents.deleteNamed",{name:escapeHtml(file.name)})}">${deleteIcon}<span>${t("common.actions.delete")}</span></button>
    </li>`).join('')}</ul>` : `<p class="hint">${t("detail.empty.noAttachments")}</p>`}
    <label class="document-add">${t("detail.actions.addAttachments")}
    <input type="file" accept="${fileAccept}" multiple data-bottle-files="${escapeHtml(entry.id)}">
    </label>
    </section>
    </div>
    <div class="actions">
    <button class="btn small" data-act="warehouse-assign" data-id="${escapeHtml(entry.id)}">${t("detail.fields.storageLocation")}</button>
    <button class="btn small" data-act="edit-bottle" data-id="${entry.id}">${editIcon}<span>${t("common.actions.edit")}</span></button>
    <button class="btn small danger" data-act="delete-bottle" data-id="${entry.id}">${deleteIcon}<span>${t("common.actions.delete")}</span></button>
    </div>
    </div>`).join('');
        shell(`<button class="inline-link" data-act="back">${t("detail.navigation.backToCollection")}</button>
    <div class="section" style="margin-top:18px">
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
    <div class="two-col">
    <div>
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
    <div class="section">
    <div class="section-head">
    <h3>${t("detail.statistics.bottleAndSampleCount", {count:physicalBottles.length})}</h3>
    <button class="btn primary" data-act="add-bottle">${t("detail.actions.addAnotherBottle")}</button>
    </div>
    <div class="panel">${list || `<p class="muted">${t("detail.empty.noPhysicalBottles")}</p>`}</div>
    </div>`);
        attachPhotoSorting(action);
        queryAll('[data-bottle-files]').forEach(el => el.addEventListener('change', async (ev) => {
            const selected = [...ev.target.files];
            if (!selected.length) return;
            await action(async () => {
                const count = await uploadFiles(el.dataset.bottleFiles, selected);
                toast(t("detail.notifications.filesSaved", {count}));
            });
        }));
        queryAll('[data-bottle-photos]').forEach(el => el.addEventListener('change', async (ev) => {
            const files = [...ev.target.files];
            if (!files.length) {
                return;
            }
            await action(async () => {
                await uploadPhotos(el.dataset.bottlePhotos, files);
                toast(t("detail.notifications.photosSaved", {count:files.length}));
            });
        }));
    }
    return detail;
}
