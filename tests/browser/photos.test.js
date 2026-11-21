import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {HELP_TOPICS} from '../../public/js/views/help.js';
import {startTestServer,requestJson} from '../helpers/server.js';
import {domOnly,chromium,session,openSettingsFromMenu,openSettingsSection,seed,mockDecoder} from './support.js';
test('browser: adjustments followed by cutting create one corrected editable cutout', async () => {
    await session(async ({base,page,open}) => {
        const created = await seed(base,'CUT-EDIT');
        const png = 'data:image/png;base64,' + fs.readFileSync(
            new URL('../fixtures/photo-import-reference.png', import.meta.url)).toString('base64');
        const photo = (await requestJson(base,`/api/bottles/${created.bottle.id}/photos`,'POST',{image:png})).data;
        // Synthetic bottle silhouette isolates editor orchestration from ONNX installation.
        // Geometry + real adjustment pipeline and server persistence still execute.
        const fakeOrt = `export const env={wasm:{}};
            export class Tensor {constructor(type,data,shape){this.data=data;} dispose(){}}
            export const InferenceSession={async create(){return {
                inputNames:['input'],outputNames:['out'],async run(){const data=new Float32Array(320*320);
                for(let y=20;y<306;y++)for(let x=106;x<213;x++)data[y*320+x]=1;
                return {out:{data}};}}}};`;
        await page.route('**/ai/vendor/ort.wasm.min.mjs', route => route.fulfill({
            status:200,contentType:'text/javascript',body:fakeOrt,
        }));
        await open();
        await page.locator(`[data-act="open"][data-id="${created.bottling.id}"]`).first().click();
        const tile = page.locator(`[data-photo-tile][data-photo-id="${photo.id}"]`);
        const pen = tile.locator('[data-act="photo-editor-open"]');
        const size = async element => element.evaluate(el => {
            const box=el.getBoundingClientRect();return {width:box.width,height:box.height};
        });
        assert.deepEqual(await size(pen),{width:28,height:28});
        assert.equal(await tile.locator('[data-act="cutout-open"]').count(), 0);
        await pen.click();
        await page.waitForFunction(() => !document.querySelector('[data-photo-slider="exposure"]').disabled);
        assert.equal(await page.locator('.photo-editor-image canvas').count(),1);
        const noOverlap = await page.evaluate(() => {
            const button=document.querySelector('.photo-editor-group-reset').getBoundingClientRect();
            const slider=document.querySelector('.photo-editor-slider input').getBoundingClientRect();
            return button.bottom < slider.top;
        });
        assert.ok(noOverlap,'reset icon must be above the slider');
        await page.locator('[data-photo-slider="exposure"]').evaluate(el=>{
            el.value='.6';el.dispatchEvent(new Event('input',{bubbles:true}));
        });
        const frameHeightBeforeTab = await page.locator('.photo-editor-image').evaluate(el => el.getBoundingClientRect().height);
        await page.locator('[data-photo-editor-tab="cutout"]').click();
        assert.equal(await page.locator('.photo-editor-image').evaluate(el => el.getBoundingClientRect().height),frameHeightBeforeTab,
            'changing editing tabs must not resize the image preview');
        await page.locator('[data-act="photo-editor-cutout"]').click();
        await page.waitForFunction(() => document.querySelector('[data-photo-editor-message]')?.textContent
            ?.includes('Freistellung in der Vorschau'),null,{timeout:20000});
        assert.equal(await page.locator('.photo-editor-image canvas').count(),1);
        assert.equal(await page.locator('.cutout-compare').count(),0);
        // Before/after must compare the whole original with the transparent cutout,
        // not just disable brightness/contrast on the already cut-out result.
        const alphaBounds = async () => page.locator('[data-photo-editor-preview]').evaluate(canvas => {
            const {data} = canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height);
            let transparent = 0;
            for (let i=3;i<data.length;i+=4) if (data[i] === 0) transparent++;
            return {transparent,width:canvas.width,height:canvas.height};
        });
        const afterCutout = await alphaBounds();
        assert.ok(afterCutout.transparent > 0,'cutout must contain a transparent background');
        await page.locator('[data-act="photo-editor-before"]').click();
        await page.waitForFunction(() => document.querySelector('[data-act="photo-editor-before"]')
            ?.getAttribute('aria-pressed') === 'true');
        assert.equal((await alphaBounds()).transparent,0,
            'Before must show the entire opaque original, even when the cutout is already active');
        assert.equal(await page.locator('[data-photo-editor]').count(),1,'comparison must stay in editor');
        await page.locator('[data-act="photo-editor-before"]').click();
        await page.waitForFunction(() => document.querySelector('[data-act="photo-editor-before"]')
            ?.getAttribute('aria-pressed') === 'false');
        assert.ok((await alphaBounds()).transparent > 0,'After must restore the cutout');
        await page.locator('[data-act="photo-editor-save"]').click();
        await page.locator('[data-photo-editor]').waitFor({state:'detached'});
        const saved = (await requestJson(base,'/api/collection')).data
            .bottlings.find(b=>b.id===created.bottling.id).bottles[0].photos[0];
        assert.ok(saved.cutout?.selected);
        assert.equal(saved.cutout.adjustment.settings.exposure,.6);
        assert.match(await tile.locator('img').getAttribute('src'),/-edit-[\w-]+\.webp$/);
        await pen.click();
        await page.waitForFunction(() => !document.querySelector('[data-photo-slider="exposure"]').disabled);
        assert.equal(Number(await page.locator('[data-photo-slider="exposure"]').inputValue()),.6);
        await page.locator('[data-act="photo-editor-before"]').click();
        await page.waitForFunction(() => document.querySelector('[data-act="photo-editor-before"]')
            ?.getAttribute('aria-pressed') === 'true');
        assert.equal((await alphaBounds()).transparent,0,
            'reopening a saved cutout must still compare against the complete original');
        await page.locator('[data-act="photo-editor-before"]').click();
        await page.waitForFunction(() => document.querySelector('[data-act="photo-editor-before"]')
            ?.getAttribute('aria-pressed') === 'false');
        assert.ok((await alphaBounds()).transparent > 0);
    });
});



test('browser: cutout then automatic correction saves the first photo of a second physical bottle', async () => {
    await session(async ({base,page,open}) => {
        const {bottling,bottle} = await seed(base,'CUT-1');
        const second = await requestJson(base,'/api/bottles','POST',{
            bottlingId:bottling.id,inventoryNumber:'CUT-2'
        });
        assert.equal(second.status,201);
        const png = 'data:image/png;base64,' + fs.readFileSync(
            new URL('../fixtures/photo-import-reference.png', import.meta.url)).toString('base64');
        const firstPhoto = (await requestJson(base,`/api/bottles/${bottle.id}/photos`,'POST',{image:png})).data;
        const secondPhoto = (await requestJson(base,`/api/bottles/${second.data.id}/photos`,'POST',{image:png})).data;
        const fakeOrt = `export const env={wasm:{}};
            export class Tensor {constructor(type,data,shape){this.data=data;} dispose(){}}
            export const InferenceSession={async create(){return {
                inputNames:['input'],outputNames:['out'],async run(){const data=new Float32Array(320*320);
                for(let y=20;y<306;y++)for(let x=106;x<213;x++)data[y*320+x]=1;
                return {out:{data}};}}}};`;
        await page.route('**/ai/vendor/ort.wasm.min.mjs', route => route.fulfill({
            status:200,contentType:'text/javascript',body:fakeOrt,
        }));
        await open();
        // Reproduce the platform's documented toBlob fallback for browsers without
        // WebP canvas encoding (the PNG is correct, but older API validation rejected it).
        await page.evaluate(() => {
            const nativeToBlob = HTMLCanvasElement.prototype.toBlob;
            HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
                return nativeToBlob.call(this, callback, type === 'image/webp' ? 'image/png' : type, quality);
            };
        });
        await page.locator(`[data-act="open"][data-id="${bottling.id}"]`).first().click();
        const secondTile = page.locator(`#bottle-${second.data.id} [data-photo-id="${secondPhoto.id}"]`);
        await secondTile.locator('[data-act="photo-editor-open"]').click();
        await page.waitForFunction(() => !document.querySelector('[data-photo-slider="exposure"]')?.disabled);
        await page.locator('[data-photo-editor-tab="cutout"]').click();
        await page.locator('[data-act="photo-editor-cutout"]').click();
        await page.waitForFunction(() => document.querySelector('[data-photo-editor-message]')?.textContent
            ?.includes('Freistellung in der Vorschau'),null,{timeout:20000});
        await page.locator('[data-act="photo-editor-auto"]').click();
        await page.waitForFunction(() => Number(document.querySelector('[data-photo-slider="clarity"]')?.value) === 9);
        await page.locator('[data-act="photo-editor-save"]').click();
        await page.locator('[data-photo-editor]').waitFor({state:'detached',timeout:25000});
        const saved = (await requestJson(base,'/api/collection')).data.bottlings
            .find(item => item.id === bottling.id).bottles;
        const edited = saved.find(item => item.id === second.data.id).photos[0];
        assert.equal(edited.id,secondPhoto.id);
        assert.equal(edited.cutout?.selected,true);
        assert.equal(edited.cutout.adjustment?.settings.clarity,9);
        assert.equal(edited.cutout.adjustment.sourcePath,edited.cutout.path);
        assert.match(edited.cutout.adjustment.path,/\.png$/, 'PNG fallback is saved instead of rejected');
        assert.equal(saved.find(item => item.id === bottle.id).photos[0].id,firstPhoto.id);
        assert.equal(saved.find(item => item.id === bottle.id).photos[0].cutout,undefined);
    });
});

test('browser: first cutout before/after compares the uncut photo without slider edits', async () => {
    await session(async ({base,page,open}) => {
        const created = await seed(base,'CUT-BEFORE');
        const png = 'data:image/png;base64,' + fs.readFileSync(
            new URL('../fixtures/photo-import-reference.png', import.meta.url)).toString('base64');
        const photo = (await requestJson(base,`/api/bottles/${created.bottle.id}/photos`,'POST',{image:png})).data;
        const fakeOrt = `export const env={wasm:{}};
            export class Tensor {constructor(type,data,shape){this.data=data;} dispose(){}}
            export const InferenceSession={async create(){return {
                inputNames:['input'],outputNames:['out'],async run(){const data=new Float32Array(320*320);
                for(let y=20;y<306;y++)for(let x=106;x<213;x++)data[y*320+x]=1;
                return {out:{data}};}}}};`;
        await page.route('**/ai/vendor/ort.wasm.min.mjs', route => route.fulfill({
            status:200,contentType:'text/javascript',body:fakeOrt,
        }));
        await open();
        await page.locator(`[data-act="open"][data-id="${created.bottling.id}"]`).first().click();
        await page.locator(`[data-act="photo-editor-open"][data-photo-id="${photo.id}"]`).click();
        await page.waitForFunction(() => !document.querySelector('[data-photo-slider="exposure"]')?.disabled);
        assert.equal(await page.locator('[data-photo-slider="exposure"]').inputValue(),'0');
        await page.locator('[data-photo-editor-tab="cutout"]').click();
        await page.locator('[data-act="photo-editor-cutout"]').click();
        await page.waitForFunction(() => document.querySelector('[data-photo-editor-message]')?.textContent
            ?.includes('Freistellung in der Vorschau'),null,{timeout:20000});
        const hasTransparentPixels = () => {
            const canvas = document.querySelector('[data-photo-editor-preview]');
            if (!canvas) return false;
            const pixels = canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
            for (let i=3;i<pixels.length;i+=4) if (pixels[i] === 0) return true;
            return false;
        };
        await page.waitForFunction(hasTransparentPixels);
        await page.locator('[data-act="photo-editor-before"]').click();
        await page.waitForFunction(() => {
            const canvas = document.querySelector('[data-photo-editor-preview]');
            if (!canvas || document.querySelector('[data-act="photo-editor-before"]')?.getAttribute('aria-pressed') !== 'true') return false;
            const pixels = canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
            for (let i=3;i<pixels.length;i+=4) if (pixels[i] !== 255) return false;
            return true;
        });
        assert.equal(await page.locator('[data-photo-editor]').count(),1);
        await page.locator('[data-act="photo-editor-before"]').click();
        await page.waitForFunction(hasTransparentPixels);
        assert.equal(await page.locator('[data-photo-slider="exposure"]').inputValue(),'0');
    });
});



test('browser: integrated cutout editor uses one preview on desktop and mobile', async () => {
    await session(async ({base, page, open}) => {
        const created = await seed(base, 'CUT-FIT');
        const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/fG8AAAAASUVORK5CYII=';
        const photo = (await requestJson(base, `/api/bottles/${created.bottle.id}/photos`, 'POST', {image:png})).data;
        await requestJson(base, `/api/bottles/${created.bottle.id}/photos/${photo.id}/cutout`, 'PUT', {image:png});
        await open();
        await page.locator(`.whisky-card[data-id="${created.bottling.id}"]`).first().click();
        await page.locator(`[data-act="photo-editor-open"][data-photo-id="${photo.id}"]`).click();
        await page.locator('[data-photo-editor-preview]').waitFor();
        await page.waitForFunction(() => !document.querySelector('[data-photo-slider="exposure"]').disabled);
        assert.equal(await page.locator('.cutout-compare').count(),0,'no second image in editor');
        assert.equal(await page.locator('.photo-editor-image canvas').count(),1);
        assert.equal(await page.locator('[data-act="photo-editor-cutout"]').count(),1);
        assert.equal(await page.locator('[data-photo-editor-tab]').count(),2);
        assert.equal(await page.locator('[data-photo-editor-panel="cutout"]').isHidden(),true);
        await page.locator('[data-photo-editor-tab="cutout"]').click();
        assert.equal(await page.locator('[data-photo-editor-panel="cutout"]').isVisible(),true);
        await page.locator('[data-photo-editor-tab="adjustments"]').click();
        assert.equal(await page.locator('[data-photo-editor-panel="adjustments"]').isVisible(),true);
        const sample = await page.locator('[data-photo-editor-preview]').evaluate(el => getComputedStyle(el).objectFit);
        assert.equal(sample,'contain');
        for (const viewport of [{width:1366,height:900},{width:390,height:844},{width:320,height:568},{width:844,height:390}]) {
            await page.setViewportSize(viewport);
            const layout = await page.evaluate(() => {
                const frame = document.querySelector('.photo-editor-image').getBoundingClientRect();
                const dialog = document.querySelector('.photo-editor').getBoundingClientRect();
                const preview = document.querySelector('.photo-editor-image canvas').getBoundingClientRect();
                const zoom = document.querySelector('.photo-editor-zoom').getBoundingClientRect();
                const before = document.querySelector('.photo-editor-stage-actions').getBoundingClientRect();
                const controls = document.querySelector('.photo-editor-controls').getBoundingClientRect();
                const help = document.querySelector('.photo-editor-help').getBoundingClientRect();
                const actions = document.querySelector('.photo-editor-actions').getBoundingClientRect();
                return {frame,dialog,preview,zoom,before,controls,help,actions,screen:innerWidth,screenHeight:innerHeight};
            });
            assert.ok(layout.frame.width>0 && layout.frame.height>0,JSON.stringify(viewport));
            assert.ok(layout.frame.width <= layout.screen+2,JSON.stringify(layout));
            assert.ok(layout.preview.width<=layout.frame.width+2 && layout.preview.height<=layout.frame.height+2);
            // Preview controls must float over the image without consuming its vertical space.
            for (const overlay of [layout.zoom,layout.before]) {
                assert.ok(overlay.left >= layout.frame.left-1 && overlay.right <= layout.frame.right+1,JSON.stringify({viewport,overlay,frame:layout.frame}));
                assert.ok(overlay.top >= layout.frame.top-1 && overlay.bottom <= layout.frame.bottom+1,JSON.stringify({viewport,overlay,frame:layout.frame}));
            }
            if (viewport.width > 710) {
                assert.ok(Math.abs(layout.controls.height-layout.frame.height)<1,
                    'the preview and the slider column must have identical heights');
                assert.ok(Math.abs(layout.controls.bottom-layout.frame.bottom)<1,
                    'preview and slider scroll area must end on the same baseline');
                assert.ok(layout.help.top>=layout.frame.bottom && layout.actions.top>=layout.help.bottom,
                    'status and action bar must follow both columns without overlapping them');
                assert.ok(layout.actions.bottom<=layout.screenHeight+1,
                    'the action bar must stay visible on normal desktop-sized viewports');
                assert.ok(Math.abs(layout.help.left-layout.dialog.left)<3 && Math.abs(layout.help.right-layout.dialog.right)<3,
                    'the status must span the full editor width');
            }
        }
    });
});



test('browser: a saved photo cutout can be previewed, toggled and deleted without losing the original', async () => {
    await session(async ({base, page, open}) => {
        const created = await seed(base, 'CUT-001');
        const bottleId = created.bottle.id;
        const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/fG8AAAAASUVORK5CYII=';
        const photo = (await requestJson(base, `/api/bottles/${bottleId}/photos`, 'POST', {image:png})).data;
        const url = `/api/bottles/${bottleId}/photos/${photo.id}/cutout`;
        const cutout = (await requestJson(base, url, 'PUT', {image:png})).data;
        await open();
        await page.locator(`.whisky-card[data-id="${created.bottling.id}"]`).first().click();
        await page.locator(`[data-act="photo-editor-open"][data-photo-id="${photo.id}"]`).waitFor();
        assert.match(await page.locator(`[data-photo-tile][data-photo-id="${photo.id}"] img`).getAttribute('src'), /cutout/);
        await page.locator(`[data-act="photo-editor-open"][data-photo-id="${photo.id}"]`).click();
        await page.locator('[data-photo-editor]').waitFor();
        await page.waitForFunction(() => !document.querySelector('[data-photo-slider="exposure"]').disabled);
        assert.equal(await page.locator('[data-act="photo-editor-cutout"]').count(),1,'freistellen is in the editor');
        assert.equal(await page.locator('.photo-editor-image canvas').count(),1);
        await page.locator('[data-photo-editor-tab="cutout"]').click();
        await page.locator('[data-act="photo-editor-toggle-cutout"]').click();
        assert.equal(await page.locator('[data-photo-editor]').getAttribute('data-photo-preview-source'),'original');
        assert.equal(await page.locator('[data-act="photo-editor-toggle-cutout"]').textContent(), 'Freistellung anzeigen');
        assert.equal(await page.locator('.photo-editor-image canvas').count(),1);
        // Showing the original changes neither the persisted selection nor the gallery.
        assert.equal((await requestJson(base,'/api/collection')).data.bottlings[0].bottles[0].photos[0].cutout.selected,true);
        assert.match(await page.locator(`[data-photo-tile][data-photo-id="${photo.id}"] img`).getAttribute('src'),/cutout/);
        await page.locator('[data-photo-editor-tab="adjustments"]').click();
        await page.locator('[data-photo-slider="exposure"]').evaluate(el=>{el.value='0.6';el.dispatchEvent(new Event('input',{bubbles:true}));});
        await page.locator('[data-photo-editor-tab="cutout"]').click();
        await page.locator('[data-act="photo-editor-toggle-cutout"]').click();
        assert.equal(await page.locator('[data-photo-editor]').getAttribute('data-photo-preview-source'),'cutout');
        assert.equal(await page.locator('[data-photo-slider="exposure"]').inputValue(),'0');
        await page.locator('[data-act="photo-editor-toggle-cutout"]').click();
        assert.equal(await page.locator('[data-photo-slider="exposure"]').inputValue(),'0.6',
            'unsaved adjustment values for each source must survive preview switching');
        // Saving the selected source commits it and its edits, but never deletes the cutout.
        await page.locator('[data-act="photo-editor-save"]').click();
        await page.locator(`[data-photo-tile][data-photo-id="${photo.id}"] img[src*="edit-"]`).waitFor();
        const afterSaving = (await requestJson(base,'/api/collection')).data.bottlings[0].bottles[0].photos[0];
        assert.equal(afterSaving.cutout.selected,false);
        assert.equal(afterSaving.adjustment.settings.exposure,.6);
        await page.locator(`[data-act="photo-editor-open"][data-photo-id="${photo.id}"]`).click();
        await page.locator('[data-photo-editor-tab="cutout"]').click();
        await page.locator('[data-act="photo-editor-remove-cutout"]').click();
        await page.locator(`[data-photo-tile][data-photo-id="${photo.id}"] img`).waitFor();
        const photoAfterDelete = (await requestJson(base, '/api/collection')).data.bottlings[0].bottles[0].photos[0];
        assert.equal(photoAfterDelete.cutout, undefined);
        assert.equal(photoAfterDelete.path, photo.path, 'original image remains stored');
        assert.equal(photoAfterDelete.adjustment.settings.exposure,.6, 'original edits survive cutout deletion');
        assert.equal(await page.locator(`[data-photo-tile][data-photo-id="${photo.id}"] img`).getAttribute('src'),
            `/${photoAfterDelete.adjustment.path}`);
    });
});



test('browser: saved transparent cutout Before displays all opaque original pixels synchronously', async () => {
    await session(async ({base,page,open}) => {
        const {bottle,bottling} = await seed(base,'CUT-OPAQUE');
        const opaque = 'data:image/png;base64,' + fs.readFileSync(
            new URL('../fixtures/photo-import-reference.png', import.meta.url)).toString('base64');
        const transparent = 'data:image/png;base64,' + fs.readFileSync(
            new URL('../fixtures/photo-cutout-transparent.png', import.meta.url)).toString('base64');
        const photo = (await requestJson(base,`/api/bottles/${bottle.id}/photos`,'POST',{image:opaque})).data;
        await requestJson(base,`/api/bottles/${bottle.id}/photos/${photo.id}/cutout`,'PUT',{image:transparent});
        await open();
        await page.locator(`[data-act="open"][data-id="${bottling.id}"]`).first().click();
        await page.locator(`[data-act="photo-editor-open"][data-photo-id="${photo.id}"]`).click();
        await page.waitForFunction(() => !document.querySelector('[data-photo-slider="exposure"]').disabled);
        const transparentCount = () => page.locator('[data-photo-editor-preview]').evaluate(canvas => {
            const pixels = canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
            let count = 0;
            for (let index=3;index<pixels.length;index+=4) if (pixels[index]===0) count++;
            return count;
        });
        assert.ok((await transparentCount()) > 0);
        await page.locator('[data-act="photo-editor-before"]').click();
        assert.equal(await page.locator('[data-act="photo-editor-before"]').getAttribute('aria-pressed'),'true');
        assert.equal(await transparentCount(),0);
        await page.locator('[data-act="photo-editor-before"]').click();
        assert.ok((await transparentCount()) > 0);
    });
});



test('browser: cutout mask brush erases at preview zoom, supports undo, and saves only the new mask', async () => {
    await session(async ({base,page,open,dir}) => {
        const created = await seed(base,'MASK-EDIT');
        const originalPng = 'data:image/png;base64,' + fs.readFileSync(
            new URL('../fixtures/photo-import-reference.png', import.meta.url)).toString('base64');
        const photo = (await requestJson(base,`/api/bottles/${created.bottle.id}/photos`,'POST',
            {image:originalPng})).data;
        const url = `/api/bottles/${created.bottle.id}/photos/${photo.id}/cutout`;
        const old = (await requestJson(base,url,'PUT',{image:originalPng})).data.cutout.path;
        const initialOriginal = fs.readFileSync(`${dir}/${photo.path}`);
        await open();
        await page.locator(`.whisky-card[data-id="${created.bottling.id}"]`).first().click();
        await page.locator(`[data-act="photo-editor-open"][data-photo-id="${photo.id}"]`).click();
        await page.waitForFunction(() => !document.querySelector('[data-photo-slider="exposure"]').disabled);
        const frameHeightBeforeMask = await page.locator('.photo-editor-image').evaluate(el => el.getBoundingClientRect().height);
        await page.locator('[data-photo-editor-tab="cutout"]').click();
        await page.locator('[data-photo-editor-mask-tools]').waitFor({state:'visible'});
        assert.equal(await page.locator('.photo-editor-image').evaluate(el => el.getBoundingClientRect().height),frameHeightBeforeMask);
        const centerAlpha = () => page.locator('[data-photo-editor-preview]').evaluate(canvas => {
            const pixels = canvas.getContext('2d').getImageData(
                Math.floor(canvas.width / 2),Math.floor(canvas.height / 2),1,1).data;
            return pixels[3];
        });
        assert.equal(await centerAlpha(),255);
        await page.locator('[data-act="photo-editor-zoom-in"]').click();
        assert.match(await page.locator('[data-photo-editor-zoom-level]').textContent(),/150/);
        await page.locator('[data-photo-brush-mode="erase"]').click();
        const rect = await page.locator('[data-photo-editor-preview]').boundingBox();
        const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
        await page.mouse.move(x,y); await page.mouse.down(); await page.mouse.up();
        await page.waitForFunction(() => {
            const canvas = document.querySelector('[data-photo-editor-preview]');
            return canvas?.getContext('2d').getImageData(Math.floor(canvas.width/2),
                Math.floor(canvas.height/2),1,1).data[3] === 0;
        });
        await page.locator('[data-act="photo-editor-brush-undo"]').click();
        await page.waitForFunction(() => {
            const canvas = document.querySelector('[data-photo-editor-preview]');
            return canvas?.getContext('2d').getImageData(Math.floor(canvas.width/2),
                Math.floor(canvas.height/2),1,1).data[3] === 255;
        });
        await page.locator('[data-photo-brush-mode="restore"]').click();
        assert.equal(await page.locator('[data-photo-brush-mode="restore"]').getAttribute('aria-pressed'),'true');
        await page.locator('[data-photo-brush-mode="erase"]').click();
        await page.mouse.move(x,y); await page.mouse.down(); await page.mouse.up();
        await page.locator('[data-photo-editor-tab="adjustments"]').click();
        await page.locator('[data-photo-slider="exposure"]').evaluate(slider => {
            slider.value='.6';slider.dispatchEvent(new Event('input',{bubbles:true}));
        });
        await page.locator('[data-act="photo-editor-save"]').click();
        await page.locator('[data-photo-editor]').waitFor({state:'detached'});
        const after = (await requestJson(base,'/api/collection')).data.bottlings
            .find(item => item.id === created.bottling.id).bottles[0].photos[0];
        assert.equal(after.path,photo.path,'retouch must not replace original');
        assert.notEqual(after.cutout.path,old,'new cutout must persist');
        assert.equal(after.cutout.adjustment.settings.exposure,.6);
        assert.deepEqual(fs.readFileSync(`${dir}/${after.path}`),initialOriginal);
        assert.ok(fs.existsSync(`${dir}/${after.cutout.path}`));
    });
});



test('browser: isolated slightly tilted bottle fills both vertical edges of transparent 2:3 cutout', async () => {
    await session(async ({page, open}) => {
        await open();
        const result = await page.evaluate(async () => {
            const {composeCutout} = await import(new URL('js/features/cutout/image.js', document.baseURI).href);
            const source = document.createElement('canvas');
            source.width = 720; source.height = 1080;
            const sc = source.getContext('2d');
            sc.fillStyle = '#bc7623'; sc.fillRect(0, 0, source.width, source.height);
            const img = new Image(); img.src = source.toDataURL('image/png'); await img.decode();
            const mask = new Uint8ClampedArray(320 * 320);
            for (let y = 28; y < 291; y++) {
                const mid = 160 + (y - 160) * Math.tan(6 * Math.PI / 180) * 1080 / 720;
                for (let x = Math.ceil(mid - 30); x <= mid + 30; x++) mask[y * 320 + x] = 255;
            }
            // High-confidence debris must be absent from the saved image, not just its crop.
            mask[0] = 255; mask[319] = 255;
            const cutout = new Image(); cutout.src = composeCutout(img, mask); await cutout.decode();
            const out = document.createElement('canvas');
            out.width = cutout.naturalWidth; out.height = cutout.naturalHeight;
            const ctx = out.getContext('2d', {willReadFrequently:true});
            ctx.drawImage(cutout, 0, 0);
            const rgba = ctx.getImageData(0, 0, out.width, out.height).data;
            const rowHasAlpha = y => {
                for (let x = 0; x < out.width; x++) {
                    if (rgba[(y * out.width + x) * 4 + 3] >= 8) return true;
                }
                return false;
            };
            return {width:out.width,height:out.height,top:rowHasAlpha(0),bottom:rowHasAlpha(out.height - 1),
                topLeft:rgba[3],topRight:rgba[(out.width - 1) * 4 + 3]};
        });
        assert.equal(result.width * 3, result.height * 2, 'the saved PNG must be exactly 2:3');
        assert.ok(result.top, 'the visible bottle reaches the first image row');
        assert.ok(result.bottom, 'the visible bottle reaches the final image row');
        assert.equal(result.topLeft, 0, 'no detached alpha at the outer top left');
        assert.equal(result.topRight, 0, 'no detached alpha at the outer top right');
    });
});



test('browser: cutout compositor sharpens the model feather into a narrow transparent bottle edge', async () => {
    await session(async ({page, open}) => {
        await open();
        const result = await page.evaluate(async () => {
            const {composeCutout} = await import(new URL('js/features/cutout/image.js', document.baseURI).href);
            const original = document.createElement('canvas');
            original.width = 640; original.height = 960;
            const sourceContext = original.getContext('2d');
            sourceContext.fillStyle = '#67829a';
            sourceContext.fillRect(0, 0, original.width, original.height);
            const photo = new Image();
            photo.src = original.toDataURL('image/png');
            await photo.decode();
            const mask = new Uint8ClampedArray(320 * 320);
            for (let y = 22; y < 298; y++) {
                for (let x = 108; x <= 212; x++) {
                    const distance = Math.min(x - 108, 212 - x);
                    mask[y * 320 + x] = Math.min(255, 25 * distance);
                }
            }
            const image = new Image();
            image.src = composeCutout(photo, mask);
            await image.decode();
            const output = document.createElement('canvas');
            output.width = image.naturalWidth; output.height = image.naturalHeight;
            const context = output.getContext('2d', {willReadFrequently:true});
            context.drawImage(image, 0, 0);
            const rgba = context.getImageData(0, Math.floor(output.height / 2), output.width, 1).data;
            const alphas = Array.from({length:output.width}, (_, x) => rgba[x * 4 + 3]);
            return {
                transition:alphas.filter(value => value > 0 && value < 255).length,
                opaque:alphas.filter(value => value === 255).length,
                transparent:alphas.filter(value => value === 0).length,
                ratio:output.width * 3 === output.height * 2,
            };
        });
        assert.equal(result.ratio, true, 'the PNG keeps the original 2:3 ratio');
        assert.ok(result.transition > 0 && result.transition <= 16,
            `the final edge needs narrow antialiasing, not a broad model feather: ${JSON.stringify(result)}`);
        assert.ok(result.opaque > 0 && result.transparent > 0,
            'the image has a fully opaque bottle and transparent background');
    });
});



test('browser: photo editor previews exposure, saves reversible adjustments and restores the original', async () => {
    await session(async ({page, open, base}) => {
        const created = await seed(base, '002018');
        const bottle = created.bottle;
        const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAqCAIAAAAmpwwJAAAALUlEQVR4nO3MMQ0AMAgAsDFn2MAG/hNMwNcKaGT12/BXFpFIJBKJRCKRSHQSDaMuAWIphFaeAAAAAElFTkSuQmCC';
        const upload = await requestJson(base, `/api/bottles/${bottle.id}/photos`, 'POST', {image:png});
        assert.equal(upload.status,201);
        await open();
        await page.locator(`[data-act="open"][data-id="${created.bottling.id}"]`).first().click();
        await page.locator(`[data-act="photo-editor-open"][data-photo-id="${upload.data.id}"]`).click();
        const exposure = page.locator('[data-photo-slider="exposure"]');
        await exposure.waitFor({state:'visible'});
        await page.waitForFunction(() => !document.querySelector('[data-photo-slider="exposure"]').disabled);
        const pixel = () => page.locator('[data-photo-editor-preview]').evaluate(canvas =>
            canvas.getContext('2d').getImageData(0,0,1,1).data[0]);
        const before = await pixel();
        await exposure.evaluate(el => { el.value='1'; el.dispatchEvent(new Event('input',{bubbles:true})); });
        await page.waitForFunction(previous => {
            const canvas = document.querySelector('[data-photo-editor-preview]');
            return canvas?.getContext('2d').getImageData(0,0,1,1).data[0] > previous;
        },before);
        await page.locator('[data-act="photo-editor-before"]').click();
        await page.waitForFunction(expected => document.querySelector('[data-photo-editor-preview]')?.
            getContext('2d').getImageData(0,0,1,1).data[0] === expected, before);
        await page.locator('[data-act="photo-editor-before"]').click();
        await page.locator('[data-act="photo-editor-save"]').click();
        await page.locator('[data-photo-editor]').waitFor({state:'detached'});
        assert.match(await page.locator('.photo-tile img').first().getAttribute('src'),/-edit-[\w-]+\.webp$/);
        await page.locator('[data-act="photo-editor-open"]').click();
        await page.waitForFunction(() => !document.querySelector('[data-photo-slider="exposure"]').disabled);
        assert.equal(await page.locator('[data-photo-slider="exposure"]').inputValue(),'1');
        await page.locator('[data-act="photo-editor-reset"]').click();
        await page.locator('[data-act="photo-editor-save"]').click();
        await page.locator('[data-photo-editor]').waitFor({state:'detached'});
        assert.ok((await page.locator('.photo-tile img').first().getAttribute('src')).endsWith('.png'));
        const collection = (await requestJson(base, '/api/collection')).data;
        assert.equal(collection.bottlings.find(b => b.id === created.bottling.id)
            .bottles[0].photos[0].adjustment,undefined);
    });
});




test('browser: photo editor group resets and white-balance eyedropper select real image pixels', async () => {
    await session(async ({page, open, base}) => {
        const created = await seed(base, '002019');
        const png = 'data:image/png;base64,' + fs.readFileSync(
            new URL('../fixtures/photo-import-reference.png', import.meta.url)).toString('base64');
        const upload = await requestJson(base, `/api/bottles/${created.bottle.id}/photos`, 'POST', {image:png});
        assert.equal(upload.status,201);
        await open();
        await page.locator(`[data-act="open"][data-id="${created.bottling.id}"]`).first().click();
        await page.locator(`[data-act="photo-editor-open"][data-photo-id="${upload.data.id}"]`).click();
        const exposure = page.locator('[data-photo-slider="exposure"]');
        await page.waitForFunction(() => !document.querySelector('[data-photo-slider="exposure"]').disabled);
        const change = async (name, value) => page.locator(`[data-photo-slider="${name}"]`).evaluate((el,v) => {
            el.value = String(v); el.dispatchEvent(new Event('input',{bubbles:true}));
        },value);
        await change('exposure', .5);
        await change('temperature', 30);
        await change('clarity', 12);
        await page.locator('[data-act="photo-editor-reset-group"][data-photo-group="light"]').click();
        assert.equal(await exposure.inputValue(),'0');
        assert.equal(await page.locator('[data-photo-slider="temperature"]').inputValue(),'30');
        assert.equal(await page.locator('[data-photo-slider="clarity"]').inputValue(),'12');
        await page.locator('[data-act="photo-editor-pick-white"]').click();
        assert.equal(await page.locator('[data-act="photo-editor-pick-white"]').getAttribute('aria-pressed'),'true');
        const point = await page.locator('[data-photo-editor-preview]').evaluate(canvas => {
            const rect = canvas.getBoundingClientRect();
            const scale = Math.min(rect.width / canvas.width, rect.height / canvas.height);
            const left = rect.left + (rect.width - canvas.width*scale)/2;
            const top = rect.top + (rect.height - canvas.height*scale)/2;
            return {x: left + canvas.width*scale*.35, y: top + canvas.height*scale*.35,
                dx: canvas.width*scale*.25, dy: canvas.height*scale*.25};
        });
        await page.mouse.move(point.x,point.y);
        await page.mouse.down();
        await page.mouse.move(point.x+point.dx,point.y+point.dy,{steps:3});
        await page.mouse.up();
        await page.waitForFunction(() => document.querySelector('[data-act="photo-editor-pick-white"]')?.getAttribute('aria-pressed') === 'false');
        assert.ok(Number(await page.locator('[data-photo-slider="temperature"]').inputValue()) < 0);
        assert.equal(await page.locator('[data-photo-slider="clarity"]').inputValue(),'12');
        await page.locator('[data-act="photo-editor-reset-group"][data-photo-group="color"]').click();
        assert.equal(await page.locator('[data-photo-slider="temperature"]').inputValue(),'0');
        assert.equal(await page.locator('[data-photo-slider="clarity"]').inputValue(),'12');
        await page.locator('[data-act="photo-editor-reset-group"][data-photo-group="detail"]').click();
        assert.equal(await page.locator('[data-photo-slider="clarity"]').inputValue(),'0');
    });
});
