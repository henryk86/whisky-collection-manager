import { hasBottlingDetail } from './bottling-details.js';

/** Compact, labelled facts for distinguishing similarly named bottlings on the map. */
export function mapBottlingFacts(bottling) {
    const facts = [];
    if (hasBottlingDetail(bottling.ageYears)) {
        const age = Number(bottling.ageYears);
        facts.push(`${bottling.ageYears} ${age === 1 ? 'Jahr' : 'Jahre'}`);
    }
    if (hasBottlingDetail(bottling.abv)) {
        const abv = String(bottling.abv).replace('.', ',');
        facts.push(`${abv} % Vol.`);
    }
    if (hasBottlingDetail(bottling.distillationYear)) {
        facts.push(`Dest. ${bottling.distillationYear}`);
    }
    if (hasBottlingDetail(bottling.bottlingYear)) {
        facts.push(`Abgef. ${bottling.bottlingYear}`);
    } else if (hasBottlingDetail(bottling.releaseYear)) {
        facts.push(`Ersch. ${bottling.releaseYear}`);
    }
    return facts.join(' · ');
}
