/**
 * The changelist shown behind the "Dev Notes" tag on the title screen.
 *
 * CONVENTION: newest entry on top, and add (or extend the top) entry on **every commit + push to
 * GitHub** so players/testers always see what changed in the build they're running. Keep bullets
 * short and player-facing. The most recent `date` doubles as the visible build stamp.
 */
export interface DevNote {
  /** ISO date of the push, e.g. '2026-07-01'. */
  date: string;
  /** One-line headline for the batch of changes. */
  title: string;
  /** Short, player-facing bullets. */
  changes: string[];
}

export const DEV_NOTES: DevNote[] = [
  {
    date: '2026-07-01',
    title: 'Three circuits, three places + live time of day',
    changes: [
      'Three genuinely different tracks: the flowing Verdant Loop, the long Coral Coast (hairpin + chicane), and the switchback Summit Pass.',
      'Summit Pass is now a proper mountain switchback — a tall cascade of hairpins on a narrow road (the Grand Derby finale).',
      'Each is set in its own place — green meadow, sandy coast with palms, alpine pines & scree — not just a recolour.',
      'The sky now follows YOUR real local time: dawn, day, dusk or night. Play in the evening, race under lights.',
      'In-race vitals panel shows live STAMINA, SPEED and CORNER gauges that move every tick.',
      'Staged tuning lights up as each effect fires, with live +/−% magnitude chips.',
      'Results screen Analysis tab: a lap-by-lap breakdown of the whole field (Position · Speed · Stamina · Corner).',
      'Added this Dev Notes tag.',
    ],
  },
];

/** Visible build stamp = the newest note's date. */
export const DEV_BUILD = DEV_NOTES[0]?.date ?? 'dev';
