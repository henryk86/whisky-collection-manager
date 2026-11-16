import english from '../../public/locales/en.json' with { type: 'json' };
import { apiErrorCode } from '../../public/js/i18n/api-error-codes.js';

const dynamicErrors = [
    [/^Ungültige Zahl: (.+)$/, 'api.errors.invalidNumberField', ['field']],
    [/^Ungültiges Datum: (.+)$/, 'api.errors.invalidDateField', ['field']],
    [/^(.+) ist erforderlich$/, 'api.errors.requiredField', ['field']],
    [/^(.+) widerspricht (.+)$/, 'api.errors.conflictingFields', ['field', 'other']],
    [/^(.+): ungültiger Wert$/, 'api.errors.invalidField', ['field']],
    [/^(.+): außerhalb des gültigen Bereichs$/, 'api.errors.fieldOutOfRange', ['field']],
];

function englishMessage(key, params = {}) {
    return english[key].replace(/\{([a-zA-Z]\w*)\}/g, (placeholder, name) =>
        Object.hasOwn(params, name) ? params[name] : placeholder);
}

/** Never leak unexpected errors, internal German text or untrusted details into HTTP responses. */
export function publicErrorResponse(error) {
    const status = Number.isInteger(error?.status) ? error.status : 500;
    if (!error?.status) return { error: englishMessage('errors.api.generic', {status}) };
    const code = apiErrorCode(error.message);
    if (code) return { error: englishMessage(code), errorCode: code };
    for (const [pattern, candidate, names] of dynamicErrors) {
        const match = typeof error.message === 'string' ? pattern.exec(error.message) : null;
        if (!match) continue;
        const params = Object.fromEntries(names.map((name, index) => [name, match[index + 1].slice(0, 100)]));
        return { error: englishMessage(candidate, params), errorCode: candidate, errorParams: params };
    }
    // Legacy or dynamically generated validations without a stable code.
    return { error: englishMessage('errors.api.generic', {status}) };
}
