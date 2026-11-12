/**
 * Mutually exclusive inventory labels for the collection overview.
 * Closed is the implicit/default state: 'Standardflasche' or 'Sample'.
 * Open bottles are called out explicitly; empty bottles are not displayed.
 * Each physical bottle contributes to exactly one group.
 */
export function inventoryCountGroups(bottles) {
    const categories = [
        { type: 'standard', status: 'closed', singular: 'Standardflasche', plural: 'Standardflaschen' },
        { type: 'standard', status: 'open', singular: 'offene Standardflasche', plural: 'offene Standardflaschen' },
        { type: 'sample', status: 'closed', singular: 'Sample', plural: 'Samples' },
        { type: 'sample', status: 'open', singular: 'offenes Sample', plural: 'offene Samples' },
    ];
    return categories.flatMap(group => {
        const count = bottles.filter(bottle =>
            (bottle.volumeType === 'sample' ? 'sample' : 'standard') === group.type &&
            (bottle.status || 'closed') === group.status
        ).length;
        return count ? [{ type: group.type, status: group.status, count,
            label: `${count} ${count === 1 ? group.singular : group.plural}` }] : [];
    });
}
