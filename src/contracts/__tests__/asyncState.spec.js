import { describe, expect, it } from 'vitest';
import {
  ASYNC_STATUS,
  SYNC_STATUS,
  canUseSuccessToast,
  failedState,
  localOnlyState,
  successState,
  syncingState
} from '../asyncState';

describe('truthful async state contract', () => {
  it('allows success messaging only for authoritative remote success', () => {
    expect(canUseSuccessToast(successState({ id: 'saved' }))).toBe(true);
    expect(canUseSuccessToast(localOnlyState({ id: 'local' }))).toBe(false);
    expect(canUseSuccessToast(syncingState({ id: 'pending' }))).toBe(false);
  });

  it('keeps remote failures out of the success state', () => {
    const state = failedState(new Error('offline'), { remote: true, data: { id: 'local-copy' } });
    expect(state.status).toBe(ASYNC_STATUS.ERROR);
    expect(state.syncStatus).toBe(SYNC_STATUS.REMOTE_FAILED);
    expect(canUseSuccessToast(state)).toBe(false);
  });

  it('uses empty for successful empty collections', () => {
    expect(successState([]).status).toBe(ASYNC_STATUS.EMPTY);
  });
});
