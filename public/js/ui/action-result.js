/** Mutations have an explicit outcome even when an endpoint returns no JSON body.
 * Callers must inspect ok before leaving a view or dismissing a form. */
export async function runAction(task, refresh, onError) {
    try {
        const value = await task();
        await refresh();
        return { ok: true, value };
    } catch (error) {
        onError(error);
        return { ok: false, error };
    }
}
