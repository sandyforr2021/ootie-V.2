import { ProviderError } from '../errors.js';

// Keep only documented diagnostic codes; provider messages can contain input text.
const REASON_BY_CODE = new Map([
  ['58061214', 'AGE_RESTRICTED'], ['17301594', 'AGE_RESTRICTED'],
  ['29310472', 'PUBLIC_FIGURE_RESTRICTED'], ['15236754', 'PUBLIC_FIGURE_RESTRICTED'],
  ['64151117', 'PERSON_RESTRICTED'], ['39322892', 'PERSON_RESTRICTED'],
  ...['62263041', '57734940', '22137204', '74803281', '29578790', '42876398',
    '92201652', '89371032', '49114662', '72817394', '90789179', '63429089',
    '43188360', '35561574', '35561575', '78610348', '61493863', '56562880',
    '32635315'].map((code) => [code, 'CONTENT_FILTERED'])
]);

export function googleSafetyRejection(message = '') {
  const supportCodes = [...new Set(String(message).match(/\b\d{8}\b/g) || [])]
    .filter((code) => REASON_BY_CODE.has(code));
  const reasons = [...new Set(supportCodes.map((code) => REASON_BY_CODE.get(code)))];
  const safetyReason = reasons.length === 1 ? reasons[0] : 'UNSPECIFIED';
  return new ProviderError('SAFETY_REJECTION', 'Google safety filters rejected this request', {
    safetyReason, supportCodes
  });
}

export function isGoogleSafetyRejection(message = '') {
  const text = String(message).toLowerCase();
  if (/(invalid|unsupported|unknown).*safety.*setting|safety.*setting.*(invalid|unsupported|unknown)/.test(text)) return false;
  return /responsible ai|safety|(?:filtered|blocked|rejected).*content/.test(text)
    || (text.match(/\b\d{8}\b/g) || []).some((code) => REASON_BY_CODE.has(code));
}
