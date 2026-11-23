/** A persisted mutation is successful even when the subsequent view refresh fails.
 * Callers may close their forms and must not retry a committed POST. */
export async function runAction(task, refresh, onError, onRefreshError = () => {}) {
  let value;
  try {
    value = await task();
  } catch (error) {
    onError(error);
    return {ok: false, error};
  }
  try {
    await refresh();
    return {ok: true, value};
  } catch (refreshError) {
    onRefreshError(refreshError);
    return {ok: true, value, refreshError};
  }
}
