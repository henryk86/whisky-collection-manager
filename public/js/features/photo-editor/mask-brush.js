/** Alpha-only corrections. Source RGB and source alpha stay immutable. */
export const MASK_BRUSH_MODES = Object.freeze(['erase', 'restore']);
export const DEFAULT_MASK_BRUSH_SIZE = 4;

/** A stroke position/radius is relative to the smaller image side, not the screen zoom. */
export function paintMaskSegment(current, reference, width, height, from, to, sizePercent, mode) {
    if (!MASK_BRUSH_MODES.includes(mode)) throw new RangeError('Invalid brush mode');
    if (!(width > 0 && height > 0) || current.length !== width*height*4 || reference.length !== current.length)
        throw new RangeError('Invalid image dimensions');
    if (![from?.x,from?.y,to?.x,to?.y,sizePercent].every(Number.isFinite))
        throw new RangeError('Invalid brush position');
    const radius = Math.max(.5, Math.min(width,height) * Math.max(.5, Math.min(20,sizePercent)) / 200);
    const x0=from.x*width, y0=from.y*height, x1=to.x*width, y1=to.y*height;
    const dx=x1-x0, dy=y1-y0, distance2=dx*dx+dy*dy;
    const minX=Math.max(0,Math.floor(Math.min(x0,x1)-radius-1));
    const maxX=Math.min(width-1,Math.ceil(Math.max(x0,x1)+radius+1));
    const minY=Math.max(0,Math.floor(Math.min(y0,y1)-radius-1));
    const maxY=Math.min(height-1,Math.ceil(Math.max(y0,y1)+radius+1));
    for (let y=minY;y<=maxY;y++) for (let x=minX;x<=maxX;x++) {
        const px=x+.5, py=y+.5;
        const projection=distance2 ? Math.max(0,Math.min(1,((px-x0)*dx+(py-y0)*dy)/distance2)) : 0;
        const d=Math.hypot(px-x0-projection*dx,py-y0-projection*dy);
        if (d>=radius) continue;
        const strength=d<=radius*.76 ? 1 : (radius-d)/(radius*.24);
        const offset=(y*width+x)*4+3;
        const initial=reference[offset];
        if (mode==='erase') current[offset]=Math.min(current[offset],Math.round(initial*(1-strength)));
        else current[offset]=Math.max(current[offset],Math.round(initial*strength));
    }
    return current;
}

/** Rebuild at any resolution. A restore stroke cannot resurrect pixels removed by the AI mask. */
export function applyMaskStrokes(imageData, strokes) {
    const output=new Uint8ClampedArray(imageData.data);
    for (const stroke of strokes) {
        for (let i=0;i<stroke.points.length;i++) {
            const from=stroke.points[Math.max(0,i-1)];
            const to=stroke.points[i];
            paintMaskSegment(output,imageData.data,imageData.width,imageData.height,
                from,to,stroke.size,stroke.mode);
        }
    }
    return {data:output,width:imageData.width,height:imageData.height};
}
