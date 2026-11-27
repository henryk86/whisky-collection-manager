/**
 * Builds a disambiguated release label without modifying stored names.
 * @param {{name?: string, subtitle?: string|null}|null|undefined} bottling Owned or external whisky metadata.
 * @return {string} Name followed by the optional subtitle.
 */
export function bottlingName(bottling) {
  return [bottling?.name, bottling?.subtitle].filter(Boolean).join(' · ');
}
