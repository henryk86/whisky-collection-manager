import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildDistilleryMap, locationFor, markerDiameter, fitMapToSites, project, unproject, zoomAroundPoint } from '../../public/js/domain/distillery-map.js';

function fixture() {
    return {
        distilleries: [
            { id: 'kilchoman', name: 'Kilchoman' },
            { id: 'ardbeg', name: 'Ardbeg' },
            { id: 'unknown', name: 'Experimental Island Distillery' },
        ],
        bottlings: [],
    };
}
test('map groups 120 bottlings of one distillery in a single marker, with 142 physical bottles', () => {
    const collection = fixture();
    for (let i = 0; i < 120; i++) {
        collection.bottlings.push({ id: `b-${i}`, name: `Release ${i}`, distilleryIds: ['kilchoman'], bottles: Array(i < 22 ? 2 : 1).fill(0).map((_, n) => ({ id: `physical-${i}-${n}` })) });
    }
    const result = buildDistilleryMap(collection);
    assert.equal(result.located.length, 1);
    assert.equal(result.located[0].name, 'Kilchoman');
    assert.equal(result.located[0].bottlingCount, 120);
    assert.equal(result.located[0].bottleCount, 142);
    assert.equal(result.located[0].bottlings.length, 120);
    assert.equal(markerDiameter(142), 62);
});
test('optional map layer includes all distilleries, including sites with no bottlings or bottles', () => {
    const collection = fixture();
    collection.bottlings.push({ id: 'bottle-site', name: 'Kilchoman Release', distilleryIds: ['kilchoman'], bottles: [{ id: 'physical' }] });
    const defaultSites = buildDistilleryMap(collection);
    assert.equal(defaultSites.located.length, 1, 'normal map still only shows stocked distilleries');
    assert.equal(defaultSites.missing.length, 0);
    const allSites = buildDistilleryMap(collection, { includeAllDistilleries: true });
    assert.equal(allSites.located.length, 2);
    assert.equal(allSites.missing.length, 1, 'unlocated distillery without stock still needs positioning');
    assert.equal(allSites.located.find(site => site.id === 'ardbeg').bottleCount, 0);
    assert.equal(allSites.located.find(site => site.id === 'ardbeg').bottlingCount, 0);
    assert.deepEqual(allSites.located.find(site => site.id === 'ardbeg').bottlings, []);
    assert.equal(allSites.located.find(site => site.id === 'kilchoman').bottleCount, 1);
    assert.equal(allSites.located.find(site => site.id === 'kilchoman').bottlingCount, 1);
    assert.equal(allSites.missing[0].id, 'unknown');
    assert.equal(allSites.missing[0].bottleCount, 0);
    assert.equal(buildDistilleryMap(collection).located.length, 1, 'turning layer off does not modify collection data');
});

test('all-distilleries layer includes every location in the built-in catalog', () => {
    const distilleries = JSON.parse(fs.readFileSync(new URL('../../seed/distillery.json', import.meta.url), 'utf8'));
    const allSites = buildDistilleryMap({ distilleries, bottlings: [] }, { includeAllDistilleries: true });
    assert.equal(allSites.located.length, distilleries.length);
    assert.equal(allSites.missing.length, 0);
    assert.ok(allSites.located.every(site => site.bottleCount === 0 && site.bottlingCount === 0));
    assert.equal(buildDistilleryMap({ distilleries, bottlings: [] }).located.length, 0);
});

test('markers scale by physical bottles with a visual cap, not by bottling count', () => {
    assert.ok(markerDiameter(1) < markerDiameter(10));
    assert.ok(markerDiameter(10) < markerDiameter(100));
    assert.ok(markerDiameter(100) <= 62);
    assert.equal(markerDiameter(10000), 62);
});
test('location fallback and manual coordinate precedence with unlocated list', () => {
    const collection = fixture();
    collection.bottlings.push({ id: 'x', name: 'Peated Mix', distilleryIds: ['kilchoman', 'ardbeg', 'unknown'], bottles: [{ id: 'b1' }, { id: 'b2' }] });
    const map = buildDistilleryMap(collection);
    assert.equal(map.located.length, 2);
    assert.equal(map.missing.length, 1);
    assert.equal(map.missing[0].name, 'Experimental Island Distillery');
    assert.equal(map.located[0].bottleCount, 2);
    assert.equal(map.located[1].bottleCount, 2);
    assert.equal(map.located[0].bottlingCount, 1);
    collection.distilleries[0].latitude = 40;
    collection.distilleries[0].longitude = -7;
    const changed = buildDistilleryMap(collection).located.find(site => site.id === 'kilchoman');
    assert.deepEqual(changed.location, { lat: 40, lon: -7, source: 'saved' });
});
test('map fits just Islay locations tightly, worldwide points expand the bounds', () => {
    const collection = fixture();
    collection.bottlings.push({ id: 'a', name: 'Ardbeg', distilleryIds: ['ardbeg'], bottles: [{ id: 'x' }] });
    collection.bottlings.push({ id: 'b', name: 'Kilchoman', distilleryIds: ['kilchoman'], bottles: [{ id: 'y' }] });
    let map = buildDistilleryMap(collection);
    const islay = fitMapToSites(map.located, 900, 600);
    assert.ok(islay.zoom >= 8, `Not Islay-focused: zoom=${islay.zoom}`);
    assert.ok(islay.lat > 55.5 && islay.lat < 56);
    assert.ok(islay.lon < -6 && islay.lon > -7);
    collection.distilleries[2].latitude = 40;
    collection.distilleries[2].longitude = -100;
    collection.bottlings.push({ id: 'c', name: 'Far away', distilleryIds: ['unknown'], bottles: [] });
    map = buildDistilleryMap(collection);
    assert.ok(fitMapToSites(map.located, 900, 600).zoom < islay.zoom);
    assert.equal(fitMapToSites([map.located[0]], 900, 600).zoom, 11);
});
test('Web Mercator is reversible and respects the dateline, without external map dependencies', () => {
    for (const [lat, lon] of [[55.7869, -6.4308], [0, 0], [-40, 169]]) {
        const point = project(lat, lon, 11);
        const back = unproject(point.x, point.y, 11);
        assert.ok(Math.abs(lat - back.lat) < 0.0000001);
        assert.ok(Math.abs(lon - back.lon) < 0.0000001);
    }
});

test('all 450 built-in distilleries have reference coordinates; manual values always win', () => {
    const catalog = JSON.parse(fs.readFileSync(new URL('../../seed/distillery.json', import.meta.url), 'utf8'));
    assert.equal(catalog.length, 450);
    for (const distillery of catalog) {
        const location = locationFor(distillery);
        assert.ok(location, `Missing coordinates for ${distillery.name}`);
        assert.ok(location.lat >= -90 && location.lat <= 90, `Invalid latitude for ${distillery.name}: ${location.lat}`);
        assert.ok(location.lon >= -180 && location.lon <= 180, `Invalid longitude for ${distillery.name}: ${location.lon}`);
        assert.ok(['saved', 'catalog'].includes(location.source));
    }
    const original = locationFor({ name: 'Aberfeldy' });
    assert.equal(original.source, 'catalog');
    assert.equal(original.approximate, true);
    assert.deepEqual(locationFor({ name: 'Aberfeldy', latitude: 55.9, longitude: -4.4 }),
        { lat: 55.9, lon: -4.4, source: 'saved' });
    assert.equal(locationFor({ name: 'Unlisted Private Distillery' }), null);
});

test('historic distilleries with shared former names use consistent locality positions', () => {
    const gleniffer = locationFor({ name: 'Gleniffer' });
    const glenpatrick = locationFor({ name: 'Glenpatrick' });
    assert.deepEqual([gleniffer.lat, gleniffer.lon], [glenpatrick.lat, glenpatrick.lon]);
    assert.deepEqual(locationFor({ name: 'Kilchoman' }), { lat: 55.7869, lon: -6.4308, source: 'catalog' });
    assert.equal(locationFor({ name: 'Strathmeldrum' }).approximate, true,
        'Approximate historical town position must be identified as such');
});


test('wheel anchor: zoom keeps the map coordinate below the pointer fixed', () => {
    const samples = [
        { center: { lat: 55.78, lon: -6.27 }, from: 8, to: 9, width: 830, height: 530, x: 75, y: 405 },
        { center: { lat: 50.9, lon: 11.6 }, from: 11, to: 9, width: 310, height: 380, x: 280, y: 44 },
        { center: { lat: -41.3, lon: 174.8 }, from: 6, to: 7, width: 980, height: 660, x: 510, y: 220 },
    ];
    function beneath(center, zoom, width, height, x, y) {
        const middle = project(center.lat, center.lon, zoom);
        return unproject(middle.x + x - width / 2, middle.y + y - height / 2, zoom);
    }
    for (const { center, from, to, width, height, x, y } of samples) {
        const initial = beneath(center, from, width, height, x, y);
        const next = zoomAroundPoint(center, from, to, width, height, x, y);
        const final = beneath(next, next.zoom, width, height, x, y);
        assert.equal(next.zoom, to);
        assert.ok(Math.abs(final.lat - initial.lat) < 1e-8, `latitude at pointer changed: ${final.lat} vs ${initial.lat}`);
        assert.ok(Math.abs(final.lon - initial.lon) < 1e-8, `longitude at pointer changed: ${final.lon} vs ${initial.lon}`);
    }
});

test('wheel zoom: center controls stay centered and zoom limits are respected', () => {
    const center = { lat: 55.8, lon: -6.4 };
    const centered = zoomAroundPoint(center, 9, 11, 900, 600);
    assert.ok(Math.abs(centered.lat - center.lat) < 1e-8);
    assert.ok(Math.abs(centered.lon - center.lon) < 1e-8);
    assert.equal(centered.zoom, 11);
    assert.equal(zoomAroundPoint(center, 16, 17, 900, 600, 150, 200).zoom, 16);
    assert.deepEqual(zoomAroundPoint(center, 2, 0, 900, 600, 150, 200), { ...center, zoom: 2 });
});

test('map sites retain operating status independent of stock and coordinates', () => {
    const collection = { distilleries: [
        { id: 'closed', name: 'Hanyu', status: 'closed' },
        { id: 'reopened', name: 'Port Ellen', status: 'reopened' },
        { id: 'active', name: 'Yamazaki', status: 'active' },
    ], bottlings: [{ id: 'one', name: 'Historic whisky', distilleryIds: ['closed'], bottles: [{ id: 'physical' }] }] };
    const sites = buildDistilleryMap(collection, { includeAllDistilleries: true }).located;
    assert.equal(sites.find(s => s.id === 'closed').status, 'closed');
    assert.equal(sites.find(s => s.id === 'closed').bottleCount, 1);
    assert.equal(sites.find(s => s.id === 'reopened').status, 'reopened');
    assert.equal(sites.find(s => s.id === 'active').status, 'active');
    assert.equal(locationFor({ name: 'Yamazaki' }).approximate, true);
});
