/**
 * Documentation contracts for the JSON format (schemaVersion 6).
 * These JSDoc types do not add runtime validation or a build step.
 * Runtime validation lives in server/domain/validation.js.
 * Optional metadata is intentionally omitted from minimal examples.
 *
 * @typedef {Object} Photo
 * @property {string} id
 * @property {import('./photo-images.js').PhotoAdjustment} [adjustment] Original-image editing state.
 * @property {import('./photo-images.js').PhotoCutout} [cutout] Selected or retained transparent derivative.
 * @property {string} path Relative path, e.g.
 * images/<bottle-id>/photo-<id>.jpg.
 * @property {string} [createdAt] ISO timestamp.
 * @property {'whiskybase'} [source] External reference image; not a proof of
 * ownership.
 *
 * @typedef {Object} BottleFile
 * @property {string} id UUID identifying this attachment.
 * @property {string} name Original filename shown to the user.
 * @property {string} path Relative path: documents/<bottle-id>/<file-id>.<ext>.
 * @property {number} size Number of bytes on disk.
 * @property {string} mimeType MIME type derived from the allowed extension.
 * @property {string} sha256 SHA-256 checksum of the stored bytes.
 * @property {string} uploadedAt ISO timestamp.
 *
 * @typedef {Object} Bottle
 * @property {string} id Stable UUID, independent of the inventory number.
 * @property {string} inventoryNumber Printed/scanned identifier; preserve
 * leading zeros.
 * @property {'standard'|'sample'} volumeType Type of this exact physical
 * bottle.
 * @property {number|null} [volumeMl] Actual volume of this bottle (samples
 * can have a different size).
 * @property {'closed'|'open'|'empty'} status
 * @property {Photo[]} [photos]
 * @property {BottleFile[]} [files] Invoice PDFs, supporting pictures, and
 * other records.
 * @property {string} [comment]
 * @property {string} [purchaseDate]
 * @property {string} [openedAt] YYYY-MM-DD opening date.
 * @property {string|null} [emptiedAt] YYYY-MM-DD date bottle became empty;
 * optional for legacy bottles.
 * @property {number|null} [purchasePrice]
 * @property {string} [currency]
 * @property {string} [createdAt]
 * @property {string} [updatedAt]
 *
 * @typedef {Object} Tasting
 * @property {string} id Independent, immutable tasting UUID.
 * @property {string} tastedOn YYYY-MM-DD local tasting date.
 * @property {string} [title] Optional tasting title.
 * @property {{nose:string,palate:string,finish:string}} tastingNotes
 * @property {number|null} rating Optional score from 0 to 100.
 * @property {string} [ratingComment] Optional overall comment on the rating,
 * up to 10,000 characters.
 * @property {import('./flavor-profile.js').FlavorProfile|null} flavorProfile Ten normalized sensory axes (older raw records may have eight).
 * @property {string|null} whiskyColor A fixed whisky colour key or
 * custom:#rrggbb (restricted warm whisky hue).
 * @property {string} createdAt ISO timestamp.
 * @property {string} updatedAt ISO timestamp.
 *
 * @typedef {Object} Bottling
 * @property {string} id
 * @property {string} name
 * @property {string[]} distilleryIds Zero, one, or multiple known contributors.
 * @property {string|null} [whiskyType]
 * @property {string|null} [brand]
 * @property {string} [bottler]
 * @property {boolean} [compositionComplete]
 * @property {number|null} [ageYears]
 * @property {number|null} [abv]
 * @property {number|null} [volumeMl] Optional nominal size stated for the
 * release; NOT the physical bottle type.
 * @property {string|null} [distillationDate] YYYY-MM-DD when the full date
 * is known.
 * @property {string|null} [bottlingDate] YYYY-MM-DD when the full date is
 * known.
 * @property {number|null} [distillationYear]
 * @property {number|null} [bottlingYear]
 * @property {'complete'|'incomplete'} [completionStatus]
 * @property {Tasting[]} tastings Independent tastings; the only persisted
 * owned-tasting source.
 * No legacy tasting fields or redundant rating summaries are persisted.
 * @property {Bottle[]} bottles Physical bottles are nested; no top-level
 * bottles array.
 * @property {string} [createdAt]
 * @property {string} [updatedAt]
 *
 * @typedef {Object} Distillery
 * @property {string} id
 * @property {string} name
 * @property {string} [status]
 * @property {string} [country] Geography of the producing site, not the
 * bottler.
 * @property {string} [region] Whisky region when supported by curated
 * reference data.
 * @property {number|null} [latitude] Optional surveyed coordinate; takes
 * precedence over curated locations.
 * @property {number|null} [longitude]
 *
 * @typedef {Object} ExternalTastingBottling
 * @property {string} name Release name of an unowned whisky.
 * @property {string} distillery Optional free-text distillery.
 * @property {string} bottler Optional free-text bottler.
 * @property {number|null} ageYears
 * @property {number|null} abv
 * @property {number|null} releaseYear
 *
 * @typedef {Tasting & {bottling: ExternalTastingBottling}} StandaloneTasting
 *
 * @typedef {Object} FlightPlanItem
 * @property {string} bottlingId Owned release identifier.
 * @property {string} bottleId Physical bottle intended for the session.
 * @property {'noProfile'|'untried'|'contrast'|'similar'|'intensity'|'manual'} [reason] Rationale for the planned selection.
 *
 * @typedef {Object} TastingFlight
 * @property {string} id Stable UUID for the tasting session.
 * @property {string} name Name of the flight.
 * @property {string} date YYYY-MM-DD tasting session date.
 * @property {string} notes Optional comparison notes.
 * @property {string[]} tastingIds Ordered references to individual owned or
 * external tastings; each tasting is in at most one flight.
 * @property {'planned'|'inProgress'|'completed'} [phase] Lifecycle state; older flights omit it.
 * @property {FlightPlanItem[]} [planItems] Up to six distinct planned releases; missing bottles are retained.
 * @property {string} createdAt
 * @property {string} updatedAt
 *
 * @typedef {Object} Collection
 * @property {6} schemaVersion
 * @property {number} nextInventoryNumber
 * @property {string[]} reservedInventoryNumbers Historical numbers skipped
 * by automatic suggestions; may be manually reassigned once free.
 * @property {{establishedYear: number|null}} [settings] Optional
 * collection-wide preferences; older archives omit this.
 * @property {Distillery[]} distilleries
 * @property {Bottling[]} bottlings
 * @property {StandaloneTasting[]} [externalTastings] Standalone
 * tastings of unowned whisky, excluded from inventory and analytics.
 * @property {TastingFlight[]} [tastingFlights] Optional ordered session
 * groups; no duplication of individual notes.
 */
export {};
