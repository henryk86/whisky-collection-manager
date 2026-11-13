import test from 'node:test';
import assert from 'node:assert/strict';
import {paintMaskSegment,applyMaskStrokes} from '../../public/js/features/photo-editor/mask-brush.js';

function fixture(width=80,height=80) {
    const data=new Uint8ClampedArray(width*height*4);
    for (let i=0;i<data.length;i+=4) {
        data[i]=210;data[i+1]=60;data[i+2]=31;data[i+3]=255;
    }
    return {data,width,height};
}
const alpha=(pixels,w,x,y)=>pixels[(y*w+x)*4+3];
test('eraser removes only alpha and never touches RGB',()=>{
    const source=fixture(), current=new Uint8ClampedArray(source.data);
    paintMaskSegment(current,source.data,80,80,{x:.3,y:.5},{x:.7,y:.5},10,'erase');
    assert.equal(alpha(current,80,40,40),0);
    assert.equal(alpha(current,80,0,0),255);
    for (let i=0;i<current.length;i+=4) assert.deepEqual(Array.from(current.slice(i,i+3)),[210,60,31]);
});
test('restore brush restores accidentally erased alpha but does not invent model-missing pixels',()=>{
    const source=fixture();
    source.data[(40*80+40)*4+3]=0; // Truly missing from original segmentation
    const current=new Uint8ClampedArray(source.data);
    paintMaskSegment(current,source.data,80,80,{x:.3,y:.5},{x:.7,y:.5},10,'erase');
    paintMaskSegment(current,source.data,80,80,{x:.3,y:.5},{x:.7,y:.5},10,'restore');
    assert.equal(alpha(current,80,40,40),0);
    assert.equal(alpha(current,80,34,40),255);
});
test('stroke replays identically at a new preview resolution and preserves transparent borders',()=>{
    const strokes=[{mode:'erase',size:8,points:[{x:.15,y:.6},{x:.65,y:.6}]}];
    for (const size of [80,160]) {
        const source=fixture(size,size);
        for (let i=0;i<size;i++) source.data[(10*size+i)*4+3]=0;
        const result=applyMaskStrokes(source,strokes);
        assert.equal(alpha(result.data,size,Math.round(size*.4),Math.round(size*.6)),0);
        assert.equal(alpha(result.data,size,0,10),0);
        assert.equal(alpha(source.data,size,Math.round(size*.4),Math.round(size*.6)),255);
    }
});
test('rebuilding with one stroke removed restores the pre-brush cutout',()=>{
    const source=fixture();
    const strokes=[{mode:'erase',size:10,points:[{x:.5,y:.5}]}];
    assert.equal(alpha(applyMaskStrokes(source,strokes).data,80,40,40),0);
    assert.equal(alpha(applyMaskStrokes(source,[]).data,80,40,40),255);
});
