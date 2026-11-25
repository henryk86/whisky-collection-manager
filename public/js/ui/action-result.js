/**
 * Runs a persisted mutation and then refreshes the view. A refresh failure does
 * not invalidate a committed mutation or authorize a retry.
 *
 * @param {Function} task Mutation callback; may return a value or promise.
 * @param {Function} refresh Callback to reload the view after successful
 *     mutation.
 * @param {Function} onError Receives a mutation error.
 * @param {Function=} onRefreshError Receives a post-mutation refresh error.
 * @return {!Promise<!Object>} Result with ok and either value or error; a
 *     committed mutation may also include refreshError.
 */
export async function runAction(
  task, refresh, onError, onRefreshError = () => {}
) {
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
