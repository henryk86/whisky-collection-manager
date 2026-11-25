import {replaceContent} from './dom-renderer.js';
import {query} from './dom.js';
import {t} from '../i18n/index.js';
import {loadTemplates} from './templates.js';

const renderTemplate = await loadTemplates(new URL('./templates/notifications.html', import.meta.url));


/**
 * Shows a transient status notification in the application shell.
 *
 * @param {*} message Message used by this operation.
 * @param {boolean=} error Error being handled.
 */
export function toast(message, error = false) {
  query('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast' + (error ? ' error' : '');
  if (error) {
    el.setAttribute('role', 'alert');
    const text = document.createElement('span');
    text.className = 'toast-message';
    text.textContent = message;
    el.append(text);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'toast-close';
    close.setAttribute('aria-label', t('common.actions.close'));
    close.title = t('common.actions.close');
    replaceContent(close, renderTemplate('toastSvg'));
    close.addEventListener('click', () => el.remove());
    el.append(close);
  } else {
    // Preserve the existing success notification markup and behavior.
    el.textContent = message;
  }

  document.body.append(el);
  setTimeout(() => el.remove(), 4600);
}
