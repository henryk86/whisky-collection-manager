/** Pure viewport transforms. Zoom affects only the on-screen canvas, never exported pixels. */
export const MIN_PREVIEW_ZOOM = 1;
export const MAX_PREVIEW_ZOOM = 6;
export const clampPreviewZoom = value => Math.max(MIN_PREVIEW_ZOOM, Math.min(MAX_PREVIEW_ZOOM, value));

export function zoomAroundPoint({zoom, x, y}, requestedZoom, point, size) {
    const nextZoom = clampPreviewZoom(requestedZoom);
    const ratio = nextZoom / zoom;
    const nextX = point.x - size.width / 2 - (point.x - size.width / 2 - x) * ratio;
    const nextY = point.y - size.height / 2 - (point.y - size.height / 2 - y) * ratio;
    return constrainPreviewPan({zoom: nextZoom, x: nextX, y: nextY}, size);
}

export function constrainPreviewPan({zoom, x, y}, size) {
    const widthLimit = (zoom - 1) * size.width / 2;
    const heightLimit = (zoom - 1) * size.height / 2;
    return {zoom,
        x: Math.max(-widthLimit, Math.min(widthLimit, x)),
        y: Math.max(-heightLimit, Math.min(heightLimit, y))};
}
