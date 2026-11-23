import test from 'node:test';
import assert from 'node:assert/strict';
import { session, seed } from './support.js';
import { requestJson } from '../helpers/server.js';
import { actionButton } from '../../public/js/ui/buttons.js';
import { sectionHeader } from '../../public/js/ui/section-header.js';
import { helpIconButton } from '../../public/js/ui/help-icon-button.js';

const widths = [390, 768, 1024, 1440];
const themes = ['light', 'dark'];

const viewportMetrics = () => ({
    viewport: innerWidth,
    overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    header: document.querySelector('.site-header')?.getBoundingClientRect().width,
    main: document.querySelector('main')?.getBoundingClientRect().width,
});

// Additional contract across real page markup, not a regex on CSS source.
test('browser: closure headers, detail grids and empty states remain aligned in four sizes and both themes', async () => {
    await session(async ({page,open,base}) => {
        const {bottling} = await seed(base, '009911');
        for (const query of ['', `?bottling=${bottling.id}`, '?view=analysis', '?view=settings', '?view=help']) {
            await open({query});
            await page.locator('.site-header').waitFor({state:'visible'});
            for (const width of widths) {
                await page.setViewportSize({width,height:900});
                for (const theme of themes) {
                    await page.evaluate(theme => {document.documentElement.dataset.theme=theme;},theme);
                    const geometry = await page.evaluate(viewportMetrics);
                    assert.ok(geometry.main > 0 && geometry.main <= width+1, `${query}/${width}/${theme}: main width`);
                    assert.ok(geometry.header > 0, `${query}/${width}/${theme}: header rendered`);
                    assert.ok(geometry.overflow <= 1, `${query}/${width}/${theme}: horizontal overflow`);
                    const repeated = await page.locator('[data-ds-panel="standard"] .panel').count();
                    assert.equal(repeated,0,`${query}: shared panels must not contain duplicate panel borders`);
                }
            }
        }
    });
});

test('browser: closure help icons are outside heading line boxes and accessible', async () => {
    await session(async ({page,open}) => {
        await open();
        const html = sectionHeader({title:'Wirklich sehr lange und umbruchfähige Abschnittsüberschrift',
            trailingAction: helpIconButton({label:'Hilfe',action:'flight-plan-help'})});
        for (const width of [390,1440]) {
            await page.setViewportSize({width,height:900});
            const data=await page.evaluate(html => {
                const container=document.createElement('div');
                container.style.cssText='width:min(100%,360px);margin:8px 0;';
                container.innerHTML=html;
                document.querySelector('main').append(container);
                const title=container.querySelector('h3');
                const icon=container.querySelector('.ds-help-icon-button');
                const before=title.getBoundingClientRect();
                const lineHeight=getComputedStyle(title).lineHeight;
                const originalHeight=before.height;
                icon.remove();
                const withoutIcon=title.getBoundingClientRect();
                container.remove();
                return {height:originalHeight,without:withoutIcon.height,lineHeight,label:icon.getAttribute('aria-label'),svg:icon.querySelectorAll('svg').length};
            },html);
            assert.equal(data.height,data.without,`${width}: help icon must not change line box`);
            assert.ok(data.height>0 && parseFloat(data.lineHeight)>0);
            assert.equal(data.label,'Hilfe');
            assert.equal(data.svg,1);
        }
    });
});

test('browser: closure button variants and invalid form states remain keyboard accessible', async () => {
    await session(async ({page,open}) => {
        await open();
        const examples = ['primary','secondary','destructive','text','icon'].map(variant =>
            actionButton({label:variant,variant,iconOnly:variant==='icon',disabled:variant==='destructive',
                loading:variant==='primary'})).join('');
        const styles=await page.evaluate(html=>{
            const host=document.createElement('div');host.innerHTML=html;document.querySelector('main').append(host);
            const buttons=[...host.querySelectorAll('button')].map(button=>({
                width:button.getBoundingClientRect().width,
                disabled:button.disabled,busy:button.getAttribute('aria-busy'),
                name:button.getAttribute('aria-label')||button.textContent.trim(),
            }));host.remove();return buttons;
        },examples);
        assert.equal(styles.length,5);
        assert.ok(styles.every(value=>value.width>0&&value.name));
        assert.equal(styles[0].busy,'true');
        assert.equal(styles[0].disabled,true);
        assert.equal(styles[2].disabled,true);
        await page.locator('header [data-act="new"]').click();
        const form=page.locator('#bottling-form');
        await form.waitFor({state:'visible'});
        assert.equal(await form.locator('[name="name"]').evaluate(field=>field.required),true);
        assert.equal(await form.evaluate(el=>el.checkValidity()),false,'required name invalid');
        await form.locator('button[type="submit"]').click();
        assert.equal(await form.count(),1,'invalid submission keeps the form open');
        assert.equal(await form.locator('[name="name"]').evaluate(el=>el.validity.valueMissing),true);
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#modal-root .dialog').count(),0);
    });
});

test('browser: closure repeated modal cycles restore focus, scroll and scrollbar geometry', async () => {
    await session(async ({page,open}) => {
        await open();
        await page.evaluate(()=>{document.querySelector('main').style.minHeight='1900px';window.scrollTo(0,490);});
        const initial=await page.evaluate(()=>({scroll:scrollY,left:document.querySelector('main').getBoundingClientRect().left,
            width:document.querySelector('main').getBoundingClientRect().width}));
        assert.ok(initial.scroll>400);
        for(let cycle=0;cycle<4;cycle++) {
            // Do not scroll the background by clicking an offscreen trigger through Playwright.
            await page.evaluate(()=>{const button=document.querySelector('header [data-act="new"]');button.focus({preventScroll:true});button.click();});
            await page.locator('#modal-root .ds-modal').waitFor({state:'visible'});
            assert.equal(await page.evaluate(()=>document.querySelector('main').inert),true);
            await page.locator('#modal-root .ds-modal-close').focus();
            await page.keyboard.press('Tab');
            assert.equal(await page.evaluate(()=>Boolean(document.activeElement.closest('#modal-root'))),true);
            const locked=await page.evaluate(()=>({left:document.querySelector('main').getBoundingClientRect().left,
                width:document.querySelector('main').getBoundingClientRect().width}));
            assert.ok(Math.abs(locked.left-initial.left)<=1);
            assert.ok(Math.abs(locked.width-initial.width)<=1);
            await page.keyboard.press('Escape');
            assert.equal(await page.locator('#modal-root .dialog').count(),0);
            const restored=await page.evaluate(()=>({scroll:scrollY,inert:document.querySelector('main').inert,
                focus:document.activeElement.matches('header [data-act="new"]')}));
            assert.ok(Math.abs(restored.scroll-initial.scroll)<=1,`cycle ${cycle}: background scroll restored`);
            assert.equal(restored.inert,false);assert.equal(restored.focus,true);
        }
    });
});

test('browser: closure long titles, missing values and languages do not overflow mobile viewport', async () => {
    await session(async ({page,open,base}) => {
        const response=await requestJson(base,'/api/bottlings','POST',{
            name:'A deliberately exceptionally long whisky bottling title with additional marketing descriptors and a few words beyond what a phone can show on a single line',
            description:'Beschreibung und ergänzende Notizen. '.repeat(25),
            firstBottle:{inventoryNumber:'009912',status:'closed'},
        });
        assert.equal(response.status,201);
        await open({query:`?bottling=${response.data.bottling.id}`});
        for(const width of [390,768,1440]) {
            await page.setViewportSize({width,height:900});
            const geometry=await page.evaluate(viewportMetrics);
            assert.ok(geometry.overflow<=1,`long title at ${width}px`);
            assert.ok((await page.locator('[data-ds-detail-field]').count())>0);
        }
        for(const [language,expected] of [['de','Zur Sammlung'],['en','Back to collection']]) {
            await open({query:`?view=settings&lang=${language}`});
            const nav=page.locator('.settings-heading .ds-back-button');
            await nav.waitFor({state:'visible'});
            assert.equal((await nav.innerText()).trim(),expected);
            assert.equal(await nav.locator('svg').count(),1);
            assert.equal((await nav.innerText()).includes('←'),false);
            assert.ok((await page.evaluate(viewportMetrics)).overflow<=1,`${language}: no overflow`);
        }
    });
});
