import { escapeHtml } from './dom.js';

/** Shared action button. `icon` is trusted application-rendered SVG; labels,
 * action identifiers and custom class names are escaped before interpolation.
 * Existing `.btn`, `.primary`, `.danger` remain supported for older views. */
export function actionButton({ label = '', action = '', variant = 'secondary', size = 'default',
    type = 'button', icon = '', iconOnly = false, disabled = false, loading = false,
    className = '', attributes = '' } = {}) {
    const variants = { primary:'primary', secondary:'', destructive:'danger', text:'ds-button--text', icon:'ds-button--icon' };
    if (!Object.hasOwn(variants, variant)) throw new RangeError('Invalid button variant');
    if (!['default','small','large'].includes(size)) throw new RangeError('Invalid button size');
    if (!['button','submit','reset'].includes(type)) throw new RangeError('Invalid button type');
    const safe = escapeHtml(String(label));
    const classes = ['btn','ds-button',variants[variant],size === 'small' ? 'small' : '',
        size === 'large' ? 'ds-button--large' : '',iconOnly || variant === 'icon' ? 'ds-button--icon' : '', className].filter(Boolean).join(' ');
    // attributes is app-owned static HTML only; never pass input/user data.
    return `<button class="${escapeHtml(classes)}" type="${type}"${action ? ` data-act="${escapeHtml(action)}"` : ''}${iconOnly ? ` aria-label="${safe}"` : ''}${disabled || loading ? ' disabled' : ''}${loading ? ' aria-busy="true"' : ''}${attributes ? ` ${attributes}` : ''}>${icon}${iconOnly ? '' : safe}</button>`;
}
