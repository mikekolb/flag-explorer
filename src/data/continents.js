// The real continents. The game world is made-up islands (see islands.js), but each
// country still belongs to its real continent: My Flags groups flags by continent,
// the flag popup says where the country really is, and finishing a continent celebrates.
export const CONTINENTS = [
  { id: 'northAmerica', name: 'North America' },
  { id: 'southAmerica', name: 'South America' },
  { id: 'europe', name: 'Europe' },
  { id: 'africa', name: 'Africa' },
  { id: 'asia', name: 'Asia' },
  { id: 'oceania', name: 'Oceania' },
];
export const CONTINENT_BY_ID = Object.fromEntries(CONTINENTS.map((c) => [c.id, c]));
