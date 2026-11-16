import { t } from '../i18n/index.js';
// Minimal client-side router. Query-based routes also work on direct reloads
// because the local Node server already serves / for all query strings.
export function parseRoute(search) {
    const params = new URLSearchParams(search);
    const flightId = params.get('flight');
    const validFlight = flightId && /^[a-zA-Z0-9-]{1,100}$/.test(flightId) ? flightId : null;
    const bottlingId = params.get('bottling');
    if (bottlingId && /^[a-zA-Z0-9-]{1,100}$/.test(bottlingId)) {
        const tastingId = params.get('tasting');
        if (tastingId && /^[a-zA-Z0-9-]{1,100}$/.test(tastingId))
            return {page:'tasting',selected:bottlingId,tastingId,...(validFlight?{flightId:validFlight}:{})};
        if (params.get('view') === 'tasting-flight' && validFlight) return {page:'tasting-flight',selected:validFlight};
    if (params.get('view') === 'tastings') return {page:'tastings',selected:bottlingId};
        return {page:'detail',selected:bottlingId};
    }
    const externalTasting=params.get('externalTasting');
    if (externalTasting && /^[a-zA-Z0-9-]{1,100}$/.test(externalTasting))
        return {page:'external-tasting',selected:externalTasting,tastingId:null,...(validFlight?{flightId:validFlight}:{})};
    if (params.get('view') === 'tasting-flight' && validFlight) return {page:'tasting-flight',selected:validFlight};
    if (params.get('view') === 'tastings') return {page:'tastings-home', selected:null};
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
    if (params.get('view') === 'help') return { page: 'help', selected: null };
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
    if (['detail','tasting','tastings'].includes(page)) {
        if (!selected || !/^[a-zA-Z0-9-]{1,100}$/.test(selected)) {
            throw new Error(t("navigation.errors.invalidBottlingId"));
        }
        const prefix='/?bottling=' + encodeURIComponent(selected);
        if (page === 'tastings') return prefix + '&view=tastings';
        if (page === 'tasting') {
            if (!filters.tastingId || !/^[a-zA-Z0-9-]{1,100}$/.test(filters.tastingId))
                throw new Error('Ungültige Verkostungs-ID');
            return prefix + '&tasting=' + encodeURIComponent(filters.tastingId) + (filters.flightId ? '&flight='+encodeURIComponent(filters.flightId) : '');
        }
        return prefix;
    }
    if (page === 'tastings-home') return '/?view=tastings';
    if (page === 'tasting-flight') {
        if (!selected || !/^[a-zA-Z0-9-]{1,100}$/.test(selected)) throw new Error('Ungültige Flight-ID');
        return '/?view=tasting-flight&flight='+encodeURIComponent(selected);
    }
    if (page === 'external-tasting') {
        if (!selected || !/^[a-zA-Z0-9-]{1,100}$/.test(selected)) throw new Error('Ungültige Verkostungs-ID');
        return '/?externalTasting='+encodeURIComponent(selected)+(filters.flightId ? '&flight='+encodeURIComponent(filters.flightId) : '');
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
    if (page === 'help') return '/?view=help';
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
