import collection from '@/data/styleCrewCollection.json';

// A content label only; never used for authorization or ownership.
export const isStyleCrew = (profile) => collection.some(person =>
  [person.username, person.name.toLowerCase()].includes(String(profile?.username || '').replace(/^@/, ''))
);
