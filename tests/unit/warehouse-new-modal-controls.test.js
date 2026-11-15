import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createModal} from '../../public/js/ui/modal.js';
import {helpView} from '../../public/js/views/help.js';

test('shelf navigation has a three-way application dialog and parent manager updates after save',()=>{
    const code=fs.readFileSync('public/js/views/warehouse.js','utf8');
    assert.match(code,/data-act="warehouse-shelf-switch"/);
    assert.match(code,/modal\.choose\(/);
    assert.match(code,/\{id:'save'/);
    assert.match(code,/\{id:'discard'/);
    assert.match(code,/\{id:'cancel'/);
    assert.match(code,/refreshFurnitureModal\(\); \/\/ refresh a suspended furniture manager/);
    assert.doesNotMatch(code,/window\.confirm\(/);
});
test('modal supports choice and replaces current sibling while preserving the original stack',async()=>{
    const prior=globalThis.document;
    let overlay;
    const host={get firstElementChild(){return overlay;},set innerHTML(html){overlay=html?{html,addEventListener(){}}:null;},replaceChildren(element){overlay=element;},querySelector(){return overlay;}};
    globalThis.document={querySelector(){return host;}};
    try {
        const state={modal:null};const modal=createModal({state,onClose(){}});
        modal.showModal('Parent','<p>Parent</p>');
        const parent=host.firstElementChild;
        modal.showModal('First','<p>First</p>');
        modal.showModal('Second','<p>Second</p>',false,'replace');
        modal.closeModal();
        assert.equal(host.firstElementChild,parent);
        const prompt=modal.choose('Unsaved','Choose',[{id:'cancel',label:'Cancel'},{id:'discard',label:'Discard'},{id:'save',label:'Save'}]);
        assert.equal(modal.acceptChoice('discard'),true);
        assert.equal(await prompt,'discard');
        modal.closeModal();
        assert.equal(state.modal,null);
    } finally {globalThis.document=prior;}
});
test('help retains existing short guidance and includes technical accordion guides in the same content panel',()=>{
    const html=helpView('backups');
    assert.match(html,/help-content-panel/);
    assert.match(html,/help-technical-guides/);
    assert.match(html,/class="help-guide"/);
    assert.match(html,/backup-admin-token/);
    assert.match(html,/rclone config/);
    assert.match(html,/OneDrive/);
});
