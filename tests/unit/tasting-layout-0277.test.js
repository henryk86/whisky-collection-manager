import test from 'node:test';
import assert from 'node:assert/strict';
import { createTastingsView } from '../../public/js/views/tastings.js';
import { createDetailView } from '../../public/js/views/detail.js';

const example = { id:'bottling-1',name:'Example dram',bottles:[],distillery:'Sample Distillery',tastings:[] };

function detailHtml(tastings=[]) {
    let html='';
    const oldDocument=globalThis.document;
    globalThis.document={querySelectorAll:()=>[]};
    try {
        const state={page:'detail',selected:example.id,collection:{bottlings:[{...example,tastings}],distilleries:[]}};
        createDetailView({state,selectors:{bottles:()=>[],coverPhoto:()=>'',distilleryNames:()=>[]},
            shell:content=>{html=content;},navigate(){},action:async fn=>fn()})();
    } finally { globalThis.document=oldDocument; }
    return html;
}

test('detail-page new tasting is above the summary card, matching another bottle',()=>{
    const html=detailHtml();
    const section=html.match(/<section[^>]*class="section tasting-summary"[\s\S]*?<\/section>/)?.[0];
    assert.ok(section);
    const heading=section.match(/<div class="section-head">[\s\S]*?<\/div>/)?.[0];
    assert.match(heading,/data-act="tastings-new"[^>]*><svg class="new-icon"/);
    assert.ok(section.indexOf('data-act="tastings-new"') < section.indexOf('class="panel tasting-summary-card"'));
    assert.match(section,/class="actions tasting-summary-actions"[\s\S]*?data-act="tastings-open"/);
    assert.equal((section.match(/data-act="tastings-new"/g)||[]).length,1);
    assert.match(html, /data-act="add-bottle"><svg class="new-icon"/);
});

test('detail-page latest tasting uses five fillable glencairns before its numeric score',()=>{
    const latest={id:'note-1',tastedOn:'2026-11-15',createdAt:'2026-11-15T20:00:00Z',rating:85};
    const html=detailHtml([latest]);
    const row=html.match(/<div class="tasting-summary-score">[\s\S]*?<div class="tasting-summary-rating">[^<]*<\/div>/)?.[0];
    assert.ok(row);
    assert.equal((row.match(/class="glencairn-symbol glencairn-rating-symbol"/g)||[]).length,5);
    assert.match(row,/tasting-summary-glasses[\s\S]*?85 \/ 100/);
    assert.match(html,/data-act="tastings-open" data-tasting-id="note-1"/);
});

test('when a bottling has no notes, the overview action does not use an invalid tasting ID',()=>{
    const html=detailHtml();
    assert.match(html,/data-act="tastings-open"(?=\s|>)/);
    assert.doesNotMatch(html,/data-act="tastings-open"[^>]*data-tasting-id=/);
    assert.match(html,/Noch keine Verkostung/);
});

test('the tasting home create action is inside the entries panel heading',()=>{
    let html='';
    const state={page:'tastings-home',collection:{bottlings:[],externalTastings:[]}};
    createTastingsView({state,shell:content=>html=content,navigate(){},refresh(){}}).home();
    assert.match(html,/<section class="analytics-panel tasting-home-recent">\s*<div class="tasting-panel-heading"><h3>Einträge<\/h3>\s*<button[^>]*data-act="tastings-start-choice"[^>]*><svg class="new-icon"/);
    assert.doesNotMatch(html,/class="tasting-add-action"/);
});

test('tasting subject photo precedes details inside the information panel',()=>{
    let html='';
    const b={...example,tastings:[{id:'t1',tastedOn:'2026-11-15',rating:80,tastingNotes:{nose:'',palate:'',finish:''}}]};
    const state={page:'tastings',selected:b.id,collection:{bottlings:[b],distilleries:[],externalTastings:[]}};
    const selectors={coverPhoto:()=>'/photos/cover.png'};
    createTastingsView({state,selectors,shell:content=>html=content,navigate(){},refresh(){}}).list();
    const info=html.match(/<div class="tasting-bottling-summary tasting-bottling-photo-layout">[\s\S]*?<\/section>/)?.[0];
    assert.ok(info);
    assert.ok(info.indexOf('class="tasting-bottling-photo"') < info.indexOf('class="tasting-bottling-copy"'));
});

test('saved tasting edit control sits inside the record data panel rather than the section heading',()=>{
    let html='';
    const note={id:'note-1',tastedOn:'2026-11-15',title:'Evening',rating:80,tastingNotes:{nose:'',palate:'',finish:''}};
    const b={...example,tastings:[note]};
    const state={page:'tasting',selected:b.id,tastingId:note.id,collection:{bottlings:[b],distilleries:[],externalTastings:[]}};
    createTastingsView({state,shell:content=>html=content,navigate(){},refresh(){}}).editor();
    const start=html.indexOf('class="tasting-record-fields analytics-panel tasting-readonly-meta-panel"');
    const end=html.indexOf('class="tasting-top-row"', start);
    assert.ok(start > -1 && end > start);
    const recordPanel=html.slice(start,end);
    assert.match(recordPanel,/data-act="tasting-edit-start"/);
    assert.match(recordPanel,/class="actions tasting-readonly-meta-actions"/);
    assert.doesNotMatch(html,/<div class="section-head"><h3>Eindrücke<\/h3>\s*<div class="actions">/);
    assert.equal((html.match(/data-act="tasting-edit-start"/g)||[]).length,1);
});
