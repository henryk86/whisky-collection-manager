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
 * @param {((element: Element, content: *) => void)=} mountContent Content mount boundary.
 * @param {{label: string, run: () => (void|Promise<void>) }=} followUp Optional one-shot action for a success notification.
 */
export function toast(message, error = false, mountContent = replaceContent, followUp) {
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
  } else if (followUp) {
    el.classList.add('toast-with-action');
    const text = document.createElement('span');
    text.className = 'toast-message';
    text.setAttribute('role', 'status');
    text.textContent = message;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'toast-action';
    button.textContent = followUp.label;
    button.addEventListener('click', async () => {
      if (button.disabled) return;
      button.disabled = true;
      el.remove();
      try {await followUp.run();}
      catch (err) {toast(err.message, true);}
    });
    el.append(text, button);
  } else {
    // Preserve the existing success notification markup and behavior.
    el.textContent = message;
  }

  document.body.append(el);
  setTimeout(() => el.remove(), followUp && !error ? 10000 : 4600);
}
