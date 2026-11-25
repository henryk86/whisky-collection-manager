import {t} from '../../i18n/index.js';
/**
 * Keep decoder settings stable; changes require actual barcode-device testing.
 */
export const scannerFormatNames = [
  'QR_CODE',
  'CODE_128',
  'CODE_39',
  'CODE_93',
  'EAN_13',
  'EAN_8',
  'UPC_A',
  'UPC_E',
  'ITF',
  'DATA_MATRIX',
  'CODABAR',
];
/**
 * Returns barcode formats supported by the scanner configuration.
 *
 * @param {!Object=} supported Supported used by this operation.
 * @return {!Array<*>} Resulting list of values.
 */
export function supportedFormats(supported = {}) {
  const formats = scannerFormatNames.map(name => supported[name]).filter(Number.isInteger);
  if (!formats.length) {
    throw Error(t('errors.scanner.formatsUnavailable'));
  }
  return formats;
}

/**
 * Builds camera constraints for the selected scanner mode.
 *
 * @return {!Object} Structured result for the caller.
 */
export function cameraConfig() {
  return {
    fps: 12,
    /**
     * Calculates the qrbox numeric value.
     *
     * @param {*} width Width in pixels.
     * @param {*} height Height in pixels.
     * @return {!Object} Structured result assembled from the input data.
     */
    qrbox: (width, height) => {
      const side = Math.floor(Math.min(width * .92, height * .85));
      return {
        width: side, height: Math.floor(side * .65),
      };
    },
  };
}
