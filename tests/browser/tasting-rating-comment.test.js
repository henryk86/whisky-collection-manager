import test from 'node:test';
import assert from 'node:assert/strict';
import {session} from './support.js';
import {requestJson} from '../helpers/server.js';

test('browser: rating comments persist through edit, read-only view and the 14px bottling summary',async()=>{
    await session(async({page,base,open})=>{
        await open();
        await page.locator('[data-act="new"]').first().click();
        await page.locator('#bottling-form [name="name"]').fill('Rating comment test');
        await page.locator('#bottling-form button[type="submit"]').click();
        await page.locator('[data-act="tastings-new"]').click();
        const editor=page.locator('[data-flavor-detail]');
        await editor.locator('[data-tasting-note="nose"]').fill('Vanille und Honig');
        await editor.locator('[data-tasting-rating-comment]').fill('Sehr rund und komplex.');
        await page.locator('[data-act="tasting-create"]').click();
        const comment=editor.locator('.tasting-rating-comment .tasting-readonly-note');
        await comment.waitFor();
        assert.equal(await comment.textContent(),'Sehr rund und komplex.');
        await editor.locator('[data-act="tasting-edit-start"]').click();
        const input=editor.locator('[data-tasting-rating-comment]');
        assert.equal(await input.inputValue(),'Sehr rund und komplex.');
        await input.fill('Noch einmal probieren.');
        await input.press('Tab');
        await page.waitForFunction(async()=>{
            const response=await fetch('/api/collection');
            const collection=await response.json();
            return collection.bottlings?.[0]?.tastings?.[0]?.ratingComment==='Noch einmal probieren.';
        });
        await editor.locator('[data-act="tasting-edit-done"]').click();
        assert.equal(await comment.textContent(),'Noch einmal probieren.');
        await page.locator('[data-act="tastings-back-list"]').click();
        await page.locator('[data-act="tastings-back-detail"]').click();
        const fontSize=await page.locator('.tasting-summary-note-value').first().evaluate(el=>getComputedStyle(el).fontSize);
        assert.equal(fontSize,'14px');
        await page.setViewportSize({width:390,height:844});
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
    });
});

test('browser: tasting preview balances present sections without desktop wrapping or overflow',async()=>{
    await session(async({page,base,open})=>{
        const bottling=(await requestJson(base,'/api/bottlings','POST',{
            name:'Responsive tasting preview'
        })).data.bottling;
        const flavorProfile={woody:8,smoky:3,cereal:2,peaty:7,fruity:4,floral:1,
            medicinal:0,winey:2,feinty:5,sulphury:3};
        const result=await requestJson(base,`/api/bottlings/${bottling.id}/tastings`,'POST',{
            tastedOn:'2026-11-22',rating:80,flavorProfile,
            tastingNotes:{
                nose:'Vanille, frische Früchte und ein langer, leicht rauchiger Nachklang',
                palate:'Ausgewogen mit einer etwas längeren Beschreibung für die Vorschau',
                finish:'Würzig und warm'
            }
        });
        assert.equal(result.status,201);
        await open();
        await page.locator(`[data-act="open"][data-id="${bottling.id}"]`).first().click();
        const summary=page.locator('.tasting-summary-content');
        await summary.waitFor();
        for (const width of [1440,1200,1024,960]) {
            await page.setViewportSize({width,height:900});
            const layout=await summary.evaluate(row=>{
                const parts=['main','radar','notes'].map(name=>{
                    const el=row.querySelector(`.tasting-summary-${name}`);
                    const r=el.getBoundingClientRect();
                    return {name,left:r.left,right:r.right,width:r.width};
                });
                const parent=row.getBoundingClientRect();
                const meta=row.querySelector('.tasting-summary-main .tasting-summary-meta').getBoundingClientRect();
                const action=row.querySelector('.tasting-summary-main .tasting-summary-actions').getBoundingClientRect();
                return {wrap:getComputedStyle(row).flexWrap,align:getComputedStyle(row).alignItems,parts,
                    left:parent.left,right:parent.right,
                    actionBelowMeta:action.top>=meta.bottom,
                    documentWidth:document.documentElement.scrollWidth};
            });
            assert.equal(layout.wrap,'nowrap',`desktop ${width}px stays on a single row`);
            assert.equal(layout.align,'flex-start',`desktop ${width}px top-aligns all columns`);
            if (width>=1200) {
                const [,radar,notes]=layout.parts;
                assert.ok(notes.width >= radar.width * 1.65,
                    `tasting notes are considerably wider than the radar at ${width}px`);
            }
            assert.ok(layout.actionBelowMeta,`open button is below tasting date at ${width}px`);
            assert.ok(layout.documentWidth<=width+2,`no page overflow at ${width}px`);
            for(let i=0;i<layout.parts.length;i++) {
                const item=layout.parts[i];
                assert.ok(item.width>0,`${item.name} has space at ${width}px`);
                assert.ok(item.left>=layout.left-1 && item.right<=layout.right+1,
                    `${item.name} stays inside the panel at ${width}px`);
                if(i>0) assert.ok(item.left>=layout.parts[i-1].right-1,
                    `${item.name} does not overlap its neighbor at ${width}px`);
            }
        }
        await page.setViewportSize({width:390,height:844});
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
    });
});
