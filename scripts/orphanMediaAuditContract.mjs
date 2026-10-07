export function classifyOrphanMedia({ objects, existingItemKeys, referencedPaths, thresholdHours, now = Date.now() }) {
  const items = existingItemKeys instanceof Set ? existingItemKeys : new Set(existingItemKeys || []);
  const references = referencedPaths instanceof Set ? referencedPaths : new Set(referencedPaths || []);
  return (objects || []).map((object) => {
    const itemExists = items.has(`${object.userId}/${object.itemId}`);
    const isCurrent = references.has(object.path);
    const isOriginal = /\/original\./i.test(object.path);
    const ageHours = object.createdAt ? (now - new Date(object.createdAt).getTime()) / 3600000 : 0;
    const retainedOriginal = itemExists && isOriginal;
    const candidate = !isCurrent && !retainedOriginal && ageHours >= thresholdHours;
    return { ...object, itemExists, isCurrent, retainedOriginal, ageHours: Math.round(ageHours), candidate };
  });
}

