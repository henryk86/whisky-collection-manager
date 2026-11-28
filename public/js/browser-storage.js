/**
 * Resolves browser-owned persistent storage without touching Node.js Web Storage.
 * Browsers can deny storage access (including access to the property itself).
 * @return {Storage|undefined} Browser storage if accessible; otherwise undefined.
 */
export function getBrowserStorage() {
  try {return typeof window === 'undefined' ? undefined : window.localStorage;}
  catch {return undefined;}
}
