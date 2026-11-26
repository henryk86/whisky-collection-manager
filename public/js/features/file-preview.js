import {t} from '../i18n/index.js';
import {modalFooter} from '../ui/modal-layout.js';
import {query} from '../ui/dom.js';
import {httpResponseError} from '../api.js';
import {loadTemplates} from '../ui/templates.js';

const renderTemplate = await loadTemplates('dialogs/file-preview.html');


/**
 * Browsers can preview these file types without uploading data to an external
 * service.
 *
 * @param {string} name Name of the item.
 * @return {!Object} Structured result for the caller.
 */
export function documentPreviewKind(name) {
  const ext = String(name || '').split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return {kind: 'pdf', type: 'application/pdf'};
  const images = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
  };
  if (Object.hasOwn(images, ext)) return {kind: 'image', type: images[ext]};
  if (['txt', 'csv', 'eml'].includes(ext)) return {kind: 'text', type: 'text/plain'};
  return {kind: 'unsupported', type: null};
}

/**
 * Preview binary attachments from the existing authenticated download
 * endpoint. Object URLs are revoked when the application closes the modal.
 *
 * @param {!Object} options Optional configuration for the operation.
 * @return {!Object} Structured result for the caller.
 */
export function createFilePreview({modal, state}) {
  let blobUrl = null;
  let sequence = 0;
  /**
   * Performs the close lifecycle action.
   */
  function close() {
    sequence++;
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    blobUrl = null;
  }

  /**
   * Controls the file preview state.
   *
   * @param {*} button Button used by this operation.
   */
  async function open(button) {
    close();
    const token = sequence;
    const bottleId = button.dataset.id;
    const fileId = button.dataset.fileId;
    const name = button.dataset.fileName;
    const url = `/api/bottles/${encodeURIComponent(bottleId)}/files/${encodeURIComponent(fileId)}`;
    const preview = documentPreviewKind(name);
    modal.showModal(
      name,
      renderTemplate('documentPreviewStage', {
        t: t(preview.kind === 'unsupported' ? 'detail.documents.previewUnavailable' : 'detail.documents.previewLoading'),
        modalFooter: modalFooter(
          renderTemplate('primaryButton', {
            url: url,
            name: name,
            download: t('detail.documents.download'),
          }),
          {className: 'document-preview-actions'}
        ),
      }),
      true
    );
    const shownModal = state.modal;
    if (preview.kind === 'unsupported') return;
    if (preview.kind === 'pdf') {
      // A same-origin PDF endpoint works even when the active CSP does not
      // allow blob: frames.
      const stage = query('#modal-root .document-preview-stage');
      if (!stage || state.modal !== shownModal) return;
      const frame = document.createElement('iframe');
      frame.className = 'document-preview-pdf';
      frame.title = name;
      // Native PDF viewers have their own sandbox. A sandboxed iframe can
      // prevent Chrome from loading its built-in PDF viewer entirely.
      frame.src = `${url}/preview`;
      stage.replaceChildren(frame);
      return;
    }
    try {
      const response = await fetch(url, {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!response.ok) {
        if (response.status === 401) window.dispatchEvent(new Event('wcm:auth-required'));
        let data = null;
        if (response.headers.get('content-type')?.includes('json')) {
          try {
            data = await response.json();
          } catch { /* A missing body is handled below. */}
        }
        throw httpResponseError(response.status, data);
      }
      const blob = await response.blob();
      if (token !== sequence || state.modal !== shownModal) return;
      const stage = query('#modal-root .document-preview-stage');
      if (!stage) return;
      stage.replaceChildren();
      if (preview.kind === 'text') {
        // Display untrusted text as textContent, never as HTML.
        const pre = document.createElement('pre');
        pre.className = 'document-preview-text';
        pre.textContent = await blob.slice(0, 256 * 1024).text();
        if (token !== sequence || state.modal !== shownModal) return;
        stage.append(pre);
        if (blob.size > 256 * 1024) {
          const note = document.createElement('p');
          note.className = 'hint';
          note.textContent = t('detail.documents.previewTruncated');
          stage.append(note);
        }
      } else {
        blobUrl = URL.createObjectURL(new Blob([blob], {type: preview.type}));
        const img = document.createElement('img');
        img.className = 'document-preview-image';
        img.alt = name;
        img.src = blobUrl;
        img.addEventListener('error', () => {
          stage.replaceChildren();
          const notice = document.createElement('p');
          notice.className = 'hint';
          notice.textContent = t('detail.documents.previewUnavailable');
          stage.append(notice);
        }, {once: true});
        stage.append(img);
      }
    } catch (error) {
      if (token !== sequence || state.modal !== shownModal) return;
      const stage = query('#modal-root .document-preview-stage');
      if (stage) {
        stage.textContent = '';
        const note = document.createElement('p');
        note.className = 'hint';
        note.textContent = error.message || t('detail.documents.previewFailed');
        stage.append(note);
      }
    }
  }
  return {open, close};
}
