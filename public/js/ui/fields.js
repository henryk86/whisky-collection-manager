import { escapeHtml } from './dom.js';
export const textInput = (label, name, value = '', options = {}) => `<label class="form-field ${options.full ? 'full' : ''}">${label}<input ${options.required ? 'required' : ''} name="${name}" type="${options.type || 'text'}" ${options.step ? `step="${options.step}"` : ''} value="${escapeHtml(value ?? '')}" ${options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : ''}>
    </label>`;
export const selectInput = (label, name, options, value = '') => `<label class="form-field">${label}<select name="${name}">${options.map(([v, t]) => `<option value="${escapeHtml(v)}" ${String(v) === String(value ?? '') ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('')}</select>
    </label>`;
export const areaInput = (label, name, value = '') => `<label class="form-field full">${label}<textarea name="${name}">${escapeHtml(value)}</textarea>
    </label>`;
