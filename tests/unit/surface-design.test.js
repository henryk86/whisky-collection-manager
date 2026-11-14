import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const styles = fs.readFileSync('public/styles/surfaces.css', 'utf8');

test('all major content surfaces share the square-corner design from collection', () => {
    assert.match(fs.readFileSync('public/style.css','utf8'), /@import url\("\.\/styles\/surfaces\.css"\)/);
    assert.match(styles, /--surface-corner:\s*0px;/);
    assert.match(styles, /--field-corner:\s*2px;/);
    for (const selector of ['.panel','.whisky-card','.analytics-panel',
        '.settings-page .backup-step','.warehouse-room-card','.warehouse-room-summary',
        '.warehouse-wall-controls','.warehouse-unassigned-tray',
        '.warehouse-shelf-detail-bottle','.map-sidebar']) {
        assert.ok(styles.includes(selector + ','), `${selector}: shared surface rule is present`);
    }
    assert.match(styles, /border-radius:\s*var\(--surface-corner\)/);
    assert.match(styles, /border-radius:\s*var\(--field-corner\)/);
    assert.doesNotMatch(styles, /\.map-marker\b|\.analytics-donut\b|\.map-all-toggle input\b/,
        'round map markers, charts and switches must not be flattened');
});
