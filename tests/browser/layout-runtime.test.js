import test from 'node:test';
import assert from 'node:assert/strict';
import {session, seed, openSettingsFromMenu, openSettingsSection} from './support.js';
import {requestJson} from '../helpers/server.js';

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/fG8AAAAASUVORK5CYII=';

async function go(page, action, selector) {
    if (!(await page.locator('#site-drawer').isVisible())) {
        await page.locator('header [data-act="toggle-menu"]').click();
    }
    await page.locator(`#site-drawer [data-act="${action}"]`).click();
    await page.locator(selector).waitFor();
}

// These checks deliberately read the *computed* result of the complete CSS
// cascade. They replace source-regex assertions that passed even when another
// stylesheet overrode the property in a real viewport.
test('browser: mobile header keeps accessible actions in order, usable icons and positive spacing', async () => {
    await session(async ({page,open}) => {
        await open();
        for (const width of [360,390,450,1366]) {
            await page.setViewportSize({width,height:850});
            const values = await page.locator('.site-header').evaluate(header => {
                const actions = [...header.querySelectorAll('.top-actions > button')];
                const brand = header.querySelector('.brand');
                return {
                    names: actions.map(el => el.dataset.act),
                    labels: actions.map(el => el.getAttribute('aria-label')),
                    svg: actions.map(el => !!el.querySelector('svg')),
                    rightEdges: actions.map(el => el.getBoundingClientRect().right),
                    gap: parseFloat(getComputedStyle(brand).columnGap || getComputedStyle(brand).gap),
                    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
                };
            });
            assert.deepEqual(values.names,['toggle-theme','scan','new','toggle-menu']);
            assert.ok(values.labels.every(Boolean), `${width}: accessible labels required`);
            assert.ok(values.svg.every(Boolean), `${width}: every action needs an SVG`);
            assert.ok(values.gap > 0, `${width}: logo must not collide with title`);
            assert.ok(values.rightEdges.at(-1) >= Math.max(...values.rightEdges.slice(0,-1)), `${width}: menu must remain last`);
            assert.equal(values.overflow,false,`${width}: header must not create horizontal overflow`);
        }
        const original = await page.locator('.theme-toggle').getAttribute('aria-pressed');
        await page.locator('.theme-toggle').click();
        assert.notEqual(await page.locator('.theme-toggle').getAttribute('aria-pressed'), original);
        assert.equal(await page.locator('.theme-toggle svg').count(),1);
    });
});

test('browser: mobile detail uses full-width controls and two action rows without overflow', async () => {
    await session(async ({page,open,base}) => {
        const {bottling}=await seed(base,'001291');
        await page.setViewportSize({width:390,height:844});
        await open({query:`?bottling=${bottling.id}`});
        const metrics=await page.locator('.detail-page-head').evaluate(head => {
            const title=head.querySelector('h2').getBoundingClientRect();
            const actions=head.querySelector('.detail-head-actions').getBoundingClientRect();
            const edit=head.querySelector('[data-act="edit-bottling"]').getBoundingClientRect();
            const remove=head.querySelector('[data-act="delete-bottling"]').getBoundingClientRect();
            return {titleBottom:title.bottom,actionsTop:actions.top,editTop:edit.top,
                removeTop:remove.top,actionRight:actions.right,parentRight:head.getBoundingClientRect().right,
                overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1};
        });
        assert.ok(metrics.actionsTop>=metrics.titleBottom-1,'buttons must be below the title');
        assert.ok(Math.abs(metrics.editTop-metrics.removeTop)<=2,'edit and delete must share a row');
        assert.ok(metrics.actionRight<=metrics.parentRight+2);
        assert.equal(metrics.overflow,false);
        await page.locator('[data-act="edit-bottling"]').click();
        for (const name of ['distillationDate','bottlingDate']) {
            const field=page.locator(`#bottling-form [name="${name}"]`);
            const actual=await field.evaluate(el=>({type:el.type,width:el.getBoundingClientRect().width,
                parentWidth:el.parentElement.getBoundingClientRect().width,height:el.getBoundingClientRect().height}));
            assert.equal(actual.type,'date');
            assert.ok(actual.width<=actual.parentWidth+2,`${name} must fit on a phone`);
            assert.ok(actual.height>=40,`${name} must remain touchable`);
        }
    });
});

test('browser: page headings share readable typography and fit desktop and phone viewports', async () => {
    await session(async ({page,open}) => {
        await open();
        const pages=[
            {action:'goto-analysis',selector:'.analytics-page-heading'},
            {action:'goto-warehouse',selector:'.warehouse-heading'},
            {action:'goto-map',selector:'.map-heading'},
            {action:'goto-settings-menu',selector:'.settings-heading'},
            {action:'goto-help',selector:'.help-heading'},
        ];
        for (const width of [1366,390]) {
            await page.setViewportSize({width,height:900});
            await go(page,'goto-home','.collection-heading');
            for (const route of pages) {
                await go(page,route.action,route.selector);
                const result=await page.locator(route.selector).evaluate(head=>{
                    const h=head.querySelector('h2');
                    const rect=h.getBoundingClientRect(), parent=head.getBoundingClientRect();
                    return {size:parseFloat(getComputedStyle(h).fontSize),overflow:rect.right>parent.right+2,
                        title:h.textContent.trim(),hasCopy:!!head.querySelector('.intro,.page-heading-copy')};
                });
                assert.ok(result.size>=23,`${route.action}: heading legible at ${width}`);
                assert.equal(result.overflow,false,`${route.action}: heading fits at ${width}`);
                assert.ok(result.title.length>2);
                assert.equal(result.hasCopy,true,`${route.action}: accessible introduction`);
            }
        }
    });
});

test('browser: square content surfaces, filter controls and KPIs inherit their shared design', async () => {
    await session(async ({page,open}) => {
        await open();
        for (const width of [1366,390]) {
            await page.setViewportSize({width,height:900});
            const home=await page.evaluate(()=>({
                card:getComputedStyle(document.querySelector('.panel.stat')).borderRadius,
                gold:getComputedStyle(document.querySelector('.panel.stat')).borderTopWidth,
                // A collapsed filter's own computed display is still "block" when
                // its parent is display:none. Its measured height is then 0px,
                // even though it is not an interactive/visible control.
                toolbar:[...document.querySelectorAll('.toolbar input,.toolbar select,.toolbar [data-act="toggle-view"],.toolbar [data-act="toggle-collection-filters"]')]
                    .filter(el=>el.getClientRects().length>0 && getComputedStyle(el).visibility!=='hidden')
                    .map(el=>({name:el.id || el.dataset.act, height:el.getBoundingClientRect().height})),
                hiddenExtras:[...document.querySelectorAll('.collection-filter-extra select')]
                    .every(el=>el.getClientRects().length===0),
                overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,
            }));
            assert.equal(home.card,'0px');
            assert.equal(home.gold,'3px');
            assert.ok(home.toolbar.length>=4,`${width}: visible filter controls exist`);
            assert.ok(home.toolbar.every(item=>item.height>=40),
                `${width}: accessible filter height (${JSON.stringify(home.toolbar)})`);
            assert.equal(home.hiddenExtras,true,`${width}: advanced filters start collapsed`);
            assert.equal(home.overflow,false,`${width}: no horizontal overflow`);
            await page.locator('[data-act="toggle-collection-filters"]').click();
            const expanded=await page.evaluate(()=>({
                controls:[...document.querySelectorAll('.collection-filter-extra select,#filter-status,#filter-completion')]
                    .filter(el=>el.getClientRects().length>0)
                    .map(el=>({name:el.id,height:el.getBoundingClientRect().height})),
                overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,
            }));
            assert.ok(expanded.controls.length>=3,`${width}: advanced filters are visible when opened`);
            assert.ok(expanded.controls.every(item=>item.height>=40),
                `${width}: expanded filter height (${JSON.stringify(expanded.controls)})`);
            assert.equal(expanded.overflow,false,`${width}: expanded filters do not overflow horizontally`);
            await page.locator('[data-act="toggle-collection-filters"]').click();
        }
        await go(page,'goto-analysis','.analytics-page');
        const analytics=await page.locator('.analytics-metrics .panel.stat').first().evaluate(el=>({
            radius:getComputedStyle(el).borderRadius,top:getComputedStyle(el).borderTopWidth}));
        assert.equal(analytics.radius,'0px');
        assert.equal(analytics.top,'3px');
        await go(page,'goto-help','.help-page');
        const help=await page.locator('.help-content-panel').first().evaluate(el=>({
            radius:getComputedStyle(el).borderRadius,
            textSize:parseFloat(getComputedStyle(document.querySelector('.help-description')).fontSize)}));
        assert.equal(help.radius,'0px');
        assert.ok(help.textSize<=18 && help.textSize>=12);
    });
});

test('browser: mobile section selectors and date fields work without overflowing', async () => {
    await session(async ({page,open})=>{
        await page.setViewportSize({width:390,height:850});
        await open();
        await go(page,'goto-analysis','.analytics-page');
        const nav=page.locator('.analytics-page .section-nav-mobile select');
        assert.equal(await nav.count(),1);
        assert.equal(await nav.isVisible(),true);
        await nav.selectOption('timeline');
        const field=page.locator('#analytics-start-date');
        await field.waitFor();
        const metrics=await field.evaluate(el=>({type:el.type,right:el.getBoundingClientRect().right,
            parentRight:el.parentElement.getBoundingClientRect().right}));
        assert.equal(metrics.type,'date');
        assert.ok(metrics.right<=metrics.parentRight+2);
        await field.fill('2026-01-15');
        assert.equal(await field.inputValue(),'2026-01-15');
        await go(page,'goto-help','.help-page');
        assert.equal(await page.locator('.help-page .section-nav-mobile select').isVisible(),true);
        await go(page,'goto-settings-menu','.settings-page');
        assert.equal(await page.locator('.settings-page .section-nav-mobile select').isVisible(),true);
        await openSettingsSection(page,'general');
        assert.equal(await page.locator('#established-year').isVisible(),true);
    });
});

test('browser: collection hero stays dark in both themes and photos have real internal spacing', async () => {
    await session(async ({page,open,base})=>{
        const {bottling,bottle}=await seed(base,'001292');
        const upload=await requestJson(base,`/api/bottles/${bottle.id}/photos`,'POST',{image:png});
        assert.equal(upload.status,201);
        await open();
        const hero=()=>page.locator('.collection-hero').evaluate(el=>({
            color:getComputedStyle(el).color,overlay:getComputedStyle(el.querySelector('.hero-overlay')).backgroundImage,
            copy:el.querySelector('.hero-description')?.textContent?.trim()}));
        const light=await hero();
        assert.ok(light.copy?.length>30);
        assert.equal(light.color,'rgb(255, 255, 255)');
        await page.locator('.theme-toggle').click();
        const dark=await hero();
        assert.equal(dark.copy,light.copy);
        assert.equal(dark.color,light.color);
        await page.locator(`.whisky-card[data-id="${bottling.id}"]`).click();
        const photo=await page.locator('.hero-photo').evaluate(el=>({
            top:parseFloat(getComputedStyle(el).paddingTop),bottom:parseFloat(getComputedStyle(el).paddingBottom),
            imagePadding:parseFloat(getComputedStyle(el.querySelector('img')).paddingBottom)}));
        assert.ok(photo.top>0 && photo.bottom>0,'cover image container retains visible inset');
        assert.ok(photo.imagePadding>=0);
    });
});

test('browser: map theme changes tile colors while leaving marker icons and legend unfiltered', async () => {
    await session(async ({page,open})=>{
        await open();
        await go(page,'goto-map','.map-canvas');
        const metrics=()=>page.locator('.map-canvas').evaluate(canvas=>{
            const css=el=>getComputedStyle(el);
            const legend=canvas.closest('main').querySelector('.map-legend');
            const cluster=legend?.querySelector('.map-cluster-visual');
            const marker=legend?.querySelector('.map-legend-marker');
            return {tileFilter:css(canvas.querySelector('.map-tiles')).filter,
                markerShadow:marker?css(marker).boxShadow:null,
                clusterRadius:cluster?css(cluster).borderRadius:null,
                canvasBackground:css(canvas).backgroundColor};
        });
        const first=await metrics();
        await page.locator('.theme-toggle').click();
        const second=await metrics();
        assert.notEqual(second.tileFilter,first.tileFilter,'tile colors follow selected theme');
        if (first.markerShadow!==null) assert.equal(first.markerShadow,'none');
        if (first.clusterRadius!==null) assert.equal(first.clusterRadius,'50%');
        assert.notEqual(first.canvasBackground,second.canvasBackground);
    });
});

test('browser: settings headings, distillery form and collection spacing use live geometry', async () => {
    await session(async ({page,open})=>{
        await open();
        await openSettingsFromMenu(page);
        await openSettingsSection(page,'general');
        const layout=await page.locator('[data-settings-panel="general"]').evaluate(panel=>{
            const title=panel.querySelector('.analytics-section-title');
            const content=panel.querySelector('.panel.section');
            const top=title.getBoundingClientRect(), below=content.getBoundingClientRect();
            return {gap:below.top-top.bottom,overflows:document.documentElement.scrollWidth>document.documentElement.clientWidth+1};
        });
        assert.ok(layout.gap>=12 && layout.gap<=30,`consistent heading/content spacing: ${layout.gap}px`);
        assert.equal(layout.overflows,false);
        await openSettingsSection(page,'distilleries');
        const list=await page.locator('.distillery-list').evaluate(el=>({overflow:getComputedStyle(el).overflowY,
            height:el.getBoundingClientRect().height}));
        assert.equal(list.overflow,'visible');
        assert.ok(list.height>1000,'distillery list follows page scrolling, not nested scrollbox');
    });
});
