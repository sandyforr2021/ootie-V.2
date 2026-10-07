import { describe, expect, it } from 'vitest';
import {
  SERVICE_ERROR_CODE,
  ServiceError,
  getServiceErrorMessage,
  normalizeServiceError,
  serviceFailure
} from '../serviceError';

describe('service error contract', () => {
  it('maps permission, duplicate, and network failures to stable codes', () => {
    expect(normalizeServiceError({ status: 403 }).code).toBe(SERVICE_ERROR_CODE.PERMISSION_DENIED);
    expect(normalizeServiceError({ code: '23505' }).code).toBe(SERVICE_ERROR_CODE.DUPLICATE);
    expect(normalizeServiceError(new TypeError('Failed to fetch')).code).toBe(SERVICE_ERROR_CODE.NETWORK_ERROR);
  });

  it('maps PostgreSQL data exceptions such as a future birth date to validation', () => {
    expect(normalizeServiceError({ code: '22007' }).code).toBe(SERVICE_ERROR_CODE.VALIDATION_ERROR);
  });

  it('does not expose raw remote messages to the UI helper', () => {
    const raw = { status: 403, message: 'sensitive policy details' };
    expect(getServiceErrorMessage(raw)).toBe('你沒有執行這項操作的權限。');
  });

  it('preserves an existing ServiceError', () => {
    const original = new ServiceError(SERVICE_ERROR_CODE.PROFILE_MISSING);
    expect(serviceFailure(original).error).toBe(original);
  });
});
