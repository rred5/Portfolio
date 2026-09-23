// Every timing in one place (spec §9.1, D17: kept short, tuned together during development).
// Durations are in seconds.

export const motion = {
  /** Island → section, first dive of the page load. */
  diveFirst: 1.0,
  /** Island → section, later dives. */
  dive: 0.5,
  /** Section → section. */
  switch: 0.35,
  /** Section → island. */
  surface: 0.4,
  /** Fraction of each transition at which the scene swaps (hidden by peak blur). */
  swapAt: { dive: 0.7, switch: 0.45, surface: 0.45, fade: 0 },

  regionHover: 0.15,
  previewIn: 0.12,
  previewOut: 0.1,
  pinnedIn: 0.12,

  /** One climbing move to the hovered / pinned hold: feet, drive, reach, latch, other hand. */
  move: 1.2,
  /** Each move through the holds in between, on the way to a hold further up or down. */
  moveThrough: 0.85,
  /** Reduced motion: straight to the target pose. */
  poseReduced: 0.08,

  reducedFade: 0.15,
  directEnter: 0.3,
  loadingFade: 0.2,
  sheetShift: 0.2,

  holdPulsePeriod: 1.8,
  chalkIdleDelay: 5,
  chalkEvery: [6, 10] as const,
  chalkDuration: 0.8,
  axeTick: 0.1,

  parallax: {
    islandDeg: 1.5,
    sectionYawDeg: 2,
    sectionPitchDeg: 1.5,
    /** Exponential smoothing rate. */
    damping: 5,
  },
} as const;
