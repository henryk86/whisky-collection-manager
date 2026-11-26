import {actionButton} from '../../ui/buttons.js';
import {t} from '../../i18n/index.js';
import {query} from '../../ui/dom.js';
import {textInput} from '../../ui/fields.js';
import {supportedFormats, cameraConfig} from './config.js';
import {loadTemplates} from '../../ui/templates.js';

const renderTemplate = await loadTemplates('scanner/controller.html');

/**
 * Camera lifecycle only. Inventory lookup lives in resolve-code.js.
 *
 * @param {!Object} options Optional configuration for the operation.
 * @return {!Object} Structured result for the caller.
 */
export function createScanner({state, showModal, resolveCode}) {
  let scannerSequence = 0;
  /**
   * Updates element attributes used by scan status.
   *
   * @param {*} message Message to display or use for diagnostics.
   * @param {string=} kind Visual status category for the scanner message.
   */
  function scanStatus(message, kind = 'info') {
    const element = query('#scan-error');
    if (element) {
      element.textContent = message;
      element.dataset.status = kind;
    }
  }

  /**
   * Builds the localized scan error text for the current language.
   *
   * @param {*} err Error to handle or propagate.
   * @return {*} Value returned by the delegated operation.
   */
  function scanError(err) {
    const name = err?.name || '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return t("scanner.camera.permissionDenied");
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return t("scanner.camera.notFound");
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      return t("scanner.camera.inUse");
    }
    return err?.message || String(err) || t("scanner.errors.unknownScannerError");
  }
  let scannerLibraryPromise = null;
  /**
   * Loads scanner library for controller.
   *
   * @return {*} Created DOM element.
   */
  function loadScannerLibrary() {
    if (window.Html5Qrcode) {
      return Promise.resolve(window.Html5Qrcode);
    }
    if (!scannerLibraryPromise) {
      scannerLibraryPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = '/vendor/html5-qrcode.min.js';
        script.async = true;
        script.onload = () => window.Html5Qrcode ? resolve(window.Html5Qrcode) : reject(Error('Scanner-Bibliothek konnte nicht geladen werden'));
        script.onerror = () => reject(Error(t('scanner.errors.libraryMissing')));
        document.head.append(script);
      }).catch(err => {
        scannerLibraryPromise = null;
        throw err;
      });
    }
    return scannerLibraryPromise;
  }

  /**
   * Performs the stop scan lifecycle action.
   * @return {!Promise<*>} Promise for the asynchronous operation.
   */
  async function stopScan() {
    scannerSequence++;
    const scanner = state.scanner;
    state.scanner = null;
    if (scanner?.timer) {
      clearTimeout(scanner.timer);
    }
    scanner?.stream?.getTracks().forEach(t => t.stop());
    if (scanner?.engine) {
      try {
        await scanner.engine.stop();
      }
      catch {
      }
      try {
        await scanner.engine.clear();
      }
      catch {
      }
    }
  }

  /**
   * Builds the localized scan code text for the current language.
   *
   * @param {boolean=} assign Whether to assign the scanned bottle to a warehouse shelf.
   * @return {!Promise<*>} Promise for the asynchronous operation.
   */
  async function scanCode(assign = false) {
    const previousModal = assign ? state.modal : null;
    const previousValues = assign && query('#bottle-form') ? Object.fromEntries(new FormData(query('#bottle-form')).entries()) : null;
    state.scanReturn = assign ? {
      modal: previousModal, values: previousValues,
    } : null;
    await stopScan();
    const sequence = scannerSequence;
    showModal(
      t("forms.bottle.scanLabel"),
      renderTemplate('hint', {
        manualCodeField: textInput(t("scanner.input.manualInventoryNumber"), 'manualCode', '', {full: true, }),
        assign: assign ? '1' : '0',
        closeModalButton: actionButton({
          label: t("common.actions.close"),
          action: 'close-modal',
        }),
      })
    );
    if (!window.isSecureContext) {
      scanStatus(t("scanner.camera.requiresHttps"), 'error');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      scanStatus(t("scanner.camera.unsupportedBrowser"), 'error');
      return;
    }
    try {
      const Html5Qrcode = await loadScannerLibrary();
      if (sequence !== scannerSequence || !query('#scan-reader')) {
        return;
      }
      const engine = new Html5Qrcode('scan-reader', {
        formatsToSupport: supportedFormats(window.Html5QrcodeSupportedFormats),
        useBarCodeDetectorIfSupported: false,
        verbose: false,
      }, false);
      const scanner = {
        engine, timer: null,
      };
      state.scanner = scanner;
      let handled = false;
      /**
       * Builds the localized decoded text for the current language.
       *
       * @param {*} value Value to process.
       * @param {*} result Result from the preceding operation.
       * @return {!Promise<*>} Promise for the asynchronous operation.
       */
      const decoded = async (value, result) => {
        if (handled || state.scanner !== scanner) {
          return;
        }
        handled = true;
        const code = String(value ?? '').trim();
        const format = result?.result?.format?.formatName || t("scanner.input.barcodeOrQr");
        scanStatus(`Erkannt (${format}): ${code}`, 'success');
        const field = query('[name=manualCode]');
        if (field) {
          field.value = code;
        }
        try {
          navigator.vibrate?.(80);
        }
        catch {
        }
        await stopScan();
        if (code) {
          await resolveCode(code, assign);
        }
      };
      await engine.start({
        facingMode: 'environment',
      }, cameraConfig(), decoded, () => {
      });
      if (sequence !== scannerSequence || state.scanner !== scanner) {
        await engine.stop().catch(() => {
        });
        return;
      }
      scanStatus(t("scanner.camera.captureHint"), 'info');
      scanner.timer = setTimeout(() => {
        if (state.scanner === scanner && !handled) {
          scanStatus(t("scanner.camera.noCodeDetectedHint"), 'warning');
        }
      }, 6500);
    }
    catch (err) {
      if (sequence !== scannerSequence) {
        return;
      }
      scanStatus(t('scanner.errors.unavailable', {error: scanError(err)}), 'error');
      stopScan();
    }
  }

  /**
   * Builds the localized scan image text for the current language.
   *
   * @param {*} file File resource to read, write or inspect.
   * @return {!Promise<*>} Promise for the asynchronous operation.
   */
  async function scanImage(file) {
    if (!file) {
      return;
    }
    const assign = !!state.scanReturn;
    try {
      const Html5Qrcode = await loadScannerLibrary();
      if (!query('#scan-reader')) {
        return;
      }
      await stopScan();
      scanStatus(t("scanner.status.analyzingImage"));
      const engine = new Html5Qrcode('scan-reader', {
        formatsToSupport: supportedFormats(window.Html5QrcodeSupportedFormats),
        useBarCodeDetectorIfSupported: false,
      }, false);
      state.scanner = {engine, };
      const value = await engine.scanFile(file, true);
      const field = query('[name=manualCode]');
      if (field) {
        field.value = value;
      }
      scanStatus(`Code erkannt: ${value}`, 'success');
      await stopScan();
      await resolveCode(value, assign);
    }
    catch (err) {
      scanStatus('Bild konnte nicht gelesen werden: ' + scanError(err), 'error');
    }
  }
  return {
    scanCode, scanImage, stopScan,
  };
}
