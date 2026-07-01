/**
 * The changelist shown behind the "Dev Notes" tag on the title screen.
 *
 * CONVENTION: **prepend** a new entry on every commit + push — never replace or merge into an
 * existing one. Newest first. Each entry gets a unique `id` (same-day pushes are fine). Keep bullets
 * short and player-facing. `DEV_BUILD` = the newest entry's date (visible on the tag).
 */
export interface DevNote {
  /** Unique id for this build note (e.g. '2026-07-01-summit-switchback'). */
  id: string;
  /** ISO date of the push, e.g. '2026-07-01'. */
  date: string;
  /** One-line headline for this batch of changes. */
  title: string;
  /** Short, player-facing bullets — what changed in this build only. */
  changes: string[];
}

/** Newest first — scroll the Dev Notes panel to browse older builds. */
export const DEV_NOTES: DevNote[] = [
  {
    id: '2026-07-01-trail-none',
    date: '2026-07-01',
    title: 'No-trail option',
    changes: [
      'Title screen trail picker now has an × option to turn off your wake entirely.',
    ],
  },
  {
    id: '2026-07-01-dev-notes-scroll',
    date: '2026-07-01',
    title: 'Dev Notes history',
    changes: [
      'Each update now adds a new Dev Notes entry — older builds stay in the list.',
      'Scroll the Dev Notes panel to browse past changelogs.',
    ],
  },
  {
    id: '2026-07-01-summit-switchback',
    date: '2026-07-01',
    title: 'Summit Pass switchback',
    changes: [
      'Summit Pass is now a proper mountain switchback — a tall cascade of hairpins on a narrow road.',
      'The Grand Derby finale runs 2 laps (it\'s a long lap).',
      'Hairpin corners render cleanly — no more road folding or flickering curbs.',
    ],
  },
  {
    id: '2026-07-01-three-tracks',
    date: '2026-07-01',
    title: 'Three circuits, three places + live time of day',
    changes: [
      'Three genuinely different tracks: Verdant Loop, Coral Coast, and Summit Pass.',
      'Each cup has its own place — meadow, sandy coast with palms, alpine pines & scree.',
      'The sky follows your real local time: dawn, day, dusk or night.',
    ],
  },
  {
    id: '2026-07-01-live-vitals',
    date: '2026-07-01',
    title: 'Live race telemetry & post-race analysis',
    changes: [
      'In-race vitals panel: live STAMINA, SPEED and CORNER gauges that move every tick.',
      'Staged tuning lights up as each effect fires, with live +/−% magnitude chips.',
      'Results screen Analysis tab: lap-by-lap breakdown (Position · Speed · Stamina · Corner).',
      'Added this Dev Notes tag.',
    ],
  },
];

/** Visible build stamp = the newest note's date. */
export const DEV_BUILD = DEV_NOTES[0]?.date ?? 'dev';
