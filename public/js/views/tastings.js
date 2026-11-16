import { t } from '../i18n/index.js';
import { escapeHtml } from '../ui/dom.js';
import { formatDate, imageUrl } from '../ui/format.js';
import { request } from '../api.js';
import { toast } from '../ui/notifications.js';
import { flavorChart, readFlavorProfile, displayFlavorProfile } from '../ui/flavor-profile.js';
import { createTastingHistory } from '../domain/tasting-history.js';
import { glencairnRating, syncGlencairnRating } from '../ui/glencairn-rating.js';
import { glencairnRatingSymbol } from '../ui/glencairn-icon.js';
import { whiskyColorSelector, whiskyColorDisplay } from '../ui/whisky-color-selector.js';
import { parseTastingScore, emptyTastingNotes } from '../../../shared/tasting.js';
import { sortedTastings } from '../../../shared/tasting-records.js';
import {allTastingReferences,flightEntries,flightForTasting} from '../../../shared/tasting-flights.js';
import { allStandaloneTastings } from '../../../shared/standalone-tastings.js';
import { editIcon, newBottlingIcon } from '../ui/action-icons.js';
import { reorderFlightIds } from '../features/flight-order.js';

/** Tasting list and single-record editor; no migration of earlier bottling notes. */
export function createTastingsView({state,selectors,shell,navigate,refresh,showModal,closeModal}) {
    let flavorSession = null;
    let createChoiceOpen = false;
    let flightEditing = false;
    let flightAdding = false;
    let flightCreating = false;
    let lastFlightId = null;
    const isExternal = () => state.page === 'external-tasting';
    const standalone = () => allStandaloneTastings(state.collection || {});
    const subject = () => state.collection?.bottlings?.find(b => b.id === state.selected);
    const editPage = (external = isExternal()) => external ? 'external-tasting' : 'tasting';
    const distilleryMeta = (bottling, owned = true) => [
        (bottling?.distilleryIds || []).map(id => state.collection?.distilleries?.find(d => d.id === id)?.name).filter(Boolean).join(', ') || bottling?.distillery || '',
        bottling?.ageYears != null && bottling.ageYears !== '' ? `${t('forms.bottling.ageYears')}: ${t('home.facts.years',{count:bottling.ageYears})}` : '',
        owned && typeof bottling?.caskType === 'string' && bottling.caskType.trim() ? `${t('forms.bottling.caskType')}: ${bottling.caskType.trim()}` : '',
        bottling?.abv != null && bottling.abv !== '' ? `${t('forms.bottling.abv')}: ${String(bottling.abv).replace('.',',')} % Vol.` : '',
        !owned && bottling?.bottler ? `${t('forms.bottling.bottler')}: ${bottling.bottler}` : '',
        !owned && bottling?.releaseYear != null && bottling.releaseYear !== '' ? `${t('forms.bottling.releaseYear')}: ${bottling.releaseYear}` : ''
    ].filter(Boolean).join(' · ');
    const backLink = (action,label) => `<nav class="tasting-back-nav" aria-label="${escapeHtml(t(label))}"><button type="button" class="inline-link tasting-back" data-act="${action}"><span aria-hidden="true">←</span> ${escapeHtml(t(label))}</button></nav>`;
    const pageTitle = (title, intro, eyebrow = t('tastings.childEyebrow')) => `<header class="section-head analytics-page-heading"><div class="page-heading-copy">
        <span class="eyebrow dark">${escapeHtml(eyebrow)}</span>
        <h2>${escapeHtml(title)}<span class="heading-period">.</span></h2>
        <p class="intro">${escapeHtml(intro)}</p></div></header>`;
    // Show exactly the same Abfuellungsfoto (cover image) as the bottling detail page.
    const bottlingInfo = (bottling, external = false, draft = false) => {
        const photo = external ? '' : (selectors?.coverPhoto?.(bottling.id) || '');
        return `<section class="analytics-panel tasting-bottling-info">
        ${external ? `${draft ? '' : `<div class="tasting-bottling-summary" data-external-read>
            <div class="tasting-bottling-summary-head"><strong>${escapeHtml(bottling.name || '')}</strong>
                <div class="tasting-external-summary-actions"><button type="button" class="btn small" data-act="tasting-external-edit">${editIcon}<span>${escapeHtml(t('common.actions.edit'))}</span></button>
                <button type="button" class="btn small" data-act="tasting-external-assign">${escapeHtml(t('tastings.assignToCollection'))}</button></div></div>
            ${distilleryMeta(bottling,false) ? `<p class="muted">${escapeHtml(distilleryMeta(bottling,false))}</p>` : ''}
        </div>`}
        <div data-external-edit ${draft ? '' : 'hidden'}>
            <div class="tasting-external-fields">${externalFields(bottling)}</div>
            ${draft ? '' : `<div class="actions tasting-external-actions"><button type="button" class="btn" data-act="tasting-external-cancel">${escapeHtml(t('common.actions.cancel'))}</button>
                <button type="button" class="btn primary" data-act="tasting-external-save">${escapeHtml(t('common.actions.save'))}</button></div>`}
        </div>` : `<div class="tasting-bottling-summary tasting-bottling-photo-layout">
            ${photo ? `<img class="tasting-bottling-photo" src="${escapeHtml(imageUrl(photo))}" alt="${escapeHtml(t('home.image.bottleAlt',{name:bottling.name || ''}))}" loading="lazy">` : ''}
            <div class="tasting-bottling-copy">
                <div class="tasting-bottling-summary-head"><strong>${escapeHtml(bottling.name || '')}</strong>
                    <button type="button" class="btn small" data-act="tasting-open-bottling">${escapeHtml(t('tastings.openBottlingDetails'))}</button></div>
                ${distilleryMeta(bottling) ? `<p class="muted">${escapeHtml(distilleryMeta(bottling))}</p>` : ''}
            </div>
        </div>`}
    </section>`;
    };
    const associatedFlight = record => record?.id ? flightForTasting(state.collection,record.id) : null;
    const flightHint = record => {
        const flight=associatedFlight(record);
        if (!flight) return '';
        const pos=flight.tastingIds.indexOf(record.id)+1;
        return `<div class="tasting-flight-context"><button type="button" class="inline-link" data-act="tasting-open-flight" data-flight-id="${escapeHtml(flight.id)}">${escapeHtml(flight.name)} · ${escapeHtml(t('tastingFlights.position',{position:pos,count:flight.tastingIds.length}))}</button></div>`;
    };
    const tastingRating = record => record.rating == null ? escapeHtml(t('tasting.unrated')) : `${escapeHtml(String(record.rating))} / 100`;
    const blank = value => value == null || String(value).trim() === '' ? '<span class="muted">&ndash;</span>' : escapeHtml(String(value));
    const staticRating = record => `<div class="tasting-readonly-rating"><span class="tasting-readonly-glasses" aria-hidden="true">${record.rating == null ? '' : Array.from({length:5},(_,i)=>{
        const fill=Math.max(0,Math.min(100,(Number(record.rating)-i*20)*5));
        return glencairnRatingSymbol({fill,id:`read-rating-${i}`});
    }).join('')}</span><strong>${tastingRating(record)}</strong></div>`;
    const tastingReadOnly = value => `<div class="flavor-detail-panel tasting-panel tasting-readonly-panels">
        <div class="tasting-record-fields analytics-panel tasting-readonly-meta-panel">
            <div class="tasting-readonly-meta-fields">
                <div class="tasting-readonly-field"><span class="tasting-readonly-label">${escapeHtml(t('tastings.date'))}</span><strong>${escapeHtml(formatDate(value.tastedOn || ''))}</strong></div>
                ${value.title ? `<div class="tasting-readonly-field"><span class="tasting-readonly-label">${escapeHtml(t('tastings.nameReadonly'))}</span><strong>${escapeHtml(value.title)}</strong></div>` : ''}
            </div>
            <div class="actions tasting-readonly-meta-actions"><button type="button" class="btn small" data-act="tasting-edit-start">${editIcon}<span>${escapeHtml(t('common.actions.edit'))}</span></button></div>
        </div>
        <div class="tasting-top-row">
            <section class="analytics-panel tasting-color-panel"><h3>${escapeHtml(t('tasting.colorHeading'))}</h3>
                ${whiskyColorDisplay(value.whiskyColor) || `<p class="hint">${escapeHtml(t('tastings.notRecorded'))}</p>`}
            </section>
            <section class="analytics-panel tasting-senses-section"><h3>${escapeHtml(t('flavor.title'))}</h3>
                ${flavorChart(value.flavorProfile,{editable:false})}</section>
        </div>
        <section class="analytics-panel"><h3>${escapeHtml(t('tasting.notes'))}</h3>
            <div class="tasting-notes">${['nose','palate','finish'].map(key=>`<div class="tasting-readonly-field"><span class="tasting-readonly-label">${escapeHtml(t(`forms.bottling.${key}`))}</span><p class="tasting-readonly-note">${blank(value.tastingNotes?.[key])}</p></div>`).join('')}</div>
        </section>
        <section class="analytics-panel tasting-rating-panel"><h3>${escapeHtml(t('tasting.overallRating'))}</h3>
            ${staticRating(value)}</section>
    </div>`;
    const tastingListGlasses = record => {
        if (record.rating == null || !Number.isFinite(Number(record.rating))) return '';
        const safe=Math.max(0,Math.min(100,Number(record.rating)));
        const unique=String(record.id).replace(/[^a-zA-Z0-9_-]/g,'-');
        return `<span class="tasting-list-glasses" aria-hidden="true">${Array.from({length:5},(_,i)=>
            glencairnRatingSymbol({fill:Math.max(0,Math.min(100,(safe-i*20)*5)),id:`tasting-list-${unique}-${i}`})).join('')}</span>`;
    };
    const tastingRow = ({record,b,external=false,home=false}) => `<div class="warehouse-bottle-row tasting-entry-row ${home?'tasting-home-row':'tasting-list-row'}">
        <button type="button" class="tasting-entry-open" data-act="${home?'tastings-home-open':'tastings-open'}" ${home ? `data-external="${external?'1':'0'}" data-bottling-id="${escapeHtml(external?record.id:b.id)}"` : ''} data-tasting-id="${escapeHtml(record.id)}"
            aria-label="${escapeHtml(`${t('tastings.open')}: ${home ? b.name : (record.title || formatDate(record.tastedOn))}`)}">
            <span class="warehouse-bottle-row-info tasting-entry-info">
                <strong>${escapeHtml(home ? b.name : (record.title || formatDate(record.tastedOn)))}</strong>
                <small>${escapeHtml(home ? formatDate(record.tastedOn) : (record.title ? formatDate(record.tastedOn) : ''))}${home && record.title ? ` · ${escapeHtml(record.title)}` : ''}</small>
            </span>
            <span class="tasting-entry-trailing">${tastingListGlasses(record)}<span class="tasting-list-rating">${tastingRating(record)}</span><span class="tasting-entry-chevron" aria-hidden="true">›</span></span>
        </button>
        ${home ? '' : `<div class="tasting-entry-actions"><button type="button" class="btn small danger" data-act="tasting-delete" data-tasting-id="${escapeHtml(record.id)}">${escapeHtml(t('common.actions.delete'))}</button></div>`}
    </div>`;
    const emptyRecord = () => ({tastedOn:localToday(),title:'',flavorProfile:null,tastingNotes:emptyTastingNotes(),rating:null,whiskyColor:null});
    const emptyBottling = () => ({name:'',distillery:'',bottler:'',ageYears:null,abv:null,releaseYear:null});
    let flavorSaveQueue = Promise.resolve();
    function flavorNode() { return globalThis.document?.querySelector?.('[data-flavor-detail]') || null; }
    function readTastingEditor() {
        const node = flavorNode();
        return {flavorProfile:readFlavorProfile(node),
            tastingNotes:Object.fromEntries(['nose','palate','finish'].map(key =>
                [key,node.querySelector(`[data-tasting-note="${key}"]`)?.value || ''])),
            rating:parseTastingScore(node.querySelector('[data-tasting-score]')?.value),
            whiskyColor:node.querySelector('[data-whisky-color]')?.dataset.whiskyColor || null};
    }
    function updateTastingButtons() {
        const node = flavorNode();
        if (!node || !flavorSession) return;
        const undo = node.querySelector('[data-act="flavor-detail-undo"]');
        const redo = node.querySelector('[data-act="flavor-detail-redo"]');
        if (undo) undo.disabled = !flavorSession.history.canUndo;
        if (redo) redo.disabled = !flavorSession.history.canRedo;
        const missing = node.querySelector('[data-flavor-missing]');
        if (missing) missing.hidden = Boolean(flavorSession.history.value.flavorProfile);
        const clearRating = node.querySelector('[data-act="tasting-rating-clear"]');
        if (clearRating) clearRating.disabled = flavorSession.history.value.rating == null;
        const clearColor = node.querySelector('[data-act="tasting-color-clear"]');
        const clearFlavor = node.querySelector('[data-act="tasting-flavor-clear"]');
        if (clearFlavor) clearFlavor.disabled = !flavorSession.history.value.flavorProfile;
        if (clearColor) clearColor.disabled = !flavorSession.history.value.whiskyColor;
    }
    function redrawTasting() {
        const node = flavorNode();
        if (!node || !flavorSession) return;
        const value = flavorSession.history.value;
        displayFlavorProfile(node, value.flavorProfile);
        for (const key of ['nose','palate','finish']) {
            const input = node.querySelector(`[data-tasting-note="${key}"]`);
            if (input) input.value = value.tastingNotes[key];
        }
        const rating = node.querySelector('[data-tasting-rating]');
        if (rating) rating.outerHTML = glencairnRating(value.rating);
        const color = node.querySelector('[data-whisky-color]');
        if (color) color.outerHTML = whiskyColorSelector(value.whiskyColor);
        updateTastingButtons();
    }
    function persistTasting() {
        const session = flavorSession;
        if (!session?.editing) return Promise.resolve();
        const value = session.history.value;
        flavorSaveQueue = flavorSaveQueue.then(async () => {
            if (session.draft) return;
            const updated = await request(session.external ? `/api/external-tastings/${encodeURIComponent(session.id)}` : `/api/bottlings/${encodeURIComponent(session.bottlingId)}/tastings/${encodeURIComponent(session.id)}`, {
                method:'PATCH', body:JSON.stringify(value)
            });
            if (session.external) {
                const item=state.collection?.externalTastings?.find(t=>t.id===session.id);
                if (item) Object.assign(item,updated);
            } else {
                const entry=state.collection?.bottlings?.find(b=>b.id===session.bottlingId);
                const tasting=entry?.tastings?.find(t=>t.id===session.id);
                if (tasting) Object.assign(tasting,updated);
            }
        }).catch(error => toast(error.message, true));
        return flavorSaveQueue;
    }
    function commitTasting() {
        if (!flavorSession?.editing) return true;
        const node = flavorNode();
        if (!node || !flavorSession) return;
        let value;
        const score = node.querySelector('[data-tasting-score]');
        try { value = readTastingEditor(); }
        catch {
            if (score) {
                score.setCustomValidity(t('tasting.ratingInvalid'));
                const error = node.querySelector('#tasting-score-error');
                if (error) error.textContent = t('tasting.ratingInvalid');
                score.setAttribute('aria-invalid','true');
            }
            return false;
        }
        if (score) {
            score.setCustomValidity(''); score.removeAttribute('aria-invalid');
            const error = node.querySelector('#tasting-score-error');
            if (error) error.textContent = '';
        }
        if (flavorSession.history.record(value)) {
            syncGlencairnRating(node.querySelector('[data-tasting-rating]'), value.rating);
            // Do not replace focused form controls while a blur/change event fires.
            // This also prevents the browser from losing a pending glass-button click.
            updateTastingButtons();
            void persistTasting();
        }
        return true;
    }
    function previewRating() {
        const widget=flavorNode()?.querySelector('[data-tasting-rating]');
        if (!widget) return;
        try { syncGlencairnRating(widget,parseTastingScore(widget.querySelector('[data-tasting-score]')?.value)); }
        catch { /* Leave the last valid preview intact until the input is corrected. */ }
    }
    function chooseRating(value) {
        if (!flavorSession?.editing) return;
        const node = flavorNode()?.querySelector('[data-tasting-rating]');
        if (!node) return;
        node.dataset.ratingValue = value == null ? '' : String(value);
        const input = node.querySelector('[data-tasting-score]');
        if (input) input.value = value == null ? '' : String(value).replace('.',',');
        commitTasting();
        redrawTasting();
        const selector = value == null ? '[data-act="tasting-rating-clear"]' : `[data-rating-points="${value}"]`;
        flavorNode()?.querySelector(selector)?.focus?.();
    }
    function chooseColor(value) {
        if (!flavorSession?.editing) return;
        const node = flavorNode()?.querySelector('[data-whisky-color]');
        if (!node) return;
        node.dataset.whiskyColor = value || '';
        commitTasting();
        redrawTasting();
        flavorNode()?.querySelector(value ? `[data-color-key="${value}"]` : '[data-act="tasting-color-clear"]')?.focus?.();
    }
    function clearFlavor() {
        if (!flavorSession?.editing) return;
        if (!flavorSession || !flavorSession.history.value.flavorProfile) return;
        if (flavorSession.history.record({...flavorSession.history.value,flavorProfile:null})) {
            redrawTasting();
            void persistTasting();
            flavorNode()?.querySelector('[data-act="tasting-flavor-clear"]')?.focus?.();
        }
    }
    function stepFlavor(direction) {
        if (!flavorSession?.editing) return;
        const changed = direction < 0 ? flavorSession.history.undo() : flavorSession.history.redo();
        if (changed) { redrawTasting(); void persistTasting(); }
    }

    function externalFields(info = {}) {
        const fields=[
            ['name','tastings.externalName','text',180,true],['distillery','tastings.externalDistillery','text',140,false],
            ['bottler','tastings.externalBottler','text',140,false],['ageYears','tastings.externalAge','number',null,false],
            ['abv','tastings.externalAbv','number',null,false],['releaseYear','tastings.externalYear','number',null,false]
        ];
        return fields.map(([key,label,type,max,required])=>`<label>${escapeHtml(t(label))}
            <input data-external-field="${key}" name="${key}" type="${type}" ${max ? `maxlength="${max}"`:''} ${required?'required':''}
                ${type==='number' ? (key==='abv'?'min="0" max="100" step="0.1"':key==='ageYears'?'min="0" max="200" step="1"':'min="1800" max="2200" step="1"'):''}
                value="${escapeHtml(String(info[key] ?? ''))}"></label>`).join('');
    }
    function readExternalFields(node) {
        const data={};
        for (const key of ['name','distillery','bottler','ageYears','abv','releaseYear']) {
            const input=node.querySelector(`[data-external-field="${key}"]`);
            if (!input?.checkValidity()) { input?.reportValidity(); return null; }
            data[key]=['ageYears','abv','releaseYear'].includes(key) ? (input.value===''?null:Number(input.value)) : input.value.trim();
        }
        if (!data.name) { node.querySelector('[data-external-field="name"]')?.reportValidity(); return null; }
        return data;
    }
    const flightList = () => [...(state.collection?.tastingFlights || [])].sort((a,b)=>b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    function homeFlights() {
        const flights=flightList();
        return `<section class="analytics-panel tasting-flight-home">
            <div class="tasting-panel-heading"><h3>${escapeHtml(t('tastingFlights.plural'))}</h3>
                <button type="button" class="btn small" data-act="tasting-flight-new">${newBottlingIcon}<span>${escapeHtml(t('tastingFlights.create'))}</span></button></div>
            ${flights.length ? `<div class="warehouse-bottle-list tasting-flight-list">${flights.map(item=>`<button class="tasting-flight-home-link" type="button" data-act="tasting-flight-open" data-flight-id="${escapeHtml(item.id)}">
                <span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(formatDate(item.date))} · ${escapeHtml(t(item.tastingIds.length===1?'tastingFlights.oneEntry':'tastingFlights.entriesCount',{count:item.tastingIds.length}))}</small></span>
                <span class="tasting-entry-chevron" aria-hidden="true">›</span></button>`).join('')}</div>` : `<p class="hint">${escapeHtml(t('tastingFlights.none'))}</p>`}
        </section>`;
    }
    function startFlight() {
        showModal(t('tastingFlights.create'),`<div class="tasting-flight-form">
            <label>${escapeHtml(t('tastingFlights.name'))}<input data-flight-name maxlength="160" required placeholder="${escapeHtml(t('tastingFlights.namePlaceholder'))}"></label>
            <label>${escapeHtml(t('tastingFlights.date'))}<input type="date" data-flight-date required value="${localToday()}"></label>
            <label>${escapeHtml(t('tastingFlights.notes'))}<textarea data-flight-notes maxlength="10000" rows="3"></textarea></label>
            <div class="actions"><button class="btn" type="button" data-act="close-modal">${escapeHtml(t('common.actions.cancel'))}</button>
            <button class="btn primary" type="button" data-act="tasting-flight-create-confirm">${escapeHtml(t('tastingFlights.create'))}</button></div>
        </div>`,false);
    }
    async function createFlight() {
        const box=document.querySelector('#modal-root');
        const name=box?.querySelector('[data-flight-name]');
        const date=box?.querySelector('[data-flight-date]');
        if (!name?.reportValidity() || !date?.reportValidity() || flightCreating) return;
        flightCreating=true;
        try {
            const flight=await request('/api/tasting-flights',{method:'POST',body:JSON.stringify({name:name.value,date:date.value,notes:box.querySelector('[data-flight-notes]')?.value || ''})});
            closeModal();
            state.page='tastings-home';
            await refresh('collection');
            navigate('tasting-flight',flight.id);
        } catch(error) {toast(error.message,true);}
        finally {flightCreating=false;}
    }
    const flightEntryLabel = item => `${item.bottling?.name || ''}${item.record.title ? ` · ${item.record.title}` : ''} · ${formatDate(item.record.tastedOn || '')}`;
    function flight() {
        flavorSession=null;
        if (lastFlightId !== state.selected) {flightEditing=false;flightAdding=false;lastFlightId=state.selected;}
        const current=(state.collection?.tastingFlights || []).find(item=>item.id===state.selected);
        if (!current) {navigate('tastings-home',null,{replace:true});return;}
        const refs=flightEntries(state.collection,current);
        const available=allTastingReferences(state.collection).filter(item=>!flightForTasting(state.collection,item.record.id))
            .sort((a,b)=>a.bottling.name.localeCompare(b.bottling.name));
        const entryRow=(item,i)=>`<div class="tasting-flight-member" data-tasting-id="${escapeHtml(item.record.id)}">
            <div class="tasting-flight-order-control"><button type="button" class="tasting-flight-drag-handle" data-flight-drag aria-label="${escapeHtml(t('tastingFlights.dragHandle'))}" title="${escapeHtml(t('tastingFlights.dragHandle'))}">
                <svg width="17" height="19" viewBox="0 0 16 20" fill="currentColor" aria-hidden="true"><circle cx="5" cy="3" r="1.5"/><circle cx="11" cy="3" r="1.5"/><circle cx="5" cy="10" r="1.5"/><circle cx="11" cy="10" r="1.5"/><circle cx="5" cy="17" r="1.5"/><circle cx="11" cy="17" r="1.5"/></svg>
            </button><span class="tasting-flight-position" aria-label="${escapeHtml(t('tastingFlights.position',{position:i+1,count:refs.length}))}">${i+1}</span></div>
            <button type="button" class="tasting-flight-member-open" data-act="tasting-flight-note-open" data-tasting-id="${escapeHtml(item.record.id)}" data-bottling-id="${escapeHtml(item.external?item.record.id:item.bottling.id)}" data-external="${item.external?'1':'0'}">
                <strong>${escapeHtml(item.bottling.name)}</strong><small>${escapeHtml(item.record.title || formatDate(item.record.tastedOn))}</small>
            </button>
            <span class="tasting-flight-member-score">${tastingListGlasses(item.record) || '<span class="tasting-list-glasses" aria-hidden="true"></span>'}<strong>${tastingRating(item.record)}</strong></span>
            <div class="tasting-flight-member-actions">
                <button type="button" class="btn small" data-act="tasting-flight-move" data-index="${i}" data-direction="-1" ${i===0?'disabled':''} aria-label="${escapeHtml(t('tastingFlights.moveUp'))}">↑</button>
                <button type="button" class="btn small" data-act="tasting-flight-move" data-index="${i}" data-direction="1" ${i===refs.length-1?'disabled':''} aria-label="${escapeHtml(t('tastingFlights.moveDown'))}">↓</button>
                <button type="button" class="btn small" data-act="tasting-flight-remove-note" data-tasting-id="${escapeHtml(item.record.id)}">${escapeHtml(t('tastingFlights.detach'))}</button>
            </div>
        </div>`;
        shell(`<div class="analytics-page tasting-child-page tasting-flight-page">
            ${backLink('tasting-flight-back','tastingFlights.back')}
            ${pageTitle(t('tastingFlights.detailTitle'),t('tastingFlights.detailIntro'))}
            <section class="analytics-panel tasting-flight-summary">
                ${flightEditing?`<div class="tasting-flight-form">
                    <label>${escapeHtml(t('tastingFlights.name'))}<input data-flight-name maxlength="160" required value="${escapeHtml(current.name)}"></label>
                    <label>${escapeHtml(t('tastingFlights.date'))}<input type="date" data-flight-date required value="${escapeHtml(current.date)}"></label>
                    <label>${escapeHtml(t('tastingFlights.notes'))}<textarea data-flight-notes maxlength="10000" rows="4">${escapeHtml(current.notes)}</textarea></label>
                    <div class="actions"><button class="btn" type="button" data-act="tasting-flight-cancel-edit">${escapeHtml(t('common.actions.cancel'))}</button>
                    <button class="btn primary" type="button" data-act="tasting-flight-save">${escapeHtml(t('common.actions.save'))}</button></div>
                </div>`:`<div class="tasting-panel-heading"><div><h3>${escapeHtml(current.name)}</h3><p class="muted">${escapeHtml(formatDate(current.date))}</p></div>
                    <div class="actions"><button type="button" class="btn small" data-act="tasting-flight-edit">${editIcon}<span>${escapeHtml(t('common.actions.edit'))}</span></button>
                        <button type="button" class="btn small danger" data-act="tasting-flight-delete">${escapeHtml(t('common.actions.delete'))}</button></div></div>
                    ${current.notes ? `<p class="tasting-flight-comment">${escapeHtml(current.notes)}</p>` : ''}`}
            </section>
            <section class="analytics-panel tasting-flight-members"><div class="tasting-panel-heading"><h3>${escapeHtml(t(refs.length===1?'tastingFlights.oneEntry':'tastingFlights.entriesCount',{count:refs.length}))}</h3>
                <button type="button" class="btn primary" data-act="tasting-flight-toggle-add">${newBottlingIcon}<span>${escapeHtml(t('tastingFlights.add'))}</span></button></div>
                ${flightAdding?`<div class="tasting-flight-add">
                    <div class="tasting-flight-add-existing"><label>${escapeHtml(t('tastingFlights.selectExisting'))}
                        <select data-flight-tasting-option ${available.length?'':'disabled'}>${available.map(item=>`<option value="${escapeHtml(item.record.id)}">${escapeHtml(flightEntryLabel(item))}</option>`).join('')}</select></label>
                        <button class="btn" type="button" data-act="tasting-flight-attach" ${available.length?'':'disabled'}>${escapeHtml(t('tastingFlights.addExisting'))}</button></div>
                    <div class="tasting-flight-add-new"><label>${escapeHtml(t('tastings.chooseBottling'))}
                        <select data-flight-owned-bottling>${(state.collection?.bottlings || []).map(b=>`<option value="${escapeHtml(b.id)}">${escapeHtml(b.name)}</option>`).join('')}</select></label>
                        <button class="btn" type="button" data-act="tasting-flight-new-owned" ${(state.collection?.bottlings || []).length?'':'disabled'}>${escapeHtml(t('tastings.fromCollection'))}</button>
                        <button class="btn" type="button" data-act="tasting-flight-new-external">${escapeHtml(t('tastings.outsideCollection'))}</button></div>
                </div>`:''}
                ${refs.length ? `<div class="warehouse-bottle-list tasting-flight-members-list">${refs.map(entryRow).join('')}</div>` : `<p class="hint">${escapeHtml(t('tastingFlights.noEntries'))}</p>`}
            </section></div>`);
    }
    function toggleFlightEdit(editing) {flightEditing=editing;flight();}
    function toggleFlightAdd() {flightAdding=!flightAdding;flight();}
    async function saveFlight() {
        const name=document.querySelector('.tasting-flight-page [data-flight-name]');
        const date=document.querySelector('.tasting-flight-page [data-flight-date]');
        if (!name?.reportValidity() || !date?.reportValidity()) return;
        const notes=document.querySelector('.tasting-flight-page [data-flight-notes]')?.value || '';
        try {
            await request(`/api/tasting-flights/${encodeURIComponent(state.selected)}`,{method:'PATCH',body:JSON.stringify({name:name.value,date:date.value,notes})});
            flightEditing=false;
            await refresh('collection');
        } catch(error) {toast(error.message,true);}
    }
    async function updateFlightMembers(ids) {
        try {
            await request(`/api/tasting-flights/${encodeURIComponent(state.selected)}/tastings`,{method:'PUT',body:JSON.stringify({tastingIds:ids})});
            await refresh('collection');
        } catch(error) {toast(error.message,true);}
    }
    function reorderFlightMember(sourceId,targetId,after) {
        const record=(state.collection?.tastingFlights || []).find(x=>x.id===state.selected);
        const reordered=record && reorderFlightIds(record.tastingIds,sourceId,targetId,after);
        if (reordered) return updateFlightMembers(reordered);
    }
    function moveFlightMember(index,step) {
        const record=(state.collection?.tastingFlights || []).find(x=>x.id===state.selected);
        if (!record) return;
        const ids=[...record.tastingIds],to=index+step;
        if (!Number.isInteger(index) || to<0 || to>=ids.length) return;
        [ids[index],ids[to]]=[ids[to],ids[index]];
        return updateFlightMembers(ids);
    }
    function attachFlightMember() {
        const id=document.querySelector('[data-flight-tasting-option]')?.value;
        const current=(state.collection?.tastingFlights || []).find(x=>x.id===state.selected);
        if (id && current) return updateFlightMembers([...current.tastingIds,id]);
    }
    function detachFlightMember(id) {
        const current=(state.collection?.tastingFlights || []).find(x=>x.id===state.selected);
        if (current?.tastingIds.includes(id)) return updateFlightMembers(current.tastingIds.filter(x=>x!==id));
    }
    async function deleteFlight() {
        try {
            await request(`/api/tasting-flights/${encodeURIComponent(state.selected)}`,{method:'DELETE'});
            closeModal();
            state.page='tastings-home';
            await refresh('collection');
            navigate('tastings-home',null,{replace:true});
            return true;
        } catch(error) {toast(error.message,true);return false;}
    }
    function home() {
        // Returning to an index ends any prior edit session. Reopening is always read-only.
        flavorSession = null;
        const owned=state.collection?.bottlings || [];
        const entries=[
            ...owned.flatMap(b=>sortedTastings(b).map(record=>({record,b,external:false}))),
            ...standalone().map(record=>({record,b:record.bottling,external:true}))
        ].sort((a,b)=>(b.record.tastedOn || '').localeCompare(a.record.tastedOn || '') ||
            (b.record.createdAt || '').localeCompare(a.record.createdAt || '') || b.record.id.localeCompare(a.record.id));
        shell(`<div class="analytics-page tasting-home-page">
            <header class="section-head analytics-page-heading"><div class="page-heading-copy">
            <span class="eyebrow dark">${escapeHtml(t('tastings.homeEyebrow'))}</span>
            <h2>${escapeHtml(t('tastings.homeTitle'))}<span class="heading-period">.</span></h2>
            <p class="intro">${escapeHtml(t('tastings.homeIntro'))}</p></div></header>
            ${homeFlights()}
            <section class="analytics-panel tasting-home-recent">
                <div class="tasting-panel-heading"><h3>${escapeHtml(t('tastings.entries'))}</h3>
                    <button type="button" class="btn primary" data-act="tastings-start-choice">${newBottlingIcon}<span>${escapeHtml(t('tastings.add'))}</span></button>
                </div>
                ${createChoiceOpen?`<div class="tasting-create-chooser"><div class="tasting-choose-owned">
                    <label>${escapeHtml(t('tastings.chooseBottling'))}<select data-owned-tasting-bottling>
                    ${owned.map(b=>`<option value="${escapeHtml(b.id)}">${escapeHtml(b.name)}</option>`).join('')}</select></label>
                    <button type="button" class="btn" data-act="tastings-start-owned" ${owned.length?'':'disabled'}>${escapeHtml(t('tastings.fromCollection'))}</button>
                </div><button type="button" class="btn" data-act="tastings-start-external">${escapeHtml(t('tastings.outsideCollection'))}</button></div>`:''}
                ${entries.length ? `<div class="warehouse-bottle-list tasting-entry-list">${entries.map(item=>tastingRow({...item,home:true})).join('')}</div>` : `<p class="hint">${escapeHtml(t('tastings.emptyHome'))}</p>`}
            </section>
        </div>`);
    }
    function toggleCreateChoice() { createChoiceOpen=!createChoiceOpen; home(); }
    function list() {
        flavorSession = null;
        const bottling=subject();
        if (!bottling) { navigate('tastings-home',null,{replace:true}); return; }
        const tastings=sortedTastings(bottling);
        shell(`<div class="analytics-page tasting-child-page">
        ${backLink('tastings-back-detail','tastings.backDetail')}
        ${pageTitle(t('tastings.overviewTitle'),t('tastings.overviewIntro'))}
        ${bottlingInfo(bottling)}
        <section class="analytics-panel tasting-list-section">
            <div class="tasting-panel-heading"><h3>${escapeHtml(t('tastings.entriesCount',{count:tastings.length}))}</h3>
                <button type="button" class="btn primary" data-act="tastings-new">${newBottlingIcon}<span>${escapeHtml(t('tastings.add'))}</span></button></div>
            ${tastings.length ? `<div class="warehouse-bottle-list tasting-entry-list">${tastings.map(record=>tastingRow({record,b:bottling})).join('')}</div>` : `<p class="hint">${escapeHtml(t('tastings.none'))}</p>`}
        </section></div>`);
    }
    function editor() {
        // Returning from a tasting should show the compact flight list, not the expanded add form.
        if (state.flightId) flightAdding=false;
        const external=isExternal();
        const record=external ? standalone().find(x=>x.id===state.selected) : null;
        const bottling=external ? (record?.bottling || emptyBottling()) : subject();
        const draft=external ? state.selected==='new' : state.tastingId==='new';
        const existing=external ? record : (draft ? null : (bottling?.tastings || []).find(x=>x.id===state.tastingId));
        if (!external && !bottling) { navigate('tastings-home',null,{replace:true}); return; }
        if (!draft && !existing) { navigate(external?'tastings-home':'tastings',external?null:bottling.id,{replace:true}); return; }
        const value=existing || emptyRecord();
        const flightBack=state.flightId && (state.collection?.tastingFlights || []).some(f=>f.id===state.flightId && (draft || f.tastingIds.includes(existing?.id)));
        const backAction=flightBack ? 'tasting-back-flight' : (external?'tastings-back-home':'tastings-back-list');
        const backLabel=flightBack ? 'tastingFlights.backToFlight' : (external?'tastings.backHome':'tastings.backList');
        const id=existing?.id || 'new';
        if (!flavorSession || flavorSession.id !== id || flavorSession.bottlingId !== (bottling.id || id) || flavorSession.external !== external) {
            flavorSession={id,bottlingId:bottling.id || id,draft,external,editing:draft,history:createTastingHistory(value)};
            flavorSaveQueue=Promise.resolve();
        }
        if (!draft && !flavorSession.editing) {
            shell(`<div class="analytics-page tasting-child-page">
                ${backLink(backAction,backLabel)}
                ${pageTitle(t('tastings.editorViewTitle'),t('tastings.editorViewIntro'))}
                <section class="section tasting-editor-content tasting-readonly-content" data-flavor-detail data-tasting-readonly="true">
                    ${bottlingInfo(bottling,external,false)}
                    ${flightHint(existing)}
                    <div class="section-head"><h3>${escapeHtml(t('tastings.editorSection'))}</h3></div>
                    ${tastingReadOnly(value)}
                </section>
            </div>`);
            return;
        }
        shell(`<div class="analytics-page tasting-child-page">
        ${backLink(backAction,backLabel)}
        ${pageTitle(draft?t('tastings.editorCreateTitle'):t('tastings.editorEditTitle'),
            draft?t('tastings.editorCreateIntro'):t('tastings.editorEditIntro'))}
    <section class="section tasting-editor-content" data-flavor-detail data-bottling-id="${escapeHtml(bottling?.id || record?.id || 'new')}" aria-label="${escapeHtml(t('flavor.title'))}">
        ${bottlingInfo(bottling,external,draft)}
        ${existing ? flightHint(existing) : (flightBack ? `<div class="tasting-flight-context">${escapeHtml(t('tastingFlights.newInFlight'))}</div>` : '')}
        <div class="section-head tasting-editor-section-head"><h3>${escapeHtml(t('tastings.editorSection'))}</h3></div>
        <div class="flavor-detail-panel tasting-panel">
            <div class="tasting-record-fields analytics-panel tasting-edit-meta-panel">
                <label>${escapeHtml(t('tastings.date'))}<input type="date" data-tasting-date required value="${escapeHtml(value.tastedOn)}"></label>
                <label>${escapeHtml(t('tastings.nameOptional'))}<input type="text" maxlength="120" data-tasting-title value="${escapeHtml(value.title || '')}" placeholder="${escapeHtml(t('tastings.titlePlaceholder'))}"></label>
            <div class="actions tasting-editor-actions"><div class="actions flavor-history-actions">
                <button type="button" class="btn small tasting-action-btn" data-act="flavor-detail-undo" title="${escapeHtml(t('flavor.undo'))}" aria-label="${escapeHtml(t('flavor.undo'))}" ${flavorSession.history.canUndo ? '' : 'disabled'}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-2"/></svg></button>
                <button type="button" class="btn small tasting-action-btn" data-act="flavor-detail-redo" title="${escapeHtml(t('flavor.redo'))}" aria-label="${escapeHtml(t('flavor.redo'))}" ${flavorSession.history.canRedo ? '' : 'disabled'}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h2"/></svg></button>
            </div>
                ${draft?'':`<button type="button" class="btn small" data-act="tasting-edit-done">${escapeHtml(t('tastings.done'))}</button><button type="button" class="btn small danger" data-act="tasting-delete" data-tasting-id="${escapeHtml(value.id)}">${escapeHtml(t('common.actions.delete'))}</button>`}
            </div>
            </div>
            <div class="tasting-top-row">
                <section class="analytics-panel tasting-color-panel">
                    <div class="tasting-panel-heading"><h3>${escapeHtml(t('tasting.colorHeading'))}</h3>
                        <button type="button" class="btn small" data-act="tasting-color-clear" ${flavorSession.history.value.whiskyColor ? '' : 'disabled'}>${escapeHtml(t('tasting.colorClear'))}</button>
                    </div>
                    ${whiskyColorSelector(flavorSession.history.value.whiskyColor)}
                </section>
                <section class="analytics-panel tasting-senses-section"><div class="tasting-panel-heading"><h3>${escapeHtml(t('flavor.title'))}</h3>
                    <button type="button" class="btn small" data-act="tasting-flavor-clear" ${flavorSession.history.value.flavorProfile?'':'disabled'}>${escapeHtml(t('tastings.clearRadar'))}</button></div>
                    <p class="hint" data-flavor-missing ${flavorSession.history.value.flavorProfile ? 'hidden' : ''}>${escapeHtml(t('flavor.notRecorded'))}</p>
                    ${flavorChart(flavorSession.history.value.flavorProfile, {editable:true})}
                </section>
            </div>
            <section class="analytics-panel"><h3>${escapeHtml(t('tasting.notes'))}</h3>
                <div class="tasting-notes">${['nose','palate','finish'].map(key => `<label>${escapeHtml(t(`forms.bottling.${key}`))}<textarea data-tasting-note="${key}">${escapeHtml(flavorSession.history.value.tastingNotes[key])}</textarea></label>`).join('')}</div>
            </section>
            <section class="analytics-panel tasting-rating-panel">
                <div class="tasting-panel-heading"><h3>${escapeHtml(t('tasting.overallRating'))}</h3>
                    <button type="button" class="btn small" data-act="tasting-rating-clear" ${flavorSession.history.value.rating == null ? 'disabled' : ''}>${escapeHtml(t('tasting.clearRating'))}</button>
                </div>
                ${glencairnRating(flavorSession.history.value.rating)}
            </section>
        </div>
        ${draft ? `<div class="actions tasting-create-actions"><button type="button" class="btn primary" data-act="tasting-create">${escapeHtml(t('tastings.save'))}</button></div>` : ''}
    </section>

</div>`);
    }
    function localToday() {
        const d=new Date();
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }
    async function saveDraft() {
        const session=flavorSession;
        if (!session?.draft) return;
        if (!commitTasting()) return;
        const node=flavorNode();
        const tastedOn=node?.querySelector('[data-tasting-date]')?.value;
        const title=node?.querySelector('[data-tasting-title]')?.value || '';
        if (!node?.querySelector('[data-tasting-date]')?.checkValidity()) {
            node?.querySelector('[data-tasting-date]')?.reportValidity();return;
        }
        try {
            const externalBottling=session.external?readExternalFields(node):null;
            if (session.external && !externalBottling) return;
            const flightId=state.flightId;
            const data={...session.history.value,tastedOn,title,...(session.external?{bottling:externalBottling}:flightId?{bottlingId:session.bottlingId}:{})};
            const response=await request(flightId ? `/api/tasting-flights/${encodeURIComponent(flightId)}/tastings` :
                (session.external?'/api/external-tastings':`/api/bottlings/${encodeURIComponent(session.bottlingId)}/tastings`),{
                method:'POST',body:JSON.stringify(data)
            });
            const created=flightId ? response.record : response;
            await refresh('collection');
            navigate(editPage(session.external),session.external?created.id:session.bottlingId,{tastingId:session.external?null:created.id,flightId,replace:true});
        } catch(error) { toast(error.message,true); }
    }
    async function persistMeta() {
        const session=flavorSession;
        if (!session?.editing || session.draft) return;
        const node=flavorNode();
        const date=node?.querySelector('[data-tasting-date]');
        if (!date?.checkValidity()) { date?.reportValidity();return; }
        const patch={tastedOn:date.value,title:node.querySelector('[data-tasting-title]').value};
        flavorSaveQueue=flavorSaveQueue.then(async()=>{
            const updated=await request(session.external?`/api/external-tastings/${encodeURIComponent(session.id)}`:`/api/bottlings/${encodeURIComponent(session.bottlingId)}/tastings/${encodeURIComponent(session.id)}`,{method:'PATCH',body:JSON.stringify(patch)});
            if (session.external) {
                const item=state.collection?.externalTastings?.find(t=>t.id===session.id);
                if (item) Object.assign(item,updated);
            } else {
                const b=state.collection?.bottlings?.find(b=>b.id===session.bottlingId);
                const item=b?.tastings?.find(t=>t.id===session.id);
                if (item) Object.assign(item,updated);
            }
        }).catch(error=>toast(error.message,true));
        await flavorSaveQueue;
    }
    function startEditing() {
        if (!flavorSession || flavorSession.draft) return;
        flavorSession.editing = true;
        editor();
        flavorNode()?.querySelector('[data-tasting-date]')?.focus?.();
    }
    async function finishEditing() {
        if (!flavorSession?.editing || flavorSession.draft) return;
        if (!commitTasting()) return;
        const session = flavorSession;
        await flavorSaveQueue;
        if (session !== flavorSession) return;
        session.editing = false;
        editor();
        flavorNode()?.querySelector('[data-act="tasting-edit-start"]')?.focus?.();
    }
    function showExternalEdit(editing) {
        if (!flavorSession?.external || flavorSession.draft) return;
        const panel = flavorNode()?.querySelector('.tasting-bottling-info');
        const read = panel?.querySelector('[data-external-read]');
        const form = panel?.querySelector('[data-external-edit]');
        if (!read || !form) return;
        read.hidden = editing;
        form.hidden = !editing;
        if (editing) form.querySelector('[data-external-field="name"]')?.focus?.();
    }
    function cancelExternalEdit() {
        const record = standalone().find(item => item.id === flavorSession?.id);
        const panel = flavorNode()?.querySelector('.tasting-bottling-info');
        if (record && panel) {
            for (const key of ['name','distillery','bottler','ageYears','abv','releaseYear']) {
                const input = panel.querySelector(`[data-external-field="${key}"]`);
                if (input) input.value = String(record.bottling?.[key] ?? '');
            }
        }
        showExternalEdit(false);
    }
    async function persistExternalDetails() {
        const session = flavorSession;
        if (!session?.external || session.draft) return;
        const node = flavorNode();
        const fields = readExternalFields(node);
        if (!fields) return;
        const panel = node?.querySelector('.tasting-bottling-info');
        try {
            await flavorSaveQueue;
            const updated = await request(`/api/external-tastings/${encodeURIComponent(session.id)}`, {method:'PATCH',body:JSON.stringify({bottling:fields})});
            const item = state.collection?.externalTastings?.find(t=>t.id===session.id);
            if (item) Object.assign(item,updated);
            if (panel?.isConnected) panel.outerHTML = bottlingInfo(updated.bottling,true,false);
        } catch(error) { toast(error.message,true); }
    }
    function showAssignDialog() {
        const session=flavorSession;
        if (!session?.external || session.draft) return;
        const owned=[...(state.collection?.bottlings || [])].sort((a,b)=>a.name.localeCompare(b.name));
        if (!owned.length) {
            toast(t('tastings.assignNoBottlings'),true);
            return;
        }
        const options=owned.map(b=>`<option value="${escapeHtml(b.id)}">${escapeHtml(b.name)}</option>`).join('');
        showModal(t('tastings.assignToCollection'),`<p>${escapeHtml(t('tastings.assignExplanation'))}</p>
            <label class="tasting-assign-field">${escapeHtml(t('tastings.chooseBottling'))}
                <select data-tasting-assign-target required>${options}</select>
            </label><div class="actions tasting-assign-actions">
                <button type="button" class="btn" data-act="close-modal">${escapeHtml(t('common.actions.cancel'))}</button>
                <button type="button" class="btn primary" data-act="tasting-external-assign-confirm">${escapeHtml(t('tastings.assignToCollection'))}</button>
            </div>`,false);
    }
    async function assignExternalToBottling() {
        const session=flavorSession;
        if (!session?.external || session.draft) return;
        const select=document.querySelector('[data-tasting-assign-target]');
        if (!select?.checkValidity()) {select?.reportValidity();return;}
        const bottlingId=select.value;
        if (!(state.collection?.bottlings || []).some(b=>b.id===bottlingId)) return;
        // A pending notes/rating autosave must finish before the record moves.
        if (!commitTasting()) return;
        await flavorSaveQueue;
        const confirmButton=document.querySelector('[data-act="tasting-external-assign-confirm"]');
        if (confirmButton) confirmButton.disabled=true;
        try {
            const result=await request(`/api/external-tastings/${encodeURIComponent(session.id)}/assign`,{
                method:'POST',body:JSON.stringify({bottlingId})
            });
            closeModal();
            // Refresh while on the overview, so the removed external URL cannot redirect.
            state.page='tastings-home';
            await refresh('collection');
            navigate('tasting',result.bottlingId,{tastingId:result.tastingId,replace:true});
        } catch(error) {
            toast(error.message,true);
            if (confirmButton?.isConnected) confirmButton.disabled=false;
        }
    }
    return {home,list,editor,flight,startFlight,createFlight,saveFlight,deleteFlight,moveFlightMember,reorderFlightMember,attachFlightMember,detachFlightMember,toggleFlightEdit,toggleFlightAdd,saveDraft,persistMeta,toggleCreateChoice,commitFlavor:commitTasting,chooseRating,previewRating,chooseColor,clearFlavor,
        showAssignDialog,assignExternalToBottling,startEditing,finishEditing,
        startExternalEdit:()=>showExternalEdit(true),cancelExternalEdit,persistExternalDetails,
        undoFlavor:()=>stepFlavor(-1),redoFlavor:()=>stepFlavor(1)};
}
