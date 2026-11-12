import { t } from '../../i18n/index.js';
import { query as select } from '../../ui/dom.js';
import { lookupInventoryNumber } from '../../domain/selectors.js';
/** A scan navigates or fills the inventory field. It never opens an editor. */
export function createCodeResolver({ state, navigate, toast, closeModal, renderModal, query = select }) {
    async function resolveCode(value, assign = false) {
        value = value.trim();
        if (!value) {
            toast(t("scanner.validation.codeRequired"), true);
            return;
        }
        const match = lookupInventoryNumber(state.collection, value);
        const found = match?.bottle;
        if (found) {
            if (assign) {
                toast(t("scanner.validation.inventoryNumberAlreadyAssigned"), true);
                return;
            }
            navigate('detail', match.bottling.id, {
                highlightBottleId: found.id
            });
            return;
        }
        if (assign && state.scanReturn) {
            const previous = state.scanReturn;
            closeModal();
            state.modal = previous.modal;
            renderModal();
            const form = query('#bottle-form');
            if (form) {
                for (const [k, v] of Object.entries(previous.values || {})) {
                    if (form.elements[k] && typeof v === 'string') {
                        form.elements[k].value = v;
                    }
                }
                form.elements.inventoryNumber.value = value;
            }
            state.scanReturn = null;
            return;
        }
        closeModal();
        const msg = t("scanner.validation.unassignedCode",{code:value});
        toast(msg, true);
    }
    return resolveCode;
}
