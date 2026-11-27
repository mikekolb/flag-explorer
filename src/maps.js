// The two kinds of map, chosen in Settings (save.settings.map):
//   'islands' = six random made-up islands, flags scattered at random (islands.js)
//   'earth'   = the six real continents, flags near their real spots (earth.js)
// The rest of the game only talks to this file, and calls each walkable world a "region".
import { ISLANDS, initIslands, islandOf, codesOn, planIsland } from './islands.js';
import { CONTINENT_REGIONS, planContinent } from './earth.js';
import { BY_CODE } from './data/countries.js';
import { countriesIn } from './config.js';

export let MODE = 'islands';

export function initMap(mode, seed, codes) {
  MODE = mode === 'earth' ? 'earth' : 'islands';
  initIslands(seed, codes);
}

export const isEarth = () => MODE === 'earth';
export const regions = () => (isEarth() ? CONTINENT_REGIONS : ISLANDS);
export const regionById = (id) => regions().find((r) => r.id === id);
export const regionOf = (code) => (isEarth() ? BY_CODE[code].continent : islandOf(code));
export const codesIn = (id) => (isEarth() ? countriesIn(id).map((c) => c.code) : codesOn(id));
export const planRegion = (id) => (isEarth() ? planContinent(id) : Promise.resolve(planIsland(id)));
// "is in Europe" but "is on Sunny Island"
export const inOn = () => (isEarth() ? 'in' : 'on');
