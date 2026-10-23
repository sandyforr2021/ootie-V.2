import collection from '@/data/styleCrewCollection.json';
export const visiblePostTags = tags => (tags || []).filter(tag => !/^#?OOTIEStyleCrew$/i.test(String(tag)));

// A content label only; never used for authorization or ownership.
export const isStyleCrew = (profile) => collection.some(person =>
  [person.username, person.name.toLowerCase()].includes(String(profile?.username || '').replace(/^@/, ''))
);
