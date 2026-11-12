/** Collection pagination is presentation-only. All bottlings remain in collection.json. */
// Every selectable page size is divisible by the supported grid column counts.
export const DEFAULT_PAGE_SIZE = 24;
export const PAGE_SIZE_OPTIONS = Object.freeze([12, 24, 48, 96]);
export const GRID_COLUMN_OPTIONS = Object.freeze([1, 2, 3, 4]);

/** Prevent an invalid URL or old page number from making the collection look empty. */
export function pageFromSearch(search = '') {
    const raw = new URLSearchParams(search).get('page');
    if (!raw || !/^[1-9]\d{0,5}$/.test(raw)) return 1;
    return Number(raw);
}

export function overviewModeFromSearch(search = '') {
    return new URLSearchParams(search).get('mode') === 'bottles' ? 'bottles' : 'bottlings';
}

/** The bottle view has its own shareable URL; old bottling URLs remain unchanged. */
export function homePageUrl(page, mode = 'bottlings') {
    const params = new URLSearchParams();
    if (mode === 'bottles') params.set('mode', 'bottles');
    if (page > 1) params.set('page', String(page));
    return params.size ? `/?${params}` : '/';
}

/** Slice after filtering and sorting, never before. */
export function paginate(items, requestedPage = 1, requestedSize = DEFAULT_PAGE_SIZE) {
    const pageSize = Number.isSafeInteger(Number(requestedSize)) && Number(requestedSize) >= 1 && Number(requestedSize) <= 240 ? Number(requestedSize) : DEFAULT_PAGE_SIZE;
    const total = items.length;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const numericPage = Number.isSafeInteger(Number(requestedPage)) ? Number(requestedPage) : 1;
    const page = Math.max(1, Math.min(pageCount, numericPage));
    const start = (page - 1) * pageSize;
    return {
        items: items.slice(start, start + pageSize),
        total,
        page,
        pageCount,
        pageSize,
        from: total ? start + 1 : 0,
        to: Math.min(total, start + pageSize),
    };
}

/** Short, predictable page-number list for both desktop and small phone screens. */
export function visiblePages(current, totalPages) {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
    const pages = new Set([1, totalPages, current - 1, current, current + 1]);
    if (current < 4) for (const n of [2, 3, 4]) pages.add(n);
    if (current > totalPages - 3) for (const n of [totalPages - 3, totalPages - 2, totalPages - 1]) pages.add(n);
    const ordered = [...pages].filter(n => n > 0 && n <= totalPages).sort((a, b) => a - b);
    return ordered.flatMap((number, index) => {
        if (!index || number - ordered[index - 1] === 1) return [number];
        return ['…', number];
    });
}
