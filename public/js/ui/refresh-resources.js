/** Refresh only resources known to be affected by a mutation.
 * Unknown/mixed mutations deliberately use both endpoints. The cache module
 * retains revalidation semantics for every resource actually requested. */
export async function loadResources(state, getJson, scope = 'all') {
    if (!['all', 'collection', 'warehouse'].includes(scope)) throw new Error(`Unknown refresh scope: ${scope}`);
    const collection = scope !== 'warehouse' || !state.collection
        ? getJson('/api/collection') : Promise.resolve(state.collection);
    const warehouse = scope !== 'collection' || !state.warehouse
        ? getJson('/api/warehouse') : Promise.resolve(state.warehouse);
    const [nextCollection, nextWarehouse] = await Promise.all([collection, warehouse]);
    state.collection = nextCollection;
    state.warehouse = nextWarehouse;
    return state;
}
