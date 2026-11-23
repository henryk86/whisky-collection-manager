import {displayErrorParams} from '../../shared/api-error-field-labels.js';
import {apiErrorFallbacks} from '../../shared/api-error-fallbacks.js';

function englishMessage(template, params = {}) {
  return template.replace(/\{([a-zA-Z]\w*)\}/g, (placeholder, name) =>
    Object.hasOwn(params, name) ? params[name] : placeholder);
}
function safeParams(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([name, field]) =>
    /^[a-zA-Z]\w*$/.test(name) && typeof field === 'string' && field.length <= 100));
}

/** Never infer public error identity from translated messages or expose internal detail. */
export function publicErrorResponse(error) {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  const generic = {error: englishMessage('The request could not be completed (HTTP {status}).', {status: String(status)})};
  const code = error?.code;
  if (typeof code !== 'string' || !Object.hasOwn(apiErrorFallbacks, code)) return generic;
  const params = safeParams(error.params);
  return {
    error: englishMessage(apiErrorFallbacks[code], displayErrorParams(params)),
    errorCode: code,
    ...(Object.keys(params).length ? {errorParams: params} : {})
  };
}
