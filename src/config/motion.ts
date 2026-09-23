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

  pose: 0.3,
  poseLong: 0.4,
  poseReduced: 0.08,
  /** Pelvis travel (m) above which a pose change counts as a long move. */
  longMove: 0.9,

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
