import test from 'node:test';
import assert from 'node:assert/strict';
import {displayFlavorProfile,readFlavorProfile} from '../../public/js/ui/flavor-profile.js';
import {createTastingHistory} from '../../public/js/domain/tasting-history.js';

const axes=['woody','cereal','peaty','fruity','floral','winey','feinty','sulphury'];
test('clear radar restores true null state, not a recorded all-zero profile; undo works',()=>{
    const sliders=axes.map(axis=>({value:0,name:axis}));
    const editor={dataset:{flavorSet:'1'},querySelector(query){
        const axis=query.match(/name="flavor-([^"]+)"/)?.[1];
        return sliders.find(s=>s.name===axis) || null;
    }};
    const container={matches:()=>false,querySelector(query){
        if (query==='[data-flavor-editor]') return editor;
        const index=query.match(/data-flavor-range="(\d+)"/)?.[1];
        if (index!==undefined) return sliders[Number(index)];
        if (query==='[data-flavor-polygon]') return {setAttribute(){}};
        return null;
    }};
    const value=Object.fromEntries(axes.map((axis,index)=>[axis,index]));
    const history=createTastingHistory({flavorProfile:value,tastingNotes:{nose:'',palate:'',finish:''}});
    history.record({...history.value,flavorProfile:null});
    displayFlavorProfile(container,history.value.flavorProfile);
    assert.equal(editor.dataset.flavorSet,'');
    assert.equal(readFlavorProfile(container),null);
    assert.deepEqual(sliders.map(x=>x.value),axes.map(()=> '0'));
    assert.equal(history.undo(),true);
    displayFlavorProfile(container,history.value.flavorProfile);
    assert.equal(editor.dataset.flavorSet,'1');
    assert.deepEqual(readFlavorProfile(container),value);
});
