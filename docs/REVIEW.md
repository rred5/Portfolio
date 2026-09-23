# Review and diagnosis (2026-09-23, v1 → v1.1)

A full pass over the v1 code (state, app wiring, rendering, scenes, climber, holds, UI, pages)
plus screenshot checks of every view on desktop and phone. v1 is tagged `v1-save`.

## Fixed in this pass

| Problem | Cause | Fix |
|---|---|---|
| Floating object near the climber in Skills and Projects | The short sleeves were placed with a shared scratch vector that `segment()` overwrote, so they rendered at half their world position (only the gym and plains outfits have short sleeves) | New climber rig with its own scratch vectors (`src/climber/Climber.tsx`) |
| Holds floating off / sunk into the neighbouring gym wall | Hand-written plane equation with both slopes flipped relative to the panel's rotation | Holds built in the panel's own frame and moved with it (`GymScene.tsx`) |
| Section title misaligned and cropped | Centred between rail and card column rather than on the page; `overflow: hidden` clipped the text stroke | Page-centred, padded (`app.css`, `.topbar__title`) |
| Holds' "shader issue" | Faceted (flat-shaded) holds made the ink pass draw lines across facets; the glow was a back-face shell scaled 1.45× that cut into the wall; shadow acne on large faces | Smooth sculpted holds (`holdShapes.ts`), glow ring that follows the relief, `normalBias` on every sun light |
| Black specks all over the Kilter board | Every hold had a dark LED box that the ink pass outlined | Board face texture with grain, T-nut grid and seams; LED rings on the problem's holds only |
| Holds look stuck on | High-contrast lens shapes unrelated to the rock | Holds tinted to each wall's rock with chalked tops; plastic colours on the board |
| Some holds half-buried (e.g. Skills "Frameworks") | Narrow cracks and strata steps in the surface function are shallower in the coarse relief mesh | `coverDepth()` lifts holds, tape, rings and the climber's hands/feet onto the rendered surface |
| Black diamonds / hexagons on ice and coast | Dark cones and "pocket" discs used as decoration | Removed; decoration is rock/ice features now |
| Walls out of place in their settings | Each wall was a slab standing on flat ground | Plains outcrop cluster, apron and talus; glacier buttresses and drifts; coast shoulder stepping into the sea |
| Island view unimpressive | Top-down pie with a straight water cross | 41° three-quarter view, winding channels, central signpost, lighthouse, sailboat, wave marks |
| A card opened by itself on page load (regression found while fixing hover) | Picking ran at the default pointer position (screen centre) | Picking waits for a real pointer event |
| Hover not re-checked after a transition | The "pointer moved" flag was consumed while the transition was running | Flag kept until the view settles |
| Back/forward lost the pinned card | Only direct loads read the URL hash | Re-pinned after the transition lands |
| Blank blue page while the bundle downloads | App is client-only | Static copy of the loading screen in the HTML |
| Blank page if a scene chunk fails to load | No error boundary | Falls back to `/text?fallback=error` with a retry link |
| PCFSoftShadowMap warning | Removed from three | PCF shadows |

## Recommended next, in priority order

### 1. Content and launch (biggest impact)
- **Real content** in `src/content/portfolio.ts` (everything is `[Placeholder]`).
- **Pick the nav variant** (`?nav=rail` vs `?nav=dock`) and delete the other.
- **Transition timings**: say what feels off; all in `src/config/motion.ts`.
- **Hosting**: set `SITE_URL`, add a 1200×630 `og:image` (a screenshot of the island). Canonical
  and Open Graph tags are already in place.

### 2. Visual polish
- ~~Climber glances back over the shoulder when a card is pinned (face, cheeks, smile)~~: done.
- ~~Ropes on the glacier and sea cliff, through ice screws / quickdraws to a coiled pile~~: done.
- ~~Chalk puff when a hand lands (and when leaving the chalk bag)~~: done.
- **Island life**: gulls and snowfall over the glacier region are in; lit windows in the city or a
  lighthouse lamp could follow.
- **Surface transition**: returning to the island could reassemble the fallen chunks (reverse of
  the dive) for continuity.
- **Hold ↔ card link** on desktop: a thin leader line from the pinned hold to the card.

### 3. UX
- ~~Previous / next in the card (and ← → keys)~~: done (v1.1).
- **Phones**: one tap on an island region dives straight in; if accidental dives show up in
  testing, a first-tap highlight would help.
- ~~Preload the display font~~: done (v1.1).

### 4. Performance (not yet measured on real devices)
- Measure frame rate on a mid-range Android phone and an iPhone before tuning further.
- The coast ocean is animated on the CPU (~16k vertices + normals each frame; now every other frame
  on phones). Moving the waves into a vertex shader would remove that cost.
- ~~Halve shadow maps on phones~~: done (v1.1).
- JS + CSS is ~365 KB gzipped (three, postprocessing, React Three Fiber, React). Section scenes are
  already split and preloaded; the remaining size is mostly three itself.

### 5. Robustness and code health
- Only Chrome has been tested. Check Safari/iOS (WebGL2, half-float render targets in
  postprocessing) and Firefox.
- `PostFX` reads `lowPower` once; if the environment changes (e.g. tablet docked to a keyboard)
  the composer isn't rebuilt. Minor.
- Dev only: React warns about a state update during render after hot reloads (store init inside
  `App`'s render), and three warns that `THREE.Clock` is deprecated (inside React Three Fiber; goes
  away with an R3F update).
- `scripts/screenshots.mjs` could become a CI smoke test: load every route, fail on console
  errors.

### 6. Search and sharing
- The 3D pages are client-rendered, so crawlers see only the title and description (the text
  version is linked as an alternate). Rendering each section's text into a visually hidden `<main>`
  on its route would make the 3D pages themselves indexable.
