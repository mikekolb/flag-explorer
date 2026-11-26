# How Flag Explorer works

Plain HTML, CSS and JavaScript (ES modules), built with Vite. The only runtime libraries are `three` (3D) and `topojson-client` (reading map data). `flag-icons` and `world-atlas` provide data files. There is no backend and no framework.

## Big picture

```
index.html ── loads ──> src/main.js
                          │
          ┌───────────────┼────────────────────┬───────────────┐
          ▼               ▼                    ▼               ▼
     world.js         player.js           controls.js        ui.js
   (one continent)   (the kid model)     (touch/keys)   (all screens/popups)
          │                                                    │
          ▼                                                    ▼
       geo.js  <── world-atlas map data              save.js, speech.js, flags.js
   (lat/lon → x/z,
    map drawings)
```

- **Only one continent is in memory at a time.** Flying to another continent throws away the old world (`world.dispose()`) and builds the new one (`buildWorld()` in `world.js`). A build takes a fraction of a second.
- **`main.js` owns the game loop** (`frame()`): read input → move the player → resolve collisions → stick to the ground → check for flags → update the camera → render → update the hint arrow and minimap → save the position every 3 seconds.
- **`ui.js` never touches 3D objects.** It talks to the game through the small `game` object that `main.js` passes to `initUI()` (`save`, `player`, `world`, `travel()`, `setHint()`, `setSetting()`, `resetAll()`, `onModalChange()`).
- While any popup is open, the game is paused and controls are turned off (`onModalChange`).

## Coordinates and the map

- World units are called **steps**. 1 step ≈ 1 metre for the character (the kid is about 2.5 steps tall).
- Each continent covers a lat/lon box (`src/data/continents.js`). `makeProjection()` in `geo.js` turns lat/lon into world `x` (east) and `z` (south) with a simple equirectangular projection, scaled so the longest side is `size` steps. The middle of the box is `(0, 0)`.
- Oceania crosses the date line (lon 110 → 192). Negative longitudes are shifted by +360 there (`proj.norm`). Map rings that cross the date line are "unwrapped" while drawing, so they don't smear across the map.
- `world-atlas/countries-50m.json` (Natural Earth) is loaded once with a dynamic import. From it:
  - `drawMask()` draws a black/white land mask (2 steps per pixel). It decides what is land.
  - `drawGround()` draws the colourful political map (pastel countries, white borders, beaches, shallow water). It becomes the **texture on the terrain**, and is also reused for the minimap and the big map.
  - `drawWorld()` draws the world map for fast travel. Each land shape is coloured by the continent of the nearest country in our list (Russia is forced to Europe and Greenland to North America, to match where their flags are).

## Building a continent (`world.js` → `buildWorld`)

1. **Place flags.** Start at each country's real lat/lon, then push flags apart until every pair is at least `MIN_GAP` (15) steps apart. This is how tiny countries (Vatican City, Monaco, San Marino…) each get their own space. A flag that ends up in the sea is moved to nearby land. If there is no land nearby, a small round island is drawn for it.
2. **Choose a hiding spot** per flag, from a random number seeded by the country code (so it's the same every time): about 34% open ground, 26% behind a house, 20% on a hill, 20% in a cave.
3. **Ground height** (`heightAt(x, z)`): a blurred land mask decides land vs sea (sea floor ≈ −0.8, under a see-through water plane at 0). Gentle noise makes rolling hills. Gaussian "bumps" add the flag hills and some extra hills. Low flags get a small mound so they're never under water. **The character and the terrain mesh both use `heightAt`**, so walking matches what you see.
4. **Meshes:** one terrain plane (about 3 steps per square, flat-shaded, map texture), sea plane and sea floor, then instanced meshes for houses, roofs, trees and cave rocks. These are few draw calls, which matters on iPad. Each cave has its own dome mesh, which fades out when the player is inside so the camera can see in.
5. **Collisions:** circles (trees, rocks, flag poles) and boxes (houses) stored in a grid of 8-step cells. `resolve(x, z, radius)` pushes the player out of them. There's no collision with the dome itself; the ring of rocks forms the cave wall, with a gap for the mouth.
6. **Flags:** pole (instanced, turns gold when found), a cloth plane with the flag texture (waves when near the player), and a spinning gold star once found. A hint "beacon" (a tall glowing cylinder) is placed on the hinted flag.
7. **Spawn point:** land near the middle of the continent's flags, not on top of one. The game also remembers the last position on each continent.

Everything uses seeded randomness (`noise.js` → `rng(seed)`), so each continent looks the same every visit, as long as the code and data don't change.

## Flags (images)

- `scripts/copy-flags.mjs` runs before `dev` and `build`. It copies the 195 needed SVGs from `node_modules/flag-icons/flags/4x3/` into `public/flags/` and **adds `width`/`height`**. Without these, iPad Safari won't draw the SVGs onto a canvas. `public/flags/` is git-ignored because it's generated.
- `flags.js` loads each SVG into a 256×192 canvas. The canvas is used as the 3D texture and for map icons. DOM popups use the SVG URL directly.

## Controls (`controls.js`)

- Touch events on a full-screen `#touch-layer` under the HUD. The first touch on the left 45% of the screen becomes the joystick (it appears where you touch). Another touch drags the camera. The jump button has its own handler.
- `touchstart`/`touchmove` call `preventDefault()` to stop iPad scrolling and zooming. CSS `touch-action: none` and the `gesturestart` handler block pinch zoom.
- `read()` returns movement relative to the camera, plus how far you dragged to look, plus whether jump was pressed. Movement is turned into world directions in `main.js`.

## Saving (`save.js`)

- One JSON object in `localStorage['flag-explorer-save-v1']`: `found` (code → time found), `last` (last continent), `pos` (last position per continent), `celebrated` (which celebrations were shown, stored as the flag count at the time so a bigger total celebrates again), `settings` (`voice`, `fast`).
- `loadSave()` fills in missing fields, so older saves keep working.
- **Reset gotcha:** reset reloads the page, and the page saves while it closes (`visibilitychange`). To stop that from writing the old flags back, `resetAll()` first empties the save object in memory, then `resetSave()` sets a lock that blocks any more writes until the reload.

## Speech (`speech.js`)

- Uses the browser's `speechSynthesis` with an English voice. iPad Safari only allows speech after a tap, so the **Play** button speaks a silent utterance first to unlock it.
- Each country's `say` value lets you spell out tricky names (for example Kiribati → "Kiri-bass").

## Performance choices (for iPad)

- Pixel ratio capped at 1.5 (1 in Fast mode). Antialiasing is off in Fast mode. There are no real-time shadows (just a round blob under the kid), plus fog and a short camera range.
- Lambert materials, flat shading, instancing. Only the current continent is loaded.
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
