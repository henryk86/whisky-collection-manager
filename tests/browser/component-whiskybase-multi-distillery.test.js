import {domElements, domText} from './component-dom.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {matchImportedDistilleries} from '../../public/js/features/import/distillery-matching.js';
import {importChoice} from '../../public/js/features/import/choice-template.js';

const distilleries = [
  {id: 'd-caol', name: 'Caol Ila'}, {id: 'd-bow', name: 'Bowmore'},
  {id: 'd-ard', name: 'Ardbeg'}, {id: 'd-port', name: 'Port Ellen'},
];

test(
  'Whiskybase: unknown contributors are listed separately, disabled and escaped in preview',
  async () => {
    const matches = matchImportedDistilleries('Ardbeg, New & <Scotch> Works', distilleries);
    assert.deepEqual(matches, [{name: 'Ardbeg', id: 'd-ard'}, {name: 'New & <Scotch> Works', id: null}]);
    const known = importChoice({
      label: 'Destillerie', value: matches[0].name,
      distillery: true, distilleryId: matches[0].id, checked: true,
    });
    const unknown = importChoice({
      label: 'Destillerie', value: matches[1].name,
      distillery: true, disabled: true,
    });
    assert.ok((await domElements(known, '[name="import-distillery"][value="d-ard"][checked]')).length > 0);
    assert.ok((await domElements(unknown, '[name="import-distillery"][disabled]')).length > 0);
    assert.match(await domText(unknown), new RegExp("New & <Scotch> Works"));
    assert.equal((await domElements(unknown, 'Scotch')).length, 0);
    assert.match(await domText(unknown), /Nicht gefunden/);
  }
);
