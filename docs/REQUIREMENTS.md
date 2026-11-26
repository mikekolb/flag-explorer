# Requirements and decisions

This is what the game was asked to do, how each part was done, and what was decided along the way. Keep these rules in mind when changing the game.

## The brief

A web game for a young child (about 7, reads well) to play in **iPad Safari**: explore a 3D world and hunt for the flags of all 195 countries. It's inspired by "find the hidden things" games, but it must **not** copy any existing game's name, characters or assets.

## Hard rules

| Rule | How it's met |
|---|---|
| Plain HTML/CSS/JS with Vite. No backend, accounts, ads or outside links. | No server code. The only links are in the README, not the game. |
| No personal info in the code, and never the child's name. | Nothing personal in the code or files. Keep it that way. |
| Spoken country names only. No sound effects or music. | `speech.js` is the only audio. |
| Flag images bundled locally, so nothing breaks if another site goes down. | `flag-icons` SVGs copied into the site at build time. The map data is bundled too. |
| One player. Progress saved in the browser and kept across updates. | `localStorage`, keyed by country code (see ARCHITECTURE.md). |
| Reset hidden in a settings menu. | Gear → hold "Hold to reset" for 3 seconds. |
| iPad: landscape, full screen, big buttons, simple words. | Home-screen web app (manifest + Apple meta tags). A "turn sideways" screen in portrait. |

## Features (all done)

- **World:** 3D, seen from behind the character, low-poly and bright (three.js). Six made-up islands (Sunny, Berry, Leafy, Rocky, Candy and Snowy Island) with random shapes and colourful patchwork meadows. Each save has its own random world.
- **Character:** a friendly low-poly kid with brown hair. Walk animation and jump.
- **Travel:** you walk around one island. To go to another, open the Map → All islands tab and tap an island.
- **Flags:** 195 (193 UN members + Vatican City + Palestine), dealt out at random to the islands (about 33 each) and placed at random spots at least 22 steps apart. Some in the open, some behind houses, on hills or in caves.
- **Collecting:** walk up to a flag → big flag, country name (spoken aloud) and fun facts.
- **Fun facts:** two short, kid-friendly facts per country in `src/data/facts.js`. They also show for flags found before the facts were added.
- **Counter:** "N / 195 found", always on screen.
- **My Flags:** all found flags. Tap one to see it again.
- **Minimap** (corner) and **full map** (one button): your position and found flags. Unfound flags stay hidden.
- **Hints:** unlimited, no cooldown, no penalty. A searchable list of unfound flags with pictures. Then a big arrow with the distance, a light beam at the flag and a star on the map. If the flag is on another island, it tells you to fly there first.
- **Celebrations:** a small one for each finished island, a small one for finding every country from a real continent, and a big one (trophy + confetti) for all 195.
- **New random world** (Settings): new islands and new spots for the flags not found yet. Found flags stay found.
- **Controls:** joystick on the left, drag to look, Jump button. WASD/mouse on a computer.

## How it was built

1. A small **test version** first (Europe, 10 flags, packed with tiny countries) to check the controls and speed on the real iPad. Result: **smooth**, so the 3D version was kept. (The plan was to switch to a top-down 2D world if 3D lagged.)
2. Then switched to the **full 195 flags**. The test version can still be turned on with `TEST_BUILD` in `src/config.js`.
3. Fixed a reset bug (the page saved old progress back while reloading).
4. Added fun facts for every country and a version number in Settings.
5. After playing, the child asked for a **random map instead of the real Earth**, and for flags **spread out at random instead of next to their neighbours**. The real-map continents were replaced with six random islands, and the world-atlas map data was removed.

## Choices made along the way

- **Real continents still matter for learning:** the flag popup says "A country in Africa", My Flags groups by continent, and finishing a continent celebrates. Borderline countries: Russia → Europe, Turkey → Asia, Cyprus → Europe, Georgia/Armenia/Azerbaijan/Kazakhstan → Asia. Counts: Africa 54, Europe 45, Asia 47, North America 23 (includes Central America and the Caribbean), South America 12, Oceania 14.
- **One world per save, not a new one every visit,** so the child can learn the way around. The seed is stored in the save; "New random world" and reset make a new one.
- **Shallow water is walkable,** so the small islands around each big one can be reached on foot. Going to another big island needs fast travel.
- **Distance is shown in "steps"** instead of metres, since that's easier for a young child.
- **Fun facts are shown, not spoken.** Only country names are read aloud.
- **No offline mode (service worker)** for now, so updates show up reliably. It could be added later.

## Ideas not done yet

- Offline play (service worker), carefully set up so updates still arrive.
- Reading the fun facts aloud with a 🔊 button.
- Keeping the camera from passing through trees.
