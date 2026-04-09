// ── Record screen constants ──────────────────────────────────────────────────

export const MAX_PHOTOS = 5;

export interface HoldColour {
  label: string;
  hex: string;
}

export const HOLD_COLOURS: readonly HoldColour[] = [
  { label: 'Red', hex: '#ef4444' },
  { label: 'Blue', hex: '#3b82f6' },
  { label: 'Green', hex: '#22c55e' },
  { label: 'Yellow', hex: '#eab308' },
  { label: 'Black', hex: '#1f2937' },
  { label: 'Orange', hex: '#f97316' },
  { label: 'Purple', hex: '#a855f7' },
  { label: 'White', hex: '#f9fafb' },
  { label: 'Pink', hex: '#ec4899' },
];

export const GRADES: readonly string[] = [
  'VB',
  'V0',
  'V1',
  'V2',
  'V3',
  'V4',
  'V5',
  'V6',
  'V7',
  'V8',
  'V9',
  'V10',
  'V11',
  'V12',
  'V13',
  'V14',
  'V15',
  'V16',
  'V17',
];

export interface Project {
  id: string;
  label: string;
}

export const PROJECTS: readonly Project[] = [
  { id: 'p1', label: 'Main Project' },
  { id: 'p2', label: 'Summer Beta' },
  { id: 'p3', label: 'Moonboard Sessions' },
];

export const PROCESSING_MESSAGES: readonly string[] = [
  'Analysing holds…',
  'Matching problem…',
  'Almost there…',
];
