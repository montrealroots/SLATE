import type { IdentitySlice, Person } from '../../src/person/identity/identity.ts';

/** A made person for tests of the engines that read one: an American actress born in Los Angeles in 2000. */
export function person(over: Partial<Person> = {}): Person {
  return {
    legal: { first: 'Ada', middle: '', last: 'Reyes' },
    preferred: 'Ada Reyes',
    pronouns: 'she',
    billedAs: 'actress',
    born: { date: '2000-06-14', country: 'US', region: 'US.CA' },
    citizenship: ['US'],
    languages: [{ lang: 'en', level: 'C2' }],
    ethnicity: [],
    grewUp: { country: 'US', region: 'US.CA' },
    family: 'outside',
    headshot: 0,
    ...over,
  };
}

/** The identity slice of a life whose person is made. */
export const identity = (over: Partial<Person> = {}): IdentitySlice => ({ person: person(over), sessions: [] });
