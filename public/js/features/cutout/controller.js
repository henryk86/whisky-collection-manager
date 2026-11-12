import { t } from '../../i18n/index.js';
import { escapeHtml } from '../../ui/dom.js';
import { imageUrl } from '../../ui/format.js';
import { request } from '../../api.js';
import { toast } from '../../ui/notifications.js';
import { cutoutImage } from './image.js';

/** The preview is ephemeral until the user confirms it. Modal closure never writes data. */
export function createCutoutController({ state, showModal, closeModal, action }) {
    let selected;
    let preview;
    let busy = false;
    let token = 0;
    const getPhoto = (bottleId, photoId) => state.collection?.bottlings
        .flatMap(bottling => bottling.bottles || [])
        .find(bottle => bottle.id === bottleId)?.photos?.find(photo => photo.id === photoId);
    const root = () => document.querySelector('[data-cutout-workspace]');

    function showStatus(key, error = false) {
        const label = root()?.querySelector('[data-cutout-status]');
        if (label) { label.textContent = t(key); label.dataset.error = error ? 'true' : 'false'; }
    }

    function renderResult(photo) {
        const element = root();
        if (!element) return;
        const result = element.querySelector('[data-cutout-preview]');
        const location = preview || (photo?.cutout ? imageUrl(photo.cutout.path) : '');
        if (location) { result.src = location; result.hidden = false; }
        const save = element.querySelector('[data-act="cutout-save"]');
        if (save) save.disabled = !preview || busy;
    }

    function showRetry(visible) {
        const element = root();
        if (!element) return;
        const retry = element.querySelector('[data-act="cutout-generate"]');
        if (!visible) { retry?.remove(); return; }
        if (retry) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn';
        button.dataset.act = 'cutout-generate';
        button.textContent = t('cutout.retry');
        element.querySelector('.cutout-actions')?.prepend(button);
    }

    function open(button) {
        const bottleId = button?.dataset.id;
        const photoId = button?.dataset.photoId;
        const photo = getPhoto(bottleId, photoId);
        if (!photo) return;
        selected = { bottleId, photoId };
        preview = null;
        busy = false;
        token++;
        const original = imageUrl(photo.path);
        showModal(t('cutout.title'), `<div class="cutout-workspace" data-cutout-workspace>
            <p class="hint">${t('cutout.hint')}</p>
            <div class="cutout-compare">
                <figure><div class="cutout-image-frame"><img src="${escapeHtml(original)}" alt="${t('cutout.original')}" loading="eager"></div><figcaption>${t('cutout.original')}</figcaption></figure>
                <figure><div class="cutout-image-frame cutout-checker"><img data-cutout-preview alt="${t('cutout.result')}" hidden></div><figcaption>${t('cutout.result')}</figcaption></figure>
            </div>
            <p class="cutout-status" data-cutout-status role="status" aria-live="polite"></p>
            <div class="actions cutout-actions">
                <button class="btn primary" type="button" data-act="cutout-save" disabled>${t('cutout.save')}</button>
                ${photo.cutout ? `<button class="btn" type="button" data-act="cutout-toggle" data-selected="${photo.cutout.selected}">${photo.cutout.selected ? t('cutout.showOriginal') : t('cutout.showCutout')}</button>
                <button class="btn danger" type="button" data-act="cutout-remove">${t('cutout.remove')}</button>` : ''}
                <button class="btn" type="button" data-act="close-modal">${t('common.actions.cancel')}</button>
            </div>
        </div>`, true, Boolean(state.modal));
        renderResult(photo);
        // For an existing cutout, show it first without re-running the model.
        if (!photo.cutout) void generate();
    }

    async function generate() {
        if (!selected || busy || !root()) return;
        const photo = getPhoto(selected.bottleId, selected.photoId);
        if (!photo) return;
        busy = true;
        const generation = token;
        showRetry(false);
        showStatus('cutout.loading');
        try {
            const data = await cutoutImage(imageUrl(photo.path), phase => {
                if (generation === token && root()) showStatus(`cutout.${phase}`);
            });
            if (generation !== token || !root()) return;
            preview = data;
            showStatus('cutout.ready');
            renderResult(photo);
        } catch (error) {
            if (generation !== token || !root()) return;
            showStatus('cutout.failed', true);
            showRetry(true);
            toast(`${t('cutout.failed')}: ${error.message}`, true);
        } finally {
            if (generation === token) {
                busy = false;
                if (root()) renderResult(photo);
            }
        }
    }

    const endpoint = () => `/api/bottles/${encodeURIComponent(selected.bottleId)}/photos/${encodeURIComponent(selected.photoId)}/cutout`;
    async function save() {
        if (!selected || !preview || busy) return;
        const data = await action(() => request(endpoint(), { method: 'PUT', body: JSON.stringify({ image: preview }) }));
        if (data) { token++; closeModal(true); toast(t('cutout.saved')); }
    }
    async function toggle() {
        if (!selected || busy) return;
        const photo = getPhoto(selected.bottleId, selected.photoId);
        if (!photo?.cutout) return;
        const data = await action(() => request(endpoint(), { method: 'PATCH', body: JSON.stringify({ selected: !photo.cutout.selected }) }));
        if (data) { token++; closeModal(true); }
    }
    async function remove() {
        if (!selected || busy) return;
        const data = await action(() => request(endpoint(), { method: 'DELETE' }));
        if (data) { token++; closeModal(true); toast(t('cutout.removed')); }
    }
    return { open, generate, save, toggle, remove };
}
