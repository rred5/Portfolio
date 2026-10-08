// ALL portfolio content lives here (spec §4), taken from the Oct 7 2026 resume. Item `order` runs
// bottom → top on each wall (oldest first for dated items). Each section holds 2–8 items.

import type { Item, Portfolio, Profile, Section } from './types';

// One switch for CAMP. `false` drops its hold from the Experience wall (and the text version) and
// serves the resume PDF without the Leadership section.
const SHOW_CAMP = true;

export const profile: Profile = {
  name: 'Ryan Reddy',
  title: 'Developer Portfolio',
  summary:
    'Computer science student at Purdue who builds AI products and the systems behind them: a solo knowledge-graph platform for company documents, on-device vision-language model benchmarking on Snapdragon phones, and a state-winning autonomous robot.',
  email: 'ryangreddy@gmail.com',
  // Google Voice number. Delete this line to take it off the Contact card and the text version.
  phone: '512-766-9833',
  links: [
    { label: 'GitHub', url: 'https://github.com/rred5' },
    { label: 'LinkedIn', url: 'https://www.linkedin.com/in/ryan-reddy-23273521b' },
  ],
  resumeUrl: SHOW_CAMP ? '/resume-with-camp.pdf' : '/resume-no-camp.pdf',
};

export const sections: Section[] = [
  {
    id: 'projects',
    label: 'Projects',
    navLabel: 'Projects',
    order: 0,
    intro: 'Things I have built: AI products, benchmarking tools and a competition robot.',
  },
  {
    id: 'experience',
    label: 'Experience',
    navLabel: 'Experience',
    order: 1,
    intro: 'Where I have worked, led and studied.',
  },
  {
    id: 'skills',
    label: 'Skills',
    navLabel: 'Skills',
    order: 2,
    intro: 'Languages, frameworks and tools I use.',
  },
  {
    id: 'about',
    label: 'About & Contact',
    navLabel: 'About',
    order: 3,
    intro: 'Who I am and how to reach me.',
  },
];

const camp: Item = {
  id: 'camp',
  section: 'experience',
  order: 0,
  tag: 'CAMP',
  kind: 'experience',
  company: "Children's Association for Maximum Potential (CAMP)",
  role: 'Program Activity Leader',
  dates: { start: '2025', label: 'Summer 2025' },
  summary: 'A full-time summer camp for children and adults with disabilities.',
  bullets: [
    'Led daily recreational and social activities, with hundreds of campers per session across 6 sessions',
    "Adapted each activity to individual campers' needs",
  ],
};

export const items: Item[] = [
  // Projects (oldest at the bottom of the board)
  {
    id: 'robot-tour',
    section: 'projects',
    order: 0,
    tag: 'Robot Tour',
    kind: 'project',
    name: 'Robot Tour Autonomous Robotics System',
    dates: { start: '2022', end: '2024' },
    summary:
      'A competition robot that won 1st place at the Texas State Tournament. I was lead architect; my partner led the code development.',
    description:
      'Robot Tour rewards repeatability: the robot has to drive a fixed course accurately, run after run. I architected a command-based C++/Arduino motion-control stack for a Pololu robot, with encoder distance tracking, IMU/gyro yaw estimation, and waypoint and state tracking.\n\nOn top of that I designed the precision-control logic and a custom PCB that brings gyroscope and Hall effect encoder feedback into the robot, so autonomous runs repeat reliably.',
    tech: ['C++', 'Arduino', 'PID control', 'IMU / gyro', 'Hall effect encoders', 'PCB design'],
    highlights: [
      '1st place, Texas State Tournament (Science Olympiad Robot Tour, 2024)',
      'PID-style correction, S-curve acceleration, drift correction, turn calibration and motor balancing',
      'Custom PCB integrating a gyroscope and Hall effect encoder feedback',
    ],
  },
  {
    id: 'companybrain',
    section: 'projects',
    order: 1,
    tag: 'CompanyBrain',
    kind: 'project',
    name: 'CompanyBrain',
    dates: { start: '2026-07' },
    summary: 'A solo-built AI knowledge-graph platform that turns internal company documents into source-linked facts.',
    description:
      'I designed and built, solo, a full-stack platform that turns company documents into a source-linked knowledge graph for AI agents that act on company processes.\n\nAn LLM extraction pipeline (Claude forced tool use) pulls entities and relationships against a fixed ontology and tags each fact with its source document and its authority: official policy or tribal knowledge.',
    tech: ['Next.js', 'TypeScript', 'Prisma', 'PostgreSQL / pgvector', 'Neon', 'Vercel', 'Anthropic API', 'Voyage AI'],
    highlights: [
      'Two-stage entity resolution (exact match, then Voyage embeddings with pgvector similarity); replaced a guessed 0.85 merge threshold that missed a real duplicate with 0.75, set from measured duplicate vs. non-duplicate scores',
      'Semantic search that ranks graph entities by pgvector similarity to a free-text query, verified on live data',
      'LLM spend capped by an in-database ledger and a fail-closed pre-call budget gate',
      'Fixed a rate-limit failure found in live testing (batched embedding calls) and three bugs from a code review (27 unit tests); development isolated from production data with a Neon database branch',
    ],
    links: { demo: 'https://company-brain-nu-puce.vercel.app' },
  },
  {
    id: 'vlm-benchmarks',
    section: 'projects',
    order: 2,
    tag: 'VLM Benchmarks',
    kind: 'project',
    name: 'On-device VLM Benchmarks',
    dates: { start: '2026-08' },
    summary: "A benchmark harness that measures a vision-language model's speed on a Snapdragon phone's CPU, GPU and NPU.",
    description:
      "For the Purdue LPCVC team I built a benchmark harness on Qualcomm's GenieX Android sample. It runs Qwen3-VL-2B on the phone's CPU, GPU and NPU and records time-to-first-token, prefill speed and decode speed.",
    tech: ['Qwen3-VL-2B', 'Qualcomm GenieX', 'Android / adb'],
    highlights: [
      'Over 10 runs per configuration, the GPU and NPU cut time-to-first-token 2–3× versus the CPU (cold start: 30.1 s to 9.6 s)',
      'Accuracy pilot that scores real-vs.-tampered image verdicts against a labeled dataset',
    ],
  },
  {
    id: 'phonebench',
    section: 'projects',
    order: 3,
    tag: 'PhoneBench',
    kind: 'project',
    name: 'PhoneBench',
    dates: { start: '2026-08' },
    summary: 'A website for queueing benchmark jobs on a shared Snapdragon phone, built for the Purdue LPCVC team.',
    description:
      'Running a benchmark on the team\'s shared phone used to mean USB and adb. I built PhoneBench so teammates can queue jobs from a website instead.\n\nIt has been live since October 2026. Sign-in is limited to team members for now.',
    tech: ['Kotlin', 'FastAPI', 'Supabase', 'React', 'Vercel', 'Qualcomm GenieX'],
    highlights: [
      'A Kotlin worker app on the phone takes jobs from the cloud queue and runs them on the CPU, GPU or NPU',
      'FastAPI and Supabase job queue with Google sign-in; React site on Vercel',
      'The first cloud job (10 images × 10 repetitions, Qwen3-VL-2B) completed all 100 runs',
    ],
    links: { other: [{ label: 'Live site (team only)', url: 'https://lpcvc-phone-bench-app-server.vercel.app' }] },
  },

  // Experience (oldest at the bottom of the ice face)
  ...(SHOW_CAMP ? [camp] : []),
  {
    id: 'purdue',
    section: 'experience',
    order: 1,
    tag: 'Purdue',
    kind: 'experience',
    company: 'Purdue University',
    role: 'B.S. in Computer Science',
    dates: { start: '2025-08', end: '2029-05' },
    summary: 'Expected graduation May 2029.',
    bullets: ['GPA: 3.44/4.0'],
  },
  {
    id: 'purdue-vip',
    section: 'experience',
    order: 2,
    tag: 'Purdue VIP',
    kind: 'experience',
    company: 'Purdue VIP: Low-Power Computer Vision Challenge (LPCVC) Team',
    role: 'Team member',
    dates: { start: '2026-08' },
    summary: 'On-device vision-language model benchmarking and remote-access infrastructure.',
    bullets: [
      'Built PhoneBench, the site where teammates queue benchmark jobs on a shared Snapdragon phone',
      'Built the CPU/GPU/NPU benchmark harness and the accuracy pilot for Qwen3-VL-2B',
    ],
  },

  // Skills (one hold per group)
  {
    id: 'languages',
    section: 'skills',
    order: 0,
    tag: 'Languages',
    kind: 'skills',
    name: 'Languages',
    skills: [
      { name: 'Python' },
      { name: 'TypeScript' },
      { name: 'JavaScript' },
      { name: 'Kotlin' },
      { name: 'C++' },
      { name: 'C#' },
      { name: 'Java' },
      { name: 'SQL' },
      { name: 'HTML' },
      { name: 'CSS' },
      { name: 'Bash' },
    ],
  },
  {
    id: 'web-backend',
    section: 'skills',
    order: 1,
    tag: 'Web & Backend',
    kind: 'skills',
    name: 'Web & Backend',
    skills: [
      { name: 'React' },
      { name: 'Next.js' },
      { name: 'Node.js' },
      { name: 'FastAPI' },
      { name: 'Prisma' },
      { name: 'PostgreSQL / pgvector' },
      { name: 'Supabase' },
      { name: 'Neon' },
      { name: 'Vercel' },
      { name: 'Tailwind CSS' },
      { name: 'REST APIs' },
      { name: 'pytest' },
      { name: 'Git' },
    ],
  },
  {
    id: 'ai-data',
    section: 'skills',
    order: 2,
    tag: 'AI & Data',
    kind: 'skills',
    name: 'AI & Data',
    skills: [
      { name: 'Anthropic API (tool use)' },
      { name: 'Voyage AI' },
      { name: 'Embeddings and vector search' },
      { name: 'Knowledge graphs' },
      { name: 'TensorFlow' },
      { name: 'matplotlib' },
      { name: 'Claude Code' },
      { name: 'OpenAI Codex' },
    ],
  },
  {
    id: 'systems-hardware',
    section: 'skills',
    order: 3,
    tag: 'Systems',
    kind: 'skills',
    name: 'Systems & Hardware',
    skills: [
      { name: 'Android / adb' },
      { name: 'Arduino' },
      { name: 'Unity' },
      { name: 'Logisim' },
      { name: 'NgSpice' },
    ],
  },

  // About & Contact
  {
    id: 'who-i-am',
    section: 'about',
    order: 0,
    tag: 'Who I am',
    kind: 'about',
    heading: 'Who I am',
    body: "I'm a computer science student at Purdue (B.S., expected May 2029) who builds AI products and the systems behind them. I'm most interested in source-grounded agents, coding tools, and the places AI meets robotics and infrastructure.\n\nI move quickly, then stay with the details that make a system useful and reliable.",
  },
  {
    id: 'awards',
    section: 'about',
    order: 1,
    tag: 'Awards',
    kind: 'about',
    heading: 'Awards & honors',
    body: 'Top 30 USA, PicoCTF 2024; AIME Qualifier 2024; CyberPatriot Nationals Semifinalist 2024.\n\n1st, Texas State Tournament, Science Olympiad Robot Tour 2024; 2nd, Texas State Tournament, Science Olympiad Solar Power 2024; FBLA Nationals Qualifier 2024.',
  },
  {
    id: 'get-in-touch',
    section: 'about',
    order: 2,
    tag: 'Get in touch',
    kind: 'contact',
    heading: 'Get in touch',
  },
];

export const portfolio: Portfolio = { profile, sections, items };
