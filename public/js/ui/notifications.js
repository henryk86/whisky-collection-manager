import { query } from './dom.js';
export function toast(message, error = false) {
    query('.toast')?.remove();
    const el = document.createElement('div');
    el.className = 'toast' + (error ? ' error' : '');
    el.textContent = message;
    document.body.append(el);
    setTimeout(() => el.remove(), 4600);
}
