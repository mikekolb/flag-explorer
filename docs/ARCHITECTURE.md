# How Flag Explorer works

Plain HTML, CSS and JavaScript (ES modules), built with Vite. The only runtime libraries are `three` (3D) and `topojson-client` (reading map data). `flag-icons` provides the flag images and `world-atlas` the real map shapes. There is no backend and no framework.

## Big picture

```
index.html ── loads ──> src/main.js
                          │
          ┌───────────────┼────────────────────┬───────────────┐
          ▼               ▼                    ▼               ▼
     world.js         player.js           controls.js        ui.js
   (one region in 3D) (the kid model)     (touch/keys)   (all screens/popups)
          │                                                    │
          ▼                                                    ▼
       maps.js  (which map is on)                    save.js, speech.js, flags.js
       ┌──┴──────────────┐
       ▼                 ▼
   islands.js         earth.js ──> geo.js <── world-atlas map data
 (made-up islands)   (real continents)
```

- A **region** is one walkable world: an island on the islands map, or a continent on the real world map.
- **Only one region is in memory at a time.** Flying to another one throws away the old world (`world.dispose()`) and builds the new one (`buildWorld()` in `world.js`). A build takes a fraction of a second.
- **`main.js` owns the game loop** (`frame()`): read input → move the player → resolve collisions → stick to the ground → check for flags → update the camera → render → update the hint arrow and minimap → save the position every 3 seconds.
- **`ui.js` never touches 3D objects.** It talks to the game through the small `game` object that `main.js` passes to `initUI()` (`save`, `player`, `world`, `travel()`, `setHint()`, `setSetting()`, `newWorld()`, `resetAll()`, `onModalChange()`).
- While any popup is open, the game is paused and controls are turned off (`onModalChange`).

## Two maps (`maps.js`)

Settings → "Which map?" sets `save.settings.map`: `'islands'` (default) or `'earth'`. Changing it reloads the page. `initMap()` runs once at start, and the rest of the game only asks `maps.js`: `regions()`, `regionById(id)`, `regionOf(code)`, `codesIn(id)`, `planRegion(id)`, and `inOn()` ("is **on** Sunny Island" but "is **in** Europe").

Both maps make the same kind of **plan** for a region: `{ region, W, H, land, soft, flags: [{code, x, z}], center, paint(px) }`. `world.js` builds the 3D world from any plan. Found flags are keyed by country code, so they count on both maps.

## The made-up islands (`islands.js`)

- World units are called **steps**. 1 step ≈ 1 metre for the character (the kid is about 2.5 steps tall).
- There are six islands (`ISLANDS`: Sunny, Berry, Leafy, Rocky, Candy, Snowy), each with a name, a label colour and a set of pastel meadow colours. Each island is a square world of `SIZE` (560) steps with the middle at `(0, 0)`. `x` is east and `z` is south.
- **`save.seed`** decides everything random. A new save gets a random seed (`newSeed()` in `save.js`). The same seed always gives the same world.
- `initIslands(seed, codes)` shuffles all country codes with the seed and deals them out to the islands in turn (about 33 each). So neighbouring countries end up far apart, on purpose.
- `planIsland(id)` makes everything about one island except the 3D meshes, and caches it:
  - **Shape:** a blob with wobbly noise edges, turned at a random angle, plus 3 to 6 small islands around it. It never touches the edge of the square.
  - **Land mask** (2 steps per cell, 1 = land) and a blurred copy (`soft`) for smooth coasts.
  - **Flag spots:** random spots well inside the land, at least `MIN_GAP` (22) steps from every other flag.
  - **Center:** the middle of the main land, for the first spawn.
- `paintIsland(plan, px)` paints the island map at `px` pixels per step: deep and shallow water, sand, and meadows in pastel patches (a jittered-grid Voronoi with wiggly white lines between patches, so it looks like a colourful map). It's the **texture on the terrain**, and is also reused for the minimap, the big map, and (at small size) the All islands map.
- `baseHeight(soft, x, z)`: ground height before hills, used by both the terrain and the painting so the beaches line up.

## The real world (`earth.js` and `geo.js`)

- Each continent covers a lat/lon box (`src/data/continents.js`). `makeProjection()` in `geo.js` turns lat/lon into world `x`/`z` with a simple equirectangular projection, scaled so the longest side is `size` steps.
- Oceania crosses the date line (lon 110 → 192). Negative longitudes are shifted by +360 there (`proj.norm`), and map rings that cross the date line are "unwrapped" while drawing.
- `world-atlas/countries-50m.json` (Natural Earth) is loaded once with a dynamic import. `drawMask()` draws the land mask, `drawGround()` the colourful political map (the terrain texture), and `drawWorld()` the world map for fast travel.
- `planContinent(id)` starts each flag at its country's real lat/lon, then pushes flags apart until every pair is at least 15 steps apart, so tiny countries (Vatican City, Monaco…) each get room. A flag that ends up in the sea moves to nearby land, or gets a small round island.

On both maps the real continents are also used for learning: the flag popup says "A country in Africa", My Flags groups flags by continent, and finding every country from a continent celebrates.

## Building a region (`world.js` → `buildWorld(plan, found)`)

1. **Choose a hiding spot** per flag, from a random number seeded by the country code: about 34% open ground, 26% behind a house, 20% on a hill, 20% in a cave.
2. **Ground height** (`heightAt(x, z)`): `baseHeight` (sea floor ≈ −0.8, under a see-through water plane at 0; gentle noise makes rolling hills) plus Gaussian "bumps" for the flag hills and some extra hills. Low flags get a small mound so they're never under water. **The character and the terrain mesh both use `heightAt`**, so walking matches what you see.
3. **Meshes:** one terrain plane (about 3 steps per square, flat-shaded, map texture), sea plane and sea floor, then instanced meshes for houses, roofs, trees and cave rocks. These are few draw calls, which matters on iPad. Each cave has its own dome mesh, which fades out when the player is inside so the camera can see in.
4. **Collisions:** circles (trees, rocks, flag poles) and boxes (houses) stored in a grid of 8-step cells. `resolve(x, z, radius)` pushes the player out of them. There's no collision with the dome itself; the ring of rocks forms the cave wall, with a gap for the mouth.
5. **Flags:** pole (instanced, turns gold when found), a cloth plane with the flag texture (waves when near the player), and a spinning gold star once found. A hint "beacon" (a tall glowing cylinder) is placed on the hinted flag.
6. **Spawn point:** land near the middle of the region, not on top of a flag. The game also remembers the last position on each island and continent.

Everything uses seeded randomness (`noise.js` → `rng(seed)`), so each region looks the same every visit, as long as the seed and the code don't change.

## Fast travel and the maps

- **Map → This island / This continent:** the painted map, found flags, the hint star and the player arrow.
- **Map → World (real world map):** the world map coloured by continent, with found flags at their real spots. Tap a continent to fly there.
- **Map → All islands (islands map):** the six islands in a grid (3 × 2), each with its found flags and a label ("12 of 33 found"). Tap an island or its label to fly there (`travel(id)` in `main.js`).
- **New random world** (Settings, islands map only): `newWorld()` in `main.js` picks a new seed, clears the saved positions and reloads. Found flags stay found; the flags not found yet get new spots.

## Flags (images)

- `scripts/copy-flags.mjs` runs before `dev` and `build`. It copies the 195 needed SVGs from `node_modules/flag-icons/flags/4x3/` into `public/flags/` and **adds `width`/`height`**. Without these, iPad Safari won't draw the SVGs onto a canvas. `public/flags/` is git-ignored because it's generated.
- `flags.js` loads each SVG into a 256×192 canvas. The canvas is used as the 3D texture and for map icons. DOM popups use the SVG URL directly.

## Controls (`controls.js`)

- Touch events on a full-screen `#touch-layer` under the HUD. The first touch on the left 45% of the screen becomes the joystick (it appears where you touch). Another touch drags the camera. The jump button has its own handler.
- `touchstart`/`touchmove` call `preventDefault()` to stop iPad scrolling and zooming. CSS `touch-action: none` and the `gesturestart` handler block pinch zoom.
- `read()` returns movement relative to the camera, plus how far you dragged to look, plus whether jump was pressed. Movement is turned into world directions in `main.js`.

## Saving (`save.js`)

- One JSON object in `localStorage['flag-explorer-save-v1']`: `found` (code → time found), `seed` (which random world), `last` (last region), `pos` (last position per island and per continent), `celebrated` (which celebrations were shown: continents and `all` store the flag count at the time so a bigger total celebrates again; islands are stored as `island-<seed>-<id>` so a new world can celebrate again), `settings` (`voice`, `fast`, `map`).
- `loadSave()` fills in missing fields, so older saves keep working. Saves from the old real-map version have no seed: they get one, and their old continent positions are dropped (`main.js`). Found flags are kept.
- **Reset gotcha:** reset reloads the page, and the page saves while it closes (`visibilitychange`). To stop that from writing the old flags back, `resetAll()` first empties the save object in memory, then `resetSave()` sets a lock that blocks any more writes until the reload. `newWorld()` uses the same lock (`lockSave()`) so the old position is not saved onto the new world.

## Speech (`speech.js`)

- Uses the browser's `speechSynthesis` with an English voice. iPad Safari only allows speech after a tap, so the **Play** button speaks a silent utterance first to unlock it.
- Each country's `say` value lets you spell out tricky names (for example Kiribati → "Kiri-bass").

## Performance choices (for iPad)

- Pixel ratio capped at 1.5 (1 in Fast mode). Antialiasing is off in Fast mode. There are no real-time shadows (just a round blob under the kid), plus fog and a short camera range.
- Lambert materials, flat shading, instancing. Only the current region is loaded.
- Changing Fast mode reloads the page, because antialiasing can only be set when the renderer is created.

## Version stamp

`vite.config.js` defines `__BUILD_TIME__` at build time, and Settings shows it. Use it to check whether a device has the latest version (GitHub Pages lets devices keep a copy for about 10 minutes).

## Testing helpers

There are no automated tests. In dev mode only (`npm run dev`), `window.__game` gives access to the game object from the browser console. For example:

```js
const g = window.__game;
await g.travel('asia');                                   // fly somewhere
const f = g.world.flags[0]; g.player.x = f.x + 1.5; g.player.z = f.z; // stand next to a flag
```

This is not included in the published build.
