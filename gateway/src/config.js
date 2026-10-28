import { GatewayError } from './errors.js';

const required = (env, key) => {
  const value = String(env[key] || '').trim();
  if (!value) throw new GatewayError('CONFIG_ERROR', 500, `Missing ${key}`);
  return value;
};

const positiveInteger = (value, fallback) => {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new GatewayError('CONFIG_ERROR', 500, 'AI_MAX_IMAGES_PER_USER_PER_DAY must be a positive integer');
  }
  return parsed;
};

const optionalMoney = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new GatewayError('CONFIG_ERROR', 500, 'Estimated cost values must be non-negative numbers');
  }
  return parsed;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const uuidAllowlist = (value, settingName = 'AI_QUOTA_EXEMPT_USER_IDS') => {
  const ids = String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (ids.some((id) => !UUID_PATTERN.test(id))) {
    throw new GatewayError('CONFIG_ERROR', 500, `${settingName} must contain only UUIDs`);
  }
  return Object.freeze([...new Set(ids)]);
};

export function loadConfig(env = process.env) {
  const supabaseUrl = required(env, 'SUPABASE_URL').replace(/\/$/, '');
  const projectRef = env.OOTIE_SUPABASE_PROJECT_REF || 'hoxkrmadzjnyjaqjbyxc';
  const target = new URL(supabaseUrl);
  if (target.protocol !== 'https:' || target.hostname !== `${projectRef}.supabase.co` || target.username || target.password || target.port) {
    throw new GatewayError('OOTIE_PROJECT_MISMATCH', 500, 'Refused a database outside the configured OOTIE project.');
  }
  const competitionMode = String(env.OOTIE_COMPETITION_MODE || 'true') !== 'false';
  const googleSetting = (key) => competitionMode ? '' : required(env, key);
  const imageOutputSize = String(env.AI_IMAGE_OUTPUT_SIZE || '1K').toUpperCase();
  if (imageOutputSize !== '1K') {
    throw new GatewayError('CONFIG_ERROR', 500, 'Development image output must remain 1K');
  }

  return Object.freeze({
    port: Number(env.PORT || 8080),
    competitionMode,
    youcam: {
      apiKey: String(env.YOUCAM_API_KEY || '').trim(),
      freeCreditExpiry: Number(env.YOUCAM_FREE_CREDIT_EXPIRY_MS || 0),
      enabled: env.YOUCAM_ENABLED === 'true',
      workerEnabled: env.YOUCAM_WORKER_ENABLED === 'true',
      reviewerUserIds: uuidAllowlist(env.YOUCAM_REVIEWER_USER_IDS, 'YOUCAM_REVIEWER_USER_IDS')
    },
    google: {
      projectId: googleSetting('GOOGLE_CLOUD_PROJECT'),
      stylingLocation: googleSetting('GOOGLE_CLOUD_LOCATION_STYLING'),
      vtoLocation: googleSetting('GOOGLE_CLOUD_LOCATION_VTO'),
      imageLocation: googleSetting('GOOGLE_CLOUD_LOCATION_IMAGE'),
      stylingModel: googleSetting('GOOGLE_STYLING_MODEL'),
      vtoModel: googleSetting('GOOGLE_VTO_MODEL'),
      imageModel: googleSetting('GOOGLE_IMAGE_MODEL'),
      imageOutputSize
    },
    supabase: {
      url: supabaseUrl,
      publishableKey: required(env, 'SUPABASE_PUBLISHABLE_KEY'),
      serviceRoleKey: String(env.SUPABASE_SECRET_KEY || '').trim() || required(env, 'SUPABASE_SERVICE_ROLE_KEY'),
      aiBucket: String(env.SUPABASE_AI_BUCKET || 'ootie-ai-private')
    },
    cost: {
      imageGenerationEnabled: String(env.AI_IMAGE_GENERATION_ENABLED || 'false').toLowerCase() === 'true',
      maxImagesPerUserPerDay: positiveInteger(env.AI_MAX_IMAGES_PER_USER_PER_DAY, 3),
      quotaExemptUserIds: uuidAllowlist(env.AI_QUOTA_EXEMPT_USER_IDS),
      quotaTimezone: String(env.AI_QUOTA_TIMEZONE || 'UTC'),
      estimatedVtoUsd: optionalMoney(env.AI_ESTIMATED_COST_VTO_USD),
      estimatedPreviewUsd: optionalMoney(env.AI_ESTIMATED_COST_OUTFIT_PREVIEW_USD),
      vtoPoints: positiveInteger(env.VTO_POINTS_COST, 8),
      previewPoints: positiveInteger(env.OUTFIT_PREVIEW_POINTS_COST, 12)
    },
    corsAllowedOrigins: [env.CORS_ALLOWED_ORIGINS || '', env.RENDER_EXTERNAL_URL && /^https:\/\/[a-z0-9-]+\.onrender\.com$/.test(env.RENDER_EXTERNAL_URL) ? env.RENDER_EXTERNAL_URL : ''].join(',')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
  });
}
