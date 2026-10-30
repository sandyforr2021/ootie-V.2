const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const SAFE_TARGETS = [
  new RegExp(`^/ootd/${UUID}(?:\\?comment=1)?$`, 'i'),
  new RegExp(`^/sos\\?sos=${UUID}$`, 'i'),
  /^\/profile(?:\?user=%?40?[a-z0-9_-]+)?$/i,
  /^\/(membership|tryon|bookmarks)$/
];

export const resolveNotificationTarget = (notification = {}) => {
  const path = String(notification.target_path || '').trim();
  if (path && SAFE_TARGETS.some((pattern) => pattern.test(path))) return path;

  const entityId = String(notification.entity_id || '');
  if (notification.event_type === 'OOTD_LIKE' && new RegExp(`^${UUID}$`, 'i').test(entityId)) return `/ootd/${entityId}`;
  if (notification.event_type === 'SOS_SUGGESTION' && new RegExp(`^${UUID}$`, 'i').test(entityId)) return `/sos?sos=${entityId}`;
  if (notification.event_type === 'FOLLOW' && notification.actor?.username) return `/profile?user=${encodeURIComponent(notification.actor.username)}`;
  if (notification.event_type === 'POINTS' || notification.event_type === 'SUBSCRIPTION') return '/membership';
  if (notification.event_type === 'AI_RESULT') return '/tryon';
  return null;
};
