export const ASYNC_STATUS = Object.freeze({
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  EMPTY: 'empty',
  ERROR: 'error',
  DENIED: 'denied',
  SYNCING: 'syncing'
});

export const SYNC_STATUS = Object.freeze({
  SYNCED: 'SYNCED',
  LOCAL_ONLY: 'LOCAL_ONLY',
  REMOTE_FAILED: 'REMOTE_FAILED',
  UNSYNCED: 'UNSYNCED'
});

export function createAsyncState(overrides = {}) {
  return {
    status: ASYNC_STATUS.IDLE,
    data: null,
    error: null,
    syncStatus: null,
    ...overrides
  };
}

export function loadingState(previous = {}) {
  return createAsyncState({ ...previous, status: ASYNC_STATUS.LOADING, error: null });
}

export function successState(data, options = {}) {
  const empty = options.empty ?? (Array.isArray(data) && data.length === 0);
  return createAsyncState({
    status: empty ? ASYNC_STATUS.EMPTY : ASYNC_STATUS.SUCCESS,
    data,
    syncStatus: options.syncStatus || SYNC_STATUS.SYNCED
  });
}

export function syncingState(data) {
  return createAsyncState({ status: ASYNC_STATUS.SYNCING, data, syncStatus: SYNC_STATUS.UNSYNCED });
}

export function localOnlyState(data) {
  return createAsyncState({ status: ASYNC_STATUS.SUCCESS, data, syncStatus: SYNC_STATUS.LOCAL_ONLY });
}

export function failedState(error, options = {}) {
  return createAsyncState({
    status: options.denied ? ASYNC_STATUS.DENIED : ASYNC_STATUS.ERROR,
    data: options.data ?? null,
    error,
    syncStatus: options.remote ? SYNC_STATUS.REMOTE_FAILED : (options.syncStatus || null)
  });
}

export function isAuthoritativeSuccess(state) {
  return (
    [ASYNC_STATUS.SUCCESS, ASYNC_STATUS.EMPTY].includes(state?.status) &&
    state?.syncStatus === SYNC_STATUS.SYNCED
  );
}

export function canUseSuccessToast(state) {
  return isAuthoritativeSuccess(state);
}
