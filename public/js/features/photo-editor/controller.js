import {t} from '../../i18n/index.js';
import {escapeHtml} from '../../ui/dom.js';
import {imageUrl} from '../../ui/format.js';
import {request} from '../../api.js';
import {toast} from '../../ui/notifications.js';
import {PHOTO_ADJUSTMENT_GROUPS, EMPTY_PHOTO_ADJUSTMENTS,
    adjustPhotoPixels, autoPhotoAdjustments, validatePhotoAdjustments,
    resetPhotoAdjustmentGroup, whiteBalanceFromArea} from './adjustments.js';
import {basePhotoPath, editorPhotoSourceSettings} from '../../domain/photo-images.js';
import {cutoutImage} from '../cutout/image.js';
import {MIN_PREVIEW_ZOOM, MAX_PREVIEW_ZOOM, clampPreviewZoom, zoomAroundPoint, constrainPreviewPan} from './preview-zoom.js';
import {DEFAULT_MASK_BRUSH_SIZE, paintMaskSegment, applyMaskStrokes} from './mask-brush.js';

const MAX_PREVIEW_SIDE = 1050;
const MAX_EXPORT_SIDE = 4096;
const MAX_IMAGE_BYTES = 9_400_000; // Allow room for JSON/base64 request overhead.
const root = () => document.querySelector('[data-photo-editor]');
const resetIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11a9 9 0 1 1 2.7 6.5"/><path d="M3 4v7h7"/></svg>';
const pipetteIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><g transform="rotate(43 12 12)"><rect x="9.5" y="1.5" width="5" height="5" rx="2.4"/><path d="M9 6.5h6v2.5H9z"/><path d="M10 9v8l2 5 2-5V9"/><path d="M11 13h2"/></g></svg>';
const formValue = value => Number(value).toLocaleString('de-DE', {maximumFractionDigits: 2});
const canvasFromImage = (image, maxSide) => {
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d', {willReadFrequently: true});
    if (!context) throw Error(t('photoEditor.error'));
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
};
const imageDataFromCanvas = canvas => canvas.getContext('2d', {willReadFrequently: true})
    .getImageData(0, 0, canvas.width, canvas.height);
const blobFromCanvas = (canvas, quality = .97) => new Promise((resolve, reject) =>
    canvas.toBlob(blob => blob ? resolve(blob) : reject(Error(t('photoEditor.error'))), 'image/webp', quality));
const blobAsDataUrl = blob => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(Error(t('photoEditor.error')));
    reader.readAsDataURL(blob);
});

/** All edits are previewed against the original unedited source, never cumulatively. */
export function createPhotoEditor({state, showModal, closeModal, action}) {
    let selection = null;
    let image = null;
    let sourceData = null;
    let pendingCutout = null;
    let maskBaseData = null; // The unmodified transparent base for undo and restore.
    let maskStrokes = []; // Normalized to image coordinates, independent of preview zoom.
    let brushMode = null;
    let brushSize = DEFAULT_MASK_BRUSH_SIZE;
    let activeBrush = null;
    let values = {...EMPTY_PHOTO_ADJUSTMENTS};
    // Preview source is intentionally local to this dialog. Neither a source switch
    // nor a slider change touches the collection until Save is pressed.
    let previewCutout = false;
    let sourceValues = {original:{...EMPTY_PHOTO_ADJUSTMENTS},cutout:{...EMPTY_PHOTO_ADJUSTMENTS}};
    let savedSourceValues = {original:{...EMPTY_PHOTO_ADJUSTMENTS},cutout:{...EMPTY_PHOTO_ADJUSTMENTS}};
    let cutoutMaskStrokes = [];
    let showingBefore = false;
    let originalPreviewData = null; // Before/after for a cutout always shows the complete original.
    let activeTab = 'adjustments';
    let whitePicking = false;
    let pickStart = null;
    let busy = false;
    let renderId = 0;
    let generation = 0;
    let viewport = {zoom: 1, x: 0, y: 0};
    const panPointers = new Map();
    let panStart = null;
    let pinchStart = null;
    const findPhoto = (bottleId, photoId) => state.collection?.bottlings
        .flatMap(bottling => bottling.bottles || [])
        .find(bottle => bottle.id === bottleId)?.photos?.find(photo => photo.id === photoId);
    const endpoint = () => `/api/bottles/${encodeURIComponent(selection.bottleId)}/photos/${encodeURIComponent(selection.photoId)}/adjustments`;
    const sliderHtml = ({key, min, max, step}) => `<label class="photo-editor-slider">
        <span>${escapeHtml(t(`photoEditor.${key}`))} <output data-photo-output="${key}">0</output></span>
        <input type="range" data-photo-slider="${key}" min="${min}" max="${max}" step="${step}" value="0" disabled>
    </label>`;

    function viewportSize() {
        const canvas = root()?.querySelector('[data-photo-editor-preview]');
        return {width: canvas?.clientWidth || 1, height: canvas?.clientHeight || 1};
    }
    function updateViewport() {
        const host = root();
        if (!host) return;
        const canvas = host.querySelector('[data-photo-editor-preview]');
        if (!canvas) return;
        viewport = constrainPreviewPan(viewport, viewportSize());
        canvas.style.transform = `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`;
        host.querySelector('[data-photo-editor-zoom-level]').textContent = `${Math.round(viewport.zoom * 100)} %`;
        host.querySelector('[data-act="photo-editor-zoom-out"]').disabled = viewport.zoom <= MIN_PREVIEW_ZOOM;
        host.querySelector('[data-act="photo-editor-zoom-in"]').disabled = viewport.zoom >= MAX_PREVIEW_ZOOM;
        host.querySelector('[data-act="photo-editor-zoom-reset"]').disabled = viewport.zoom === MIN_PREVIEW_ZOOM;
        host.querySelector('.photo-editor-image').classList.toggle('is-zoomed', viewport.zoom > MIN_PREVIEW_ZOOM);
    }
    function zoom(direction, pointer = null) {
        if (!root() || !sourceData || busy) return;
        const size = viewportSize();
        viewport = zoomAroundPoint(viewport, direction === 0 ? 1 : clampPreviewZoom(viewport.zoom * direction),
            pointer || {x:size.width/2,y:size.height/2},size);
        updateViewport();
    }
    function attachViewport(canvas) {
        const stage = canvas.closest('.photo-editor-image');
        stage.addEventListener('wheel', event => {
            if (whitePicking || !sourceData || busy) return;
            event.preventDefault();
            // Canvas coordinates must be relative to its untransformed layout box.
            const stageRect = stage.getBoundingClientRect();
            const point = {x:event.clientX - stageRect.left - stage.clientLeft - parseFloat(getComputedStyle(stage).paddingLeft || 0),
                y:event.clientY - stageRect.top - stage.clientTop - parseFloat(getComputedStyle(stage).paddingTop || 0)};
            zoom(event.deltaY < 0 ? 1.15 : 1/1.15, point);
        }, {passive:false});
        canvas.addEventListener('pointerdown', event => {
            if (whitePicking || brushMode || busy || !sourceData || viewport.zoom === 1 || !event.isPrimary && event.pointerType !== 'touch') return;
            if (event.pointerType === 'mouse' && event.button !== 0) return;
            event.preventDefault();
            panPointers.set(event.pointerId, {x:event.clientX,y:event.clientY});
            canvas.setPointerCapture?.(event.pointerId);
            if (panPointers.size === 1) {
                panStart = {x:event.clientX, y:event.clientY, viewport:{...viewport}};
                pinchStart = null;
            } else if (panPointers.size === 2) {
                const [a,b] = [...panPointers.values()];
                pinchStart = {distance:Math.hypot(b.x-a.x,b.y-a.y), zoom:viewport.zoom};
                panStart = null;
            }
        });
        canvas.addEventListener('pointermove', event => {
            if (!panPointers.has(event.pointerId) || whitePicking) return;
            panPointers.set(event.pointerId, {x:event.clientX,y:event.clientY});
            if (pinchStart && panPointers.size === 2) {
                const [a,b] = [...panPointers.values()];
                const stageRect = stage.getBoundingClientRect();
                const point = {x:(a.x+b.x)/2-stageRect.left-stage.clientLeft-parseFloat(getComputedStyle(stage).paddingLeft || 0),
                    y:(a.y+b.y)/2-stageRect.top-stage.clientTop-parseFloat(getComputedStyle(stage).paddingTop || 0)};
                // Finger distance is proportional to preview magnification.
                viewport = zoomAroundPoint(viewport, viewport.zoom * (Math.hypot(b.x-a.x,b.y-a.y) / Math.max(1,pinchStart.lastDistance || pinchStart.distance)), point, viewportSize());
                pinchStart.lastDistance = Math.hypot(b.x-a.x,b.y-a.y);
                updateViewport();
            } else if (panStart && panPointers.size === 1) {
                viewport = constrainPreviewPan({zoom:panStart.viewport.zoom,
                    x:panStart.viewport.x + event.clientX-panStart.x,
                    y:panStart.viewport.y + event.clientY-panStart.y}, viewportSize());
                updateViewport();
            }
        });
        const release = event => {
            if (!panPointers.delete(event.pointerId)) return;
            if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
            pinchStart = null;
            panStart = null;
            if (panPointers.size === 1) {
                const [position] = panPointers.values();
                panStart = {x:position.x,y:position.y,viewport:{...viewport}};
            }
        };
        canvas.addEventListener('pointerup', release);
        canvas.addEventListener('pointercancel', release);
    }
    function resetViewport() {
        viewport = {zoom:1,x:0,y:0};
        panPointers.clear(); panStart = null; pinchStart = null;
        if (root()) updateViewport();
    }

    function selectTab(tab) {
        if (tab !== 'adjustments' && tab !== 'cutout') return;
        activeTab = tab;
        if (tab !== 'adjustments') stopPicking();
        if (tab !== 'cutout') stopBrush();
        syncSliders();
    }

    function syncSliders() {
        const host = root();
        if (!host) return;
        for (const tab of host.querySelectorAll('[data-photo-editor-tab]')) {
            const selected = tab.dataset.photoEditorTab === activeTab;
            tab.setAttribute('aria-selected', String(selected));
            tab.tabIndex = selected ? 0 : -1;
        }
        for (const panel of host.querySelectorAll('[data-photo-editor-panel]'))
            panel.hidden = panel.dataset.photoEditorPanel !== activeTab;
        for (const input of host.querySelectorAll('[data-photo-slider]')) {
            const value = values[input.dataset.photoSlider];
            input.value = String(value);
            host.querySelector(`[data-photo-output="${input.dataset.photoSlider}"]`).textContent = formValue(value);
            input.disabled = busy || !sourceData;
        }
        for (const button of host.querySelectorAll('[data-photo-editor-ready]')) button.disabled = busy || !sourceData;
        const generateButton = host.querySelector('[data-act="photo-editor-cutout"]');
        if (generateButton) generateButton.disabled = busy || !sourceData;
        for (const button of host.querySelectorAll('[data-photo-editor-existing-cutout]')) {
            button.disabled = busy || Boolean(pendingCutout) || !sourceData;
            button.textContent = previewCutout ? t('cutout.showOriginal') : t('cutout.showCutout');
        }
        host.dataset.photoPreviewSource = previewCutout ? 'cutout' : 'original';
        const undoCutout = host.querySelector('[data-act="photo-editor-remove-cutout"]');
        if (undoCutout) {
            const photo = selection && findPhoto(selection.bottleId, selection.photoId);
            undoCutout.hidden = !pendingCutout && !photo?.cutout;
            undoCutout.disabled = busy;
        }
        const picker = host.querySelector('[data-act="photo-editor-pick-white"]');
        if (picker) picker.setAttribute('aria-pressed', String(whitePicking));
        const maskTools = host.querySelector('[data-photo-editor-mask-tools]');
        if (maskTools) {
            maskTools.hidden = !maskBaseData;
            for (const button of maskTools.querySelectorAll('[data-photo-brush-mode]')) {
                button.setAttribute('aria-pressed', String(brushMode === button.dataset.photoBrushMode));
                button.disabled = busy;
            }
            const undo = maskTools.querySelector('[data-act="photo-editor-brush-undo"]');
            if (undo) undo.disabled = busy || !maskStrokes.length;
            const size = maskTools.querySelector('[data-photo-brush-size]');
            if (size) { size.disabled = busy; size.value = String(brushSize); }
            maskTools.querySelector('[data-photo-brush-size-value]').textContent = `${brushSize} %`;
        }
        host.querySelector('.photo-editor-image')?.classList.toggle('is-brushing', Boolean(brushMode));
        host.querySelector('.photo-editor-image')?.classList.toggle('is-picking', whitePicking);
        const before = host.querySelector('[data-act="photo-editor-before"]');
        if (before) {
            before.setAttribute('aria-pressed', String(showingBefore));
            before.textContent = showingBefore ? t('photoEditor.after') : t('photoEditor.before');
        }
    }

    function stopPicking() {
        whitePicking = false;
        pickStart = null;
        const host = root();
        if (host) {
            host.querySelector('[data-photo-editor-selection]')?.setAttribute('hidden', '');
            host.querySelector('.photo-editor-image')?.classList.remove('is-picking');
        }
    }

    // The CSS canvas box can be larger than its rendered image (object-fit: contain).
    // Translate pointer positions through the actual rendered image rectangle.
    function imageGeometry(canvas) {
        const rect = canvas.getBoundingClientRect();
        const scale = Math.min(rect.width / sourceData.width, rect.height / sourceData.height);
        return {left: rect.left + (rect.width - sourceData.width*scale)/2,
            top: rect.top + (rect.height - sourceData.height*scale)/2,
            width: sourceData.width*scale, height: sourceData.height*scale, scale};
    }
    function imagePoint(canvas, event, clampToImage = false) {
        const frame = imageGeometry(canvas);
        const x = (event.clientX - frame.left) / frame.scale;
        const y = (event.clientY - frame.top) / frame.scale;
        if (!clampToImage && (x < 0 || y < 0 || x > sourceData.width || y > sourceData.height)) return null;
        return {x: Math.max(0, Math.min(sourceData.width, x)),
            y: Math.max(0, Math.min(sourceData.height, y))};
    }
    function markSelection(canvas, start, end) {
        const host = root();
        if (!host) return;
        const overlay = host.querySelector('[data-photo-editor-selection]');
        const parent = host.querySelector('.photo-editor-image').getBoundingClientRect();
        const frame = imageGeometry(canvas);
        overlay.style.left = `${frame.left - parent.left + Math.min(start.x,end.x)*frame.scale}px`;
        overlay.style.top = `${frame.top - parent.top + Math.min(start.y,end.y)*frame.scale}px`;
        overlay.style.width = `${Math.max(2, Math.abs(end.x-start.x)*frame.scale)}px`;
        overlay.style.height = `${Math.max(2, Math.abs(end.y-start.y)*frame.scale)}px`;
        overlay.removeAttribute('hidden');
    }
    function attachWhitePicker(canvas) {
        canvas.addEventListener('pointerdown', event => {
            if (!whitePicking || !sourceData || busy || !event.isPrimary || event.button !== 0) return;
            const point = imagePoint(canvas, event);
            if (!point) return;
            event.preventDefault();
            pickStart = {point, pointerId: event.pointerId};
            canvas.setPointerCapture?.(event.pointerId);
            markSelection(canvas, point, point);
        });
        canvas.addEventListener('pointermove', event => {
            if (!pickStart || pickStart.pointerId !== event.pointerId) return;
            markSelection(canvas, pickStart.point, imagePoint(canvas, event, true));
        });
        canvas.addEventListener('pointercancel', event => {
            if (pickStart?.pointerId === event.pointerId) {
                pickStart = null;
                root()?.querySelector('[data-photo-editor-selection]')?.setAttribute('hidden','');
            }
        });
        canvas.addEventListener('pointerup', event => {
            if (!pickStart || pickStart.pointerId !== event.pointerId || !root() || !sourceData) return;
            event.preventDefault();
            const start = pickStart.point;
            const end = imagePoint(canvas, event, true);
            pickStart = null;
            if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
            let x0 = Math.min(start.x,end.x), x1 = Math.max(start.x,end.x);
            let y0 = Math.min(start.y,end.y), y1 = Math.max(start.y,end.y);
            // A single tap/click samples a small neighborhood, not a noisy lone pixel.
            if (x1-x0 < 3 && y1-y0 < 3) {
                const radius = Math.max(3, Math.round(Math.min(sourceData.width,sourceData.height)*.012));
                x0 = start.x - radius; x1 = start.x + radius;
                y0 = start.y - radius; y1 = start.y + radius;
            }
            stopPicking();
            try {
                setValues(whiteBalanceFromArea(sourceData,
                    {x:x0,y:y0,width:x1-x0,height:y1-y0}, values));
                if (root()) root().querySelector('[data-photo-editor-message]').textContent = t('photoEditor.pickedWhite');
            } catch (_) {
                syncSliders();
                if (root()) root().querySelector('[data-photo-editor-message]').textContent = t('photoEditor.pickWhiteError');
            }
        });
    }

    function stopBrush() {
        brushMode = null;
        activeBrush = null;
        root()?.querySelector('[data-photo-editor-brush-cursor]')?.setAttribute('hidden','');
    }
    function refreshMaskPreview() {
        if (!maskBaseData) return;
        sourceData = applyMaskStrokes(maskBaseData, maskStrokes);
        showingBefore = false;
        schedulePreview();
        syncSliders();
    }
    function toggleBrush(mode) {
        if (!['erase','restore'].includes(mode) || busy || !maskBaseData || !root()) return;
        stopPicking();
        if (brushMode === mode) stopBrush();
        else {
            showingBefore = false; // Never paint on the uncut comparison view.
            schedulePreview();
            brushMode = mode;
            activeBrush = null;
        }
        syncSliders();
        root().querySelector('[data-photo-editor-message]').textContent = brushMode
            ? t(brushMode === 'erase' ? 'photoEditor.eraseHint' : 'photoEditor.restoreHint')
            : t('photoEditor.hint');
    }
    function undoBrush() {
        if (busy || activeBrush || !maskStrokes.length) return;
        maskStrokes.pop();
        refreshMaskPreview();
    }
    function brushPoint(canvas, event) {
        const point = imagePoint(canvas,event);
        return point ? {x:point.x / sourceData.width, y:point.y / sourceData.height} : null;
    }
    function updateBrushCursor(canvas, event) {
        const cursor = root()?.querySelector('[data-photo-editor-brush-cursor]');
        if (!cursor || !brushMode || !maskBaseData) return;
        const point = imagePoint(canvas,event);
        if (!point) { cursor.hidden = true; return; }
        const frame = imageGeometry(canvas);
        const stageRect = canvas.closest('.photo-editor-image').getBoundingClientRect();
        const diameter = Math.min(sourceData.width, sourceData.height) * brushSize/100 * frame.scale;
        cursor.style.width = `${diameter}px`;
        cursor.style.height = `${diameter}px`;
        cursor.style.left = `${frame.left - stageRect.left + point.x*frame.scale}px`;
        cursor.style.top = `${frame.top - stageRect.top + point.y*frame.scale}px`;
        cursor.hidden = false;
    }
    function attachMaskBrush(canvas) {
        canvas.addEventListener('pointerdown', event => {
            if (!brushMode || busy || !maskBaseData || !sourceData ||
                (event.pointerType === 'mouse' && event.button !== 0) || !event.isPrimary) return;
            const point = brushPoint(canvas,event);
            if (!point) return;
            event.preventDefault();
            activeBrush = {pointerId:event.pointerId, stroke:{mode:brushMode,size:brushSize,points:[point]}};
            maskStrokes.push(activeBrush.stroke);
            canvas.setPointerCapture?.(event.pointerId);
            paintMaskSegment(sourceData.data,maskBaseData.data,sourceData.width,sourceData.height,
                point,point,brushSize,brushMode);
            showingBefore = false;
            syncSliders();
            schedulePreview();
            updateBrushCursor(canvas,event);
        });
        canvas.addEventListener('pointermove', event => {
            if (!brushMode) return;
            updateBrushCursor(canvas,event);
            if (!activeBrush || activeBrush.pointerId !== event.pointerId || busy) return;
            const current = brushPoint(canvas,event);
            if (!current) return;
            const stroke = activeBrush.stroke;
            const previous = stroke.points[stroke.points.length-1];
            // Avoid very dense pointer samples on high refresh-rate mice.
            if (Math.hypot(current.x-previous.x,current.y-previous.y) < .0005) return;
            stroke.points.push(current);
            paintMaskSegment(sourceData.data,maskBaseData.data,sourceData.width,sourceData.height,
                previous,current,stroke.size,stroke.mode);
            schedulePreview();
        });
        const release = event => {
            if (!activeBrush || activeBrush.pointerId !== event.pointerId) return;
            if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
            if (event.type === 'pointercancel') {
                maskStrokes.pop();
                refreshMaskPreview();
            }
            activeBrush = null;
            syncSliders();
        };
        canvas.addEventListener('pointerup',release);
        canvas.addEventListener('pointercancel',release);
        canvas.addEventListener('pointerleave', () => {
            root()?.querySelector('[data-photo-editor-brush-cursor]')?.setAttribute('hidden','');
        });
    }

    function schedulePreview() {
        const thisGeneration = generation;
        if (renderId) cancelAnimationFrame(renderId);
        renderId = requestAnimationFrame(() => {
            renderId = 0;
            const host = root();
            if (!host || !sourceData || thisGeneration !== generation) return;
            const canvas = host.querySelector('[data-photo-editor-preview]');
            if (!canvas) return;
            // "Before" compares the entire editing result: when a background has
            // been removed, show the uncut original rather than only neutralizing
            // sliders on the already transparent image.
            const adjusted = showingBefore
                ? (previewCutout ? originalPreviewData || sourceData : sourceData)
                : adjustPhotoPixels(sourceData, values);
            if (canvas.width !== adjusted.width || canvas.height !== adjusted.height) {
                canvas.width = adjusted.width;
                canvas.height = adjusted.height;
            }
            canvas.getContext('2d', {willReadFrequently: true})
                .putImageData(new ImageData(adjusted.data, adjusted.width, adjusted.height), 0, 0);
        });
    }

    async function open(button) {
        const bottleId = button?.dataset.id;
        const photoId = button?.dataset.photoId;
        const photo = findPhoto(bottleId, photoId);
        if (!photo) return;
        const sourcePath = basePhotoPath(photo);
        selection = {bottleId, photoId, sourcePath};
        previewCutout = Boolean(photo.cutout?.selected);
        const {original:originalSettings, cutout:cutoutSettings} = editorPhotoSourceSettings(photo);
        sourceValues = {
            original:validatePhotoAdjustments(originalSettings || EMPTY_PHOTO_ADJUSTMENTS),
            cutout:validatePhotoAdjustments(cutoutSettings || EMPTY_PHOTO_ADJUSTMENTS)
        };
        savedSourceValues = {
            original:{...sourceValues.original}, cutout:{...sourceValues.cutout}
        };
        values = {...sourceValues[previewCutout ? 'cutout' : 'original']};
        cutoutMaskStrokes = [];
        sourceData = null;
        originalPreviewData = null;
        image = null;
        pendingCutout = null;
        maskBaseData = null; maskStrokes = []; brushMode = null; brushSize = DEFAULT_MASK_BRUSH_SIZE; activeBrush = null;
        busy = false;
        whitePicking = false;
        pickStart = null;
        showingBefore = false;
        activeTab = 'adjustments';
        viewport = {zoom:1,x:0,y:0};
        panPointers.clear(); panStart = null; pinchStart = null;
        generation++;
        const currentGeneration = generation;
        if (renderId) cancelAnimationFrame(renderId);
        showModal(t('photoEditor.title'), `<div class="photo-editor" data-photo-editor>
            <div class="photo-editor-layout">
                <div class="photo-editor-stage">
                    <div class="photo-editor-image cutout-checker">
                        <canvas data-photo-editor-preview role="img" aria-label="${escapeHtml(t('photoEditor.preview'))}"></canvas>
                        <div data-photo-editor-selection class="photo-editor-selection" hidden aria-hidden="true"></div>
                        <div data-photo-editor-brush-cursor class="photo-editor-brush-cursor" hidden aria-hidden="true"></div>
                        <div class="photo-editor-overlay">
                            <div class="photo-editor-zoom" role="group" aria-label="${escapeHtml(t('photoEditor.zoom'))}">
                                <button type="button" data-act="photo-editor-zoom-out" aria-label="${escapeHtml(t('photoEditor.zoomOut'))}" title="${escapeHtml(t('photoEditor.zoomOut'))}" disabled>−</button>
                                <button type="button" data-act="photo-editor-zoom-reset" aria-label="${escapeHtml(t('photoEditor.zoomReset'))}" title="${escapeHtml(t('photoEditor.zoomReset'))}" disabled><span data-photo-editor-zoom-level>100 %</span></button>
                                <button type="button" data-act="photo-editor-zoom-in" aria-label="${escapeHtml(t('photoEditor.zoomIn'))}" title="${escapeHtml(t('photoEditor.zoomIn'))}">+</button>
                            </div>
                            <div class="photo-editor-stage-actions">
                                <button type="button" class="btn small" data-act="photo-editor-before" data-photo-editor-ready disabled aria-pressed="false">${escapeHtml(t('photoEditor.before'))}</button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="photo-editor-controls">
                    <div class="photo-editor-tabs" role="tablist" aria-label="${escapeHtml(t('photoEditor.title'))}">
                        <button type="button" id="photo-editor-tab-adjustments" role="tab" data-photo-editor-tab="adjustments" data-act="photo-editor-tab" aria-controls="photo-editor-panel-adjustments" aria-selected="true">${escapeHtml(t('photoEditor.adjustmentsTab'))}</button>
                        <button type="button" id="photo-editor-tab-cutout" role="tab" data-photo-editor-tab="cutout" data-act="photo-editor-tab" aria-controls="photo-editor-panel-cutout" aria-selected="false">${escapeHtml(t('photoEditor.cutoutTab'))}</button>
                    </div>
                    <div class="photo-editor-tab-panel" id="photo-editor-panel-adjustments" role="tabpanel" aria-labelledby="photo-editor-tab-adjustments" data-photo-editor-panel="adjustments">
                    ${PHOTO_ADJUSTMENT_GROUPS.map(group => `<section class="photo-editor-group" aria-label="${escapeHtml(t(`photoEditor.${group.key}`))}">
                        <div class="photo-editor-group-header"><h3>${escapeHtml(t(`photoEditor.${group.key}`))}</h3>
                        <div class="photo-editor-group-tools">${group.key === 'color' ? `<button type="button" class="photo-editor-white-picker" data-act="photo-editor-pick-white" data-photo-editor-ready disabled aria-pressed="false" title="${escapeHtml(t('photoEditor.pickWhite'))}" aria-label="${escapeHtml(t('photoEditor.pickWhite'))}">${pipetteIcon}</button>` : ''}
                        <button type="button" class="photo-editor-group-reset" data-act="photo-editor-reset-group" data-photo-group="${group.key}" data-photo-editor-ready disabled title="${escapeHtml(t('photoEditor.resetGroup', {group: t(`photoEditor.${group.key}`)}))}" aria-label="${escapeHtml(t('photoEditor.resetGroup', {group: t(`photoEditor.${group.key}`)}))}">${resetIcon}</button></div></div>
                        ${group.sliders.map(sliderHtml).join('')}</section>`).join('')}
                    </div>
                    <div class="photo-editor-tab-panel" id="photo-editor-panel-cutout" role="tabpanel" aria-labelledby="photo-editor-tab-cutout" data-photo-editor-panel="cutout" hidden>
                        <div class="photo-editor-cutout-actions">
                            <button type="button" class="btn small" data-act="photo-editor-cutout" data-photo-editor-ready disabled>${escapeHtml(t(photo.cutout ? 'photoEditor.recutout' : 'cutout.title'))}</button>
                            ${photo.cutout ? `<button type="button" class="btn small" data-act="photo-editor-toggle-cutout" data-photo-editor-existing-cutout>${escapeHtml(photo.cutout.selected ? t('cutout.showOriginal') : t('cutout.showCutout'))}</button>` : ''}
                            <button type="button" class="btn small danger" data-act="photo-editor-remove-cutout" data-photo-editor-ready disabled hidden>${escapeHtml(t('cutout.remove'))}</button>
                        </div>
                    <div class="photo-editor-mask-tools" data-photo-editor-mask-tools hidden>
                        <div class="photo-editor-mask-buttons" role="group" aria-label="${escapeHtml(t('photoEditor.maskTools'))}">
                            <button type="button" class="btn small" data-photo-brush-mode="erase" data-act="photo-editor-brush-mode" aria-pressed="false">${escapeHtml(t('photoEditor.erase'))}</button>
                            <button type="button" class="btn small" data-photo-brush-mode="restore" data-act="photo-editor-brush-mode" aria-pressed="false">${escapeHtml(t('photoEditor.restore'))}</button>
                            <button type="button" class="btn small" data-act="photo-editor-brush-undo" disabled>${escapeHtml(t('photoEditor.brushUndo'))}</button>
                        </div>
                        <label class="photo-editor-mask-size">${escapeHtml(t('photoEditor.brushSize'))}
                            <input type="range" min="1" max="15" step="1" value="${DEFAULT_MASK_BRUSH_SIZE}" data-photo-brush-size>
                            <output data-photo-brush-size-value>${DEFAULT_MASK_BRUSH_SIZE} %</output>
                        </label>
                    </div>
                    </div>
                </div>
            </div>
            <p class="photo-editor-help" data-photo-editor-message role="status">${escapeHtml(t('photoEditor.loading'))}</p>
            <div class="photo-editor-actions">
                <button type="button" class="btn" data-act="photo-editor-auto" data-photo-editor-ready disabled>${escapeHtml(t('photoEditor.auto'))}</button>
                <button type="button" class="btn" data-act="photo-editor-reset" data-photo-editor-ready disabled>${escapeHtml(t('photoEditor.reset'))}</button>
                <span class="photo-editor-actions-spacer"></span>
                <button type="button" class="btn" data-act="close-modal">${escapeHtml(t('common.actions.cancel'))}</button>
                <button type="button" class="btn primary" data-act="photo-editor-save" data-photo-editor-ready disabled>${escapeHtml(t('common.actions.save'))}</button>
            </div>
        </div>`, true, Boolean(state.modal));
        const host = root();
        host.addEventListener('input', event => {
            if (event.target.matches('[data-photo-brush-size]')) {
                brushSize = Number(event.target.value);
                syncSliders();
                return;
            }
            const input = event.target.closest('[data-photo-slider]');
            if (!input || busy) return;
            values[input.dataset.photoSlider] = Number(input.value);
            sourceValues[previewCutout ? 'cutout' : 'original'] = {...values};
            showingBefore = false;
            stopPicking();
            syncSliders();
            schedulePreview();
        });
        host.addEventListener('keydown', event => {
            const tab = event.target.closest('[data-photo-editor-tab]');
            if (tab && ['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) {
                event.preventDefault();
                const next = event.key === 'Home' ? 'adjustments' : event.key === 'End' ? 'cutout' :
                    (tab.dataset.photoEditorTab === 'adjustments' ? 'cutout' : 'adjustments');
                selectTab(next);
                host.querySelector(`[data-photo-editor-tab="${next}"]`)?.focus();
                return;
            }
            if (event.key === 'Escape' && (whitePicking || brushMode)) {
                event.stopPropagation();
                stopPicking();
                stopBrush();
                syncSliders();
                host.querySelector('[data-photo-editor-message]').textContent = t('photoEditor.hint');
            }
        });
        attachWhitePicker(host.querySelector('[data-photo-editor-preview]'));
        attachMaskBrush(host.querySelector('[data-photo-editor-preview]'));
        attachViewport(host.querySelector('[data-photo-editor-preview]'));
        try {
            const loaded = new Image();
            loaded.decoding = 'async';
            loaded.crossOrigin = 'anonymous';
            loaded.src = imageUrl(sourcePath);
            if (typeof loaded.decode === 'function') await loaded.decode();
            else await new Promise((resolve, reject) => {
                loaded.onload = resolve;
                loaded.onerror = reject;
            });
            if (currentGeneration !== generation || !root()) return;
            image = loaded;
            const inputCanvas = canvasFromImage(image, MAX_PREVIEW_SIDE);
            sourceData = imageDataFromCanvas(inputCanvas);
            if (!previewCutout) originalPreviewData = sourceData;
            maskBaseData = photo.cutout?.selected ? imageDataFromCanvas(inputCanvas) : null;
            const preview = root().querySelector('[data-photo-editor-preview]');
            preview.width = inputCanvas.width;
            preview.height = inputCanvas.height;
            root().querySelector('[data-photo-editor-message]').textContent = t('photoEditor.hint');
            syncSliders();
            resetViewport();
            schedulePreview();

        } catch (error) {
            if (currentGeneration !== generation || !root()) return;
            root().querySelector('[data-photo-editor-message]').textContent = t('photoEditor.error');
            toast(error.message, true);
        }
    }

    function setValues(next) {
        if (!root() || busy || !sourceData) return;
        values = validatePhotoAdjustments(next);
        sourceValues[previewCutout ? 'cutout' : 'original'] = {...values};
        stopPicking();
        showingBefore = false;
        syncSliders();
        schedulePreview();
    }
    function reset() { setValues(EMPTY_PHOTO_ADJUSTMENTS); }
    function resetGroup(groupKey) {
        if (!PHOTO_ADJUSTMENT_GROUPS.some(group => group.key === groupKey)) return;
        setValues(resetPhotoAdjustmentGroup(values, groupKey));
    }
    function toggleWhitePicker() {
        if (!root() || busy || !sourceData) return;
        if (whitePicking) stopPicking();
        else {
            stopBrush();
            showingBefore = false; // Sample the image that will actually be edited.
            schedulePreview();
            whitePicking = true;
        }
        syncSliders();
        root().querySelector('[data-photo-editor-message]').textContent =
            whitePicking ? t('photoEditor.pickWhiteHint') : t('photoEditor.hint');
    }
    function auto() { if (sourceData) setValues(autoPhotoAdjustments(sourceData)); }
    async function before() {
        if (!root() || !sourceData || busy) return;
        if (showingBefore) {
            showingBefore = false;
            syncSliders();
            schedulePreview();
            return;
        }
        stopPicking();
        stopBrush();
        if (previewCutout && !originalPreviewData) {
            const photo = selection && findPhoto(selection.bottleId, selection.photoId);
            if (!photo) return;
            const thisGeneration = generation;
            busy = true;
            syncSliders();
            try {
                const original = new Image();
                original.decoding = 'async';
                original.crossOrigin = 'anonymous';
                original.src = imageUrl(photo.path);
                if (typeof original.decode === 'function') await original.decode();
                else await new Promise((resolve,reject) => {original.onload=resolve;original.onerror=reject;});
                if (generation !== thisGeneration || !root()) return;
                originalPreviewData = imageDataFromCanvas(canvasFromImage(original, MAX_PREVIEW_SIDE));
            } catch (error) {
                if (generation === thisGeneration && root()) toast(error.message,true);
                return;
            } finally {
                if (generation === thisGeneration) {
                    busy = false;
                    if (root()) syncSliders();
                }
            }
        }
        if (!root()) return;
        showingBefore = true;
        syncSliders();
        schedulePreview();
    }

    // Generate a new transparent cutout from the retained original. The segmentation
    // model sees the current corrections; the transparent output does NOT bake them.
    // This prevents double correction when adjusting a cutout later.
    async function cutout() {
        if (busy || !selection || !sourceData || !root()) return;
        const photo = findPhoto(selection.bottleId, selection.photoId);
        if (!photo) return;
        busy = true;
        stopPicking();
        syncSliders();
        const thisGeneration = generation;
        const message = root().querySelector('[data-photo-editor-message]');
        try {
            const originalUrl = imageUrl(photo.path);
            let segmentationUrl;
            if (Object.values(values).some(value => value !== 0)) {
                const original = new Image();
                original.decoding = 'async';
                original.crossOrigin = 'anonymous';
                original.src = originalUrl;
                await original.decode();
                const sourceCanvas = canvasFromImage(original, MAX_PREVIEW_SIDE);
                const corrected = adjustPhotoPixels(imageDataFromCanvas(sourceCanvas), values);
                sourceCanvas.getContext('2d').putImageData(new ImageData(corrected.data, corrected.width, corrected.height), 0, 0);
                segmentationUrl = sourceCanvas.toDataURL('image/png');
            }
            const cutoutData = await cutoutImage(originalUrl, phase => {
                if (generation === thisGeneration && root()) message.textContent = t(`cutout.${phase}`);
            }, {segmentationUrl});
            if (generation !== thisGeneration || !root()) return;
            const cutoutImageElement = new Image();
            cutoutImageElement.src = cutoutData;
            await cutoutImageElement.decode();
            if (generation !== thisGeneration || !root()) return;
            pendingCutout = cutoutData;
            // Retain the uncropped original for immediate before/after comparison.
            if (!previewCutout) originalPreviewData = sourceData;
            previewCutout = true;
            sourceValues.cutout = {...values};
            savedSourceValues.cutout = {...EMPTY_PHOTO_ADJUSTMENTS};
            cutoutMaskStrokes = [];
            maskStrokes = []; stopBrush();
            image = cutoutImageElement;
            const canvas = canvasFromImage(image, MAX_PREVIEW_SIDE);
            sourceData = imageDataFromCanvas(canvas);
            maskBaseData = imageDataFromCanvas(canvas);
            const preview = root().querySelector('[data-photo-editor-preview]');
            preview.width = canvas.width;
            preview.height = canvas.height;
            showingBefore = false;
            message.textContent = t('photoEditor.cutoutReady');
            resetViewport();
            schedulePreview();
        } catch (error) {
            if (generation === thisGeneration && root()) {
                message.textContent = t('cutout.failed');
                toast(`${t('cutout.failed')}: ${error.message}`, true);
            }
        } finally {
            if (generation === thisGeneration) {
                busy = false;
                if (root()) syncSliders();
            }
        }
    }
    async function toggleCutout() {
        const photo = selection && findPhoto(selection.bottleId, selection.photoId);
        if (!photo?.cutout || busy || pendingCutout || !root()) return;
        const next = !previewCutout;
        busy = true;
        stopPicking();
        stopBrush();
        if (previewCutout) cutoutMaskStrokes = maskStrokes.map(stroke => ({...stroke}));
        sourceValues[previewCutout ? 'cutout' : 'original'] = {...values};
        syncSliders();
        const thisGeneration = generation;
        try {
            const loaded = new Image();
            loaded.decoding = 'async';
            loaded.crossOrigin = 'anonymous';
            loaded.src = imageUrl(next ? photo.cutout.path : photo.path);
            if (typeof loaded.decode === 'function') await loaded.decode();
            else await new Promise((resolve,reject) => {loaded.onload = resolve; loaded.onerror = reject;});
            if (thisGeneration !== generation || !root()) return;
            const canvas = canvasFromImage(loaded, MAX_PREVIEW_SIDE);
            image = loaded;
            if (!next) originalPreviewData = imageDataFromCanvas(canvas);
            maskBaseData = next ? imageDataFromCanvas(canvas) : null;
            maskStrokes = next ? cutoutMaskStrokes.map(stroke => ({...stroke})) : [];
            sourceData = next && maskStrokes.length
                ? applyMaskStrokes(maskBaseData,maskStrokes) : imageDataFromCanvas(canvas);
            previewCutout = next;
            values = {...sourceValues[next ? 'cutout' : 'original']};
            const preview = root().querySelector('[data-photo-editor-preview]');
            preview.width = canvas.width;
            preview.height = canvas.height;
            showingBefore = false;
            root().querySelector('[data-photo-editor-message]').textContent = t('photoEditor.hint');
            resetViewport();
            schedulePreview();
        } catch (error) {
            if (thisGeneration === generation && root()) toast(error.message,true);
        } finally {
            if (thisGeneration === generation) {
                busy = false;
                if (root()) syncSliders();
            }
        }
    }
    async function removeCutout() {
        const photo = selection && findPhoto(selection.bottleId, selection.photoId);
        if (!photo || busy || !root()) return;
        if (pendingCutout) {
            busy = true;
            syncSliders();
            const thisGeneration = generation;
            try {
                const original = new Image();
                original.crossOrigin = 'anonymous';
                original.decoding = 'async';
                original.src = imageUrl(photo.path);
                await original.decode();
                if (thisGeneration !== generation || !root()) return;
                image = original;
                const canvas = canvasFromImage(original, MAX_PREVIEW_SIDE);
                sourceData = imageDataFromCanvas(canvas);
                const preview = root().querySelector('[data-photo-editor-preview]');
                preview.width = canvas.width;
                preview.height = canvas.height;
                pendingCutout = null;
                previewCutout = false;
                values = {...sourceValues.original};
                maskBaseData = null; maskStrokes = []; cutoutMaskStrokes = []; stopBrush();
                showingBefore = false;
                root().querySelector('[data-photo-editor-message]').textContent = t('cutout.removed');
                resetViewport();
                schedulePreview();
            } catch (error) {
                toast(error.message, true);
            } finally {
                busy = false;
                if (root()) syncSliders();
            }
            return;
        }
        if (!photo.cutout) return;
        const result = await action(() => request(`/api/bottles/${encodeURIComponent(selection.bottleId)}/photos/${encodeURIComponent(selection.photoId)}/cutout`,
            {method:'DELETE'}));
        if (result) {generation++; closeModal(true); toast(t('cutout.removed'));}
    }

    async function save() {
        if (busy || !sourceData || !image || !selection || !root()) return;
        busy = true;
        const thisGeneration = generation;
        syncSliders();
        const host = root();
        const message = host.querySelector('[data-photo-editor-message]');
        message.textContent = t('photoEditor.saving');
        try {
            const storedSettings = validatePhotoAdjustments(values);
            const photo = findPhoto(selection.bottleId, selection.photoId);
            const sourceKey = previewCutout ? 'cutout' : 'original';
            const savedSettings = savedSourceValues[sourceKey];
            const settingsChanged = Object.keys(storedSettings).some(key => storedSettings[key] !== savedSettings[key]);
            const selectedChanged = Boolean(photo?.cutout) && previewCutout !== photo.cutout.selected;
            const cutoutEndpoint = endpoint().replace(/\/adjustments$/, '/cutout');
            const selectForSave = () => request(cutoutEndpoint, {
                method:'PATCH', body:JSON.stringify({selected:previewCutout})
            });
            const commit = callback => action(async () => {
                // The API selects the image separately from its adjustments; synchronize
                // the source before saving an edited derivative of that source.
                if (selectedChanged) await selectForSave();
                return callback ? await callback() : {ok:true};
            });
            const savingCutout = Boolean(pendingCutout || (previewCutout && maskStrokes.length));
            // Merely showing a different variant is a preview-only operation.
            // Save commits that selection; unchanged settings must never trigger a
            // regeneration or deletion of an existing edited derivative.
            if (!savingCutout && !settingsChanged) {
                const result = selectedChanged ? await commit() : {ok:true};
                if (result && generation === thisGeneration) {generation++; closeModal(true); toast(t('photoEditor.saved'));}
                return;
            }
            if (!savingCutout && Object.values(storedSettings).every(value => value === 0)) {
                const result = await commit(() => request(endpoint(), {method:'DELETE'}));
                if (result && generation === thisGeneration) { generation++; closeModal(true); toast(t('photoEditor.saved')); }
                return;
            }
            // Export the current RAW base (original or new transparent cutout) once.
            // No correction gets baked into the saved transparent PNG.
            const hasEdits = Object.values(storedSettings).some(value => value !== 0);
            let cutoutCanvas;
            let cutoutDataUrl = pendingCutout;
            if (maskStrokes.length) {
                cutoutCanvas = canvasFromImage(image, MAX_EXPORT_SIDE);
                const masked = applyMaskStrokes(imageDataFromCanvas(cutoutCanvas), maskStrokes);
                cutoutCanvas.getContext('2d').putImageData(new ImageData(masked.data,masked.width,masked.height),0,0);
                cutoutDataUrl = cutoutCanvas.toDataURL('image/png');
                // Keep the PNG within the cutout endpoint's upload limit.
                while (cutoutDataUrl.length > 13000000 && Math.max(cutoutCanvas.width,cutoutCanvas.height) > 800) {
                    const smaller = document.createElement('canvas');
                    smaller.width = Math.round(cutoutCanvas.width*.8);
                    smaller.height = Math.round(cutoutCanvas.height*.8);
                    smaller.getContext('2d').drawImage(cutoutCanvas,0,0,smaller.width,smaller.height);
                    cutoutCanvas = smaller;
                    cutoutDataUrl = cutoutCanvas.toDataURL('image/png');
                }
                if (cutoutDataUrl.length > 13000000) throw Error(t('photoEditor.tooLarge'));
            }
            let imageDataUrl;
            if (hasEdits) {
                let canvas = cutoutCanvas || canvasFromImage(image, MAX_EXPORT_SIDE);
                const source = imageDataFromCanvas(canvas);
                const adjusted = adjustPhotoPixels(source, storedSettings);
                canvas.getContext('2d').putImageData(new ImageData(adjusted.data, adjusted.width, adjusted.height), 0, 0);
                let blob = await blobFromCanvas(canvas);
                // Preserve pixels: try modestly stronger compression before ever
                // reducing the actual export dimensions for the 10 MB upload limit.
                for (const quality of [.94, .9, .86]) {
                    if (blob.size <= MAX_IMAGE_BYTES) break;
                    blob = await blobFromCanvas(canvas, quality);
                }
                while (blob.size > MAX_IMAGE_BYTES && Math.max(canvas.width, canvas.height) > 800) {
                    const smaller = document.createElement('canvas');
                    smaller.width = Math.round(canvas.width * .8);
                    smaller.height = Math.round(canvas.height * .8);
                    smaller.getContext('2d').drawImage(canvas, 0, 0, smaller.width, smaller.height);
                    canvas = smaller;
                    blob = await blobFromCanvas(canvas, .9);
                }
                if (blob.size > MAX_IMAGE_BYTES) throw Error(t('photoEditor.tooLarge'));
                imageDataUrl = await blobAsDataUrl(blob);
            }
            if (generation !== thisGeneration || !root()) return;
            const payload = savingCutout
                ? {image: cutoutDataUrl, ...(hasEdits ? {adjustment:{image:imageDataUrl,settings:storedSettings}} : {})}
                : {image: imageDataUrl, settings: storedSettings};
            const target = savingCutout ? endpoint().replace(/\/adjustments$/, '/cutout') : endpoint();
            const result = await commit(() => request(target, {
                method: 'PUT', body: JSON.stringify(payload)
            }));
            if (result && generation === thisGeneration) {
                generation++;
                closeModal(true);
                toast(t('photoEditor.saved'));
            }
        } catch (error) {
            if (generation === thisGeneration && root()) {
                toast(error.message, true);
                message.textContent = error.message;
            }
        } finally {
            if (generation === thisGeneration) {
                busy = false;
                if (root()) syncSliders();
            }
        }
    }
    return {open, selectTab, before, auto, reset, resetGroup, toggleWhitePicker, toggleBrush, undoBrush, zoom, cutout, toggleCutout, removeCutout, save};
}
