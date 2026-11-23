import {query} from './dom.js';
import {t} from '../i18n/index.js';

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
    close.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
    close.addEventListener('click', () => el.remove());
    el.append(close);
  } else {
    // Preserve the existing success notification markup and behavior.
    el.textContent = message;
  }

  document.body.append(el);
  setTimeout(() => el.remove(), 4600);
}
