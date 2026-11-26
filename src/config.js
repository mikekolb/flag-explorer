import { COUNTRIES } from './data/countries.js';

// TEST BUILD: one continent and 10 flags, to check controls and speed on the iPad.
// Set TEST_BUILD to false to turn on all 195 flags and all six continents.
export const TEST_BUILD = true;
const TEST_CODES = ['IT', 'VA', 'SM', 'MC', 'FR', 'CH', 'LI', 'AT', 'ES', 'AD'];
const TEST_CONTINENTS = ['europe'];

export const ACTIVE_COUNTRIES = TEST_BUILD
  ? COUNTRIES.filter((c) => TEST_CODES.includes(c.code))
  : COUNTRIES;

export function isContinentOpen(id) {
  return !TEST_BUILD || TEST_CONTINENTS.includes(id);
}

export function countriesIn(continentId) {
  return ACTIVE_COUNTRIES.filter((c) => c.continent === continentId);
}

export const FLAG_URL = (code) => `${import.meta.env.BASE_URL}flags/${code.toLowerCase()}.svg`;
