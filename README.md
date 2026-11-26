# Flag Explorer

A bright, low-poly 3D game for iPad Safari. You walk around each continent and find the hidden flags of all **195 countries** (the 193 UN members plus Vatican City and Palestine). When you find a flag, the game shows it big, reads the country name out loud, and shows two fun facts.

**Play it:** https://mikekolb.github.io/flag-explorer/ (iPad, landscape. Tap Share → *Add to Home Screen* for full screen.)

It was made for a young child who reads well, so it uses big buttons, simple words, no sound effects, no ads, no accounts and no links out of the game.

---

## Quick start (for developers)

You need [Node.js](https://nodejs.org/) 20 or newer.

```bash
git clone https://github.com/mikekolb/flag-explorer.git
cd flag-explorer
npm install
npm run dev        # opens a local server, usually http://localhost:5173
```

On a computer: **WASD** or arrow keys to walk, **drag the mouse** to look around, **Space** to jump, **Q/E** to turn.

To try it on an iPad on the same Wi-Fi, use the "Network" address that `npm run dev` prints.

| Command | What it does |
|---|---|
| `npm run dev` | Copies the flag images, then starts the local dev server |
| `npm run build` | Copies the flag images, then builds the finished site into `dist/` |
| `npm run preview` | Serves the built `dist/` folder to check it |
| `node scripts/make-icons.mjs` | Redraws the home-screen icons in `public/` (only needed if you change them) |

There are no tests, no backend, and no environment variables.

---

## How to play (what the child sees)

- **Joystick (left side):** put a finger anywhere on the left part of the screen and slide to walk.
- **Look around:** drag a finger on the right part of the screen.
- **Jump:** the big yellow button.
- **Walk up to a flag** to collect it. A popup shows the flag, the country name (spoken aloud) and two fun facts.
- **Counter** at the top: "47 / 195 found".
- **Map:** shows this continent with the flags you found. The **World** tab lets you tap a continent to fly there.
- **Hint:** pick any flag you haven't found. A big arrow and a step count guide you, a light beam marks the spot, and a star shows on the map. If it's on another continent, the game tells you to fly there first. Hints are unlimited.
- **My Flags:** every flag you found. Tap one to see it again.
- **Celebrations:** stars and confetti when a continent is finished, and a trophy when all 195 are found.
- **Settings (gear):** voice on/off, Fast mode, full screen, the version number, and a **hold-for-3-seconds reset** for grown-ups.

---

## Common changes

| I want to… | Do this |
|---|---|
| Change or add fun facts | Edit [`src/data/facts.js`](src/data/facts.js). Facts are keyed by two-letter country code. Facts show for flags found earlier too. |
| Fix a country name or pronunciation | Edit [`src/data/countries.js`](src/data/countries.js). The optional 6th value is how the voice should say it. |
| Move a flag | Change the country's `lat`/`lon` in `countries.js`. The game spaces flags out automatically. |
| Go back to the small 10-flag test version | Set `TEST_BUILD = true` in [`src/config.js`](src/config.js). |
| Change how a continent's world is sized | Edit [`src/data/continents.js`](src/data/continents.js) (`size` = steps across the longest side). |
| Make the game faster on old iPads | Players can turn on **Fast mode** in Settings. For everyone, lower the tree count or terrain detail in [`src/world.js`](src/world.js). |

After a change, push to `main`. The site updates by itself in about a minute (see below).

---

## Publishing (GitHub Pages)

Every push to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). It builds the game and publishes `dist/` to GitHub Pages. In the repo settings, Pages must be set to **Source: GitHub Actions** (already done).

- The site uses relative paths (`base: './'` in [`vite.config.js`](vite.config.js)), so it works under any repo name or in a fork.
- **If you fork this repo:** go to *Settings → Pages*, choose **GitHub Actions** as the source, then push to `main` or run the workflow by hand from the *Actions* tab. Your link will be `https://<your-username>.github.io/<repo-name>/`.
- Devices can keep the old version for about 10 minutes, and home-screen apps sometimes longer. To check which version a device runs, open **Settings**: the version line shows the build time in UTC. If it's old, fully close the app and reopen it.

---

## Project layout

```
index.html               All on-screen layout (HUD, popups, map, settings)
vite.config.js           Build settings (relative paths, build-time version stamp)
public/                  Files copied as-is: icons, web app manifest, flags/ (generated)
scripts/copy-flags.mjs   Copies the 195 needed flag SVGs from the flag-icons package into public/flags
scripts/make-icons.mjs   Draws the home-screen PNG icons with no extra libraries
src/
  main.js       Starts everything: renderer, game loop, movement, collecting, travel, start screen
  world.js      Builds one continent: map-shaped terrain, sea, trees, houses, hills, caves, flags, collisions
  geo.js        Real map data: lat/lon → world position, drawing land/borders, the world map
  player.js     The low-poly kid character and its walk/jump animation
  controls.js   Touch joystick, drag-to-look, jump button, keyboard and mouse
  ui.js         Counter, flag popup, My Flags, hints, minimap, full map, settings, celebrations
  save.js       Saving progress in the browser (localStorage)
  speech.js     Reading country names aloud (browser speech)
  flags.js      Loads flag SVGs into images for the 3D flags and map icons
  noise.js      Small random-number and terrain-noise helpers
  config.js     TEST_BUILD switch and which countries/continents are active
  style.css     All styling
  data/
    countries.js   The 195 countries: code, name, continent, lat/lon, how to say it
    continents.js  The six continents: map area, world size, colour, map label spot
    facts.js       Two fun facts per country
docs/
  ARCHITECTURE.md  How the game works inside, and the tricky parts
  REQUIREMENTS.md  What the game was asked to do, and the decisions made
CLAUDE.md / AGENTS.md  Notes for AI coding assistants
```

More detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md).

---

## Saved progress

Progress is stored only in the browser (`localStorage`, key `flag-explorer-save-v1`). It's keyed by country code, so game updates keep it. Notes:
- Safari and the home-screen app on an iPad keep **separate** saves.
- Clearing Safari's website data erases the save.
- If you ever change the save format, keep reading the old key or move the data over, so no one loses their flags.

---

## Known limits

- It needs internet to load (there is no offline service worker).
- The camera can pass through a tree for a moment in thick forest.
- The browser's built-in voice may say a few names slightly wrong. Fix them with the `say` value in `countries.js`.
- On the big map, the little islands drawn for tiny island countries hint where those flags are.
- Speed was checked on one iPad. Older iPads may need **Fast mode**.

---

## License

The game's code is under the [MIT License](LICENSE): anyone may use, copy, change and share it, as long as they keep the license notice. The flag images and map data keep their own licenses, listed below.

## Credits

- Flag images: [flag-icons](https://github.com/lipis/flag-icons) (MIT license), bundled locally.
- Map shapes: [world-atlas](https://github.com/topojson/world-atlas), from [Natural Earth](https://www.naturalearthdata.com/) (public domain).
- 3D: [three.js](https://threejs.org/) (MIT). Build tool: [Vite](https://vite.dev/) (MIT).
