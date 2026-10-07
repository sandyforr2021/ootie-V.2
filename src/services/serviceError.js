export const SERVICE_ERROR_CODE = Object.freeze({
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  PROFILE_MISSING: 'PROFILE_MISSING',
  PROFILE_NOT_READY: 'PROFILE_NOT_READY',
  NOT_FOUND: 'NOT_FOUND',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  DUPLICATE: 'DUPLICATE',
  NETWORK_ERROR: 'NETWORK_ERROR',
  REMOTE_WRITE_FAILED: 'REMOTE_WRITE_FAILED',
  CLEARANCE_UNAVAILABLE: 'CLEARANCE_UNAVAILABLE',
  DISPLAY_NAME_COOLDOWN: 'DISPLAY_NAME_COOLDOWN',
  PROVIDER_NOT_CONFIGURED: 'PROVIDER_NOT_CONFIGURED',
  AVATAR_INVALID: 'AVATAR_INVALID',
  AVATAR_TOO_LARGE: 'AVATAR_TOO_LARGE',
  GUEST_CLOSET_LIMIT: 'GUEST_CLOSET_LIMIT',
  AI_GUEST_LIMIT: 'AI_GUEST_LIMIT',
  SAVED_OUTFITS_NOT_READY: 'SAVED_OUTFITS_NOT_READY',
  LOCAL_PERSISTENCE_FAILED: 'LOCAL_PERSISTENCE_FAILED',
  UNKNOWN: 'UNKNOWN'
});

const USER_MESSAGES = Object.freeze({
  AUTH_REQUIRED: '請先登入後再繼續。',
  PROFILE_MISSING: '帳號已登入，但尚未建立 OOTIE 個人檔案。',
  PROFILE_NOT_READY: '個人檔案尚未準備完成，暫時無法執行此操作。',
  NOT_FOUND: '找不到指定資料。',
  PERMISSION_DENIED: '你沒有執行這項操作的權限。',
  VALIDATION_ERROR: '資料格式不正確，請檢查後再試。',
  DUPLICATE: '這筆資料已存在。',
  NETWORK_ERROR: '網路連線失敗，請稍後再試。',
  REMOTE_WRITE_FAILED: '資料尚未同步到伺服器。',
  CLEARANCE_UNAVAILABLE: '遠端衣櫥尚未提供正式的出清狀態欄位。',
  DISPLAY_NAME_COOLDOWN: '暱稱每 30 天可以修改一次。',
  PROVIDER_NOT_CONFIGURED: '此登入方式目前尚未啟用。',
  AVATAR_INVALID: '大頭貼只接受 JPEG、PNG 或 WebP 圖片。',
  AVATAR_TOO_LARGE: '大頭貼檔案不可超過 5 MB。',
  GUEST_CLOSET_LIMIT: '登入會員後即可繼續新增衣物。',
  AI_GUEST_LIMIT: '登入會員後即可繼續使用 OOTIE AI。',
  SAVED_OUTFITS_NOT_READY: '收藏穿搭功能正在升級，請稍後再試。',
  LOCAL_PERSISTENCE_FAILED: '這件衣物尚未儲存，請清理裝置空間後再試。',
  UNKNOWN: '發生未預期的錯誤，請稍後再試。'
});

export class ServiceError extends Error {
  constructor(code, options = {}) {
    const safeCode = Object.values(SERVICE_ERROR_CODE).includes(code) ? code : SERVICE_ERROR_CODE.UNKNOWN;
    super(options.message || USER_MESSAGES[safeCode]);
    this.name = 'ServiceError';
    this.code = safeCode;
    this.userMessage = options.userMessage || USER_MESSAGES[safeCode];
    this.retryable = options.retryable ?? [
      SERVICE_ERROR_CODE.NETWORK_ERROR,
      SERVICE_ERROR_CODE.REMOTE_WRITE_FAILED,
      SERVICE_ERROR_CODE.UNKNOWN
    ].includes(safeCode);
    this.details = options.details || null;
    this.cause = options.cause;
  }
}

export function normalizeServiceError(error, fallbackCode = SERVICE_ERROR_CODE.UNKNOWN) {
  if (error instanceof ServiceError) return error;

  const status = Number(error?.status || error?.statusCode || 0);
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();

  let mappedCode = Object.values(SERVICE_ERROR_CODE).includes(code) ? code : fallbackCode;
  if (status === 401 || code === '401' || message.includes('jwt')) mappedCode = SERVICE_ERROR_CODE.AUTH_REQUIRED;
  else if (message.includes('display_name_cooldown') || message.includes('display name cooldown')) mappedCode = SERVICE_ERROR_CODE.DISPLAY_NAME_COOLDOWN;
  else if (status === 403 || code === '42501' || message.includes('permission denied')) mappedCode = SERVICE_ERROR_CODE.PERMISSION_DENIED;
  else if (status === 404 || code === 'PGRST116') mappedCode = SERVICE_ERROR_CODE.NOT_FOUND;
  else if (code === '23505' || status === 409 || message.includes('duplicate')) mappedCode = SERVICE_ERROR_CODE.DUPLICATE;
  else if (status === 400 || code.startsWith('22')) mappedCode = SERVICE_ERROR_CODE.VALIDATION_ERROR;
  else if (error instanceof TypeError || message.includes('fetch') || message.includes('network')) mappedCode = SERVICE_ERROR_CODE.NETWORK_ERROR;

  return new ServiceError(mappedCode, { cause: error });
}

export function serviceSuccess(data, metadata = {}) {
  return { ok: true, data, error: null, ...metadata };
}

export function serviceFailure(error, fallbackCode, metadata = {}) {
  return { ok: false, data: null, error: normalizeServiceError(error, fallbackCode), ...metadata };
}

export function getServiceErrorMessage(error) {
  return normalizeServiceError(error).userMessage;
}
