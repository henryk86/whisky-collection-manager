import test from 'node:test';
import assert from 'node:assert/strict';
import { readAnalyticsDate } from '../../public/js/domain/analytics-period.js';

test('analytics date fields accept real calendar days including leap years', () => {
    assert.equal(readAnalyticsDate('2026-04-17'), '2026-04-17');
    assert.equal(readAnalyticsDate('2024-02-29'), '2024-02-29');
    for (const invalid of ['', '2026-04', '2026-02-29', '2026-13-01', '2026-01-00', '2026-04-31', 'invalid']) {
        assert.equal(readAnalyticsDate(invalid), '', invalid);
    }
});
