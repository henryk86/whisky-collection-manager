import { t } from '../i18n/index.js';
// Minimal client-side router. Query-based routes also work on direct reloads
// because the local Node server already serves / for all query strings.
export function parseRoute(search) {
    const params = new URLSearchParams(search);
    const bottlingId = params.get('bottling');
    if (bottlingId && /^[a-zA-Z0-9-]{1,100}$/.test(bottlingId)) {
        return {
            page: 'detail', selected: bottlingId
        };
    }
    if (params.get('view') === 'analysis') {
        const allowed = new Set(['overview', 'inventory', 'origins', 'profile', 'finance', 'timeline', 'quality']);
        const section = params.get('section') || 'overview';
        return { page: 'analytics', selected: allowed.has(section) ? section : 'overview', filters: {
            distillery: params.get('distillery') || 'all', country: params.get('country') || 'all',
            volumeType: ['all', 'standard', 'sample'].includes(params.get('volumeType')) ? params.get('volumeType') : 'all',
            status: ['all', 'closed', 'open', 'empty'].includes(params.get('status')) ? params.get('status') : 'all',
        } };
    }
    if (params.get('view') === 'warehouse') {
        const section = params.get('section');
        const id = value => value && /^[a-zA-Z0-9-]{1,100}$/.test(value) ? value : null;
        return { page: 'warehouse', selected: ['overview', 'rooms', 'shelves', 'find'].includes(section) ? section : 'overview',
            roomId: id(params.get('room')), furnitureId: id(params.get('furniture')) };
    }
    if (params.get('view') === 'map') {
        const focusBottling = params.get('focusBottling');
        return { page: 'map', selected: focusBottling && /^[a-zA-Z0-9-]{1,100}$/.test(focusBottling) ? focusBottling : null };
    }
    if (params.get('view') === 'settings') {
        return {
            page: 'settings', selected: null
        };
    }
    return {
        page: 'home', selected: null
    };
}
export function routeUrl(page, selected, filters = {}) {
    if (page === 'detail') {
        if (!selected || !/^[a-zA-Z0-9-]{1,100}$/.test(selected)) {
            throw new Error(t("navigation.errors.invalidBottlingId"));
        }
        return '/?bottling=' + encodeURIComponent(selected);
    }
    if (page === 'analytics') {
        const section = ['overview', 'inventory', 'origins', 'profile', 'finance', 'timeline', 'quality'].includes(selected) ? selected : 'overview';
        const params = new URLSearchParams({ view: 'analysis' });
        if (section !== 'overview') params.set('section', section);
        for (const field of ['distillery', 'country', 'volumeType', 'status']) {
            const value = filters[field];
            if (typeof value === 'string' && value !== 'all' && value.length < 200) params.set(field, value);
        }
        return '/?' + params.toString();
    }
    if (page === 'warehouse') {
        const params = new URLSearchParams({view:'warehouse'});
        if (selected === 'rooms' || selected === 'shelves' || selected === 'find') params.set('section', selected);
        if (selected === 'rooms' || selected === 'shelves') {
            if (filters.roomId && /^[a-zA-Z0-9-]{1,100}$/.test(filters.roomId)) params.set('room', filters.roomId);
            if (filters.furnitureId && /^[a-zA-Z0-9-]{1,100}$/.test(filters.furnitureId)) params.set('furniture', filters.furnitureId);
        }
        return '/?' + params.toString();
    }
    if (page === 'settings') {
        return '/?view=settings';
    }
    if (page === 'map') {
        return selected && /^[a-zA-Z0-9-]{1,100}$/.test(selected)
            ? '/?view=map&focusBottling=' + encodeURIComponent(selected)
            : '/?view=map';
    }
    return '/';
}
