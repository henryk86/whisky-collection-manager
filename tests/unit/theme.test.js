import test from 'node:test';
import assert from 'node:assert/strict';
import { getThemePreference, effectiveTheme, nextTheme } from '../../public/js/theme/preference.js';
test('theme defaults to system preference', () => {
    assert.equal(getThemePreference({
        getItem() {
            return null;
        }
    }), 'system');
    assert.equal(effectiveTheme('system', true), 'dark');
    assert.equal(effectiveTheme('system', false), 'light');
});
test('light and dark override system preference', () => {
    assert.equal(effectiveTheme('dark', false), 'dark');
    assert.equal(effectiveTheme('light', true), 'light');
});
test('toggle flips light/dark and ignores invalid stored data', () => {
    assert.equal(nextTheme('dark'), 'light');
    assert.equal(nextTheme('light'), 'dark');
    assert.equal(getThemePreference({
        getItem() {
            return 'unexpected';
        }
    }), 'system');
    assert.equal(getThemePreference({
        getItem() {
            throw Error('blocked');
        }
    }), 'system');
});
