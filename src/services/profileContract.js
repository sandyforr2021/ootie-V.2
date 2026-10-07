import { SERVICE_ERROR_CODE, ServiceError } from './serviceError';

export const DISPLAY_NAME_MAX_LENGTH = 30;
export const SLOGAN_MAX_LENGTH = 120;
export const PHONE_MAX_LENGTH = 64;
export const DISPLAY_NAME_COOLDOWN_DAYS = 30;
export const DEFAULT_PROFILE_SLOGAN = '用衣櫥記錄日常，也和衣友分享穿搭靈感。';

export const normalizeDisplayName = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');

export const normalizeUsername = (value) => {
  const trimmed = String(value ?? '').trim().toLowerCase();
  if (!trimmed) return '';
  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
};

export const getDisplayNameCooldown = (profile, now = Date.now()) => {
  const changedAt = profile?.display_name_changed_at ? new Date(profile.display_name_changed_at).getTime() : NaN;
  if (!Number.isFinite(changedAt)) return { locked: false, nextChangeAt: null, daysRemaining: 0 };
  const nextChangeAt = changedAt + DISPLAY_NAME_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  const remaining = Math.max(0, nextChangeAt - now);
  return {
    locked: remaining > 0,
    nextChangeAt: new Date(nextChangeAt).toISOString(),
    daysRemaining: remaining > 0 ? Math.ceil(remaining / (24 * 60 * 60 * 1000)) : 0
  };
};

export const validatePublicProfileInput = (input = {}, { currentProfile } = {}) => {
  const displayName = normalizeDisplayName(input.display_name);
  const username = normalizeUsername(input.username);
  const slogan = String(input.slogan ?? '').trim();
  if (!displayName || displayName.length > DISPLAY_NAME_MAX_LENGTH) {
    throw new ServiceError(SERVICE_ERROR_CODE.VALIDATION_ERROR, { userMessage: `顯示暱稱需為 1～${DISPLAY_NAME_MAX_LENGTH} 個字元。` });
  }
  if (!username) throw new ServiceError(SERVICE_ERROR_CODE.VALIDATION_ERROR, { userMessage: '請輸入帳號 ID。' });
  if (slogan.length > SLOGAN_MAX_LENGTH) {
    throw new ServiceError(SERVICE_ERROR_CODE.VALIDATION_ERROR, { userMessage: `個人 Slogan 不可超過 ${SLOGAN_MAX_LENGTH} 個字元。` });
  }
  if (currentProfile && normalizeDisplayName(currentProfile.display_name) !== displayName) {
    const cooldown = getDisplayNameCooldown(currentProfile);
    if (cooldown.locked) {
      throw new ServiceError(SERVICE_ERROR_CODE.DISPLAY_NAME_COOLDOWN, { details: cooldown });
    }
  }
  return { display_name: displayName, username, slogan: slogan || null };
};

export const validatePrivateProfileInput = (input = {}) => {
  const fullName = String(input.full_name ?? '').trim();
  const phone = String(input.phone ?? '').trim();
  const birthDate = input.birth_date ? String(input.birth_date) : null;
  if (fullName.length > 120 || phone.length > PHONE_MAX_LENGTH) {
    throw new ServiceError(SERVICE_ERROR_CODE.VALIDATION_ERROR, { userMessage: '私人帳號資料格式不正確。' });
  }
  if (birthDate && (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || new Date(`${birthDate}T00:00:00`) > new Date())) {
    throw new ServiceError(SERVICE_ERROR_CODE.VALIDATION_ERROR, { userMessage: '生日不可為未來日期。' });
  }
  return { full_name: fullName || null, birth_date: birthDate, phone: phone || null };
};
