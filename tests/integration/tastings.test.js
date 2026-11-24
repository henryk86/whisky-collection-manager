import test from 'node:test';
import assert from 'node:assert/strict';
import {startTestServer, requestJson as api} from '../helpers/server.js';
import {latestTasting} from '../../shared/tasting-records.js';
const notes = nose => ({nose, palate: '', finish: ''});
test(
  'tasting CRUD, latest-date summary, no implicit migration and cross-bottling isolation',
  async () => {
    const server = await startTestServer();
    try {
      const a = (await api(server.base, '/api/bottlings', 'POST', {name: 'Release A'})).data.bottling;
      const b = (await api(server.base, '/api/bottlings', 'POST', {name: 'Release B'})).data.bottling;
      assert.deepEqual(a.tastings, []);
      assert.equal(
        a.rating,
        undefined,
        'no legacy records are converted on create'
      );
      const endpoint = `/api/bottlings/${a.id}/tastings`;
      const first = await api(
        server.base,
        endpoint,
        'POST',
        {
          tastedOn: '2026-06-01',
          rating: 80,
          tastingNotes: notes('Oaky'),
          ratingComment: 'Sehr ausgewogen\nSchöner Nachklang',
        }
      );
      assert.equal(first.status, 201);
      assert.equal(
        first.data.ratingComment,
        'Sehr ausgewogen\nSchöner Nachklang'
      );
      const recent = await api(
        server.base,
        endpoint,
        'POST',
        {tastedOn: '2026-11-15', rating: 91.5}
      );
      assert.equal(recent.status, 201);
      const old = await api(
        server.base,
        endpoint,
        'POST',
        {tastedOn: '2026-01-02', rating: 99}
      );
      assert.equal(old.status, 201);
      let current = (await api(server.base, '/api/collection')).data
        .bottlings[0];
      assert.deepEqual(current.tastings.map(x => x.rating), [80, 91.5, 99]);
      assert.equal(
        latestTasting(current).rating,
        91.5,
        'latest date, not insertion order'
      );
      assert.equal(current.rating, undefined, 'no persisted summary');
      assert.deepEqual(
        (await api(server.base, endpoint)).data.map(x => x.rating),
        [91.5, 80, 99]
      );
      assert.equal(
        (await api(server.base, `${endpoint}/${first.data.id}`)).data.rating,
        80
      );
      assert.equal(
        (await api(server.base, `${endpoint}/${first.data.id}`)).data
          .ratingComment,
        'Sehr ausgewogen\nSchöner Nachklang'
      );
      assert.equal(
        (await api(
          server.base,
          `/api/bottlings/${b.id}/tastings/${first.data.id}`
        )).status,
        404
      );
      assert.equal(
        (await api(
          server.base,
          `/api/bottlings/${b.id}/tastings/${first.data.id}`,
          'DELETE'
        )).status,
        404
      );
      assert.equal(
        (await api(server.base, `/api/bottlings/${a.id}`, 'PATCH', {rating: 45})).status,
        400
      );
      const edit = await api(
        server.base,
        `${endpoint}/${recent.data.id}`,
        'PATCH',
        {
          rating: null,
          tastingNotes: notes('Vanilla'),
          ratingComment: 'Noch einmal testen',
        }
      );
      assert.equal(edit.status, 200);
      current = (await api(server.base, '/api/collection')).data.bottlings[0];
      assert.equal(
        latestTasting(current).rating,
        null,
        'latest without score remains unscored'
      );
      assert.equal(latestTasting(current).tastingNotes.nose, 'Vanilla');
      assert.equal(latestTasting(current).ratingComment, 'Noch einmal testen');
      assert.equal(
        (await api(
          server.base,
          `${endpoint}/${recent.data.id}`,
          'PATCH',
          {ratingComment: 27}
        )).status,
        400
      );
      assert.equal(
        (await api(
          server.base,
          `${endpoint}/${recent.data.id}`,
          'PATCH',
          {ratingComment: ''}
        )).data.ratingComment,
        ''
      );
      assert.equal(
        (await api(
          server.base,
          endpoint,
          'POST',
          {tastedOn: '2026-02-31', rating: 99}
        )).status,
        400
      );
      assert.equal(
        (await api(
          server.base,
          `${endpoint}/${recent.data.id}`,
          'PATCH',
          {id: 'tamper'}
        )).status,
        400
      );
      assert.equal(
        (await api(server.base, `${endpoint}/${recent.data
          .id}`, 'DELETE')).status,
        200
      );
      current = (await api(server.base, '/api/collection')).data.bottlings[0];
      assert.equal(latestTasting(current).rating, 80);
      await api(server.base, `${endpoint}/${first.data.id}`, 'DELETE');
      await api(server.base, `${endpoint}/${old.data.id}`, 'DELETE');
      current = (await api(server.base, '/api/collection')).data.bottlings[0];
      assert.equal(current.tastings.length, 0);
      assert.equal(latestTasting(current), null);
      const exported = await api(server.base, '/api/collection');
      assert.deepEqual(exported.data.bottlings[0].tastings, []);
    } finally {await server.stop();}
  }
);

test(
  'legacy flavor scores survive API reads and edits; new aroma scores persist independently',
  async () => {
    const server = await startTestServer();
    try {
      const bottling = (await api(
        server.base,
        '/api/bottlings',
        'POST',
        {name: 'Historical flavors'}
      )).data.bottling;
      const route = `/api/bottlings/${bottling.id}/tastings`;
      const legacy = {
        woody: 8,
        cereal: 3,
        peaty: 6,
        fruity: 4,
        floral: 2,
        winey: 1,
        feinty: 7,
        sulphury: 0,
      };
      const created = await api(
        server.base,
        route,
        'POST',
        {tastedOn: '2026-11-17', flavorProfile: legacy}
      );
      assert.equal(created.status, 201);
      const id = created.data.id;
      const stored = (await api(server.base, `${route}/${id}`)).data;
      for (const [key, score] of Object.entries(legacy)) assert.equal(stored.flavorProfile[key], score);
      for (const key of ['smoky', 'medicinal']) assert.equal(stored.flavorProfile[key], null);
      const edit = await api(server.base, `${route}/${id}`, 'PATCH', {title: 'Retasted'});
      assert.equal(edit.status, 200);
      const unchanged = (await api(server.base, `${route}/${id}`)).data
        .flavorProfile;
      assert.deepEqual(
        unchanged,
        stored.flavorProfile,
        'editing unrelated fields must not fabricate missing aroma ratings'
      );
      const update = await api(server.base, `${route}/${id}`, 'PATCH', {
        flavorProfile: {...unchanged, smoky: 0, medicinal: 5},
      });
      assert.equal(update.status, 200);
      const saved = (await api(server.base, `${route}/${id}`)).data
        .flavorProfile;
      assert.equal(saved.smoky, 0, 'explicit zero is a recorded score');
      assert.equal(saved.medicinal, 5);
      for (const [key, score] of Object.entries(legacy)) assert.equal(saved[key], score);
      const withOldEleventh = {...saved, fiery: 9};
      const oldUpdate = await api(
        server.base,
        `${route}/${id}`,
        'PATCH',
        {flavorProfile: withOldEleventh}
      );
      assert.equal(oldUpdate.status, 200);
      const normalized = (await api(server.base, `${route}/${id}`)).data
        .flavorProfile;
      assert.equal(
        Object.hasOwn(normalized, 'fiery'),
        false,
        'deprecated extra dimension is not persisted'
      );
      assert.equal(
        normalized.feinty,
        legacy.feinty,
        'alcoholic dimension stays unchanged'
      );
    } finally {await server.stop();}
  }
);
