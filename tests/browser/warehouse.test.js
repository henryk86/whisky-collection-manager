import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {HELP_TOPICS} from '../../public/js/views/help.js';
import {startTestServer,requestJson} from '../helpers/server.js';
import {domOnly,chromium,session,openSettingsFromMenu,openSettingsSection,seed,mockDecoder} from './support.js';
test('browser: finder opens the exact shelf, returns to its search and keeps single-bottle relocation', async () => {
    await session(async ({base,page,open}) => {
        const {bottle} = await seed(base,'098712');
        const room = (await requestJson(base,'/api/warehouse/rooms','POST',
            {name:'Suchraum',width:4,height:3})).data;
        const rack = (await requestJson(base,`/api/warehouse/rooms/${room.id}/furniture`,'POST',
            {name:'Testvitrine',type:'vitrine',x:0.2,y:0.2,width:1,depth:.5,rotation:0,elevation:0,itemHeight:1.8})).data;
        const shelf = (await requestJson(base,`/api/warehouse/furniture/${rack.id}/shelves`,'POST',
            {name:'Fach 2',capacity:5})).data;
        assert.equal((await requestJson(base,`/api/warehouse/bottles/${bottle.id}`,'PUT',{shelfId:shelf.id})).status,200);
        await open();
        await page.locator('header [data-act="toggle-menu"]').click();
        await page.locator('#site-drawer [data-act="goto-warehouse"]').click();
        await page.locator('.warehouse-tabs [data-section="find"]').click();
        await page.locator('#warehouse-search').fill('098712');
        const result = page.locator(`.warehouse-finder-card[data-bottle-id="${bottle.id}"]`);
        await result.waitFor();
        // An exceptionally tall bottle photo must remain entirely within the
        // thumbnail at its original aspect ratio, not be clipped or stretched.
        const preview = await result.locator('.warehouse-finder-photo').evaluate(async slot => {
            const img = slot.querySelector('img');
            const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="400"><rect width="80" height="400" fill="#bd955d"/></svg>';
            img.src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
            await img.decode();
            const outer = slot.getBoundingClientRect(), inner = img.getBoundingClientRect();
            return {outer:{left:outer.left,right:outer.right,top:outer.top,bottom:outer.bottom},
                inner:{left:inner.left,right:inner.right,top:inner.top,bottom:inner.bottom,width:inner.width,height:inner.height}};
        });
        assert.ok(preview.inner.left >= preview.outer.left - 1 && preview.inner.right <= preview.outer.right + 1);
        assert.ok(preview.inner.top >= preview.outer.top - 1 && preview.inner.bottom <= preview.outer.bottom + 1);
        assert.ok(Math.abs(preview.inner.width / preview.inner.height - 0.2) < 0.01, 'full bottle aspect ratio is preserved');
        assert.equal(await page.locator('.warehouse-bottle-check').count(),0);
        await page.locator('.warehouse-finder-filter-option').nth(1).click();
        assert.equal(await page.locator('input[name="warehouse-find-placement"][value="assigned"]').isChecked(),true);
        await result.locator('[data-act="warehouse-find-location"]').click();
        assert.equal(await page.locator('.warehouse-tabs [data-section="shelves"]').getAttribute('aria-current'),'page');
        assert.equal(await page.locator(`.warehouse-wall-bottle.is-find-focus [data-id="${bottle.id}"]`).count(),1);
        // The whole shelf is located by an external glow: nothing may be
        // placed over its title, bottle preview, or occupancy information.
        const focusStyle = await page.locator('.warehouse-wall-bay.is-find-focus').evaluate(bay => {
            const preview = bay.querySelector('.warehouse-bottle-silhouettes');
            const selected = bay.querySelector('.warehouse-wall-bottle.is-find-focus');
            const dimmed = bay.querySelector('.warehouse-wall-bottle.is-find-dimmed');
            return {bayShadow:getComputedStyle(bay).boxShadow,
                previewOutline:getComputedStyle(preview).outlineStyle,
                previewBackground:getComputedStyle(preview).backgroundColor,
                selectedTransform:getComputedStyle(selected).transform,
                selectedFilter:getComputedStyle(selected).filter,
                dimmedOpacity:dimmed ? getComputedStyle(dimmed).opacity : null,
                badgeCount:bay.querySelectorAll('.warehouse-find-bottle-badge').length};
        });
        assert.match(focusStyle.bayShadow, /rgba?\(/, 'located shelf has a visible external glow');
        assert.equal(focusStyle.previewOutline,'none', 'no inner preview frame');
        assert.notEqual(focusStyle.selectedTransform,'none', 'found bottle is additionally highlighted');
        assert.notEqual(focusStyle.selectedFilter,'none', 'found bottle receives a visible emphasis');
        assert.ok(focusStyle.dimmedOpacity !== null && Number(focusStyle.dimmedOpacity) < 1, 'other bottles are visually reduced');
        assert.equal(focusStyle.badgeCount,0, 'no exclamation mark over the found bottle');
        await page.locator('[data-act="warehouse-return-find"]').click();
        assert.equal(await page.locator('#warehouse-search').inputValue(),'098712');
        assert.equal(await page.locator('input[name="warehouse-find-placement"][value="assigned"]').isChecked(),true);
        await result.locator('[data-act="warehouse-assign"]').click();
        const form = page.locator('#modal-root #warehouse-form');
        await form.waitFor();
        assert.equal(await form.locator('.warehouse-assignment-current strong').innerText(),
            'Suchraum / Testvitrine / Fach 2');
        await page.locator('#modal-root .dialog-head [data-act="close-modal"]').click();
        await result.locator('[data-act="warehouse-find-location"]').click();
        await page.locator('[data-act="warehouse-find-clear"]').click();
        assert.equal(await page.locator('.warehouse-tabs [data-section="shelves"]').getAttribute('aria-current'),'page');
        assert.equal(await page.locator('.warehouse-find-return').count(),0);
        assert.equal(await page.locator('.warehouse-wall-bay.is-find-focus').count(),0);
        assert.equal(await page.locator('.warehouse-wall-bottle.is-find-focus, .warehouse-wall-bottle.is-find-dimmed').count(),0);
    });
});

test('browser: warehouse room plan mounts local Three.js and keeps the 2D plan available', async () => {
    await session(async ({base,page,open})=>{
        const room=await requestJson(base,'/api/warehouse/rooms','POST',{name:'3D-Raum',width:5,height:4});
        assert.equal(room.status,201);
        const rack=await requestJson(base,`/api/warehouse/rooms/${room.data.id}/furniture`,'POST',
            {name:'Offenes Regal',type:'regal',x:0.3,y:0.2,width:1.7,depth:0.6,rotation:0,elevation:0,itemHeight:1.8});
        assert.equal(rack.status,201);
        // Only furniture with configured shelves appears in the room-wide shelf wall.
        const shelf=await requestJson(base,`/api/warehouse/furniture/${rack.data.id}/shelves`,'POST',
            {name:'Regalfach',capacity:6});
        assert.equal(shelf.status,201);
        await open();
        await page.locator('header [data-act="toggle-menu"]').click();
        await page.locator('#site-drawer [data-act="goto-warehouse"]').click();
        await page.locator('.warehouse-tabs [data-section="rooms"]').click();
        assert.equal(await page.locator('[data-act="warehouse-plan-mode"][data-mode="3d"]').getAttribute('aria-pressed'),'true');
        assert.equal(await page.locator('.warehouse-three-viewport').count(),1);
        for(const corner of ['nw','ne','se','sw']){
            await page.locator(`[data-act="warehouse-camera"][data-corner="${corner}"]`).click();
            assert.equal(await page.locator(`[data-act="warehouse-camera"][data-corner="${corner}"]`).getAttribute('aria-pressed'),'true');
        }
        const eye=page.locator('.warehouse-bulk-visibility').first();
        assert.equal(await eye.locator('svg.warehouse-eye-icon').count(),1);
        assert.equal(await eye.getAttribute('aria-label'),'Offenes Regal ausblenden');
        const tile=page.locator('.warehouse-bulk-item').first();
        await tile.hover();
        if (await page.locator('.warehouse-three-canvas').count()) {
            await page.waitForFunction(() => document.querySelector('.warehouse-three-canvas')?.dataset.highlightedFurniture !== '');
            assert.equal(await page.locator('.warehouse-three-canvas').getAttribute('data-highlighted-furniture'),rack.data.id);
            await page.locator('.warehouse-bulk-head').hover();
            assert.equal(await page.locator('.warehouse-three-canvas').getAttribute('data-highlighted-furniture'),'');
        }
        await eye.click();
        assert.equal(await page.locator('.warehouse-bulk-visibility').first().getAttribute('aria-pressed'),'false');
        assert.equal(await page.locator('.warehouse-bulk-visibility').first().getAttribute('aria-label'),'Offenes Regal einblenden');
        assert.equal(await page.locator('.warehouse-bulk-item.is-hidden').count(),1);
        assert.equal(await page.locator('.warehouse-camera-toolbar [data-act="warehouse-iso-clear"]').count(),0);
        await page.locator('.warehouse-bulk-visibility').first().click();
        assert.equal(await page.locator('.warehouse-bulk-visibility').first().getAttribute('aria-pressed'),'true');
        assert.equal(await page.locator('.warehouse-bulk-item.is-hidden').count(),0);
        await page.locator('#warehouse-plan-zoom').selectOption('150');
        assert.equal(await page.locator('#warehouse-plan-zoom').inputValue(),'150');
        await page.locator('.warehouse-bulk-open').first().click();
        assert.equal(await page.locator('.warehouse-furniture-panel').count(),0,'room plan does not edit shelves');
        await page.locator('[data-act="warehouse-open-shelves"]').click();
        assert.equal(await page.locator('.warehouse-tabs [data-section="shelves"]').getAttribute('aria-current'),'page');
        assert.equal(await page.locator('.warehouse-furniture-panel').count(),0,'editing is confined to a modal');
        // Editing is only accessible through the furniture icon in Regale & Faecher.
        await page.locator(`.warehouse-wall-furniture-edit[data-id="${rack.data.id}"]`).click();
        assert.equal(await page.locator('#modal-root .warehouse-furniture-panel').count(),1,'furniture management opens in a modal');
        // Compartment and bottle actions precede the photos; both upload controls
        // use the existing compact bottle-gallery style.
        const managerLayout = await page.locator('#modal-root .warehouse-furniture-panel').evaluate(panel => {
            const measure = selector => {
                const rect = panel.querySelector(selector).getBoundingClientRect();
                return {left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,width:rect.width,height:rect.height};
            };
            return {actions:measure('.warehouse-furniture-actions'),photos:measure('.warehouse-furniture-photos'),
                upload:measure('.warehouse-furniture-photo-actions .photo-add'),
                camera:measure('.warehouse-furniture-photo-actions .photo-capture')};
        });
        assert.ok(managerLayout.actions.bottom < managerLayout.photos.top, 'action buttons appear above photos');
        assert.ok(managerLayout.upload.width <= 200, 'upload action must not fill dialog width');
        assert.ok(managerLayout.upload.height <= 45, 'upload button has bottle-gallery compact height');
        assert.ok(managerLayout.camera.height <= 45, 'camera button matches bottle-gallery height');
        assert.ok(managerLayout.upload.right < managerLayout.camera.left, 'upload actions stay side by side at desktop width');
        await page.locator('#modal-root .dialog-head [data-act="close-modal"]').click();
        await page.locator('.warehouse-tabs [data-section="rooms"]').click();
        await page.locator('.warehouse-tabs [data-section="rooms"]').click();
        await page.locator('[data-act="warehouse-plan-mode"][data-mode="2d"]').click();
        assert.equal(await page.locator('.warehouse-floor').count(),1);
        assert.equal(await page.locator('.warehouse-three-viewport').count(),0);
    });
});



test('browser: room and compact furniture strip stay together; show all restores hidden items', async () => {
    await session(async ({base,page,open}) => {
        const roomResult=await requestJson(base,'/api/warehouse/rooms','POST',{name:'Kompakter Raum',width:10,height:6});
        const room=roomResult.data;
        for (let i=0;i<13;i++) {
            const result=await requestJson(base,`/api/warehouse/rooms/${room.id}/furniture`,'POST',{
                name:`Testregal ${i+1}`,type:'regal',x:(i%5)*1.7+0.1,y:Math.floor(i/5)*1.1+0.1,
                width:1.2,depth:.5,rotation:0,elevation:0,itemHeight:1.6,
            });
            assert.equal(result.status,201,`furniture ${i+1} should be created`);
        }
        await open();
        await page.locator('header [data-act="toggle-menu"]').click();
        await page.locator('#site-drawer [data-act="goto-warehouse"]').click();
        await page.locator('.warehouse-tabs [data-section="rooms"]').click();
        await page.locator('#warehouse-room-select').selectOption(room.id);
        assert.equal(await page.locator('.warehouse-plan-workspace').count(),1);
        assert.equal(await page.locator('.warehouse-bulk-item').count(),13);
        assert.equal(await page.locator('[data-act="warehouse-show-all"]').isDisabled(),true);
        const desktop=await page.evaluate(()=>{
            const stage=document.querySelector('.warehouse-plan-stage').getBoundingClientRect();
            const aside=document.querySelector('.warehouse-bulk-panel--sidebar').getBoundingClientRect();
            const list=document.querySelector('.warehouse-bulk-panel--sidebar .warehouse-bulk-list');
            return {stage:{left:stage.left,right:stage.right,top:stage.top,bottom:stage.bottom},aside:{left:aside.left,top:aside.top,bottom:aside.bottom},scrollHeight:list.scrollHeight,clientHeight:list.clientHeight};
        });
        assert.ok(desktop.stage.right<=desktop.aside.left,`sidebar must be beside 3D scene: ${JSON.stringify(desktop)}`);
        assert.ok(Math.abs(desktop.stage.top-desktop.aside.top)<2,`scene and controls must start at same height: ${JSON.stringify(desktop)}`);
        assert.ok(desktop.scrollHeight>desktop.clientHeight,`long furniture list must scroll inside sidebar: ${JSON.stringify(desktop)}`);
        const eyes=page.locator('.warehouse-bulk-visibility');
        await eyes.nth(0).click();
        await eyes.nth(1).click();
        assert.equal(await page.locator('.warehouse-bulk-item.is-hidden').count(),2);
        assert.equal(await page.locator('[data-act="warehouse-show-all"]').isEnabled(),true);
        await page.locator('[data-act="warehouse-show-all"]').click();
        assert.equal(await page.locator('.warehouse-bulk-item.is-hidden').count(),0);
        assert.equal(await page.locator('[data-act="warehouse-show-all"]').isDisabled(),true);
        assert.equal(await page.locator('.warehouse-bulk-visibility[aria-pressed="true"]').count(),13);
        assert.equal(await page.locator('.warehouse-bulk-check:checked').count(),0,'show all must not modify bulk selection');
        await page.setViewportSize({width:390,height:844});
        const mobile=await page.evaluate(()=>{
            const stage=document.querySelector('.warehouse-plan-stage').getBoundingClientRect();
            const aside=document.querySelector('.warehouse-bulk-panel--sidebar').getBoundingClientRect();
            const list=document.querySelector('.warehouse-bulk-panel--sidebar .warehouse-bulk-list');
            return {stageBottom:stage.bottom,asideTop:aside.top,stripWidth:list.clientWidth,scrollWidth:list.scrollWidth,pageWidth:document.body.scrollWidth,viewportWidth:document.body.getBoundingClientRect().width};
        });
        assert.ok(mobile.asideTop>=mobile.stageBottom-2,`compact horizontal list must be immediately below the 3D scene: ${JSON.stringify(mobile)}`);
        assert.ok(mobile.scrollWidth>mobile.stripWidth,`many furniture cards must scroll horizontally: ${JSON.stringify(mobile)}`);
        assert.ok(mobile.pageWidth<=mobile.viewportWidth+2,`no horizontal page overflow: ${JSON.stringify(mobile)}`);
    });
});



test('browser: shelf overview keeps decorative bottles inert; furniture and rack can open bottle previews', async () => {
    await session(async ({base,page,open}) => {
        const created = await seed(base, '098765');
        const room = (await requestJson(base,'/api/warehouse/rooms','POST',{name:'Flaschenraum',width:4,height:4})).data;
        const furniture = (await requestJson(base,`/api/warehouse/rooms/${room.id}/furniture`,'POST',
            {name:'Testregal',type:'regal',x:.3,y:.3,width:1,depth:.5,rotation:0,elevation:0,itemHeight:1.8})).data;
        const shelf = (await requestJson(base,`/api/warehouse/furniture/${furniture.id}/shelves`,'POST',
            {name:'Flaschenfach',capacity:6})).data;
        const allocation = await requestJson(base,`/api/warehouse/bottles/${created.bottle.id}`,'PUT',{shelfId:shelf.id});
        assert.equal(allocation.status,200);
        await open();
        await page.locator('header [data-act="toggle-menu"]').click();
        await page.locator('#site-drawer [data-act="goto-warehouse"]').click();
        await page.locator('.warehouse-tabs [data-section="shelves"]').click();
        await page.locator('#warehouse-room-select').selectOption(room.id);
        // Furniture modal -> bottle modal -> furniture modal must preserve context.
        await page.locator(`.warehouse-wall-furniture-edit[data-id="${furniture.id}"]`).click();
        const manager = page.locator('#modal-root .warehouse-furniture-manager');
        assert.equal(await manager.locator('.warehouse-shelf').count(),1);
        const managedBottle = manager.locator(`.warehouse-bottle-symbol[data-id="${created.bottle.id}"][data-act="warehouse-bottle-preview"]`);
        assert.equal(await managedBottle.count(),1);
        await managedBottle.click();
        assert.equal(await page.locator('#modal-root .warehouse-bottle-preview').count(),1);
        await page.locator('#modal-root .dialog-head [data-act="close-modal"]').click();
        assert.equal(await manager.locator('.warehouse-shelf').count(),1,'closing bottle preview returns to furniture modal');

        // Shelf editing itself is another nested modal, with a return to its parent.
        await manager.locator('[data-act="warehouse-shelf-edit"]').click();
        assert.equal(await page.locator('#modal-root #warehouse-form').count(),1);
        await page.locator('#modal-root .dialog-head [data-act="close-modal"]').click();
        assert.equal(await manager.locator('.warehouse-shelf').count(),1,'closing shelf edit returns to furniture modal');

        // The shelf overview is read-only: clicking a bottle image never opens
        // a bottle preview, but relocation remains available on each card.
        await manager.locator('.warehouse-shelf-head strong').first().dblclick();
        const shelfOverview = page.locator('#modal-root .warehouse-shelf-detail-grid');
        assert.equal(await shelfOverview.count(),1);
        const decorativeBottle = shelfOverview.locator('.warehouse-bottle-static');
        assert.equal(await decorativeBottle.count(),1);
        assert.equal(await shelfOverview.locator('[data-act="warehouse-bottle-preview"]').count(),0);
        // Decorative images deliberately ignore pointer events; a physical
        // click on their image area reaches the card and must stay inert.
        const bottleBounds=await decorativeBottle.boundingBox();
        assert.ok(bottleBounds,'decorative bottle image must be visible');
        await page.mouse.click(bottleBounds.x+bottleBounds.width/2,bottleBounds.y+bottleBounds.height/2);
        assert.equal(await page.locator('#modal-root .warehouse-shelf-detail-grid').count(),1);
        assert.equal(await page.locator('#modal-root .warehouse-bottle-preview').count(),0);
        await shelfOverview.locator(`[data-act="warehouse-assign"][data-id="${created.bottle.id}"]`).click();
        assert.equal(await page.locator('#modal-root #warehouse-form').count(),1);
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#modal-root .warehouse-shelf-detail-grid').count(),1,'Escape returns to shelf overview from relocation');
        await page.locator('#modal-root .dialog-head [data-act="close-modal"]').click();
        assert.equal(await manager.locator('.warehouse-shelf').count(),1,'closing compartment overview returns to furniture modal');
        await page.locator('#modal-root .dialog-head [data-act="close-modal"]').click();
        assert.equal(await page.locator('#modal-root [role="dialog"]').count(),0);

        // A click still selects for batch relocation, a double-click opens bottle details.
        const symbol = page.locator(`.warehouse-room-wall .warehouse-bottle-symbol[data-id="${created.bottle.id}"]`);
        await symbol.click();
        assert.equal(await symbol.getAttribute('aria-pressed'),'true');
        await symbol.dblclick();
        const dialog = page.locator('#modal-root [role="dialog"]');
        await dialog.waitFor();
        assert.equal(await dialog.locator('.warehouse-bottle-preview').count(),1);
        assert.match(await dialog.textContent(),/Browser Test Blend/);
        assert.match(await dialog.textContent(),/098765/);
        assert.match(await dialog.textContent(),/Inventarnummer/);
        assert.match(await dialog.textContent(),/46 % Vol\./);
        assert.match(await dialog.textContent(),/Status/);
        assert.equal(await dialog.locator('#warehouse-form').count(),0,'preview must not open relocation form immediately');
        const link = dialog.getByRole('link',{name:'Zu den Flaschendetails'});
        assert.equal(await link.getAttribute('href'),`/?bottling=${created.bottling.id}`);
        await dialog.locator('[data-act="warehouse-assign"]').click();
        assert.equal(await page.locator('#warehouse-form').count(),1,'relocation opens as a nested modal');
        const assign = page.locator('#warehouse-form');
        assert.equal(await assign.locator('[data-assignment-room]').inputValue(),room.id);
        assert.equal(await assign.locator('[data-assignment-furniture]').inputValue(),furniture.id);
        assert.equal(await assign.locator('[data-assignment-shelf]').inputValue(),shelf.id);
        assert.match(await assign.locator('.warehouse-assignment-current').innerText(),/Flaschenraum \/ Testregal \/ Flaschenfach/);
        assert.equal(await page.locator('#modal-root .dialog-head h2').innerText(), 'Lagerort');
        assert.equal(await assign.locator('summary, details').count(), 0,
            'relocation must never require a second click on Lagerort ändern');
        assert.equal(await assign.locator('[data-assignment-room]').isVisible(), true);
        assert.equal(await assign.locator('[data-assignment-furniture]').isVisible(), true);
        assert.equal(await assign.locator('[data-assignment-shelf]').isVisible(), true);
        // Desktop relocation is compact without hiding its controls: the bottle
        // and current location share a row and the three selectors share another.
        const compact = await assign.evaluate(element => {
            const dialog = element.closest('.dialog').getBoundingClientRect();
            const bottle = element.querySelector('.warehouse-assignment-bottle').getBoundingClientRect();
            const current = element.querySelector('.warehouse-assignment-current').getBoundingClientRect();
            const selectors = element.querySelector('.warehouse-assignment-selectors');
            return { dialogWidth:dialog.width, dialogHeight:dialog.height,
                bottleTop:bottle.top, currentTop:current.top,
                columns:getComputedStyle(selectors).gridTemplateColumns.split(' ').length };
        });
        assert.ok(compact.dialogWidth <= 742, `relocation modal should not span the full page: ${JSON.stringify(compact)}`);
        assert.ok(Math.abs(compact.bottleTop - compact.currentTop) <= 2,
            `bottle and current location must share one row: ${JSON.stringify(compact)}`);
        assert.equal(compact.columns, 3, 'desktop relocation choices fit on one row');
        await assign.locator('.warehouse-form-actions [type="submit"]').waitFor({state:'visible'});
        const radioStyle = await assign.locator('.warehouse-assignment-modes input[type="radio"]').first().evaluate(input => {
            const style = getComputedStyle(input);
            const bounds = input.getBoundingClientRect();
            return {width:bounds.width,height:bounds.height,appearance:style.appearance};
        });
        assert.ok(Math.abs(radioStyle.width - 18) < 1 && Math.abs(radioStyle.height - 18) < 1,
            `assignment radios should retain an 18px control instead of text-field dimensions: ${JSON.stringify(radioStyle)}`);
        assert.equal(radioStyle.appearance, 'auto');
        assert.match(await assign.locator('.warehouse-assignment-feedback').innerText(),/1 von 6/);
        // A tall real bottle photo used to inflate the CSS grid's intrinsic row
        // beyond the fixed preview frame, silently cropping the bottom in Chrome.
        await assign.evaluate(element => {
            const photo = element.querySelector('.warehouse-assignment-photo');
            const image = document.createElement('img');
            image.alt = '';
            image.src = 'data:image/svg+xml,' + encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="2400">'
                + '<rect width="600" height="2400" fill="green"/>'
                + '<rect y="2300" width="600" height="100" fill="red"/>'
                + '</svg>');
            photo.replaceChildren(image);
        });
        await assign.locator('.warehouse-assignment-photo img').evaluate(image => image.decode());
        const checkPhotoSize = async () => {
            const bounds = await assign.evaluate(element => {
                const frame = element.querySelector('.warehouse-assignment-photo').getBoundingClientRect();
                const image = element.querySelector('.warehouse-assignment-photo img').getBoundingClientRect();
                return {frame:{x:frame.x,y:frame.y,w:frame.width,h:frame.height},
                    image:{x:image.x,y:image.y,w:image.width,h:image.height},
                    fit:getComputedStyle(element.querySelector('.warehouse-assignment-photo img')).objectFit};
            });
            assert.equal(bounds.fit,'contain');
            assert.ok(bounds.image.x >= bounds.frame.x - 1 && bounds.image.y >= bounds.frame.y - 1
                && bounds.image.x + bounds.image.w <= bounds.frame.x + bounds.frame.w + 1
                && bounds.image.y + bounds.image.h <= bounds.frame.y + bounds.frame.h + 1,
                `tall bottle photo must fit entirely in preview: ${JSON.stringify(bounds)}`);
        };
        await checkPhotoSize();
        await assign.locator('[name="warehouseAssignmentMode"][value="none"]').check();
        assert.equal(await assign.locator('[data-assignment-room]').isDisabled(),true);
        assert.equal(await assign.locator('[data-assignment-shelf]').isDisabled(),true);
        await assign.locator('[name="warehouseAssignmentMode"][value="shelf"]').check();
        assert.equal(await assign.locator('[data-assignment-shelf]').isEnabled(),true);
        await page.setViewportSize({width:390,height:844});
        const assignmentFrame = await assign.evaluate(element => ({
            width: element.closest('.dialog').getBoundingClientRect().width,
            viewport: document.documentElement.clientWidth,
            columns: getComputedStyle(element.querySelector('.warehouse-assignment-selectors')).gridTemplateColumns.split(' ').length,
        }));
        assert.ok(assignmentFrame.width <= assignmentFrame.viewport + 1, 'dialog must fit mobile width');
        assert.equal(assignmentFrame.columns,1,'mobile assignment selects should stack vertically');
        await checkPhotoSize();
        await page.locator('#modal-root .dialog-head [data-act="close-modal"]').first().click();
        assert.equal(await page.locator('#modal-root .warehouse-bottle-preview').count(),1,
            'closing relocation restores the bottle modal');
        await page.locator('#modal-root [data-act="open"]').click();
        await page.locator(`#bottle-${created.bottle.id}.scanned-bottle`).waitFor();
        assert.equal(await page.locator('#modal-root [role="dialog"]').count(),0);
    });
});



test('browser: Umlagern directly offers destination selectors and saves a different shelf', async () => {
    await session(async ({base,page,open}) => {
        const {bottle} = await seed(base, '098766');
        const room = (await requestJson(base, '/api/warehouse/rooms', 'POST',
            {name:'Umlagerraum',width:4,height:4})).data;
        const rack = (await requestJson(base, `/api/warehouse/rooms/${room.id}/furniture`, 'POST',
            {name:'Umlagerregal',type:'regal',x:.3,y:.3,width:1,depth:.5,rotation:0,elevation:0,itemHeight:1.8})).data;
        const first = (await requestJson(base, `/api/warehouse/furniture/${rack.id}/shelves`, 'POST',
            {name:'Bisheriges Fach',capacity:5})).data;
        const target = (await requestJson(base, `/api/warehouse/furniture/${rack.id}/shelves`, 'POST',
            {name:'Zielfach',capacity:5})).data;
        assert.equal((await requestJson(base, `/api/warehouse/bottles/${bottle.id}`,
            'PUT', {shelfId:first.id})).status, 200);
        await open();
        await page.locator('header [data-act="toggle-menu"]').click();
        await page.locator('#site-drawer [data-act="goto-warehouse"]').click();
        await page.locator('.warehouse-tabs [data-section="find"]').click();
        await page.locator(`[data-act="warehouse-assign"][data-id="${bottle.id}"]`).click();
        const form = page.locator('#modal-root #warehouse-form');
        await form.waitFor();
        assert.equal(await form.locator('.warehouse-assignment-current strong').innerText(),
            'Umlagerraum / Umlagerregal / Bisheriges Fach');
        assert.equal(await form.locator('summary, details').count(), 0);
        for (const field of ['room','furniture','shelf']) {
            assert.equal(await form.locator(`[data-assignment-${field}]`).isVisible(),true,
                `${field} must be selectable immediately after Umlagern`);
        }
        assert.equal(await form.locator('button[type="submit"]').isVisible(),true,
            'Speichern must be available without clicking Lagerort ändern');
        await form.locator('[data-assignment-shelf]').selectOption(target.id);
        await form.locator('button[type="submit"]').click();
        await form.waitFor({state:'detached'});
        const stored = await requestJson(base, '/api/warehouse');
        assert.equal(stored.status,200);
        assert.equal(stored.data.assignments[bottle.id],target.id,
            'Umlagern must persist the chosen shelf, not the original shelf');
        await page.locator(`[data-act="warehouse-assign"][data-id="${bottle.id}"]`).click();
        await form.waitFor();
        assert.match(await form.locator('.warehouse-assignment-current strong').innerText(),/Zielfach/);
        await form.locator('[name="warehouseAssignmentMode"][value="none"]').check();
        assert.equal(await form.locator('[data-assignment-shelf]').isDisabled(),true);
        await form.locator('button[type="submit"]').click();
        await form.waitFor({state:'detached'});
        const unassigned = await requestJson(base, '/api/warehouse');
        assert.equal(unassigned.status,200);
        assert.equal(unassigned.data.assignments[bottle.id] ?? null, null,
            'Ohne Lagerort should be saved without opening an extra editor');
    });
});

test('browser: bottle detail Umlagern opens the same compact destination form', async () => {
    await session(async ({base,page,open}) => {
        const created = await seed(base,'033321');
        await open({query:`?bottling=${created.bottling.id}`});
        const relocate = page.locator(`#bottle-${created.bottle.id} .bottle-entry-actions [data-act="warehouse-assign"]`);
        await relocate.waitFor();
        assert.equal(await relocate.innerText(), 'Umlagern');
        await relocate.click();
        const form = page.locator('#modal-root .warehouse-assignment-form');
        await form.waitFor();
        assert.equal(await form.locator('details, summary').count(),0);
        for (const key of ['room','furniture','shelf']) {
            assert.equal(await form.locator(`[data-assignment-${key}]`).isVisible(),true,
                `${key} must be immediately available from bottle details`);
        }
        assert.equal(await form.locator('button[type="submit"]').isVisible(), true);
        await page.setViewportSize({width:390,height:844});
        const mobile = await form.evaluate(element => ({
            width:element.closest('.dialog').getBoundingClientRect().width,
            viewport:document.documentElement.clientWidth,
            columns:getComputedStyle(element.querySelector('.warehouse-assignment-selectors')).gridTemplateColumns.split(' ').length
        }));
        assert.ok(mobile.width <= mobile.viewport + 1, `modal must fit mobile viewport: ${JSON.stringify(mobile)}`);
        assert.equal(mobile.columns,1,'mobile selectors must be stacked and usable');
    });
});

test('browser: room plan positions furniture; shelf tab owns wall, editing and bottles', async () => {
    await session(async ({base,page,open}) => {
        const room=(await requestJson(base,'/api/warehouse/rooms','POST',{name:'Scrollraum',width:5,height:4})).data;
        const furniture=(await requestJson(base,`/api/warehouse/rooms/${room.id}/furniture`,'POST',
            {name:'Klickregal',type:'regal',x:0.5,y:0.5,width:1,depth:.5,rotation:0,elevation:0,itemHeight:1.5})).data;
        await requestJson(base,`/api/warehouse/furniture/${furniture.id}/shelves`,'POST',{name:'Testfach',capacity:2});
        await open();
        await page.locator('header [data-act="toggle-menu"]').click();
        await page.locator('#site-drawer [data-act="goto-warehouse"]').click();
        await page.locator('.warehouse-tabs [data-section="rooms"]').click();
        await page.locator('#warehouse-room-select').selectOption(room.id);
        await page.locator('[data-act="warehouse-plan-mode"][data-mode="2d"]').click();
        assert.equal(await page.locator('.warehouse-floor').count(),1);
        assert.equal(await page.locator('.warehouse-bulk-item').count(),1);
        assert.equal(await page.locator('.warehouse-room-wall').count(),0);
        assert.equal(await page.locator('.warehouse-furniture-panel').count(),0);
        assert.equal(await page.locator('.warehouse-bulk-check').count(),0,'no furniture bulk actions in room plans');
        assert.equal(await page.locator('.warehouse-plan-tools [data-act="warehouse-furniture-new"]').count(),1);
        await page.locator('.warehouse-bulk-open').click();
        assert.equal(await page.locator('.warehouse-bulk-open').getAttribute('aria-current'),'true');
        assert.equal(await page.locator('.warehouse-plan-focus-info').count(),1,'selecting furniture in Raumpläne shows position and a usable destination');
        assert.equal(await page.locator('.warehouse-furniture-panel').count(),0);
        await page.locator('[data-act="warehouse-open-shelves"]').click();
        assert.equal(await page.locator('.warehouse-tabs [data-section="shelves"]').getAttribute('aria-current'),'page');
        assert.equal(await page.locator('.warehouse-room-wall').count(),1);
        assert.equal(await page.locator('.warehouse-floor').count(),0);
        assert.equal(await page.locator('[data-act="warehouse-furniture-new"]').count(),1);
        assert.equal(await page.locator('.warehouse-furniture-panel').count(),0,'shelf wall is the only visible furniture view');
        await page.locator('.warehouse-wall-furniture-edit').first().click();
        assert.equal(await page.locator('#modal-root .warehouse-furniture-panel .warehouse-shelf').count(),1);
        assert.equal(await page.locator('#modal-root .warehouse-furniture-panel .warehouse-bottle-symbol').count(),0,
            'empty shelf has no bottle thumbnails');
        assert.equal(await page.locator('#modal-root .warehouse-bulk-list').count(),0,
            'individual furniture dialog must never contain a furniture picker');
        await page.locator('#modal-root [data-act="close-modal"]').click();
        await page.locator('[data-act="warehouse-furniture-bulk"]').click();
        assert.equal(await page.locator('#modal-root .warehouse-furniture-panel').count(),0);
        const item=page.locator('#modal-root .warehouse-bulk-pick').first();
        assert.equal(await item.getAttribute('aria-pressed'),'false');
        await item.click();
        assert.equal(await item.getAttribute('aria-pressed'),'true');
        assert.equal(await page.locator('#modal-root .warehouse-bulk-item.is-selected').count(),1);
        assert.equal(await page.locator('.warehouse-bulk-delete-btn').isEnabled(),true);
        await item.click();
        assert.equal(await item.getAttribute('aria-pressed'),'false');
        await page.locator('#modal-root [data-act="close-modal"]').click();
        for (const action of ['warehouse-room-new','warehouse-room-edit','warehouse-room-delete'])
            assert.equal(await page.locator(`.warehouse-room-toolbar [data-act="${action}"]`).count(),0);
        await page.locator('.warehouse-tabs [data-section="rooms"]').click();
        for (const action of ['warehouse-room-new','warehouse-room-edit','warehouse-room-delete'])
            assert.equal(await page.locator(`.warehouse-room-toolbar [data-act="${action}"]`).count(),1);
        await page.locator('[data-act="warehouse-plan-mode"][data-mode="2d"]').click();
        await page.locator('.warehouse-floor .warehouse-drag').dblclick();
        await page.locator('#warehouse-form [name="name"]').waitFor();
        assert.equal(await page.locator('#warehouse-form [name="name"]').inputValue(),'Klickregal');
        assert.equal(await page.locator('.warehouse-tabs [data-section="shelves"]').getAttribute('aria-current'),'page',
            'editing furniture from the plan opens shelf management');
    });
});



test('browser: 3D viewport either renders WebGL canvas or clearly reports unavailable WebGL', async()=>{
    await session(async({base,page,open})=>{
        const room=await requestJson(base,'/api/warehouse/rooms','POST',{name:'Tiefentest',width:4,height:4});
        const baseFurniture=await requestJson(base,`/api/warehouse/rooms/${room.data.id}/furniture`,'POST',
            {name:'Unterschrank',type:'schrank',x:0.5,y:0.5,width:2,depth:0.6,rotation:0,elevation:0,itemHeight:1.8});
        const upper=await requestJson(base,`/api/warehouse/rooms/${room.data.id}/furniture`,'POST',
            {name:'Hängeregal',type:'haengeregal',x:0.5,y:0.5,width:2,depth:0.6,rotation:0,elevation:1.9,itemHeight:0.4});
        assert.equal(baseFurniture.status,201);assert.equal(upper.status,201);
        await open();await page.locator('header [data-act="toggle-menu"]').click();
        await page.locator('#site-drawer [data-act="goto-warehouse"]').click();
        await page.locator('.warehouse-tabs [data-section="rooms"]').click();
        await page.locator('[data-act="warehouse-plan-mode"][data-mode="3d"]').click();
        await page.waitForFunction(()=>!!document.querySelector('.warehouse-three-canvas')||
            /nicht verf.gbar/.test(document.querySelector('.warehouse-three-viewport')?.textContent||''));
        const viewport=page.locator('.warehouse-three-viewport');
        const canvas=viewport.locator('.warehouse-three-canvas');
        if(await canvas.count()){
            const size=await canvas.evaluate(el=>({width:el.width,height:el.height}));
            assert.ok(size.width>10&&size.height>10,'live WebGL canvas has real dimensions');
        }else{
            assert.match(await viewport.textContent(),/nicht verfügbar/);
        }
        const data=await requestJson(base,'/api/warehouse');
        assert.equal(data.data.rooms[0].furniture.length,2);
    });
});



test('browser: 2D furniture drag stops at a physical obstacle but permits non-overlapping heights', async () => {
    await session(async ({base,page,open})=>{
        const room=(await requestJson(base,'/api/warehouse/rooms','POST',{name:'Kollisionsraum',width:4,height:3})).data;
        const post=async (name,x,elevation=0)=>(await requestJson(base,`/api/warehouse/rooms/${room.id}/furniture`,'POST',
            {name,type:'schrank',x,y:.2,width:.5,depth:.5,rotation:0,elevation,itemHeight:.6})).data;
        const moving=await post('Beweglich',.2);
        await post('Hindernis',1.2);
        const elevated=await post('Wandregal',1.2,.6);
        await open();
        await page.locator('header [data-act="toggle-menu"]').click();
        await page.locator('#site-drawer [data-act="goto-warehouse"]').click();
        await page.locator('.warehouse-tabs [data-section="rooms"]').click();
        await page.locator('[data-act="warehouse-plan-mode"][data-mode="2d"]').click();
        const plan=page.locator('.warehouse-floor');
        await plan.waitFor();
        assert.ok(await page.locator('.warehouse-grid-fine').count()>0);
        const planRect=await plan.boundingBox();
        const scale=planRect.width/4;
        const dragFurniture=async (id, deltaMetres) => {
            const el=page.locator(`.warehouse-drag[data-id="${id}"]`);
            const rect=await el.boundingBox();
            const x=rect.x+rect.width/2,y=rect.y+rect.height/2;
            await page.mouse.move(x,y);
            await page.mouse.down();
            await page.mouse.move(x+deltaMetres*scale,y,{steps:1});
            await page.mouse.up();
            await page.waitForTimeout(120);
        };
        await dragFurniture(moving.id,2.4);
        const blocked=(await requestJson(base,'/api/warehouse')).data.rooms[0].furniture.find(f=>f.id===moving.id);
        assert.ok(blocked.x<=.71 && blocked.x>=.61,`collision stops drag near cabinet: ${blocked.x}`);
        await page.locator('#warehouse-plan-layer').selectOption('elevated');
        await dragFurniture(elevated.id,1.5);
        const updated=(await requestJson(base,'/api/warehouse')).data.rooms[0].furniture.find(f=>f.id===elevated.id);
        assert.ok(updated.x>2.5,`elevated shelf can move above floor cabinet: ${updated.x}`);
    });
});



test('browser: overview room cards show static 3D room previews and still open the room plan', async () => {
    await session(async ({base,page,open}) => {
        const room = (await requestJson(base, '/api/warehouse/rooms', 'POST',
            {name:'Raumvorschau', width:4, height:3})).data;
        const furniture = await requestJson(base, `/api/warehouse/rooms/${room.id}/furniture`, 'POST',
            {name:'Vorschau-Regal',type:'regal',x:0.3,y:0.6,width:1.2,depth:0.5,rotation:0,elevation:0,itemHeight:1.8});
        assert.equal(furniture.status, 201);
        await open();
        await page.locator('header [data-act="toggle-menu"]').click();
        await page.locator('#site-drawer [data-act="goto-warehouse"]').click();
        const card = page.locator(`.warehouse-room-card[data-id="${room.id}"]`);
        await card.waitFor();
        const preview = card.locator('.warehouse-room-preview');
        await preview.waitFor();
        await page.waitForFunction(id => {
            const node = document.querySelector(`.warehouse-room-card[data-id="${id}"] .warehouse-room-preview`);
            return node?.dataset.previewState === 'ready' || node?.dataset.previewState === 'unavailable';
        }, room.id);
        if (await preview.locator('img').count()) {
            assert.equal(await preview.locator('img').evaluate(img => img.naturalWidth === 360 && img.naturalHeight === 210), true,
                'static image is rendered at thumbnail resolution');
            assert.ok((await preview.locator('img').getAttribute('src')).startsWith('data:image/png;base64,'));
        } else {
            assert.match(await preview.textContent(), /nicht verfügbar/, 'fallback if WebGL is blocked');
        }
        const positions = await card.evaluate(el => {
            const image = el.querySelector('.warehouse-room-preview').getBoundingClientRect();
            const details = el.querySelector('.warehouse-room-card-details').getBoundingClientRect();
            return { image: { x:image.x, width:image.width, height:image.height }, details:{ x:details.x } };
        });
        assert.ok(positions.image.width <= 114 && positions.image.height <= 72, 'thumbnail stays compact');
        assert.ok(positions.details.x > positions.image.x + positions.image.width, 'text sits beside the thumbnail');
        await card.click();
        await page.locator('.warehouse-three-viewport').waitFor();
    });
});




test('browser: eye icons independently hide and show furniture without selecting its checkbox', async () => {
    await session(async ({base,page,open}) => {
        const room=await requestJson(base,'/api/warehouse/rooms','POST',{name:'Sichtbarkeit',width:5,height:4});
        assert.equal(room.status,201);
        for(const [name,x] of [['Linkes Regal',0.4],['Rechtes Regal',2.5]]) {
            const result=await requestJson(base,`/api/warehouse/rooms/${room.data.id}/furniture`,'POST',
                {name,type:'regal',x,y:0.3,width:1,depth:0.5,rotation:0,elevation:0,itemHeight:1.8});
            assert.equal(result.status,201);
        }
        await open();
        await page.locator('header [data-act="toggle-menu"]').click();
        await page.locator('#site-drawer [data-act="goto-warehouse"]').click();
        await page.locator('.warehouse-tabs [data-section="rooms"]').click();
        const eyes=page.locator('.warehouse-bulk-visibility');
        assert.equal(await eyes.count(),2);
        assert.equal(await eyes.first().getAttribute('aria-pressed'),'true');
        assert.equal(await eyes.last().getAttribute('aria-pressed'),'true');
        const dims=await eyes.first().evaluate(el=>({button:el.getBoundingClientRect().width,icon:el.querySelector('svg').getBoundingClientRect().width}));
        assert.ok(dims.button>=44 && dims.icon>=27,JSON.stringify(dims));
        await eyes.first().click();
        await eyes.last().click();
        assert.equal(await page.locator('.warehouse-bulk-item.is-hidden').count(),2);
        assert.equal(await page.locator('.warehouse-bulk-check:checked').count(),0);
        await eyes.first().click();
        assert.equal(await eyes.first().getAttribute('aria-pressed'),'true');
        assert.equal(await eyes.last().getAttribute('aria-pressed'),'false');
        assert.equal(await page.locator('.warehouse-bulk-item.is-hidden').count(),1);
        if(await page.locator('.warehouse-three-canvas').count()) {
            const hidden=await page.locator('.warehouse-three-canvas').getAttribute('data-hidden-furniture');
            assert.equal(hidden,await eyes.last().getAttribute('data-id'));
        }
        // The visibility choice survives leaving and returning to the 3D plan.
        await page.locator('[data-act="warehouse-plan-mode"][data-mode="2d"]').click();
        await page.locator('[data-act="warehouse-plan-mode"][data-mode="3d"]').click();
        assert.equal(await page.locator('.warehouse-bulk-visibility').last().getAttribute('aria-pressed'),'false');
    });
});



test('browser: compact room tools, uniform bulk buttons and furniture wall toggles', async () => {
    await session(async ({base,page,open}) => {
        const room=(await requestJson(base,'/api/warehouse/rooms','POST',{name:'Whiskyzimmer',width:3,height:4})).data;
        const created=await requestJson(base,`/api/warehouse/rooms/${room.id}/furniture`,'POST',{
            name:'Wandregal',type:'regal',x:.2,y:.2,width:1,depth:.4,rotation:0,elevation:0,itemHeight:1.8,
            leftSidePanel:true,rightSidePanel:false,backPanel:true,
        });
        assert.equal(created.status,201);
        const shelf=await requestJson(base,`/api/warehouse/furniture/${created.data.id}/shelves`,'POST',
            {name:'Wandfach',capacity:4});
        assert.equal(shelf.status,201);
        await open();
        await page.locator('header [data-act="toggle-menu"]').click();
        await page.locator('#site-drawer [data-act="goto-warehouse"]').click();
        await page.locator('.warehouse-tabs [data-section="rooms"]').click();
        await page.locator('#warehouse-room-select').selectOption(room.id);
        const desktop=await page.evaluate(() => {
            const el = selector => document.querySelector(selector)?.getBoundingClientRect();
            return { roomName:el('.warehouse-room-identity h3'),metrics:el('.warehouse-room-metrics'),
                modes:el('.warehouse-view-switch'), cameras:el('.warehouse-camera-toolbar'),
                zoom:el('.warehouse-plan-filter') };
        });
        assert.equal(await page.locator('.warehouse-bulk-actions').count(),0,
            'Raumplaene must not expose furniture bulk editing');
        assert.ok(Math.abs(desktop.modes.top-desktop.cameras.top)<4,`camera and view switch share a row: ${JSON.stringify(desktop)}`);
        assert.ok(Math.abs(desktop.modes.top-desktop.zoom.top)<4,`zoom and view switch share a row: ${JSON.stringify(desktop)}`);
        assert.ok(Math.abs(desktop.roomName.top-desktop.metrics.top)<40,`room title and metrics share a header: ${JSON.stringify(desktop)}`);
        await page.locator('.warehouse-room-summary').screenshot({path:'test-artifacts/warehouse-room-header-0147.png'});
        await page.locator('.warehouse-tabs [data-section="shelves"]').click();
        await page.locator('[data-act="warehouse-furniture-bulk"]').click();
        const bulkButtons=await page.locator('#modal-root .warehouse-furniture-bulk-manager .warehouse-bulk-actions .btn')
            .evaluateAll(buttons=>buttons.map(button=>button.getBoundingClientRect().height));
        assert.equal(bulkButtons.length,4,'bulk controls belong in the separate furniture management modal');
        assert.ok(bulkButtons.every(height=>Math.abs(height-bulkButtons[0])<1),
            `bulk buttons need equal heights ${JSON.stringify(bulkButtons)}`);
        await page.locator('#modal-root .dialog-head [data-act="close-modal"]').click();
        await page.locator('.warehouse-wall-furniture-edit').click();
        assert.equal(await page.locator('#modal-root .warehouse-furniture-panel').count(),1);
        await page.locator('#modal-root [data-act="warehouse-furniture-edit"]').click();
        assert.equal(await page.locator('.warehouse-wall-toggle').count(),3);
        assert.equal(await page.locator('.warehouse-wall-toggle [name="leftSidePanel"]').isChecked(),true);
        assert.equal(await page.locator('.warehouse-wall-toggle [name="rightSidePanel"]').isChecked(),false);
        assert.equal(await page.locator('.warehouse-wall-toggle [name="backPanel"]').isChecked(),true);
        await page.locator('.warehouse-wall-toggle').nth(1).click();
        assert.equal(await page.locator('.warehouse-wall-toggle [name="rightSidePanel"]').isChecked(),true);
        await page.locator('.warehouse-wall-options').screenshot({path:'test-artifacts/warehouse-wall-desktop-0147.png'});
        await page.setViewportSize({width:390,height:844});
        const mobile=await page.evaluate(() => {
            const fieldset=document.querySelector('.warehouse-wall-options').getBoundingClientRect();
            const cards=[...document.querySelectorAll('.warehouse-wall-toggle')].map(el=>el.getBoundingClientRect());
            return {fieldset:{left:fieldset.left,right:fieldset.right},cards:cards.map(r=>({left:r.left,right:r.right,top:r.top,bottom:r.bottom})),width:document.body.getBoundingClientRect().width};
        });
        assert.ok(mobile.cards.every(r=>r.right<=mobile.width+2),`wall options should fit mobile viewport: ${JSON.stringify(mobile)}`);
        assert.ok(mobile.cards[0].bottom<=mobile.cards[1].top,`mobile wall switches should stack: ${JSON.stringify(mobile)}`);
        await page.locator('.warehouse-wall-options').screenshot({path:'test-artifacts/warehouse-wall-mobile-0147.png'});
    });
});



test('browser: analysis and warehouse use the same page width as the shared main content', async () => {
    await session(async ({page, open}) => {
        await open();
        for (const width of [1600, 1024, 390]) {
            await page.setViewportSize({width, height:900});
            for (const [destination] of [['analysis'], ['warehouse']]) {
                await page.locator('header [data-act="toggle-menu"]').click();
                await page.locator(`#site-drawer [data-act="goto-${destination}"]`).click();
                const dimensions = await page.locator('.analytics-page').evaluate(element => {
                    const main = element.closest('main');
                    const mainStyle = getComputedStyle(main);
                    const bounds = main.getBoundingClientRect();
                    const contentLeft = bounds.left + parseFloat(mainStyle.paddingLeft);
                    const contentRight = bounds.right - parseFloat(mainStyle.paddingRight);
                    const page = element.getBoundingClientRect();
                    return {left:page.left, right:page.right, contentLeft, contentRight};
                });
                assert.ok(Math.abs(dimensions.left - dimensions.contentLeft) < 1,
                    `${destination} left edge aligns with shared main content at ${width}px`);
                assert.ok(Math.abs(dimensions.right - dimensions.contentRight) < 1,
                    `${destination} right edge aligns with shared main content at ${width}px`);
            }
        }
    });
});




test('browser: translating a dynamic warehouse view does not translate room names', async () => {
    await session(async ({page, base, open}) => {
        const created = await requestJson(base, '/api/warehouse/rooms', 'POST',
            {name:'Lagerverwaltung', width:4, height:3});
        assert.equal(created.status, 201);
        // Verify the shipped English catalog rather than a shortened test-only
        // dictionary; wait for async language initialization before asserting.
        await open({query:'?lang=en'});
        await page.locator('html[lang="en"]').waitFor();
        await page.locator('header [data-act="toggle-menu"]').click();
        assert.equal((await page.locator('#site-drawer [data-act="goto-analysis"]').innerText()).trim(), 'Analytics');
        await page.locator('#site-drawer [data-act="goto-warehouse"]').click();
        await page.getByRole('heading', {name:'Storage management'}).waitFor();
        assert.match(await page.locator('.warehouse-heading p').innerText(), /every bottle has its own place/);
        assert.match(await page.locator('.warehouse-room-card-details').first().innerText(), /0 storage furniture items/);
        assert.equal((await page.locator('.warehouse-room-card-details strong').first().innerText()).trim(),
            'Lagerverwaltung', 'user-defined room names must remain unchanged');
    });
});



test('browser: complete English locale renders collection controls and analytics filters', async () => {
    await session(async ({page, open}) => {
        await open({query:'?lang=en'});
        await page.locator('html[lang="en"]').waitFor();
        const view = page.locator('[data-act="toggle-view"]');
        await view.waitFor();
        assert.match((await view.innerText()).trim(), /Table/);
        await view.click();
        assert.match((await view.innerText()).trim(), /Cards/);
        await page.locator('header [data-act="toggle-menu"]').click();
        await page.locator('#site-drawer [data-act="goto-analysis"]').click();
        await page.locator('.analytics-page').waitFor();
        const filters = await page.locator('.analytics-filters').innerText();
        for (const label of ['All distilleries','All countries','All bottle types','All statuses']) {
            assert.match(filters, new RegExp(label));
        }
        assert.doesNotMatch(filters, /Alle Destillerien|Alle Flaschentypen|Alle Status/);
    });
});




test('browser: English map legend translates active and closed for visible and empty distilleries', async () => {
    await session(async ({page, open}) => {
        await open({query:'?lang=en'});
        await page.locator('html[lang="en"]').waitFor();
        await page.locator('header [data-act="toggle-menu"]').click();
        await page.locator('#site-drawer [data-act="goto-map"]').click();
        const stocked = page.locator('.map-legend-status');
        await stocked.waitFor();
        assert.match(await stocked.innerText(), /With bottles\s+1\s*Active\s+1\s*Closed/);
        await page.locator('#map-all-distilleries').check();
        const empty = page.locator('.map-legend-empty');
        await empty.waitFor();
        assert.match(await empty.innerText(), /Without bottles\s+Active\s+Closed/);
        assert.doesNotMatch(await page.locator('.map-legend').innerText(), /Aktiv|Geschlossen/);
    });
});



test('browser: deleting an occupied room asks to unassign its bottles, with cancel preserving everything', async () => {
    await session(async ({base,page,open}) => {
        const bottle=await seed(base,'071615');
        const room=(await requestJson(base,'/api/warehouse/rooms','POST',{name:'Löschtest',width:4,height:3})).data;
        const other=(await requestJson(base,'/api/warehouse/rooms','POST',{name:'Bleibt',width:4,height:3})).data;
        const furniture=(await requestJson(base,`/api/warehouse/rooms/${room.id}/furniture`,'POST',
            {name:'Regal',type:'regal',x:0,y:0,width:1,depth:.5})).data;
        const shelf=(await requestJson(base,`/api/warehouse/furniture/${furniture.id}/shelves`,'POST',{name:'Fach'})).data;
        assert.equal((await requestJson(base,`/api/warehouse/bottles/${bottle.bottle.id}`,'PUT',{shelfId:shelf.id})).status,200);
        await open();
        await page.locator('header [data-act="toggle-menu"]').click();
        await page.locator('#site-drawer [data-act="goto-warehouse"]').click();
        await page.locator('.warehouse-tabs [data-section="rooms"]').click();
        await page.locator('#warehouse-room-select').selectOption(room.id);
        await page.locator('.warehouse-room-toolbar [data-act="warehouse-room-delete"]').click();
        const dialog=page.locator('#modal-root [role="dialog"]');
        assert.match(await dialog.textContent(),/1 Flasche/);
        assert.equal(await dialog.locator('[data-act="warehouse-confirm-delete-unassign"]').count(),1);
        assert.equal(await dialog.locator('[data-act="warehouse-confirm-delete"]').count(),0);
        await dialog.getByRole('button',{name:'Abbrechen'}).click();
        assert.equal(await dialog.count(),0);
        const afterCancel=(await requestJson(base,'/api/warehouse')).data;
        assert.equal(afterCancel.rooms.length,2);
        assert.equal(afterCancel.assignments[bottle.bottle.id],shelf.id);
        await page.locator('.warehouse-room-toolbar [data-act="warehouse-room-delete"]').click();
        await dialog.locator('[data-act="warehouse-confirm-delete-unassign"]').click();
        await page.locator('#modal-root [role="dialog"]').waitFor({state:'detached'});
        const afterDelete=(await requestJson(base,'/api/warehouse')).data;
        assert.deepEqual(afterDelete.rooms.map(entry=>entry.id),[other.id]);
        assert.equal(afterDelete.assignments[bottle.bottle.id],undefined);
        assert.ok(afterDelete.bottles.some(entry=>entry.id===bottle.bottle.id));
    });
});



test('browser: showing all distilleries preserves exact map camera and viewer node', async () => {
    await session(async ({page, open}) => {
        await open();
        await page.locator('header [data-act="toggle-menu"]').click();
        await page.locator('#site-drawer [data-act="goto-map"]').click();
        await page.locator('.map-zoom-level').waitFor();
        await page.locator('[data-map-control="in"]').click();
        await page.locator('[data-map-control="in"]').click();
        await page.locator('#distillery-map').evaluate(node => { node.dataset.cameraIdentity = 'preserve'; });
        const snapshot = () => page.locator('#distillery-map').evaluate(node => {
            const tile = node.querySelector('.map-tiles img');
            const viewport = node.querySelector('.map-viewport');
            const zoom = Number(node.querySelector('.map-zoom-level').textContent.replace(/[^\d]/g, ''));
            if (!tile || !viewport) return null;
            const [, , x, y] = new URL(tile.src).pathname.split('/').map(segment => parseInt(segment, 10));
            return { zoom, centerX: x * 256 - parseFloat(tile.style.left) + viewport.clientWidth / 2,
                centerY: y * 256 - parseFloat(tile.style.top) + viewport.clientHeight / 2 };
        });
        const before = await snapshot();
        assert.ok(before && Number.isFinite(before.centerX));
        await page.locator('#map-all-distilleries').check();
        assert.equal(await page.locator('#distillery-map').getAttribute('data-camera-identity'), 'preserve');
        assert.deepEqual(await snapshot(), before, 'show all must preserve camera');
        await page.locator('#map-all-distilleries').uncheck();
        assert.deepEqual(await snapshot(), before, 'hide empty sites must preserve camera');
    });
});


test('browser: placing furniture from the 2D plan stays in room plans and permits the first compartment', async () => {
    await session(async ({base,page,open}) => {
        const room=(await requestJson(base,'/api/warehouse/rooms','POST',
            {name:'Neuer Raum',width:5,height:4})).data;
        await open();
        await page.locator('header [data-act="toggle-menu"]').click();
        await page.locator('#site-drawer [data-act="goto-warehouse"]').click();
        await page.locator('.warehouse-tabs [data-section="rooms"]').click();
        await page.locator('#warehouse-room-select').selectOption(room.id);
        await page.locator('[data-act="warehouse-plan-mode"][data-mode="2d"]').click();
        await page.locator('.warehouse-plan-tools [data-act="warehouse-furniture-new"]').click();
        const form=page.locator('#modal-root #warehouse-form');
        await form.locator('[name="name"]').fill('Vitrine neu');
        await form.locator('button[type="submit"]').click();
        await page.locator('.warehouse-tabs [data-section="rooms"][aria-current="page"]').waitFor();
        assert.equal(await page.locator('.warehouse-floor').count(),1);
        assert.equal(await page.locator('.warehouse-plan-focus-info strong').innerText(),'Vitrine neu');
        await page.locator('.warehouse-plan-focus [data-act="warehouse-furniture-manage"]').click();
        await page.locator('#modal-root .warehouse-furniture-manager [data-act="warehouse-shelf-new"]').click();
        const shelfForm=page.locator('#modal-root #warehouse-form');
        await shelfForm.locator('[name="name"]').fill('Erstes Fach');
        await shelfForm.locator('button[type="submit"]').click();
        await page.locator('.warehouse-tabs [data-section="rooms"][aria-current="page"]').waitFor();
        assert.equal(await page.locator('.warehouse-floor').count(),1);
        assert.equal((await requestJson(base,'/api/warehouse')).data.rooms
            .find(entry=>entry.id===room.id).furniture[0].shelves[0].name,'Erstes Fach');
        // The original double-click route to Regale & Fächer is intentionally unchanged.
    });
});
