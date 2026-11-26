import { COUNTRIES } from './data/countries.js';

// TEST BUILD: one island and 10 flags, to check controls and speed on the iPad.
// Set TEST_BUILD to false to turn on all 195 flags and all six islands.
export const TEST_BUILD = false;
const TEST_CODES = ['IT', 'VA', 'SM', 'MC', 'FR', 'CH', 'LI', 'AT', 'ES', 'AD'];

export const ACTIVE_COUNTRIES = TEST_BUILD
  ? COUNTRIES.filter((c) => TEST_CODES.includes(c.code))
  : COUNTRIES;

// countries from one real continent (used for My Flags and continent celebrations)
export function countriesIn(continentId) {
  return ACTIVE_COUNTRIES.filter((c) => c.continent === continentId);
}

export const FLAG_URL = (code) => `${import.meta.env.BASE_URL}flags/${code.toLowerCase()}.svg`;
