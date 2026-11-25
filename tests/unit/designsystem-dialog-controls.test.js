import test from 'node:test';
import assert from 'node:assert/strict';
import {actionButton} from '../../public/js/ui/buttons.js';
import {modalFrame, modalFooter} from '../../public/js/ui/modal-layout.js';
import {textInput, selectInput, areaInput, checkboxInput} from '../../public/js/ui/fields.js';

test(
  'button variants preserve existing semantics and expose loading/disabled/focusable controls',
  () => {
    for (const [variant, className] of [
      ['primary', 'primary'],
      ['secondary', 'ds-button'],
      ['destructive', 'danger'],
      ['text', 'ds-button--text'],
      ['icon', 'ds-button--icon'],
    ]) {
      assert.match(
        actionButton({label: 'A & B', action: 'do-it', variant}),
        new RegExp(className)
      );
    }
    const loading = actionButton({label: 'Save', variant: 'primary', type: 'submit', loading: true});
    assert.match(loading, /type="submit"/);
    assert.match(loading, /disabled aria-busy="true"/);
    const icon = actionButton({
      label: 'Close',
      icon: '<svg aria-hidden="true"></svg>',
      iconOnly: true,
      size: 'small',
    });
    assert.match(icon, /aria-label="Close"/);
    assert.equal((icon.match(/<svg/g) || []).length, 1);
    assert.throws(() => actionButton({variant: 'unknown'}), RangeError);
    assert.throws(() => actionButton({size: 'massive'}), RangeError);
    assert.match(
      actionButton({label: '<script>hi</script>', action: 'evil" test'}),
      /&lt;script&gt;/
    );
    assert.doesNotMatch(
      actionButton({label: '<script>hi</script>'}),
      /<script>/
    );
  }
);


test(
  'shared buttons render app-owned icon labels without double-escaping',
  () => {
    const iconLabel = '<span class="add-action-label">' +
      '<svg aria-hidden="true"></svg>' +
      '<span>A &amp; B</span></span>';
    const markup = actionButton({
      trustedContent: iconLabel,
      action: 'add-distillery',
      variant: 'primary',
    });
    assert.match(markup, /data-act="add-distillery"/);
    assert.match(markup, /class="add-action-label"/);
    assert.equal((markup.match(/<svg/g) || []).length, 1);
    assert.match(markup, /A &amp; B/);
    assert.doesNotMatch(markup, /&amp;amp;/);
    const withData = actionButton({
      label: 'Open',
      action: 'tastings-open',
      data: {'tasting-id': 'A&B"<>'},
      ariaLabel: 'Show <tasting>',
      title: 'Open & view',
    });
    assert.match(withData, /data-tasting-id="A&amp;B&quot;&lt;&gt;"/);
    assert.match(withData, /aria-label="Show &lt;tasting&gt;"/);
    assert.match(withData, /title="Open &amp; view"/);
    assert.throws(
      () => actionButton({data: {'foo\" onmouseover': 'bad'}}),
      RangeError
    );
    assert.match(
      actionButton({label: '<script>alert(1)</script>'}),
      /&lt;script&gt;alert\(1\)&lt;\/script&gt;/
    );
  }
);

test(
  'central modal frame provides title, named close action, inner content and explicit variants',
  () => {
    const html = modalFrame({
      title: 'Whisky & Me',
      content: '<form id="edit"></form>',
      wide: true,
      variant: 'editor',
      closeLabel: 'Close',
    });
    assert.match(
      html,
      /role="dialog" aria-modal="true" aria-labelledby="ds-modal-title"/
    );
    assert.match(html, /class="dialog ds-modal ds-modal--editor"/);
    assert.doesNotMatch(
      html,
      /ds-modal--wide/,
      'explicit modal variant must override legacy wide size'
    );
    const assignment = modalFrame({
      title: 'Lagerort',
      content: '<form id="warehouse-form"></form>',
      wide: true,
      variant: 'assignment',
      closeLabel: 'Close',
    });
    assert.match(assignment, /class="dialog ds-modal ds-modal--assignment"/);
    assert.doesNotMatch(
      assignment,
      /ds-modal--wide/,
      'assignment stays at the documented 740px maximum'
    );
    const legacyWide = modalFrame({title: 'Other', content: '<p></p>', wide: true, closeLabel: 'Close'});
    assert.match(legacyWide, /class="dialog ds-modal wide ds-modal--wide"/);
    assert.match(html, /id="ds-modal-title">Whisky &amp; Me/);
    assert.match(html, /class="ds-modal-body"><form id="edit"><\/form>/);
    assert.match(html, /data-act="close-modal"/);
    assert.throws(
      () => modalFrame({title: 'bad', variant: 'random'}),
      RangeError
    );
    const footer = modalFooter(actionButton({label: 'Cancel', action: 'close-modal'}));
    assert.match(footer, /class="actions ds-modal-footer"/);
  }
);

test(
  'form helpers escape untrusted text and associate help/errors with controls',
  () => {
    const field = textInput(
      'Your & name',
      'name',
      '<x>',
      {required: true, description: 'Helpful', error: 'Wrong & missing'}
    );
    assert.match(
      field,
      /name="name" required aria-invalid="true" aria-describedby="ds-name-hint ds-name-error"/
    );
    assert.match(field, /value="&lt;x&gt;"/);
    assert.match(field, /id="ds-name-hint">Helpful/);
    assert.match(field, /id="ds-name-error" role="alert">Wrong &amp; missing/);
    const select = selectInput('Choose', 'id', [['', '<Empty>'], ['a', 'Yes']], 'a');
    assert.match(select, /&lt;Empty&gt;/); assert.match(select, /value="a" selected/);
    assert.match(areaInput('Note', 'note', '<br>'), /&lt;br&gt;/);
    assert.match(
      checkboxInput('Accept', 'consent', true),
      /type="checkbox" name="consent" checked/
    );
  }
);
