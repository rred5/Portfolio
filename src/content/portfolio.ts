// ALL portfolio content lives here (spec §4), taken from the Oct 7 2026 resume. Item `order` runs
// bottom → top on each wall (oldest first for dated items). Each section holds 2–8 items.
//
// Card text is meant to be skimmed: a one-line `summary`, one short paragraph that does not repeat it,
// and about three one-line highlights. A hover preview cannot scroll, so keep each card short enough
// to show in full (the long version lives on the resume).

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
    name: 'Robot Tour Autonomous Robot',
    dates: { start: '2022', end: '2024' },
    summary: '1st place at the Texas State Tournament.',
    description:
      'A Science Olympiad robot that has to drive a fixed course the same way every run. I was lead architect; my partner led the code development.',
    tech: ['C++', 'Arduino', 'PID control', 'IMU / gyro', 'PCB design'],
    highlights: [
      'C++/Arduino motion control with encoder distance tracking and IMU/gyro yaw estimation',
      'PID-style correction, S-curve acceleration, drift correction, turn calibration',
      'Custom PCB with gyroscope and Hall effect encoder feedback',
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
    summary: 'A solo-built knowledge graph for company documents.',
    description:
      'Turns company documents into a source-linked knowledge graph for AI agents. Claude extracts each fact with its source and authority (policy or tribal knowledge).',
    tech: ['Next.js', 'TypeScript', 'Prisma', 'PostgreSQL', 'pgvector', 'Anthropic API', 'Voyage AI'],
    highlights: [
      'A measured 0.75 merge threshold replaced a guessed 0.85 that missed a duplicate',
      'Semantic search ranks entities by pgvector similarity, verified on live data',
      'LLM spend capped by a ledger and a fail-closed budget gate',
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
    summary: "Qwen3-VL-2B speed on a phone's CPU, GPU and NPU.",
    description:
      "For the Purdue LPCVC team: a benchmark harness on Qualcomm's GenieX Android sample that records time-to-first-token, prefill speed and decode speed on each processor.",
    tech: ['Qwen3-VL-2B', 'Qualcomm GenieX', 'Android / adb'],
    highlights: [
      'GPU and NPU cut time-to-first-token 2–3× versus the CPU over 10 runs per configuration (cold start: 30.1 s to 9.6 s)',
      'Accuracy pilot scoring real-vs.-tampered image verdicts against a labeled dataset',
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
    summary: 'A website for queueing benchmark jobs on a shared phone.',
    description:
      "Teammates queue jobs on the team's Snapdragon phone from a website instead of using USB and adb. Live since October 2026, with sign-in limited to team members.",
    tech: ['Kotlin', 'FastAPI', 'Supabase', 'React', 'Vercel'],
    highlights: [
      'Kotlin worker app runs each job on the phone\'s CPU, GPU or NPU',
      'FastAPI and Supabase queue with Google sign-in; React site on Vercel',
      'First cloud job completed all 100 runs (10 images × 10 repetitions)',
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
    company: 'Low-Power Computer Vision Challenge',
    role: 'Purdue VIP LPCVC Team',
    dates: { start: '2026-08' },
    summary: 'On-device vision-language model benchmarking and remote-access infrastructure.',
    bullets: ['Built PhoneBench and the Qwen3-VL-2B benchmark harness (see Projects)'],
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
    body: 'Competition results, all from 2024.',
    bullets: [
      'Top 30 USA, PicoCTF',
      'AIME Qualifier',
      'CyberPatriot Nationals Semifinalist',
      '1st, Texas State Tournament: Science Olympiad Robot Tour',
      '2nd, Texas State Tournament: Science Olympiad Solar Power',
      'FBLA Nationals Qualifier',
    ],
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
