export class GatewayError extends Error {
  constructor(code, status = 500, message = code, details = undefined) {
    super(message);
    this.name = 'GatewayError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class ProviderError extends GatewayError {
  constructor(code, message = code, details = undefined) {
    const statusByCode = {
      SAFETY_REJECTION: 422,
      PROVIDER_QUOTA: 503,
      PROVIDER_UNAVAILABLE: 503,
      INVALID_PROVIDER_OUTPUT: 502
    };
    super(code, statusByCode[code] || 502, message, details);
    this.name = 'ProviderError';
  }
}

export const assert = (condition, code, status = 400, message = code) => {
  if (!condition) throw new GatewayError(code, status, message);
};

export const toErrorResponse = (error) => {
  const normalized = error instanceof GatewayError
    ? error
    : new GatewayError('INTERNAL_ERROR', 500, 'Unexpected gateway error');

  return {
    status: normalized.status,
    body: {
      error: {
        code: normalized.code,
        message: normalized.message,
        ...(normalized.details ? { details: normalized.details } : {})
      }
    }
  };
};
