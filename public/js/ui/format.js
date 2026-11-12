import { currentLanguage } from '../i18n/index.js';
import { escapeHtml } from './dom.js';
export const imageUrl = p => p ? `/${encodeURI(p)}` : '';
export const formatValue = n => n == null || n === '' ? '–' : escapeHtml(n);
export const formatDate = val => val ? new Date(val).toLocaleDateString(currentLanguage()) : '–';
