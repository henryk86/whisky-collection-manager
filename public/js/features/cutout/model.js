/** Local browser inference: no image bytes, telemetry or prompts leave the device. */
export const MODEL_SIZE = 320;
const PIXELS = MODEL_SIZE * MODEL_SIZE;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];
let inferenceSession;

/** NCHW float32, RGB in [0,1], ImageNet normalization used by U2Netp. */
export function modelInput(imageData) {
    if (!imageData || imageData.width !== MODEL_SIZE || imageData.height !== MODEL_SIZE)
        throw new Error('Ungültige Modellbildgröße');
    const data = new Float32Array(3 * PIXELS);
    for (let i = 0; i < PIXELS; i++) {
        const pixel = i * 4;
        for (let channel = 0; channel < 3; channel++) {
            data[channel * PIXELS + i] = ((imageData.data[pixel + channel] / 255) - MEAN[channel]) / STD[channel];
        }
    }
    return data;
}

/** U2Netp output d0 is normalized like rembg and interpreted as alpha. */
export function normalizedMask(raw) {
    if (!raw || raw.length < PIXELS) throw new Error('Ungültige Modellmaske');
    let minimum = Infinity, maximum = -Infinity;
    for (let i = 0; i < PIXELS; i++) {
        const value = raw[i];
        if (!Number.isFinite(value)) throw new Error('Ungültige KI-Berechnung');
        minimum = Math.min(minimum, value);
        maximum = Math.max(maximum, value);
    }
    if (maximum - minimum < 1e-7) throw new Error('Keine Flasche erkannt');
    const mask = new Uint8ClampedArray(PIXELS);
    for (let i = 0; i < PIXELS; i++) mask[i] = Math.round(255 * (raw[i] - minimum) / (maximum - minimum));
    return mask;
}

async function session() {
    if (!inferenceSession) {
        inferenceSession = (async () => {
            // These files are downloaded only while preparing the Docker image / installation.
            const ort = await import('/ai/vendor/ort.wasm.min.mjs');
            ort.env.wasm.wasmPaths = '/ai/vendor/';
            ort.env.wasm.numThreads = 1; // no cross-origin isolation or large worker pool
            ort.env.wasm.proxy = false;
            const engine = await ort.InferenceSession.create('/ai/models/u2netp.onnx', {
                executionProviders: ['wasm'],
                graphOptimizationLevel: 'all',
            });
            return { ort, engine };
        })().catch(error => { inferenceSession = null; throw error; });
    }
    return inferenceSession;
}

export async function segment(imageData) {
    const { ort, engine } = await session();
    const inputName = engine.inputNames[0];
    const tensor = new ort.Tensor('float32', modelInput(imageData), [1, 3, MODEL_SIZE, MODEL_SIZE]);
    try {
        const output = await engine.run({ [inputName]: tensor });
        const first = output[engine.outputNames[0]];
        return normalizedMask(first?.data);
    } finally {
        tensor.dispose?.();
    }
}
