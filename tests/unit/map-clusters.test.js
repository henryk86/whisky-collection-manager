import test from 'node:test';
import assert from 'node:assert/strict';
import { clusterMapSites } from '../../public/js/domain/map-clusters.js';

const distillery = (id, lat, lon, bottleCount = 0, bottlingCount = 0) => ({
    id, name: id, location: { lat, lon }, bottleCount, bottlingCount,
});

test('low zoom combines neighbouring distilleries and counts sites, bottlings and physical bottles separately', () => {
    const sites = [
        distillery('ardbeg', 55.6406, -6.1086, 4, 2),
        distillery('lagavulin', 55.636, -6.127, 2, 1),
        distillery('kilchoman', 55.7869, -6.4308, 1, 1),
    ];
    const groups = clusterMapSites(sites, 5);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].sites.length, 3);
    assert.equal(groups[0].bottleCount, 7);
    assert.equal(groups[0].bottlingCount, 4);
    assert.deepEqual(sites.map(site => site.bottleCount), [4, 2, 1], 'original data stays intact');
});

test('zooming in automatically separates places that are geographically distinct', () => {
    const sites = [
        distillery('ardbeg', 55.6406, -6.1086),
        distillery('lagavulin', 55.636, -6.127),
        distillery('kilchoman', 55.7869, -6.4308),
    ];
    assert.equal(clusterMapSites(sites, 7).length, 1);
    assert.equal(clusterMapSites(sites, 11).length, 2, 'Ardbeg and Lagavulin still close enough to group');
    assert.equal(clusterMapSites(sites, 15).length, 3);
});

test('panning and viewport changes cannot affect grouping; focus can expose a site inside a cluster', () => {
    const sites = [distillery('one', 55.6406, -6.1086), distillery('two', 55.6406, -6.1086)];
    const expanded = clusterMapSites(sites, 16);
    assert.equal(expanded.length, 2, 'maximum zoom always displays distinct distilleries separately');
    assert.ok(expanded.every(group => group.sites.length === 1));
    assert.ok(expanded.every(group => group.anchorX !== undefined), 'overlapping coordinates have original position anchors');
    assert.notDeepEqual([expanded[0].x, expanded[0].y], [expanded[1].x, expanded[1].y], 'overlapping markers are offset');
    const pinned = clusterMapSites(sites, 3, { pinnedId: 'two' });
    assert.equal(pinned.length, 2);
    assert.equal(pinned.find(group => group.sites[0].id === 'two').pinned, true);
    assert.equal(clusterMapSites(sites, 3).length, 1, 'next zoom or pan can restore clustering');
});

test('an unlocated distillery cannot create a marker cluster', () => {
    const groups = clusterMapSites([distillery('one', 55.6406, -6.1086), { id: 'missing', location: null }], 2);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].sites.length, 1);
});

test('a group with no physical bottles remains zero even when it includes many distilleries', () => {
    const sites = [
        distillery('one', 55.64, -6.10, 0, 0),
        distillery('two', 55.64, -6.11, 0, 3),
        distillery('three', 55.64, -6.12, 5, 2),
    ];
    const groups = clusterMapSites(sites, 4);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].sites.length, 3);
    assert.equal(groups[0].bottleCount, 5, 'cluster sums physical bottles, not distilleries or bottlings');
    assert.equal(groups[0].bottlingCount, 5);
    const emptyGroups = clusterMapSites(sites.slice(0, 2), 4);
    assert.equal(emptyGroups[0].bottleCount, 0);
});

test('a single distillery with many physical bottles never becomes a cluster', () => {
    const site = distillery('only', 55.6406, -6.1086, 19, 4);
    for (const zoom of [2, 9, 15, 16]) {
        const groups = clusterMapSites([site], zoom);
        assert.equal(groups.length, 1);
        assert.equal(groups[0].sites.length, 1);
        assert.equal(groups[0].bottleCount, 19);
    }
});

test('different nearby distilleries resolve even with overlapping markers at maximum zoom', () => {
    const sites = [
        distillery('a', 55.640600, -6.108600, 3, 2),
        distillery('b', 55.640605, -6.108605, 7, 4),
    ];
    assert.equal(clusterMapSites(sites, 15).length, 1);
    const groups = clusterMapSites(sites, 16);
    assert.equal(groups.length, 2);
    assert.deepEqual(groups.map(group => group.bottleCount), [3, 7]);
    assert.ok(groups.every(group => group.sites.length === 1));
    assert.notDeepEqual([groups[0].x, groups[0].y], [groups[1].x, groups[1].y]);
});

test('world overview can aggregate the only stocked site, but focusing it exposes a single marker', () => {
    const sites = [
        distillery('kilchoman', 55.7869, -6.4308, 1, 1),
        distillery('nearby-empty', 55.7869, -6.4308, 0, 0),
    ];
    const overview = clusterMapSites(sites, 2);
    assert.equal(overview.length, 1);
    assert.equal(overview[0].sites.length, 2, 'no separate stocked marker is guaranteed at overview zoom');
    assert.equal(overview[0].bottleCount, 1, 'cluster still includes the stocked bottle');
    const focused = clusterMapSites(sites, 10, { pinnedId: 'kilchoman' });
    assert.equal(focused.length, 2);
    assert.equal(focused.find(group => group.sites[0].id === 'kilchoman').sites.length, 1);
    assert.equal(focused.find(group => group.sites[0].id === 'kilchoman').bottleCount, 1);
});
