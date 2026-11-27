// The six real continents. In "Real world" map mode each one is its own walkable world:
// lon/lat = the slice of the real map it covers, size = steps across its longest side.
// In both modes they group My Flags and give the "every country from Europe" celebration.
export const CONTINENTS = [
  { id: 'northAmerica', name: 'North America', lon: [-170, -52], lat: [6, 72], size: 660, color: '#5fcf7f', label: [45, -100] },
  { id: 'southAmerica', name: 'South America', lon: [-84, -32], lat: [-56, 14], size: 520, color: '#ff8aa6', label: [-15, -60] },
  { id: 'europe', name: 'Europe', lon: [-25, 45], lat: [34, 71.5], size: 640, color: '#6cb2ff', label: [54, 15] },
  { id: 'africa', name: 'Africa', lon: [-26, 60], lat: [-36, 38], size: 680, color: '#f5cf4a', label: [5, 20] },
  { id: 'asia', name: 'Asia', lon: [25, 147], lat: [-11, 56], size: 720, color: '#ffa94d', label: [42, 95] },
  { id: 'oceania', name: 'Oceania', lon: [110, 192], lat: [-48, 12], size: 620, color: '#b993ff', label: [-25, 140] },
];
export const CONTINENT_BY_ID = Object.fromEntries(CONTINENTS.map((c) => [c.id, c]));
