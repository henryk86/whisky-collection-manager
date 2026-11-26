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
 * @param {Record<string, number>=} supported Scanner library's mapping of barcode-format names to numeric constants.
 * @return {number[]} Supported numeric barcode-format identifiers.
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
 * @return {{fps: number, qrbox: (width: number, height: number) => {width: number, height: number}}} Decoder frame rate and scan-area sizing callback.
 */
export function cameraConfig() {
  return {
    fps: 12,
    /**
     * Fits the rectangular scan area inside the available camera preview.
     *
     * @param {number} width Width in pixels.
     * @param {number} height Height in pixels.
     * @return {{width: number, height: number}} Scan-area dimensions in pixels.
     */
    qrbox: (width, height) => {
      const side = Math.floor(Math.min(width * .92, height * .85));
      return {
        width: side, height: Math.floor(side * .65),
      };
    },
  };
}
