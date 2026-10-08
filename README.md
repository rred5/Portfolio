# Climbing Island Portfolio

A developer portfolio as an interactive 3D diorama. The landing page is a cartoon island split into
four regions; each region dives into a climbing wall where every highlighted hold is a portfolio item.
A plain text version (`/text`, `/llms.txt`, `/llms-full.txt`) is generated from the same data.

**Design and behaviour are specified in [`docs/SPEC.md`](docs/SPEC.md).** It is the source of truth.

```sh
npm install
npm run dev        # http://localhost:4321
npm test           # unit tests (content, text version, state rules, routes)
npm run check      # type check (.ts, .tsx, .astro)
npm run build      # static site in dist/ (works on any static host)
```

## Editing content

Everything shown on the site lives in **`src/content/portfolio.ts`**, currently filled in from the
Oct 7 2026 resume. Each section holds 2–8 items; `order` runs bottom → top on the wall (oldest first).
The build fails with a readable message if the content is invalid.

- **CAMP:** one switch, `SHOW_CAMP` at the top of `portfolio.ts`. Set it to `false` to drop the CAMP
  hold and serve `public/resume-no-camp.pdf` instead of `public/resume-with-camp.pdf`.
- **Phone number:** `profile.phone`. Delete the line to take it off the Contact card and text version.
- **Resume PDFs:** replace the two files in `public/` when the resume changes.

Set `SITE_URL` (env var, used by `astro.config.mjs`) once hosting is decided so `/llms.txt` has
absolute links.

## Tuning

- **Timings:** `src/config/motion.ts`, every transition and animation duration in one place.
- **Camera framing per wall:** `src/scenes/walls.ts` (`framing.landscape` / `framing.portrait`).
- **Island layout:** `src/scenes/island/layout.ts`.
- **Navigation comparison:** add `?nav=rail` or `?nav=dock` to any section URL (spec P10). Once one
  is chosen, delete the other variant from `src/ui/Nav.tsx` and `src/styles/app.css`.

## Layout

```
src/content/     portfolio data, validation, queries
src/lib/text/    Markdown generator for /text, /llms.txt, /llms-full.txt
src/state/       zustand store (state machine), router, per-frame transition clock, registries
src/app/         canvas setup: camera rig, transitions, picking, post effects, section loader
src/render/      toon material, ink outline + zoom blur effects, geometry helpers, sky
src/scenes/      island + four walls (gym, glacier, plains, coast), wall/route/hold framework
src/climber/     rigged climber, IK poses, outfits
src/ui/          DOM overlay: top bar, labels, tags, card, bottom sheet, nav, loading
scripts/         screenshot driver (playwright-core + installed Chrome)
```

## Screenshots

With the dev server running on port 4400 (`npx astro dev --port 4400`):

```sh
node scripts/screenshots.mjs steps.json out/
```

See the header of `scripts/screenshots.mjs` for the step format.
