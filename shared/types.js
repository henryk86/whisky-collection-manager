/**
 * Documentation contracts for the JSON format (schemaVersion 4).
 * These JSDoc types do not add runtime validation or a build step.
 * Runtime validation lives in server/domain/validation.js.
 * Optional metadata is intentionally omitted from minimal examples.
 *
 * @typedef {Object} Photo
 * @property {string} id
 * @property {string} path Relative path, e.g. images/<bottle-id>/photo-<id>.jpg.
 * @property {string} [createdAt] ISO timestamp.
 * @property {'whiskybase'} [source] External reference image; not a proof of ownership.
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
 * @property {string} inventoryNumber Printed/scanned identifier; preserve leading zeros.
 * @property {'standard'|'sample'} volumeType Type of this exact physical bottle.
 * @property {number|null} [volumeMl] Actual volume of this bottle (samples can have a different size).
 * @property {'closed'|'open'|'empty'} status
 * @property {Photo[]} [photos]
 * @property {BottleFile[]} [files] Invoice PDFs, supporting pictures, and other records.
 * @property {string} [comment]
 * @property {{nose: string, palate: string, finish: string}} [tastingNotes]
 * @property {string} [purchaseDate]
 * @property {number|null} [purchasePrice]
 * @property {string} [currency]
 * @property {number|null} [rating]
 * @property {string} [createdAt]
 * @property {string} [updatedAt]
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
 * @property {number|null} [volumeMl] Optional nominal size stated for the release; NOT the physical bottle type.
 * @property {string|null} [distillationDate] YYYY-MM-DD when the full date is known.
 * @property {string|null} [bottlingDate] YYYY-MM-DD when the full date is known.
 * @property {number|null} [distillationYear]
 * @property {number|null} [bottlingYear]
 * @property {'complete'|'incomplete'} [completionStatus]
 * @property {Bottle[]} bottles Physical bottles are nested; no top-level bottles array.
 * @property {string} [createdAt]
 * @property {string} [updatedAt]
 *
 * @typedef {Object} Distillery
 * @property {string} id
 * @property {string} name
 * @property {string} [status]
 * @property {string} [country] Geography of the producing site, not the bottler.
 * @property {string} [region] Whisky region when supported by curated reference data.
 * @property {number|null} [latitude] Optional surveyed coordinate; takes precedence over curated locations.
 * @property {number|null} [longitude]
 *
 * @typedef {Object} Collection
 * @property {4} schemaVersion
 * @property {number} nextInventoryNumber
 * @property {string[]} reservedInventoryNumbers Historical numbers skipped by automatic suggestions; may be manually reassigned once free.
 * @property {{establishedYear: number|null}} [settings] Optional collection-wide preferences; older archives omit this.
 * @property {Distillery[]} distilleries
 * @property {Bottling[]} bottlings
 */
export {};
