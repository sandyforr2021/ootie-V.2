const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isTryOnItemId = (value) => UUID_PATTERN.test(String(value || ''));

export const getOwnedTryOnItemIds = (items, profileId) => {
  const ownerId = String(profileId || '');
  if (!isTryOnItemId(ownerId)) return [];

  return (Array.isArray(items) ? items : [])
    .filter((item) => isTryOnItemId(item?.id) && String(item?.owner_id || '') === ownerId)
    .map((item) => String(item.id));
};

export const reconcileTryOnSelection = ({
  currentIds = [],
  requestedIds = [],
  items = [],
  profileId = '',
  mode = 'single'
} = {}) => {
  const availableIds = getOwnedTryOnItemIds(items, profileId);
  const available = new Set(availableIds);
  const limit = mode === 'single' ? 1 : 5;
  const uniqueAvailable = (values) => [...new Set(
    (Array.isArray(values) ? values : [])
      .map(String)
      .filter((id) => available.has(id))
  )].slice(0, limit);

  const retained = uniqueAvailable(currentIds);
  if (retained.length) return retained;

  const requested = uniqueAvailable(requestedIds);
  if (requested.length) return requested;

  return availableIds.slice(0, 1);
};

