import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {HELP_TOPICS} from '../../public/js/views/help.js';
import {startTestServer,requestJson} from '../helpers/server.js';
import {domOnly,chromium,session,openSettingsFromMenu,openSettingsSection,seed,mockDecoder} from './support.js';
test('browser: bottling tasting block edits eight-axis flavor, notes and five Glencairn glasses with undo/redo', async () => {
    await session(async ({page,base,open}) => {
        await open();
        await page.locator('[data-act="new"]').first().click();
        const form=page.locator('#bottling-form');
        await form.locator('[name="name"]').fill('Flavor profile browser test');
        assert.equal(await form.locator('[data-flavor-range]').count(),0,
            'tasting belongs to the second detail block, not the bottling master-data form');
        await form.locator('button[type="submit"]').click();
        await page.locator('[data-act="tastings-new"]').click();
        await page.locator('[data-act="tasting-create"]').click();
        await page.locator('[data-act="tasting-edit-start"]').click();
        const section = page.locator('[data-flavor-detail]');
        await section.waitFor({state:'visible'});
        assert.match(await section.locator('.flavor-chart').textContent(),/Alkoholisch/);
        await section.locator('[data-flavor-range="6"]').evaluate(input => {
            input.value='8'; input.dispatchEvent(new Event('input',{bubbles:true}));
            input.dispatchEvent(new Event('change',{bubbles:true}));
        });
        await section.locator('[data-rating-points="80"]').click();
        assert.equal(await section.locator('[data-tasting-rating]').getAttribute('data-rating-value'),'80');
        const note = section.locator('[data-tasting-note="nose"]');
        await note.fill('Sherry and vanilla');
        await note.press('Tab');
        assert.equal(await section.locator('[data-flavor-value="6"]').textContent(),'8');
        await page.waitForFunction(async () => {
            const response=await fetch('/api/collection');
            const data=await response.json();
            const b=data.bottlings?.[0];
            const last=b?.tastings?.at(-1);
            return last?.rating===80 && last?.flavorProfile?.feinty===8 && last?.tastingNotes?.nose==='Sherry and vanilla';
        });
        const saved=(await requestJson(base,'/api/collection')).data.bottlings[0];
        assert.equal(saved.bottles[0].rating,undefined);
        assert.equal(saved.bottles[0].tastingNotes,undefined);
        await section.locator('[data-act="flavor-detail-undo"]').click();
        assert.equal(await section.locator('[data-tasting-note="nose"]').inputValue(),'');
        await section.locator('[data-act="flavor-detail-redo"]').click();
        assert.equal(await section.locator('[data-tasting-note="nose"]').inputValue(),'Sherry and vanilla');
        await page.locator('[data-act="tastings-back-list"]').click();
        await page.locator('[data-act="tastings-back-detail"]').click();
        await page.locator('[data-act="edit-bottling"]').click();
        assert.equal(await page.locator('#bottling-form [data-flavor-range]').count(),0);
    });
});



test('browser: v0.24 shelf editor saves capacity in suspended manager and switches with three-way confirmation', async () => {
    await session(async ({page,base,open}) => {
        const room=(await requestJson(base,'/api/warehouse/rooms','POST',{name:'Dialograum',width:4,height:4})).data;
        const furniture=(await requestJson(base,`/api/warehouse/rooms/${room.id}/furniture`,'POST',
            {name:'Dialogregal',type:'regal',x:.2,y:.2,width:1,depth:.5,rotation:0,itemHeight:1.8})).data;
        const shelf1=(await requestJson(base,`/api/warehouse/furniture/${furniture.id}/shelves`,'POST',{name:'Fach unten',capacity:4})).data;
        const shelf2=(await requestJson(base,`/api/warehouse/furniture/${furniture.id}/shelves`,'POST',{name:'Fach oben',capacity:6})).data;
        await open();
        await page.locator('header [data-act="toggle-menu"]').click();
        await page.locator('#site-drawer [data-act="goto-warehouse"]').click();
        await page.locator('.warehouse-tabs [data-section="shelves"]').click();
        await page.locator('#warehouse-room-select').selectOption(room.id);
        await page.locator(`.warehouse-wall-furniture-edit[data-id="${furniture.id}"]`).click();
        const manager=page.locator('#modal-root .warehouse-furniture-manager');
        await manager.locator(`[data-act="warehouse-shelf-edit"][data-id="${shelf2.id}"]`).click();
        await page.locator('#warehouse-form [name="capacity"]').fill('12');
        await page.locator('#warehouse-form [data-act="warehouse-shelf-switch"]').filter({hasText:'Nächstes'}).click();
        await page.locator('[data-choice="cancel"]').click();
        assert.equal(await page.locator('#warehouse-form [name="capacity"]').inputValue(),'12');
        await page.locator('#warehouse-form [data-act="warehouse-shelf-switch"]').filter({hasText:'Nächstes'}).click();
        await page.locator('[data-choice="save"]').click();
        await page.locator(`#warehouse-form[data-endpoint="/api/warehouse/shelves/${shelf1.id}"]`).waitFor();
        await page.locator('#modal-root .dialog-head [data-act="close-modal"]').click();
        const updated=manager.locator(`.warehouse-shelf[data-shelf-id="${shelf2.id}"]`);
        assert.match(await updated.locator('.warehouse-shelf-meta').textContent(),/12/);
        assert.equal((await requestJson(base,'/api/warehouse')).data.rooms[0].furniture[0].shelves[1].capacity,12);
        await manager.locator('input[data-furniture-photos]:not([capture])').setInputFiles({
            name:'shelf.png',mimeType:'image/png',
            buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAOfb9AcAAAAASUVORK5CYII=','base64')
        });
        await manager.locator('.warehouse-furniture-photo').waitFor();
        await manager.locator('[data-act="warehouse-photo-open"]').click();
        await page.locator('.warehouse-photo-lightbox img').waitFor();
        await page.locator('#modal-root .dialog-head [data-act="close-modal"]').click();
        assert.equal(await manager.locator('.warehouse-furniture-photo').count(),1);
    });
});



test('browser: v0.24 nested mobile modal fixes page scrolling and technical help is expandable',async()=>{
    await session(async ({page,open})=>{
        await page.setViewportSize({width:390,height:844});
        await open();
        await page.locator('[data-act="new"]').first().click();
        assert.equal(await page.evaluate(()=>document.body.style.position),'fixed');
        assert.equal(await page.evaluate(()=>document.documentElement.style.overflow),'hidden');
        const scrollable=await page.locator('.dialog').evaluate(el=>({touchAction:getComputedStyle(el).touchAction,overflow:getComputedStyle(el).overflowY}));
        assert.match(scrollable.touchAction,/pan-y/);
        assert.match(scrollable.overflow,/auto/);
        await page.locator('#modal-root .dialog-head [data-act="close-modal"]').click();
        assert.notEqual(await page.evaluate(()=>document.body.style.position),'fixed');
        await page.locator('header [data-act="toggle-menu"]').click();
        await page.locator('#site-drawer [data-act="goto-help"]').click();
        await page.locator('[data-section-switch="help"]').selectOption('backups');
        const technical=page.locator('#help-panel-backups .help-technical-guides');
        assert.ok(await technical.isVisible());
        await technical.locator('details').first().locator('summary').click();
        assert.match(await technical.locator('details').first().textContent(),/Backup-Administrator-Schlüssel/);
    });
});



test('browser: v0.25.1 palette, precise Glencairn rating, undo history and compact detail layout', async () => {
    await session(async ({page,base,open}) => {
        await open();
        await page.locator('[data-act="new"]').first().click();
        await page.locator('#bottling-form [name="name"]').fill('Color and Glencairn test');
        await page.locator('#bottling-form button[type="submit"]').click();
        const summary=page.locator('.detail-summary-grid');
        await page.setViewportSize({width:1440,height:900});
        const row=await summary.evaluate(el=>{
            const image=el.querySelector('.detail-summary-photo > .hero-photo').getBoundingClientRect();
            const facts=el.querySelector(':scope > .panel').getBoundingClientRect();
            return {imageHeight:image.height,factsHeight:facts.height};
        });
        assert.ok(Math.abs(row.imageHeight-row.factsHeight) < 1.5, `image and facts equal height: ${JSON.stringify(row)}`);
        await page.locator('[data-act="tastings-new"]').click();
        await page.locator('[data-act="tasting-create"]').click();
        await page.locator('[data-act="tasting-edit-start"]').click();
        const section=page.locator('[data-flavor-detail]');
        await section.waitFor({state:'visible'});
        assert.equal(await section.locator('.whisky-color-choice').count(),12);
        const columns=await section.locator('.flavor-sliders').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
        assert.equal(columns,2,'two grouped slider columns beside the radar chart');
        await section.locator('[data-act="tasting-color"][data-color-key="amber"]').click();
        await section.screenshot({path:'test-artifacts/wcm_0251_tasting_light.png'});
        const color=section.locator('[data-color-key="amber"] .glencairn-liquid');
        const before=await color.evaluate(el=>getComputedStyle(el).fill);
        await page.locator('[data-act="toggle-theme"]').click();
        const after=await section.locator('[data-color-key="amber"] .glencairn-liquid').evaluate(el=>getComputedStyle(el).fill);
        assert.equal(before,after,'whisky colour must not follow the light/dark theme');
        await section.screenshot({path:'test-artifacts/wcm_0251_tasting_dark.png'});
        const score=section.locator('[data-tasting-score]');
        await score.fill('101');
        await score.press('Tab');
        assert.equal(await score.getAttribute('aria-invalid'),'true');
        assert.equal((await requestJson(base,'/api/collection')).data.bottlings[0].tastings?.at(-1)?.rating ?? null,null,
            'invalid scores cannot be persisted');
        await score.fill('87,5');
        assert.equal(await section.locator('[data-tasting-rating]').getAttribute('data-rating-value'),'87.5',
            'the Glencairn visualization should update immediately, without waiting for blur');
        await score.press('Tab');
        assert.equal(await score.getAttribute('aria-invalid'),null);
        assert.equal(await section.locator('[data-tasting-rating]').getAttribute('data-rating-value'),'87.5',
            'the preview and persisted score must agree');
        await page.waitForFunction(async () => {
            const data=await (await fetch('/api/collection')).json();
            const b=data.bottlings?.[0];
            const last=b?.tastings?.at(-1);
            return last?.whiskyColor==='amber' && last?.rating===87.5;
        });
        assert.equal((await requestJson(base,'/api/collection')).data.bottlings[0].tastings.at(-1).rating,87.5);
        await section.locator('[data-act="flavor-detail-undo"]').click();
        assert.equal(await section.locator('[data-tasting-score]').inputValue(),'');
        await section.locator('[data-act="flavor-detail-redo"]').click();
        assert.equal(await section.locator('[data-tasting-score]').inputValue(),'87,5');
        const labels=await section.locator('.flavor-history-actions button').count();
        assert.equal(labels,2);
        assert.equal(await section.locator('[data-act="flavor-detail-undo"] svg').count(),1);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
        await page.setViewportSize({width:390,height:844});
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,
            'color selectors and rating controls must not overflow on mobile');
    });
});



test('browser: v0.25.4 Full HD tasting layout groups colour separately from radar and compact 2x4 sliders', async () => {
    await session(async ({page,open}) => {
        await page.setViewportSize({width:1920,height:1080});
        await open();
        await page.locator('[data-act="new"]').first().click();
        await page.locator('#bottling-form [name="name"]').fill('Full HD Geschmacksprofil');
        await page.locator('#bottling-form button[type="submit"]').click();
        await page.locator('[data-act="tastings-new"]').click();
        await page.locator('[data-act="tasting-create"]').click();
        await page.locator('[data-act="tasting-edit-start"]').click();
        const panel=page.locator('[data-flavor-detail]');
        await panel.waitFor({state:'visible'});
        const color=panel.locator('.tasting-color-panel');
        const palette=color.locator('.whisky-color-grid');
        const graph=panel.locator('.flavor-chart');
        const sliders=panel.locator('.flavor-sliders');
        assert.equal(await palette.locator('.whisky-color-choice').count(),12);
        const metrics=await panel.evaluate(el=>{
            const css=selector=>getComputedStyle(el.querySelector(selector));
            const rect=selector=>{
                const {x,y,width,height}=el.querySelector(selector).getBoundingClientRect();return {x,y,width,height};
            };
            return {outer:css('.tasting-top-row').gridTemplateColumns.split(' ').length,
                inner:css('.flavor-editor').gridTemplateColumns.split(' ').length,
                colorColumns:css('.whisky-color-grid').gridTemplateColumns.split(' ').length,
                sliderColumns:css('.flavor-sliders').gridTemplateColumns.split(' ').length,
                color:rect('.tasting-color-panel'),flavor:rect('.tasting-senses-section'),
                chart:rect('.flavor-chart'),bars:rect('.flavor-sliders'),
                scrollbar:document.documentElement.scrollWidth-innerWidth};
        });
        assert.equal(metrics.outer,2,`two sibling panels at Full HD: ${JSON.stringify(metrics)}`);
        assert.equal(metrics.inner,2,'radar and sliders share the same flavor panel');
        assert.equal(metrics.colorColumns,3,'palette must show 3 columns and 4 rows');
        assert.equal(metrics.sliderColumns,2,'eight sliders must sit in two groups of four');
        assert.ok(metrics.color.x+metrics.color.width <= metrics.flavor.x + 2);
        assert.ok(metrics.chart.x+metrics.chart.width <= metrics.bars.x + 2);
        assert.ok(metrics.scrollbar <= 1,'Full HD layout must not create horizontal overflow');
        assert.equal(await sliders.locator('input[data-flavor-range]').count(),8);
        await page.setViewportSize({width:1040,height:900});
        assert.equal(await panel.locator('.tasting-top-row').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),1);
        assert.equal(await panel.locator('.flavor-editor').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),2);
        await page.setViewportSize({width:390,height:844});
        assert.equal(await panel.locator('.flavor-editor').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),1);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
        await color.locator('[data-color-key="amber"]').click();
        assert.equal(await color.locator('[data-color-key="amber"]').getAttribute('aria-pressed'),'true');
    });
});



test('browser: v0.25.4 tasting hierarchy matches analytics and gold-filled glasses preserve precise scores', async () => {
    await session(async ({page,open}) => {
        await page.setViewportSize({width:1440,height:900});
        await open();
        await page.locator('[data-act="new"]').first().click();
        await page.locator('#bottling-form [name="name"]').fill('Tasting panel consistency');
        await page.locator('#bottling-form button[type="submit"]').click();
        await page.locator('[data-act="tastings-new"]').click();
        await page.locator('[data-act="tasting-create"]').click();
        await page.locator('[data-act="tasting-edit-start"]').click();
        const section=page.locator('[data-flavor-detail]');
        await section.waitFor({state:'visible'});
        const panels=section.locator('.tasting-panel .analytics-panel');
        assert.equal(await panels.count(),5,'date/title, color, profile, notes, and rating use separate analytics-style panels');
        assert.equal(await section.locator('.tasting-color-panel h3').textContent(),'Farbe');
        assert.equal(await section.locator('.tasting-senses-section h3').textContent(),'Geschmacksprofil');
        assert.equal(await section.locator('.tasting-panel > section.analytics-panel h3').first().textContent(),'Verkostungsnotizen');
        assert.equal(await section.locator('.tasting-panel > section.analytics-panel h3').last().textContent(),'Gesamtbewertung');
        assert.equal(await section.locator(':scope > .section-head h3').textContent(),'Eindrücke');
        assert.equal(await section.locator('svg[aria-label*="Bewertung kann"]').count(),0);
        const appearance=await panels.first().evaluate(el=>{
            const style=getComputedStyle(el);
            return {radius:style.borderTopLeftRadius,border:style.borderTopWidth,shadow:style.boxShadow,
                background:style.backgroundColor,header:getComputedStyle(document.querySelector('.tasting-color-panel h3')).fontFamily};
        });
        assert.equal(appearance.radius,'0px');
        assert.equal(appearance.border,'1px');
        assert.equal(appearance.shadow,'none');
        assert.ok(appearance.header.length>0);
        const colorPanel=section.locator('.tasting-color-panel');
        const ratingPanel=section.locator('.tasting-rating-panel');
        assert.equal(await colorPanel.locator('.whisky-color-current, .whisky-color-footer').count(),0);
        assert.equal(await colorPanel.locator('[data-act="tasting-color-clear"]').count(),1);
        assert.equal(await ratingPanel.locator('[data-act="tasting-rating-clear"]').count(),1);
        assert.equal(await colorPanel.locator('.tasting-panel-heading [data-act="tasting-color-clear"]').isDisabled(),true);
        assert.equal(await ratingPanel.locator('.tasting-panel-heading [data-act="tasting-rating-clear"]').isDisabled(),true);
        const headerPositions=await section.evaluate(() => {
            const positions = selector => {
                const panel=document.querySelector(selector);
                const head=panel.querySelector('.tasting-panel-heading h3').getBoundingClientRect();
                const button=panel.querySelector('.tasting-panel-heading button').getBoundingClientRect();
                const bounds=panel.getBoundingClientRect();
                return {headingY:head.y,buttonY:button.y,buttonRight:button.right,panelRight:bounds.right};
            };
            return [positions('.tasting-color-panel'),positions('.tasting-rating-panel')];
        });
        for (const pos of headerPositions) {
            assert.ok(Math.abs(pos.headingY-pos.buttonY)<24,'remove control belongs to the section heading row');
            assert.ok(pos.panelRight-pos.buttonRight < 35,'remove control is right-aligned');
        }
        await colorPanel.locator('[data-color-key="butter"]').click();
        assert.equal(await colorPanel.locator('[data-color-key="butter"]').getAttribute('aria-pressed'),'true');
        assert.ok(await colorPanel.locator('[data-color-key="butter"]').evaluate(el=>getComputedStyle(el,'::after').content.includes('✓')));
        assert.equal(await colorPanel.locator('[data-act="tasting-color-clear"]').isEnabled(),true);
        await colorPanel.locator('[data-act="tasting-color-clear"]').click();
        assert.equal(await colorPanel.locator('.is-selected').count(),0);
        assert.equal(await colorPanel.locator('[data-act="tasting-color-clear"]').isDisabled(),true);
        const rating=section.locator('[data-tasting-rating]');
        assert.equal(await rating.locator('.glencairn-rating-outline').count(),5);
        assert.equal(await rating.locator('.glencairn-rating-fill').count(),5);
        assert.equal(await rating.locator('.glencairn-rating-fill[clip-path]').count(),5,'filled bowls are clipped to the original glass shape');
        await rating.locator('[data-tasting-score]').fill('87,5');
        assert.equal(await rating.locator('[data-tasting-score]').inputValue(),'87,5');
        assert.equal(await rating.locator('[data-tasting-rating-total]').count(),0,'rating is displayed only in the editable input');
        assert.equal(await rating.locator('[data-glass-state="full"]').count(),4);
        assert.equal(await rating.locator('[data-glass-state="partial"]').count(),1);
        const fifthFill = await rating.locator('[data-glass-state="partial"] [data-rating-fill]').evaluate(node => ({y:+node.getAttribute('y'),height:+node.getAttribute('height')}));
        assert.ok(Math.abs(fifthFill.height - 94.875)<0.001,'87.5 points fill 37.5% of the fifth glass from the bottom');
        assert.ok(Math.abs(fifthFill.y - (331 - 94.875))<0.001);
        await rating.locator('[data-tasting-score]').press('Tab');
        assert.equal(await ratingPanel.locator('[data-act="tasting-rating-clear"]').isEnabled(),true);
        await ratingPanel.locator('[data-act="tasting-rating-clear"]').click();
        assert.equal(await rating.locator('[data-tasting-score]').inputValue(),'');
        assert.equal(await rating.locator('[data-glass-state="empty"]').count(),5);
        assert.equal(await ratingPanel.locator('[data-act="tasting-rating-clear"]').isDisabled(),true);
        await section.locator('[data-act="flavor-detail-undo"]').click();
        assert.equal(await rating.locator('[data-tasting-score]').inputValue(),'87,5');
        assert.equal(await ratingPanel.locator('[data-act="tasting-rating-clear"]').isEnabled(),true);
        await section.screenshot({path:'test-artifacts/wcm_0253_tasting_light.png'});
        await page.locator('[data-act="toggle-theme"]').click();
        assert.equal(await rating.locator('.glencairn-rating-fill').count(),5);
        assert.equal(await rating.locator('[data-tasting-score]').inputValue(),'87,5');
        await section.screenshot({path:'test-artifacts/wcm_0253_tasting_dark.png'});
        await page.setViewportSize({width:390,height:844});
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    });
});



test('browser: v0.26.0 multiple dated tastings, latest summary, individual editing and modal delete', async () => {
    await session(async ({page,base,open}) => {
        const bottling = (await requestJson(base,'/api/bottlings','POST',{
            name:'Chronological tastings',firstBottle:{inventoryNumber:'998170'}
        })).data.bottling;
        await open();
        await page.locator(`[data-act="open"][data-id="${bottling.id}"]`).first().click();
        assert.equal(await page.locator('[data-flavor-detail]').count(),0,'no editor on master details');
        assert.match(await page.locator('.tasting-summary').innerText(),/Noch keine Verkostung/);
        await page.locator('[data-act="tastings-new"]').click();
        assert.equal((await requestJson(base,'/api/collection')).data.bottlings[0].tastings.length,0,
            'opening draft never persists it');
        await page.locator('[data-tasting-date]').fill('2026-10-10');
        await page.locator('[data-tasting-score]').fill('81');
        await page.locator('[data-tasting-score]').press('Tab');
        await page.locator('[data-act="tasting-create"]').click();
        await page.locator('[data-act="tastings-back-list"]').click();
        await page.locator('[data-act="tastings-new"]').click();
        await page.locator('[data-tasting-date]').fill('2026-11-12');
        await page.locator('[data-tasting-title]').fill('Spätere Verkostung');
        await page.locator('[data-act="tasting-create"]').click();
        await page.locator('[data-act="tastings-back-list"]').click();
        const list=page.locator('.tasting-list-row');
        assert.equal(await list.count(),2);
        assert.match(await list.first().innerText(),/Spätere Verkostung/);
        await page.locator('[data-act="tastings-back-detail"]').click();
        assert.match(await page.locator('.tasting-summary-rating').innerText(),/Nicht bewertet/,
            'latest tasting without score must not fall back to 81');
        await page.locator('[data-act="tastings-open"]').first().click();
        await list.first().locator('[data-act="tastings-open"]').click();
        assert.equal(await page.locator('[data-tasting-score]').count(),0,'saved tasting is read-only on opening');
        await page.locator('[data-act="tasting-edit-start"]').click();
        await page.locator('[data-tasting-score]').fill('87,5');
        await page.locator('[data-tasting-score]').press('Tab');
        await page.waitForFunction(async id => {
            const data=await(await fetch('/api/collection')).json();
            return data.bottlings.find(b=>b.id===id)?.tastings?.some(t=>t.rating===87.5);
        },bottling.id);
        await page.locator('[data-act="tastings-back-list"]').click();
        await page.locator('[data-act="tasting-delete"]').first().click();
        assert.equal(await page.locator('[data-act="confirm-action"]').count(),1);
        await page.getByRole('button', {name:'Abbrechen',exact:true}).click();
        assert.equal(await page.locator('.tasting-list-row').count(),2,'cancel preserves record');
        await page.locator('[data-act="tasting-delete"]').first().click();
        await page.locator('[data-act="confirm-action"]').click();
        await page.waitForFunction(() => document.querySelectorAll('.tasting-list-row').length === 1);
        assert.equal(await page.locator('.tasting-list-row').count(),1);
        await page.locator('[data-act="tastings-back-detail"]').click();
        assert.match(await page.locator('.tasting-summary-rating').innerText(),/81 \/ 100/);
        await page.setViewportSize({width:320,height:720});
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
        if (!domOnly) {
            await page.goto(base+`/?bottling=${bottling.id}&view=tastings`);
            await page.locator('.tasting-list-row').waitFor();
            assert.equal(await page.locator('.tasting-list-row').count(),1,'direct route can reload');
        }
    });
});



test('browser: rejected tasting DELETE keeps the editing page and confirmation open', async () => {
    await session(async ({page,base,open}) => {
        const bottling = (await requestJson(base,'/api/bottlings','POST',{
            name:'Tasting delete failure',firstBottle:{inventoryNumber:'998171'}
        })).data.bottling;
        const tasting = (await requestJson(base,`/api/bottlings/${bottling.id}/tastings`,'POST',{
            title:'Do not remove',tastedOn:'2026-11-16'
        })).data;
        await open();
        await page.locator(`[data-act="open"][data-id="${bottling.id}"]`).first().click();
        await page.locator('[data-act="tastings-open"]').first().click();
        // Existing tastings open read-only; deletion is available after Edit.
        await page.locator('[data-act="tasting-edit-start"]').click();
        await page.locator('[data-act="tasting-delete"]').first().click();
        await page.route(`**/api/bottlings/${bottling.id}/tastings/${tasting.id}`, async route => {
            if (route.request().method() === 'DELETE') {
                await route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'Simulated server failure'})});
            } else {
                await route.fallback();
            }
        });
        await page.locator('[data-act="confirm-action"]').click();
        await page.locator('.toast.error').waitFor();
        assert.equal(await page.locator('[data-act="confirm-action"]').count(),1,
            'failed deletion retains the confirmation for retry or cancel');
        await page.locator('[data-act="close-modal"]').last().click();
        assert.equal(await page.locator('[data-act="tasting-delete"]').count(),1,
            'failed deletion must not navigate away from the tasting');
        assert.equal((await requestJson(base,'/api/collection')).data.bottlings[0].tastings.length,1);
    });
});



test('browser: flight groups owned and new external notes with an ordered sequence and no duplicate records',async()=>{
    await session(async({base,page,open})=>{
        const owned=(await requestJson(base,'/api/bottlings','POST',{name:'Islay bottling'})).data.bottling;
        const first=(await requestJson(base,`/api/bottlings/${owned.id}/tastings`,'POST',{tastedOn:'2026-11-15',rating:86,title:'First glass'})).data;
        await open();
        await page.locator('header [data-act="toggle-menu"]').click();
        await page.locator('#site-drawer [data-act="goto-tastings-home"]').click();
        await page.locator('[data-act="tasting-flight-new"]').click();
        await page.locator('#modal-root [data-flight-name]').fill('Islay comparison');
        await page.locator('#modal-root [data-flight-notes]').fill('Peat gets stronger near the end');
        await page.locator('#modal-root [data-act="tasting-flight-create-confirm"]').click();
        await page.locator('.tasting-flight-page').waitFor();
        assert.match(await page.locator('.tasting-flight-summary').innerText(),/Islay comparison/);
        await page.locator('[data-act="tasting-flight-toggle-add"]').click();
        await page.locator('[data-flight-tasting-option]').selectOption(first.id);
        await page.locator('[data-act="tasting-flight-attach"]').click();
        await page.waitForFunction(()=>document.querySelectorAll('.tasting-flight-member').length===1);
        await page.locator('[data-act="tasting-flight-new-external"]').click();
        await page.locator('[data-external-field="name"]').fill('A whisky outside the collection');
        await page.locator('[data-tasting-title]').fill('Second glass');
        await page.locator('[data-act="tasting-create"]').click();
        await page.locator('[data-tasting-readonly="true"]').waitFor();
        assert.match(await page.locator('.tasting-flight-context').innerText(),/Position 2 von 2/);
        await page.locator('[data-act="tasting-back-flight"]').click();
        await page.waitForFunction(()=>document.querySelectorAll('.tasting-flight-member').length===2);
        assert.equal(await page.locator('.tasting-flight-add').count(),0,'returning from a new note closes the add panel');
        const before=(await requestJson(base,'/api/collection')).data;
        assert.equal(before.bottlings.length,1);
        assert.equal(before.externalTastings.length,1);
        assert.equal(before.tastingFlights[0].tastingIds.length,2);
        await page.locator('[data-act="tasting-flight-move"][data-index="1"][data-direction="-1"]').click();
        await page.waitForFunction(id=>document.querySelector('.tasting-flight-member')?.dataset.tastingId===id, before.externalTastings[0].id);
        const after=(await requestJson(base,'/api/collection')).data;
        assert.deepEqual(after.tastingFlights[0].tastingIds,[before.externalTastings[0].id,first.id]);
        assert.equal(after.externalTastings[0].title,'Second glass');
        // The drag grip reorders notes without opening their detail view. The
        // glass/score columns must remain aligned for differing score lengths.
        const ratingCoordinates=await page.locator('.tasting-flight-member-score').evaluateAll(items=>items.map(item=>({
            glasses:item.querySelector('.tasting-list-glasses').getBoundingClientRect().x,
            score:item.querySelector('strong').getBoundingClientRect().x
        })));
        assert.ok(ratingCoordinates.every(item=>item.glasses===ratingCoordinates[0].glasses && item.score===ratingCoordinates[0].score));
        const dragGrip=await page.locator('[data-flight-drag]').first().boundingBox();
        const dropRow=await page.locator('.tasting-flight-member').last().boundingBox();
        const origin={x:dragGrip.x+dragGrip.width/2,y:dragGrip.y+dragGrip.height/2};
        const end={x:dropRow.x+dropRow.width/2,y:dropRow.y+dropRow.height-5};
        await page.mouse.move(origin.x,origin.y);
        await page.mouse.down();
        await page.mouse.move(end.x,end.y,{steps:14});
        await page.mouse.up();
        await page.waitForFunction(id=>document.querySelector('.tasting-flight-member:last-child')?.dataset.tastingId===id,after.externalTastings[0].id);
        assert.deepEqual((await requestJson(base,'/api/collection')).data.tastingFlights[0].tastingIds,[first.id,before.externalTastings[0].id]);
        assert.equal(await page.locator('.tasting-flight-page').count(),1,'drag does not navigate into tasting details');
        await page.screenshot({path:'test-artifacts/flight-desktop.png',fullPage:true});
        for (const width of [390,320]) {
            await page.setViewportSize({width,height:812});
            const dimensions=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:window.innerWidth}));
            assert.ok(dimensions.scroll<=dimensions.viewport+2,`flight page overflows at ${width}: ${JSON.stringify(dimensions)}`);
            if (width===390) await page.screenshot({path:'test-artifacts/flight-mobile.png',fullPage:true});
        }
    });
});



test('browser: mobile owned tasting list keeps full titles and ratings readable at 390 and 320 px',async()=>{
    await session(async({base,page,open})=>{
        const owned=(await requestJson(base,'/api/bottlings','POST',{name:'Big Peat'})).data.bottling;
        for (const [title,rating] of [['MixMontag',80],['',82],['',80]]) {
            assert.equal((await requestJson(base,`/api/bottlings/${owned.id}/tastings`,'POST',{
                tastedOn:'2026-11-15',title,rating
            })).status,201);
        }
        await open({query:`?bottling=${owned.id}&view=tastings`});
        await page.locator('.tasting-entry-row').first().waitFor();
        for (const width of [390,320]) {
            await page.setViewportSize({width,height:812});
            const actual=await page.evaluate(()=>{
                const headings=[...document.querySelectorAll('.tasting-entry-info strong')];
                const top=headings.find(el=>el.textContent==='MixMontag');
                return {scroll:document.documentElement.scrollWidth,viewport:window.innerWidth,
                    titleHeight:top?.getBoundingClientRect().height || 0,
                    fontSize:top?parseFloat(getComputedStyle(top).fontSize):0,
                    ratings:[...document.querySelectorAll('.tasting-list-rating')].map(el=>el.textContent)};
            });
            assert.ok(actual.scroll<=actual.viewport+2,`horizontal page overflow at ${width}: ${JSON.stringify(actual)}`);
            assert.ok(actual.titleHeight<=actual.fontSize*1.45,`MixMontag wraps unexpectedly at ${width}: ${JSON.stringify(actual)}`);
            assert.deepEqual(actual.ratings.sort(),['80 / 100','80 / 100','82 / 100']);
        }
    });
});



test('browser: one upload selection stores exactly one photo and one file after repeated detail re-renders', async () => {
    await session(async ({ page, base, open }) => {
        const { bottling, bottle } = await seed(base, '004711');
        await open({query:`?bottling=${bottling.id}`});
        await page.locator('[data-bottle-files]').waitFor({state:'attached'});
        // Editing the bottling only changes the page head. The bottle section
        // (with the upload inputs) is retained by the partial shell update.
        for (let i = 0; i < 3; i++) {
            await page.locator('[data-act="edit-bottling"]').click();
            await page.locator('#bottling-form').waitFor();
            await page.locator('#bottling-form [name="name"]').fill(`Upload Probe ${i}`);
            await page.locator('#bottling-form [type="submit"], #bottling-form button.primary').first().click();
            await page.waitForFunction(name => document.querySelector('main h2')?.textContent.includes(name), `Upload Probe ${i}`);
        }
        const posts = {photos:0, files:0};
        page.on('request', request => {
            if (request.method() !== 'POST') return;
            const path = new URL(request.url()).pathname;
            if (path === `/api/bottles/${bottle.id}/photos`) posts.photos++;
            if (path === `/api/bottles/${bottle.id}/files`) posts.files++;
        });
        const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/fG8AAAAASUVORK5CYII=', 'base64');
        await page.locator('[data-bottle-photos]').first().setInputFiles({name:'probe.png', mimeType:'image/png', buffer:png});
        await page.locator('.photo-tile').first().waitFor();
        await page.locator('[data-bottle-files]').setInputFiles({name:'probe.pdf', mimeType:'application/pdf',
            buffer:Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n')});
        await page.locator('.document-list a').waitFor();
        await page.waitForTimeout(300);
        const stored = (await requestJson(base, '/api/collection')).data.bottlings
            .find(entry => entry.id === bottling.id).bottles.find(entry => entry.id === bottle.id);
        assert.deepEqual(posts, {photos:1, files:1}, 'one selection must trigger exactly one upload request each');
        assert.equal(stored.photos.length, 1);
        assert.equal(stored.files.length, 1);
    });
});


test('browser: tasting overview preserves DOM when chooser opens, and flight creation avoids warehouse reload', async () => {
    await session(async ({page,base,open}) => {
        await open();
        await page.locator('header [data-act="toggle-menu"]').click();
        await page.locator('#site-drawer [data-act="goto-tastings-home"]').click();
        const heading = page.locator('.tasting-home-page .analytics-page-heading');
        await heading.waitFor();
        await heading.evaluate(node => {window.__tastingHeading=node;});
        await page.locator('[data-act="tastings-start-choice"]').click();
        assert.ok(await page.locator('.tasting-create-chooser').isVisible());
        assert.ok(await heading.evaluate(node => node===window.__tastingHeading),
            'Opening the chooser must not replace the existing overview heading');
        await page.locator('[data-act="tastings-start-choice"]').click();
        assert.equal(await page.locator('.tasting-create-chooser').count(),0);
        assert.ok(await heading.evaluate(node => node===window.__tastingHeading),
            'Closing the chooser must retain the overview heading');
        const warehouseGets=[];
        page.on('request', req => {
            if(req.method()==='GET' && new URL(req.url()).pathname==='/api/warehouse') warehouseGets.push(req.url());
        });
        await page.locator('[data-act="tasting-flight-new"]').click();
        await page.locator('#modal-root [data-flight-name]').fill('Scoped flight refresh');
        await page.locator('#modal-root [data-act="tasting-flight-create-confirm"]').click();
        await page.locator('.tasting-flight-page').waitFor();
        assert.equal(warehouseGets.length,0,'A flight mutation must not reload the warehouse');
        const result=await requestJson(base,'/api/collection');
        assert.ok(result.data.tastingFlights.some(item=>item.name==='Scoped flight refresh'));
    });
});
