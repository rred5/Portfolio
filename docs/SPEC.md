# Climbing Island Portfolio: Design & Implementation Spec

**Status:** APPROVED (2026-09-23) and implemented as v1. This document is authoritative: nothing
outside it gets built without discussing it first, and anything still undefined is asked about, not
invented. Where v1 differs from the text below, §20 says how and why.

Items tagged **[Pn]** started as proposals for details the brief didn't cover. All have now been
answered; §17 records how each one was resolved.

---

## 1. Summary

A developer portfolio presented as an interactive 3D diorama with a climbing theme. The landing page is
a high-angle view of a stylized island split into four regions. Each region is a portfolio section;
clicking it dives into that section's climbing wall. On the wall, each highlighted interactive hold is one
portfolio item: hovering (or tapping) it moves a cartoon climber onto that hold and shows an information
card. A text version of the whole portfolio (`/text`, `/llms.txt`, `/llms-full.txt`) is generated from
the same content data.

### Non-goals (v1)

- Free camera movement, orbiting, or exploration.
- Procedural or physics-based climbing. Climber motion is authored poses blended with IK.
- Sound, analytics, multiple languages, CMS, dark/light theme toggle.
- Real portfolio content. v1 ships with clearly marked placeholders in one data file.

---

## 2. Decisions log (from Q&A, 2026-09-23)

| # | Topic | Decision |
|---|---|---|
| D1 | Sections | 4: **Projects, Experience, Skills, About + Contact** |
| D2 | Mapping | Projects = **indoor gym / Kilter-style board**; Experience = **glacier**; Skills = **sunny plains**; About/Contact = **coastal cliff** |
| D3 | Content | Placeholders now; real content filled in later in one data file |
| D4 | 3D assets | Free CC0 model packs (Kenney, Quaternius, CC0 items on Poly Pizza) restyled with shared toon shading and outlines, plus code-built walls, holds and terrain |
| D5 | Look | *A Short Hike*-style cozy low-poly, pushed more saturated, **with strong black outlines** |
| D6 | Pinned card + hover another hold | Pinned card stays; only hold highlight and climber react |
| D7 | Click outside pinned card | Closes it; Esc also closes it |
| D8 | Climber | Generic cartoon climber (not an avatar), same character everywhere, **outfit changes per environment** |
| D9 | Navigation | Build **two** variants in the real site, **side rail** and **bottom dock**, then keep one and delete the other |
| D10 | Hosting | Undecided: plain static build that works on any host |
| D11 | Island break-up | Other regions **break into chunks that fall into the ocean** |
| D12 | Hold name tags | **Always visible** beside every interactive hold |
| D13 | Card side | **Always right**; wall framed left of center |
| D14 | Climber after hover ends | **Stays on the last hold** |
| D15 | Glacier | Climber uses **ice axes + crampons** |
| D16 | Text button | Top-right, labelled **"Text version"** |
| D17 | Transition timing | **Keep short.** All timings live in one config file and get tuned together during development |
| D18 | Other defaults | Accepted: reduced-motion crossfades, mobile bottom sheet + tap-to-enter, URL per section, llms.txt files, loading screen, Astro + React Three Fiber, no sound/analytics |
| D19 | Island backdrop | Island sits **in the sea**, with ocean to every edge of the screen |
| D20 | Name placement | Island: **big, top-center** with "Developer Portfolio" underneath. Sections: **small, top-left**, and clicking it returns to the island |
| D21 | Section top bar | Name top-left · section title small **top-middle** (centered over the wall area) · "Text version" top-right |
| D22 | Hover preview | **View-only.** Fades out as soon as the cursor leaves the hold and can't be clicked. Clicking the hold pins the card |
| D23 | Framework | **Astro kept.** Next.js was considered; Astro chosen for the lighter download and zero-JS text pages. Responsiveness doesn't depend on the framework |

---

## 3. Pages, routes and app states

### 3.1 Routes

| Route | Shows |
|---|---|
| `/` | Island (landing) |
| `/projects` | Projects wall (gym) |
| `/experience` | Experience wall (glacier) |
| `/skills` | Skills wall (plains) |
| `/about` | About + Contact wall (coast) |
| `/<section>#<item-id>` | That section with that item's card pinned |
| `/text` | Human-readable text version (HTML rendered from the generated Markdown) |
| `/llms.txt` | llmstxt.org-format index |
| `/llms-full.txt` | Full portfolio content as Markdown |

- Each 3D route is a static HTML page that mounts the same app with a different starting state, so deep
  links work on any static host.
- Moving between 3D routes happens client-side (History API), so there are no page reloads. Browser
  back/forward moves between island and sections and runs the normal transitions.
- Pinning a card replaces the hash (`history.replaceState`, so pinning doesn't add history entries).
  Closing the card clears the hash.
- **[P1] Direct load of a section URL** (e.g. someone opens `/projects` from a link): skip the
  island and dive, and show the section with a short fade-in (~0.3s). The first island→section dive
  still counts as the "first transition" if they later go to the island and back in.
- **[P2] 404:** a plain static page in the site style with links to the island and the text version.

### 3.2 App state machine

```
loading ──► island ──(click region)──► diving ──► section(id)
               ▲                                     │   │
               └──────(island button / back)─ surfacing   └─(nav)─► switching ──► section(id')
```

- `loading`: loading screen until the island scene is ready (§15.4).
- `island`: region hover/click enabled.
- `diving` / `surfacing` / `switching`: transitions (§9). Hold and region input is ignored during
  them. If a new navigation request arrives mid-transition, the latest target wins: the current
  transition jumps to its swap point and heads to the new target.
- `section(id)`: hold hover/click, card and climber interaction.

---

## 4. Content structure

All portfolio content lives in **`src/content/portfolio.ts`**, a typed TypeScript module. It has **no 3D
information**. The 3D scenes, the cards, and the text version all read from it.

```ts
interface Profile {
  name: string;               // "Your Name" placeholder
  title: string;              // "Developer Portfolio"
  summary: string;            // 1–2 sentences, used in llms.txt and the About card
  location?: string;
  email: string;
  links: Link[];              // GitHub, LinkedIn, etc.
  resumeUrl?: string;         // PDF in /public
}

type SectionId = 'projects' | 'experience' | 'skills' | 'about';

interface Section {
  id: SectionId;
  label: string;              // Island label + nav label: "Projects"
  order: number;              // Island label order, nav order, text-version order
  intro?: string;             // Text version only (not shown in 3D, see §7.6)
}

interface BaseItem {
  id: string;                 // URL hash + hold binding, kebab-case, unique
  section: SectionId;
  order: number;              // Route order: 0 = lowest hold on the wall (oldest for dated items)
  tag: string;                // Short hold name tag, ≤ 18 chars ("Pathfinder")
}

interface ProjectItem extends BaseItem {
  kind: 'project';
  name: string;
  dates?: { start: string; end?: string };   // "2025-02"; missing end = "Present"
  summary: string;            // one line
  description: string;        // 1–2 short paragraphs
  tech: string[];
  highlights?: string[];      // features / results bullets
  image?: { src: string; alt: string };
  links?: { github?: string; demo?: string; other?: Link[] };
}

interface ExperienceItem extends BaseItem {
  kind: 'experience';
  company: string;
  role: string;
  dates: { start: string; end?: string };
  location?: string;
  summary: string;
  bullets: string[];
  tech?: string[];
  link?: Link;
}

interface SkillGroupItem extends BaseItem {
  kind: 'skills';
  name: string;               // "Languages", "Frameworks", "ML", "Tools"
  skills: { name: string; level?: 'familiar' | 'proficient' | 'expert' }[];
  note?: string;
}

interface AboutItem extends BaseItem {
  kind: 'about';
  heading: string;            // "Who I am", "Off the keyboard"
  body: string;
  image?: { src: string; alt: string };      // e.g. a photo
}

interface ContactItem extends BaseItem {
  kind: 'contact';
  heading: string;            // "Get in touch"
  // Renders Profile.email, Profile.links and Profile.resumeUrl
}

type Item = ProjectItem | ExperienceItem | SkillGroupItem | AboutItem | ContactItem;
export const profile: Profile;
export const sections: Section[];
export const items: Item[];
```

**Limits:** 3–8 items per section, enforced by the scene layouts (§8.1). Skills uses one item per **skill
group**, not per skill.

**Placeholder set for v1:** Projects 5, Experience 3 (2 jobs + education as an experience item), Skills 4
groups, About 3 (Who I am, Off the keyboard, Get in touch). All placeholder strings start with
`[Placeholder]` so they're easy to find.

**Validation (build fails on error):** unique ids; every item is bound to exactly one interactive
hold in its section layout and every interactive hold is bound to an item; per-section count within the
layout's slot count; `tag` ≤ 18 chars.

---

## 5. Visual direction (shared by all scenes)

- **Style:** *A Short Hike*-like low-poly shapes and chunky proportions, **flat/cel shading** (2–3 tone
  steps, no realistic materials), saturated palettes, and **strong black outlines** on silhouettes and major
  creases. Surfaces get their texture from geometry (facets, strata, cracks, ledges) and vertex colors,
  not from image textures.
- **Outlines:** a full-screen edge pass (depth + normal edges) in ink color `#151515`, ~2.5 CSS px thick
  at any resolution. Distant background layers fade the outline toward the atmosphere color so
  far scenery doesn't turn noisy.
- **Model packs:** used only for props and set dressing (trees, rocks, buildings, crash pads, posters).
  They're restyled with the shared toon material and palette so they don't look mismatched. Walls, holds,
  terrain and the climber are built in code.
- **UI style (cards, labels, buttons):** cream panels `#FFF8EC`, 3px ink borders, 12px corner radius,
  hard offset shadow (4px down/right, ink color). A game-like frame around conventional, readable
  content.
- **Typography [P3]:** **Lilita One** (display) + **Nunito** (body), self-hosted. Display font for
  the name, region labels, section title and card titles; body font for everything else.
- **Palettes** (starting values, tuned during build):

| Scene | Key colors |
|---|---|
| Island ocean | deep `#1F6FB2`, shallow `#3FB6E0`, foam `#FFFFFF` |
| Plains | sky `#7EC8F2→#CFEFFF`, grass `#6BCB4B/#3E9A3A`, sandstone `#E8A15A/#C9763B` |
| Glacier | sky `#9FB7F0→#E6E0FF`, snow `#F4F8FF`, ice `#7FD3F7/#3E8FD6`, rock `#5A5F7A` |
| Gym | walls `#2B2D42`, board plywood `#D9A566`, graffiti `#FF4FA3/#3EE0C5/#FFB400`, light `#FFE3A3` |
| Coast | sky `#FF9E6B→#FFD6A0`, sea `#2F9BD6/#1F6FB2`, cliff `#8C5A4A/#B8735A` |
| UI | ink `#151515`, cream `#FFF8EC`, white `#FFFFFF`, interactive cue yellow `#FFD23F` |

---

## 6. Island (landing)

### 6.1 Layout

- Camera looks down from a **three-quarter angle (~41°, 52° in portrait)** toward the north, framing
  the whole island with ocean around it (v1.1: lowered from ~55° so terrain and landmarks read in
  depth). The island fills ~70% of the viewport height on desktop.
- Four regions, each a miniature of its environment. The tallest one sits at the back so nothing is
  hidden:
  - **Back-left: Glacier (Experience):** a snowy peak, the island's highest point.
  - **Back-right: City (Projects):** a small block of buildings; the gym is the largest, with a big
    window and a visible board inside.
  - **Front-left: Plains (Skills):** green meadow with sandstone towers and boulders.
  - **Front-right: Coast (About):** cliffs dropping straight into the ocean, a sea stack.
- Regions meet along clear boundaries (a river, a ridge, a road) so each one reads as a separate area.
- Around the island: low-poly ocean with slowly moving foam lines. A few clouds drift between the
  camera and the island edges without covering regions.
- **Title:** name (display font, large, white with ink outline) with "Developer Portfolio" underneath,
  top-center. **Text version** button top-right. Nothing else on screen (no hint text).
- **Mobile portrait:** camera pulls back and tilts steeper so all four regions fit below the title;
  labels shrink one step.

### 6.2 Labels

- One label per region: a pill with the section label ("Projects"), anchored beside its region
  (HTML positioned over the 3D point every frame), with a short leader tick pointing at the region.
- **[P4] Label states:** default = ink pill with white text (reads on both sea and land); region
  hover = **white pill with ink text**, scale 1.06. This is how "the label highlights in white" gets
  implemented.
- Labels are real `<button>`s: hovering or focusing a label triggers the region hover; clicking one
  enters the section.

### 6.3 Region hover (desktop)

All at once, over **0.15s**:
- A **white outline** traces the region's boundary (a separate selection outline, thicker than the
  black ink lines).
- The region **lifts** ~4% of island height up and slightly toward the camera.
- The region's label switches to its white state.
- Cursor becomes a pointer.

Only one region can be hovered at a time. Moving off it reverses the effect over 0.15s.

### 6.4 Region click

Starts the dive transition (§9.2). Mobile: a single tap enters immediately (no hover step).

---

## 7. Section environments

Common to every section:
- One **fixed camera** per section (plus limited parallax, §10). The scene is only built for what that
  camera can see plus a margin for parallax, so no half-finished areas can show.
- The wall occupies the **left ~60%** of a desktop viewport, leaving the right column for the card
  (§11). Portrait mobile: wall centered and fit to width.
- The wall surface is built to look interesting on its own: layered geometry, cracks, ledges, color
  variation, many **decorative holds/features**, with the interactive holds in between.
- Every section uses the same shading, outlines, climber rig and interactive-hold cue.

### 7.1 Projects: Indoor gym, Kilter-style board

- **Wall:** a Kilter-style board: square plywood panel on a steel frame, tilted to a steep overhang
  (~40°), with a dense grid of bolt-on holds in muted neutral colors and an LED dot beside every hold
  position. Kickboard at the bottom. No real brand logos or names.
- **Holds:** Kilter-style plastic shapes (crimps, pinches, jugs, slopers, edges) on the grid.
  Interactive holds keep the Kilter LED color convention as their idle cue: first = **green** (start),
  middle = **cyan** (hand), last = **magenta** (finish).
- **Background:** gym interior with textured concrete/painted walls, **original** graffiti-style murals
  and posters (made for this site, no copying real artwork), a neighbouring bouldering wall with colored
  holds, crash mats, a chalk bucket, warm pendant lights.
- **Lighting:** warm indoor, pools of light on the board, darker room edges.
- **Ambient:** almost still, just a slow, faint shimmer in the lights.
- **Climber outfit:** T-shirt, shorts, climbing shoes, chalk bag.

### 7.2 Experience: Glacier

- **Wall:** steep snow-and-ice face: blue ice bands and bulges, icicle curtains, dark rock outcrops,
  snow-loaded ledges.
- **Holds:** ice bulges, icicle pillars and rock horns. Interactive holds are ice features where an axe
  pick lands (with a small chipped mark). Feet use crampon placements on ice steps.
- **Background:** layered distant peaks fading into a pale morning haze, a glacier tongue far below,
  thin clouds under the summit.
- **Lighting:** cold low morning sun from the side, lavender shadows.
- **Ambient:** light snowfall (sparse, slow), occasional wisp of spindrift off a ledge.
- **Climber outfit:** puffy jacket, helmet, gloves, mountaineering boots with crampons, two ice axes.
- **[P5] No rope** in v1. Can be added later.

### 7.3 Skills: Sunny plains

- **Wall:** a tall sandstone boulder: horizontal strata bands in orange/tan, vertical cracks, lichen
  spots, grass tufts and a crash pad at its base.
- **Holds:** carved into the rock: jugs, horizontal ledges, crack segments, slopers, pockets, in the
  same rock material with lighter color on top edges.
- **Background:** rolling green plains, sandstone towers and hoodoos, a few round low-poly trees,
  large fluffy low-poly clouds, bright blue sky.
- **Lighting:** bright midday sun, short soft shadows.
- **Ambient:** clouds drift slowly, grass sways gently.
- **Climber outfit:** T-shirt, long climbing pants, chalk bag, climbing shoes.

### 7.4 About + Contact: Coastal cliff

- **Wall:** a sea cliff straight above the water: horizontal ledges, crevices, pockets, a few big
  flakes; darker wet rock near the bottom.
- **Holds:** natural ledges, crevices and pockets.
- **Background:** open ocean with low-poly waves, spray/mist at the cliff base, distant cliffs and a sea
  stack, low sun near the horizon.
- **Lighting:** golden hour: warm key light, soft orange rim, blue-tinted shadows.
- **Ambient:** waves roll, mist drifts at the cliff base.
- **Climber outfit:** tank top, shorts, climbing shoes, chalk bag.

### 7.5 Ambient-motion rules

Ambient motion is always slow, low-contrast and kept behind the wall. Nothing ambient moves in front of
the wall or near an interactive hold. All of it is off under reduced motion (§15.2).

### 7.6 On-screen section chrome

A single top bar (D20, D21):

```
┌──────────────────────────────────────────────────────────┐
│ Your Name            Projects               [Text version] │
│                                                            │
│            (wall)                         │    (card)     │
└──────────────────────────────────────────────────────────┘
```

- **Top-left:** your name, small, display font. It's a link: clicking it goes back to the island
  (same as the nav's island button).
- **Top-middle:** section title (e.g. "Projects"), small, display font, centered over the **wall
  area** (the viewport minus the card column), so it stays put when a card opens. No description
  text.
- **Top-right:** **Text version** button (same as on the island).
- The navigation variant (§12).
- Mobile portrait: same three items in one row, one size step smaller; the title truncates first if space
  runs out.

---

## 8. Holds

### 8.1 Hold kinds (per wall layout)

Each section has a hand-authored layout file (`src/scenes/<env>/layout.ts`) that places:
- **Interactive holds:** slots `s0…sN` (N ≤ 7), bound to items by `order` (item order 0 → slot s0,
  the lowest). Bottom-to-top in time order, oldest first, for Projects and Experience.
- **Support holds:** non-interactive holds placed where the climber's other hand and feet go in each
  pose. They look like decorative holds.
- **Decorative holds/features:** extra holds and rock features for visual texture.

### 8.2 Interactive cue (shared across environments)

Every interactive hold, and nothing else, has:
1. **Tape tag:** a short strip of colored tape just below the hold (like gym route tape) with the
   hold's **name tag** text (`item.tag`) as an HTML label attached to it. Always visible (D12).
2. **Pulse glow:** a soft yellow (`#FFD23F`) glow ring on the wall around the hold, pulsing slowly
   (1.8s period, low amplitude). On the Kilter board the LED color (§7.1) replaces the yellow and the
   tape is dropped (Kilter problems are marked by their LED rings); the name tag is still there.

### 8.3 Hold states

| State | Visual |
|---|---|
| Idle | Cue (tape + pulse) |
| Hover (desktop) / focus (keyboard) | **Thick white outline**, hold tinted toward the cue color, scale 1.08, tag turns white-on-ink, pulse stops |
| Pinned | Same as hover, persists; tag shows a small pin mark |
| Hover while another hold is pinned | Hovered hold shows hover state, pinned hold keeps pinned state (D6) |

Hit areas are larger than the visible hold: at least 44×44 CSS px on touch. Tags are clickable too
(same as clicking the hold).

### 8.4 Hold input rules

| Input | Result |
|---|---|
| Hover hold, nothing pinned | Hover state + climber moves to that hold + **preview card** opens |
| Leave hold, nothing pinned | Preview card fades out immediately (0.1s); climber stays (D14) |
| Move from one hold straight onto another | Preview switches directly to the new hold's card |
| Hover hold, card pinned | Hover state + climber moves; **pinned card unchanged** (D6) |
| Click hold | Climber moves; that item's card becomes **pinned** (replaces any pinned card); URL hash set |
| Click the already-pinned hold **[P7]** | Nothing (it stays pinned, doesn't toggle off) |
| Click empty scene (not a hold, not UI) | Closes pinned card (D7) |
| Esc | Closes pinned card (D7) |
| Tab / Shift+Tab | Moves focus through the interactive holds in order; focus = hover behavior |
| Enter / Space on focused hold | Pins it |

---

## 9. Transitions

### 9.1 Timings (starting values, kept short per D17)

All live in **`src/config/motion.ts`** so they can be tuned in one place.

| Transition | Duration |
|---|---|
| Island → section, **first** dive of the page load | **1.0s** |
| Island → section, later dives | **0.5s** |
| Section → section | **0.35s** |
| Section → island | **0.4s** |
| Region hover lift / release | 0.15s |
| Card preview in / out | 0.12s / 0.1s (no close delay, D22) |
| Climber pose change | 0.3s (0.4s for long moves) |
| Reduced-motion crossfade (all route changes) | 0.15s |

### 9.2 Island → section (dive)

The island miniature and the section diorama are **separate scenes**. The dive hides the swap behind
peak blur.

1. **0–15%:** the selected region lifts a little higher; hover outline fades out.
2. **5–60%:** the other three regions split into chunky pieces (6–12 per region) that tip and fall into
   the ocean with a small splash. First dive: full effect. Later dives: fewer, faster chunks.
3. **15–100%:** camera dashes toward the selected region with ease-in; the **zoom blur** (radial blur
   from screen center) and **speed lines** (white streaks overlay) ramp up.
4. **~70%:** at peak blur, the scene swaps to the section diorama with the camera slightly pulled back
   from its final framing.
5. **70–100%:** blur and speed lines ramp down as the camera settles into the section framing.

### 9.3 Section → section

1. **0–45%:** camera pulls back quickly, zoom blur + speed lines ramp up.
2. **~45%:** scene swap at peak blur.
3. **45–100%:** new diorama resolves with a short push-in to its framing; blur fades.

Any pinned card closes at the start. The climber in the new section starts at that wall's **rest pose**.

### 9.4 Section → island

Pull-back with blur (like 9.3 step 1), swap, and the island appears **already whole**, settling into
place. **[P8]** No reassembly animation. Pinned card closes at the start.

### 9.5 Rules

- A section's assets must be loaded before its swap point (§15.3). If they aren't, the transition holds at
  peak blur with a small spinner until they are.
- Reduced motion replaces every transition with a 0.15s crossfade (no chunks, blur or camera movement).

---

## 10. Camera behavior

- **Island:** fixed pose. Desktop pointer parallax: up to **±1.5°** yaw/pitch.
- **Sections:** fixed pose per section, framing the wall left of center. Pointer parallax up to **±2°
  yaw, ±1.5° pitch**, smoothed. Hard-clamped, so the wall never leaves view and nothing outside the built
  area shows.
- No orbit, pan, zoom or scroll control, and no gyroscope.
- **Parallax is off** on touch devices and under reduced motion.
- Camera does not move when cards open on desktop. On mobile, see §13.3.
- Each section defines separate framings for landscape and portrait aspect ratios, and the camera adjusts
  its distance so the whole wall fits.

---

## 11. Information card

### 11.1 Layout (desktop / landscape)

- **Right column**, width `clamp(340px, 30vw, 440px)`, starting **below the top bar** (§7.6) and
  running to 24px above the bottom edge (a long card). Content scrolls inside the card if it's too tall.
- Cream panel, ink border, offset shadow (§5). Header strip in the section's accent color.
- Header: title, subtitle, dates, **X** close button (only shown when pinned; preview cards have no X).
- **Preview cards are view-only** (D22): they ignore the pointer, show no X, and vanish when the cursor
  leaves the hold. To scroll a card or use its links, click the hold to pin it.
- Links open in a new tab.
- ~~[P9] Clicking inside a preview card pins it~~: dropped, since previews are view-only.

### 11.2 Content per item kind

| Kind | Card content (in order) |
|---|---|
| Project | Name · dates · summary · image (if any) · description · highlights bullets · tech chips · GitHub / Demo buttons |
| Experience | Role · company · dates · location · summary · bullets · tech chips · link |
| Skill group | Group name · skills as chips (level shown as 1–3 filled dots) · note |
| About | Heading · image (if any) · body |
| Contact | Heading · email (copy button) · profile link buttons · resume download button |

One image per card max; no lightbox in v1.

### 11.3 Card lifecycle

- Opens: preview on hover (desktop), pinned on click/tap/Enter.
- Closes: X, Esc, click on empty scene, section change, going to island.
- Keyboard: pinning with Enter moves focus to the card; closing returns focus to the hold.
- Only one card at a time.

---

## 12. Navigation (while in a section)

The island itself is the navigation on `/`. In sections, **two variants are built** (D9), switchable via
`?nav=rail` / `?nav=dock` **[P10]** during the comparison. After you choose, the other variant and the
switch are deleted. Separately, the name in the top bar always links back to the island (D20).

Both variants contain the same 5 buttons: **Island** (home) + the 4 sections in `order`. Each has an
icon and label; the current section is highlighted and not clickable.

### 12.1 Variant A: Side rail

- Vertical stack on the **left edge**, vertically centered, 72px wide, cream/ink style.
- Island button on top, separated from the four section buttons.
- Icon + short label under each icon.

### 12.2 Variant B: Bottom dock

- Horizontal pill bar at the bottom, **centered within the area left of the card column** so it
  never collides with the card.
- Island button on the left end, separated; section buttons follow.
- Active button sits raised with an accent-colored top.

### 12.3 Shared

- Keyboard: **1–4** jump to sections, **0** goes to the island.
- On mobile, both variants render as the bottom dock (a side rail doesn't fit portrait screens).

---

## 13. Mobile and touch

### 13.1 Detection

Touch mode = `(hover: none) and (pointer: coarse)`. On hybrid devices, behavior follows the input
type of each individual event (touch taps behave like mobile, mouse hovers like desktop).

### 13.2 Island

Tap a region or its label to **enter immediately**. No hover/lift state.

### 13.3 Sections

- **Tap a hold:** climber moves + card opens **pinned** as a **bottom sheet** (~45% of viewport height,
  drag handle, X). There is no preview state on touch.
- **Tap another hold:** sheet content switches.
- **Close:** X, swipe the sheet down, or tap empty scene.
- **[P11]** When the sheet opens, the camera shifts up (0.2s) so the active hold and climber stay
  visible above the sheet; it shifts back when the sheet closes.
- Hold name tags stay visible, one size step smaller. Wall layouts are authored so tags don't overlap
  at portrait framing.
- The nav dock is hidden while the sheet is open.

### 13.4 Mobile simplifications

- Device pixel ratio capped at 1.5; lower-resolution outline pass.
- Snow and mist particle counts halved.
- Zoom blur replaced by speed lines + a quick fade (cheaper). Transitions keep the same timings.
- No parallax.

---

## 14. Climber

### 14.1 Rig

- Joint hierarchy: **pelvis (root) → spine/chest → neck → head**; chest → **shoulder → elbow → hand** ×2;
  pelvis → **hip → knee → foot** ×2.
- Built in code as a `THREE.Object3D` hierarchy.
- Limbs are placed with **two-bone IK** solved in the wall's 2D plane (adapted from the old project's
  `solveTwoBone`), then pushed out from the wall surface by an offset per joint so elbows and knees
  bend away from the wall. Elbows/knees are biased outward (frog position), like the old solver.

### 14.2 Body and look

- Low-poly, toon-shaded parts on the joints, outlined like everything else. *A Short Hike*-style
  proportions: large head, rounded body, stubby but long-enough limbs (~4 heads tall so reaches
  look plausible).
- Generic, friendly face: dot eyes, small nose, no mouth. Hair tuft or beanie depending on outfit.
- Outfits per environment (§7), swapped as separate mesh sets on the same rig.

### 14.3 Poses

- Each wall has a pose table (`src/scenes/<env>/poses.ts`):
  - **Rest pose** at the bottom of the wall (start holds).
  - **One pose per interactive slot:** which hand grabs the interactive hold, where the other hand and
    both feet go (support holds), pelvis position and torso lean.
- **Pose change:** pelvis and torso ease to the new position; the reaching hand follows a small arc to
  its target and lands last; other limbs reposition with small offsets in timing (0–80ms) so it
  doesn't look robotic. 0.3s normally, 0.4s for long moves.
- **Interruption:** a new target mid-move blends from the current in-between pose, with no snapping.
- **Glacier:** hand targets are axe-pick placements; each landing gets a short "tick" (a small axe snap
  + ice chip particles). Feet land on crampon steps.
- Section entry: climber starts in the rest pose.

### 14.4 Idle

- Breathing (subtle chest scale).
- On chalk walls (gym, plains, coast): after ~5s without input, an occasional chalk dip with the free
  hand (0.8s, then back). Glacier: breathing only.
- Reduced motion: no idle animation, pose changes snap in 0.08s.

---

## 15. Motion, performance and loading

### 15.1 Motion principles

- Interactive feedback (hover, pin, card) responds within one frame and finishes in ≤ 0.15s.
- Transitions follow §9.1 and are never slower than those values.
- Ambient motion stays subtle and behind the wall (§7.5).

### 15.2 Reduced motion (`prefers-reduced-motion: reduce`)

Crossfade transitions (0.15s), no zoom blur/speed lines/chunks, no parallax, no ambient particles or
water movement (static frames), no climber idle, pose snaps, hold pulse replaced by a static glow.

### 15.3 Loading strategy

- **Initial load:** app shell + island scene + fonts. Target **≤ 3 MB compressed**.
- **Section scenes** are separate chunks (code + models). **[P12]** After the island is
  interactive, all four sections preload in the background while the browser is idle, so dives are
  instant. With Save-Data on, or on slow connections, a section preloads only when its region is
  hovered or tapped.
- Total for everything **≤ 10 MB** compressed. Models as glTF with meshopt compression; nearly no image
  textures (vertex colors + small gradient ramps).
- Rendering pauses when the tab is hidden.
- Targets: 60fps on a mid-range laptop integrated GPU, ≥ 30fps on a mid-range phone.

### 15.4 Loading screen

Cream background, name + "Developer Portfolio" in the site typography, and a chunky progress bar (ink
border, accent fill). Shown until the island is ready, then fades out (0.2s). No artificial minimum
duration.

### 15.5 Fallback

If WebGL2 is unavailable or the scene fails to initialize, the app redirects to `/text` with a
one-line note at the top ("Showing the text version because 3D isn't available on this device").

---

## 16. Text / LLM version

Generated at **build time** from `src/content/portfolio.ts` by one shared Markdown generator
(`src/lib/text/`).

- **`/llms-full.txt`:** complete portfolio as Markdown:
  `# Name` → `> summary` → contact links → `## Projects` (each project as `###` with dates, summary,
  description, highlights, tech, links) → `## Experience` → `## Skills` → `## About`.
- **`/llms.txt`:** [llmstxt.org](https://llmstxt.org) format: `# Name`, `> summary`, short intro, then
  `## Sections` with one link per section to `/text#<section>` plus a one-line description, and
  `## Optional` linking `/llms-full.txt`.
- **`/text`:** the same Markdown rendered to clean HTML with the site's fonts in a readable single column,
  a link back to the 3D site, and links to both raw files.
- The **"Text version"** button (top-right on every 3D screen) opens `/text` in the same tab.
- Absolute URLs use a `SITE_URL` config value, a placeholder until hosting is decided (D10).

---

## 17. Proposal resolutions

| ID | Proposal | Resolution | Section |
|---|---|---|---|
| P1 | Direct load of `/section` skips the island, 0.3s fade-in | Approved | §3.1 |
| P2 | Simple styled 404 page | Approved | §3.1 |
| P3 | Font pairing | **Lilita One + Nunito** | §5 |
| P4 | Labels: ink pill default → white pill on hover | Approved | §6.2 |
| P5 | No rope on the glacier in v1 | Approved | §7.2 |
| P6 | Section title top-left | **Replaced** by the top bar: name top-left, title top-middle (D20, D21) | §7.6 |
| P7 | Clicking the pinned hold again does nothing | Approved | §8.4 |
| P8 | Section → island: island appears whole, no reassembly | Approved | §9.4 |
| P9 | Clicking inside a preview card pins it | **Dropped**: previews are view-only (D22) | §11.1 |
| P10 | `?nav=rail` / `?nav=dock` switch during the nav comparison | Approved | §12 |
| P11 | Mobile: camera shifts up when the bottom sheet opens | Approved | §13.3 |
| P12 | Background preload of all sections after the island loads | Approved | §15.3 |

---

## 18. Technical architecture

### 18.1 Stack

- **Astro** (static output), **React** (single client-only island that holds the whole 3D app),
  **TypeScript** (strict).
- **three.js** + **@react-three/fiber** + **@react-three/drei**.
- **postprocessing** (+ `@react-three/postprocessing`) for the ink-outline edge pass, white selection
  outline, zoom blur (custom effects where the library has none).
- **zustand** for app state.
- **marked** (or similar) for rendering the generated Markdown in `/text` at build time.
- Dev tooling: **Vitest** (content validation, Markdown generator, state machine), **Playwright** script
  for desktop + mobile screenshots.

Versions: latest stable at setup time; Node ≥ 22.

### 18.2 Folder layout

```
new-portfolio/
  docs/SPEC.md              ← this file
  CREDITS.md                ← every third-party model: source, author, license (CC0 only)
  public/
    models/<env>/*.glb
    images/                 ← project images, resume PDF
  src/
    content/portfolio.ts    ← ALL portfolio data (§4)
    content/validate.ts
    config/motion.ts        ← all timings (§9.1)
    config/site.ts          ← SITE_URL, feature flags (nav variant during comparison)
    lib/text/               ← Markdown generator (llms.txt, llms-full.txt, /text)
    lib/ik.ts               ← two-bone IK
    state/store.ts          ← zustand store + route/transition state machine
    state/router.ts         ← History API sync
    app/App.tsx             ← Canvas + DOM overlay root
    ui/                     ← Card, BottomSheet, NavRail, NavDock, Labels, TextButton, Loading
    render/                 ← toon material, ink outline effect, selection outline, zoom blur, speed lines
    scenes/island/          ← island geometry, regions, chunk-fall
    scenes/<env>/           ← gym | glacier | plains | coast: Scene.tsx, layout.ts, poses.ts, wall.ts
    climber/                ← rig, parts, outfits, pose blending, idle
    pages/
      index.astro, [section].astro, text.astro, 404.astro
      llms.txt.ts, llms-full.txt.ts
```

### 18.3 Key mechanics

- **Toon shading:** `MeshToonMaterial` with vertex colors and a 3-step gradient ramp, one shared
  material factory so every model (including restyled packs) matches.
- **Ink outlines:** one custom full-screen effect that detects edges in depth and normals.
- **Hover outlines (white):** a selection-outline effect limited to the hovered region or hold.
- **Hit testing:** simplified invisible meshes per region/hold for raycasting; hold hit spheres sized
  to ≥ 44px on screen.
- **HTML overlays:** labels and tags are DOM buttons positioned by projecting their 3D anchor each
  frame (accessible, crisp text, keyboard-focusable).
- **Accessibility:** the canvas is `aria-hidden`; region labels and hold tags are real buttons with
  descriptive `aria-label`s; cards are labelled dialogs (non-modal); visible focus rings.

### 18.4 Browser support

Latest two versions of Chrome, Edge, Firefox and Safari (desktop + iOS/Android), WebGL2 required
(otherwise the `/text` fallback, §15.5).

---

## 19. Build milestones

Each milestone ends with a check-in (screenshots + a local URL) where you give feedback, including
on timing.

1. **Scaffold:** Astro + R3F project, content file with placeholders + validation, text version
   (`/text`, `/llms.txt`, `/llms-full.txt`), routes.
2. **Rendering base:** toon material, ink outlines, loading screen.
3. **Island:** geometry of 4 regions, labels, hover (outline, lift, label), title, text button.
4. **First wall end-to-end (Projects / gym):** wall + holds + cue, tags, card (preview/pin/close),
   climber rig + poses, keyboard.
5. **Transitions:** dive (chunks + zoom blur), section↔section, surface, reduced motion.
6. **Other three walls:** glacier, plains, coast, including outfits and ambient motion.
7. **Navigation:** rail + dock variants → you pick → delete the other.
8. **Mobile:** bottom sheet, tap model, portrait framings, performance tier.
9. **Polish & performance:** loading budget, preload, fallback, cross-browser check.

---

## 20. Implementation notes (v1)

Small calls made while building, for review:

| Topic | What v1 does | Why |
|---|---|---|
| D4 model packs | **No packs used.** Everything, props included, is generated in code with the shared toon material | Packs weren't needed to reach the look, and it keeps the site dependency-free and small (~360 KB gz JS+CSS in total). Packs can still be added for extra props; `CREDITS.md` has the slot |
| Text version order | Projects and Experience list **newest first** in `/text` and `/llms-full.txt`; the walls stay oldest-first bottom → top | Resume convention for reading |
| `Section.navLabel` | Extra content field: short nav label (`About` for "About & Contact") | "About & Contact" doesn't fit a 72px rail button |
| Nav default | `?nav=rail` is the default when no `?nav=` is given | One variant has to be the default during the comparison |
| Poses | Poses are **generated** from each hold's position (`src/scenes/wall/route.ts`) instead of hand-written per hold; support holds are placed where the other limbs land | Works for any wall size from 3 to 8 items with no manual authoring; still "one predefined pose per hold" |
| Island regions | Regions are separated by narrow water channels that wind like rivers, meeting at a central rock with a trailhead signpost (v1.1; v1 had a straight cross) | Clear boundaries without the ruler-straight look |
| Glacier outfit | Crampons shown as a plate under the boots | Readable at this scale |
| Tab order | Top bar → hold tags → nav → card | Tags (the content) come before navigation |
| Transition timings | As in §9.1, unchanged | Tune in `src/config/motion.ts` |
| Holds (v1.1) | Sculpted, smooth-shaded holds with flat backs and chalk on the upward faces, tinted to each wall's rock (plastic colours on the Kilter board); glow ring replaces the back-face halo shell | Faceted holds drew ink lines across every facet and looked stuck on; the halo cut into the wall |
| Climber (v1.1) | Smooth-shaded rig: tapered limbs, shaped torso and shorts, harness with the chalk bag on the belt, ears, hair bun, climbing shoes pointing into the wall; chalk puff when a hand lands; a glance back over the shoulder (face with cheeks and a smile) when a hold is pinned | Reads better from behind, where the camera always sees it, and gives the climber some personality |
| Wall surroundings (v1.1) | Plains boulder sits in an outcrop cluster with a sandy apron and talus; the ice sits between snow-capped rock buttresses; the sea cliff steps down into the water | Walls looked like slabs placed in the scene |
| Island extras (v1.1) | Lighthouse on the coast region, a sailboat circling the island, gulls, snowfall over the glacier region, cartoon wave marks on the water | Life on the landing page |
| Card steps (v1.1) | A pinned card has previous / next buttons for the items below and above on the same wall (also ← →); the climber moves with it | Read a section in order without going back to the wall |
| Climbing moves (v1.2) | Each move is a sequence (~1.2 s): feet step up one at a time, the body drives up while both hands stay on their holds (the IK shows the pull and push), the free hand reaches and latches, then the other hand follows. Holds further away are climbed one at a time (0.85 s each). Per-wall flavour: overhang pulls the hips in and swings after the latch; ice winds the axe up overhead and kicks the crampons in (`src/climber/moves.ts`) | Moves used to be a straight blend between poses, so the climber floated rather than climbed |
| Routes (v1.2) | Holds follow a climbing line close to the body instead of alternating edge to edge; the Kilter route goes up the left side, then traverses the top to the finish | The climber was jumping from one edge of the wall to the other |
| Ropes (v1.2) | Removed | Requested |
| Holds (v1.2) | More kinds: incut jugs with a scoop, flat-topped crimps, slopers, square pinches, pockets, horns, rails, leaning flakes, knobs, ice mushrooms, two-lobed dual holds; each wall has its own mix | More variety and shape |
| Exposed starts (v1.2) | Terrace, ice face and sea cliff start from a ledge high above the ground, the walls continue far above and below the route, and each ends in a prow so the right of the frame opens onto the view (fixed camera; all hold tags stay on screen) | Walls felt short and the backgrounds flat |
| Skills (v1.2) | National-park sandstone terrace ~22 m above farmland: lower terrace, patchwork wheat/green/plowed fields, red barn, silos, farmhouse, hay, fences, tree lines, road, creek, buttes. Island: three terrace tiers on the region's outer third, farms on the rest | Requested national-park look |
| Experience (v1.2) | Taller ice face from a snow shelf, view down a glacier valley (winding ice, moraines, crevasses) to ranges in the haze | Requested grand view |
| About (v1.2) | Cliff starts ~14 m above the sea; harbour with pier, hut, crates, barrels and moored fishing boats; boats working out at sea; gulls. Island: fishing market in a sandy cove (pier, boats, stalls, crates of fish, barrels) and a fishing boat circling the island | Requested fishing market and boats |
| Gym (v1.2) | Kilter control panel with a lit screen right of the board; the neighbour wall holds four taped, colour-coded problems with volumes; bench, hangboard, campus board, shoe cubbies; three regulars (watching from the pads, at the panel, bouldering) posed procedurally with the climber's body (`src/climber/Person.tsx`) | The background was sparse and the neighbour wall's holds were random |
| Island seams (v1.3) | Chunks keep region coordinates and share one transform at rest (they tumble about their centre only while falling); skirts on the seams between chunks are tucked under their own chunk | Along the seams, a chunk's skirt sat at exactly its neighbour's surface depth and z-fought with it; the stray pixels became flickering ink specks whenever the camera or a hovered region moved |
| Island farmland (v1.3) | Fields on a grid turned toward the camera, kept only where they fit inside the region and clear of the terrace, draped over the rendered terrain (raycast) in small lifted cells; a farmyard with the barn, silo and farmhouse spaced apart, a fence and a bale stack; trees clear of fields and buildings; terrace tiers follow the winding channel | Fields overlapped each other, the terrain poked through them, and the barn, silo, farmhouse and bales clipped into each other |
| Wall edges (v1.3) | The Skills, Experience and About faces end in a squared-off corner with thickness (`reliefMesh` `corner`): each strata unit, ice-face block or ledge stops at its own point and its side runs 2–3 m back into the rock, flaring toward the camera, so the edge steps instead of ending in a flat cut | The edges read as flat cut-outs |
| Climbing focus (v1.3) | Camera framings closer to the Kilter board's proportions (smaller fit, less yaw, centred nearer the route); bigger, paler route holds with smaller, fewer decoys; rock and ice around the route in two close tones; ring colour per wall chosen against the rock (cyan on sandstone and sea cliff, amber on ice) with a solid band and a thin dark inner rim; tape in the ring colour; Skills climber in teal against the orange rock | The climbing was not the focus of the outdoor sections |
| Hold tags (v1.3) | On the natural walls the tag sits level with its hold, on the side away from the climbing line, and slides in rather than run off the screen; the board keeps its tags below the holds | Tags below the holds covered the climber's head |
