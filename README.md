# Flag Explorer

A 3D world game for iPad Safari: walk around each continent and find the hidden flags of all 195 countries.

- `npm run dev` — play locally (WASD to walk, drag to look, Space to jump)
- `npm run build` — build into `dist/`
- Pushing to `main` publishes to GitHub Pages.

**Test build vs full game:** set `TEST_BUILD` in `src/config.js` (`true` = Europe with 10 flags, `false` = all 195).

**Fun facts:** add them in `src/data/facts.js`, keyed by country code.

Flag images: [flag-icons](https://github.com/lipis/flag-icons) (MIT). Map data: [world-atlas](https://github.com/topojson/world-atlas) / Natural Earth (public domain).
