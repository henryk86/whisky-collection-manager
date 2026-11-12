/** Keep decoder settings stable; changes require actual barcode-device testing. */
export const scannerFormatNames = ['QR_CODE', 'CODE_128', 'CODE_39', 'CODE_93', 'EAN_13', 'EAN_8', 'UPC_A', 'UPC_E', 'ITF', 'DATA_MATRIX', 'CODABAR'];
export function supportedFormats(supported = {}) {
    const formats = scannerFormatNames.map(name => supported[name]).filter(Number.isInteger);
    if (!formats.length) {
        throw Error('Scannerformate konnten nicht geladen werden');
    }
    return formats;
}
export function cameraConfig() {
    return {
        fps: 12, qrbox: (width, height) => {
            const side = Math.floor(Math.min(width * .92, height * .85));
            return {
                width: side, height: Math.floor(side * .65)
            };
        }
    };
}
