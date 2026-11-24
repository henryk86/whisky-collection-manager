import test from 'node:test';
import assert from 'node:assert/strict';
import {documentPreviewKind} from '../../public/js/features/file-preview.js';

test(
  'attachment preview permits native browser image, PDF and text content',
  () => {
    assert.deepEqual(
      documentPreviewKind('invoice.PDF'),
      {kind: 'pdf', type: 'application/pdf'}
    );
    assert.deepEqual(
      documentPreviewKind('proof.png'),
      {kind: 'image', type: 'image/png'}
    );
    assert.deepEqual(
      documentPreviewKind('proof.JPEG'),
      {kind: 'image', type: 'image/jpeg'}
    );
    assert.deepEqual(
      documentPreviewKind('proof.gif'),
      {kind: 'image', type: 'image/gif'}
    );
    assert.deepEqual(
      documentPreviewKind('evidence.csv'),
      {kind: 'text', type: 'text/plain'}
    );
    assert.deepEqual(
      documentPreviewKind('message.eml'),
      {kind: 'text', type: 'text/plain'}
    );
  }
);

test(
  'attachment preview does not embed unsupported office, HEIC, SVG or HTML files',
  () => {
    for (const name of [
      'order.docx',
      'report.xlsx',
      'receipt.odt',
      'invoice.ods',
      'evidence.heic',
      'photo.heif',
      'unsafe.svg',
      'unsafe.html',
      'unknown',
    ]) {
      assert.deepEqual(
        documentPreviewKind(name),
        {kind: 'unsupported', type: null},
        name
      );
    }
  }
);
