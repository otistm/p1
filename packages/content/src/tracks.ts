import type { TrackDef } from '@grid/sim';

/** Presentation metadata layered on top of the engine's TrackDef. */
export interface TrackMeta {
  theme: 'meadow' | 'sunset' | 'night';
  scenerySeed: number;
}

export interface TrackContent extends TrackDef {
  meta: TrackMeta;
}

/** The founding circuit — the prototype's varied-corner derby loop. */
export const SUNSET_DERBY: TrackContent = {
  id: 'sunset-derby',
  name: 'Sunset Derby',
  width: 11.5,
  laps: 3,
  samplesPerSegment: 22,
  points: [
    [46, 0],
    [43.8, 25.3],
    [23, 39.8],
    [0, 41.4],
    [-23, 39.8],
    [-43.8, 25.3],
    [-46, 0],
    [-35.9, -20.7],
    [-23, -39.8],
    [0, -50.6],
    [23, -39.8],
    [35.9, -20.7],
  ],
  meta: { theme: 'meadow', scenerySeed: 1337 },
};

export const TRACKS: Record<string, TrackContent> = {
  [SUNSET_DERBY.id]: SUNSET_DERBY,
};

export const DEFAULT_TRACK_ID = SUNSET_DERBY.id;
