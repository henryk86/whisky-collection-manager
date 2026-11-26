import {replaceContent} from './dom-renderer.js';
import {query} from './dom.js';
import {t} from '../i18n/index.js';
import {loadTemplates} from './templates.js';

const renderTemplate = await loadTemplates('components/notifications.html');


/**
 * Shows a transient status notification in the application shell.
 *
 * @param {*} message Notification text or render content to display temporarily.
 * @param {boolean=} error Whether the notification reports an error.
 * @param {function(!Element, *): void=} mountContent Content mount boundary.
 */
export function toast(message, error = false, mountContent = replaceContent) {
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
    mountContent(close, renderTemplate('toastSvg'));
    close.addEventListener('click', () => el.remove());
    el.append(close);
  } else {
    // Preserve the existing success notification markup and behavior.
    el.textContent = message;
  }

  document.body.append(el);
  setTimeout(() => el.remove(), 4600);
}
