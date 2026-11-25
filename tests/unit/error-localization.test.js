import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createTranslator, initializeLanguage,
  t
} from '../../public/js/i18n/index.js';
import {httpResponseError, request} from '../../public/js/api.js';
import {apiErrorCode} from '../../shared/api-error-codes.js';
import {jobErrorText} from '../../public/js/i18n/job-errors.js';
import {publicErrorResponse}
  from '../../server/domain/public-error-response.js';
import {fail} from '../../server/domain/errors.js';
import {adjustPhotoPixels, validatePhotoAdjustments}
  from '../../public/js/features/photo-editor/adjustments.js';
import {sharpenCutoutAlpha} from '../../public/js/features/cutout/edge.js';

const catalogs = Object.fromEntries(['de', 'en', 'index'].map(language =>
  [
    language,
    JSON.parse(fs.readFileSync(
      new URL(`../../public/locales/${language}.json`, import.meta.url),
      'utf8'
    )),
  ]));
/**
 * Transforms the loader text with the required substitutions.
 *
 * @param {*} url URL of the resource being processed.
 * @return {!Promise<*>} Promise for the asynchronous operation.
 */
const loader = async url => {
  const language = url.split('/').pop().replace('.json', '');
  return {
    ok: Boolean(catalogs[language]),
    /**
     * Derives the json result from the supplied values.
     * @return {!Promise<*>} Promise for the asynchronous operation.
     */
    json: async () =>
      catalogs[language],
  };
};

/**
 * Coordinates asynchronous work for select.
 *
 * @param {*} code Code used to identify a specific outcome.
 * @return {!Promise<*>} Promise for the asynchronous operation.
 */
const select = async code => {
  const old = globalThis.location;
  globalThis.location = {search: `?lang=${code}`};
  try {await initializeLanguage(loader);} finally {
    if (old === undefined) delete globalThis.location;
    else globalThis.location = old;
  }
};

test(
  'image exceptions are localized at the source, preserving exception types',
  async () => {
    try {
      await select('de');
      assert.throws(
        () => adjustPhotoPixels({width: 1, height: 1, data: []}, {}),
        error => error instanceof TypeError && error.message ===
          'Ungültige Bilddaten.'
      );
      assert.throws(
        () => sharpenCutoutAlpha([1, 2]),
        /Ungültige RGBA-Bilddaten/
      );
      assert.throws(
        () => validatePhotoAdjustments({exposure: 100}),
        /Ungültiger Wert für exposure/
      );
      await select('en');
      assert.throws(
        () => adjustPhotoPixels({width: 1, height: 1, data: []}, {}),
        error => error instanceof TypeError && error.message ===
          'Invalid image data.'
      );
      assert.throws(
        () => sharpenCutoutAlpha([1, 2]),
        /Invalid RGBA image data/
      );
      assert.throws(
        () => validatePhotoAdjustments({exposure: 100}),
        /Invalid value for exposure/
      );
    } finally {await select('de');}
  }
);

test(
  'missing translations fall back to English, not German or a raw key',
  () => {
    assert.equal(
      createTranslator({}, catalogs.en, 'de')('errors.images.invalidData'),
      'Invalid image data.'
    );
    assert.equal(
      createTranslator(
        {'errors.images.invalidData': ''},
        catalogs.en,
        'de'
      )('errors.images.invalidData'),
      'Invalid image data.'
    );
    assert.equal(t('errors.images.invalidData'), 'Ungültige Bilddaten.');
  }
);

test(
  'server errors expose stable codes and English-only fallback, never raw \
German text',
  () => {
    assert.equal(apiErrorCode('Ungültiger Pfad'), 'api.errors.invalidPath');
    assert.equal(
      apiErrorCode('constructor'),
      null,
      'Object.prototype properties must not be valid error codes'
    );
    assert.deepEqual(
      publicErrorResponse(fail('Ungültiger Pfad', 400, 'api.errors.invalidPath'
      )),
      {error: 'Invalid path.', errorCode: 'api.errors.invalidPath'}
    );
    assert.deepEqual(
      publicErrorResponse(fail(
        'Ungültige Zahl: abv',
        400,
        'api.errors.invalidNumberField',
        {field: 'abv'}
      )),
      {
        error: 'Invalid number: ABV',
        errorCode: 'api.errors.invalidNumberField',
        errorParams: {field: 'abv'},
      }
    );
    // Rewording a developer diagnostic must not change the public error
    // identity.
    assert.deepEqual(
      publicErrorResponse(fail(
        'Some entirely different diagnostic',
        400,
        'api.errors.invalidPath'
      )),
      {error: 'Invalid path.', errorCode: 'api.errors.invalidPath'}
    );
    assert.deepEqual(publicErrorResponse(fail('Noch nicht übersetzt', 400)),
      {error: 'The request could not be completed (HTTP 400).'});
    assert.deepEqual(
      publicErrorResponse(fail('Ungültiger Pfad', 400)),
      {error: 'The request could not be completed (HTTP 400).'},
      'untyped errors must not leak or map by German text'
    );
    assert.deepEqual(
      publicErrorResponse(fail(
        'raw',
        400,
        'api.errors.requiredField',
        {field: 'abc', html: '<script>', payload: 123}
      )),
      {
        error: 'abc is required.',
        errorCode: 'api.errors.requiredField',
        errorParams: {field: 'abc', html: '<script>'},
      }
    );
    assert.deepEqual(
      publicErrorResponse(new Error('secret token and stack details')),
      {error: 'The request could not be completed (HTTP 500).'}
    );
  }
);

test(
  'API errors use selected language and sanitized code instead of raw \
server error',
  async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => Response.json(
        {error: 'Ungültiger Pfad', errorCode: 'api.errors.invalidPath'},
        {status: 400}
      );
      await select('de');
      await assert.rejects(
        () => request('/api/example'),
        error => error.status === 400 &&
          error.code === 'api.errors.invalidPath' && error.message ===
          'Ungültiger Pfad.'
      );
      await select('en');
      await assert.rejects(
        () => request('/api/example'),
        error => error.message === 'Invalid path.'
      );
      globalThis.fetch = async () => Response.json(
        {error: '<script>Deutscher Servertext</script>'},
        {status: 422}
      );
      await assert.rejects(
        () => request('/api/example'),
        error => error.message ===
          'The request could not be completed (HTTP 422).'
      );
      const dynamic = httpResponseError(
        400,
        {errorCode: 'api.errors.requiredField', errorParams: {field: 'Name'}}
      );
      assert.equal(dynamic.message, 'Name is required.');
      assert.equal(
        jobErrorText('<img src=x onerror=alert(1)>'),
        t('backups.jobs.failed')
      );
      assert.equal(jobErrorText('Ungültiger Pfad'), 'Invalid path.');
      assert.equal(
        httpResponseError(
          400,
          {
            errorCode: 'api.errors.requiredField',
            errorParams: {field: 'distilleryName'},
          }
        ).message,
        'Distillery name is required.'
      );
      assert.equal(
        httpResponseError(
          400,
          {
            errorCode: 'api.errors.invalidDateField',
            errorParams: {field: 'distillationDate'},
          }
        ).message,
        'Invalid date: Distillation date'
      );
      assert.equal(
        jobErrorText({errorCode: 'backup.errors.mountMarkerMissing'}),
        'Backup destination unavailable: USB/NAS drive is not mounted \
correctly (backup marker missing).'
      );
      assert.equal(
        jobErrorText({
          errorCode: 'backup.errors.sourceSnapshotFailed',
          errorParams: {status: '503'},
        }),
        'The application could not create a consistent backup snapshot \
(HTTP 503).'
      );
      assert.equal(
        jobErrorText({
          errorCode: 'backup.errors.notInCatalog',
          error: '<script>secrets</script>',
        }),
        t('backups.jobs.failed')
      );
      await select('de');
      assert.equal(
        httpResponseError(
          400,
          {errorCode: 'api.errors.requiredField', errorParams: {field: 'name'}}
        ).message,
        'Name ist erforderlich.'
      );
      assert.equal(
        httpResponseError(
          400,
          {
            errorCode: 'api.errors.invalidNumberField',
            errorParams: {field: 'abv'},
          }
        ).message,
        'Ungültige Zahl: Alkoholgehalt'
      );
      assert.equal(
        jobErrorText({errorCode: 'backup.errors.mountMarkerMissing'}),
        'Backup-Ziel nicht bereit: USB-/NAS-Laufwerk ist nicht korrekt \
eingehängt (Backup-Marker fehlt).'
      );

    } finally {
      globalThis.fetch = originalFetch;
      await select('de');
    }
  }
);
