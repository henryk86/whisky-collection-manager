export const escapeHtml = v => String(v ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));
export const query = (sel, from = document) => from.querySelector(sel);
export const queryAll = (sel, from = document) => [...from.querySelectorAll(sel)];
